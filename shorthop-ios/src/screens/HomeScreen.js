/**
 * HomeScreen — minimalist calendar with moment dots + yesterday team preview.
 *
 * Calendar dots:
 *   White dot = manually saved moment
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
  Animated,
  Dimensions,
  Easing,
} from "react-native";
import { Calendar } from "react-native-calendars";
import { LinearGradient } from "expo-linear-gradient";
import { GestureDetector, Gesture } from "react-native-gesture-handler";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../services/firebase";
import {
  getMomentsInRange,
  getMomentsForDate,
  getUserProfile,
  recordLoginDate,
  getLoginDatesInRange,
} from "../services/moments";
import { getHighlights, getGames, getGamePlays } from "../services/savantApi";
import { prefetchMoments, prefetchHighlights } from "../services/prefetch";
import MomentCard from "../components/MomentCard";
import colors from "../constants/colors";
import { teamName } from "../constants/teams";
import { useCalendar } from "../context/CalendarContext";
import { useTheme } from "../context/ThemeContext";

const SCREEN_W = Dimensions.get("window").width;

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

// ─── Calendar slide-in wrapper ────────────────────────────────────────────────

function CalendarSlide({ direction, swipeGesture, children }) {
  const translateX = useRef(
    new Animated.Value(
      direction === "forward"  ?  SCREEN_W :
      direction === "backward" ? -SCREEN_W : 0
    )
  ).current;

  useEffect(() => {
    if (!direction) return;
    Animated.timing(translateX, {
      toValue: 0,
      duration: 280,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, []);

  return (
    <GestureDetector gesture={swipeGesture}>
      <Animated.View style={{ transform: [{ translateX }] }}>
        {children}
      </Animated.View>
    </GestureDetector>
  );
}

// ─── Drum-roll picker ──────────────────────────────────────────────────────────

function MonthYearPicker({ visible, initialMonth, initialYear, onConfirm, onCancel, themeColors }) {
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
      <View style={[ps.sheet, { backgroundColor: themeColors.surfaceElevated }]}>
        {/* Toolbar */}
        <View style={[ps.toolbar, { borderBottomColor: themeColors.border }]}>
          <TouchableOpacity
            onPress={onCancel}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={[ps.cancel, { color: themeColors.textSecondary }]}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => onConfirm(selMonth, selYear)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={[ps.done, { color: themeColors.accent }]}>Done</Text>
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
                  <Text
                    style={[
                      ps.itemText,
                      { color: themeColors.textMuted },
                      index === selMonth - 1 && ps.itemSel,
                      index === selMonth - 1 && { color: themeColors.textPrimary },
                    ]}
                  >
                    {item}
                  </Text>
                </View>
              )}
            />
            <LinearGradient
              colors={[themeColors.surfaceElevated, "transparent"]}
              style={ps.fadeTop}
              pointerEvents="none"
            />
            <LinearGradient
              colors={["transparent", themeColors.surfaceElevated]}
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
                  <Text
                    style={[
                      ps.itemText,
                      { color: themeColors.textMuted },
                      item === selYear && ps.itemSel,
                      item === selYear && { color: themeColors.textPrimary },
                    ]}
                  >
                    {item}
                  </Text>
                </View>
              )}
            />
            <LinearGradient
              colors={[themeColors.surfaceElevated, "transparent"]}
              style={ps.fadeTop}
              pointerEvents="none"
            />
            <LinearGradient
              colors={["transparent", themeColors.surfaceElevated]}
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

function yesterdayStr() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split("T")[0];
}

function monthRange(dateStr) {
  const [y, m] = dateStr.split("-").map(Number);
  const start = `${y}-${String(m).padStart(2, "0")}-01`;
  const lastDay = new Date(y, m, 0).getDate();
  const end = `${y}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return { start, end };
}

function normalizeMonthStart(dateStr) {
  const [y, m] = String(dateStr || "").split("-").map(Number);
  if (!Number.isFinite(y) || !Number.isFinite(m)) return todayStr().slice(0, 7) + "-01";
  return `${y}-${String(m).padStart(2, "0")}-01`;
}

// ─── Screen ────────────────────────────────────────────────────────────────────

export default function HomeScreen({ navigation }) {
  const { colors: themeColors, themeTeamCode } = useTheme();
  const calendarShellColor = "#1F1F1F";
  const today = todayStr();
  const yesterday = yesterdayStr();
  const [currentMonth, setCurrentMonth] = useState(normalizeMonthStart(today));
  const themedCalendarKey = `${currentMonth}-${calendarShellColor}-${themeColors.textPrimary}`;
  const { setCurrentMonth: setContextMonth } = useCalendar();
  const [animDirection, setAnimDirection] = useState(null);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [markedDates, setMarkedDates] = useState({});
  const [previewMoments, setPreviewMoments] = useState([]);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [profile, setProfile] = useState(null);

  const displayYear = parseInt(currentMonth.slice(0, 4));
  const displayMonth = parseInt(currentMonth.slice(5, 7));

  // Keep CalendarContext in sync so SavedMomentsScreen knows where to scroll
  useEffect(() => {
    setContextMonth(currentMonth);
  }, [currentMonth]);

  // Reload calendar dots and preview moments whenever the screen is focused.
  // This keeps suggested plays in sync when favorite team changes in Profile.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      recordLoginDate(today).catch(() => {});
      loadCalendarDots(currentMonth);
      getUserProfile()
        .then((nextProfile) => {
          if (!active) return;
          setProfile(nextProfile || null);
          loadPreviewMoments(nextProfile || null);
        })
        .catch(() => {
          if (!active) return;
          setProfile(null);
          setPreviewMoments([]);
          setLoadingPreview(false);
        });
      return () => {
        active = false;
      };
    }, [currentMonth, themeColors, today])
  );

  async function loadCalendarDots(monthStart) {
    const { start, end } = monthRange(monthStart);
    try {
      const [moments, loginDates] = await Promise.all([
        getMomentsInRange(start, end),
        getLoginDatesInRange(start, end),
      ]);

      const loginSet = new Set(loginDates);
      const marked = {};

      // Moment dots per date
      for (const m of moments) {
        if (!marked[m.date]) marked[m.date] = { dots: [] };
        const dotColor = colors.manualSave;
        if (!marked[m.date].dots.find((d) => d.color === dotColor)) {
          marked[m.date].dots.push({ color: dotColor });
        }
      }

      // Days with both a login and a saved moment → red number
      for (const date of loginSet) {
        if (marked[date] && date !== today) {
          marked[date].textColor = themeColors.accent;
        }
      }

      // Today → gold number (always)
      if (!marked[today]) marked[today] = { dots: [] };
      marked[today].textColor = colors.today;

      setMarkedDates(marked);
    } catch {
      // Non-critical
    }
  }

  async function loadPreviewMoments(profileArg = profile) {
    setLoadingPreview(true);
    try {
      if (!profileArg?.favoriteTeam) {
        setPreviewMoments([]);
        return;
      }
      const gamesResp = await getGames(yesterday);
      const games = gamesResp?.games || [];
      const gameMap = new Map(games.map((g) => [String(g.game_pk), g]));
      const relevantGames = games.filter(
        (g) =>
          g?.away?.abbr?.toUpperCase() === profileArg.favoriteTeam ||
          g?.home?.abbr?.toUpperCase() === profileArg.favoriteTeam
      );

      const playsByGame = await Promise.all(
        relevantGames.map((g) => getGamePlays(g.game_pk, yesterday).catch(() => ({ plays: [] })))
      );
      const videos = playsByGame.flatMap((r) => r?.plays || []).slice(-8).reverse();

      setPreviewMoments(
        videos.map((v) => ({
          id: `preview_${v.play_id}`,
          date: yesterday,
          playId: v.play_id,
          gamePk: v.game_pk,
          playerName: v.player || v.batter_name || "",
          event: v.event,
          description: v.description || "",
          battingTeam: v.batting_team || "",
          pitchingTeam: v.pitching_team || "",
          inning: Number(v.inning) || 0,
          halfInning: v.half_inning || "",
          outs: Number(v.outs) || 0,
          balls: Number(v.balls) || 0,
          strikes: Number(v.strikes) || 0,
          onFirst: Boolean(v.on_first),
          onSecond: Boolean(v.on_second),
          onThird: Boolean(v.on_third),
          savantUrl: v.savant_url || "",
          awayAbbr: gameMap.get(String(v.game_pk))?.away?.abbr || "",
          homeAbbr: gameMap.get(String(v.game_pk))?.home?.abbr || "",
          awayScore: gameMap.get(String(v.game_pk))?.away?.score,
          homeScore: gameMap.get(String(v.game_pk))?.home?.score,
          gameStatus: gameMap.get(String(v.game_pk))?.status || "",
        }))
      );
    } catch {
      setPreviewMoments([]);
    } finally {
      setLoadingPreview(false);
    }
  }

  function onDayPress(day) {
    prefetchMoments(day.dateString, () => getMomentsForDate(day.dateString));
    prefetchHighlights(day.dateString, null, () =>
      getHighlights({ date: day.dateString, team: null, limit: 50 })
    );
    navigation.push("Day", { date: day.dateString });
  }

  function onMonthChange(month) {
    const monthStart = normalizeMonthStart(month.dateString);
    setCurrentMonth(monthStart);
    loadCalendarDots(monthStart);
  }

  function openPicker() {
    setPickerVisible(true);
  }

  function confirmPicker(month, year) {
    const dateStr = `${year}-${String(month).padStart(2, "0")}-01`;
    setAnimDirection(dateStr > currentMonth ? "forward" : "backward");
    setCurrentMonth(dateStr);
    loadCalendarDots(dateStr);
    setPickerVisible(false);
  }

  function goToMonth(delta) {
    const [y, m] = currentMonth.split("-").map(Number);
    let nm = m + delta;
    let ny = y;
    if (nm > 12) { nm = 1; ny += 1; }
    if (nm < 1)  { nm = 12; ny -= 1; }
    if (ny < 2017) return;
    const todayYear = parseInt(today.slice(0, 4));
    const todayMon  = parseInt(today.slice(5, 7));
    if (ny > todayYear || (ny === todayYear && nm > todayMon)) return;
    const dateStr = `${ny}-${String(nm).padStart(2, "0")}-01`;
    setAnimDirection(delta > 0 ? "forward" : "backward");
    setCurrentMonth(dateStr);
    loadCalendarDots(dateStr);
  }

  const calendarSwipe = Gesture.Pan()
    .runOnJS(true)
    .activeOffsetX([-25, 25])
    .failOffsetY([-20, 20])
    .onEnd((e) => {
      if (e.translationX < -40) goToMonth(1);
      else if (e.translationX > 40) goToMonth(-1);
    });

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: themeColors.background }]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <Text style={[styles.wordmark, { color: themeColors.textPrimary }]}>shorthop</Text>
      </View>

      <View
        style={[
          styles.calendarWrapper,
          {
            backgroundColor: calendarShellColor,
            borderColor: themeTeamCode === "SHORTHOP" ? themeColors.border : themeColors.accent,
          },
        ]}
      >
        <CalendarSlide
          key={themedCalendarKey}
          direction={animDirection}
          swipeGesture={calendarSwipe}
        >
          <Calendar
            key={themedCalendarKey}
            current={currentMonth}
            minDate="2017-01-01"
            onDayPress={onDayPress}
            onMonthChange={onMonthChange}
            onPressArrowLeft={() => goToMonth(-1)}
            onPressArrowRight={() => goToMonth(1)}
            markedDates={markedDates}
            dayComponent={({ date, state, marking, onPress }) => {
              if (!date) return <View />;
              const isDisabled = state === "disabled";
              const isToday = date.dateString === today;
              const yearNum = Number(date.year);
              const isJackieRobinsonDay =
                yearNum >= 2017 && Number(date.month) === 4 && Number(date.day) === 15;
              const textColor = isDisabled
                ? themeColors.textMuted
                : marking?.textColor || themeColors.textPrimary;
              const dayLabel = isJackieRobinsonDay ? "42" : String(date.day);
              const dayLabelColor = isJackieRobinsonDay ? "#005A9C" : textColor;
              return (
                <TouchableOpacity
                  onPress={() => onPress(date)}
                  style={styles.dayCell}
                  activeOpacity={0.6}
                  disabled={isDisabled}
                >
                  <View
                    style={[
                      styles.dayNumWrap,
                      isToday && styles.dayNumWrapToday,
                      isJackieRobinsonDay && styles.dayNumWrapJackie,
                    ]}
                  >
                    <Text
                      style={[
                        styles.dayNum,
                        { color: dayLabelColor },
                        isJackieRobinsonDay && styles.dayNumJackie,
                      ]}
                    >
                      {dayLabel}
                    </Text>
                  </View>
                  {marking?.dots?.length > 0 && (
                    <View style={styles.dayDots}>
                      {marking.dots.slice(0, 3).map((dot, i) => (
                        <View
                          key={i}
                          style={[styles.dayDot, { backgroundColor: dot.color }]}
                        />
                      ))}
                    </View>
                  )}
                </TouchableOpacity>
              );
            }}
            renderHeader={() => (
              <TouchableOpacity
                onPress={openPicker}
                style={styles.calendarHeaderBtn}
                activeOpacity={0.7}
                hitSlop={{ top: 8, bottom: 8, left: 16, right: 16 }}
              >
                <Text style={[styles.calendarHeaderText, { color: themeColors.textPrimary }]}>
                  {MONTH_NAMES[displayMonth - 1]} {displayYear}
                </Text>
                <Ionicons
                  name="chevron-down"
                  size={13}
                  color={themeColors.textSecondary}
                  style={{ marginLeft: 5, marginTop: 1 }}
                />
              </TouchableOpacity>
            )}
            theme={{
              backgroundColor: calendarShellColor,
              calendarBackground: calendarShellColor,
              textSectionTitleColor: themeColors.textMuted,
              arrowColor: themeColors.textSecondary,
              disabledArrowColor: themeColors.textMuted,
              monthTextColor: themeColors.textPrimary,
              textDayHeaderFontSize: 11,
              textMonthFontSize: 16,
              textMonthFontWeight: "300",
            }}
            style={styles.calendar}
          />
        </CalendarSlide>
      </View>

      {/* Favorite team preview strip */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: themeColors.textMuted }]}>
            YESTERDAY'S TEAM PREVIEW
          </Text>
          {loadingPreview && (
            <ActivityIndicator size="small" color={themeColors.textMuted} />
          )}
        </View>

        {!profile?.favoriteTeam && !loadingPreview && (
          <Text style={[styles.empty, { color: themeColors.textMuted }]}>
            Pick a favorite team in Profile to see yesterday's preview moments.
          </Text>
        )}

        {profile?.favoriteTeam && previewMoments.length === 0 && !loadingPreview && (
          <Text style={[styles.empty, { color: themeColors.textMuted }]}>
            No preview moments found for {teamName(profile.favoriteTeam)} on {yesterday}.
          </Text>
        )}

        {previewMoments.map((moment) => (
          <View key={moment.id}>
            <Text style={[styles.autoSaveLabel, { color: themeColors.textMuted }]}>
              {teamName(profile?.favoriteTeam || "")}
            </Text>
            <MomentCard
              moment={moment}
              compact
              onPress={() =>
                navigation.navigate("GamePlays", {
                  gamePk: moment.gamePk,
                  date: moment.date,
                  awayAbbr: moment.awayAbbr,
                  homeAbbr: moment.homeAbbr,
                  awayScore: moment.awayScore,
                  homeScore: moment.homeScore,
                  status: moment.gameStatus,
                  highlightPlayId: moment.playId,
                })
              }
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
        themeColors={themeColors}
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
    paddingBottom: 90,
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
  calendarWrapper: {
    overflow: "hidden",
    marginHorizontal: 8,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  calendar: {
    marginHorizontal: 0,
  },
  dayCell: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 4,
    flex: 1,
  },
  dayNumWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  dayNumWrapToday: {
    borderWidth: 1,
    borderColor: colors.today,
  },
  dayNumWrapJackie: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: "#005A9C",
  },
  dayNum: {
    fontSize: 14,
  },
  dayNumJackie: {
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  dayDots: {
    flexDirection: "row",
    gap: 3,
    marginTop: 2,
  },
  dayDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
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
