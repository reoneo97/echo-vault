import { describe, it, expect } from "vitest";
import { sm2 } from "../sm2";

describe("sm2", () => {
    const defaultEF = 2.5;

    describe("failed reviews (quality < 3)", () => {
        it("resets repetitions to 0 on quality 0", () => {
            const result = sm2(0, 5, defaultEF, 30);
            expect(result.repetitions).toBe(0);
            expect(result.interval).toBe(0);
        });

        it("resets repetitions to 0 on quality 2", () => {
            const result = sm2(2, 3, defaultEF, 10);
            expect(result.repetitions).toBe(0);
            expect(result.interval).toBe(0);
        });

        it("still adjusts easiness factor downward", () => {
            const result = sm2(0, 3, defaultEF, 10);
            expect(result.easinessFactor).toBeLessThan(defaultEF);
        });
    });

    describe("passed reviews (quality >= 3)", () => {
        it("first successful review gives interval of 1 day", () => {
            const result = sm2(4, 0, defaultEF, 0);
            expect(result.repetitions).toBe(1);
            expect(result.interval).toBe(1);
        });

        it("second successful review gives interval of 6 days", () => {
            const result = sm2(4, 1, defaultEF, 1);
            expect(result.repetitions).toBe(2);
            expect(result.interval).toBe(6);
        });

        it("subsequent reviews multiply interval by EF", () => {
            const result = sm2(4, 2, defaultEF, 6);
            expect(result.repetitions).toBe(3);
            // 6 * 2.5 = 15
            expect(result.interval).toBe(15);
        });

        it("increments repetitions", () => {
            const result = sm2(5, 4, defaultEF, 20);
            expect(result.repetitions).toBe(5);
        });
    });

    describe("easiness factor", () => {
        it("increases with quality 5", () => {
            const result = sm2(5, 0, defaultEF, 0);
            expect(result.easinessFactor).toBeGreaterThan(defaultEF);
        });

        it("stays roughly the same with quality 4", () => {
            const result = sm2(4, 0, defaultEF, 0);
            expect(result.easinessFactor).toBe(2.5);
        });

        it("decreases with quality 3", () => {
            const result = sm2(3, 0, defaultEF, 0);
            expect(result.easinessFactor).toBeLessThan(defaultEF);
        });

        it("never goes below 1.3", () => {
            // Repeatedly apply low quality
            let ef = defaultEF;
            for (let i = 0; i < 20; i++) {
                const result = sm2(0, 0, ef, 0);
                ef = result.easinessFactor;
            }
            expect(ef).toBeGreaterThanOrEqual(1.3);
        });

        it("rounds to 2 decimal places", () => {
            const result = sm2(3, 0, 2.5, 0);
            const decimals = result.easinessFactor.toString().split(".")[1];
            expect(decimals?.length ?? 0).toBeLessThanOrEqual(2);
        });
    });

    describe("next review date", () => {
        it("returns a YYYY-MM-DD string", () => {
            const result = sm2(4, 0, defaultEF, 0);
            expect(result.nextReviewDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        });

        it("sets today for failed reviews (interval 0)", () => {
            const result = sm2(0, 3, defaultEF, 10);
            const today = new Date().toISOString().split("T")[0];
            expect(result.nextReviewDate).toBe(today);
        });

        it("sets tomorrow for first successful review", () => {
            const result = sm2(4, 0, defaultEF, 0);
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            expect(result.nextReviewDate).toBe(
                tomorrow.toISOString().split("T")[0]
            );
        });
    });
});
