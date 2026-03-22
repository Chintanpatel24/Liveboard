# 🎨 LiveBoard v3 — Real-time Collaborative Whiteboard

Draw together, live, with anyone — on phone, tablet, or laptop.  
**Fully free. Works on Vercel. No server to maintain.**

---

## Why this works (and the others didn't)

| Version | Problem |
|---------|---------|
| Original | Socket.IO needs a persistent server — Vercel kills it |
| v2 (Pusher) | Client events need to be manually enabled; hard to debug |
| **v3 (Firebase)** | ✅ Firebase manages WebSockets on their servers — works perfectly with Vercel |

---

## Setup: 4 steps, ~3 minutes

### Step 1 — Create a free Firebase project

1. Go to **https://console.firebase.google.com**
2. Sign in with Google → **Add project**
3. Enter any project name (e.g. `liveboard`) → Continue → Create project

### Step 2 — Enable Realtime Database

1. In your project, click **Build** (left sidebar) → **Realtime Database**
2. Click **Create Database**
3. Choose a location (any region is fine)
4. Select **Start in test mode** → **Enable**

### Step 3 — Get your web config

1. Click the ⚙️ **gear icon** (top left) → **Project settings**
2. Scroll down to **Your apps** → click the **`</>`** (Web) button
3. Register the app (any nickname) → copy the `firebaseConfig` object

It looks like this:
```js
{
  apiKey: "AIzaSy...",
  authDomain: "your-project.firebaseapp.com",
  databaseURL: "https://your-project-default-rtdb.firebaseio.com",
  projectId: "your-project",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456:web:abcdef"
}
```

### Step 4 — Deploy to Vercel

Push this folder to GitHub, then in **Vercel**:
- Import the repository
- No build command, output directory = `/` (root)
- Deploy!

When you open the app for the first time, it will show a setup screen.  
Paste your Firebase config JSON and click **Save & Launch**.  
Config is saved in your browser automatically.

---

## How the real-time sync works

```
User A draws →  points written to Firebase Realtime DB
                    ↓ (Firebase WebSocket push, ~50ms)
User B's browser  ← receives the update → renders instantly
```

| Data path | What it stores |
|-----------|---------------|
| `boards/{roomId}/strokes` | All committed strokes (permanent) |
| `boards/{roomId}/live/{userId}` | In-progress stroke (ephemeral) |
| `boards/{roomId}/cursors/{userId}` | Cursor position (ephemeral) |
| `boards/{roomId}/presence/{userId}` | Who's online (auto-removed on disconnect) |

---

## Firebase free tier limits

| Limit | Free (Spark) plan |
|-------|------------------|
| Simultaneous connections | 100 |
| Storage | 1 GB |
| Download per month | 10 GB |
| Cost | $0 |

More than enough for collaborative drawing with friends!

---

## Local development

Just open `index.html` in a browser — no npm, no build step.  
Or use any static file server:
```bash
npx serve .
# or
python3 -m http.server 3000
```
