/**
 * Firebase configuration for Shorthop.
 *
 * SETUP STEPS:
 * 1. Go to https://console.firebase.google.com and create a project named "shorthop"
 * 2. In Project Settings → Your Apps, click "Add app" → iOS
 *    - Bundle ID: com.shorthop.app
 *    - Download GoogleService-Info.plist and place it in shorthop-ios/ (gitignored)
 * 3. Add a Web App as well — copy the firebaseConfig object below
 * 4. Enable Authentication → Sign-in method:
 *    - Apple (requires Apple Developer account)
 *    - Google
 * 5. Enable Firestore Database (start in production mode, then apply rules)
 * 6. Replace the placeholder values below with your actual config.
 */

import { initializeApp, getApps, getApp } from "firebase/app";
import { initializeAuth, getAuth, inMemoryPersistence } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Using inMemoryPersistence to isolate AsyncStorage/getReactNativePersistence issues
// TODO: restore getReactNativePersistence(AsyncStorage) once auth initializes correctly
let auth;
try {
  auth = initializeAuth(app, {
    persistence: inMemoryPersistence,
  });
} catch (e) {
  console.error("[firebase] initializeAuth error:", e);
  try {
    auth = getAuth(app);
  } catch (e2) {
    console.error("[firebase] getAuth fallback also failed:", e2);
  }
}

export { auth };
export const db = getFirestore(app);
export default app;
