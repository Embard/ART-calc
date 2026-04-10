const state = {
  artifacts: [],
  inventory: {},
  slots: [],
  locked: [],
  priorities: {},
  variants: [],
  lastTweakedMetric: null,
  beltCount: 5,
  planSource: 'inventory',
  slotEditing: null,
  dragIndex: null
};

const metrics = [
  ['health', 'Здоровье', 1],
  ['blood', 'Кровь', 1],
  ['shock', 'Шок', 1],
  ['water', 'Вода', 1],
  ['food', 'Еда', 1],
  ['radOut', 'Вывод радиации', 1],
  ['radIn', 'Накопление радиации', -1],
  ['radBalance', 'Рад-баланс', 1],
  ['bleedChance', 'Шанс кровотечения', -1],
  ['bleedHeal', 'Остановка крови', 1]
];

const els = {
  inventoryList: document.getElementById('inventoryList'),
  search: document.getElementById('search'),
  slots: document.getElementById('slots'),
  priorities: document.getElementById('priorities'),
  totals: document.getElementById('totals'),
  variants: document.getElementById('variants'),
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
    state.priorities = data.priorities || {};
    state.lastTweakedMetric = data.lastTweakedMetric || null;
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
    locked: state.locked,
    priorities: state.priorities,
    lastTweakedMetric: state.lastTweakedMetric
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
function getDirection(metricKey) {
  const found = metrics.find(([key]) => key === metricKey);
  return found ? found[2] : 1;
}
function priorityWeight(key) {
  const p = Number(state.priorities[key] || 0);
  if (p === 2) return 3.5;
  if (p === 1) return 2.0;
  if (p === -1) return 0.55;
  if (p === -2) return 0.25;
  return 1.0;
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

function scoreTotals(totals, baselineTotals = null, focusedMetric = null) {
  let score = 0;
  metrics.forEach(([key, , direction]) => {
    const value = Number(totals[key] || 0) * direction;
    score += value * priorityWeight(key);
  });

  if (totals.health < 4) score -= (4 - totals.health) * 40;
  if (totals.radBalance < 8) score -= (8 - totals.radBalance) * 10;
  if (totals.food < -30) score -= Math.abs(totals.food + 30) * 0.18;
  if (totals.water < -30) score -= Math.abs(totals.water + 30) * 0.18;

  // Soft balance rule: when user buffs one metric (e.g. shock), keep others near current build.
  if (baselineTotals) {
    metrics.forEach(([key]) => {
      if (key === focusedMetric) return;
      const drift = Math.abs(Number(totals[key] || 0) - Number(baselineTotals[key] || 0));
      score -= drift * 0.08;
    });
  }
  return score;
}

function buildVariants(limit = 6) {
  syncSlots();
  const totalSlots = state.slots.length;
  const baselineTotals = aggregateTotals();
  const baseTotals = Object.fromEntries(metrics.map(([k]) => [k, 0]));
  const lockedSlots = [];
  const freeSlots = [];
  state.slots.forEach((name, i) => (state.locked[i] ? lockedSlots : freeSlots).push(i));

  const baseSlots = state.slots.slice();
  lockedSlots.forEach((i) => {
    const name = baseSlots[i];
    if (!name) return;
    const art = getArtifact(name);
    if (!art) return;
    metrics.forEach(([key]) => baseTotals[key] += Number(art[key] || 0));
  });

  const candidates = state.artifacts.filter(a => state.planSource === 'all' || Number(state.inventory[a.name] || 0) > 0);
  let beam = [{
    slots: baseSlots,
    totals: { ...baseTotals },
    score: scoreTotals(baseTotals, baselineTotals, state.lastTweakedMetric)
  }];
  const BEAM_WIDTH = 40;

  freeSlots.forEach((slotIdx) => {
    const next = [];
    beam.forEach((node) => {
      candidates.forEach((art) => {
        const localStateSlots = node.slots;
        const countUsed = localStateSlots.reduce((s, slotName, idx) => s + (idx !== slotIdx && slotName === art.name ? 1 : 0), 0);
        if (state.planSource !== 'all' && countUsed >= Number(state.inventory[art.name] || 0)) return;
        const newSlots = localStateSlots.slice();
        newSlots[slotIdx] = art.name;
        const newTotals = { ...node.totals };
        metrics.forEach(([key]) => newTotals[key] += Number(art[key] || 0));
        const newScore = scoreTotals(newTotals, baselineTotals, state.lastTweakedMetric);
        next.push({ slots: newSlots, totals: newTotals, score: newScore });
      });
    });
    next.sort((a, b) => b.score - a.score);
    beam = next.slice(0, BEAM_WIDTH);
  });

  const uniq = [];
  const seen = new Set();
  beam.forEach((v) => {
    const key = v.slots.join('|');
    if (seen.has(key)) return;
    seen.add(key);
    uniq.push(v);
  });
  uniq.sort((a, b) => b.score - a.score);
  state.variants = uniq.slice(0, Math.max(limit, 1));

  if (!state.variants.length) {
    state.variants = [{ slots: state.slots.slice(), totals: aggregateTotals(), score: scoreTotals(aggregateTotals(), baselineTotals, state.lastTweakedMetric) }];
  }
  const best = state.variants[0];
  state.slots = best.slots.slice(0, totalSlots);
}

function autoBuild() {
  buildVariants(8);
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
        saveState(); renderAll();
      };
      plus.onclick = () => {
        state.inventory[art.name] = Number(state.inventory[art.name] || 0) + 1;
        saveState(); renderAll();
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
      const avail = state.planSource === 'all' ? '∞' : Math.max(0, Number(state.inventory[art.name] || 0) - usedCount(art.name, state.slotEditing));
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
  const buildScore = Math.round(scoreTotals(totals, totals, null));
  els.totals.innerHTML = '';
  metrics.forEach(([key, label, direction]) => {
    const value = totals[key];
    const row = document.createElement('div');
    row.className = 'total-row';
    const positiveTone = direction === 1 ? value >= 0 : value <= 0;
    row.innerHTML = `<span>${label}</span><strong class="${positiveTone ? 'pos' : 'neg'}">${value > 0 ? '+' : ''}${value}</strong>`;
    els.totals.appendChild(row);
  });
  const scoreRow = document.createElement('div');
  scoreRow.className = 'total-row';
  scoreRow.innerHTML = `<span>Итоговый скор</span><strong class="pos">${buildScore}</strong>`;
  els.totals.appendChild(scoreRow);

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

function setPriority(key, delta) {
  const current = Number(state.priorities[key] || 0);
  state.priorities[key] = Math.max(-2, Math.min(2, current + delta));
  state.lastTweakedMetric = key;
  buildVariants(8);
  saveState();
  renderAll();
}

function renderPriorities() {
  els.priorities.innerHTML = '';
  metrics.forEach(([key, label]) => {
    const row = document.createElement('div');
    row.className = 'total-row';
    const value = Number(state.priorities[key] || 0);
    row.innerHTML = `
      <span>${label}</span>
      <div class="prio-control">
        <button class="btn tiny-btn" type="button">−</button>
        <strong>${value > 0 ? '+' : ''}${value}</strong>
        <button class="btn tiny-btn" type="button">+</button>
      </div>
    `;
    const [minus, plus] = row.querySelectorAll('button');
    minus.addEventListener('click', () => setPriority(key, -1));
    plus.addEventListener('click', () => setPriority(key, 1));
    els.priorities.appendChild(row);
  });
}

function renderVariants() {
  if (!els.variants) return;
  els.variants.innerHTML = '';
  if (!state.variants.length) {
    els.variants.innerHTML = '<div class="mini">Нет рассчитанных вариантов. Нажми «Автосборка».</div>';
    return;
  }
  state.variants.forEach((variant, idx) => {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'variant-item btn';
    const totals = variant.totals;
    item.innerHTML = `
      <span>#${idx + 1} • скор ${Math.round(variant.score)}</span>
      <span class="mini">HP ${totals.health} | Blood ${totals.blood} | RadBal ${totals.radBalance} | RadIn ${totals.radIn}</span>
    `;
    item.addEventListener('click', () => {
      state.slots = variant.slots.slice();
      saveState();
      renderAll();
    });
    els.variants.appendChild(item);
  });
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
  renderPriorities();
  renderSlots();
  renderTotals();
  renderVariants();
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
    buildVariants(8);
    saveState();
    renderAll();
  });
  els.autoBuild.addEventListener('click', autoBuild);
  els.clearBuild.addEventListener('click', clearBuild);

  buildVariants(8);
  renderAll();
}

init();
