import { useState } from "react";

interface ImportQueueProps {
    queue: string[];
    onImport: (selected: string[], onProgress: (completed: number, total: number) => void) => Promise<void>;
    onBack: () => void;
}

const MAX_SELECTION = 10;

export function ImportQueue({ queue, onImport, onBack }: ImportQueueProps) {
    const [selected, setSelected] = useState<Set<string>>(
        new Set(queue.slice(0, MAX_SELECTION))
    );
    const [importing, setImporting] = useState(false);
    const [progress, setProgress] = useState<{ completed: number; total: number } | null>(null);

    const toggle = (path: string) => {
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(path)) {
                next.delete(path);
            } else if (next.size < MAX_SELECTION) {
                next.add(path);
            }
            return next;
        });
    };

    const handleImport = async () => {
        if (selected.size === 0) return;
        setImporting(true);
        setProgress({ completed: 0, total: selected.size });
        await onImport([...selected], (completed, total) => {
            setProgress({ completed, total });
        });
        setProgress(null);
        setImporting(false);
    };

    const fileName = (path: string) => path.split("/").pop() ?? path;
    const folderName = (path: string) => path.includes("/") ? path.substring(0, path.lastIndexOf("/")) : null;

    return (
        <div className="echovault-import-queue">
            <div className="echovault-import-queue-header">
                <span className="echovault-import-queue-remaining">
                    {queue.length} note{queue.length !== 1 ? "s" : ""} remaining
                </span>
                <span className="echovault-import-queue-count">
                    {selected.size} / {MAX_SELECTION} selected
                </span>
            </div>

            <ul className="echovault-import-queue-list">
                {queue.map((path) => {
                    const disabled = !selected.has(path) && selected.size >= MAX_SELECTION;
                    return (
                        <li
                            key={path}
                            className={`echovault-import-queue-item${disabled ? " echovault-import-queue-item-disabled" : ""}`}
                            onClick={() => !importing && toggle(path)}
                        >
                            <input
                                type="checkbox"
                                checked={selected.has(path)}
                                disabled={disabled || importing}
                                onChange={() => toggle(path)}
                                onClick={(e) => e.stopPropagation()}
                            />
                            <div className="echovault-import-queue-meta">
                                <span className="echovault-import-queue-name">{fileName(path)}</span>
                                {folderName(path) && (
                                    <span className="echovault-import-queue-folder">{folderName(path)}</span>
                                )}
                            </div>
                        </li>
                    );
                })}
            </ul>

            {progress && (
                <div className="echovault-import-progress">
                    <div className="echovault-import-progress-bar">
                        <div
                            className="echovault-import-progress-fill"
                            style={{ width: `${(progress.completed / progress.total) * 100}%` }}
                        />
                    </div>
                    <span className="echovault-import-progress-label">
                        {progress.completed} / {progress.total} notes
                    </span>
                </div>
            )}

            <div className="echovault-import-queue-actions">
                <button
                    className="echovault-btn echovault-btn-primary"
                    onClick={handleImport}
                    disabled={selected.size === 0 || importing}
                >
                    {importing ? "Importing..." : `Import ${selected.size} note${selected.size !== 1 ? "s" : ""}`}
                </button>
                <button className="echovault-btn" onClick={onBack} disabled={importing}>
                    Back
                </button>
            </div>
        </div>
    );
}
