import { execFile } from "child_process";

function run(
    command: string,
    args: string[],
    cwd: string
): Promise<string> {
    return new Promise((resolve, reject) => {
        execFile(command, args, { cwd, maxBuffer: 1024 * 1024 * 10 }, (err, stdout, stderr) => {
            if (err) {
                reject(new Error(stderr || err.message));
            } else {
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

export async function gitInit(vaultPath: string): Promise<void> {
    await run("git", ["init"], vaultPath);
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

export async function gitDiff(
    vaultPath: string,
    commitHash: string
): Promise<{ diffText: string; changedFiles: string[] }> {
    const raw = await run(
        "git",
        ["diff", `${commitHash}~1..${commitHash}`],
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
