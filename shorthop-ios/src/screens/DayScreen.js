/**
 * DayScreen — shows all saved moments for a selected date.
 * Swipe left on a card to reveal the delete button.
 */

import React, { useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  LayoutAnimation,
  Platform,
  UIManager,
} from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import Svg, { Rect, Line, Path, Circle } from "react-native-svg";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { getMomentsForDate, deleteMoment } from "../services/moments";
import { consumeMoments, invalidateMoments } from "../services/prefetch";
import VideoMomentCard from "../components/VideoMomentCard";
import colors from "../constants/colors";

if (Platform.OS === "android") {
  UIManager.setLayoutAnimationEnabledExperimental?.(true);
}

function formatHeaderDate(dateStr) {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
}

// ─── Bat-hits-trashcan SVG icon ───────────────────────────────────────────────

function BatTrashIcon() {
  return (
    <Svg width={52} height={52} viewBox="0 0 60 60">
      {/* ── Trash can ── */}
      {/* Knob on lid */}
      <Rect x="42" y="10" width="6" height="5" rx="2" fill="white" />
      {/* Lid (slightly wider than body) */}
      <Rect x="36" y="15" width="18" height="5" rx="2" fill="white" />
      {/* Body */}
      <Rect x="38" y="20" width="14" height="24" rx="2" fill="white" />
      {/* Trash lines inside body (in the red button color so they read as cutouts) */}
      <Line x1="40.5" y1="26" x2="49.5" y2="26" stroke="#D32F2F" strokeWidth="2" strokeLinecap="round" />
      <Line x1="40.5" y1="31" x2="49.5" y2="31" stroke="#D32F2F" strokeWidth="2" strokeLinecap="round" />
      <Line x1="40.5" y1="36" x2="49.5" y2="36" stroke="#D32F2F" strokeWidth="2" strokeLinecap="round" />

      {/* ── Baseball bat ── */}
      {/* Handle — thin */}
      <Path
        d="M 4,55 C 8,51 20,38 27,27"
        stroke="white"
        strokeWidth="3.5"
        strokeLinecap="round"
        fill="none"
      />
      {/* Barrel — wider, hitting the lid */}
      <Path
        d="M 27,27 C 30,22 33,18 37,14"
        stroke="white"
        strokeWidth="8"
        strokeLinecap="round"
        fill="none"
      />
      {/* Barrel tip cap */}
      <Circle cx="37" cy="14" r="4" fill="white" />

      {/* ── Impact lines (comic-style "WHAM" lines) ── */}
      {/* Up */}
      <Line x1="33" y1="12" x2="30" y2="4"  stroke="white" strokeWidth="2.5" strokeLinecap="round" />
      {/* Up-left */}
      <Line x1="28" y1="15" x2="21" y2="9"  stroke="white" strokeWidth="2"   strokeLinecap="round" />
      {/* Left */}
      <Line x1="26" y1="22" x2="17" y2="20" stroke="white" strokeWidth="2"   strokeLinecap="round" />
      {/* Down-left */}
      <Line x1="27" y1="30" x2="18" y2="35" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
      {/* Up-right */}
      <Line x1="38" y1="10" x2="44" y2="4"  stroke="white" strokeWidth="2"   strokeLinecap="round" />
    </Svg>
  );
}

// ─── Swipeable wrapper ────────────────────────────────────────────────────────

function SwipeableMomentCard({ moment, onDelete }) {
  const swipeRef = useRef(null);

  function renderRightActions() {
    return (
      <TouchableOpacity
        style={styles.deleteAction}
        onPress={() => {
          swipeRef.current?.close();
          onDelete();
        }}
        activeOpacity={0.85}
      >
        <BatTrashIcon />
      </TouchableOpacity>
    );
  }

  return (
    <Swipeable
      ref={swipeRef}
      renderRightActions={renderRightActions}
      rightThreshold={60}
      overshootRight={false}
      friction={2}
    >
      <VideoMomentCard moment={moment} />
    </Swipeable>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function DayScreen({ route, navigation }) {
  const { date } = route.params;
  const [moments, setMoments] = useState([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [date])
  );

  async function load() {
    setLoading(true);
    try {
      const data = await consumeMoments(date, () => getMomentsForDate(date));
      setMoments(data);
    } catch {
      setMoments([]);
    } finally {
      invalidateMoments(date);
      setLoading(false);
    }
  }

  async function handleDelete(moment) {
    try {
      await deleteMoment(moment.id);
      invalidateMoments(date);
      LayoutAnimation.easeInEaseOut();
      setMoments((prev) => prev.filter((m) => m.id !== moment.id));
    } catch (err) {
      // silently ignore — card stays visible
    }
  }

  function renderEmpty() {
    if (loading) return null;
    return (
      <Text style={styles.empty}>
        No moments saved for this day.{"\n"}Tap below to add one.
      </Text>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="chevron-back" size={26} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.dateTitle}>{formatHeaderDate(date)}</Text>
        <View style={{ width: 26 }} />
      </View>

      <FlatList
        data={moments}
        keyExtractor={(m) => m.id}
        renderItem={({ item }) => (
          <SwipeableMomentCard
            moment={item}
            onDelete={() => handleDelete(item)}
          />
        )}
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />

      <TouchableOpacity
        style={styles.addButton}
        onPress={() => navigation.navigate("AddMoment", { date })}
        activeOpacity={0.85}
      >
        <Ionicons name="add" size={20} color="#fff" style={{ marginRight: 6 }} />
        <Text style={styles.addButtonText}>Add a moment</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  dateTitle: {
    color: colors.textPrimary,
    fontSize: 17,
    fontWeight: "300",
    letterSpacing: 0.5,
  },
  listContent: {
    padding: 16,
    flexGrow: 1,
  },
  empty: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 22,
    textAlign: "center",
    marginTop: 60,
  },
  deleteAction: {
    backgroundColor: "#D32F2F",
    justifyContent: "center",
    alignItems: "center",
    width: 90,
    marginBottom: 14, // matches VideoMomentCard marginBottom
    borderRadius: 12,
    marginLeft: 8,
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.accent,
    marginHorizontal: 20,
    marginBottom: 36,
    paddingVertical: 14,
    borderRadius: 10,
  },
  addButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});
