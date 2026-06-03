PLUGIN_SRC = ./plugin
PLUGIN_DEST = ./vault/echo-vault/.obsidian/plugins/echo-vault
BACKEND_SRC = ./backend

.PHONY: build install dev start up down logs restart eval test test-plugin test-backend

build:
	cd $(PLUGIN_SRC) && npm run build

install: build
	mkdir -p $(PLUGIN_DEST)
	rsync -av --exclude .git $(PLUGIN_SRC)/ $(PLUGIN_DEST)/

dev:
	cd $(PLUGIN_SRC) && npm run dev

start: install dev

# ── Docker (daily use) ────────────────────────────────────────────────────────

up:
	docker compose up -d --build
	@echo ""
	@echo "  Backend  → http://localhost:8000"
	@echo "  Grafana  → http://localhost:3000  (admin / admin)"
	@echo "  Prometheus → http://localhost:9090"

down:
	docker compose down

logs:
	docker compose logs -f backend

restart:
	docker compose restart backend

# ── Evals ─────────────────────────────────────────────────────────────────────

eval:
	cd $(BACKEND_SRC) && uv run python evals/run_eval.py $(ARGS)

# ── Tests ─────────────────────────────────────────────────────────────────────

test: test-plugin test-backend

test-plugin:
	cd $(PLUGIN_SRC) && npm test

test-backend:
	cd $(BACKEND_SRC) && uv run pytest tests/ -v
