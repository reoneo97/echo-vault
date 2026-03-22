import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        globals: true,
        environment: "node",
    },
    resolve: {
        alias: {
            obsidian: "./src/__mocks__/obsidian.ts",
        },
    },
});
