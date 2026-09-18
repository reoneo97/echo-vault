import { App, PluginSettingTab, Setting } from "obsidian";
import type EchoVaultPlugin from "../main";

export class EchoVaultSettingTab extends PluginSettingTab {
    plugin: EchoVaultPlugin;

    constructor(app: App, plugin: EchoVaultPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        new Setting(containerEl)
            .setName("Backend URL")
            .setDesc("URL of the EchoVault Python backend")
            .addText((text) =>
                text
                    .setPlaceholder("http://localhost:8000")
                    .setValue(this.plugin.settings.backendUrl)
                    .onChange(async (value) => {
                        this.plugin.settings.backendUrl = value;
                        await this.plugin.saveSettings();
                    })
            );

        new Setting(containerEl)
            .setName("Flashcard folder")
            .setDesc("Folder in your vault where flashcard data is stored")
            .addText((text) =>
                text
                    .setPlaceholder("EchoVault")
                    .setValue(this.plugin.settings.flashcardFolderPath)
                    .onChange(async (value) => {
                        this.plugin.settings.flashcardFolderPath = value;
                        await this.plugin.saveSettings();
                    })
            );

        new Setting(containerEl)
            .setName("Data file name")
            .setDesc("Name of the JSON file storing flashcards")
            .addText((text) =>
                text
                    .setPlaceholder("flashcards.json")
                    .setValue(this.plugin.settings.dataFileName)
                    .onChange(async (value) => {
                        this.plugin.settings.dataFileName = value;
                        await this.plugin.saveSettings();
                    })
            );

        new Setting(containerEl)
            .setName("Max cards per generation")
            .setDesc("Maximum number of flashcards to generate per commit")
            .addSlider((slider) =>
                slider
                    .setLimits(1, 30, 1)
                    .setValue(this.plugin.settings.maxCardsPerGeneration)
                    .setDynamicTooltip()
                    .onChange(async (value) => {
                        this.plugin.settings.maxCardsPerGeneration = value;
                        await this.plugin.saveSettings();
                    })
            );

        new Setting(containerEl)
            .setName("Scoped folders")
            .setDesc(
                "Only generate cards from notes inside these folders (comma-separated, e.g. \"knowledge,courses\"). " +
                "Leave empty to process the entire vault."
            )
            .addText((text) =>
                text
                    .setPlaceholder("knowledge,courses")
                    .setValue(this.plugin.settings.scopedFolders)
                    .onChange(async (value) => {
                        this.plugin.settings.scopedFolders = value;
                        await this.plugin.saveSettings();
                    })
            );
    }
}
