export interface SessionStats {
    total: number;
    correct: number;
    ratings: number[];
}

interface ReviewSummaryProps {
    stats: SessionStats;
    onDone: () => void;
}

export function ReviewSummary({ stats, onDone }: ReviewSummaryProps) {
    const accuracy = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0;
    const avgRating = stats.ratings.length > 0
        ? (stats.ratings.reduce((a, b) => a + b, 0) / stats.ratings.length).toFixed(1)
        : "0";

    const ratingCounts = { again: 0, hard: 0, good: 0, easy: 0 };
    for (const r of stats.ratings) {
        if (r === 0) ratingCounts.again++;
        else if (r === 2) ratingCounts.hard++;
        else if (r === 4) ratingCounts.good++;
        else if (r === 5) ratingCounts.easy++;
    }

    const getMessage = () => {
        if (accuracy === 100) return "Perfect session!";
        if (accuracy >= 80) return "Great work!";
        if (accuracy >= 60) return "Solid effort!";
        return "Keep at it!";
    };

    const getEmoji = () => {
        if (accuracy === 100) return "\uD83C\uDF1F";
        if (accuracy >= 80) return "\uD83D\uDD25";
        if (accuracy >= 60) return "\uD83D\uDCAA";
        return "\uD83C\uDF31";
    };

    return (
        <div className="echovault-summary">
            <div className="echovault-summary-emoji">{getEmoji()}</div>
            <h2 className="echovault-summary-title">{getMessage()}</h2>
            <p className="echovault-summary-subtitle">
                You reviewed {stats.total} card{stats.total !== 1 ? "s" : ""}
            </p>

            <div className="echovault-summary-stats">
                <div className="echovault-summary-stat">
                    <div className="echovault-summary-stat-value">{accuracy}%</div>
                    <div className="echovault-summary-stat-label">Accuracy</div>
                </div>
                <div className="echovault-summary-stat">
                    <div className="echovault-summary-stat-value">{avgRating}</div>
                    <div className="echovault-summary-stat-label">Avg Rating</div>
                </div>
                <div className="echovault-summary-stat">
                    <div className="echovault-summary-stat-value">{stats.total}</div>
                    <div className="echovault-summary-stat-label">Reviewed</div>
                </div>
            </div>

            <div className="echovault-summary-breakdown">
                <div className="echovault-summary-breakdown-title">Rating Breakdown</div>
                <div className="echovault-summary-bars">
                    {([
                        { label: "Again", count: ratingCounts.again, cls: "again" },
                        { label: "Hard", count: ratingCounts.hard, cls: "hard" },
                        { label: "Good", count: ratingCounts.good, cls: "good" },
                        { label: "Easy", count: ratingCounts.easy, cls: "easy" },
                    ] as const).map(({ label, count, cls }) => (
                        <div key={label} className="echovault-summary-bar-row">
                            <span className="echovault-summary-bar-label">{label}</span>
                            <div className="echovault-summary-bar-track">
                                <div
                                    className={`echovault-summary-bar-fill echovault-summary-bar-${cls}`}
                                    style={{ width: stats.total > 0 ? `${(count / stats.total) * 100}%` : "0%" }}
                                />
                            </div>
                            <span className="echovault-summary-bar-count">{count}</span>
                        </div>
                    ))}
                </div>
            </div>

            <button
                className="echovault-btn echovault-btn-primary"
                onClick={onDone}
            >
                Back to Dashboard
            </button>
        </div>
    );
}
