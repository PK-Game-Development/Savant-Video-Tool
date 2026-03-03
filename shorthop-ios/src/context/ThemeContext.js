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

function makeColors(themeCode, teamHex) {
  if (themeCode === "ARI") {
    // Diamondbacks: purple + teal
    return {
      background: "#2E0A4F",
      surface: "#3C1466",
      surfaceElevated: "#4A1F7A",
      border: "#2EC4B6",
      accent: "#2EC4B6",
      accentMuted: "#1E8F85",
      today: "#D4AF37",
      textPrimary: "#FFFFFF",
      textSecondary: "#DCCAF0",
      textMuted: "#BFA7DB",
      autoSaveMlb: "#C8102E",
      autoSaveTeam: "#2EC4B6",
      manualSave: "#FFFFFF",
    };
  }

  if (themeCode === "MIA") {
    // Marlins: black + classic teal
    return {
      background: "#0A0A0A",
      surface: "#151515",
      surfaceElevated: "#1F1F1F",
      border: "#00AFA0",
      accent: "#00AFA0",
      accentMuted: "#007C72",
      today: "#D4AF37",
      textPrimary: "#FFFFFF",
      textSecondary: "#BEEBE7",
      textMuted: "#7CCBC3",
      autoSaveMlb: "#C8102E",
      autoSaveTeam: "#00AFA0",
      manualSave: "#FFFFFF",
    };
  }

  if (themeCode === "BOS") {
    // Red Sox: same setup as Braves (primary navy, secondary red)
    return {
      background: "#0A1D3A",
      surface: "#132B50",
      surfaceElevated: "#1B3B67",
      border: "#CE1141",
      accent: "#CE1141",
      accentMuted: "#7E0A28",
      today: "#D4AF37",
      textPrimary: "#FFFFFF",
      textSecondary: "#D2DDF0",
      textMuted: "#A2B4D3",
      autoSaveMlb: "#C8102E",
      autoSaveTeam: "#CE1141",
      manualSave: "#FFFFFF",
    };
  }

  if (themeCode === "CLE") {
    // Guardians: same setup as Braves (primary navy, secondary red)
    return {
      background: "#0A1D3A",
      surface: "#132B50",
      surfaceElevated: "#1B3B67",
      border: "#CE1141",
      accent: "#CE1141",
      accentMuted: "#7E0A28",
      today: "#D4AF37",
      textPrimary: "#FFFFFF",
      textSecondary: "#D2DDF0",
      textMuted: "#A2B4D3",
      autoSaveMlb: "#C8102E",
      autoSaveTeam: "#CE1141",
      manualSave: "#FFFFFF",
    };
  }

  if (themeCode === "CWS") {
    // White Sox: primary black, secondary red
    return {
      background: "#0A0A0A",
      surface: "#151515",
      surfaceElevated: "#202020",
      border: "#A32028",
      accent: "#A32028",
      accentMuted: "#66141A",
      today: "#D4AF37",
      textPrimary: "#FFFFFF",
      textSecondary: "#D6D6D6",
      textMuted: "#A7A7A7",
      autoSaveMlb: "#C8102E",
      autoSaveTeam: "#A32028",
      manualSave: "#FFFFFF",
    };
  }

  if (themeCode === "ATL") {
    // Braves: primary navy, secondary red
    return {
      background: "#0A1D3A",
      surface: "#132B50",
      surfaceElevated: "#1B3B67",
      border: "#CE1141",
      accent: "#CE1141",
      accentMuted: "#7E0A28",
      today: "#D4AF37",
      textPrimary: "#FFFFFF",
      textSecondary: "#D2DDF0",
      textMuted: "#A2B4D3",
      autoSaveMlb: "#C8102E",
      autoSaveTeam: "#CE1141",
      manualSave: "#FFFFFF",
    };
  }

  if (themeCode === "OAK") {
    // Athletics: green primary, gold secondary
    return {
      background: "#0E2A1F",
      surface: "#174130",
      surfaceElevated: "#205944",
      border: "#EFB21E",
      accent: "#EFB21E",
      accentMuted: "#9E7614",
      today: "#D4AF37",
      textPrimary: "#FFFFFF",
      textSecondary: "#D8E7DE",
      textMuted: "#A9C2B3",
      autoSaveMlb: "#C8102E",
      autoSaveTeam: "#EFB21E",
      manualSave: "#FFFFFF",
    };
  }

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

  const accent = teamHex || "#C8102E";
  const background = mixHex(accent, "#000000", 0.82);
  const surface = mixHex(accent, "#000000", 0.72);
  const surfaceElevated = mixHex(accent, "#000000", 0.62);
  const border = mixHex(accent, "#FFFFFF", 0.34);

  return {
    background,
    surface,
    surfaceElevated,
    border,
    accent,
    accentMuted: darkenHex(accent, 0.6),
    today: "#D4AF37",
    textPrimary: "#FFFFFF",
    textSecondary: mixHex("#D6D6D6", accent, 0.16),
    textMuted: mixHex("#9D9D9D", accent, 0.14),
    autoSaveMlb: "#C8102E",
    autoSaveTeam: accent,
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
  const teamHex = TEAMS.find((t) => t.code === safeThemeCode)?.color;
  const colors = useMemo(() => makeColors(safeThemeCode, teamHex), [safeThemeCode, teamHex]);
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
