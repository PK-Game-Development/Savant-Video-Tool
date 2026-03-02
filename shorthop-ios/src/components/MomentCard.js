/**
 * MomentCard — displays a saved moment in DayScreen and HomeScreen auto-save strip.
 *
 * Props:
 *   moment       — Firestore moment object
 *   onPress      — optional tap handler
 *   onLongPress  — optional long-press (delete) handler
 *   compact      — if true, renders a smaller version for the auto-save strip
 */

import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import colors from "../constants/colors";
import { eventLabel, teamName } from "../constants/teams";

export default function MomentCard({ moment, onPress, onLongPress, compact = false }) {
  const label = eventLabel(moment.event);
  const wpaNum = parseFloat(moment.wpa) || 0;
  const wpaSign = wpaNum >= 0 ? "+" : "";
  const wpaColor = wpaNum > 0 ? "#4CAF50" : wpaNum < 0 ? colors.accent : colors.textSecondary;

  const autoLabel =
    moment.autoSaveType === "mlb"
      ? "MLB"
      : moment.autoSaveType === "team"
      ? teamName(moment.battingTeam || moment.pitchingTeam)
      : null;

  if (compact) {
    return (
      <TouchableOpacity
        style={styles.compactCard}
        onPress={onPress}
        onLongPress={onLongPress}
        activeOpacity={0.75}
      >
        <View style={styles.compactLeft}>
          <Text style={styles.compactPlayer} numberOfLines={1}>
            {moment.playerName}
          </Text>
          <Text style={styles.compactEvent} numberOfLines={1}>
            {label}
          </Text>
        </View>
        <Text style={[styles.wpa, { color: wpaColor }]}>
          {wpaSign}{wpaNum.toFixed(2)}
        </Text>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      onLongPress={onLongPress}
      activeOpacity={0.75}
    >
      <View style={styles.cardTop}>
        <View style={styles.cardLeft}>
          <Text style={styles.playerName} numberOfLines={1}>
            {moment.playerName}
          </Text>
          <Text style={styles.eventText} numberOfLines={1}>
            {label}
          </Text>
        </View>
        <Text style={[styles.wpa, { color: wpaColor }]}>
          {wpaSign}{wpaNum.toFixed(2)}
        </Text>
      </View>

      <View style={styles.cardBottom}>
        <Text style={styles.matchup} numberOfLines={1}>
          {moment.battingTeam} vs {moment.pitchingTeam}
        </Text>
        {autoLabel && (
          <View style={[
            styles.badge,
            { backgroundColor: moment.autoSaveType === "mlb" ? colors.autoSaveMlb : colors.autoSaveTeam }
          ]}>
            <Text style={styles.badgeText}>{autoLabel}</Text>
          </View>
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
  },
  cardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 6,
  },
  cardLeft: {
    flex: 1,
    marginRight: 12,
  },
  playerName: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 2,
  },
  eventText: {
    color: colors.textSecondary,
    fontSize: 13,
  },
  wpa: {
    fontSize: 17,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  cardBottom: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  matchup: {
    color: colors.textMuted,
    fontSize: 12,
    flex: 1,
  },
  badge: {
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 8,
  },
  badgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "700",
  },

  // Compact (auto-save strip)
  compactCard: {
    backgroundColor: colors.surface,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 8,
  },
  compactLeft: {
    flex: 1,
    marginRight: 10,
  },
  compactPlayer: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: "600",
  },
  compactEvent: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 1,
  },
});
