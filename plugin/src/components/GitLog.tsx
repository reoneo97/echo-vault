import { useState, useEffect } from "react";
import { gitLog, LogEntry } from "../git";
import type { FlashcardStore } from "../store";

interface GitLogProps {
    vaultPath: string;
    store: FlashcardStore;
    onBack: () => void;
}

export function GitLog({ vaultPath, store, onBack }: GitLogProps) {
    const [entries, setEntries] = useState<LogEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [expandedHash, setExpandedHash] = useState<string | null>(null);

    useEffect(() => {
        async function load() {
            try {
                const log = await gitLog(vaultPath);
                setEntries(log);
            } catch (e: unknown) {
                setError(e instanceof Error ? e.message : String(e));
            }
            setLoading(false);
        }
        load();
    }, [vaultPath]);

    const formatDate = (iso: string) => {
        const d = new Date(iso);
        return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
    };

    const toggleExpand = (hash: string) => {
        setExpandedHash((prev) => (prev === hash ? null : hash));
    };

    return (
        <>
            <div className="echovault-review-header">
                <button className="echovault-btn echovault-btn-back" onClick={onBack}>
                    Back
                </button>
                <span className="echovault-progress">Git Log</span>
            </div>

            {loading && <p className="echovault-gitlog-status">Loading commits...</p>}
            {error && <p className="echovault-gitlog-status echovault-gitlog-error">{error}</p>}

            {!loading && !error && entries.length === 0 && (
                <p className="echovault-gitlog-status">No commits yet</p>
            )}

            {!loading && !error && entries.length > 0 && (
                <div className="echovault-gitlog-list">
                    {entries.map((entry) => {
                        const hasCards = store.hasCommit(entry.hash);
                        const isExpanded = expandedHash === entry.hash;
                        return (
                            <div
                                key={entry.hash}
                                className={`echovault-gitlog-entry ${isExpanded ? "echovault-gitlog-entry-expanded" : ""}`}
                                onClick={() => toggleExpand(entry.hash)}
                            >
                                <div className="echovault-gitlog-top">
                                    <span className="echovault-gitlog-hash">{entry.shortHash}</span>
                                    <span className="echovault-gitlog-date">{formatDate(entry.date)}</span>
                                </div>
                                <div className="echovault-gitlog-message">{entry.message}</div>
                                <div className="echovault-gitlog-meta">
                                    {entry.files.length > 0 && (
                                        <span className="echovault-gitlog-files">
                                            {entry.files.length} file{entry.files.length !== 1 ? "s" : ""} changed
                                        </span>
                                    )}
                                    {hasCards && (
                                        <span className="echovault-gitlog-cards-badge">cards generated</span>
                                    )}
                                </div>
                                {isExpanded && entry.files.length > 0 && (
                                    <div className="echovault-gitlog-filelist">
                                        {entry.files.map((file) => (
                                            <div key={file} className="echovault-gitlog-file">{file}</div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </>
    );
}
