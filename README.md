<p align="center">
  <img src="assets/icon.svg" alt="EchoVault" width="96" height="96" />
</p>

<h1 align="center">EchoVault</h1>

<p align="center">
  AI-powered flashcard generation for Obsidian using git diffs and spaced repetition.
</p>

<p align="center">
  Write notes, commit changes, and EchoVault automatically generates flashcards from what's new — then schedules reviews using the SM-2 algorithm.
</p>

---

## How It Works

1. Write or edit notes in Obsidian
2. Run **Commit & Generate Flashcards** — the plugin commits your vault and extracts the diff
3. New content is sent to a Python backend which calls an LLM (via OpenRouter) to create flashcards
4. Cards are stored locally in your vault as JSON
5. Run **Review Flashcards** to study due cards with spaced repetition scheduling

## Card Types

- **Q&A** — classic question and answer
- **Multiple Choice** — pick from 4 options with instant correct/incorrect feedback
- **True / False** — binary choice with color-coded feedback

## Architecture

```
Obsidian Plugin (TypeScript + React)     Python Backend (FastAPI)
┌──────────────────────────────┐         ┌─────────────────────┐
│  Git ops (commit, diff)      │         │                     │
│  Flashcard storage           │── diff ─▶  OpenRouter LLM API │
│  SM-2 scheduling             │◀─ cards ─│                     │
│  React sidebar UI            │         └─────────────────────┘
└──────────────────────────────┘
```

- **Plugin** handles everything local: UI, git, storage, review scheduling
- **Backend** handles LLM calls only: receives diff text, returns flashcard pairs
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

Or use `make install` to build and copy to the test vault automatically.

Enable the plugin in Obsidian settings.

## Usage

| Command | What it does |
|---|---|
| **Commit & Generate Flashcards** | Commits vault changes, extracts the diff, generates flashcards via LLM |
| **Review Flashcards** | Opens the sidebar with due cards — answer then rate (Again / Hard / Good / Easy) |
| **Browse All Cards** | Search, filter, and manage all flashcards with the card browser |

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
├── plugin/        # Obsidian plugin (TypeScript + React)
├── backend/       # FastAPI server (Python)
└── vault/         # Test vault for development
```

See [plugin/README.md](plugin/README.md) and [backend/README.md](backend/README.md) for detailed documentation.
