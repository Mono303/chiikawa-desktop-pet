---
name: chiikawa-desktop-pet
description: >
  Creates a Chiikawa (吉伊/ちいかわ) desktop pet for Windows using Electron — a
  transparent, always-on-top animated character that loops GIF animations, responds
  to clicks with random state transitions, detects rapid clicks to trigger a cry
  animation, and is draggable. Use this skill whenever the user asks about desktop
  pets, desktop mascots, transparent desktop characters, Chiikawa/吉伊/ちいかわ on
  desktop, Windows pet applications, or wants to build an animated always-on-top
  GIF character for Windows. This includes any mention of "桌宠", "桌面宠物",
  "吉伊桌宠", "桌面萌宠", or similar.
compatibility:
  - electron
  - gifuct-js
  - windows
  - npm
---

# 吉伊桌宠 (Chiikawa Desktop Pet)

## Overview

Creates a Windows desktop pet that displays a Chiikawa character. The character:
- Sits on top of all windows (`alwaysOnTop`)
- Has a transparent background (only the character pixels are visible)
- Loops a default idle animation (`nomal.gif`)
- Randomly switches to one of 7 action animations (`1.gif` ~ `7.gif`) every 60 seconds
- On click: triggers a random action animation
- On 3 rapid clicks within 3 seconds: triggers the cry animation (`cry.gif`)
- Is draggable by holding and moving the mouse
- Right-click shows a context menu (reset position / quit)
- System tray icon shows running status with quick-quit menu

## Project Structure

```
chiikawa-pet/
├── main.js                # Electron main process
├── preload.js             # Context bridge (exposes gifuct + IPC APIs)
├── renderer/
│   ├── index.html         # Pet window HTML
│   ├── style.css          # Styles
│   └── app.js             # Core logic (state machine, GIF rendering, interaction)
├── assets/                # GIF assets + optional audio (user-replaceable)
│   ├── nomal.gif          # Default idle loop
│   ├── 1.gif ~ 7.gif      # Random action animations
│   ├── cry.gif            # Cry animation (rapid-click trigger)
│   ├── sound1.mp3 ~ soundN.mp3  # Optional custom sound effects (named independently)
├── package.json
├── start.bat              # Windows launcher
└── README.md
```

## State Machine

- **idle** — loops `nomal.gif` indefinitely
- **1 ~ 7** — plays the corresponding GIF once, then returns to idle
- **cry** — plays `cry.gif` once, then returns to idle

Trigger rules:
- Every 60s: pick a random state from 1-7, play it once, return to idle
- On click (on character): same as above
- On 3 clicks within 3s: trigger cry, return to idle
- On drag: move the Electron window, no state change

## Design Document

Full design doc at `docs/superpowers/specs/2026-05-13-chiikawa-desktop-pet-design.md`

## Source Code

### main.js — Electron Main Process

```js
const { app, BrowserWindow, ipcMain, Menu, Tray, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');

let win;

function createWindow() {
  const { screen } = require('electron');
  const workArea = screen.getPrimaryDisplay().workAreaSize;

  win = new BrowserWindow({
    width: 200, height: 200,
    frame: false, transparent: true, alwaysOnTop: true,
    skipTaskbar: true, resizable: false, hasShadow: false, show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true, nodeIntegration: false, sandbox: false
    }
  });

  win.setIgnoreMouseEvents(true, { forward: true });
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  win.once('ready-to-show', () => {
    win.show();
    win.setPosition(
      Math.round((workArea.width - 200) / 2),
      Math.round((workArea.height - 200) / 2)
    );
  });

  const ctxMenu = Menu.buildFromTemplate([
    { label: 'Reset Position', click: () => win.setPosition(
      Math.round((workArea.width - 200) / 2),
      Math.round((workArea.height - 200) / 2)
    )},
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() }
  ]);

  ipcMain.on('show-context-menu', () => ctxMenu.popup({ window: win }));
}

// ---- System tray icon ----
let tray = null;

function createTray() {
  const size = 16;
  const buf = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - (size - 1) / 2;
      const dy = y - (size - 1) / 2;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const i = (y * size + x) * 4;
      if (dist < size / 2) {
        buf[i] = 0x00; buf[i+1] = 0xcc; buf[i+2] = 0x4a; buf[i+3] = 0xff;
      } else {
        buf[i+3] = 0;
      }
    }
  }
  tray = new Tray(nativeImage.createFromBitmap(buf, { width: size, height: size }));
  tray.setToolTip('吉伊桌宠 — 运行中');
  const m = Menu.buildFromTemplate([{ label: 'Quit', click: () => app.quit() }]);
  tray.setContextMenu(m);
  tray.on('click', () => tray.popUpContextMenu());
}

app.whenReady().then(() => { createWindow(); createTray(); });
app.on('window-all-closed', () => app.quit());

ipcMain.on('set-ignore-mouse', (_, ignore, options) => {
  win.setIgnoreMouseEvents(ignore, options);
});

ipcMain.on('move-window', (_, dx, dy) => {
  const [x, y] = win.getPosition();
  win.setPosition(x + dx, y + dy);
});

ipcMain.on('resize-window', (_, w, h) => {
  win.setSize(Math.round(w), Math.round(h));
});

ipcMain.handle('get-audio-files', async () => {
  const assetsDir = path.join(__dirname, 'assets');
  try {
    const files = fs.readdirSync(assetsDir);
    return { mp3s: files.filter(f => f.endsWith('.mp3')) };
  } catch {
    return { mp3s: [] };
  }
});
```

### preload.js — Context Bridge

```js
const { contextBridge, ipcRenderer } = require('electron');
const { parseGIF, decompressFrames } = require('gifuct-js');

contextBridge.exposeInMainWorld('electronAPI', {
  setIgnoreMouse: (ignore, options) => ipcRenderer.send('set-ignore-mouse', ignore, options),
  moveWindow: (dx, dy) => ipcRenderer.send('move-window', dx, dy),
  resizeWindow: (w, h) => ipcRenderer.send('resize-window', w, h),
  showContextMenu: () => ipcRenderer.send('show-context-menu'),
  getAudioFiles: () => ipcRenderer.invoke('get-audio-files')
});

contextBridge.exposeInMainWorld('gifuct', {
  parseGIF, decompressFrames
});
```

### renderer/app.js — Core Logic

```js
const { parseGIF, decompressFrames } = window.gifuct;

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const offscreen = document.createElement('canvas');
const offCtx = offscreen.getContext('2d');
const pet = document.getElementById('pet');

const STATES = ['1', '2', '3', '4', '5', '6', '7'];
const GIFS = {};

// ---- Sound engine (Web Audio API synthesis) ----
let audioCtx = null;
let audioReady = false;

function ensureAudio() {
  if (audioReady) return true;
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') {
      audioCtx.resume().then(() => { audioReady = true; });
      return false;
    }
    audioReady = true;
    return true;
  } catch { return false; }
}

function playTone(freq, duration, type = 'sine', volume = 0.15) {
  try {
    if (!ensureAudio() || !audioCtx || audioCtx.state !== 'running') return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(volume, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
  } catch (e) {
    console.log('Audio error:', e.message);
  }
}

// ---- Sound pools (decoupled from state numbers) ----
const RANDOM_SOUND_POOL = [
  [523, 0.15, 'sine'],    [587, 0.15, 'sine'],
  [659, 0.15, 'sine'],    [698, 0.15, 'sine'],
  [784, 0.15, 'sine'],    [880, 0.15, 'sine'],
  [988, 0.15, 'sine'],    [1047, 0.12, 'triangle'],
  [554, 0.18, 'triangle'], [740, 0.12, 'sine'],
  [415, 0.2, 'triangle'],  [1319, 0.1, 'sine'],
];

const CRY_SOUND = [300, 0.4, 'sine'];
let loadedAudioBuffers = [];
let cryAudioBuffer = null;

async function loadAudioFiles() {
  const files = await window.electronAPI.getAudioFiles();
  if (!files.mp3s || files.mp3s.length === 0) return 0;

  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();

  for (const name of files.mp3s) {
    try {
      const resp = await fetch(`../assets/${encodeURIComponent(name)}`);
      if (!resp.ok) continue;
      const arrayBuf = await resp.arrayBuffer();
      const decoded = await audioCtx.decodeAudioData(arrayBuf);

      if (name === 'cry.mp3') {
        cryAudioBuffer = decoded;
      } else {
        loadedAudioBuffers.push(decoded);
      }
    } catch { /* skip */ }
  }

  return loadedAudioBuffers.length;
}

function playLoadedBuffer(buffer) {
  if (!audioCtx || audioCtx.state !== 'running') return;
  const source = audioCtx.createBufferSource();
  const gain = audioCtx.createGain();
  source.buffer = buffer;
  gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
  source.connect(gain);
  gain.connect(audioCtx.destination);
  source.start();
}

function pickRandomSound() {
  if (loadedAudioBuffers.length > 0) {
    const buf = loadedAudioBuffers[Math.floor(Math.random() * loadedAudioBuffers.length)];
    return () => playLoadedBuffer(buf);
  }
  const s = RANDOM_SOUND_POOL[Math.floor(Math.random() * RANDOM_SOUND_POOL.length)];
  return () => {
    playTone(s[0], s[1], s[2], 0.12);
    setTimeout(() => playTone(s[0] + 100, s[1] * 0.7, s[2], 0.08), 80);
  };
}

function playCrySound() {
  if (cryAudioBuffer) { playLoadedBuffer(cryAudioBuffer); return; }
  const s = CRY_SOUND;
  playTone(s[0], s[1], s[2], 0.12);
  setTimeout(() => playTone(s[0] - 40, s[1] + 0.1, s[2], 0.10), 150);
  setTimeout(() => playTone(s[0] - 80, s[1] + 0.2, s[2], 0.08), 350);
}

function playStateSound(state) {
  if (state === 'cry') playCrySound();
  else pickRandomSound()();
}

let currentState = 'idle';
let currentFrames = null;
let currentFrameIndex = 0;
let frameTimer = null;
let isPlaying = false;
let isDragging = false;
let isOverCharacter = false;
let loopCount = 0;
const MAX_LOOPS = 2;

const clickTimes = [];
const COMBO_WINDOW = 3000;
const COMBO_THRESHOLD = 3;

function loadGIF(name) {
  return fetch(`../assets/${name}.gif`)
    .then(r => r.arrayBuffer())
    .then(buf => decompressFrames(parseGIF(buf), true));
}

async function loadAllGIFs() {
  GIFS.idle = await loadGIF('nomal');
  for (const s of STATES) GIFS[s] = await loadGIF(s);
  GIFS.cry = await loadGIF('cry');

  let maxW = 0, maxH = 0;
  for (const key in GIFS) {
    for (const f of GIFS[key]) {
      if (f.dims.width + f.dims.left > maxW) maxW = f.dims.width + f.dims.left;
      if (f.dims.height + f.dims.top > maxH) maxH = f.dims.height + f.dims.top;
    }
  }
  canvas.width = maxW;
  canvas.height = maxH;
  offscreen.width = maxW;
  offscreen.height = maxH;
  window.electronAPI.resizeWindow(maxW, maxH);
}

function renderFrame(frames, frameIndex) {
  const frame = frames[frameIndex];
  const { left, top, width, height } = frame.dims;

  const patchData = offCtx.createImageData(width, height);
  patchData.data.set(frame.patch);

  if (frame.disposalType === 2) {
    offCtx.clearRect(left, top, width, height);
  }

  offCtx.putImageData(patchData, left, top);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(offscreen, 0, 0);
}

function playState(state) {
  if (frameTimer) { clearTimeout(frameTimer); frameTimer = null; }
  offCtx.clearRect(0, 0, offscreen.width, offscreen.height);

  if (state !== 'idle') playStateSound(state);

  currentState = state;
  currentFrames = GIFS[state];
  currentFrameIndex = 0;
  loopCount = 0;
  isPlaying = true;
  scheduleNextFrame();
}

function scheduleNextFrame() {
  if (!currentFrames || currentFrameIndex >= currentFrames.length) {
    if (currentState === 'idle') {
      currentFrameIndex = 0;
      offCtx.clearRect(0, 0, offscreen.width, offscreen.height);
      scheduleNextFrame();
      return;
    }
    loopCount++;
    if (loopCount < MAX_LOOPS) {
      currentFrameIndex = 0;
      offCtx.clearRect(0, 0, offscreen.width, offscreen.height);
      scheduleNextFrame();
      return;
    }
    playState('idle');
    return;
  }

  renderFrame(currentFrames, currentFrameIndex);
  const delay = currentFrames[currentFrameIndex].delay || 100;
  frameTimer = setTimeout(() => {
    currentFrameIndex++;
    scheduleNextFrame();
  }, delay);
}

function pickRandomState() {
  return STATES[Math.floor(Math.random() * STATES.length)];
}

function triggerRandom() {
  if (currentState === 'idle') playState(pickRandomState());
}

function triggerCry() {
  clickTimes.length = 0;
  playState('cry');
}

function getCursorPos(e) {
  const rect = canvas.getBoundingClientRect();
  return { x: e.clientX - rect.left, y: e.clientY - rect.top };
}

function isOnCharacter(cx, cy) {
  try {
    const px = offCtx.getImageData(cx, cy, 1, 1).data;
    return px[3] > 0;
  } catch { return false; }
}

// ---- Pointer events ----
pet.addEventListener('pointermove', (e) => {
  const { x, y } = getCursorPos(e);
  const onChar = isOnCharacter(x, y);
  if (onChar !== isOverCharacter) {
    isOverCharacter = onChar;
    pet.classList.toggle('hover', onChar);
    window.electronAPI.setIgnoreMouse(!onChar, { forward: true });
  }
});

pet.addEventListener('pointerleave', () => {
  isOverCharacter = false;
  pet.classList.remove('hover');
  window.electronAPI.setIgnoreMouse(true, { forward: true });
});

let audioInitialized = false;
function firstInteraction() {
  if (!audioInitialized) { audioInitialized = true; ensureAudio(); }
}

pet.addEventListener('pointerdown', (e) => {
  firstInteraction();
  if (!isOverCharacter) return;
  clickTimes.push(Date.now());
  while (clickTimes.length > 0 && clickTimes[0] < Date.now() - COMBO_WINDOW) {
    clickTimes.shift();
  }
  if (clickTimes.length >= COMBO_THRESHOLD) {
    triggerCry(); return;
  }
  if (currentState === 'idle') triggerRandom();
  isDragging = true;
  pet.setPointerCapture(e.pointerId);
  pet.classList.add('dragging');
});

pet.addEventListener('pointermove', (e) => {
  if (!isDragging) return;
  window.electronAPI.moveWindow(e.movementX, e.movementY);
});

pet.addEventListener('pointerup', () => {
  if (isDragging) { isDragging = false; pet.classList.remove('dragging'); }
});

pet.addEventListener('contextmenu', (e) => {
  if (isOverCharacter) { e.preventDefault(); window.electronAPI.showContextMenu(); }
});

setInterval(triggerRandom, 60000);
Promise.all([loadAllGIFs(), loadAudioFiles()]).then(() => playState('idle'));
```

### renderer/index.html

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <div id="pet">
    <canvas id="canvas"></canvas>
  </div>
  <script src="app.js"></script>
</body>
</html>
```

### renderer/style.css

```css
* { margin: 0; padding: 0; box-sizing: border-box; }
body { width: 100vw; height: 100vh; overflow: hidden; -webkit-app-region: no-drag; background: transparent; }
#pet { width: 100vw; height: 100vh; display: flex; align-items: center; justify-content: center; cursor: pointer; }
#pet.dragging { cursor: grabbing; }
#pet.hover { filter: brightness(1.1); }
canvas { display: block; image-rendering: auto; }
```

### package.json

```json
{
  "name": "chiikawa-pet",
  "version": "1.0.0",
  "description": "Chiikawa Desktop Pet",
  "main": "main.js",
  "scripts": {
    "start": "electron .",
    "build": "electron-builder --win portable"
  },
  "dependencies": { "gifuct-js": "^2.1.2" },
  "devDependencies": { "electron": "^33.0.0", "electron-builder": "^25.0.0" },
  "build": {
    "appId": "chiikawa.pet",
    "productName": "ChiikawaPet",
    "win": { "target": "portable", "signAndEditExecutable": false },
    "files": ["main.js", "preload.js", "renderer/**/*", "assets/**/*", "node_modules/**/*"]
  }
}
```

## Default Assets

The skill bundles 9 default GIF assets in `assets/`:
- `nomal.gif` — idle loop
- `1.gif` through `7.gif` — random action animations
- `cry.gif` — cry animation

Users can add `sound1.mp3` through `soundN.mp3` for custom sound effects, or rely on the built-in synthesized tones.

## Setup Instructions

### Prerequisites
- Node.js 18+ and npm
- Windows (for the transparent always-on-top window)

### Steps

1. Create the project directory and all files listed in the Source Code section above
2. Copy the GIF assets from the skill's `assets/` directory into the project's `assets/`
3. Run `npm install` in the project directory
4. Run `npm start` to launch the pet
5. Optionally run `npm run build` to create a portable `.exe`

### Building the Portable EXE

```bash
CSC_IDENTITY_AUTO_DISCOVERY=false npm run build
```

The built exe will be at `dist/ChiikawaPet 1.0.0.exe`.

## Customizing Assets

### GIF Animations
Replace any GIF in `assets/` with your own file (keep the same filename):
- Keep GIF sizes reasonable (< 2MB per file)
- The window auto-sizes to the largest GIF's dimensions
- Background should be transparent for best results

### Sound Effects (Optional)
Place `sound1.mp3`, `sound2.mp3`, ... `soundN.mp3` in `assets/` to replace synthesized tones:
- Sound files are **decoupled** from animation states — each click picks a random sound from the pool
- You can have more (or fewer) sound files than action states
- The cry animation uses a fixed synthesized tone (not affected by sound files)
- Without any mp3 files, the app uses built-in synthesized tones (12 variants)

## GitHub

The full project is available at: https://github.com/gaoxingyuan/chiikawa-desktop-pet
