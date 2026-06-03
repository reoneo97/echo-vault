import { useState, useEffect, useCallback } from "react";
import type EchoVaultPlugin from "../main";
import { Flashcard } from "../types";
import { sm2 } from "../core/sm2";
import { nowISO } from "../utils";
import { MCQCard } from "./cards/MCQCard";
import { TFCard } from "./cards/TFCard";
import { RatingButtons } from "./cards/RatingButtons";
import { ReviewSummary, SessionStats } from "./ReviewSummary";
import { MarkdownText } from "./MarkdownText";

interface ReviewSessionProps {
    plugin: EchoVaultPlugin;
    reviewAll?: boolean;
    initialCards?: Flashcard[];
    onComplete: () => void;
    onBack: () => void;
}

interface CardSnapshot {
    card: Flashcard;
    quality: number;
}

const RATING_LABELS: Record<number, string> = { 0: "Again", 2: "Hard", 4: "Good", 5: "Easy" };

export function ReviewSession({ plugin, reviewAll = false, initialCards, onComplete, onBack }: ReviewSessionProps) {
    const [cards, setCards] = useState<Flashcard[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [highWaterMark, setHighWaterMark] = useState(0); // index of next unrated card
    const [showingAnswer, setShowingAnswer] = useState(false);
    const [selectedAnswer, setSelectedAnswer] = useState<number | boolean | null>(null);
    const [userDraft, setUserDraft] = useState("");
    // keyed by card index — stores pre-rating state for undo
    const [snapshots, setSnapshots] = useState<Record<number, CardSnapshot>>({});
    // keyed by card index — quality given per card (for session stats)
    const [ratingsByIndex, setRatingsByIndex] = useState<Record<number, number>>({});

    useEffect(() => {
        if (initialCards) {
            setCards(initialCards);
        } else {
            setCards(reviewAll ? plugin.store.getAllCards() : plugin.store.getDueCards());
        }
    }, [plugin, reviewAll, initialCards]);

    const card = cards[currentIndex];
    const isReviewing = currentIndex < highWaterMark; // navigating a previously-rated card

    const sessionStats: SessionStats = {
        total: Object.keys(ratingsByIndex).length,
        correct: Object.values(ratingsByIndex).filter((q) => q >= 3).length,
        ratings: Object.values(ratingsByIndex),
    };

    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        const tag = (e.target as HTMLElement).tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

        if (!showingAnswer && !isReviewing && e.code === "Space") {
            e.preventDefault();
            if (card?.type === "qa") setShowingAnswer(true);
        }
        if (showingAnswer && !isReviewing) {
            const ratingMap: Record<string, number> = {
                Digit1: 0, Digit2: 2, Digit3: 4, Digit4: 5,
            };
            if (e.code in ratingMap) {
                e.preventDefault();
                handleRate(ratingMap[e.code]);
            }
        }
    }, [showingAnswer, isReviewing, card]);

    useEffect(() => {
        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);
    }, [handleKeyDown]);

    if (cards.length === 0) return null;

    if (currentIndex >= cards.length) {
        return <ReviewSummary stats={sessionStats} onDone={onComplete} />;
    }

    const handleAnswer = (answer: number | boolean) => {
        setSelectedAnswer(answer);
        setShowingAnswer(true);
    };

    const handleRate = async (quality: number) => {
        // Store pre-rating snapshot for undo
        setSnapshots((prev) => ({ ...prev, [currentIndex]: { card: { ...card }, quality } }));
        setRatingsByIndex((prev) => ({ ...prev, [currentIndex]: quality }));

        const result = sm2(quality, card.repetitions, card.easinessFactor, card.interval);
        card.repetitions = result.repetitions;
        card.easinessFactor = result.easinessFactor;
        card.interval = result.interval;
        card.nextReviewDate = result.nextReviewDate;
        card.lastReviewedAt = nowISO();
        card.reviewHistory = [...(card.reviewHistory ?? []), { date: card.lastReviewedAt, quality }];

        await plugin.store.updateCard(card);
        await plugin.reviewLog.recordReview(quality >= 3, quality);

        const next = currentIndex + 1;
        setHighWaterMark((prev) => Math.max(prev, next));
        setCurrentIndex(next);
        setShowingAnswer(false);
        setSelectedAnswer(null);
        setUserDraft("");
    };

    const handleUndo = async () => {
        const snapshot = snapshots[currentIndex];
        if (!snapshot) return;

        await plugin.store.updateCard(snapshot.card);
        await plugin.reviewLog.undoReview(snapshot.quality >= 3, snapshot.quality);
        setCards((prev) => prev.map((c, i) => i === currentIndex ? { ...snapshot.card } : c));

        setSnapshots((prev) => { const n = { ...prev }; delete n[currentIndex]; return n; });
        setRatingsByIndex((prev) => { const n = { ...prev }; delete n[currentIndex]; return n; });

        setHighWaterMark(currentIndex);
        setShowingAnswer(false);
        setSelectedAnswer(null);
        setUserDraft("");
    };

    const goBack = () => {
        if (currentIndex === 0) return;
        setCurrentIndex((i) => i - 1);
        setShowingAnswer(true);
        setSelectedAnswer(null);
        setUserDraft("");
    };

    const goForward = () => {
        if (currentIndex >= highWaterMark) return;
        const next = currentIndex + 1;
        setCurrentIndex(next);
        setShowingAnswer(next < highWaterMark);
        if (next >= highWaterMark) {
            setSelectedAnswer(null);
            setUserDraft("");
        }
    };

    const cardType = card.type ?? "qa";
    const typeLabel = cardType === "mcq" ? "Multiple Choice" : cardType === "tf" ? "True / False" : "Q & A";
    const progress = (highWaterMark / cards.length) * 100;
    const snapshot = snapshots[currentIndex];

    return (
        <>
            <div className="echovault-review-header">
                <button className="echovault-btn echovault-btn-back" onClick={onBack}>Back</button>
                <span className="echovault-progress">{highWaterMark} / {cards.length}</span>
                {highWaterMark > 0 && (
                    <button
                        className="echovault-btn echovault-btn-finish-early"
                        onClick={() => setCurrentIndex(cards.length)}
                    >
                        Finish
                    </button>
                )}
            </div>

            <div className="echovault-progress-bar">
                <div className="echovault-progress-bar-fill" style={{ width: `${progress}%` }} />
            </div>

            <div className={`echovault-card-type echovault-card-type-${cardType}`}>{typeLabel}</div>

            <div className="echovault-card-flip">
                <MarkdownText
                    app={plugin.app}
                    markdown={card.question}
                    sourcePath={card.sourceNotePath !== "manual" ? card.sourceNotePath : undefined}
                    className="echovault-question echovault-md"
                />
            </div>

            {/* Previously rated card — show answer + undo */}
            {isReviewing && (
                <div className="echovault-answer-reveal">
                    <div className="echovault-answer">
                        {snapshot && (
                            <div className="echovault-prev-rating">
                                Rated: <strong>{RATING_LABELS[snapshot.quality] ?? snapshot.quality}</strong>
                            </div>
                        )}
                        <MarkdownText
                            app={plugin.app}
                            markdown={card.answer}
                            sourcePath={card.sourceNotePath !== "manual" ? card.sourceNotePath : undefined}
                            className="echovault-md"
                        />
                    </div>
                    {snapshot && (
                        <button className="echovault-btn echovault-btn-undo-rating" onClick={handleUndo}>
                            Undo Rating
                        </button>
                    )}
                </div>
            )}

            {/* Current unrated card */}
            {!isReviewing && (
                <>
                    {cardType === "mcq" && (
                        <MCQCard
                            card={card}
                            selectedAnswer={typeof selectedAnswer === "number" ? selectedAnswer : null}
                            onAnswer={handleAnswer}
                        />
                    )}
                    {cardType === "tf" && (
                        <TFCard
                            card={card}
                            selectedAnswer={typeof selectedAnswer === "boolean" ? selectedAnswer : null}
                            onAnswer={handleAnswer}
                        />
                    )}
                    {cardType === "qa" && !showingAnswer && (
                        <>
                            <textarea
                                className="echovault-draft-input"
                                placeholder="Write your answer before revealing..."
                                value={userDraft}
                                onChange={(e) => setUserDraft(e.target.value)}
                                rows={3}
                            />
                            <button className="echovault-btn echovault-btn-show" onClick={() => setShowingAnswer(true)}>
                                Show Answer
                                <span className="echovault-shortcut-hint">space</span>
                            </button>
                        </>
                    )}
                    {showingAnswer && (
                        <div className="echovault-answer-reveal">
                            {(() => {
                                const isCorrect = cardType === "qa" ? null
                                    : cardType === "mcq" ? selectedAnswer === card.correctIndex
                                    : cardType === "tf" ? selectedAnswer === card.correctValue
                                    : null;
                                const cls = isCorrect === null ? "echovault-answer"
                                    : isCorrect ? "echovault-answer echovault-answer-correct"
                                    : "echovault-answer echovault-answer-incorrect";
                                return (
                                    <div className={cls}>
                                        {isCorrect !== null && (
                                            <div className="echovault-answer-feedback">
                                                {isCorrect ? "✅ Great job! That's correct" : "❌ Not quite"}
                                            </div>
                                        )}
                                        <MarkdownText
                                            app={plugin.app}
                                            markdown={card.answer}
                                            sourcePath={card.sourceNotePath !== "manual" ? card.sourceNotePath : undefined}
                                            className="echovault-md"
                                        />
                                    </div>
                                );
                            })()}
                            <RatingButtons onRate={handleRate} />
                        </div>
                    )}
                </>
            )}

            {/* Navigation */}
            <div className="echovault-review-nav">
                <button
                    className="echovault-btn echovault-review-nav-btn"
                    onClick={goBack}
                    disabled={currentIndex === 0}
                    title="Previous card"
                >
                    ←
                </button>
                <span className="echovault-review-nav-pos">{currentIndex + 1} / {cards.length}</span>
                <button
                    className="echovault-btn echovault-review-nav-btn"
                    onClick={goForward}
                    disabled={currentIndex >= highWaterMark}
                    title="Next card"
                >
                    →
                </button>
            </div>
        </>
    );
}
