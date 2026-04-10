const state = {
  artifacts: [],
  inventory: {},
  slots: [],
  locked: [],
  beltCount: 5,
  planSource: 'inventory',
  slotEditing: null,
  dragIndex: null
};

const metrics = [
  ['health', 'Здоровье'],
  ['blood', 'Кровь'],
  ['shock', 'Шок'],
  ['water', 'Вода'],
  ['food', 'Еда'],
  ['radOut', 'Вывод радиации'],
  ['radIn', 'Накопление радиации'],
  ['radBalance', 'Рад-баланс'],
  ['bleedChance', 'Шанс кровотечения'],
  ['bleedHeal', 'Остановка крови']
];

const els = {
  inventoryList: document.getElementById('inventoryList'),
  search: document.getElementById('search'),
  slots: document.getElementById('slots'),
  totals: document.getElementById('totals'),
  beltCount: document.getElementById('beltCount'),
  planSource: document.getElementById('planSource'),
  autoBuild: document.getElementById('autoBuild'),
  clearBuild: document.getElementById('clearBuild'),
  pickerDialog: document.getElementById('pickerDialog'),
  pickerList: document.getElementById('pickerList'),
  pickerSearch: document.getElementById('pickerSearch'),
  kpiSlots: document.getElementById('kpiSlots'),
  kpiRad: document.getElementById('kpiRad'),
  kpiStatus: document.getElementById('kpiStatus'),
  selfCritique: document.getElementById('selfCritique')
};

function loadState() {
  const raw = localStorage.getItem('art-calc-zone-v1');
  if (!raw) return;
  try {
    const data = JSON.parse(raw);
    state.inventory = data.inventory || {};
    state.beltCount = Number(data.beltCount || 5);
    state.planSource = data.planSource || 'inventory';
    state.slots = Array.isArray(data.slots) ? data.slots : [];
    state.locked = Array.isArray(data.locked) ? data.locked : [];
  } catch {
    // ignore corrupted state
  }
}

function saveState() {
  localStorage.setItem('art-calc-zone-v1', JSON.stringify({
    inventory: state.inventory,
    beltCount: state.beltCount,
    planSource: state.planSource,
    slots: state.slots,
    locked: state.locked
  }));
}

function syncSlots() {
  const needed = state.beltCount * 3;
  while (state.slots.length < needed) state.slots.push(null);
  state.slots = state.slots.slice(0, needed);
  while (state.locked.length < needed) state.locked.push(false);
  state.locked = state.locked.slice(0, needed);
}

function getArtifact(name) {
  return state.artifacts.find(a => a.name === name);
}

function usedCount(name, except = -1) {
  return state.slots.reduce((sum, slot, i) => sum + (i !== except && slot === name ? 1 : 0), 0);
}

function canUse(name, except = -1) {
  if (state.planSource === 'all') return true;
  return usedCount(name, except) < Number(state.inventory[name] || 0);
}

function aggregateTotals() {
  const totals = Object.fromEntries(metrics.map(([k]) => [k, 0]));
  state.slots.forEach(name => {
    if (!name) return;
    const art = getArtifact(name);
    if (!art) return;
    metrics.forEach(([key]) => totals[key] += Number(art[key] || 0));
  });
  return totals;
}

function scoreArtifact(art, totals) {
  const lowHealth = totals.health < 6;
  const lowRad = totals.radBalance < 15;
  return (
    art.health * (lowHealth ? 2.2 : 1.2) +
    art.blood * 0.05 +
    art.shock * 0.03 +
    art.radBalance * (lowRad ? 1.5 : 1.0) +
    art.bleedHeal * 0.03 -
    Math.max(0, -art.food) * 0.02 -
    Math.max(0, -art.water) * 0.02 -
    art.radIn * 0.5 -
    Math.max(0, art.bleedChance) * 0.05
  );
}

function autoBuild() {
  syncSlots();
  const totals = Object.fromEntries(metrics.map(([k]) => [k, 0]));

  state.slots.forEach((name, i) => {
    if (!state.locked[i] || !name) return;
    const art = getArtifact(name);
    if (!art) return;
    metrics.forEach(([key]) => totals[key] += Number(art[key] || 0));
  });

  const pickable = state.artifacts.filter(a => state.planSource === 'all' || Number(state.inventory[a.name] || 0) > 0);

  for (let i = 0; i < state.slots.length; i++) {
    if (state.locked[i]) continue;

    let best = null;
    let bestScore = -Infinity;
    pickable.forEach(art => {
      if (!canUse(art.name, i)) return;
      const sc = scoreArtifact(art, totals);
      if (sc > bestScore) {
        bestScore = sc;
        best = art;
      }
    });

    state.slots[i] = best ? best.name : null;
    if (best) {
      metrics.forEach(([key]) => totals[key] += Number(best[key] || 0));
    }
  }

  saveState();
  renderAll();
}

function clearBuild() {
  syncSlots();
  state.slots = state.slots.map((slot, i) => state.locked[i] ? slot : null);
  saveState();
  renderAll();
}

function imgOrFallback(imagePath) {
  return imagePath || 'assets/artifacts/placeholder.png';
}

function renderInventory() {
  const q = els.search.value.trim().toLowerCase();
  els.inventoryList.innerHTML = '';

  state.artifacts
    .filter(a => !q || a.name.toLowerCase().includes(q))
    .forEach(art => {
      const row = document.createElement('div');
      row.className = 'inventory-item';
      const left = document.createElement('div');
      left.className = 'inventory-left';
      left.innerHTML = `
        <img class="artifact-thumb" src="${imgOrFallback(art.image)}" alt="${art.name}" onerror="this.src='assets/artifacts/placeholder.png'" />
        <div>
          <div class="name">${art.name}</div>
          <div class="mini">HP ${art.health} | Blood ${art.blood} | Rad ${art.radBalance}</div>
        </div>
      `;

      const right = document.createElement('div');
      right.className = 'stepper';
      const minus = document.createElement('button');
      minus.className = 'btn';
      minus.textContent = '−';
      const val = document.createElement('strong');
      val.textContent = String(Number(state.inventory[art.name] || 0));
      const plus = document.createElement('button');
      plus.className = 'btn';
      plus.textContent = '+';

      minus.onclick = () => {
        state.inventory[art.name] = Math.max(0, Number(state.inventory[art.name] || 0) - 1);
        saveState();
        renderAll();
      };
      plus.onclick = () => {
        state.inventory[art.name] = Number(state.inventory[art.name] || 0) + 1;
        saveState();
        renderAll();
      };

      right.append(minus, val, plus);
      row.append(left, right);
      els.inventoryList.appendChild(row);
    });
}

function openPicker(index) {
  state.slotEditing = index;
  els.pickerDialog.showModal();
  renderPicker();
}

function renderPicker() {
  const q = els.pickerSearch.value.trim().toLowerCase();
  els.pickerList.innerHTML = '';

  const empty = document.createElement('button');
  empty.type = 'button';
  empty.className = 'pick-item btn';
  empty.textContent = 'Очистить слот';
  empty.onclick = () => {
    state.slots[state.slotEditing] = null;
    saveState();
    els.pickerDialog.close();
    renderAll();
  };
  els.pickerList.appendChild(empty);

  state.artifacts
    .filter(a => !q || a.name.toLowerCase().includes(q))
    .forEach(art => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'pick-item btn';
      const avail = state.planSource === 'all'
        ? '∞'
        : Math.max(0, Number(state.inventory[art.name] || 0) - usedCount(art.name, state.slotEditing));

      btn.innerHTML = `
        <span class="pick-main">
          <img class="artifact-thumb" src="${imgOrFallback(art.image)}" alt="${art.name}" onerror="this.src='assets/artifacts/placeholder.png'" />
          <span>${art.name}</span>
        </span>
        <span>Доступно: ${avail}</span>
      `;
      btn.disabled = !canUse(art.name, state.slotEditing);
      btn.onclick = () => {
        state.slots[state.slotEditing] = art.name;
        saveState();
        els.pickerDialog.close();
        renderAll();
      };
      els.pickerList.appendChild(btn);
    });
}

function renderSlots() {
  syncSlots();
  els.slots.innerHTML = '';

  state.slots.forEach((name, i) => {
    const cell = document.createElement('div');
    cell.className = 'slot';
    if (state.locked[i]) cell.classList.add('locked');
    cell.dataset.index = String(i);

    const art = name ? getArtifact(name) : null;
    cell.innerHTML = art
      ? `<div class="slot-top"><small>Слот ${i + 1}</small><button class="lock-btn" type="button">${state.locked[i] ? '🔒' : '🔓'}</button></div><img class="artifact-thumb" src="${imgOrFallback(art.image)}" alt="${art.name}" onerror="this.src='assets/artifacts/placeholder.png'" /><strong>${art.name}</strong><div class="mini">HP ${art.health} • Rad ${art.radBalance}</div><button class="btn pick-btn" type="button">Выбрать</button>`
      : `<div class="slot-top"><small>Слот ${i + 1}</small><button class="lock-btn" type="button">${state.locked[i] ? '🔒' : '🔓'}</button></div><div class="mini">Пусто — нажми «Выбрать»</div><button class="btn pick-btn" type="button">Выбрать</button>`;

    const pickBtn = cell.querySelector('.pick-btn');
    if (pickBtn && state.locked[i]) pickBtn.disabled = true;
    pickBtn?.addEventListener('click', () => openPicker(i));

    const lockBtn = cell.querySelector('.lock-btn');
    lockBtn?.addEventListener('click', () => {
      state.locked[i] = !state.locked[i];
      saveState();
      renderSlots();
    });

    if (art) {
      cell.draggable = true;
      cell.addEventListener('dragstart', () => {
        if (state.locked[i]) return;
        state.dragIndex = i;
      });
    }

    cell.addEventListener('dragover', (e) => {
      e.preventDefault();
      if (state.dragIndex === null || state.dragIndex === i || state.locked[i]) return;
      cell.classList.add('drag-over');
    });

    cell.addEventListener('dragleave', () => cell.classList.remove('drag-over'));

    cell.addEventListener('drop', (e) => {
      e.preventDefault();
      cell.classList.remove('drag-over');
      const from = state.dragIndex;
      if (from === null || from === i || state.locked[i] || state.locked[from]) return;

      const fromName = state.slots[from];
      const toName = state.slots[i];
      if (fromName && toName && (!canUse(fromName, i) || !canUse(toName, from))) return;
      if (fromName && !toName && !canUse(fromName, i)) return;
      if (!fromName) return;

      state.slots[from] = toName;
      state.slots[i] = fromName;
      state.dragIndex = null;
      saveState();
      renderAll();
    });

    cell.addEventListener('dragend', () => {
      state.dragIndex = null;
      document.querySelectorAll('.slot').forEach(el => el.classList.remove('drag-over'));
    });

    els.slots.appendChild(cell);
  });
}

function renderTotals() {
  const totals = aggregateTotals();
  els.totals.innerHTML = '';

  metrics.forEach(([key, label]) => {
    const value = totals[key];
    const row = document.createElement('div');
    row.className = 'total-row';
    row.innerHTML = `<span>${label}</span><strong class="${value >= 0 ? 'pos' : 'neg'}">${value > 0 ? '+' : ''}${value}</strong>`;
    els.totals.appendChild(row);
  });

  const filled = state.slots.filter(Boolean).length;
  els.kpiSlots.textContent = `${filled} / ${state.slots.length}`;
  els.kpiRad.textContent = `${totals.radBalance > 0 ? '+' : ''}${totals.radBalance}`;

  const status = [];
  if (totals.health >= 6) status.push('живучая');
  else status.push('хрупкая');
  if (totals.radBalance >= 15) status.push('держит радиацию');
  else status.push('слабый рад-контроль');
  if (totals.food < -120 || totals.water < -120) status.push('жрет ресурсы');
  els.kpiStatus.textContent = status.join(', ');

  runSelfCritique(totals);
}

function runSelfCritique(totals) {
  const notes = [];
  if (totals.health < 6) notes.push('Критика: низкое здоровье. Исправление: усилен вес HP в автоподборе.');
  if (totals.radBalance < 15) notes.push('Критика: слабый вывод радиации. Исправление: в автосборке повышен приоритет radBalance.');
  if (totals.food < -140 || totals.water < -140) notes.push('Критика: слишком сильный голод/жажда. Исправление: штраф в скоринге за минус еду/воду.');
  if (!notes.length) notes.push('Повторная критика: сборка выглядит сбалансированной, критичных перекосов не найдено.');
  els.selfCritique.innerHTML = `<strong>Самокритика и доработка:</strong><ul>${notes.map(n => `<li>${n}</li>`).join('')}</ul>`;
}

function renderAll() {
  renderInventory();
  renderSlots();
  renderTotals();
}

async function init() {
  loadState();
  const resp = await fetch('artifacts.json');
  state.artifacts = await resp.json();

  els.beltCount.value = String(state.beltCount);
  els.planSource.value = state.planSource;
  syncSlots();

  els.search.addEventListener('input', renderInventory);
  els.pickerSearch.addEventListener('input', renderPicker);
  els.beltCount.addEventListener('change', () => {
    state.beltCount = Number(els.beltCount.value);
    syncSlots();
    saveState();
    renderAll();
  });
  els.planSource.addEventListener('change', () => {
    state.planSource = els.planSource.value;
    saveState();
    renderAll();
  });
  els.autoBuild.addEventListener('click', autoBuild);
  els.clearBuild.addEventListener('click', clearBuild);

  renderAll();
}

init();