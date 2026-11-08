"""Vault link-graph traversal -- finds notes related to a given note via its
existing markdown links and shared tags, without building or maintaining a
separate graph structure.

See harness-design.md section 4a: the vault's own links + tags already ARE a
knowledge graph (nodes = notes, edges = links/tags) as a side effect of how
it's written. This just walks that structure; it never constructs or persists
one of its own.

Draft (harness-design.md step 2) -- not yet wired into generation. Will become
an `@agent.tool` on `generator_agent` (step 3), used to author "connection"
cards, and later reused by `gap_finder.py` for prerequisite-gap detection
(step 8: note B links to concept A, but A's own note is thin or missing).
"""
import re
from pathlib import Path

import yaml

_LINK_RE = re.compile(r"\[[^\]]*\]\((?!https?://)([^)]+\.md)\)")
_FRONTMATTER_RE = re.compile(r"^---\n(.*?)\n---", re.S)


def _parse_note(path: Path) -> tuple[dict, str]:
    text = path.read_text(encoding="utf-8")
    m = _FRONTMATTER_RE.match(text)
    if not m:
        return {}, text
    try:
        fm = yaml.safe_load(m.group(1)) or {}
    except yaml.YAMLError:
        fm = {}
    return fm, text[m.end():]


def _outgoing_links(note_path: Path, body: str) -> list[Path]:
    links = []
    for match in _LINK_RE.findall(body):
        target = (note_path.parent / match).resolve()
        if target.exists():
            links.append(target)
    return links


def related_notes(note_path: str, vault_path: str, hops: int = 1) -> list[dict]:
    """Notes related to `note_path` via outgoing markdown links or shared
    tags, up to `hops` link-hops away (tags are only checked at hop 1 -- see
    the note on transitivity below). Returns, deduplicated (closest hop wins):

        [{"path": str, "relation": "link"|"tag", "hop": int,
          "shared_tags": [str, ...]}, ...]

    Read-only, no external calls. `note_path` and returned paths are relative
    to `vault_path`.
    """
    vault = Path(vault_path)
    start = (vault / note_path).resolve()
    if not start.exists():
        return []

    fm, body = _parse_note(start)
    own_tags = set(fm.get("tags") or [])

    found: dict[Path, dict] = {}

    # hop 1: direct outgoing links
    frontier = _outgoing_links(start, body)
    for target in frontier:
        found[target] = {"path": str(target.relative_to(vault)), "relation": "link",
                          "hop": 1, "shared_tags": []}

    # shared tags at hop 1 only. NOTE: this scans every .md file in the vault
    # once -- fine at a few thousand notes, but the first thing to optimise
    # (a precomputed tag -> notes index) if the vault grows a lot larger.
    if own_tags:
        for md_file in vault.rglob("*.md"):
            if md_file == start or md_file in found:
                continue
            other_fm, _ = _parse_note(md_file)
            shared = own_tags & set(other_fm.get("tags") or [])
            if shared:
                found[md_file] = {"path": str(md_file.relative_to(vault)), "relation": "tag",
                                  "hop": 1, "shared_tags": sorted(shared)}

    # hop 2+: follow links onward from hop-1 linked notes. Tags don't compound
    # past hop 1 here -- kept simple for the draft; revisit if transitive tag
    # relatedness turns out to matter in practice.
    current_hop = 1
    while current_hop < hops:
        current_hop += 1
        next_frontier = []
        for target in frontier:
            _, target_body = _parse_note(target)
            for linked in _outgoing_links(target, target_body):
                if linked != start and linked not in found:
                    found[linked] = {"path": str(linked.relative_to(vault)), "relation": "link",
                                      "hop": current_hop, "shared_tags": []}
                    next_frontier.append(linked)
        frontier = next_frontier

    return sorted(found.values(), key=lambda r: (r["hop"], r["path"]))
