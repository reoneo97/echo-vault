import { Vault } from "obsidian";
import { Flashcard, FlashcardData, EchoVaultSettings } from "../types";
import { getTodayDateString } from "../utils";

const EMPTY_DATA: FlashcardData = { version: 1, cards: [], processedFiles: {}, importQueue: [] };

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
            const parsed = JSON.parse(raw) as FlashcardData;
            // Migrate older data missing newer fields
            this.data = { processedFiles: {}, importQueue: [], ...parsed };
            // Migrate cards missing reviewHistory or tags
            this.data.cards = this.data.cards.map((c) => ({
                ...c,
                reviewHistory: c.reviewHistory ?? [],
                tags: c.tags ?? [],
            }));
        } catch {
            this.data = { version: 1, cards: [], processedFiles: {} };
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

    async clearAll(): Promise<void> {
        this.data = { ...EMPTY_DATA, cards: [] };
        await this.save();
    }

    hasProcessedFile(filePath: string, contentHash: string): boolean {
        return this.data.processedFiles[filePath] === contentHash;
    }

    async recordProcessedFiles(files: { path: string; contentHash: string }[]): Promise<void> {
        const paths = new Set(files.map((f) => f.path));
        for (const f of files) {
            this.data.processedFiles[f.path] = f.contentHash;
        }
        this.data.importQueue = this.data.importQueue.filter((p) => !paths.has(p));
        await this.save();
    }

    getImportQueue(): string[] {
        return this.data.importQueue;
    }

    async initImportQueue(paths: string[]): Promise<void> {
        if (this.data.importQueue.length > 0) return;
        this.data.importQueue = [...paths];
        await this.save();
    }

    async removeFromImportQueue(paths: string[]): Promise<void> {
        const set = new Set(paths);
        this.data.importQueue = this.data.importQueue.filter((p) => !set.has(p));
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

    getForecast(): { tomorrow: number; thisWeek: number } {
        const todayStr = getTodayDateString();

        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowStr = tomorrow.toISOString().split("T")[0];

        const weekEnd = new Date();
        weekEnd.setDate(weekEnd.getDate() + 7);
        const weekEndStr = weekEnd.toISOString().split("T")[0];

        let tomorrowCount = 0;
        let thisWeekCount = 0;

        for (const card of this.data.cards) {
            if (card.nextReviewDate <= todayStr) continue;
            if (card.nextReviewDate === tomorrowStr) tomorrowCount++;
            if (card.nextReviewDate <= weekEndStr) thisWeekCount++;
        }

        return { tomorrow: tomorrowCount, thisWeek: thisWeekCount };
    }
}
