/**
 * Authentication service — Apple Sign-In and Google Sign-In via Firebase Auth.
 *
 * Apple Sign-In: uses expo-apple-authentication (native iOS credential) → Firebase OAuthProvider
 * Google Sign-In: uses expo-auth-session browser redirect → Firebase GoogleAuthProvider
 *
 * GOOGLE SETUP:
 *   1. In Firebase Console → Authentication → Google → enable and copy the Web Client ID
 *   2. In Google Cloud Console, add your Expo redirect URI to the OAuth client's authorized redirects:
 *      https://auth.expo.io/@YOUR_EXPO_USERNAME/shorthop
 *   3. Replace GOOGLE_WEB_CLIENT_ID below with your actual client ID.
 */

import * as AppleAuthentication from "expo-apple-authentication";
import * as WebBrowser from "expo-web-browser";
import * as Google from "expo-auth-session/providers/google";
import {
  signInWithCredential,
  OAuthProvider,
  GoogleAuthProvider,
  signOut as firebaseSignOut,
} from "firebase/auth";
import { auth } from "./firebase";

WebBrowser.maybeCompleteAuthSession();

// Replace with your Google OAuth Web Client ID from Firebase Console
const GOOGLE_WEB_CLIENT_ID =
  "YOUR_GOOGLE_WEB_CLIENT_ID.apps.googleusercontent.com";

// ─── Apple ───────────────────────────────────────────────────────────────────

export async function signInWithApple() {
  const credential = await AppleAuthentication.signInAsync({
    requestedScopes: [
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      AppleAuthentication.AppleAuthenticationScope.EMAIL,
    ],
  });

  const provider = new OAuthProvider("apple.com");
  const firebaseCredential = provider.credential({
    idToken: credential.identityToken,
    rawNonce: credential.authorizationCode,
  });

  const result = await signInWithCredential(auth, firebaseCredential);
  return result.user;
}

// ─── Google ──────────────────────────────────────────────────────────────────

/**
 * Returns a hook-compatible object. Call this at the top of a component:
 *   const googleAuth = useGoogleAuth();
 *   // then: googleAuth.promptAsync() to start the flow
 *   // then: googleAuth.user once resolved
 */
export function useGoogleAuth() {
  const [request, response, promptAsync] = Google.useAuthRequest({
    webClientId: GOOGLE_WEB_CLIENT_ID,
    selectAccount: true,
  });

  async function handleResponse(resp) {
    if (resp?.type !== "success") return null;
    const { id_token } = resp.params;
    const credential = GoogleAuthProvider.credential(id_token);
    const result = await signInWithCredential(auth, credential);
    return result.user;
  }

  return { request, response, promptAsync, handleResponse };
}

// ─── Sign Out ────────────────────────────────────────────────────────────────

export async function signOut() {
  await firebaseSignOut(auth);
}
