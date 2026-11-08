/** Returns how many flashcards to generate for a piece of text: 1 per 120 words, capped 1–15. */
export function cardBudget(text: string): number {
    const words = text.trim().split(/\s+/).filter(Boolean).length;
    return Math.max(1, Math.min(15, Math.floor(words / 120)));
}

/**
 * Extracts tags from YAML frontmatter. Handles three formats:
 *   tags: [a, b, c]
 *   tags:\n  - a\n  - b
 *   tags: single
 */
export function extractFrontmatterTags(content: string): string[] {
    const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!fmMatch) return [];
    const fm = fmMatch[1];

    // Inline array: tags: [a, b, c]
    const inline = fm.match(/^tags:\s*\[([^\]]*)\]/m);
    if (inline) {
        return inline[1].split(",").map((t) => t.trim().replace(/^["']|["']$/g, "")).filter(Boolean);
    }

    // Block list: tags:\n  - a\n  - b
    const block = fm.match(/^tags:\s*\n((?:[ \t]+-[ \t]+.+\n?)+)/m);
    if (block) {
        return (block[1].match(/[ \t]+-[ \t]+(.+)/g) ?? [])
            .map((t) => t.replace(/[ \t]+-[ \t]+/, "").trim());
    }

    // Single value: tags: value
    const single = fm.match(/^tags:\s*(\S+)/m);
    if (single && !single[1].startsWith("[")) return [single[1].trim()];

    return [];
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
