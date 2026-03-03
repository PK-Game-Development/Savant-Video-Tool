import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { TEAMS } from "../constants/teams";

const LOCAL_PROFILE_KEY = "shorthop_profile";
const LOCAL_THEME_KEY = "shorthop_theme_team";
const SHORTHOP_THEME = "SHORTHOP";
const MLB_THEME = "MLB";

export const PALETTE_OPTIONS = [
  { code: SHORTHOP_THEME, name: "Shorthop", color: "#C8102E" },
  { code: MLB_THEME, name: "MLB", color: "#041E42" },
  ...TEAMS,
];

function darkenHex(hex, factor = 0.6) {
  const clean = (hex || "").replace("#", "");
  if (clean.length !== 6) return "#780B1C";
  const r = Math.max(0, Math.min(255, Math.round(parseInt(clean.slice(0, 2), 16) * factor)));
  const g = Math.max(0, Math.min(255, Math.round(parseInt(clean.slice(2, 4), 16) * factor)));
  const b = Math.max(0, Math.min(255, Math.round(parseInt(clean.slice(4, 6), 16) * factor)));
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b
    .toString(16)
    .padStart(2, "0")}`.toUpperCase();
}

function hexToRgb(hex) {
  const clean = (hex || "").replace("#", "");
  if (clean.length !== 6) return null;
  return {
    r: parseInt(clean.slice(0, 2), 16),
    g: parseInt(clean.slice(2, 4), 16),
    b: parseInt(clean.slice(4, 6), 16),
  };
}

function rgbToHex(r, g, b) {
  return `#${Math.round(r).toString(16).padStart(2, "0")}${Math.round(g)
    .toString(16)
    .padStart(2, "0")}${Math.round(b).toString(16).padStart(2, "0")}`.toUpperCase();
}

function mixHex(baseHex, targetHex, targetWeight) {
  const base = hexToRgb(baseHex);
  const target = hexToRgb(targetHex);
  if (!base || !target) return baseHex;
  const w = Math.max(0, Math.min(1, targetWeight));
  return rgbToHex(
    base.r * (1 - w) + target.r * w,
    base.g * (1 - w) + target.g * w,
    base.b * (1 - w) + target.b * w
  );
}

function makeColors(themeCode, teamPrimaryHex, teamSecondaryHex) {
  if (themeCode === MLB_THEME) {
    return {
      background: "#0A2B59",
      surface: "#123A74",
      surfaceElevated: "#1A4B90",
      border: "#3C6EB0",
      accent: "#C8102E",
      accentMuted: darkenHex("#C8102E", 0.6),
      today: "#D4AF37",
      textPrimary: "#FFFFFF",
      textSecondary: "#DAE6F7",
      textMuted: "#AFC5E4",
      autoSaveMlb: "#C8102E",
      autoSaveTeam: "#2C6ECF",
      manualSave: "#FFFFFF",
    };
  }

  if (!themeCode || themeCode === SHORTHOP_THEME) {
    return {
      background: "#151515",
      surface: "#242424",
      surfaceElevated: "#323232",
      border: "#444444",
      accent: "#C8102E",
      accentMuted: "#8B0A1F",
      today: "#D4AF37",
      textPrimary: "#FFFFFF",
      textSecondary: "#B0B0B0",
      textMuted: "#7A7A7A",
      autoSaveMlb: "#C8102E",
      autoSaveTeam: "#4A90D9",
      manualSave: "#FFFFFF",
    };
  }

  const primary = teamPrimaryHex || "#C8102E";
  const secondary = teamSecondaryHex || darkenHex(primary, 0.65);
  const background = mixHex(secondary, "#000000", 0.78);
  const surface = mixHex(secondary, "#000000", 0.68);
  const surfaceElevated = mixHex(secondary, "#000000", 0.58);

  return {
    background,
    surface,
    surfaceElevated,
    border: secondary,
    accent: primary,
    accentMuted: darkenHex(primary, 0.6),
    today: "#D4AF37",
    textPrimary: "#FFFFFF",
    textSecondary: mixHex("#D6D6D6", secondary, 0.2),
    textMuted: mixHex("#9D9D9D", secondary, 0.18),
    autoSaveMlb: "#C8102E",
    autoSaveTeam: primary,
    manualSave: "#FFFFFF",
  };
}

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [themeTeamCode, setThemeTeamCode] = useState(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const rawTheme = await AsyncStorage.getItem(LOCAL_THEME_KEY);
        if (rawTheme) {
          if (mounted) setThemeTeamCode(rawTheme);
          return;
        }

        // Backward compatibility: migrate existing profile.themeTeam once.
        const rawProfile = await AsyncStorage.getItem(LOCAL_PROFILE_KEY);
        const profile = rawProfile ? JSON.parse(rawProfile) : null;
        const migrated = profile?.themeTeam || SHORTHOP_THEME;
        if (migrated) {
          await AsyncStorage.setItem(LOCAL_THEME_KEY, migrated);
        }
        if (mounted) setThemeTeamCode(migrated);
      } catch {
        if (mounted) setThemeTeamCode(null);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  async function setThemeTeam(code) {
    setThemeTeamCode(code || null);
    try {
      if (code) await AsyncStorage.setItem(LOCAL_THEME_KEY, code);
      else await AsyncStorage.removeItem(LOCAL_THEME_KEY);

      // Keep profile in sync for signed-in users/new-device restore.
      const raw = await AsyncStorage.getItem(LOCAL_PROFILE_KEY);
      const current = raw ? JSON.parse(raw) : {};
      const next = Object.assign({}, current, { themeTeam: code || null });
      await AsyncStorage.setItem(LOCAL_PROFILE_KEY, JSON.stringify(next));
    } catch {
      // Ignore persistence errors; in-memory theme still updates immediately.
    }
  }

  const safeThemeCode = themeTeamCode || SHORTHOP_THEME;
  const team = TEAMS.find((t) => t.code === safeThemeCode);
  const colors = useMemo(
    () => makeColors(safeThemeCode, team?.primary || team?.color, team?.secondary),
    [safeThemeCode, team?.primary, team?.color, team?.secondary]
  );
  const value = useMemo(
    () => ({ colors, themeTeamCode, setThemeTeam }),
    [colors, themeTeamCode]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return ctx;
}
