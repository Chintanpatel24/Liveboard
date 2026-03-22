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
