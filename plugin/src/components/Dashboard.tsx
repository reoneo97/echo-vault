import { useState } from "react";
import { ReviewLog } from "../review-log";

interface DashboardProps {
    stats: { total: number; due: number };
    streak: number;
    reviewLog: ReviewLog;
    onCommitAndGenerate: () => Promise<void>;
    onStartReview: () => void;
    onAddTestCard: () => Promise<void>;
    onBrowse: () => void;
    onCreate: () => void;
    onGitLog: () => void;
}

export function Dashboard({
    stats,
    streak,
    reviewLog,
    onCommitAndGenerate,
    onStartReview,
    onAddTestCard,
    onBrowse,
    onCreate,
    onGitLog,
}: DashboardProps) {
    const [generating, setGenerating] = useState(false);

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

            <div className="echovault-actions">
                <button
                    className="echovault-btn echovault-btn-primary"
                    onClick={handleCommit}
                    disabled={generating}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 16 12 12 8 16" /><line x1="12" y1="12" x2="12" y2="21" /><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" /></svg>
                    {generating ? "Working..." : "Commit & Generate"}
                </button>

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
                    Git Log
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

