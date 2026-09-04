import { useState, useRef, useCallback } from "react";
import { App } from "obsidian";
import { Flashcard, GenerationResult, StagedCard, StagedFileGroup, CardFeedbackEntry, CardType } from "../types";
import { generateId, nowISO, getTodayDateString } from "../utils";
import { MarkdownText } from "./MarkdownText";

interface StagingPanelProps {
    app: App;
    generationResult: GenerationResult;
    onConfirm: (acceptedCards: Flashcard[], feedback: CardFeedbackEntry[]) => Promise<void>;
    onCancel: () => void;
}

export function StagingPanel({ app, generationResult, onConfirm, onCancel }: StagingPanelProps) {
    const [groups, setGroups] = useState<StagedFileGroup[]>(
        () => generationResult.fileGroups.map((fg) => ({
            ...fg,
            cards: fg.cards.map((c) => ({ ...c })),
        }))
    );
    const [saving, setSaving] = useState(false);
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
        () => new Set(generationResult.fileGroups.map((fg) => fg.sourceNote))
    );
    const [editingCard, setEditingCard] = useState<string | null>(null);
    const footerRef = useRef<HTMLDivElement>(null);

    const allCards = groups.flatMap((g) => g.cards);
    const accepted = allCards.filter((c) => c.decision === "accepted" || c.decision === "edited");
    const rejected = allCards.filter((c) => c.decision === "rejected");
    const pending = allCards.filter((c) => c.decision === null);

    const updateCard = (tempId: string, update: Partial<StagedCard>) => {
        setGroups((prev) =>
            prev.map((g) => ({
                ...g,
                cards: g.cards.map((c) =>
                    c.tempId === tempId ? { ...c, ...update } : c
                ),
            }))
        );
    };

    const setAllDecisions = useCallback((decision: "accepted" | "rejected") => {
        setGroups((prev) =>
            prev.map((g) => ({
                ...g,
                cards: g.cards.map((c) => ({ ...c, decision })),
            }))
        );
        setTimeout(() => footerRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }), 50);
    }, []);

    const setGroupDecision = (sourceNote: string, decision: "accepted" | "rejected") => {
        setGroups((prev) =>
            prev.map((g) =>
                g.sourceNote === sourceNote
                    ? { ...g, cards: g.cards.map((c) => ({ ...c, decision })) }
                    : g
            )
        );
    };

    const toggleGroup = (sourceNote: string) => {
        setExpandedGroups((prev) => {
            const next = new Set(prev);
            if (next.has(sourceNote)) next.delete(sourceNote);
            else next.add(sourceNote);
            return next;
        });
    };

    const handleConfirm = async () => {
        setSaving(true);
        const now = nowISO();
        const today = getTodayDateString();

        const acceptedCards: Flashcard[] = accepted.map((c) => {
            const resolvedType = c.editedCardType ?? c.cardType;
            const base = {
                id: generateId(),
                question: c.editedQuestion ?? c.question,
                answer: c.editedAnswer ?? c.answer,
                sourceNotePath: c.sourceNotePath,
                commitHash: c.commitHash,
                createdAt: now,
                lastReviewedAt: null,
                repetitions: 0,
                easinessFactor: 2.5,
                interval: 0,
                nextReviewDate: today,
                reviewHistory: [],
                tags: c.tags ?? [],
            };
            if (resolvedType === "mcq") {
                const choices = c.editedChoices ?? c.choices ?? ["", "", "", ""];
                return { ...base, type: "mcq" as const, choices, correctIndex: c.editedCorrectIndex ?? c.correctIndex ?? 0 };
            }
            if (resolvedType === "tf") {
                return { ...base, type: "tf" as const, correctValue: c.editedCorrectValue ?? c.correctValue ?? true };
            }
            return { ...base, type: "qa" as const };
        });

        const feedback: CardFeedbackEntry[] = allCards
            .filter((c) => c.decision !== null)
            .map((c) => ({
                question: c.question,
                answer: c.answer,
                source_note: c.sourceNotePath,
                commit_hash: c.commitHash,
                decision: c.decision!,
                original_type: c.cardType,
                ...(c.editedQuestion ? { edited_question: c.editedQuestion } : {}),
                ...(c.editedAnswer ? { edited_answer: c.editedAnswer } : {}),
                ...(c.editedCardType && c.editedCardType !== c.cardType ? { edited_type: c.editedCardType } : {}),
            }));

        await onConfirm(acceptedCards, feedback);
        setSaving(false);
    };

    return (
        <div className="echovault-staging">
            <div className="echovault-staging-header">
                <span>{generationResult.totalCards} card{generationResult.totalCards !== 1 ? "s" : ""} generated</span>
            </div>

            <div className="echovault-staging-bulk">
                <button
                    className="echovault-btn echovault-staging-btn-accept-all"
                    onClick={() => setAllDecisions("accepted")}
                >
                    Accept All
                </button>
                <button
                    className="echovault-btn echovault-staging-btn-reject-all"
                    onClick={() => setAllDecisions("rejected")}
                >
                    Reject All
                </button>
            </div>

            <div className="echovault-staging-summary">
                {accepted.length > 0 && <span className="echovault-staging-count-accepted">{accepted.length} accepted</span>}
                {rejected.length > 0 && <span className="echovault-staging-count-rejected">{rejected.length} rejected</span>}
                {pending.length > 0 && <span className="echovault-staging-count-pending">{pending.length} pending</span>}
            </div>

            <div className="echovault-staging-groups">
                {groups.map((group) => (
                    <StagingFileCard
                        key={group.sourceNote}
                        app={app}
                        sourceNote={group.sourceNote}
                        cards={group.cards}
                        expanded={expandedGroups.has(group.sourceNote)}
                        editingCardId={editingCard}
                        onToggle={() => toggleGroup(group.sourceNote)}
                        onAcceptAll={() => setGroupDecision(group.sourceNote, "accepted")}
                        onRejectAll={() => setGroupDecision(group.sourceNote, "rejected")}
                        onAcceptCard={(tempId) => {
                            const card = group.cards.find((c) => c.tempId === tempId);
                            const isEdited = card?.editedQuestion || card?.editedAnswer || card?.editedCardType;
                            updateCard(tempId, { decision: isEdited ? "edited" : "accepted" });
                        }}
                        onRejectCard={(tempId) => updateCard(tempId, { decision: "rejected" })}
                        onEditToggle={(tempId) => setEditingCard(editingCard === tempId ? null : tempId)}
                        onUpdateQuestion={(tempId, q) => updateCard(tempId, { editedQuestion: q })}
                        onUpdateAnswer={(tempId, a) => updateCard(tempId, { editedAnswer: a })}
                        onUpdateCardType={(tempId, type) => updateCard(tempId, { editedCardType: type })}
                        onUpdateChoices={(tempId, choices) => updateCard(tempId, { editedChoices: choices })}
                        onUpdateCorrectIndex={(tempId, index) => updateCard(tempId, { editedCorrectIndex: index })}
                        onUpdateCorrectValue={(tempId, value) => updateCard(tempId, { editedCorrectValue: value })}
                    />
                ))}
            </div>

            <div className="echovault-staging-footer" ref={footerRef}>
                <button
                    className="echovault-btn echovault-btn-primary"
                    onClick={handleConfirm}
                    disabled={saving || (accepted.length === 0 && rejected.length === 0)}
                >
                    {saving ? "Saving..." : `Save ${accepted.length} Card${accepted.length !== 1 ? "s" : ""}`}
                </button>
                <button
                    className="echovault-btn echovault-btn-show"
                    onClick={onCancel}
                    disabled={saving}
                >
                    Discard All
                </button>
            </div>
        </div>
    );
}

function StagingFileCard({
    app,
    sourceNote,
    cards,
    expanded,
    editingCardId,
    onToggle,
    onAcceptAll,
    onRejectAll,
    onAcceptCard,
    onRejectCard,
    onEditToggle,
    onUpdateQuestion,
    onUpdateAnswer,
    onUpdateCardType,
    onUpdateChoices,
    onUpdateCorrectIndex,
    onUpdateCorrectValue,
}: {
    app: App;
    sourceNote: string;
    cards: StagedCard[];
    expanded: boolean;
    editingCardId: string | null;
    onToggle: () => void;
    onAcceptAll: () => void;
    onRejectAll: () => void;
    onAcceptCard: (tempId: string) => void;
    onRejectCard: (tempId: string) => void;
    onEditToggle: (tempId: string) => void;
    onUpdateQuestion: (tempId: string, q: string) => void;
    onUpdateAnswer: (tempId: string, a: string) => void;
    onUpdateCardType: (tempId: string, type: CardType) => void;
    onUpdateChoices: (tempId: string, choices: string[]) => void;
    onUpdateCorrectIndex: (tempId: string, index: number) => void;
    onUpdateCorrectValue: (tempId: string, value: boolean) => void;
}) {
    const accepted = cards.filter((c) => c.decision === "accepted" || c.decision === "edited").length;
    const rejected = cards.filter((c) => c.decision === "rejected").length;

    return (
        <div className="echovault-staging-group">
            <button
                className="echovault-staging-group-header"
                onClick={onToggle}
            >
                <span className={`echovault-chevron ${expanded ? "echovault-chevron-open" : ""}`}>&#9656;</span>
                <span className="echovault-staging-group-name">{sourceNote}</span>
                <span className="echovault-staging-group-count">{cards.length}</span>
            </button>
            {expanded && (
                <>
                    <div className="echovault-staging-file-actions">
                        <button
                            className="echovault-staging-file-btn echovault-staging-file-btn-accept"
                            onClick={(e) => { e.stopPropagation(); onAcceptAll(); }}
                        >
                            Accept All ({cards.length})
                        </button>
                        <button
                            className="echovault-staging-file-btn echovault-staging-file-btn-reject"
                            onClick={(e) => { e.stopPropagation(); onRejectAll(); }}
                        >
                            Reject All ({cards.length})
                        </button>
                        {(accepted > 0 || rejected > 0) && (
                            <span className="echovault-staging-file-summary">
                                {accepted > 0 && <span className="echovault-staging-count-accepted">{accepted}✓</span>}
                                {rejected > 0 && <span className="echovault-staging-count-rejected">{rejected}✗</span>}
                            </span>
                        )}
                    </div>
                    <div className="echovault-staging-cards">
                        {cards.map((card) => (
                            <StagingCard
                                key={card.tempId}
                                app={app}
                                card={card}
                                isEditing={editingCardId === card.tempId}
                                onEdit={() => onEditToggle(card.tempId)}
                                onAccept={() => onAcceptCard(card.tempId)}
                                onReject={() => onRejectCard(card.tempId)}
                                onUpdateQuestion={(q) => onUpdateQuestion(card.tempId, q)}
                                onUpdateAnswer={(a) => onUpdateAnswer(card.tempId, a)}
                                onUpdateCardType={(t) => onUpdateCardType(card.tempId, t)}
                                onUpdateChoices={(choices) => onUpdateChoices(card.tempId, choices)}
                                onUpdateCorrectIndex={(i) => onUpdateCorrectIndex(card.tempId, i)}
                                onUpdateCorrectValue={(v) => onUpdateCorrectValue(card.tempId, v)}
                            />
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}

function StagingCard({
    app,
    card,
    isEditing,
    onEdit,
    onAccept,
    onReject,
    onUpdateQuestion,
    onUpdateAnswer,
    onUpdateCardType,
    onUpdateChoices,
    onUpdateCorrectIndex,
    onUpdateCorrectValue,
}: {
    app: App;
    card: StagedCard;
    isEditing: boolean;
    onEdit: () => void;
    onAccept: () => void;
    onReject: () => void;
    onUpdateQuestion: (q: string) => void;
    onUpdateAnswer: (a: string) => void;
    onUpdateCardType: (type: CardType) => void;
    onUpdateChoices: (choices: string[]) => void;
    onUpdateCorrectIndex: (index: number) => void;
    onUpdateCorrectValue: (value: boolean) => void;
}) {
    const [collapsed, setCollapsed] = useState(false);

    const decisionClass = card.decision === "accepted" || card.decision === "edited"
        ? "echovault-staging-card-accepted"
        : card.decision === "rejected"
        ? "echovault-staging-card-rejected"
        : "";

    // Auto-collapse when a decision is first made, or when re-clicking the same decision
    const prevDecision = useRef(card.decision);
    if (prevDecision.current === null && card.decision !== null) {
        setCollapsed(true);
    }
    prevDecision.current = card.decision;

    const handleAccept = () => {
        if (card.decision === "accepted" || card.decision === "edited") setCollapsed(true);
        onAccept();
    };

    const handleReject = () => {
        if (card.decision === "rejected") setCollapsed(true);
        onReject();
    };

    if (collapsed && card.decision !== null) {
        const badge = card.decision === "rejected" ? "Rejected" : "Accepted";
        return (
            <div
                className={`echovault-staging-card-collapsed ${decisionClass}`}
                onClick={() => setCollapsed(false)}
            >
                <span className="echovault-staging-collapsed-badge">{badge}</span>
                <span className="echovault-staging-collapsed-q">{card.editedQuestion ?? card.question}</span>
            </div>
        );
    }

    return (
        <div className={`echovault-staging-card ${decisionClass}`}>
            {isEditing ? (
                <>
                    {/* Type selector */}
                    <label className="echovault-staging-label">Card Type</label>
                    <div className="echovault-staging-type-selector">
                        {(["qa", "mcq", "tf"] as CardType[]).map((t) => {
                            const activeType = card.editedCardType ?? card.cardType;
                            const label = t === "mcq" ? "Multiple Choice" : t === "tf" ? "True / False" : "Q & A";
                            return (
                                <button
                                    key={t}
                                    className={`echovault-staging-type-btn ${activeType === t ? "echovault-staging-type-btn-active" : ""}`}
                                    onClick={() => {
                                        if (activeType === t) return;
                                        onUpdateCardType(t);
                                        // Initialise type-specific fields on transition
                                        if (t === "mcq") {
                                            onUpdateChoices(card.editedChoices ?? card.choices ?? ["", "", "", ""]);
                                            onUpdateCorrectIndex(card.editedCorrectIndex ?? card.correctIndex ?? 0);
                                        }
                                        if (t === "tf") {
                                            onUpdateCorrectValue(card.editedCorrectValue ?? card.correctValue ?? true);
                                        }
                                    }}
                                >
                                    {label}
                                </button>
                            );
                        })}
                    </div>

                    <label className="echovault-staging-label">Question</label>
                    <textarea
                        className="echovault-staging-textarea"
                        value={card.editedQuestion ?? card.question}
                        onChange={(e) => onUpdateQuestion(e.target.value)}
                        rows={2}
                    />
                    {(card.editedCardType ?? card.cardType) === "mcq" && (
                        <>
                            <label className="echovault-staging-label">Options (select correct)</label>
                            {(card.editedChoices ?? card.choices ?? ["", "", "", ""]).map((choice, i) => {
                                const currentCorrect = card.editedCorrectIndex ?? card.correctIndex ?? 0;
                                return (
                                    <div key={i} className="echovault-staging-mcq-row">
                                        <input
                                            type="radio"
                                            name={`correct-${card.tempId}`}
                                            checked={currentCorrect === i}
                                            onChange={() => onUpdateCorrectIndex(i)}
                                        />
                                        <input
                                            type="text"
                                            className="echovault-staging-option-input"
                                            value={choice}
                                            onChange={(e) => {
                                                const updated = [...(card.editedChoices ?? card.choices ?? ["", "", "", ""])];
                                                updated[i] = e.target.value;
                                                onUpdateChoices(updated);
                                            }}
                                        />
                                    </div>
                                );
                            })}
                        </>
                    )}
                    {(card.editedCardType ?? card.cardType) === "tf" && (
                        <>
                            <label className="echovault-staging-label">Correct Answer</label>
                            <div className="echovault-staging-tf-toggle">
                                <button
                                    className={`echovault-staging-tf-btn ${(card.editedCorrectValue ?? card.correctValue) === true ? "echovault-staging-tf-btn-active" : ""}`}
                                    onClick={() => onUpdateCorrectValue(true)}
                                >
                                    True
                                </button>
                                <button
                                    className={`echovault-staging-tf-btn ${(card.editedCorrectValue ?? card.correctValue) === false ? "echovault-staging-tf-btn-active" : ""}`}
                                    onClick={() => onUpdateCorrectValue(false)}
                                >
                                    False
                                </button>
                            </div>
                        </>
                    )}
                    <label className="echovault-staging-label">Answer / Explanation</label>
                    <textarea
                        className="echovault-staging-textarea"
                        value={card.editedAnswer ?? card.answer}
                        onChange={(e) => onUpdateAnswer(e.target.value)}
                        rows={2}
                    />
                </>
            ) : (
                <>
                    <div className={`echovault-staging-type-badge echovault-staging-type-${card.cardType}`}>
                        {card.cardType === "mcq" ? "Multiple Choice" : card.cardType === "tf" ? "True / False" : "Q & A"}
                    </div>
                    {card.duplicateOf && (
                        <div className="echovault-staging-duplicate-warning">
                            Possible duplicate of: <em>{card.duplicateOf}</em>
                        </div>
                    )}
                    <div className="echovault-staging-q">
                        <strong>Q:</strong>
                        <MarkdownText app={app} markdown={card.editedQuestion ?? card.question} sourcePath={card.sourceNotePath} className="echovault-md" />
                    </div>
                    <div className="echovault-staging-a">
                        <strong>A:</strong>
                        <MarkdownText app={app} markdown={card.editedAnswer ?? card.answer} sourcePath={card.sourceNotePath} className="echovault-md" />
                    </div>
                </>
            )}
            <div className="echovault-staging-card-actions">
                <button
                    className={`echovault-staging-action ${card.decision === "accepted" || card.decision === "edited" ? "echovault-staging-action-active-accept" : ""}`}
                    onClick={handleAccept}
                >
                    Accept
                </button>
                <button
                    className={`echovault-staging-action ${card.decision === "rejected" ? "echovault-staging-action-active-reject" : ""}`}
                    onClick={handleReject}
                >
                    Reject
                </button>
                <button className="echovault-staging-action" onClick={onEdit}>
                    {isEditing ? "Done" : "Edit"}
                </button>
                {card.decision !== null && (
                    <button
                        className="echovault-staging-action echovault-staging-action-collapse"
                        onClick={() => setCollapsed(true)}
                        title="Collapse"
                    >
                        ▲
                    </button>
                )}
            </div>
        </div>
    );
}
