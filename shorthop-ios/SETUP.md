# Shorthop iOS App — Setup Guide

## Prerequisites
- Node.js 18+
- Expo Go app on your iPhone (install from App Store)
- Firebase account (free)

---

## 1. Install dependencies

```bash
cd shorthop-ios
npm install
```

---

## 2. Firebase setup

1. Go to [console.firebase.google.com](https://console.firebase.google.com) and create a project called `shorthop`
2. **Authentication** → Sign-in method:
   - Enable **Apple** (requires Apple Developer account — $99/year)
   - Enable **Google**
3. **Firestore Database** → Create database → Start in production mode
4. Add Firestore indexes (required for date range queries):
   - Collection: `moments`
   - Fields: `date ASC`, `createdAt ASC`
5. **Project Settings** → Your Apps → Add app → Web
6. Copy the `firebaseConfig` object and paste it into `src/services/firebase.js`

---

## 3. Google Sign-In setup

1. In Firebase Console → Authentication → Google → copy the **Web client ID**
2. Open `src/services/auth.js` and replace `YOUR_GOOGLE_WEB_CLIENT_ID` with it

---

## 4. Point the app at your Flask backend

**Option A — local development:**
```bash
# Find your Mac's local IP
ifconfig | grep "inet " | grep -v 127.0.0.1

# Start the app with that IP
EXPO_PUBLIC_API_URL=http://192.168.1.x:5000 npx expo start
```

**Option B — deployed backend:**
Open `app.json` and set `extra.apiBaseUrl` to your deployed Flask URL:
```json
"extra": {
  "apiBaseUrl": "https://your-app.onrender.com"
}
```

---

## 5. Run the app

```bash
npx expo start
```

Scan the QR code with **Expo Go** on your iPhone. The app will load.

> **Note:** Apple Sign-In only works on a real device, not the simulator.
> Google Sign-In works on both.

---

## 6. For App Store submission (later)

1. Install EAS CLI: `npm install -g eas-cli`
2. `eas build --platform ios`
3. This requires an Apple Developer account and Xcode on a Mac for final submission.

---

## Firestore Security Rules

After testing, lock down Firestore so users can only read their own data:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;

      match /moments/{momentId} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }
    }
  }
}
```

---

## Troubleshooting

**"No Statcast data for this date yet"** — The Flask backend couldn't find data for that date on Baseball Savant. Try a different date or check that the Flask server is running.

**Google Sign-In redirect not working** — Make sure your Expo redirect URI (`https://auth.expo.io/@YOUR_USERNAME/shorthop`) is added to the OAuth client's authorized redirect URIs in Google Cloud Console.

**Apple Sign-In fails** — Must be tested on a real device with an Apple ID logged in. Verify `expo-apple-authentication` plugin is in `app.json`.
