// Minimal Obsidian API mock for unit tests

export class Notice {
    constructor(_message: string) {}
}

export class Component {
    load() {}
    unload() {}
}

export class TFile {
    path: string;
    name: string;
    extension: string;
    constructor(path: string) {
        this.path = path;
        this.name = path.split("/").pop() ?? path;
        this.extension = this.name.split(".").pop() ?? "";
    }
}

export const MarkdownRenderer = {
    render: async () => {},
};

export function requestUrl(_opts: Record<string, unknown>) {
    return Promise.resolve({ status: 200, json: {} });
}

export class Vault {
    adapter = {
        exists: async (_path: string) => false,
        mkdir: async (_path: string) => {},
        read: async (_path: string) => "{}",
        write: async (_path: string, _data: string) => {},
        readBinary: async (_path: string) => new ArrayBuffer(0),
        stat: async (_path: string) => ({ size: 0 }),
    };
    getFiles() {
        return [];
    }
}

export class Plugin {
    app = { vault: new Vault() };
    async loadData() { return {}; }
    async saveData(_data: unknown) {}
    addCommand() {}
    addRibbonIcon() {}
    addSettingTab() {}
    addStatusBarItem() { return { setText: () => {} }; }
    registerView() {}
}

export class App {
    vault = new Vault();
    workspace = {
        getLeavesOfType: () => [],
        getActiveFile: () => null,
    };
}
