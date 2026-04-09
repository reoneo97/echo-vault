import { Modal, App } from "obsidian";
import { Flashcard } from "./types";
import { sm2 } from "./sm2";
import { FlashcardStore } from "./store";
import { nowISO } from "./utils";

const RATINGS: { label: string; quality: number }[] = [
    { label: "Again", quality: 0 },
    { label: "Hard", quality: 2 },
    { label: "Good", quality: 4 },
    { label: "Easy", quality: 5 },
];

export class ReviewModal extends Modal {
    private cards: Flashcard[];
    private currentIndex = 0;
    private showingAnswer = false;
    private selectedOption: string | null = null;

    constructor(
        app: App,
        private store: FlashcardStore
    ) {
        super(app);
        this.cards = store.getDueCards();
    }

    onOpen() {
        this.modalEl.addClass("echovault-review-modal");
        if (this.cards.length === 0) {
            this.renderComplete();
        } else {
            this.renderCard();
        }
    }

    onClose() {
        this.contentEl.empty();
    }

    private renderCard() {
        const { contentEl } = this;
        contentEl.empty();

        const card = this.cards[this.currentIndex];

        // Progress
        const progress = contentEl.createDiv({ cls: "echovault-progress" });
        progress.setText(
            `Card ${this.currentIndex + 1} of ${this.cards.length}`
        );

        // Card type badge
        const type = card.type ?? "standard";
        if (type !== "standard") {
            const badge = type === "true_false" ? "True / False" : "Multiple Choice";
            contentEl.createDiv({ cls: "echovault-card-type-badge", text: badge });
        }

        // Question
        const questionEl = contentEl.createDiv({ cls: "echovault-question" });
        questionEl.setText(card.question);

        if (type === "standard") {
            this.renderStandardCard(contentEl, card);
        } else if (type === "true_false") {
            this.renderTrueFalseCard(contentEl, card);
        } else if (type === "multiple_choice") {
            this.renderMultipleChoiceCard(contentEl, card);
        }
    }

    private renderStandardCard(container: HTMLElement, card: Flashcard) {
        if (this.showingAnswer) {
            container.createDiv({ cls: "echovault-answer", text: card.answer });
            this.renderRatingButtons(container, card);
        } else {
            const showBtn = container.createEl("button", {
                text: "Show Answer",
                cls: "echovault-btn echovault-btn-show",
            });
            showBtn.addEventListener("click", () => {
                this.showingAnswer = true;
                this.renderCard();
            });
        }
    }

    private renderTrueFalseCard(container: HTMLElement, card: Flashcard) {
        if (this.selectedOption !== null) {
            const correct = card.correctAnswer ?? card.answer;
            const isCorrect = this.selectedOption === correct.toLowerCase();
            this.renderAnswerFeedback(container, isCorrect, correct === "true" ? "True" : "False");
            if (card.answer && card.answer.toLowerCase() !== correct) {
                container.createDiv({ cls: "echovault-answer", text: card.answer });
            }
            this.renderRatingButtons(container, card);
        } else {
            const optionsEl = container.createDiv({ cls: "echovault-tf-options" });
            for (const value of ["true", "false"]) {
                const btn = optionsEl.createEl("button", {
                    text: value === "true" ? "True" : "False",
                    cls: "echovault-btn echovault-btn-tf",
                });
                btn.addEventListener("click", () => {
                    this.selectedOption = value;
                    this.showingAnswer = true;
                    this.renderCard();
                });
            }
        }
    }

    private renderMultipleChoiceCard(container: HTMLElement, card: Flashcard) {
        const options = card.options ?? [];
        if (this.selectedOption !== null) {
            const correct = card.correctAnswer ?? card.answer;
            const isCorrect = this.selectedOption === correct;
            this.renderAnswerFeedback(container, isCorrect, correct);
            const optionsEl = container.createDiv({ cls: "echovault-mcq-options" });
            for (const opt of options) {
                const cls = ["echovault-mcq-option", "echovault-mcq-option-disabled"];
                if (opt === correct) cls.push("echovault-mcq-option-correct");
                else if (opt === this.selectedOption) cls.push("echovault-mcq-option-incorrect");
                optionsEl.createDiv({ cls: cls.join(" "), text: opt });
            }
            if (card.answer && card.answer !== correct) {
                container.createDiv({ cls: "echovault-answer", text: card.answer });
            }
            this.renderRatingButtons(container, card);
        } else {
            const optionsEl = container.createDiv({ cls: "echovault-mcq-options" });
            for (const opt of options) {
                const optEl = optionsEl.createDiv({ cls: "echovault-mcq-option", text: opt });
                optEl.addEventListener("click", () => {
                    this.selectedOption = opt;
                    this.showingAnswer = true;
                    this.renderCard();
                });
            }
        }
    }

    private renderAnswerFeedback(container: HTMLElement, isCorrect: boolean, correctAnswer: string) {
        const feedbackEl = container.createDiv({
            cls: `echovault-feedback ${isCorrect ? "echovault-feedback-correct" : "echovault-feedback-incorrect"}`,
        });
        feedbackEl.createSpan({ text: isCorrect ? "Correct!" : `Incorrect — answer: ${correctAnswer}` });
    }

    private renderRatingButtons(container: HTMLElement, card: Flashcard) {
        const ratingContainer = container.createDiv({ cls: "echovault-ratings" });
        for (const { label, quality } of RATINGS) {
            const btn = ratingContainer.createEl("button", {
                text: label,
                cls: `echovault-btn echovault-btn-${label.toLowerCase()}`,
            });
            btn.addEventListener("click", () => this.rateCard(card, quality));
        }
    }

    private async rateCard(card: Flashcard, quality: number) {
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

        await this.store.updateCard(card);

        this.currentIndex++;
        this.showingAnswer = false;
        this.selectedOption = null;

        if (this.currentIndex >= this.cards.length) {
            this.renderComplete();
        } else {
            this.renderCard();
        }
    }

    private renderComplete() {
        const { contentEl } = this;
        contentEl.empty();

        const doneEl = contentEl.createDiv({ cls: "echovault-complete" });

        if (this.cards.length === 0) {
            doneEl.createEl("h2", { text: "No cards due!" });
            doneEl.createEl("p", { text: "All caught up. Check back later." });
        } else {
            doneEl.createEl("h2", { text: "Review complete!" });
            doneEl.createEl("p", {
                text: `You reviewed ${this.cards.length} card(s).`,
            });
        }

        const closeBtn = contentEl.createEl("button", {
            text: "Close",
            cls: "echovault-btn",
        });
        closeBtn.addEventListener("click", () => this.close());
    }
}
