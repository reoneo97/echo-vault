import { Modal, App } from "obsidian";
import { Flashcard } from "./types";
import { sm2 } from "./core/sm2";
import { FlashcardStore } from "./core/store";
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

        // Question
        const questionEl = contentEl.createDiv({ cls: "echovault-question" });
        questionEl.setText(card.question);

        if (this.showingAnswer) {
            // Answer
            const answerEl = contentEl.createDiv({ cls: "echovault-answer" });
            answerEl.setText(card.answer);

            // Rating buttons
            const ratingContainer = contentEl.createDiv({
                cls: "echovault-ratings",
            });
            for (const { label, quality } of RATINGS) {
                const btn = ratingContainer.createEl("button", {
                    text: label,
                    cls: `echovault-btn echovault-btn-${label.toLowerCase()}`,
                });
                btn.addEventListener("click", () =>
                    this.rateCard(card, quality)
                );
            }
        } else {
            // Show Answer button
            const showBtn = contentEl.createEl("button", {
                text: "Show Answer",
                cls: "echovault-btn echovault-btn-show",
            });
            showBtn.addEventListener("click", () => {
                this.showingAnswer = true;
                this.renderCard();
            });
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
