import { Notice, Vault, TFile } from "obsidian";
import { gitCommit, gitDiff, gitResetLastCommit, isOwnGitRepo, gitInit } from "./git";
import { generateFlashcardsBatch } from "./api-client";
import { FlashcardStore } from "./store";
import { Logger } from "./logger";
import { EchoVaultSettings, ImageAttachment, FileDiffPayload, GenerationResult, StagedCard, StagedFileGroup } from "../types";
import { generateId } from "../utils";

const IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "gif", "bmp", "webp"]);
const MAX_IMAGES = 5;
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5 MB

const MEDIA_TYPES: Record<string, string> = {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    bmp: "image/bmp",
    webp: "image/webp",
};

function extractImageRefs(text: string): string[] {
    const refs = new Set<string>();

    // Obsidian wikilinks: ![[image.png]] or ![[folder/image.png]]
    // Also handles aliases like ![[image.png|caption]]
    const wikiRegex = /!\[\[([^\]|]+\.(?:png|jpg|jpeg|gif|bmp|webp))(?:\|[^\]]*)?\]\]/gi;
    for (const match of text.matchAll(wikiRegex)) {
        refs.add(match[1].trim());
    }

    // Markdown links: ![alt](image.png) or ![alt](folder/image.png)
    const mdRegex = /!\[[^\]]*\]\(([^)]+\.(?:png|jpg|jpeg|gif|bmp|webp))\)/gi;
    for (const match of text.matchAll(mdRegex)) {
        refs.add(match[1].trim());
    }

    return [...refs];
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

async function resolveImages(
    refs: string[],
    vault: Vault
): Promise<ImageAttachment[]> {
    const attachments: ImageAttachment[] = [];

    // Build a name→path lookup for wikilink resolution (basename only)
    const filesByName = new Map<string, TFile>();
    for (const file of vault.getFiles()) {
        if (file instanceof TFile && IMAGE_EXTENSIONS.has(file.extension.toLowerCase())) {
            // First match wins (matches Obsidian's resolution behavior)
            if (!filesByName.has(file.name)) {
                filesByName.set(file.name, file);
            }
        }
    }

    for (const ref of refs.slice(0, MAX_IMAGES)) {
        try {
            let filePath: string | null = null;

            // Try direct path first
            if (await vault.adapter.exists(ref)) {
                filePath = ref;
            } else {
                // Search by basename (for wikilinks like ![[photo.png]])
                const basename = ref.split("/").pop() ?? ref;
                const found = filesByName.get(basename);
                if (found) {
                    filePath = found.path;
                }
            }

            if (!filePath) continue;

            // Check file size before reading
            const stat = await vault.adapter.stat(filePath);
            if (!stat || stat.size > MAX_IMAGE_SIZE) continue;

            const data = await vault.adapter.readBinary(filePath);
            const ext = filePath.split(".").pop()?.toLowerCase() ?? "";

            attachments.push({
                filename: filePath,
                data: arrayBufferToBase64(data),
                media_type: MEDIA_TYPES[ext] ?? "application/octet-stream",
            });
        } catch {
            // Skip images that can't be read
        }
    }

    return attachments;
}

export type GenerateStage = "committing" | "analyzing" | "generating";

export async function commitAndGenerate(
    vaultPath: string,
    vault: Vault,
    store: FlashcardStore,
    settings: EchoVaultSettings,
    logger?: Logger,
    onProgress?: (stage: GenerateStage) => void
): Promise<GenerationResult | null> {
    logger?.info("commitAndGenerate started", { vaultPath });

    // Ensure the vault has its own git repo (not a parent's)
    if (!(await isOwnGitRepo(vaultPath))) {
        logger?.info("No git repo found, initializing");
        new Notice("Initializing git repository in vault...");
        await gitInit(vaultPath);
        // Need an initial commit first
        const initial = await gitCommit(vaultPath, "Initial commit");
        if (!initial.hasChanges) {
            new Notice("No files to commit.");
            return null;
        }
    }

    // Commit current changes
    onProgress?.("committing");
    new Notice("Committing vault changes...");
    const commitResult = await gitCommit(
        vaultPath,
        `EchoVault: ${new Date().toLocaleString()}`
    );

    if (!commitResult.hasChanges) {
        logger?.info("No changes to commit");
        new Notice("No changes to commit.");
        return null;
    }

    logger?.info("Committed", { hash: commitResult.hash });

    // Check for duplicate commit
    if (store.hasCommit(commitResult.hash)) {
        logger?.warn("Duplicate commit skipped", { hash: commitResult.hash });
        new Notice("This commit has already been processed.");
        return null;
    }

    // Get per-file diffs
    onProgress?.("analyzing");
    const { files } = await gitDiff(vaultPath, commitResult.hash);

    logger?.info("Diff retrieved", {
        fileCount: files.length,
        files: files.map((f) => f.path),
    });

    if (files.length === 0) {
        logger?.info("Empty diff, skipping");
        new Notice("No new text content in this commit.");
        return null;
    }

    // Resolve images per file
    const payloads: FileDiffPayload[] = [];
    for (const file of files) {
        const imageRefs = extractImageRefs(file.content);
        let images: ImageAttachment[] = [];
        if (imageRefs.length > 0) {
            images = await resolveImages(imageRefs, vault);
            logger?.info("Images resolved", { file: file.path, refs: imageRefs, resolved: images.length });
        }
        payloads.push({
            path: file.path,
            diff_content: file.content,
            ...(images.length > 0 ? { images } : {}),
        });
    }

    // Call backend
    onProgress?.("generating");
    new Notice(`Generating flashcards from ${files.length} file${files.length > 1 ? "s" : ""}...`);

    let response;
    try {
        response = await generateFlashcardsBatch(payloads, settings.maxCardsPerGeneration, settings);
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        logger?.error("Backend call failed, reverting commit", { error: msg });
        await gitResetLastCommit(vaultPath);
        logger?.info("Commit reverted", { hash: commitResult.hash });
        new Notice(`Failed to generate flashcards: ${msg}. Commit reverted — retry when backend is online.`);
        return null;
    }

    // Build staged cards for review
    const fileGroups: StagedFileGroup[] = [];
    for (const fileResult of response.file_results) {
        const cards: StagedCard[] = fileResult.cards.map((c) => ({
            tempId: generateId(),
            question: c.question,
            answer: c.answer,
            sourceNotePath: fileResult.source_note,
            commitHash: commitResult.hash,
            decision: null,
        }));
        if (cards.length > 0) {
            fileGroups.push({ sourceNote: fileResult.source_note, cards });
        }
    }

    const totalCards = fileGroups.reduce((sum, fg) => sum + fg.cards.length, 0);
    if (totalCards === 0) {
        logger?.warn("Backend returned no cards");
        new Notice("No flashcards were generated from this diff.");
        return null;
    }

    logger?.info("Cards generated for staging", { count: totalCards });
    return { commitHash: commitResult.hash, fileGroups, totalCards };
}
