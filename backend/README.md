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
│   └── openrouter.py     # LLM integration via PydanticAI
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
Plugin POST /generate-flashcards
  → routes.py validates request (GenerateRequest schema)
  → openrouter.py builds prompt from diff + optional images
  → PydanticAI agent calls LLM via OpenRouter
  → LLM returns structured output (GenerateResponse schema)
  → routes.py returns list of flashcard pairs to plugin
```

### Key Modules

**`main.py`** — Creates the FastAPI app and attaches CORS middleware (allows all origins since the Obsidian plugin runs locally).

**`config.py`** — Uses `pydantic-settings` to load configuration from a `.env` file. The `Settings` class defines the OpenRouter API key, model name, and system prompt.

**`schemas.py`** — Pydantic models that define the API contract:
- `GenerateRequest` — diff content, source note path, max cards, optional images
- `GenerateResponse` — list of `FlashcardPair` (question + answer)
- `ImageData` — base64-encoded image attachment for multimodal prompts

**`routes.py`** — Two endpoints:
- `GET /health` — simple health check
- `POST /generate-flashcards` — validates input, calls LLM, returns cards

**`openrouter.py`** — Wraps the LLM call using PydanticAI's `Agent` with structured output. When images are included, it builds a multimodal message with `BinaryContent` objects so the LLM can see referenced images from the user's notes.

## API Endpoints

### `GET /health`

Returns `{"status": "ok"}` when the server is running.

### `POST /generate-flashcards`

Generate flashcards from a git diff.

**Request body:**
```json
{
  "diff_content": "string (required) — added lines from the git diff",
  "source_note": "string — filename of the changed note",
  "max_cards": 10,
  "images": [
    {
      "filename": "diagram.png",
      "data": "base64-encoded image bytes",
      "media_type": "image/png"
    }
  ]
}
```

**Response:**
```json
{
  "cards": [
    {
      "question": "What is...",
      "answer": "It is..."
    }
  ]
}
```

## Testing

```bash
uv run pytest           # run all tests
uv run pytest -v        # verbose output
uv run pytest -x        # stop on first failure
```

Tests mock the LLM call so they run without an API key.
