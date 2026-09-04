import { MCQFlashcard } from "../../types";

interface MCQCardProps {
    card: MCQFlashcard;
    selectedAnswer: number | null;
    onAnswer: (index: number) => void;
}

export function MCQCard({ card, selectedAnswer, onAnswer }: MCQCardProps) {
    const answered = selectedAnswer !== null;

    return (
        <div className="echovault-choices">
            {card.choices.map((choice, i) => {
                let cls = "echovault-btn echovault-btn-choice";
                if (answered) {
                    if (i === card.correctIndex) {
                        cls += " echovault-btn-choice-correct";
                    } else if (i === selectedAnswer) {
                        cls += " echovault-btn-choice-incorrect";
                    } else {
                        cls += " echovault-btn-choice-disabled";
                    }
                }

                return (
                    <button
                        key={i}
                        className={cls}
                        disabled={answered}
                        onClick={() => onAnswer(i)}
                    >
                        <span className="echovault-choice-label">{String.fromCharCode(65 + i)}.</span>
                        <span className="echovault-choice-text">{choice}</span>
                    </button>
                );
            })}
        </div>
    );
}
