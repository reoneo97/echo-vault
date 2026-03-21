import { useMemo } from "react";
import { ReviewLog } from "../review-log";

interface ReviewHeatmapProps {
    reviewLog: ReviewLog;
}

const DAY_LABELS = ["Mon", "", "Wed", "", "Fri", "", ""];
const WEEKS = 12;
const TOTAL_DAYS = WEEKS * 7;

function getIntensity(count: number): number {
    if (count === 0) return 0;
    if (count <= 2) return 1;
    if (count <= 5) return 2;
    if (count <= 9) return 3;
    return 4;
}

export function ReviewHeatmap({ reviewLog }: ReviewHeatmapProps) {
    const { grid, totalReviewed } = useMemo(() => {
        const sessions = reviewLog.getRecentSessions(TOTAL_DAYS);
        const sessionMap = new Map(sessions.map((s) => [s.date, s.cardsReviewed]));

        // Find the end date (today) and align to fill complete weeks
        const today = new Date();
        const dayOfWeek = (today.getDay() + 6) % 7; // 0=Mon, 6=Sun
        const endDate = new Date(today);

        // Build grid: each entry is { date, count }
        const cells: { date: string; count: number }[] = [];
        const startOffset = (WEEKS - 1) * 7 + dayOfWeek;

        let total = 0;
        for (let i = startOffset; i >= 0; i--) {
            const d = new Date(endDate);
            d.setDate(d.getDate() - i);
            const dateStr = d.toISOString().split("T")[0];
            const count = sessionMap.get(dateStr) ?? 0;
            total += count;
            cells.push({ date: dateStr, count });
        }

        // Arrange into columns (weeks) x rows (days)
        // Each column is a week, each row is a day (Mon=0 to Sun=6)
        const weeks: { date: string; count: number }[][] = [];
        let weekIdx = 0;
        for (let i = 0; i < cells.length; i++) {
            if (i > 0 && i % 7 === 0) weekIdx++;
            if (!weeks[weekIdx]) weeks[weekIdx] = [];
            weeks[weekIdx].push(cells[i]);
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
