# EchoVault Plugin

Obsidian plugin that generates AI-powered flashcards from git diffs with SM-2 spaced repetition.

## Setup

```bash
npm install
npm run build

# Or from project root:
make install    # builds + syncs to test vault
make start      # install + watch mode
```

## Project Structure

```
src/
├── main.ts              # Plugin entry point — commands, sidebar, ribbon, status bar
│
├── core/                # Business logic (no UI dependencies)
│   ├── types.ts         # Shared interfaces, types, default settings
│   ├── utils.ts         # Helpers (ID generation, date strings)
│   ├── store.ts         # Flashcard CRUD — reads/writes flashcards.json
│   ├── review-log.ts    # Daily review session tracking
│   ├── generate.ts      # Commit → per-file diffs → images per file → batch backend call → save cards
│   ├── git.ts           # Git CLI wrappers (init, commit, log, diff) with per-command logging
│   ├── api-client.ts    # HTTP calls to backend (health, generate, batch generate)
│   ├── sm2.ts           # SM-2 spaced repetition algorithm
│   └── logger.ts        # Debug logger — writes to EchoVault/echovault.log
│
├── components/          # React UI (+ two non-React UI wiring files)
│   ├── SettingsTab.ts   # Settings tab UI (Obsidian native API, not React)
│   ├── SidebarView.tsx  # Mounts React app into an Obsidian ItemView
│   ├── App.tsx          # Root component — panel navigation, state
│   ├── Header.tsx       # Top bar with plugin title
│   ├── Dashboard.tsx    # Home screen — stats, forecast, actions
│   ├── ReviewSession.tsx # Card review flow with rating
│   ├── ReviewSummary.tsx # Post-review stats summary
│   ├── CardBrowser.tsx  # Search, filter, manage all cards
│   ├── CreateCard.tsx   # Manual card creation form
│   ├── GitLog.tsx       # History page — commit log + heatmap
│   ├── ReviewHeatmap.tsx # GitHub-style review activity grid
│   ├── Tutorial.tsx     # First-run onboarding walkthrough
│   ├── MarkdownText.tsx # Renders markdown via Obsidian's MarkdownRenderer
│   ├── EmptyState.tsx   # Reusable empty state with icon + action
│   ├── AboutModal.tsx   # Plugin info modal
│   └── cards/           # Card type-specific UI
│       ├── MCQCard.tsx  # Multiple choice options
│       ├── TFCard.tsx   # True/false buttons
│       ├── QACard.tsx   # Q&A answer display
│       └── RatingButtons.tsx  # Again / Hard / Good / Easy
│
├── __tests__/           # Vitest tests
│   ├── sm2.test.ts      # SM-2 algorithm tests
│   ├── store.test.ts    # FlashcardStore with mocked vault
│   ├── utils.test.ts    # Utility function tests
│   └── generate.test.ts # Image reference extraction tests
│
└── __mocks__/
    └── obsidian.ts      # Obsidian API mock for tests
```

## Architecture

The plugin is organized in two layers, plus a single entrypoint:

- **Entrypoint** (`main.ts`) — Obsidian plugin lifecycle, registers commands and views
- **Core** (`core/`) — business logic with no UI dependencies: types, data persistence, git operations, API calls, scheduling algorithm
- **Components** (`components/`) — the UI layer mounted inside an Obsidian `ItemView`. Almost all React, except `SettingsTab.ts` (Obsidian's native `PluginSettingTab` API) — it lives here because it's a UI concern, not because it's React.

Data flows through the `plugin` instance which is passed to React components, giving them access to `plugin.store`, `plugin.reviewLog`, `plugin.logger`, and `plugin.app`.

## Testing

```bash
npm test              # run all tests
npm run test:watch    # watch mode
```

Tests use vitest with an Obsidian API mock at `src/__mocks__/obsidian.ts`.
