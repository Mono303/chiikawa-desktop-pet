// ---- Status bar ----
const statusBar = (() => {
  const el = document.createElement('div');
  el.id = 'status-bar';
  el.innerHTML = `
    <div class="sb-section" id="sb-hunger">
      <span class="sb-label">🍔</span>
      <div class="sb-bar"><div class="sb-fill" id="sb-hunger-fill"></div></div>
    </div>
    <div class="sb-section" id="sb-mood">
      <span class="sb-label">🎪</span>
      <div class="sb-bar"><div class="sb-fill" id="sb-mood-fill"></div></div>
    </div>
    <span class="sb-money" id="sb-money">💰 100</span>
    <button class="sb-btn" id="btn-shop">🏪</button>
    <button class="sb-btn" id="btn-goals">🎯</button>
  `;
  return el;
})();

function updateStatusBar() {
  document.getElementById('sb-hunger-fill').style.width = ((store.hunger || 0) / STAT_MAX * 100) + '%';
  document.getElementById('sb-mood-fill').style.width = ((store.mood || 0) / STAT_MAX * 100) + '%';
  document.getElementById('sb-money').textContent = '💰 ' + (store.money || 0);
}

// ---- Item selection popups ----
function showItemPopup(type) {
  const items = type === 'food' ? getFoodItems() : getToyItems();
  const label = type === 'food' ? '🍔 喂食' : '🎪 玩耍';

  hidePopup();
  const overlay = document.createElement('div');
  overlay.className = 'popup-overlay';
  overlay.onclick = hidePopup;

  const box = document.createElement('div');
  box.className = 'popup-box';
  box.onclick = e => e.stopPropagation();
  box.innerHTML = `<div class="popup-title">${label}</div>`;

  const list = document.createElement('div');
  list.className = 'popup-list';

  const avail = items.filter(i => store.inventory[type] > 0);
  if (avail.length === 0) {
    list.innerHTML = '<div class="popup-empty">没有库存，去商店买一些吧</div>';
  } else {
    for (const item of avail) {
      const row = document.createElement('div');
      row.className = 'popup-row';
      row.innerHTML = `${item.emoji} ${item.name}  <span class="popup-effect">+${item.effect}</span>`;
      row.onclick = () => {
        const ok = type === 'food' ? feed(item.id) : play(item.id);
        if (ok) { updateStatusBar(); hidePopup(); checkCryLock(); }
      };
      list.appendChild(row);
    }
  }

  box.appendChild(list);
  overlay.appendChild(box);
  document.body.appendChild(overlay);

  // Disable click-through while popup is open
  window.electronAPI.setIgnoreMouse(false, { forward: true });
}

function hidePopup() {
  document.querySelectorAll('.popup-overlay').forEach(el => el.remove());
  // Re-enable click-through — next pointermove will correct it
  window.electronAPI.setIgnoreMouse(true, { forward: true });
}

// ---- Shop panel ----
function showShop() {
  hidePopup();
  const overlay = document.createElement('div');
  overlay.className = 'popup-overlay';
  overlay.onclick = hidePopup;

  const box = document.createElement('div');
  box.className = 'popup-box shop-box';
  box.onclick = e => e.stopPropagation();
  box.innerHTML = '<div class="popup-title">🏪 商店</div><div class="popup-list" id="shop-list"></div>';

  const list = box.querySelector('#shop-list');
  renderShopList(list);

  overlay.appendChild(box);
  document.body.appendChild(overlay);
  window.electronAPI.setIgnoreMouse(false, { forward: true });
}

function renderShopList(listEl) {
  listEl.innerHTML = '';
  for (const item of SHOP_ITEMS) {
    const row = document.createElement('div');
    row.className = 'popup-row';
    const canBuy = store.money >= item.price;
    row.innerHTML = `${item.emoji} ${item.name}  <span>${item.price}💰 <button class="shop-btn" ${canBuy ? '' : 'disabled'}>购买</button></span>`;
    if (canBuy) {
      row.querySelector('.shop-btn').onclick = () => {
        buyItem(item.id);
        updateStatusBar();
        renderShopList(listEl);
      };
    }
    listEl.appendChild(row);
  }
}

// ---- Goal panel ----
function showGoals() {
  hidePopup();
  const overlay = document.createElement('div');
  overlay.className = 'popup-overlay';
  overlay.onclick = hidePopup;

  const box = document.createElement('div');
  box.className = 'popup-box goal-box';
  box.onclick = e => e.stopPropagation();
  box.innerHTML = '<div class="popup-title">🎯 目标</div><div id="goal-list"></div><div class="goal-add"><input id="goal-input" placeholder="写一个目标..." /><input id="goal-reward" type="number" min="1" placeholder="💰" /><button id="goal-add-btn">添加</button></div>';

  const listEl = box.querySelector('#goal-list');
  renderGoalList(listEl);

  // Add goal handler
  const input = box.querySelector('#goal-input');
  const reward = box.querySelector('#goal-reward');
  box.querySelector('#goal-add-btn').onclick = () => {
    const r = parseInt(reward.value) || 0;
    if (addGoal(input.value, r)) {
      input.value = ''; reward.value = '';
      renderGoalList(listEl);
      updateStatusBar();
    }
  };
  input.onkeydown = e => { if (e.key === 'Enter') box.querySelector('#goal-add-btn').click(); };

  overlay.appendChild(box);
  document.body.appendChild(overlay);
  window.electronAPI.setIgnoreMouse(false, { forward: true });
}

function renderGoalList(container) {
  container.innerHTML = '';
  if (store.goals.length === 0) {
    container.innerHTML = '<div class="popup-empty" style="padding:12px">还没有目标</div>';
    return;
  }
  for (const g of store.goals) {
    const row = document.createElement('div');
    row.className = 'goal-row' + (g.done ? ' goal-done' : '');
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = g.done;
    cb.disabled = g.done;
    if (!g.done) {
      cb.onchange = () => {
        if (confirm(`确认完成"${g.text}"，获得 ${g.reward}💰？`)) {
          completeGoal(g.id);
          updateStatusBar();
          renderGoalList(container);
        } else { cb.checked = false; }
      };
    }
    row.appendChild(cb);
    const text = document.createElement('span');
    text.className = 'goal-text';
    text.textContent = g.text;
    row.appendChild(text);
    const badge = document.createElement('span');
    badge.className = 'goal-reward';
    badge.textContent = g.reward + '💰';
    row.appendChild(badge);
    container.appendChild(row);
  }
}
