/* ═══════════════════════════════════════════════════════
   LiveBoard — Client
   ═══════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const socket = io();

  // ── Constants ──────────────────────────────────
  const W = 2400, H = 1600;                         // fixed canvas resolution

  // ── DOM ────────────────────────────────────────
  const $ = (s) => document.querySelector(s);
  const landing      = $('#landing');
  const board        = $('#board');
  const canvas       = $('#mainCanvas');
  const preview      = $('#previewCanvas');
  const ctx          = canvas.getContext('2d');
  const pctx         = preview.getContext('2d');
  const cursorLayer  = $('#cursorLayer');
  const textBox      = $('#textBox');
  const toastEl      = $('#toast');

  // ── State ──────────────────────────────────────
  let roomId        = null;
  let myName        = '';
  let strokes       = [];          // committed strokes
  let currentStroke = null;        // in-progress stroke
  let tool          = 'pen';
  let color         = '#000000';
  let size          = 4;
  let opacity       = 1;
  let fontSize      = 24;
  let drawing       = false;
  let shapeStart    = null;        // {x,y} for shape tools
  const cursors     = {};          // remote cursors
  const COLORS      = ['#ef4444','#3b82f6','#22c55e','#f97316','#8b5cf6','#06b6d4','#ec4899','#eab308'];

  // ═════════════════════════════════════════════════
  //  ROUTING
  // ═════════════════════════════════════════════════

  function getParam(k) {
    return new URLSearchParams(window.location.search).get(k);
  }

  function init() {
    const r = getParam('room');
    if (r) {
      enterBoard(r);
    } else {
      landing.classList.remove('hidden');
      board.classList.add('hidden');
    }
  }

  // Create board
  $('#createBtn').addEventListener('click', () => {
    const id = Math.random().toString(36).substr(2, 8);
    window.history.pushState({}, '', '?room=' + id);
    enterBoard(id);
  });

  // Join board
  $('#joinBtn').addEventListener('click', () => {
    const val = $('#joinInput').value.trim();
    if (!val) return;
    // accept full URL or just the code
    let id = val;
    try {
      const u = new URL(val);
      id = u.searchParams.get('room') || val;
    } catch (_) { /* it's just a code */ }
    window.history.pushState({}, '', '?room=' + id);
    enterBoard(id);
  });

  function enterBoard(id) {
    roomId = id;
    landing.classList.add('hidden');
    board.classList.remove('hidden');
    setupCanvas();
    socket.emit('join-room', roomId);
  }

  // ═════════════════════════════════════════════════
  //  CANVAS SETUP
  // ═════════════════════════════════════════════════

  function setupCanvas() {
    canvas.width  = W;
    canvas.height = H;
    preview.width = W;
    preview.height= H;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, W, H);
  }

  // Convert mouse/touch → canvas coords (handles CSS scaling)
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
      y: (cy - rect.top)  * (H / rect.height)
    };
  }

  // ═════════════════════════════════════════════════
  //  ATOMIC DRAW HELPERS  (each fully self-contained)
  // ═════════════════════════════════════════════════

  function drawSeg(c, x1, y1, x2, y2, col, w, op, eraser) {
    c.save();
    c.beginPath();
    c.moveTo(x1, y1);
    c.lineTo(x2, y2);
    c.strokeStyle = eraser ? '#FFFFFF' : col;
    c.lineWidth   = eraser ? w * 3 : w;
    c.globalAlpha = eraser ? 1 : op;
    c.lineCap     = 'round';
    c.lineJoin    = 'round';
    c.stroke();
    c.restore();
  }

  function drawFullPath(c, s) {
    const pts = s.points;
    if (!pts || pts.length < 2) {
      if (pts && pts.length === 1) {
        // single dot
        c.save();
        c.beginPath();
        c.arc(pts[0].x, pts[0].y, (s.eraser ? s.width*1.5 : s.width/2), 0, Math.PI*2);
        c.fillStyle = s.eraser ? '#FFFFFF' : s.color;
        c.globalAlpha = s.eraser ? 1 : s.opacity;
        c.fill();
        c.restore();
      }
      return;
    }
    c.save();
    c.beginPath();
    c.strokeStyle = s.eraser ? '#FFFFFF' : s.color;
    c.lineWidth   = s.eraser ? s.width * 3 : s.width;
    c.globalAlpha = s.eraser ? 1 : s.opacity;
    c.lineCap     = 'round';
    c.lineJoin    = 'round';
    c.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length - 1; i++) {
      const mx = (pts[i].x + pts[i+1].x) / 2;
      const my = (pts[i].y + pts[i+1].y) / 2;
      c.quadraticCurveTo(pts[i].x, pts[i].y, mx, my);
    }
    c.lineTo(pts[pts.length-1].x, pts[pts.length-1].y);
    c.stroke();
    c.restore();
  }

  function drawLine(c, x1,y1,x2,y2,col,w,op) {
    c.save(); c.beginPath(); c.moveTo(x1,y1); c.lineTo(x2,y2);
    c.strokeStyle=col; c.lineWidth=w; c.globalAlpha=op;
    c.lineCap='round'; c.stroke(); c.restore();
  }

  function drawRect(c, x1,y1,x2,y2,col,w,op) {
    c.save(); c.strokeStyle=col; c.lineWidth=w; c.globalAlpha=op;
    c.strokeRect(Math.min(x1,x2),Math.min(y1,y2),Math.abs(x2-x1),Math.abs(y2-y1));
    c.restore();
  }

  function drawCircle(c, x1,y1,x2,y2,col,w,op) {
    c.save(); c.beginPath();
    const rx=Math.abs(x2-x1)/2, ry=Math.abs(y2-y1)/2;
    c.ellipse(Math.min(x1,x2)+rx, Math.min(y1,y2)+ry, rx||1, ry||1, 0,0,Math.PI*2);
    c.strokeStyle=col; c.lineWidth=w; c.globalAlpha=op; c.stroke(); c.restore();
  }

  function drawArrow(c, x1,y1,x2,y2,col,w,op) {
    c.save(); c.strokeStyle=col; c.fillStyle=col; c.lineWidth=w; c.globalAlpha=op;
    c.beginPath(); c.moveTo(x1,y1); c.lineTo(x2,y2); c.stroke();
    const a=Math.atan2(y2-y1,x2-x1), h=Math.max(14,w*4);
    c.beginPath(); c.moveTo(x2,y2);
    c.lineTo(x2-h*Math.cos(a-Math.PI/6),y2-h*Math.sin(a-Math.PI/6));
    c.lineTo(x2-h*Math.cos(a+Math.PI/6),y2-h*Math.sin(a+Math.PI/6));
    c.closePath(); c.fill(); c.restore();
  }

  function drawText(c, s) {
    c.save();
    c.font = s.size + 'px "Segoe UI", system-ui, sans-serif';
    c.fillStyle = s.color;
    c.globalAlpha = s.opacity;
    const lines = s.text.split('\n');
    lines.forEach((line, i) => c.fillText(line, s.x, s.y + i * s.size * 1.25));
    c.restore();
  }

  function drawShape(c, s) {
    switch(s.shape) {
      case 'line':   drawLine(c,s.x1,s.y1,s.x2,s.y2,s.color,s.width,s.opacity); break;
      case 'rect':   drawRect(c,s.x1,s.y1,s.x2,s.y2,s.color,s.width,s.opacity); break;
      case 'circle': drawCircle(c,s.x1,s.y1,s.x2,s.y2,s.color,s.width,s.opacity); break;
      case 'arrow':  drawArrow(c,s.x1,s.y1,s.x2,s.y2,s.color,s.width,s.opacity); break;
    }
  }

  function renderStroke(c, s) {
    if (s.type === 'path')  drawFullPath(c, s);
    if (s.type === 'shape') drawShape(c, s);
    if (s.type === 'text')  drawText(c, s);
  }

  // ── Full Redraw ────────────────────────────────
  function redrawAll() {
    ctx.save();
    ctx.fillStyle = '#FFFFFF';
    ctx.globalAlpha = 1;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
    strokes.forEach(s => renderStroke(ctx, s));
  }

  // ═════════════════════════════════════════════════
  //  POINTER EVENTS
  // ═════════════════════════════════════════════════

  function onDown(e) {
    e.preventDefault();
    const p = xy(e);

    // ── Text tool ──
    if (tool === 'text') {
      openText(p.x, p.y);
      return;
    }

    drawing = true;

    // ── Shapes ──
    if (['line','rect','circle','arrow'].includes(tool)) {
      shapeStart = p;
      return;
    }

    // ── Pen / Eraser ──
    currentStroke = {
      type: 'path',
      color: color,
      width: size,
      opacity: opacity,
      eraser: tool === 'eraser',
      points: [p]
    };
  }

  function onMove(e) {
    e.preventDefault();
    const p = xy(e);

    // send cursor
    socket.emit('cursor', p);

    if (!drawing) return;

    // ── Shape preview ──
    if (shapeStart) {
      pctx.clearRect(0, 0, W, H);
      const tmp = { shape: tool, x1:shapeStart.x, y1:shapeStart.y, x2:p.x, y2:p.y, color, width:size, opacity };
      drawShape(pctx, tmp);
      return;
    }

    // ── Pen / Eraser ──
    if (!currentStroke) return;
    const last = currentStroke.points[currentStroke.points.length - 1];
    currentStroke.points.push(p);

    // draw locally
    drawSeg(ctx, last.x, last.y, p.x, p.y, color, size, opacity, currentStroke.eraser);

    // send live segment to others
    socket.emit('live-draw', {
      x1: last.x, y1: last.y, x2: p.x, y2: p.y,
      color, width: size, opacity,
      eraser: currentStroke.eraser
    });
  }

  function onUp(e) {
    if (!drawing) return;
    drawing = false;

    // ── Shape commit ──
    if (shapeStart) {
      pctx.clearRect(0, 0, W, H);
      const p = xy(e);
      const s = { type:'shape', shape:tool, x1:shapeStart.x, y1:shapeStart.y,
                  x2:p.x, y2:p.y, color, width:size, opacity };
      drawShape(ctx, s);
      strokes.push(s);
      socket.emit('commit-stroke', s);
      shapeStart = null;
      return;
    }

    // ── Pen / Eraser commit ──
    if (currentStroke) {
      strokes.push(currentStroke);
      socket.emit('commit-stroke', currentStroke);
      currentStroke = null;
    }
  }

  canvas.addEventListener('mousedown',  onDown);
  canvas.addEventListener('mousemove',  onMove);
  canvas.addEventListener('mouseup',    onUp);
  canvas.addEventListener('mouseleave', onUp);
  canvas.addEventListener('touchstart', onDown, { passive: false });
  canvas.addEventListener('touchmove',  onMove, { passive: false });
  canvas.addEventListener('touchend',   onUp);
  canvas.addEventListener('touchcancel',onUp);

  // ═════════════════════════════════════════════════
  //  TEXT TOOL
  // ═════════════════════════════════════════════════

  function openText(cx, cy) {
    const rect = canvas.getBoundingClientRect();
    const sx = rect.width / W;
    const sy = rect.height / H;
    textBox.classList.remove('hidden');
    textBox.style.left = (cx * sx) + 'px';
    textBox.style.top  = (cy * sy) + 'px';
    textBox.style.fontSize = (fontSize * sx) + 'px';
    textBox.style.color = color;
    textBox.value = '';
    textBox._cx = cx;
    textBox._cy = cy;
    setTimeout(() => textBox.focus(), 30);
  }

  function commitText() {
    const t = textBox.value.trim();
    textBox.classList.add('hidden');
    if (!t) return;
    const s = { type:'text', text:t, x:textBox._cx, y:textBox._cy + fontSize,
                color, size:fontSize, opacity };
    drawText(ctx, s);
    strokes.push(s);
    socket.emit('commit-stroke', s);
  }

  textBox.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commitText(); }
    if (e.key === 'Escape') textBox.classList.add('hidden');
  });
  textBox.addEventListener('blur', commitText);

  // ═════════════════════════════════════════════════
  //  SOCKET HANDLERS
  // ═════════════════════════════════════════════════

  socket.on('init', (data) => {
    myName = data.userName;
    strokes = data.strokes || [];
    $('#onlineNum').textContent = data.userCount;
    redrawAll();
    showToast('Welcome, ' + myName + '! 👋');
  });

  // live pen/eraser from others
  socket.on('live-draw', (d) => {
    drawSeg(ctx, d.x1, d.y1, d.x2, d.y2, d.color, d.width, d.opacity, d.eraser);
  });

  // committed stroke from others — just store (already visible via live-draw for paths)
  socket.on('new-stroke', (s) => {
    strokes.push(s);
    // shapes and text weren't shown via live-draw, so draw them now
    if (s.type === 'shape' || s.type === 'text') {
      renderStroke(ctx, s);
    }
  });

  // full redraw (after undo or clear)
  socket.on('full-redraw', (arr) => {
    strokes = arr;
    redrawAll();
  });

  socket.on('user-count', (n) => {
    $('#onlineNum').textContent = n;
  });

  socket.on('toast', (msg) => showToast(msg));

  // ── Remote cursors ─────────────────────────────
  socket.on('cursor', (d) => {
    let el = cursors[d.id];
    if (!el) {
      el = document.createElement('div');
      el.className = 'rcursor';
      const ci = Object.keys(cursors).length % COLORS.length;
      el.innerHTML = `<div class="rcursor-dot" style="background:${COLORS[ci]}"></div>
                      <div class="rcursor-name">${d.name}</div>`;
      cursorLayer.appendChild(el);
      cursors[d.id] = el;
    }
    // convert canvas coords → CSS coords
    const rect = canvas.getBoundingClientRect();
    el.style.left = (d.x * rect.width / W) + 'px';
    el.style.top  = (d.y * rect.height / H) + 'px';
  });

  socket.on('cursor-gone', (id) => {
    if (cursors[id]) { cursors[id].remove(); delete cursors[id]; }
  });

  // ═════════════════════════════════════════════════
  //  TOOLBAR UI
  // ═════════════════════════════════════════════════

  // Tools
  document.querySelectorAll('.tool').forEach(b => {
    b.addEventListener('click', () => {
      document.querySelector('.tool.active').classList.remove('active');
      b.classList.add('active');
      tool = b.dataset.tool;
      canvas.style.cursor = tool === 'eraser' ? 'cell' : tool === 'text' ? 'text' : 'crosshair';
      $('#fontSec').style.display = tool === 'text' ? '' : 'none';
    });
  });

  // Colors
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

  // Sliders
  $('#sizeSlider').addEventListener('input', (e) => {
    size = +e.target.value;
    $('#sizeVal').textContent = size;
  });
  $('#opSlider').addEventListener('input', (e) => {
    opacity = +e.target.value / 100;
    $('#opVal').textContent = e.target.value;
  });
  $('#fontSlider').addEventListener('input', (e) => {
    fontSize = +e.target.value;
    $('#fontVal').textContent = fontSize;
  });

  // ── Top bar buttons ────────────────────────────

  // Share
  $('#shareBtn').addEventListener('click', () => {
    const url = window.location.href;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url).then(() => showToast('Link copied! Share it 🔗'));
    } else {
      prompt('Copy this link:', url);
    }
  });

  // Undo
  $('#undoBtn').addEventListener('click', () => socket.emit('undo'));

  // Clear
  $('#clearBtn').addEventListener('click', () => {
    if (confirm('Clear the entire board for everyone?')) socket.emit('clear');
  });

  // Download
  $('#downloadBtn').addEventListener('click', () => {
    const a = document.createElement('a');
    a.download = 'liveboard-' + Date.now() + '.png';
    a.href = canvas.toDataURL();
    a.click();
    showToast('Saved as PNG! 💾');
  });

  // ── Keyboard Shortcuts ─────────────────────────
  document.addEventListener('keydown', (e) => {
    if (e.target === textBox) return;
    if (e.ctrlKey && e.key === 'z') { e.preventDefault(); socket.emit('undo'); return; }
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
  //  BOOT
  // ═════════════════════════════════════════════════
  init();

})();
