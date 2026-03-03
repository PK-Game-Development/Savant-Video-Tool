/**
 * GamePlaysScreen — all at-bat plays from a single game, grouped by inning.
 * Tap a play to save it as a moment.
 */

import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  View,
  Text,
  SectionList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { getGamePlays } from "../services/savantApi";
import { saveMoment, getSavedPlayIds } from "../services/moments";
import { invalidateMoments } from "../services/prefetch";
import { teamByCode, eventLabel } from "../constants/teams";
import { useTheme } from "../context/ThemeContext";

const ORDINALS = ["", "1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th", "9th", "10th", "11th", "12th"];

function ordinal(n) {
  return ORDINALS[n] || `${n}th`;
}

function PlayRow({ play, saved, saving, onPress, colors, styles, highlighted }) {
  const label = eventLabel(play.event);
  const isHit = ["single", "double", "triple", "home_run"].includes(play.event);
  const isScore = play.is_scoring;
  const halfLabel = play.half_inning === "top" ? "▲" : "▼";

  return (
    <TouchableOpacity
      style={[styles.row, saved && styles.rowSaved, highlighted && styles.rowHighlighted]}
      onPress={onPress}
      activeOpacity={0.75}
      disabled={saved || saving}
    >
      <View style={styles.rowLeft}>
        <Text style={styles.inningChip}>
          {halfLabel}{play.inning}
        </Text>
      </View>

      <View style={styles.rowCenter}>
        <Text style={styles.playerName} numberOfLines={1}>{play.player}</Text>
        <View style={styles.eventRow}>
          <View style={[styles.eventDot, { backgroundColor: isHit ? "#4CAF50" : isScore ? "#FFA726" : colors.textMuted }]} />
          <Text style={styles.eventLabel} numberOfLines={1}>{label}</Text>
        </View>
        <Text style={styles.desc} numberOfLines={2}>{play.description}</Text>
      </View>

      <View style={styles.rowRight}>
        <Text style={styles.scoreChip}>
          {play.away_score}–{play.home_score}
        </Text>
        {saving ? (
          <ActivityIndicator size="small" color={colors.textMuted} style={{ marginTop: 6 }} />
        ) : saved ? (
          <Ionicons
            name="checkmark-circle"
            size={20}
            color={colors.autoSaveTeam}
            style={{ marginTop: 6 }}
          />
        ) : (
          <Ionicons name="add-circle-outline" size={20} color={colors.textMuted} style={{ marginTop: 6 }} />
        )}
      </View>
    </TouchableOpacity>
  );
}

export default function GamePlaysScreen({ route, navigation }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { gamePk, date, awayAbbr, homeAbbr, awayScore, homeScore, status, highlightPlayId } =
    route.params;
  const sectionListRef = useRef(null);

  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savedPlayIds, setSavedPlayIds] = useState(new Set());
  const [savingId, setSavingId] = useState(null);

  const awayTeam = teamByCode(awayAbbr);
  const homeTeam = teamByCode(homeAbbr);

  useEffect(() => {
    load();
    getSavedPlayIds(date).then(setSavedPlayIds).catch(() => {});
  }, [gamePk]);

  useEffect(() => {
    if (!highlightPlayId || sections.length === 0) return;
    let targetSection = -1;
    let targetItem = -1;
    for (let s = 0; s < sections.length; s += 1) {
      const idx = sections[s].data.findIndex((p) => p.play_id === highlightPlayId);
      if (idx >= 0) {
        targetSection = s;
        targetItem = idx;
        break;
      }
    }
    if (targetSection < 0 || targetItem < 0) return;
    const t = setTimeout(() => {
      sectionListRef.current?.scrollToLocation?.({
        sectionIndex: targetSection,
        itemIndex: targetItem,
        viewPosition: 0.5,
        animated: true,
      });
    }, 120);
    return () => clearTimeout(t);
  }, [sections, highlightPlayId]);

  async function load() {
    setLoading(true);
    try {
      const data = await getGamePlays(gamePk, date);
      setSections(groupByInning(data.plays || []));
    } catch (err) {
      Alert.alert("Could not load plays", err.message);
    } finally {
      setLoading(false);
    }
  }

  function groupByInning(plays) {
    // Group into half-inning sections: top then bottom for each inning
    const map = new Map();
    for (const play of plays) {
      const key = `${play.inning}-${play.half_inning}`;
      if (!map.has(key)) {
        const half = play.half_inning === "top" ? "Top" : "Bot";
        map.set(key, { title: `${half} ${ordinal(play.inning)}`, key, data: [] });
      }
      map.get(key).data.push(play);
    }
    return Array.from(map.values());
  }

  async function handleSave(play) {
    setSavingId(play.play_id);
    try {
      await saveMoment(play, { isAutoSaved: false, autoSaveType: null });
      invalidateMoments(date);
      setSavedPlayIds((prev) => new Set([...prev, play.play_id]));
    } catch (err) {
      Alert.alert("Error saving moment", err.message);
    } finally {
      setSavingId(null);
    }
  }

  const isFinal = status?.toLowerCase().includes("final");

  return (
    <View style={styles.container}>
      {/* Header scoreboard */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="chevron-back" size={26} color={colors.textPrimary} />
        </TouchableOpacity>

        <View style={styles.scoreboard}>
          <View style={styles.scoreTeam}>
            <View style={[styles.teamBar, { backgroundColor: awayTeam?.color || colors.textMuted }]} />
            <Text style={styles.scoreAbbr}>{awayAbbr}</Text>
            <Text style={styles.scoreNum}>{awayScore ?? "—"}</Text>
          </View>
          <View style={styles.scoreMiddle}>
            <Text style={styles.statusLabel}>{isFinal ? "FINAL" : status?.toUpperCase()}</Text>
          </View>
          <View style={[styles.scoreTeam, styles.scoreTeamRight]}>
            <View style={[styles.teamBar, { backgroundColor: homeTeam?.color || colors.textMuted }]} />
            <Text style={styles.scoreAbbr}>{homeAbbr}</Text>
            <Text style={styles.scoreNum}>{homeScore ?? "—"}</Text>
          </View>
        </View>

        <View style={{ width: 26 }} />
      </View>

      {loading ? (
        <ActivityIndicator color={colors.textSecondary} style={styles.loader} />
      ) : (
        <SectionList
          ref={sectionListRef}
          sections={sections}
          keyExtractor={(play) => play.play_id}
          onScrollToIndexFailed={() => {}}
          stickySectionHeadersEnabled
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          renderSectionHeader={({ section }) => (
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{section.title.toUpperCase()}</Text>
            </View>
          )}
          renderItem={({ item }) => (
            <PlayRow
              play={item}
              colors={colors}
              styles={styles}
              saved={savedPlayIds.has(item.play_id)}
              saving={savingId === item.play_id}
              highlighted={item.play_id === highlightPlayId}
              onPress={() => handleSave(item)}
            />
          )}
          ListEmptyComponent={
            <Text style={styles.empty}>No plays found for this game.</Text>
          }
        />
      )}
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  scoreboard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  scoreTeam: {
    alignItems: "center",
  },
  scoreTeamRight: {
    alignItems: "center",
  },
  teamBar: {
    width: 24,
    height: 3,
    borderRadius: 2,
    marginBottom: 4,
  },
  scoreAbbr: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.5,
  },
  scoreNum: {
    color: colors.textPrimary,
    fontSize: 22,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  scoreMiddle: {
    alignItems: "center",
  },
  statusLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 1,
  },
  loader: { marginTop: 60 },
  listContent: { paddingBottom: 40 },
  sectionHeader: {
    backgroundColor: colors.background,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sectionTitle: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.5,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowHighlighted: {
    borderLeftWidth: 3,
    borderLeftColor: colors.accent,
    backgroundColor: colors.surfaceElevated,
  },
  rowSaved: {
    opacity: 0.5,
  },
  rowLeft: {
    width: 36,
    alignItems: "center",
    paddingTop: 2,
  },
  inningChip: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "600",
  },
  rowCenter: {
    flex: 1,
    marginHorizontal: 10,
  },
  playerName: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 3,
  },
  eventRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 3,
  },
  eventDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  eventLabel: {
    color: colors.textSecondary,
    fontSize: 12,
  },
  desc: {
    color: colors.textMuted,
    fontSize: 11,
    lineHeight: 15,
  },
  rowRight: {
    alignItems: "center",
    width: 40,
  },
  scoreChip: {
    color: colors.textMuted,
    fontSize: 11,
    fontVariant: ["tabular-nums"],
  },
  empty: {
    color: colors.textMuted,
    fontSize: 14,
    textAlign: "center",
    marginTop: 60,
    paddingHorizontal: 32,
  },
  });
}
