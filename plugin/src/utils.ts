/** Returns how many flashcards to generate for a piece of text: 1 per 120 words, capped 1–15. */
export function cardBudget(text: string): number {
    const words = text.trim().split(/\s+/).filter(Boolean).length;
    return Math.max(1, Math.min(15, Math.floor(words / 120)));
}

/** djb2 hash — fast, non-cryptographic, good enough for content deduplication. */
export function hashContent(content: string): string {
    let hash = 5381;
    for (let i = 0; i < content.length; i++) {
        hash = ((hash << 5) + hash) + content.charCodeAt(i);
        hash |= 0;
    }
    return (hash >>> 0).toString(16);
}

/** Jaccard similarity on word tokens (0–1). */
export function questionSimilarity(a: string, b: string): number {
    const tokenize = (s: string) => new Set(s.toLowerCase().replace(/[^a-z0-9\s]/g, "").split(/\s+/).filter(Boolean));
    const ta = tokenize(a);
    const tb = tokenize(b);
    const intersection = [...ta].filter((t) => tb.has(t)).length;
    const union = new Set([...ta, ...tb]).size;
    return union === 0 ? 0 : intersection / union;
}

export function generateId(): string {
    return Math.random().toString(36).substring(2, 10);
}

export function getTodayDateString(): string {
    return new Date().toISOString().split("T")[0];
}

export function nowISO(): string {
    return new Date().toISOString();
}
