/**
 * WelcomeScreen — shown to unauthenticated users.
 * Offers Apple Sign-In and Google Sign-In.
 */

import React, { useEffect, useState } from "react";
import * as WebBrowser from "expo-web-browser";

// Must be called at module level in the screen that handles the OAuth redirect
WebBrowser.maybeCompleteAuthSession();
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Platform,
  Alert,
  TouchableOpacity,
} from "react-native";
import * as AppleAuthentication from "expo-apple-authentication";
import { Ionicons } from "@expo/vector-icons";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../services/firebase";
import { signInWithApple, useGoogleAuth } from "../services/auth";
import colors from "../constants/colors";

export default function WelcomeScreen({ navigation }) {
  const [loading, setLoading] = useState(false);
  const googleAuth = useGoogleAuth();

  // Handle Google OAuth response when it comes back
  useEffect(() => {
    if (googleAuth.response?.type === "success") {
      setLoading(true);
      googleAuth
        .handleResponse(googleAuth.response)
        .catch((err) => Alert.alert("Google Sign-In failed", err.message))
        .finally(() => setLoading(false));
    }
  }, [googleAuth.response]);

  async function handleApple() {
    setLoading(true);
    try {
      await signInWithApple();
    } catch (err) {
      if (err.code !== "ERR_REQUEST_CANCELED") {
        Alert.alert("Apple Sign-In failed", err.message);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setLoading(true);
    try {
      await googleAuth.promptAsync();
    } catch (err) {
      Alert.alert("Google Sign-In failed", err.message);
      setLoading(false);
    }
    // loading is cleared in the useEffect above when response arrives
  }

  return (
    <View style={styles.container}>
      <View style={styles.hero}>
        <Text style={styles.wordmark}>shorthop</Text>
        <Text style={styles.tagline}>your baseball diary</Text>
      </View>

      <View style={styles.buttons}>
        {Platform.OS === "ios" && (
          <AppleAuthentication.AppleAuthenticationButton
            buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
            buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
            cornerRadius={10}
            style={styles.appleButton}
            onPress={handleApple}
          />
        )}

        <TouchableOpacity
          style={styles.googleButton}
          onPress={handleGoogle}
          disabled={!googleAuth.request || loading}
          activeOpacity={0.8}
        >
          <Ionicons name="logo-google" size={18} color={colors.textPrimary} style={styles.googleIcon} />
          <Text style={styles.googleText}>Continue with Google</Text>
        </TouchableOpacity>
      </View>

      {loading && (
        <ActivityIndicator
          color={colors.textSecondary}
          style={styles.spinner}
        />
      )}

      <Text style={styles.fine}>
        No passwords. We only store your saved moments.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 32,
    paddingTop: 120,
    paddingBottom: 60,
  },
  hero: {
    alignItems: "center",
  },
  wordmark: {
    color: colors.textPrimary,
    fontSize: 42,
    fontWeight: "200",
    letterSpacing: 6,
    marginBottom: 10,
  },
  tagline: {
    color: colors.textSecondary,
    fontSize: 14,
    letterSpacing: 2,
  },
  buttons: {
    width: "100%",
    gap: 12,
  },
  appleButton: {
    width: "100%",
    height: 50,
  },
  googleButton: {
    width: "100%",
    height: 50,
    backgroundColor: colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  googleIcon: {
    marginRight: 10,
  },
  googleText: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: "500",
  },
  spinner: {
    marginTop: 20,
  },
  fine: {
    color: colors.textMuted,
    fontSize: 12,
    textAlign: "center",
  },
});
