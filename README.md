# 🎨 LiveBoard — Local Collaborative Whiteboard

Draw together in real time with anyone. Run it on your PC, share the link, and you're both live. No cloud, no accounts, no Vercel. Just Node.js.

---

## What's inside

### 🖊️ Drawing Tools
| Tool | Key | Description |
|------|-----|-------------|
| Pen | `P` | Smooth freehand drawing |
| Highlighter | `H` | Semi-transparent wide strokes |
| Fill Bucket | `F` | Flood-fill any area with color |
| Eraser | `E` | Erase parts of the drawing |
| Text | `T` | Click to place text anywhere |

### 🔷 Shapes
| Shape | Key | Description |
|-------|-----|-------------|
| Line | `L` | Straight line |
| Rectangle | `R` | Outlined rectangle |
| Filled Rectangle | — | Solid filled rectangle |
| Circle | `C` | Outlined ellipse/circle |
| Filled Circle | — | Solid filled circle |
| Arrow | `A` | Line with arrowhead |
| Triangle | — | Outlined triangle |
| Diamond | — | Outlined diamond |
| Star | — | 5-point star |

### ✍️ Text Options
- **Font size** slider (10–120px)
- **Bold**, *Italic*, Underline toggles
- **Font family** — Default / Serif / Monospace / Impact / Cursive
- `Ctrl+B` bold · `Ctrl+I` italic · `Ctrl+U` underline (while text tool active)

### 🎨 Colour & Style
- 10 preset colours + custom colour picker
- **Brush size** slider (1–60px)
- **Opacity** slider (10–100%)

### 🖼️ Image Panel
- Click **🖼️ Image** button in the top bar — or **drag & drop** any image file onto the board
- The window **splits**: drawing canvas on the left, image viewer on the right
- **Zoom** in/out with scroll wheel or +/− buttons
- **Pan** by clicking and dragging inside the image panel
- **Fit** button to reset zoom/pan to fit the panel
- Drag the **vertical divider bar** to resize the two panels
- Click **✕ Remove** to dismiss the image — drawing canvas expands back to full width

### 👥 Collaboration
- **Live pen strokes** — others see your drawing segment by segment as you draw
- **Live cursors** — see everyone's cursor moving in real time with their name
- **Presence list** — sidebar shows who's currently in the room
- **Undo** — synced for everyone (`↩ Undo` button or `Ctrl+Z`)
- **Clear** — wipes the board for everyone

### Other
- **💾 Save** — download the board as a PNG
- **🔗 Share** — copies the current room URL to clipboard
- Full **touch support** (phones + tablets)
- Responsive layout — sidebar collapses on mobile

---

## Requirements

- [Node.js](https://nodejs.org) — download the **LTS** version (free, one-time install)

---

## Getting started

### Windows

Double-click **`START.bat`**

First run downloads packages (~10 seconds), then the server starts.

### Mac / Linux

```bash
bash start.sh
```

Or manually:

```bash
npm install
node server.js
```

---

## Sharing with your friend

When the server starts, the terminal shows your link:

```
╔══════════════════════════════════════════════════════╗
║           🎨  LiveBoard is running!                  ║
╠══════════════════════════════════════════════════════╣
║  Your link:  http://192.168.1.5:3000
╚══════════════════════════════════════════════════════╝
```

### Friend is on the same WiFi

Send them the `http://192.168.x.x:3000` link. They open it in their browser — done.

### Friend is on a different network (anywhere in the world)

Open a **new terminal window** and run:

```bash
npx cloudflared tunnel --url http://localhost:3000
```

It prints a public URL like:

```
https://something-random.trycloudflare.com
```

Send that to your friend. Works from anywhere, completely free, no account needed.

> **Keep both terminal windows open** — one for the server, one for the tunnel.
> The tunnel URL changes every time you restart it, so share the new link each session.

---

## How to use the board

1. Open the link → click **✨ Create New Board**
2. The URL updates with a room code (e.g. `?room=abc123`)
3. Click **🔗 Share** — the full URL is copied to your clipboard
4. Send that URL to your friend
5. They open it → you're both in the same room → draw live together!

---

## Image panel walkthrough

1. Click **🖼️ Image** in the top bar — or **drag any image file** from your desktop onto the board window
2. The board splits — drawing on the left, image viewer on the right
3. Inside the image panel:
   - **Scroll wheel** to zoom (zooms centred on your cursor position)
   - **Click and drag** to pan around the image
   - **+** / **−** buttons for step-by-step zoom
   - **⊡ Fit** button to reset back to fit-in-panel view
4. **Drag the divider bar** (the vertical line between the panels) left or right to resize them
5. Click **✕ Remove** — image closes, drawing canvas takes the full width again

---

## Keyboard shortcuts

| Shortcut | Action |
|----------|--------|
| `P` | Pen |
| `H` | Highlighter |
| `F` | Fill bucket |
| `E` | Eraser |
| `T` | Text |
| `L` | Line |
| `R` | Rectangle |
| `C` | Circle |
| `A` | Arrow |
| `Ctrl+Z` | Undo |
| `Ctrl+B` | Bold (text tool) |
| `Ctrl+I` | Italic (text tool) |
| `Ctrl+U` | Underline (text tool) |
| `Enter` | Commit text |
| `Shift+Enter` | New line in text box |
| `Escape` | Cancel text |

---

## Project structure

```
liveboard-local/
├── server.js          ← Node.js server (Express + Socket.IO)
├── package.json       ← Dependencies (express, socket.io)
├── START.bat          ← Windows launcher (double-click)
├── start.sh           ← Mac/Linux launcher
├── HOW-TO-USE.txt     ← Plain-text quick-start guide
├── README.md          ← This file
└── public/
    └── index.html     ← Entire frontend (HTML + CSS + JS in one file)
```

---

## How it works

```
You draw a stroke
    ↓
Each segment (x1,y1 → x2,y2) is sent to server.js via Socket.IO instantly
    ↓
server.js broadcasts it to everyone else in the same room
    ↓
Their browser draws that segment on screen — live, no delay
    ↓
On pen-up, the full stroke is saved to the room's memory
    ↓
Anyone who joins later receives all saved strokes to rebuild the board
```

All data lives **in memory** on the server. Restarting the server clears all boards. There is no database.

---

## Troubleshooting

**Friend can't connect on same WiFi**
Windows Firewall may be blocking port 3000. When Node.js first runs, Windows asks for firewall permission — click Allow. Or use the cloudflared tunnel instead.

**`npm` not found**
Node.js isn't installed. Download from [nodejs.org](https://nodejs.org), install the LTS version, then restart your terminal.

**Port 3000 already in use**
Open `server.js`, change `const PORT = 3000` to `3001` (or any free number), and update the link accordingly.

**Cloudflared tunnel drops**
The free quick tunnel has no uptime guarantee. Just run `npx cloudflared tunnel --url http://localhost:3000` again and share the new URL.

**Lines look choppy on slow connection**
Each pen segment is sent immediately as you draw. On slow networks there may be slight lag — this is normal. On the same WiFi it's near-instant.
