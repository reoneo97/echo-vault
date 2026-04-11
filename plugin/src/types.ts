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
    hasSeenTutorial: boolean;
}

export const DEFAULT_SETTINGS: EchoVaultSettings = {
    backendUrl: "http://localhost:8000",
    flashcardFolderPath: "EchoVault",
    dataFileName: "flashcards.json",
    maxCardsPerGeneration: 10,
    hasSeenTutorial: false,
};

export interface ImageAttachment {
    filename: string;
    data: string; // base64
    media_type: string;
}

export interface GenerateResponse {
    cards: { question: string; answer: string }[];
}

export interface FileDiffPayload {
    path: string;
    diff_content: string;
    images?: ImageAttachment[];
}

export interface FileResult {
    source_note: string;
    cards: { question: string; answer: string }[];
    error?: string;
}

export interface BatchGenerateResponse {
    file_results: FileResult[];
}

// Staging types
export type StagingDecision = "accepted" | "rejected" | "edited";

export interface StagedCard {
    tempId: string;
    question: string;
    answer: string;
    sourceNotePath: string;
    commitHash: string;
    decision: StagingDecision | null;
    editedQuestion?: string;
    editedAnswer?: string;
}

export interface StagedFileGroup {
    sourceNote: string;
    cards: StagedCard[];
}

export interface GenerationResult {
    commitHash: string;
    fileGroups: StagedFileGroup[];
    totalCards: number;
}

// Feedback types
export interface CardFeedbackEntry {
    question: string;
    answer: string;
    source_note: string;
    commit_hash: string;
    decision: StagingDecision;
    edited_question?: string;
    edited_answer?: string;
}
