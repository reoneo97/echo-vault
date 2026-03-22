import { describe, it, expect, beforeEach, vi } from "vitest";
import { FlashcardStore } from "../store";
import { Flashcard, EchoVaultSettings, DEFAULT_SETTINGS } from "../types";

function createMockVault(data: Record<string, string> = {}) {
    const store = new Map(Object.entries(data));
    return {
        adapter: {
            exists: vi.fn(async (path: string) => store.has(path)),
            mkdir: vi.fn(async () => {}),
            read: vi.fn(async (path: string) => store.get(path) ?? ""),
            write: vi.fn(async (path: string, content: string) => {
                store.set(path, content);
            }),
        },
        // expose for assertions
        _store: store,
    };
}

function makeCard(overrides: Partial<Flashcard> = {}): Flashcard {
    return {
        id: "test-1",
        type: "qa",
        question: "What is X?",
        answer: "X is Y.",
        sourceNotePath: "notes/test.md",
        commitHash: "abc123",
        createdAt: "2026-01-01T00:00:00.000Z",
        lastReviewedAt: null,
        repetitions: 0,
        easinessFactor: 2.5,
        interval: 0,
        nextReviewDate: "2026-01-01",
        ...overrides,
    } as Flashcard;
}

describe("FlashcardStore", () => {
    let vault: ReturnType<typeof createMockVault>;
    let store: FlashcardStore;
    const settings: EchoVaultSettings = { ...DEFAULT_SETTINGS };

    beforeEach(async () => {
        vault = createMockVault();
        store = new FlashcardStore(vault as any, settings);
        await store.load();
    });

    describe("load", () => {
        it("initializes with empty cards when no file exists", async () => {
            expect(store.getAllCards()).toEqual([]);
        });

        it("creates folder if it does not exist", async () => {
            expect(vault.adapter.mkdir).toHaveBeenCalledWith(
                settings.flashcardFolderPath
            );
        });

        it("loads existing data from file", async () => {
            const card = makeCard();
            const data = { version: 1, cards: [card] };
            const filePath = `${settings.flashcardFolderPath}/${settings.dataFileName}`;
            const vaultWithData = createMockVault({
                [filePath]: JSON.stringify(data),
            });
            const storeWithData = new FlashcardStore(
                vaultWithData as any,
                settings
            );
            await storeWithData.load();
            expect(storeWithData.getAllCards()).toHaveLength(1);
            expect(storeWithData.getAllCards()[0].id).toBe("test-1");
        });
    });

    describe("addCards", () => {
        it("adds cards and persists to disk", async () => {
            const card = makeCard();
            await store.addCards([card]);
            expect(store.getAllCards()).toHaveLength(1);
            expect(vault.adapter.write).toHaveBeenCalled();
        });

        it("adds multiple cards at once", async () => {
            const cards = [
                makeCard({ id: "a" }),
                makeCard({ id: "b" }),
                makeCard({ id: "c" }),
            ];
            await store.addCards(cards);
            expect(store.getAllCards()).toHaveLength(3);
        });
    });

    describe("getDueCards", () => {
        it("returns cards with nextReviewDate <= today", async () => {
            const today = new Date().toISOString().split("T")[0];
            const past = "2020-01-01";
            const future = "2099-12-31";

            await store.addCards([
                makeCard({ id: "due-today", nextReviewDate: today }),
                makeCard({ id: "due-past", nextReviewDate: past }),
                makeCard({ id: "not-due", nextReviewDate: future }),
            ]);

            const due = store.getDueCards();
            const dueIds = due.map((c) => c.id);
            expect(dueIds).toContain("due-today");
            expect(dueIds).toContain("due-past");
            expect(dueIds).not.toContain("not-due");
        });
    });

    describe("updateCard", () => {
        it("updates an existing card by id", async () => {
            await store.addCards([makeCard({ id: "upd" })]);
            const updated = makeCard({
                id: "upd",
                question: "Updated question",
            });
            await store.updateCard(updated);
            expect(store.getAllCards()[0].question).toBe("Updated question");
        });

        it("does nothing if card id not found", async () => {
            await store.addCards([makeCard({ id: "exists" })]);
            const writeBefore = vault.adapter.write.mock.calls.length;
            await store.updateCard(makeCard({ id: "nope" }));
            // write should not be called again
            expect(vault.adapter.write.mock.calls.length).toBe(writeBefore);
        });
    });

    describe("deleteCard", () => {
        it("removes a card by id", async () => {
            await store.addCards([makeCard({ id: "del" }), makeCard({ id: "keep" })]);
            await store.deleteCard("del");
            const ids = store.getAllCards().map((c) => c.id);
            expect(ids).toEqual(["keep"]);
        });
    });

    describe("hasCommit", () => {
        it("returns true if any card has the commit hash", async () => {
            await store.addCards([makeCard({ commitHash: "abc" })]);
            expect(store.hasCommit("abc")).toBe(true);
        });

        it("returns false for unknown commit hash", async () => {
            expect(store.hasCommit("unknown")).toBe(false);
        });
    });

    describe("getStats", () => {
        it("returns total and due counts", async () => {
            const today = new Date().toISOString().split("T")[0];
            await store.addCards([
                makeCard({ id: "a", nextReviewDate: today }),
                makeCard({ id: "b", nextReviewDate: "2099-12-31" }),
            ]);
            const stats = store.getStats();
            expect(stats.total).toBe(2);
            expect(stats.due).toBe(1);
        });
    });

    describe("getForecast", () => {
        it("counts cards due tomorrow", async () => {
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            const tomorrowStr = tomorrow.toISOString().split("T")[0];

            await store.addCards([
                makeCard({ id: "tmr", nextReviewDate: tomorrowStr }),
            ]);
            const forecast = store.getForecast();
            expect(forecast.tomorrow).toBe(1);
        });

        it("counts cards due this week (next 7 days)", async () => {
            const dates = [];
            for (let i = 1; i <= 7; i++) {
                const d = new Date();
                d.setDate(d.getDate() + i);
                dates.push(d.toISOString().split("T")[0]);
            }

            await store.addCards(
                dates.map((d, i) => makeCard({ id: `w${i}`, nextReviewDate: d }))
            );
            const forecast = store.getForecast();
            expect(forecast.thisWeek).toBe(7);
        });

        it("excludes already-due cards from forecast", async () => {
            const today = new Date().toISOString().split("T")[0];
            await store.addCards([
                makeCard({ id: "due-now", nextReviewDate: today }),
            ]);
            const forecast = store.getForecast();
            expect(forecast.tomorrow).toBe(0);
            expect(forecast.thisWeek).toBe(0);
        });

        it("excludes cards beyond 7 days", async () => {
            const far = new Date();
            far.setDate(far.getDate() + 30);
            await store.addCards([
                makeCard({ id: "far", nextReviewDate: far.toISOString().split("T")[0] }),
            ]);
            const forecast = store.getForecast();
            expect(forecast.thisWeek).toBe(0);
        });
    });

    describe("getAllCards", () => {
        it("returns a copy, not a reference", async () => {
            await store.addCards([makeCard()]);
            const cards = store.getAllCards();
            cards.pop();
            // Original should be unaffected
            expect(store.getAllCards()).toHaveLength(1);
        });
    });
});
