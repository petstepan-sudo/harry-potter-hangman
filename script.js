(function () {
  "use strict";

  const CHARACTERS = [
    "Harry Potter",
    "Hermiona Grangerová",
    "Ron Weasley",
    "Albus Brumbál",
    "Severus Snape",
    "Draco Malfoy",
    "Sirius Black",
    "Remus Lupin",
    "Minerva McGonagallová",
    "Rubeus Hagrid",
    "Luna Lovegoodová",
    "Neville Longbottom",
    "Bellatrix Lestrangeová",
    "Lord Voldemort",
    "Cedric Diggory",
    "Cho Changová",
    "Ginny Weasleyová",
    "Fred Weasley",
    "George Weasley",
    "Arthur Weasley",
    "Molly Weasleyová",
    "Lucius Malfoy",
    "Narcissa Malfoyová",
    "James Potter",
    "Lily Potterová",
    "Peter Pettigrew",
    "Filius Flitwick",
    "Pomona Prachová",
    "Horacio Křikavec",
    "Kingsley Shacklebolt",
    "Nymphadora Tonksová",
    "Alastor Moody",
    "Dolores Umbridgeová",
    "Gellert Grindelwald",
    "Nicolas Flamel",
    "Viktor Krum",
    "Fleur Delacourová",
    "Ollivander",
    "Aberforth Brumbál",
    "Argus Filch",
    "Dean Thomas",
    "Seamus Finnigan",
    "Lavender Brownová",
    "Parvati Patilová",
    "Padma Patilová",
    "Pansy Parkinsonová",
    "Gregory Goyle",
    "Vincent Crabbe",
    "Percy Weasley",
    "Madam Rosmerta",
  ];

  const MAX_LIVES = 10;
  const LS_LEADERBOARD = "hpHangmanLeaderboard";
  const LS_PLAYER = "hpHangmanPlayerName";
  const MAX_LEADERBOARD = 200;
  const TIMER_MS = 100;

  const wordDisplay = document.getElementById("wordDisplay");
  const heartsEl = document.getElementById("hearts");
  const wrongLettersEl = document.getElementById("wrongLetters");
  const letterInput = document.getElementById("letterInput");
  const guessBtn = document.getElementById("guessBtn");
  const newGameBtn = document.getElementById("newGameBtn");
  const modal = document.getElementById("modal");
  const modalTitle = document.getElementById("modalTitle");
  const modalText = document.getElementById("modalText");
  const modalBtn = document.getElementById("modalBtn");
  const playerNameInput = document.getElementById("playerNameInput");
  const gameTimerEl = document.getElementById("gameTimer");
  const rankPreviewEl = document.getElementById("rankPreview");
  const leaderboardBody = document.getElementById("leaderboardBody");

  let secret = "";
  let revealed = [];
  let guessed = new Set();
  let wrong = new Set();
  let lives = MAX_LIVES;
  let gameStartTime = 0;
  let timerId = null;

  function normalizeLetter(ch) {
    if (!ch) return "";
    const map = {
      á: "a",
      č: "c",
      ď: "d",
      é: "e",
      ě: "e",
      í: "i",
      ň: "n",
      ó: "o",
      ř: "r",
      š: "s",
      ť: "t",
      ú: "u",
      ů: "u",
      ý: "y",
      ž: "z",
    };
    const lower = ch.toLowerCase();
    return map[lower] || lower;
  }

  function pickSecret() {
    const i = Math.floor(Math.random() * CHARACTERS.length);
    return CHARACTERS[i];
  }

  function formatDurationMs(ms) {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const sec = s % 60;
    if (m >= 60) {
      const h = Math.floor(m / 60);
      const mm = m % 60;
      return `${h}:${String(mm).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
    }
    return `${m}:${String(sec).padStart(2, "0")}`;
  }

  function localDateKey(d) {
    const y = d.getFullYear();
    const mo = d.getMonth() + 1;
    const day = d.getDate();
    return `${y}-${mo}-${day}`;
  }

  function isToday(iso) {
    return localDateKey(new Date(iso)) === localDateKey(new Date());
  }

  function loadLeaderboard() {
    try {
      const raw = localStorage.getItem(LS_LEADERBOARD);
      if (!raw) return [];
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    } catch {
      return [];
    }
  }

  function saveLeaderboard(entries) {
    localStorage.setItem(LS_LEADERBOARD, JSON.stringify(entries));
  }

  function compareEntries(a, b) {
    if (a.durationMs !== b.durationMs) return a.durationMs - b.durationMs;
    return new Date(a.finishedAt) - new Date(b.finishedAt);
  }

  function sortEntries(entries) {
    return [...entries].sort(compareEntries);
  }

  function hypotheticalRank(entries, durationMs, todayOnly) {
    const base = todayOnly ? entries.filter((e) => isToday(e.finishedAt)) : entries.slice();
    const nowIso = new Date().toISOString();
    const hypo = { durationMs, finishedAt: nowIso, __h: true };
    const sorted = sortEntries(base.concat(hypo));
    const idx = sorted.findIndex((e) => e.__h);
    return idx + 1;
  }

  function stopGameTimer() {
    if (timerId !== null) {
      clearInterval(timerId);
      timerId = null;
    }
  }

  function tickTimerAndPreview() {
    if (modal.hidden === false) return;
    const elapsed = performance.now() - gameStartTime;
    gameTimerEl.textContent = formatDurationMs(elapsed);
    const entries = loadLeaderboard();
    const rAll = hypotheticalRank(entries, elapsed, false);
    const rToday = hypotheticalRank(entries, elapsed, true);
    rankPreviewEl.textContent =
      `Když teď úspěšně dokončíš hru, budeš na ${rAll}. místě celkově a na ${rToday}. místě mezi dnešními výsledky.`;
  }

  function startGameTimer() {
    stopGameTimer();
    gameStartTime = performance.now();
    gameTimerEl.textContent = formatDurationMs(0);
    tickTimerAndPreview();
    timerId = setInterval(tickTimerAndPreview, TIMER_MS);
  }

  function getPlayerName() {
    const t = playerNameInput.value.trim();
    return t || "Hráč";
  }

  function renderLeaderboard() {
    leaderboardBody.innerHTML = "";
    const sorted = sortEntries(loadLeaderboard()).slice(0, MAX_LEADERBOARD);
    if (sorted.length === 0) {
      const tr = document.createElement("tr");
      const td = document.createElement("td");
      td.colSpan = 5;
      td.className = "leaderboard-empty";
      td.textContent = "Zatím žádné výhry.";
      tr.appendChild(td);
      leaderboardBody.appendChild(tr);
      return;
    }
    sorted.forEach((e, i) => {
      const tr = document.createElement("tr");
      const d = new Date(e.finishedAt);
      const dateStr = d.toLocaleDateString("cs-CZ", {
        day: "numeric",
        month: "numeric",
        year: "numeric",
      });
      const timeStr = d.toLocaleTimeString("cs-CZ", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
      const cells = [
        String(i + 1),
        e.playerName || "Hráč",
        dateStr,
        timeStr,
        formatDurationMs(e.durationMs),
      ];
      cells.forEach((text) => {
        const td = document.createElement("td");
        td.textContent = text;
        tr.appendChild(td);
      });
      leaderboardBody.appendChild(tr);
    });
  }

  function renderHearts() {
    heartsEl.innerHTML = "";
    for (let i = 0; i < MAX_LIVES; i++) {
      const span = document.createElement("span");
      span.className = "heart" + (i >= lives ? " lost" : "");
      span.textContent = "\u2665";
      span.setAttribute("aria-hidden", "true");
      heartsEl.appendChild(span);
    }
    heartsEl.setAttribute("aria-label", `${lives} z ${MAX_LIVES} životů`);
  }

  function renderWord() {
    wordDisplay.innerHTML = "";
    const chars = secret.split("");

    for (let i = 0; i < chars.length; i++) {
      const c = chars[i];
      if (c === " ") {
        const gap = document.createElement("span");
        gap.className = "word-gap";
        gap.setAttribute("aria-hidden", "true");
        wordDisplay.appendChild(gap);
        continue;
      }

      const slot = document.createElement("span");
      slot.className = "char-slot";
      const isRevealed = revealed[i];

      if (isRevealed) {
        slot.textContent = c;
        slot.classList.add("revealed");
        slot.setAttribute("aria-label", c);
      } else {
        slot.textContent = "\u00a0";
        slot.setAttribute("aria-label", "neznámé písmeno");
      }

      wordDisplay.appendChild(slot);
    }
  }

  function renderWrong() {
    wrongLettersEl.textContent = Array.from(wrong)
      .sort((a, b) => a.localeCompare(b, "cs"))
      .join("  ");
  }

  function checkWin() {
    for (let i = 0; i < secret.length; i++) {
      if (secret[i] === " ") continue;
      if (!revealed[i]) return false;
    }
    return true;
  }

  function recordWinAndRanks(durationMs) {
    const id =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `id-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const entry = {
      id,
      playerName: getPlayerName(),
      durationMs,
      finishedAt: new Date().toISOString(),
    };
    const list = loadLeaderboard();
    list.push(entry);
    const sorted = sortEntries(list);
    const trimmed = sorted.slice(0, MAX_LEADERBOARD);
    saveLeaderboard(trimmed);
    const overallRank = sorted.findIndex((e) => e.id === entry.id) + 1;
    const todaySorted = sorted.filter((e) => isToday(e.finishedAt));
    const todayRank = todaySorted.findIndex((e) => e.id === entry.id) + 1;
    return { overallRank, todayRank, durationMs };
  }

  function openModal(win, answer, winMeta) {
    modal.hidden = false;
    rankPreviewEl.hidden = true;
    stopGameTimer();
    modalTitle.className = "modal-title " + (win ? "win" : "lose");
    modalTitle.textContent = win ? "Výborně!" : "Konec hry";
    if (win && winMeta) {
      modalText.textContent =
        `Uhádl(a) jsi: ${answer}\n\nTvé místo: ${winMeta.overallRank}. v celkovém žebříčku a ${winMeta.todayRank}. mezi dnešními výsledky.\nDélka hry: ${formatDurationMs(winMeta.durationMs)}.`;
    } else if (win) {
      modalText.textContent = `Uhádl(a) jsi: ${answer}`;
    } else {
      modalText.textContent = `Správná odpověď byla: ${answer}`;
    }
    modalBtn.focus();
  }

  function closeModal() {
    modal.hidden = true;
    rankPreviewEl.hidden = false;
    letterInput.focus();
  }

  function tryLetter(raw) {
    const letter = normalizeLetter(raw);
    if (!letter || !/[a-z]/.test(letter)) {
      letterInput.value = "";
      return;
    }

    if (guessed.has(letter)) {
      letterInput.value = "";
      return;
    }

    guessed.add(letter);
    let hit = false;
    for (let i = 0; i < secret.length; i++) {
      if (secret[i] === " ") continue;
      if (normalizeLetter(secret[i]) === letter) {
        revealed[i] = true;
        hit = true;
      }
    }

    if (!hit) {
      wrong.add(letter);
      lives -= 1;
    }

    letterInput.value = "";
    renderWord();
    renderHearts();
    renderWrong();

    if (checkWin()) {
      const durationMs = performance.now() - gameStartTime;
      const winMeta = recordWinAndRanks(durationMs);
      renderLeaderboard();
      openModal(true, secret, winMeta);
      return;
    }
    if (lives <= 0) {
      openModal(false, secret);
    }
  }

  function initGame() {
    secret = pickSecret();
    revealed = secret.split("").map((c) => c === " ");
    guessed = new Set();
    wrong = new Set();
    lives = MAX_LIVES;
    renderHearts();
    renderWord();
    renderWrong();
    rankPreviewEl.hidden = false;
    startGameTimer();
    letterInput.focus();
  }

  try {
    const saved = localStorage.getItem(LS_PLAYER);
    if (saved !== null) playerNameInput.value = saved;
  } catch {
    /* ignore */
  }

  playerNameInput.addEventListener("input", () => {
    let v = playerNameInput.value;
    if (v.length > 24) v = v.slice(0, 24);
    playerNameInput.value = v;
    try {
      localStorage.setItem(LS_PLAYER, v);
    } catch {
      /* ignore */
    }
  });

  guessBtn.addEventListener("click", () => {
    const v = letterInput.value;
    if (v) tryLetter(v[0]);
  });

  letterInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const v = letterInput.value;
      if (v) tryLetter(v[0]);
    }
  });

  letterInput.addEventListener("input", () => {
    const v = letterInput.value;
    if (v.length > 1) letterInput.value = v.slice(-1);
  });

  document.addEventListener("keydown", (e) => {
    if (modal.hidden === false) return;
    if (e.target === letterInput || e.target === playerNameInput || e.target.tagName === "BUTTON")
      return;
    if (e.key.length === 1 && /[a-zA-ZáčďéěíňóřšťúůýžÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ]/.test(e.key)) {
      e.preventDefault();
      tryLetter(e.key);
    }
  });

  newGameBtn.addEventListener("click", initGame);
  modalBtn.addEventListener("click", () => {
    closeModal();
    initGame();
  });

  modal.addEventListener("click", (e) => {
    if (e.target.dataset.close !== undefined) {
      closeModal();
      initGame();
    }
  });

  renderLeaderboard();
  initGame();
})();
