import { useState } from "react";
import { Notice } from "obsidian";
import { CardType, Flashcard } from "../types";
import { generateId, getTodayDateString, nowISO } from "../utils";
import type { FlashcardStore } from "../store";

interface CreateCardProps {
    store: FlashcardStore;
    onBack: () => void;
    onCreated: () => void;
}

export function CreateCard({ store, onBack, onCreated }: CreateCardProps) {
    const [cardType, setCardType] = useState<CardType>("qa");
    const [question, setQuestion] = useState("");
    const [answer, setAnswer] = useState("");

    // MCQ state
    const [choices, setChoices] = useState(["", "", "", ""]);
    const [correctIndex, setCorrectIndex] = useState(0);

    // TF state
    const [correctValue, setCorrectValue] = useState(true);

    const [saving, setSaving] = useState(false);

    const canSave = () => {
        if (!question.trim() || !answer.trim()) return false;
        if (cardType === "mcq" && choices.some((c) => !c.trim())) return false;
        return true;
    };

    const handleSave = async () => {
        if (!canSave()) return;
        setSaving(true);

        const base = {
            id: generateId(),
            question: question.trim(),
            answer: answer.trim(),
            sourceNotePath: "manual",
            commitHash: null,
            createdAt: nowISO(),
            lastReviewedAt: null,
            repetitions: 0,
            easinessFactor: 2.5,
            interval: 0,
            nextReviewDate: getTodayDateString(),
        };

        let card: Flashcard;
        if (cardType === "mcq") {
            card = { ...base, type: "mcq", choices: choices.map((c) => c.trim()), correctIndex };
        } else if (cardType === "tf") {
            card = { ...base, type: "tf", correctValue };
        } else {
            card = { ...base, type: "qa" };
        }

        await store.addCards([card]);
        setSaving(false);
        new Notice("Flashcard created!");
        onCreated();
    };

    const updateChoice = (index: number, value: string) => {
        const updated = [...choices];
        updated[index] = value;
        setChoices(updated);
    };

    return (
        <>
            <div className="echovault-review-header">
                <button className="echovault-btn echovault-btn-back" onClick={onBack}>
                    Back
                </button>
                <span className="echovault-progress">New Card</span>
            </div>

            <div className="echovault-create-form">
                <div className="echovault-create-type-picker">
                    {(["qa", "mcq", "tf"] as CardType[]).map((t) => (
                        <button
                            key={t}
                            className={`echovault-btn echovault-create-type-btn ${cardType === t ? "echovault-create-type-active" : ""}`}
                            onClick={() => setCardType(t)}
                        >
                            {t === "qa" ? "Q&A" : t === "mcq" ? "Multiple Choice" : "True / False"}
                        </button>
                    ))}
                </div>

                <label className="echovault-create-label">Question</label>
                <textarea
                    className="echovault-create-input echovault-create-textarea"
                    placeholder="Enter your question..."
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    rows={3}
                />

                {cardType === "mcq" && (
                    <>
                        <label className="echovault-create-label">Choices</label>
                        {choices.map((choice, i) => (
                            <div key={i} className="echovault-create-choice-row">
                                <input
                                    type="radio"
                                    name="correctChoice"
                                    checked={correctIndex === i}
                                    onChange={() => setCorrectIndex(i)}
                                />
                                <input
                                    className="echovault-create-input"
                                    placeholder={`Choice ${i + 1}`}
                                    value={choice}
                                    onChange={(e) => updateChoice(i, e.target.value)}
                                />
                            </div>
                        ))}
                        <p className="echovault-create-hint">Select the radio button for the correct answer</p>
                    </>
                )}

                {cardType === "tf" && (
                    <>
                        <label className="echovault-create-label">Correct Answer</label>
                        <div className="echovault-create-tf-toggle">
                            <button
                                className={`echovault-btn echovault-create-tf-btn ${correctValue ? "echovault-create-tf-active" : ""}`}
                                onClick={() => setCorrectValue(true)}
                            >
                                True
                            </button>
                            <button
                                className={`echovault-btn echovault-create-tf-btn ${!correctValue ? "echovault-create-tf-active" : ""}`}
                                onClick={() => setCorrectValue(false)}
                            >
                                False
                            </button>
                        </div>
                    </>
                )}

                <label className="echovault-create-label">
                    {cardType === "qa" ? "Answer" : "Explanation"}
                </label>
                <textarea
                    className="echovault-create-input echovault-create-textarea"
                    placeholder={cardType === "qa" ? "Enter the answer..." : "Explain why..."}
                    value={answer}
                    onChange={(e) => setAnswer(e.target.value)}
                    rows={3}
                />

                <button
                    className="echovault-btn echovault-btn-primary"
                    onClick={handleSave}
                    disabled={!canSave() || saving}
                >
                    {saving ? "Saving..." : "Create Card"}
                </button>
            </div>
        </>
    );
}
