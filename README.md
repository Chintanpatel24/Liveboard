# 🎨 LiveBoard — Local Collaborative Whiteboard

Draw together in real time with anyone — run it on your own PC, share the link, and you're live. No cloud accounts, no Vercel, no Firebase. Just Node.js.

---

## What it does

- **Live drawing sync** — every stroke appears on everyone's screen as you draw it, not just after you lift the pen
- **Live cursors** — see where your friends' cursors are moving in real time
- **Multiple tools** — pen, eraser, text, line, rectangle, circle, arrow
- **Color picker + opacity + brush size**
- **Undo / Clear** — synced for everyone in the room
- **Download** — save the board as a PNG
- **Rooms** — create a board and share the link; each link is its own private room
- **Works on phone + desktop** — full touch support

---

## Requirements

- [Node.js](https://nodejs.org) (download the **LTS** version — free)
- That's it

---

## Getting started

### Windows

Double-click **`START.bat`**

That's it. It installs packages on first run, then starts the server.

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

When the server starts, your terminal shows:

```
╔══════════════════════════════════════════════════════╗
║           🎨  LiveBoard is running!                  ║
╠══════════════════════════════════════════════════════╣
║  Your link:  http://192.168.1.5:3000
║                                                      ║
║  1. Share that link with your friend                 ║
║  2. You both open it → draw together live!           ║
╚══════════════════════════════════════════════════════╝
```

### Friend is on the same WiFi

Send them the `http://192.168.x.x:3000` link directly. They open it in their browser and join.

### Friend is on a different network (anywhere in the world)

Run this in a **new terminal window** (Node.js not required for this):

```bash
npx cloudflared tunnel --url http://localhost:3000
```

It prints a public link like:

```
https://something-random.trycloudflare.com
```

Send that link to your friend. It works from anywhere in the world, completely free, no account needed. The tunnel stays alive as long as that terminal window is open.

---

## How to use the board

1. Open the link in your browser
2. Click **✨ Create New Board** — a room is created and the URL updates with a room code
3. Click **🔗 Share Link** — the full URL is copied to your clipboard
4. Send that URL to your friend — they open it and join the same board
5. Draw together!

---

## Keyboard shortcuts

| Key | Action |
|-----|--------|
| `P` | Pen |
| `E` | Eraser |
| `T` | Text |
| `L` | Line |
| `R` | Rectangle |
| `C` | Circle |
| `A` | Arrow |
| `Ctrl + Z` | Undo |

---

## Project structure

```
liveboard-local/
├── server.js          ← Node.js server (Express + Socket.IO)
├── package.json       ← Dependencies
├── START.bat          ← Windows launcher (double-click)
├── start.sh           ← Mac/Linux launcher
├── HOW-TO-USE.txt     ← Plain text instructions
└── public/
    └── index.html     ← Entire frontend (HTML + CSS + JS in one file)
```

---

## How it works

```
You draw on your screen
      ↓
Your browser sends the stroke to server.js via Socket.IO (WebSocket)
      ↓
server.js broadcasts it to everyone else in the same room
      ↓
Their browsers receive it and draw it on their canvas instantly
```

All drawing data is stored in memory on the server. If you restart the server, the boards reset. There is no database.

---

## Stopping the server

Press `Ctrl + C` in the terminal window.

---

## Troubleshooting

**Friend can't connect on same WiFi**
Your firewall might be blocking port 3000. On Windows, when Node.js first runs it asks for firewall permission — click Allow. Or temporarily disable the firewall to test.

**`npm` not found**
Node.js is not installed. Download it from [nodejs.org](https://nodejs.org) and install the LTS version.

**Port 3000 already in use**
Something else is using port 3000. Open `server.js` and change `const PORT = 3000` to any other number like `3001`, then use that port in the URL.

**`npx cloudflared` is slow to start**
The first time it downloads the cloudflared binary (~30MB). Subsequent runs are instant.
