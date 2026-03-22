const express  = require('express');
const http     = require('http');
const { Server } = require('socket.io');
const path     = require('path');
const os       = require('os');

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, { cors: { origin: '*' } });
const PORT   = 3000;

app.use(express.static(path.join(__dirname, 'public')));

// ── Room storage (in-memory) ─────────────────────────────
const rooms = new Map();

function getRoom(id) {
  if (!rooms.has(id)) rooms.set(id, { strokes: [] });
  return rooms.get(id);
}

// ── Get your local network IP ────────────────────────────
function getLocalIP() {
  for (const ifaces of Object.values(os.networkInterfaces())) {
    for (const i of ifaces) {
      if (i.family === 'IPv4' && !i.internal) return i.address;
    }
  }
  return 'localhost';
}

// ── Socket.IO ────────────────────────────────────────────
const NAMES = ['Alex','Blake','Casey','Drew','Ellis','Finn','Gray','Harper',
               'Indigo','Jordan','Kit','Lee','Morgan','Nova','Quinn','River'];
let counter = 0;

io.on('connection', (socket) => {
  counter++;
  const userName = NAMES[counter % NAMES.length] + '-' + counter;
  let currentRoom = null;

  // JOIN
  socket.on('join', (roomId) => {
    currentRoom = roomId;
    socket.join(roomId);
    const room = getRoom(roomId);

    // Send existing board to the new user
    socket.emit('init', {
      strokes:   room.strokes,
      name:      userName,
      userCount: io.sockets.adapter.rooms.get(roomId)?.size || 1,
    });

    io.to(roomId).emit('user-count', io.sockets.adapter.rooms.get(roomId)?.size || 1);
    socket.to(roomId).emit('toast', userName + ' joined ✅');
    console.log(`✅  ${userName} joined room "${roomId}"`);
  });

  // LIVE STROKE (in-progress, sent every few ms while drawing)
  socket.on('live', (data) => {
    if (currentRoom) socket.to(currentRoom).emit('live', { ...data, uid: socket.id });
  });

  // LIVE END (finger/mouse lifted — remove their live stroke)
  socket.on('live-end', () => {
    if (currentRoom) socket.to(currentRoom).emit('live-end', socket.id);
  });

  // COMMIT STROKE (stroke is finished, store it)
  socket.on('stroke', (s) => {
    if (!currentRoom) return;
    getRoom(currentRoom).strokes.push(s);
    socket.to(currentRoom).emit('stroke', s);
  });

  // UNDO
  socket.on('undo', () => {
    if (!currentRoom) return;
    const room = getRoom(currentRoom);
    if (room.strokes.length) {
      room.strokes.pop();
      io.to(currentRoom).emit('redraw', room.strokes);
      io.to(currentRoom).emit('toast', userName + ' undid ↩');
    }
  });

  // CLEAR
  socket.on('clear', () => {
    if (!currentRoom) return;
    getRoom(currentRoom).strokes = [];
    io.to(currentRoom).emit('redraw', []);
    io.to(currentRoom).emit('toast', userName + ' cleared the board 🗑️');
  });

  // CURSOR
  socket.on('cursor', (pos) => {
    if (currentRoom) socket.to(currentRoom).emit('cursor', { id: socket.id, name: userName, x: pos.x, y: pos.y });
  });

  // DISCONNECT
  socket.on('disconnect', () => {
    if (currentRoom) {
      const size = io.sockets.adapter.rooms.get(currentRoom)?.size || 0;
      io.to(currentRoom).emit('user-count', size);
      io.to(currentRoom).emit('cursor-gone', socket.id);
      io.to(currentRoom).emit('live-end', socket.id);
      io.to(currentRoom).emit('toast', userName + ' left 👋');
      console.log(`❌  ${userName} left room "${currentRoom}"`);
    }
  });
});

// ── Start ────────────────────────────────────────────────
server.listen(PORT, '0.0.0.0', () => {
  const ip = getLocalIP();
  console.log('');
  console.log('╔══════════════════════════════════════════════════════╗');
  console.log('║           🎨  LiveBoard is running!                  ║');
  console.log('╠══════════════════════════════════════════════════════╣');
  console.log(`║  Your link:  http://${ip}:${PORT}                    `);
  console.log('║                                                      ║');
  console.log('║  1. Share that link with your friend                 ║');
  console.log('║  2. You both open it → draw together live!           ║');
  console.log('║                                                      ║');
  console.log('║  (friend must be on same WiFi)                       ║');
  console.log('║  (for internet: run  npx cloudflared tunnel          ║');
  console.log('║   --url http://localhost:3000  and share that URL)   ║');
  console.log('╚══════════════════════════════════════════════════════╝');
  console.log('');
});
