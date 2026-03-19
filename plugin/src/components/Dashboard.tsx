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
}

export function Dashboard({
    stats,
    streak,
    reviewLog,
    onCommitAndGenerate,
    onStartReview,
    onAddTestCard,
    onBrowse,
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
                    {generating ? "Working..." : "Commit & Generate"}
                </button>

                <button
                    className="echovault-btn echovault-btn-show"
                    onClick={onStartReview}
                    disabled={stats.due === 0}
                >
                    {`Review (${stats.due} due)`}
                </button>

                <button
                    className="echovault-btn echovault-btn-show"
                    onClick={onBrowse}
                    disabled={stats.total === 0}
                >
                    Browse All Cards
                </button>

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

