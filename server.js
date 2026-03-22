const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const os = require('os');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  maxHttpBufferSize: 1e8 // 100 MB for canvas snapshots
});

const PORT = process.env.PORT || 3000;

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// ── State ──────────────────────────────────────────────
let drawHistory = [];          // every stroke / action
let canvasSnapshot = null;     // periodic full-canvas PNG
let connectedUsers = 0;
const userNames = new Map();   // socket.id → display name
let userCounter = 0;

// ── Helpers ────────────────────────────────────────────
function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

// ── Socket.IO ──────────────────────────────────────────
io.on('connection', (socket) => {
  connectedUsers++;
  userCounter++;
  const userName = `User ${userCounter}`;
  userNames.set(socket.id, userName);

  console.log(`✅  ${userName} connected (${connectedUsers} online)`);

  // Send current state to newly connected user
  socket.emit('init', {
    history: drawHistory,
    snapshot: canvasSnapshot,
    userName: userName,
    onlineCount: connectedUsers
  });

  // Broadcast updated count
  io.emit('user-count', connectedUsers);
  io.emit('user-joined', userName);

  // ── Drawing events ──────────────────────────────────
  socket.on('draw-start', (data) => {
    data.userName = userNames.get(socket.id);
    drawHistory.push({ type: 'draw-start', data });
    socket.broadcast.emit('draw-start', data);
  });

  socket.on('draw-move', (data) => {
    data.userName = userNames.get(socket.id);
    drawHistory.push({ type: 'draw-move', data });
    socket.broadcast.emit('draw-move', data);
  });

  socket.on('draw-end', (data) => {
    data.userName = userNames.get(socket.id);
    drawHistory.push({ type: 'draw-end', data });
    socket.broadcast.emit('draw-end', data);
  });

  // ── Text events ─────────────────────────────────────
  socket.on('add-text', (data) => {
    data.userName = userNames.get(socket.id);
    drawHistory.push({ type: 'add-text', data });
    socket.broadcast.emit('add-text', data);
  });

  // ── Shape events ────────────────────────────────────
  socket.on('add-shape', (data) => {
    data.userName = userNames.get(socket.id);
    drawHistory.push({ type: 'add-shape', data });
    socket.broadcast.emit('add-shape', data);
  });

  // ── Clear canvas ────────────────────────────────────
  socket.on('clear-canvas', () => {
    drawHistory = [];
    canvasSnapshot = null;
    io.emit('clear-canvas');
    console.log(`🗑️  ${userNames.get(socket.id)} cleared the canvas`);
  });

  // ── Undo last action ───────────────────────────────
  socket.on('undo', () => {
    // Remove last stroke (everything between last draw-start and draw-end)
    let removeFrom = -1;
    for (let i = drawHistory.length - 1; i >= 0; i--) {
      if (drawHistory[i].type === 'draw-start' || 
          drawHistory[i].type === 'add-text' || 
          drawHistory[i].type === 'add-shape') {
        removeFrom = i;
        break;
      }
    }
    if (removeFrom >= 0) {
      drawHistory = drawHistory.slice(0, removeFrom);
      io.emit('full-redraw', drawHistory);
    }
  });

  // ── Canvas snapshot (keeps history manageable) ──────
  socket.on('canvas-snapshot', (dataUrl) => {
    canvasSnapshot = dataUrl;
    drawHistory = [];
  });

  // ── Cursor position (live cursors) ──────────────────
  socket.on('cursor-move', (data) => {
    socket.broadcast.emit('cursor-move', {
      id: socket.id,
      x: data.x,
      y: data.y,
      userName: userNames.get(socket.id)
    });
  });

  // ── Disconnect ──────────────────────────────────────
  socket.on('disconnect', () => {
    connectedUsers--;
    const name = userNames.get(socket.id);
    userNames.delete(socket.id);
    console.log(`❌  ${name} disconnected (${connectedUsers} online)`);
    io.emit('user-count', connectedUsers);
    io.emit('user-left', name);
    io.emit('cursor-remove', socket.id);
  });
});

// ── Start Server ───────────────────────────────────────
server.listen(PORT, '0.0.0.0', () => {
  const localIP = getLocalIP();
  console.log('');
  console.log('╔══════════════════════════════════════════════════════╗');
  console.log('║          🎨  LiveBoard is RUNNING!                  ║');
  console.log('╠══════════════════════════════════════════════════════╣');
  console.log(`║  Local:    http://localhost:${PORT}                   ║`);
  console.log(`║  Network:  http://${localIP}:${PORT}            ║`);
  console.log('╠══════════════════════════════════════════════════════╣');
  console.log('║  Share the Network link with others to collaborate! ║');
  console.log('║  Press Ctrl+C to stop the server.                   ║');
  console.log('╚══════════════════════════════════════════════════════╝');
  console.log('');
});
