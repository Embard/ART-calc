diff --git a/app.js b/app.js
index 8c2eab6d6078312649c23906c64df13d61ee03b5..6cbcb9408d59c25810a0cdd911ac4861cf3f76f6 100644
--- a/app.js
+++ b/app.js
@@ -1,34 +1,36 @@
 
 const state = {
   artifacts: [],
   artifactsMap: {},
+  artifactIndexMap: {},
   inventory: {},
   beltContainers: 5,
   planSource: 'inventory',
   slots: [],
   locked: [],
+  dragSlotIndex: null,
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
@@ -65,124 +67,132 @@ function adjustTarget(key, delta) {
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
-  const strength = Math.abs(Number(state.targets[key] || 0));
+  const raw = Number(state.targets[key] || 0);
+  const strength = Math.abs(raw);
   if (!strength) return null;
-  const up = Number(state.targets[key]) > 0;
+  const up = raw > 0;
 
   switch (key) {
     case 'health':
-      return up ? t.health >= Math.max(requiredHealthForHunger(t) + (strength === 2 ? 3 : 1), 3) : true;
+      return up
+        ? t.health >= Math.max(requiredHealthForHunger(t) + (strength === 2 ? 3 : 1), 3)
+        : t.health <= (strength === 2 ? 3 : 6);
     case 'blood': {
       const target = desiredBloodTarget(t);
-      return up ? t.blood >= (strength === 2 ? target : Math.max(50, Math.round(target * 0.7))) : true;
+      return up
+        ? t.blood >= (strength === 2 ? target : Math.max(50, Math.round(target * 0.7)))
+        : t.blood <= (strength === 2 ? Math.round(target * 0.6) : Math.round(target * 0.9));
     }
     case 'shock':
-      return up ? t.shock >= (strength === 2 ? 50 : 20) : true;
+      return up ? t.shock >= (strength === 2 ? 50 : 20) : t.shock <= (strength === 2 ? 15 : 35);
     case 'water':
-      return up ? t.water >= (strength === 2 ? 0 : -120) : true;
+      return up ? t.water >= (strength === 2 ? 0 : -120) : t.water <= (strength === 2 ? -140 : -60);
     case 'food':
-      return up ? t.food >= (strength === 2 ? 0 : -120) : true;
+      return up ? t.food >= (strength === 2 ? 0 : -120) : t.food <= (strength === 2 ? -140 : -60);
     case 'radOut':
-      return up ? t.radOut >= (strength === 2 ? 150 : 70) : true;
+      return up ? t.radOut >= (strength === 2 ? 150 : 70) : t.radOut <= (strength === 2 ? 30 : 80);
     case 'radIn':
-      return up ? t.radIn <= (strength === 2 ? 20 : 60) : true;
+      return up ? t.radIn <= (strength === 2 ? 20 : 60) : t.radIn >= (strength === 2 ? 90 : 40);
     case 'radBalance':
-      return up ? t.radBalance >= (strength === 2 ? 25 : 10) : true;
+      return up ? t.radBalance >= (strength === 2 ? 25 : 10) : t.radBalance <= (strength === 2 ? 0 : 8);
     case 'bleedChance':
-      return up ? t.bleedChance <= (strength === 2 ? -50 : 0) : true;
+      return up ? t.bleedChance <= (strength === 2 ? -50 : 0) : t.bleedChance >= (strength === 2 ? 20 : 0);
     case 'bleedHeal':
-      return up ? t.bleedHeal >= (strength === 2 ? 100 : 40) : true;
+      return up ? t.bleedHeal >= (strength === 2 ? 100 : 40) : t.bleedHeal <= (strength === 2 ? 10 : 40);
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
+const decisionExplain = document.getElementById('decisionExplain');
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
+const systemStatus = document.getElementById('systemStatus');
 const savesModal = document.getElementById('savesModal');
 const buildPresetNameInput = document.getElementById('buildPresetName');
 const inventoryPresetNameInput = document.getElementById('inventoryPresetName');
 const buildPresetsList = document.getElementById('buildPresetsList');
 const inventoryPresetsList = document.getElementById('inventoryPresetsList');
 const resetTargetsBtn = document.getElementById('resetTargetsBtn');
+let variantsDebounceTimer = null;
 
 
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
 
@@ -534,53 +544,76 @@ function renderTotals() {
 
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
+  renderDecisionExplain(totals);
   renderNeeds(getNeeds(totals));
 }
 
+function renderDecisionExplain(totals) {
+  if (!decisionExplain) return;
+  const strengths = [];
+  if (totals.health > 0) strengths.push(`Здоровье +${totals.health}`);
+  if (totals.blood > 0) strengths.push(`Кровь +${totals.blood}`);
+  if (totals.shock > 0) strengths.push(`Шок +${totals.shock}`);
+  if (totals.radBalance > 0) strengths.push(`Рад-баланс +${totals.radBalance}`);
+  if (totals.bleedChance <= 0) strengths.push('Без роста шанса пореза');
+  if (canHoldEmission(totals)) strengths.push('Держит выброс');
+
+  const risks = [];
+  if (totals.water < 0) risks.push(`Вода ${totals.water}`);
+  if (totals.food < 0) risks.push(`Еда ${totals.food}`);
+  if (totals.radIn > 0) risks.push(`Радиация +${totals.radIn}`);
+
+  decisionExplain.innerHTML = `
+    <div class="subpanel-title">Почему этот билд</div>
+    <div class="helper-line">Плюсы: ${strengths.length ? strengths.slice(0, 4).join(' • ') : 'средние значения без ярко выраженных плюсов'}</div>
+    <div class="helper-line">Риски: ${risks.length ? risks.join(' • ') : 'критичных рисков не обнаружено'}</div>
+  `;
+}
+
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
@@ -646,106 +679,150 @@ function buildStepper(currentValue, onMinus, onPlus) {
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
-      () => { state.inventory[art.name] = Math.max(0, Number(state.inventory[art.name] || 0) - 1); saveState(); renderAll(); },
-      () => { state.inventory[art.name] = Math.max(0, Number(state.inventory[art.name] || 0) + 1); saveState(); renderAll(); }
+      () => { state.inventory[art.name] = Math.max(0, Number(state.inventory[art.name] || 0) - 1); saveState(); renderAll(false); scheduleVariantsRecompute(); },
+      () => { state.inventory[art.name] = Math.max(0, Number(state.inventory[art.name] || 0) + 1); saveState(); renderAll(false); scheduleVariantsRecompute(); }
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
+      btn.draggable = Boolean(artName && !locked);
 
       lockBtn.textContent = locked ? '🔒' : '🔓';
       lockBtn.classList.toggle('active', locked);
       lockBtn.title = locked ? 'Снять фиксацию' : 'Зафиксировать';
       delBtn.title = 'Убрать';
 
+      btn.addEventListener('dragstart', (e) => {
+        if (!state.slots[slotIndex] || state.locked[slotIndex]) {
+          e.preventDefault();
+          return;
+        }
+        state.dragSlotIndex = slotIndex;
+        slot.classList.add('dragging');
+        if (e.dataTransfer) {
+          e.dataTransfer.effectAllowed = 'move';
+          e.dataTransfer.setData('text/plain', String(slotIndex));
+        }
+      });
+      btn.addEventListener('dragend', () => {
+        state.dragSlotIndex = null;
+        containersRoot.querySelectorAll('.slot-card.drag-over,.slot-card.dragging').forEach(el => {
+          el.classList.remove('drag-over', 'dragging');
+        });
+      });
+      btn.addEventListener('dragover', (e) => {
+        const from = state.dragSlotIndex;
+        if (from === null || from === slotIndex || state.locked[slotIndex]) return;
+        e.preventDefault();
+        if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
+        slot.classList.add('drag-over');
+      });
+      btn.addEventListener('dragleave', () => {
+        slot.classList.remove('drag-over');
+      });
+      btn.addEventListener('drop', (e) => {
+        const from = state.dragSlotIndex;
+        slot.classList.remove('drag-over');
+        if (from === null || from === slotIndex || state.locked[slotIndex]) return;
+        e.preventDefault();
+        const moved = state.slots[from];
+        if (!moved) return;
+        const target = state.slots[slotIndex] || null;
+        state.slots[slotIndex] = moved;
+        state.slots[from] = target;
+        state.dragSlotIndex = null;
+        saveState();
+        renderAll();
+      });
+
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
@@ -766,70 +843,69 @@ function renderPicker() {
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
-      if (!state.slots[slotIndex]) state.locked[slotIndex] = false;
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
-    const artIdx = state.artifacts.findIndex(a => a.name === name);
+    const artIdx = state.artifactIndexMap[name];
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
@@ -1238,116 +1314,173 @@ function applyBestBuild(silent = false) {
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
-      btn.classList.toggle('active', btn.dataset.belt === String(state.beltContainers));
+      const active = btn.dataset.belt === String(state.beltContainers);
+      btn.classList.toggle('active', active);
+      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
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
-      btn.classList.toggle('active', btn.dataset.plan === state.planSource);
+      const active = btn.dataset.plan === state.planSource;
+      btn.classList.toggle('active', active);
+      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
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
 
-async function init() {
-  const resp = await fetch('artifacts.json');
-  const artifacts = (await resp.json()).map(normalizeArt);
-  artifacts.sort((a,b) => a.name.localeCompare(b.name, 'ru'));
-  state.artifacts = artifacts;
-  state.artifactsMap = Object.fromEntries(artifacts.map(a => [a.name, a]));
+function scheduleVariantsRecompute() {
+  if (variantsDebounceTimer) clearTimeout(variantsDebounceTimer);
+  variantsDebounceTimer = setTimeout(() => {
+    renderVariants();
+    variantsDebounceTimer = null;
+  }, 220);
+}
 
-  loadState();
-  beltSelect.value = String(state.beltContainers);
-  planSourceSelect.value = state.planSource;
-  ensureSlotsLength();
-  renderAll();
+async function init() {
+  try {
+    const resp = await fetch('artifacts.json');
+    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
+    const artifacts = (await resp.json()).map(normalizeArt);
+    artifacts.sort((a,b) => a.name.localeCompare(b.name, 'ru'));
+    state.artifacts = artifacts;
+    state.artifactsMap = Object.fromEntries(artifacts.map(a => [a.name, a]));
+    state.artifactIndexMap = Object.fromEntries(artifacts.map((a, idx) => [a.name, idx]));
+
+    loadState();
+    beltSelect.value = String(state.beltContainers);
+    planSourceSelect.value = state.planSource;
+    ensureSlotsLength();
+    renderAll();
+    if (systemStatus) {
+      systemStatus.classList.add('hidden');
+      systemStatus.textContent = '';
+    }
+  } catch (err) {
+    console.error('Не удалось загрузить artifacts.json:', err);
+    if (variantsRoot) {
+      variantsRoot.innerHTML = `<div class="empty-state">Ошибка загрузки базы артефактов. Проверь файл <code>artifacts.json</code> и перезагрузи страницу.</div>`;
+    }
+    if (systemStatus) {
+      systemStatus.classList.remove('hidden');
+      systemStatus.innerHTML = `⚠ Ошибка загрузки базы артефактов. Проверь <code>artifacts.json</code> и обнови страницу.`;
+    }
+  }
 }
 
 document.getElementById('applyBestBtn').addEventListener('click', applyBestBuild);
 document.getElementById('refreshVariantsBtn').addEventListener('click', () => {
   renderAll(true);
   document.querySelector('.variants-panel')?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
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
+if (beltButtons) {
+  beltButtons.addEventListener('keydown', (e) => {
+    if (!['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
+    e.preventDefault();
+    const min = 1, max = 5;
+    const delta = e.key === 'ArrowRight' ? 1 : -1;
+    state.beltContainers = Math.max(min, Math.min(max, state.beltContainers + delta));
+    beltSelect.value = String(state.beltContainers);
+    ensureSlotsLength();
+    saveState();
+    renderAll();
+  });
+}
+if (planButtons) {
+  planButtons.addEventListener('keydown', (e) => {
+    if (!['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
+    e.preventDefault();
+    state.planSource = state.planSource === 'inventory' ? 'all' : 'inventory';
+    planSourceSelect.value = state.planSource;
+    saveState();
+    renderAll();
+  });
+}
 
 inventorySearch.addEventListener('input', renderInventory);
 pickerSearch.addEventListener('input', renderPicker);
 pickerOwnedOnly.addEventListener('change', renderPicker);
 pickerModal.addEventListener('click', (e) => { if (e.target.dataset.closePicker === '1') closePicker(); });
 if (savesModal) {
   savesModal.addEventListener('click', (e) => {
     if (e.target.dataset.closeSaves === '1') closeSavesModal();
   });
 }
+window.addEventListener('keydown', (e) => {
+  if (e.key !== 'Escape') return;
+  if (!pickerModal.classList.contains('hidden')) closePicker();
+  if (savesModal && !savesModal.classList.contains('hidden')) closeSavesModal();
+});
 window.addEventListener('beforeunload', saveState);
 
 init();
