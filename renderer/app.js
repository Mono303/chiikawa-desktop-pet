const { parseGIF, decompressFrames } = window.gifuct;

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const offscreen = document.createElement('canvas');
const offCtx = offscreen.getContext('2d');
const pet = document.getElementById('pet');

const STATES = ['1', '2', '3', '4', '5', '6', '7'];
const GIFS = {};

let currentState = 'idle';
let currentFrames = null;
let currentFrameIndex = 0;
let frameTimer = null;
let isPlaying = false;
let isDragging = false;
let isOverCharacter = false;

// Click combo detection
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

  currentState = state;
  currentFrames = GIFS[state];
  currentFrameIndex = 0;
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

// ---- Mouse hit detection ----
function getCursorPos(e) {
  const rect = canvas.getBoundingClientRect();
  return { x: e.clientX - rect.left, y: e.clientY - rect.top };
}

function isOnCharacter(cx, cy) {
  // Check the offscreen canvas pixel at this position
  // If alpha > 0, it's a character pixel
  try {
    const px = offCtx.getImageData(cx, cy, 1, 1).data;
    return px[3] > 0;
  } catch {
    // Offscreen or other error
    return false;
  }
}

// ---- Mouse events ----
// Use pointer events for unified mouse/touch

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

pet.addEventListener('pointerdown', (e) => {
  if (!isOverCharacter) return;

  clickTimes.push(Date.now());
  while (clickTimes.length > 0 && clickTimes[0] < Date.now() - COMBO_WINDOW) {
    clickTimes.shift();
  }

  if (clickTimes.length >= COMBO_THRESHOLD) {
    triggerCry();
    return;
  }

  if (currentState === 'idle') triggerRandom();

  // Start drag
  isDragging = true;
  pet.setPointerCapture(e.pointerId);
  pet.classList.add('dragging');
});

pet.addEventListener('pointermove', (e) => {
  if (!isDragging) return;
  window.electronAPI.moveWindow(e.movementX, e.movementY);
});

pet.addEventListener('pointerup', () => {
  if (isDragging) {
    isDragging = false;
    pet.classList.remove('dragging');
  }
});

// Right-click context menu
pet.addEventListener('contextmenu', (e) => {
  if (isOverCharacter) {
    e.preventDefault();
    window.electronAPI.showContextMenu();
  }
});

// Every 60s pick a random state
setInterval(triggerRandom, 60000);

loadAllGIFs().then(() => playState('idle'));
