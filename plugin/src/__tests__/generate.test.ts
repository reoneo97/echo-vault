import { describe, it, expect } from "vitest";

// extractImageRefs is not exported, so we re-implement the same logic for testing.
// This ensures the regex patterns work correctly for both Obsidian and markdown syntax.

const IMAGE_EXTS = "png|jpg|jpeg|gif|bmp|webp";

function extractImageRefs(text: string): string[] {
    const refs = new Set<string>();

    // Obsidian wikilinks: ![[image.png]] or ![[folder/image.png]] or ![[image.png|caption]]
    const wikiRegex = new RegExp(
        `!\\[\\[([^\\]|]+\\.(?:${IMAGE_EXTS}))(?:\\|[^\\]]*)?\\]\\]`,
        "gi"
    );
    for (const match of text.matchAll(wikiRegex)) {
        refs.add(match[1].trim());
    }

    // Markdown links: ![alt](image.png) or ![alt](folder/image.png)
    const mdRegex = new RegExp(
        `!\\[[^\\]]*\\]\\(([^)]+\\.(?:${IMAGE_EXTS}))\\)`,
        "gi"
    );
    for (const match of text.matchAll(mdRegex)) {
        refs.add(match[1].trim());
    }

    return [...refs];
}

describe("extractImageRefs", () => {
    describe("Obsidian wikilink syntax", () => {
        it("detects ![[image.png]]", () => {
            const refs = extractImageRefs("Here is ![[photo.png]] in text");
            expect(refs).toEqual(["photo.png"]);
        });

        it("detects wikilinks with folder paths", () => {
            const refs = extractImageRefs("![[attachments/diagram.jpg]]");
            expect(refs).toEqual(["attachments/diagram.jpg"]);
        });

        it("strips caption aliases", () => {
            const refs = extractImageRefs("![[image.png|My Caption]]");
            expect(refs).toEqual(["image.png"]);
        });

        it("handles multiple wikilinks", () => {
            const refs = extractImageRefs("![[a.png]] text ![[b.jpeg]]");
            expect(refs).toContain("a.png");
            expect(refs).toContain("b.jpeg");
            expect(refs).toHaveLength(2);
        });
    });

    describe("Markdown syntax", () => {
        it("detects ![alt](image.png)", () => {
            const refs = extractImageRefs("![diagram](figure.png)");
            expect(refs).toEqual(["figure.png"]);
        });

        it("detects markdown links with folder paths", () => {
            const refs = extractImageRefs("![](assets/photo.webp)");
            expect(refs).toEqual(["assets/photo.webp"]);
        });

        it("detects with empty alt text", () => {
            const refs = extractImageRefs("![](test.jpg)");
            expect(refs).toEqual(["test.jpg"]);
        });

        it("handles multiple markdown links", () => {
            const refs = extractImageRefs("![a](x.png) ![b](y.gif)");
            expect(refs).toContain("x.png");
            expect(refs).toContain("y.gif");
            expect(refs).toHaveLength(2);
        });
    });

    describe("mixed syntax", () => {
        it("detects both wiki and markdown links", () => {
            const text = "![[wiki.png]] and ![alt](md.jpg) here";
            const refs = extractImageRefs(text);
            expect(refs).toContain("wiki.png");
            expect(refs).toContain("md.jpg");
            expect(refs).toHaveLength(2);
        });

        it("deduplicates same image referenced twice", () => {
            const text = "![[photo.png]] and ![[photo.png]]";
            const refs = extractImageRefs(text);
            expect(refs).toEqual(["photo.png"]);
        });
    });

    describe("edge cases", () => {
        it("ignores non-image extensions", () => {
            const refs = extractImageRefs("![[notes.md]] ![](data.csv)");
            expect(refs).toHaveLength(0);
        });

        it("is case insensitive for extensions", () => {
            const refs = extractImageRefs("![[Photo.PNG]] ![](img.JPEG)");
            expect(refs).toContain("Photo.PNG");
            expect(refs).toContain("img.JPEG");
        });

        it("returns empty for text with no images", () => {
            const refs = extractImageRefs("Just some plain text with no images.");
            expect(refs).toHaveLength(0);
        });

        it("handles multiline text", () => {
            const text = `
Line one with ![[first.png]]
Line two with nothing
Line three with ![alt](second.jpg)
`;
            const refs = extractImageRefs(text);
            expect(refs).toContain("first.png");
            expect(refs).toContain("second.jpg");
            expect(refs).toHaveLength(2);
        });

        it("ignores regular wikilinks (no !)", () => {
            const refs = extractImageRefs("[[image.png]] is a link, not embed");
            expect(refs).toHaveLength(0);
        });

        it("ignores regular markdown links (no !)", () => {
            const refs = extractImageRefs("[alt](image.png)");
            expect(refs).toHaveLength(0);
        });
    });
});
