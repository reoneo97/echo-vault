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
2. Run **Commit & Generate Flashcards** — the plugin commits your vault and extracts per-file diffs
3. Each file's new content is sent to a Python backend which calls an LLM in parallel (via OpenRouter) to create flashcards
4. Cards are stored locally in your vault as JSON, each attributed to its source note
5. Run **Review Flashcards** to study due cards with spaced repetition scheduling

## Card Types

- **Q&A** — classic question and answer
- **Multiple Choice** — pick from 4 options with instant correct/incorrect feedback
- **True / False** — binary choice with color-coded feedback

## Architecture

```
Obsidian Plugin (TypeScript + React)     Python Backend (FastAPI + Docker)
┌──────────────────────────────┐         ┌──────────────────────────────┐
│  Git ops (commit, diff)      │         │  OpenRouter LLM API          │
│  Flashcard storage           │── diff ─▶  Prometheus metrics          │
│  SM-2 scheduling             │◀─ cards ─│  Logfire tracing             │
│  React sidebar UI            │         └──────────────────────────────┘
└──────────────────────────────┘                    │
                                         ┌──────────▼───────────┐
                                         │  Grafana dashboard   │
                                         │  :3000               │
                                         └──────────────────────┘
```

- **Plugin** handles everything local: UI, git, storage, review scheduling
- **Backend** handles LLM calls, metrics, and tracing — runs in Docker
- Reviews work fully offline — the backend is only needed for generating new cards

---

## Quick Start

### 1. Configure the backend

```bash
cp backend/.env.example backend/.env
```

Edit `backend/.env` and add your keys:

```
OPENROUTER_API_KEY=sk-or-...
OPENROUTER_MODEL=qwen/qwen3.5-9b
LOGFIRE_TOKEN=pylf_...        # optional — omit to disable tracing
```

### 2. Start everything

```bash
make up
```

This builds and starts the backend, Prometheus, and Grafana in Docker:

| Service | URL |
|---|---|
| Backend API | http://localhost:8000 |
| Grafana dashboard | http://localhost:3000 (admin / admin) |
| Prometheus | http://localhost:9090 |

Verify the backend is healthy:
```bash
curl http://localhost:8000/health
# {"status":"ok"}
```

### 3. Install the plugin

Build and copy to your vault:

```bash
make install PLUGIN_DEST="/path/to/your/vault/.obsidian/plugins/echo-vault"
```

Enable the plugin in Obsidian → Settings → Community Plugins.

---

## Daily Workflow

```bash
make up        # start backend + monitoring (run once; restarts automatically on reboot isn't automatic — re-run after restart)
make down      # stop everything
make logs      # tail backend logs
make restart   # rebuild + restart backend after code changes
```

---

## Development

```bash
# Plugin — watch mode with auto-install to test vault
make start

# Tests
make test          # plugin + backend
make test-plugin   # vitest
make test-backend  # pytest
```

For backend changes, rebuild and restart the container:
```bash
make restart
```

---

## Usage

| Command | What it does |
|---|---|
| **Commit & Generate Flashcards** | Commits vault changes, extracts the diff, generates flashcards via LLM |
| **Regenerate from Active Note** | Force-generates cards from the currently open note |
| **Import Existing Notes** | Gradually import notes from an existing vault (10 at a time) |
| **Review Flashcards** | Opens the sidebar with due cards — answer then rate (Again / Hard / Good / Easy) |
| **Browse All Cards** | Search, filter, and manage all flashcards |

Keyboard shortcuts during review: `Space` to reveal answer, `1–4` to rate (Again / Hard / Good / Easy).

---

## Configuration

### Backend `.env`

| Variable | Default | Description |
|---|---|---|
| `OPENROUTER_API_KEY` | — | Required. Get one at openrouter.ai |
| `OPENROUTER_MODEL` | `qwen/qwen3.5-9b` | LLM model for card generation |
| `LOGFIRE_TOKEN` | — | Optional. Enables distributed tracing via Logfire |
| `ENVIRONMENT` | `development` | Passed to Logfire as the service environment |

### Plugin settings

| Setting | Default | Description |
|---|---|---|
| Backend URL | `http://localhost:8000` | Where the backend is running |
| Flashcard folder | `EchoVault` | Vault folder for storing card data |
| Max cards per generation | `10` | Global cap on cards per commit |

---

## Project Structure

```
echo-vault/
├── docker-compose.yml     # starts backend + Prometheus + Grafana
├── Makefile               # make up / down / logs / install / test
├── plugin/                # Obsidian plugin (TypeScript + React)
├── backend/
│   ├── Dockerfile
│   ├── app/               # FastAPI application
│   └── monitoring/        # Prometheus + Grafana config
└── vault/                 # Test vault for development
```
