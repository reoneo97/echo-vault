import { useState, useEffect, useCallback } from "react";
import type EchoVaultPlugin from "../main";
import { Flashcard } from "../types";
import { sm2 } from "../sm2";
import { nowISO } from "../utils";
import { MCQCard } from "./cards/MCQCard";
import { TFCard } from "./cards/TFCard";
import { RatingButtons } from "./cards/RatingButtons";
import { ReviewSummary, SessionStats } from "./ReviewSummary";

interface ReviewSessionProps {
    plugin: EchoVaultPlugin;
    reviewAll?: boolean;
    onComplete: () => void;
    onBack: () => void;
}

interface UndoSnapshot {
    card: Flashcard;
    index: number;
    quality: number;
}

export function ReviewSession({ plugin, reviewAll = false, onComplete, onBack }: ReviewSessionProps) {
    const [cards, setCards] = useState<Flashcard[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [showingAnswer, setShowingAnswer] = useState(false);
    const [selectedAnswer, setSelectedAnswer] = useState<number | boolean | null>(null);
    const [lastUndo, setLastUndo] = useState<UndoSnapshot | null>(null);
    const [sessionStats, setSessionStats] = useState<SessionStats>({
        total: 0,
        correct: 0,
        ratings: [],
    });

    useEffect(() => {
        setCards(reviewAll ? plugin.store.getAllCards() : plugin.store.getDueCards());
    }, [plugin, reviewAll]);

    const card = cards[currentIndex];

    // Keyboard shortcuts
    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        // Ignore if typing in an input
        const tag = (e.target as HTMLElement).tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

        if (!showingAnswer && e.code === "Space") {
            e.preventDefault();
            if (card?.type === "qa") {
                setShowingAnswer(true);
            }
        }

        if (showingAnswer) {
            const ratingMap: Record<string, number> = {
                "Digit1": 0, // Again
                "Digit2": 2, // Hard
                "Digit3": 4, // Good
                "Digit4": 5, // Easy
            };
            if (e.code in ratingMap) {
                e.preventDefault();
                handleRate(ratingMap[e.code]);
            }
        }
    }, [showingAnswer, card]);

    useEffect(() => {
        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);
    }, [handleKeyDown]);

    if (cards.length === 0) {
        return null;
    }

    if (currentIndex >= cards.length) {
        return (
            <ReviewSummary
                stats={sessionStats}
                onDone={onComplete}
            />
        );
    }

    const handleAnswer = (answer: number | boolean) => {
        setSelectedAnswer(answer);
        setShowingAnswer(true);
    };

    const handleShowAnswer = () => {
        setShowingAnswer(true);
    };

    const handleRate = async (quality: number) => {
        // Save undo snapshot (deep copy before mutation)
        const snapshot: UndoSnapshot = {
            card: { ...card },
            index: currentIndex,
            quality,
        };

        const result = sm2(
            quality,
            card.repetitions,
            card.easinessFactor,
            card.interval
        );

        card.repetitions = result.repetitions;
        card.easinessFactor = result.easinessFactor;
        card.interval = result.interval;
        card.nextReviewDate = result.nextReviewDate;
        card.lastReviewedAt = nowISO();

        await plugin.store.updateCard(card);

        // Log the review
        const correct = quality >= 3;
        await plugin.reviewLog.recordReview(correct, quality);

        // Update session stats
        setSessionStats((prev) => ({
            total: prev.total + 1,
            correct: prev.correct + (correct ? 1 : 0),
            ratings: [...prev.ratings, quality],
        }));

        setLastUndo(snapshot);
        setShowingAnswer(false);
        setSelectedAnswer(null);
        setCurrentIndex((i) => i + 1);
    };

    const handleUndo = async () => {
        if (!lastUndo) return;

        // Restore the card to its previous state
        await plugin.store.updateCard(lastUndo.card);

        // Roll back session stats
        const wasCorrect = lastUndo.quality >= 3;
        setSessionStats((prev) => ({
            total: prev.total - 1,
            correct: prev.correct - (wasCorrect ? 1 : 0),
            ratings: prev.ratings.slice(0, -1),
        }));

        setCurrentIndex(lastUndo.index);
        setShowingAnswer(false);
        setSelectedAnswer(null);
        setLastUndo(null);

        // Refresh cards array so the restored card is up to date
        setCards(reviewAll ? plugin.store.getAllCards() : plugin.store.getDueCards());
    };

    const cardType = card.type ?? "qa";
    const typeLabel =
        cardType === "mcq"
            ? "Multiple Choice"
            : cardType === "tf"
              ? "True / False"
              : "Q & A";

    const progress = (currentIndex / cards.length) * 100;

    return (
        <>
            <div className="echovault-review-header">
                <button
                    className="echovault-btn echovault-btn-back"
                    onClick={onBack}
                >
                    Back
                </button>
                <div className="echovault-review-header-right">
                    {lastUndo && (
                        <button
                            className="echovault-btn echovault-btn-undo"
                            onClick={handleUndo}
                            title="Undo last rating"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" /></svg>
                        </button>
                    )}
                    <span className="echovault-progress">
                        {currentIndex + 1} / {cards.length}
                    </span>
                </div>
            </div>

            <div className="echovault-progress-bar">
                <div
                    className="echovault-progress-bar-fill"
                    style={{ width: `${progress}%` }}
                />
            </div>

            <div className={`echovault-card-type echovault-card-type-${cardType}`}>
                {typeLabel}
            </div>

            <div className={`echovault-card-flip ${showingAnswer ? "echovault-card-flip-revealed" : ""}`}>
                <div className="echovault-question">{card.question}</div>
            </div>

            {card.type === "mcq" && (
                <MCQCard
                    card={card}
                    selectedAnswer={typeof selectedAnswer === "number" ? selectedAnswer : null}
                    onAnswer={handleAnswer}
                />
            )}

            {card.type === "tf" && (
                <TFCard
                    card={card}
                    selectedAnswer={typeof selectedAnswer === "boolean" ? selectedAnswer : null}
                    onAnswer={handleAnswer}
                />
            )}

            {card.type === "qa" && !showingAnswer && (
                <button
                    className="echovault-btn echovault-btn-show"
                    onClick={handleShowAnswer}
                >
                    Show Answer
                    <span className="echovault-shortcut-hint">space</span>
                </button>
            )}

            {showingAnswer && (
                <div className="echovault-answer-reveal">
                    {(() => {
                        const isQA = cardType === "qa";
                        const isCorrect = isQA ? null
                            : card.type === "mcq" ? selectedAnswer === card.correctIndex
                            : card.type === "tf" ? selectedAnswer === card.correctValue
                            : null;
                        const cls = isCorrect === null
                            ? "echovault-answer"
                            : isCorrect
                              ? "echovault-answer echovault-answer-correct"
                              : "echovault-answer echovault-answer-incorrect";
                        return (
                            <div className={cls}>
                                {isCorrect !== null && (
                                    <div className="echovault-answer-feedback">
                                        {isCorrect ? "\u2705 Great job! That's correct" : "\u274C Not quite"}
                                    </div>
                                )}
                                {card.answer}
                            </div>
                        );
                    })()}
                    <RatingButtons onRate={handleRate} />
                </div>
            )}
        </>
    );
}
