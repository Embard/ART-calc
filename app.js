const state = {
  artifacts: [],
  artifactsMap: {},
  inventory: {},
  beltContainers: 5,
  slots: [],
  pickerSlotIndex: null
};

const STORAGE_KEY = 'stalker-build-helper-v1';

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

const beltSelect = document.getElementById('beltSelect');
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

function normalizeArt(a) {
  return {
    ...a,
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
    isFish: Boolean(a.isFish)
  };
}

function defaultSlots(count) {
  return Array.from({ length: count * 3 }, () => null);
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw);
    if (saved.inventory && typeof saved.inventory === 'object') state.inventory = saved.inventory;
    if (saved.beltContainers === 4 || saved.beltContainers === 5) state.beltContainers = saved.beltContainers;
    if (Array.isArray(saved.slots)) state.slots = saved.slots;
  } catch {}
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    inventory: state.inventory,
    beltContainers: state.beltContainers,
    slots: state.slots
  }));
}

function ensureSlotsLength() {
  const wanted = state.beltContainers * 3;
  if (!Array.isArray(state.slots) || state.slots.length === 0) {
    state.slots = defaultSlots(state.beltContainers);
  } else if (state.slots.length > wanted) {
    state.slots = state.slots.slice(0, wanted);
  } else if (state.slots.length < wanted) {
    state.slots = state.slots.concat(Array.from({ length: wanted - state.slots.length }, () => null));
  }
}

function countSelected() {
  const counts = {};
  state.slots.forEach(name => {
    if (!name) return;
    counts[name] = (counts[name] || 0) + 1;
  });
  return counts;
}

function remainingInventory(name) {
  const owned = Number(state.inventory[name] || 0);
  const used = countSelected()[name] || 0;
  return Math.max(0, owned - used);
}

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
  const totals = {
    health: 0, blood: 0, shock: 0, water: 0, food: 0,
    radOut: 0, radIn: 0, radBalance: 0, bleedChance: 0, bleedHeal: 0
  };
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

function hungryFriendly(totalHealth) {
  return totalHealth > 0;
}

function getNeeds(totals) {
  const needs = [];
  if (totals.health < 0) needs.push({ key: 'health', name: 'Здоровье', amount: Math.abs(totals.health) });
  if (totals.blood < 0) needs.push({ key: 'blood', name: 'Кровь', amount: Math.abs(totals.blood) });
  if (totals.shock < 0) needs.push({ key: 'shock', name: 'Шок', amount: Math.abs(totals.shock) });
  if (totals.radBalance < 0) needs.push({ key: 'radBalance', name: 'Баланс радиации', amount: Math.abs(totals.radBalance) });
  if (totals.bleedChance > 0) needs.push({ key: 'antiBleed', name: 'Шанс пореза', amount: totals.bleedChance });
  if (totals.bleedHeal < 0) needs.push({ key: 'bleedHeal', name: 'Лечение пореза', amount: Math.abs(totals.bleedHeal) });

  const hungerAllowed = hungryFriendly(totals.health);
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

function fishPenalty(art) {
  return art.isFish ? 0.35 : 1;
}

function getSuggestionsForNeed(need, ownedOnly) {
  const selectedCounts = countSelected();
  const rows = [];
  state.artifacts.forEach(art => {
    const contrib = contributionForNeed(art, need.key);
    if (contrib <= 0) return;
    const remaining = ownedOnly
      ? Math.max(0, Number(state.inventory[art.name] || 0) - (selectedCounts[art.name] || 0))
      : Number(state.inventory[art.name] || 0);
    if (ownedOnly && remaining <= 0) return;

    const potential = ownedOnly ? contrib * remaining : contrib;
    rows.push({
      art,
      remaining,
      contrib,
      potential,
      score: (ownedOnly ? potential : contrib) * fishPenalty(art)
    });
  });

  rows.sort((a, b) => b.score - a.score || b.contrib - a.contrib || a.art.name.localeCompare(b.art.name, 'ru'));
  return rows.slice(0, 5);
}

function estimateMissing(need) {
  const suggestions = getSuggestionsForNeed(need, false);
  const best = suggestions[0];
  if (!best) return null;
  const countNeeded = Math.ceil(need.amount / Math.max(best.contrib, 1));
  return {
    art: best.art,
    countNeeded
  };
}

function renderTotals() {
  const totals = getTotals();
  totalsGrid.innerHTML = '';
  totalsMeta.forEach(([key, label]) => {
    const val = totals[key];
    const rowKey = document.createElement('div');
    rowKey.className = 'total-key';
    rowKey.textContent = label;

    const rowVal = document.createElement('div');
    rowVal.className = 'total-val';
    let positive = null;
    if (key === 'bleedChance') positive = val <= 0;
    else positive = val >= 0;
    rowVal.classList.add(positive ? 'pos' : 'neg');
    rowVal.textContent = `${val > 0 ? '+' : ''}${val}`;

    totalsGrid.appendChild(rowKey);
    totalsGrid.appendChild(rowVal);
  });

  const needs = getNeeds(totals);
  renderNeeds(needs, totals);
}

function renderNeeds(needs, totals) {
  needsList.innerHTML = '';
  ownedSuggestions.innerHTML = '';
  missingSuggestions.innerHTML = '';

  const hungerAllowed = hungryFriendly(totals.health);

  if (needs.length === 0) {
    needsList.innerHTML = `<div class="empty-state">Сборка выглядит жизнеспособной. ${hungerAllowed ? 'Минус вода/еда допустимы, пока здоровье в плюсе.' : ''}</div>`;
    ownedSuggestions.innerHTML = `<div class="empty-state">Критичных дыр нет.</div>`;
    missingSuggestions.innerHTML = `<div class="empty-state">Ничего специально искать не нужно.</div>`;
    return;
  }

  needs.forEach(need => {
    const needEl = document.createElement('div');
    needEl.className = 'need-item';
    needEl.innerHTML = `
      <div class="need-head">
        <div class="need-name">${need.name}</div>
        <div class="badge no">Нужно ${need.amount}</div>
      </div>
    `;
    needsList.appendChild(needEl);

    const owned = getSuggestionsForNeed(need, true);
    const totalPotential = owned.reduce((sum, x) => sum + x.potential, 0);

    const ownWrap = document.createElement('div');
    ownWrap.className = 'suggest-item';
    ownWrap.innerHTML = `
      <div class="suggest-head">
        <div class="suggest-name">${need.name}</div>
        <div class="badge ${totalPotential >= need.amount ? 'ok' : 'no'}">${totalPotential >= need.amount ? 'Закрывается' : 'Не хватает'}</div>
      </div>
    `;
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
    if (missing) {
      line.textContent = `Если искать отдельно: ${missing.art.name} ×${missing.countNeeded}. ${missing.art.isFish ? 'Рыбка специально занижена по приоритету и берётся только когда других сильных вариантов мало.' : ''}`;
    } else {
      line.textContent = 'Нет подходящих артов в базе.';
    }
    missWrap.appendChild(line);
    missingSuggestions.appendChild(missWrap);
  });
}

function artStatsChips(art) {
  const chips = [];
  const add = (label, value) => {
    if (!value) return;
    chips.push(`<span class="stat-chip ${value > 0 ? 'pos' : 'neg'}">${label} ${value > 0 ? '+' : ''}${value}</span>`);
  };
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

function renderInventory() {
  const q = inventorySearch.value.trim().toLowerCase();
  inventoryList.innerHTML = '';
  state.artifacts
    .filter(art => !q || art.name.toLowerCase().includes(q))
    .forEach(art => {
      const item = document.createElement('div');
      item.className = 'inventory-item';
      item.innerHTML = `
        <div>
          <div class="inventory-name">${art.name}</div>
          <div class="inventory-meta">${artStatsChips(art)}</div>
        </div>
      `;
      const input = document.createElement('input');
      input.className = 'inventory-qty';
      input.type = 'number';
      input.min = '0';
      input.step = '1';
      input.value = Number(state.inventory[art.name] || 0);
      input.addEventListener('change', () => {
        state.inventory[art.name] = Math.max(0, parseInt(input.value || '0', 10));
        saveState();
        renderAll();
      });
      item.appendChild(input);
      inventoryList.appendChild(item);
    });
}

function initialFor(name) {
  return name.split(/\s+/).slice(0,2).map(x => x[0]).join('').toUpperCase();
}

function slotCanUseArt(name, slotIndex) {
  return remainingInventoryExcludingSlot(name, slotIndex) > 0;
}

function renderBuilder() {
  ensureSlotsLength();
  containersRoot.innerHTML = '';
  const slotTemplate = document.getElementById('slotTemplate');
  const used = countSelected();
  slotCountLabel.textContent = String(state.beltContainers * 3);
  filledCountLabel.textContent = String(state.slots.filter(Boolean).length);
  ownedUsageLabel.textContent = String(Object.values(used).reduce((a,b)=>a+b,0));

  for (let c = 0; c < state.beltContainers; c++) {
    const card = document.createElement('section');
    card.className = 'container-card';
    card.innerHTML = `
      <div class="container-head">
        <div class="container-title">Ясной контейнер для артефактов на 3 слота</div>
        <div class="pill">Контейнер ${c + 1}</div>
      </div>
      <div class="container-slots"></div>
    `;
    const slotsWrap = card.querySelector('.container-slots');
    for (let s = 0; s < 3; s++) {
      const slotIndex = c * 3 + s;
      const slot = slotTemplate.content.firstElementChild.cloneNode(true);
      const btn = slot.querySelector('.slot-main');
      const icon = slot.querySelector('.slot-icon');
      const nameEl = slot.querySelector('.slot-name');
      const dupBtn = slot.querySelector('.duplicate-btn');
      const delBtn = slot.querySelector('.remove-btn');
      const artName = state.slots[slotIndex];
      if (artName && state.artifactsMap[artName]) {
        const art = state.artifactsMap[artName];
        icon.textContent = initialFor(art.name);
        nameEl.innerHTML = `<div>${art.name}</div><div class="muted small">${artStatsChips(art)}</div>`;
      } else {
        icon.textContent = '+';
        nameEl.textContent = 'Выбрать арт';
      }

      btn.addEventListener('click', () => openPicker(slotIndex));
      delBtn.addEventListener('click', () => {
        state.slots[slotIndex] = null;
        saveState();
        renderAll();
      });
      dupBtn.addEventListener('click', () => {
        if (!artName) return;
        const freeIndex = state.slots.findIndex((x, idx) => idx !== slotIndex && !x);
        if (freeIndex === -1) return alert('Свободных слотов нет.');
        if (!slotCanUseArt(artName, freeIndex)) {
          return alert('Этого арта в инвентаре больше нет.');
        }
        state.slots[freeIndex] = artName;
        saveState();
        renderAll();
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
        <div class="pick-name">${art.name}</div>
        <div class="badge">${ownedOnly ? `Доступно ${remaining}` : `Есть ${state.inventory[art.name] || 0}`}</div>
      </div>
      <div class="pick-meta">${artStatsChips(art)}</div>
      <div class="pick-footer">
        <span>${art.isFish ? 'Рыбка: низкий приоритет' : 'Обычный приоритет'}</span>
      </div>
    `;
    card.addEventListener('click', () => {
      if (ownedOnly && remaining <= 0) return;
      state.slots[slotIndex] = art.name;
      saveState();
      renderAll();
      closePicker();
    });
    pickerList.appendChild(card);
  });
}

function scoreArtifactForBuild(art, totals) {
  const weights = {
    health: totals.health < 0 ? 7.5 : 2.8,
    blood: totals.blood < 0 ? 5.5 : 2.6,
    shock: totals.shock < 0 ? 5.5 : 2.5,
    radBalance: totals.radBalance < 0 ? 6.5 : 2.5,
    bleedHeal: totals.bleedHeal < 0 ? 4.5 : 1.6,
    antiBleed: totals.bleedChance > 0 ? 5.0 : 1.6,
    water: totals.health > 0 ? 0.25 : 1.1,
    food: totals.health > 0 ? 0.25 : 1.1
  };
  const antiBleed = Math.max(0, -art.bleedChance);
  let score = 0;
  score += art.health * weights.health;
  score += art.blood * weights.blood;
  score += art.shock * weights.shock;
  score += art.radBalance * weights.radBalance;
  score += art.bleedHeal * weights.bleedHeal;
  score += antiBleed * weights.antiBleed;
  score += art.water * weights.water;
  score += art.food * weights.food;

  // Penalties for hard negatives
  if (art.health < 0) score += art.health * 1.8;
  if (art.blood < 0) score += art.blood * 1.5;
  if (art.shock < 0) score += art.shock * 1.5;
  if (art.radBalance < 0) score += art.radBalance * 1.8;
  if (art.bleedChance > 0) score -= art.bleedChance * 1.2;

  // Fish exists, but prefer alternatives when possible
  if (art.isFish) score -= 18;

  return score;
}

function autoBuild() {
  const slotCount = state.beltContainers * 3;
  const inventoryEntries = Object.entries(state.inventory).filter(([, qty]) => Number(qty) > 0);
  if (!inventoryEntries.length) {
    alert('Сначала заполни лист инвентаря на сайте: сколько у тебя есть артов.');
    return;
  }

  const remaining = {};
  inventoryEntries.forEach(([name, qty]) => remaining[name] = Number(qty));
  const nextSlots = Array(slotCount).fill(null);
  let totals = getTotals(nextSlots);

  for (let i = 0; i < slotCount; i++) {
    let best = null;
    for (const art of state.artifacts) {
      if ((remaining[art.name] || 0) <= 0) continue;
      const score = scoreArtifactForBuild(art, totals);
      if (!best || score > best.score) {
        best = { art, score };
      }
    }
    if (!best) break;
    nextSlots[i] = best.art.name;
    remaining[best.art.name] -= 1;
    totals = getTotals(nextSlots);
  }

  state.slots = nextSlots;
  saveState();
  renderAll();
}

function clearBuild() {
  state.slots = defaultSlots(state.beltContainers);
  saveState();
  renderAll();
}

function renderAll() {
  ensureSlotsLength();
  renderInventory();
  renderBuilder();
  renderTotals();
}

async function init() {
  const resp = await fetch('artifacts.json');
  const artifacts = (await resp.json()).map(normalizeArt);
  artifacts.sort((a, b) => a.name.localeCompare(b.name, 'ru'));
  state.artifacts = artifacts;
  state.artifactsMap = Object.fromEntries(artifacts.map(a => [a.name, a]));

  loadState();
  beltSelect.value = String(state.beltContainers);
  ensureSlotsLength();
  renderAll();
}

document.getElementById('autoBuildBtn').addEventListener('click', autoBuild);
document.getElementById('clearBuildBtn').addEventListener('click', clearBuild);
document.getElementById('saveStateBtn').addEventListener('click', () => {
  saveState();
  alert('Сохранено локально в браузере.');
});
beltSelect.addEventListener('change', () => {
  state.beltContainers = Number(beltSelect.value);
  ensureSlotsLength();
  saveState();
  renderAll();
});
inventorySearch.addEventListener('input', renderInventory);
pickerSearch.addEventListener('input', renderPicker);
pickerOwnedOnly.addEventListener('change', renderPicker);
pickerModal.addEventListener('click', (e) => {
  if (e.target.dataset.closePicker === '1') closePicker();
});

window.addEventListener('beforeunload', saveState);
init();
