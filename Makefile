PLUGIN_SRC = ./plugin
PLUGIN_DEST_NOTES = /Users/reo/Documents/Reo/data-science/data-science-notes/.obsidian/plugins/echo-vault
PLUGIN_DEST_SB    = /Users/reo/Documents/Reo/data-science/second-brain/notes/.obsidian/plugins/echo-vault
BACKEND_SRC = ./backend

# Default vault to install to (override: make install VAULT=notes or VAULT=second-brain)
VAULT ?= second-brain

.PHONY: build install install-notes install-second-brain configure dev start up down logs restart eval judge dedup backtest test test-plugin test-backend

build:
	cd $(PLUGIN_SRC) && npm run build

install: build install-notes install-second-brain

install-notes:
	mkdir -p $(PLUGIN_DEST_NOTES)
	cp $(PLUGIN_SRC)/main.js      $(PLUGIN_DEST_NOTES)/main.js
	cp $(PLUGIN_SRC)/manifest.json $(PLUGIN_DEST_NOTES)/manifest.json
	cp $(PLUGIN_SRC)/styles.css   $(PLUGIN_DEST_NOTES)/styles.css

install-second-brain:
	mkdir -p $(PLUGIN_DEST_SB)
	cp $(PLUGIN_SRC)/main.js      $(PLUGIN_DEST_SB)/main.js
	cp $(PLUGIN_SRC)/manifest.json $(PLUGIN_DEST_SB)/manifest.json
	cp $(PLUGIN_SRC)/styles.css   $(PLUGIN_DEST_SB)/styles.css

# Re-apply plugin settings without touching Obsidian UI. Re-run this after
# setting up on a new machine — .obsidian/ is gitignored in the vault.
configure:
	@printf '{\n  "backendUrl": "http://localhost:8000",\n  "flashcardFolderPath": "EchoVault",\n  "dataFileName": "flashcards.json",\n  "maxCardsPerGeneration": 10,\n  "hasSeenTutorial": true,\n  "scopedFolders": "knowledge"\n}\n' > $(PLUGIN_DEST_SB)/data.json
	@echo "Configured second-brain vault (scopedFolders=knowledge)"

dev:
	cd $(PLUGIN_SRC) && npm run dev

start: install dev

# ── Docker (daily use) ────────────────────────────────────────────────────────

up:
	docker compose up -d --build
	@echo ""
	@echo "  Backend    → http://localhost:8000"
	@echo "  MLflow     → http://localhost:5001"

down:
	docker compose down

logs:
	docker compose logs -f backend

restart:
	docker compose restart backend

# ── Evals ─────────────────────────────────────────────────────────────────────

eval:
	cd evals && uv run python run_eval.py $(ARGS)

judge:
	cd evals && uv run python judge.py $(ARGS)

dedup:
	cd evals && uv run python dedup_eval.py $(ARGS)

backtest:
	cd evals && uv run python build_historical_fixtures.py $(ARGS)

# ── Tests ─────────────────────────────────────────────────────────────────────

test: test-plugin test-backend

test-plugin:
	cd $(PLUGIN_SRC) && npm test

test-backend:
	cd $(BACKEND_SRC) && uv run pytest tests/ -v
