import { useRef, useEffect } from "react";
import { App, MarkdownRenderer, Component } from "obsidian";

interface MarkdownTextProps {
    app: App;
    markdown: string;
    sourcePath?: string;
    className?: string;
}

export function MarkdownText({ app, markdown, sourcePath, className }: MarkdownTextProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const componentRef = useRef<Component | null>(null);

    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;

        // Clear previous render
        el.innerHTML = "";
        if (componentRef.current) {
            componentRef.current.unload();
        }

        const component = new Component();
        component.load();
        componentRef.current = component;

        MarkdownRenderer.render(app, markdown, el, sourcePath ?? "", component);

        return () => {
            component.unload();
            componentRef.current = null;
        };
    }, [app, markdown]);

    return <div ref={containerRef} className={className} />;
}
