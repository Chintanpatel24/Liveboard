const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const os = require('os');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

// ── Room storage ────────────────────────────────
const rooms = new Map();

function getRoom(id) {
  if (!rooms.has(id)) {
    rooms.set(id, { strokes: [], created: Date.now() });
  }
  return rooms.get(id);
}

function getLocalIP() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const n of nets[name]) {
      if (n.family === 'IPv4' && !n.internal) return n.address;
    }
  }
  return 'localhost';
}

// ── Socket.IO ───────────────────────────────────
let counter = 0;

io.on('connection', (socket) => {
  counter++;
  const userName = 'User-' + counter;
  let currentRoom = null;

  // ── Join Room ──
  socket.on('join-room', (roomId) => {
    currentRoom = roomId;
    socket.join(roomId);
    const room = getRoom(roomId);

    // send all existing strokes to new user
    socket.emit('init', {
      strokes: room.strokes,
      userName,
      userCount: io.sockets.adapter.rooms.get(roomId)?.size || 1
    });

    // tell everyone the count changed
    io.to(roomId).emit('user-count',
      io.sockets.adapter.rooms.get(roomId)?.size || 1);
    socket.to(roomId).emit('toast', userName + ' joined ✅');

    console.log(`✅ ${userName} joined room ${roomId}`);
  });

  // ── Live pen/eraser segments (real-time) ──
  socket.on('live-draw', (data) => {
    if (currentRoom) socket.to(currentRoom).emit('live-draw', data);
  });

  // ── Finished stroke (stored for undo/replay) ──
  socket.on('commit-stroke', (stroke) => {
    if (!currentRoom) return;
    const room = getRoom(currentRoom);
    room.strokes.push(stroke);
    socket.to(currentRoom).emit('new-stroke', stroke);
  });

  // ── Undo ──
  socket.on('undo', () => {
    if (!currentRoom) return;
    const room = getRoom(currentRoom);
    if (room.strokes.length > 0) {
      room.strokes.pop();
      io.to(currentRoom).emit('full-redraw', room.strokes);
    }
  });

  // ── Clear ──
  socket.on('clear', () => {
    if (!currentRoom) return;
    const room = getRoom(currentRoom);
    room.strokes = [];
    io.to(currentRoom).emit('full-redraw', []);
    io.to(currentRoom).emit('toast', userName + ' cleared the board 🗑️');
  });

  // ── Cursor ──
  socket.on('cursor', (pos) => {
    if (currentRoom) {
      socket.to(currentRoom).emit('cursor', {
        id: socket.id, x: pos.x, y: pos.y, name: userName
      });
    }
  });

  // ── Disconnect ──
  socket.on('disconnect', () => {
    if (currentRoom) {
      const count = io.sockets.adapter.rooms.get(currentRoom)?.size || 0;
      io.to(currentRoom).emit('user-count', count);
      io.to(currentRoom).emit('cursor-gone', socket.id);
      io.to(currentRoom).emit('toast', userName + ' left 👋');
      console.log(`❌ ${userName} left room ${currentRoom}`);
    }
  });
});

// ── Cleanup old empty rooms every 10 min ──
setInterval(() => {
  for (const [id, room] of rooms) {
    const size = io.sockets.adapter.rooms.get(id)?.size || 0;
    if (size === 0 && Date.now() - room.created > 3600000) rooms.delete(id);
  }
}, 600000);

// ── Start ───────────────────────────────────────
server.listen(PORT, '0.0.0.0', () => {
  const ip = getLocalIP();
  console.log('');
  console.log('╔═══════════════════════════════════════════════════╗');
  console.log('║          🎨  LiveBoard is RUNNING!                ║');
  console.log('╠═══════════════════════════════════════════════════╣');
  console.log(`║  Local:   http://localhost:${PORT}                  ║`);
  console.log(`║  Network: http://${ip}:${PORT}                 ║`);
  console.log('╠═══════════════════════════════════════════════════╣');
  console.log('║  Open the link → Create Board → Share the URL!   ║');
  console.log('╚═══════════════════════════════════════════════════╝');
  console.log('');
});
