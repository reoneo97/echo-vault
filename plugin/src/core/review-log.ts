import { Vault } from "obsidian";
import { EchoVaultSettings } from "../types";
import { getTodayDateString } from "../utils";

export interface ReviewEntry {
    date: string;
    cardsReviewed: number;
    correct: number;
    totalRating: number;
}

export interface ReviewLogData {
    sessions: ReviewEntry[];
}

export class ReviewLog {
    private data: ReviewLogData = { sessions: [] };

    constructor(
        private vault: Vault,
        private settings: EchoVaultSettings
    ) {}

    private get filePath(): string {
        return `${this.settings.flashcardFolderPath}/review-log.json`;
    }

    async load(): Promise<void> {
        const adapter = this.vault.adapter;
        const exists = await adapter.exists(this.filePath);
        if (!exists) {
            this.data = { sessions: [] };
            return;
        }
        try {
            const raw = await adapter.read(this.filePath);
            this.data = JSON.parse(raw) as ReviewLogData;
        } catch {
            this.data = { sessions: [] };
        }
    }

    private async save(): Promise<void> {
        const adapter = this.vault.adapter;
        await adapter.write(this.filePath, JSON.stringify(this.data, null, 2));
    }

    async recordReview(correct: boolean, rating: number): Promise<void> {
        const today = getTodayDateString();
        let entry = this.data.sessions.find((s) => s.date === today);
        if (!entry) {
            entry = { date: today, cardsReviewed: 0, correct: 0, totalRating: 0 };
            this.data.sessions.push(entry);
        }
        entry.cardsReviewed++;
        if (correct) entry.correct++;
        entry.totalRating += rating;
        await this.save();
    }

    getStreak(): number {
        if (this.data.sessions.length === 0) return 0;

        const dates = new Set(this.data.sessions.map((s) => s.date));
        const today = new Date();
        let streak = 0;

        // Check if today has a session; if not, start from yesterday
        const todayStr = getTodayDateString();
        let current = new Date(today);
        if (!dates.has(todayStr)) {
            current.setDate(current.getDate() - 1);
        }

        while (true) {
            const dateStr = current.toISOString().split("T")[0];
            if (dates.has(dateStr)) {
                streak++;
                current.setDate(current.getDate() - 1);
            } else {
                break;
            }
        }

        return streak;
    }

    getTodayStats(): { reviewed: number; correct: number; avgRating: number } {
        const today = getTodayDateString();
        const entry = this.data.sessions.find((s) => s.date === today);
        if (!entry || entry.cardsReviewed === 0) {
            return { reviewed: 0, correct: 0, avgRating: 0 };
        }
        return {
            reviewed: entry.cardsReviewed,
            correct: entry.correct,
            avgRating: Math.round((entry.totalRating / entry.cardsReviewed) * 10) / 10,
        };
    }

    getRecentSessions(days: number): ReviewEntry[] {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - days);
        const cutoffStr = cutoff.toISOString().split("T")[0];
        return this.data.sessions
            .filter((s) => s.date >= cutoffStr)
            .sort((a, b) => a.date.localeCompare(b.date));
    }
}
