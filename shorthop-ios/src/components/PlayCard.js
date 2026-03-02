/**
 * PlayCard — a selectable play row in AddMomentScreen.
 *
 * Props:
 *   video    — play object from Flask API
 *   saved    — true if this play is already saved (shows checkmark)
 *   onPress  — called when the card is tapped
 */

import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import colors from "../constants/colors";
import { eventLabel } from "../constants/teams";

export default function PlayCard({ video, saved = false, onPress }) {
  const label = eventLabel(video.event);
  const wpaNum = parseFloat(video.wpa) || 0;
  const wpaSign = wpaNum >= 0 ? "+" : "";
  const wpaColor = wpaNum > 0 ? "#4CAF50" : wpaNum < 0 ? colors.accent : colors.textSecondary;

  return (
    <TouchableOpacity
      style={[styles.card, saved && styles.cardSaved]}
      onPress={onPress}
      activeOpacity={0.75}
      disabled={saved}
    >
      <View style={styles.left}>
        <Text style={styles.player} numberOfLines={1}>
          {video.player || video.batter_name}
        </Text>
        <Text style={styles.event} numberOfLines={1}>
          {label}
          {video.batting_team && video.pitching_team
            ? `  ·  ${video.batting_team} vs ${video.pitching_team}`
            : ""}
        </Text>
        {video.description ? (
          <Text style={styles.desc} numberOfLines={2}>
            {video.description}
          </Text>
        ) : null}
      </View>

      <View style={styles.right}>
        <Text style={[styles.wpa, { color: wpaColor }]}>
          {wpaSign}{wpaNum.toFixed(2)}
        </Text>
        {saved ? (
          <Ionicons
            name="checkmark-circle"
            size={20}
            color={colors.autoSaveTeam}
            style={styles.icon}
          />
        ) : (
          <Ionicons
            name="add-circle-outline"
            size={20}
            color={colors.textMuted}
            style={styles.icon}
          />
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: "row",
    alignItems: "flex-start",
  },
  cardSaved: {
    borderColor: colors.autoSaveTeam,
    opacity: 0.7,
  },
  left: {
    flex: 1,
    marginRight: 12,
  },
  player: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 2,
  },
  event: {
    color: colors.textSecondary,
    fontSize: 12,
    marginBottom: 4,
  },
  desc: {
    color: colors.textMuted,
    fontSize: 11,
    lineHeight: 15,
  },
  right: {
    alignItems: "flex-end",
    justifyContent: "space-between",
    minHeight: 44,
  },
  wpa: {
    fontSize: 16,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  icon: {
    marginTop: 8,
  },
});
