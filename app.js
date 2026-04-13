
const CONFIG = {
  storage: {
    state: 'stalker-build-helper-v40',
    legacyState: 'stalker-build-helper-v23',
    buildPresets: 'stalker-build-helper-v40-build-presets',
    legacyBuildPresets: 'stalker-build-helper-v23-build-presets',
    inventoryPresets: 'stalker-build-helper-v40-inventory-presets',
    legacyInventoryPresets: 'stalker-build-helper-v23-inventory-presets'
  },
  belt: { minContainers: 1, maxContainers: 5, slotsPerContainer: 3 },
  priority: {
    min: -3,
    max: 3,
    scale: { '-3': 0.08, '-2': 0.22, '-1': 0.52, '0': 1.0, '1': 2.2, '2': 4.9, '3': 9.8 }
  },
  rules: {
    hungryMinHealth: 1,
    emission: { health: 9, shock: 20 },
    bloodTargetDefault: 100,
    bloodTargetWithWire: 50,
    wireBleedHeal: 100
  },
  search: {
    beamBalanced: 380,
    beamFocused: 280,
    hillClimbIterations: 40,
    candidateTopSlice: 72,
    diversityThresholds: [4, 2, 0],
    maxSuggestionsPerNeed: 4,
    maxMissingSuggestions: 1,
    maxVariants: 5
  },
  scoring: {
    balanced: {
      weakestBase: 52000,
      averageBase: 15000,
      spreadPenalty: 12000,
      slotUsageBonus: 4,
      comfort: {
        healthOver: { from: 8, weight: 220 },
        bloodFloor: { default: 70, withWire: 35, weight: 55 },
        shockOver: { from: 20, weight: 70 },
        radBalanceOver: { from: 10, weight: 55 },
        emissionBonus: 2600
      }
    },
    penalties: {
      water: { base: 0.15, final: 0.8 },
      food: { base: 0.15, final: 0.8 },
      bleedChance: { base: 24, final: 160 },
      bleedHeal: { base: 8, final: 45 },
      fish: { base: 2200, final: 16000 },
      riskyBleedArtifact: { base: 1200, final: 8000 },
      bloodComfort: { base: 11, final: 95 },
      emissionMiss: { base: 180, final: 1400 },
      hard: {
        health: { base: 15000, final: 250000 },
        blood: { base: 12000, final: 180000 },
        shock: { base: 10000, final: 160000 },
        radBalance: { base: 11000, final: 170000 },
        bleedChance: { base: 9000, final: 120000 }
      }
    },
    targets: {
      health: { base: 82, final: 680 },
      blood: { base: 9.5, final: 82 },
      shock: { base: 11, final: 95 },
      water: { base: 4.2, final: 34 },
      food: { base: 4.2, final: 34 },
      radOut: { base: 4.8, final: 40 },
      radIn: { base: 4.8, final: 40 },
      radBalance: { base: 16, final: 140 },
      bleedChance: { base: 7.2, final: 62 },
      bleedHeal: { base: 6.0, final: 56 }
    },
    objectives: {
      balanced: { final: { health: 7600, blood: 7000, shock: 7000, radBalance: 7600 }, base: { health: 980, blood: 900, shock: 900, radBalance: 980 }, slotUsage: { final: 3, base: 1 } },
      health: { primaryNorm: { final: 9000, base: 1200 }, primaryRaw: { final: 220, base: 28 }, support: { shock: 700, radBalance: 700, blood: 400 } },
      blood: { primaryNorm: { final: 8000, base: 1050 }, primaryRaw: { final: 85, base: 10 }, support: { health: 700, shock: 650, radBalance: 650 } },
      shock: { primaryNorm: { final: 9000, base: 1200 }, primaryRaw: { final: 120, base: 15 }, support: { health: 800, blood: 550, radBalance: 650 } },
      radBalance: { primaryNorm: { final: 9000, base: 1200 }, primaryRaw: { final: 120, base: 16 }, support: { health: 800, blood: 550, shock: 650 } },
      water: { primaryRaw: { final: 150, base: 18 }, support: { health: 650, radBalance: 500, shock: 420 } },
      food: { primaryRaw: { final: 150, base: 18 }, support: { health: 650, radBalance: 500, shock: 420 } },
      radOut: { primaryRaw: { final: 120, base: 14 }, support: { radBalance: 800, health: 320 } },
      radIn: { primaryRaw: { final: 120, base: 14 }, support: { radBalance: 800, health: 320 } },
      bleedHeal: { primaryRaw: { final: 180, base: 20 }, support: { blood: 460, health: 460 } },
      comfort: { health: { final: 260, base: 34 }, blood: { final: 44, base: 5 }, shock: { final: 72, base: 9 }, water: { final: 40, base: 4.6 }, food: { final: 40, base: 4.6 }, radBalance: { final: 90, base: 10 } }
    },
    emissionBonus: { final: 3200, base: 380 }
  }
};

const state = {
  artifacts: [],
  artifactsMap: {},
  inventory: {},
  beltContainers: 5,
  planSource: 'inventory',
  slots: [],
  locked: [],
  pickerSlotIndex: null,
  variants: null,
  targets: {
    health: 0,
    blood: 0,
    shock: 0,
    water: 0,
    food: 0,
    radOut: 0,
    radIn: 0,
    radBalance: 0,
    bleedChance: 0,
    bleedHeal: 0
  }
};

let dragSourceIndex = null;
let suppressSlotClickUntil = 0;

const NAME_ALIASES = {
  'Шнурвал': 'Измененный штурвал',
  'Изменённый штурвал': 'Измененный штурвал',
  'Травий': 'Гравий',
  'Золотая Рыбка': 'Золотая рыбка',
  'Джейкоб': 'Джейбк'
};

function canonicalName(name) {
  return NAME_ALIASES[String(name || '').trim()] || String(name || '').trim();
}

const totalsMeta = [
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
const targetLabels = Object.fromEntries(totalsMeta);
const objectiveKeyMap = {
  health: 'health',
  blood: 'blood',
  shock: 'shock',
  radBalance: 'radBalance',
  water: 'water',
  food: 'food',
  radOut: 'radOut',
  radIn: 'radIn',
  bleedHeal: 'bleedHeal',
  bleedChance: 'bleedChance'
};

const beltSelect = document.getElementById('beltSelect');
const planSourceSelect = document.getElementById('planSourceSelect');
const inventoryList = document.getElementById('inventoryList');
const inventoryVisibleCount = document.getElementById('inventoryVisibleCount');
const inventoryOwnedKinds = document.getElementById('inventoryOwnedKinds');
const artifactCountPill = document.getElementById('artifactCountPill');
const containersRoot = document.getElementById('containersRoot');
const totalsGrid = document.getElementById('totalsGrid');
const needsList = document.getElementById('needsList');
const ownedSuggestions = document.getElementById('ownedSuggestions');
const missingSuggestions = document.getElementById('missingSuggestions');
const inventorySearch = document.getElementById('inventorySearch');
const pickerModal = document.getElementById('pickerModal');
const pickerTitle = document.getElementById('pickerTitle');
const pickerList = document.getElementById('pickerList');
const pickerSearch = document.getElementById('pickerSearch');
const pickerOwnedOnly = document.getElementById('pickerOwnedOnly');
const slotCountLabel = document.getElementById('slotCountLabel');
const filledCountLabel = document.getElementById('filledCountLabel');
const ownedUsageLabel = document.getElementById('ownedUsageLabel');
const variantsRoot = document.getElementById('variantsRoot');
const beltButtons = document.getElementById('beltButtons');
const beltCaption = document.getElementById('beltCaption');
const planButtons = document.getElementById('planButtons');
const savesModal = document.getElementById('savesModal');
const buildPresetNameInput = document.getElementById('buildPresetName');
const inventoryPresetNameInput = document.getElementById('inventoryPresetName');
const buildPresetsList = document.getElementById('buildPresetsList');
const inventoryPresetsList = document.getElementById('inventoryPresetsList');
const resetTargetsBtn = document.getElementById('resetTargetsBtn');
const slotTemplate = document.getElementById('slotTemplate');

function numberToText(value) {
  const n = Number(value || 0);
  if (Math.abs(n) < 1e-9) return '0';
  const rounded = Math.round(n * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1).replace(/\.0$/, '');
}
function signedText(value) {
  const n = Number(value || 0);
  return `${n > 0 ? '+' : ''}${numberToText(n)}`;
}
function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
function slotsPerBelt(count) { return clamp(Number(count || 0), CONFIG.belt.minContainers, CONFIG.belt.maxContainers) * CONFIG.belt.slotsPerContainer; }
function defaultSlots(count) { return Array.from({ length: slotsPerBelt(count) }, () => null); }
function defaultLocks(count) { return Array.from({ length: slotsPerBelt(count) }, () => false); }
function biasClass(v) {
  if (v > 0) return 'pos';
  if (v < 0) return 'neg';
  return 'neu';
}
function priorityIndicator(v) {
  const n = Number(v || 0);
  if (!n) return '0';
  return n > 0 ? `↑${n}` : `↓${Math.abs(n)}`;
}
function targetScale(v) {
  const key = String(clamp(Number(v || 0), CONFIG.priority.min, CONFIG.priority.max));
  return CONFIG.priority.scale[key] || 1;
}
function activeTargetEntries() {
  return Object.entries(state.targets).filter(([, value]) => Number(value) !== 0);
}
function describeActiveTargetsShort() {
  const active = activeTargetEntries();
  if (!active.length) return '';
  return active.map(([key, value]) => `${targetLabels[key]} ${value > 0 ? '↑' : '↓'}${Math.abs(value)}`).join(' • ');
}
function adjustTarget(key, delta) {
  const next = clamp(Number(state.targets[key] || 0) + delta, CONFIG.priority.min, CONFIG.priority.max);
  state.targets[key] = next;
  saveState();
  applyBestBuild(true);
}
function resetTargets() {
  Object.keys(state.targets).forEach(key => state.targets[key] = 0);
  saveState();
  applyBestBuild(true);
}

function normalizeArt(a) {
  const name = canonicalName(a.name);
  return {
    ...a,
    name,
    health: Number(a.health || 0),
    blood: Number(a.blood || 0),
    shock: Number(a.shock || 0),
    water: Number(a.water || 0),
    food: Number(a.food || 0),
    radOut: Number(a.radOut || 0),
    radIn: Number(a.radIn || 0),
    radBalance: Number(a.radBalance || 0),
    bleedChance: Number(a.bleedChance || 0),
    bleedHeal: Number(a.bleedHeal || 0),
    isFish: Boolean(a.isFish || name.toLowerCase() === 'золотая рыбка'),
    avoidAuto: name === 'Колючка',
    image: a.image || 'assets/artifacts/placeholder.png'
  };
}

function getStorageObject(primaryKey, legacyKey = '') {
  const raw = localStorage.getItem(primaryKey) || (legacyKey ? localStorage.getItem(legacyKey) : '') || '';
  if (!raw) return {};
  try { return JSON.parse(raw) || {}; }
  catch { return {}; }
}
function setStorageObject(key, obj) {
  localStorage.setItem(key, JSON.stringify(obj));
}
function sanitizeTargets(rawTargets) {
  Object.keys(state.targets).forEach(key => {
    const raw = Number(rawTargets?.[key] || 0);
    state.targets[key] = clamp(raw, CONFIG.priority.min, CONFIG.priority.max);
  });
}
function ensureInventoryKeys() {
  state.artifacts.forEach(art => {
    if (!Object.prototype.hasOwnProperty.call(state.inventory, art.name)) state.inventory[art.name] = 0;
  });
  Object.keys(state.inventory).forEach(name => {
    if (!state.artifactsMap[name]) delete state.inventory[name];
  });
}
function loadState() {
  const saved = getStorageObject(CONFIG.storage.state, CONFIG.storage.legacyState);
  if (saved.inventory && typeof saved.inventory === 'object') {
    const nextInventory = {};
    Object.entries(saved.inventory).forEach(([name, qty]) => {
      nextInventory[canonicalName(name)] = Math.max(0, Number(qty || 0));
    });
    state.inventory = nextInventory;
  }
  if (Number.isInteger(saved.beltContainers)) state.beltContainers = clamp(saved.beltContainers, CONFIG.belt.minContainers, CONFIG.belt.maxContainers);
  if (saved.planSource === 'all' || saved.planSource === 'inventory') state.planSource = saved.planSource;
  sanitizeTargets(saved.targets || {});
  if (Array.isArray(saved.slots)) state.slots = saved.slots.map(v => v ? canonicalName(v) : null);
  if (Array.isArray(saved.locked)) state.locked = saved.locked.map(Boolean);
  ensureInventoryKeys();
}
function saveState() {
  setStorageObject(CONFIG.storage.state, {
    inventory: state.inventory,
    beltContainers: state.beltContainers,
    planSource: state.planSource,
    targets: state.targets,
    slots: state.slots,
    locked: state.locked
  });
}

function getNamedStore(primaryKey, legacyKey = '') {
  return getStorageObject(primaryKey, legacyKey);
}
function setNamedStore(key, obj) {
  setStorageObject(key, obj);
}

function saveBuildPreset() {
  const name = (buildPresetNameInput?.value || '').trim();
  if (!name) return alert('Введи название сборки.');
  const store = getNamedStore(CONFIG.storage.buildPresets, CONFIG.storage.legacyBuildPresets);
  store[name] = {
    beltContainers: state.beltContainers,
    planSource: state.planSource,
    targets: state.targets,
    slots: state.slots,
    locked: state.locked
  };
  setNamedStore(CONFIG.storage.buildPresets, store);
  if (buildPresetNameInput) buildPresetNameInput.value = '';
  renderSavesModal();
}
function loadBuildPresetByName(name) {
  const store = getNamedStore(CONFIG.storage.buildPresets, CONFIG.storage.legacyBuildPresets);
  const preset = store[name];
  if (!preset) return;
  state.beltContainers = clamp(Number(preset.beltContainers || 5), CONFIG.belt.minContainers, CONFIG.belt.maxContainers);
  state.planSource = preset.planSource === 'all' ? 'all' : 'inventory';
  sanitizeTargets(preset.targets || {});
  state.slots = Array.isArray(preset.slots) ? preset.slots.map(v => v ? canonicalName(v) : null) : defaultSlots(state.beltContainers);
  state.locked = Array.isArray(preset.locked) ? preset.locked.map(Boolean) : defaultLocks(state.beltContainers);
  beltSelect.value = String(state.beltContainers);
  planSourceSelect.value = state.planSource;
  ensureSlotsLength();
  saveState();
  renderAll();
  closeSavesModal();
}
function deleteBuildPreset(name) {
  const store = getNamedStore(CONFIG.storage.buildPresets, CONFIG.storage.legacyBuildPresets);
  delete store[name];
  setNamedStore(CONFIG.storage.buildPresets, store);
  renderSavesModal();
}
function saveInventoryPreset() {
  const name = (inventoryPresetNameInput?.value || '').trim();
  if (!name) return alert('Введи название инвентаря.');
  const store = getNamedStore(CONFIG.storage.inventoryPresets, CONFIG.storage.legacyInventoryPresets);
  store[name] = { inventory: state.inventory };
  setNamedStore(CONFIG.storage.inventoryPresets, store);
  if (inventoryPresetNameInput) inventoryPresetNameInput.value = '';
  renderSavesModal();
}
function loadInventoryPresetByName(name) {
  const store = getNamedStore(CONFIG.storage.inventoryPresets, CONFIG.storage.legacyInventoryPresets);
  if (!store[name]) return;
  const nextInventory = {};
  Object.entries(store[name].inventory || {}).forEach(([k, v]) => {
    nextInventory[canonicalName(k)] = Math.max(0, Number(v || 0));
  });
  state.inventory = nextInventory;
  ensureInventoryKeys();
  saveState();
  renderAll();
  closeSavesModal();
}
function deleteInventoryPreset(name) {
  const store = getNamedStore(CONFIG.storage.inventoryPresets, CONFIG.storage.legacyInventoryPresets);
  delete store[name];
  setNamedStore(CONFIG.storage.inventoryPresets, store);
  renderSavesModal();
}
function openSavesModal() {
  if (!savesModal) return;
  savesModal.classList.remove('hidden');
  savesModal.setAttribute('aria-hidden', 'false');
  renderSavesModal();
}
function closeSavesModal() {
  if (!savesModal) return;
  savesModal.classList.add('hidden');
  savesModal.setAttribute('aria-hidden', 'true');
}
function renderSavesModal() {
  if (!buildPresetsList || !inventoryPresetsList) return;

  const buildStore = getNamedStore(CONFIG.storage.buildPresets, CONFIG.storage.legacyBuildPresets);
  const buildNames = Object.keys(buildStore).sort((a, b) => a.localeCompare(b, 'ru'));
  buildPresetsList.innerHTML = buildNames.length ? '' : '<div class="empty-state">Сборок пока нет.</div>';
  buildNames.forEach(name => {
    const row = document.createElement('div');
    row.className = 'preset-item';

    const title = document.createElement('div');
    title.className = 'preset-name';
    title.textContent = name;

    const loadBtn = document.createElement('button');
    loadBtn.className = 'btn iconish';
    loadBtn.textContent = 'Загрузить';
    loadBtn.addEventListener('click', () => loadBuildPresetByName(name));

    const delBtn = document.createElement('button');
    delBtn.className = 'btn iconish';
    delBtn.textContent = 'Удалить';
    delBtn.addEventListener('click', () => deleteBuildPreset(name));

    row.append(title, loadBtn, delBtn);
    buildPresetsList.appendChild(row);
  });

  const invStore = getNamedStore(CONFIG.storage.inventoryPresets, CONFIG.storage.legacyInventoryPresets);
  const invNames = Object.keys(invStore).sort((a, b) => a.localeCompare(b, 'ru'));
  inventoryPresetsList.innerHTML = invNames.length ? '' : '<div class="empty-state">Инвентарей пока нет.</div>';
  invNames.forEach(name => {
    const row = document.createElement('div');
    row.className = 'preset-item';

    const title = document.createElement('div');
    title.className = 'preset-name';
    title.textContent = name;

    const loadBtn = document.createElement('button');
    loadBtn.className = 'btn iconish';
    loadBtn.textContent = 'Загрузить';
    loadBtn.addEventListener('click', () => loadInventoryPresetByName(name));

    const delBtn = document.createElement('button');
    delBtn.className = 'btn iconish';
    delBtn.textContent = 'Удалить';
    delBtn.addEventListener('click', () => deleteInventoryPreset(name));

    row.append(title, loadBtn, delBtn);
    inventoryPresetsList.appendChild(row);
  });
}

function ensureSlotsLength() {
  const wanted = slotsPerBelt(state.beltContainers);
  if (!Array.isArray(state.slots) || !state.slots.length) state.slots = defaultSlots(state.beltContainers);
  else if (state.slots.length > wanted) state.slots = state.slots.slice(0, wanted);
  else if (state.slots.length < wanted) state.slots = state.slots.concat(Array.from({ length: wanted - state.slots.length }, () => null));

  if (!Array.isArray(state.locked) || !state.locked.length) state.locked = defaultLocks(state.beltContainers);
  else if (state.locked.length > wanted) state.locked = state.locked.slice(0, wanted);
  else if (state.locked.length < wanted) state.locked = state.locked.concat(Array.from({ length: wanted - state.locked.length }, () => false));

  state.locked = state.locked.map((v, idx) => Boolean(v && state.slots[idx]));
}
function countSelected(slots = state.slots) {
  const counts = {};
  slots.forEach(name => {
    if (!name) return;
    counts[name] = (counts[name] || 0) + 1;
  });
  return counts;
}
function usedCountFor(name, slots = state.slots) { return countSelected(slots)[name] || 0; }
function remainingInventoryExcludingSlot(name, slotIndex) {
  const owned = Number(state.inventory[name] || 0);
  let used = 0;
  state.slots.forEach((slotName, idx) => {
    if (idx === slotIndex) return;
    if (slotName === name) used += 1;
  });
  return Math.max(0, owned - used);
}

function getEmptyTotals() {
  return { health: 0, blood: 0, shock: 0, water: 0, food: 0, radOut: 0, radIn: 0, radBalance: 0, bleedChance: 0, bleedHeal: 0 };
}
function getTotals(slots = state.slots) {
  const totals = getEmptyTotals();
  slots.forEach(name => {
    if (!name) return;
    const art = state.artifactsMap[name];
    if (!art) return;
    totals.health += art.health;
    totals.blood += art.blood;
    totals.shock += art.shock;
    totals.water += art.water;
    totals.food += art.food;
    totals.radOut += art.radOut;
    totals.radIn += art.radIn;
    totals.radBalance += art.radBalance;
    totals.bleedChance += art.bleedChance;
    totals.bleedHeal += art.bleedHeal;
  });
  return totals;
}
function cloneTotals(t) { return { ...t }; }
function addArtToTotals(t, art) {
  totalsMeta.forEach(([key]) => { t[key] += Number(art[key] || 0); });
  return t;
}
function subArtFromTotals(t, art) {
  totalsMeta.forEach(([key]) => { t[key] -= Number(art[key] || 0); });
  return t;
}

function hungerDeficit(t) {
  return Math.max(0, -t.water) + Math.max(0, -t.food);
}
function requiredHealthForHunger(t) {
  return (t.water < 0 || t.food < 0) ? CONFIG.rules.hungryMinHealth : 0;
}
function hasWireEffect(t) {
  return t.bleedHeal >= CONFIG.rules.wireBleedHeal;
}
function desiredBloodTarget(t) {
  return hasWireEffect(t) ? CONFIG.rules.bloodTargetWithWire : CONFIG.rules.bloodTargetDefault;
}
function normalizedBloodScore(t) {
  const target = desiredBloodTarget(t);
  const capped = Math.max(0, Math.min(t.blood, target));
  const base = target > 0 ? capped / target : 1;
  const over = Math.max(0, t.blood - target);
  return clamp(base + Math.min(over / 80, 0.2), 0, 1.2);
}
function canHoldEmission(t) {
  return t.health >= CONFIG.rules.emission.health && t.shock >= CONFIG.rules.emission.shock;
}
function isSafeTotals(t) {
  return t.health >= 0 &&
    t.blood >= 0 &&
    t.shock >= 0 &&
    t.radBalance >= 0 &&
    t.bleedChance <= 0 &&
    t.health >= requiredHealthForHunger(t);
}
function hungryFriendly(t) {
  return t.health >= requiredHealthForHunger(t);
}

function getNeeds(totals) {
  const needs = [];
  const requiredHealth = requiredHealthForHunger(totals);
  if (totals.health < 0) needs.push({ key: 'health', name: 'Здоровье', amount: Math.abs(totals.health) });
  if (totals.health >= 0 && totals.health < requiredHealth) needs.push({ key: 'health', name: 'Здоровье', amount: requiredHealth - totals.health });
  if (totals.blood < 0) needs.push({ key: 'blood', name: 'Кровь', amount: Math.abs(totals.blood) });
  if (totals.shock < 0) needs.push({ key: 'shock', name: 'Шок', amount: Math.abs(totals.shock) });
  if (totals.radBalance < 0) needs.push({ key: 'radBalance', name: 'Баланс радиации', amount: Math.abs(totals.radBalance) });
  if (totals.bleedChance > 0) needs.push({ key: 'antiBleed', name: 'Шанс пореза', amount: totals.bleedChance });
  if (totals.bleedHeal < 0) needs.push({ key: 'bleedHeal', name: 'Лечение пореза', amount: Math.abs(totals.bleedHeal) });

  const hungerAllowed = hungryFriendly(totals);
  if (!hungerAllowed && totals.water < 0) needs.push({ key: 'water', name: 'Вода', amount: Math.abs(totals.water) });
  if (!hungerAllowed && totals.food < 0) needs.push({ key: 'food', name: 'Еда', amount: Math.abs(totals.food) });
  return needs;
}
function contributionForNeed(art, needKey) {
  switch (needKey) {
    case 'health': return Math.max(0, art.health);
    case 'blood': return Math.max(0, art.blood);
    case 'shock': return Math.max(0, art.shock);
    case 'radBalance': return Math.max(0, art.radBalance);
    case 'antiBleed': return Math.max(0, -art.bleedChance);
    case 'bleedHeal': return Math.max(0, art.bleedHeal);
    case 'water': return Math.max(0, art.water);
    case 'food': return Math.max(0, art.food);
    default: return 0;
  }
}
function fishPenaltyFactor(art) {
  return art.isFish ? 0.35 : 1;
}
function getSuggestionsForNeed(need, ownedOnly) {
  const selectedCounts = countSelected();
  const rows = [];
  state.artifacts.forEach(art => {
    if (art.avoidAuto) return;
    const contrib = contributionForNeed(art, need.key);
    if (contrib <= 0) return;
    const remaining = ownedOnly
      ? Math.max(0, Number(state.inventory[art.name] || 0) - (selectedCounts[art.name] || 0))
      : (art.isFish ? Number(state.inventory[art.name] || 0) : (state.planSource === 'all' ? slotsPerBelt(state.beltContainers) : Number(state.inventory[art.name] || 0)));
    if (ownedOnly && remaining <= 0) return;
    const potential = ownedOnly ? contrib * remaining : contrib;
    const comfort = contrib * fishPenaltyFactor(art);
    rows.push({ art, remaining, contrib, potential, score: comfort + potential * 0.15 });
  });
  rows.sort((a, b) => b.score - a.score || b.contrib - a.contrib || a.art.name.localeCompare(b.art.name, 'ru'));
  return rows.slice(0, CONFIG.search.maxSuggestionsPerNeed);
}
function estimateMissing(need) {
  const suggestions = getSuggestionsForNeed(need, false);
  const best = suggestions[0];
  if (!best) return null;
  return { art: best.art, countNeeded: Math.ceil(need.amount / Math.max(best.contrib, 1)) };
}

function artifactInitials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '☢';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase();
}
function artImageUrl(art) {
  return art && art.image ? art.image : 'assets/artifacts/placeholder.png';
}
function attachThumb(el, art, placeholder = '+', className = '') {
  if (!el) return;
  el.innerHTML = '';
  const shell = document.createElement('div');
  shell.className = className || 'thumb-shell';

  const fallback = document.createElement('div');
  fallback.className = 'thumb-fallback';
  fallback.textContent = art ? artifactInitials(art.name) : placeholder;
  shell.appendChild(fallback);

  if (art) {
    const img = new Image();
    img.alt = art.name;
    img.loading = 'lazy';
    img.src = artImageUrl(art);
    img.addEventListener('load', () => shell.classList.add('loaded'));
    img.addEventListener('error', () => shell.classList.add('failed'));
    shell.appendChild(img);
  } else {
    shell.classList.add('failed');
  }

  el.appendChild(shell);
}
function artStatsChips(art) {
  const chips = [];
  const add = (label, value, prefer = null) => {
    if (!value) return;
    const tone = prefer || (value > 0 ? 'pos' : 'neg');
    chips.push(`<span class="stat-chip ${tone}">${label} ${value > 0 ? '+' : ''}${numberToText(value)}</span>`);
  };
  add('ХП', art.health);
  add('Кровь', art.blood, art.blood >= 0 ? (art.blood >= desiredBloodTarget({ bleedHeal: art.bleedHeal, blood: art.blood }) ? 'pos' : 'mid') : 'neg');
  add('Шок', art.shock);
  add('Вода', art.water);
  add('Еда', art.food);
  add('Рад', art.radBalance);
  add('Порез', art.bleedChance, art.bleedChance <= 0 ? 'pos' : 'neg');
  add('Леч.пореза', art.bleedHeal);
  return chips.join('');
}
function artShortSummary(art) {
  const parts = [];
  const push = (label, value) => { if (!value) return; parts.push(`${label} ${value > 0 ? '+' : ''}${numberToText(value)}`); };
  push('ХП', art.health);
  push('Кровь', art.blood);
  push('Шок', art.shock);
  push('Вода', art.water);
  push('Еда', art.food);
  push('Рад', art.radBalance);
  if (art.bleedChance) push('Порез', art.bleedChance);
  if (art.bleedHeal) push('Леч.пореза', art.bleedHeal);
  return parts.join(' • ');
}

function artSlotMetaText(art) {
  const parts = [];
  const add = (label, value) => { if (!value) return; parts.push(`${label} ${value > 0 ? '+' : ''}${numberToText(value)}`); };
  add('ХП', art.health);
  add('Кровь', art.blood);
  add('Шок', art.shock);
  add('Рад', art.radBalance);
  if (parts.length < 3) add('Вода', art.water);
  if (parts.length < 3) add('Еда', art.food);
  if (parts.length < 3) add('Леч.', art.bleedHeal);
  if (parts.length < 3) add('Порез', art.bleedChance);
  return parts.slice(0, 3).join(' • ') || 'Артефакт';
}

function canDragSlot(slotIndex) {
  return Boolean(state.slots[slotIndex]) && !state.locked[slotIndex];
}
function canDropToSlot(sourceIndex, targetIndex) {
  return Number.isInteger(sourceIndex) && Number.isInteger(targetIndex) && sourceIndex !== targetIndex && Boolean(state.slots[sourceIndex]) && !state.locked[sourceIndex] && !state.locked[targetIndex];
}
function clearDragSlotClasses() {
  document.querySelectorAll('.slot-card').forEach(node => node.classList.remove('drag-source', 'drag-target', 'drag-blocked'));
  document.body.classList.remove('dragging-slots');
}
function paintDragTargets(sourceIndex) {
  document.querySelectorAll('.slot-card').forEach(node => {
    const targetIndex = Number(node.dataset.slotIndex);
    node.classList.remove('drag-source', 'drag-target', 'drag-blocked');
    if (!Number.isInteger(targetIndex)) return;
    if (targetIndex === sourceIndex) node.classList.add('drag-source');
    else node.classList.add(canDropToSlot(sourceIndex, targetIndex) ? 'drag-target' : 'drag-blocked');
  });
}
function moveArtifactBetweenSlots(sourceIndex, targetIndex) {
  if (!canDropToSlot(sourceIndex, targetIndex)) return false;
  const sourceValue = state.slots[sourceIndex];
  const targetValue = state.slots[targetIndex];
  state.slots[targetIndex] = sourceValue;
  state.slots[sourceIndex] = targetValue || null;
  saveState();
  return true;
}
function buildStepper(currentValue, onMinus, onPlus) {
  const wrap = document.createElement('div');
  wrap.className = 'qty-stepper';

  const minus = document.createElement('button');
  minus.type = 'button';
  minus.className = 'qty-btn';
  minus.textContent = '−';
  minus.addEventListener('click', onMinus);

  const value = document.createElement('div');
  value.className = 'qty-value';
  value.textContent = String(currentValue);

  const plus = document.createElement('button');
  plus.type = 'button';
  plus.className = 'qty-btn';
  plus.textContent = '+';
  plus.addEventListener('click', onPlus);

  wrap.append(minus, value, plus);
  return wrap;
}

function renderInventory() {
  const q = inventorySearch.value.trim().toLowerCase();
  inventoryList.innerHTML = '';

  const ownedKinds = state.artifacts.filter(art => Number(state.inventory[art.name] || 0) > 0).length;
  inventoryOwnedKinds.textContent = String(ownedKinds);

  const list = state.artifacts.filter(art => {
    if (!q) return true;
    return art.name.toLowerCase().includes(q);
  });
  inventoryVisibleCount.textContent = String(list.length);

  if (!list.length) {
    inventoryList.innerHTML = '<div class="empty-state">Ничего не найдено. Попробуй другой запрос.</div>';
    return;
  }

  list.forEach(art => {
    const qty = Number(state.inventory[art.name] || 0);
    const row = document.createElement('div');
    row.className = 'inventory-item';

    const thumb = document.createElement('div');
    thumb.className = 'inventory-thumb';
    attachThumb(thumb, art, '', 'inventory-thumb');

    const copy = document.createElement('div');
    copy.className = 'inventory-copy';

    const nameRow = document.createElement('div');
    nameRow.className = 'art-name-row';

    const name = document.createElement('div');
    name.className = 'art-name';
    name.textContent = art.name;

    nameRow.append(name);

    const stats = document.createElement('div');
    stats.className = 'art-substats';
    stats.innerHTML = artStatsChips(art);

    copy.append(nameRow, stats);

    const stepper = buildStepper(
      qty,
      () => { state.inventory[art.name] = Math.max(0, qty - 1); saveState(); renderAll(false); },
      () => { state.inventory[art.name] = qty + 1; saveState(); renderAll(false); }
    );

    row.append(thumb, copy, stepper);
    inventoryList.appendChild(row);
  });
}

function slotCanUseArt(name, slotIndex) {
  const art = state.artifactsMap[name];
  if (!art) return false;
  if (state.planSource === 'all' && !art.isFish) return true;
  return remainingInventoryExcludingSlot(name, slotIndex) > 0;
}
function renderBuilder() {
  containersRoot.innerHTML = '';
  const slotCount = slotsPerBelt(state.beltContainers);
  const used = countSelected();
  const filled = state.slots.filter(Boolean).length;
  let ownedUsage = 0;
  Object.entries(used).forEach(([name, qty]) => ownedUsage += Math.min(Number(state.inventory[name] || 0), qty));

  slotCountLabel.textContent = String(slotCount);
  filledCountLabel.textContent = String(filled);
  ownedUsageLabel.textContent = String(ownedUsage);

  for (let containerIdx = 0; containerIdx < state.beltContainers; containerIdx++) {
    const card = document.createElement('div');
    card.className = 'container-card';

    const head = document.createElement('div');
    head.className = 'container-head';
    head.innerHTML = `<div class="container-title">Контейнер ${containerIdx + 1}</div><div class="badge warn">3 слота</div>`;

    const slotsWrap = document.createElement('div');
    slotsWrap.className = 'slots-wrap';

    for (let i = 0; i < CONFIG.belt.slotsPerContainer; i++) {
      const slotIndex = containerIdx * CONFIG.belt.slotsPerContainer + i;
      const slotNode = slotTemplate.content.firstElementChild.cloneNode(true);
      const btn = slotNode.querySelector('.slot-main');
      const icon = slotNode.querySelector('.slot-icon');
      const nameEl = slotNode.querySelector('.slot-name');
      const metaEl = slotNode.querySelector('.slot-meta');
      const lockBtn = slotNode.querySelector('.lock-btn');
      const delBtn = slotNode.querySelector('.remove-btn');
      const artName = state.slots[slotIndex];
      const locked = Boolean(state.locked[slotIndex]);

      slotNode.dataset.slotIndex = String(slotIndex);
      slotNode.classList.toggle('locked', locked);
      slotNode.classList.toggle('empty', !artName);
      slotNode.classList.toggle('can-drag', canDragSlot(slotIndex));

      if (artName && state.artifactsMap[artName]) {
        const art = state.artifactsMap[artName];
        attachThumb(icon, art, '', 'slot-icon');
        nameEl.textContent = art.name;
        metaEl.textContent = artSlotMetaText(art);
      } else {
        attachThumb(icon, null, '+', 'slot-icon');
        nameEl.textContent = 'Пустой слот';
        metaEl.textContent = 'Нажми, чтобы выбрать арт';
      }

      if (artName && state.planSource === 'inventory' && (used[artName] || 0) > Number(state.inventory[artName] || 0)) {
        btn.classList.add('invalid');
      }

      btn.draggable = canDragSlot(slotIndex);
      btn.title = artName ? (locked ? 'Слот зафиксирован' : 'Зажми ЛКМ и перетащи в другой слот') : 'Нажми, чтобы выбрать арт';

      lockBtn.textContent = locked ? '🔒' : '🔓';
      lockBtn.classList.toggle('active', locked);
      lockBtn.title = locked ? 'Снять фиксацию' : 'Зафиксировать';
      delBtn.title = 'Убрать';

      btn.addEventListener('click', () => {
        if (Date.now() < suppressSlotClickUntil) return;
        openPicker(slotIndex);
      });
      btn.addEventListener('dragstart', e => {
        if (!canDragSlot(slotIndex)) {
          e.preventDefault();
          return;
        }
        dragSourceIndex = slotIndex;
        suppressSlotClickUntil = Date.now() + 180;
        document.body.classList.add('dragging-slots');
        paintDragTargets(slotIndex);
        if (e.dataTransfer) {
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/plain', String(slotIndex));
        }
      });
      btn.addEventListener('dragend', () => {
        dragSourceIndex = null;
        setTimeout(() => { suppressSlotClickUntil = 0; clearDragSlotClasses(); }, 0);
      });
      slotNode.addEventListener('dragover', e => {
        if (!canDropToSlot(dragSourceIndex, slotIndex)) return;
        e.preventDefault();
        slotNode.classList.add('drag-target');
        if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
      });
      slotNode.addEventListener('dragleave', () => {
        if (slotIndex !== dragSourceIndex) slotNode.classList.remove('drag-target');
      });
      slotNode.addEventListener('drop', e => {
        if (!canDropToSlot(dragSourceIndex, slotIndex)) return;
        e.preventDefault();
        suppressSlotClickUntil = Date.now() + 220;
        const moved = moveArtifactBetweenSlots(dragSourceIndex, slotIndex);
        dragSourceIndex = null;
        clearDragSlotClasses();
        if (moved) renderAll(false);
      });
      delBtn.addEventListener('click', e => {
        e.stopPropagation();
        state.slots[slotIndex] = null;
        state.locked[slotIndex] = false;
        saveState();
        renderAll();
      });
      lockBtn.addEventListener('click', e => {
        e.stopPropagation();
        if (!state.slots[slotIndex]) return;
        state.locked[slotIndex] = !state.locked[slotIndex];
        saveState();
        renderAll();
      });

      slotsWrap.appendChild(slotNode);
    }

    card.append(head, slotsWrap);
    containersRoot.appendChild(card);
  }
}

function openPicker(slotIndex) {
  state.pickerSlotIndex = slotIndex;
  pickerSearch.value = '';
  pickerOwnedOnly.checked = state.planSource === 'inventory';
  pickerTitle.textContent = `Слот ${slotIndex + 1}: выбор артефакта`;
  pickerModal.classList.remove('hidden');
  pickerModal.setAttribute('aria-hidden', 'false');
  renderPicker();
}
function closePicker() {
  pickerModal.classList.add('hidden');
  pickerModal.setAttribute('aria-hidden', 'true');
  state.pickerSlotIndex = null;
}
function renderPicker() {
  const q = pickerSearch.value.trim().toLowerCase();
  const ownedOnly = pickerOwnedOnly.checked;
  const slotIndex = state.pickerSlotIndex;
  pickerList.innerHTML = '';

  const list = state.artifacts.filter(art => {
    if (q && !art.name.toLowerCase().includes(q)) return false;
    if (ownedOnly && !slotCanUseArt(art.name, slotIndex)) return false;
    return true;
  });

  if (!list.length) {
    pickerList.innerHTML = '<div class="empty-state">Ничего не найдено для этого режима.</div>';
    return;
  }

  list.forEach(art => {
    const remaining = remainingInventoryExcludingSlot(art.name, slotIndex);
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'pick-card';

    const head = document.createElement('div');
    head.className = 'pick-head';

    const thumb = document.createElement('div');
    thumb.className = 'pick-thumb';
    attachThumb(thumb, art, '', 'pick-thumb');

    const name = document.createElement('div');
    name.className = 'pick-name';
    name.textContent = art.name;

    const badge = document.createElement('div');
    badge.className = `badge ${ownedOnly && remaining <= 0 ? 'no' : 'warn'}`;
    badge.textContent = ownedOnly ? `Доступно ${remaining}` : `Есть ${state.inventory[art.name] || 0}`;

    head.append(thumb, name, badge);

    const meta = document.createElement('div');
    meta.className = 'pick-meta';
    meta.innerHTML = artStatsChips(art);

    const footer = document.createElement('div');
    footer.className = 'pick-footer';
    footer.textContent = art.isFish ? 'Рыбка: сильный штраф, берётся только когда реально нужна.' : (art.avoidAuto ? 'Исключён из автосборки.' : 'Доступен для ручного выбора.');

    card.append(head, meta, footer);
    card.addEventListener('click', () => {
      if (ownedOnly && !slotCanUseArt(art.name, slotIndex)) return;
      state.slots[slotIndex] = art.name;
      saveState();
      renderAll();
      closePicker();
    });
    pickerList.appendChild(card);
  });
}

function renderTotals() {
  const totals = getTotals();
  totalsGrid.innerHTML = '';

  totalsMeta.forEach(([key, label]) => {
    const val = totals[key];
    let tone = 'neg';
    if (key === 'bleedChance') tone = val <= 0 ? 'pos' : 'neg';
    else if (key === 'blood') tone = val >= desiredBloodTarget(totals) ? 'pos' : (val >= 0 ? 'mid' : 'neg');
    else tone = val >= 0 ? 'pos' : 'neg';

    const row = document.createElement('div');
    row.className = 'total-row';

    const wrap = document.createElement('div');
    wrap.className = 'total-key-wrap';

    const k = document.createElement('div');
    k.className = 'total-key';
    k.textContent = label;

    const bias = document.createElement('div');
    const targetVal = Number(state.targets[key] || 0);
    bias.className = `total-bias ${biasClass(targetVal)}`;
    bias.textContent = `Приоритет ${priorityIndicator(targetVal)}`;

    const control = document.createElement('div');
    control.className = 'total-control';

    const minus = document.createElement('button');
    minus.type = 'button';
    minus.className = 'total-step';
    minus.textContent = '−';
    minus.addEventListener('click', () => adjustTarget(key, -1));

    const value = document.createElement('div');
    value.className = `total-val ${tone}`;
    value.textContent = signedText(val);

    const plus = document.createElement('button');
    plus.type = 'button';
    plus.className = 'total-step';
    plus.textContent = '+';
    plus.addEventListener('click', () => adjustTarget(key, 1));

    wrap.append(k, bias);
    control.append(minus, value, plus);
    row.append(wrap, control);
    totalsGrid.appendChild(row);
  });

  renderNeeds(getNeeds(totals));
}
function renderNeeds(needs) {
  needsList.innerHTML = '';
  ownedSuggestions.innerHTML = '';
  missingSuggestions.innerHTML = '';

  if (!needs.length) {
    needsList.innerHTML = '<div class="empty-state">Критичных минусов нет.</div>';
    ownedSuggestions.innerHTML = '<div class="empty-state">Из текущего инвентаря ничего добирать не нужно.</div>';
    missingSuggestions.innerHTML = `<div class="empty-state">${state.planSource === 'all' ? 'Режим «Все арты»: можно смотреть только теоретические доборы.' : 'По этой сборке искать ничего не нужно.'}</div>`;
    return;
  }

  needs.forEach(need => {
    const needEl = document.createElement('div');
    needEl.className = 'need-item';
    needEl.innerHTML = `<div class="need-head"><div class="need-name">${need.name}</div><div class="badge no">Нужно ${numberToText(need.amount)}</div></div>`;
    needsList.appendChild(needEl);

    const owned = getSuggestionsForNeed(need, true);
    const ownWrap = document.createElement('div');
    ownWrap.className = 'suggest-item';
    const totalPotential = owned.reduce((sum, x) => sum + x.potential, 0);
    ownWrap.innerHTML = `<div class="suggest-head"><div class="suggest-name">${need.name}</div><div class="badge ${totalPotential >= need.amount ? 'ok' : 'warn'}">${totalPotential >= need.amount ? 'Закрывается' : 'Частично'}</div></div>`;
    if (owned.length) {
      owned.forEach(x => {
        const line = document.createElement('div');
        line.className = 'helper-line';
        line.textContent = `${x.art.name}: +${numberToText(x.contrib)} за слот, доступно ${x.remaining}, максимум ${numberToText(x.potential)}`;
        ownWrap.appendChild(line);
      });
    } else {
      const line = document.createElement('div');
      line.className = 'helper-line';
      line.textContent = 'Из текущего инвентаря сейчас нечем закрыть этот минус.';
      ownWrap.appendChild(line);
    }
    ownedSuggestions.appendChild(ownWrap);

    const missing = estimateMissing(need);
    const missWrap = document.createElement('div');
    missWrap.className = 'suggest-item';
    missWrap.innerHTML = `<div class="suggest-head"><div class="suggest-name">${need.name}</div></div>`;
    const line = document.createElement('div');
    line.className = 'helper-line';
    line.textContent = missing
      ? `Если искать отдельно: ${missing.art.name} ×${missing.countNeeded}.${missing.art.isFish ? ' Рыбка имеет пониженный приоритет.' : ''}`
      : 'Нет подходящих артов в базе.';
    missWrap.appendChild(line);
    missingSuggestions.appendChild(missWrap);
  });
}

function sourceQuantities(slotCount) {
  return state.artifacts.map(art => {
    const invQty = Number(state.inventory[art.name] || 0);
    if (art.isFish) return invQty;
    if (state.planSource === 'all') return slotCount;
    return invQty;
  });
}
function lockedCountsArray() {
  const counts = Array(state.artifacts.length).fill(0);
  state.slots.forEach((name, idx) => {
    if (!name || !state.locked[idx]) return;
    const artIdx = state.artifacts.findIndex(a => a.name === name);
    if (artIdx >= 0) counts[artIdx] += 1;
  });
  return counts;
}
function baseLockedState() {
  const totals = getEmptyTotals();
  let fishCount = 0;
  let riskBleedCount = 0;
  let slotUsage = 0;
  state.slots.forEach((name, idx) => {
    if (!name || !state.locked[idx]) return;
    const art = state.artifactsMap[name];
    if (!art) return;
    addArtToTotals(totals, art);
    if (art.isFish) fishCount += 1;
    if (art.bleedChance > 0) riskBleedCount += 1;
    slotUsage += 1;
  });
  return { totals, fishCount, riskBleedCount, slotUsage };
}
function materializeSlotsFromCounts(counts) {
  const full = state.slots.map((name, idx) => state.locked[idx] ? name : null);
  const freeIndexes = [];
  full.forEach((name, idx) => { if (!name) freeIndexes.push(idx); });

  const items = [];
  const sortable = [];
  counts.forEach((count, idx) => { if (count) sortable.push({ idx, count, name: state.artifacts[idx].name }); });
  sortable.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'ru'));
  sortable.forEach(x => { for (let i = 0; i < x.count; i++) items.push(state.artifacts[x.idx].name); });

  freeIndexes.forEach((slotIdx, i) => { full[slotIdx] = items[i] || null; });
  return full;
}
function signatureFromCounts(counts) {
  return counts.join('|');
}

function normalizedCore(totals) {
  return {
    health: clamp(Math.max(0, totals.health) / 12, 0, 1.5),
    blood: normalizedBloodScore(totals),
    shock: clamp(Math.max(0, totals.shock) / 50, 0, 1.5),
    radBalance: clamp(Math.max(0, totals.radBalance) / 20, 0, 1.5)
  };
}
function balancedCoreScore(totals, slotUsage = 0) {
  const n = normalizedCore(totals);
  const weakest = Math.min(n.health, n.blood, n.shock, n.radBalance);
  const strongest = Math.max(n.health, n.blood, n.shock, n.radBalance);
  const avg = (n.health + n.blood + n.shock + n.radBalance) / 4;
  const cfg = CONFIG.scoring.balanced;
  const spreadPenalty = (strongest - weakest) * cfg.spreadPenalty;
  const bloodTarget = desiredBloodTarget(totals);
  const bloodComfortBase = hasWireEffect(totals) ? cfg.comfort.bloodFloor.withWire : cfg.comfort.bloodFloor.default;
  const comfortBonus =
    Math.max(0, totals.health - cfg.comfort.healthOver.from) * cfg.comfort.healthOver.weight +
    Math.max(0, Math.min(totals.blood, bloodTarget) - bloodComfortBase) * cfg.comfort.bloodFloor.weight +
    Math.max(0, totals.shock - cfg.comfort.shockOver.from) * cfg.comfort.shockOver.weight +
    Math.max(0, totals.radBalance - cfg.comfort.radBalanceOver.from) * cfg.comfort.radBalanceOver.weight +
    (canHoldEmission(totals) ? cfg.comfort.emissionBonus : 0);
  return weakest * cfg.weakestBase + avg * cfg.averageBase - spreadPenalty + comfortBonus + slotUsage * cfg.slotUsageBonus;
}
function penalties(totals, fishCount, riskBleedCount, phase = 'base') {
  const pCfg = CONFIG.scoring.penalties;
  const finalPhase = phase === 'final';
  const waterPenalty = Math.max(0, -totals.water) * (finalPhase ? pCfg.water.final : pCfg.water.base);
  const foodPenalty = Math.max(0, -totals.food) * (finalPhase ? pCfg.food.final : pCfg.food.base);
  const bleedPenalty = Math.max(0, totals.bleedChance) * (finalPhase ? pCfg.bleedChance.final : pCfg.bleedChance.base) +
    Math.max(0, -totals.bleedHeal) * (finalPhase ? pCfg.bleedHeal.final : pCfg.bleedHeal.base);
  const fishPenalty = fishCount * (finalPhase ? pCfg.fish.final : pCfg.fish.base);
  const riskPenalty = riskBleedCount * (finalPhase ? pCfg.riskyBleedArtifact.final : pCfg.riskyBleedArtifact.base);
  const bloodComfortPenalty = Math.max(0, desiredBloodTarget(totals) - totals.blood) * (finalPhase ? pCfg.bloodComfort.final : pCfg.bloodComfort.base);
  const emissionMissPenalty = (!canHoldEmission(totals) && (totals.health >= 7 || totals.shock >= 15)) ? (finalPhase ? pCfg.emissionMiss.final : pCfg.emissionMiss.base) : 0;
  const hardPenalty =
    Math.max(0, -totals.health) * (finalPhase ? pCfg.hard.health.final : pCfg.hard.health.base) +
    Math.max(0, -totals.blood) * (finalPhase ? pCfg.hard.blood.final : pCfg.hard.blood.base) +
    Math.max(0, -totals.shock) * (finalPhase ? pCfg.hard.shock.final : pCfg.hard.shock.base) +
    Math.max(0, -totals.radBalance) * (finalPhase ? pCfg.hard.radBalance.final : pCfg.hard.radBalance.base) +
    Math.max(0, totals.bleedChance) * (finalPhase ? pCfg.hard.bleedChance.final : pCfg.hard.bleedChance.base);
  return { softPenalty: waterPenalty + foodPenalty + bloodComfortPenalty + emissionMissPenalty, bleedPenalty, fishPenalty, riskPenalty, hardPenalty };
}
function targetBonusScore(totals, phase = 'base') {
  const tCfg = CONFIG.scoring.targets;
  const finalPhase = phase === 'final';
  const mult = key => targetScale(state.targets[key] || 0);
  const cappedBlood = Math.min(Math.max(0, totals.blood), desiredBloodTarget(totals));
  return (
    Math.max(0, totals.health) * (finalPhase ? tCfg.health.final : tCfg.health.base) * mult('health') +
    cappedBlood * (finalPhase ? tCfg.blood.final : tCfg.blood.base) * mult('blood') +
    Math.max(0, totals.shock) * (finalPhase ? tCfg.shock.final : tCfg.shock.base) * mult('shock') +
    totals.water * (finalPhase ? tCfg.water.final : tCfg.water.base) * mult('water') +
    totals.food * (finalPhase ? tCfg.food.final : tCfg.food.base) * mult('food') +
    Math.max(0, totals.radOut) * (finalPhase ? tCfg.radOut.final : tCfg.radOut.base) * mult('radOut') +
    (-Math.max(0, totals.radIn)) * (finalPhase ? tCfg.radIn.final : tCfg.radIn.base) * mult('radIn') +
    Math.max(0, totals.radBalance) * (finalPhase ? tCfg.radBalance.final : tCfg.radBalance.base) * mult('radBalance') +
    (-Math.max(0, totals.bleedChance)) * (finalPhase ? tCfg.bleedChance.final : tCfg.bleedChance.base) * mult('bleedChance') +
    Math.max(0, totals.bleedHeal) * (finalPhase ? tCfg.bleedHeal.final : tCfg.bleedHeal.base) * mult('bleedHeal')
  );
}
function scoreByObjective(totals, fishCount, riskBleedCount, objective, slotUsage = 0, phase = 'base') {
  const n = normalizedCore(totals);
  const balance = balancedCoreScore(totals, slotUsage);
  const p = penalties(totals, fishCount, riskBleedCount, phase);
  const emissionBonus = canHoldEmission(totals) ? (phase === 'final' ? CONFIG.scoring.emissionBonus.final : CONFIG.scoring.emissionBonus.base) : 0;
  const targetsBonus = targetBonusScore(totals, phase);
  const common = balance - p.softPenalty - p.bleedPenalty - p.fishPenalty - p.riskPenalty - p.hardPenalty + emissionBonus + targetsBonus;
  const finalPhase = phase === 'final';
  const obj = CONFIG.scoring.objectives;

  switch (objective) {
    case 'health':
      return common + n.health * (finalPhase ? obj.health.primaryNorm.final : obj.health.primaryNorm.base) + totals.health * (finalPhase ? obj.health.primaryRaw.final : obj.health.primaryRaw.base) + n.shock * obj.health.support.shock + n.radBalance * obj.health.support.radBalance + n.blood * obj.health.support.blood;
    case 'blood':
      return common + n.blood * (finalPhase ? obj.blood.primaryNorm.final : obj.blood.primaryNorm.base) + Math.min(totals.blood, desiredBloodTarget(totals)) * (finalPhase ? obj.blood.primaryRaw.final : obj.blood.primaryRaw.base) + n.health * obj.blood.support.health + n.shock * obj.blood.support.shock + n.radBalance * obj.blood.support.radBalance;
    case 'shock':
      return common + n.shock * (finalPhase ? obj.shock.primaryNorm.final : obj.shock.primaryNorm.base) + totals.shock * (finalPhase ? obj.shock.primaryRaw.final : obj.shock.primaryRaw.base) + n.health * obj.shock.support.health + n.blood * obj.shock.support.blood + n.radBalance * obj.shock.support.radBalance;
    case 'radBalance':
      return common + n.radBalance * (finalPhase ? obj.radBalance.primaryNorm.final : obj.radBalance.primaryNorm.base) + totals.radBalance * (finalPhase ? obj.radBalance.primaryRaw.final : obj.radBalance.primaryRaw.base) + n.health * obj.radBalance.support.health + n.blood * obj.radBalance.support.blood + n.shock * obj.radBalance.support.shock;
    case 'water':
      return common + totals.water * (finalPhase ? obj.water.primaryRaw.final : obj.water.primaryRaw.base) + n.health * obj.water.support.health + n.radBalance * obj.water.support.radBalance + n.shock * obj.water.support.shock;
    case 'food':
      return common + totals.food * (finalPhase ? obj.food.primaryRaw.final : obj.food.primaryRaw.base) + n.health * obj.food.support.health + n.radBalance * obj.food.support.radBalance + n.shock * obj.food.support.shock;
    case 'radOut':
      return common + Math.max(0, totals.radOut) * (finalPhase ? obj.radOut.primaryRaw.final : obj.radOut.primaryRaw.base) + n.radBalance * obj.radOut.support.radBalance + n.health * obj.radOut.support.health;
    case 'radIn':
      return common + (-Math.max(0, totals.radIn)) * (finalPhase ? obj.radIn.primaryRaw.final : obj.radIn.primaryRaw.base) + n.radBalance * obj.radIn.support.radBalance + n.health * obj.radIn.support.health;
    case 'bleedHeal':
      return common + Math.max(0, totals.bleedHeal) * (finalPhase ? obj.bleedHeal.primaryRaw.final : obj.bleedHeal.primaryRaw.base) + n.blood * obj.bleedHeal.support.blood + n.health * obj.bleedHeal.support.health;
    case 'bleedChance':
      return common + (-Math.max(0, totals.bleedChance)) * (finalPhase ? obj.bleedHeal.primaryRaw.final : obj.bleedHeal.primaryRaw.base) + n.blood * obj.bleedHeal.support.blood + n.health * obj.bleedHeal.support.health;
    case 'comfort':
      return common + Math.max(0, totals.health) * (finalPhase ? obj.comfort.health.final : obj.comfort.health.base) + Math.max(0, Math.min(totals.blood, desiredBloodTarget(totals))) * (finalPhase ? obj.comfort.blood.final : obj.comfort.blood.base) + Math.max(0, totals.shock) * (finalPhase ? obj.comfort.shock.final : obj.comfort.shock.base) + totals.water * (finalPhase ? obj.comfort.water.final : obj.comfort.water.base) + totals.food * (finalPhase ? obj.comfort.food.final : obj.comfort.food.base) + Math.max(0, totals.radBalance) * (finalPhase ? obj.comfort.radBalance.final : obj.comfort.radBalance.base);
    case 'balanced':
    default:
      return common + n.health * (finalPhase ? obj.balanced.final.health : obj.balanced.base.health) + n.blood * (finalPhase ? obj.balanced.final.blood : obj.balanced.base.blood) + n.shock * (finalPhase ? obj.balanced.final.shock : obj.balanced.base.shock) + n.radBalance * (finalPhase ? obj.balanced.final.radBalance : obj.balanced.base.radBalance) + slotUsage * (finalPhase ? obj.balanced.slotUsage.final : obj.balanced.slotUsage.base);
  }
}
function baseObjectiveScore(totals, fishCount, riskBleedCount, objective, slotUsage = 0) {
  return scoreByObjective(totals, fishCount, riskBleedCount, objective, slotUsage, 'base');
}
function finalObjectiveScore(totals, fishCount, riskBleedCount, objective, slotUsage = 0) {
  return scoreByObjective(totals, fishCount, riskBleedCount, objective, slotUsage, 'final');
}

function goalCheckForVariant(key, cand) {
  const t = cand.totals;
  const strength = Math.abs(Number(state.targets[key] || 0));
  if (!strength) return null;
  switch (key) {
    case 'health': return t.health >= Math.max(requiredHealthForHunger(t) + strength, 3 + Math.max(0, strength - 2));
    case 'blood': {
      const target = desiredBloodTarget(t);
      const ratio = strength === 1 ? 0.7 : strength === 2 ? 0.9 : 1.0;
      return t.blood >= Math.max(50, Math.round(target * ratio));
    }
    case 'shock': return t.shock >= (strength === 1 ? 20 : strength === 2 ? 40 : 60);
    case 'water': return t.water >= (strength === 1 ? -120 : strength === 2 ? -40 : 0);
    case 'food': return t.food >= (strength === 1 ? -120 : strength === 2 ? -40 : 0);
    case 'radOut': return t.radOut >= (strength === 1 ? 70 : strength === 2 ? 110 : 150);
    case 'radIn': return t.radIn <= (strength === 1 ? 60 : strength === 2 ? 35 : 20);
    case 'radBalance': return t.radBalance >= (strength === 1 ? 10 : strength === 2 ? 20 : 35);
    case 'bleedChance': return t.bleedChance <= (strength === 1 ? 0 : strength === 2 ? -50 : -100);
    case 'bleedHeal': return t.bleedHeal >= (strength === 1 ? 40 : strength === 2 ? 80 : 100);
    default: return true;
  }
}
function describeGoalFit(cand) {
  const active = activeTargetEntries();
  if (!active.length) return '';
  const met = [];
  const missed = [];
  active.forEach(([key, value]) => {
    const ok = goalCheckForVariant(key, cand);
    const short = `${targetLabels[key]} ${value > 0 ? '↑' : '↓'}${Math.abs(value)}`;
    if (ok) met.push(short); else missed.push(short);
  });
  return `Выполнено: ${met.length ? met.join(', ') : '—'} | Не дотянуто: ${missed.length ? missed.join(', ') : '—'}`;
}

function getObjectiveList() {
  const set = new Set(['balanced', 'health', 'blood', 'shock', 'radBalance', 'comfort']);
  activeTargetEntries().forEach(([key, value]) => {
    if (Math.abs(value) >= 2 && objectiveKeyMap[key]) set.add(objectiveKeyMap[key]);
  });
  return [...set];
}
function beamSearch(slotCount, objective, beamWidth = CONFIG.search.beamFocused) {
  const qty = sourceQuantities(slotCount);
  const lockedCounts = lockedCountsArray();
  const searchQty = qty.map((owned, idx) => Math.max(0, owned - (lockedCounts[idx] || 0)));
  const base = baseLockedState();
  const freeSlots = Math.max(0, slotCount - base.slotUsage);
  const totalOwnedLeft = searchQty.reduce((a, b) => a + b, 0);
  const maxDepth = Math.min(freeSlots, totalOwnedLeft);

  const initial = {
    counts: Array(state.artifacts.length).fill(0),
    totals: cloneTotals(base.totals),
    fishCount: base.fishCount,
    riskBleedCount: base.riskBleedCount,
    slotUsage: base.slotUsage,
    score: baseObjectiveScore(base.totals, base.fishCount, base.riskBleedCount, objective, base.slotUsage)
  };
  if (maxDepth <= 0) return { all: [initial], lastBeam: [initial] };

  let beam = [initial];
  const all = [initial];

  for (let depth = 0; depth < maxDepth; depth++) {
    const nextMap = new Map();
    beam.forEach(cand => {
      for (let idx = 0; idx < state.artifacts.length; idx++) {
        if ((searchQty[idx] || 0) <= cand.counts[idx]) continue;
        const art = state.artifacts[idx];
        if (art.avoidAuto) continue;
        const counts = cand.counts.slice();
        counts[idx] += 1;
        const totals = cloneTotals(cand.totals);
        addArtToTotals(totals, art);
        const fishCount = cand.fishCount + (art.isFish ? 1 : 0);
        const riskBleedCount = cand.riskBleedCount + (art.bleedChance > 0 ? 1 : 0);
        const slotUsage = cand.slotUsage + 1;
        const score = baseObjectiveScore(totals, fishCount, riskBleedCount, objective, slotUsage);
        const sig = signatureFromCounts(counts);
        const existing = nextMap.get(sig);
        if (!existing || score > existing.score) {
          nextMap.set(sig, { counts, totals, fishCount, riskBleedCount, slotUsage, score });
        }
      }
    });
    beam = [...nextMap.values()].sort((a, b) => b.score - a.score).slice(0, beamWidth);
    all.push(...beam);
    if (!beam.length) break;
  }
  return { all, lastBeam: beam };
}
function multisetDistance(countsA, countsB) {
  let d = 0;
  for (let i = 0; i < countsA.length; i++) d += Math.abs((countsA[i] || 0) - (countsB[i] || 0));
  return d;
}
function hillClimb(candidate, objective) {
  let current = {
    counts: candidate.counts.slice(),
    totals: cloneTotals(candidate.totals),
    fishCount: candidate.fishCount,
    riskBleedCount: candidate.riskBleedCount,
    slotUsage: candidate.slotUsage
  };
  let improved = true;
  let guard = 0;
  const qty = sourceQuantities(slotsPerBelt(state.beltContainers));
  const lockedCounts = lockedCountsArray();
  const searchQty = qty.map((owned, idx) => Math.max(0, owned - (lockedCounts[idx] || 0)));

  while (improved && guard < CONFIG.search.hillClimbIterations) {
    guard += 1;
    improved = false;
    const currentScore = finalObjectiveScore(current.totals, current.fishCount, current.riskBleedCount, objective, current.slotUsage);
    let best = null;

    for (let oldIdx = 0; oldIdx < state.artifacts.length; oldIdx++) {
      if (!current.counts[oldIdx]) continue;
      const oldArt = state.artifacts[oldIdx];
      const baseCounts = current.counts.slice();
      baseCounts[oldIdx] -= 1;
      const baseTotals = cloneTotals(current.totals);
      subArtFromTotals(baseTotals, oldArt);
      const baseFish = current.fishCount - (oldArt.isFish ? 1 : 0);
      const baseRisk = current.riskBleedCount - (oldArt.bleedChance > 0 ? 1 : 0);

      for (let newIdx = 0; newIdx < state.artifacts.length; newIdx++) {
        if (newIdx === oldIdx) continue;
        if (baseCounts[newIdx] >= (searchQty[newIdx] || 0)) continue;
        const newArt = state.artifacts[newIdx];
        if (newArt.avoidAuto) continue;
        const counts = baseCounts.slice();
        counts[newIdx] += 1;
        const totals = cloneTotals(baseTotals);
        addArtToTotals(totals, newArt);
        if (!isSafeTotals(totals)) continue;
        const fishCount = baseFish + (newArt.isFish ? 1 : 0);
        const riskBleedCount = baseRisk + (newArt.bleedChance > 0 ? 1 : 0);
        const score = finalObjectiveScore(totals, fishCount, riskBleedCount, objective, current.slotUsage);
        if (score > currentScore + 1e-6 && (!best || score > best.score)) {
          best = { counts, totals, fishCount, riskBleedCount, slotUsage: current.slotUsage, score };
        }
      }
    }

    if (current.slotUsage < slotsPerBelt(state.beltContainers)) {
      for (let idx = 0; idx < state.artifacts.length; idx++) {
        if (current.counts[idx] >= (searchQty[idx] || 0)) continue;
        const art = state.artifacts[idx];
        if (art.avoidAuto) continue;
        const counts = current.counts.slice();
        counts[idx] += 1;
        const totals = cloneTotals(current.totals);
        addArtToTotals(totals, art);
        if (!isSafeTotals(totals)) continue;
        const fishCount = current.fishCount + (art.isFish ? 1 : 0);
        const riskBleedCount = current.riskBleedCount + (art.bleedChance > 0 ? 1 : 0);
        const slotUsage = current.slotUsage + 1;
        const score = finalObjectiveScore(totals, fishCount, riskBleedCount, objective, slotUsage);
        if (score > currentScore + 1e-6 && (!best || score > best.score)) {
          best = { counts, totals, fishCount, riskBleedCount, slotUsage, score };
        }
      }
    }

    if (best) {
      current = best;
      improved = true;
    }
  }
  return current;
}
function buildCandidatePool(slotCount) {
  const objectives = getObjectiveList();
  const pool = new Map();
  objectives.forEach(obj => {
    const width = obj === 'balanced' ? CONFIG.search.beamBalanced : CONFIG.search.beamFocused;
    const { all } = beamSearch(slotCount, obj, width);
    all.forEach(c => {
      const sig = signatureFromCounts(c.counts);
      const existing = pool.get(sig);
      const score = baseObjectiveScore(c.totals, c.fishCount, c.riskBleedCount, 'balanced', c.slotUsage);
      if (!existing || score > baseObjectiveScore(existing.totals, existing.fishCount, existing.riskBleedCount, 'balanced', existing.slotUsage)) {
        pool.set(sig, c);
      }
    });
  });
  return [...pool.values()];
}
function pickTopBalancedVariants(pool, desired = CONFIG.search.maxVariants) {
  let candidates = pool
    .filter(c => isSafeTotals(c.totals))
    .sort((a, b) => finalObjectiveScore(b.totals, b.fishCount, b.riskBleedCount, 'balanced', b.slotUsage) - finalObjectiveScore(a.totals, a.fishCount, a.riskBleedCount, 'balanced', a.slotUsage));

  const improved = [];
  candidates.slice(0, CONFIG.search.candidateTopSlice).forEach(c => improved.push(hillClimb(c, 'balanced')));

  const merged = new Map();
  [...candidates, ...improved].forEach(c => {
    const sig = signatureFromCounts(c.counts);
    const existing = merged.get(sig);
    const score = finalObjectiveScore(c.totals, c.fishCount, c.riskBleedCount, 'balanced', c.slotUsage);
    if (!existing || score > finalObjectiveScore(existing.totals, existing.fishCount, existing.riskBleedCount, 'balanced', existing.slotUsage)) {
      merged.set(sig, c);
    }
  });

  candidates = [...merged.values()]
    .filter(c => isSafeTotals(c.totals))
    .sort((a, b) => finalObjectiveScore(b.totals, b.fishCount, b.riskBleedCount, 'balanced', b.slotUsage) - finalObjectiveScore(a.totals, a.fishCount, a.riskBleedCount, 'balanced', a.slotUsage));

  const result = [];
  CONFIG.search.diversityThresholds.forEach(threshold => {
    candidates.forEach(c => {
      if (result.length >= desired) return;
      const same = result.some(x => signatureFromCounts(x.counts) === signatureFromCounts(c.counts));
      if (same) return;
      const tooClose = result.some(x => multisetDistance(x.counts, c.counts) <= threshold);
      if (!tooClose) result.push(c);
    });
  });
  return result.slice(0, desired);
}
function getFallbackUnsafeCandidate(slotCount) {
  const pool = buildCandidatePool(slotCount).sort((a, b) => baseObjectiveScore(b.totals, b.fishCount, b.riskBleedCount, 'balanced', b.slotUsage) - baseObjectiveScore(a.totals, a.fishCount, a.riskBleedCount, 'balanced', a.slotUsage));
  return pool[0] || null;
}

function describeVariantReason(cand) {
  const reasons = [];
  const t = cand.totals;

  if (t.health >= Math.max(3, requiredHealthForHunger(t) + 2)) reasons.push('есть хороший запас здоровья');
  else if (t.health >= requiredHealthForHunger(t)) reasons.push('здоровья хватает для выживания');

  if (t.blood >= desiredBloodTarget(t)) reasons.push('полностью закрывает кровь');
  else if (hasWireEffect(t) && t.blood >= CONFIG.rules.bloodTargetWithWire) reasons.push('кровь в норме за счёт проволоки');
  else if (t.blood >= 70) reasons.push('даёт хороший запас по крови');
  else if (t.blood >= 50) reasons.push('кровь выше среднего');

  if (t.shock >= 50) reasons.push('даёт отличный запас по шоку');
  else if (t.shock >= CONFIG.rules.emission.shock) reasons.push('держит шок в хорошем диапазоне');

  if (canHoldEmission(t)) reasons.push('держит выброс');
  if (t.radBalance >= 10) reasons.push('уверенно перекрывает радиацию');
  if (t.bleedChance <= 0) reasons.push('не даёт порезов');
  if (cand.fishCount === 0) reasons.push('без рыбки');
  if (cand.slotUsage < slotsPerBelt(state.beltContainers)) reasons.push('оставляет свободные слоты');

  return reasons.slice(0, 3).join(' • ');
}
function renderVariants() {
  variantsRoot.innerHTML = '';
  const slotCount = slotsPerBelt(state.beltContainers);
  const totalOwned = Object.values(state.inventory).reduce((a, b) => a + Number(b || 0), 0);
  if (!totalOwned && !state.slots.some(Boolean) && state.planSource === 'inventory') {
    variantsRoot.innerHTML = '<div class="empty-state">Сначала заполни инвентарь. После этого появятся безопасные варианты сборок.</div>';
    state.variants = null;
    return;
  }

  const pool = buildCandidatePool(slotCount);
  const safePool = pool.filter(c => isSafeTotals(c.totals));

  if (!safePool.length) {
    const fallback = getFallbackUnsafeCandidate(slotCount);
    let html = '<div class="empty-state">С учётом зафиксированных артов не найдено ни одной безопасной сборки. Автоподбор не предложит билд, который ломает здоровье, кровь, шок, радиацию или даёт положительный шанс пореза.</div>';
    if (fallback) {
      const needs = getNeeds(fallback.totals);
      if (needs.length) {
        html += `<div class="empty-state"><b>Что стоит добрать, чтобы выйти в плюс:</b><br>${needs.map(n => {
          const miss = estimateMissing(n);
          return `${n.name}: нужно ${numberToText(n.amount)}${miss ? `, лучше искать ${miss.art.name} ×${miss.countNeeded}` : ''}`;
        }).join('<br>')}</div>`;
      }
    }
    variantsRoot.innerHTML = html;
    state.variants = null;
    return;
  }

  const variants = pickTopBalancedVariants(pool, CONFIG.search.maxVariants);
  state.variants = { balanced: variants };

  const wrap = document.createElement('div');
  wrap.className = 'variant-group';

  const title = document.createElement('div');
  title.className = 'variant-group-title';
  title.innerHTML = `<div><div class="variant-name">Альтернативные баланс-сборки</div>${describeActiveTargetsShort() ? `<div class="helper-line" style="margin-top:4px">${describeActiveTargetsShort()}</div>` : ''}</div><div class="badge">${state.planSource === 'all' ? 'Все арты' : 'Из инвентаря'}</div>`;
  wrap.appendChild(title);

  const cardsRoot = document.createElement('div');
  cardsRoot.className = 'variant-cards';

  variants.forEach((cand, idx) => {
    const slots = materializeSlotsFromCounts(cand.counts);
    const counts = countSelected(slots);
    const lines = Object.entries(counts)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ru'))
      .map(([name, qty]) => `${name} ×${qty}`)
      .join('<br>');
    const emptySlots = slotCount - cand.slotUsage;
    const lockedUsed = state.locked.filter(Boolean).length;
    const fishUsed = cand.fishCount > 0;

    const card = document.createElement('div');
    card.className = 'variant-card';
    card.innerHTML = `
      <div class="variant-head">
        <div class="variant-name">Вариант ${idx + 1}</div>
        <div class="badge ${fishUsed ? 'warn' : 'ok'}">${fishUsed ? 'Есть рыбка' : 'Без рыбки'}</div>
      </div>
      <div class="variant-stats">
        <span class="stat-chip pos">ХП ${signedText(cand.totals.health)}</span>
        <span class="stat-chip ${cand.totals.blood >= desiredBloodTarget(cand.totals) ? 'pos' : (cand.totals.blood >= 0 ? 'mid' : 'neg')}">Кровь ${signedText(cand.totals.blood)}</span>
        <span class="stat-chip pos">Шок ${signedText(cand.totals.shock)}</span>
        <span class="stat-chip pos">Рад ${signedText(cand.totals.radBalance)}</span>
        <span class="stat-chip ${cand.totals.water >= 0 ? 'pos' : 'neg'}">Вода ${signedText(cand.totals.water)}</span>
        <span class="stat-chip ${cand.totals.food >= 0 ? 'pos' : 'neg'}">Еда ${signedText(cand.totals.food)}</span>
      </div>
      <div class="helper-line">Слотов занято: ${cand.slotUsage}/${slotCount}${emptySlots > 0 ? `, свободно ${emptySlots}` : ''}${lockedUsed ? `, зафиксировано ${lockedUsed}` : ''}</div>
      <div class="reason-line">${describeVariantReason(cand) || 'Сбалансированный безопасный вариант.'}</div>
      ${describeGoalFit(cand) ? `<div class="goal-fit-line">${describeGoalFit(cand)}</div>` : ''}
      <div class="variant-list">${lines || 'Пусто'}</div>
      <div class="variant-actions"><button class="btn tiny primary">Применить</button></div>
    `;
    card.querySelector('button').addEventListener('click', () => {
      state.slots = materializeSlotsFromCounts(cand.counts).slice(0, slotCount);
      while (state.slots.length < slotCount) state.slots.push(null);
      state.locked = state.locked.slice(0, slotCount);
      while (state.locked.length < slotCount) state.locked.push(false);
      saveState();
      renderAll(true);
    });
    cardsRoot.appendChild(card);
  });

  wrap.appendChild(cardsRoot);
  variantsRoot.appendChild(wrap);
}

function applyBestBuild(silent = false) {
  const slotCount = slotsPerBelt(state.beltContainers);
  const pool = buildCandidatePool(slotCount).filter(c => isSafeTotals(c.totals));
  if (!pool.length) {
    if (!silent) alert('Безопасная сборка с учётом зафиксированных артов не найдена. Сначала добери арты, которые закроют здоровье, кровь, шок, радиацию и порезы.');
    renderAll(true);
    return false;
  }
  const best = pickTopBalancedVariants(pool, 1)[0] || pool.sort((a, b) => finalObjectiveScore(b.totals, b.fishCount, b.riskBleedCount, 'balanced', b.slotUsage) - finalObjectiveScore(a.totals, a.fishCount, a.riskBleedCount, 'balanced', a.slotUsage))[0];
  if (!best) {
    if (!silent) alert('Безопасная сборка не найдена.');
    renderAll(true);
    return false;
  }
  state.slots = materializeSlotsFromCounts(best.counts).slice(0, slotCount);
  while (state.slots.length < slotCount) state.slots.push(null);
  state.locked = state.locked.slice(0, slotCount);
  while (state.locked.length < slotCount) state.locked.push(false);
  saveState();
  renderAll(true);
  return true;
}
function clearBuild() {
  state.slots = defaultSlots(state.beltContainers);
  state.locked = defaultLocks(state.beltContainers);
  saveState();
  renderAll();
}

function syncSegmentedControls() {
  [...beltButtons.querySelectorAll('[data-belt]')].forEach(btn => {
    btn.classList.toggle('active', btn.dataset.belt === String(state.beltContainers));
  });
  const labels = {
    1: '1 контейнер (3 слота)',
    2: '2 контейнера (6 слотов)',
    3: '3 контейнера (9 слотов)',
    4: '4 контейнера (12 слотов)',
    5: '5 контейнеров (15 слотов)'
  };
  beltCaption.textContent = labels[state.beltContainers] || '';
  [...planButtons.querySelectorAll('[data-plan]')].forEach(btn => {
    btn.classList.toggle('active', btn.dataset.plan === state.planSource);
  });
}
function renderAll(recomputeVariants = true) {
  ensureSlotsLength();
  syncSegmentedControls();
  renderInventory();
  renderBuilder();
  renderTotals();
  if (recomputeVariants) renderVariants();
}

async function init() {
  try {
    const resp = await fetch('artifacts.json', { cache: 'no-store' });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const artifacts = (await resp.json()).map(normalizeArt);
    artifacts.sort((a, b) => a.name.localeCompare(b.name, 'ru'));
    state.artifacts = artifacts;
    state.artifactsMap = Object.fromEntries(artifacts.map(a => [a.name, a]));
    artifactCountPill.textContent = `Артов: ${artifacts.length}`;

    loadState();
    beltSelect.value = String(state.beltContainers);
    planSourceSelect.value = state.planSource;
    ensureSlotsLength();
    renderAll();
  } catch (error) {
    console.error(error);
    variantsRoot.innerHTML = '<div class="empty-state">Не удалось загрузить artifacts.json. Проверь, что файл лежит рядом с index.html и доступен на GitHub Pages.</div>';
  }
}

document.getElementById('applyBestBtn').addEventListener('click', () => applyBestBuild(false));
document.getElementById('refreshVariantsBtn').addEventListener('click', () => {
  renderAll(true);
  document.querySelector('.variants-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
});
document.getElementById('clearBuildBtn').addEventListener('click', clearBuild);
document.getElementById('openSavesBtn').addEventListener('click', openSavesModal);
document.getElementById('saveBuildPresetBtn').addEventListener('click', saveBuildPreset);
document.getElementById('saveInventoryPresetBtn').addEventListener('click', saveInventoryPreset);
resetTargetsBtn?.addEventListener('click', resetTargets);

beltSelect.addEventListener('change', () => {
  state.beltContainers = clamp(Number(beltSelect.value || 5), CONFIG.belt.minContainers, CONFIG.belt.maxContainers);
  ensureSlotsLength();
  saveState();
  renderAll();
});
planSourceSelect.addEventListener('change', () => {
  state.planSource = planSourceSelect.value === 'all' ? 'all' : 'inventory';
  saveState();
  renderAll();
});

beltButtons.addEventListener('click', e => {
  const btn = e.target.closest('[data-belt]');
  if (!btn) return;
  state.beltContainers = clamp(Number(btn.dataset.belt || 5), CONFIG.belt.minContainers, CONFIG.belt.maxContainers);
  beltSelect.value = String(state.beltContainers);
  ensureSlotsLength();
  saveState();
  renderAll();
});
planButtons.addEventListener('click', e => {
  const btn = e.target.closest('[data-plan]');
  if (!btn) return;
  state.planSource = btn.dataset.plan === 'all' ? 'all' : 'inventory';
  planSourceSelect.value = state.planSource;
  saveState();
  renderAll();
});

inventorySearch.addEventListener('input', () => renderInventory());
pickerSearch.addEventListener('input', () => renderPicker());
pickerOwnedOnly.addEventListener('change', () => renderPicker());
pickerModal.addEventListener('click', e => { if (e.target.dataset.closePicker === '1') closePicker(); });
savesModal?.addEventListener('click', e => { if (e.target.dataset.closeSaves === '1') closeSavesModal(); });
window.addEventListener('beforeunload', saveState);

init();
