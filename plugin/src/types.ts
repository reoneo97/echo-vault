export type CardType = "qa" | "mcq" | "tf";

export interface BaseFlashcard {
    id: string;
    type: CardType;
    question: string;
    answer: string;
    sourceNotePath: string;
    commitHash: string | null;
    createdAt: string;
    lastReviewedAt: string | null;
    repetitions: number;
    easinessFactor: number;
    interval: number;
    nextReviewDate: string;
}

export interface QAFlashcard extends BaseFlashcard {
    type: "qa";
}

export interface MCQFlashcard extends BaseFlashcard {
    type: "mcq";
    choices: string[];
    correctIndex: number;
}

export interface TFFlashcard extends BaseFlashcard {
    type: "tf";
    correctValue: boolean;
}

export type Flashcard = QAFlashcard | MCQFlashcard | TFFlashcard;

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
