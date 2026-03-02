/**
 * DayScreen — shows all saved moments for a selected date.
 * Long-press a moment to delete it.
 */

import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Linking,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { getMomentsForDate, deleteMoment } from "../services/moments";
import MomentCard from "../components/MomentCard";
import colors from "../constants/colors";
import { eventLabel } from "../constants/teams";

function formatHeaderDate(dateStr) {
  // "2024-10-15" → "Tuesday, Oct 15"
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
}

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
      const data = await getMomentsForDate(date);
      setMoments(data);
    } catch {
      setMoments([]);
    } finally {
      setLoading(false);
    }
  }

  function handleLongPress(moment) {
    Alert.alert(
      "Delete moment?",
      `Remove "${eventLabel(moment.event)} — ${moment.playerName}" from this day?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteMoment(moment.id);
              setMoments((prev) => prev.filter((m) => m.id !== moment.id));
            } catch (err) {
              Alert.alert("Error", err.message);
            }
          },
        },
      ]
    );
  }

  function openSavantUrl(moment) {
    if (moment.savantUrl) {
      Linking.openURL(moment.savantUrl).catch(() =>
        Alert.alert("Could not open link")
      );
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
      {/* Header */}
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
          <MomentCard
            moment={item}
            onPress={() => openSavantUrl(item)}
            onLongPress={() => handleLongPress(item)}
          />
        )}
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />

      {/* Add Moment button */}
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
