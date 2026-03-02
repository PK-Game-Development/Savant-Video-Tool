/**
 * Client for the Shorthop Flask backend.
 *
 * Set API_BASE_URL in app.json → extra.apiBaseUrl, or override with
 * the EXPO_PUBLIC_API_URL environment variable during development:
 *   EXPO_PUBLIC_API_URL=http://192.168.1.x:5000 npx expo start
 */

import Constants from "expo-constants";

const API_BASE =
  process.env.EXPO_PUBLIC_API_URL ||
  Constants.expoConfig?.extra?.apiBaseUrl ||
  "http://localhost:5000";

async function get(path) {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  return res.json();
}

async function post(path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const b = await res.json().catch(() => ({}));
    throw new Error(b.error || `HTTP ${res.status}`);
  }
  return res.json();
}

// ─── Highlights ───────────────────────────────────────────────────────────────

/**
 * Get top plays by WPA for a given date.
 * @param {string|null} date   YYYY-MM-DD (null = most recent game date)
 * @param {string|null} team   3-letter team code filter (null = all teams)
 * @param {number}      limit  Max results (default 15, use 1 for auto-save)
 */
export async function getHighlights({ date = null, team = null, limit = 15 } = {}) {
  const params = new URLSearchParams({ limit: String(limit) });
  if (date) params.set("date", date);
  if (team) params.set("team", team);
  return get(`/api/highlights?${params}`);
}

// ─── Player Search ────────────────────────────────────────────────────────────

/**
 * Search for MLB players by name.
 * @param {string} name  Partial or full player name
 */
export async function searchPlayers(name) {
  return post("/api/player-search", { name });
}

// ─── Player Plays ─────────────────────────────────────────────────────────────

/**
 * Get all plate appearance plays for a specific player on a given date.
 * @param {number} mlbId  MLB player ID
 * @param {string} date   YYYY-MM-DD
 */
export async function getPlayerPlays(mlbId, date) {
  const params = new URLSearchParams({ mlb_id: String(mlbId), date });
  return get(`/api/player-plays?${params}`);
}

// ─── Auto-Save Helper ─────────────────────────────────────────────────────────

/**
 * Fetch the single highest-WPA play for a given date and optional team.
 * Returns the video object or null if none found.
 */
export async function getTopPlay({ date = null, team = null } = {}) {
  try {
    const data = await getHighlights({ date, team, limit: 1 });
    return data.videos?.[0] || null;
  } catch {
    return null;
  }
}
