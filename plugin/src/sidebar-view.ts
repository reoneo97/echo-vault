import { ItemView, Notice, WorkspaceLeaf } from "obsidian";
import { Flashcard } from "./types";
import { sm2 } from "./sm2";
import { FlashcardStore } from "./store";
import { isOwnGitRepo, gitInit } from "./git";
import { nowISO } from "./utils";
import type EchoVaultPlugin from "./main";

export const VIEW_TYPE = "echovault-sidebar";

const RATINGS: { label: string; quality: number }[] = [
    { label: "Again", quality: 0 },
    { label: "Hard", quality: 2 },
    { label: "Good", quality: 4 },
    { label: "Easy", quality: 5 },
];

type Panel = "dashboard" | "review";

export class EchoVaultSidebarView extends ItemView {
    private panel: Panel = "dashboard";
    private reviewCards: Flashcard[] = [];
    private currentIndex = 0;
    private showingAnswer = false;

    constructor(
        leaf: WorkspaceLeaf,
        private plugin: EchoVaultPlugin
    ) {
        super(leaf);
    }

    getViewType(): string {
        return VIEW_TYPE;
    }

    getDisplayText(): string {
        return "EchoVault";
    }

    getIcon(): string {
        return "brain";
    }

    async onOpen() {
        this.renderDashboard();
    }

    async onClose() {
        this.contentEl.empty();
    }

    refresh() {
        if (this.panel === "dashboard") {
            this.renderDashboard();
        }
    }

    // -- Dashboard --

    private renderDashboard() {
        this.panel = "dashboard";
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass("echovault-sidebar");

        // Header
        contentEl.createEl("h3", { text: "EchoVault", cls: "echovault-sidebar-title" });

        // Stats
        const { due, total } = this.plugin.store.getStats();
        const statsEl = contentEl.createDiv({ cls: "echovault-stats" });
        this.renderStat(statsEl, String(total), "Total cards");
        this.renderStat(statsEl, String(due), "Due now");

        // Actions
        const actionsEl = contentEl.createDiv({ cls: "echovault-actions" });

        const commitBtn = actionsEl.createEl("button", {
            text: "Commit & Generate",
            cls: "echovault-btn echovault-btn-primary",
        });
        commitBtn.addEventListener("click", async () => {
            commitBtn.disabled = true;
            commitBtn.setText("Working...");
            await this.plugin.commitAndGenerate();
            this.renderDashboard();
        });

        const reviewBtn = actionsEl.createEl("button", {
            text: `Review (${due} due)`,
            cls: "echovault-btn echovault-btn-show",
        });
        reviewBtn.disabled = due === 0;
        reviewBtn.addEventListener("click", () => this.startReview());
    }

    private renderStat(parent: HTMLElement, value: string, label: string) {
        const stat = parent.createDiv({ cls: "echovault-stat" });
        stat.createDiv({ cls: "echovault-stat-value", text: value });
        stat.createDiv({ cls: "echovault-stat-label", text: label });
    }

    // -- Review --

    private startReview() {
        this.reviewCards = this.plugin.store.getDueCards();
        this.currentIndex = 0;
        this.showingAnswer = false;
        if (this.reviewCards.length === 0) {
            this.renderDashboard();
            return;
        }
        this.renderReviewCard();
    }

    private renderReviewCard() {
        this.panel = "review";
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass("echovault-sidebar");

        const card = this.reviewCards[this.currentIndex];

        // Back button + progress
        const header = contentEl.createDiv({ cls: "echovault-review-header" });
        const backBtn = header.createEl("button", {
            text: "Back",
            cls: "echovault-btn echovault-btn-back",
        });
        backBtn.addEventListener("click", () => this.renderDashboard());
        header.createSpan({
            text: `${this.currentIndex + 1} / ${this.reviewCards.length}`,
            cls: "echovault-progress",
        });

        // Question
        contentEl.createDiv({ cls: "echovault-question", text: card.question });

        if (this.showingAnswer) {
            contentEl.createDiv({ cls: "echovault-answer", text: card.answer });

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
            const showBtn = contentEl.createEl("button", {
                text: "Show Answer",
                cls: "echovault-btn echovault-btn-show",
            });
            showBtn.addEventListener("click", () => {
                this.showingAnswer = true;
                this.renderReviewCard();
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

        await this.plugin.store.updateCard(card);

        this.currentIndex++;
        this.showingAnswer = false;

        if (this.currentIndex >= this.reviewCards.length) {
            this.renderReviewComplete();
        } else {
            this.renderReviewCard();
        }
    }

    private renderReviewComplete() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass("echovault-sidebar");

        const doneEl = contentEl.createDiv({ cls: "echovault-complete" });
        doneEl.createEl("h2", { text: "Review complete!" });
        doneEl.createEl("p", {
            text: `You reviewed ${this.reviewCards.length} card(s).`,
        });

        const backBtn = contentEl.createEl("button", {
            text: "Back to Dashboard",
            cls: "echovault-btn echovault-btn-primary",
        });
        backBtn.addEventListener("click", () => this.renderDashboard());
    }
}
