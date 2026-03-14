export interface Flashcard {
    id: string;
    question: string;
    answer: string;
    sourceNotePath: string;
    commitHash: string;
    createdAt: string;
    lastReviewedAt: string | null;
    repetitions: number;
    easinessFactor: number;
    interval: number;
    nextReviewDate: string;
}

export interface FlashcardData {
    version: number;
    cards: Flashcard[];
}

export interface EchoVaultSettings {
    backendUrl: string;
    flashcardFolderPath: string;
    dataFileName: string;
    maxCardsPerGeneration: number;
}

export const DEFAULT_SETTINGS: EchoVaultSettings = {
    backendUrl: "http://localhost:8000",
    flashcardFolderPath: "EchoVault",
    dataFileName: "flashcards.json",
    maxCardsPerGeneration: 10,
};

export interface GenerateResponse {
    cards: { question: string; answer: string }[];
}
