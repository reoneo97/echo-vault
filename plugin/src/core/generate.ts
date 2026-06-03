import { Notice, Vault, TFile } from "obsidian";
import { gitCommit, gitDiff, gitResetLastCommit, isOwnGitRepo, gitInit, gitHasCommits, gitCommitAllowEmpty } from "./git";
import { generateFlashcardsBatch } from "./api-client";
import { FlashcardStore } from "./store";
import { Logger } from "./logger";
import { EchoVaultSettings, ImageAttachment, FileDiffPayload, GenerationResult, StagedCard, StagedFileGroup, FileResult } from "../types";
import { generateId, hashContent, cardBudget } from "../utils";

/** Maps a backend FileResult card to the type fields needed by StagedCard. */
function mapCardTypeFields(c: FileResult["cards"][number]): Pick<StagedCard, "cardType" | "choices" | "correctIndex" | "correctValue"> {
    if (c.type === "multiple_choice" && c.options && c.options.length > 0) {
        const correctIndex = c.correct_answer ? c.options.indexOf(c.correct_answer) : 0;
        return { cardType: "mcq", choices: c.options, correctIndex: Math.max(0, correctIndex) };
    }
    if (c.type === "true_false") {
        return { cardType: "tf", correctValue: c.correct_answer === "True" };
    }
    return { cardType: "qa" };
}

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

const MAX_FILES_PER_COMMIT_BATCH = 10;

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
    }

    // If the repo already has commits (e.g. user brought an existing git vault),
    // git init is safe — it preserves all history. But we skip the auto-initial-commit
    // so we don't process the entire history; instead we only generate from new changes.
    const hasCommits = await gitHasCommits(vaultPath);

    // Commit current changes
    onProgress?.("committing");
    new Notice("Committing vault changes...");

    // If repo has no commits yet (fresh init), make an initial commit first
    if (!hasCommits) {
        const initial = await gitCommit(vaultPath, "Initial commit");
        if (!initial.hasChanges) {
            new Notice("No files to commit.");
            return null;
        }
    }

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

    // Filter out files whose content hasn't changed since last processing
    const unprocessedFiles = files.filter((f) => !store.hasProcessedFile(f.path, hashContent(f.content)));
    if (unprocessedFiles.length < files.length) {
        logger?.info("Skipping already-processed files", { skipped: files.length - unprocessedFiles.length });
    }
    if (unprocessedFiles.length === 0) {
        new Notice("All changed files have already been processed.");
        return null;
    }

    // Cap files per staging session — overflow goes to import queue for gradual processing
    let filesToProcess = unprocessedFiles;
    if (unprocessedFiles.length > MAX_FILES_PER_COMMIT_BATCH) {
        const overflow = unprocessedFiles.slice(MAX_FILES_PER_COMMIT_BATCH).map((f) => f.path);
        await store.initImportQueue(overflow);
        filesToProcess = unprocessedFiles.slice(0, MAX_FILES_PER_COMMIT_BATCH);
        logger?.info("Capped commit batch, queued overflow", { processing: filesToProcess.length, queued: overflow.length });
        new Notice(`Processing ${MAX_FILES_PER_COMMIT_BATCH} of ${unprocessedFiles.length} changed files. ${overflow.length} more queued — use "Import Existing Notes" to continue.`);
    }

    // Resolve images per file
    const payloads: FileDiffPayload[] = [];
    for (const file of filesToProcess) {
        const imageRefs = extractImageRefs(file.content);
        let images: ImageAttachment[] = [];
        if (imageRefs.length > 0) {
            images = await resolveImages(imageRefs, vault);
            logger?.info("Images resolved", { file: file.path, refs: imageRefs, resolved: images.length });
        }
        payloads.push({
            path: file.path,
            diff_content: file.content,
            max_cards: cardBudget(file.content),
            ...(images.length > 0 ? { images } : {}),
        });
    }

    // Call backend in chunks to avoid overwhelming the API for large vaults
    const CHUNK_SIZE = 20;
    const chunks: FileDiffPayload[][] = [];
    for (let i = 0; i < payloads.length; i += CHUNK_SIZE) {
        chunks.push(payloads.slice(i, i + CHUNK_SIZE));
    }

    onProgress?.("generating");
    const totalFiles = filesToProcess.length;
    const isLargeVault = chunks.length > 1;

    const fileGroups: StagedFileGroup[] = [];
    let totalFailures = 0;

    for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        if (isLargeVault) {
            new Notice(`Generating flashcards... (batch ${i + 1}/${chunks.length}, files ${i * CHUNK_SIZE + 1}–${Math.min((i + 1) * CHUNK_SIZE, totalFiles)} of ${totalFiles})`);
        } else {
            new Notice(`Generating flashcards from ${totalFiles} file${totalFiles > 1 ? "s" : ""}... (this may take a moment)`);
        }

        let response;
        try {
            response = await generateFlashcardsBatch(chunk, settings.maxCardsPerGeneration, settings);
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            logger?.error("Backend call failed, reverting commit", { error: msg });
            await gitResetLastCommit(vaultPath);
            logger?.info("Commit reverted", { hash: commitResult.hash });
            new Notice(`Failed to generate flashcards: ${msg}. Commit reverted — retry when backend is online.`);
            return null;
        }

        // Collect failures
        const failedFiles = response.file_results.filter((fr) => fr.error);
        totalFailures += failedFiles.length;
        if (failedFiles.length > 0) {
            logger?.warn("Some files failed after retries", { files: failedFiles.map((fr) => fr.source_note) });
        }

        for (const fileResult of response.file_results) {
            const cards: StagedCard[] = fileResult.cards.map((c) => ({
                tempId: generateId(),
                question: c.question,
                answer: c.answer,
                sourceNotePath: fileResult.source_note,
                commitHash: commitResult.hash,
                decision: null,
                ...mapCardTypeFields(c),
            }));
            if (cards.length > 0) {
                fileGroups.push({ sourceNote: fileResult.source_note, cards });
            }
        }
    }

    if (totalFailures > 0) {
        new Notice(`${totalFailures} file${totalFailures > 1 ? "s" : ""} failed to generate cards after retries.`);
    }

    const totalCards = fileGroups.reduce((sum, fg) => sum + fg.cards.length, 0);
    if (totalCards === 0) {
        logger?.warn("Backend returned no cards");
        new Notice("No flashcards were generated from this diff.");
        return null;
    }

    const processedFiles = filesToProcess.map((f) => ({ path: f.path, contentHash: hashContent(f.content) }));
    logger?.info("Cards generated for staging", { count: totalCards });
    return { commitHash: commitResult.hash, fileGroups, totalCards, processedFiles };
}

/**
 * Generates flashcards from a specific set of files chosen by the user.
 * Used by the import queue panel where the user selects up to 10 notes at a time.
 */
export async function importSelected(
    filePaths: string[],
    vaultPath: string,
    vault: Vault,
    store: FlashcardStore,
    settings: EchoVaultSettings,
    logger?: Logger,
    onProgress?: (completed: number, total: number) => void,
): Promise<GenerationResult | null> {
    logger?.info("importSelected started", { count: filePaths.length });

    const payloads: FileDiffPayload[] = [];
    for (const filePath of filePaths) {
        try {
            const content = await vault.adapter.read(filePath);
            if (!content.trim()) continue;

            const imageRefs = extractImageRefs(content);
            let images: ImageAttachment[] = [];
            if (imageRefs.length > 0) {
                images = await resolveImages(imageRefs, vault);
            }

            payloads.push({
                path: filePath,
                diff_content: content,
                max_cards: cardBudget(content),
                ...(images.length > 0 ? { images } : {}),
            });
        } catch {
            logger?.warn("Could not read file", { filePath });
        }
    }

    if (payloads.length === 0) {
        new Notice("No readable files in selection.");
        return null;
    }

    let commitHash: string;
    try {
        commitHash = await gitCommitAllowEmpty(vaultPath, "EchoVault: import selected notes");
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        new Notice(`Git error: ${msg}`);
        return null;
    }

    new Notice(`Generating cards from ${payloads.length} note${payloads.length !== 1 ? "s" : ""}...`);

    const CHUNK_SIZE = 20;
    const chunks: FileDiffPayload[][] = [];
    for (let i = 0; i < payloads.length; i += CHUNK_SIZE) {
        chunks.push(payloads.slice(i, i + CHUNK_SIZE));
    }

    const fileGroups: StagedFileGroup[] = [];
    let completedFiles = 0;
    onProgress?.(0, payloads.length);

    for (let i = 0; i < chunks.length; i++) {
        if (chunks.length > 1) new Notice(`Generating... (batch ${i + 1}/${chunks.length})`);

        let response;
        try {
            response = await generateFlashcardsBatch(chunks[i], settings.maxCardsPerGeneration, settings);
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            logger?.error("Batch failed during importSelected", { batch: i + 1, error: msg });
            new Notice(`Batch ${i + 1} failed: ${msg}`);
            completedFiles += chunks[i].length;
            onProgress?.(completedFiles, payloads.length);
            continue;
        }

        for (const fileResult of response.file_results) {
            const cards: StagedCard[] = fileResult.cards.map((c) => ({
                tempId: generateId(),
                question: c.question,
                answer: c.answer,
                sourceNotePath: fileResult.source_note,
                commitHash,
                decision: null,
                ...mapCardTypeFields(c),
            }));
            if (cards.length > 0) {
                fileGroups.push({ sourceNote: fileResult.source_note, cards });
            }
            completedFiles++;
            onProgress?.(completedFiles, payloads.length);
        }
    }

    const totalCards = fileGroups.reduce((sum, fg) => sum + fg.cards.length, 0);
    if (totalCards === 0) {
        logger?.warn("importSelected produced no cards");
        new Notice("No flashcards generated from selected notes.");
        return null;
    }

    const processedFiles = payloads.map((p) => ({ path: p.path, contentHash: hashContent(p.diff_content) }));
    logger?.info("importSelected staged", { totalCards, files: payloads.length });
    return { commitHash, fileGroups, totalCards, processedFiles };
}

/**
 * Imports an entire vault by processing all markdown files, skipping any that
 * have already been processed. Creates a single allow-empty commit as a
 * version checkpoint, then sends files to the backend in chunks.
 */
export async function importVault(
    vaultPath: string,
    vault: Vault,
    store: FlashcardStore,
    settings: EchoVaultSettings,
    logger?: Logger,
): Promise<GenerationResult | null> {
    logger?.info("importVault started");

    if (!(await isOwnGitRepo(vaultPath))) {
        new Notice("Initialize a git repository first.");
        return null;
    }

    // Collect all markdown files, excluding EchoVault data folder and .obsidian
    const EXCLUDED_PREFIXES = [settings.flashcardFolderPath + "/", ".obsidian/"];
    const allFiles = vault.getMarkdownFiles().filter(
        (f) => !EXCLUDED_PREFIXES.some((prefix) => f.path.startsWith(prefix))
    );

    if (allFiles.length === 0) {
        new Notice("No markdown files found in vault.");
        return null;
    }

    new Notice(`Scanning ${allFiles.length} note${allFiles.length !== 1 ? "s" : ""}...`);

    // Build payloads, skipping already-processed files
    const payloads: FileDiffPayload[] = [];
    let skippedCount = 0;

    for (const file of allFiles) {
        try {
            const content = await vault.adapter.read(file.path);
            if (!content.trim()) continue;

            if (store.hasProcessedFile(file.path, hashContent(content))) {
                skippedCount++;
                continue;
            }

            const imageRefs = extractImageRefs(content);
            let images: ImageAttachment[] = [];
            if (imageRefs.length > 0) {
                images = await resolveImages(imageRefs, vault);
            }

            payloads.push({
                path: file.path,
                diff_content: content,
                ...(images.length > 0 ? { images } : {}),
            });
        } catch {
            // Skip unreadable files
        }
    }

    if (skippedCount > 0) {
        logger?.info("Skipping already-processed files", { count: skippedCount });
    }

    if (payloads.length === 0) {
        new Notice("All notes have already been processed.");
        return null;
    }

    // Single allow-empty commit as a version checkpoint for all imported cards
    let commitHash: string;
    try {
        commitHash = await gitCommitAllowEmpty(vaultPath, "EchoVault: vault import");
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        logger?.error("Allow-empty commit failed during import", { error: msg });
        new Notice(`Git error: ${msg}`);
        return null;
    }

    if (store.hasCommit(commitHash)) {
        new Notice("This import checkpoint has already been processed.");
        return null;
    }

    // Process in chunks
    const CHUNK_SIZE = 20;
    const chunks: FileDiffPayload[][] = [];
    for (let i = 0; i < payloads.length; i += CHUNK_SIZE) {
        chunks.push(payloads.slice(i, i + CHUNK_SIZE));
    }

    const fileGroups: StagedFileGroup[] = [];
    let totalFailures = 0;

    for (let i = 0; i < chunks.length; i++) {
        new Notice(`Importing vault... (batch ${i + 1}/${chunks.length}, ${payloads.length} notes total)`);

        let response;
        try {
            response = await generateFlashcardsBatch(chunks[i], settings.maxCardsPerGeneration, settings);
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            logger?.error("Batch failed during import", { batch: i + 1, error: msg });
            new Notice(`Batch ${i + 1}/${chunks.length} failed: ${msg}`);
            totalFailures += chunks[i].length;
            continue;
        }

        totalFailures += response.file_results.filter((fr) => fr.error).length;

        for (const fileResult of response.file_results) {
            const cards: StagedCard[] = fileResult.cards.map((c) => ({
                tempId: generateId(),
                question: c.question,
                answer: c.answer,
                sourceNotePath: fileResult.source_note,
                commitHash,
                decision: null,
                ...mapCardTypeFields(c),
            }));
            if (cards.length > 0) {
                fileGroups.push({ sourceNote: fileResult.source_note, cards });
            }
        }
    }

    if (totalFailures > 0) {
        new Notice(`${totalFailures} file${totalFailures !== 1 ? "s" : ""} failed during import.`);
    }

    const totalCards = fileGroups.reduce((sum, fg) => sum + fg.cards.length, 0);
    if (totalCards === 0) {
        logger?.warn("Import produced no cards");
        new Notice("No flashcards were generated from the vault.");
        return null;
    }

    const processedFiles = payloads.map((p) => ({
        path: p.path,
        contentHash: hashContent(p.diff_content),
    }));

    logger?.info("Vault import staged", { totalCards, files: payloads.length, skipped: skippedCount });
    return { commitHash, fileGroups, totalCards, processedFiles };
}

/**
 * Force-generates flashcards from the full current content of a single file,
 * regardless of whether it has been processed before. Creates an allow-empty
 * git commit for version tracking so cards can be traced back to a repo state.
 */
export async function forceGenerateFromFile(
    filePath: string,
    vaultPath: string,
    vault: Vault,
    store: FlashcardStore,
    settings: EchoVaultSettings,
    logger?: Logger,
): Promise<GenerationResult | null> {
    logger?.info("forceGenerateFromFile started", { filePath });

    let content: string;
    try {
        content = await vault.adapter.read(filePath);
    } catch {
        new Notice(`Could not read file: ${filePath}`);
        return null;
    }

    if (!content.trim()) {
        new Notice("File is empty — no cards to generate.");
        return null;
    }

    if (store.hasProcessedFile(filePath, hashContent(content))) {
        new Notice(`Note unchanged since last processed — generating anyway.`);
        logger?.info("Force regenerating already-processed file", { filePath });
    }

    // Resolve any embedded images
    const imageRefs = extractImageRefs(content);
    let images: ImageAttachment[] = [];
    if (imageRefs.length > 0) {
        images = await resolveImages(imageRefs, vault);
        logger?.info("Images resolved", { file: filePath, resolved: images.length });
    }

    const payload: FileDiffPayload = {
        path: filePath,
        diff_content: content,
        max_cards: cardBudget(content),
        ...(images.length > 0 ? { images } : {}),
    };

    // Create an allow-empty commit for version tracking
    new Notice(`Creating checkpoint for ${filePath.split("/").pop()}...`);
    let commitHash: string;
    try {
        commitHash = await gitCommitAllowEmpty(vaultPath, `EchoVault: force regenerate ${filePath}`);
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        logger?.error("Allow-empty commit failed", { error: msg });
        new Notice(`Git error: ${msg}`);
        return null;
    }

    // Check this commit hasn't already been used (shouldn't happen with allow-empty, but guard anyway)
    if (store.hasCommit(commitHash)) {
        new Notice("This commit has already been processed.");
        return null;
    }

    new Notice(`Generating cards from ${filePath.split("/").pop()}...`);
    let response;
    try {
        response = await generateFlashcardsBatch([payload], settings.maxCardsPerGeneration, settings);
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        logger?.error("Backend call failed", { error: msg });
        new Notice(`Failed to generate flashcards: ${msg}`);
        return null;
    }

    const fileGroups: StagedFileGroup[] = [];
    for (const fileResult of response.file_results) {
        const cards: StagedCard[] = fileResult.cards.map((c) => ({
            tempId: generateId(),
            question: c.question,
            answer: c.answer,
            sourceNotePath: fileResult.source_note,
            commitHash,
            decision: null,
        }));
        if (cards.length > 0) {
            fileGroups.push({ sourceNote: fileResult.source_note, cards });
        }
    }

    const totalCards = fileGroups.reduce((sum, fg) => sum + fg.cards.length, 0);
    if (totalCards === 0) {
        logger?.warn("Backend returned no cards for force regenerate");
        new Notice("No flashcards were generated from this file.");
        return null;
    }

    logger?.info("Force regenerate cards staged", { count: totalCards });
    return {
        commitHash,
        fileGroups,
        totalCards,
        processedFiles: [{ path: filePath, contentHash: hashContent(content) }],
    };
}
