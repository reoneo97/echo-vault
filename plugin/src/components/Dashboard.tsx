import { useState } from "react";
import { ReviewLog } from "../core/review-log";
import { StatusEntry } from "../core/git";
import { GenerateStage } from "../core/generate";

interface DashboardProps {
    stats: { total: number; due: number };
    streak: number;
    forecast: { tomorrow: number; thisWeek: number };
    reviewLog: ReviewLog;
    backendOnline: boolean;
    changedFiles: StatusEntry[];
    generateStage: GenerateStage | null;
    onCheckBackend: () => Promise<boolean>;
    onCommitAndGenerate: () => Promise<void>;
    onStartReview: () => void;
    onAddTestCard: () => Promise<void>;
    onBrowse: () => void;
    onCreate: () => void;
    onGitLog: () => void;
    onDeleteAllCards: () => Promise<void>;
    onDeleteRepo: () => Promise<void>;
}

export function Dashboard({
    stats,
    streak,
    forecast,
    reviewLog,
    backendOnline,
    changedFiles,
    generateStage,
    onCheckBackend,
    onCommitAndGenerate,
    onStartReview,
    onAddTestCard,
    onBrowse,
    onCreate,
    onGitLog,
    onDeleteAllCards,
    onDeleteRepo,
}: DashboardProps) {
    const [generating, setGenerating] = useState(false);
    const [checking, setChecking] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [confirmDeleteCards, setConfirmDeleteCards] = useState(false);
    const [filesExpanded, setFilesExpanded] = useState(false);

    const MAX_VISIBLE_FILES = 10;
    const mdFiles = changedFiles.filter((e) => e.file.endsWith(".md"));

    const STAGES: GenerateStage[] = ["committing", "analyzing", "generating"];
    const STAGE_LABELS: Record<GenerateStage, string> = {
        committing: "Committing changes...",
        analyzing: "Analyzing diff...",
        generating: "Generating flashcards...",
    };
    const stageIndex = generateStage ? STAGES.indexOf(generateStage) : -1;

    const handleRetryConnection = async () => {
        setChecking(true);
        await onCheckBackend();
        setChecking(false);
    };

    const handleCommit = async () => {
        setGenerating(true);
        await onCommitAndGenerate();
        setGenerating(false);
    };

    return (
        <>
            <div className="echovault-stats">
                <StatCard label="Total cards" value={stats.total} />
                <StatCard label="Due now" value={stats.due} />
                <StatCard label="Streak" value={streak} icon={streak > 3 ? "\uD83D\uDD25" : undefined} />
            </div>

            {(forecast.tomorrow > 0 || forecast.thisWeek > 0) && (
                <div className="echovault-forecast">
                    {forecast.tomorrow > 0 && (
                        <span className="echovault-forecast-item">
                            <strong>{forecast.tomorrow}</strong> due tomorrow
                        </span>
                    )}
                    {forecast.thisWeek > 0 && (
                        <span className="echovault-forecast-item">
                            <strong>{forecast.thisWeek}</strong> due this week
                        </span>
                    )}
                </div>
            )}

            <div className="echovault-actions">
                {mdFiles.length > 0 && (
                    <div className="echovault-changed-files">
                        <button
                            className="echovault-changed-files-toggle"
                            onClick={() => setFilesExpanded(!filesExpanded)}
                        >
                            <span>{mdFiles.length} note{mdFiles.length !== 1 ? "s" : ""} changed</span>
                            <span className={`echovault-chevron ${filesExpanded ? "echovault-chevron-open" : ""}`}>&#9656;</span>
                        </button>
                        {filesExpanded && (
                            <ul className="echovault-changed-files-list">
                                {mdFiles.slice(0, MAX_VISIBLE_FILES).map((entry) => (
                                    <li key={entry.file}>
                                        <span className={`echovault-file-status echovault-file-status-${entry.status === "??" ? "new" : entry.status.toLowerCase()}`}>
                                            {entry.status === "??" ? "N" : entry.status}
                                        </span>
                                        <span className={`echovault-file-name ${entry.status === "D" ? "echovault-file-deleted" : ""}`}>{entry.file}</span>
                                    </li>
                                ))}
                                {mdFiles.length > MAX_VISIBLE_FILES && (
                                    <li className="echovault-file-more">
                                        +{mdFiles.length - MAX_VISIBLE_FILES} more files
                                    </li>
                                )}
                            </ul>
                        )}
                    </div>
                )}
                <button
                    className={`echovault-btn ${backendOnline ? "echovault-btn-primary" : "echovault-btn-offline"}`}
                    onClick={backendOnline ? handleCommit : handleRetryConnection}
                    disabled={generating || checking}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 16 12 12 8 16" /><line x1="12" y1="12" x2="12" y2="21" /><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" /></svg>
                    {generating && generateStage ? STAGE_LABELS[generateStage] : checking ? "Checking..." : !backendOnline ? "Backend Offline — Tap to Retry" : "Commit & Generate"}
                </button>
                {generating && generateStage && (
                    <div className="echovault-progress">
                        <div className="echovault-progress-bar">
                            <div
                                className="echovault-progress-fill"
                                style={{ width: `${((stageIndex + 1) / STAGES.length) * 100}%` }}
                            />
                        </div>
                        <span className="echovault-progress-step">
                            Step {stageIndex + 1} of {STAGES.length}
                        </span>
                    </div>
                )}

                <button
                    className="echovault-btn echovault-btn-show"
                    onClick={onStartReview}
                    disabled={stats.due === 0}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" /></svg>
                    {`Review (${stats.due} due)`}
                </button>

                <button
                    className="echovault-btn echovault-btn-show"
                    onClick={onBrowse}
                    disabled={stats.total === 0}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /></svg>
                    Browse All Cards
                </button>

                <button
                    className="echovault-btn echovault-btn-show"
                    onClick={onCreate}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                    Create Card
                </button>

                <button
                    className="echovault-btn echovault-btn-show"
                    onClick={onGitLog}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4" /><line x1="1.05" y1="12" x2="7" y2="12" /><line x1="17.01" y1="12" x2="22.96" y2="12" /></svg>
                    History
                </button>
            </div>

            <div className="echovault-dev-section">
                <div className="echovault-dev-divider">
                    <span>Dev Tools</span>
                </div>
                <button
                    className="echovault-btn echovault-btn-test"
                    onClick={onAddTestCard}
                >
                    Add Test Flashcard
                </button>
                {!confirmDeleteCards ? (
                    <button
                        className="echovault-btn echovault-btn-test"
                        onClick={() => setConfirmDeleteCards(true)}
                    >
                        Delete All Flashcards
                    </button>
                ) : (
                    <div className="echovault-confirm-delete">
                        <p className="echovault-confirm-warning">
                            This will permanently delete all flashcards and review progress.
                        </p>
                        <div className="echovault-confirm-actions">
                            <button
                                className="echovault-btn echovault-btn-danger"
                                onClick={() => { setConfirmDeleteCards(false); onDeleteAllCards(); }}
                            >
                                Yes, Delete All Cards
                            </button>
                            <button
                                className="echovault-btn echovault-btn-show"
                                onClick={() => setConfirmDeleteCards(false)}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                )}
                {!confirmDelete ? (
                    <button
                        className="echovault-btn echovault-btn-test"
                        onClick={() => setConfirmDelete(true)}
                    >
                        Delete EchoVault (.git)
                    </button>
                ) : (
                    <div className="echovault-confirm-delete">
                        <p className="echovault-confirm-warning">
                            This will remove the git repository and all commit history. This cannot be undone.
                        </p>
                        <div className="echovault-confirm-actions">
                            <button
                                className="echovault-btn echovault-btn-danger"
                                onClick={() => { setConfirmDelete(false); onDeleteRepo(); }}
                            >
                                Yes, Delete
                            </button>
                            <button
                                className="echovault-btn echovault-btn-show"
                                onClick={() => setConfirmDelete(false)}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </>
    );
}

function StatCard({ label, value, icon }: { label: string; value: number; icon?: string }) {
    return (
        <div className="echovault-stat">
            <div className="echovault-stat-value">
                {icon && value > 0 ? `${icon} ${value}` : value}
            </div>
            <div className="echovault-stat-label">{label}</div>
        </div>
    );
}

