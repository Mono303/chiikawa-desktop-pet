// ---- Shop items catalog ----
const SHOP_ITEMS = [
  { id: 'riceball', name: '饭团', emoji: '🍙', type: 'food', price: 20, effect: 25 },
  { id: 'cookie',  name: '饼干', emoji: '🍪', type: 'food', price: 10, effect: 15 },
  { id: 'apple',   name: '苹果', emoji: '🍎', type: 'food', price: 5,  effect: 10 },
  { id: 'carrot',  name: '胡萝卜', emoji: '🥕', type: 'food', price: 3,  effect: 5 },
  { id: 'yoyo',    name: '悠悠球', emoji: '🪀', type: 'toy',  price: 20, effect: 25 },
  { id: 'teddy',   name: '小熊', emoji: '🧸', type: 'toy',  price: 10, effect: 15 },
  { id: 'ball',    name: '球', emoji: '⚽', type: 'toy',  price: 5,  effect: 10 },
  { id: 'bubble',  name: '泡泡棒', emoji: '🪄', type: 'toy',  price: 3,  effect: 5 },
];

const STAT_MAX = 100;

// ---- Data store ----
const store = {
  hunger: 80,
  mood: 80,
  money: 100,
  inventory: { food: 0, toy: 0 },
  goals: [],
  _nextGoalId: 1,
};

let _saveTimeout = null;

function scheduleSave() {
  if (_saveTimeout) clearTimeout(_saveTimeout);
  _saveTimeout = setTimeout(saveNow, 500);
}

async function saveNow() {
  _saveTimeout = null;
  await window.electronAPI.savePersistData({
    hunger: store.hunger, mood: store.mood,
    money: store.money, inventory: store.inventory,
    goals: store.goals, nextGoalId: store._nextGoalId,
  });
}

async function loadPersistData() {
  const data = await window.electronAPI.loadPersistData();
  if (!data) return;
  if (typeof data.hunger === 'number') store.hunger = Math.max(0, Math.min(STAT_MAX, data.hunger));
  if (typeof data.mood === 'number') store.mood = Math.max(0, Math.min(STAT_MAX, data.mood));
  if (typeof data.money === 'number') store.money = Math.max(0, data.money);
  if (data.inventory && typeof data.inventory === 'object') {
    store.inventory.food = Math.max(0, data.inventory.food || 0);
    store.inventory.toy = Math.max(0, data.inventory.toy || 0);
  }
  if (Array.isArray(data.goals)) store.goals = data.goals;
  if (typeof data.nextGoalId === 'number') store._nextGoalId = data.nextGoalId;
}

// ---- Stats ----
function decayTick() {
  store.hunger = Math.max(0, store.hunger - 5);
  store.mood = Math.max(0, store.mood - 5);
  scheduleSave();
  return { hunger: store.hunger, mood: store.mood };
}

function feed(itemId) {
  const item = SHOP_ITEMS.find(i => i.id === itemId);
  if (!item || item.type !== 'food') return false;
  if (store.inventory.food < 1) return false;
  store.inventory.food--;
  store.hunger = Math.min(STAT_MAX, store.hunger + item.effect);
  scheduleSave();
  return true;
}

function play(itemId) {
  const item = SHOP_ITEMS.find(i => i.id === itemId);
  if (!item || item.type !== 'toy') return false;
  if (store.inventory.toy < 1) return false;
  store.inventory.toy--;
  store.mood = Math.min(STAT_MAX, store.mood + item.effect);
  scheduleSave();
  return true;
}

function isCryLocked() {
  return store.hunger <= 0 || store.mood <= 0;
}

// ---- Goals ----
function addGoal(text, reward) {
  if (!text.trim() || typeof reward !== 'number' || reward <= 0) return false;
  store.goals.push({ id: store._nextGoalId++, text: text.trim(), reward, done: false });
  scheduleSave();
  return true;
}

function completeGoal(id) {
  const goal = store.goals.find(g => g.id === id);
  if (!goal || goal.done) return false;
  goal.done = true;
  store.money += goal.reward;
  // Keep last 50 completed goals visible, prune older ones
  store.goals = store.goals.slice(-50);
  scheduleSave();
  return true;
}

// ---- Shop ----
function buyItem(itemId) {
  const item = SHOP_ITEMS.find(i => i.id === itemId);
  if (!item) return false;
  if (store.money < item.price) return false;
  store.money -= item.price;
  store.inventory[item.type]++;
  scheduleSave();
  return true;
}

// ---- Inventory helpers ----
function getFoodItems() {
  return SHOP_ITEMS.filter(i => i.type === 'food');
}

function getToyItems() {
  return SHOP_ITEMS.filter(i => i.type === 'toy');
}
