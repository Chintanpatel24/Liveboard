/* ── Reset & Base ─────────────────────────────────── */
*, *::before, *::after {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

:root {
  --topbar-h: 52px;
  --toolbar-w: 200px;
  --bg: #f0f0f0;
  --surface: #ffffff;
  --text: #222;
  --accent: #3b82f6;
  --danger: #ef4444;
  --shadow: 0 2px 12px rgba(0,0,0,.08);
}

html, body {
  height: 100%;
  overflow: hidden;
  font-family: 'Inter', system-ui, sans-serif;
  background: var(--bg);
  color: var(--text);
}

/* ── Top Bar ──────────────────────────────────────── */
#topbar {
  position: fixed;
  top: 0; left: 0; right: 0;
  height: var(--topbar-h);
  background: var(--surface);
  box-shadow: var(--shadow);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  z-index: 100;
}

.topbar-left, .topbar-right {
  display: flex;
  align-items: center;
  gap: 14px;
}

.logo {
  font-weight: 700;
  font-size: 18px;
  user-select: none;
}

.user-count {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: #666;
  background: #f5f5f5;
  padding: 4px 10px;
  border-radius: 20px;
}

.dot {
  width: 8px; height: 8px;
  background: #2ecc71;
  border-radius: 50%;
  display: inline-block;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: .4; }
}

/* ── Buttons ──────────────────────────────────────── */
.btn {
  padding: 6px 14px;
  border: 1px solid #ddd;
  border-radius: 8px;
  background: var(--surface);
  cursor: pointer;
  font-size: 13px;
  font-family: inherit;
  transition: all .15s;
  user-select: none;
}
.btn:hover { background: #f5f5f5; }
.btn-share {
  background: var(--accent);
  color: #fff;
  border-color: var(--accent);
}
.btn-share:hover { background: #2563eb; }
.btn-danger { color: var(--danger); border-color: var(--danger); }
.btn-danger:hover { background: #fef2f2; }
.btn-full { width: 100%; text-align: center; }

/* ── Toolbar (Left Sidebar) ───────────────────────── */
#toolbar {
  position: fixed;
  top: var(--topbar-h);
  left: 0;
  width: var(--toolbar-w);
  height: calc(100% - var(--topbar-h));
  background: var(--surface);
  box-shadow: 2px 0 12px rgba(0,0,0,.06);
  padding: 16px 14px;
  overflow-y: auto;
  z-index: 90;
}

.tool-section {
  margin-bottom: 20px;
}

.tool-section label {
  display: block;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: .5px;
  color: #888;
  margin-bottom: 8px;
  font-weight: 600;
}

/* Tool Grid */
.tool-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 4px;
}

.tool-btn {
  width: 100%;
  aspect-ratio: 1;
  border: 2px solid transparent;
  border-radius: 10px;
  background: #f5f5f5;
  cursor: pointer;
  font-size: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all .15s;
}
.tool-btn:hover { background: #e8e8e8; }
.tool-btn.active {
  border-color: var(--accent);
  background: #eff6ff;
}

/* Color Grid */
.color-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 5px;
  margin-bottom: 8px;
}

.color-btn {
  width: 100%;
  aspect-ratio: 1;
  border: 3px solid transparent;
  border-radius: 50%;
  cursor: pointer;
  transition: transform .15s, border-color .15s;
}
.color-btn:hover { transform: scale(1.15); }
.color-btn.active { border-color: var(--accent); transform: scale(1.15); }

#customColor {
  width: 100%;
  height: 30px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  background: none;
}

/* Range sliders */
input[type="range"] {
  width: 100%;
  accent-color: var(--accent);
}

/* ── Canvas Area ──────────────────────────────────── */
#canvasArea {
  position: fixed;
  top: var(--topbar-h);
  left: var(--toolbar-w);
  right: 0;
  bottom: 0;
  overflow: auto;
  background:
    /* paper dots */
    radial-gradient(circle, #ddd 1px, transparent 1px);
  background-size: 24px 24px;
  background-color: #fafafa;
}

#whiteboard {
  display: block;
  background: #ffffff;
  box-shadow: 0 0 40px rgba(0,0,0,.07);
  cursor: crosshair;
  /* The canvas is sized via JS */
}

/* ── Live Cursors ─────────────────────────────────── */
#cursorsLayer {
  position: fixed;
  top: var(--topbar-h);
  left: var(--toolbar-w);
  right: 0;
  bottom: 0;
  pointer-events: none;
  z-index: 50;
  overflow: hidden;
}

.remote-cursor {
  position: absolute;
  pointer-events: none;
  transition: left .08s linear, top .08s linear;
  z-index: 51;
}

.cursor-dot {
  width: 12px; height: 12px;
  border-radius: 50%;
  border: 2px solid #fff;
  box-shadow: 0 0 4px rgba(0,0,0,.3);
}

.cursor-label {
  position: absolute;
  top: 14px; left: 8px;
  font-size: 10px;
  background: rgba(0,0,0,.7);
  color: #fff;
  padding: 1px 6px;
  border-radius: 4px;
  white-space: nowrap;
  font-weight: 500;
}

/* ── Text Input Overlay ───────────────────────────── */
.text-input {
  position: absolute;
  background: rgba(255,255,255,.9);
  border: 2px dashed var(--accent);
  border-radius: 4px;
  padding: 4px 8px;
  font-family: 'Inter', sans-serif;
  font-size: 20px;
  outline: none;
  resize: none;
  min-width: 100px;
  z-index: 60;
}

.hidden { display: none !important; }

/* ── Toast ────────────────────────────────────────── */
.toast {
  position: fixed;
  bottom: 30px;
  left: 50%;
  transform: translateX(-50%);
  background: #333;
  color: #fff;
  padding: 10px 24px;
  border-radius: 10px;
  font-size: 14px;
  z-index: 999;
  box-shadow: 0 4px 20px rgba(0,0,0,.2);
  transition: opacity .3s;
}
.toast.hidden { opacity: 0; pointer-events: none; }
.toast.show { opacity: 1; }

/* ── Scrollbar ────────────────────────────────────── */
#canvasArea::-webkit-scrollbar { width: 8px; height: 8px; }
#canvasArea::-webkit-scrollbar-track { background: transparent; }
#canvasArea::-webkit-scrollbar-thumb { background: #ccc; border-radius: 4px; }

/* ── Responsive ───────────────────────────────────── */
@media (max-width: 768px) {
  :root { --toolbar-w: 64px; }

  #toolbar { padding: 10px 6px; }
  .tool-section label { display: none; }
  .tool-grid { grid-template-columns: 1fr 1fr; }
  .color-grid { grid-template-columns: repeat(3, 1fr); }
  .btn span { display: none; }

  #fontSizeSection, #downloadBtn, #customColor,
  #brushOpacity, .tool-section:has(#brushOpacity) { display: none !important; }
}
