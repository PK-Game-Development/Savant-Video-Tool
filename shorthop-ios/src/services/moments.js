/**
 * Firestore CRUD for user moments.
 *
 * Data model:
 *   users/{uid}                        — user profile (favoriteTeam, displayName)
 *   users/{uid}/moments/{autoId}       — one saved baseball moment
 */

import {
  doc,
  getDoc,
  setDoc,
  collection,
  addDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  getDocs,
  serverTimestamp,
} from "firebase/firestore";
import { auth, db } from "./firebase";

// ─── User Profile ─────────────────────────────────────────────────────────────

export async function getUserProfile() {
  const uid = auth.currentUser?.uid;
  if (!uid) return null;
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? snap.data() : null;
}

export async function setUserProfile(data) {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("Not authenticated");
  await setDoc(doc(db, "users", uid), data, { merge: true });
}

// ─── Moments ─────────────────────────────────────────────────────────────────

/**
 * Save a moment to Firestore.
 * @param {Object} video  - play object from Flask API (play_id, game_pk, player, event, etc.)
 * @param {Object} opts   - { isAutoSaved: bool, autoSaveType: 'mlb'|'team'|null }
 * @returns {string} Firestore document ID
 */
export async function saveMoment(video, { isAutoSaved = false, autoSaveType = null } = {}) {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("Not authenticated");

  const momentData = {
    date: video.date,
    playId: video.play_id,
    gamePk: video.game_pk,
    playerName: video.player || video.batter_name || "",
    event: video.event,
    description: video.description || "",
    wpa: parseFloat(video.wpa) || 0,
    battingTeam: video.batting_team || "",
    pitchingTeam: video.pitching_team || "",
    savantUrl: video.savant_url || "",
    isAutoSaved,
    autoSaveType,
    createdAt: serverTimestamp(),
  };

  const ref = await addDoc(collection(db, "users", uid, "moments"), momentData);
  return ref.id;
}

/**
 * Get all moments for a specific date.
 * @param {string} date  YYYY-MM-DD
 */
export async function getMomentsForDate(date) {
  const uid = auth.currentUser?.uid;
  if (!uid) return [];

  const q = query(
    collection(db, "users", uid, "moments"),
    where("date", "==", date),
    orderBy("createdAt", "asc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * Get all moments between two dates (inclusive), for calendar dot markers.
 * @param {string} startDate  YYYY-MM-DD
 * @param {string} endDate    YYYY-MM-DD
 */
export async function getMomentsInRange(startDate, endDate) {
  const uid = auth.currentUser?.uid;
  if (!uid) return [];

  const q = query(
    collection(db, "users", uid, "moments"),
    where("date", ">=", startDate),
    where("date", "<=", endDate),
    orderBy("date", "asc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * Delete a moment by Firestore document ID.
 */
export async function deleteMoment(momentId) {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("Not authenticated");
  await deleteDoc(doc(db, "users", uid, "moments", momentId));
}

/**
 * Check if a play (by playId) is already saved for the current user.
 */
export async function isPlaySaved(playId) {
  const uid = auth.currentUser?.uid;
  if (!uid) return false;
  const q = query(
    collection(db, "users", uid, "moments"),
    where("playId", "==", playId)
  );
  const snap = await getDocs(q);
  return !snap.empty;
}

/**
 * Get the set of already-saved playIds for a given date (for checkmark display).
 */
export async function getSavedPlayIds(date) {
  const moments = await getMomentsForDate(date);
  return new Set(moments.map((m) => m.playId));
}
