# EchoVault

AI-powered flashcard generation for Obsidian using git diffs and spaced repetition.

Write notes, commit changes, and EchoVault automatically generates flashcards from what's new — then schedules reviews using the SM-2 algorithm.

## How It Works

1. Write or edit notes in Obsidian
2. Run **Commit & Generate Flashcards** — the plugin commits your vault and extracts the diff
3. New content is sent to a Python backend which calls an LLM (via OpenRouter) to create Q&A flashcards
4. Cards are stored locally in your vault as JSON
5. Run **Review Flashcards** to study due cards with spaced repetition scheduling

## Architecture

```
Obsidian Plugin (TypeScript)          Python Backend (FastAPI)
┌──────────────────────────┐          ┌─────────────────────┐
│  Git ops (commit, diff)  │          │                     │
│  Flashcard storage       │── diff ─▶│  OpenRouter LLM API │
│  SM-2 scheduling         │◀─ cards ─│                     │
│  Review modal UI         │          └─────────────────────┘
└──────────────────────────┘
```

- **Plugin** handles everything local: UI, git, storage, review scheduling
- **Backend** handles LLM calls only: receives diff text, returns Q&A pairs
- Reviews work fully offline — the backend is only needed for generating new cards

## Setup

### Backend

```bash
cd backend
cp .env.example .env
# Add your OpenRouter API key to .env

uv venv && source .venv/bin/activate
uv pip install -e .
uvicorn app.main:app --reload
```

The backend runs at `http://localhost:8000`. Verify with:

```bash
curl http://localhost:8000/health
# {"status":"ok"}
```

### Plugin

```bash
cd plugin
npm install
npm run build
```

Then copy these files into your vault at `.obsidian/plugins/echo-vault/`:

- `main.js`
- `manifest.json`
- `styles.css`

Enable the plugin in Obsidian settings.

## Usage

| Command | What it does |
|---|---|
| **Commit & Generate Flashcards** | Commits vault changes via git, extracts the diff, sends new content to the backend, and stores the generated flashcards |
| **Review Flashcards** | Opens a modal with due cards — flip to reveal the answer, then rate (Again / Hard / Good / Easy) |

A ribbon icon (brain) and status bar item showing due card count are also available.

### Settings

- **Backend URL** — where the Python backend is running (default: `http://localhost:8000`)
- **Flashcard folder** — vault folder for storing flashcard data (default: `EchoVault`)
- **Max cards per generation** — limit on flashcards created per commit (default: 10)

## Configuration

### Backend `.env`

| Variable | Default | Description |
|---|---|---|
| `OPENROUTER_API_KEY` | — | Your OpenRouter API key (required) |
| `OPENROUTER_MODEL` | `anthropic/claude-sonnet-4` | LLM model to use for generation |

## Project Structure

```
echo-vault/
├── backend/
│   ├── pyproject.toml
│   ├── .env.example
│   └── app/
│       ├── main.py          # FastAPI app + CORS
│       ├── routes.py        # /health, /generate-flashcards
│       ├── openrouter.py    # LLM API client
│       ├── schemas.py       # Pydantic models
│       └── config.py        # Settings from .env
│
└── plugin/
    ├── manifest.json
    ├── package.json
    ├── styles.css
    └── src/
        ├── main.ts          # Plugin entry point
        ├── types.ts         # Interfaces and defaults
        ├── settings.ts      # Settings tab UI
        ├── sm2.ts           # SM-2 algorithm
        ├── store.ts         # Flashcard JSON persistence
        ├── git.ts           # Git operations
        ├── api-client.ts    # Backend HTTP client
        ├── generate.ts      # Commit → diff → generate orchestration
        ├── review-modal.ts  # Review UI modal
        └── utils.ts         # ID generation, date helpers
```
