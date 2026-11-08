import { describe, it, expect } from "vitest";
import { generateId, getTodayDateString, nowISO } from "../core/utils";

describe("generateId", () => {
    it("returns an 8-character string", () => {
        const id = generateId();
        expect(id).toHaveLength(8);
    });

    it("returns alphanumeric characters", () => {
        const id = generateId();
        expect(id).toMatch(/^[a-z0-9]+$/);
    });

    it("generates unique values", () => {
        const ids = new Set(Array.from({ length: 100 }, () => generateId()));
        // With 8 chars of base-36, collisions in 100 are near-impossible
        expect(ids.size).toBe(100);
    });
});

describe("getTodayDateString", () => {
    it("returns YYYY-MM-DD format", () => {
        const today = getTodayDateString();
        expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it("matches the current date", () => {
        const today = getTodayDateString();
        const expected = new Date().toISOString().split("T")[0];
        expect(today).toBe(expected);
    });
});

describe("nowISO", () => {
    it("returns a valid ISO 8601 string", () => {
        const now = nowISO();
        expect(new Date(now).toISOString()).toBe(now);
    });

    it("includes time component", () => {
        const now = nowISO();
        expect(now).toContain("T");
        expect(now).toContain("Z");
    });
});
