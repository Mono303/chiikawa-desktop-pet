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
