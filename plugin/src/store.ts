import { Vault } from "obsidian";
import { Flashcard, FlashcardData, EchoVaultSettings } from "./types";
import { getTodayDateString } from "./utils";

const EMPTY_DATA: FlashcardData = { version: 1, cards: [] };

export class FlashcardStore {
    private data: FlashcardData = { ...EMPTY_DATA, cards: [] };

    constructor(
        private vault: Vault,
        private settings: EchoVaultSettings
    ) {}

    private get filePath(): string {
        return `${this.settings.flashcardFolderPath}/${this.settings.dataFileName}`;
    }

    async load(): Promise<void> {
        const adapter = this.vault.adapter;
        const folderExists = await adapter.exists(
            this.settings.flashcardFolderPath
        );
        if (!folderExists) {
            await adapter.mkdir(this.settings.flashcardFolderPath);
        }

        const fileExists = await adapter.exists(this.filePath);
        if (!fileExists) {
            this.data = { version: 1, cards: [] };
            await this.save();
            return;
        }

        try {
            const raw = await adapter.read(this.filePath);
            this.data = JSON.parse(raw) as FlashcardData;
        } catch {
            this.data = { version: 1, cards: [] };
            await this.save();
        }
    }

    async save(): Promise<void> {
        const adapter = this.vault.adapter;
        const folderExists = await adapter.exists(
            this.settings.flashcardFolderPath
        );
        if (!folderExists) {
            await adapter.mkdir(this.settings.flashcardFolderPath);
        }
        await adapter.write(this.filePath, JSON.stringify(this.data, null, 2));
    }

    async addCards(cards: Flashcard[]): Promise<void> {
        this.data.cards.push(...cards);
        await this.save();
    }

    getDueCards(): Flashcard[] {
        const today = getTodayDateString();
        return this.data.cards.filter((c) => c.nextReviewDate <= today);
    }

    async updateCard(card: Flashcard): Promise<void> {
        const idx = this.data.cards.findIndex((c) => c.id === card.id);
        if (idx !== -1) {
            this.data.cards[idx] = card;
            await this.save();
        }
    }

    getAllCards(): Flashcard[] {
        return [...this.data.cards];
    }

    async deleteCard(id: string): Promise<void> {
        this.data.cards = this.data.cards.filter((c) => c.id !== id);
        await this.save();
    }

    hasCommit(commitHash: string): boolean {
        return this.data.cards.some((c) => c.commitHash === commitHash);
    }

    getStats(): { total: number; due: number } {
        return {
            total: this.data.cards.length,
            due: this.getDueCards().length,
        };
    }
}
