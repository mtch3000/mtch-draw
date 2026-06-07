// ================================================================
//  DRAW TOGETHER — app.js
//  Main drawing logic + real-time sync with Firebase
// ================================================================

function getOrCreateUserId() {
  let uid = localStorage.getItem('drawtogether_uid');
  if (!uid) {
    uid = 'u_' + Math.random().toString(36).slice(2, 9) + '_' + Date.now();
    localStorage.setItem('drawtogether_uid', uid);
  }
  return uid;
}
const MY_USER_ID = getOrCreateUserId();

// ── CANVAS SETUP & RESIZING ───────────────────────────────────────

const canvas  = document.getElementById('canvas');
const ctx     = canvas.getContext('2d');

let isPortraitMode = false;

// Make canvas fill the screen appropriately. Mobile portrait screens
// apply a 90deg CSS rotation to maintain a shared landscape coordinate space.
function resizeCanvas() {
  const toolbarEl = document.getElementById('toolbar');
  const toolbarH  = toolbarEl ? toolbarEl.offsetHeight : 52;
  const screenW   = window.innerWidth;
  const screenH   = window.innerHeight - toolbarH;

  isPortraitMode = screenH > screenW;

  if (isPortraitMode) {
    // Internal resolution stays landscape, filling the portrait bounds
    canvas.width  = screenH;
    canvas.height = screenW;
    
    // Explicitly set DOM element size and apply CSS rotation
    canvas.style.width = screenH + 'px';
    canvas.style.height = screenW + 'px';
    canvas.style.transformOrigin = '0 0';
    canvas.style.transform = `translateX(${screenW}px) rotate(90deg)`;
  } else {
    // Standard landscape layout
    canvas.width  = screenW;
    canvas.height = screenH;
    canvas.style.width = screenW + 'px';
    canvas.style.height = screenH + 'px';
    canvas.style.transformOrigin = '0 0';
    canvas.style.transform = 'none';
  }

  redrawAll();
}

window.addEventListener('resize', resizeCanvas);
window.addEventListener('orientationchange', () => {
  setTimeout(resizeCanvas, 150);
});

// ── COORDINATE MAPPING ────────────────────────────────────────────

// Translates viewport screen coordinates into the internal canvas coordinates
function getCanvasCoord(clientX, clientY) {
  const toolbarEl = document.getElementById('toolbar');
  const toolbarH  = toolbarEl ? toolbarEl.offsetHeight : 52;

  // Screen coordinates relative to the canvas drawing area
  const sx = clientX;
  const sy = clientY - toolbarH;

  if (isPortraitMode) {
    // Inverse mapping of `translateX(screenW) rotate(90deg)`
    // canvas.height is exactly our portrait screen width.
    const W = canvas.height; 
    return { x: sy, y: W - sx };
  } else {
    return { x: sx, y: sy };
  }
}

// ── DRAWING STATE VARIABLES ───────────────────────────────────────

let isDrawing     = false; 
let currentTool   = 'pen'; 
let currentColor  = '#1a1a1a';
let currentSize   = 5;

let liveStroke    = null;
let myStrokeIds   = [];
let allStrokes    = {};
let dbRef         = null;

const TOOL_SETTINGS = {
  pen:    { widthFactor: 0.35,  alpha: 1.0 },
  pencil: { widthFactor: 0.25,  alpha: 0.60 },
  brush:  { widthFactor: 2.2,   alpha: 0.40 },
  eraser: { widthFactor: 2.0,   alpha: 1.0 }
};

// ── DRAWING LOGIC ─────────────────────────────────────────────────

function drawStroke(stroke) {
  if (!stroke || !stroke.points || stroke.points.length === 0) return;

  const settings = TOOL_SETTINGS[stroke.tool] || TOOL_SETTINGS.pen;
  const pts      = stroke.points;
  const lineW    = Math.max(1, stroke.size * settings.widthFactor);

  ctx.save();
  ctx.lineCap    = 'round';
  ctx.lineJoin   = 'round';
  ctx.lineWidth  = lineW;
  ctx.globalAlpha = settings.alpha;

  if (stroke.tool === 'eraser') {
    ctx.globalCompositeOperation = 'destination-out';
  } else {
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = stroke.color || '#1a1a1a';
    ctx.fillStyle   = stroke.color || '#1a1a1a';
  }

  ctx.beginPath();

  if (pts.length === 1) {
    ctx.arc(pts[0].x, pts[0].y, lineW / 2, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length - 1; i++) {
      const midX = (pts[i].x + pts[i + 1].x) / 2;
      const midY = (pts[i].y + pts[i + 1].y) / 2;
      ctx.quadraticCurveTo(pts[i].x, pts[i].y, midX, midY);
    }
    ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
    ctx.stroke();
  }

  ctx.restore();
}

function redrawAll() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#fefefe';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const sorted = Object.values(allStrokes).sort((a, b) => a.timestamp - b.timestamp);
  sorted.forEach(stroke => drawStroke(stroke));
}

// ── STROKE LIFECYCLE ──────────────────────────────────────────────

function startStroke(x, y) {
  liveStroke = {
    userId:    MY_USER_ID,
    tool:      currentTool,
    color:     currentTool === 'eraser' ? '#fefefe' : currentColor,
    size:      currentSize,
    points:    [{ x, y }],
    timestamp: Date.now()
  };
  drawStroke(liveStroke);
}

function continueStroke(x, y) {
  if (!liveStroke) return;
  liveStroke.points.push({ x, y });

  const pts = liveStroke.points;
  const n   = pts.length;
  if (n < 2) return;

  const settings = TOOL_SETTINGS[liveStroke.tool] || TOOL_SETTINGS.pen;
  const lineW    = Math.max(1, liveStroke.size * settings.widthFactor);

  ctx.save();
  ctx.lineCap   = 'round';
  ctx.lineJoin  = 'round';
  ctx.lineWidth = lineW;
  ctx.globalAlpha = settings.alpha;

  if (liveStroke.tool === 'eraser') {
    ctx.globalCompositeOperation = 'destination-out';
  } else {
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = liveStroke.color;
  }

  ctx.beginPath();
  if (n >= 3) {
    const prev  = pts[n - 3];
    const curr  = pts[n - 2];
    const next  = pts[n - 1];
    const midX  = (curr.x + next.x) / 2;
    const midY  = (curr.y + next.y) / 2;
    ctx.moveTo((prev.x + curr.x) / 2, (prev.y + curr.y) / 2);
    ctx.quadraticCurveTo(curr.x, curr.y, midX, midY);
  } else {
    ctx.moveTo(pts[n - 2].x, pts[n - 2].y);
    ctx.lineTo(pts[n - 1].x, pts[n - 1].y);
  }

  ctx.stroke();
  ctx.restore();
}

function endStroke() {
  if (!liveStroke || liveStroke.points.length === 0) {
    liveStroke = null;
    return;
  }

  const strokeKey = dbRef.push().key;

  myStrokeIds.push(strokeKey);
  if (myStrokeIds.length > 5) myStrokeIds.shift();
  
  updateUndoBadge();

  dbRef.child(strokeKey).set(liveStroke)
    .catch(err => console.error('Failed to save stroke:', err));

  liveStroke = null;
}

// ── EVENTS (Mouse & Touch) ────────────────────────────────────────

function posFromMouse(e) {
  return getCanvasCoord(e.clientX, e.clientY);
}

canvas.addEventListener('mousedown', e => {
  isDrawing = true;
  const p = posFromMouse(e);
  startStroke(p.x, p.y);
});

canvas.addEventListener('mousemove', e => {
  if (!isDrawing) return;
  const p = posFromMouse(e);
  continueStroke(p.x, p.y);
});

canvas.addEventListener('mouseup', () => {
  if (!isDrawing) return;
  isDrawing = false;
  endStroke();
});

canvas.addEventListener('mouseleave', () => {
  if (!isDrawing) return;
  isDrawing = false;
  endStroke();
});

// Touch Events
function posFromTouch(e) {
  const touch = e.touches[0];
  return getCanvasCoord(touch.clientX, touch.clientY);
}

canvas.addEventListener('touchstart', e => {
  e.preventDefault();
  isDrawing = true;
  const p = posFromTouch(e);
  startStroke(p.x, p.y);
}, { passive: false });

canvas.addEventListener('touchmove', e => {
  e.preventDefault();
  if (!isDrawing) return;
  const p = posFromTouch(e);
  continueStroke(p.x, p.y);
}, { passive: false });

canvas.addEventListener('touchend', e => {
  e.preventDefault();
  if (!isDrawing) return;
  isDrawing = false;
  endStroke();
}, { passive: false });

canvas.addEventListener('touchcancel', e => {
  e.preventDefault();
  isDrawing = false;
  liveStroke = null;
}, { passive: false });


// ── TOOLBAR CONTROLS ──────────────────────────────────────────────

document.querySelectorAll('.tool-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentTool = btn.dataset.tool;
    canvas.style.cursor = (currentTool === 'eraser') ? 'cell' : 'crosshair';
  });
});

const colorPicker = document.getElementById('color-picker');
const colorSwatch = document.getElementById('color-swatch');

colorPicker.addEventListener('input', e => {
  currentColor = e.target.value;
  colorSwatch.style.background = currentColor;
});
colorSwatch.style.background = colorPicker.value;

const sizeSlider = document.getElementById('size-slider');
const sizeDot    = document.getElementById('size-dot');

sizeSlider.addEventListener('input', e => {
  currentSize = parseInt(e.target.value, 10);
  const dotPx = Math.max(4, Math.min(20, currentSize * 0.6));
  sizeDot.style.width  = dotPx + 'px';
  sizeDot.style.height = dotPx + 'px';
});

document.getElementById('undo-btn').addEventListener('click', () => {
  if (myStrokeIds.length === 0) return;
  const lastId = myStrokeIds.pop();
  dbRef.child(lastId).remove().catch(err => console.error('Undo failed:', err));
  updateUndoBadge();
});

function updateUndoBadge() {
  const badge = document.getElementById('undo-count');
  const btn   = document.getElementById('undo-btn');
  if (!badge || !btn) return;
  badge.textContent = myStrokeIds.length;
  btn.disabled = (myStrokeIds.length === 0);
}

// ── FIREBASE ──────────────────────────────────────────────────────

function initSync() {
  dbRef = firebase.database().ref('strokes');
  dbRef.on('value', snapshot => {
    allStrokes = snapshot.val() || {};
    redrawAll();
    
    if (isDrawing && liveStroke) {
      drawStroke(liveStroke);
    }

    const loader = document.getElementById('loading-screen');
    if (loader && !loader.classList.contains('hidden')) {
      loader.classList.add('hidden');
      setTimeout(() => loader.remove(), 500);
    }
  }, err => {
    console.error('Firebase sync error:', err);
    const loader = document.getElementById('loading-screen');
    if (loader) loader.classList.add('hidden');
  });
}

// ── START ─────────────────────────────────────────────────────────

window.addEventListener('load', () => {
  resizeCanvas();

  try {
    initSync();
  } catch (e) {
    console.error('Could not start Firebase. Did you fill in js/config.js?', e);
    const loader = document.getElementById('loading-screen');
    if (loader) {
      loader.querySelector('p').textContent = '⚠️ Firebase not configured. See SETUP_GUIDE.md';
    }
  }

  updateUndoBadge();
});
