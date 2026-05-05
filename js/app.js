import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signInAnonymously
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
  getDatabase,
  ref,
  onValue,
  runTransaction,
  remove,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-database.js";
import { firebaseConfig } from "./firebase-config.js";

const MOSCOW_TIME_ZONE = "Europe/Moscow";
const PLAYER_NAME_STORAGE_KEY = "labscheduler_player_name";

const DUNGEONS = [
  { id: "x1", name: "Х1" },
  { id: "x2", name: "Х2" },
  { id: "x3", name: "Х3" },
  { id: "arena", name: "Арена" },
  { id: "labyrinth", name: "Лабиринт" }
];

const TIME_SLOTS = [
  { id: "00-03", label: "00:00–03:00", startHour: 0, endHour: 3 },
  { id: "03-06", label: "03:00–06:00", startHour: 3, endHour: 6 },
  { id: "06-09", label: "06:00–09:00", startHour: 6, endHour: 9 },
  { id: "09-12", label: "09:00–12:00", startHour: 9, endHour: 12 },
  { id: "12-15", label: "12:00–15:00", startHour: 12, endHour: 15 },
  { id: "15-18", label: "15:00–18:00", startHour: 15, endHour: 18 },
  { id: "18-21", label: "18:00–21:00", startHour: 18, endHour: 21 },
  { id: "21-00", label: "21:00–00:00", startHour: 21, endHour: 24 }
];

// false — нельзя записываться в уже завершившиеся слоты текущего дня по МСК.
// true — можно выбирать любой слот текущего дня.
const ALLOW_PAST_SLOTS = false;

const els = {
  todayDate: document.getElementById("todayDate"),
  moscowTime: document.getElementById("moscowTime"),
  connectionStatus: document.getElementById("connectionStatus"),
  setupWarning: document.getElementById("setupWarning"),
  signupForm: document.getElementById("signupForm"),
  playerName: document.getElementById("playerName"),
  dungeonSelect: document.getElementById("dungeonSelect"),
  slotSelect: document.getElementById("slotSelect"),
  signupButton: document.getElementById("signupButton"),
  messageBox: document.getElementById("messageBox"),
  scheduleGrid: document.getElementById("scheduleGrid"),
  refreshButton: document.getElementById("refreshButton")
};

let app;
let auth;
let db;
let currentUser = null;
let currentMskDateKey = getMoscowDateKey();
let unsubscribeSchedule = null;
let latestDayData = null;

initStaticUi();
initClock();
initFirebase();

function initStaticUi() {
  DUNGEONS.forEach((dungeon) => {
    const option = document.createElement("option");
    option.value = dungeon.id;
    option.textContent = dungeon.name;
    els.dungeonSelect.appendChild(option);
  });

  renderSlotOptions();
  els.playerName.value = localStorage.getItem(PLAYER_NAME_STORAGE_KEY) || "";

  els.playerName.addEventListener("input", () => {
    localStorage.setItem(PLAYER_NAME_STORAGE_KEY, normalizeName(els.playerName.value));
  });

  els.signupForm.addEventListener("submit", handleSignupSubmit);
  els.refreshButton.addEventListener("click", () => subscribeToToday(true));
}

function initClock() {
  updateMoscowClock();
  setInterval(() => {
    const previousDateKey = currentMskDateKey;
    updateMoscowClock();
    renderSlotOptions();

    if (previousDateKey !== currentMskDateKey) {
      showMessage("Начался новый день по МСК. Расписание обновлено.", "success");
      subscribeToToday(true);
    }
  }, 15000);
}

function initFirebase() {
  if (!isFirebaseConfigured()) {
    setConnectionStatus("Нужно настроить Firebase", "error");
    els.setupWarning.classList.remove("hidden");
    els.signupButton.disabled = true;
    renderEmptySchedule("Firebase ещё не настроен.");
    return;
  }

  try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getDatabase(app);

    onAuthStateChanged(auth, (user) => {
      currentUser = user;
      if (user) {
        setConnectionStatus("Онлайн", "ok");
        els.signupButton.disabled = false;
        subscribeToToday(false);
      }
    });

    signInAnonymously(auth).catch((error) => {
      console.error(error);
      setConnectionStatus("Ошибка входа", "error");
      showMessage("Не удалось подключиться к Firebase Authentication. Проверь настройки проекта.", "error");
      els.signupButton.disabled = true;
    });
  } catch (error) {
    console.error(error);
    setConnectionStatus("Ошибка Firebase", "error");
    showMessage("Firebase не запустился. Проверь js/firebase-config.js.", "error");
    els.signupButton.disabled = true;
  }
}

function subscribeToToday(forceMessage) {
  if (!db) return;

  if (unsubscribeSchedule) {
    unsubscribeSchedule();
    unsubscribeSchedule = null;
  }

  const todayRef = ref(db, `days/${currentMskDateKey}/dungeons`);
  unsubscribeSchedule = onValue(
    todayRef,
    (snapshot) => {
      latestDayData = snapshot.val() || {};
      renderSchedule(latestDayData);
      if (forceMessage) {
        showMessage("Расписание обновлено.", "success");
      }
    },
    (error) => {
      console.error(error);
      setConnectionStatus("Ошибка базы", "error");
      showMessage("Не удалось загрузить расписание. Проверь правила Realtime Database.", "error");
    }
  );
}

async function handleSignupSubmit(event) {
  event.preventDefault();

  if (!currentUser || !db) {
    showMessage("Сначала дождись подключения к базе.", "error");
    return;
  }

  const name = normalizeName(els.playerName.value);
  const dungeonId = els.dungeonSelect.value;
  const slotId = els.slotSelect.value;
  const dungeon = DUNGEONS.find((item) => item.id === dungeonId);
  const slot = TIME_SLOTS.find((item) => item.id === slotId);

  if (!name || name.length < 2) {
    showMessage("Введи имя минимум из 2 символов.", "error");
    return;
  }

  if (!dungeon || !slot) {
    showMessage("Выбери данж и время.", "error");
    return;
  }

  if (!ALLOW_PAST_SLOTS && isSlotFinished(slot)) {
    showMessage("Этот слот уже закончился по МСК. Выбери другое время.", "error");
    renderSlotOptions();
    return;
  }

  const userSignupRef = ref(db, `days/${currentMskDateKey}/dungeons/${dungeonId}/signups/${currentUser.uid}`);
  els.signupButton.disabled = true;

  try {
    const result = await runTransaction(userSignupRef, (currentData) => {
      if (currentData !== null) {
        return;
      }

      return {
        uid: currentUser.uid,
        name,
        dungeonId,
        dungeonName: dungeon.name,
        slot: slot.id,
        slotLabel: slot.label,
        createdAt: serverTimestamp()
      };
    });

    if (!result.committed) {
      showMessage(`Ты уже записан на ${dungeon.name} сегодня. Сначала удали старую запись.`, "error");
      return;
    }

    localStorage.setItem(PLAYER_NAME_STORAGE_KEY, name);
    showMessage(`Готово: ${name} записан на ${dungeon.name}, ${slot.label} по МСК.`, "success");
  } catch (error) {
    console.error(error);
    showMessage("Запись не сохранилась. Проверь подключение и правила базы.", "error");
  } finally {
    els.signupButton.disabled = false;
  }
}

async function deleteOwnSignup(dungeonId) {
  if (!currentUser || !db) {
    showMessage("Нет подключения к базе.", "error");
    return;
  }

  const dungeon = DUNGEONS.find((item) => item.id === dungeonId);
  const userSignupRef = ref(db, `days/${currentMskDateKey}/dungeons/${dungeonId}/signups/${currentUser.uid}`);

  try {
    await remove(userSignupRef);
    showMessage(`Запись на ${dungeon ? dungeon.name : "данж"} удалена.`, "success");
  } catch (error) {
    console.error(error);
    showMessage("Не удалось удалить запись. Можно удалять только свою запись.", "error");
  }
}

function renderSchedule(dayData) {
  els.scheduleGrid.innerHTML = "";

  DUNGEONS.forEach((dungeon) => {
    const signupsObject = dayData?.[dungeon.id]?.signups || {};
    const signups = Object.values(signupsObject).filter(Boolean);
    const signupsBySlot = groupSignupsBySlot(signups);

    const card = document.createElement("article");
    card.className = "dungeon-card";

    const header = document.createElement("div");
    header.className = "dungeon-header";

    const title = document.createElement("h3");
    title.textContent = dungeon.name;

    const counter = document.createElement("span");
    counter.className = "counter";
    counter.textContent = String(signups.length);
    counter.title = "Количество записей";

    header.append(title, counter);
    card.appendChild(header);

    const slotList = document.createElement("div");
    slotList.className = "slot-list";

    TIME_SLOTS.forEach((slot) => {
      const slotCard = document.createElement("div");
      slotCard.className = "slot-card";

      const slotTitle = document.createElement("div");
      slotTitle.className = "slot-title";
      slotTitle.textContent = slot.label;
      slotCard.appendChild(slotTitle);

      const slotSignups = signupsBySlot[slot.id] || [];
      if (slotSignups.length === 0) {
        const empty = document.createElement("div");
        empty.className = "empty-slot";
        empty.textContent = isSlotFinished(slot) && !ALLOW_PAST_SLOTS ? "Слот завершён" : "Свободно";
        slotCard.appendChild(empty);
      } else {
        slotSignups
          .sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "ru"))
          .forEach((signup) => {
            slotCard.appendChild(renderPlayerRow(signup, dungeon.id));
          });
      }

      slotList.appendChild(slotCard);
    });

    card.appendChild(slotList);
    els.scheduleGrid.appendChild(card);
  });
}

function renderPlayerRow(signup, dungeonId) {
  const row = document.createElement("div");
  row.className = "player-row";

  const name = document.createElement("span");
  name.className = "player-name";
  name.textContent = signup.name || "Без имени";
  row.appendChild(name);

  if (currentUser && signup.uid === currentUser.uid) {
    const button = document.createElement("button");
    button.className = "delete-button";
    button.type = "button";
    button.textContent = "Удалить";
    button.addEventListener("click", () => deleteOwnSignup(dungeonId));
    row.appendChild(button);
  }

  return row;
}

function renderEmptySchedule(text) {
  els.scheduleGrid.innerHTML = "";
  const empty = document.createElement("div");
  empty.className = "empty-dungeon";
  empty.textContent = text;
  els.scheduleGrid.appendChild(empty);
}

function renderSlotOptions() {
  const selectedValue = els.slotSelect.value;
  els.slotSelect.innerHTML = "";

  TIME_SLOTS.forEach((slot) => {
    const option = document.createElement("option");
    option.value = slot.id;
    option.textContent = slot.label;

    if (!ALLOW_PAST_SLOTS && isSlotFinished(slot)) {
      option.disabled = true;
      option.textContent = `${slot.label} — завершён`;
    }

    els.slotSelect.appendChild(option);
  });

  if (selectedValue && [...els.slotSelect.options].some((option) => option.value === selectedValue && !option.disabled)) {
    els.slotSelect.value = selectedValue;
  }
}

function groupSignupsBySlot(signups) {
  return signups.reduce((acc, signup) => {
    const slotId = signup.slot || "unknown";
    if (!acc[slotId]) acc[slotId] = [];
    acc[slotId].push(signup);
    return acc;
  }, {});
}

function getMoscowParts() {
  const formatter = new Intl.DateTimeFormat("ru-RU", {
    timeZone: MOSCOW_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
  });

  const parts = formatter.formatToParts(new Date());
  return Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
}

function getMoscowDateKey() {
  const parts = getMoscowParts();
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function updateMoscowClock() {
  const parts = getMoscowParts();
  currentMskDateKey = `${parts.year}-${parts.month}-${parts.day}`;
  els.todayDate.textContent = `${parts.day}.${parts.month}.${parts.year}`;
  els.moscowTime.textContent = `${parts.hour}:${parts.minute}:${parts.second} МСК`;
}

function getCurrentMoscowHour() {
  return Number(getMoscowParts().hour);
}

function isSlotFinished(slot) {
  return getCurrentMoscowHour() >= slot.endHour;
}

function normalizeName(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function showMessage(text, type) {
  els.messageBox.textContent = text;
  els.messageBox.className = `message-box ${type || ""}`.trim();
}

function setConnectionStatus(text, type) {
  els.connectionStatus.textContent = text;
  els.connectionStatus.className = `status-pill status-${type}`;
}

function isFirebaseConfigured() {
  return firebaseConfig
    && firebaseConfig.apiKey
    && !firebaseConfig.apiKey.includes("PASTE_")
    && firebaseConfig.projectId
    && !firebaseConfig.projectId.includes("PASTE_")
    && firebaseConfig.databaseURL
    && !firebaseConfig.databaseURL.includes("PASTE_");
}
