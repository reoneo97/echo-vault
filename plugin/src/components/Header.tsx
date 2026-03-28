import { App } from "obsidian";
import { AboutModal } from "./AboutModal";

const LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a7 7 0 0 0-7 7c0 2.38 1.19 4.47 3 5.74V17a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-2.26c1.81-1.27 3-3.36 3-5.74a7 7 0 0 0-7-7z"/><path d="M9 21h6"/><path d="M10 17v-2.5"/><path d="M14 17v-2.5"/></svg>`;

const INFO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`;

const TUTORIAL_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>`;

const SETTINGS_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`;

interface HeaderProps {
    gitInitialized: boolean;
    app: App;
    pluginId: string;
    showInfo?: boolean;
    showTutorialLink?: boolean;
    onTutorial?: () => void;
}

export function Header({ gitInitialized, app, pluginId, showInfo = false, showTutorialLink = false, onTutorial }: HeaderProps) {
    const handleInfoClick = () => {
        new AboutModal(app).open();
    };

    const handleSettingsClick = () => {
        // Open Obsidian settings and navigate to this plugin's tab
        (app as any).setting.open();
        (app as any).setting.openTabById(pluginId);
    };

    return (
        <div className="echovault-header">
            <div className="echovault-header-actions">
                <button
                    className="echovault-info-btn"
                    onClick={handleSettingsClick}
                    aria-label="Open settings"
                    dangerouslySetInnerHTML={{ __html: SETTINGS_SVG }}
                />
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
