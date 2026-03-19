
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

const STORAGE_KEY = 'stalker-build-helper-v23';
const BUILDS_KEY = 'stalker-build-helper-v23-build-presets';
const INVENTORIES_KEY = 'stalker-build-helper-v23-inventory-presets';

const NAME_ALIASES = {
  'Шнурвал': 'Измененный штурвал',
  'Травий': 'Гравий',
  'Золотая Рыбка': 'Золотая рыбка',
  'Джейбк': 'Джейкоб'
};

function canonicalName(name) { return NAME_ALIASES[name] || name; }

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

function biasClass(v) {
  if (v > 0) return 'pos';
  if (v < 0) return 'neg';
  return 'neu';
}
function biasText(v) {
  return v > 0 ? `+${v}` : String(v);
}
function adjustTarget(key, delta) {
  state.targets[key] = Math.max(-2, Math.min(2, Number(state.targets[key] || 0) + delta));
  saveState();
  applyBestBuild(true);
}
function resetTargets() {
  Object.keys(state.targets).forEach(key => state.targets[key] = 0);
  saveState();
  applyBestBuild(true);
}
function targetScale(v) {
  const n = Number(v || 0);
  if (n >= 2) return 5.0;
  if (n === 1) return 2.8;
  if (n === 0) return 1.0;
  if (n === -1) return 0.45;
  return 0.18;
}
function activeTargetEntries() {
  return Object.entries(state.targets).filter(([, value]) => Number(value) !== 0);
}
function describeActiveTargetsShort() {
  const active = activeTargetEntries();
  if (!active.length) return '';
  return active.map(([key, value]) => `${targetLabels[key]} ${value > 0 ? '↑' : '↓'}`).join(' • ');
}
function goalCheckForVariant(key, cand) {
  const t = cand.totals;
  const strength = Math.abs(Number(state.targets[key] || 0));
  if (!strength) return null;
  const up = Number(state.targets[key]) > 0;

  switch (key) {
    case 'health':
      return up ? t.health >= Math.max(requiredHealthForHunger(t) + (strength === 2 ? 3 : 1), 3) : true;
    case 'blood': {
      const target = desiredBloodTarget(t);
      return up ? t.blood >= (strength === 2 ? target : Math.max(50, Math.round(target * 0.7))) : true;
    }
    case 'shock':
      return up ? t.shock >= (strength === 2 ? 50 : 20) : true;
    case 'water':
      return up ? t.water >= (strength === 2 ? 0 : -120) : true;
    case 'food':
      return up ? t.food >= (strength === 2 ? 0 : -120) : true;
    case 'radOut':
      return up ? t.radOut >= (strength === 2 ? 150 : 70) : true;
    case 'radIn':
      return up ? t.radIn <= (strength === 2 ? 20 : 60) : true;
    case 'radBalance':
      return up ? t.radBalance >= (strength === 2 ? 25 : 10) : true;
    case 'bleedChance':
      return up ? t.bleedChance <= (strength === 2 ? -50 : 0) : true;
    case 'bleedHeal':
      return up ? t.bleedHeal >= (strength === 2 ? 100 : 40) : true;
    default:
      return true;
  }
}
function describeGoalFit(cand) {
  const active = activeTargetEntries();
  if (!active.length) return '';
  const met = [];
  const missed = [];
  active.forEach(([key, value]) => {
    const okay = goalCheckForVariant(key, cand);
    const short = `${targetLabels[key]} ${value > 0 ? '↑' : '↓'}`;
    if (okay) met.push(short);
    else missed.push(short);
  });
  const metText = met.length ? `выполнено: ${met.join(', ')}` : 'выполнено: —';
  const missText = missed.length ? `не дотянуто: ${missed.join(', ')}` : 'не дотянуто: —';
  return `${metText} | ${missText}`;
}

const beltSelect = document.getElementById('beltSelect');
const planSourceSelect = document.getElementById('planSourceSelect');
const inventoryList = document.getElementById('inventoryList');
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


function normalizeArt(a) {
  return {
    ...a,
    name: canonicalName(a.name),
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
    isFish: Boolean(a.isFish || canonicalName(a.name).toLowerCase() === 'золотая рыбка'),
    avoidAuto: canonicalName(a.name) === 'Колючка',
    image: a.image || 'assets/artifacts/placeholder.png'
  };
}

function defaultSlots(count) { return Array.from({ length: count * 3 }, () => null); }
function defaultLocks(count) { return Array.from({ length: count * 3 }, () => false); }

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw);

    if (saved.inventory && typeof saved.inventory === 'object') {
      const nextInventory = {};
      Object.entries(saved.inventory).forEach(([name, qty]) => {
        nextInventory[canonicalName(name)] = Number(qty || 0);
      });
      state.inventory = nextInventory;
    }
    if (Number.isInteger(saved.beltContainers) && saved.beltContainers >= 1 && saved.beltContainers <= 5) state.beltContainers = saved.beltContainers;
    if (saved.planSource === 'all' || saved.planSource === 'inventory') state.planSource = saved.planSource;
    if (saved.targets && typeof saved.targets === 'object') {
      Object.keys(state.targets).forEach(key => {
        const raw = Number(saved.targets[key] || 0);
        state.targets[key] = Math.max(-2, Math.min(2, raw));
      });
    }
    if (Array.isArray(saved.slots)) state.slots = saved.slots.map(v => v ? canonicalName(v) : null);
    if (Array.isArray(saved.locked)) state.locked = saved.locked.map(Boolean);
  } catch {}
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    inventory: state.inventory,
    beltContainers: state.beltContainers,
    planSource: state.planSource,
    targets: state.targets,
    slots: state.slots,
    locked: state.locked
  }));
}

function getNamedStore(key) {
  try { return JSON.parse(localStorage.getItem(key) || '{}') || {}; }
  catch { return {}; }
}
function setNamedStore(key, obj) { localStorage.setItem(key, JSON.stringify(obj)); }


function saveBuildPreset() {
  const name = (buildPresetNameInput?.value || '').trim();
  if (!name) return alert('Введи название сборки.');
  const store = getNamedStore(BUILDS_KEY);
  store[name] = {
    beltContainers: state.beltContainers,
    planSource: state.planSource,
    targets: state.targets,
    slots: state.slots,
    locked: state.locked
  };
  setNamedStore(BUILDS_KEY, store);
  if (buildPresetNameInput) buildPresetNameInput.value = '';
  renderSavesModal();
}
function loadBuildPresetByName(name) {
  const store = getNamedStore(BUILDS_KEY);
  if (!store[name]) return;
  const preset = store[name];
  state.beltContainers = (Number.isInteger(preset.beltContainers) && preset.beltContainers >= 1 && preset.beltContainers <= 5) ? preset.beltContainers : 5;
  state.planSource = preset.planSource === 'all' ? 'all' : 'inventory';
  if (preset.targets && typeof preset.targets === 'object') {
    Object.keys(state.targets).forEach(key => {
      const raw = Number(preset.targets[key] || 0);
      state.targets[key] = Math.max(-2, Math.min(2, raw));
    });
  } else {
    Object.keys(state.targets).forEach(key => state.targets[key] = 0);
  }
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
  const store = getNamedStore(BUILDS_KEY);
  delete store[name];
  setNamedStore(BUILDS_KEY, store);
  renderSavesModal();
}
function saveInventoryPreset() {
  const name = (inventoryPresetNameInput?.value || '').trim();
  if (!name) return alert('Введи название инвентаря.');
  const store = getNamedStore(INVENTORIES_KEY);
  store[name] = { inventory: state.inventory };
  setNamedStore(INVENTORIES_KEY, store);
  if (inventoryPresetNameInput) inventoryPresetNameInput.value = '';
  renderSavesModal();
}
function loadInventoryPresetByName(name) {
  const store = getNamedStore(INVENTORIES_KEY);
  if (!store[name]) return;
  const nextInventory = {};
  Object.entries(store[name].inventory || {}).forEach(([k, v]) => nextInventory[canonicalName(k)] = Number(v || 0));
  state.inventory = nextInventory;
  saveState();
  renderAll();
  closeSavesModal();
}
function deleteInventoryPreset(name) {
  const store = getNamedStore(INVENTORIES_KEY);
  delete store[name];
  setNamedStore(INVENTORIES_KEY, store);
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

  const buildStore = getNamedStore(BUILDS_KEY);
  const buildNames = Object.keys(buildStore).sort((a,b)=>a.localeCompare(b,'ru'));
  buildPresetsList.innerHTML = buildNames.length ? '' : '<div class="empty-state">Сборок пока нет.</div>';
  buildNames.forEach(name => {
    const row = document.createElement('div');
    row.className = 'preset-item';
    row.innerHTML = `<div class="preset-name">${name}</div>
      <button class="btn iconish">Загрузить</button>
      <button class="btn iconish">Удалить</button>`;
    const [loadBtn, delBtn] = row.querySelectorAll('button');
    loadBtn.addEventListener('click', () => loadBuildPresetByName(name));
    delBtn.addEventListener('click', () => deleteBuildPreset(name));
    buildPresetsList.appendChild(row);
  });

  const invStore = getNamedStore(INVENTORIES_KEY);
  const invNames = Object.keys(invStore).sort((a,b)=>a.localeCompare(b,'ru'));
  inventoryPresetsList.innerHTML = invNames.length ? '' : '<div class="empty-state">Инвентарей пока нет.</div>';
  invNames.forEach(name => {
    const row = document.createElement('div');
    row.className = 'preset-item';
    row.innerHTML = `<div class="preset-name">${name}</div>
      <button class="btn iconish">Загрузить</button>
      <button class="btn iconish">Удалить</button>`;
    const [loadBtn, delBtn] = row.querySelectorAll('button');
    loadBtn.addEventListener('click', () => loadInventoryPresetByName(name));
    delBtn.addEventListener('click', () => deleteInventoryPreset(name));
    inventoryPresetsList.appendChild(row);
  });
}


function ensureSlotsLength() {
  const wanted = state.beltContainers * 3;
  if (!Array.isArray(state.slots) || state.slots.length === 0) state.slots = defaultSlots(state.beltContainers);
  else if (state.slots.length > wanted) state.slots = state.slots.slice(0, wanted);
  else if (state.slots.length < wanted) state.slots = state.slots.concat(Array.from({ length: wanted - state.slots.length }, () => null));

  if (!Array.isArray(state.locked) || state.locked.length === 0) state.locked = defaultLocks(state.beltContainers);
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

function getTotals(slots = state.slots) {
  const totals = { health:0,blood:0,shock:0,water:0,food:0,radOut:0,radIn:0,radBalance:0,bleedChance:0,bleedHeal:0 };
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
  t.health += art.health; t.blood += art.blood; t.shock += art.shock;
  t.water += art.water; t.food += art.food; t.radOut += art.radOut;
  t.radIn += art.radIn; t.radBalance += art.radBalance;
  t.bleedChance += art.bleedChance; t.bleedHeal += art.bleedHeal;
  return t;
}
function subArtFromTotals(t, art) {
  t.health -= art.health; t.blood -= art.blood; t.shock -= art.shock;
  t.water -= art.water; t.food -= art.food; t.radOut -= art.radOut;
  t.radIn -= art.radIn; t.radBalance -= art.radBalance;
  t.bleedChance -= art.bleedChance; t.bleedHeal -= art.bleedHeal;
  return t;
}

function hungerDeficit(t) {
  return Math.max(0, -t.water) + Math.max(0, -t.food);
}
function requiredHealthForHunger(t) {
  return (t.water < 0 || t.food < 0) ? 1 : 0;
}
function hasWireEffect(t) {
  return t.bleedHeal >= 100;
}
function desiredBloodTarget(t) {
  return hasWireEffect(t) ? 50 : 100;
}
function normalizedBloodScore(t) {
  const target = desiredBloodTarget(t);
  const capped = Math.max(0, Math.min(t.blood, target));
  const base = target > 0 ? capped / target : 1;
  const over = Math.max(0, t.blood - target);
  return clamp(base + Math.min(over / 80, 0.2), 0, 1.2);
}
function canHoldEmission(t) {
  return t.health >= 9 && t.shock >= 20;
}

function isSafeTotals(t) {
  return t.health >= 0 &&
    t.blood >= 0 &&
    t.shock >= 0 &&
    t.radBalance >= 0 &&
    t.bleedChance <= 0 &&
    t.health >= requiredHealthForHunger(t);
}
function hungryFriendly(totals) { return totals.health >= requiredHealthForHunger(totals); }

function getNeeds(totals) {
  const needs = [];
  const requiredHealth = requiredHealthForHunger(totals);
  if (totals.health < 0) needs.push({ key:'health', name:'Здоровье', amount:Math.abs(totals.health) });
  if (totals.health >= 0 && totals.health < requiredHealth) needs.push({ key:'health', name:'Здоровье', amount:requiredHealth - totals.health });
  if (totals.blood < 0) needs.push({ key:'blood', name:'Кровь', amount:Math.abs(totals.blood) });
  if (totals.shock < 0) needs.push({ key:'shock', name:'Шок', amount:Math.abs(totals.shock) });
  if (totals.radBalance < 0) needs.push({ key:'radBalance', name:'Баланс радиации', amount:Math.abs(totals.radBalance) });
  if (totals.bleedChance > 0) needs.push({ key:'antiBleed', name:'Шанс пореза', amount:totals.bleedChance });
  if (totals.bleedHeal < 0) needs.push({ key:'bleedHeal', name:'Лечение пореза', amount:Math.abs(totals.bleedHeal) });

  const hungerAllowed = hungryFriendly(totals);
  if (!hungerAllowed && totals.water < 0) needs.push({ key:'water', name:'Вода', amount:Math.abs(totals.water) });
  if (!hungerAllowed && totals.food < 0) needs.push({ key:'food', name:'Еда', amount:Math.abs(totals.food) });
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
function fishPenaltyFactor(art) { return art.isFish ? 0.35 : 1; }

function getSuggestionsForNeed(need, ownedOnly) {
  const selectedCounts = countSelected();
  const rows = [];
  state.artifacts.forEach(art => {
    if (art.avoidAuto) return;
    const contrib = contributionForNeed(art, need.key);
    if (contrib <= 0) return;
    const remaining = ownedOnly
      ? Math.max(0, Number(state.inventory[art.name] || 0) - (selectedCounts[art.name] || 0))
      : (art.isFish
          ? Number(state.inventory[art.name] || 0)
          : (state.planSource === 'all' ? state.beltContainers * 3 : Number(state.inventory[art.name] || 0)));
    if (ownedOnly && remaining <= 0) return;
    const potential = ownedOnly ? contrib * remaining : contrib;
    rows.push({ art, remaining, contrib, potential, score:(ownedOnly ? potential : contrib) * fishPenaltyFactor(art) });
  });
  rows.sort((a,b) => b.score - a.score || b.contrib - a.contrib || a.art.name.localeCompare(b.art.name, 'ru'));
  return rows.slice(0,5);
}

function estimateMissing(need) {
  const suggestions = getSuggestionsForNeed(need, false);
  const best = suggestions[0];
  if (!best) return null;
  return { art: best.art, countNeeded: Math.ceil(need.amount / Math.max(best.contrib, 1)) };
}


function renderTotals() {
  const totals = getTotals();
  totalsGrid.innerHTML = '';
  totalsMeta.forEach(([key, label]) => {
    const val = totals[key];
    let tone = 'neg';
    if (key === 'bleedChance') tone = val <= 0 ? 'pos' : 'neg';
    else if (key === 'blood') tone = val >= 100 ? 'pos' : (val >= 0 ? 'mid' : 'neg');
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
    bias.textContent = targetVal === 0 ? '0' : (targetVal > 0 ? `↑${targetVal}` : `↓${Math.abs(targetVal)}`);

    const control = document.createElement('div');
    control.className = 'total-control';

    const minus = document.createElement('button');
    minus.type = 'button';
    minus.className = 'total-step';
    minus.textContent = '−';
    minus.addEventListener('click', () => adjustTarget(key, -1));

    const v = document.createElement('div');
    v.className = `total-val ${tone}`;
    v.textContent = `${val > 0 ? '+' : ''}${val}`;

    const plus = document.createElement('button');
    plus.type = 'button';
    plus.className = 'total-step';
    plus.textContent = '+';
    plus.addEventListener('click', () => adjustTarget(key, 1));

    wrap.append(k, bias);
    control.append(minus, v, plus);
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
    needsList.innerHTML = `<div class="empty-state">Критичных минусов нет.</div>`;
    ownedSuggestions.innerHTML = `<div class="empty-state">Ничего дополнительно закрывать не нужно.</div>`;
    missingSuggestions.innerHTML = `<div class="empty-state">${state.planSource === 'all' ? 'Режим «Все арты»: можно смотреть теоретические цели для поиска.' : 'По этой сборке ничего добирать не нужно.'}</div>`;
    return;
  }

  needs.forEach(need => {
    const needEl = document.createElement('div');
    needEl.className = 'need-item';
    needEl.innerHTML = `<div class="need-head"><div class="need-name">${need.name}</div><div class="badge no">Нужно закрыть ${need.amount}</div></div>`;
    needsList.appendChild(needEl);

    const owned = getSuggestionsForNeed(need, true);
    const totalPotential = owned.reduce((sum, x) => sum + x.potential, 0);
    const ownWrap = document.createElement('div');
    ownWrap.className = 'suggest-item';
    ownWrap.innerHTML = `<div class="suggest-head"><div class="suggest-name">${need.name}</div><div class="badge ${totalPotential >= need.amount ? 'ok' : 'no'}">${totalPotential >= need.amount ? 'Закрывается' : 'Не хватает'}</div></div>`;
    if (owned.length) {
      owned.forEach(x => {
        const line = document.createElement('div');
        line.className = 'helper-line';
        line.textContent = `${x.art.name} — +${x.contrib} за слот, доступно ${x.remaining}, максимум закроет ${x.potential}`;
        ownWrap.appendChild(line);
      });
    } else {
      const line = document.createElement('div');
      line.className = 'helper-line';
      line.textContent = 'Из твоего инвентаря сейчас нечем закрыть этот минус.';
      ownWrap.appendChild(line);
    }
    ownedSuggestions.appendChild(ownWrap);

    const missing = estimateMissing(need);
    const missWrap = document.createElement('div');
    missWrap.className = 'suggest-item';
    missWrap.innerHTML = `<div class="suggest-head"><div class="suggest-name">${need.name}</div></div>`;
    const line = document.createElement('div');
    line.className = 'helper-line';
    line.textContent = missing ? `Если искать отдельно: ${missing.art.name} ×${missing.countNeeded}. ${missing.art.isFish ? 'Рыбка имеет низкий приоритет и берётся только когда нормальной замены мало.' : ''}` : 'Нет подходящих артов в базе.';
    missWrap.appendChild(line);
    missingSuggestions.appendChild(missWrap);
  });
}

function artStatsChips(art) {
  const chips = [];
  const add = (label, value) => { if (!value) return; chips.push(`<span class="stat-chip ${value > 0 ? 'pos' : 'neg'}">${label} ${value > 0 ? '+' : ''}${value}</span>`); };
  add('ХП', art.health);
  add('Кровь', art.blood);
  add('Шок', art.shock);
  add('Вода', art.water);
  add('Еда', art.food);
  add('Рад', art.radBalance);
  add('Порез', art.bleedChance);
  add('Леч.пореза', art.bleedHeal);
  return chips.join('');
}
function artImageUrl(art) { return art && art.image ? art.image : 'assets/artifacts/placeholder.png'; }
function setThumb(el, art, placeholder = '+') {
  if (!el) return;
  if (art) {
    el.classList.add('has-image');
    el.innerHTML = `<img src="${artImageUrl(art)}" alt="${art.name}" loading="lazy" />`;
  } else {
    el.classList.remove('has-image');
    el.textContent = placeholder;
  }
}

function buildStepper(currentValue, onMinus, onPlus) {
  const wrap = document.createElement('div');
  wrap.className = 'qty-stepper';
  const minus = document.createElement('button');
  minus.type = 'button'; minus.className = 'qty-btn'; minus.textContent = '−'; minus.addEventListener('click', onMinus);
  const value = document.createElement('div');
  value.className = 'qty-value'; value.textContent = String(currentValue);
  const plus = document.createElement('button');
  plus.type = 'button'; plus.className = 'qty-btn'; plus.textContent = '+'; plus.addEventListener('click', onPlus);
  wrap.append(minus, value, plus);
  return wrap;
}

function renderInventory() {
  const q = inventorySearch.value.trim().toLowerCase();
  inventoryList.innerHTML = '';
  state.artifacts.filter(art => !q || art.name.toLowerCase().includes(q)).forEach(art => {
    const item = document.createElement('div');
    item.className = 'inventory-item';
    const info = document.createElement('div');
    info.className = 'inventory-main';
    const thumb = document.createElement('div');
    thumb.className = 'inventory-thumb';
    setThumb(thumb, art, '');
    const textWrap = document.createElement('div');
    const name = document.createElement('div');
    name.className = 'inventory-name'; name.textContent = art.name;
    const meta = document.createElement('div');
    meta.className = 'inventory-meta'; meta.innerHTML = artStatsChips(art);
    textWrap.append(name, meta);
    info.append(thumb, textWrap);

    const currentQty = Number(state.inventory[art.name] || 0);
    const stepper = buildStepper(
      currentQty,
      () => { state.inventory[art.name] = Math.max(0, Number(state.inventory[art.name] || 0) - 1); saveState(); renderAll(); },
      () => { state.inventory[art.name] = Math.max(0, Number(state.inventory[art.name] || 0) + 1); saveState(); renderAll(); }
    );
    item.append(info, stepper);
    inventoryList.appendChild(item);
  });
}

function slotCanUseArt(name, slotIndex) {
  return state.planSource === 'all' || remainingInventoryExcludingSlot(name, slotIndex) > 0 || state.slots[slotIndex] === name;
}

function renderBuilder() {
  ensureSlotsLength();
  containersRoot.innerHTML = '';
  const slotTemplate = document.getElementById('slotTemplate');
  const used = countSelected();
  if (slotCountLabel) slotCountLabel.textContent = String(state.beltContainers * 3);
  if (filledCountLabel) filledCountLabel.textContent = String(state.slots.filter(Boolean).length);
  if (ownedUsageLabel) ownedUsageLabel.textContent = String(Object.values(used).reduce((a,b)=>a+b,0));

  for (let c = 0; c < state.beltContainers; c++) {
    const card = document.createElement('section');
    card.className = 'container-card';
    card.innerHTML = `<div class="container-head"><div class="container-title">Контейнер на 3 слота</div><div class="pill">Контейнер ${c + 1}</div></div><div class="container-slots"></div>`;
    const slotsWrap = card.querySelector('.container-slots');

    for (let s = 0; s < 3; s++) {
      const slotIndex = c * 3 + s;
      const slot = slotTemplate.content.firstElementChild.cloneNode(true);
      const btn = slot.querySelector('.slot-main');
      const icon = slot.querySelector('.slot-icon');
      const nameEl = slot.querySelector('.slot-name');
      const lockBtn = slot.querySelector('.lock-btn');
      const delBtn = slot.querySelector('.remove-btn');
      const artName = state.slots[slotIndex];
      const locked = Boolean(state.locked[slotIndex]);

      if (locked) slot.classList.add('locked');

      if (artName && state.artifactsMap[artName]) {
        const art = state.artifactsMap[artName];
        setThumb(icon, art, '');
        nameEl.innerHTML = `<div>${art.name}</div><div class="muted small">${artStatsChips(art)}</div>`;
      } else {
        setThumb(icon, null, '+');
        nameEl.textContent = 'Выбрать арт';
      }

      if (artName && (used[artName] || 0) > Number(state.inventory[artName] || 0) && state.planSource === 'inventory') btn.classList.add('invalid');

      lockBtn.textContent = locked ? '🔒' : '🔓';
      lockBtn.classList.toggle('active', locked);
      lockBtn.setAttribute('aria-pressed', locked ? 'true' : 'false');
      lockBtn.title = locked ? 'Снять фиксацию' : 'Зафиксировать';
      delBtn.title = 'Убрать';

      btn.addEventListener('click', () => openPicker(slotIndex));
      delBtn.addEventListener('click', () => {
        state.slots[slotIndex] = null; state.locked[slotIndex] = false; saveState(); renderAll();
      });
      lockBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!state.slots[slotIndex]) return;
        state.locked[slotIndex] = !state.locked[slotIndex];
        saveState(); renderAll();
      });

      slotsWrap.appendChild(slot);
    }
    containersRoot.appendChild(card);
  }
}

function openPicker(slotIndex) {
  state.pickerSlotIndex = slotIndex;
  pickerSearch.value = '';
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
  pickerList.innerHTML = '';
  const slotIndex = state.pickerSlotIndex;

  const list = state.artifacts.filter(art => {
    if (q && !art.name.toLowerCase().includes(q)) return false;
    if (ownedOnly && !slotCanUseArt(art.name, slotIndex)) return false;
    return true;
  });

  if (!list.length) {
    pickerList.innerHTML = `<div class="empty-state">Ничего не найдено.</div>`;
    return;
  }

  list.forEach(art => {
    const remaining = remainingInventoryExcludingSlot(art.name, slotIndex);
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'pick-card';
    card.innerHTML = `
      <div class="pick-head">
        <div class="pick-thumb"><img src="${artImageUrl(art)}" alt="${art.name}" loading="lazy" /></div>
        <div class="pick-name">${art.name}</div>
        <div class="badge">${ownedOnly ? `Доступно ${remaining}` : `Есть ${state.inventory[art.name] || 0}`}</div>
      </div>
      <div class="pick-meta">${artStatsChips(art)}</div>
      <div class="pick-footer"><span>${art.isFish ? 'Рыбка: сильный штраф в подборе' : 'Обычный приоритет'}</span></div>
    `;
    card.addEventListener('click', () => {
      if (ownedOnly && !slotCanUseArt(art.name, slotIndex)) return;
      state.slots[slotIndex] = art.name;
      if (!state.slots[slotIndex]) state.locked[slotIndex] = false;
      saveState(); renderAll(); closePicker();
    });
    pickerList.appendChild(card);
  });
}

function sourceQuantities(slotCount) {
  return state.artifacts.map(a => {
    const invQty = Number(state.inventory[a.name] || 0);
    if (a.isFish) return invQty;
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
  const totals = { health:0,blood:0,shock:0,water:0,food:0,radOut:0,radIn:0,radBalance:0,bleedChance:0,bleedHeal:0 };
  let fishCount = 0, riskBleedCount = 0, slotUsage = 0;
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
  sortable.sort((a,b) => b.count - a.count || a.name.localeCompare(b.name, 'ru'));
  sortable.forEach(x => { for (let i = 0; i < x.count; i++) items.push(state.artifacts[x.idx].name); });
  freeIndexes.forEach((slotIdx, i) => { full[slotIdx] = items[i] || null; });
  return full;
}
function signatureFromCounts(counts) { return counts.join('|'); }
function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

function normalizedCore(totals) {
  const bloodNorm = normalizedBloodScore(totals);
  return {
    health: clamp(Math.max(0, totals.health) / 12, 0, 1.5),
    blood: bloodNorm,
    shock: clamp(Math.max(0, totals.shock) / 50, 0, 1.5),
    radBalance: clamp(Math.max(0, totals.radBalance) / 20, 0, 1.5)
  };
}
function balancedCoreScore(totals, slotUsage = 0) {
  const n = normalizedCore(totals);
  const weakest = Math.min(n.health, n.blood, n.shock, n.radBalance);
  const strongest = Math.max(n.health, n.blood, n.shock, n.radBalance);
  const avg = (n.health + n.blood + n.shock + n.radBalance) / 4;
  const spreadPenalty = (strongest - weakest) * 12000;
  const bloodTarget = desiredBloodTarget(totals);
  const bloodComfortBase = hasWireEffect(totals) ? 35 : 70;
  const comfortBonus =
    Math.max(0, totals.health - 8) * 220 +
    Math.max(0, Math.min(totals.blood, bloodTarget) - bloodComfortBase) * 55 +
    Math.max(0, totals.shock - 20) * 70 +
    Math.max(0, totals.radBalance - 10) * 55 +
    (canHoldEmission(totals) ? 2600 : 0);
  return weakest * 52000 + avg * 15000 - spreadPenalty + comfortBonus + slotUsage * 4;
}
function penalties(totals, fishCount, riskBleedCount, phase='base') {
  const waterPenalty = Math.max(0, -totals.water);
  const foodPenalty = Math.max(0, -totals.food);
  const bleedPenalty = Math.max(0, totals.bleedChance) * (phase === 'final' ? 160 : 24) + Math.max(0, -totals.bleedHeal) * (phase === 'final' ? 45 : 8);
  const fishPenalty = fishCount * (phase === 'final' ? 16000 : 2200);
  const riskPenalty = riskBleedCount * (phase === 'final' ? 8000 : 1200);
  const bloodTarget = desiredBloodTarget(totals);
  const bloodComfortPenalty = Math.max(0, bloodTarget - totals.blood) * (phase === 'final' ? 95 : 11);
  const emissionMissPenalty = (!canHoldEmission(totals) && (totals.health >= 7 || totals.shock >= 15)) ? (phase === 'final' ? 1400 : 180) : 0;
  const softPenalty = waterPenalty * (phase === 'final' ? 0.8 : 0.15) + foodPenalty * (phase === 'final' ? 0.8 : 0.15) + bloodComfortPenalty + emissionMissPenalty;
  const hardPenalty =
    Math.max(0, -totals.health) * (phase === 'final' ? 250000 : 15000) +
    Math.max(0, -totals.blood) * (phase === 'final' ? 180000 : 12000) +
    Math.max(0, -totals.shock) * (phase === 'final' ? 160000 : 10000) +
    Math.max(0, -totals.radBalance) * (phase === 'final' ? 170000 : 11000) +
    Math.max(0, totals.bleedChance) * (phase === 'final' ? 120000 : 9000);
  return { softPenalty, bleedPenalty, fishPenalty, riskPenalty, hardPenalty };
}

function targetBonusScore(totals, phase='base') {
  const bloodTarget = desiredBloodTarget(totals);
  const cappedBlood = Math.min(Math.max(0, totals.blood), bloodTarget);
  const mult = (base, key) => base * targetScale(state.targets[key] || 0);
  return (
    Math.max(0, totals.health) * mult(phase === 'final' ? 680 : 82, 'health') +
    cappedBlood * mult(phase === 'final' ? 82 : 9.5, 'blood') +
    Math.max(0, totals.shock) * mult(phase === 'final' ? 95 : 11, 'shock') +
    totals.water * mult(phase === 'final' ? 34 : 4.2, 'water') +
    totals.food * mult(phase === 'final' ? 34 : 4.2, 'food') +
    Math.max(0, totals.radOut) * mult(phase === 'final' ? 40 : 4.8, 'radOut') +
    (-Math.max(0, totals.radIn)) * mult(phase === 'final' ? 40 : 4.8, 'radIn') +
    Math.max(0, totals.radBalance) * mult(phase === 'final' ? 140 : 16, 'radBalance') +
    (-Math.max(0, totals.bleedChance)) * mult(phase === 'final' ? 62 : 7.2, 'bleedChance') +
    Math.max(0, totals.bleedHeal) * mult(phase === 'final' ? 56 : 6.0, 'bleedHeal')
  );
}
function scoreByObjective(totals, fishCount, riskBleedCount, objective, slotUsage=0, phase='base') {
  const n = normalizedCore(totals);
  const balance = balancedCoreScore(totals, slotUsage);
  const p = penalties(totals, fishCount, riskBleedCount, phase);
  const emissionBonus = canHoldEmission(totals) ? (phase === 'final' ? 3200 : 380) : 0;
  const targetsBonus = targetBonusScore(totals, phase);
  const common = balance - p.softPenalty - p.bleedPenalty - p.fishPenalty - p.riskPenalty - p.hardPenalty + emissionBonus + targetsBonus;

  switch (objective) {
    case 'health':
      return common + n.health * (phase === 'final' ? 9000 : 1200) + totals.health * (phase === 'final' ? 220 : 28) + n.shock * 700 + n.radBalance * 700 + n.blood * 400;
    case 'blood':
      return common + n.blood * (phase === 'final' ? 8000 : 1050) + Math.min(totals.blood, desiredBloodTarget(totals)) * (phase === 'final' ? 85 : 10) + n.health * 700 + n.shock * 650 + n.radBalance * 650;
    case 'shock':
      return common + n.shock * (phase === 'final' ? 9000 : 1200) + totals.shock * (phase === 'final' ? 120 : 15) + n.health * 800 + n.blood * 550 + n.radBalance * 650;
    case 'radBalance':
      return common + n.radBalance * (phase === 'final' ? 9000 : 1200) + totals.radBalance * (phase === 'final' ? 120 : 16) + n.health * 800 + n.blood * 550 + n.shock * 650;
    case 'balanced':
    default:
      return common + n.health * (phase === 'final' ? 7600 : 980) + n.blood * (phase === 'final' ? 7000 : 900) + n.shock * (phase === 'final' ? 7000 : 900) + n.radBalance * (phase === 'final' ? 7600 : 980) + slotUsage * (phase === 'final' ? 3 : 1);
  }
}
function baseObjectiveScore(totals, fishCount, riskBleedCount, objective, slotUsage=0) { return scoreByObjective(totals, fishCount, riskBleedCount, objective, slotUsage, 'base'); }
function finalObjectiveScore(totals, fishCount, riskBleedCount, objective, slotUsage=0) { return scoreByObjective(totals, fishCount, riskBleedCount, objective, slotUsage, 'final'); }

function beamSearch(slotCount, objective, beamWidth=260) {
  const qty = sourceQuantities(slotCount);
  const lockedCounts = lockedCountsArray();
  const searchQty = qty.map((owned, idx) => Math.max(0, owned - (lockedCounts[idx] || 0)));
  const base = baseLockedState();
  const freeSlots = Math.max(0, slotCount - base.slotUsage);
  const totalOwnedLeft = searchQty.reduce((a,b) => a+b, 0);
  const maxDepth = Math.min(freeSlots, totalOwnedLeft);

  const initial = {
    counts: Array(state.artifacts.length).fill(0),
    totals: cloneTotals(base.totals),
    fishCount: base.fishCount,
    riskBleedCount: base.riskBleedCount,
    slotUsage: base.slotUsage,
    score: baseObjectiveScore(base.totals, base.fishCount, base.riskBleedCount, objective, base.slotUsage)
  };
  if (maxDepth <= 0) return { all:[initial], lastBeam:[initial] };

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
    beam = [...nextMap.values()].sort((a,b) => b.score - a.score).slice(0, beamWidth);
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
  const qty = sourceQuantities(state.beltContainers * 3);
  const lockedCounts = lockedCountsArray();
  const searchQty = qty.map((owned, idx) => Math.max(0, owned - (lockedCounts[idx] || 0)));

  while (improved && guard < 35) {
    guard += 1;
    improved = false;
    const currentScore = finalObjectiveScore(current.totals, current.fishCount, current.riskBleedCount, objective, current.slotUsage);
    let best = null;

    for (let oldIdx = 0; oldIdx < current.counts.length; oldIdx++) {
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

    if (current.slotUsage < state.beltContainers * 3) {
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
  const objectives = ['balanced', 'health', 'blood', 'shock', 'radBalance'];
  const pool = new Map();
  objectives.forEach(obj => {
    const { all } = beamSearch(slotCount, obj, obj === 'balanced' ? 340 : 260);
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

function pickTopBalancedVariants(pool, desired = 5) {
  let candidates = pool
    .filter(c => isSafeTotals(c.totals))
    .sort((a,b) => finalObjectiveScore(b.totals, b.fishCount, b.riskBleedCount, 'balanced', b.slotUsage) - finalObjectiveScore(a.totals, a.fishCount, a.riskBleedCount, 'balanced', a.slotUsage));

  const improved = [];
  candidates.slice(0, 64).forEach(c => improved.push(hillClimb(c, 'balanced')));

  const merged = new Map();
  [...candidates, ...improved].forEach(c => {
    const sig = signatureFromCounts(c.counts);
    const existing = merged.get(sig);
    const sc = finalObjectiveScore(c.totals, c.fishCount, c.riskBleedCount, 'balanced', c.slotUsage);
    if (!existing || sc > finalObjectiveScore(existing.totals, existing.fishCount, existing.riskBleedCount, 'balanced', existing.slotUsage)) {
      merged.set(sig, c);
    }
  });

  candidates = [...merged.values()]
    .filter(c => isSafeTotals(c.totals))
    .sort((a,b) => finalObjectiveScore(b.totals, b.fishCount, b.riskBleedCount, 'balanced', b.slotUsage) - finalObjectiveScore(a.totals, a.fishCount, a.riskBleedCount, 'balanced', a.slotUsage));

  const result = [];
  const thresholds = [4, 2, 0];
  thresholds.forEach(threshold => {
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
  const pool = buildCandidatePool(slotCount).sort((a,b) => baseObjectiveScore(b.totals, b.fishCount, b.riskBleedCount, 'balanced', b.slotUsage) - baseObjectiveScore(a.totals, a.fishCount, a.riskBleedCount, 'balanced', a.slotUsage));
  return pool[0] || null;
}


function describeVariantReason(cand) {
  const reasons = [];
  const t = cand.totals;

  if (t.health >= Math.max(3, requiredHealthForHunger(t) + 2)) reasons.push('есть хороший запас здоровья');
  else if (t.health >= requiredHealthForHunger(t)) reasons.push('здоровья хватает для выживания');

  if (t.blood >= 100) reasons.push('полностью закрывает кровь');
  else if (hasWireEffect(t) && t.blood >= 50) reasons.push('кровь в норме за счёт проволоки');
  else if (t.blood >= 70) reasons.push('даёт хороший запас по крови');
  else if (t.blood >= 50) reasons.push('кровь выше среднего');

  if (t.shock >= 50) reasons.push('даёт отличный запас по шоку');
  else if (t.shock >= 20) reasons.push('держит шок в хорошем диапазоне');

  if (canHoldEmission(t)) reasons.push('держит выброс');
  if (t.radBalance >= 10) reasons.push('уверенно перекрывает радиацию');
  if (t.bleedChance <= 0) reasons.push('не даёт порезов');
  if (cand.fishCount === 0) reasons.push('без рыбки');
  if (cand.slotUsage < state.beltContainers * 3) reasons.push('оставляет свободные слоты');

  return reasons.slice(0, 3).join(' • ');
}

function renderVariants() {
  variantsRoot.innerHTML = '';
  const slotCount = state.beltContainers * 3;
  const totalOwned = Object.values(state.inventory).reduce((a, b) => a + Number(b || 0), 0);
  if (!totalOwned && !state.slots.some(Boolean) && state.planSource === 'inventory') {
    variantsRoot.innerHTML = `<div class="empty-state">Сначала заполни инвентарь. После этого появятся сбалансированные варианты сборок.</div>`;
    state.variants = null;
    return;
  }

  const pool = buildCandidatePool(slotCount);
  const safePool = pool.filter(c => isSafeTotals(c.totals));

  if (!safePool.length) {
    const fallback = getFallbackUnsafeCandidate(slotCount);
    let html = `<div class="empty-state">С учётом зафиксированных артов не найдено ни одной безопасной сборки. Сайт не будет предлагать билд, который ломает здоровье / кровь / шок / радиацию / даёт положительный шанс пореза.</div>`;
    if (fallback) {
      const needs = getNeeds(fallback.totals);
      if (needs.length) {
        html += `<div class="empty-state"><b>Что стоит добрать, чтобы выйти в плюс:</b><br>${needs.map(n => {
          const miss = estimateMissing(n);
          return `${n.name}: нужно ${n.amount}${miss ? `, лучше искать ${miss.art.name} ×${miss.countNeeded}` : ''}`;
        }).join('<br>')}</div>`;
      }
    }
    variantsRoot.innerHTML = html;
    state.variants = null;
    return;
  }

  const variants = pickTopBalancedVariants(pool, 5);
  state.variants = { balanced: variants };

  const wrap = document.createElement('div');
  wrap.className = 'variant-group';
  const activeTargetsText = describeActiveTargetsShort();
  wrap.innerHTML = `<div class="variant-group-title"><div><div class="variant-name">Альтернативные баланс-сборки</div>${activeTargetsText ? `<div class="helper-line" style="margin-top:4px">${activeTargetsText}</div>` : ''}</div><div class="badge">${state.planSource === 'all' ? 'Все арты' : 'Из инвентаря'}</div></div><div class="variant-cards"></div>`;
  const cardsRoot = wrap.querySelector('.variant-cards');

  variants.forEach((cand, idx) => {
    const slots = materializeSlotsFromCounts(cand.counts);
    const fishUsed = cand.fishCount > 0;
    const counts = countSelected(slots);
    const lines = Object.entries(counts).sort((a,b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ru')).map(([name, qty]) => `${name} ×${qty}`).join('<br>');
    const emptySlots = slotCount - cand.slotUsage;
    const lockedUsed = state.locked.filter(Boolean).length;
    const card = document.createElement('div');
    card.className = 'variant-card';
    card.innerHTML = `
      <div class="variant-head">
        <div class="variant-name">Вариант ${idx + 1}</div>
        <div class="badge ${fishUsed ? 'no' : 'ok'}">${fishUsed ? 'Есть рыбка' : 'Без рыбки'}</div>
      </div>
      <div class="variant-stats">
        <span class="stat-chip pos">ХП ${cand.totals.health > 0 ? '+' : ''}${cand.totals.health}</span>
        <span class="stat-chip ${cand.totals.blood >= 100 ? 'pos' : (cand.totals.blood >= 0 ? 'mid' : 'neg')}">Кровь ${cand.totals.blood > 0 ? '+' : ''}${cand.totals.blood}</span>
        <span class="stat-chip pos">Шок ${cand.totals.shock > 0 ? '+' : ''}${cand.totals.shock}</span>
        <span class="stat-chip pos">Рад ${cand.totals.radBalance > 0 ? '+' : ''}${cand.totals.radBalance}</span>
        <span class="stat-chip ${cand.totals.water >= 0 ? 'pos' : 'neg'}">Вода ${cand.totals.water > 0 ? '+' : ''}${cand.totals.water}</span>
        <span class="stat-chip ${cand.totals.food >= 0 ? 'pos' : 'neg'}">Еда ${cand.totals.food > 0 ? '+' : ''}${cand.totals.food}</span>
      </div>
      <div class="helper-line">Слотов занято: ${cand.slotUsage}/${slotCount}${emptySlots > 0 ? `, свободно ${emptySlots}` : ''}${lockedUsed ? `, зафиксировано ${lockedUsed}` : ''}</div>
      <div class="reason-line">${describeVariantReason(cand)}</div>
      ${describeGoalFit(cand) ? `<div class="goal-fit-line">${describeGoalFit(cand)}</div>` : ''}
      <div class="variant-list">${lines}</div>
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

  variantsRoot.appendChild(wrap);
}

function applyBestBuild(silent = false) {
  const slotCount = state.beltContainers * 3;
  const pool = buildCandidatePool(slotCount).filter(c => isSafeTotals(c.totals));
  if (!pool.length) {
    if (!silent) alert('Безопасная сборка с учётом зафиксированных артов не найдена. Сначала добери арты, которые закроют здоровье / кровь / шок / радиацию / порезы.');
    renderAll(true);
    return false;
  }
  const best = pickTopBalancedVariants(pool, 1)[0] || pool.sort((a,b) => finalObjectiveScore(b.totals, b.fishCount, b.riskBleedCount, 'balanced', b.slotUsage) - finalObjectiveScore(a.totals, a.fishCount, a.riskBleedCount, 'balanced', a.slotUsage))[0];
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
  if (beltButtons) {
    [...beltButtons.querySelectorAll('[data-belt]')].forEach(btn => {
      btn.classList.toggle('active', btn.dataset.belt === String(state.beltContainers));
    });
  }
  if (beltCaption) {
    const labels = {
      1:'1 контейнер (3 слота)',
      2:'2 контейнера (6 слотов)',
      3:'3 контейнера (9 слотов)',
      4:'4 контейнера (12 слотов)',
      5:'5 контейнеров (15 слотов)'
    };
    beltCaption.textContent = labels[state.beltContainers] || '';
  }
  if (planButtons) {
    [...planButtons.querySelectorAll('[data-plan]')].forEach(btn => {
      btn.classList.toggle('active', btn.dataset.plan === state.planSource);
    });
  }
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
  const resp = await fetch('artifacts.json');
  const artifacts = (await resp.json()).map(normalizeArt);
  artifacts.sort((a,b) => a.name.localeCompare(b.name, 'ru'));
  state.artifacts = artifacts;
  state.artifactsMap = Object.fromEntries(artifacts.map(a => [a.name, a]));

  loadState();
  beltSelect.value = String(state.beltContainers);
  planSourceSelect.value = state.planSource;
  ensureSlotsLength();
  renderAll();
}

document.getElementById('applyBestBtn').addEventListener('click', applyBestBuild);
document.getElementById('refreshVariantsBtn').addEventListener('click', () => {
  renderAll(true);
  document.querySelector('.variants-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
});
document.getElementById('clearBuildBtn').addEventListener('click', clearBuild);
document.getElementById('openSavesBtn').addEventListener('click', openSavesModal);
document.getElementById('saveBuildPresetBtn').addEventListener('click', saveBuildPreset);
document.getElementById('saveInventoryPresetBtn').addEventListener('click', saveInventoryPreset);
if (resetTargetsBtn) resetTargetsBtn.addEventListener('click', resetTargets);
beltSelect.addEventListener('change', () => { state.beltContainers = Number(beltSelect.value); ensureSlotsLength(); saveState(); renderAll(); });
planSourceSelect.addEventListener('change', () => { state.planSource = planSourceSelect.value === 'all' ? 'all' : 'inventory'; saveState(); renderAll(); });

if (beltButtons) {
  beltButtons.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-belt]');
    if (!btn) return;
    state.beltContainers = Number(btn.dataset.belt);
    beltSelect.value = String(state.beltContainers);
    ensureSlotsLength();
    saveState();
    renderAll();
  });
}
if (planButtons) {
  planButtons.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-plan]');
    if (!btn) return;
    state.planSource = btn.dataset.plan === 'all' ? 'all' : 'inventory';
    planSourceSelect.value = state.planSource;
    saveState();
    renderAll();
  });
}

inventorySearch.addEventListener('input', renderInventory);
pickerSearch.addEventListener('input', renderPicker);
pickerOwnedOnly.addEventListener('change', renderPicker);
pickerModal.addEventListener('click', (e) => { if (e.target.dataset.closePicker === '1') closePicker(); });
if (savesModal) {
  savesModal.addEventListener('click', (e) => {
    if (e.target.dataset.closeSaves === '1') closeSavesModal();
  });
}
window.addEventListener('beforeunload', saveState);

init();
