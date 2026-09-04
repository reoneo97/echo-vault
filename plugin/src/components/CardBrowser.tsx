import { useState, useMemo } from "react";
import { Notice } from "obsidian";
import type EchoVaultPlugin from "../main";
import { Flashcard, CardType } from "../types";
import { getTodayDateString } from "../utils";
import { EmptyState } from "./EmptyState";
import { MarkdownText } from "./MarkdownText";

type SortField = "created" | "nextReview" | "easiness";
type TypeFilter = "all" | CardType;
type ViewMode = "flat" | "grouped";

interface CardBrowserProps {
    plugin: EchoVaultPlugin;
    onBack: () => void;
    onReviewAll: (cards: Flashcard[]) => void;
}

export function CardBrowser({ plugin, onBack, onReviewAll }: CardBrowserProps) {
    const [cards, setCards] = useState<Flashcard[]>(() => plugin.store.getAllCards());
    const [search, setSearch] = useState("");
    const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
    const [sortField, setSortField] = useState<SortField>("created");
    const [sourceFilter, setSourceFilter] = useState<string>("all");
    const [tagFilter, setTagFilter] = useState<string>("all");
    const [viewMode, setViewMode] = useState<ViewMode>("flat");
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

    const sourceNotes = useMemo(() => {
        return Array.from(new Set(cards.map((c) => c.sourceNotePath))).sort();
    }, [cards]);

    const allTags = useMemo(() => {
        const tags = new Set<string>();
        cards.forEach((c) => c.tags?.forEach((t) => tags.add(t)));
        return Array.from(tags).sort();
    }, [cards]);

    const filtered = useMemo(() => {
        let result = cards;

        if (typeFilter !== "all") {
            result = result.filter((c) => (c.type ?? "qa") === typeFilter);
        }

        if (sourceFilter !== "all") {
            result = result.filter((c) => c.sourceNotePath === sourceFilter);
        }

        if (tagFilter !== "all") {
            result = result.filter((c) => c.tags?.includes(tagFilter));
        }

        if (search.trim()) {
            const q = search.toLowerCase().replace(/^#/, "");
            result = result.filter(
                (c) =>
                    c.question.toLowerCase().includes(q) ||
                    c.answer.toLowerCase().includes(q) ||
                    c.tags?.some((t) => t.toLowerCase().includes(q))
            );
        }

        result = [...result].sort((a, b) => {
            if (sortField === "created") return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
            if (sortField === "nextReview") return a.nextReviewDate.localeCompare(b.nextReviewDate);
            return a.easinessFactor - b.easinessFactor;
        });

        return result;
    }, [cards, search, typeFilter, sourceFilter, tagFilter, sortField]);

    const grouped = useMemo(() => {
        const map = new Map<string, Flashcard[]>();
        for (const card of filtered) {
            const key = card.sourceNotePath;
            if (!map.has(key)) map.set(key, []);
            map.get(key)!.push(card);
        }
        return map;
    }, [filtered]);

    const toggleGroup = (note: string) => {
        setExpandedGroups((prev) => {
            const next = new Set(prev);
            if (next.has(note)) next.delete(note);
            else next.add(note);
            return next;
        });
    };

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
                    placeholder="Search cards or #tag..."
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

                <div className="echovault-browser-filters">
                    <select
                        className="echovault-browser-select echovault-browser-select-source"
                        value={sourceFilter}
                        onChange={(e) => setSourceFilter(e.target.value)}
                    >
                        <option value="all">All notes</option>
                        {sourceNotes.map((note) => (
                            <option key={note} value={note}>
                                {note.split("/").pop()}
                            </option>
                        ))}
                    </select>
                    {allTags.length > 0 && (
                        <select
                            className="echovault-browser-select"
                            value={tagFilter}
                            onChange={(e) => setTagFilter(e.target.value)}
                        >
                            <option value="all">All tags</option>
                            {allTags.map((tag) => (
                                <option key={tag} value={tag}>#{tag}</option>
                            ))}
                        </select>
                    )}

                    <div className="echovault-browser-view-toggle">
                        <button
                            className={`echovault-browser-view-btn ${viewMode === "flat" ? "echovault-browser-view-btn-active" : ""}`}
                            onClick={() => setViewMode("flat")}
                            title="Flat view"
                        >
                            ☰
                        </button>
                        <button
                            className={`echovault-browser-view-btn ${viewMode === "grouped" ? "echovault-browser-view-btn-active" : ""}`}
                            onClick={() => setViewMode("grouped")}
                            title="Group by note"
                        >
                            ⊞
                        </button>
                    </div>
                </div>
            </div>

            <button
                className="echovault-btn echovault-btn-primary echovault-browser-review-all"
                onClick={() => onReviewAll(filtered)}
                disabled={filtered.length === 0}
            >
                Review {filtered.length === cards.length ? "All" : "Filtered"} Cards ({filtered.length})
            </button>

            <div className="echovault-browser-list">
                {viewMode === "grouped" && Array.from(grouped.entries()).map(([note, noteCards]) => (
                    <div key={note} className="echovault-browser-group">
                        <button
                            className="echovault-browser-group-header"
                            onClick={() => toggleGroup(note)}
                        >
                            <span className={`echovault-chevron ${expandedGroups.has(note) ? "echovault-chevron-open" : ""}`}>&#9656;</span>
                            <span className="echovault-browser-group-name">{note.split("/").pop()}</span>
                            <span className="echovault-browser-group-path">{note}</span>
                            <span className="echovault-browser-group-count">{noteCards.length}</span>
                        </button>
                        {expandedGroups.has(note) && noteCards.map((card) => renderCard(card))}
                    </div>
                ))}
                {viewMode === "flat" && filtered.map((card) => renderCard(card))}

                {filtered.length === 0 && (
                    <div className="echovault-browser-empty">No cards match your filters.</div>
                )}
            </div>
        </>
    );

    function renderCard(card: Flashcard) {
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

                                    {card.tags && card.tags.length > 0 && (
                                        <div className="echovault-browser-tags">
                                            {card.tags.map((tag) => (
                                                <span
                                                    key={tag}
                                                    className="echovault-browser-tag"
                                                    onClick={() => setTagFilter(tag)}
                                                    title={`Filter by #${tag}`}
                                                >
                                                    #{tag}
                                                </span>
                                            ))}
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

                                    {card.reviewHistory && card.reviewHistory.length > 0 && (
                                        <div className="echovault-browser-history">
                                            <span className="echovault-browser-label">Review history</span>
                                            <div className="echovault-browser-history-list">
                                                {[...card.reviewHistory].reverse().map((entry, i) => (
                                                    <div key={i} className="echovault-browser-history-row">
                                                        <span className="echovault-browser-history-date">
                                                            {new Date(entry.date).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                                                        </span>
                                                        <span className={`echovault-browser-history-rating echovault-history-q${entry.quality}`}>
                                                            {entry.quality === 0 ? "Again" : entry.quality === 2 ? "Hard" : entry.quality === 4 ? "Good" : "Easy"}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

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
    }
}
