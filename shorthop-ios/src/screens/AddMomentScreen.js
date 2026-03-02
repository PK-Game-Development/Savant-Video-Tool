/**
 * AddMomentScreen — browse plays for a given date and save one.
 *
 * Search modes:
 *   1. Default: top 15 WPA plays for the date (all teams)
 *   2. Team filter: top plays for the selected team
 *   3. Player search: type a name → pick a player → see their plays that day
 */

import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Keyboard,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { getHighlights, searchPlayers, getPlayerPlays } from "../services/savantApi";
import { saveMoment, getSavedPlayIds } from "../services/moments";
import PlayCard from "../components/PlayCard";
import colors from "../constants/colors";
import { TEAMS } from "../constants/teams";

function formatShortDate(dateStr) {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function AddMomentScreen({ route, navigation }) {
  const { date } = route.params;

  const [query, setQuery] = useState("");
  const [mode, setMode] = useState("highlights"); // "highlights" | "player" | "team"
  const [plays, setPlays] = useState([]);
  const [playerResults, setPlayerResults] = useState([]);
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [savedPlayIds, setSavedPlayIds] = useState(new Set());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(null); // play_id being saved
  const [showTeamPicker, setShowTeamPicker] = useState(false);
  const playerSearchTimer = useRef(null);

  // Load default highlights and saved play IDs on mount
  useEffect(() => {
    loadHighlights();
    getSavedPlayIds(date).then(setSavedPlayIds).catch(() => {});
  }, [date]);

  async function loadHighlights(team = null) {
    setLoading(true);
    setPlays([]);
    try {
      const data = await getHighlights({ date, team, limit: 15 });
      setPlays(data.videos || []);
    } catch (err) {
      Alert.alert("Could not load plays", err.message);
    } finally {
      setLoading(false);
    }
  }

  // Debounced player search
  useEffect(() => {
    if (query.length < 2) {
      setPlayerResults([]);
      return;
    }
    clearTimeout(playerSearchTimer.current);
    playerSearchTimer.current = setTimeout(async () => {
      try {
        const data = await searchPlayers(query);
        setPlayerResults(data.players || []);
      } catch {
        setPlayerResults([]);
      }
    }, 300);
    return () => clearTimeout(playerSearchTimer.current);
  }, [query]);

  async function selectPlayer(player) {
    Keyboard.dismiss();
    setSelectedPlayer(player);
    setPlayerResults([]);
    setQuery(player.name);
    setMode("player");
    setLoading(true);
    setPlays([]);
    try {
      const data = await getPlayerPlays(player.mlb_id, date);
      setPlays(data.videos || []);
      if ((data.videos || []).length === 0) {
        Alert.alert("No plays found", `${player.name} didn't have a plate appearance on this date.`);
      }
    } catch (err) {
      Alert.alert("Error", err.message);
    } finally {
      setLoading(false);
    }
  }

  function selectTeam(team) {
    setSelectedTeam(team.code);
    setShowTeamPicker(false);
    setQuery("");
    setSelectedPlayer(null);
    setMode("team");
    loadHighlights(team.code);
  }

  function clearSearch() {
    setQuery("");
    setSelectedPlayer(null);
    setSelectedTeam(null);
    setMode("highlights");
    setPlayerResults([]);
    loadHighlights(null);
  }

  async function handleSave(video) {
    setSaving(video.play_id);
    try {
      await saveMoment(video, { isAutoSaved: false, autoSaveType: null });
      setSavedPlayIds((prev) => new Set([...prev, video.play_id]));
    } catch (err) {
      Alert.alert("Error saving moment", err.message);
    } finally {
      setSaving(null);
    }
  }

  const hasQuery = query.length >= 2 && !selectedPlayer;

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
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Add Moment</Text>
          <Text style={styles.headerDate}>{formatShortDate(date)}</Text>
        </View>
        <View style={{ width: 26 }} />
      </View>

      {/* Search bar */}
      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={16} color={colors.textMuted} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search player or team..."
            placeholderTextColor={colors.textMuted}
            value={query}
            onChangeText={(t) => {
              setQuery(t);
              setSelectedPlayer(null);
              if (t.length === 0) clearSearch();
            }}
            autoCorrect={false}
            autoCapitalize="words"
            returnKeyType="search"
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={clearSearch} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close-circle" size={16} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity
          style={[styles.teamBtn, selectedTeam && styles.teamBtnActive]}
          onPress={() => setShowTeamPicker(!showTeamPicker)}
          activeOpacity={0.8}
        >
          <Text style={styles.teamBtnText}>{selectedTeam || "Team"}</Text>
        </TouchableOpacity>
      </View>

      {/* Team picker dropdown */}
      {showTeamPicker && (
        <View style={styles.teamPicker}>
          <ScrollView style={{ maxHeight: 240 }} nestedScrollEnabled>
            {TEAMS.map((t) => (
              <TouchableOpacity
                key={t.code}
                style={styles.teamPickerRow}
                onPress={() => selectTeam(t)}
              >
                <View style={[styles.teamPickerDot, { backgroundColor: t.color }]} />
                <Text style={styles.teamPickerName}>{t.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Player autocomplete dropdown */}
      {hasQuery && playerResults.length > 0 && (
        <View style={styles.playerDropdown}>
          {playerResults.slice(0, 6).map((p) => (
            <TouchableOpacity
              key={p.mlb_id}
              style={styles.playerRow}
              onPress={() => selectPlayer(p)}
            >
              <Text style={styles.playerRowName}>{p.name}</Text>
              <Text style={styles.playerRowMeta}>{p.position} · {p.team}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Section label */}
      <Text style={styles.sectionLabel}>
        {mode === "player" && selectedPlayer
          ? selectedPlayer.name.toUpperCase()
          : mode === "team" && selectedTeam
          ? `${selectedTeam} · TOP PLAYS`
          : "TOP PLAYS TODAY"}
      </Text>

      {/* Play list */}
      {loading ? (
        <ActivityIndicator color={colors.textSecondary} style={styles.loader} />
      ) : (
        <FlatList
          data={plays}
          keyExtractor={(v) => v.play_id}
          renderItem={({ item }) => (
            <PlayCard
              video={item}
              saved={savedPlayIds.has(item.play_id)}
              onPress={() => handleSave(item)}
            />
          )}
          ListEmptyComponent={
            <Text style={styles.empty}>No plays found for this date.</Text>
          }
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        />
      )}
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
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerCenter: {
    alignItems: "center",
  },
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
  searchRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
    alignItems: "center",
  },
  searchBox: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 10,
    height: 40,
  },
  searchIcon: {
    marginRight: 6,
  },
  searchInput: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 14,
  },
  teamBtn: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    height: 40,
    justifyContent: "center",
  },
  teamBtnActive: {
    borderColor: colors.accent,
  },
  teamBtnText: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: "600",
  },
  teamPicker: {
    position: "absolute",
    top: 168,
    right: 16,
    width: 230,
    backgroundColor: colors.surfaceElevated,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    zIndex: 100,
    shadowColor: "#000",
    shadowOpacity: 0.6,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 10,
  },
  teamPickerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  teamPickerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 10,
  },
  teamPickerName: {
    color: colors.textPrimary,
    fontSize: 13,
  },
  playerDropdown: {
    marginHorizontal: 16,
    backgroundColor: colors.surfaceElevated,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 4,
    zIndex: 50,
  },
  playerRow: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  playerRowName: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: "500",
  },
  playerRowMeta: {
    color: colors.textSecondary,
    fontSize: 11,
    marginTop: 1,
  },
  sectionLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 1.5,
    paddingHorizontal: 16,
    marginBottom: 10,
    marginTop: 4,
  },
  loader: {
    marginTop: 60,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
    flexGrow: 1,
  },
  empty: {
    color: colors.textMuted,
    fontSize: 13,
    textAlign: "center",
    marginTop: 40,
  },
});
