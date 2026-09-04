import { TFFlashcard } from "../../types";

interface TFCardProps {
    card: TFFlashcard;
    selectedAnswer: boolean | null;
    onAnswer: (value: boolean) => void;
}

export function TFCard({ card, selectedAnswer, onAnswer }: TFCardProps) {
    const answered = selectedAnswer !== null;

    return (
        <div className="echovault-choices echovault-tf-choices">
            {[true, false].map((value) => {
                let cls = "echovault-btn echovault-btn-choice";
                if (answered) {
                    if (value === card.correctValue) {
                        cls += " echovault-btn-choice-correct";
                    } else if (value === selectedAnswer) {
                        cls += " echovault-btn-choice-incorrect";
                    }
                }

                return (
                    <button
                        key={String(value)}
                        className={cls}
                        disabled={answered}
                        onClick={() => onAnswer(value)}
                    >
                        {value ? "True" : "False"}
                    </button>
                );
            })}
        </div>
    );
}
