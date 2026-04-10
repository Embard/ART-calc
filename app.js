const state = {
  artifacts: [],
  inventory: {},
  slots: [],
  locked: [],
  beltCount: 5,
  planSource: 'inventory',
  priorities: {},
  alternatives: [],
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
  selfCritique: document.getElementById('selfCritique'),
  priorityGrid: document.getElementById('priorityGrid'),
  prioritiesReset: document.getElementById('prioritiesReset'),
  alternatives: document.getElementById('alternatives')
};

const BASE_WEIGHTS = {
  health: 3.2,
  blood: 0.4,
  shock: 1.1,
  water: 0.45,
  food: 0.45,
  radOut: 0.9,
  radIn: 1.7,
  radBalance: 2.6,
  bleedChance: 1.4,
  bleedHeal: 0.8
};

const DEFAULT_PRIORITIES = Object.fromEntries(metrics.map(([key]) => [key, 0]));

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
    state.priorities = metrics.reduce((acc, [key]) => {
      const value = Number(data.priorities?.[key] ?? DEFAULT_PRIORITIES[key]);
      acc[key] = Math.max(-5, Math.min(5, value));
      return acc;
    }, {});
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
    priorities: state.priorities
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

function toDesirableMetricValue(key, value) {
  if (key === 'radIn' || key === 'bleedChance') return -value;
  return value;
}

function getPriorityFactor(key) {
  const manual = Number(state.priorities[key] || 0);
  return 1 + manual * 0.22;
}

function scoreTotals(totals) {
  let score = 0;
  metrics.forEach(([key]) => {
    const value = toDesirableMetricValue(key, Number(totals[key] || 0));
    score += value * BASE_WEIGHTS[key] * getPriorityFactor(key);
  });

  const softFloors = {
    health: 6,
    radBalance: 15,
    food: -80,
    water: -80
  };
  Object.entries(softFloors).forEach(([key, floor]) => {
    const deficit = Math.max(0, floor - Number(totals[key] || 0));
    score -= deficit * deficit * 0.34;
  });

  const neutralKeys = metrics
    .map(([key]) => key)
    .filter(key => Math.abs(Number(state.priorities[key] || 0)) <= 1);
  const stabilityPenalty = neutralKeys.reduce((sum, key) => {
    const value = Number(totals[key] || 0);
    return sum + Math.max(0, -value) * 0.08;
  }, 0);

  return score - stabilityPenalty;
}

function buildCandidatePool() {
  return state.artifacts.filter(a => state.planSource === 'all' || Number(state.inventory[a.name] || 0) > 0);
}

function countUsedFromSlots(slots) {
  return slots.reduce((acc, name) => {
    if (!name) return acc;
    acc[name] = (acc[name] || 0) + 1;
    return acc;
  }, {});
}

function canUseInPartial(name, usedMap, replacingName = null) {
  if (state.planSource === 'all') return true;
  const alreadyUsed = Number(usedMap[name] || 0) - (replacingName === name ? 1 : 0);
  return alreadyUsed < Number(state.inventory[name] || 0);
}

function autoBuild() {
  syncSlots();
  const pickable = buildCandidatePool();
  const unlockedIndexes = state.slots
    .map((_, i) => i)
    .filter(i => !state.locked[i]);

  const baseSlots = state.slots.map((name, i) => state.locked[i] ? name : null);
  const baseTotals = Object.fromEntries(metrics.map(([k]) => [k, 0]));
  baseSlots.forEach(name => {
    if (!name) return;
    const art = getArtifact(name);
    if (!art) return;
    metrics.forEach(([key]) => {
      baseTotals[key] += Number(art[key] || 0);
    });
  });

  let beam = [{
    slots: [...baseSlots],
    used: countUsedFromSlots(baseSlots),
    totals: { ...baseTotals },
    score: scoreTotals(baseTotals)
  }];
  const beamWidth = 28;

  unlockedIndexes.forEach(index => {
    const nextBeam = [];
    beam.forEach(candidate => {
      pickable.forEach(art => {
        if (!canUseInPartial(art.name, candidate.used, candidate.slots[index])) return;
        const nextSlots = [...candidate.slots];
        nextSlots[index] = art.name;
        const nextUsed = { ...candidate.used, [art.name]: Number(candidate.used[art.name] || 0) + 1 };
        const nextTotals = { ...candidate.totals };
        metrics.forEach(([key]) => {
          nextTotals[key] += Number(art[key] || 0);
        });
        nextBeam.push({
          slots: nextSlots,
          used: nextUsed,
          totals: nextTotals,
          score: scoreTotals(nextTotals)
        });
      });
    });
    nextBeam.sort((a, b) => b.score - a.score);
    beam = nextBeam.slice(0, beamWidth);
  });

  const ranked = beam.sort((a, b) => b.score - a.score).slice(0, 4);
  if (!ranked.length) {
    state.alternatives = [];
    saveState();
    renderAll();
    return;
  }

  state.slots = [...ranked[0].slots];
  state.alternatives = ranked.slice(1).map((variant, idx) => ({
    id: `alt-${Date.now()}-${idx}`,
    label: `Вариант ${idx + 2}`,
    score: variant.score,
    slots: [...variant.slots],
    totals: variant.totals
  }));

  saveState();
  renderAll();
}

function renderAlternatives() {
  if (!els.alternatives) return;
  els.alternatives.innerHTML = '';
  if (!state.alternatives.length) {
    els.alternatives.innerHTML = '<p class="mini">Альтернативы появятся после автосборки.</p>';
    return;
  }

  state.alternatives.forEach(variant => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn alt-item';
    const shock = Number(variant.totals.shock || 0);
    const food = Number(variant.totals.food || 0);
    const water = Number(variant.totals.water || 0);
    btn.innerHTML = `<strong>${variant.label}</strong><span class="mini">Шок ${shock > 0 ? '+' : ''}${shock} • Еда ${food > 0 ? '+' : ''}${food} • Вода ${water > 0 ? '+' : ''}${water}</span>`;
    btn.addEventListener('click', () => {
      state.slots = [...variant.slots];
      saveState();
      renderAll();
    });
    els.alternatives.appendChild(btn);
  });
}

function renderPriorities() {
  if (!els.priorityGrid) return;
  els.priorityGrid.innerHTML = '';

  metrics.forEach(([key, label]) => {
    const row = document.createElement('div');
    row.className = 'priority-row';
    const caption = document.createElement('span');
    caption.textContent = label;

    const controls = document.createElement('div');
    controls.className = 'priority-stepper';
    const minus = document.createElement('button');
    minus.type = 'button';
    minus.className = 'btn';
    minus.textContent = '−';
    const value = document.createElement('strong');
    const current = Number(state.priorities[key] || 0);
    value.textContent = `${current > 0 ? '+' : ''}${current}`;
    const plus = document.createElement('button');
    plus.type = 'button';
    plus.className = 'btn';
    plus.textContent = '+';

    minus.addEventListener('click', () => {
      state.priorities[key] = Math.max(-5, Number(state.priorities[key] || 0) - 1);
      saveState();
      renderPriorities();
    });
    plus.addEventListener('click', () => {
      state.priorities[key] = Math.min(5, Number(state.priorities[key] || 0) + 1);
      saveState();
      renderPriorities();
    });

    controls.append(minus, value, plus);
    row.append(caption, controls);
    els.priorityGrid.appendChild(row);
  });
}

function resetPriorities() {
  state.priorities = { ...DEFAULT_PRIORITIES };
  saveState();
  renderPriorities();
}

function clearBuild() {
  syncSlots();
  state.slots = state.slots.map((slot, i) => state.locked[i] ? slot : null);
  state.alternatives = [];
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
  renderPriorities();
  renderSlots();
  renderAlternatives();
  renderTotals();
}

async function init() {
  loadState();
  state.priorities = metrics.reduce((acc, [key]) => {
    acc[key] = Number(state.priorities?.[key] ?? DEFAULT_PRIORITIES[key]);
    return acc;
  }, {});
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
  els.prioritiesReset?.addEventListener('click', resetPriorities);
  els.autoBuild.addEventListener('click', autoBuild);
  els.clearBuild.addEventListener('click', clearBuild);

  renderAll();
}

init();
