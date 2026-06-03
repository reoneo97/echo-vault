PLUGIN_SRC = ./plugin
PLUGIN_DEST = /Users/reo/Documents/Reo/data-science/data-science-notes/.obsidian/plugins/echo-vault
BACKEND_SRC = ./backend

.PHONY: build install dev start up down logs restart eval judge test test-plugin test-backend

build:
	cd $(PLUGIN_SRC) && npm run build

install: build
	mkdir -p $(PLUGIN_DEST)
	cp $(PLUGIN_SRC)/main.js $(PLUGIN_DEST)/main.js
	cp $(PLUGIN_SRC)/manifest.json $(PLUGIN_DEST)/manifest.json
	cp $(PLUGIN_SRC)/styles.css $(PLUGIN_DEST)/styles.css

dev:
	cd $(PLUGIN_SRC) && npm run dev

start: install dev

# ── Docker (daily use) ────────────────────────────────────────────────────────

up:
	docker compose up -d --build
	@echo ""
	@echo "  Backend    → http://localhost:8000"
	@echo "  Grafana    → http://localhost:3000  (admin / admin)"
	@echo "  Prometheus → http://localhost:9090"
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

# ── Tests ─────────────────────────────────────────────────────────────────────

test: test-plugin test-backend

test-plugin:
	cd $(PLUGIN_SRC) && npm test

test-backend:
	cd $(BACKEND_SRC) && uv run pytest tests/ -v
