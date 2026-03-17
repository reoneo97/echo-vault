import { useState, useEffect } from "react";
import type EchoVaultPlugin from "../main";
import { Flashcard } from "../types";
import { sm2 } from "../sm2";
import { nowISO } from "../utils";
import { MCQCard } from "./cards/MCQCard";
import { TFCard } from "./cards/TFCard";
import { RatingButtons } from "./cards/RatingButtons";

interface ReviewSessionProps {
    plugin: EchoVaultPlugin;
    reviewAll?: boolean;
    onComplete: () => void;
    onBack: () => void;
}

export function ReviewSession({ plugin, reviewAll = false, onComplete, onBack }: ReviewSessionProps) {
    const [cards, setCards] = useState<Flashcard[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [showingAnswer, setShowingAnswer] = useState(false);
    const [selectedAnswer, setSelectedAnswer] = useState<number | boolean | null>(null);

    useEffect(() => {
        setCards(reviewAll ? plugin.store.getAllCards() : plugin.store.getDueCards());
    }, [plugin, reviewAll]);

    const card = cards[currentIndex];

    if (cards.length === 0) {
        return null;
    }

    if (currentIndex >= cards.length) {
        return (
            <div className="echovault-complete">
                <h2>Review complete!</h2>
                <p>You reviewed {cards.length} card(s).</p>
                <button
                    className="echovault-btn echovault-btn-primary"
                    onClick={onComplete}
                >
                    Back to Dashboard
                </button>
            </div>
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

        setShowingAnswer(false);
        setSelectedAnswer(null);
        setCurrentIndex((i) => i + 1);
    };

    const cardType = card.type ?? "qa";
    const typeLabel =
        cardType === "mcq"
            ? "Multiple Choice"
            : cardType === "tf"
              ? "True / False"
              : "Q & A";

    return (
        <>
            <div className="echovault-review-header">
                <button
                    className="echovault-btn echovault-btn-back"
                    onClick={onBack}
                >
                    Back
                </button>
                <span className="echovault-progress">
                    {currentIndex + 1} / {cards.length}
                </span>
            </div>

            <div className={`echovault-card-type echovault-card-type-${cardType}`}>
                {typeLabel}
            </div>

            <div className="echovault-question">{card.question}</div>

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
                </button>
            )}

            {showingAnswer && (
                <>
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
                </>
            )}
        </>
    );
}
