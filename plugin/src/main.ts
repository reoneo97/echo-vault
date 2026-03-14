import { Notice, Plugin } from "obsidian";
import { DEFAULT_SETTINGS, EchoVaultSettings } from "./types";
import { EchoVaultSettingTab } from "./settings";
import { FlashcardStore } from "./store";
import { checkBackendHealth } from "./api-client";
import { commitAndGenerate } from "./generate";
import { ReviewModal } from "./review-modal";

export default class EchoVaultPlugin extends Plugin {
    settings: EchoVaultSettings = DEFAULT_SETTINGS;
    store!: FlashcardStore;
    private statusBarEl: HTMLElement | null = null;

    async onload() {
        await this.loadSettings();

        this.store = new FlashcardStore(this.app.vault, this.settings);
        await this.store.load();

        // Settings tab
        this.addSettingTab(new EchoVaultSettingTab(this.app, this));

        // Commands
        this.addCommand({
            id: "commit-and-generate",
            name: "Commit & Generate Flashcards",
            callback: () => this.handleCommitAndGenerate(),
        });

        this.addCommand({
            id: "review-flashcards",
            name: "Review Flashcards",
            callback: () => this.handleReview(),
        });

        // Ribbon icon
        this.addRibbonIcon("brain", "Review EchoVault Flashcards", () =>
            this.handleReview()
        );

        // Status bar
        this.statusBarEl = this.addStatusBarItem();
        this.updateStatusBar();

        // Health check
        const healthy = await checkBackendHealth(this.settings);
        if (healthy) {
            new Notice("Connected to EchoVault backend");
        } else {
            new Notice(
                "EchoVault backend not reachable. Check settings."
            );
        }

        console.log("EchoVault loaded");
    }

    onunload() {
        console.log("EchoVault unloaded");
    }

    async loadSettings() {
        this.settings = Object.assign(
            {},
            DEFAULT_SETTINGS,
            await this.loadData()
        );
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    private getVaultPath(): string {
        const adapter = this.app.vault.adapter as { getBasePath?: () => string };
        if (adapter.getBasePath) {
            return adapter.getBasePath();
        }
        throw new Error("Could not determine vault path");
    }

    private async handleCommitAndGenerate() {
        try {
            const vaultPath = this.getVaultPath();
            await commitAndGenerate(vaultPath, this.store, this.settings);
            this.updateStatusBar();
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            new Notice(`EchoVault error: ${msg}`);
            console.error("EchoVault:", e);
        }
    }

    private handleReview() {
        new ReviewModal(this.app, this.store).open();
        // Update status bar after modal closes
        setTimeout(() => this.updateStatusBar(), 500);
    }

    private updateStatusBar() {
        if (!this.statusBarEl) return;
        const { due, total } = this.store.getStats();
        this.statusBarEl.setText(
            due > 0 ? `EchoVault: ${due} due` : `EchoVault: ${total} cards`
        );
    }
}
