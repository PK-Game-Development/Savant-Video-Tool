/**
 * ProfileScreen — stats, favorite team, account settings, sign out.
 * Tab screen — no back button.
 */

import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useCallback } from "react";
import { auth } from "../services/firebase";
import { signOut } from "../services/auth";
import { getUserProfile, setUserProfile, getAllMoments } from "../services/moments";
import { TEAMS } from "../constants/teams";
import colors from "../constants/colors";

export default function ProfileScreen() {
  const [profile, setProfile] = useState(null);
  const [editingTeam, setEditingTeam] = useState(false);
  const [saving, setSaving] = useState(false);
  const [stats, setStats] = useState(null);

  useFocusEffect(
    useCallback(() => {
      getUserProfile().then(setProfile).catch(() => {});
      loadStats();
    }, [])
  );

  async function loadStats() {
    try {
      const all = await getAllMoments();
      const totalMoments = all.length;
      const distinctDays = new Set(all.map((m) => m.date)).size;
      const distinctMonths = new Set(all.map((m) => m.date.slice(0, 7))).size;
      setStats({ totalMoments, distinctDays, distinctMonths });
    } catch {
      setStats(null);
    }
  }

  async function handleSelectTeam(code) {
    setSaving(true);
    try {
      await setUserProfile({ favoriteTeam: code });
      setProfile((p) => ({ ...p, favoriteTeam: code }));
      setEditingTeam(false);
    } catch (err) {
      Alert.alert("Error", err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleSignOut() {
    Alert.alert("Sign out?", "You'll need to sign in again to access your moments.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: async () => {
          try {
            await signOut();
          } catch (err) {
            Alert.alert("Error", err.message);
          }
        },
      },
    ]);
  }

  const user = auth.currentUser;
  const currentTeam = TEAMS.find((t) => t.code === profile?.favoriteTeam);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.wordmark}>profile</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Stats */}
        {stats && (
          <>
            <Text style={styles.sectionLabel}>YOUR STATS</Text>
            <View style={styles.statsRow}>
              <View style={styles.statCard}>
                <Text style={styles.statNumber}>{stats.totalMoments}</Text>
                <Text style={styles.statLabel}>moments</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statNumber}>{stats.distinctDays}</Text>
                <Text style={styles.statLabel}>days</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statNumber}>{stats.distinctMonths}</Text>
                <Text style={styles.statLabel}>months</Text>
              </View>
            </View>
          </>
        )}

        {/* Account */}
        <Text style={styles.sectionLabel}>ACCOUNT</Text>
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Signed in as</Text>
          <Text style={styles.cardValue} numberOfLines={1}>
            {user?.displayName || user?.email || "User"}
          </Text>
        </View>

        {/* Favorite team */}
        <Text style={styles.sectionLabel}>YOUR TEAM</Text>
        <TouchableOpacity
          style={styles.card}
          onPress={() => setEditingTeam(!editingTeam)}
          activeOpacity={0.75}
        >
          <View style={styles.cardRow}>
            <View>
              <Text style={styles.cardLabel}>Favorite team</Text>
              <View style={styles.teamDisplay}>
                {currentTeam && (
                  <View style={[styles.teamDot, { backgroundColor: currentTeam.color }]} />
                )}
                <Text style={styles.cardValue}>
                  {currentTeam?.name || "None selected"}
                </Text>
              </View>
            </View>
            <Ionicons
              name={editingTeam ? "chevron-up" : "chevron-down"}
              size={18}
              color={colors.textMuted}
            />
          </View>
        </TouchableOpacity>

        {editingTeam && (
          <View style={styles.teamList}>
            {TEAMS.map((t) => (
              <TouchableOpacity
                key={t.code}
                style={[
                  styles.teamRow,
                  t.code === profile?.favoriteTeam && styles.teamRowSelected,
                ]}
                onPress={() => handleSelectTeam(t.code)}
                disabled={saving}
              >
                <View style={[styles.teamRowDot, { backgroundColor: t.color }]} />
                <Text
                  style={[
                    styles.teamRowName,
                    t.code === profile?.favoriteTeam && styles.teamRowNameSelected,
                  ]}
                >
                  {t.name}
                </Text>
                {saving && t.code === profile?.favoriteTeam && (
                  <ActivityIndicator size="small" color={colors.textMuted} />
                )}
                {t.code === profile?.favoriteTeam && !saving && (
                  <Ionicons name="checkmark" size={16} color={colors.accent} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* About */}
        <Text style={styles.sectionLabel}>ABOUT</Text>
        <View style={styles.card}>
          <Text style={styles.cardLabel}>How auto-save works</Text>
          <Text style={styles.cardBody}>
            Every day, Shorthop saves the highest Win Probability Added (WPA) play for MLB and for
            your team. Clips are posted by MLB a few hours after games go final — usually by morning.
            You can always add your own plays too.
          </Text>
        </View>

        {/* Sign out */}
        <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut} activeOpacity={0.8}>
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  wordmark: {
    color: colors.textPrimary,
    fontSize: 22,
    fontWeight: "200",
    letterSpacing: 4,
  },
  content: {
    padding: 20,
    paddingBottom: 60,
  },
  sectionLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 1.5,
    marginBottom: 8,
    marginTop: 24,
  },
  statsRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 4,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 14,
    alignItems: "center",
  },
  statNumber: {
    color: colors.textPrimary,
    fontSize: 24,
    fontWeight: "200",
    letterSpacing: 1,
  },
  statLabel: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 1,
    marginTop: 3,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 4,
  },
  cardRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cardLabel: {
    color: colors.textMuted,
    fontSize: 11,
    marginBottom: 4,
  },
  cardValue: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: "400",
  },
  cardBody: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 20,
    marginTop: 4,
  },
  teamDisplay: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  teamDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  teamList: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 4,
    overflow: "hidden",
  },
  teamRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  teamRowSelected: {
    backgroundColor: colors.surfaceElevated,
  },
  teamRowDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 10,
  },
  teamRowName: {
    flex: 1,
    color: colors.textSecondary,
    fontSize: 14,
  },
  teamRowNameSelected: {
    color: colors.textPrimary,
    fontWeight: "500",
  },
  signOutBtn: {
    marginTop: 40,
    backgroundColor: colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 14,
    alignItems: "center",
  },
  signOutText: {
    color: colors.accent,
    fontSize: 16,
    fontWeight: "500",
  },
});
