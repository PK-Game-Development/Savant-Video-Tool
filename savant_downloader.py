#!/usr/bin/env python3
"""
Baseball Savant Video Downloader

Downloads all videos from a Baseball Savant Statcast Search results page.

How it works:
  1. Fetches the search results CSV from Baseball Savant
  2. Queries the MLB Stats API to get video play IDs for each pitch
  3. Downloads the video clips from MLB's CDN

Usage:
    python savant_downloader.py "<baseball_savant_search_url>"
    python savant_downloader.py "<url>" -o my_videos --broadcast away
    python savant_downloader.py "<url>" --max 10 --list
"""

import argparse
import csv
import io
import os
import re
import sys
import time
from collections import defaultdict
from urllib.parse import urlparse, parse_qs, urlencode

import requests

STATCAST_CSV_BASE = "https://baseballsavant.mlb.com/statcast_search/csv"
MLB_GAME_FEED_URL = "https://statsapi.mlb.com/api/v1.1/game/{game_pk}/feed/live"
VIDEO_CDN_URL = "https://fastball-clips.mlb.com/{game_pk}/{broadcast}/{play_id}.mp4"
SPORTY_VIDEO_URL = "https://baseballsavant.mlb.com/sporty-videos?playId={play_id}"


def create_session():
    """Create a requests session with browser-like headers."""
    session = requests.Session()
    session.headers.update({
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/120.0.0.0 Safari/537.36"
        ),
    })
    return session


def build_csv_url(search_url):
    """Convert a Baseball Savant Statcast search URL to its CSV endpoint."""
    parsed = urlparse(search_url)
    params = parse_qs(parsed.query)
    params["all"] = ["true"]
    params["type"] = ["details"]
    query = urlencode(params, doseq=True)
    return f"{STATCAST_CSV_BASE}?{query}"


def fetch_search_results(search_url, session):
    """Fetch Statcast search results as a list of dicts (one per pitch)."""
    csv_url = build_csv_url(search_url)
    print("Fetching search results from Baseball Savant...")

    resp = session.get(csv_url, timeout=120)
    resp.raise_for_status()

    text = resp.text.strip()
    if not text:
        return []

    reader = csv.DictReader(io.StringIO(text))
    return list(reader)


def fetch_game_play_ids(game_pk, session):
    """
    Fetch play IDs from the MLB Stats API for a given game.

    Returns dict mapping (at_bat_number, pitch_number) -> play_id.
    at_bat_number is 1-based to match the Statcast CSV format.
    """
    url = MLB_GAME_FEED_URL.format(game_pk=game_pk)
    resp = session.get(url, timeout=30)
    resp.raise_for_status()
    data = resp.json()

    play_id_map = {}
    all_plays = data.get("liveData", {}).get("plays", {}).get("allPlays", [])

    for play in all_plays:
        # atBatIndex is 0-based in the API; CSV at_bat_number is 1-based
        ab_number = play.get("atBatIndex", -1) + 1

        for event in play.get("playEvents", []):
            play_id = event.get("playId", "")
            pitch_num = event.get("pitchNumber")
            if play_id and pitch_num is not None:
                play_id_map[(ab_number, pitch_num)] = play_id

    return play_id_map


def sanitize_filename(name):
    """Remove characters that aren't safe for filenames."""
    return re.sub(r"[^\w\s\-.]", "", str(name)).strip().replace(" ", "_")


def build_filename(row, index):
    """Build a descriptive filename from CSV row data."""
    date = row.get("game_date", "").replace("-", "")
    player = sanitize_filename(row.get("player_name", "unknown"))
    events = sanitize_filename(row.get("events", ""))
    ab = row.get("at_bat_number", "")
    pitch = row.get("pitch_number", "")

    parts = [date, player]
    if events:
        parts.append(events)
    parts.append(f"ab{ab}_p{pitch}")
    return "_".join(filter(None, parts)) + ".mp4"


def download_video(url, output_path, session):
    """Download a video file with a progress bar."""
    headers = {
        "Origin": "https://www.mlb.com",
        "Referer": "https://www.mlb.com/",
    }

    resp = session.get(url, stream=True, timeout=120, headers=headers)
    resp.raise_for_status()

    total = int(resp.headers.get("content-length", 0))
    downloaded = 0

    with open(output_path, "wb") as f:
        for chunk in resp.iter_content(chunk_size=8192):
            f.write(chunk)
            downloaded += len(chunk)
            if total:
                pct = (downloaded / total) * 100
                filled = int(30 * downloaded / total)
                bar = "#" * filled + "-" * (30 - filled)
                mb_down = downloaded / (1024 * 1024)
                mb_total = total / (1024 * 1024)
                print(
                    f"\r  [{bar}] {pct:.1f}% ({mb_down:.1f}/{mb_total:.1f} MB)",
                    end="",
                    flush=True,
                )

    if total:
        print()

    return True


def try_download_video(game_pk, play_id, broadcast, output_path, session):
    """
    Try downloading a video, falling back to the other broadcast angle.
    Returns True on success, False on failure.
    """
    broadcasts = [broadcast, "away" if broadcast == "home" else "home"]

    for bc in broadcasts:
        video_url = VIDEO_CDN_URL.format(
            game_pk=game_pk, broadcast=bc, play_id=play_id
        )
        try:
            download_video(video_url, output_path, session)
            return True
        except requests.HTTPError:
            continue
        except requests.ConnectionError:
            continue

    return False


def main():
    parser = argparse.ArgumentParser(
        description="Download videos from a Baseball Savant Statcast search page.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=(
            "Examples:\n"
            '  python savant_downloader.py "https://baseballsavant.mlb.com/statcast_search?..."\n'
            '  python savant_downloader.py "https://baseballsavant.mlb.com/statcast_search?..." -o homers\n'
            '  python savant_downloader.py "https://baseballsavant.mlb.com/statcast_search?..." --max 5\n'
            '  python savant_downloader.py "https://baseballsavant.mlb.com/statcast_search?..." --list\n'
        ),
    )
    parser.add_argument("url", help="Baseball Savant Statcast search URL")
    parser.add_argument(
        "-o", "--output", default=os.path.join(os.path.expanduser("~"), "Downloads"), help="Output directory (default: ~/Downloads)"
    )
    parser.add_argument(
        "--broadcast",
        choices=["home", "away"],
        default="home",
        help="Preferred broadcast angle (default: home)",
    )
    parser.add_argument(
        "--delay",
        type=float,
        default=0.5,
        help="Delay between video downloads in seconds (default: 0.5)",
    )
    parser.add_argument(
        "--max",
        type=int,
        default=0,
        help="Max number of videos to download, 0 for all (default: 0)",
    )
    parser.add_argument(
        "--list",
        action="store_true",
        help="List video URLs without downloading",
    )

    args = parser.parse_args()

    if "baseballsavant" not in args.url:
        print("Error: URL must be from baseballsavant.mlb.com")
        sys.exit(1)

    session = create_session()

    # --- Step 1: Fetch search results CSV ---
    rows = fetch_search_results(args.url, session)
    if not rows:
        print("No results found in the search.")
        sys.exit(0)

    print(f"Found {len(rows)} pitches in search results")

    if args.max > 0:
        rows = rows[: args.max]
        print(f"Limiting to first {args.max}")

    # --- Step 2: Group by game and fetch play IDs ---
    games = defaultdict(list)
    for row in rows:
        gp = row.get("game_pk", "")
        if gp:
            games[gp].append(row)

    print(f"Across {len(games)} games\n")
    print("Fetching play IDs from MLB Stats API...")

    game_play_maps = {}
    for i, game_pk in enumerate(games, 1):
        try:
            play_map = fetch_game_play_ids(game_pk, session)
            game_play_maps[game_pk] = play_map
            print(f"  [{i}/{len(games)}] Game {game_pk}: {len(play_map)} pitch events")
        except Exception as e:
            print(f"  [{i}/{len(games)}] Game {game_pk}: failed ({e})")
            game_play_maps[game_pk] = {}
        time.sleep(0.3)

    # --- Step 3: Resolve play IDs for each search result ---
    resolved = []
    unresolved = 0

    for idx, row in enumerate(rows):
        game_pk = row.get("game_pk", "")
        try:
            ab_num = int(row.get("at_bat_number", 0))
            pitch_num = int(row.get("pitch_number", 0))
        except (ValueError, TypeError):
            unresolved += 1
            continue

        play_id = game_play_maps.get(game_pk, {}).get((ab_num, pitch_num))
        if play_id:
            resolved.append((row, game_pk, play_id))
        else:
            unresolved += 1

    print(f"\nResolved {len(resolved)} videos, {unresolved} could not be matched")

    if not resolved:
        print("No videos to download.")
        sys.exit(0)

    # --- List mode ---
    if args.list:
        print(f"\nVideo URLs ({args.broadcast} broadcast):\n")
        for row, game_pk, play_id in resolved:
            cdn_url = VIDEO_CDN_URL.format(
                game_pk=game_pk, broadcast=args.broadcast, play_id=play_id
            )
            sporty_url = SPORTY_VIDEO_URL.format(play_id=play_id)
            player = row.get("player_name", "unknown")
            date = row.get("game_date", "")
            events = row.get("events", "")
            label = f"{player} - {date}"
            if events:
                label += f" - {events}"
            print(f"{label}")
            print(f"  CDN:    {cdn_url}")
            print(f"  Savant: {sporty_url}")
            print()
        sys.exit(0)

    # --- Step 4: Download videos ---
    os.makedirs(args.output, exist_ok=True)
    print(f"\nDownloading {len(resolved)} videos to {os.path.abspath(args.output)}/\n")

    downloaded = 0
    skipped = 0
    failed = 0

    for i, (row, game_pk, play_id) in enumerate(resolved, 1):
        filename = build_filename(row, i)
        output_path = os.path.join(args.output, filename)

        player = row.get("player_name", "unknown")
        date = row.get("game_date", "")
        events = row.get("events", "")
        label = f"{player} - {date}"
        if events:
            label += f" - {events}"

        print(f"[{i}/{len(resolved)}] {label}")

        success = try_download_video(
            game_pk, play_id, args.broadcast, output_path, session
        )

        if success:
            downloaded += 1
            print(f"  -> {filename}")
        else:
            failed += 1
            print(f"  FAILED - no video available")
            if os.path.exists(output_path):
                os.remove(output_path)

        time.sleep(args.delay)

    # --- Summary ---
    print(f"\n{'=' * 50}")
    print(f"  Downloaded:  {downloaded}")
    print(f"  Skipped:     {skipped}")
    print(f"  Failed:      {failed}")
    print(f"  Total:       {len(resolved)}")
    print(f"{'=' * 50}")
    print(f"Videos saved to: {os.path.abspath(args.output)}/")


if __name__ == "__main__":
    main()
