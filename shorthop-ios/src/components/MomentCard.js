/**
 * MomentCard — displays a saved moment in DayScreen and SavedMomentsScreen.
 */

import React, { useMemo } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { eventLabel } from "../constants/teams";
import { useTheme } from "../context/ThemeContext";
import SituationGraphic from "./SituationGraphic";

const MOMENT_BG = "#1F1F1F";

function formatMomentDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(`${dateStr}T12:00:00`);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function MomentCard({ moment, onPress, onLongPress, compact = false }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const label = eventLabel(moment.event);
  const dateLabel = formatMomentDate(moment.date);

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
          <Text style={styles.compactDate}>{dateLabel}</Text>
        </View>
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
      <View style={styles.leftCol}>
        <Text style={styles.playerName} numberOfLines={1}>
          {moment.playerName}
        </Text>
        <SituationGraphic moment={moment} colors={colors} />
      </View>

      <View style={styles.rightCol}>
        <Text style={styles.eventText} numberOfLines={1}>
          {label}
        </Text>
        <Text style={styles.dateText}>{dateLabel}</Text>
        <Text style={styles.matchup} numberOfLines={1}>
          {moment.battingTeam} vs {moment.pitchingTeam}
        </Text>
        {moment.description ? (
          <Text style={styles.desc} numberOfLines={2}>
            {moment.description}
          </Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

function makeStyles(colors) {
  return StyleSheet.create({
    card: {
      backgroundColor: MOMENT_BG,
      borderRadius: 10,
      padding: 14,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: colors.border,
      flexDirection: "row",
      gap: 12,
    },
    leftCol: {
      width: 128,
    },
    rightCol: {
      flex: 1,
      justifyContent: "flex-start",
    },
    playerName: {
      color: colors.textPrimary,
      fontSize: 16,
      fontWeight: "600",
    },
    eventText: {
      color: colors.textPrimary,
      fontSize: 14,
      fontWeight: "600",
      marginBottom: 2,
    },
    dateText: {
      color: colors.textSecondary,
      fontSize: 12,
      marginBottom: 2,
    },
    matchup: {
      color: colors.textMuted,
      fontSize: 12,
      marginBottom: 4,
    },
    desc: {
      color: colors.textSecondary,
      fontSize: 12,
      lineHeight: 17,
    },

    compactCard: {
      backgroundColor: MOMENT_BG,
      borderRadius: 8,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 8,
    },
    compactLeft: {
      flex: 1,
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
    compactDate: {
      color: colors.textMuted,
      fontSize: 11,
      marginTop: 2,
    },
  });
}
