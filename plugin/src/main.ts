import { Notice, Plugin } from "obsidian";
import { DEFAULT_SETTINGS, EchoVaultSettings, GenerationResult } from "./core/types";
import { EchoVaultSettingTab } from "./components/SettingsTab";
import { FlashcardStore } from "./core/store";
import { ReviewLog } from "./core/review-log";
import { Logger } from "./core/logger";
import { checkBackendHealth } from "./core/api-client";
import { commitAndGenerate, forceGenerateFromFile, importVault, GenerateStage } from "./core/generate";
import { setGitLogger } from "./core/git";
import { EchoVaultSidebarView, VIEW_TYPE } from "./components/SidebarView";

export default class EchoVaultPlugin extends Plugin {
    settings: EchoVaultSettings = DEFAULT_SETTINGS;
    store!: FlashcardStore;
    reviewLog!: ReviewLog;
    logger!: Logger;
    private statusBarEl: HTMLElement | null = null;

    async onload() {
        await this.loadSettings();

        this.logger = new Logger(this.app.vault, this.settings);
        this.logger.info("Plugin loading");
        setGitLogger(this.logger);

        this.store = new FlashcardStore(this.app.vault, this.settings);
        await this.store.load();

        this.reviewLog = new ReviewLog(this.app.vault, this.settings);
        await this.reviewLog.load();

        // Settings tab
        this.addSettingTab(new EchoVaultSettingTab(this.app, this));

        // Register sidebar view
        this.registerView(VIEW_TYPE, (leaf) => new EchoVaultSidebarView(leaf, this));

        // Commands
        this.addCommand({
            id: "commit-and-generate",
            name: "Commit & Generate Flashcards",
            callback: () => this.commitAndGenerate(),
        });

        this.addCommand({
            id: "open-sidebar",
            name: "Open EchoVault Panel",
            callback: () => this.activateSidebar(),
        });

        this.addCommand({
            id: "import-vault",
            name: "Import All Notes (Generate Cards from Entire Vault)",
            callback: () => this.importVault(),
        });

        this.addCommand({
            id: "force-regenerate-active-file",
            name: "Regenerate Cards from Active File",
            checkCallback: (checking) => {
                const file = this.app.workspace.getActiveFile();
                if (file && file.extension === "md") {
                    if (!checking) this.forceRegenerateFromFile(file.path);
                    return true;
                }
                return false;
            },
        });

        // Ribbon icon opens the sidebar
        this.addRibbonIcon("brain", "Open EchoVault", () =>
            this.activateSidebar()
        );

        // Status bar
        this.statusBarEl = this.addStatusBarItem();
        this.updateStatusBar();

        // Health check
        const healthy = await checkBackendHealth(this.settings);
        if (healthy) {
            new Notice("Connected to EchoVault backend");
            this.logger.info("Backend connected", { url: this.settings.backendUrl });
        } else {
            new Notice("EchoVault backend not reachable. Check settings.");
            this.logger.warn("Backend not reachable", { url: this.settings.backendUrl });
        }

        this.logger.info("Plugin loaded");
    }

    async onunload() {
        this.logger.info("Plugin unloading");
        await this.logger.flush();
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

    getVaultPath(): string {
        const adapter = this.app.vault.adapter as { getBasePath?: () => string };
        if (adapter.getBasePath) {
            return adapter.getBasePath();
        }
        throw new Error("Could not determine vault path");
    }

    async commitAndGenerate(onProgress?: (stage: GenerateStage) => void): Promise<GenerationResult | null> {
        try {
            const vaultPath = this.getVaultPath();
            const result = await commitAndGenerate(vaultPath, this.app.vault, this.store, this.settings, this.logger, onProgress);
            return result;
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            new Notice(`EchoVault error: ${msg}`);
            this.logger.error("commitAndGenerate failed", { error: msg });
            throw e;
        }
    }

    async forceRegenerateFromFile(filePath: string): Promise<GenerationResult | null> {
        try {
            const vaultPath = this.getVaultPath();
            return await forceGenerateFromFile(filePath, vaultPath, this.app.vault, this.store, this.settings, this.logger);
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            new Notice(`EchoVault error: ${msg}`);
            this.logger.error("forceRegenerateFromFile failed", { error: msg });
            throw e;
        }
    }

    async importVault(): Promise<GenerationResult | null> {
        try {
            const vaultPath = this.getVaultPath();
            return await importVault(vaultPath, this.app.vault, this.store, this.settings, this.logger);
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            new Notice(`EchoVault error: ${msg}`);
            this.logger.error("importVault failed", { error: msg });
            throw e;
        }
    }

    private async activateSidebar() {
        const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE);
        if (existing.length > 0) {
            this.app.workspace.revealLeaf(existing[0]);
            return;
        }
        const leaf = this.app.workspace.getRightLeaf(false);
        if (leaf) {
            await leaf.setViewState({ type: VIEW_TYPE, active: true });
            this.app.workspace.revealLeaf(leaf);
        }
    }

    private refreshSidebar() {
        for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE)) {
            const view = leaf.view as EchoVaultSidebarView;
            view.refresh();
        }
    }

    updateStatusBar() {
        if (!this.statusBarEl) return;
        const { due, total } = this.store.getStats();
        this.statusBarEl.setText(
            due > 0 ? `EchoVault: ${due} due` : `EchoVault: ${total} cards`
        );
    }
}
