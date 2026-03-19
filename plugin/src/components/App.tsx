import { useState, useEffect, useCallback } from "react";
import { Notice } from "obsidian";
import type EchoVaultPlugin from "../main";
import { Flashcard, CardType } from "../types";
import { isOwnGitRepo, gitInit } from "../git";
import { generateId, getTodayDateString, nowISO } from "../utils";
import { Header } from "./Header";
import { Dashboard } from "./Dashboard";
import { ReviewSession } from "./ReviewSession";
import { CardBrowser } from "./CardBrowser";
import { CreateCard } from "./CreateCard";

type Panel = "init" | "dashboard" | "review" | "review-all" | "browse" | "create";

export function EchoVaultApp({ plugin }: { plugin: EchoVaultPlugin }) {
    const [panel, setPanel] = useState<Panel>("dashboard");
    const [gitInitialized, setGitInitialized] = useState(false);
    const [stats, setStats] = useState({ total: 0, due: 0 });
    const [streak, setStreak] = useState(0);

    const refreshStats = useCallback(() => {
        setStats(plugin.store.getStats());
        setStreak(plugin.reviewLog.getStreak());
    }, [plugin]);

    useEffect(() => {
        async function checkGit() {
            const vaultPath = plugin.getVaultPath();
            const hasRepo = await isOwnGitRepo(vaultPath);
            setGitInitialized(hasRepo);
            if (hasRepo) {
                setPanel("dashboard");
            } else {
                setPanel("init");
            }
        }
        checkGit();
        refreshStats();
    }, [plugin, refreshStats]);

    const handleGitInit = async () => {
        try {
            const vaultPath = plugin.getVaultPath();
            await gitInit(vaultPath);
            setGitInitialized(true);
            setPanel("dashboard");
            new Notice("Git repository initialized!");
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            new Notice(`Failed to initialize: ${msg}`);
        }
    };

    const handleCommitAndGenerate = async () => {
        await plugin.commitAndGenerate();
        refreshStats();
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
        new Notice(`Test ${label} flashcard added!`);
    };

    const handleStartReview = () => {
        setPanel("review");
    };

    const handleReviewComplete = () => {
        refreshStats();
        setPanel("dashboard");
    };

    return (
        <div className="echovault-sidebar">
            <Header gitInitialized={gitInitialized} app={plugin.app} showInfo={panel === "dashboard" || panel === "init"} />

            {panel === "init" && (
                <InitPanel onInit={handleGitInit} />
            )}

            {panel === "dashboard" && (
                <Dashboard
                    stats={stats}
                    streak={streak}
                    reviewLog={plugin.reviewLog}
                    onCommitAndGenerate={handleCommitAndGenerate}
                    onStartReview={handleStartReview}
                    onAddTestCard={handleAddTestCard}
                    onBrowse={() => setPanel("browse")}
                    onCreate={() => setPanel("create")}
                />
            )}

            {panel === "review" && (
                <ReviewSession
                    plugin={plugin}
                    onComplete={handleReviewComplete}
                    onBack={() => { refreshStats(); setPanel("dashboard"); }}
                />
            )}

            {panel === "review-all" && (
                <ReviewSession
                    plugin={plugin}
                    reviewAll
                    onComplete={handleReviewComplete}
                    onBack={() => { refreshStats(); setPanel("browse"); }}
                />
            )}

            {panel === "browse" && (
                <CardBrowser
                    plugin={plugin}
                    onBack={() => { refreshStats(); setPanel("dashboard"); }}
                    onReviewAll={() => setPanel("review-all")}
                />
            )}

            {panel === "create" && (
                <CreateCard
                    store={plugin.store}
                    onBack={() => { refreshStats(); setPanel("dashboard"); }}
                    onCreated={() => { refreshStats(); setPanel("dashboard"); }}
                />
            )}
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
            <p>
                Your vault doesn't have a git repository yet. Initialize one to
                start tracking changes and generating flashcards.
            </p>
            <button
                className="echovault-btn echovault-btn-primary"
                onClick={handleClick}
                disabled={loading}
            >
                {loading ? "Initializing..." : "Initialize EchoVault"}
            </button>
        </div>
    );
}
