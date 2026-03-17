import { useState } from "react";

interface DashboardProps {
    stats: { total: number; due: number };
    onCommitAndGenerate: () => Promise<void>;
    onStartReview: () => void;
    onAddTestCard: () => Promise<void>;
    onBrowse: () => void;
}

export function Dashboard({
    stats,
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

function StatCard({ label, value }: { label: string; value: number }) {
    return (
        <div className="echovault-stat">
            <div className="echovault-stat-value">{value}</div>
            <div className="echovault-stat-label">{label}</div>
        </div>
    );
}
