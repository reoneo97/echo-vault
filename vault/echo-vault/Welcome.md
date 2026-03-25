# Welcome to EchoVault

EchoVault automatically generates flashcards from your notes using AI, then helps you review them with spaced repetition so you actually remember what you write.

## How It Works

1. **Write your notes** as you normally would in Obsidian.
2. **Commit & Generate** — EchoVault commits your changes via git, extracts what's new, and sends it to an AI backend that creates question/answer flashcards.
3. **Review** — When cards are due, review them in the sidebar. Rate how well you remembered each one, and EchoVault schedules the next review using the SM-2 spaced repetition algorithm.

## Getting Started

### 1. Check the backend connection
When the plugin loads, you'll see a notice telling you whether the backend is reachable. If not, open **Settings → EchoVault** and verify the backend URL (default: `http://localhost:8000`).

### 2. Generate your first flashcards
After writing some notes, trigger **Commit & Generate** using any of these methods:
- Press `Ctrl+Shift+G` (or `Cmd+Shift+G` on macOS)
- Open the Command Palette (`Ctrl+P`) and search for **"EchoVault: Commit & Generate Flashcards"**
- Click the **Commit & Generate** button in the EchoVault sidebar

This will commit your changes, extract the diff, and generate flashcards from the new content.

### 3. Review due cards
Open the EchoVault sidebar and click **Review** when cards are due. For each card:
- Read the question
- Click **Show Answer**
- Rate your recall: **Again**, **Hard**, **Good**, or **Easy**

Your rating determines when you'll see the card next — cards you find easy appear less often, while difficult ones come back sooner.

## Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl+Shift+G` | Commit & Generate Flashcards |
| `Ctrl+Shift+E` | Open EchoVault Panel |

On macOS, use `Cmd` instead of `Ctrl`.

These are default shortcuts. If they conflict with other plugins, you can reassign them in **Settings → Hotkeys** by searching for "EchoVault".

## Settings

Open **Settings → EchoVault** to configure:

- **Backend URL** — Address of the AI backend server
- **Flashcard folder path** — Vault folder where flashcard data is stored (default: `EchoVault`)
- **Data file name** — JSON file that holds your cards (default: `flashcards.json`)
- **Max cards per generation** — Limit how many cards are created per commit (1–30)

## Tips

- **Commit often** — Smaller diffs produce more focused, higher-quality flashcards.
- **Review daily** — Spaced repetition works best with consistent reviews. Check the status bar at the bottom of Obsidian to see how many cards are due.
- **Be honest with ratings** — Rating yourself accurately helps the algorithm schedule reviews effectively.
