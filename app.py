#!/usr/bin/env python3
"""
Baseball Savant Video Downloader - Web App

Flask web interface for downloading videos from Baseball Savant search pages.
Run with: python app.py
Then open http://localhost:5000 in your browser.
"""

import csv
import io
import json
import os
import re
import threading
import time
import uuid
from collections import defaultdict
from urllib.parse import urlparse, parse_qs, urlencode

import requests
from flask import Flask, render_template, request, jsonify, Response, send_from_directory

app = Flask(__name__)

# --- Config ---
DOWNLOAD_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "videos")
STATCAST_CSV_BASE = "https://baseballsavant.mlb.com/statcast_search/csv"
MLB_GAME_FEED_URL = "https://statsapi.mlb.com/api/v1.1/game/{game_pk}/feed/live"
VIDEO_CDN_URL = "https://fastball-clips.mlb.com/{game_pk}/{broadcast}/{play_id}.mp4"
SPORTY_VIDEO_URL = "https://baseballsavant.mlb.com/sporty-videos?playId={play_id}"

# Active download jobs: job_id -> job state dict
jobs = {}


def create_session():
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
    all_plays = data.get("liveData", {}).get("plays", {}).get("allPlays", [])
    for play in all_plays:
        ab_number = play.get("atBatIndex", -1) + 1
        for event in play.get("playEvents", []):
            play_id = event.get("playId", "")
            pitch_num = event.get("pitchNumber")
            if play_id and pitch_num is not None:
                play_id_map[(ab_number, pitch_num)] = play_id
    return play_id_map


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
    }
    resp = session.get(url, stream=True, timeout=120, headers=headers)
    resp.raise_for_status()
    total = int(resp.headers.get("content-length", 0))
    downloaded = 0
    with open(output_path, "wb") as f:
        for chunk in resp.iter_content(chunk_size=8192):
            f.write(chunk)
            downloaded += len(chunk)
    return total


def try_download(game_pk, play_id, broadcast, output_path, session):
    broadcasts = [broadcast, "away" if broadcast == "home" else "home"]
    for bc in broadcasts:
        video_url = VIDEO_CDN_URL.format(game_pk=game_pk, broadcast=bc, play_id=play_id)
        try:
            download_video_file(video_url, output_path, session)
            return True
        except (requests.HTTPError, requests.ConnectionError):
            continue
    return False


# ---- Routes ----

@app.route("/")
def index():
    return render_template("index.html")


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
    for game_pk in games:
        try:
            game_play_maps[game_pk] = fetch_game_play_ids(game_pk, session)
        except Exception:
            game_play_maps[game_pk] = {}
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
        already_downloaded = os.path.exists(os.path.join(DOWNLOAD_DIR, filename))

        videos.append({
            "player": row.get("player_name", "Unknown"),
            "date": row.get("game_date", ""),
            "event": row.get("events", ""),
            "description": row.get("des", ""),
            "pitch_type": row.get("pitch_type", ""),
            "release_speed": row.get("release_speed", ""),
            "launch_speed": row.get("launch_speed", ""),
            "launch_angle": row.get("launch_angle", ""),
            "game_pk": game_pk,
            "play_id": play_id,
            "filename": filename,
            "downloaded": already_downloaded,
            "savant_url": SPORTY_VIDEO_URL.format(play_id=play_id),
        })

    return jsonify({
        "total_pitches": total_found,
        "videos_resolved": len(videos),
        "games": len(games),
        "videos": videos,
    })


@app.route("/api/download", methods=["POST"])
def api_download():
    """Start a download job for selected videos. Returns a job ID for progress tracking."""
    data = request.get_json()
    videos = data.get("videos", [])
    broadcast = data.get("broadcast", "home")

    if not videos:
        return jsonify({"error": "No videos selected"}), 400

    job_id = str(uuid.uuid4())[:8]
    jobs[job_id] = {
        "status": "running",
        "total": len(videos),
        "completed": 0,
        "failed": 0,
        "current": "",
        "results": [],
    }

    def run_downloads():
        os.makedirs(DOWNLOAD_DIR, exist_ok=True)
        session = create_session()
        job = jobs[job_id]

        for video in videos:
            game_pk = video["game_pk"]
            play_id = video["play_id"]
            filename = video["filename"]
            output_path = os.path.join(DOWNLOAD_DIR, filename)

            job["current"] = f"{video.get('player', '')} - {video.get('date', '')}"

            if os.path.exists(output_path):
                job["completed"] += 1
                job["results"].append({"filename": filename, "status": "skipped"})
                continue

            success = try_download(game_pk, play_id, broadcast, output_path, session)

            if success:
                job["completed"] += 1
                job["results"].append({"filename": filename, "status": "ok"})
            else:
                job["failed"] += 1
                job["results"].append({"filename": filename, "status": "failed"})
                if os.path.exists(output_path):
                    os.remove(output_path)

            time.sleep(0.5)

        job["status"] = "done"
        job["current"] = ""

    thread = threading.Thread(target=run_downloads, daemon=True)
    thread.start()

    return jsonify({"job_id": job_id})


@app.route("/api/status/<job_id>")
def api_status(job_id):
    """Get the current status of a download job."""
    job = jobs.get(job_id)
    if not job:
        return jsonify({"error": "Job not found"}), 404
    return jsonify(job)


@app.route("/api/progress/<job_id>")
def api_progress(job_id):
    """Server-Sent Events stream for real-time download progress."""
    def generate():
        while True:
            job = jobs.get(job_id)
            if not job:
                yield f"data: {json.dumps({'error': 'Job not found'})}\n\n"
                break
            yield f"data: {json.dumps(job)}\n\n"
            if job["status"] == "done":
                break
            time.sleep(0.5)

    return Response(generate(), mimetype="text/event-stream")


@app.route("/videos/<filename>")
def serve_video(filename):
    """Serve a downloaded video file."""
    return send_from_directory(DOWNLOAD_DIR, filename)


if __name__ == "__main__":
    os.makedirs(DOWNLOAD_DIR, exist_ok=True)
    app.run(debug=True, host="0.0.0.0", port=5000)
