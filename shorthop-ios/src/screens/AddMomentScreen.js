/**
 * AddMomentScreen — shows scoreboard cards for every game on the selected date.
 * Tap a game to browse its plays in GamePlaysScreen.
 */

import React, { useState, useEffect, useMemo } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { getGames } from "../services/savantApi";
import { teamByCode } from "../constants/teams";
import { useTheme } from "../context/ThemeContext";

function formatShortDate(dateStr) {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function ScoreboardCard({ game, onPress, colors, styles }) {
  const awayTeam = teamByCode(game.away.abbr);
  const homeTeam = teamByCode(game.home.abbr);
  const awayColor = awayTeam?.color || colors.textMuted;
  const homeColor = homeTeam?.color || colors.textMuted;

  const isLive = game.abstract_state === "Live";
  const isFinal = game.abstract_state === "Final";
  const isPreview = game.abstract_state === "Preview";

  const awayWin = isFinal && game.away.score > game.home.score;
  const homeWin = isFinal && game.home.score > game.away.score;

  let statusText = game.status;
  if (isLive && game.inning) {
    statusText = `${game.inning_state?.charAt(0) || ""}${game.inning}`;
  }

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.75}
      disabled={isPreview}
    >
      {/* Away team */}
      <View style={styles.teamBlock}>
        <View style={[styles.teamColorBar, { backgroundColor: awayColor }]} />
        <Text style={[styles.abbr, !awayWin && isFinal && styles.abbrLoser]}>
          {game.away.abbr}
        </Text>
        <Text style={[styles.teamName, !awayWin && isFinal && styles.teamNameLoser]}>
          {game.away.name}
        </Text>
      </View>

      {/* Scores + status */}
      <View style={styles.center}>
        {isPreview ? (
          <Text style={styles.previewText}>Upcoming</Text>
        ) : (
          <View style={styles.scoreRow}>
            <Text style={[styles.score, !awayWin && isFinal && styles.scoreDim]}>
              {game.away.score ?? "—"}
            </Text>
            <Text style={styles.scoreDash}>–</Text>
            <Text style={[styles.score, !homeWin && isFinal && styles.scoreDim]}>
              {game.home.score ?? "—"}
            </Text>
          </View>
        )}
        <View style={[styles.statusBadge, isLive && styles.statusLive]}>
          <Text style={[styles.statusText, isLive && styles.statusTextLive]}>
            {isLive ? "● " : ""}{statusText}
          </Text>
        </View>
      </View>

      {/* Home team */}
      <View style={[styles.teamBlock, styles.teamBlockRight]}>
        <View style={[styles.teamColorBar, { backgroundColor: homeColor }]} />
        <Text style={[styles.abbr, !homeWin && isFinal && styles.abbrLoser]}>
          {game.home.abbr}
        </Text>
        <Text style={[styles.teamName, !homeWin && isFinal && styles.teamNameLoser]}>
          {game.home.name}
        </Text>
      </View>

      {!isPreview && (
        <Ionicons name="chevron-forward" size={16} color={colors.textMuted} style={styles.chevron} />
      )}
    </TouchableOpacity>
  );
}

export default function AddMomentScreen({ route, navigation }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { date } = route.params;
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, [date]);

  async function load() {
    setLoading(true);
    try {
      const data = await getGames(date);
      setGames(data.games || []);
    } catch (err) {
      Alert.alert("Could not load games", err.message);
    } finally {
      setLoading(false);
    }
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
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Add Moment</Text>
          <Text style={styles.headerDate}>{formatShortDate(date)}</Text>
        </View>
        <View style={{ width: 26 }} />
      </View>

      {loading ? (
        <ActivityIndicator color={colors.textSecondary} style={styles.loader} />
      ) : (
        <FlatList
          data={games}
          keyExtractor={(g) => g.game_pk}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <Text style={styles.empty}>No games found for this date.</Text>
          }
          renderItem={({ item }) => (
            <ScoreboardCard
              game={item}
              colors={colors}
              styles={styles}
              onPress={() =>
                navigation.navigate("GamePlays", {
                  gamePk: item.game_pk,
                  date,
                  awayAbbr: item.away.abbr,
                  homeAbbr: item.home.abbr,
                  awayScore: item.away.score,
                  homeScore: item.home.score,
                  status: item.status,
                })
              }
            />
          )}
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
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerCenter: { alignItems: "center" },
  headerTitle: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: "600",
  },
  headerDate: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  loader: { marginTop: 60 },
  list: { padding: 16 },
  empty: {
    color: colors.textMuted,
    fontSize: 14,
    textAlign: "center",
    marginTop: 60,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 14,
    overflow: "hidden",
  },
  teamBlock: {
    flex: 1,
    alignItems: "flex-start",
  },
  teamBlockRight: {
    alignItems: "flex-end",
  },
  teamColorBar: {
    width: 28,
    height: 3,
    borderRadius: 2,
    marginBottom: 6,
  },
  abbr: {
    color: colors.textPrimary,
    fontSize: 22,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  abbrLoser: {
    color: colors.textMuted,
  },
  teamName: {
    color: colors.textSecondary,
    fontSize: 11,
    marginTop: 2,
  },
  teamNameLoser: {
    color: colors.textMuted,
  },
  center: {
    alignItems: "center",
    paddingHorizontal: 12,
  },
  scoreRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },
  score: {
    color: colors.textPrimary,
    fontSize: 26,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
    minWidth: 28,
    textAlign: "center",
  },
  scoreDim: {
    color: colors.textMuted,
  },
  scoreDash: {
    color: colors.textMuted,
    fontSize: 18,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    backgroundColor: colors.surfaceElevated,
  },
  statusLive: {
    backgroundColor: "#1a3a1a",
  },
  statusText: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  statusTextLive: {
    color: "#4CAF50",
  },
  previewText: {
    color: colors.textMuted,
    fontSize: 12,
    fontStyle: "italic",
  },
  chevron: {
    marginLeft: 4,
  },
  });
}
