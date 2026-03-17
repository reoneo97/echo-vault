import { QAFlashcard } from "../../types";

interface QACardProps {
    card: QAFlashcard;
    showingAnswer: boolean;
    onShowAnswer: () => void;
}

export function QACard({ card, showingAnswer, onShowAnswer }: QACardProps) {
    if (showingAnswer) {
        return <div className="echovault-answer">{card.answer}</div>;
    }

    return (
        <button className="echovault-btn echovault-btn-show" onClick={onShowAnswer}>
            Show Answer
        </button>
    );
}
