import { useState } from "react";
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
                    <div key={group.sourceNote} className="echovault-staging-group">
                        <button
                            className="echovault-staging-group-header"
                            onClick={() => toggleGroup(group.sourceNote)}
                        >
                            <span className={`echovault-chevron ${expandedGroups.has(group.sourceNote) ? "echovault-chevron-open" : ""}`}>&#9656;</span>
                            <span className="echovault-staging-group-name">{group.sourceNote}</span>
                            <span className="echovault-staging-group-count">{group.cards.length}</span>
                        </button>
                        {expandedGroups.has(group.sourceNote) && (
                            <div className="echovault-staging-cards">
                                {group.cards.map((card) => (
                                    <StagingCard
                                        key={card.tempId}
                                        card={card}
                                        isEditing={editingCard === card.tempId}
                                        onEdit={() => setEditingCard(editingCard === card.tempId ? null : card.tempId)}
                                        onAccept={() => updateCard(card.tempId, { decision: card.editedQuestion || card.editedAnswer ? "edited" : "accepted" })}
                                        onReject={() => updateCard(card.tempId, { decision: "rejected" })}
                                        onUpdateQuestion={(q) => updateCard(card.tempId, { editedQuestion: q })}
                                        onUpdateAnswer={(a) => updateCard(card.tempId, { editedAnswer: a })}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
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
    const decisionClass = card.decision === "accepted" || card.decision === "edited"
        ? "echovault-staging-card-accepted"
        : card.decision === "rejected"
        ? "echovault-staging-card-rejected"
        : "";

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
