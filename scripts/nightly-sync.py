#!/usr/bin/env python3
"""
Nightly Grimoire Sync — X + Raindrop → Grimoire with auto-categorization.

Runs:  ~4:20 AM daily via cron
Pulls: bird CLI (X bookmarks) + Raindrop API
Dedup: checks Grimoire existing URLs before importing
Tags:  #x or #raindrop for source provenance
Cats:  auto-assigns one of 13 content categories via title/desc/domain heuristics

Usage (from cron or manually):
    GRIMOIRE_PASS="..." python3 /home/agents/grimoire/nightly_sync.py

Secrets fetched from 1Password Olympus vault:
    - "Bird Cookies"    → AUTH_TOKEN, CT0 (for bird CLI)
    - "Raindrop API"    → testtoken (Raindrop OAuth)
    - "Grimoire - Bookmark Manager" → password (Grimoire login)
"""

import json
import os
import re
import subprocess
import sys
import time
import urllib.request
import urllib.error
from pathlib import Path
from typing import Optional

SCRIPT_DIR = Path(__file__).parent
sys.path.insert(0, str(SCRIPT_DIR))
from grimoire_api import GrimoireAPI

# ── Grimoire connection ──
# Use https:// for production; http:// for internal Docker networking
# Override via GRIMOIRE_URL env var if needed
GRIMOIRE_URL = os.environ.get("GRIMOIRE_URL", "https://grimoire.internal:5173")
GRIMOIRE_USER = "edward"

# ── Raindrop ──
RAINDROP_API = "https://api.raindrop.io/rest/v1"
RAINDROP_COLLECTION = 57333946
RAINDROP_PERPAGE = 50

# ── Bird / X ──
BIRD_CMD = ["bird"]
X_CACHE = SCRIPT_DIR / "bookmarks_raw.json"

# ── Logging ──
LOG_FILE = SCRIPT_DIR / "nightly_sync.log"

# ── Category map: ID → (keyword patterns, domain patterns) ──
# Categories from Grimoire DB:
#   7=AI & Agents, 8=Programming & Dev, 9=Audio & Music,
#   10=Esoteric & Spirituality, 11=Health & Biohacking,
#   12=Design & UI, 13=Art & Generative Art, 14=Gaming & Game Dev,
#   15=Academic & Papers, 16=Web & Infrastructure,
#   17=Hobby & DIY, 18=Finance & Crypto, 19=Community & Events
CATEGORY_RULES = [
    (7, "AI & Agents", [
        "ai agent", "llm", "gpt", "claude", "chatgpt", "prompt engineering",
        "machine learning", "neural net", "deep learning", "transformer",
        "autonomous agent", "rag", "langchain", "fine.tun", "vector db",
        "embedding", "token", "large language model", "foundation model",
        "multi-agent", "agentic", "chain of thought", "reasoning model",
    ], [
        "openai.com", "anthropic.com", "huggingface.co", "perplexity.ai",
    ]),
    (8, "Programming & Dev", [
        "programming", "code", "developer", "api", "git", "deploy",
        "typescript", "javascript", "python", "rust", "docker", "kubernetes",
        "backend", "frontend", "fullstack", "refactor", "compiler",
        "open source", "npm", "cargo", "pip", "bun", "deno", "node.js",
        "react", "vue", "svelte", "commit", "pull request", "pr review",
    ], [
        "github.com", "gitlab.com", "stackoverflow.com", "npmjs.com",
        "docs.rs", "crates.io", "pypi.org",
    ]),
    (9, "Audio & Music", [
        "music", "audio", "song", "beat", "synth", "producer", "album",
        "listening", "playlist", "podcast", "spotify", "sound design",
        "mixing", "mastering", "daw", "ableton", "fl studio", "vst",
    ], [
        "soundcloud.com", "bandcamp.com", "open.spotify.com",
        "music.youtube.com",
    ]),
    (10, "Esoteric & Spirituality", [
        "esoteric", "spirituality", "occult", "alchemy", "meditation",
        "consciousness", "mystic", "hermetic", "gnostic", "tarot",
        "astrology", "kabbalah", "dao", "zen", "non.dual", "enlightenment",
        "psychedelic", "ayahuasca", "dmt", "dream", "astral",
    ], []),
    (11, "Health & Biohacking", [
        "health", "biohack", "longevity", "supplement", "peptide",
        "nootropic", "exercise", "fitness", "nutrition", "diet", "fasting",
        "mitochondria", "nad", "senolytic", "ivermectin", "fenbendazole",
        "cancer", "treatment", "therapy", "clinical trial",
    ], [
        "examine.com", "pubmed.ncbi.nlm.nih.gov",
    ]),
    (12, "Design & UI", [
        "design", "ui", "ux", "figma", "component", "layout", "color",
        "typography", "interface", "wireframe", "prototype", "mockup",
        "design system", "design token", "accessibility", "a11y",
        "responsive", "mobile first", "user research",
    ], [
        "dribbble.com", "behance.net", "ui/ux",
    ]),
    (13, "Art & Generative Art", [
        "generative art", "creative coding", "three.js", "p5.js",
        "shader", "glsl", "canvas", "webgl", "processing", "openframeworks",
        "digital art", "nft", "generative", "procedural", "fragment",
        "pixel art", "interactive art", "installation",
    ], []),
    (14, "Gaming & Game Dev", [
        "game", "gaming", "gamedev", "unity", "unreal", "godot",
        "mechanics", "gameplay", "rpg", "rts", "fps", "roguelike",
        "speedrun", "emulator", "retro game", "modding", "game engine",
    ], [
        "store.steampowered.com", "itch.io",
    ]),
    (15, "Academic & Papers", [
        "paper", "research", "study", "arxiv", "journal", "academic",
        "thesis", "doi", "preprint", "proceedings", "conference paper",
        "survey", "literature review", "meta.analysis",
    ], [
        "arxiv.org", "scholar.google.com", "semanticscholar.org",
        "openreview.net", "neurips.cc", "icml.cc", "iclr.cc",
    ]),
    (16, "Web & Infrastructure", [
        "web", "hosting", "server", "cloud", "domain", "dns", "vps",
        "cdn", "nginx", "traefik", "proxy", "load balancer", "ssl",
        "tls", "certificate", "tailscale", "wireguard", "vpn",
        "infrastructure", "devops", "ci/cd", "monitoring",
    ], [
        "hetzner.com", "digitalocean.com", "vultr.com", "linode.com",
        "cloudflare.com", "netcup.de", "ovhcloud.com",
    ]),
    (17, "Hobby & DIY", [
        "diy", "hobby", "crafting", "maker", "3d print", "arduino",
        "woodworking", "electronics", "soldering", "raspberry pi",
        "home lab", "homelab", "self.hosted", "selfhost",
        "home server",
    ], [
        "thingiverse.com", "printables.com", "instructables.com",
        "raspberrypi.com",
    ]),
    (18, "Finance & Crypto", [
        "finance", "crypto", "bitcoin", "ethereum", "defi", "trading",
        "stock", "investment", "blockchain", "web3", "token", "dao",
        "yield", "staking", "nft", "wallet", "smart contract",
        "solidity", "evm", "layer 2", "rollup", "zcash", "monero",
    ], [
        "coinbase.com", "binance.com", "coingecko.com", "debank.com",
        "etherscan.io",
    ]),
    (19, "Community & Events", [
        "community", "meetup", "conference", "event", "hackathon",
        "workshop", "summit", "gathering", "co.working", "unconference",
        "twitter space", "discord", "telegram group",
    ], []),
]


def log(msg: str):
    ts = time.strftime("%Y-%m-%d %H:%M:%S")
    line = f"[{ts}] {msg}"
    print(line)
    with open(LOG_FILE, "a") as f:
        f.write(line + "\n")


def get_op(item: str, field: str) -> str:
    """Fetch a secret from 1Password Olympus vault."""
    r = subprocess.run(
        ["op", "item", "get", item, "--vault", "Olympus",
         "--fields", field, "--reveal"],
        capture_output=True, text=True, timeout=15
    )
    if r.returncode != 0:
        raise RuntimeError(f"1Password failed for '{item}/{field}': {r.stderr[:200]}")
    return r.stdout.strip()


def auto_categorize(title: str, desc: str, domain: str, url: str) -> int:
    """
    Assign a category ID based on title, description, domain, and URL content.

    Two-pass strategy:
      1. Domain matching (all categories checked) — exact host/substring match wins
      2. Keyword matching (word-boundary anchored) — most specific match wins

    Returns category ID (defaults to 7 = AI & Agents as the largest bucket).
    """
    text = f"{title} {desc} {domain} {url}".lower()

    # ── Pass 1: Domain matching ──
    domain_matches = []
    for cat_id, cat_name, keywords, domains in CATEGORY_RULES:
        for d in domains:
            d_lower = d.lower().replace("www.", "")
            if d_lower in domain.lower() or d_lower in url.lower():
                domain_matches.append((cat_id, len(d_lower)))
    if domain_matches:
        # Pick the most specific (longest) domain match
        domain_matches.sort(key=lambda x: -x[1])
        return domain_matches[0][0]

    # ── Pass 2: Keyword matching with word boundaries ──
    for cat_id, cat_name, keywords, domains in CATEGORY_RULES:
        for kw in keywords:
            # Escape regex specials, then add word boundaries
            escaped = re.escape(kw.lower())
            pattern = r"(?<![a-z])" + escaped + r"(?![a-z])"
            if re.search(pattern, text):
                return cat_id

    # Default: AI & Agents
    return 7


def sync_x(api: GrimoireAPI, existing_urls: set) -> tuple:
    """
    Sync X/Twitter bookmarks via bird CLI.
    Returns (imported_count, skipped_count, failed_count).
    """
    log("── X Bookmarks Sync ──")

    # Fetch bird auth from 1Password
    try:
        auth_token = get_op("Bird Cookies", "auth-token")
        ct0 = get_op("Bird Cookies", "ct0")
    except Exception as e:
        log(f"✗ Failed to get Bird cookies from 1Password: {e}")
        return 0, 0, 0

    env = os.environ.copy()
    env["AUTH_TOKEN"] = auth_token
    env["CT0"] = ct0

    # Fetch from bird CLI
    try:
        result = subprocess.run(
            BIRD_CMD + ["bookmarks", "--json", "-n", "1320"],
            capture_output=True, text=True, timeout=120, env=env
        )
        if result.returncode != 0:
            log(f"✗ bird CLI failed: {result.stderr[:200]}")
            return 0, 0, 0
        fresh = json.loads(result.stdout)
    except Exception as e:
        log(f"✗ bird CLI error: {e}")
        return 0, 0, 0

    log(f"  → {len(fresh)} bookmarks on X")

    # Build URLs
    fresh_with_urls = []
    for bm in fresh:
        try:
            tweet_url = f"https://x.com/{bm['author']['username']}/status/{bm['id']}"
            fresh_with_urls.append((bm, tweet_url))
        except (KeyError, TypeError):
            continue

    new_items = [(bm, url) for bm, url in fresh_with_urls if url not in existing_urls]
    log(f"  → {len(new_items)} new since last sync")

    if not new_items:
        log("  Nothing to sync from X.")
        # Still update cache
        with open(X_CACHE, "w") as f:
            json.dump(fresh, f, indent=2)
        return 0, 0, 0

    imported = 0
    failed = 0
    for i, (bm, tweet_url) in enumerate(new_items):
        text = bm.get("text", "")
        title = text.split("\n")[0][:120] if text else f"Bookmark by @{bm['author']['username']}"
        description = text[:500] if text else ""
        domain = "x.com"

        cat_id = auto_categorize(title, description, domain, tweet_url)

        try:
            api.create_bookmark(
                url=tweet_url, title=title, description=description,
                category=cat_id, tags=["x"]
            )
            imported += 1
            existing_urls.add(tweet_url)
            if imported % 10 == 0:
                log(f"  ✓ X: {imported}/{len(new_items)}")
        except Exception as e:
            failed += 1
            log(f"  ✗ X: {title[:50]} → {str(e)[:80]}")
            if failed >= 5:
                log("  ✗ Too many X failures, stopping sync")
                break

    # Update cache
    with open(X_CACHE, "w") as f:
        json.dump(fresh, f, indent=2)

    log(f"  X done: {imported} imported, {failed} failed")
    return imported, 0, failed


def sync_raindrop(api: GrimoireAPI, existing_urls: set) -> tuple:
    """
    Sync Raindrop bookmarks via Raindrop API.
    Returns (imported_count, skipped_count, failed_count).
    """
    log("── Raindrop Sync ──")

    # Get Raindrop token
    try:
        rain_token = get_op("Raindrop API", "testtoken")
    except Exception as e:
        log(f"✗ Failed to get Raindrop token: {e}")
        return 0, 0, 0

    imported = 0
    failed = 0
    skipped = 0

    for page in range(100):
        url = (f"{RAINDROP_API}/raindrops/{RAINDROP_COLLECTION}"
               f"?page={page}&perpage={RAINDROP_PERPAGE}")
        req = urllib.request.Request(url, headers={
            "Authorization": f"Bearer {rain_token}"
        })
        try:
            with urllib.request.urlopen(req, timeout=15) as resp:
                data = json.loads(resp.read())
        except Exception as e:
            if page == 0:
                log(f"✗ Raindrop API error: {e}")
            else:
                log(f"  → Raindrop API ended at page {page}")
            break

        items = data.get("items", [])
        if not items:
            log(f"  → No more Raindrop items (page {page})")
            break

        for item in items:
            bm_url = item.get("link", "")
            if not bm_url:
                continue

            if bm_url in existing_urls:
                skipped += 1
                continue

            title = item.get("title", "") or bm_url[:60]
            desc = item.get("excerpt", "") or ""
            rd_tags = [t.get("_id", "") for t in item.get("tags", []) if t.get("_id")]
            domain = item.get("domain", "") or ""

            cat_id = auto_categorize(title, desc, domain, bm_url)

            # Build tags: raindrop source + any existing tags
            tags = ["raindrop"] + [t for t in rd_tags if t]

            try:
                api.create_bookmark(
                    url=bm_url, title=title, description=desc,
                    category=cat_id, tags=tags
                )
                imported += 1
                existing_urls.add(bm_url)
                if imported % 10 == 0:
                    log(f"  ✓ Raindrop: {imported}/{imported + skipped}")
            except Exception as e:
                failed += 1
                log(f"  ✗ Raindrop: {title[:50]} → {str(e)[:80]}")

        log(f"  Raindrop page {page}: +{imported} imported, {failed} failed so far")

        # Check if done
        total = data.get("count", 0) or data.get("total", 0)
        if total > 0 and (imported + skipped) >= total:
            break

        time.sleep(0.3)  # rate limit courtesy

    log(f"  Raindrop done: {imported} imported, {skipped} skipped, {failed} failed")
    return imported, skipped, failed


def main():
    log("╔══════════════════════════════════════════╗")
    log("║   Grimoire Nightly Sync                  ║")
    log("╚══════════════════════════════════════════╝")

    # ── Auth ──
    try:
        grim_pass = get_op("Grimoire - Bookmark Manager", "password")
    except Exception as e:
        log(f"✗ Failed to get Grimoire password: {e}")
        sys.exit(1)

    log("🔐 Connecting to Grimoire...")
    api = GrimoireAPI(GRIMOIRE_URL, GRIMOIRE_USER, grim_pass)

    # ── Get existing URLs ──
    log("  Fetching existing Grimoire bookmarks for dedup...")
    all_bms = api.list_bookmarks()
    existing_urls = {b.get("url", "") for b in all_bms if b.get("url")}
    log(f"  → {len(existing_urls)} existing bookmarks in Grimoire")

    # ── Sync X ──
    x_imported, _, x_failed = sync_x(api, existing_urls)

    # ── Sync Raindrop ──
    rd_imported, rd_skipped, rd_failed = sync_raindrop(api, existing_urls)

    # ── Summary ──
    total_new = x_imported + rd_imported
    total_fails = x_failed + rd_failed
    log("")
    log("📊 Nightly Sync Summary")
    log(f"  X:        {x_imported:>4} new, {x_failed} failed")
    log(f"  Raindrop: {rd_imported:>4} new, {rd_skipped} skipped, {rd_failed} failed")
    log(f"  ─────────────────────")
    log(f"  Total:    {total_new:>4} new bookmarks imported")
    if total_fails:
        log(f"  Failures: {total_fails}")
    log(f"  Grimoire: {len(existing_urls)} total bookmarks")
    log("✅ Nightly sync complete")


if __name__ == "__main__":
    main()
