---
title: Chiikawa Desktop Pet — Pet Stats & Goal System
date: 2026-05-15
status: draft
---

# Chiikawa Desktop Pet: Pet Stats & Goal System

## Overview

Add a gamified stats layer to the existing Chiikawa desktop pet: goal-setting earns money, money buys food/toys, consumables restore hunger and mood. Pet enters forced cry state when either stat hits zero.

## UI Layout

Window extends ~60px at the bottom for a semi-transparent status bar. The existing canvas (GIF area) stays unchanged above.

**Mouse hit detection:** The status bar area is always interactive (never click-through). The canvas area above continues to use the existing pixel-level alpha detection. When the status bar is hovered, `setIgnoreMouseEvents(false)` is set for the status bar zone only — the forward click-through behavior above it is unaffected.

**Status bar** (always visible, low opacity by default, full opacity on hover):

```
┌──────────────────────────────────────────┐
│           GIF canvas (unchanged)         │
│                                          │
├──────────────────────────────────────────┤
│ 🍔 ████████░░ │ 🎪 ██████░░░░ │ 💰 100  │ [🏪Shop] [🎯Goals] │
└──────────────────────────────────────────┘
```

- Hunger/mood shown as progress bars (0–100 scale)
- Click 🍔 area → food selection popup, click 🎪 → toy selection popup
- Shop and Goal buttons open their respective modal panels

## Data Model

Stored as local JSON (`persist.json`) via main-process IPC:

```json
{
  "stats": { "hunger": 80, "mood": 80 },
  "money": 100,
  "goals": [
    { "id": 1, "text": "goal description", "reward": 30, "done": false, "createdAt": "..." }
  ],
  "inventory": { "food": 2, "toy": 1 }
}
```

Initial values: hunger=80, mood=80, money=100.

## Stat Decay

- Every 30 minutes of runtime: hunger -= 5, mood -= 5 (minimum 0)
- Offline decay NOT calculated — no `lastDecay` field
- After each decay tick: check if hunger ≤ 0 or mood ≤ 0 → force `playState('cry')`

## Cry Lock

When hunger ≤ 0 or mood ≤ 0:
- Pet is locked in cry state: `triggerRandom()` does nothing (no random state switching)
- 60s interval still fires but `triggerRandom` is suppressed
- Only way to exit: feed (restore hunger > 0) AND play (restore mood > 0)
- Once both > 0 → return to normal idle + random state machine

## Shop Items

| Item | Type | Price | Effect |
|------|------|-------|--------|
| 🍙 Rice Ball | food | 20 | hunger +25 |
| 🍪 Cookie | food | 10 | hunger +15 |
| 🍎 Apple | food | 5 | hunger +10 |
| 🥕 Carrot | food | 3 | hunger +5 |
| 🪀 Yo-yo | toy | 20 | mood +25 |
| 🧸 Teddy | toy | 10 | mood +15 |
| ⚽ Ball | toy | 5 | mood +10 |
| 🪄 Bubble Wand | toy | 3 | mood +5 |

Items have an upper cap: hunger/mood max 100.

## Goal System

- User types goal text + sets reward amount → adds to pending list
- Each goal: checkbox + text + reward badge
- Check → confirm dialog → money added → goal marked done (stays visible as completed)
- Goals persist across restarts

## Data Persistence

- Main process adds IPC handler: `save-persist-data` / `load-persist-data`
- Data stored as `persist.json` in the app's user data directory (`app.getPath('userData')`)
- Write on every meaningful state change (goal complete, purchase, stat decay, item use)
- Read on startup to restore

## Implementation Boundaries

All new code lives in `renderer/app.js` (data logic, UI rendering, event handlers) and `main.js` (IPC persistence handlers, one new `preload.js` method). No new HTML files — panels are DOM elements created in JS.

## Files Changed

- `renderer/app.js` — stats, goals, shop, inventory, decay timer, persistent storage calls, UI panels
- `main.js` — IPC handler for save/load persist.json
- `preload.js` — expose `savePersistData` / `loadPersistData`
