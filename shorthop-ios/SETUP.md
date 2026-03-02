# Shorthop iOS App — Setup Guide

This guide walks you through getting Shorthop running on your iPhone, step by step.
There are 6 parts. Don't skip any of them — each one builds on the last.

**Total time:** About 30–45 minutes the first time.

> **⚠️ Node version requirement:** This app requires **Node 20 LTS**. Node 22 or 24 will
> cause Expo to crash. If you already have Node installed, check your version first
> (`node --version`) and follow the nvm setup in Step 1 to make sure you're on 20.

---

## Part 1 — Install the tools you need on your computer

### Step 1: Install Node.js version 20 (the right version)

The app requires a specific version of Node.js — **version 20**. Newer versions (22, 24)
break Expo. The easiest way to manage this is with a tool called nvm, which lets you
switch between Node versions.

**1a. Check if you already have nvm installed:**

Open Terminal (press `Cmd + Space`, type "Terminal", press Enter). Type:
```
nvm --version
```
- If you see a version number → nvm is already installed. Skip to step 1d.
- If you see `command not found` → continue to step 1b.

**1b. Install nvm via Homebrew:**

First check if Homebrew is installed:
```
brew --version
```
If you see `command not found`, install Homebrew first:
```
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```
Then install nvm:
```
brew install nvm
```

**1c. Add nvm to your shell so Terminal can find it:**

First, find out which Mac you have. Type:
```
uname -m
```
- `arm64` = Apple Silicon (M1/M2/M3/M4)
- `x86_64` = Intel

Now open your shell config file:
```
nano ~/.zshrc
```
Press the **down arrow** to get to the very bottom of the file. Add these lines
(choose the right set for your Mac):

**Apple Silicon (arm64):**
```
export NVM_DIR="$HOME/.nvm"
[ -s "/opt/homebrew/opt/nvm/nvm.sh" ] && \. "/opt/homebrew/opt/nvm/nvm.sh"
[ -s "/opt/homebrew/opt/nvm/etc/bash_completion.d/nvm" ] && \. "/opt/homebrew/opt/nvm/etc/bash_completion.d/nvm"
```

**Intel (x86_64):**
```
export NVM_DIR="$HOME/.nvm"
[ -s "/usr/local/opt/nvm/nvm.sh" ] && \. "/usr/local/opt/nvm/nvm.sh"
[ -s "/usr/local/opt/nvm/etc/bash_completion.d/nvm" ] && \. "/usr/local/opt/nvm/etc/bash_completion.d/nvm"
```

Save and close: press **Ctrl+X**, then **Y**, then **Enter**.

Reload the shell:
```
source ~/.zshrc
```

Verify nvm works:
```
nvm --version
```
You should see a version number like `0.39.7`. ✓

**1d. Install Node 20 and set it as your default:**
```
nvm install 20
nvm use 20
nvm alias default 20
```

**Check that it worked:**
```
node --version
```
You should see `v20.x.x`. If it starts with 20, you're good. ✓

> If you already had a different Node version installed and nothing above worked,
> close the Terminal window completely, open a fresh one, and run `node --version` again.

---

### Step 2: Install Expo Go on your iPhone

Expo Go lets you run the app on your phone during development — no App Store submission required.

1. On your iPhone, open the **App Store**.
2. Tap the **Search** tab at the bottom.
3. Type **"Expo Go"** in the search bar.
4. Tap the result that says **Expo Go** with an orange icon (made by Expo).
5. Tap **Get**, then confirm with Face ID / Touch ID.
6. Wait for it to install. Keep it on your home screen — you'll use it every time you test.

---

## Part 2 — Install the app's dependencies

### Step 3: Open Terminal and navigate to the app folder

1. Open the **Terminal** app (press `Cmd + Space`, type "Terminal", hit Enter).
2. You need to navigate to the `shorthop-ios` folder inside this project. Type this (replace the path with wherever you cloned the repo):
```
cd ~/path/to/Savant-Video-Tool/shorthop-ios
```
   For example, if the project is on your Desktop:
```
cd ~/Desktop/Savant-Video-Tool/shorthop-ios
```
3. Press **Enter**.

### Step 4: Install the JavaScript packages

Still in Terminal, type this exactly and press Enter:
```
npm install
```

You'll see a lot of text scrolling by. This is normal — it's downloading all the libraries the app needs. Wait until it stops and you see your cursor again. It usually takes 1–3 minutes.

If you see a line that says `added 1234 packages` (the number doesn't matter) — you're good. ✓

---

## Part 3 — Set up Firebase (your app's backend database and login system)

Firebase is Google's free service that stores your saved moments and handles sign-in. This is the most involved part — take it slow.

### Step 5: Create a Firebase account and project

1. Open your browser and go to: **https://console.firebase.google.com**
2. Sign in with a Google account (any Gmail works).
3. Click the big **"Add project"** button (or "Create a project").
4. In the "Project name" field, type: `shorthop`
5. Click **Continue**.
6. On the "Google Analytics" screen, you can turn it **off** (toggle it off) — you don't need it.
7. Click **Create project**.
8. Wait about 10 seconds while it spins. Then click **Continue**.

You're now inside your Firebase project dashboard. ✓

---

### Step 6: Enable Google Sign-In

1. In the left sidebar, click **Authentication** (it has a person icon).
2. Click the **"Get started"** button.
3. You'll see a list of sign-in providers. Click on **Google**.
4. Click the toggle at the top right to turn it **on** (it turns blue).
5. In the "Project support email" dropdown, select your email address.
6. Click **Save**.

You'll see Google now shows as **Enabled** in the list. ✓

---

### Step 7: Enable Apple Sign-In

> **Note:** Apple Sign-In requires an Apple Developer account ($99/year). If you don't have one yet, skip this step for now — Google Sign-In will still work for testing.

1. You should still be on the Authentication → Sign-in method page.
2. Click on **Apple** in the provider list.
3. Click the toggle to turn it **on** (it turns blue).
4. Click **Save**.

---

### Step 8: Create the Firestore database (where moments get stored)

1. In the left sidebar, click **Firestore Database** (it has a cylinder icon).
2. Click **"Create database"**.
3. A popup asks which mode to start in. Select **"Start in production mode"**.
4. Click **Next**.
5. It asks for a location. Pick **"us-central"** (or whichever is closest to you).
6. Click **Enable**.
7. Wait about 15 seconds while it creates the database.

The database is ready when you see an empty table/grid appear. ✓

---

### Step 9: Add a database index (so date searches work fast)

1. You should be in the Firestore Database section. Click on the **"Indexes"** tab at the top.
2. Click **"Add index"**.
3. Fill it out exactly like this:
   - **Collection ID:** `moments`
   - Click **"Add field"** and set: Field path = `date`, Order = `Ascending`
   - Click **"Add field"** again and set: Field path = `createdAt`, Order = `Ascending`
   - **Query scope:** Collection group
4. Click **Create**.

It'll show "Building" for a minute. That's fine — move on while it builds. ✓

---

### Step 10: Get your Firebase config (the secret keys)

1. Click the **gear icon** (⚙️) at the top of the left sidebar, then click **"Project settings"**.
2. Scroll down to the section called **"Your apps"**.
3. Click the **"</>"** icon (the web icon — it looks like angle brackets).
4. It asks for an "App nickname". Type `shorthop-web` and click **"Register app"**.
5. You'll see a block of code that looks like this:
   ```
   const firebaseConfig = {
     apiKey: "AIzaSy...",
     authDomain: "shorthop-xxxxx.firebaseapp.com",
     projectId: "shorthop-xxxxx",
     ...
   };
   ```
6. **Select all of that config block** (from the `{` to the closing `}`) and copy it (Cmd+C).

Keep this browser tab open — you'll need it in the next step.

---

### Step 11: Paste the config into the app

1. Open **Finder** and navigate to the `shorthop-ios/src/services/` folder inside the project.
2. Open the file called **`firebase.js`** in any text editor (right-click → Open With → TextEdit, or use VS Code if you have it).
3. Find this section near the top:
   ```
   const firebaseConfig = {
     apiKey: "YOUR_API_KEY",
     authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
     ...
   ```
4. **Delete those placeholder lines** (everything from the `{` to the `};`) and paste in the real config you copied.
5. Save the file (Cmd+S).

---

### Step 12: Copy the Google Sign-In client ID into the app

1. Go back to the Firebase browser tab.
2. In the left sidebar, click **Authentication**, then click the **"Sign-in method"** tab.
3. Click on **Google** in the provider list.
4. Under "Web SDK configuration", you'll see a field labeled **"Web client ID"**. It looks like a long string ending in `.apps.googleusercontent.com`.
5. Click the copy icon next to it (or select the text and copy it).
6. Back in your text editor, open `shorthop-ios/src/services/auth.js`.
7. Find this line near the top:
   ```
   const GOOGLE_WEB_CLIENT_ID = "YOUR_GOOGLE_WEB_CLIENT_ID.apps.googleusercontent.com";
   ```
8. Replace `YOUR_GOOGLE_WEB_CLIENT_ID.apps.googleusercontent.com` with the ID you just copied (keep the quotes).
9. Save the file (Cmd+S).

---

## Part 4 — Point the app at your Flask backend

The iPhone app needs to talk to the Flask server (the existing Savant Video Tool) to get baseball data.

### Step 13: Find your computer's local IP address

1. Open **Terminal**.
2. Type this and press Enter:
   ```
   ipconfig getifaddr en0
   ```
3. You'll see a number like `192.168.1.47`. That's your computer's address on your local Wi-Fi. Write it down.

> **Important:** Your iPhone and your computer must be on the **same Wi-Fi network** for this to work.

---

### Step 14: Make sure the Flask server is running

1. In Terminal, open a **new tab** (Cmd+T).
2. Navigate to the main project folder:
   ```
   cd ~/path/to/Savant-Video-Tool
   ```
3. Start the Flask server:
   ```
   python app.py
   ```
4. You should see something like `Running on http://127.0.0.1:5000`. Leave this tab running — don't close it.

---

## Part 5 — Run the app on your iPhone

### Step 15: Start Expo

1. In Terminal, open **another new tab** (Cmd+T).
2. Navigate to the iOS app folder:
   ```
   cd ~/path/to/Savant-Video-Tool/shorthop-ios
   ```
3. Type this command (replace `192.168.1.47` with your actual IP from Step 13):
   ```
   EXPO_PUBLIC_API_URL=http://192.168.1.47:5000 npx expo start
   ```
4. Press **Enter** and wait about 15 seconds.
5. A QR code will appear in the terminal window.

---

### Step 16: Open the app on your iPhone

1. On your iPhone, open the **Camera** app.
2. Point it at the QR code in the Terminal window.
3. A banner will appear at the top of your screen that says **"Open in Expo Go"**. Tap it.
4. Expo Go opens and the app starts loading. The first load takes about 20–30 seconds.
5. You should see the **Shorthop welcome screen** with "Continue with Apple" and "Continue with Google" buttons.

If that's what you see — the app is running. ✓

---

### Step 17: Sign in and pick your team

1. Tap **"Continue with Google"** (easiest to test first — Apple Sign-In requires a real device with a specific setup).
2. A browser window opens. Sign in with your Google account.
3. After signing in, you're taken back to the app.
4. The **team picker screen** appears. Scroll through the list and tap your team.
5. Tap **"Let's go"**.
6. The **home screen** loads with a calendar. Today's date is highlighted in red.

You're in. ✓

---

## Part 6 — What to expect from here

### The calendar
- Tap any day to see moments saved for that day.
- Days that have moments will show colored dots.

### Auto-saves
- Every morning when you open the app, it automatically saves the highest WPA play from the previous day — one for your team, one for MLB overall.
- This only works if the Flask server is running and games from the previous day have gone Final on Baseball Savant (usually by 2–3am).

### Adding a moment manually
- Tap any day on the calendar → tap **"Add a moment"**.
- Browse the top plays listed, or search by team or player name.
- Tap a play to save it.

### Viewing a clip
- Tap any saved moment card to open the play on Baseball Savant in your browser.

---

## Troubleshooting

**The QR code scan does nothing**
Make sure your iPhone and Mac are on the same Wi-Fi network. Turn off your phone's cellular data temporarily and try again.

**"Network request failed" error in the app**
The app can't reach the Flask server. Check that:
- The Flask server is still running in Terminal (Step 14)
- You used the correct IP address from Step 13
- Both devices are on the same Wi-Fi

**"No Statcast data for this date yet"**
Baseball Savant hasn't posted data for that date. This is normal for today or recent dates where games haven't finished yet. Try tapping a day from last week.

**Google Sign-In opens a browser but then nothing happens**
This is a known issue during development. Try closing Expo Go completely, reopening it, scanning the QR code again, and trying sign-in once more.

**Apple Sign-In button doesn't appear**
Apple Sign-In only shows on real iPhones (not the simulator) with an Apple ID signed in. If you're testing on a simulator, use Google Sign-In instead.

**The app is slow or shows a blank screen**
Kill Expo Go, go back to Terminal, press `Ctrl+C` to stop Expo, then run the `npx expo start` command again. Re-scan the QR code.

---

## When you're ready for the App Store (later — no rush)

This requires:
- An **Apple Developer account** (https://developer.apple.com — $99/year)
- **Xcode** installed on your Mac (free from the Mac App Store — it's large, ~15GB)
- Running `npm install -g eas-cli` then `eas build --platform ios`

Don't worry about this until the app is where you want it feature-wise.
