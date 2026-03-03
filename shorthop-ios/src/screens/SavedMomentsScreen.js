/**
 * SavedMomentsScreen — chronological list of all saved moments, grouped by month.
 * Scrolls to the month currently visible on the home calendar when opened.
 */

import React, { useState, useCallback, useRef, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { getAllMoments } from "../services/moments";
import { useCalendar } from "../context/CalendarContext";
import MomentCard from "../components/MomentCard";
import colors from "../constants/colors";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function formatMonthHeader(yyyyMm) {
  const [y, m] = yyyyMm.split("-").map(Number);
  return `${MONTH_NAMES[m - 1]} ${y}`;
}

export default function SavedMomentsScreen({ navigation }) {
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(true);
  const { currentMonth } = useCalendar();
  const scrollRef = useRef(null);
  const sectionOffsets = useRef({});
  const didScroll = useRef(false);

  useFocusEffect(
    useCallback(() => {
      didScroll.current = false;
      load();
    }, [])
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
        .sort((a, b) => (a > b ? -1 : 1))
        .map((key) => ({
          month: key,
          moments: grouped[key].sort((a, b) => b.date.localeCompare(a.date)),
        }));

      setSections(sorted);
    } catch {
      setSections([]);
    } finally {
      setLoading(false);
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
        <Text style={styles.empty}>No moments saved yet.{"\n"}Tap any day on the calendar to add one.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.wordmark}>moments</Text>
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
              <MomentCard
                key={moment.id}
                moment={moment}
                onPress={() => navigation.navigate("Day", { date: moment.date })}
              />
            ))}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
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
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
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
});
