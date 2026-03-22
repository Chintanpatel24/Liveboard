/* ═══════════════════════════════════════════════════════
   LiveBoard — Client  (Pusher edition, Vercel-ready)
   ═══════════════════════════════════════════════════════ */
(function () {
  'use strict';

  // ── Constants ──────────────────────────────────
  const W = 2400, H = 1600;

  // ── DOM ────────────────────────────────────────
  const $ = (s) => document.querySelector(s);
  const landing     = $('#landing');
  const board       = $('#board');
  const canvas      = $('#mainCanvas');
  const preview     = $('#previewCanvas');
  const ctx         = canvas.getContext('2d');
  const pctx        = preview.getContext('2d');
  const cursorLayer = $('#cursorLayer');
  const textBox     = $('#textBox');
  const toastEl     = $('#toast');

  // ── State ──────────────────────────────────────
  let pusher  = null;
  let channel = null;
  let roomId  = null;
  let myName  = '';
  let myId    = '';
  let strokes = [];
  let currentStroke = null;
  let tool    = 'pen';
  let color   = '#000000';
  let size    = 4;
  let opacity = 1;
  let fontSize = 24;
  let drawing = false;
  let shapeStart = null;
  const cursors = {};
  const COLORS  = ['#ef4444','#3b82f6','#22c55e','#f97316','#8b5cf6','#06b6d4','#ec4899','#eab308'];

  // ── Live-draw batching (avoids Pusher rate limit) ──
  let pendingSegs  = [];
  let batchTimer   = null;

  // ── Cursor throttle ────────────────────────────
  let lastCursorSent = 0;

  // ═════════════════════════════════════════════════
  //  BOOT – fetch Pusher config, then show landing
  // ═════════════════════════════════════════════════

  async function boot() {
    let cfg = {};
    try {
      cfg = await fetch('/api/config').then(r => r.json());
    } catch (e) {
      console.warn('Could not fetch config:', e);
    }

    if (!cfg.configured) {
      $('#configError').classList.remove('hidden');
      landing.classList.remove('hidden');
      return;
    }

    // Init Pusher (key is safe to expose – it's the public app key)
    pusher = new Pusher(cfg.pusherKey, {
      cluster:      cfg.pusherCluster,
      authEndpoint: '/api/pusher-auth',
    });

    pusher.connection.bind('error', (err) => {
      showToast('Connection error ❌  Check console.', 5000);
      console.error('Pusher error:', err);
    });

    const r = getParam('room');
    if (r) {
      enterBoard(r);
    } else {
      landing.classList.remove('hidden');
    }
  }

  // ═════════════════════════════════════════════════
  //  ROUTING
  // ═════════════════════════════════════════════════

  function getParam(k) {
    return new URLSearchParams(window.location.search).get(k);
  }

  $('#createBtn').addEventListener('click', () => {
    const id = Math.random().toString(36).substr(2, 8);
    window.history.pushState({}, '', '?room=' + id);
    enterBoard(id);
  });

  $('#joinBtn').addEventListener('click', () => {
    let val = $('#joinInput').value.trim();
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
    subscribeRoom(id);
  }

  // ═════════════════════════════════════════════════
  //  CANVAS SETUP
  // ═════════════════════════════════════════════════

  function setupCanvas() {
    canvas.width  = W; canvas.height = H;
    preview.width = W; preview.height = H;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, W, H);
  }

  function xy(e) {
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

  // ═════════════════════════════════════════════════
  //  PUSHER ROOM SUBSCRIPTION
  // ═════════════════════════════════════════════════

  function subscribeRoom(id) {
    channel = pusher.subscribe('presence-room-' + id);

    // ── Successfully joined the Pusher presence channel ──
    channel.bind('pusher:subscription_succeeded', (members) => {
      myId   = members.me.id;
      myName = members.me.info.name;
      $('#onlineNum').textContent = members.count;
      redrawAll();
      showToast('Welcome, ' + myName + '! 👋');

      // Ask existing members to send us the current board state
      if (members.count > 1) {
        setTimeout(() => trigger('client-request-state', { to: myId }), 600);
      }
    });

    channel.bind('pusher:subscription_error', (status) => {
      showToast('Room join failed ❌ (status ' + status + ')', 5000);
    });

    // ── Someone joined ──
    channel.bind('pusher:member_added', (m) => {
      $('#onlineNum').textContent = channel.members.count;
      showToast(m.info.name + ' joined ✅');
    });

    // ── Someone left ──
    channel.bind('pusher:member_removed', (m) => {
      $('#onlineNum').textContent = channel.members.count;
      showToast(m.info.name + ' left 👋');
      if (cursors[m.id]) { cursors[m.id].remove(); delete cursors[m.id]; }
    });

    // ── Live drawing segments (batched) ──
    channel.bind('client-draw-batch', (data) => {
      (data.segs || []).forEach(d =>
        drawSeg(ctx, d.x1, d.y1, d.x2, d.y2, d.color, d.width, d.opacity, d.eraser)
      );
    });

    // ── Finished stroke from another user ──
    channel.bind('client-stroke', (s) => {
      strokes.push(s);
      // paths were already shown live; shapes/text weren't
      if (s.type === 'shape' || s.type === 'text') renderStroke(ctx, s);
    });

    // ── Undo broadcast ──
    channel.bind('client-undo', () => {
      if (strokes.length) { strokes.pop(); redrawAll(); }
    });

    // ── Clear broadcast ──
    channel.bind('client-clear', (data) => {
      strokes = [];
      redrawAll();
      showToast((data.who || 'Someone') + ' cleared the board 🗑️');
    });

    // ── Cursor from another user ──
    channel.bind('client-cursor', (d) => {
      if (d.id === myId) return;
      let el = cursors[d.id];
      if (!el) {
        el = document.createElement('div');
        el.className = 'rcursor';
        const ci = Object.keys(cursors).length % COLORS.length;
        el.innerHTML =
          `<div class="rcursor-dot" style="background:${COLORS[ci]}"></div>` +
          `<div class="rcursor-name">${d.name}</div>`;
        cursorLayer.appendChild(el);
        cursors[d.id] = el;
      }
      const rect = canvas.getBoundingClientRect();
      el.style.left = (d.x * rect.width  / W) + 'px';
      el.style.top  = (d.y * rect.height / H) + 'px';
    });

    // ── New user asked for current board state ──
    channel.bind('client-request-state', (data) => {
      if (data.to === myId) return; // that's our own request echoed back

      // Only one responder needed – the member with the lexically smallest id
      const memberIds = [];
      channel.members.each(m => memberIds.push(m.id));
      memberIds.sort();
      if (memberIds[0] !== myId) return; // not our turn to respond

      // Compress + chunk the stroke array to fit Pusher's 10 KB event limit
      const chunks = chunkStrokes(compressStrokes(strokes), 7500);
      chunks.forEach((chunk, i) => {
        trigger('client-state-chunk', {
          to:     data.to,
          chunk:  i,
          total:  chunks.length,
          strokes: chunk,
        });
      });
    });

    // ── Receive board state (new user) ──
    channel.bind('client-state-chunk', (data) => {
      if (data.to !== myId) return;         // not for us
      if (strokes.length > 0)  return;      // already have state

      // Collect chunks then apply
      if (!channel._stateChunks) channel._stateChunks = {};
      channel._stateChunks[data.chunk] = data.strokes;

      if (Object.keys(channel._stateChunks).length === data.total) {
        // All chunks received → rebuild full stroke array
        const all = [];
        for (let i = 0; i < data.total; i++) all.push(...channel._stateChunks[i]);
        strokes = all;
        delete channel._stateChunks;
        redrawAll();
        showToast('Board synced! 🔄');
      }
    });
  }

  // ── Safe trigger wrapper ──
  function trigger(event, data) {
    if (!channel) return;
    try {
      channel.trigger(event, data);
    } catch (e) {
      console.warn('Pusher trigger failed:', event, e);
    }
  }

  // ── Compress strokes to reduce payload size ──
  function compressStrokes(arr) {
    return arr.map(s => {
      if (s.type === 'path' && s.points && s.points.length > 4) {
        // Keep every other point (halves payload, barely noticeable visually)
        const pts = s.points.filter((_, i) => i % 2 === 0 || i === s.points.length - 1);
        return { ...s, points: pts.map(p => ({ x: +p.x.toFixed(1), y: +p.y.toFixed(1) })) };
      }
      return s;
    });
  }

  // ── Split array into byte-limited chunks ──
  function chunkStrokes(arr, maxBytes) {
    const chunks = []; let cur = []; let bytes = 0;
    for (const s of arr) {
      const b = JSON.stringify(s).length;
      if (bytes + b > maxBytes && cur.length) { chunks.push(cur); cur = []; bytes = 0; }
      cur.push(s); bytes += b;
    }
    if (cur.length) chunks.push(cur);
    return chunks.length ? chunks : [[]];
  }

  // ═════════════════════════════════════════════════
  //  DRAW HELPERS  (identical to original)
  // ═════════════════════════════════════════════════

  function drawSeg(c, x1, y1, x2, y2, col, w, op, eraser) {
    c.save();
    c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2);
    c.strokeStyle = eraser ? '#FFFFFF' : col;
    c.lineWidth   = eraser ? w * 3 : w;
    c.globalAlpha = eraser ? 1 : op;
    c.lineCap = 'round'; c.lineJoin = 'round';
    c.stroke(); c.restore();
  }

  function drawFullPath(c, s) {
    const pts = s.points;
    if (!pts || pts.length < 2) {
      if (pts && pts.length === 1) {
        c.save(); c.beginPath();
        c.arc(pts[0].x, pts[0].y, (s.eraser ? s.width*1.5 : s.width/2), 0, Math.PI*2);
        c.fillStyle = s.eraser ? '#FFFFFF' : s.color;
        c.globalAlpha = s.eraser ? 1 : s.opacity;
        c.fill(); c.restore();
      }
      return;
    }
    c.save(); c.beginPath();
    c.strokeStyle = s.eraser ? '#FFFFFF' : s.color;
    c.lineWidth   = s.eraser ? s.width * 3 : s.width;
    c.globalAlpha = s.eraser ? 1 : s.opacity;
    c.lineCap = 'round'; c.lineJoin = 'round';
    c.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length - 1; i++) {
      const mx = (pts[i].x + pts[i+1].x) / 2;
      const my = (pts[i].y + pts[i+1].y) / 2;
      c.quadraticCurveTo(pts[i].x, pts[i].y, mx, my);
    }
    c.lineTo(pts[pts.length-1].x, pts[pts.length-1].y);
    c.stroke(); c.restore();
  }

  function drawLine(c,x1,y1,x2,y2,col,w,op){c.save();c.beginPath();c.moveTo(x1,y1);c.lineTo(x2,y2);c.strokeStyle=col;c.lineWidth=w;c.globalAlpha=op;c.lineCap='round';c.stroke();c.restore();}
  function drawRect(c,x1,y1,x2,y2,col,w,op){c.save();c.strokeStyle=col;c.lineWidth=w;c.globalAlpha=op;c.strokeRect(Math.min(x1,x2),Math.min(y1,y2),Math.abs(x2-x1),Math.abs(y2-y1));c.restore();}
  function drawCircle(c,x1,y1,x2,y2,col,w,op){c.save();c.beginPath();const rx=Math.abs(x2-x1)/2,ry=Math.abs(y2-y1)/2;c.ellipse(Math.min(x1,x2)+rx,Math.min(y1,y2)+ry,rx||1,ry||1,0,0,Math.PI*2);c.strokeStyle=col;c.lineWidth=w;c.globalAlpha=op;c.stroke();c.restore();}
  function drawArrow(c,x1,y1,x2,y2,col,w,op){c.save();c.strokeStyle=col;c.fillStyle=col;c.lineWidth=w;c.globalAlpha=op;c.beginPath();c.moveTo(x1,y1);c.lineTo(x2,y2);c.stroke();const a=Math.atan2(y2-y1,x2-x1),h=Math.max(14,w*4);c.beginPath();c.moveTo(x2,y2);c.lineTo(x2-h*Math.cos(a-Math.PI/6),y2-h*Math.sin(a-Math.PI/6));c.lineTo(x2-h*Math.cos(a+Math.PI/6),y2-h*Math.sin(a+Math.PI/6));c.closePath();c.fill();c.restore();}

  function drawText(c, s) {
    c.save();
    c.font = s.size + 'px "Segoe UI", system-ui, sans-serif';
    c.fillStyle = s.color; c.globalAlpha = s.opacity;
    s.text.split('\n').forEach((line, i) => c.fillText(line, s.x, s.y + i * s.size * 1.25));
    c.restore();
  }

  function drawShape(c, s) {
    switch(s.shape) {
      case 'line':   drawLine(c,s.x1,s.y1,s.x2,s.y2,s.color,s.width,s.opacity);   break;
      case 'rect':   drawRect(c,s.x1,s.y1,s.x2,s.y2,s.color,s.width,s.opacity);   break;
      case 'circle': drawCircle(c,s.x1,s.y1,s.x2,s.y2,s.color,s.width,s.opacity); break;
      case 'arrow':  drawArrow(c,s.x1,s.y1,s.x2,s.y2,s.color,s.width,s.opacity);  break;
    }
  }

  function renderStroke(c, s) {
    if (s.type === 'path')  drawFullPath(c, s);
    if (s.type === 'shape') drawShape(c, s);
    if (s.type === 'text')  drawText(c, s);
  }

  function redrawAll() {
    ctx.save(); ctx.fillStyle = '#FFFFFF'; ctx.globalAlpha = 1;
    ctx.fillRect(0, 0, W, H); ctx.restore();
    strokes.forEach(s => renderStroke(ctx, s));
  }

  // ═════════════════════════════════════════════════
  //  POINTER EVENTS
  // ═════════════════════════════════════════════════

  function onDown(e) {
    e.preventDefault();
    const p = xy(e);
    if (tool === 'text') { openText(p.x, p.y); return; }
    drawing = true;
    if (['line','rect','circle','arrow'].includes(tool)) { shapeStart = p; return; }
    currentStroke = { type:'path', color, width:size, opacity, eraser: tool==='eraser', points:[p] };
  }

  function onMove(e) {
    e.preventDefault();
    const p = xy(e);

    // Cursor (throttled to ~10/s)
    const now = Date.now();
    if (now - lastCursorSent > 100) {
      trigger('client-cursor', { id: myId, x: p.x, y: p.y, name: myName });
      lastCursorSent = now;
    }

    if (!drawing) return;

    if (shapeStart) {
      pctx.clearRect(0, 0, W, H);
      drawShape(pctx, { shape:tool, x1:shapeStart.x, y1:shapeStart.y, x2:p.x, y2:p.y, color, width:size, opacity });
      return;
    }

    if (!currentStroke) return;
    const last = currentStroke.points[currentStroke.points.length - 1];
    currentStroke.points.push(p);
    drawSeg(ctx, last.x, last.y, p.x, p.y, color, size, opacity, currentStroke.eraser);

    // Queue segment for batched send
    pendingSegs.push({ x1:last.x, y1:last.y, x2:p.x, y2:p.y, color, width:size, opacity, eraser:currentStroke.eraser });
    if (!batchTimer) batchTimer = setTimeout(flushBatch, 50); // 20fps max to stay within Pusher rate limit
  }

  function onUp(e) {
    if (!drawing) return;
    drawing = false;
    flushBatch(); // flush any remaining segments immediately

    if (shapeStart) {
      pctx.clearRect(0, 0, W, H);
      const p = xy(e);
      const s = { type:'shape', shape:tool, x1:shapeStart.x, y1:shapeStart.y, x2:p.x, y2:p.y, color, width:size, opacity };
      drawShape(ctx, s);
      strokes.push(s);
      trigger('client-stroke', s);
      shapeStart = null;
      return;
    }

    if (currentStroke) {
      strokes.push(currentStroke);
      trigger('client-stroke', currentStroke);
      currentStroke = null;
    }
  }

  function flushBatch() {
    batchTimer = null;
    if (!pendingSegs.length) return;
    trigger('client-draw-batch', { segs: pendingSegs });
    pendingSegs = [];
  }

  canvas.addEventListener('mousedown',  onDown);
  canvas.addEventListener('mousemove',  onMove);
  canvas.addEventListener('mouseup',    onUp);
  canvas.addEventListener('mouseleave', onUp);
  canvas.addEventListener('touchstart', onDown,  { passive: false });
  canvas.addEventListener('touchmove',  onMove,  { passive: false });
  canvas.addEventListener('touchend',   onUp);
  canvas.addEventListener('touchcancel',onUp);

  // ═════════════════════════════════════════════════
  //  TEXT TOOL
  // ═════════════════════════════════════════════════

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
    setTimeout(() => textBox.focus(), 30);
  }

  function commitText() {
    const t = textBox.value.trim();
    textBox.classList.add('hidden');
    if (!t) return;
    const s = { type:'text', text:t, x:textBox._cx, y:textBox._cy + fontSize, color, size:fontSize, opacity };
    drawText(ctx, s);
    strokes.push(s);
    trigger('client-stroke', s);
  }

  textBox.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commitText(); }
    if (e.key === 'Escape') textBox.classList.add('hidden');
  });
  textBox.addEventListener('blur', commitText);

  // ═════════════════════════════════════════════════
  //  TOOLBAR UI
  // ═════════════════════════════════════════════════

  document.querySelectorAll('.tool').forEach(b => {
    b.addEventListener('click', () => {
      document.querySelector('.tool.active').classList.remove('active');
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
  $('#colorPick').addEventListener('input', (e) => {
    color = e.target.value;
    document.querySelector('.clr.active')?.classList.remove('active');
  });

  $('#sizeSlider').addEventListener('input', (e) => { size = +e.target.value; $('#sizeVal').textContent = size; });
  $('#opSlider').addEventListener('input',   (e) => { opacity = +e.target.value / 100; $('#opVal').textContent = e.target.value; });
  $('#fontSlider').addEventListener('input', (e) => { fontSize = +e.target.value; $('#fontVal').textContent = fontSize; });

  // ── Top bar ──
  $('#shareBtn').addEventListener('click', () => {
    const url = window.location.href;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url).then(() => showToast('Link copied! Share it 🔗'));
    } else {
      prompt('Copy this link:', url);
    }
  });

  $('#undoBtn').addEventListener('click', () => {
    if (strokes.length) {
      strokes.pop();
      redrawAll();
      trigger('client-undo', {});
    }
  });

  $('#clearBtn').addEventListener('click', () => {
    if (confirm('Clear the entire board for everyone?')) {
      strokes = [];
      redrawAll();
      trigger('client-clear', { who: myName });
    }
  });

  $('#downloadBtn').addEventListener('click', () => {
    const a = document.createElement('a');
    a.download = 'liveboard-' + Date.now() + '.png';
    a.href = canvas.toDataURL();
    a.click();
    showToast('Saved as PNG! 💾');
  });

  // ── Keyboard shortcuts ──
  document.addEventListener('keydown', (e) => {
    if (e.target === textBox) return;
    if (e.ctrlKey && e.key === 'z') {
      e.preventDefault();
      if (strokes.length) { strokes.pop(); redrawAll(); trigger('client-undo', {}); }
      return;
    }
    const map = { p:'pen', e:'eraser', t:'text', l:'line', r:'rect', c:'circle', a:'arrow' };
    if (map[e.key] && !e.ctrlKey && !e.metaKey) {
      document.querySelector('.tool.active').classList.remove('active');
      document.querySelector(`.tool[data-tool="${map[e.key]}"]`).classList.add('active');
      tool = map[e.key];
      canvas.style.cursor = tool==='eraser'?'cell':tool==='text'?'text':'crosshair';
      $('#fontSec').style.display = tool==='text'?'':'none';
    }
  });

  // ═════════════════════════════════════════════════
  //  TOAST
  // ═════════════════════════════════════════════════

  function showToast(msg, ms) {
    ms = ms || 2500;
    toastEl.textContent = msg;
    toastEl.classList.remove('hidden');
    toastEl.classList.add('show');
    clearTimeout(toastEl._t);
    toastEl._t = setTimeout(() => {
      toastEl.classList.remove('show');
      setTimeout(() => toastEl.classList.add('hidden'), 300);
    }, ms);
  }

  // ═════════════════════════════════════════════════
  //  START
  // ═════════════════════════════════════════════════
  boot();

})();
