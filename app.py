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
import os
import re
import shutil
import subprocess
import tempfile
import threading
import time
import uuid
import zipfile
from collections import defaultdict
from urllib.parse import urlparse, parse_qs, urlencode

import requests
from flask import (
    Flask, render_template, request, jsonify, Response, send_file, abort,
)

app = Flask(__name__)

# --- Config ---
STATCAST_CSV_BASE = "https://baseballsavant.mlb.com/statcast_search/csv"
MLB_GAME_FEED_URL = "https://statsapi.mlb.com/api/v1.1/game/{game_pk}/feed/live"
VIDEO_CDN_URL = "https://fastball-clips.mlb.com/{game_pk}/{broadcast}/{play_id}.mp4"
SPORTY_VIDEO_URL = "https://baseballsavant.mlb.com/sporty-videos?playId={play_id}"

# Base temp directory for all jobs
WORK_DIR = os.path.join(tempfile.gettempdir(), "savant_jobs")
os.makedirs(WORK_DIR, exist_ok=True)

# How long to keep job files before cleanup (seconds)
JOB_TTL = 3600  # 1 hour

# Active jobs: job_id -> job state dict
jobs = {}


# --- Helpers ---

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
    with open(output_path, "wb") as f:
        for chunk in resp.iter_content(chunk_size=8192):
            f.write(chunk)


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


def probe_has_audio(path):
    """Check if a video file has an audio stream."""
    cmd = [
        "ffprobe", "-v", "quiet",
        "-select_streams", "a",
        "-show_entries", "stream=index",
        "-of", "csv=p=0",
        path,
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
    return bool(result.stdout.strip())


def combine_videos(file_paths, output_path):
    """Combine multiple mp4 files into one using ffmpeg concat filter.

    Re-encodes to handle clips with different resolutions/codecs/framerates.
    Generates silent audio for clips that have no audio track.
    """
    if not shutil.which("ffmpeg"):
        raise RuntimeError("ffmpeg is not installed on this server.")

    # Build the concat filter: scale all to 1280x720, 30fps, then concatenate
    inputs = []
    filter_parts = []
    for i, path in enumerate(file_paths):
        inputs.extend(["-i", path])
        has_audio = probe_has_audio(path)

        filter_parts.append(
            f"[{i}:v]scale=1280:720:force_original_aspect_ratio=decrease,"
            f"pad=1280:720:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30[v{i}];"
        )
        if has_audio:
            filter_parts.append(f"[{i}:a]aresample=48000[a{i}];")
        else:
            # Generate silent audio matching the video duration
            filter_parts.append(
                f"anullsrc=r=48000:cl=stereo[a{i}_null];"
                f"[a{i}_null]atrim=duration=30[a{i}];"
            )

    v_streams = "".join(f"[v{i}]" for i in range(len(file_paths)))
    a_streams = "".join(f"[a{i}]" for i in range(len(file_paths)))
    n = len(file_paths)
    filter_parts.append(f"{v_streams}{a_streams}concat=n={n}:v=1:a=1[outv][outa]")

    filter_complex = "".join(filter_parts)

    cmd = [
        "ffmpeg", "-y",
        *inputs,
        "-filter_complex", filter_complex,
        "-map", "[outv]", "-map", "[outa]",
        "-c:v", "libx264", "-preset", "fast", "-crf", "23",
        "-c:a", "aac", "-b:a", "128k",
        "-movflags", "+faststart",
        output_path,
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=600)
    if result.returncode != 0:
        raise RuntimeError(f"ffmpeg failed: {result.stderr[:500]}")


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
    """Start a download job. Downloads videos to a server temp directory."""
    data = request.get_json()
    videos = data.get("videos", [])
    broadcast = data.get("broadcast", "home")
    combine = data.get("combine", False)

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
        "combine": combine,
        "download_ready": False,
        "download_file": None,
        "job_dir": job_dir,
    }

    def run_job():
        session = create_session()
        job = jobs[job_id]
        downloaded_paths = []

        # Phase 1: Download all videos
        for video in videos:
            game_pk = video["game_pk"]
            play_id = video["play_id"]
            filename = video["filename"]
            output_path = os.path.join(job_dir, filename)

            job["current"] = f"{video.get('player', '')} - {video.get('date', '')}"

            success = try_download(game_pk, play_id, broadcast, output_path, session)

            if success:
                job["completed"] += 1
                job["results"].append({"filename": filename, "status": "ok"})
                downloaded_paths.append(output_path)
            else:
                job["failed"] += 1
                job["results"].append({"filename": filename, "status": "failed"})
                if os.path.exists(output_path):
                    os.remove(output_path)

            time.sleep(0.3)

        # Phase 2: Combine if requested
        if combine and len(downloaded_paths) >= 2:
            job["phase"] = "combining"
            job["current"] = "Combining all clips into one video..."
            try:
                combined_path = os.path.join(job_dir, "combined_video.mp4")
                combine_videos(downloaded_paths, combined_path)
                job["download_file"] = "combined_video.mp4"
                job["download_ready"] = True
            except Exception as e:
                job["results"].append({
                    "filename": "combined_video.mp4",
                    "status": "failed",
                    "error": str(e),
                })

        elif combine and len(downloaded_paths) == 1:
            # Only one video — just offer it directly
            job["download_file"] = os.path.basename(downloaded_paths[0])
            job["download_ready"] = True

        elif not combine and downloaded_paths:
            # No combine — zip all individual files
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

        job["phase"] = "done"
        job["status"] = "done"
        job["current"] = ""

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
    """Download the final file (combined video or zip) for a completed job."""
    job = jobs.get(job_id)
    job_dir = get_job_dir(job_id)

    if job and job.get("download_ready"):
        filename = job["download_file"]
    else:
        # Fallback: look for the expected output files on disk
        if not os.path.isdir(job_dir):
            abort(404)
        for name in ("combined_video.mp4", "savant_videos.zip"):
            if os.path.exists(os.path.join(job_dir, name)):
                filename = name
                break
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


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(debug=True, host="0.0.0.0", port=port)
