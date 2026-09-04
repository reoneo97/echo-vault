export interface SM2Result {
    repetitions: number;
    easinessFactor: number;
    interval: number;
    nextReviewDate: string;
}

/**
 * SM-2 spaced repetition algorithm.
 * @param quality Rating 0-5 (0=Again, 2=Hard, 4=Good, 5=Easy)
 * @param repetitions Current repetition count
 * @param easinessFactor Current easiness factor (≥1.3)
 * @param interval Current interval in days
 */
export function sm2(
    quality: number,
    repetitions: number,
    easinessFactor: number,
    interval: number
): SM2Result {
    let newRepetitions: number;
    let newInterval: number;
    let newEF: number;

    if (quality < 3) {
        // Failed — reset
        newRepetitions = 0;
        newInterval = 0;
    } else {
        // Passed
        newRepetitions = repetitions + 1;
        if (repetitions === 0) {
            newInterval = 1;
        } else if (repetitions === 1) {
            newInterval = 6;
        } else {
            newInterval = Math.round(interval * easinessFactor);
        }
    }

    newEF =
        easinessFactor +
        (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
    if (newEF < 1.3) newEF = 1.3;

    const today = new Date();
    const next = new Date(today);
    next.setDate(today.getDate() + (newInterval || 0));
    const nextReviewDate = next.toISOString().split("T")[0];

    return {
        repetitions: newRepetitions,
        easinessFactor: Math.round(newEF * 100) / 100,
        interval: newInterval,
        nextReviewDate,
    };
}
