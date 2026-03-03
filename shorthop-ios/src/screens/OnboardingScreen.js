/**
 * OnboardingScreen — shown once after first sign-in to pick a favorite team.
 * Saves the selection to the user's Firestore profile.
 */

import React, { useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from "react-native";
import { setUserProfile } from "../services/moments";
import { auth } from "../services/firebase";
import { TEAMS } from "../constants/teams";
import staticColors from "../constants/colors";
import { useTheme } from "../context/ThemeContext";

export default function OnboardingScreen({ navigation }) {
  const { colors: themeColors } = useTheme();
  const [selected, setSelected] = useState(null);
  const [saving, setSaving] = useState(false);

  async function handleContinue() {
    if (!selected) {
      Alert.alert("Pick your team", "Select a team to continue.");
      return;
    }
    setSaving(true);
    try {
      await setUserProfile({
        favoriteTeam: selected,
        displayName: auth.currentUser?.displayName || "",
        createdAt: new Date().toISOString(),
      });
      // Navigation is handled by AppNavigator reacting to profile state
    } catch (err) {
      Alert.alert("Error", err.message);
    } finally {
      setSaving(false);
    }
  }

  function renderTeam({ item }) {
    const isSelected = selected === item.code;
    return (
      <TouchableOpacity
        style={[styles.teamRow, isSelected && styles.teamRowSelected]}
        onPress={() => setSelected(item.code)}
        activeOpacity={0.7}
      >
        <View style={[styles.teamDot, { backgroundColor: item.color }]} />
        <Text style={[styles.teamName, isSelected && styles.teamNameSelected]}>
          {item.name}
        </Text>
        {isSelected && (
          <View style={[styles.check, { backgroundColor: themeColors.accent }]}>
            <Text style={styles.checkmark}>✓</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Pick your team.</Text>
      <Text style={styles.sub}>
        We'll auto-save your team's top play every day.
      </Text>

      <FlatList
        data={TEAMS}
        keyExtractor={(t) => t.code}
        renderItem={renderTeam}
        style={styles.list}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 20 }}
      />

      <TouchableOpacity
        style={[
          styles.continueBtn,
          { backgroundColor: themeColors.accent },
          !selected && styles.continueBtnDisabled,
        ]}
        onPress={handleContinue}
        disabled={!selected || saving}
        activeOpacity={0.85}
      >
        {saving ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.continueBtnText}>Let's go</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: staticColors.background,
    paddingHorizontal: 20,
    paddingTop: 60,
  },
  heading: {
    color: staticColors.textPrimary,
    fontSize: 28,
    fontWeight: "300",
    letterSpacing: 1,
    marginBottom: 8,
  },
  sub: {
    color: staticColors.textSecondary,
    fontSize: 14,
    marginBottom: 24,
  },
  list: {
    flex: 1,
  },
  teamRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 13,
    paddingHorizontal: 14,
    borderRadius: 8,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: "transparent",
  },
  teamRowSelected: {
    borderColor: staticColors.border,
    backgroundColor: staticColors.surface,
  },
  teamDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 12,
  },
  teamName: {
    color: staticColors.textSecondary,
    fontSize: 15,
    flex: 1,
  },
  teamNameSelected: {
    color: staticColors.textPrimary,
    fontWeight: "500",
  },
  check: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  checkmark: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
  },
  continueBtn: {
    borderRadius: 10,
    paddingVertical: 15,
    alignItems: "center",
    marginBottom: 40,
    marginTop: 16,
  },
  continueBtnDisabled: {
    opacity: 0.4,
  },
  continueBtnText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "600",
  },
});
