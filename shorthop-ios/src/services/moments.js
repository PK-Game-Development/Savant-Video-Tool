/**
 * Firestore CRUD for user moments.
 *
 * Data model:
 *   users/{uid}                        — user profile (favoriteTeam, displayName)
 *   users/{uid}/moments/{autoId}       — one saved baseball moment
 *
 * DEV fallback: when no Firebase user is signed in, AsyncStorage is used
 * so the full save/read/delete flow works without auth.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
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

// ─── Local (AsyncStorage) helpers ─────────────────────────────────────────────

const LOCAL_KEY = "shorthop_moments";
const LOCAL_PROFILE_KEY = "shorthop_profile";

async function localGetAll() {
  const raw = await AsyncStorage.getItem(LOCAL_KEY);
  return raw ? JSON.parse(raw) : [];
}

async function localSaveAll(moments) {
  await AsyncStorage.setItem(LOCAL_KEY, JSON.stringify(moments));
}

// ─── User Profile ─────────────────────────────────────────────────────────────

export async function getUserProfile() {
  const uid = auth.currentUser?.uid;
  if (!uid) {
    const raw = await AsyncStorage.getItem(LOCAL_PROFILE_KEY);
    return raw ? JSON.parse(raw) : null;
  }
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? snap.data() : null;
}

export async function setUserProfile(data) {
  const uid = auth.currentUser?.uid;
  const raw = await AsyncStorage.getItem(LOCAL_PROFILE_KEY);
  const localProfile = raw ? JSON.parse(raw) : {};
  const merged = Object.assign({}, localProfile, data);
  await AsyncStorage.setItem(LOCAL_PROFILE_KEY, JSON.stringify(merged));

  if (!uid) return;
  await setDoc(doc(db, "users", uid), data, { merge: true });
}

// ─── Moments ─────────────────────────────────────────────────────────────────

export async function saveMoment(video, { isAutoSaved = false, autoSaveType = null } = {}) {
  const uid = auth.currentUser?.uid;

  const momentData = {
    date: video.date,
    playId: video.play_id,
    gamePk: video.game_pk,
    playerName: video.player || video.batter_name || "",
    event: video.event,
    description: video.description || "",
    battingTeam: video.batting_team || "",
    pitchingTeam: video.pitching_team || "",
    inning: Number(video.inning) || 0,
    halfInning: video.half_inning || "",
    outs: Number(video.outs) || 0,
    balls: Number(video.balls) || 0,
    strikes: Number(video.strikes) || 0,
    onFirst: Boolean(video.on_first),
    onSecond: Boolean(video.on_second),
    onThird: Boolean(video.on_third),
    savantUrl: video.savant_url || "",
    isAutoSaved,
    autoSaveType,
    createdAt: Date.now(),
  };

  if (!uid) {
    // DEV: persist locally
    const all = await localGetAll();
    const id = `local_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    all.push({ id, ...momentData });
    await localSaveAll(all);
    return id;
  }

  const ref = await addDoc(collection(db, "users", uid, "moments"), {
    ...momentData,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function getMomentsForDate(date) {
  const uid = auth.currentUser?.uid;

  if (!uid) {
    const all = await localGetAll();
    return all.filter((m) => m.date === date);
  }

  const q = query(
    collection(db, "users", uid, "moments"),
    where("date", "==", date),
    orderBy("createdAt", "asc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getMomentsInRange(startDate, endDate) {
  const uid = auth.currentUser?.uid;

  if (!uid) {
    const all = await localGetAll();
    return all.filter((m) => m.date >= startDate && m.date <= endDate);
  }

  const q = query(
    collection(db, "users", uid, "moments"),
    where("date", ">=", startDate),
    where("date", "<=", endDate),
    orderBy("date", "asc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getAllMoments() {
  const uid = auth.currentUser?.uid;

  if (!uid) {
    const all = await localGetAll();
    return all.sort((a, b) => a.date.localeCompare(b.date));
  }

  const q = query(
    collection(db, "users", uid, "moments"),
    orderBy("date", "asc"),
    orderBy("createdAt", "asc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function deleteMoment(momentId) {
  const uid = auth.currentUser?.uid;

  if (!uid) {
    const all = await localGetAll();
    await localSaveAll(all.filter((m) => m.id !== momentId));
    return;
  }

  await deleteDoc(doc(db, "users", uid, "moments", momentId));
}

export async function isPlaySaved(playId) {
  const uid = auth.currentUser?.uid;

  if (!uid) {
    const all = await localGetAll();
    return all.some((m) => m.playId === playId);
  }

  const q = query(
    collection(db, "users", uid, "moments"),
    where("playId", "==", playId)
  );
  const snap = await getDocs(q);
  return !snap.empty;
}

export async function getSavedPlayIds(date) {
  const moments = await getMomentsForDate(date);
  return new Set(moments.map((m) => m.playId));
}

// ─── Login dates ───────────────────────────────────────────────────────────────
//   users/{uid}/loginDates/{dateStr}  — one doc per day the user opened the app

const LOCAL_LOGIN_KEY = "shorthop_login_dates";

export async function recordLoginDate(dateStr) {
  const uid = auth.currentUser?.uid;

  if (!uid) {
    const raw = await AsyncStorage.getItem(LOCAL_LOGIN_KEY);
    const dates = raw ? JSON.parse(raw) : [];
    if (!dates.includes(dateStr)) {
      await AsyncStorage.setItem(LOCAL_LOGIN_KEY, JSON.stringify([...dates, dateStr]));
    }
    return;
  }

  // Document ID = date string → naturally idempotent
  await setDoc(doc(db, "users", uid, "loginDates", dateStr), { date: dateStr }, { merge: true });
}

export async function getLoginDatesInRange(startDate, endDate) {
  const uid = auth.currentUser?.uid;

  if (!uid) {
    const raw = await AsyncStorage.getItem(LOCAL_LOGIN_KEY);
    const dates = raw ? JSON.parse(raw) : [];
    return dates.filter((d) => d >= startDate && d <= endDate);
  }

  const q = query(
    collection(db, "users", uid, "loginDates"),
    where("date", ">=", startDate),
    where("date", "<=", endDate)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data().date);
}
