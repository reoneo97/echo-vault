interface EmptyStateProps {
    icon: React.ReactNode;
    title: string;
    description: string;
    action?: {
        label: string;
        onClick: () => void;
    };
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
    return (
        <div className="echovault-empty">
            <div className="echovault-empty-icon">{icon}</div>
            <h3 className="echovault-empty-title">{title}</h3>
            <p className="echovault-empty-desc">{description}</p>
            {action && (
                <button
                    className="echovault-btn echovault-btn-primary echovault-empty-action"
                    onClick={action.onClick}
                >
                    {action.label}
                </button>
            )}
        </div>
    );
}
