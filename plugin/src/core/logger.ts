import { Vault } from "obsidian";
import { EchoVaultSettings } from "../types";

type LogLevel = "INFO" | "WARN" | "ERROR";

const LOG_FILE = "echovault.log";
const MAX_LINES = 500;

export class Logger {
    private buffer: string[] = [];
    private flushTimer: ReturnType<typeof setTimeout> | null = null;

    constructor(
        private vault: Vault,
        private settings: EchoVaultSettings
    ) {}

    private get filePath(): string {
        return `${this.settings.flashcardFolderPath}/${LOG_FILE}`;
    }

    info(message: string, context?: Record<string, unknown>) {
        this.write("INFO", message, context);
    }

    warn(message: string, context?: Record<string, unknown>) {
        this.write("WARN", message, context);
    }

    error(message: string, context?: Record<string, unknown>) {
        this.write("ERROR", message, context);
    }

    private write(level: LogLevel, message: string, context?: Record<string, unknown>) {
        const timestamp = new Date().toISOString();
        let line = `[${timestamp}] ${level}: ${message}`;
        if (context) {
            line += ` | ${JSON.stringify(context)}`;
        }

        // Also log to console for dev tools
        const consoleFn = level === "ERROR" ? console.error : level === "WARN" ? console.warn : console.log;
        consoleFn(`EchoVault ${line}`);

        this.buffer.push(line);
        this.scheduleFlush();
    }

    private scheduleFlush() {
        if (this.flushTimer) return;
        this.flushTimer = setTimeout(() => {
            this.flushTimer = null;
            this.flush();
        }, 500);
    }

    async flush(): Promise<void> {
        if (this.buffer.length === 0) return;
        const newLines = this.buffer.splice(0);

        try {
            const adapter = this.vault.adapter;

            // Ensure folder exists
            const folderExists = await adapter.exists(this.settings.flashcardFolderPath);
            if (!folderExists) {
                await adapter.mkdir(this.settings.flashcardFolderPath);
            }

            let existing = "";
            const fileExists = await adapter.exists(this.filePath);
            if (fileExists) {
                existing = await adapter.read(this.filePath);
            }

            const allLines = existing
                ? existing.split("\n").concat(newLines)
                : newLines;

            // Trim to max lines
            const trimmed = allLines.length > MAX_LINES
                ? allLines.slice(allLines.length - MAX_LINES)
                : allLines;

            await adapter.write(this.filePath, trimmed.join("\n"));
        } catch (e) {
            // Last resort: console only
            console.error("EchoVault logger flush failed:", e);
        }
    }
}
