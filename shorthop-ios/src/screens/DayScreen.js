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
import { Swipeable, GestureDetector, Gesture } from "react-native-gesture-handler";
import Svg, { Rect, Line, Path } from "react-native-svg";
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

function TrashIcon() {
  return (
    <Svg width={28} height={28} viewBox="0 0 24 24">
      {/* Handle on lid */}
      <Rect x="9" y="1" width="6" height="3" rx="1.5" fill="white" />
      {/* Lid */}
      <Rect x="3" y="4" width="18" height="3" rx="1.5" fill="white" />
      {/* Body */}
      <Path d="M5,8 L6.5,22 Q6.7,23 8,23 L16,23 Q17.3,23 17.5,22 L19,8 Z" fill="white" />
      {/* Lines inside */}
      <Line x1="10" y1="11" x2="10" y2="20" stroke="#D32F2F" strokeWidth="1.5" strokeLinecap="round" />
      <Line x1="14" y1="11" x2="14" y2="20" stroke="#D32F2F" strokeWidth="1.5" strokeLinecap="round" />
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
        <TrashIcon />
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

  function navigateDay(delta) {
    const d = new Date(date + "T12:00:00");
    d.setDate(d.getDate() + delta);
    const newDate = d.toISOString().split("T")[0];
    // Don't go before Savant video archive
    if (newDate < "2017-01-01") return;
    // Don't go into the future
    if (newDate > new Date().toISOString().split("T")[0]) return;
    navigation.replace("Day", { date: newDate });
  }

  const daySwipe = Gesture.Pan()
    .runOnJS(true)
    .activeOffsetX([-50, 50])
    .failOffsetY([-20, 20])
    .onEnd((e) => {
      if (e.translationX < -60) navigateDay(1);
      else if (e.translationX > 60) navigateDay(-1);
    });

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
    <GestureDetector gesture={daySwipe}>
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
    </GestureDetector>
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
