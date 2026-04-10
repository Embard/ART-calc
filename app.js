const METRICS = [
  ['health', 'Здоровье'],
  ['blood', 'Кровь'],
  ['shock', 'Шок'],
  ['water', 'Вода'],
  ['food', 'Еда'],
  ['radOut', 'Вывод радиации'],
  ['radIn', 'Накопление радиации'],
  ['radBalance', 'Баланс радиации'],
  ['bleedChance', 'Шанс пореза'],
  ['bleedHeal', 'Лечение пореза']
];

const STORAGE_KEY = 'art-calc-zone-v2';
const PRESETS_KEY = 'art-calc-zone-presets-v1';

const tuning = {
  build: {
    beamWidth: 46,
    alternatives: 5,
    diversityPenalty: 0.5,
    rarityPenalty: 0.14
  },
  targetScales: {
    health: 2.3,
    blood: 0.8,
    shock: 1.3,
    water: 0.45,
    food: 0.45,
    radOut: 0.7,
    radIn: 1.1,
    radBalance: 2.2,
    bleedChance: 1.5,
    bleedHeal: 0.9
  },
  safetyWeights: {
    health: 110,
    blood: 95,
    shock: 95,
    radBalance: 120,
    bleedChance: 80,
    hungerHealthGuard: 70
  },
  comfortWeights: {
    bloodSoft70: 25,
    bloodSoft50WithWire: 22,
    foodWaterNegative: 0.6,
    foodWaterHard: 1.2,
    neutralPenalty: 0.22
  },
  emissionBonus: {
    healthMin: 9,
    shockMin: 20,
    bonus: 95
  },
  wireRules: {
    wireName: 'Проволока',
    healStrong: 10
  },
  locks: {
    bannedInAuto: ['Колючка'],
    limitedInAllMode: ['Золотая рыбка']
  }
};

const state = {
  artifacts: [],
  byName: new Map(),
  inventory: {},
  slots: [],
  locked: [],
  beltCount: 5,
  planSource: 'inventory',
 codex/add-customizable-priority-settings-99npv3
 codex/add-customizable-priority-settings-99npv3
  priorities: Object.fromEntries(METRICS.map(([k]) => [k, 0])),

  priorities: {},
 test

  priorities: {},
 main
  alternatives: [],
  slotEditing: null,
  dragIndex: null,
  presets: { builds: [], inventories: [] }
};

const els = {
  inventoryList: document.getElementById('inventoryList'),
  search: document.getElementById('search'),
  slots: document.getElementById('slots'),
  totals: document.getElementById('totals'),
  beltCount: document.getElementById('beltCount'),
  planSource: document.getElementById('planSource'),
  autoBuild: document.getElementById('autoBuild'),
  variantsBtn: document.getElementById('variantsBtn'),
  clearBuild: document.getElementById('clearBuild'),
  pickerDialog: document.getElementById('pickerDialog'),
  pickerList: document.getElementById('pickerList'),
  pickerSearch: document.getElementById('pickerSearch'),
  kpiSlots: document.getElementById('kpiSlots'),
  kpiRad: document.getElementById('kpiRad'),
  kpiStatus: document.getElementById('kpiStatus'),
  selfCritique: document.getElementById('selfCritique'),
 codex/add-customizable-priority-settings-99npv3
 codex/add-customizable-priority-settings-99npv3
  alternatives: document.getElementById('alternatives'),
  summaryBox: document.getElementById('summaryBox'),
  storageBtn: document.getElementById('storageBtn'),
  storageDialog: document.getElementById('storageDialog'),
  buildSaveName: document.getElementById('buildSaveName'),
  invSaveName: document.getElementById('invSaveName'),
  saveBuildBtn: document.getElementById('saveBuildBtn'),
  saveInvBtn: document.getElementById('saveInvBtn'),
  buildsList: document.getElementById('buildsList'),
  inventoriesList: document.getElementById('inventoriesList')
};

function asNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function signed(value) {
  return `${value > 0 ? '+' : ''}${value}`;
}

function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}

function syncSlots() {
  const need = state.beltCount * 3;
  while (state.slots.length < need) state.slots.push(null);
  while (state.locked.length < need) state.locked.push(false);
  state.slots = state.slots.slice(0, need);
  state.locked = state.locked.slice(0, need);
}

  priorityGrid: document.getElementById('priorityGrid'),
  prioritiesReset: document.getElementById('prioritiesReset'),
  alternatives: document.getElementById('alternatives')
};


  priorityGrid: document.getElementById('priorityGrid'),
  prioritiesReset: document.getElementById('prioritiesReset'),
  alternatives: document.getElementById('alternatives')
};

 main
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
 codex/add-customizable-priority-settings-99npv3
 test

 main

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);
    state.inventory = data.inventory || {};
    state.beltCount = clamp(asNum(data.beltCount || 5), 1, 5);
    state.planSource = data.planSource === 'all' ? 'all' : 'inventory';
    state.slots = Array.isArray(data.slots) ? data.slots : [];
    state.locked = Array.isArray(data.locked) ? data.locked : [];
 codex/add-customizable-priority-settings-99npv3
 codex/add-customizable-priority-settings-99npv3
    state.priorities = METRICS.reduce((acc, [key]) => {
      acc[key] = clamp(asNum(data.priorities?.[key]), -3, 3);

    state.priorities = metrics.reduce((acc, [key]) => {
      const value = Number(data.priorities?.[key] ?? DEFAULT_PRIORITIES[key]);
      acc[key] = Math.max(-5, Math.min(5, value));
 test
      return acc;
    }, {});
  } catch {
    state.inventory = {};
  }
}

function loadPresets() {
  try {
    const raw = localStorage.getItem(PRESETS_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    state.presets = {
      builds: Array.isArray(parsed.builds) ? parsed.builds : [],
      inventories: Array.isArray(parsed.inventories) ? parsed.inventories : []
    };

    state.priorities = metrics.reduce((acc, [key]) => {
      const value = Number(data.priorities?.[key] ?? DEFAULT_PRIORITIES[key]);
      acc[key] = Math.max(-5, Math.min(5, value));
      return acc;
    }, {});
 main
  } catch {
    state.presets = { builds: [], inventories: [] };
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    inventory: state.inventory,
    beltCount: state.beltCount,
    planSource: state.planSource,
    slots: state.slots,
    locked: state.locked,
    priorities: state.priorities
  }));
}

function savePresets() {
  localStorage.setItem(PRESETS_KEY, JSON.stringify(state.presets));
}

function getArtifact(name) {
  return state.byName.get(name) || null;
}

function aggregateTotals(slots = state.slots) {
  const totals = Object.fromEntries(METRICS.map(([k]) => [k, 0]));
  slots.forEach((name) => {
    if (!name) return;
    const artifact = getArtifact(name);
    if (!artifact) return;
    METRICS.forEach(([key]) => {
      totals[key] += asNum(artifact[key]);
    });
  });
  return totals;
}

function countUsed(slots = state.slots) {
  return slots.reduce((acc, name) => {
    if (!name) return acc;
    acc[name] = asNum(acc[name]) + 1;
    return acc;
  }, {});
}

function canUseByInventory(name, usedMap, planSource) {
  if (planSource === 'inventory') return asNum(usedMap[name]) < asNum(state.inventory[name]);
  if (tuning.locks.limitedInAllMode.includes(name)) return asNum(usedMap[name]) < asNum(state.inventory[name]);
  return true;
}

function metricUtility(metric, value) {
  if (metric === 'radIn' || metric === 'bleedChance') return -value;
  return value;
}

 codex/add-customizable-priority-settings-99npv3
function priorityCurve(priority) {
  if (priority === 0) return 1;
  const s = Math.sign(priority);
  const a = Math.abs(priority);
  return 1 + s * (a === 1 ? 0.35 : a === 2 ? 0.95 : 2.0);
}

function hasWire(slots) {
  return slots.some(name => name === tuning.wireRules.wireName);
}

function buildSafetyPenalty(totals) {
  let penalty = 0;
  if (totals.health < 0) penalty += Math.abs(totals.health) * tuning.safetyWeights.health;
  if (totals.blood < 0) penalty += Math.abs(totals.blood) * tuning.safetyWeights.blood;
  if (totals.shock < 0) penalty += Math.abs(totals.shock) * tuning.safetyWeights.shock;
  if (totals.radBalance < 0) penalty += Math.abs(totals.radBalance) * tuning.safetyWeights.radBalance;
  if (totals.bleedChance > 0) penalty += totals.bleedChance * tuning.safetyWeights.bleedChance;
  if ((totals.food < 0 || totals.water < 0) && totals.health < 1) {
    penalty += (1 - totals.health) * tuning.safetyWeights.hungerHealthGuard;
  }
  return penalty;
}

function emissionBonus(totals) {
  if (totals.health >= tuning.emissionBonus.healthMin && totals.shock >= tuning.emissionBonus.shockMin) {
    return tuning.emissionBonus.bonus;
  }
  return 0;
}

function bloodComfortScore(totals, slots) {
  const wire = hasWire(slots);
  if (totals.blood >= 100) return 38;
  if (totals.blood >= 70) return tuning.comfortWeights.bloodSoft70;
  if (wire && totals.blood >= 50 && totals.bleedHeal >= tuning.wireRules.healStrong) return tuning.comfortWeights.bloodSoft50WithWire;
  if (totals.blood >= 50) return 12;
  return -Math.max(0, 50 - totals.blood) * 0.55;
}

function scoreBuild(totals, slots, usedMap) {
  let score = 0;
  METRICS.forEach(([key]) => {
    const utility = metricUtility(key, asNum(totals[key]));
    const tuned = tuning.targetScales[key] || 1;
    const priority = state.priorities[key] || 0;
    score += utility * tuned * priorityCurve(priority);
    if (priority !== 0) {
      score += utility * Math.sign(priority) * (Math.abs(priority) ** 2) * 0.6;
    }
  });

  score += bloodComfortScore(totals, slots);
  score += emissionBonus(totals);

  const hungerLoss = Math.max(0, -totals.food) + Math.max(0, -totals.water);
  score -= hungerLoss * tuning.comfortWeights.foodWaterNegative;
  if (totals.food < -120 || totals.water < -120) score -= hungerLoss * tuning.comfortWeights.foodWaterHard;

  const neutralMetrics = METRICS.map(([k]) => k).filter(k => state.priorities[k] === 0);
  score -= neutralMetrics.reduce((sum, key) => {
    const raw = asNum(totals[key]);
    return sum + (raw < 0 ? Math.abs(raw) * tuning.comfortWeights.neutralPenalty : 0);
  }, 0);

  const rarityPenalty = Object.entries(usedMap).reduce((sum, [name, count]) => {
    if (count <= 1) return sum;
    const inv = asNum(state.inventory[name]);
    const pressure = inv > 0 ? count / Math.max(1, inv) : count;
    return sum + (pressure ** 1.4) * tuning.build.rarityPenalty;
  }, 0);
  score -= rarityPenalty;

  score -= buildSafetyPenalty(totals);
  return score;
}

function isBannedForAuto(name) {
  return tuning.locks.bannedInAuto.includes(name);
}

function getAutoPool() {
  return state.artifacts.filter((artifact) => {
    if (isBannedForAuto(artifact.name)) return false;
    if (state.planSource === 'inventory') return asNum(state.inventory[artifact.name]) > 0;
    if (tuning.locks.limitedInAllMode.includes(artifact.name)) return asNum(state.inventory[artifact.name]) > 0;
    return true;
  });
}

 codex/add-customizable-priority-settings-99npv3
function lockedBase() {
  const baseSlots = state.slots.map((name, i) => (state.locked[i] ? name : null));
  return {
    slots: baseSlots,
    totals: aggregateTotals(baseSlots),
    used: countUsed(baseSlots)
  };

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
 main
}

function autoBuild() {
  syncSlots();
 codex/add-customizable-priority-settings-99npv3
  const unlocked = state.slots.map((_, i) => i).filter(i => !state.locked[i]);
  const pool = getAutoPool();
  const base = lockedBase();

  let beam = [{
    slots: [...base.slots],
    totals: { ...base.totals },
    used: { ...base.used },
    score: scoreBuild(base.totals, base.slots, base.used)
  }];

  unlocked.forEach((slotIndex) => {
    const next = [];
    beam.forEach((candidate) => {
      pool.forEach((artifact) => {
        const prev = candidate.slots[slotIndex];
        const used = { ...candidate.used };
        if (prev) used[prev] = Math.max(0, asNum(used[prev]) - 1);
        if (!canUseByInventory(artifact.name, used, state.planSource)) return;

        const nextSlots = [...candidate.slots];
        nextSlots[slotIndex] = artifact.name;
        const nextUsed = { ...used, [artifact.name]: asNum(used[artifact.name]) + 1 };
        const totals = aggregateTotals(nextSlots);
        let score = scoreBuild(totals, nextSlots, nextUsed);
        if (candidate.slots[slotIndex] && candidate.slots[slotIndex] !== artifact.name) score -= tuning.build.diversityPenalty;
        next.push({ slots: nextSlots, totals, used: nextUsed, score });

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

 main
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
 codex/add-customizable-priority-settings-99npv3
 test

 main
      });
    });
    nextBeam.sort((a, b) => b.score - a.score);
    beam = nextBeam.slice(0, beamWidth);
  });

 codex/add-customizable-priority-settings-99npv3
 codex/add-customizable-priority-settings-99npv3
    next.sort((a, b) => b.score - a.score);
    beam = next.slice(0, tuning.build.beamWidth);
  });

  beam.sort((a, b) => b.score - a.score);
  const top = beam.slice(0, tuning.build.alternatives);
  if (!top.length) return;

  state.slots = [...top[0].slots];
  state.alternatives = top.map((item, idx) => ({
    id: `build-${Date.now()}-${idx}`,
    rank: idx + 1,
    slots: item.slots,
    totals: item.totals,
    score: item.score,
    note: explainVariant(item.totals, item.slots)
  }));


 main
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

 codex/add-customizable-priority-settings-99npv3
 test

 main
  saveState();
  renderAll();
}

 codex/add-customizable-priority-settings-99npv3
 codex/add-customizable-priority-settings-99npv3
function explainVariant(totals, slots) {
  const bits = [];
  if (totals.blood >= 100) bits.push('кровь закрыта');
  else if (totals.blood >= 70) bits.push('кровь с запасом');
  else if (totals.blood >= 50) bits.push('кровь рабочая');
  if (hasWire(slots) && totals.blood >= 50 && totals.bleedHeal >= tuning.wireRules.healStrong) bits.push('Проволока синергия');
  if (totals.health >= 9 && totals.shock >= 20) bits.push('держит выброс');
  if (!slots.includes('Золотая рыбка')) bits.push('без рыбки');
  const activePriority = METRICS.filter(([k]) => state.priorities[k] !== 0).map(([k, label]) => `${label} ${state.priorities[k] > 0 ? '↑' : '↓'}`);
  if (activePriority.length) bits.push(`приоритеты: ${activePriority.join(', ')}`);
  return bits.slice(0, 3).join(' · ') || 'сбалансированная сборка';
}

function clearBuild() {
  state.slots = state.slots.map((name, i) => (state.locked[i] ? name : null));


 main
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
 codex/add-customizable-priority-settings-99npv3
 test

 main
  state.alternatives = [];
  saveState();
  renderAll();
}

function renderInventory() {
  const query = els.search.value.trim().toLowerCase();
  els.inventoryList.innerHTML = '';

  state.artifacts
    .filter((a) => !query || a.name.toLowerCase().includes(query))
    .forEach((artifact) => {
      const qty = asNum(state.inventory[artifact.name]);
      const row = document.createElement('article');
      row.className = 'inventory-item';
      row.innerHTML = `
        <div class="inventory-main">
          <img class="artifact-thumb" src="${artifact.image || 'assets/artifacts/placeholder.png'}" alt="${artifact.name}" onerror="this.src='assets/artifacts/placeholder.png'" />
          <div class="inventory-meta">
            <h4>${artifact.name}</h4>
            <p>HP ${signed(asNum(artifact.health))} · Кровь ${signed(asNum(artifact.blood))} · Шок ${signed(asNum(artifact.shock))} · Рад ${signed(asNum(artifact.radBalance))}</p>
          </div>
        </div>
        <div class="stepper">
          <button class="btn" type="button" data-step="-5">-5</button>
          <button class="btn" type="button" data-step="-1">−</button>
          <strong>${qty}</strong>
          <button class="btn" type="button" data-step="1">+</button>
          <button class="btn" type="button" data-step="5">+5</button>
        </div>
      `;

      row.querySelectorAll('[data-step]').forEach((button) => {
        button.addEventListener('click', () => {
          const step = asNum(button.getAttribute('data-step'));
          state.inventory[artifact.name] = Math.max(0, qty + step);
          saveState();
          renderInventory();
          renderSlots();
        });
      });

      els.inventoryList.appendChild(row);
    });
}

function openPicker(index) {
  state.slotEditing = index;
  renderPicker();
  els.pickerDialog.showModal();
}

function renderPicker() {
  const query = els.pickerSearch.value.trim().toLowerCase();
  els.pickerList.innerHTML = '';

  const clearBtn = document.createElement('button');
  clearBtn.className = 'pick-item btn';
  clearBtn.type = 'button';
  clearBtn.textContent = 'Очистить слот';
  clearBtn.addEventListener('click', () => {
    state.slots[state.slotEditing] = null;
    saveState();
    els.pickerDialog.close();
    renderAll();
  });
  els.pickerList.appendChild(clearBtn);

  state.artifacts
    .filter((a) => !query || a.name.toLowerCase().includes(query))
    .forEach((artifact) => {
      const used = countUsed(state.slots);
      if (isBannedForAuto(artifact.name) && state.slotEditing !== null) {
        // ручной выбор разрешен
      }
      const available = state.planSource === 'all'
        ? (tuning.locks.limitedInAllMode.includes(artifact.name)
          ? Math.max(0, asNum(state.inventory[artifact.name]) - asNum(used[artifact.name]))
          : '∞')
        : Math.max(0, asNum(state.inventory[artifact.name]) - asNum(used[artifact.name]));
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'pick-item btn';
      button.innerHTML = `
        <span class="pick-main"><img class="artifact-thumb" src="${artifact.image || 'assets/artifacts/placeholder.png'}" alt="${artifact.name}" onerror="this.src='assets/artifacts/placeholder.png'" />${artifact.name}</span>
        <span>${available}</span>
      `;
      button.disabled = available === 0;
      button.addEventListener('click', () => {
        state.slots[state.slotEditing] = artifact.name;
        saveState();
        els.pickerDialog.close();
        renderAll();
      });
      els.pickerList.appendChild(button);
    });
}

function renderSlots() {
  syncSlots();
  els.slots.innerHTML = '';
  state.slots.forEach((name, index) => {
    const artifact = name ? getArtifact(name) : null;
    const slot = document.createElement('article');
    slot.className = `slot ${state.locked[index] ? 'locked' : ''}`;
    slot.dataset.index = String(index);
    slot.innerHTML = artifact
      ? `<header class="slot-head"><small>Слот ${index + 1}</small><div class="slot-actions"><button class="lock-btn" type="button">${state.locked[index] ? '🔒' : '🔓'}</button><button class="clear-btn" type="button">✕</button></div></header><img class="artifact-thumb" src="${artifact.image || 'assets/artifacts/placeholder.png'}" alt="${artifact.name}" onerror="this.src='assets/artifacts/placeholder.png'" /><strong>${artifact.name}</strong><p class="mini">HP ${signed(asNum(artifact.health))} · Рад ${signed(asNum(artifact.radBalance))}</p><button class="btn pick-btn" type="button">Выбрать</button>`
      : `<header class="slot-head"><small>Слот ${index + 1}</small><div class="slot-actions"><button class="lock-btn" type="button">${state.locked[index] ? '🔒' : '🔓'}</button></div></header><p class="slot-empty">Пусто</p><button class="btn pick-btn" type="button">Выбрать</button>`;

    slot.querySelector('.pick-btn')?.addEventListener('click', () => {
      if (!state.locked[index]) openPicker(index);
    });

    slot.querySelector('.lock-btn')?.addEventListener('click', () => {
      state.locked[index] = !state.locked[index];
      saveState();
      renderSlots();
    });

    slot.querySelector('.clear-btn')?.addEventListener('click', () => {
      if (state.locked[index]) return;
      state.slots[index] = null;
      saveState();
      renderAll();
    });

    if (artifact && !state.locked[index]) {
      slot.draggable = true;
      slot.addEventListener('dragstart', () => { state.dragIndex = index; });
    }

    slot.addEventListener('dragover', (event) => {
      event.preventDefault();
      if (state.dragIndex === null || state.dragIndex === index || state.locked[index]) return;
      slot.classList.add('drag-over');
    });

    slot.addEventListener('dragleave', () => slot.classList.remove('drag-over'));

    slot.addEventListener('drop', (event) => {
      event.preventDefault();
      slot.classList.remove('drag-over');
      const from = state.dragIndex;
      if (from === null || from === index || state.locked[from] || state.locked[index]) return;
      const temp = state.slots[from];
      state.slots[from] = state.slots[index];
      state.slots[index] = temp;
      state.dragIndex = null;
      saveState();
      renderAll();
    });

    els.slots.appendChild(slot);
  });
}

function makePriorityStepper(metricKey, current) {
  const wrap = document.createElement('span');
  wrap.className = 'priority-stepper';
  const minus = document.createElement('button');
  minus.className = 'mini-btn';
  minus.type = 'button';
  minus.textContent = '−';
  minus.addEventListener('click', () => {
    state.priorities[metricKey] = clamp(current - 1, -3, 3);
    saveState();
    autoBuild();
  });
  const val = document.createElement('strong');
  val.textContent = signed(current);
  const plus = document.createElement('button');
  plus.className = 'mini-btn';
  plus.type = 'button';
  plus.textContent = '+';
  plus.addEventListener('click', () => {
    state.priorities[metricKey] = clamp(current + 1, -3, 3);
    saveState();
    autoBuild();
  });
  wrap.append(minus, val, plus);
  return wrap;
}

function renderTotals() {
  const totals = aggregateTotals();
  els.totals.innerHTML = '';

  METRICS.forEach(([key, label]) => {
    const row = document.createElement('div');
    const value = asNum(totals[key]);
    const good = (key === 'radIn' || key === 'bleedChance') ? value <= 0 : value >= 0;
    row.className = `total-row ${good ? 'ok' : 'bad'}`;
    const left = document.createElement('span');
    left.textContent = label;
    const right = document.createElement('div');
    right.className = 'total-controls';
    right.appendChild(makePriorityStepper(key, state.priorities[key]));
    const valueNode = document.createElement('strong');
    valueNode.className = value >= 0 ? 'pos' : 'neg';
    valueNode.textContent = signed(value);
    right.appendChild(valueNode);
    row.append(left, right);
    els.totals.appendChild(row);
  });

  const filled = state.slots.filter(Boolean).length;
  els.kpiSlots.textContent = `${filled} / ${state.slots.length}`;
  els.kpiRad.textContent = signed(totals.radBalance);

  const statuses = [];
  if (totals.health >= 9 && totals.shock >= 20) statuses.push('Держит выброс');
  if (totals.radBalance >= 0) statuses.push('Рад-баланс стабилен');
  if (totals.bleedChance <= 0) statuses.push('Порез под контролем');
  if (!statuses.length) statuses.push('Требует доработки');
  els.kpiStatus.textContent = statuses.join(' · ');

  renderSummary(totals);
  renderSelfCritique(totals);
}

function renderSummary(totals) {
  const lines = [];
  if (totals.health < 1) lines.push('Нужно минимум +1 к здоровью (из-за воды/еды).');
  if (totals.blood < 50) lines.push('Кровь ниже рабочего порога, ищи арты с кровью/лечением.');
  if (totals.radBalance < 0) lines.push('Не закрыт рад-баланс, добавь вывод радиации.');
  if (totals.bleedChance > 0) lines.push('Шанс пореза в плюс, нужны анти-порез артефакты.');
  if (!lines.length) lines.push('Сборка выглядит стабильной. Можно точечно крутить приоритеты.');

  const inventoryHints = [];
  const usable = state.artifacts.filter(a => asNum(state.inventory[a.name]) > 0);
  const byMetric = (metric, direction = 1) => usable
    .filter(a => direction * asNum(a[metric]) > 0)
    .sort((a, b) => direction * (asNum(b[metric]) - asNum(a[metric])))
    .slice(0, 2)
    .map(a => a.name);

  if (totals.radBalance < 0) inventoryHints.push(`Из инвентаря: ${byMetric('radBalance', 1).join(', ') || 'ничего подходящего'}`);
  if (totals.blood < 50) inventoryHints.push(`На кровь: ${byMetric('blood', 1).join(', ') || 'ничего подходящего'}`);

  els.summaryBox.innerHTML = `<ul>${[...lines, ...inventoryHints].map(v => `<li>${v}</li>`).join('')}</ul>`;
}

function renderSelfCritique(totals) {
  const notes = [];
  if (totals.health < 0 || totals.shock < 0 || totals.blood < 0 || totals.radBalance < 0 || totals.bleedChance > 0) {
    notes.push('Есть нарушение safety-правил. Автоподбор будет это штрафовать сильнее.');
  }
  if (totals.food < -120 || totals.water < -120) notes.push('Сильный расход еды/воды. Попробуй поднять приоритет еды/воды.');
  if (totals.health >= 9 && totals.shock >= 20) notes.push('Выброс выдерживается.');
  if (!notes.length) notes.push('Параметры в хорошем балансе.');
  els.selfCritique.innerHTML = `<strong>Сводка:</strong> ${notes.join(' ')}`;
}

function renderAlternatives() {
  els.alternatives.innerHTML = '';
  if (!state.alternatives.length) {
    els.alternatives.innerHTML = '<p class="mini">Нажми «Варианты», чтобы получить топ-5 сборок.</p>';
    return;
  }

  state.alternatives.forEach((variant, idx) => {
    const card = document.createElement('article');
    card.className = 'variant-card';
    const arts = variant.slots.filter(Boolean).slice(0, 6).join(', ');
    card.innerHTML = `
      <header>
        <strong>#${idx + 1}</strong>
        <span>Score ${variant.score.toFixed(1)}</span>
      </header>
      <p>${variant.note}</p>
      <p class="mini">HP ${signed(variant.totals.health)} · Blood ${signed(variant.totals.blood)} · Shock ${signed(variant.totals.shock)} · Rad ${signed(variant.totals.radBalance)}</p>
      <p class="mini">${arts}</p>
      <button class="btn" type="button">Применить</button>
    `;
    card.querySelector('button').addEventListener('click', () => {
      state.slots = [...variant.slots];
      saveState();
      renderAll();
      card.classList.add('applied');
      setTimeout(() => card.classList.remove('applied'), 400);
    });
    els.alternatives.appendChild(card);
  });
}

function renderStorageLists() {
  els.buildsList.innerHTML = '';
  els.inventoriesList.innerHTML = '';

  state.presets.builds.forEach((entry) => {
    const item = document.createElement('div');
    item.className = 'storage-row';
    item.innerHTML = `<span>${entry.name}</span><div><button class="btn" data-act="load">Загрузить</button><button class="btn" data-act="delete">Удалить</button></div>`;
    item.querySelector('[data-act="load"]').addEventListener('click', () => {
      state.slots = [...entry.slots];
      state.locked = [...entry.locked];
      state.beltCount = asNum(entry.beltCount) || state.beltCount;
      syncSlots();
      saveState();
      renderAll();
    });
    item.querySelector('[data-act="delete"]').addEventListener('click', () => {
      state.presets.builds = state.presets.builds.filter((x) => x.id !== entry.id);
      savePresets();
      renderStorageLists();
    });
    els.buildsList.appendChild(item);
  });

  state.presets.inventories.forEach((entry) => {
    const item = document.createElement('div');
    item.className = 'storage-row';
    item.innerHTML = `<span>${entry.name}</span><div><button class="btn" data-act="load">Загрузить</button><button class="btn" data-act="delete">Удалить</button></div>`;
    item.querySelector('[data-act="load"]').addEventListener('click', () => {
      state.inventory = { ...entry.inventory };
      saveState();
      renderAll();
    });
    item.querySelector('[data-act="delete"]').addEventListener('click', () => {
      state.presets.inventories = state.presets.inventories.filter((x) => x.id !== entry.id);
      savePresets();
      renderStorageLists();
    });
    els.inventoriesList.appendChild(item);
  });
}

function saveBuildPreset() {
  const name = els.buildSaveName.value.trim();
  if (!name) return;
  state.presets.builds.unshift({
    id: `b-${Date.now()}`,
    name,
    slots: [...state.slots],
    locked: [...state.locked],
    beltCount: state.beltCount
  });
  state.presets.builds = state.presets.builds.slice(0, 30);
  savePresets();
  els.buildSaveName.value = '';
  renderStorageLists();
}

function saveInventoryPreset() {
  const name = els.invSaveName.value.trim();
  if (!name) return;
  state.presets.inventories.unshift({
    id: `i-${Date.now()}`,
    name,
    inventory: { ...state.inventory }
  });
  state.presets.inventories = state.presets.inventories.slice(0, 30);
  savePresets();
  els.invSaveName.value = '';
  renderStorageLists();
}

function renderAll() {
  renderInventory();
  renderPriorities();
  renderSlots();
  renderAlternatives();
  renderTotals();
  renderAlternatives();
}

async function init() {
  loadState();
 codex/add-customizable-priority-settings-99npv3
 codex/add-customizable-priority-settings-99npv3
  loadPresets();

  const response = await fetch('artifacts.json');
  const raw = await response.json();
  state.artifacts = raw.map((a) => ({
    ...a,
    image: a.image || 'assets/artifacts/placeholder.png',
    radBalance: asNum(a.radBalance ?? asNum(a.radOut) - asNum(a.radIn))
  }));
  state.byName = new Map(state.artifacts.map((a) => [a.name, a]));


 main
  state.priorities = metrics.reduce((acc, [key]) => {
    acc[key] = Number(state.priorities?.[key] ?? DEFAULT_PRIORITIES[key]);
    return acc;
  }, {});
  const resp = await fetch('artifacts.json');
  state.artifacts = await resp.json();
 test

  syncSlots();
  els.beltCount.value = String(state.beltCount);
  els.planSource.value = state.planSource;

  els.search.addEventListener('input', renderInventory);
  els.pickerSearch.addEventListener('input', renderPicker);

  els.beltCount.addEventListener('change', () => {
    state.beltCount = clamp(asNum(els.beltCount.value), 1, 5);
    syncSlots();
    saveState();
    renderAll();
  });

  els.planSource.addEventListener('change', () => {
    state.planSource = els.planSource.value === 'all' ? 'all' : 'inventory';
    saveState();
    renderAll();
  });
 codex/add-customizable-priority-settings-99npv3
 codex/add-customizable-priority-settings-99npv3


  els.prioritiesReset?.addEventListener('click', resetPriorities);
 test

  els.prioritiesReset?.addEventListener('click', resetPriorities);
 main
  els.autoBuild.addEventListener('click', autoBuild);
  els.variantsBtn.addEventListener('click', () => {
    autoBuild();
    document.getElementById('variantsSection')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  els.clearBuild.addEventListener('click', clearBuild);

  els.storageBtn.addEventListener('click', () => {
    renderStorageLists();
    els.storageDialog.showModal();
  });
  els.saveBuildBtn.addEventListener('click', saveBuildPreset);
  els.saveInvBtn.addEventListener('click', saveInventoryPreset);

  renderAll();
}

init();
