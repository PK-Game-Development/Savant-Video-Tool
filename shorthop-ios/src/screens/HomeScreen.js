/**
 * HomeScreen — minimalist calendar with moment dots + today's auto-save strip.
 *
 * Calendar dots:
 *   Red dot  = MLB auto-save present
 *   Blue dot = Team auto-save present
 *   White dot = manually saved moment
 *
 * On mount / foreground: triggers auto-save check for today.
 */

import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Calendar } from "react-native-calendars";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../services/firebase";
import {
  getMomentsInRange,
  getMomentsForDate,
  saveMoment,
  getUserProfile,
} from "../services/moments";
import { getTopPlay } from "../services/savantApi";
import MomentCard from "../components/MomentCard";
import colors from "../constants/colors";
import { teamName } from "../constants/teams";

function todayStr() {
  return new Date().toISOString().split("T")[0];
}

function monthRange(dateStr) {
  const [y, m] = dateStr.split("-").map(Number);
  const start = `${y}-${String(m).padStart(2, "0")}-01`;
  const lastDay = new Date(y, m, 0).getDate();
  const end = `${y}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return { start, end };
}

export default function HomeScreen({ navigation }) {
  const today = todayStr();
  const [currentMonth, setCurrentMonth] = useState(today.slice(0, 7) + "-01");
  const [markedDates, setMarkedDates] = useState({});
  const [todayMoments, setTodayMoments] = useState([]);
  const [loadingAuto, setLoadingAuto] = useState(false);
  const [profile, setProfile] = useState(null);

  // Load user profile once
  useEffect(() => {
    getUserProfile().then(setProfile).catch(() => {});
  }, []);

  // Reload calendar dots and today's moments whenever the screen is focused
  useFocusEffect(
    useCallback(() => {
      loadCalendarDots(currentMonth);
      loadTodayMoments();
    }, [currentMonth, profile])
  );

  async function loadCalendarDots(monthStart) {
    const { start, end } = monthRange(monthStart);
    try {
      const moments = await getMomentsInRange(start, end);
      const dots = {};
      for (const m of moments) {
        if (!dots[m.date]) dots[m.date] = { dots: [] };
        const dotColor =
          m.autoSaveType === "mlb"
            ? colors.autoSaveMlb
            : m.autoSaveType === "team"
            ? colors.autoSaveTeam
            : colors.manualSave;
        // Avoid duplicate dot colors for the same day
        if (!dots[m.date].dots.find((d) => d.color === dotColor)) {
          dots[m.date].dots.push({ color: dotColor, key: m.autoSaveType || "manual" });
        }
      }
      // Highlight today
      if (!dots[today]) dots[today] = { dots: [] };
      dots[today].selected = true;
      dots[today].selectedColor = colors.accent;

      setMarkedDates(dots);
    } catch {
      // Non-critical — calendar still works without dots
    }
  }

  async function loadTodayMoments() {
    try {
      const moments = await getMomentsForDate(today);
      setTodayMoments(moments);
      // Trigger auto-save only if none exist yet today
      const hasAutoSave = moments.some((m) => m.isAutoSaved);
      if (!hasAutoSave && profile?.favoriteTeam) {
        runAutoSave(profile.favoriteTeam);
      } else if (!hasAutoSave && profile) {
        runAutoSave(null);
      }
    } catch {
      setTodayMoments([]);
    }
  }

  async function runAutoSave(favoriteTeam) {
    setLoadingAuto(true);
    try {
      // MLB top play
      const mlbPlay = await getTopPlay({ limit: 1 });
      if (mlbPlay) {
        await saveMoment(mlbPlay, { isAutoSaved: true, autoSaveType: "mlb" });
      }

      // Team top play (only if different from MLB top play)
      if (favoriteTeam) {
        const teamPlay = await getTopPlay({ team: favoriteTeam, limit: 1 });
        if (teamPlay && teamPlay.play_id !== mlbPlay?.play_id) {
          await saveMoment(teamPlay, { isAutoSaved: true, autoSaveType: "team" });
        }
      }

      // Refresh after saving
      const fresh = await getMomentsForDate(today);
      setTodayMoments(fresh);
      loadCalendarDots(currentMonth);
    } catch {
      // Auto-save is best-effort; don't alert the user
    } finally {
      setLoadingAuto(false);
    }
  }

  function onDayPress(day) {
    navigation.navigate("Day", { date: day.dateString });
  }

  function onMonthChange(month) {
    setCurrentMonth(month.dateString);
    loadCalendarDots(month.dateString);
  }

  const autoSavedToday = todayMoments.filter((m) => m.isAutoSaved);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <Text style={styles.wordmark}>shorthop</Text>
        <TouchableOpacity
          onPress={() => navigation.navigate("Settings")}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="settings-outline" size={22} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      <Calendar
        current={today}
        onDayPress={onDayPress}
        onMonthChange={onMonthChange}
        markingType="multi-dot"
        markedDates={markedDates}
        theme={{
          backgroundColor: colors.background,
          calendarBackground: colors.background,
          textSectionTitleColor: colors.textMuted,
          selectedDayBackgroundColor: colors.accent,
          selectedDayTextColor: "#fff",
          todayTextColor: colors.accent,
          dayTextColor: colors.textPrimary,
          textDisabledColor: colors.textMuted,
          dotColor: colors.accent,
          selectedDotColor: "#fff",
          arrowColor: colors.textSecondary,
          disabledArrowColor: colors.textMuted,
          monthTextColor: colors.textPrimary,
          indicatorColor: colors.accent,
          textDayFontSize: 14,
          textMonthFontSize: 16,
          textDayHeaderFontSize: 11,
          textMonthFontWeight: "300",
        }}
        style={styles.calendar}
      />

      {/* Auto-save strip */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>TODAY'S AUTO-SAVES</Text>
          {loadingAuto && (
            <ActivityIndicator size="small" color={colors.textMuted} />
          )}
        </View>

        {autoSavedToday.length === 0 && !loadingAuto && (
          <Text style={styles.empty}>
            {new Date().getHours() < 8
              ? "Check back this morning — clips post after games go final."
              : "No data yet for today. Check back later."}
          </Text>
        )}

        {autoSavedToday.map((moment) => (
          <View key={moment.id}>
            {moment.autoSaveType && (
              <Text style={styles.autoSaveLabel}>
                {moment.autoSaveType === "mlb"
                  ? "MLB"
                  : profile?.favoriteTeam
                  ? teamName(profile.favoriteTeam)
                  : "Your Team"}
              </Text>
            )}
            <MomentCard
              moment={moment}
              compact
              onPress={() => navigation.navigate("Day", { date: today })}
            />
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingBottom: 40,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 10,
  },
  wordmark: {
    color: colors.textPrimary,
    fontSize: 22,
    fontWeight: "200",
    letterSpacing: 4,
  },
  calendar: {
    marginHorizontal: 8,
  },
  section: {
    paddingHorizontal: 20,
    marginTop: 28,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  sectionTitle: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 1.5,
  },
  autoSaveLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 1,
    marginBottom: 4,
    marginTop: 4,
  },
  empty: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 20,
  },
});
