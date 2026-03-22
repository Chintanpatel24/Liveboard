# Liveboard

How to Run
Bash

### 1. Go into the project folder
cd liveboard

### 2. Install dependencies
npm install

### 3. Start the server
npm start
You'll see output like:
text

<pre>
╔══════════════════════════════════════════════════════╗
║          🎨  LiveBoard is RUNNING!                   ║
╠══════════════════════════════════════════════════════╣
║  Local:    http://localhost:3000                     ║
║  Network:  http://192.168.1.42:3000                  ║
╠══════════════════════════════════════════════════════╣
║  Share the Network link with others to collaborate!  ║
║  Press Ctrl+C to stop the server.                    ║
╚══════════════════════════════════════════════════════╝


┌─────────────┐         WebSocket (Socket.IO)        ┌─────────────┐
│   User A    │◄────────────────────────────────────►│   Server    │
│  (Browser)  │    draw / erase / text / shapes      │  (Node.js)  │
└─────────────┘                                      └──────┬──────┘
                                                            │
                                                     broadcasts
                                                      to all
┌─────────────┐                                      ┌──────┴──────┐
│   User B    │◄────────────────────────────────────►│  Socket.IO  │
│  (Browser)  │         real-time sync               └─────────────┘
└─────────────┘

   You (Browser)                    Server (Node.js)                Friend (Browser)
   ┌──────────┐                    ┌──────────────┐                ┌──────────┐
   │ Draw on  │── live-draw ──────>│  Broadcasts  │── live-draw ──>│ Sees it  │
   │ canvas   │── commit-stroke ──>│  Stores it   │── new-stroke ─>│ instantly │
   │          │<── full-redraw ────│  (on undo)   │── full-redraw─>│          │
   │ See live │<── cursor ─────────│              │<── cursor ─────│ Moves    │
   │ cursors  │                    │  Room: abc12 │                │ mouse    │
   └──────────┘                    └──────────────┘                └──────────┘
</pre>
<pre>
  🚀 Run It
Bash

cd liveboard
npm start
Output:

text

╔═══════════════════════════════════════════════════╗
║          🎨  LiveBoard is RUNNING!                ║
╠═══════════════════════════════════════════════════╣
║  Local:   http://localhost:3000                   ║
║  Network: http://192.168.1.42:3000                ║
╠═══════════════════════════════════════════════════╣
║  Open the link → Create Board → Share the URL!   ║
╚═══════════════════════════════════════════════════╝
🌐 Deploy Online (Free — anyone on the internet can join)
Option A: ngrok (quickest — 1 command)
Bash

# In another terminal while server is running:
npx ngrok http 3000
You get a public URL like https://abc123.ngrok-free.app — share it with anyone!

Option B: Render.com (permanent free hosting)
Bash

# 1. Push your liveboard folder to GitHub

# 2. Go to https://render.com → New Web Service

# 3. Connect your repo, set:
#    Build Command:  npm install
#    Start Command:  npm start

# 4. Deploy → get a permanent URL like https://liveboard-xxxx.onrender.com
Option C: Glitch.com (paste & go)
text

1. Go to https://glitch.com → New Project → Import from GitHub
2. Paste your GitHub repo URL
3. It auto-deploys — you get a URL instantly

</pre>

Features Summary

Feature	How

- ✏️ Pen	Freehand drawing with adjustable size/color/opacity

- 🧹 Eraser	Draws white over content

- 🔤 Text	Click anywhere → type → Enter to place

- 📏 Line / ⬜ Rect / ⭕ Circle / ➡️ Arrow	Click & drag shapes

- 🎨 Colors	10 preset + custom color picker

- ↩ Undo	Removes last stroke (Ctrl+Z also works)

- 🗑 Clear	Wipes board for everyone

- 🔗 Share	Copies the join link to clipboard

- 💾 Download	Saves canvas as PNG

- 👆 Live Cursors	See other users' mouse positions with names

- 📱 Touch	Works on tablets/phones

- ⌨️ Shortcuts	P=pen, E=eraser, T=text, L=line, R=rect, C=circle
