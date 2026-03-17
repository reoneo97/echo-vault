import { Notice } from "obsidian";
import { gitCommit, gitDiff, isOwnGitRepo, gitInit } from "./git";
import { generateFlashcards } from "./api-client";
import { FlashcardStore } from "./store";
import { EchoVaultSettings, Flashcard } from "./types";
import { generateId, nowISO, getTodayDateString } from "./utils";

export async function commitAndGenerate(
    vaultPath: string,
    store: FlashcardStore,
    settings: EchoVaultSettings
): Promise<void> {
    // Ensure the vault has its own git repo (not a parent's)
    if (!(await isOwnGitRepo(vaultPath))) {
        new Notice("Initializing git repository in vault...");
        await gitInit(vaultPath);
        // Need an initial commit first
        const initial = await gitCommit(vaultPath, "Initial commit");
        if (!initial.hasChanges) {
            new Notice("No files to commit.");
            return;
        }
    }

    // Commit current changes
    new Notice("Committing vault changes...");
    const commitResult = await gitCommit(
        vaultPath,
        `EchoVault: ${new Date().toLocaleString()}`
    );

    if (!commitResult.hasChanges) {
        new Notice("No changes to commit.");
        return;
    }

    // Check for duplicate commit
    if (store.hasCommit(commitResult.hash)) {
        new Notice("This commit has already been processed.");
        return;
    }

    // Get diff
    const { diffText, changedFiles } = await gitDiff(
        vaultPath,
        commitResult.hash
    );

    if (!diffText.trim()) {
        new Notice("No new text content in this commit.");
        return;
    }

    // Call backend
    new Notice("Generating flashcards...");
    const sourceNote = changedFiles.length > 0 ? changedFiles[0] : "unknown";

    let response;
    try {
        response = await generateFlashcards(diffText, sourceNote, settings);
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        new Notice(`Failed to generate flashcards: ${msg}`);
        return;
    }

    if (!response.cards || response.cards.length === 0) {
        new Notice("No flashcards were generated from this diff.");
        return;
    }

    // Create Flashcard objects
    const now = nowISO();
    const today = getTodayDateString();
    const newCards: Flashcard[] = response.cards.map((c) => ({
        id: generateId(),
        type: "qa" as const,
        question: c.question,
        answer: c.answer,
        sourceNotePath: sourceNote,
        commitHash: commitResult.hash,
        createdAt: now,
        lastReviewedAt: null,
        repetitions: 0,
        easinessFactor: 2.5,
        interval: 0,
        nextReviewDate: today,
    }));

    await store.addCards(newCards);
    new Notice(`Created ${newCards.length} new flashcard(s)!`);
}
