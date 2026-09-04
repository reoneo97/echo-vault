import { useMemo } from "react";
import { ReviewLog } from "../core/review-log";

interface ReviewHeatmapProps {
    reviewLog: ReviewLog;
}

const DAY_LABELS = ["Mon", "", "Wed", "", "Fri", "", ""];
const WEEKS = 13;

function getIntensity(count: number): number {
    if (count === 0) return 0;
    if (count <= 2) return 1;
    if (count <= 5) return 2;
    if (count <= 9) return 3;
    return 4;
}

export function ReviewHeatmap({ reviewLog }: ReviewHeatmapProps) {
    const { grid, totalReviewed } = useMemo(() => {
        const sessions = reviewLog.getRecentSessions(WEEKS * 7);
        const sessionMap = new Map(sessions.map((s) => [s.date, s.cardsReviewed]));

        const today = new Date();
        const todayDow = (today.getDay() + 6) % 7; // 0=Mon, 6=Sun

        // Start from Monday of (WEEKS-1) weeks ago
        const startDate = new Date(today);
        startDate.setDate(startDate.getDate() - todayDow - (WEEKS - 1) * 7);

        const cells: { date: string; count: number }[] = [];
        let total = 0;
        const current = new Date(startDate);

        while (current <= today) {
            const dateStr = current.toISOString().split("T")[0];
            const count = sessionMap.get(dateStr) ?? 0;
            total += count;
            cells.push({ date: dateStr, count });
            current.setDate(current.getDate() + 1);
        }

        // Split into weeks of 7 (last week may be partial)
        const weeks: typeof cells[] = [];
        for (let i = 0; i < cells.length; i += 7) {
            weeks.push(cells.slice(i, i + 7));
        }

        return { grid: weeks, totalReviewed: total };
    }, [reviewLog]);

    if (totalReviewed === 0 && grid.every((w) => w.every((c) => c.count === 0))) {
        return null;
    }

    return (
        <div className="echovault-heatmap">
            <div className="echovault-heatmap-label">Review Activity</div>
            <div className="echovault-heatmap-grid">
                <div className="echovault-heatmap-days">
                    {DAY_LABELS.map((label, i) => (
                        <div key={i} className="echovault-heatmap-day-label">
                            {label}
                        </div>
                    ))}
                </div>
                <div className="echovault-heatmap-weeks">
                    {grid.map((week, wi) => (
                        <div key={wi} className="echovault-heatmap-week">
                            {week.map((cell, di) => (
                                <div
                                    key={di}
                                    className={`echovault-heatmap-cell echovault-heatmap-level-${getIntensity(cell.count)}`}
                                    title={`${cell.date}: ${cell.count} cards reviewed`}
                                />
                            ))}
                        </div>
                    ))}
                </div>
            </div>
            <div className="echovault-heatmap-legend">
                <span className="echovault-heatmap-legend-label">Less</span>
                {[0, 1, 2, 3, 4].map((level) => (
                    <div key={level} className={`echovault-heatmap-cell echovault-heatmap-level-${level}`} />
                ))}
                <span className="echovault-heatmap-legend-label">More</span>
            </div>
        </div>
    );
}
