#!/usr/bin/env python3
"""Native desktop wrapper for the Savant Video Tool (macOS-friendly)."""

import os
import socket
import threading
import time

from app import app, DOWNLOAD_DIR

try:
    import webview
except ImportError as exc:
    raise SystemExit(
        "pywebview is required for the desktop app. Install dependencies with: pip install -r requirements.txt"
    ) from exc


def find_open_port(start=5000, end=5100):
    for port in range(start, end + 1):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
            sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            if sock.connect_ex(("127.0.0.1", port)) != 0:
                return port
    raise RuntimeError("Could not find an open localhost port between 5000-5100")


def run_flask(host, port):
    os.makedirs(DOWNLOAD_DIR, exist_ok=True)
    app.run(host=host, port=port, debug=False, use_reloader=False)


def main():
    host = "127.0.0.1"
    port = find_open_port()
    url = f"http://{host}:{port}"

    thread = threading.Thread(target=run_flask, args=(host, port), daemon=True)
    thread.start()

    for _ in range(40):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
            if sock.connect_ex((host, port)) == 0:
                break
        time.sleep(0.1)

    webview.create_window("Savant Video Tool", url, width=1320, height=900)
    webview.start()


if __name__ == "__main__":
    main()
