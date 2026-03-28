import { execFile } from "child_process";
import { readFile, writeFile, rm } from "fs/promises";
import { join } from "path";
import { Logger } from "./logger";

let _logger: Logger | undefined;

export function setGitLogger(logger: Logger) {
    _logger = logger;
}

function run(
    command: string,
    args: string[],
    cwd: string
): Promise<string> {
    const cmd = `${command} ${args.join(" ")}`;
    _logger?.info("git exec", { cmd });
    return new Promise((resolve, reject) => {
        execFile(command, args, { cwd, maxBuffer: 1024 * 1024 * 10 }, (err, stdout, stderr) => {
            if (err) {
                _logger?.error("git exec failed", { cmd, error: stderr || err.message });
                reject(new Error(stderr || err.message));
            } else {
                _logger?.info("git exec ok", { cmd, outputLength: stdout.length });
                resolve(stdout);
            }
        });
    });
}

export async function isOwnGitRepo(vaultPath: string): Promise<boolean> {
    try {
        const toplevel = (
            await run("git", ["rev-parse", "--show-toplevel"], vaultPath)
        ).trim();
        // Only true if the git root IS the vault path, not a parent
        return toplevel === vaultPath || toplevel === vaultPath.replace(/\/$/, "");
    } catch {
        return false;
    }
}

export async function gitRemoveRepo(vaultPath: string): Promise<void> {
    await rm(join(vaultPath, ".git"), { recursive: true, force: true });
}

export async function gitInit(vaultPath: string): Promise<void> {
    await run("git", ["init"], vaultPath);
    await ensureGitignore(vaultPath);
}

async function ensureGitignore(vaultPath: string): Promise<void> {
    const gitignorePath = join(vaultPath, ".gitignore");
    let content = "";
    try {
        content = await readFile(gitignorePath, "utf-8");
    } catch {
        // File doesn't exist yet
    }

    const lines = content.split("\n");
    if (!lines.some((line) => line.trim() === ".obsidian")) {
        const newEntry = content.endsWith("\n") || content === "" ? ".obsidian\n" : "\n.obsidian\n";
        await writeFile(gitignorePath, content + newEntry, "utf-8");
    }
}

export interface CommitResult {
    hash: string;
    hasChanges: boolean;
}

export async function gitCommit(
    vaultPath: string,
    message: string
): Promise<CommitResult> {
    await run("git", ["add", "-A"], vaultPath);

    try {
        await run("git", ["commit", "-m", message], vaultPath);
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        if (msg.includes("nothing to commit")) {
            return { hash: "", hasChanges: false };
        }
        throw e;
    }

    const hash = (
        await run("git", ["rev-parse", "HEAD"], vaultPath)
    ).trim();
    return { hash, hasChanges: true };
}

export interface LogEntry {
    hash: string;
    shortHash: string;
    date: string;
    message: string;
    files: string[];
}

export async function gitLog(
    vaultPath: string,
    count: number = 30
): Promise<LogEntry[]> {
    const SEP = "<<SEP>>";
    const raw = await run(
        "git",
        ["log", `--max-count=${count}`, `--pretty=format:${SEP}%H${SEP}%h${SEP}%aI${SEP}%s`, "--name-only"],
        vaultPath
    );

    const entries: LogEntry[] = [];
    // Split on the separator that starts each commit block
    const blocks = raw.split(SEP).filter((b) => b.trim());

    // blocks come in groups of 4: hash, shortHash, date, "message\n\nfile1\nfile2..."
    for (let i = 0; i + 3 < blocks.length; i += 4) {
        const hash = blocks[i].trim();
        const shortHash = blocks[i + 1].trim();
        const date = blocks[i + 2].trim();
        const rest = blocks[i + 3];

        // First line is the message, remaining non-empty lines are filenames
        const restLines = rest.split("\n");
        const message = restLines[0].trim();
        const files = restLines.slice(1).map((l) => l.trim()).filter(Boolean);

        entries.push({ hash, shortHash, date, message, files });
    }

    return entries;
}

export async function gitDiff(
    vaultPath: string,
    commitHash: string
): Promise<{ diffText: string; changedFiles: string[] }> {
    const raw = await run(
        "git",
        ["diff", `${commitHash}~1..${commitHash}`, "--", "*.md"],
        vaultPath
    );

    const changedFiles: string[] = [];
    const addedLines: string[] = [];

    for (const line of raw.split("\n")) {
        if (line.startsWith("diff --git")) {
            const match = line.match(/b\/(.+)$/);
            if (match) changedFiles.push(match[1]);
        } else if (
            line.startsWith("+") &&
            !line.startsWith("+++") &&
            !line.startsWith("+++ ")
        ) {
            addedLines.push(line.substring(1));
        }
    }

    return { diffText: addedLines.join("\n"), changedFiles };
}
