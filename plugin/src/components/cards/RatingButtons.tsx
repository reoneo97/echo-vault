const RATINGS = [
    { label: "Again", quality: 0 },
    { label: "Hard", quality: 2 },
    { label: "Good", quality: 4 },
    { label: "Easy", quality: 5 },
];

interface RatingButtonsProps {
    onRate: (quality: number) => void;
}

export function RatingButtons({ onRate }: RatingButtonsProps) {
    return (
        <div className="echovault-ratings">
            {RATINGS.map(({ label, quality }) => (
                <button
                    key={label}
                    className={`echovault-btn echovault-btn-${label.toLowerCase()}`}
                    onClick={() => onRate(quality)}
                >
                    {label}
                </button>
            ))}
        </div>
    );
}
