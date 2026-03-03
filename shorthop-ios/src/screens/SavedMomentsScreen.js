/**
 * SavedMomentsScreen — chronological list of all saved moments, grouped by month.
 * Scrolls to the month currently visible on the home calendar when opened.
 */

import React, { useState, useCallback, useRef, useEffect, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import { useFocusEffect } from "@react-navigation/native";
import { getAllMoments, deleteMoment } from "../services/moments";
import { useCalendar } from "../context/CalendarContext";
import MomentCard from "../components/MomentCard";
import { useTheme } from "../context/ThemeContext";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function formatMonthHeader(yyyyMm) {
  const [y, m] = yyyyMm.split("-").map(Number);
  return `${MONTH_NAMES[m - 1]} ${y}`;
}

function removeMomentFromSections(prevSections, momentId) {
  return prevSections
    .map((s) => ({ ...s, moments: s.moments.filter((m) => m.id !== momentId) }))
    .filter((s) => s.moments.length > 0);
}

export default function SavedMomentsScreen({ navigation }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sortOrder, setSortOrder] = useState("desc");
  const { currentMonth } = useCalendar();
  const scrollRef = useRef(null);
  const sectionOffsets = useRef({});
  const didScroll = useRef(false);

  useFocusEffect(
    useCallback(() => {
      didScroll.current = false;
      load();
    }, [sortOrder])
  );

  // Re-scroll when sections load or context month changes
  useEffect(() => {
    if (sections.length > 0 && !didScroll.current) {
      scrollToMonth();
    }
  }, [sections, currentMonth]);

  async function load() {
    setLoading(true);
    try {
      const all = await getAllMoments();

      // Group by YYYY-MM
      const grouped = {};
      for (const m of all) {
        const key = m.date.slice(0, 7);
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(m);
      }

      // Sort months descending, moments within each month descending by date
      const sorted = Object.keys(grouped)
        .sort((a, b) => (sortOrder === "desc" ? b.localeCompare(a) : a.localeCompare(b)))
        .map((key) => ({
          month: key,
          moments: grouped[key].sort((a, b) =>
            sortOrder === "desc" ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date)
          ),
        }));

      setSections(sorted);
    } catch {
      setSections([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteMoment(moment) {
    try {
      await deleteMoment(moment.id);
      setSections((prev) => removeMomentFromSections(prev, moment.id));
    } catch (err) {
      Alert.alert("Could not delete moment", err.message || "Please try again.");
    }
  }

  function scrollToMonth() {
    if (!currentMonth || !scrollRef.current) return;
    const target = currentMonth.slice(0, 7);

    // Find exact match; fall back to closest month at or before target
    let key = target;
    if (sectionOffsets.current[key] === undefined) {
      const keys = Object.keys(sectionOffsets.current).sort();
      const before = keys.filter((k) => k <= target);
      key = before.length ? before[before.length - 1] : keys[0];
    }

    const offset = sectionOffsets.current[key];
    if (offset !== undefined) {
      scrollRef.current.scrollTo({ y: offset, animated: false });
      didScroll.current = true;
    }
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.wordmark}>moments</Text>
        </View>
        <View style={styles.sortRow}>
          <TouchableOpacity
            style={[styles.sortBtn, sortOrder === "desc" && styles.sortBtnActive]}
            onPress={() => setSortOrder("desc")}
            activeOpacity={0.8}
          >
            <Text style={[styles.sortText, sortOrder === "desc" && styles.sortTextActive]}>
              Descending
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.sortBtn, sortOrder === "asc" && styles.sortBtnActive]}
            onPress={() => setSortOrder("asc")}
            activeOpacity={0.8}
          >
            <Text style={[styles.sortText, sortOrder === "asc" && styles.sortTextActive]}>
              Ascending
            </Text>
          </TouchableOpacity>
        </View>
        <ActivityIndicator color={colors.textMuted} style={{ marginTop: 60 }} />
      </View>
    );
  }

  if (sections.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.wordmark}>moments</Text>
        </View>
        <View style={styles.sortRow}>
          <TouchableOpacity
            style={[styles.sortBtn, sortOrder === "desc" && styles.sortBtnActive]}
            onPress={() => setSortOrder("desc")}
            activeOpacity={0.8}
          >
            <Text style={[styles.sortText, sortOrder === "desc" && styles.sortTextActive]}>
              Descending
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.sortBtn, sortOrder === "asc" && styles.sortBtnActive]}
            onPress={() => setSortOrder("asc")}
            activeOpacity={0.8}
          >
            <Text style={[styles.sortText, sortOrder === "asc" && styles.sortTextActive]}>
              Ascending
            </Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.empty}>No moments saved yet.{"\n"}Tap any day on the calendar to add one.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.wordmark}>moments</Text>
      </View>
      <View style={styles.sortRow}>
        <TouchableOpacity
          style={[styles.sortBtn, sortOrder === "desc" && styles.sortBtnActive]}
          onPress={() => setSortOrder("desc")}
          activeOpacity={0.8}
        >
          <Text style={[styles.sortText, sortOrder === "desc" && styles.sortTextActive]}>
            Descending
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.sortBtn, sortOrder === "asc" && styles.sortBtnActive]}
          onPress={() => setSortOrder("asc")}
          activeOpacity={0.8}
        >
          <Text style={[styles.sortText, sortOrder === "asc" && styles.sortTextActive]}>
            Ascending
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
      >
        {sections.map(({ month, moments }) => (
          <View
            key={month}
            onLayout={(e) => {
              sectionOffsets.current[month] = e.nativeEvent.layout.y;
            }}
          >
            <Text style={styles.monthHeader}>{formatMonthHeader(month)}</Text>
            {moments.map((moment) => (
              <Swipeable
                key={moment.id}
                rightThreshold={60}
                overshootRight={false}
                renderRightActions={() => (
                  <TouchableOpacity
                    style={styles.deleteAction}
                    onPress={() => handleDeleteMoment(moment)}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.deleteActionText}>Delete</Text>
                  </TouchableOpacity>
                )}
              >
                <MomentCard
                  moment={moment}
                  onPress={() => navigation.push("Day", { date: moment.date })}
                />
              </Swipeable>
            ))}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

function makeStyles(colors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      paddingHorizontal: 20,
      paddingTop: 60,
      paddingBottom: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    wordmark: {
      color: colors.textPrimary,
      fontSize: 22,
      fontWeight: "200",
      letterSpacing: 4,
    },
    sortRow: {
      flexDirection: "row",
      gap: 8,
      paddingHorizontal: 16,
      paddingTop: 12,
    },
    sortBtn: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    sortBtnActive: {
      borderColor: colors.accent,
      backgroundColor: colors.surfaceElevated,
    },
    sortText: {
      color: colors.textSecondary,
      fontSize: 12,
      fontWeight: "500",
    },
    sortTextActive: {
      color: colors.textPrimary,
    },
    listContent: {
      paddingHorizontal: 16,
      paddingTop: 10,
      paddingBottom: 40,
    },
    monthHeader: {
      color: colors.textMuted,
      fontSize: 11,
      fontWeight: "600",
      letterSpacing: 1.5,
      marginTop: 20,
      marginBottom: 10,
    },
    empty: {
      color: colors.textMuted,
      fontSize: 14,
      lineHeight: 22,
      textAlign: "center",
      marginTop: 80,
      paddingHorizontal: 40,
    },
    deleteAction: {
      backgroundColor: "#7A1E24",
      justifyContent: "center",
      alignItems: "center",
      width: 92,
      marginBottom: 10,
      borderRadius: 10,
      marginLeft: 8,
    },
    deleteActionText: {
      color: "#FFFFFF",
      fontSize: 13,
      fontWeight: "700",
    },
  });
}
