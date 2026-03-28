PLUGIN_SRC = ./plugin
PLUGIN_DEST = ./vault/echo-vault/.obsidian/plugins/echo-vault
BACKEND_SRC = ./backend

.PHONY: build install dev start backend test test-plugin test-backend

build:
	cd $(PLUGIN_SRC) && npm run build

install: build
	mkdir -p $(PLUGIN_DEST)
	rsync -av --exclude .git $(PLUGIN_SRC)/ $(PLUGIN_DEST)/

dev:
	cd $(PLUGIN_DEST) && npm run dev

start: install dev

backend:
	@if lsof -ti:8000 > /dev/null 2>&1; then \
		echo "Backend already running on port 8000"; \
	else \
		cd $(BACKEND_SRC) && uv run uvicorn app.main:app --reload; \
	fi

test: test-plugin test-backend

test-plugin:
	cd $(PLUGIN_SRC) && npm test

test-backend:
	cd $(BACKEND_SRC) && uv run pytest tests/ -v
