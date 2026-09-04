import { useState, useMemo } from "react";

interface ImportQueueProps {
    queue: string[];
    tagsByPath: Record<string, string[]>;
    onImport: (selected: string[], onProgress: (completed: number, total: number) => void) => Promise<void>;
    onBack: () => void;
}

const MAX_SELECTION = 10;

export function ImportQueue({ queue, tagsByPath, onImport, onBack }: ImportQueueProps) {
    const [selected, setSelected] = useState<Set<string>>(
        new Set(queue.slice(0, MAX_SELECTION))
    );
    const [search, setSearch] = useState("");
    const [importing, setImporting] = useState(false);
    const [progress, setProgress] = useState<{ completed: number; total: number } | null>(null);

    const filtered = useMemo(() => {
        if (!search.trim()) return queue;
        const q = search.toLowerCase().replace(/^#/, "");
        return queue.filter((path) => {
            const name = fileName(path).toLowerCase();
            const tags = tagsByPath[path] ?? [];
            return name.includes(q) || tags.some((t) => t.toLowerCase().includes(q));
        });
    }, [queue, search, tagsByPath]);

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

    const selectAll = () => {
        setSelected(new Set(filtered.slice(0, MAX_SELECTION)));
    };

    const unselectAll = () => {
        setSelected(new Set());
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

            <input
                type="text"
                className="echovault-import-queue-search"
                placeholder="Search by name or #tag..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                disabled={importing}
            />

            <div className="echovault-import-queue-bulk">
                <button
                    className="echovault-btn echovault-import-queue-bulk-btn"
                    onClick={selectAll}
                    disabled={importing || filtered.length === 0}
                >
                    Select first {Math.min(filtered.length, MAX_SELECTION)}
                </button>
                <button
                    className="echovault-btn echovault-import-queue-bulk-btn"
                    onClick={unselectAll}
                    disabled={importing || selected.size === 0}
                >
                    Unselect All
                </button>
            </div>

            <ul className="echovault-import-queue-list">
                {filtered.map((path) => {
                    const disabled = !selected.has(path) && selected.size >= MAX_SELECTION;
                    const tags = tagsByPath[path] ?? [];
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
                                <div className="echovault-import-queue-bottom">
                                    {folderName(path) && (
                                        <span className="echovault-import-queue-folder">{folderName(path)}</span>
                                    )}
                                    {tags.length > 0 && (
                                        <div className="echovault-import-queue-tags">
                                            {tags.map((tag) => (
                                                <span
                                                    key={tag}
                                                    className="echovault-import-queue-tag"
                                                    onClick={(e) => { e.stopPropagation(); setSearch(tag); }}
                                                >
                                                    #{tag}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </li>
                    );
                })}
                {filtered.length === 0 && (
                    <li className="echovault-import-queue-empty">No notes match your search.</li>
                )}
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
