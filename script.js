"use strict";

// ---------- Configurações ----------
const STORAGE_KEY = "pomodoro:stats";
const MINUTES = { focus: 25, short: 5, long: 15 };
const LABELS = { focus: "Hora de focar", short: "Pausa curta", long: "Pausa longa" };
const SESSIONS_PER_SET = 4;
const RING_LENGTH = 2 * Math.PI * 54; // circunferência do círculo SVG (raio 54)

// ---------- Elementos da página ----------
const $ = (id) => document.getElementById(id);
const el = {
  time: $("time"), label: $("label"), ring: $("ring"), cycle: $("cycle"),
  start: $("start"), reset: $("reset"), clear: $("clear-stats"), chart: $("chart"),
  today: $("stat-today"), todaySessions: $("stat-today-sessions"),
  streak: $("stat-streak"), total: $("stat-total"), totalSessions: $("stat-total-sessions"),
  modeButtons: document.querySelectorAll(".mode"),
};
el.ring.style.strokeDasharray = RING_LENGTH;

// ---------- Armazenamento ----------
// Formato: { "2026-10-08": { sessions: 3, minutes: 75 }, ... }
function loadStats() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; }
  catch { return {}; }
}
function saveStats() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(stats)); } catch {}
}

// Chave do dia no horário LOCAL (toISOString usaria UTC e viraria o dia errado à noite)
function dateKey(date = new Date()) {
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${m}-${d}`;
}

// ---------- Estado ----------
let stats = loadStats();
let mode = "focus";
let cycle = 1;                       // número da sessão de foco atual (1 a 4)
let remainingMs = MINUTES.focus * 60 * 1000;
let endTime = null;                  // momento exato em que o timer termina
let intervalId = null;

const durationMs = () => MINUTES[mode] * 60 * 1000;
const isRunning = () => intervalId !== null;

// ---------- Timer ----------
function formatClock(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = String(Math.floor(total / 60)).padStart(2, "0");
  const s = String(total % 60).padStart(2, "0");
  return `${m}:${s}`;
}

function renderTimer() {
  const clock = formatClock(remainingMs);
  el.time.textContent = clock;
  el.label.textContent = LABELS[mode];
  document.title = `${clock} · ${LABELS[mode]}`;
  document.body.dataset.mode = mode;
  el.ring.style.strokeDashoffset = RING_LENGTH * (1 - remainingMs / durationMs());
  el.start.textContent = isRunning() ? "Pausar" : remainingMs < durationMs() ? "Continuar" : "Iniciar";

  if (mode === "focus") el.cycle.textContent = `Sessão de foco ${cycle} de ${SESSIONS_PER_SET}`;
  else if (mode === "short") el.cycle.textContent = `Pausa após a sessão ${cycle}`;
  else el.cycle.textContent = "Ciclo completo. Descanse bem!";

  el.modeButtons.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.mode === mode)));
}

function stopInterval() {
  clearInterval(intervalId);
  intervalId = null;
}

function setMode(newMode) {
  stopInterval();
  mode = newMode;
  remainingMs = durationMs();
  renderTimer();
}

function start() {
  unlockAudio();
  // Guardamos a hora final em vez de ir subtraindo 1s a cada tick:
  // assim o timer continua certo mesmo se a aba ficar em segundo plano.
  endTime = Date.now() + remainingMs;
  intervalId = setInterval(tick, 250);
  renderTimer();
}

function pause() {
  remainingMs = endTime - Date.now();
  stopInterval();
  renderTimer();
}

function tick() {
  remainingMs = endTime - Date.now();
  if (remainingMs <= 0) finish();
  else renderTimer();
}

function finish() {
  stopInterval();
  playBeep();
  if (mode === "focus") {
    registerSession(MINUTES.focus);
    setMode(cycle % SESSIONS_PER_SET === 0 ? "long" : "short");
  } else {
    cycle = mode === "long" ? 1 : cycle + 1;
    setMode("focus");
  }
}

// ---------- Som (Web Audio API) ----------
let audioCtx = null;
function unlockAudio() {
  // O navegador só libera o áudio depois de um clique do usuário
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === "suspended") audioCtx.resume();
}
function playBeep() {
  if (!audioCtx) return;
  [0, 0.3, 0.6].forEach((offset) => {
    const t = audioCtx.currentTime + offset;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(t);
    osc.stop(t + 0.3);
  });
}

// ---------- Estatísticas ----------
function registerSession(minutes) {
  const key = dateKey();
  const day = stats[key] || { sessions: 0, minutes: 0 };
  day.sessions += 1;
  day.minutes += minutes;
  stats[key] = day;
  saveStats();
  renderStats();
}

function formatMinutes(min) {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

function calcStreak() {
  const day = new Date();
  // Se ainda não focou hoje, a sequência de ontem continua valendo
  if (!stats[dateKey(day)]) day.setDate(day.getDate() - 1);
  let streak = 0;
  while (stats[dateKey(day)]) {
    streak++;
    day.setDate(day.getDate() - 1);
  }
  return streak;
}

function getLastDays(n) {
  const days = [];
  for (let i = n - 1; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    days.push({ date, minutes: stats[dateKey(date)]?.minutes ?? 0 });
  }
  return days;
}

function renderChart() {
  const days = getLastDays(7);
  const max = Math.max(...days.map((d) => d.minutes), 1);

  el.chart.replaceChildren(...days.map((day, i) => {
    const col = document.createElement("div");
    col.className = "bar-col" + (i === days.length - 1 ? " is-today" : "");
    col.title = day.date.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })
      + `: ${formatMinutes(day.minutes)}`;

    const value = document.createElement("span");
    value.className = "bar-value";
    value.textContent = day.minutes;

    const track = document.createElement("div");
    track.className = "bar-track";
    const bar = document.createElement("div");
    bar.className = "bar";
    bar.style.height = `${(day.minutes / max) * 100}%`;
    track.append(bar);

    const name = document.createElement("span");
    name.className = "bar-day";
    name.textContent = day.date.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "");

    col.append(value, track, name);
    return col;
  }));
}

function renderStats() {
  const today = stats[dateKey()] || { sessions: 0, minutes: 0 };
  const all = Object.values(stats);
  const totalMinutes = all.reduce((sum, d) => sum + d.minutes, 0);
  const totalSessions = all.reduce((sum, d) => sum + d.sessions, 0);
  const streak = calcStreak();

  el.today.textContent = formatMinutes(today.minutes);
  el.todaySessions.textContent = plural(today.sessions, "sessão", "sessões");
  el.streak.textContent = plural(streak, "dia", "dias");
  el.total.textContent = formatMinutes(totalMinutes);
  el.totalSessions.textContent = plural(totalSessions, "sessão", "sessões");
  renderChart();
}

// ---------- Eventos ----------
el.start.addEventListener("click", () => (isRunning() ? pause() : start()));

el.reset.addEventListener("click", () => {
  stopInterval();
  remainingMs = durationMs();
  renderTimer();
});

el.modeButtons.forEach((b) => b.addEventListener("click", () => setMode(b.dataset.mode)));

el.clear.addEventListener("click", () => {
  if (confirm("Apagar todas as estatísticas? Isso não pode ser desfeito.")) {
    stats = {};
    saveStats();
    renderStats();
  }
});

// ---------- Início ----------
renderTimer();
renderStats();