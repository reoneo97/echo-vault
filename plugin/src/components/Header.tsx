import { App } from "obsidian";
import { AboutModal } from "./AboutModal";

const LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a7 7 0 0 0-7 7c0 2.38 1.19 4.47 3 5.74V17a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-2.26c1.81-1.27 3-3.36 3-5.74a7 7 0 0 0-7-7z"/><path d="M9 21h6"/><path d="M10 17v-2.5"/><path d="M14 17v-2.5"/></svg>`;

const INFO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`;

const TUTORIAL_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>`;

interface HeaderProps {
    gitInitialized: boolean;
    app: App;
    showInfo?: boolean;
    showTutorialLink?: boolean;
    onTutorial?: () => void;
}

export function Header({ gitInitialized, app, showInfo = false, showTutorialLink = false, onTutorial }: HeaderProps) {
    const handleInfoClick = () => {
        new AboutModal(app).open();
    };

    return (
        <div className="echovault-header">
            <div className="echovault-header-actions">
                {showTutorialLink && onTutorial && (
                    <button
                        className="echovault-info-btn"
                        onClick={onTutorial}
                        aria-label="View tutorial"
                        dangerouslySetInnerHTML={{ __html: TUTORIAL_SVG }}
                    />
                )}
                {showInfo && (
                    <button
                        className="echovault-info-btn"
                        onClick={handleInfoClick}
                        aria-label="About EchoVault"
                        dangerouslySetInnerHTML={{ __html: INFO_SVG }}
                    />
                )}
            </div>
            <div
                className="echovault-logo"
                dangerouslySetInnerHTML={{ __html: LOGO_SVG }}
            />
            <h3 className="echovault-sidebar-title">EchoVault</h3>
            <div
                className={`echovault-git-status ${
                    gitInitialized
                        ? "echovault-git-active"
                        : "echovault-git-inactive"
                }`}
            >
                <span>
                    {gitInitialized ? "Git initialized" : "No git repo"}
                </span>
            </div>
        </div>
    );
}
