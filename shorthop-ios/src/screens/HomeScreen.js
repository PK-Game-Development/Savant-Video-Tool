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

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  FlatList,
  Modal,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { Calendar } from "react-native-calendars";
import { LinearGradient } from "expo-linear-gradient";
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
import { getTopPlay, getHighlights } from "../services/savantApi";
import { prefetchMoments, prefetchHighlights } from "../services/prefetch";
import MomentCard from "../components/MomentCard";
import colors from "../constants/colors";
import { teamName } from "../constants/teams";

// ─── Picker data ───────────────────────────────────────────────────────────────

const ITEM_H = 48;
const PICKER_H = ITEM_H * 5;
const MONTH_NAMES = [
  "January", "February", "March", "April",
  "May", "June", "July", "August",
  "September", "October", "November", "December",
];
const YEAR_LIST = (() => {
  const y = new Date().getFullYear();
  return Array.from({ length: y - 2016 }, (_, i) => 2017 + i);
})();

// ─── Drum-roll picker ──────────────────────────────────────────────────────────

function MonthYearPicker({ visible, initialMonth, initialYear, onConfirm, onCancel }) {
  const [selMonth, setSelMonth] = useState(initialMonth);
  const [selYear, setSelYear] = useState(initialYear);
  const monthRef = useRef(null);
  const yearRef = useRef(null);

  useEffect(() => {
    if (!visible) return;
    setSelMonth(initialMonth);
    setSelYear(initialYear);
    const t = setTimeout(() => {
      monthRef.current?.scrollToIndex({ index: initialMonth - 1, animated: false });
      const yi = YEAR_LIST.indexOf(initialYear);
      yearRef.current?.scrollToIndex({ index: yi >= 0 ? yi : 0, animated: false });
    }, 80);
    return () => clearTimeout(t);
  }, [visible, initialMonth, initialYear]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <TouchableOpacity style={ps.backdrop} onPress={onCancel} activeOpacity={1} />
      <View style={ps.sheet}>
        {/* Toolbar */}
        <View style={ps.toolbar}>
          <TouchableOpacity
            onPress={onCancel}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={ps.cancel}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => onConfirm(selMonth, selYear)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={ps.done}>Done</Text>
          </TouchableOpacity>
        </View>

        {/* Drum columns */}
        <View style={ps.drumRow}>
          {/* Center selection bar */}
          <View pointerEvents="none" style={ps.selBar} />

          {/* Month */}
          <View style={ps.col}>
            <FlatList
              ref={monthRef}
              data={MONTH_NAMES}
              keyExtractor={(_, i) => `m${i}`}
              snapToInterval={ITEM_H}
              decelerationRate="fast"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={ps.colContent}
              getItemLayout={(_, i) => ({ length: ITEM_H, offset: ITEM_H * i, index: i })}
              onMomentumScrollEnd={(e) => {
                const idx = Math.round(e.nativeEvent.contentOffset.y / ITEM_H);
                setSelMonth(Math.max(1, Math.min(idx + 1, 12)));
              }}
              renderItem={({ item, index }) => (
                <View style={ps.item}>
                  <Text style={[ps.itemText, index === selMonth - 1 && ps.itemSel]}>
                    {item}
                  </Text>
                </View>
              )}
            />
            <LinearGradient
              colors={[colors.surfaceElevated, "transparent"]}
              style={ps.fadeTop}
              pointerEvents="none"
            />
            <LinearGradient
              colors={["transparent", colors.surfaceElevated]}
              style={ps.fadeBot}
              pointerEvents="none"
            />
          </View>

          {/* Year */}
          <View style={ps.col}>
            <FlatList
              ref={yearRef}
              data={YEAR_LIST}
              keyExtractor={(y) => `y${y}`}
              snapToInterval={ITEM_H}
              decelerationRate="fast"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={ps.colContent}
              getItemLayout={(_, i) => ({ length: ITEM_H, offset: ITEM_H * i, index: i })}
              onMomentumScrollEnd={(e) => {
                const idx = Math.round(e.nativeEvent.contentOffset.y / ITEM_H);
                const clamped = Math.max(0, Math.min(idx, YEAR_LIST.length - 1));
                setSelYear(YEAR_LIST[clamped]);
              }}
              renderItem={({ item }) => (
                <View style={ps.item}>
                  <Text style={[ps.itemText, item === selYear && ps.itemSel]}>
                    {item}
                  </Text>
                </View>
              )}
            />
            <LinearGradient
              colors={[colors.surfaceElevated, "transparent"]}
              style={ps.fadeTop}
              pointerEvents="none"
            />
            <LinearGradient
              colors={["transparent", colors.surfaceElevated]}
              style={ps.fadeBot}
              pointerEvents="none"
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const ps = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  sheet: {
    backgroundColor: colors.surfaceElevated,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: 44,
  },
  toolbar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  cancel: {
    color: colors.textSecondary,
    fontSize: 16,
  },
  done: {
    color: colors.accent,
    fontSize: 16,
    fontWeight: "600",
  },
  drumRow: {
    flexDirection: "row",
    height: PICKER_H,
    paddingHorizontal: 20,
    overflow: "hidden",
  },
  selBar: {
    position: "absolute",
    left: 20,
    right: 20,
    top: ITEM_H * 2,
    height: ITEM_H,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.18)",
  },
  col: {
    flex: 1,
    overflow: "hidden",
  },
  colContent: {
    paddingVertical: ITEM_H * 2,
  },
  item: {
    height: ITEM_H,
    justifyContent: "center",
    alignItems: "center",
  },
  itemText: {
    color: colors.textMuted,
    fontSize: 17,
  },
  itemSel: {
    color: colors.textPrimary,
    fontWeight: "500",
  },
  fadeTop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: ITEM_H * 2,
  },
  fadeBot: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: ITEM_H * 2,
  },
});

// ─── Helpers ───────────────────────────────────────────────────────────────────

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

// ─── Screen ────────────────────────────────────────────────────────────────────

export default function HomeScreen({ navigation }) {
  const today = todayStr();
  const [currentMonth, setCurrentMonth] = useState(today.slice(0, 7) + "-01");
  const [calendarKey, setCalendarKey] = useState(0);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [markedDates, setMarkedDates] = useState({});
  const [todayMoments, setTodayMoments] = useState([]);
  const [loadingAuto, setLoadingAuto] = useState(false);
  const [profile, setProfile] = useState(null);

  const displayYear = parseInt(currentMonth.slice(0, 4));
  const displayMonth = parseInt(currentMonth.slice(5, 7));

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
        if (!dots[m.date].dots.find((d) => d.color === dotColor)) {
          dots[m.date].dots.push({ color: dotColor, key: m.autoSaveType || "manual" });
        }
      }
      if (!dots[today]) dots[today] = { dots: [] };
      dots[today].selected = true;
      dots[today].selectedColor = colors.accent;
      setMarkedDates(dots);
    } catch {
      // Non-critical
    }
  }

  async function loadTodayMoments() {
    try {
      const moments = await getMomentsForDate(today);
      setTodayMoments(moments);
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
      const mlbPlay = await getTopPlay({ limit: 1 });
      if (mlbPlay) {
        await saveMoment(mlbPlay, { isAutoSaved: true, autoSaveType: "mlb" });
      }
      if (favoriteTeam) {
        const teamPlay = await getTopPlay({ team: favoriteTeam, limit: 1 });
        if (teamPlay && teamPlay.play_id !== mlbPlay?.play_id) {
          await saveMoment(teamPlay, { isAutoSaved: true, autoSaveType: "team" });
        }
      }
      const fresh = await getMomentsForDate(today);
      setTodayMoments(fresh);
      loadCalendarDots(currentMonth);
    } catch {
      // Auto-save is best-effort
    } finally {
      setLoadingAuto(false);
    }
  }

  function onDayPress(day) {
    prefetchMoments(day.dateString, () => getMomentsForDate(day.dateString));
    prefetchHighlights(day.dateString, null, () =>
      getHighlights({ date: day.dateString, team: null, limit: 50 })
    );
    navigation.navigate("Day", { date: day.dateString });
  }

  function onMonthChange(month) {
    setCurrentMonth(month.dateString);
    loadCalendarDots(month.dateString);
  }

  function openPicker() {
    setPickerVisible(true);
  }

  function confirmPicker(month, year) {
    const dateStr = `${year}-${String(month).padStart(2, "0")}-01`;
    setCurrentMonth(dateStr);
    loadCalendarDots(dateStr);
    setCalendarKey((k) => k + 1);
    setPickerVisible(false);
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
        key={calendarKey}
        current={currentMonth}
        minDate="2017-01-01"
        onDayPress={onDayPress}
        onMonthChange={onMonthChange}
        markingType="multi-dot"
        markedDates={markedDates}
        renderHeader={() => (
          <TouchableOpacity
            onPress={openPicker}
            style={styles.calendarHeaderBtn}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 16, right: 16 }}
          >
            <Text style={styles.calendarHeaderText}>
              {MONTH_NAMES[displayMonth - 1]} {displayYear}
            </Text>
            <Ionicons
              name="chevron-down"
              size={13}
              color={colors.textSecondary}
              style={{ marginLeft: 5, marginTop: 1 }}
            />
          </TouchableOpacity>
        )}
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

      <MonthYearPicker
        visible={pickerVisible}
        initialMonth={displayMonth}
        initialYear={displayYear}
        onConfirm={confirmPicker}
        onCancel={() => setPickerVisible(false)}
      />
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
  calendarHeaderBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 4,
  },
  calendarHeaderText: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: "300",
    letterSpacing: 0.5,
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
