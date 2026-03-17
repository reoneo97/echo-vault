import { App, Modal } from "obsidian";

export class AboutModal extends Modal {
    constructor(app: App) {
        super(app);
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.addClass("echovault-about-modal");

        contentEl.createEl("h2", { text: "About EchoVault" });
        contentEl.createEl("div", { cls: "echovault-about-version", text: "v0.1.0" });

        contentEl.createEl("p", {
            text: "EchoVault is an Obsidian plugin that generates AI-powered flashcards from your notes and git diffs. It uses SM-2 spaced repetition to schedule reviews, helping you retain what you learn.",
        });

        contentEl.createEl("h3", { text: "Features" });
        const features = contentEl.createEl("ul");
        const featureList = [
            "AI-generated flashcards from git diffs and notes",
            "Three card types: Q&A, Multiple Choice, and True/False",
            "SM-2 spaced repetition scheduling",
            "Powered by LLMs via OpenRouter",
        ];
        for (const f of featureList) {
            features.createEl("li", { text: f });
        }

        // Repo link
        const repoLink = contentEl.createDiv({ cls: "echovault-about-repo" });
        repoLink.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/></svg>`;
        repoLink.appendText(" reoneo97/echo-vault");
        repoLink.addEventListener("click", () => {
            window.open("https://github.com/reoneo97/echo-vault", "_blank");
        });

        const footer = contentEl.createDiv({ cls: "echovault-about-footer" });

        const authorCard = footer.createDiv({ cls: "echovault-about-author" });
        authorCard.addEventListener("click", () => {
            window.open("https://github.com/reoneo97", "_blank");
        });

        const githubIcon = authorCard.createDiv({ cls: "echovault-about-github-icon" });
        githubIcon.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/></svg>`;

        const authorInfo = authorCard.createDiv({ cls: "echovault-about-author-info" });
        authorInfo.createEl("span", { cls: "echovault-about-author-name", text: "Reo Neo" });
        authorInfo.createEl("span", { cls: "echovault-about-author-role", text: "Machine Learning Engineer" });

        footer.createEl("div", { cls: "echovault-about-tagline", text: "Made with curiosity and Claude" });
    }

    onClose() {
        this.contentEl.empty();
    }
}
