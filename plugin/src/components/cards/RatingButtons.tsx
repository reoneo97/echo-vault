const RATINGS = [
    { label: "Again", quality: 0, key: "1" },
    { label: "Hard", quality: 2, key: "2" },
    { label: "Good", quality: 4, key: "3" },
    { label: "Easy", quality: 5, key: "4" },
];

interface RatingButtonsProps {
    onRate: (quality: number) => void;
}

export function RatingButtons({ onRate }: RatingButtonsProps) {
    return (
        <div className="echovault-ratings">
            {RATINGS.map(({ label, quality, key }) => (
                <button
                    key={label}
                    className={`echovault-btn echovault-btn-${label.toLowerCase()}`}
                    onClick={() => onRate(quality)}
                >
                    {label}
                    <span className="echovault-shortcut-hint">{key}</span>
                </button>
            ))}
        </div>
    );
}
