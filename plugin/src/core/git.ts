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

/** Returns true if any EchoVault commit exists in the repo history. */
export async function gitHasEchoVaultCommits(vaultPath: string): Promise<boolean> {
    try {
        const result = await run("git", ["log", "--oneline", "--grep=EchoVault:", "-1"], vaultPath);
        return result.trim().length > 0;
    } catch {
        return false;
    }
}

/** Returns true if the repo has at least one commit (safe to diff against HEAD). */
export async function gitHasCommits(vaultPath: string): Promise<boolean> {
    try {
        await run("git", ["rev-parse", "HEAD"], vaultPath);
        return true;
    } catch {
        return false;
    }
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
    const ignoreEntries = [".obsidian", "EchoVault/"];
    const missing = ignoreEntries.filter((entry) => !lines.some((line) => line.trim() === entry));
    if (missing.length > 0) {
        const suffix = (content.endsWith("\n") || content === "" ? "" : "\n") + missing.join("\n") + "\n";
        await writeFile(gitignorePath, content + suffix, "utf-8");
    }
}

export async function gitResetLastCommit(vaultPath: string): Promise<void> {
    await run("git", ["reset", "--soft", "HEAD~1"], vaultPath);
}

/** Creates an empty commit (no file changes) and returns the new commit hash. */
export async function gitCommitAllowEmpty(vaultPath: string, message: string): Promise<string> {
    await run("git", ["commit", "--allow-empty", "-m", message], vaultPath);
    return (await run("git", ["rev-parse", "HEAD"], vaultPath)).trim();
}

export async function gitCommitCount(vaultPath: string): Promise<number> {
    try {
        const count = await run("git", ["rev-list", "--count", "HEAD"], vaultPath);
        return parseInt(count.trim(), 10);
    } catch {
        return 0;
    }
}

export interface StatusEntry {
    status: string;   // "M", "A", "D", "??" etc.
    file: string;
}

export async function gitStatus(vaultPath: string): Promise<StatusEntry[]> {
    const raw = await run("git", ["status", "--short"], vaultPath);
    if (!raw.trim()) return [];
    return raw.trim().split("\n").map((line) => ({
        status: line.substring(0, 2).trim(),
        file: line.substring(3).replace(/^"|"$/g, ""),
    }));
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

export interface FileDiff {
    path: string;
    content: string;
}

export async function gitDiff(
    vaultPath: string,
    commitHash: string
): Promise<{ files: FileDiff[] }> {
    const commitCount = await gitCommitCount(vaultPath);
    const raw = commitCount <= 1
        ? await run("git", ["show", "--format=", commitHash, "--", "*.md"], vaultPath)
        : await run("git", ["diff", `${commitHash}~1`, commitHash, "--", "*.md"], vaultPath);

    const fileMap = new Map<string, string[]>();
    let currentFile: string | null = null;

    for (const line of raw.split("\n")) {
        if (line.startsWith("diff --git")) {
            const match = line.match(/b\/(.+)$/);
            if (match) {
                currentFile = match[1];
                fileMap.set(currentFile, []);
            }
        } else if (
            currentFile &&
            line.startsWith("+") &&
            !line.startsWith("+++") &&
            !line.startsWith("+++ ")
        ) {
            fileMap.get(currentFile)!.push(line.substring(1));
        }
    }

    const files: FileDiff[] = [];
    for (const [path, lines] of fileMap) {
        const content = lines.join("\n");
        if (content.trim()) {
            files.push({ path, content });
        }
    }

    return { files };
}
