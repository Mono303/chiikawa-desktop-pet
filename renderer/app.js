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
// Random sound pool — more entries than states (7), picked randomly per action
const RANDOM_SOUND_POOL = [
  [523, 0.15, 'sine'],    // C5
  [587, 0.15, 'sine'],    // D5
  [659, 0.15, 'sine'],    // E5
  [698, 0.15, 'sine'],    // F5
  [784, 0.15, 'sine'],    // G5
  [880, 0.15, 'sine'],    // A5
  [988, 0.15, 'sine'],    // B5
  [1047, 0.12, 'triangle'], // C6
  [554, 0.18, 'triangle'],  // C#5
  [740, 0.12, 'sine'],      // F#5
  [415, 0.2, 'triangle'],   // G#4
  [1319, 0.1, 'sine'],      // E6
];

const CRY_SOUND = [300, 0.4, 'sine'];

// Loaded audio buffers (from mp3 files in assets/)
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
    } catch { /* skip unloadable file */ }
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
  if (cryAudioBuffer) {
    playLoadedBuffer(cryAudioBuffer);
    return;
  }
  const s = CRY_SOUND;
  playTone(s[0], s[1], s[2], 0.12);
  setTimeout(() => playTone(s[0] - 40, s[1] + 0.1, s[2], 0.10), 150);
  setTimeout(() => playTone(s[0] - 80, s[1] + 0.2, s[2], 0.08), 350);
}

function playStateSound(state) {
  if (state === 'cry') {
    playCrySound();
  } else {
    pickRandomSound()();
  }
}

let currentState = 'idle';
let currentFrames = null;
let currentFrameIndex = 0;
let frameTimer = null;
let isPlaying = false;
let isDragging = false;
let isOverCharacter = false;
let loopCount = 0;
const MAX_LOOPS = 2; // non-idle states loop this many times

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
  window.electronAPI.resizeWindow(maxW, maxH + 44);
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
  if (currentState === 'idle' && !isCryLocked()) playState(pickRandomState());
}

function triggerCry() {
  clickTimes.length = 0;
  playState('cry');
}

// ---- Stat system integration ----
function checkCryLock() {
  if (isCryLocked()) {
    if (currentState !== 'cry') {
      clickTimes.length = 0;
      playState('cry');
    }
  }
}

// Decay every 30 minutes (1800000 ms)
const DECAY_INTERVAL = 1800000;

setInterval(() => {
  decayTick();
  updateStatusBar();
  checkCryLock();
}, DECAY_INTERVAL);

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

// First interaction: pre-init AudioContext (Chromium autoplay policy)
let audioInitialized = false;
function firstInteraction() {
  if (!audioInitialized) {
    audioInitialized = true;
    ensureAudio();
  }
}

pet.addEventListener('pointerdown', (e) => {
  firstInteraction();
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

Promise.all([loadAllGIFs(), loadAudioFiles()]).then(async () => {
  await loadPersistData();
  pet.appendChild(statusBar);
  updateStatusBar();
  document.getElementById('sb-hunger').onclick = () => showItemPopup('food');
  document.getElementById('sb-mood').onclick = () => showItemPopup('toy');
  document.getElementById('btn-shop').onclick = () => showShop();
  document.getElementById('btn-goals').onclick = () => showGoals();
  playState('idle');
}).catch(err => {
  console.error('Startup failed:', err);
  playState('idle');
});
