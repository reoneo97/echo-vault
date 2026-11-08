import { requestUrl } from "obsidian";
import { EchoVaultSettings, FileDiffPayload, BatchGenerateResponse, CardFeedbackEntry, ReviewEvent } from "./types";

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

export async function sendReviewEvents(
    events: ReviewEvent[],
    settings: EchoVaultSettings
): Promise<void> {
    if (events.length === 0) return;
    await requestUrl({
        url: `${settings.backendUrl}/review-events`,
        method: "POST",
        contentType: "application/json",
        body: JSON.stringify({ events }),
    });
}
