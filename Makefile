PLUGIN_SRC = ./plugin
PLUGIN_DEST = ./vault/echo-vault/.obsidian/plugins/echo-vault
BACKEND_SRC = ./backend

.PHONY: build install dev start test test-plugin test-backend

build:
	cd $(PLUGIN_SRC) && npm run build

install: build
	mkdir -p $(PLUGIN_DEST)
	rsync -av --exclude .git $(PLUGIN_SRC)/ $(PLUGIN_DEST)/

dev:
	cd $(PLUGIN_DEST) && npm run dev

start: install dev

test: test-plugin test-backend

test-plugin:
	cd $(PLUGIN_SRC) && npm test

test-backend:
	cd $(BACKEND_SRC) && uv run pytest tests/ -v
