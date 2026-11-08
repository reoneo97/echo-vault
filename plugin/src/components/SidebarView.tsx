import { ItemView, Notice, WorkspaceLeaf } from "obsidian";
import { StrictMode } from "react";
import { createRoot, Root } from "react-dom/client";
import type EchoVaultPlugin from "../main";
import { EchoVaultApp } from "./App";

export const VIEW_TYPE = "echovault-sidebar";

export class EchoVaultSidebarView extends ItemView {
    private root: Root | null = null;

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
        this.root = createRoot(this.contentEl);
        this.root.render(
            <StrictMode>
                <EchoVaultApp plugin={this.plugin} />
            </StrictMode>
        );
    }

    async onClose() {
        this.root?.unmount();
    }

    refresh() {
        // Re-mount to trigger fresh state
        if (this.root) {
            this.root.unmount();
        }
        this.root = createRoot(this.contentEl);
        this.root.render(
            <StrictMode>
                <EchoVaultApp plugin={this.plugin} />
            </StrictMode>
        );
    }
}
