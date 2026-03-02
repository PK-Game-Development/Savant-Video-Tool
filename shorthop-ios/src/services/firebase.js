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

import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Replace with your Firebase project's config object
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID",
};

// Prevent re-initialization on hot reload
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

export const auth = getAuth(app);
export const db = getFirestore(app);
export default app;
