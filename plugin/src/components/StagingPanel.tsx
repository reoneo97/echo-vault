import { useState, useRef } from "react";
import { Flashcard, GenerationResult, StagedCard, StagedFileGroup, CardFeedbackEntry } from "../types";
import { generateId, nowISO, getTodayDateString } from "../utils";

interface StagingPanelProps {
    generationResult: GenerationResult;
    onConfirm: (acceptedCards: Flashcard[], feedback: CardFeedbackEntry[]) => Promise<void>;
    onCancel: () => void;
}

export function StagingPanel({ generationResult, onConfirm, onCancel }: StagingPanelProps) {
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

    const setAllDecisions = (decision: "accepted" | "rejected") => {
        setGroups((prev) =>
            prev.map((g) => ({
                ...g,
                cards: g.cards.map((c) => ({ ...c, decision })),
            }))
        );
    };

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

        const acceptedCards: Flashcard[] = accepted.map((c) => ({
            id: generateId(),
            type: "qa" as const,
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
        }));

        const feedback: CardFeedbackEntry[] = allCards
            .filter((c) => c.decision !== null)
            .map((c) => ({
                question: c.question,
                answer: c.answer,
                source_note: c.sourceNotePath,
                commit_hash: c.commitHash,
                decision: c.decision!,
                ...(c.editedQuestion ? { edited_question: c.editedQuestion } : {}),
                ...(c.editedAnswer ? { edited_answer: c.editedAnswer } : {}),
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
                        sourceNote={group.sourceNote}
                        cards={group.cards}
                        expanded={expandedGroups.has(group.sourceNote)}
                        editingCardId={editingCard}
                        onToggle={() => toggleGroup(group.sourceNote)}
                        onAcceptAll={() => setGroupDecision(group.sourceNote, "accepted")}
                        onRejectAll={() => setGroupDecision(group.sourceNote, "rejected")}
                        onAcceptCard={(tempId) => {
                            const card = group.cards.find((c) => c.tempId === tempId);
                            const decision = card?.editedQuestion || card?.editedAnswer ? "edited" : "accepted";
                            updateCard(tempId, { decision });
                        }}
                        onRejectCard={(tempId) => updateCard(tempId, { decision: "rejected" })}
                        onEditToggle={(tempId) => setEditingCard(editingCard === tempId ? null : tempId)}
                        onUpdateQuestion={(tempId, q) => updateCard(tempId, { editedQuestion: q })}
                        onUpdateAnswer={(tempId, a) => updateCard(tempId, { editedAnswer: a })}
                    />
                ))}
            </div>

            <div className="echovault-staging-footer">
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
}: {
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
                                card={card}
                                isEditing={editingCardId === card.tempId}
                                onEdit={() => onEditToggle(card.tempId)}
                                onAccept={() => onAcceptCard(card.tempId)}
                                onReject={() => onRejectCard(card.tempId)}
                                onUpdateQuestion={(q) => onUpdateQuestion(card.tempId, q)}
                                onUpdateAnswer={(a) => onUpdateAnswer(card.tempId, a)}
                            />
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}

function StagingCard({
    card,
    isEditing,
    onEdit,
    onAccept,
    onReject,
    onUpdateQuestion,
    onUpdateAnswer,
}: {
    card: StagedCard;
    isEditing: boolean;
    onEdit: () => void;
    onAccept: () => void;
    onReject: () => void;
    onUpdateQuestion: (q: string) => void;
    onUpdateAnswer: (a: string) => void;
}) {
    const [collapsed, setCollapsed] = useState(false);

    const decisionClass = card.decision === "accepted" || card.decision === "edited"
        ? "echovault-staging-card-accepted"
        : card.decision === "rejected"
        ? "echovault-staging-card-rejected"
        : "";

    // Auto-collapse when a decision is made
    const prevDecision = useRef(card.decision);
    if (prevDecision.current === null && card.decision !== null) {
        setCollapsed(true);
    }
    prevDecision.current = card.decision;

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
                    <label className="echovault-staging-label">Question</label>
                    <textarea
                        className="echovault-staging-textarea"
                        value={card.editedQuestion ?? card.question}
                        onChange={(e) => onUpdateQuestion(e.target.value)}
                        rows={2}
                    />
                    <label className="echovault-staging-label">Answer</label>
                    <textarea
                        className="echovault-staging-textarea"
                        value={card.editedAnswer ?? card.answer}
                        onChange={(e) => onUpdateAnswer(e.target.value)}
                        rows={2}
                    />
                </>
            ) : (
                <>
                    <div className="echovault-staging-q"><strong>Q:</strong> {card.editedQuestion ?? card.question}</div>
                    <div className="echovault-staging-a"><strong>A:</strong> {card.editedAnswer ?? card.answer}</div>
                </>
            )}
            <div className="echovault-staging-card-actions">
                <button
                    className={`echovault-staging-action ${card.decision === "accepted" || card.decision === "edited" ? "echovault-staging-action-active-accept" : ""}`}
                    onClick={onAccept}
                >
                    Accept
                </button>
                <button
                    className={`echovault-staging-action ${card.decision === "rejected" ? "echovault-staging-action-active-reject" : ""}`}
                    onClick={onReject}
                >
                    Reject
                </button>
                <button className="echovault-staging-action" onClick={onEdit}>
                    {isEditing ? "Done" : "Edit"}
                </button>
            </div>
        </div>
    );
}
