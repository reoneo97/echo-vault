import { requestUrl } from "obsidian";
import { EchoVaultSettings, GenerateResponse, ImageAttachment, FileDiffPayload, BatchGenerateResponse, CardFeedbackEntry } from "../types";

export async function checkBackendHealth(
    settings: EchoVaultSettings
): Promise<boolean> {
    try {
        const res = await requestUrl({
            url: `${settings.backendUrl}/health`,
            method: "GET",
        });
        return res.status === 200 && res.json?.status === "ok";
    } catch {
        return false;
    }
}

export async function generateFlashcards(
    diffContent: string,
    sourceNote: string,
    settings: EchoVaultSettings,
    images: ImageAttachment[] = []
): Promise<GenerateResponse> {
    const res = await requestUrl({
        url: `${settings.backendUrl}/generate-flashcards`,
        method: "POST",
        contentType: "application/json",
        body: JSON.stringify({
            diff_content: diffContent,
            source_note: sourceNote,
            max_cards: settings.maxCardsPerGeneration,
            images: images.length > 0 ? images : undefined,
        }),
    });
    return res.json as GenerateResponse;
}

export async function generateFlashcardsBatch(
    files: FileDiffPayload[],
    maxCards: number,
    settings: EchoVaultSettings
): Promise<BatchGenerateResponse> {
    const res = await requestUrl({
        url: `${settings.backendUrl}/generate-flashcards-batch`,
        method: "POST",
        contentType: "application/json",
        body: JSON.stringify({
            files,
            max_cards: maxCards,
        }),
    });
    return res.json as BatchGenerateResponse;
}

export async function sendFeedback(
    entries: CardFeedbackEntry[],
    settings: EchoVaultSettings
): Promise<void> {
    await requestUrl({
        url: `${settings.backendUrl}/feedback`,
        method: "POST",
        contentType: "application/json",
        body: JSON.stringify({ entries }),
    });
}
