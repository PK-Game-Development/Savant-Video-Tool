/**
 * PlayCard — a selectable play row in AddMomentScreen.
 *
 * Props:
 *   video    — play object from Flask API
 *   saved    — true if this play is already saved (shows checkmark)
 *   onPress  — called when the card is tapped
 */

import React, { useMemo } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { eventLabel } from "../constants/teams";
import { useTheme } from "../context/ThemeContext";

export default function PlayCard({ video, saved = false, onPress }) {
  const { colors: themeColors } = useTheme();
  const styles = useMemo(() => makeStyles(themeColors), [themeColors]);
  const label = eventLabel(video.event);

  return (
    <TouchableOpacity
      style={[
        styles.card,
        saved && styles.cardSaved,
        saved && styles.themeCardSaved,
        saved && { borderColor: themeColors.autoSaveTeam },
      ]}
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
        {saved ? (
          <Ionicons
            name="checkmark-circle"
            size={20}
            color={themeColors.autoSaveTeam}
            style={styles.icon}
          />
        ) : (
          <Ionicons
            name="add-circle-outline"
            size={20}
            color={themeColors.textMuted}
            style={styles.icon}
          />
        )}
      </View>
    </TouchableOpacity>
  );
}

function makeStyles(colors) {
  return StyleSheet.create({
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
  themeCardSaved: {},
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
    justifyContent: "center",
    minHeight: 24,
  },
  icon: {
    marginTop: 8,
  },
  });
}
