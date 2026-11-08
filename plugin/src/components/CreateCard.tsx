import { useState, useMemo, useRef, useEffect } from "react";
import { App, TFile, MarkdownView } from "obsidian";
import { CardType, Flashcard } from "../core/types";
import { generateId, getTodayDateString, nowISO } from "../core/utils";
import type { FlashcardStore } from "../core/store";

interface CreateCardProps {
    store: FlashcardStore;
    app: App;
    onBack: () => void;
    onCreated: () => void;
}

export function CreateCard({ store, app, onBack, onCreated }: CreateCardProps) {
    const [cardType, setCardType] = useState<CardType>("qa");
    const [question, setQuestion] = useState("");
    const [answer, setAnswer] = useState("");

    // MCQ state
    const [choices, setChoices] = useState(["", "", "", ""]);
    const [correctIndex, setCorrectIndex] = useState(0);

    // TF state
    const [correctValue, setCorrectValue] = useState(true);

    // Linked note state
    const [linkedNote, setLinkedNote] = useState<string | null>(null);
    const [noteSearch, setNoteSearch] = useState("");
    const [notePickerOpen, setNotePickerOpen] = useState(false);
    const notePickerRef = useRef<HTMLDivElement>(null);

    const activeFilePath = app.workspace.getActiveFile()?.path ?? null;

    const openNotePaths = useMemo(() => {
        const paths = new Set<string>();
        for (const leaf of app.workspace.getLeavesOfType("markdown")) {
            const file = (leaf.view as MarkdownView).file;
            if (file) paths.add(file.path);
        }
        return [...paths];
    }, [app.workspace]);

    const markdownFiles = useMemo(
        () => app.vault.getFiles()
            .filter((f): f is TFile => f instanceof TFile && f.extension === "md")
            .map((f) => f.path)
            .sort(),
        [app.vault]
    );

    const { filteredOpen, filteredVault, totalVaultMatches } = useMemo(() => {
        const q = noteSearch.trim().toLowerCase();
        const openSet = new Set(openNotePaths);

        const matchedOpen = q
            ? openNotePaths.filter((p) => p.toLowerCase().includes(q))
            : openNotePaths;

        const vaultMatches = (q
            ? markdownFiles.filter((p) => p.toLowerCase().includes(q))
            : markdownFiles
        ).filter((p) => !openSet.has(p));

        return {
            filteredOpen: matchedOpen,
            filteredVault: vaultMatches.slice(0, 20),
            totalVaultMatches: vaultMatches.length,
        };
    }, [noteSearch, openNotePaths, markdownFiles]);

    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            if (notePickerRef.current && !notePickerRef.current.contains(e.target as Node)) {
                setNotePickerOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClick);
        return () => document.removeEventListener("mousedown", handleClick);
    }, []);

    const [saving, setSaving] = useState(false);

    const canSave = () => {
        if (!question.trim() || !answer.trim()) return false;
        if (cardType === "mcq" && choices.some((c) => !c.trim())) return false;
        return true;
    };

    const handleSave = async () => {
        if (!canSave()) return;
        setSaving(true);

        const base = {
            id: generateId(),
            question: question.trim(),
            answer: answer.trim(),
            sourceNotePath: linkedNote ?? "manual",
            commitHash: null,
            createdAt: nowISO(),
            lastReviewedAt: null,
            repetitions: 0,
            easinessFactor: 2.5,
            interval: 0,
            nextReviewDate: getTodayDateString(),
        };

        let card: Flashcard;
        if (cardType === "mcq") {
            card = { ...base, type: "mcq", choices: choices.map((c) => c.trim()), correctIndex };
        } else if (cardType === "tf") {
            card = { ...base, type: "tf", correctValue };
        } else {
            card = { ...base, type: "qa" };
        }

        await store.addCards([card]);
        setSaving(false);
        onCreated();
    };

    const updateChoice = (index: number, value: string) => {
        const updated = [...choices];
        updated[index] = value;
        setChoices(updated);
    };

    return (
        <>
            <div className="echovault-review-header">
                <button className="echovault-btn echovault-btn-back" onClick={onBack}>
                    Back
                </button>
                <span className="echovault-progress">New Card</span>
            </div>

            <div className="echovault-create-form">
                <div className="echovault-create-type-picker">
                    {(["qa", "mcq", "tf"] as CardType[]).map((t) => (
                        <button
                            key={t}
                            className={`echovault-btn echovault-create-type-btn ${cardType === t ? "echovault-create-type-active" : ""}`}
                            onClick={() => setCardType(t)}
                        >
                            {t === "qa" ? "Q&A" : t === "mcq" ? "Multiple Choice" : "True / False"}
                        </button>
                    ))}
                </div>

                <label className="echovault-create-label">Question</label>
                <textarea
                    className="echovault-create-input echovault-create-textarea"
                    placeholder="Enter your question..."
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    rows={3}
                />

                {cardType === "mcq" && (
                    <>
                        <label className="echovault-create-label">Choices</label>
                        {choices.map((choice, i) => (
                            <div key={i} className="echovault-create-choice-row">
                                <input
                                    type="radio"
                                    name="correctChoice"
                                    checked={correctIndex === i}
                                    onChange={() => setCorrectIndex(i)}
                                />
                                <input
                                    className="echovault-create-input"
                                    placeholder={`Choice ${i + 1}`}
                                    value={choice}
                                    onChange={(e) => updateChoice(i, e.target.value)}
                                />
                            </div>
                        ))}
                        <p className="echovault-create-hint">Select the radio button for the correct answer</p>
                    </>
                )}

                {cardType === "tf" && (
                    <>
                        <label className="echovault-create-label">Correct Answer</label>
                        <div className="echovault-create-tf-toggle">
                            <button
                                className={`echovault-btn echovault-create-tf-btn ${correctValue ? "echovault-create-tf-active" : ""}`}
                                onClick={() => setCorrectValue(true)}
                            >
                                True
                            </button>
                            <button
                                className={`echovault-btn echovault-create-tf-btn ${!correctValue ? "echovault-create-tf-active" : ""}`}
                                onClick={() => setCorrectValue(false)}
                            >
                                False
                            </button>
                        </div>
                    </>
                )}

                <label className="echovault-create-label">
                    {cardType === "qa" ? "Answer" : "Explanation"}
                </label>
                <textarea
                    className="echovault-create-input echovault-create-textarea"
                    placeholder={cardType === "qa" ? "Enter the answer..." : "Explain why..."}
                    value={answer}
                    onChange={(e) => setAnswer(e.target.value)}
                    rows={3}
                />

                <label className="echovault-create-label">Related Note (optional)</label>
                <div className="echovault-note-picker" ref={notePickerRef}>
                    {linkedNote ? (
                        <div className="echovault-note-picker-selected">
                            <span className="echovault-note-picker-path">{linkedNote}</span>
                            <button
                                className="echovault-note-picker-clear"
                                onClick={() => { setLinkedNote(null); setNoteSearch(""); }}
                            >
                                &times;
                            </button>
                        </div>
                    ) : (
                        <input
                            className="echovault-create-input"
                            placeholder="Search for a note..."
                            value={noteSearch}
                            onChange={(e) => { setNoteSearch(e.target.value); setNotePickerOpen(true); }}
                            onFocus={() => setNotePickerOpen(true)}
                        />
                    )}
                    {notePickerOpen && !linkedNote && (
                        <div className="echovault-note-picker-dropdown">
                            {filteredOpen.length === 0 && filteredVault.length === 0 ? (
                                <div className="echovault-note-picker-empty">No notes found</div>
                            ) : (
                                <>
                                    {filteredOpen.length > 0 && (
                                        <>
                                            <div className="echovault-note-picker-section">Open Notes</div>
                                            {filteredOpen.map((path) => (
                                                <button
                                                    key={path}
                                                    className={`echovault-note-picker-item ${path === activeFilePath ? "echovault-note-picker-active" : ""}`}
                                                    onClick={() => {
                                                        setLinkedNote(path);
                                                        setNoteSearch("");
                                                        setNotePickerOpen(false);
                                                    }}
                                                >
                                                    {path}
                                                    {path === activeFilePath && <span className="echovault-note-picker-badge">active</span>}
                                                </button>
                                            ))}
                                        </>
                                    )}
                                    {filteredVault.length > 0 && (
                                        <>
                                            <div className="echovault-note-picker-section">All Notes</div>
                                            {filteredVault.map((path) => (
                                                <button
                                                    key={path}
                                                    className="echovault-note-picker-item"
                                                    onClick={() => {
                                                        setLinkedNote(path);
                                                        setNoteSearch("");
                                                        setNotePickerOpen(false);
                                                    }}
                                                >
                                                    {path}
                                                </button>
                                            ))}
                                            {totalVaultMatches > 20 && (
                                                <div className="echovault-note-picker-more">
                                                    {totalVaultMatches - 20} more — keep typing to narrow results
                                                </div>
                                            )}
                                        </>
                                    )}
                                </>
                            )}
                        </div>
                    )}
                </div>

                <button
                    className="echovault-btn echovault-btn-primary"
                    onClick={handleSave}
                    disabled={!canSave() || saving}
                >
                    {saving ? "Saving..." : "Create Card"}
                </button>
            </div>
        </>
    );
}
