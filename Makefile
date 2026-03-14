PLUGIN_SRC = ./plugin
PLUGIN_DEST = ./vault/echo-vault/.obsidian/plugins/echo-vault

.PHONY: install dev start

install:
	mkdir -p $(PLUGIN_DEST)
	rsync -av --exclude .git $(PLUGIN_SRC)/ $(PLUGIN_DEST)/

dev:
	cd $(PLUGIN_DEST) && npm run dev

start: install dev
