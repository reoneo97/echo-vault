import { useState } from "react";

interface TutorialProps {
    onComplete: () => void;
}

const STEPS = [
    {
        title: "Welcome to EchoVault",
        description: "Turn your notes into lasting knowledge. EchoVault watches what you write, generates flashcards with AI, and schedules reviews so you never forget.",
        icon: (
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a7 7 0 0 0-7 7c0 2.38 1.19 4.47 3 5.74V17a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-2.26c1.81-1.27 3-3.36 3-5.74a7 7 0 0 0-7-7z"/><path d="M9 21h6"/><path d="M10 17v-2.5"/><path d="M14 17v-2.5"/></svg>
        ),
    },
    {
        title: "Write & Commit",
        description: "Write your notes as usual. When you're ready, hit Commit & Generate — EchoVault commits your changes and sends the diff to an AI that creates flashcards from what's new.",
        icon: (
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 16 12 12 8 16" /><line x1="12" y1="12" x2="12" y2="21" /><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" /></svg>
        ),
    },
    {
        title: "Three Card Types",
        description: "Cards come in three flavors: Q&A for open-ended recall, Multiple Choice for recognition, and True/False for quick fact-checking. You can also create cards manually.",
        icon: (
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /></svg>
        ),
    },
    {
        title: "Spaced Repetition",
        description: "EchoVault uses the SM-2 algorithm to schedule reviews. Cards you find easy appear less often, while tricky ones come back sooner — optimizing your study time.",
        icon: (
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
        ),
    },
    {
        title: "Review & Rate",
        description: "During reviews, rate each card from Again to Easy. Use keyboard shortcuts for speed: Space to reveal, then 1-4 to rate. Your streak tracks daily consistency.",
        icon: (
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" /></svg>
        ),
    },
    {
        title: "You're all set!",
        description: "Start by committing some notes to generate your first flashcards, or create a card manually to get a feel for the review flow.",
        icon: (
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>
        ),
    },
];

export function Tutorial({ onComplete }: TutorialProps) {
    const [step, setStep] = useState(0);
    const current = STEPS[step];
    const isLast = step === STEPS.length - 1;

    return (
        <div className="echovault-tutorial">
            <div className="echovault-tutorial-progress">
                {STEPS.map((_, i) => (
                    <div
                        key={i}
                        className={`echovault-tutorial-dot ${i === step ? "echovault-tutorial-dot-active" : ""} ${i < step ? "echovault-tutorial-dot-done" : ""}`}
                    />
                ))}
            </div>

            <div className="echovault-tutorial-card">
                <div className="echovault-tutorial-icon">{current.icon}</div>
                <h3 className="echovault-tutorial-title">{current.title}</h3>
                <p className="echovault-tutorial-desc">{current.description}</p>
            </div>

            <div className="echovault-tutorial-actions">
                {step > 0 && (
                    <button
                        className="echovault-btn echovault-btn-back"
                        onClick={() => setStep((s) => s - 1)}
                    >
                        Back
                    </button>
                )}
                {!isLast ? (
                    <button
                        className="echovault-btn echovault-btn-primary echovault-tutorial-next"
                        onClick={() => setStep((s) => s + 1)}
                    >
                        Next
                    </button>
                ) : (
                    <button
                        className="echovault-btn echovault-btn-primary echovault-tutorial-next"
                        onClick={onComplete}
                    >
                        Get Started
                    </button>
                )}
            </div>

            {!isLast && (
                <button
                    className="echovault-tutorial-skip"
                    onClick={onComplete}
                >
                    Skip tutorial
                </button>
            )}
        </div>
    );
}
