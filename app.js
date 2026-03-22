/* ═══════════════════════════════════════════════════════════
   LiveBoard v3 — Firebase Realtime Database edition
   Works on Vercel (static), Netlify, GitHub Pages — anywhere.
   ═══════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  // ── Canvas resolution ─────────────────────────────────────
  const W = 2400, H = 1600;

  // ── User palette (one color per user in the room) ─────────
  const USER_COLORS = [
    '#3b82f6','#ef4444','#22c55e','#f97316',
    '#8b5cf6','#06b6d4','#ec4899','#eab308',
    '#14b8a6','#f43f5e','#a855f7','#84cc16',
  ];
  const NAMES = [
    'Alex','Blake','Casey','Drew','Ellis','Finn',
    'Gray','Harper','Indigo','Jordan','Kit','Lee',
    'Morgan','Nova','Quinn','River','Sage','Taylor',
    'Uma','Val','Wren','Xen','Yuki','Zara',
  ];

  // ── DOM refs ──────────────────────────────────────────────
  const $ = s => document.querySelector(s);
  const setupScreen  = $('#setupScreen');
  const landing      = $('#landing');
  const board        = $('#board');
  const canvas       = $('#mainCanvas');
  const liveCanvas   = $('#liveCanvas');
  const previewC     = $('#previewCanvas');
  const ctx          = canvas.getContext('2d');
  const lctx         = liveCanvas.getContext('2d');
  const pctx         = previewC.getContext('2d');
  const cursorLayer  = $('#cursorLayer');
  const textBox      = $('#textBox');
  const toastEl      = $('#toast');
  const usersSec     = $('#usersSec');

  // ── App state ─────────────────────────────────────────────
  let db        = null;
  let roomId    = null;
  let myId      = null;
  let myName    = '';
  let myColor   = USER_COLORS[0];
  let strokes   = [];            // committed strokes array (local copy)
  let currentStroke = null;
  let tool      = 'pen';
  let color     = '#1a1a1a';
  let size      = 4;
  let opacity   = 1;
  let fontSize  = 24;
  let drawing   = false;
  let shapeStart = null;

  // ── Live strokes from other users {userId → strokeData} ───
  const liveStrokes = {};
  // ── Remote cursors {userId → domElement} ─────────────────
  const cursors = {};
  // ── Online members {userId → {name, color}} ───────────────
  const members = {};

  // ── Throttle timers ───────────────────────────────────────
  let liveWriteTimer   = null;
  let cursorWriteTimer = null;

  // ═══════════════════════════════════════════════════════════
  //  STEP 1: INIT — load Firebase config, show correct screen
  // ═══════════════════════════════════════════════════════════

  function init() {
    const cfg = loadConfig();

    if (!cfg) {
      // No config → show setup screen
      setupScreen.classList.remove('hidden');
      setupConfigUI();
      return;
    }

    try {
      firebase.initializeApp(cfg);
      db = firebase.database();
    } catch (e) {
      // Already initialized (hot-reload / dev)
      if (firebase.apps.length) {
        db = firebase.database();
      } else {
        showSetupError('Firebase init failed: ' + e.message);
        setupScreen.classList.remove('hidden');
        setupConfigUI();
        return;
      }
    }

    startApp();
  }

  function loadConfig() {
    // 1. Check localStorage (from in-app setup)
    const stored = localStorage.getItem('lb_firebase_cfg');
    if (stored) {
      try { return JSON.parse(stored); } catch (_) {}
    }
    // 2. Check window.FIREBASE_CONFIG (from firebase-config.js if bundled)
    if (window.FIREBASE_CONFIG && window.FIREBASE_CONFIG.apiKey) {
      return window.FIREBASE_CONFIG;
    }
    return null;
  }

  function startApp() {
    // Generate a stable userId for this browser session
    myId    = sessionStorage.getItem('lb_uid') || ('u' + Math.random().toString(36).substr(2, 10));
    sessionStorage.setItem('lb_uid', myId);

    // Deterministic name + color from userId hash
    const h = myId.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
    myName  = NAMES[h % NAMES.length] + '-' + ((h * 13) % 90 + 10);
    myColor = USER_COLORS[h % USER_COLORS.length];

    const room = getParam('room');
    if (room) {
      enterBoard(room);
    } else {
      landing.classList.remove('hidden');
    }
  }

  // ═══════════════════════════════════════════════════════════
  //  SETUP UI
  // ═══════════════════════════════════════════════════════════

  function setupConfigUI() {
    $('#saveConfigBtn').addEventListener('click', () => {
      const raw = $('#configInput').value.trim();
      if (!raw) { showSetupError('Please paste your Firebase config.'); return; }

      // Accept either bare JSON object or wrapped in a JS object literal
      let json = raw;
      // Strip trailing commas that break JSON.parse
      json = json.replace(/,\s*([\]}])/g, '$1');

      let cfg;
      try {
        cfg = JSON.parse(json);
      } catch (_) {
        showSetupError('Could not parse the config. Make sure you paste only the { … } part.');
        return;
      }

      if (!cfg.apiKey || !cfg.databaseURL) {
        showSetupError('Config is missing apiKey or databaseURL. Make sure you enabled Realtime Database in Firebase Console.');
        return;
      }

      localStorage.setItem('lb_firebase_cfg', JSON.stringify(cfg));
      setupScreen.classList.add('hidden');
      init(); // retry with saved config
    });
  }

  function showSetupError(msg) {
    const el = $('#setupError');
    el.textContent = '⚠️ ' + msg;
    el.classList.remove('hidden');
  }

  // ═══════════════════════════════════════════════════════════
  //  ROUTING
  // ═══════════════════════════════════════════════════════════

  function getParam(k) {
    return new URLSearchParams(window.location.search).get(k);
  }

  // Create board
  $('#createBtn').addEventListener('click', () => {
    const id = Math.random().toString(36).substr(2, 9);
    window.history.pushState({}, '', '?room=' + id);
    enterBoard(id);
  });

  // Join board
  $('#joinBtn').addEventListener('click', () => {
    let val = ($('#joinInput').value || '').trim();
    if (!val) return;
    let id = val;
    try { id = new URL(val).searchParams.get('room') || val; } catch (_) {}
    window.history.pushState({}, '', '?room=' + id);
    enterBoard(id);
  });

  function enterBoard(id) {
    roomId = id;
    landing.classList.add('hidden');
    board.classList.remove('hidden');
    setupCanvas();
    subscribeFirebase();
  }

  // ═══════════════════════════════════════════════════════════
  //  CANVAS SETUP
  // ═══════════════════════════════════════════════════════════

  function setupCanvas() {
    [canvas, liveCanvas, previewC].forEach(c => {
      c.width  = W;
      c.height = H;
    });
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);
  }

  function canvasXY(e) {
    const rect = canvas.getBoundingClientRect();
    let cx, cy;
    if (e.touches && e.touches.length) {
      cx = e.touches[0].clientX; cy = e.touches[0].clientY;
    } else if (e.changedTouches && e.changedTouches.length) {
      cx = e.changedTouches[0].clientX; cy = e.changedTouches[0].clientY;
    } else {
      cx = e.clientX; cy = e.clientY;
    }
    return {
      x: (cx - rect.left) * (W / rect.width),
      y: (cy - rect.top)  * (H / rect.height),
    };
  }

  // ═══════════════════════════════════════════════════════════
  //  FIREBASE SUBSCRIPTIONS
  // ═══════════════════════════════════════════════════════════

  function subscribeFirebase() {
    const boardRef    = db.ref('boards/' + roomId);
    const strokesRef  = boardRef.child('strokes');
    const liveRef     = boardRef.child('live');
    const cursorsRef  = boardRef.child('cursors');
    const presenceRef = boardRef.child('presence');

    // ── 1. Presence: register ourselves + cleanup on disconnect ──
    const myPresenceRef = presenceRef.child(myId);
    myPresenceRef.set({ name: myName, color: myColor, t: Date.now() });
    myPresenceRef.onDisconnect().remove();

    // ── 2. Watch presence (user count + names) ──
    presenceRef.on('value', snap => {
      const data = snap.val() || {};
      Object.keys(members).forEach(k => { if (!data[k]) delete members[k]; });
      Object.entries(data).forEach(([uid, info]) => { members[uid] = info; });
      updatePresenceUI();
    });

    // ── 3. Load all existing committed strokes, then watch for new ones ──
    strokesRef.once('value', snap => {
      const data = snap.val() || {};
      strokes = Object.values(data);
      redrawAll();
      showToast('Welcome, ' + myName + '! Board loaded ✅');
    });

    // Listen for strokes added by others AFTER we joined
    strokesRef.on('child_added', snap => {
      const s = snap.val();
      if (!s) return;
      // Skip strokes already in our local array (from the once() load above)
      const isDuplicate = strokes.some(existing =>
        existing._id && existing._id === s._id
      );
      if (isDuplicate) return;
      strokes.push(s);
      renderStroke(ctx, s); // draw on main canvas immediately
    });

    // ── 4. Watch full-redraw signals (undo, clear) ──
    boardRef.child('redraw').on('value', snap => {
      const d = snap.val();
      if (!d || !d.t) return;
      // Re-load strokes from DB and redraw
      strokesRef.once('value', snap2 => {
        strokes = Object.values(snap2.val() || {});
        redrawAll();
        if (d.msg) showToast(d.msg);
      });
    });

    // ── 5. Live drawing from other users ──
    liveRef.on('child_changed', snap => {
      const uid = snap.key;
      if (uid === myId) return;
      const data = snap.val();
      if (!data) { delete liveStrokes[uid]; }
      else { liveStrokes[uid] = data; }
      redrawLive();
    });
    liveRef.on('child_removed', snap => {
      delete liveStrokes[snap.key];
      redrawLive();
    });

    // ── 6. Cursors from other users ──
    cursorsRef.on('child_changed', snap => {
      const uid = snap.key;
      if (uid === myId) return;
      const d = snap.val();
      if (!d) return;
      updateCursor(uid, d.x, d.y, d.name, d.color);
    });
    cursorsRef.on('child_removed', snap => {
      removeCursor(snap.key);
    });

    // Clean up our cursor + live stroke on disconnect
    cursorsRef.child(myId).onDisconnect().remove();
    liveRef.child(myId).onDisconnect().remove();
  }

  // ── Commit a stroke to Firebase ──
  function pushStroke(s) {
    const id = db.ref('boards/' + roomId + '/strokes').push().key;
    s._id = id;
    strokes.push(s); // already added locally for responsiveness
    db.ref('boards/' + roomId + '/strokes/' + id).set(s);
  }

  // ── Update our live drawing entry ──
  function writeLive(data) {
    if (!liveWriteTimer) {
      liveWriteTimer = setTimeout(() => {
        liveWriteTimer = null;
        db.ref('boards/' + roomId + '/live/' + myId).set(data);
      }, 40); // ~25fps
    }
  }

  function clearLive() {
    clearTimeout(liveWriteTimer);
    liveWriteTimer = null;
    db.ref('boards/' + roomId + '/live/' + myId).remove();
  }

  // ── Cursor ──
  function writeCursor(x, y) {
    if (!cursorWriteTimer) {
      cursorWriteTimer = setTimeout(() => {
        cursorWriteTimer = null;
        db.ref('boards/' + roomId + '/cursors/' + myId).set({
          x, y, name: myName, color: myColor, t: Date.now()
        });
      }, 80); // ~12fps — enough for smooth cursor
    }
  }

  // ── Signal full redraw ──
  function signalRedraw(msg) {
    db.ref('boards/' + roomId + '/redraw').set({ t: Date.now(), msg: msg || '' });
  }

  // ═══════════════════════════════════════════════════════════
  //  DRAW HELPERS
  // ═══════════════════════════════════════════════════════════

  function drawSeg(c, x1, y1, x2, y2, col, w, op, eraser) {
    c.save();
    c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2);
    c.strokeStyle = eraser ? '#ffffff' : col;
    c.lineWidth   = eraser ? w * 3 : w;
    c.globalAlpha = eraser ? 1 : op;
    c.lineCap = 'round'; c.lineJoin = 'round';
    c.stroke(); c.restore();
  }

  function drawPath(c, s) {
    const pts = s.points;
    if (!pts || pts.length === 0) return;
    if (pts.length === 1) {
      c.save(); c.beginPath();
      c.arc(pts[0].x, pts[0].y, (s.eraser ? s.width*1.5 : s.width/2), 0, Math.PI*2);
      c.fillStyle = s.eraser ? '#ffffff' : s.color;
      c.globalAlpha = s.eraser ? 1 : s.opacity;
      c.fill(); c.restore();
      return;
    }
    c.save();
    c.strokeStyle = s.eraser ? '#ffffff' : s.color;
    c.lineWidth   = s.eraser ? s.width * 3 : s.width;
    c.globalAlpha = s.eraser ? 1 : s.opacity;
    c.lineCap = 'round'; c.lineJoin = 'round';
    c.beginPath(); c.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length - 1; i++) {
      const mx = (pts[i].x + pts[i+1].x) / 2;
      const my = (pts[i].y + pts[i+1].y) / 2;
      c.quadraticCurveTo(pts[i].x, pts[i].y, mx, my);
    }
    c.lineTo(pts[pts.length-1].x, pts[pts.length-1].y);
    c.stroke(); c.restore();
  }

  function drawShape(c, s) {
    const { x1, y1, x2, y2, color: col, width: w, opacity: op } = s;
    c.save();
    c.strokeStyle = col; c.lineWidth = w; c.globalAlpha = op;
    c.lineCap = 'round';
    switch (s.shape) {
      case 'line':
        c.beginPath(); c.moveTo(x1,y1); c.lineTo(x2,y2); c.stroke();
        break;
      case 'rect':
        c.strokeRect(Math.min(x1,x2), Math.min(y1,y2), Math.abs(x2-x1), Math.abs(y2-y1));
        break;
      case 'circle': {
        const rx = Math.abs(x2-x1)/2, ry = Math.abs(y2-y1)/2;
        c.beginPath();
        c.ellipse(Math.min(x1,x2)+rx, Math.min(y1,y2)+ry, rx||1, ry||1, 0,0,Math.PI*2);
        c.stroke();
        break;
      }
      case 'arrow': {
        c.fillStyle = col;
        c.beginPath(); c.moveTo(x1,y1); c.lineTo(x2,y2); c.stroke();
        const a = Math.atan2(y2-y1, x2-x1), h = Math.max(14, w*4);
        c.beginPath(); c.moveTo(x2,y2);
        c.lineTo(x2-h*Math.cos(a-Math.PI/6), y2-h*Math.sin(a-Math.PI/6));
        c.lineTo(x2-h*Math.cos(a+Math.PI/6), y2-h*Math.sin(a+Math.PI/6));
        c.closePath(); c.fill();
        break;
      }
    }
    c.restore();
  }

  function drawText(c, s) {
    c.save();
    c.font = `${s.size}px "Segoe UI", system-ui, sans-serif`;
    c.fillStyle = s.color; c.globalAlpha = s.opacity;
    (s.text || '').split('\n').forEach((line, i) =>
      c.fillText(line, s.x, s.y + i * s.size * 1.25)
    );
    c.restore();
  }

  function renderStroke(c, s) {
    if (!s) return;
    if (s.type === 'path')  drawPath(c, s);
    if (s.type === 'shape') drawShape(c, s);
    if (s.type === 'text')  drawText(c, s);
  }

  // ── Full canvas redraw (after undo/clear) ──
  function redrawAll() {
    ctx.save();
    ctx.fillStyle = '#ffffff'; ctx.globalAlpha = 1;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
    strokes.forEach(s => renderStroke(ctx, s));
  }

  // ── Live canvas redraw (remote users' in-progress strokes) ──
  function redrawLive() {
    lctx.clearRect(0, 0, W, H);
    for (const s of Object.values(liveStrokes)) {
      renderStroke(lctx, s);
    }
  }

  // ═══════════════════════════════════════════════════════════
  //  POINTER EVENTS (drawing)
  // ═══════════════════════════════════════════════════════════

  function onDown(e) {
    e.preventDefault();
    const p = canvasXY(e);

    if (tool === 'text') { openText(p.x, p.y); return; }

    drawing = true;

    if (['line','rect','circle','arrow'].includes(tool)) {
      shapeStart = p;
      return;
    }

    currentStroke = {
      type: 'path', color, width: size, opacity,
      eraser: tool === 'eraser', points: [p]
    };
  }

  function onMove(e) {
    e.preventDefault();
    const p = canvasXY(e);

    // Send cursor position
    writeCursor(p.x, p.y);

    if (!drawing) return;

    // ── Shape preview ──
    if (shapeStart) {
      pctx.clearRect(0, 0, W, H);
      drawShape(pctx, { shape:tool, x1:shapeStart.x, y1:shapeStart.y,
                        x2:p.x, y2:p.y, color, width:size, opacity });
      return;
    }

    // ── Pen / eraser ──
    if (!currentStroke) return;
    const last = currentStroke.points[currentStroke.points.length - 1];
    currentStroke.points.push(p);

    // Draw locally
    drawSeg(ctx, last.x, last.y, p.x, p.y, color, size, opacity, currentStroke.eraser);

    // Broadcast current in-progress stroke to Firebase (throttled)
    writeLive({
      type:   'path',
      color:  currentStroke.color,
      width:  currentStroke.width,
      opacity: currentStroke.opacity,
      eraser: currentStroke.eraser,
      points: currentStroke.points,
    });
  }

  function onUp(e) {
    if (!drawing) return;
    drawing = false;
    clearLive(); // remove our live entry — stroke is committed

    // ── Shape commit ──
    if (shapeStart) {
      pctx.clearRect(0, 0, W, H);
      const p = canvasXY(e);
      const s = { type:'shape', shape:tool, x1:shapeStart.x, y1:shapeStart.y,
                  x2:p.x, y2:p.y, color, width:size, opacity };
      drawShape(ctx, s);
      pushStroke(s);
      shapeStart = null;
      return;
    }

    // ── Pen / eraser commit ──
    if (currentStroke && currentStroke.points.length) {
      pushStroke(currentStroke);
      currentStroke = null;
    }
  }

  canvas.addEventListener('mousedown',  onDown);
  canvas.addEventListener('mousemove',  onMove);
  canvas.addEventListener('mouseup',    onUp);
  canvas.addEventListener('mouseleave', onUp);
  canvas.addEventListener('touchstart', onDown,  { passive: false });
  canvas.addEventListener('touchmove',  onMove,  { passive: false });
  canvas.addEventListener('touchend',   onUp);
  canvas.addEventListener('touchcancel',onUp);

  // ═══════════════════════════════════════════════════════════
  //  TEXT TOOL
  // ═══════════════════════════════════════════════════════════

  function openText(cx, cy) {
    const rect = canvas.getBoundingClientRect();
    const sx = rect.width / W, sy = rect.height / H;
    textBox.classList.remove('hidden');
    textBox.style.left     = (cx * sx) + 'px';
    textBox.style.top      = (cy * sy) + 'px';
    textBox.style.fontSize = (fontSize * sx) + 'px';
    textBox.style.color    = color;
    textBox.value = '';
    textBox._cx = cx; textBox._cy = cy;
    setTimeout(() => textBox.focus(), 20);
  }

  function commitText() {
    const t = (textBox.value || '').trim();
    textBox.classList.add('hidden');
    if (!t) return;
    const s = { type:'text', text:t, x:textBox._cx, y:textBox._cy + fontSize,
                color, size:fontSize, opacity };
    drawText(ctx, s);
    pushStroke(s);
  }

  textBox.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commitText(); }
    if (e.key === 'Escape') { textBox.classList.add('hidden'); }
  });
  textBox.addEventListener('blur', commitText);

  // ═══════════════════════════════════════════════════════════
  //  UNDO & CLEAR
  // ═══════════════════════════════════════════════════════════

  function doUndo() {
    if (!strokes.length) return;
    // Find the last stroke pushed by ME (by _id being the last push key)
    // For simplicity, undo the last stroke in the array
    const last = strokes[strokes.length - 1];
    if (!last || !last._id) return;
    db.ref('boards/' + roomId + '/strokes/' + last._id).remove();
    strokes.pop();
    redrawAll();
    signalRedraw(myName + ' undid a stroke ↩');
  }

  function doClear() {
    if (!confirm('Clear the entire board for everyone?')) return;
    db.ref('boards/' + roomId + '/strokes').remove();
    strokes = [];
    redrawAll();
    signalRedraw(myName + ' cleared the board 🗑️');
  }

  // ═══════════════════════════════════════════════════════════
  //  REMOTE CURSORS
  // ═══════════════════════════════════════════════════════════

  function updateCursor(uid, x, y, name, userColor) {
    let el = cursors[uid];
    if (!el) {
      el = document.createElement('div');
      el.className = 'rcursor';
      el.innerHTML =
        `<svg width="16" height="22" viewBox="0 0 16 22" fill="${userColor}" xmlns="http://www.w3.org/2000/svg">
          <path d="M0 0 L0 18 L4.5 13.5 L7.5 20 L9.5 19 L6.5 12 L12 12 Z" stroke="white" stroke-width="1.5" stroke-linejoin="round"/>
        </svg>
        <div class="rcursor-name" style="background:${userColor}">${name}</div>`;
      cursorLayer.appendChild(el);
      cursors[uid] = el;
    }
    const rect = canvas.getBoundingClientRect();
    el.style.left = (x * rect.width  / W) + 'px';
    el.style.top  = (y * rect.height / H) + 'px';
  }

  function removeCursor(uid) {
    if (cursors[uid]) { cursors[uid].remove(); delete cursors[uid]; }
  }

  // ═══════════════════════════════════════════════════════════
  //  PRESENCE UI
  // ═══════════════════════════════════════════════════════════

  function updatePresenceUI() {
    const count = Object.keys(members).length;
    $('#onlineNum').textContent = count;

    usersSec.innerHTML = '<div class="sec-title">WHO\'S HERE</div>';
    for (const [uid, info] of Object.entries(members)) {
      const pip = document.createElement('div');
      pip.className = 'user-pip' + (uid === myId ? ' user-pip-me' : '');
      pip.innerHTML =
        `<div class="user-pip-dot" style="background:${info.color || '#888'}"></div>` +
        `<span>${info.name || 'User'}</span>`;
      usersSec.appendChild(pip);
    }
  }

  // ═══════════════════════════════════════════════════════════
  //  TOOLBAR UI
  // ═══════════════════════════════════════════════════════════

  document.querySelectorAll('.tool').forEach(b => {
    b.addEventListener('click', () => {
      document.querySelector('.tool.active')?.classList.remove('active');
      b.classList.add('active');
      tool = b.dataset.tool;
      canvas.style.cursor = tool==='eraser' ? 'cell' : tool==='text' ? 'text' : 'crosshair';
      $('#fontSec').style.display = tool==='text' ? '' : 'none';
    });
  });

  document.querySelectorAll('.clr').forEach(b => {
    b.addEventListener('click', () => {
      document.querySelector('.clr.active')?.classList.remove('active');
      b.classList.add('active');
      color = b.dataset.c;
      $('#colorPick').value = color;
    });
  });
  $('#colorPick').addEventListener('input', e => {
    color = e.target.value;
    document.querySelector('.clr.active')?.classList.remove('active');
  });

  $('#sizeSlider').addEventListener('input', e => {
    size = +e.target.value; $('#sizeVal').textContent = size;
  });
  $('#opSlider').addEventListener('input', e => {
    opacity = +e.target.value / 100; $('#opVal').textContent = e.target.value;
  });
  $('#fontSlider').addEventListener('input', e => {
    fontSize = +e.target.value; $('#fontVal').textContent = fontSize;
  });

  // Top-bar buttons
  $('#shareBtn').addEventListener('click', () => {
    const url = window.location.href;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url).then(() => showToast('Link copied! Share it 🔗'));
    } else {
      prompt('Copy this link:', url);
    }
  });
  $('#undoBtn').addEventListener('click',     doUndo);
  $('#clearBtn').addEventListener('click',    doClear);
  $('#downloadBtn').addEventListener('click', () => {
    const a = document.createElement('a');
    a.download = 'liveboard-' + Date.now() + '.png';
    a.href = canvas.toDataURL();
    a.click();
    showToast('Saved as PNG! 💾');
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', e => {
    if (e.target === textBox) return;
    if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); doUndo(); return; }
    const map = { p:'pen', e:'eraser', t:'text', l:'line', r:'rect', c:'circle', a:'arrow' };
    if (map[e.key] && !e.ctrlKey && !e.metaKey) {
      document.querySelector('.tool.active')?.classList.remove('active');
      document.querySelector(`.tool[data-tool="${map[e.key]}"]`)?.classList.add('active');
      tool = map[e.key];
      canvas.style.cursor = tool==='eraser'?'cell':tool==='text'?'text':'crosshair';
      $('#fontSec').style.display = tool==='text'?'':'none';
    }
  });

  // ═══════════════════════════════════════════════════════════
  //  TOAST
  // ═══════════════════════════════════════════════════════════

  function showToast(msg, ms = 2500) {
    toastEl.textContent = msg;
    toastEl.classList.remove('hidden');
    toastEl.classList.add('show');
    clearTimeout(toastEl._t);
    toastEl._t = setTimeout(() => {
      toastEl.classList.remove('show');
      setTimeout(() => toastEl.classList.add('hidden'), 300);
    }, ms);
  }

  // ═══════════════════════════════════════════════════════════
  //  BOOT
  // ═══════════════════════════════════════════════════════════
  init();

})();
