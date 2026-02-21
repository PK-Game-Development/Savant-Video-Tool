#!/usr/bin/env python3
"""
Baseball Savant Video Downloader - Web App

Self-contained web app that fetches, downloads, and optionally combines
Baseball Savant video clips. Works fully in-browser — no local install needed.

Locally:  python app.py
Deploy:   Docker / Render / Railway
"""

import csv
import io
import json
import logging
import os
import random
import re
import shutil
import subprocess
import tempfile
import threading
import time
import uuid
import zipfile
from collections import defaultdict
from datetime import datetime
from urllib.parse import urlparse, parse_qs, urlencode

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter
from flask import (
    Flask, render_template, request, jsonify, Response, send_file, abort,
)

app = Flask(__name__)

logger = logging.getLogger("savant_dl")
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
)

# --- Config ---
STATCAST_CSV_BASE = "https://baseballsavant.mlb.com/statcast_search/csv"
MLB_GAME_FEED_URL = "https://statsapi.mlb.com/api/v1.1/game/{game_pk}/feed/live"
VIDEO_CDN_URL = "https://fastball-clips.mlb.com/{game_pk}/{broadcast}/{play_id}.mp4"
SPORTY_VIDEO_URL = "https://baseballsavant.mlb.com/sporty-videos?playId={play_id}"
MLB_PLAYER_SEARCH_URL = "https://statsapi.mlb.com/api/v1/people/search?names={name}&hydrate=currentTeam,xrefId"
MLB_SCHEDULE_URL = "https://statsapi.mlb.com/api/v1/schedule?sportId=1&date={date}"

# Maps MLB Stats API gameType codes to Statcast hfGT filter values
_MLB_GAMETYPE_TO_HFGT = {
    "R": "R",    # Regular Season
    "S": "ST",   # Spring Training
    "F": "F",    # Wild Card
    "D": "D",    # Division Series
    "L": "L",    # League Championship Series
    "W": "W",    # World Series
    "P": "PO",   # Postseason (generic)
}

# MLB team ID -> Fangraphs depth chart slug (team nickname only)
FANGRAPHS_TEAM_SLUGS = {
    108: "angels",
    109: "diamondbacks",
    110: "orioles",
    111: "red-sox",
    112: "cubs",
    113: "reds",
    114: "guardians",
    115: "rockies",
    116: "tigers",
    117: "astros",
    118: "royals",
    119: "dodgers",
    120: "nationals",
    121: "mets",
    133: "athletics",
    134: "pirates",
    135: "padres",
    136: "mariners",
    137: "giants",
    138: "cardinals",
    139: "rays",
    140: "rangers",
    141: "blue-jays",
    142: "twins",
    143: "phillies",
    144: "braves",
    145: "white-sox",
    146: "marlins",
    147: "yankees",
    158: "brewers",
}

# Base temp directory for all jobs
WORK_DIR = os.path.join(tempfile.gettempdir(), "savant_jobs")
os.makedirs(WORK_DIR, exist_ok=True)

# How long to keep job files before cleanup (seconds)
JOB_TTL = 1800  # 30 minutes

# Active jobs: job_id -> job state dict
jobs = {}

# Player search cache: query -> (timestamp, results)
_player_cache = {}
_PLAYER_CACHE_TTL = 300  # 5 minutes

# Highlights cache: (timestamp, data)
_highlights_cache = (0, None)
_HIGHLIGHTS_CACHE_TTL = 600  # 10 minutes


# --- Helpers ---

def create_session():
    session = requests.Session()
    session.headers.update({
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/131.0.0.0 Safari/537.36"
        ),
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
        "Connection": "keep-alive",
    })
    retry_strategy = Retry(
        total=3,
        backoff_factor=0.5,
        status_forcelist=[502, 503, 504],
        allowed_methods=["GET"],
        raise_on_status=False,
    )
    adapter = HTTPAdapter(
        max_retries=retry_strategy,
        pool_connections=10,
        pool_maxsize=10,
    )
    session.mount("https://", adapter)
    session.mount("http://", adapter)
    return session


def build_csv_url(search_url):
    parsed = urlparse(search_url)
    params = parse_qs(parsed.query)
    params["all"] = ["true"]
    params["type"] = ["details"]
    query = urlencode(params, doseq=True)
    return f"{STATCAST_CSV_BASE}?{query}"


def fetch_search_results(search_url, session):
    csv_url = build_csv_url(search_url)
    resp = session.get(csv_url, timeout=120)
    resp.raise_for_status()
    text = resp.text.strip()
    if not text:
        return []
    reader = csv.DictReader(io.StringIO(text))
    return list(reader)


def fetch_game_play_ids(game_pk, session):
    url = MLB_GAME_FEED_URL.format(game_pk=game_pk)
    resp = session.get(url, timeout=30)
    resp.raise_for_status()
    data = resp.json()
    play_id_map = {}
    matchup_map = {}
    duration_map = {}
    all_plays = data.get("liveData", {}).get("plays", {}).get("allPlays", [])
    for play in all_plays:
        ab_number = play.get("atBatIndex", -1) + 1
        matchup = play.get("matchup", {})
        batter_name = matchup.get("batter", {}).get("fullName", "")
        pitcher_name = matchup.get("pitcher", {}).get("fullName", "")
        matchup_map[ab_number] = (batter_name, pitcher_name)
        for event in play.get("playEvents", []):
            play_id = event.get("playId", "")
            pitch_num = event.get("pitchNumber")
            if play_id and pitch_num is not None:
                play_id_map[(ab_number, pitch_num)] = play_id
                # Extract video duration from startTime/endTime
                start = event.get("startTime", "")
                end = event.get("endTime", "")
                if start and end:
                    try:
                        st = datetime.fromisoformat(start.replace("Z", "+00:00"))
                        et = datetime.fromisoformat(end.replace("Z", "+00:00"))
                        dur_secs = max(0, int((et - st).total_seconds()))
                        duration_map[(ab_number, pitch_num)] = dur_secs
                    except (ValueError, TypeError):
                        pass
    return play_id_map, matchup_map, duration_map


def sanitize_filename(name):
    return re.sub(r"[^\w\s\-.]", "", str(name)).strip().replace(" ", "_")


def build_filename(row):
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


def download_video_file(url, output_path, session):
    headers = {
        "Origin": "https://www.mlb.com",
        "Referer": "https://www.mlb.com/",
        "Accept": "video/mp4,video/*;q=0.9,*/*;q=0.8",
        "Sec-Fetch-Dest": "video",
        "Sec-Fetch-Mode": "no-cors",
        "Sec-Fetch-Site": "cross-site",
    }
    resp = session.get(url, stream=True, timeout=(10, 120), headers=headers)
    resp.raise_for_status()

    expected_size = resp.headers.get("Content-Length")
    bytes_written = 0
    with open(output_path, "wb") as f:
        for chunk in resp.iter_content(chunk_size=8192):
            f.write(chunk)
            bytes_written += len(chunk)

    if expected_size is not None:
        expected_size = int(expected_size)
        if bytes_written < expected_size:
            try:
                os.remove(output_path)
            except OSError:
                pass
            raise requests.ConnectionError(
                f"Incomplete download: got {bytes_written} of {expected_size} bytes"
            )

    if bytes_written == 0:
        try:
            os.remove(output_path)
        except OSError:
            pass
        raise requests.ConnectionError("Empty response body (0 bytes received)")

    logger.info("Downloaded %s (%d bytes)", os.path.basename(output_path), bytes_written)


def try_download(game_pk, play_id, broadcast, output_path, session):
    """Attempt to download a video clip, trying home/away then national broadcast.

    Nationally televised games (ESPN, FOX, TBS, etc.) are stored under the
    "national" broadcast slot on the CDN rather than home/away. This function
    tries the user's preferred angle first, then the opposite, then national.

    Returns dict: {"success": bool, "error": str|None, "status_code": int|None}
    """
    broadcasts = [broadcast, "away" if broadcast == "home" else "home", "national"]
    last_error = None
    last_status = None

    for bc in broadcasts:
        video_url = VIDEO_CDN_URL.format(game_pk=game_pk, broadcast=bc, play_id=play_id)
        try:
            download_video_file(video_url, output_path, session)
            return {"success": True, "error": None, "status_code": None}
        except requests.HTTPError as e:
            last_status = e.response.status_code if e.response is not None else None
            last_error = f"HTTP {last_status}" if last_status else str(e)
            logger.warning("HTTP error for %s/%s/%s: %s", game_pk, bc, play_id, last_error)
        except requests.Timeout:
            last_error = "Request timed out"
            last_status = None
            logger.warning("Timeout for %s/%s/%s", game_pk, bc, play_id)
        except requests.ConnectionError as e:
            last_error = f"Connection failed: {e}"
            last_status = None
            logger.warning("Connection error for %s/%s/%s: %s", game_pk, bc, play_id, e)
        except requests.RequestException as e:
            last_error = f"Download error: {type(e).__name__}"
            last_status = None
            logger.warning("Request error for %s/%s/%s: %s", game_pk, bc, play_id, last_error)
        except IOError as e:
            last_error = f"Disk write error: {e}"
            last_status = None
            logger.warning("Disk error for %s/%s/%s: %s", game_pk, bc, play_id, e)

    logger.error("All broadcasts failed for game_pk=%s play_id=%s: %s", game_pk, play_id, last_error)
    return {"success": False, "error": last_error, "status_code": last_status}


MAX_RETRIES = 3
RETRY_BACKOFF_BASE = 2  # delays: ~2s, ~4s, ~8s (plus jitter)


def _is_retryable(result):
    """Determine if a failed download should be retried."""
    if result["success"]:
        return False
    sc = result.get("status_code")
    err = result.get("error", "")
    if sc is not None and (sc >= 500 or sc == 429 or sc == 403 or sc == 404):
        return True
    if "timed out" in err.lower() or "connection" in err.lower():
        return True
    return False


def try_download_with_retry(game_pk, play_id, broadcast, output_path, session):
    """Download with retry and exponential backoff + jitter for transient errors."""
    result = try_download(game_pk, play_id, broadcast, output_path, session)
    if result["success"] or not _is_retryable(result):
        return result

    for attempt in range(1, MAX_RETRIES + 1):
        base_delay = RETRY_BACKOFF_BASE ** attempt
        jitter = random.uniform(0, base_delay * 0.5)
        delay = base_delay + jitter
        logger.warning(
            "Retry %d/%d for play_id=%s (reason: %s), waiting %.1fs",
            attempt, MAX_RETRIES, play_id, result.get("error", "unknown"), delay,
        )
        time.sleep(delay)

        if os.path.exists(output_path):
            try:
                os.remove(output_path)
            except OSError:
                pass
        result = try_download(game_pk, play_id, broadcast, output_path, session)
        if result["success"] or not _is_retryable(result):
            break

    return result



def get_job_dir(job_id):
    """Return the temp directory for a specific job."""
    return os.path.join(WORK_DIR, job_id)


def cleanup_old_jobs():
    """Remove job directories older than JOB_TTL."""
    now = time.time()
    try:
        for name in os.listdir(WORK_DIR):
            path = os.path.join(WORK_DIR, name)
            if os.path.isdir(path) and (now - os.path.getmtime(path)) > JOB_TTL:
                shutil.rmtree(path, ignore_errors=True)
                jobs.pop(name, None)
    except OSError:
        pass


# --- Routes ---

@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/player-search", methods=["POST"])
def api_player_search():
    """Search for MLB players by name and return player info."""
    data = request.get_json()
    name = data.get("name", "").strip()

    if not name or len(name) < 2:
        return jsonify({"error": "Please enter at least 2 characters."}), 400

    # Check cache first
    cache_key = name.lower()
    now = time.time()
    if cache_key in _player_cache:
        cached_time, cached_result = _player_cache[cache_key]
        if now - cached_time < _PLAYER_CACHE_TTL:
            return jsonify(cached_result)

    session = create_session()

    try:
        search_url = MLB_PLAYER_SEARCH_URL.format(name=requests.utils.quote(name))
        resp = session.get(search_url, timeout=15)
        resp.raise_for_status()
        api_data = resp.json()
    except Exception as e:
        return jsonify({"error": f"MLB API error: {e}"}), 500

    people = api_data.get("people", [])
    if not people:
        return jsonify({"error": f"No players found matching '{name}'."}), 404

    people = people[:10]

    results = []
    for player in people:
        mlb_id = player.get("id")
        full_name = player.get("fullName", "Unknown")
        primary_position = player.get("primaryPosition", {}).get("abbreviation", "")
        if primary_position == "TWP":
            primary_position = "2Way"
        active = player.get("active", False)

        current_team = player.get("currentTeam", {})
        team_id = current_team.get("id")
        team_name = current_team.get("name", "")

        # Extract birth date and calculate age
        birth_date_str = player.get("birthDate", "")
        age = None
        if birth_date_str:
            try:
                bd = datetime.strptime(birth_date_str, "%Y-%m-%d")
                today = datetime.now()
                age = today.year - bd.year - ((today.month, today.day) < (bd.month, bd.day))
            except ValueError:
                age = None

        headshot_url = (
            f"https://img.mlbstatic.com/mlb-photos/image/upload/"
            f"d_people:generic:headshot:67:current.png/"
            f"w_213,q_auto:best/v1/people/{mlb_id}/headshot/67/current"
        )

        # Extract Fangraphs ID from cross-reference IDs
        fg_id = None
        for xref in player.get("xrefIds", []):
            if xref.get("xrefType") == "fangraphs":
                fg_id = xref.get("xrefId")
                break

        # External links
        links = {
            "savant": f"https://baseballsavant.mlb.com/savant-player/{mlb_id}",
            "mlb": f"https://www.mlb.com/player/{mlb_id}",
            "bbref": f"https://www.baseball-reference.com/search/search.fcgi?search={requests.utils.quote(full_name)}",
        }

        if fg_id:
            name_slug = re.sub(r"[^a-z0-9-]", "", full_name.lower().replace(" ", "-"))
            links["fangraphs"] = f"https://www.fangraphs.com/players/{name_slug}/{fg_id}/stats"

        if team_id and team_id in FANGRAPHS_TEAM_SLUGS:
            slug = FANGRAPHS_TEAM_SLUGS[team_id]
            links["roster_resource"] = f"https://www.fangraphs.com/roster-resource/depth-charts/{slug}"

        results.append({
            "mlb_id": mlb_id,
            "name": full_name,
            "position": primary_position,
            "active": active,
            "team": team_name,
            "team_id": team_id,
            "age": age,
            "headshot_url": headshot_url,
            "links": links,
        })

    result = {"players": results}
    _player_cache[cache_key] = (time.time(), result)
    return jsonify(result)


@app.route("/api/search", methods=["POST"])
def api_search():
    """Fetch search results and resolve play IDs. Returns list of videos."""
    data = request.get_json()
    url = data.get("url", "").strip()
    max_results = data.get("max", 0)

    if "baseballsavant" not in url:
        return jsonify({"error": "URL must be from baseballsavant.mlb.com"}), 400

    session = create_session()

    try:
        rows = fetch_search_results(url, session)
    except Exception as e:
        return jsonify({"error": f"Failed to fetch search results: {e}"}), 500

    if not rows:
        return jsonify({"error": "No results found for that search."}), 404

    total_found = len(rows)
    if max_results > 0:
        rows = rows[:max_results]

    # Group by game and fetch play IDs
    games = defaultdict(list)
    for row in rows:
        gp = row.get("game_pk", "")
        if gp:
            games[gp].append(row)

    game_play_maps = {}
    game_matchup_maps = {}
    game_duration_maps = {}
    for game_pk in games:
        try:
            play_map, matchup_map, duration_map = fetch_game_play_ids(game_pk, session)
            game_play_maps[game_pk] = play_map
            game_matchup_maps[game_pk] = matchup_map
            game_duration_maps[game_pk] = duration_map
        except Exception:
            game_play_maps[game_pk] = {}
            game_matchup_maps[game_pk] = {}
            game_duration_maps[game_pk] = {}
        time.sleep(0.2)

    # Resolve play IDs
    videos = []
    for row in rows:
        game_pk = row.get("game_pk", "")
        try:
            ab_num = int(row.get("at_bat_number", 0))
            pitch_num = int(row.get("pitch_number", 0))
        except (ValueError, TypeError):
            continue

        play_id = game_play_maps.get(game_pk, {}).get((ab_num, pitch_num))
        if not play_id:
            continue

        filename = build_filename(row)

        # Determine opposing team from inning_topbot
        home = row.get("home_team", "")
        away = row.get("away_team", "")
        topbot = row.get("inning_topbot", "")
        if topbot == "Top":
            batting_team = away
            pitching_team = home
        elif topbot == "Bot":
            batting_team = home
            pitching_team = away
        else:
            batting_team = ""
            pitching_team = ""

        # Get batter/pitcher names from game feed matchup data
        matchup = game_matchup_maps.get(game_pk, {}).get(ab_num, ("", ""))
        batter_name = matchup[0]
        pitcher_name = matchup[1]

        # Get video duration from game feed timing data
        dur_secs = game_duration_maps.get(game_pk, {}).get((ab_num, pitch_num))
        if dur_secs is not None:
            duration_str = f"{dur_secs // 60}:{dur_secs % 60:02d}"
        else:
            duration_str = ""

        videos.append({
            "player": row.get("player_name", "Unknown"),
            "date": row.get("game_date", ""),
            "event": row.get("events", ""),
            "description": row.get("des", ""),
            "pitch_type": row.get("pitch_type", ""),
            "release_speed": row.get("release_speed", ""),
            "launch_speed": row.get("launch_speed", ""),
            "launch_angle": row.get("launch_angle", ""),
            "batting_team": batting_team,
            "pitching_team": pitching_team,
            "batter_name": batter_name,
            "pitcher_name": pitcher_name,
            "duration": duration_str,
            "game_pk": game_pk,
            "play_id": play_id,
            "filename": filename,
            "savant_url": SPORTY_VIDEO_URL.format(play_id=play_id),
        })

    # Detect player_type from URL
    player_type = "batter"
    if "player_type=pitcher" in url:
        player_type = "pitcher"

    return jsonify({
        "total_pitches": total_found,
        "videos_resolved": len(videos),
        "games": len(games),
        "player_type": player_type,
        "videos": videos,
    })


def _find_most_recent_game_date(session):
    """Walk backwards from today to find the most recent date with Final MLB games.

    Returns a tuple (date_str, hf_game_type) where hf_game_type is the Statcast
    hfGT filter value (e.g. "R" for regular season, "ST" for spring training).
    Returns (None, None) if no recent games are found.
    """
    from datetime import timedelta
    today = datetime.now()
    for days_back in range(0, 14):
        check = today - timedelta(days=days_back)
        date_str = check.strftime("%Y-%m-%d")
        try:
            resp = session.get(MLB_SCHEDULE_URL.format(date=date_str), timeout=15)
            resp.raise_for_status()
            data = resp.json()
            dates = data.get("dates", [])
            if dates:
                games = dates[0].get("games", [])
                final_games = [g for g in games if g.get("status", {}).get("abstractGameState") == "Final"]
                if final_games:
                    mlb_type = final_games[0].get("gameType", "R")
                    hf_type = _MLB_GAMETYPE_TO_HFGT.get(mlb_type, "R")
                    return date_str, hf_type
        except Exception:
            continue
    return None, None


@app.route("/api/highlights", methods=["GET"])
def api_highlights():
    """Return top plays from the most recent MLB day, sorted by Win Probability Added."""
    global _highlights_cache

    # Serve from cache if fresh
    cache_ts, cache_data = _highlights_cache
    if cache_data is not None and (time.time() - cache_ts) < _HIGHLIGHTS_CACHE_TTL:
        return jsonify(cache_data)

    session = create_session()

    game_date, hf_game_type = _find_most_recent_game_date(session)
    if not game_date:
        return jsonify({"error": "No recent MLB games found."}), 404

    # Build Statcast CSV URL for that date — fetch all pitches with events (plate appearance results)
    csv_params = urlencode({
        "all": "true",
        "type": "details",
        "hfGT": f"{hf_game_type}|",
        "game_date_gt": game_date,
        "game_date_lt": game_date,
        "sortColumn": "delta_run_exp",
        "sortOrder": "desc",
        "player_type": "batter",
        "min_results": "0",
    }, doseq=True)
    csv_url = f"{STATCAST_CSV_BASE}?{csv_params}"

    try:
        resp = session.get(csv_url, timeout=120)
        resp.raise_for_status()
        text = resp.text.strip()
        if not text:
            return jsonify({"error": "No Statcast data for this date yet."}), 404
        reader = csv.DictReader(io.StringIO(text))
        rows = list(reader)
    except Exception as e:
        return jsonify({"error": f"Failed to fetch highlights: {e}"}), 500

    if not rows:
        return jsonify({"error": "No Statcast data for this date yet."}), 404

    # Filter to only rows that have a plate appearance result (events field) and WPA
    pa_rows = []
    for row in rows:
        event = row.get("events", "").strip()
        wpa_str = row.get("delta_run_exp", "").strip()
        if event and wpa_str:
            try:
                row["_wpa"] = float(wpa_str)
            except ValueError:
                continue
            pa_rows.append(row)

    # Sort by absolute WPA descending and take top 15
    pa_rows.sort(key=lambda r: abs(r["_wpa"]), reverse=True)
    pa_rows = pa_rows[:15]

    # Resolve play IDs (same flow as /api/search)
    games = defaultdict(list)
    for row in pa_rows:
        gp = row.get("game_pk", "")
        if gp:
            games[gp].append(row)

    game_play_maps = {}
    game_matchup_maps = {}
    game_duration_maps = {}
    for game_pk in games:
        try:
            play_map, matchup_map, duration_map = fetch_game_play_ids(game_pk, session)
            game_play_maps[game_pk] = play_map
            game_matchup_maps[game_pk] = matchup_map
            game_duration_maps[game_pk] = duration_map
        except Exception:
            game_play_maps[game_pk] = {}
            game_matchup_maps[game_pk] = {}
            game_duration_maps[game_pk] = {}
        time.sleep(0.2)

    videos = []
    for row in pa_rows:
        game_pk = row.get("game_pk", "")
        try:
            ab_num = int(row.get("at_bat_number", 0))
            pitch_num = int(row.get("pitch_number", 0))
        except (ValueError, TypeError):
            continue

        play_id = game_play_maps.get(game_pk, {}).get((ab_num, pitch_num))
        if not play_id:
            continue

        home = row.get("home_team", "")
        away = row.get("away_team", "")
        topbot = row.get("inning_topbot", "")
        if topbot == "Top":
            batting_team = away
            pitching_team = home
        elif topbot == "Bot":
            batting_team = home
            pitching_team = away
        else:
            batting_team = ""
            pitching_team = ""

        matchup = game_matchup_maps.get(game_pk, {}).get(ab_num, ("", ""))
        batter_name = matchup[0]
        pitcher_name = matchup[1]

        dur_secs = game_duration_maps.get(game_pk, {}).get((ab_num, pitch_num))
        if dur_secs is not None:
            duration_str = f"{dur_secs // 60}:{dur_secs % 60:02d}"
        else:
            duration_str = ""

        wpa = row.get("_wpa", 0)
        wpa_display = f"+{wpa:.2f}" if wpa >= 0 else f"{wpa:.2f}"

        videos.append({
            "player": row.get("player_name", "Unknown"),
            "date": row.get("game_date", ""),
            "event": row.get("events", ""),
            "description": row.get("des", ""),
            "pitch_type": row.get("pitch_type", ""),
            "release_speed": row.get("release_speed", ""),
            "launch_speed": row.get("launch_speed", ""),
            "launch_angle": row.get("launch_angle", ""),
            "batting_team": batting_team,
            "pitching_team": pitching_team,
            "batter_name": batter_name,
            "pitcher_name": pitcher_name,
            "duration": duration_str,
            "wpa": wpa_display,
            "game_pk": game_pk,
            "play_id": play_id,
            "filename": build_filename(row),
            "savant_url": SPORTY_VIDEO_URL.format(play_id=play_id),
        })

    result = {
        "game_date": game_date,
        "game_type": hf_game_type,
        "videos": videos,
    }
    _highlights_cache = (time.time(), result)
    return jsonify(result)


@app.route("/api/download", methods=["POST"])
def api_download():
    """Start a download job. Downloads videos to a server temp directory."""
    data = request.get_json()
    videos = data.get("videos", [])
    broadcast = data.get("broadcast", "home")

    if not videos:
        return jsonify({"error": "No videos selected"}), 400

    # Cleanup old jobs opportunistically
    cleanup_old_jobs()

    job_id = str(uuid.uuid4())[:8]
    job_dir = get_job_dir(job_id)
    os.makedirs(job_dir, exist_ok=True)

    jobs[job_id] = {
        "status": "running",
        "phase": "downloading",
        "total": len(videos),
        "completed": 0,
        "failed": 0,
        "current": "",
        "results": [],
        "download_ready": False,
        "download_file": None,
        "job_dir": job_dir,
    }

    def run_job():
        session = create_session()
        job = jobs[job_id]
        downloaded_paths = []
        download_delay = 1.0  # base delay between downloads (seconds)
        consecutive_failures = 0
        logger.info("Job %s started: %d videos, broadcast=%s", job_id, len(videos), broadcast)

        try:
            # Phase 1: Download all videos
            for idx, video in enumerate(videos):
                game_pk = video["game_pk"]
                play_id = video["play_id"]
                filename = video["filename"]
                output_path = os.path.join(job_dir, filename)

                job["current"] = f"{video.get('player', '')} - {video.get('date', '')}"

                try:
                    result = try_download_with_retry(
                        game_pk, play_id, broadcast, output_path, session
                    )
                except Exception as e:
                    result = {
                        "success": False,
                        "error": f"Unexpected: {type(e).__name__}: {e}",
                        "status_code": None,
                    }

                if result["success"]:
                    job["completed"] += 1
                    job["results"].append({"filename": filename, "status": "ok"})
                    downloaded_paths.append(output_path)
                    consecutive_failures = 0
                    # Gradually recover delay after successes
                    if download_delay > 1.0:
                        download_delay = max(1.0, download_delay * 0.8)
                else:
                    job["failed"] += 1
                    entry = {"filename": filename, "status": "failed"}
                    if result.get("error"):
                        entry["error"] = result["error"]
                    job["results"].append(entry)
                    logger.warning("Job %s: FAILED %s - %s", job_id, filename, result.get("error"))
                    if os.path.exists(output_path):
                        try:
                            os.remove(output_path)
                        except OSError:
                            pass

                    # Adaptive throttling: slow down when failures pile up
                    consecutive_failures += 1
                    if consecutive_failures >= 2:
                        download_delay = min(5.0, download_delay * 1.5)
                        logger.info(
                            "Job %s: %d consecutive failures, increasing delay to %.1fs",
                            job_id, consecutive_failures, download_delay,
                        )
                    # Recreate session after 3+ consecutive failures (stale connection)
                    if consecutive_failures >= 3:
                        logger.info("Job %s: recreating session after %d failures", job_id, consecutive_failures)
                        session = create_session()

                if idx < len(videos) - 1:
                    time.sleep(download_delay)

            # Phase 2: Zip all individual files
            if downloaded_paths:
                job["phase"] = "zipping"
                job["current"] = "Packaging files..."
                try:
                    zip_path = os.path.join(job_dir, "savant_videos.zip")
                    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_STORED) as zf:
                        for path in downloaded_paths:
                            zf.write(path, os.path.basename(path))
                    job["download_file"] = "savant_videos.zip"
                    job["download_ready"] = True
                except Exception as e:
                    job["results"].append({
                        "filename": "savant_videos.zip",
                        "status": "failed",
                        "error": str(e),
                    })

        except Exception:
            pass  # individual errors already handled above

        finally:
            job["phase"] = "done"
            job["status"] = "done"
            job["current"] = ""
            logger.info(
                "Job %s complete: %d/%d succeeded, %d failed",
                job_id, job["completed"], len(videos), job["failed"],
            )

    thread = threading.Thread(target=run_job, daemon=True)
    thread.start()

    return jsonify({"job_id": job_id})


@app.route("/api/status/<job_id>")
def api_status(job_id):
    """Get the current status of a job."""
    job = jobs.get(job_id)
    if not job:
        return jsonify({"error": "Job not found"}), 404
    # Don't leak internal paths to the client
    safe = {k: v for k, v in job.items() if k != "job_dir"}
    return jsonify(safe)


@app.route("/api/progress/<job_id>")
def api_progress(job_id):
    """Server-Sent Events stream for real-time progress."""
    def generate():
        while True:
            job = jobs.get(job_id)
            if not job:
                yield f"data: {json.dumps({'error': 'Job not found'})}\n\n"
                break
            safe = {k: v for k, v in job.items() if k != "job_dir"}
            yield f"data: {json.dumps(safe)}\n\n"
            if job["status"] == "done":
                break
            time.sleep(0.5)

    return Response(generate(), mimetype="text/event-stream")


@app.route("/api/download-file/<job_id>")
def api_download_file(job_id):
    """Download the final zip file for a completed job."""
    job = jobs.get(job_id)
    job_dir = get_job_dir(job_id)

    if job and job.get("download_ready"):
        filename = job["download_file"]
    else:
        # Fallback: look for the expected output file on disk
        if not os.path.isdir(job_dir):
            abort(404)
        zip_name = "savant_videos.zip"
        if os.path.exists(os.path.join(job_dir, zip_name)):
            filename = zip_name
        else:
            abort(404)

    file_path = os.path.join(job_dir, filename)
    if not os.path.exists(file_path):
        abort(404)

    return send_file(
        file_path,
        as_attachment=True,
        download_name=filename,
    )


@app.route("/api/job/<job_id>", methods=["DELETE"])
def api_cleanup_job(job_id):
    """Delete a job's temp files and free memory."""
    job_dir = get_job_dir(job_id)
    if os.path.isdir(job_dir):
        shutil.rmtree(job_dir, ignore_errors=True)
    jobs.pop(job_id, None)
    return jsonify({"ok": True})


@app.route("/api/game-log", methods=["POST"])
def api_game_log():
    """Fetch a player's game log from the MLB Stats API."""
    data = request.get_json()
    mlb_id = data.get("mlb_id")
    season = data.get("season")
    group = data.get("group", "hitting")  # "hitting" or "pitching"

    if not mlb_id or not season:
        return jsonify({"error": "mlb_id and season are required"}), 400

    if group not in ("hitting", "pitching"):
        return jsonify({"error": "group must be 'hitting' or 'pitching'"}), 400

    session = create_session()
    api_url = (
        f"https://statsapi.mlb.com/api/v1/people/{mlb_id}/stats"
        f"?stats=gameLog&season={season}&group={group}"
    )

    try:
        resp = session.get(api_url, timeout=15)
        resp.raise_for_status()
        api_data = resp.json()
    except Exception as e:
        return jsonify({"error": f"MLB API error: {e}"}), 500

    stats_list = api_data.get("stats", [])
    if not stats_list:
        return jsonify({"games": []})

    splits = stats_list[0].get("splits", [])
    games = []
    for split in splits:
        stat = split.get("stat", {})
        opponent = split.get("opponent", {}).get("name", "")
        game_date = split.get("date", "")
        is_home = split.get("isHome", False)

        game = {
            "date": game_date,
            "opponent": opponent,
            "home": is_home,
        }

        if group == "hitting":
            game.update({
                "ab": stat.get("atBats", 0),
                "r": stat.get("runs", 0),
                "h": stat.get("hits", 0),
                "doubles": stat.get("doubles", 0),
                "triples": stat.get("triples", 0),
                "hr": stat.get("homeRuns", 0),
                "rbi": stat.get("rbi", 0),
                "bb": stat.get("baseOnBalls", 0),
                "so": stat.get("strikeOuts", 0),
                "sb": stat.get("stolenBases", 0),
                "avg": stat.get("avg", ""),
                "ops": stat.get("ops", ""),
            })
        else:
            game.update({
                "ip": stat.get("inningsPitched", ""),
                "h": stat.get("hits", 0),
                "r": stat.get("runs", 0),
                "er": stat.get("earnedRuns", 0),
                "bb": stat.get("baseOnBalls", 0),
                "so": stat.get("strikeOuts", 0),
                "hr": stat.get("homeRuns", 0),
                "era": stat.get("era", ""),
                "pitches": stat.get("numberOfPitches", 0),
                "strikes": stat.get("strikes", 0),
                "decision": stat.get("note", ""),
            })

        games.append(game)

    return jsonify({"games": games, "group": group})


@app.route("/api/game-log/export", methods=["POST"])
def api_game_log_export():
    """Export game log data as an XLSX file."""
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "Invalid request"}), 400

    games = data.get("games", [])
    group = data.get("group", "hitting")
    player_name = str(data.get("player_name", "Player"))
    season = str(data.get("season", ""))

    try:
        return _build_game_log_xlsx(games, group, player_name, season)
    except Exception as e:
        return jsonify({"error": f"Export failed: {e}"}), 500


def _build_game_log_xlsx(games, group, player_name, season):
    wb = Workbook()
    ws = wb.active
    ws.title = f"{season} Game Log"

    # Header style
    header_font = Font(bold=True, color="FFFFFF", size=11)
    header_fill = PatternFill(start_color="1A2844", end_color="1A2844", fill_type="solid")
    header_align = Alignment(horizontal="center")
    thin_border = Border(
        bottom=Side(style="thin", color="CCCCCC"),
    )

    # Title row
    title_font = Font(bold=True, size=13, color="0B1026")
    title_fill = PatternFill(start_color="F5C842", end_color="F5C842", fill_type="solid")

    if group == "hitting":
        headers = ["Date", "Opp", "AB", "R", "H", "2B", "3B", "HR", "RBI", "BB", "SO", "SB", "AVG", "OPS"]
    else:
        headers = ["Date", "Opp", "Dec", "IP", "H", "R", "ER", "BB", "SO", "HR", "P", "S", "ERA"]

    # Title
    ws.merge_cells(start_row=1, start_column=1, end_row=1, end_column=len(headers))
    title_cell = ws.cell(row=1, column=1, value=f"{player_name} - {season} {'Batting' if group == 'hitting' else 'Pitching'} Game Log")
    title_cell.font = title_font
    title_cell.fill = title_fill
    title_cell.alignment = Alignment(horizontal="center")

    # Headers
    for col_idx, h in enumerate(headers, 1):
        cell = ws.cell(row=2, column=col_idx, value=h)
        cell.font = header_font
        cell.fill = header_fill
        cell.alignment = header_align

    # Data rows
    for row_idx, g in enumerate(games, 3):
        prefix = "vs " if g.get("home") else "@ "
        opp = prefix + g.get("opponent", "")

        if group == "hitting":
            row_data = [
                g.get("date", ""), opp,
                g.get("ab", 0), g.get("r", 0), g.get("h", 0),
                g.get("doubles", 0), g.get("triples", 0), g.get("hr", 0),
                g.get("rbi", 0), g.get("bb", 0), g.get("so", 0),
                g.get("sb", 0), g.get("avg", ""), g.get("ops", ""),
            ]
        else:
            row_data = [
                g.get("date", ""), opp, g.get("decision", ""),
                g.get("ip", ""), g.get("h", 0), g.get("r", 0),
                g.get("er", 0), g.get("bb", 0), g.get("so", 0),
                g.get("hr", 0), g.get("pitches", 0), g.get("strikes", 0),
                g.get("era", ""),
            ]

        for col_idx, val in enumerate(row_data, 1):
            cell = ws.cell(row=row_idx, column=col_idx, value=val)
            cell.border = thin_border
            if col_idx > 2:
                cell.alignment = Alignment(horizontal="center")

    # Auto-width columns
    for col_idx in range(1, len(headers) + 1):
        max_len = len(str(headers[col_idx - 1]))
        for row in ws.iter_rows(min_row=3, min_col=col_idx, max_col=col_idx):
            for cell in row:
                if cell.value is not None:
                    max_len = max(max_len, len(str(cell.value)))
        ws.column_dimensions[get_column_letter(col_idx)].width = max_len + 3

    # Write to buffer
    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)

    safe_name = re.sub(r"[^a-zA-Z0-9_\- ]", "", player_name).strip().replace(" ", "_")
    filename = f"{safe_name}_{season}_{'batting' if group == 'hitting' else 'pitching'}_game_log.xlsx"

    return send_file(
        buf,
        as_attachment=True,
        download_name=filename,
        mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(debug=True, host="0.0.0.0", port=port)
