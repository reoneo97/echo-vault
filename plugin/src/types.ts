export type CardType = "standard" | "true_false" | "multiple_choice";

export interface Flashcard {
    id: string;
    type: CardType;
    question: string;
    answer: string;
    options?: string[];       // MCQ: list of choices
    correctAnswer?: string;   // MCQ: correct option text, T/F: "true" or "false"
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

export interface GenerateResponseCard {
    type?: CardType;
    question: string;
    answer: string;
    options?: string[];
    correct_answer?: string;
}

export interface GenerateResponse {
    cards: GenerateResponseCard[];
}
