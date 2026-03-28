import {
  fetchLeaderboard,
  getSupabaseClient,
  insertWin,
  type LeaderboardEntry,
} from "./supabase";

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
] as const;

const MAX_LIVES = 10;
const LS_PLAYER = "hpHangmanPlayerName";
const MAX_LEADERBOARD = 200;
const TIMER_MS = 100;

const supabase = getSupabaseClient();

const wordDisplay = document.getElementById("wordDisplay")!;
const heartsEl = document.getElementById("hearts")!;
const wrongLettersEl = document.getElementById("wrongLetters")!;
const letterInput = document.getElementById("letterInput") as HTMLInputElement;
const guessBtn = document.getElementById("guessBtn")!;
const newGameBtn = document.getElementById("newGameBtn")!;
const modal = document.getElementById("modal") as HTMLElement;
const modalTitle = document.getElementById("modalTitle")!;
const modalText = document.getElementById("modalText")!;
const modalBtn = document.getElementById("modalBtn")!;
const playerNameInput = document.getElementById("playerNameInput") as HTMLInputElement;
const gameTimerEl = document.getElementById("gameTimer")!;
const rankPreviewEl = document.getElementById("rankPreview")!;
const leaderboardBody = document.getElementById("leaderboardBody")!;

let leaderboardCache: LeaderboardEntry[] = [];
let leaderboardLoadError: string | null = null;
let secret = "";
let revealed: boolean[] = [];
let guessed = new Set<string>();
let wrong = new Set<string>();
let lives = MAX_LIVES;
let gameStartTime = 0;
let timerId: ReturnType<typeof setInterval> | null = null;

function normalizeLetter(ch: string): string {
  if (!ch) return "";
  const map: Record<string, string> = {
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
  return map[lower] ?? lower;
}

function pickSecret(): string {
  const i = Math.floor(Math.random() * CHARACTERS.length);
  return CHARACTERS[i]!;
}

function formatDurationMs(ms: number): string {
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

function localDateKey(d: Date): string {
  const y = d.getFullYear();
  const mo = d.getMonth() + 1;
  const day = d.getDate();
  return `${y}-${mo}-${day}`;
}

function isToday(iso: string): boolean {
  return localDateKey(new Date(iso)) === localDateKey(new Date());
}

function loadLeaderboard(): LeaderboardEntry[] {
  return leaderboardCache;
}

function compareEntries(a: LeaderboardEntry, b: LeaderboardEntry): number {
  if (a.durationMs !== b.durationMs) return a.durationMs - b.durationMs;
  return new Date(a.finishedAt).getTime() - new Date(b.finishedAt).getTime();
}

function sortEntries(entries: LeaderboardEntry[]): LeaderboardEntry[] {
  return [...entries].sort(compareEntries);
}

function hypotheticalRank(
  entries: LeaderboardEntry[],
  durationMs: number,
  todayOnly: boolean,
): number {
  const base = todayOnly
    ? entries.filter((e) => isToday(e.finishedAt))
    : entries.slice();
  const hypo: LeaderboardEntry = {
    id: "__hypo__",
    playerName: "",
    durationMs,
    finishedAt: new Date().toISOString(),
  };
  const sorted = sortEntries(base.concat(hypo));
  return sorted.findIndex((e) => e.id === "__hypo__") + 1;
}

async function refreshLeaderboardFromRemote(): Promise<void> {
  leaderboardLoadError = null;
  if (!supabase) {
    leaderboardCache = [];
    leaderboardLoadError = "Chybí konfigurace Supabase (proměnné prostředí při buildu).";
    return;
  }
  try {
    leaderboardCache = await fetchLeaderboard(supabase, MAX_LEADERBOARD);
  } catch (e) {
    console.error(e);
    leaderboardCache = [];
    leaderboardLoadError =
      "Žebříček se nepodařilo načíst. Zkontrolujte připojení nebo nastavení Supabase.";
  }
}

function stopGameTimer(): void {
  if (timerId !== null) {
    clearInterval(timerId);
    timerId = null;
  }
}

function tickTimerAndPreview(): void {
  if (modal.hidden === false) return;
  const elapsed = Math.round(performance.now() - gameStartTime);
  gameTimerEl.textContent = formatDurationMs(elapsed);
  const entries = loadLeaderboard();
  const rAll = hypotheticalRank(entries, elapsed, false);
  const rToday = hypotheticalRank(entries, elapsed, true);
  rankPreviewEl.textContent = `Když teď úspěšně dokončíš hru, budeš na ${rAll}. místě celkově a na ${rToday}. místě mezi dnešními výsledky.`;
}

function startGameTimer(): void {
  stopGameTimer();
  gameStartTime = performance.now();
  gameTimerEl.textContent = formatDurationMs(0);
  tickTimerAndPreview();
  timerId = setInterval(tickTimerAndPreview, TIMER_MS);
}

function getPlayerName(): string {
  const t = playerNameInput.value.trim();
  return t || "Hráč";
}

function renderLeaderboard(): void {
  leaderboardBody.innerHTML = "";
  if (leaderboardLoadError) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 5;
    td.className = "leaderboard-empty";
    td.textContent = leaderboardLoadError;
    tr.appendChild(td);
    leaderboardBody.appendChild(tr);
    return;
  }

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

function renderHearts(): void {
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

function renderWord(): void {
  wordDisplay.innerHTML = "";
  const chars = secret.split("");

  for (let i = 0; i < chars.length; i++) {
    const c = chars[i]!;
    if (c === " ") {
      const gap = document.createElement("span");
      gap.className = "word-gap";
      gap.setAttribute("aria-hidden", "true");
      wordDisplay.appendChild(gap);
      continue;
    }

    const slot = document.createElement("span");
    slot.className = "char-slot";
    const isRevealed = revealed[i]!;

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

function renderWrong(): void {
  wrongLettersEl.textContent = Array.from(wrong)
    .sort((a, b) => a.localeCompare(b, "cs"))
    .join("  ");
}

function checkWin(): boolean {
  for (let i = 0; i < secret.length; i++) {
    if (secret[i] === " ") continue;
    if (!revealed[i]) return false;
  }
  return true;
}

function ranksForEntry(entryId: string): { overallRank: number; todayRank: number } {
  const sorted = sortEntries(loadLeaderboard());
  const overallRank = sorted.findIndex((e) => e.id === entryId) + 1;
  const todaySorted = sorted.filter((e) => isToday(e.finishedAt));
  const todayRank = todaySorted.findIndex((e) => e.id === entryId) + 1;
  return { overallRank, todayRank };
}

async function recordWinAndRanks(rawDurationMs: number): Promise<{
  overallRank: number;
  todayRank: number;
  durationMs: number;
}> {
  const durationMs = Math.max(1, Math.round(rawDurationMs));
  const finishedAt = new Date().toISOString();
  const playerName = getPlayerName();
  const payload: Omit<LeaderboardEntry, "id"> = {
    playerName,
    durationMs,
    finishedAt,
  };

  if (!supabase) {
    const id =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `id-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    leaderboardCache = sortEntries([...leaderboardCache, { ...payload, id }]).slice(
      0,
      MAX_LEADERBOARD,
    );
    const { overallRank, todayRank } = ranksForEntry(id);
    return { overallRank, todayRank, durationMs };
  }

  const id = await insertWin(supabase, payload);
  await refreshLeaderboardFromRemote();
  const { overallRank, todayRank } = ranksForEntry(id);
  return { overallRank, todayRank, durationMs };
}

function openModal(
  win: boolean,
  answer: string,
  winMeta?: { overallRank: number; todayRank: number; durationMs: number },
  saveFailed?: boolean,
): void {
  modal.hidden = false;
  rankPreviewEl.hidden = true;
  stopGameTimer();
  modalTitle.className = "modal-title " + (win ? "win" : "lose");
  modalTitle.textContent = win ? "Výborně!" : "Konec hry";
  if (win && winMeta) {
    let text = `Uhádl(a) jsi: ${answer}\n\nTvé místo: ${winMeta.overallRank}. v celkovém žebříčku a ${winMeta.todayRank}. mezi dnešními výsledky.\nDélka hry: ${formatDurationMs(winMeta.durationMs)}.`;
    if (saveFailed) {
      text += "\n\n(Poznámka: výsledek se nepodařilo uložit na server — žebříček se může lišit.)";
    }
    modalText.textContent = text;
  } else if (win) {
    modalText.textContent =
      saveFailed && supabase
        ? `Uhádl(a) jsi: ${answer}\n\nVýsledek se nepodařilo uložit na server.`
        : `Uhádl(a) jsi: ${answer}`;
  } else {
    modalText.textContent = `Správná odpověď byla: ${answer}`;
  }
  modalBtn.focus();
}

function closeModal(): void {
  modal.hidden = true;
  rankPreviewEl.hidden = false;
  letterInput.focus();
}

async function tryLetter(raw: string): Promise<void> {
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
    if (normalizeLetter(secret[i]!) === letter) {
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
    try {
      const winMeta = await recordWinAndRanks(durationMs);
      renderLeaderboard();
      openModal(true, secret, winMeta, false);
    } catch (e) {
      console.error(e);
      renderLeaderboard();
      openModal(true, secret, undefined, supabase !== null);
    }
    return;
  }
  if (lives <= 0) {
    openModal(false, secret);
  }
}

function initGame(): void {
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
  void refreshLeaderboardFromRemote().then(() => {
    renderLeaderboard();
    tickTimerAndPreview();
  });
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
  if (v) void tryLetter(v[0]!);
});

letterInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    const v = letterInput.value;
    if (v) void tryLetter(v[0]!);
  }
});

letterInput.addEventListener("input", () => {
  const v = letterInput.value;
  if (v.length > 1) letterInput.value = v.slice(-1);
});

document.addEventListener("keydown", (e) => {
  if (modal.hidden === false) return;
  if (e.target === letterInput || e.target === playerNameInput || e.target instanceof HTMLButtonElement)
    return;
  if (e.key.length === 1 && /[a-zA-ZáčďéěíňóřšťúůýžÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ]/.test(e.key)) {
    e.preventDefault();
    void tryLetter(e.key);
  }
});

newGameBtn.addEventListener("click", initGame);
modalBtn.addEventListener("click", () => {
  closeModal();
  initGame();
});

modal.addEventListener("click", (e) => {
  const t = e.target as HTMLElement;
  if (t.dataset.close !== undefined) {
    closeModal();
    initGame();
  }
});

// Hru spustíme hned; žebříček z API doběhne na pozadí (nepozastavuje UI při pomalé síti).
renderLeaderboard();
initGame();
void refreshLeaderboardFromRemote().then(() => {
  renderLeaderboard();
  tickTimerAndPreview();
});
