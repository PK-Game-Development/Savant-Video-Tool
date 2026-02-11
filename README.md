# Savant Video Tool

Download Baseball Savant videos from Statcast searches.

## Super simple Mac guide (like you're 10) 🍎

Think of this like making hot chocolate:
1. Open Terminal.
2. Go to the project folder.
3. Install what the app needs.
4. Press "go".

---

## Step 1: Open Terminal and go to the folder

If your project folder is in your Home folder, type this:

```bash
cd ~/Savant-Video-Tool
```

Now check you are in the right place:

```bash
pwd
ls
```

You should see files like `app.py`, `desktop_app.py`, and `build_macos_app.sh`.

If you do **not** see those files, you're in the wrong folder.

---

## Step 2: Make sure you're on the right branch

```bash
git checkout mac-desktop-app
git pull
```

---

## Step 3: Fastest way to test (recommended)

Copy/paste these **one line at a time**:

```bash
python3 -m venv .venv
source .venv/bin/activate
python3 -m pip install --upgrade pip
python3 -m pip install -r requirements.txt
python3 desktop_app.py
```

What should happen:
- A window opens called **Savant Video Tool**.
- That is your desktop app.

---

## Step 4: Build a real Mac `.app` you can click

If the fast test works, build the app bundle:

```bash
chmod +x build_macos_app.sh
./build_macos_app.sh
open ./dist/SavantVideoTool.app
```

When it finishes, you should have:
- `dist/SavantVideoTool.app`

---

## If something goes wrong (quick fixes)

### "No such file or directory"
You are in the wrong folder. Run:

```bash
cd ~/Savant-Video-Tool
pwd
ls
```

### "build_macos_app.sh: No such file"
Same issue: wrong folder. Go back to Step 1.

### `dist/SavantVideoTool.app` does not exist
The build failed earlier. Re-run:

```bash
./build_macos_app.sh
```

Then read the **first red error line**.

### macOS says app is blocked
- In Finder, right-click the app.
- Click **Open**.

---

## Optional: run only in browser (old way)

```bash
python3 -m venv .venv
source .venv/bin/activate
python3 -m pip install -r requirements.txt
python3 app.py
```

Then open <http://localhost:5000>.
