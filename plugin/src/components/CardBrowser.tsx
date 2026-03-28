import { useState, useMemo } from "react";
import { Notice } from "obsidian";
import type EchoVaultPlugin from "../main";
import { Flashcard, CardType } from "../types";
import { getTodayDateString } from "../utils";
import { EmptyState } from "./EmptyState";
import { MarkdownText } from "./MarkdownText";

type SortField = "created" | "nextReview" | "easiness";
type TypeFilter = "all" | CardType;

interface CardBrowserProps {
    plugin: EchoVaultPlugin;
    onBack: () => void;
    onReviewAll: () => void;
}

export function CardBrowser({ plugin, onBack, onReviewAll }: CardBrowserProps) {
    const [cards, setCards] = useState<Flashcard[]>(() => plugin.store.getAllCards());
    const [search, setSearch] = useState("");
    const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
    const [sortField, setSortField] = useState<SortField>("created");
    const [expandedId, setExpandedId] = useState<string | null>(null);

    const filtered = useMemo(() => {
        let result = cards;

        if (typeFilter !== "all") {
            result = result.filter((c) => (c.type ?? "qa") === typeFilter);
        }

        if (search.trim()) {
            const q = search.toLowerCase();
            result = result.filter(
                (c) =>
                    c.question.toLowerCase().includes(q) ||
                    c.answer.toLowerCase().includes(q)
            );
        }

        result.sort((a, b) => {
            if (sortField === "created") {
                return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
            }
            if (sortField === "nextReview") {
                return a.nextReviewDate.localeCompare(b.nextReviewDate);
            }
            return a.easinessFactor - b.easinessFactor;
        });

        return result;
    }, [cards, search, typeFilter, sortField]);

    const handleDelete = async (id: string) => {
        await plugin.store.deleteCard(id);
        setCards(plugin.store.getAllCards());
        setExpandedId(null);
        new Notice("Card deleted");
    };

    const today = getTodayDateString();

    if (cards.length === 0) {
        return (
            <EmptyState
                icon={<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><line x1="3" y1="9" x2="21" y2="9" /><line x1="9" y1="21" x2="9" y2="9" /></svg>}
                title="No cards yet"
                description="Generate flashcards from your notes or create some manually to get started."
                action={{ label: "Back to Dashboard", onClick: onBack }}
            />
        );
    }

    return (
        <>
            <div className="echovault-review-header">
                <button className="echovault-btn echovault-btn-back" onClick={onBack}>
                    Back
                </button>
                <span className="echovault-progress">{filtered.length} cards</span>
            </div>

            <div className="echovault-browser-controls">
                <input
                    type="text"
                    className="echovault-browser-search"
                    placeholder="Search cards..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />

                <div className="echovault-browser-filters">
                    <select
                        className="echovault-browser-select"
                        value={typeFilter}
                        onChange={(e) => setTypeFilter(e.target.value as TypeFilter)}
                    >
                        <option value="all">All types</option>
                        <option value="qa">Q&A</option>
                        <option value="mcq">Multiple Choice</option>
                        <option value="tf">True / False</option>
                    </select>

                    <select
                        className="echovault-browser-select"
                        value={sortField}
                        onChange={(e) => setSortField(e.target.value as SortField)}
                    >
                        <option value="created">Newest first</option>
                        <option value="nextReview">Next review</option>
                        <option value="easiness">Difficulty</option>
                    </select>
                </div>
            </div>

            <button
                className="echovault-btn echovault-btn-primary echovault-browser-review-all"
                onClick={onReviewAll}
                disabled={cards.length === 0}
            >
                Review All Cards ({cards.length})
            </button>

            <div className="echovault-browser-list">
                {filtered.map((card) => {
                    const cardType = card.type ?? "qa";
                    const isExpanded = expandedId === card.id;
                    const isDue = card.nextReviewDate <= today;

                    return (
                        <div
                            key={card.id}
                            className={`echovault-browser-card ${isExpanded ? "echovault-browser-card-expanded" : ""}`}
                        >
                            <div
                                className="echovault-browser-card-header"
                                onClick={() => setExpandedId(isExpanded ? null : card.id)}
                            >
                                <div className="echovault-browser-card-top">
                                    <span className={`echovault-card-type echovault-card-type-${cardType}`}>
                                        {cardType === "mcq" ? "MCQ" : cardType === "tf" ? "T/F" : "Q&A"}
                                    </span>
                                    {isDue && (
                                        <span className="echovault-browser-due-badge">Due</span>
                                    )}
                                </div>
                                <div className="echovault-browser-card-question">
                                    <MarkdownText app={plugin.app} markdown={card.question} sourcePath={card.sourceNotePath !== "manual" ? card.sourceNotePath : undefined} className="echovault-md" />
                                </div>
                            </div>

                            {isExpanded && (
                                <div className="echovault-browser-card-detail">
                                    <div className="echovault-browser-card-answer">
                                        <span className="echovault-browser-label">Answer</span>
                                        <MarkdownText app={plugin.app} markdown={card.answer} sourcePath={card.sourceNotePath !== "manual" ? card.sourceNotePath : undefined} className="echovault-md" />
                                    </div>

                                    {card.type === "mcq" && (
                                        <div className="echovault-browser-card-meta">
                                            <span className="echovault-browser-label">Choices</span>
                                            <ul className="echovault-browser-choices">
                                                {card.choices.map((c, i) => (
                                                    <li key={i} className={i === card.correctIndex ? "echovault-browser-correct" : ""}>
                                                        {c}{i === card.correctIndex ? " \u2713" : ""}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}

                                    {card.type === "tf" && (
                                        <div className="echovault-browser-card-meta">
                                            <span className="echovault-browser-label">Correct answer</span>
                                            <span>{card.correctValue ? "True" : "False"}</span>
                                        </div>
                                    )}

                                    <div className="echovault-browser-card-stats">
                                        <div className="echovault-browser-stat">
                                            <span className="echovault-browser-label">Source</span>
                                            <span>{card.sourceNotePath}</span>
                                        </div>
                                        <div className="echovault-browser-stat">
                                            <span className="echovault-browser-label">Next review</span>
                                            <span>{card.nextReviewDate}</span>
                                        </div>
                                        <div className="echovault-browser-stat">
                                            <span className="echovault-browser-label">Repetitions</span>
                                            <span>{card.repetitions}</span>
                                        </div>
                                        <div className="echovault-browser-stat">
                                            <span className="echovault-browser-label">Easiness</span>
                                            <span>{card.easinessFactor.toFixed(2)}</span>
                                        </div>
                                    </div>

                                    <button
                                        className="echovault-btn echovault-browser-delete"
                                        onClick={() => handleDelete(card.id)}
                                    >
                                        Delete card
                                    </button>
                                </div>
                            )}
                        </div>
                    );
                })}

                {filtered.length === 0 && (
                    <div className="echovault-browser-empty">
                        No cards match your filters.
                    </div>
                )}
            </div>
        </>
    );
}
