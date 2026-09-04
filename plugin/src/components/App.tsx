import { useState, useEffect, useCallback, useRef } from "react";
import { Notice } from "obsidian";
import type EchoVaultPlugin from "../main";
import { Flashcard, CardType, GenerationResult, CardFeedbackEntry } from "../core/types";
import { isOwnGitRepo, gitInit, gitRemoveRepo, gitStatus, gitHasEchoVaultCommits, StatusEntry } from "../core/git";
import { checkBackendHealth, sendFeedback } from "../core/api-client";
import { GenerateStage, importSelected } from "../core/generate";
import { generateId, getTodayDateString, nowISO, questionSimilarity } from "../core/utils";
import { Header } from "./Header";
import { Dashboard } from "./Dashboard";
import { ReviewSession } from "./ReviewSession";
import { CardBrowser } from "./CardBrowser";
import { CreateCard } from "./CreateCard";
import { GitLog } from "./GitLog";
import { Tutorial } from "./Tutorial";
import { EmptyState } from "./EmptyState";
import { StagingPanel } from "./StagingPanel";
import { ImportQueue } from "./ImportQueue";

type Panel = "init" | "tutorial" | "dashboard" | "review" | "review-all" | "browse" | "create" | "git-log" | "staging" | "import-queue";

const PANEL_LABELS: Record<Panel, string> = {
    init: "Setup",
    tutorial: "Tutorial",
    dashboard: "Dashboard",
    review: "Review",
    "review-all": "Review All",
    browse: "Browse",
    create: "Create",
    "git-log": "History",
    staging: "Review Cards",
    "import-queue": "Import Existing Notes",
};

export function EchoVaultApp({ plugin }: { plugin: EchoVaultPlugin }) {
    const [panel, setPanel] = useState<Panel>("dashboard");
    const [prevPanel, setPrevPanel] = useState<Panel | null>(null);
    const [animating, setAnimating] = useState(false);
    const [gitInitialized, setGitInitialized] = useState(false);
    const [backendOnline, setBackendOnline] = useState(false);
    const [stats, setStats] = useState({ total: 0, due: 0 });
    const [streak, setStreak] = useState(0);
    const [forecast, setForecast] = useState({ tomorrow: 0, thisWeek: 0 });
    const [changedFiles, setChangedFiles] = useState<StatusEntry[]>([]);
    const [generateStage, setGenerateStage] = useState<GenerateStage | null>(null);
    const [generationResult, setGenerationResult] = useState<GenerationResult | null>(null);
    const [importQueueCount, setImportQueueCount] = useState(0);
    const [reviewCards, setReviewCards] = useState<import("../core/types").Flashcard[] | null>(null);
    const panelRef = useRef<HTMLDivElement>(null);

    const navigateTo = useCallback((next: Panel) => {
        setPrevPanel(panel);
        setAnimating(true);
        setPanel(next);
        // Clear animation class after transition
        setTimeout(() => setAnimating(false), 200);
    }, [panel]);

    const refreshStats = useCallback(() => {
        setStats(plugin.store.getStats());
        setStreak(plugin.reviewLog.getStreak());
        setForecast(plugin.store.getForecast());
    }, [plugin]);

    const refreshChangedFiles = useCallback(async () => {
        try {
            const files = await gitStatus(plugin.getVaultPath());
            setChangedFiles(files);
        } catch {
            setChangedFiles([]);
        }
    }, [plugin]);

    // Refresh file list whenever dashboard is shown
    useEffect(() => {
        if (panel === "dashboard") {
            refreshChangedFiles();
        }
    }, [panel, refreshChangedFiles]);

    useEffect(() => {
        async function checkGit() {
            const vaultPath = plugin.getVaultPath();
            const hasRepo = await isOwnGitRepo(vaultPath);
            setGitInitialized(hasRepo);
            if (hasRepo) {
                if (!plugin.settings.hasSeenTutorial) {
                    setPanel("tutorial");
                } else {
                    setPanel("dashboard");
                }
                refreshChangedFiles();

                // On first EchoVault use, populate the import queue with all vault notes
                const hasHistory = await gitHasEchoVaultCommits(vaultPath);
                if (!hasHistory && plugin.store.getImportQueue().length === 0) {
                    const EXCLUDED = [plugin.settings.flashcardFolderPath + "/", ".obsidian/"];
                    const allPaths = plugin.app.vault.getMarkdownFiles()
                        .filter((f) => !EXCLUDED.some((p) => f.path.startsWith(p)))
                        .map((f) => f.path);
                    await plugin.store.initImportQueue(allPaths);
                }
                setImportQueueCount(plugin.store.getImportQueue().length);
            } else {
                setPanel("init");
            }
        }
        async function checkBackend() {
            const healthy = await checkBackendHealth(plugin.settings);
            setBackendOnline(healthy);
        }
        checkGit();
        checkBackend();
        refreshStats();
    }, [plugin, refreshStats, refreshChangedFiles]);

    const handleTutorialComplete = async () => {
        plugin.settings.hasSeenTutorial = true;
        await plugin.saveSettings();
        navigateTo("dashboard");
    };

    const handleGitInit = async () => {
        try {
            const vaultPath = plugin.getVaultPath();
            await gitInit(vaultPath);
            setGitInitialized(true);

            // Populate import queue — no EchoVault history exists yet after a fresh git init
            if (plugin.store.getImportQueue().length === 0) {
                const EXCLUDED = [plugin.settings.flashcardFolderPath + "/", ".obsidian/"];
                const allPaths = plugin.app.vault.getMarkdownFiles()
                    .filter((f) => !EXCLUDED.some((p) => f.path.startsWith(p)))
                    .map((f) => f.path);
                await plugin.store.initImportQueue(allPaths);
                setImportQueueCount(allPaths.length);
            }

            new Notice("Git repository initialized — you're all set!");
            if (!plugin.settings.hasSeenTutorial) {
                navigateTo("tutorial");
            } else {
                navigateTo("dashboard");
            }
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            new Notice(`Failed to initialize git: ${msg}`);
        }
    };

    const handleCheckBackend = async (): Promise<boolean> => {
        const healthy = await checkBackendHealth(plugin.settings);
        setBackendOnline(healthy);
        return healthy;
    };

    const handleCommitAndGenerate = async () => {
        try {
            const result = await plugin.commitAndGenerate((stage) => setGenerateStage(stage));
            setGenerateStage(null);
            if (result) {
                // Annotate staged cards with duplicate warnings
                const existingCards = plugin.store.getAllCards();
                const SIMILARITY_THRESHOLD = 0.6;
                const annotated = result.fileGroups.map((fg) => ({
                    ...fg,
                    cards: fg.cards.map((card) => {
                        const similar = existingCards.find(
                            (ec) => ec.sourceNotePath === card.sourceNotePath &&
                                questionSimilarity(card.question, ec.question) >= SIMILARITY_THRESHOLD
                        );
                        return similar ? { ...card, duplicateOf: similar.question } : card;
                    }),
                }));
                setGenerationResult({ ...result, fileGroups: annotated });
                navigateTo("staging");
                return;
            }
        } catch {
            const healthy = await checkBackendHealth(plugin.settings);
            setBackendOnline(healthy);
        }
        setGenerateStage(null);
        refreshStats();
        refreshChangedFiles();
    };

    const handleStagingConfirm = async (acceptedCards: Flashcard[], feedback: CardFeedbackEntry[]) => {
        if (acceptedCards.length > 0) {
            await plugin.store.addCards(acceptedCards);
        }
        if (generationResult?.processedFiles) {
            await plugin.store.recordProcessedFiles(generationResult.processedFiles);
        }
        try {
            await sendFeedback(feedback, plugin.settings);
        } catch {
            // Feedback is best-effort
        }
        setGenerationResult(null);
        setImportQueueCount(plugin.store.getImportQueue().length);
        plugin.updateStatusBar();
        refreshStats();
        refreshChangedFiles();
        navigateTo("dashboard");
        new Notice(`Saved ${acceptedCards.length} card${acceptedCards.length !== 1 ? "s" : ""}`);
    };

    const handleStagingCancel = async () => {
        if (generationResult) {
            const feedback: CardFeedbackEntry[] = generationResult.fileGroups.flatMap((fg) =>
                fg.cards.map((c) => ({
                    question: c.question,
                    answer: c.answer,
                    source_note: c.sourceNotePath,
                    commit_hash: c.commitHash,
                    decision: "rejected" as const,
                }))
            );
            try {
                await sendFeedback(feedback, plugin.settings);
            } catch {
                // Best-effort
            }
        }
        setGenerationResult(null);
        refreshStats();
        refreshChangedFiles();
        navigateTo("dashboard");
    };

    const handleDeleteRepo = async () => {
        try {
            const vaultPath = plugin.getVaultPath();
            await gitRemoveRepo(vaultPath);
            setGitInitialized(false);
            new Notice("Git repository removed.");
            navigateTo("init");
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            new Notice(`Failed to remove git repo: ${msg}`);
        }
    };

    const handleImportSelected = async (selectedPaths: string[], onProgress?: (completed: number, total: number) => void) => {
        try {
            const vaultPath = plugin.getVaultPath();
            const result = await importSelected(selectedPaths, vaultPath, plugin.app.vault, plugin.store, plugin.settings, plugin.logger, onProgress);
            if (result) {
                const existingCards = plugin.store.getAllCards();
                const SIMILARITY_THRESHOLD = 0.6;
                const annotated = result.fileGroups.map((fg) => ({
                    ...fg,
                    cards: fg.cards.map((card) => {
                        const similar = existingCards.find(
                            (ec) => ec.sourceNotePath === card.sourceNotePath &&
                                questionSimilarity(card.question, ec.question) >= SIMILARITY_THRESHOLD
                        );
                        return similar ? { ...card, duplicateOf: similar.question } : card;
                    }),
                }));
                setGenerationResult({ ...result, fileGroups: annotated });
                navigateTo("staging");
            }
        } catch {
            const healthy = await checkBackendHealth(plugin.settings);
            setBackendOnline(healthy);
        }
    };

    const handleImportVault = async () => {
        try {
            const result = await plugin.importVault();
            if (result) {
                const existingCards = plugin.store.getAllCards();
                const SIMILARITY_THRESHOLD = 0.6;
                const annotated = result.fileGroups.map((fg) => ({
                    ...fg,
                    cards: fg.cards.map((card) => {
                        const similar = existingCards.find(
                            (ec) => ec.sourceNotePath === card.sourceNotePath &&
                                questionSimilarity(card.question, ec.question) >= SIMILARITY_THRESHOLD
                        );
                        return similar ? { ...card, duplicateOf: similar.question } : card;
                    }),
                }));
                setGenerationResult({ ...result, fileGroups: annotated });
                navigateTo("staging");
            }
        } catch {
            const healthy = await checkBackendHealth(plugin.settings);
            setBackendOnline(healthy);
        }
    };

    const handleForceRegenerateActiveFile = async () => {
        const activeFile = plugin.app.workspace.getActiveFile();
        if (!activeFile || activeFile.extension !== "md") {
            new Notice("Open a markdown note first, then click Regenerate.");
            return;
        }
        try {
            const result = await plugin.forceRegenerateFromFile(activeFile.path);
            if (result) {
                const existingCards = plugin.store.getAllCards();
                const SIMILARITY_THRESHOLD = 0.6;
                const annotated = result.fileGroups.map((fg) => ({
                    ...fg,
                    cards: fg.cards.map((card) => {
                        const similar = existingCards.find(
                            (ec) => ec.sourceNotePath === card.sourceNotePath &&
                                questionSimilarity(card.question, ec.question) >= SIMILARITY_THRESHOLD
                        );
                        return similar ? { ...card, duplicateOf: similar.question } : card;
                    }),
                }));
                setGenerationResult({ ...result, fileGroups: annotated });
                navigateTo("staging");
            }
        } catch {
            const healthy = await checkBackendHealth(plugin.settings);
            setBackendOnline(healthy);
        }
    };

    const handleOpenDataFolder = () => {
        const { shell } = require("electron") as typeof import("electron");
        const folderPath = `${plugin.getVaultPath()}/${plugin.settings.flashcardFolderPath}`;
        shell.openPath(folderPath);
    };

    const handleDeleteAllCards = async () => {
        await plugin.store.clearAll();
        plugin.updateStatusBar();
        refreshStats();
        new Notice("All flashcards deleted.");
    };

    const handleAddTestCard = async () => {
        const types: CardType[] = ["qa", "mcq", "tf"];
        const cardType = types[Math.floor(Math.random() * types.length)];

        const qaSamples = [
            { q: "What is a closure?", a: "A function that captures variables from its enclosing scope, retaining access even after the outer function returns." },
            { q: "What is the event loop in JavaScript?", a: "A mechanism that processes the callback queue, executing tasks when the call stack is empty, enabling non-blocking I/O." },
            { q: "What is memoization?", a: "An optimization that caches the results of expensive function calls and returns the cached result for repeated inputs." },
        ];
        const mcqSamples = [
            { q: "Which data structure uses FIFO ordering?", a: "Queue — it processes elements in First-In, First-Out order.", choices: ["Stack", "Queue", "Binary Tree", "Hash Map"], correctIndex: 1 },
            { q: "What is the time complexity of binary search?", a: "O(log n) — it halves the search space with each comparison.", choices: ["O(n)", "O(log n)", "O(n log n)", "O(1)"], correctIndex: 1 },
            { q: "Which HTTP method is idempotent?", a: "PUT — calling it multiple times produces the same result as calling it once.", choices: ["POST", "PUT", "PATCH", "CONNECT"], correctIndex: 1 },
        ];
        const tfSamples = [
            { q: "JavaScript is a statically typed language.", a: "False — JavaScript is dynamically typed. Types are determined at runtime, not compile time.", correctValue: false },
            { q: "TCP guarantees ordered delivery of packets.", a: "True — TCP uses sequence numbers to ensure packets are delivered in order.", correctValue: true },
            { q: "In Python, lists are immutable.", a: "False — Python lists are mutable. Tuples are the immutable sequence type.", correctValue: false },
        ];

        const base = {
            id: `test-${generateId()}`,
            sourceNotePath: "test/synthetic.md",
            commitHash: "test-" + generateId(),
            createdAt: nowISO(),
            lastReviewedAt: null,
            repetitions: 0,
            easinessFactor: 2.5,
            interval: 0,
            nextReviewDate: getTodayDateString(),
        };

        let card: Flashcard;
        if (cardType === "mcq") {
            const s = mcqSamples[Math.floor(Math.random() * mcqSamples.length)];
            card = { ...base, type: "mcq", question: s.q, answer: s.a, choices: s.choices, correctIndex: s.correctIndex };
        } else if (cardType === "tf") {
            const s = tfSamples[Math.floor(Math.random() * tfSamples.length)];
            card = { ...base, type: "tf", question: s.q, answer: s.a, correctValue: s.correctValue };
        } else {
            const s = qaSamples[Math.floor(Math.random() * qaSamples.length)];
            card = { ...base, type: "qa", question: s.q, answer: s.a };
        }

        await plugin.store.addCards([card]);
        refreshStats();
        const label = cardType === "mcq" ? "Multiple Choice" : cardType === "tf" ? "True/False" : "Q&A";
        new Notice(`Added ${label} card — ${stats.total + 1} cards total`);
    };

    const handleStartReview = () => {
        if (stats.due === 0) {
            new Notice("No cards due for review right now");
            return;
        }
        navigateTo("review");
    };

    const handleReviewComplete = () => {
        refreshStats();
        navigateTo("dashboard");
    };

    // Breadcrumb: show parent > current for non-dashboard panels
    const showBreadcrumb = panel !== "dashboard" && panel !== "init" && panel !== "tutorial";
    const breadcrumbParent = panel === "review-all" ? "Browse" : "Home";
    const breadcrumbParentPanel: Panel = panel === "review-all" ? "browse" : "dashboard";

    return (
        <div className="echovault-sidebar">
            <Header
                gitInitialized={gitInitialized}
                app={plugin.app}
                pluginId={plugin.manifest.id}
                showInfo={panel === "dashboard" || panel === "init"}
                showTutorialLink={panel === "dashboard" && plugin.settings.hasSeenTutorial}
                onTutorial={() => navigateTo("tutorial")}
            />

            {showBreadcrumb && (
                <div className="echovault-breadcrumb">
                    <button
                        className="echovault-breadcrumb-link"
                        onClick={() => { refreshStats(); navigateTo(breadcrumbParentPanel); }}
                    >
                        {breadcrumbParent}
                    </button>
                    <span className="echovault-breadcrumb-sep">/</span>
                    <span className="echovault-breadcrumb-current">{PANEL_LABELS[panel]}</span>
                </div>
            )}

            <div
                ref={panelRef}
                className={`echovault-panel ${animating ? "echovault-panel-enter" : ""}`}
            >
                {panel === "init" && (
                    <InitPanel onInit={handleGitInit} />
                )}

                {panel === "tutorial" && (
                    <Tutorial onComplete={handleTutorialComplete} />
                )}

                {panel === "dashboard" && (
                    <Dashboard
                        stats={stats}
                        streak={streak}
                        forecast={forecast}
                        reviewLog={plugin.reviewLog}
                        backendOnline={backendOnline}
                        changedFiles={changedFiles}
                        generateStage={generateStage}
                        onCheckBackend={handleCheckBackend}
                        onCommitAndGenerate={handleCommitAndGenerate}
                        onStartReview={handleStartReview}
                        onAddTestCard={handleAddTestCard}
                        onBrowse={() => navigateTo("browse")}
                        onCreate={() => navigateTo("create")}
                        onGitLog={() => navigateTo("git-log")}
                        onDeleteAllCards={handleDeleteAllCards}
                        onDeleteRepo={handleDeleteRepo}
                        onOpenDataFolder={handleOpenDataFolder}
                        onForceRegenerate={handleForceRegenerateActiveFile}
                        onImportVault={handleImportVault}
                        importQueueCount={importQueueCount}
                        onOpenImportQueue={() => navigateTo("import-queue")}
                    />
                )}

                {panel === "review" && (
                    stats.due === 0 ? (
                        <EmptyState
                            icon={<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>}
                            title="All caught up!"
                            description="No cards are due for review right now. Come back later or create new cards."
                            action={{ label: "Back to Dashboard", onClick: () => navigateTo("dashboard") }}
                        />
                    ) : (
                        <ReviewSession
                            plugin={plugin}
                            onComplete={handleReviewComplete}
                            onBack={() => { refreshStats(); navigateTo("dashboard"); }}
                        />
                    )
                )}

                {panel === "review-all" && (
                    <ReviewSession
                        plugin={plugin}
                        reviewAll
                        initialCards={reviewCards ?? undefined}
                        onComplete={handleReviewComplete}
                        onBack={() => { refreshStats(); setReviewCards(null); navigateTo("browse"); }}
                    />
                )}

                {panel === "browse" && (
                    <CardBrowser
                        plugin={plugin}
                        onBack={() => { refreshStats(); navigateTo("dashboard"); }}
                        onReviewAll={(cards) => { setReviewCards(cards); navigateTo("review-all"); }}
                    />
                )}

                {panel === "git-log" && (
                    <GitLog
                        vaultPath={plugin.getVaultPath()}
                        store={plugin.store}
                        reviewLog={plugin.reviewLog}
                        onBack={() => navigateTo("dashboard")}
                    />
                )}

                {panel === "create" && (
                    <CreateCard
                        store={plugin.store}
                        app={plugin.app}
                        onBack={() => { refreshStats(); navigateTo("dashboard"); }}
                        onCreated={() => {
                            refreshStats();
                            navigateTo("dashboard");
                            new Notice(`Card created — ${stats.total + 1} cards in your collection`);
                        }}
                    />
                )}

                {panel === "staging" && generationResult && (
                    <StagingPanel
                        app={plugin.app}
                        generationResult={generationResult}
                        onConfirm={handleStagingConfirm}
                        onCancel={handleStagingCancel}
                    />
                )}

                {panel === "import-queue" && (() => {
                    const queue = plugin.store.getImportQueue();
                    const tagsByPath: Record<string, string[]> = {};
                    for (const path of queue) {
                        const cache = plugin.app.metadataCache.getCache(path);
                        const raw = cache?.frontmatter?.tags;
                        tagsByPath[path] = Array.isArray(raw) ? raw : raw ? [String(raw)] : [];
                    }
                    return (
                        <ImportQueue
                            queue={queue}
                            tagsByPath={tagsByPath}
                            onImport={handleImportSelected}
                            onBack={() => navigateTo("dashboard")}
                        />
                    );
                })()}
            </div>
        </div>
    );
}

function InitPanel({ onInit }: { onInit: () => Promise<void> }) {
    const [loading, setLoading] = useState(false);

    const handleClick = async () => {
        setLoading(true);
        await onInit();
        setLoading(false);
    };

    return (
        <div className="echovault-init">
            <div className="echovault-init-pitch">
                <div className="echovault-init-feature">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>
                    <div>
                        <strong>Learn as you write</strong>
                        <span>Flashcards are generated automatically from your notes — no manual effort needed.</span>
                    </div>
                </div>
                <div className="echovault-init-feature">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                    <div>
                        <strong>Never forget what matters</strong>
                        <span>Spaced repetition surfaces cards right when you're about to forget them.</span>
                    </div>
                </div>
                <div className="echovault-init-feature">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" /></svg>
                    <div>
                        <strong>Your vault, your knowledge</strong>
                        <span>Everything stays local — your cards live right alongside your notes.</span>
                    </div>
                </div>
            </div>

            <div className="echovault-init-cta">
                <p>To get started, initialize a git repository to track your changes.</p>
                <button
                    className="echovault-btn echovault-btn-primary"
                    onClick={handleClick}
                    disabled={loading}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                    {loading ? "Initializing..." : "Get Started"}
                </button>
            </div>
        </div>
    );
}
