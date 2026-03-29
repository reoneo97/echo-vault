# EchoVault Backend

FastAPI backend that generates AI-powered flashcards from git diffs using LLMs via OpenRouter.

## Setup

```bash
# Install dependencies (requires uv)
uv sync

# Create .env file
cp .env.example .env  # then add your OpenRouter API key

# Run dev server
uvicorn app.main:app --reload
# or from project root:
make backend
```

### Environment Variables

| Variable | Default | Description |
|---|---|---|
| `OPENROUTER_API_KEY` | (required) | Your OpenRouter API key |
| `OPENROUTER_MODEL` | `anthropic/claude-sonnet-4` | LLM model to use |
| `SYSTEM_PROMPT` | (see `config.py`) | System prompt for card generation |

## Project Structure

```
backend/
├── app/
│   ├── main.py          # FastAPI app, CORS middleware
│   ├── config.py         # Settings via pydantic-settings (.env)
│   ├── routes.py         # API endpoints
│   ├── schemas.py        # Pydantic request/response models
│   ├── openrouter.py     # LLM integration via PydanticAI
│   └── templates/
│       └── logs.html     # Jinja2 template for request log viewer
├── logs/
│   └── requests.jsonl    # JSONL request/response log (auto-created)
├── tests/
│   ├── conftest.py       # Pytest fixtures (TestClient, AsyncClient)
│   ├── test_schemas.py   # Pydantic model validation tests
│   └── test_routes.py    # Endpoint tests with mocked LLM
├── experiments/          # Experimental scripts (not part of the app)
├── fine_tuning/          # Fine-tuning related work (not part of the app)
└── pyproject.toml        # Dependencies and build config
```

## How It Works

### Request Flow

```
Plugin POST /generate-flashcards-batch
  → routes.py validates request (BatchGenerateRequest schema)
  → Distributes max_cards budget proportionally across files
  → Parallel LLM calls via asyncio.gather (one per file)
  → Each call: openrouter.py builds prompt → PydanticAI agent → LLM → structured output
  → routes.py returns cards grouped by source file (BatchGenerateResponse)
  → Logs full request/response to logs/requests.jsonl
```

### Key Modules

**`main.py`** — Creates the FastAPI app and attaches CORS middleware (allows all origins since the Obsidian plugin runs locally).

**`config.py`** — Uses `pydantic-settings` to load configuration from a `.env` file. The `Settings` class defines the OpenRouter API key, model name, and system prompt.

**`schemas.py`** — Pydantic models that define the API contract:
- `GenerateRequest` / `GenerateResponse` — single-file endpoint (legacy)
- `BatchGenerateRequest` / `BatchGenerateResponse` — per-file batch endpoint (current)
- `FileDiffEntry` — per-file diff with path, content, and optional images
- `FileResultEntry` — per-file result with source_note and cards
- `ImageData` — base64-encoded image attachment for multimodal prompts

**`routes.py`** — Endpoints:
- `GET /health` — simple health check
- `GET /agent-health` — streaming LLM health check via OpenRouter
- `POST /generate-flashcards` — single-file generation (legacy)
- `POST /generate-flashcards-batch` — per-file generation with parallel LLM calls and proportional card budget distribution
- `GET /logs?limit=20` — HTML request log viewer (Jinja2 template)

**`openrouter.py`** — Two PydanticAI agents:
- `flashcard_agent` — structured output (`GenerateResponse`), uses `FLASHCARD_PROMPT` as system prompt
- `health_agent` — streaming text output for health checks
When images are included, it builds a multimodal message with `BinaryContent` objects so the LLM can see referenced images from the user's notes.

## API Endpoints

### `GET /health`

Returns `{"status": "ok"}` when the server is running.

### `POST /generate-flashcards-batch`

Generate flashcards from per-file diffs. LLM calls run in parallel. Card budget is distributed proportionally to diff size.

**Request body:**
```json
{
  "files": [
    {
      "path": "notes/kafka.md",
      "diff_content": "added lines from this file's diff",
      "images": []
    },
    {
      "path": "notes/react.md",
      "diff_content": "added lines from this file's diff",
      "images": []
    }
  ],
  "max_cards": 10
}
```

**Response:**
```json
{
  "file_results": [
    {
      "source_note": "notes/kafka.md",
      "cards": [
        { "question": "What is Kafka?", "answer": "A distributed event streaming platform." }
      ]
    },
    {
      "source_note": "notes/react.md",
      "cards": [
        { "question": "What are React hooks?", "answer": "Functions that let you use state in function components." }
      ]
    }
  ]
}
```

### `GET /logs?limit=20`

HTML dashboard showing recent request/response logs with diffs and generated cards. Supports both legacy single-file and batch log entries.

### `POST /generate-flashcards` (legacy)

Single-file generation endpoint. Still functional for backwards compatibility.

## Testing

```bash
uv run pytest           # run all tests
uv run pytest -v        # verbose output
uv run pytest -x        # stop on first failure
```

Tests mock the LLM call so they run without an API key.
