/**
 * Firefighter Spelling — canvas engine (ES module).
 * Loaded by index.html as <script type="module" src="src/engine.js">
 */
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const captionEl = document.getElementById("live-caption");
const pasteEl = document.getElementById("paste-words");
const applyBtn = document.getElementById("apply-words");
const toolsToggle = document.getElementById("tools-toggle");
const toolsBody = document.getElementById("tools-body");
const anyTextEl = document.getElementById("any-text");
const speakAnyBtn = document.getElementById("speak-any");
const voiceBellaBtn = document.getElementById("voice-bella");
const voicePuckBtn = document.getElementById("voice-puck");
const ttsStatusEl = document.getElementById("tts-status");

const API = "1.6.0";
const STORAGE_KEY = "mrj.firefighter_spelling.records";
const CUSTOM_KEY = "mrj.firefighter_spelling.custom_words";
const VOICE_KEY = "mrj.firefighter_spelling.tts_gender";
const DEFAULT_PACK_URL = "packs/numbers-en.json";
const WORDS_TXT_URL = "packs/words.txt";
const WINDOWS = 5;
const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const HURRY_MS = 4000;
const SLAM_MS = 2200;
const HEAVEN_AFTER = 2.4;
const COLLAPSE_S = 1.7;
const PIXEL_CAP = 2;
const DEFAULT_SEC_PER_LETTER = 5;
const NARRATOR_RATE = 1.45;
const TAP_DEBOUNCE_MS = 50;
const HIT_PAD = 10;
const SNAP_PX = 28;

const VERSION = "1.6";
const SPRITE_URLS = {
  fireman: "public/sprites/fireman.png",
  grandma: "public/sprites/grandma.png",
  hug: "public/sprites/hug.png",
  angel: "public/sprites/angel.png",
  truck: "public/sprites/truck.png",
  helicopter: "public/sprites/helicopter.png",
  ladder: "public/sprites/ladder.png",
  flames: "public/sprites/flames.png",
};
const sprites = {};
for (const [k, url] of Object.entries(SPRITE_URLS)) {
  const img = new Image();
  img.src = url;
  sprites[k] = img;
}

function drawImg(img, x, y, w, h) {
  if (img && img.complete && img.naturalWidth > 0) {
    ctx.drawImage(img, x, y, w, h);
    return true;
  }
  return false;
}
const params = new URLSearchParams(location.search);
const studentId = params.get("student") || "Guest";
const packUrl = params.get("pack") || DEFAULT_PACK_URL;
const packIdHint = params.get("packid") || "demo10";
const sessionId =
  (crypto.randomUUID && crypto.randomUUID()) ||
  `s-${Date.now()}-${Math.random().toString(16).slice(2)}`;

const state = {
  phase: "boot", // boot | tap | truck | intro | play | win | lose | fly | results
  truckX: -280,
  truckT: 0,
  ladderSlot: 2,
  ladderT: 0,
  climbT: 0,
  climbing: false,
  engulf: 0.12,
  hugT: 0,
  loseStage: "fire",
  heavenT: 0,
  pack: null,
  packId: "",
  itemIndex: 0,
  word: "",
  itemId: "",
  floor: 0, // 0 = ground, floors = letters.length means roof
  floors: 0,
  timerMs: 0,
  timerMax: 0,
  score: 0,
  lastRecord: null,
  taps: [],
  errors: 0,
  roundStartedAt: "",
  rescued: 0,
  burned: 0,
  introT: 0,
  hurryT: 0,
  slamI: 0,
  slamT: 0,
  winT: 0,
  loseT: 0,
  shake: 0,
  flash: 0,
  flames: [],
  sparks: [],
  heloX: 0,
  heloY: 0,
  grandmaFly: 0,
  hug: 0,
  wrongPulse: 0,
  lastWrong: -1,
  windowFaces: [],
  t0: 0,
  grandmaHelpI: 0,
  grandmaCheerI: 0,
  popCh: "",
  popT: 0,
  popSlot: -1,
  collapseT: 0,
  audioOn: false,
  queuedSlot: null,
  letterArmed: false,
  ttsGender: "male",
};

let audioCtx = null;
let lastTs = 0;
let pointerDown = false;
let lastPointerAt = 0;

function rand(a, b) {
  return a + Math.random() * (b - a);
}
function irand(a, b) {
  return Math.floor(rand(a, b + 1));
}
function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}
function pick(arr) {
  return arr[(Math.random() * arr.length) | 0];
}

function caption(text) {
  if (captionEl) captionEl.textContent = text || "";
}

function nowDay() {
  return new Date().toISOString().slice(0, 10);
}

function loadRecords() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveRecord(rec) {
  const all = loadRecords();
  all.push(rec);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {
    /* quota */
  }
  state.lastRecord = rec;
}

function recordDay1(fields) {
  const ended = new Date().toISOString();
  const started = state.roundStartedAt || ended;
  const latency = Math.max(0, Date.parse(ended) - Date.parse(started));
  const ok = fields.correct === 1 || fields.won === true;
  const rec = {
    student_id: studentId,
    session_id: sessionId,
    module_id: (state.pack && state.pack.module_id) || "firefighter_spelling",
    activity_id: (state.pack && state.pack.activity_id) || "grandma_rescue",
    item_id: state.itemId,
    skill_tags: (state.pack && state.pack.skill_tags) || ["spelling"],
    response: (state.taps || []).join(""),
    correct: ok ? 1 : 0,
    latency_ms: latency,
    accuracy: ok ? 1 : 0,
    points: ok ? Math.max(0, 100 * state.floors - 15 * state.errors) : 0,
    errors: state.errors,
    started_at: started,
    ended_at: ended,
    ui_locale: "en",
    pack_id: state.packId,
    word: state.word,
    score: state.score,
    ...fields,
  };
  saveRecord(rec);
  return rec;
}

const grandmaAudio = {};
const narratorAudio = {};
const readyGrandma = new Set();
const readyNarrator = new Set();
const failedGrandma = new Set();
const failedNarrator = new Set();
let grandmaNow = null;
let narratorNow = null;

function preloadClip(store, ready, failed, folder, id) {
  const url = `public/audio/${folder}/${id}.mp3`;
  const a = store[id] || new Audio(url);
  store[id] = a;
  a.preload = "auto";
  a.addEventListener("canplaythrough", () => { ready.add(id); failed.delete(id); }, { once: true });
  a.addEventListener("error", () => { ready.delete(id); failed.add(id); }, { once: true });
  try { a.load(); } catch { failed.add(id); }
  return a;
}

const GRANDMA_HELP = [
  "g-help-me",
  "g-hurry-please",
  "g-oh-hurry",
  "g-waiting",
  "g-save-me",
  "g-scared",
  "g-quick",
  "g-come-on",
];
const GRANDMA_CHEER = [
  "g-you-can",
  "g-thats-it",
  "g-almost",
  "g-dont-give-up",
  "g-keep-climbing",
  "g-believe",
];

GRANDMA_HELP.concat(GRANDMA_CHEER).concat(["g-thank-you"]).forEach((id) =>
  preloadClip(grandmaAudio, readyGrandma, failedGrandma, "grandma", id)
);
["listen", "the-word-is", "again", "please-spell"].forEach((id) =>
  preloadClip(narratorAudio, readyNarrator, failedNarrator, "narrator", id)
);
"abcdefghijklmnopqrstuvwxyz".split("").forEach((ch) =>
  preloadClip(narratorAudio, readyNarrator, failedNarrator, "narrator", `letter-${ch}`)
);
["one", "two", "three", "four", "five"].forEach((w) => {
  preloadClip(narratorAudio, readyNarrator, failedNarrator, "narrator", `spell-${w}`);
  preloadClip(narratorAudio, readyNarrator, failedNarrator, "narrator", `no-${w}`);
  preloadClip(narratorAudio, readyNarrator, failedNarrator, "narrator", `word-${w}`);
});
const BAKED_WORDS = new Set(["one", "two", "three", "four", "five"]);

function grandmaClipFor(text) {
  const t = String(text || "").trim();
  const low = t.toLowerCase();
  const w = (state.word || "").toLowerCase();
  if (/help me/.test(low)) return "g-help-me";
  if (/hurry up/.test(low)) return "g-hurry-please";
  if (/thank you/.test(low)) return "g-thank-you";
  if (/here is the spelling|oh no/.test(low)) return "g-oh-hurry";
  if (/great job/.test(low)) return "g-thats-it";
  if (/please spell/.test(low) && w) return `spell-${w}`;
  if (/no, no/.test(low) && w) return `no-${w}`;
  if (w && low.replace(/[^a-z]/g, "") === w) return `word-${w}`;
  return null;
}

function playReady(store, ready, nowRef, id, rate, failed) {
  const a = store[id];
  if (!a || (failed && failed.has(id))) return false;
  try {
    if (nowRef.a && nowRef.a !== store[id]) {
      nowRef.a.pause();
      nowRef.a.currentTime = 0;
    }
    const a = store[id];
    a.pause();
    a.currentTime = 0;
    a.playbackRate = rate;
    a.volume = 1;
    nowRef.a = a;
    const p = a.play();
    if (p && p.catch) p.catch(() => {});
    return true;
  } catch {
    return false;
  }
}

const grandmaNowRef = { a: null };
const narratorNowRef = { a: null };
const narrQ = [];
let narrBusy = false;
let narrGen = 0;
const gmQ = [];
let gmBusy = false;
let gmGen = 0;

function stopGrandma() {
  gmQ.length = 0;
  gmBusy = false;
  gmGen += 1;
  if (grandmaNowRef.a) {
    try {
      grandmaNowRef.a.onended = null;
      grandmaNowRef.a.pause();
      grandmaNowRef.a.currentTime = 0;
    } catch { /* ignore */ }
  }
}

function enqueueGrandma(id) {
  if (!id) return;
  gmQ.push(id);
  pumpGrandma();
}

function pumpGrandma() {
  if (gmBusy) return;
  const id = gmQ.shift();
  if (!id) return;
  gmBusy = true;
  const myGen = gmGen;
  const a = grandmaAudio[id];
  const finish = () => {
    if (myGen !== gmGen) return;
    gmBusy = false;
    pumpGrandma();
  };
  if (!state.audioOn || !a) {
    setTimeout(finish, 400);
    return;
  }
  try {
    a.onended = null;
    a.pause();
    a.currentTime = 0;
    a.playbackRate = 0.92;
    a.volume = 1;
    grandmaNowRef.a = a;
    a.onended = finish;
    const p = a.play();
    if (p && p.catch) p.catch(() => setTimeout(finish, 1800));
  } catch {
    setTimeout(finish, 400);
  }
}

function stopNarrator() {
  narrQ.length = 0;
  narrBusy = false;
  narrGen += 1;
  if (narratorNowRef.a) {
    try {
      narratorNowRef.a.onended = null;
      narratorNowRef.a.onerror = null;
      narratorNowRef.a.pause();
      narratorNowRef.a.currentTime = 0;
    } catch { /* ignore */ }
  }
}

function enqueueNarrator(item) {
  narrQ.push(item);
  pumpNarrator();
}

function pumpNarrator() {
  if (narrBusy) return;
  const item = narrQ.shift();
  if (!item) {
    state.narrDone = true;
    return;
  }
  narrBusy = true;
  const myGen = narrGen;
  if (item.onStart) item.onStart();
  caption(item.text || "");
  const finish = () => {
    if (myGen !== narrGen) return;
    narrBusy = false;
    if (item.onEnd) item.onEnd();
    pumpNarrator();
  };
  const id = item.clip;
  const a = id ? narratorAudio[id] : null;
  const clipFailed = !!(id && failedNarrator.has(id));
  if (state.audioOn && a && !clipFailed) {
    try {
      a.onended = null;
      a.pause();
      a.currentTime = 0;
      a.playbackRate = item.rate || NARRATOR_RATE;
      a.volume = 1;
      narratorNowRef.a = a;
      a.onended = () => {
        const gap = item.gapMs == null ? 280 : item.gapMs;
        setTimeout(finish, gap);
      };
      const p = a.play();
      if (p && p.catch) p.catch(() => setTimeout(finish, 1800));
      return;
    } catch { /* fall through */ }
  }
  if (state.audioOn && item.text) {
    playOfflineTts(item.text, () => {
      const gap = item.gapMs == null ? 280 : item.gapMs;
      setTimeout(finish, gap);
    });
    return;
  }
  setTimeout(finish, 500);
}

function startHeavenSpell() {
  stopNarrator();
  stopGrandma();
  state.slamI = 0;
  state.slamT = 0;
  state.narrDone = false;
  const w = (state.word || "").toUpperCase();
  const low = w.toLowerCase();
  enqueueNarrator({ clip: "listen", text: "Listen. Here is the spelling.", gapMs: 280 });
  w.split("").forEach((ch, i) => {
    enqueueNarrator({
      clip: `letter-${ch.toLowerCase()}`,
      text: ch,
      gapMs: 220,
      onStart() {
        state.slamI = i;
        state.slamT = 0;
        sfxSlam();
      },
      onEnd() {
        state.slamI = i + 1;
      },
    });
  });
  enqueueNarrator({ clip: "the-word-is", text: "The word is spelled.", gapMs: 500 });
  enqueueNarrator({
    clip: BAKED_WORDS.has(low) ? `word-${low}` : null,
    text: `The word is ${w}.`,
    gapMs: 800,
  });
  enqueueNarrator({ clip: "again", text: "Now you know. Try again.", gapMs: 200 });
}

function ttsUrl(text, gender) {
  const w = String(text || "").toLowerCase().replace(/[^a-z]/g, "");
  if (!w || w.length > 16) return "";
  if (w.length === 1) return `public/audio/narrator/letter-${w}.mp3`;
  if (BAKED_WORDS.has(w)) return `public/audio/narrator/word-${w}.mp3`;
  return "";
}

function letterAudioUrl(ch) {
  const id = String(ch || "").toLowerCase().replace(/[^a-z]/g, "");
  if (!id) return "";
  return `public/audio/narrator/letter-${id}.mp3`;
}

function playOfflineTts(text, onEnd) {
  const done = typeof onEnd === "function" ? onEnd : () => {};
  const line = String(text || "").trim();
  if (!line) {
    done();
    return;
  }
  const w = (state.word || "").toLowerCase();
  const one = line.toLowerCase().replace(/[^a-z]/g, "");
  let url = "";
  if (one.length === 1) url = letterAudioUrl(one);
  else if (w && (one === w || line.toLowerCase().includes(w))) url = ttsUrl(w);
  else if (one) url = ttsUrl(one);
  if (!url) {
    done();
    return;
  }
  try {
    const a = new Audio(url);
    a.preload = "auto";
    a.onended = () => done();
    a.onerror = () => done();
    narratorNowRef.a = a;
    const p = a.play();
    if (p && p.catch) p.catch(() => done());
  } catch {
    done();
  }
}

function speak(text, opts = {}) {
  caption(text);
  if (!state.audioOn) return;
  const clip = grandmaClipFor(text);
  if (clip && playReady(grandmaAudio, readyGrandma, grandmaNowRef, clip, 0.92, failedGrandma)) return;
  enqueueNarrator({ text, tts: true });
}

function playGrandmaRotate(list, key) {
  if (!list.length) return;
  const i = state[key] || 0;
  const id = list[i % list.length];
  state[key] = i + 1;
  caption(id);
  enqueueGrandma(id);
}

function speakSpell() {
  const w = (state.word || "").toLowerCase();
  const text = `Please spell the word ${w}.`;
  caption(`Please spell ${w.toUpperCase()}.`);
  if (!state.audioOn) return;
  const id = `spell-${w}`;
  if (BAKED_WORDS.has(w) && playReady(narratorAudio, readyNarrator, narratorNowRef, id, NARRATOR_RATE, failedNarrator)) return;
  enqueueNarrator({ text, tts: true });
}

function speakNo() {
  const w = (state.word || "").toLowerCase();
  const text = `No, no. It is ${w}.`;
  caption(`No, no. It is ${w.toUpperCase()}.`);
  if (!state.audioOn) return;
  const id = `no-${w}`;
  if (BAKED_WORDS.has(w) && playReady(narratorAudio, readyNarrator, narratorNowRef, id, NARRATOR_RATE, failedNarrator)) return;
  enqueueNarrator({ text, tts: true });
}

function speakNarratorLetter(ch) {
  enqueueNarrator({ clip: `letter-${String(ch).toLowerCase()}`, text: ch });
}

function speakNarrator(text, clipId) {
  enqueueNarrator({ clip: clipId || null, text });
}

function setTtsGender(gender) {
  state.ttsGender = gender === "female" ? "female" : "male";
  try { localStorage.setItem(VOICE_KEY, state.ttsGender); } catch { /* ignore */ }
  if (voiceBellaBtn) voiceBellaBtn.classList.toggle("on", state.ttsGender === "female");
  if (voicePuckBtn) voicePuckBtn.classList.toggle("on", state.ttsGender === "male");
  if (ttsStatusEl) {
    ttsStatusEl.textContent = "Voices are ready. Tap TAP TO PLAY to hear Grandma.";
  }
}

function ensureAudio() {
  if (audioCtx) {
    if (audioCtx.state === "suspended") audioCtx.resume();
    return;
  }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  audioCtx = new AC();
}

function beep(freq, dur = 0.12, type = "square", gain = 0.08, slide = 0) {
  if (!audioCtx) return;
  const t = audioCtx.currentTime;
  const o = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t + dur);
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g);
  g.connect(audioCtx.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function sfxCorrect() {
  beep(440, 0.08, "square", 0.07, 220);
  setTimeout(() => beep(660, 0.1, "triangle", 0.06), 70);
}
function sfxWrong() {
  beep(180, 0.18, "sawtooth", 0.06, -80);
}
function sfxWin() {
  [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => beep(f, 0.14, "triangle", 0.07), i * 90));
}
function sfxLose() {
  beep(220, 0.3, "sawtooth", 0.07, -120);
}
function sfxSlam() {
  beep(90, 0.12, "square", 0.1);
  beep(220, 0.18, "triangle", 0.05);
}
function sfxHelo() {
  if (!audioCtx) return;
  const t = audioCtx.currentTime;
  for (let i = 0; i < 8; i++) {
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = "sawtooth";
    o.frequency.setValueAtTime(70 + i * 18, t);
    o.frequency.linearRampToValueAtTime(90 + i * 22, t + 1.6);
    g.gain.setValueAtTime(0.09, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.8);
    o.connect(g);
    g.connect(audioCtx.destination);
    o.start(t);
    o.stop(t + 1.85);
  }
}

function sfxSiren(dt) {
  if (!audioCtx) return;
  const t = audioCtx.currentTime;
  const o = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  o.type = "sawtooth";
  const f = 620 + Math.sin(state.t0 * 8) * 280;
  o.frequency.setValueAtTime(f, t);
  g.gain.setValueAtTime(0.07, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
  o.connect(g);
  g.connect(audioCtx.destination);
  o.start(t);
  o.stop(t + 0.13);
}

function normalizePack(raw, sourceId) {
  const items = (raw.items || [])
    .map((it, i) => {
      const word = String(it.word || it).trim().toLowerCase().replace(/[^a-z]/g, "");
      if (!word) return null;
      return { item_id: it.item_id || `${sourceId}-${i}-${word}`, word };
    })
    .filter(Boolean);
  return {
    pack_id: raw.pack_id || sourceId || "custom",
    module_id: raw.module_id || "firefighter_spelling",
    activity_id: raw.activity_id || "grandma_rescue",
    skill_tags: raw.skill_tags || ["spelling"],
    seconds_per_letter: Number(raw.seconds_per_letter) > 0 ? Number(raw.seconds_per_letter) : DEFAULT_SEC_PER_LETTER,
    items,
  };
}

function packFromLines(text, id) {
  const items = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"))
    .map((word, i) => ({ item_id: `${id}-${i}`, word: word.toLowerCase().replace(/[^a-z]/g, "") }))
    .filter((it) => it.word);
  return normalizePack({ pack_id: id, seconds_per_letter: DEFAULT_SEC_PER_LETTER, items }, id);
}

async function fetchPack() {
  if (packUrl === "session") {
    try {
      const raw = sessionStorage.getItem("mrj.wm.gamepack");
      if (raw) {
        const pack = normalizePack(JSON.parse(raw), "session");
        if (pack.items.length) return pack;
      }
    } catch {
      /* fall through */
    }
  }
  try {
    const res = await fetch(packUrl === "session" ? "packs/animals.json" : packUrl, { cache: "no-store" });
    if (res.ok) {
      const json = await res.json();
      const pack = normalizePack(json, json.pack_id || "fetched");
      if (pack.items.length) return pack;
    }
  } catch {
    /* fall through */
  }
  try {
    const res = await fetch(WORDS_TXT_URL, { cache: "no-store" });
    if (res.ok) {
      const text = await res.text();
      const pack = packFromLines(text, "words-txt");
      if (pack.items.length) return pack;
    }
  } catch {
    /* last resort empty — still not hardcoded as only source */
  }
  return normalizePack({ pack_id: "empty", seconds_per_letter: DEFAULT_SEC_PER_LETTER, items: [] }, "empty");
}

function currentItem() {
  if (!state.pack || !state.pack.items.length) return { item_id: "none", word: "help" };
  return state.pack.items[state.itemIndex % state.pack.items.length];
}

function lettersForFloor(correctLetter, floorSeed) {
  const set = new Set();
  set.add(correctLetter);
  let guard = 0;
  while (set.size < WINDOWS && guard++ < 80) {
    const L = LETTERS[Math.abs((floorSeed * 17 + guard * 31) % LETTERS.length)];
    if (L !== correctLetter) set.add(L);
  }
  const arr = [...set];
  // shuffle deterministically-ish plus a little random so it's not always same slot
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.slice(0, WINDOWS);
}

function layoutWindows() {
  const w = state.word.toUpperCase();
  state.windowFaces = [];
  for (let f = 0; f < w.length; f++) {
    const letters = lettersForFloor(w[f], f + w.length * 13 + state.itemIndex * 7);
    state.windowFaces.push(
      letters.map((ch, i) => ({
        ch,
        face: (f * 5 + i + state.itemIndex) % 6,
        blink: Math.random(),
      }))
    );
  }
}

function startWord(index) {
  if (!state.pack || !state.pack.items.length) {
    state.phase = "tap";
    caption("No words in pack.");
    return;
  }
  state.itemIndex = ((index % state.pack.items.length) + state.pack.items.length) % state.pack.items.length;
  const it = currentItem();
  state.word = it.word.toLowerCase();
  state.itemId = it.item_id;
  state.floors = state.word.length;
  state.floor = 0;
  state.queuedSlot = null;
  state.letterArmed = false;
  armLetterTimer();
  state.introT = 0;
  state.hurryT = 0;
  state.slamI = 0;
  state.slamT = 0;
  state.winT = 0;
  state.loseT = 0;
  state.heloX = -200;
  state.heloY = 80;
  state.grandmaFly = 0;
  state.hug = 0;
  state.hugT = 0;
  state.climbing = false;
  state.ladderT = 0.35;
  state.climbT = 0;
  state.engulf = 0.12;
  state.ladderSlot = 2;
  state.wrongPulse = 0;
  state.lastWrong = -1;
  state.taps = [];
  state.errors = 0;
  state.roundStartedAt = new Date().toISOString();
  state.flames = [];
  state.sparks = [];
  layoutWindows();
  state.phase = "intro";
  playGrandmaRotate(GRANDMA_HELP, "grandmaHelpI");
}

function letterBudgetMs() {
  const sec = (state.pack && state.pack.seconds_per_letter) || DEFAULT_SEC_PER_LETTER;
  return Math.max(1000, Number(sec) * 1000);
}

function armLetterTimer() {
  state.timerMax = letterBudgetMs();
  state.timerMs = state.timerMax;
  state.letterArmed = true;
}

function beginPlay() {
  state.phase = "play";
  state.queuedSlot = null;
  armLetterTimer();
  state.hurryT = 0;
  speakSpell();
}

function nextWord() {
  const n = state.pack && state.pack.items ? state.pack.items.length : 0;
  if (!n || state.itemIndex >= n - 1) {
    state.phase = "results";
    caption(`Done. Score ${state.score}.`);
    speak("Great job! Tap play again.");
    return;
  }
  startWord(state.itemIndex + 1);
}

function playAgain() {
  stopNarrator();
  stopGrandma();
  state.score = 0;
  state.rescued = 0;
  state.burned = 0;
  startWord(0);
}

function tryAgain() {
  stopNarrator();
  stopGrandma();
  startWord(state.itemIndex);
}

function skipWord() {
  stopNarrator();
  stopGrandma();
  recordDay1({ result: "skip", skipped: true });
  nextWord();
}

function tapToPlay() {
  state.audioOn = true;
  ensureAudio();
  if (audioCtx && audioCtx.state === "suspended") audioCtx.resume();
  state.phase = "truck";
  state.truckX = -320;
  state.truckT = 0;
}

function onCorrect() {
  if (state.climbing) return;
  state.letterArmed = false;
  state.queuedSlot = null;
  sfxCorrect();
  state.climbing = true;
  state.ladderT = 0;
  state.climbT = 0;
  state.flash = 0.35;
  spawnSparks(cssW / 2, cssH * 0.55, 10, "#ffe27a");
}

function finishClimb() {
  state.climbing = false;
  state.floor += 1;
  state.engulf = 0.12;
  if (state.floor >= state.floors) winRound();
  else {
    armLetterTimer();
    playGrandmaRotate(GRANDMA_CHEER, "grandmaCheerI");
    const queued = state.queuedSlot;
    state.queuedSlot = null;
    if (queued != null) tapWindow(queued);
  }
}

function onWrong(slot) {
  sfxWrong();
  state.shake = 10;
  state.wrongPulse = 1;
  state.lastWrong = slot;
  state.engulf = 1;
  speakNo();
}

function winRound() {
  state.phase = "win";
  state.winT = 0;
  state.hug = 1;
  state.rescued += 1;
  state.score += 100 + Math.round(state.timerMs / 50);
  sfxWin();
  enqueueGrandma("g-thank-you");
  recordDay1({ result: "win", won: true, correct: 1 });
}

function loseRound() {
  if (state.phase === "lose") return;
  if (state.climbing || !state.letterArmed) return;
  stopGrandma();
  stopNarrator();
  state.phase = "lose";
  state.engulf = 1;
  state.loseT = 0;
  state.loseStage = "fire";
  state.heavenT = 0;
  state.collapseT = 0;
  state.slamI = 0;
  state.slamT = 0;
  state.burned += 1;
  sfxLose();
  const b = buildingRect();
  for (let i = 0; i < 40; i++) {
    spawnFlame(rand(-20, cssW + 20), rand(-10, cssH));
    spawnSparks(rand(0, cssW), rand(0, cssH), 2, "#ff6a1a");
  }
  recordDay1({ result: "lose", won: false, correct: 0 });
}

function tapWindow(slot) {
  if (state.phase !== "play") return;
  if (slot < 0 || slot >= WINDOWS) return;
  if (state.climbing) {
    state.queuedSlot = slot;
    return;
  }
  const floor = state.floor;
  if (floor >= state.floors) return;
  const row = state.windowFaces[floor];
  if (!row) return;
  const ch = row[slot].ch;
  const need = state.word.toUpperCase()[floor];
  state.taps.push(ch);
  state.ladderSlot = slot;
  state.popCh = ch;
  state.popT = 1;
  state.popSlot = slot;
  if (ch === need) onCorrect();
  else {
    state.errors += 1;
    onWrong(slot);
  }
}

/* ---------- layout / resize ---------- */
let cssW = 390;
let cssH = 844;
let dpr = 1;

function resize() {
  dpr = Math.min(PIXEL_CAP, window.devicePixelRatio || 1);
  cssW = Math.max(1, window.innerWidth);
  cssH = Math.max(1, window.innerHeight);
  canvas.width = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);
  canvas.style.width = cssW + "px";
  canvas.style.height = cssH + "px";
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
window.addEventListener("resize", resize);
resize();

function buildingRect() {
  const floors = Math.max(1, state.floors || 3);
  const top = cssH * 0.08;
  const bottom = cssH * 0.90;
  const avail = Math.max(300, bottom - top);
  const floorH = Math.max(56, Math.min(128, (avail - 20) / floors));
  const bh = floorH * floors + 22;
  const leftGutter = Math.max(56, cssW * 0.13);
  const bw = Math.min(cssW - leftGutter - 10, cssW * 0.84);
  const x = leftGutter;
  const y = bottom - bh;
  return { x, y, w: bw, h: bh, floorH };
}

function windowHit(floorIndex) {
  const b = buildingRect();
  const floors = Math.max(1, state.floors);
  const floorH = b.floorH || b.h / Math.max(1, floors);
  const gy = b.y + b.h - (floorIndex + 1) * floorH;
  const pad = 5;
  const ww = (b.w - pad * (WINDOWS + 1)) / WINDOWS;
  const wh = Math.min(floorH * 0.88, ww * 1.28);
  const wy = gy + (floorH - wh) * 0.35;
  const rects = [];
  for (let i = 0; i < WINDOWS; i++) {
    const wx = b.x + pad + i * (ww + pad);
    rects.push({ x: wx, y: wy, w: ww, h: wh });
  }
  return { gy, floorH, rects };
}

function hitTest(px, py) {
  if (state.phase === "tap") return { kind: "start" };
  if (state.phase === "results") return { kind: "again" };
  if (state.phase === "lose") {
    const tryR = { x: cssW * 0.12, y: cssH * 0.82, w: cssW * 0.36, h: 56 };
    const skipR = { x: cssW * 0.52, y: cssH * 0.82, w: cssW * 0.36, h: 56 };
    if (inRect(px, py, tryR)) return { kind: "retry" };
    if (inRect(px, py, skipR)) return { kind: "skip" };
  }
  if (state.phase === "play") {
    const { rects } = windowHit(state.floor);
    let best = -1;
    let bestD = SNAP_PX;
    for (let i = 0; i < rects.length; i++) {
      const r = {
        x: rects[i].x - HIT_PAD,
        y: rects[i].y - HIT_PAD,
        w: rects[i].w + HIT_PAD * 2,
        h: rects[i].h + HIT_PAD * 2,
      };
      if (inRect(px, py, r)) return { kind: "window", slot: i };
      const cx = rects[i].x + rects[i].w / 2;
      const cy = rects[i].y + rects[i].h / 2;
      const d = Math.hypot(px - cx, py - cy);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    if (best >= 0) return { kind: "window", slot: best };
  }
  return null;
}

function inRect(x, y, r) {
  return x >= r.x && y >= r.y && x <= r.x + r.w && y <= r.y + r.h;
}

function spawnSparks(x, y, n, color) {
  for (let i = 0; i < n; i++) {
    state.sparks.push({
      x,
      y,
      vx: rand(-80, 80),
      vy: rand(-160, -40),
      life: rand(0.4, 0.9),
      color: color || pick(["#ffd43b", "#ff8a3d", "#fff"]),
    });
  }
}

function spawnFlame(x, y) {
  const big = 22 + state.engulf * 48;
  state.flames.push({
    x,
    y,
    life: rand(0.5, 1.4),
    s: rand(big * 0.7, big),
  });
}

/* ---------- input ---------- */
function canvasPoint(e) {
  const r = canvas.getBoundingClientRect();
  const t = e.touches ? e.touches[0] || e.changedTouches[0] : e;
  return { x: t.clientX - r.left, y: t.clientY - r.top };
}

function onPointer(e) {
  e.preventDefault();
  const now = performance.now();
  if (now - lastPointerAt < TAP_DEBOUNCE_MS) return;
  lastPointerAt = now;
  const p = canvasPoint(e);
  const hit = hitTest(p.x, p.y);
  if (!hit) return;
  if (hit.kind === "start") tapToPlay();
  else if (hit.kind === "window") tapWindow(hit.slot);
  else if (hit.kind === "retry") tryAgain();
  else if (hit.kind === "skip") skipWord();
  else if (hit.kind === "again") playAgain();
}

canvas.addEventListener("pointerdown", (e) => {
  pointerDown = true;
  canvas.focus();
  onPointer(e);
});
canvas.addEventListener("touchstart", (e) => {
  e.preventDefault();
  onPointer(e);
}, { passive: false });

window.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
  if (state.phase === "tap") tapToPlay();
  else if (state.phase === "lose") tryAgain();
  else if (state.phase === "results") playAgain();
  return;
  }
  if (state.phase === "play") {
    const n = Number(e.key);
    if (n >= 1 && n <= 5) tapWindow(n - 1);
  }
});

if (toolsToggle && toolsBody) {
  toolsToggle.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    toolsBody.hidden = !toolsBody.hidden;
  });
}
if (voiceBellaBtn) voiceBellaBtn.addEventListener("click", () => setTtsGender("female"));
if (voicePuckBtn) voicePuckBtn.addEventListener("click", () => setTtsGender("male"));
if (speakAnyBtn) {
  speakAnyBtn.addEventListener("click", () => {
    const text = (anyTextEl && anyTextEl.value) || "";
    if (!text.trim()) {
      caption("Type something first.");
      return;
    }
    state.audioOn = true;
    ensureAudio();
    stopNarrator();
    caption(text.trim());
    playOfflineTts(text.trim(), () => {});
    const w = text.trim().toLowerCase().replace(/[^a-z]/g, "");
    if (w && w.length > 1 && !BAKED_WORDS.has(w) && ttsStatusEl) {
      ttsStatusEl.textContent = "That word is not in this game’s voices yet. Try one, two, three, four, or five.";
    }
  });
}
if (anyTextEl) {
  anyTextEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (speakAnyBtn) speakAnyBtn.click();
    }
  });
}

if (applyBtn) {
  applyBtn.addEventListener("click", () => {
    const text = (pasteEl && pasteEl.value) || "";
    const pack = packFromLines(text, "custom-paste");
    if (!pack.items.length) {
      caption("Paste one word per line.");
      return;
    }
    try { localStorage.setItem(CUSTOM_KEY, text); } catch { /* ignore */ }
    state.pack = pack;
    state.packId = pack.pack_id;
    state.score = 0;
    state.rescued = 0;
    state.burned = 0;
    if (state.phase === "boot" || state.phase === "tap") {
      caption(`Custom pack ready (${pack.items.length} words). Tap to play.`);
    } else {
      startWord(0);
    }
  });
}

/* ---------- update ---------- */
function update(dt) {
  state.t0 += dt;
  if (state.shake > 0) state.shake *= Math.pow(0.04, dt);
  if (state.flash > 0) state.flash = Math.max(0, state.flash - dt * 2);
  if (state.wrongPulse > 0) state.wrongPulse = Math.max(0, state.wrongPulse - dt * 2.2);
  if (state.popT > 0) state.popT = Math.max(0, state.popT - dt * 0.85);

  for (const s of state.sparks) {
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    s.vy += 280 * dt;
    s.life -= dt;
  }
  state.sparks = state.sparks.filter((s) => s.life > 0);
  for (const f of state.flames) f.life -= dt;
  state.flames = state.flames.filter((f) => f.life > 0);

  if (state.phase === "intro") {
    state.introT += dt;
    if (state.introT > 2.4 && !gmBusy && !gmQ.length) beginPlay();
    else if (state.introT > 7) beginPlay();
  }

  if (state.phase === "play") {
    if (!state.climbing && state.letterArmed) {
      state.timerMs = Math.max(0, state.timerMs - dt * 1000);
      if (state.timerMs <= 0) loseRound();
    }
    state.hurryT += dt;
    if (state.hurryT >= 8 && !gmBusy && gmQ.length === 0) {
      state.hurryT = 0;
      playGrandmaRotate(GRANDMA_HELP, "grandmaHelpI");
    }
    if (Math.random() < dt * (5 + state.engulf * 18)) {
      const b = buildingRect();
      spawnFlame(rand(b.x - 8, b.x + b.w + 8), rand(b.y - 20, b.y + b.h * 0.45));
    }
  }

  if ((state.phase === "intro" || state.phase === "truck") && Math.random() < dt * 5) {
    const b = buildingRect();
    spawnFlame(rand(b.x, b.x + b.w), b.y - 10);
  }

  if (state.phase === "win") {
    state.winT += dt;
    state.hugT += dt;
    if (state.winT > 2.1) {
      const n = (state.pack && state.pack.items && state.pack.items.length) || 0;
      const last = state.itemIndex >= n - 1;
      const cleanSweep = state.burned === 0 && last;
      if (cleanSweep) {
        state.phase = "fly";
        state.heloX = -200;
        state.grandmaFly = 0;
        sfxHelo();
      } else {
        nextWord();
      }
    }
  }

  if (state.phase === "truck") {
    state.truckT += dt;
    state.truckX = Math.min(28, -320 + state.truckT * 220);
    if (state.truckT < 2.4 && Math.floor(state.t0 * 9) !== Math.floor((state.t0 - dt) * 9)) sfxSiren();
    if (state.truckT > 2.8) startWord(0);
  }

  if (state.climbing && state.phase === "play") {
    if (state.ladderT < 1) state.ladderT = Math.min(1, state.ladderT + dt * 2.4);
    else {
      state.climbT = Math.min(1, state.climbT + dt * 1.8);
      if (state.climbT >= 1) finishClimb();
    }
  }

  if (state.phase === "play" && !state.climbing && state.engulf > 0.12) {
    state.engulf = Math.max(0.12, state.engulf - dt * 0.35);
  }

  if (state.phase === "fly") {
    state.winT += dt;
    state.heloX += 140 * dt;
    if (state.heloX > cssW * 0.38) state.grandmaFly += dt;
    if (state.heloX > cssW + 180) nextWord();
  }

  if (state.phase === "lose") {
    state.loseT += dt;
    if (Math.random() < dt * 28) {
      spawnFlame(rand(-30, cssW + 30), rand(-20, cssH + 10));
      spawnSparks(rand(0, cssW), rand(0, cssH), 4, "#ff6a1a");
    }
    if (state.loseStage === "fire" && state.loseT >= HEAVEN_AFTER) {
      state.loseStage = "collapse";
      state.collapseT = 0;
    }
    if (state.loseStage === "collapse") {
      state.collapseT += dt;
      if (state.collapseT >= COLLAPSE_S) {
        state.loseStage = "heaven";
        state.heavenT = 0;
        startHeavenSpell();
      }
    }
    if (state.loseStage === "heaven") {
      state.heavenT += dt;
      if (state.slamI < (state.word || "").length) {
        state.slamT += dt * 1000;
      }
    }
  }
}

/* ---------- draw ---------- */
function roundRect(x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function drawSky() {
  const g = ctx.createLinearGradient(0, 0, 0, cssH);
  g.addColorStop(0, "#1a3a78");
  g.addColorStop(0.45, "#3d6ad6");
  g.addColorStop(0.75, "#f4a15a");
  g.addColorStop(1, "#ff6a3d");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, cssW, cssH);

  // clouds
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  for (let i = 0; i < 5; i++) {
    const cx = ((i * 170 + state.t0 * 12) % (cssW + 160)) - 80;
    const cy = 40 + (i % 3) * 28;
    blob(cx, cy, 28);
    blob(cx + 24, cy + 6, 20);
    blob(cx - 22, cy + 8, 16);
  }
}

function blob(x, y, r) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

function drawGround() {
  ctx.fillStyle = "#2d8a3e";
  ctx.fillRect(0, cssH * 0.86, cssW, cssH * 0.14);
  ctx.fillStyle = "#246f32";
  ctx.fillRect(0, cssH * 0.86, cssW, 10);
  const tx = state.phase === "truck" || state.phase === "tap" ? state.truckX : 8;
  const ty = cssH * 0.72;
  const tw = 280;
  const th = 118;
  if (!drawImg(sprites.truck, tx, ty, tw, th)) {
    ctx.fillStyle = "#c1121f";
    roundRect(tx, ty + 18, 180, 58, 8);
    ctx.fill();
    ctx.fillStyle = "#ffd43b";
    roundRect(tx + 110, ty + 26, 58, 28, 4);
    ctx.fill();
    ctx.fillStyle = "#111";
    ctx.beginPath();
    ctx.arc(tx + 40, ty + 78, 16, 0, Math.PI * 2);
    ctx.arc(tx + 140, ty + 78, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.font = "700 16px Fredoka, sans-serif";
    ctx.fillText("FIRE", tx + 18, ty + 52);
  }
  if (state.phase === "truck") {
    ctx.fillStyle = "#ffd43b";
    ctx.font = "700 18px Fredoka, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("FIRE TRUCK INCOMING", cssW / 2, cssH * 0.18);
  }
}

function drawFirefighter(x, y, scale) {
  const w = 58 * scale;
  const h = 84 * scale;
  if (drawImg(sprites.fireman, x - w / 2, y - h * 0.72, w, h)) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.fillStyle = "#1a1a1a";
  roundRect(-14, 28, 12, 22, 3);
  ctx.fill();
  roundRect(2, 28, 12, 22, 3);
  ctx.fill();
  ctx.fillStyle = "#c1121f";
  roundRect(-20, -6, 40, 42, 6);
  ctx.fill();
  ctx.fillStyle = "#ffd43b";
  roundRect(-20, 8, 40, 7, 2);
  ctx.fill();
  ctx.fillStyle = "#e8b48a";
  ctx.beginPath();
  ctx.arc(0, -18, 13, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#d90429";
  ctx.beginPath();
  ctx.ellipse(0, -28, 18, 12, 0, Math.PI, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(-18, -28, 36, 8);
  ctx.fillStyle = "#ffd43b";
  ctx.fillRect(-4, -36, 8, 10);
  ctx.fillStyle = "#111";
  ctx.fillRect(-16, -22, 32, 6);
  ctx.restore();
}

function drawGrandma(x, y, scale, flying) {
  const w = 70 * scale;
  const h = 98 * scale;
  if (flying) drawAngelWings(x, y - h * 0.12, scale);
  if (drawImg(sprites.grandma, x - w / 2, y - h * 0.7, w, h)) {
    if (flying) drawHalo(x, y - h * 0.78, scale);
    return;
  }
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  if (flying) ctx.rotate(-0.25);
  ctx.fillStyle = "#d97706";
  ctx.beginPath();
  ctx.moveTo(-24, 8);
  ctx.lineTo(24, 8);
  ctx.lineTo(18, 42);
  ctx.lineTo(-18, 42);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#f3c09a";
  ctx.beginPath();
  ctx.ellipse(0, 8, 20, 18, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(0, -16, 18, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#e7e5e4";
  ctx.beginPath();
  ctx.arc(0, -30, 11, 0, Math.PI * 2);
  ctx.arc(-14, -20, 9, 0, Math.PI * 2);
  ctx.arc(14, -20, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#444";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(-7, -16, 6, 0, Math.PI * 2);
  ctx.arc(7, -16, 6, 0, Math.PI * 2);
  ctx.moveTo(-1, -16);
  ctx.lineTo(1, -16);
  ctx.stroke();
  ctx.restore();
}

function drawAngelWings(x, y, scale) {
  const flap = 0.22 + Math.sin(state.t0 * 4.5) * 0.10;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale * 1.85, scale * 1.85);
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.scale(side, 1);
    ctx.rotate(-flap);
    ctx.fillStyle = "rgba(255,255,255,0.96)";
    ctx.strokeStyle = "rgba(255,220,140,0.9)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(6, 8);
    ctx.quadraticCurveTo(70, -70, 110, -8);
    ctx.quadraticCurveTo(88, 28, 42, 26);
    ctx.quadraticCurveTo(78, 8, 6, 14);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(18, 6);
    ctx.quadraticCurveTo(58, -36, 92, -2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(22, 12);
    ctx.quadraticCurveTo(54, -8, 80, 10);
    ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
}

function drawHalo(x, y, scale) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.strokeStyle = "#ffe27a";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.ellipse(0, -6, 18, 6, -0.15, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = "rgba(255,255,220,0.7)";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
}

function drawAngelAscent() {
  if (state.phase !== "lose" || state.loseStage !== "heaven") return;
  const t = state.heavenT;
  const bob = Math.sin(t * 2.2) * 10;
  const x = cssW / 2;
  const y = cssH * 0.20 + bob;
  ctx.save();
  drawAngelWings(x, y + 12, 1.5);
  drawHalo(x, y - 70, 1.55);
  drawGrandma(x, y, 1.08, false);
  ctx.strokeStyle = "#c2410c";
  ctx.lineWidth = 4;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.arc(x, y + 8, 13, 0.2, Math.PI - 0.2);
  ctx.stroke();
  ctx.fillStyle = "#fff8e0";
  ctx.font = "700 16px Fredoka, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("Grandma is an angel now — she's happy!", x, y + 78);
  ctx.restore();
}

function drawLadderToWindow() {
  if (state.phase === "lose") return;
  const floor = Math.min(state.floor, Math.max(0, state.floors - 1));
  const { rects } = windowHit(floor);
  const slot = Math.max(0, Math.min(WINDOWS - 1, state.ladderSlot));
  const win = rects[slot];
  if (!win) return;
  const b = buildingRect();
  const groundY = cssH * 0.88;
  const groundX = Math.max(18, b.x - 36);
  const topY = win.y + win.h * 0.55;
  const topX = win.x - 4;
  const t = state.phase === "play" || state.phase === "intro" ? Math.max(0.35, state.ladderT || 0.4) : 0.25;
  const x2 = groundX + (topX - groundX) * t;
  const y2 = groundY + (topY - groundY) * t;
  ctx.save();
  ctx.strokeStyle = "#d4af37";
  ctx.lineWidth = 5;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(groundX - 7, groundY);
  ctx.lineTo(x2 - 7, y2);
  ctx.moveTo(groundX + 7, groundY);
  ctx.lineTo(x2 + 7, y2);
  ctx.stroke();
  const steps = 9;
  ctx.lineWidth = 3;
  for (let i = 1; i < steps; i++) {
    const p = i / steps;
    if (p > t) break;
    const x = groundX + (x2 - groundX) * p;
    const y = groundY + (y2 - groundY) * p;
    ctx.beginPath();
    ctx.moveTo(x - 9, y);
    ctx.lineTo(x + 9, y);
    ctx.stroke();
  }
  ctx.restore();
}

function drawFace(x, y, s, kind, t) {
  ctx.save();
  ctx.translate(x, y);
  const blink = (Math.sin(t * 3 + kind) + 1) < 0.08 ? 0.2 : 1;
  ctx.fillStyle = "#1a0a08";
  ctx.beginPath();
  ctx.ellipse(-s * 0.18, -s * 0.08, s * 0.07, s * 0.07 * blink, 0, 0, Math.PI * 2);
  ctx.ellipse(s * 0.18, -s * 0.08, s * 0.07, s * 0.07 * blink, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#1a0a08";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  if (kind % 2 === 0) ctx.arc(0, s * 0.12, s * 0.16, 0.1, Math.PI - 0.1);
  else ctx.arc(0, s * 0.22, s * 0.16, Math.PI + 0.2, -0.2);
  ctx.stroke();
  ctx.restore();
}

function drawBuilding() {
  if (state.phase === "lose" && state.loseStage === "heaven") return;
  const b = buildingRect();
  const floors = Math.max(1, state.floors);
  const burn = state.phase === "lose" ? 1 : state.engulf;
  const fall = state.phase === "lose" && state.loseStage === "collapse"
    ? clamp(state.collapseT / COLLAPSE_S, 0, 1)
    : 0;

  ctx.save();
  if (fall > 0) {
    ctx.translate(b.x + b.w / 2, b.y + b.h);
    ctx.scale(1 + fall * 0.12, Math.max(0.04, 1 - fall * 0.92));
    ctx.translate(-(b.x + b.w / 2), -(b.y + b.h));
    ctx.globalAlpha = 1 - fall * 0.75;
  }
  if (state.shake > 0.4) {
    ctx.translate((Math.random() - 0.5) * state.shake, (Math.random() - 0.5) * state.shake);
  }

  // brick
  const brick = ctx.createLinearGradient(b.x, b.y, b.x + b.w, b.y + b.h);
  brick.addColorStop(0, "#e85d4c");
  brick.addColorStop(0.5, "#c44536");
  brick.addColorStop(1, mixBurn("#9b2c20", burn));
  ctx.fillStyle = brick;
  roundRect(b.x, b.y, b.w, b.h, 10);
  ctx.fill();
  ctx.strokeStyle = "#6b1c14";
  ctx.lineWidth = 4;
  ctx.stroke();

  // brick lines
  ctx.strokeStyle = "rgba(80,20,16,0.25)";
  ctx.lineWidth = 1;
  const rows = 12;
  for (let r = 1; r < rows; r++) {
    const yy = b.y + (b.h / rows) * r;
    ctx.beginPath();
    ctx.moveTo(b.x + 4, yy);
    ctx.lineTo(b.x + b.w - 4, yy);
    ctx.stroke();
  }

  // roof
  ctx.fillStyle = "#3d2b1f";
  ctx.beginPath();
  ctx.moveTo(b.x - 16, b.y + 8);
  ctx.lineTo(b.x + b.w / 2, b.y - 48);
  ctx.lineTo(b.x + b.w + 16, b.y + 8);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#ffd43b";
  ctx.fillRect(b.x + b.w / 2 - 8, b.y - 70, 16, 28);
  ctx.fillStyle = "#e11d2e";
  ctx.beginPath();
  ctx.moveTo(b.x + b.w / 2 - 8, b.y - 70);
  ctx.lineTo(b.x + b.w / 2 + 22, b.y - 62);
  ctx.lineTo(b.x + b.w / 2 - 8, b.y - 54);
  ctx.closePath();
  ctx.fill();

  // grandma on roof (hidden in lose — fire covers her)
  if (state.phase !== "lose" && (state.phase !== "fly" || state.grandmaFly < 0.05)) {
    const gx = b.x + b.w / 2;
    const gy = b.y - 10;
    if (state.phase === "win" || state.hug) {
      if (!drawImg(sprites.hug, gx - 56, gy - 52, 112, 104)) {
        drawGrandma(gx + 14, gy, 0.72, false);
        drawFirefighter(gx - 18, gy + 8, 0.7);
      }
    } else {
      drawGrandma(gx, gy, 0.78, false);
    }
  }

  drawLadderToWindow();
  if ((state.phase === "play" || state.phase === "intro") && state.phase !== "lose") {
    const f = Math.min(state.floor, Math.max(0, floors - 1));
    const { rects: r0 } = windowHit(f);
    const slot = Math.max(0, Math.min(WINDOWS - 1, state.ladderSlot));
    const mid = r0[slot] || r0[2] || r0[0];
    const groundY = cssH * 0.86;
    const topY = mid ? mid.y + mid.h * 0.7 : groundY;
    const p = state.climbing ? state.climbT : 0.05;
    const climbY = groundY + (topY - groundY) * p;
    const fx = Math.max(28, b.x - 34);
    drawFirefighter(fx, climbY, 0.72);
  }

  for (let f = 0; f < floors; f++) {
    const { rects } = windowHit(f);
    const row = state.windowFaces[f] || [];
    const climbed = state.floor > f;
    const current = state.phase === "play" && state.floor === f;
    for (let i = 0; i < WINDOWS; i++) {
      const r = rects[i];
      const cell = row[i] || { ch: "?", face: 0 };
      ctx.fillStyle = climbed ? "#ffe08a" : current ? "#7ad7ff" : "#16324a";
      if (state.phase === "lose") ctx.fillStyle = mixBurn("#4a1a12", burn);
      roundRect(r.x, r.y, r.w, r.h, 6);
      ctx.fill();
      ctx.strokeStyle = current ? "#fff36a" : "#2a140c";
      ctx.lineWidth = current ? 4 : 2;
      ctx.stroke();
      if (state.lastWrong === i && current && state.wrongPulse > 0) {
        ctx.fillStyle = `rgba(255,40,40,${state.wrongPulse * 0.55})`;
        roundRect(r.x, r.y, r.w, r.h, 6);
        ctx.fill();
      }
      const fs = Math.min(r.h * 0.78, r.w * 0.88);
      ctx.font = `700 ${fs}px Luckiest Guy, Fredoka, Impact, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = climbed ? "#c44536" : "#fff8e8";
      ctx.fillText(cell.ch, r.x + r.w / 2, r.y + r.h * 0.46);
      drawFace(r.x + r.w / 2, r.y + r.h * 0.82, r.w, cell.face, state.t0 + i);
    }
    if (climbed || (state.phase === "play" && state.floor === f) || state.phase === "intro") {
      /* ladder marks */
    }
  }

  ctx.restore();

  for (const fl of state.flames) {
    ctx.globalAlpha = clamp(fl.life, 0, 1);
    const img = sprites.flames;
    if (img && img.complete && img.naturalWidth > 0) {
      const s = fl.s * 2.2;
      ctx.drawImage(img, fl.x - s * 0.5, fl.y - s, s, s);
    } else {
    ctx.fillStyle = "#ff9a1a";
    ctx.beginPath();
    ctx.moveTo(fl.x, fl.y);
    ctx.quadraticCurveTo(fl.x + fl.s * 0.4, fl.y - fl.s, fl.x, fl.y - fl.s * 1.6);
    ctx.quadraticCurveTo(fl.x - fl.s * 0.4, fl.y - fl.s, fl.x, fl.y);
    ctx.fill();
    ctx.fillStyle = "#ffe27a";
    ctx.beginPath();
    ctx.moveTo(fl.x, fl.y);
    ctx.quadraticCurveTo(fl.x + 4, fl.y - fl.s * 0.5, fl.x, fl.y - fl.s * 0.9);
    ctx.quadraticCurveTo(fl.x - 4, fl.y - fl.s * 0.5, fl.x, fl.y);
    ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}

function mixBurn(hex, amt) {
  return amt > 0.5 ? "#3a0c08" : hex;
}

function drawHelo() {
  if (state.phase !== "fly") return;
  const x = state.phase === "win" ? -80 : state.heloX;
  const y = state.heloY + Math.sin(state.t0 * 10) * 4;
  ctx.save();
  ctx.translate(x, y);
  if (!drawImg(sprites.helicopter, -90, -40, 200, 90)) {
  ctx.fillStyle = "#c1121f";
  roundRect(-70, -14, 140, 36, 12);
  ctx.fill();
  ctx.fillStyle = "#111";
  roundRect(30, -28, 50, 22, 8);
  ctx.fill();
  }
  ctx.strokeStyle = "#eee";
  ctx.lineWidth = 4;
  ctx.beginPath();
  const spin = state.t0 * 50;
  ctx.moveTo(-90, -28);
  ctx.lineTo(90, -28);
  ctx.moveTo(Math.cos(spin) * 88, -28);
  ctx.lineTo(-Math.cos(spin) * 88, -28);
  ctx.stroke();
  ctx.strokeStyle = "#ffd43b";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(0, 16);
  ctx.lineTo(0, 110);
  ctx.stroke();
  for (let i = 0; i < 7; i++) {
    ctx.beginPath();
    ctx.moveTo(-12, 28 + i * 12);
    ctx.lineTo(12, 28 + i * 12);
    ctx.stroke();
  }
  if (state.grandmaFly > 0) {
    drawGrandma(8, 50 + Math.min(state.grandmaFly * 40, 50), 0.85, false);
    drawFirefighter(-18, 58, 0.55);
  }
  ctx.restore();
}

function drawHud() {
  if (state.phase === "lose" && state.loseStage === "heaven") return;
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillStyle = "#fff8e0";
  ctx.font = "700 22px Luckiest Guy, Fredoka, sans-serif";
  ctx.fillText("FIREFIGHTER SPELLING", 14, 10);
  ctx.font = "600 14px Fredoka, sans-serif";
  ctx.fillText(`v${VERSION}  Score ${state.score}   ${studentId}`, 14, 36);

  if (state.phase === "play" || state.phase === "intro") {
    const pct = state.phase === "play" ? state.timerMs / state.timerMax : 1;
    const bx = cssW * 0.12;
    const by = cssH * 0.12;
    const bw = cssW * 0.76;
    ctx.fillStyle = "#1a0a08";
    roundRect(bx, by, bw, 18, 9);
    ctx.fill();
    ctx.fillStyle = pct > 0.3 ? "#3ddc84" : "#ff5c5c";
    roundRect(bx + 2, by + 2, Math.max(0, (bw - 4) * pct), 14, 7);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.font = "700 12px Fredoka, sans-serif";
    ctx.textAlign = "center";
    const sec = state.phase === "play" ? Math.ceil(state.timerMs / 1000) : Math.ceil(state.timerMax / 1000);
    ctx.fillText(`${sec}s`, cssW / 2, by + 2);
  }

  ctx.textAlign = "center";
  ctx.fillStyle = "#fff8e0";
  ctx.font = "700 18px Fredoka, sans-serif";
  if (state.phase === "intro") {
    ctx.fillText("Help Grandma! Listen…", cssW / 2, cssH * 0.17);
  } else if (state.phase === "play") {
    ctx.fillText(`Floor ${state.floor + 1} / ${state.floors}  ·  tap the letter`, cssW / 2, cssH * 0.17);
  }
}

function drawButton(r, label, color) {
  ctx.fillStyle = color;
  roundRect(r.x, r.y, r.w, r.h, 14);
  ctx.fill();
  ctx.strokeStyle = "#fff8e0";
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.fillStyle = "#1a0a08";
  ctx.font = "700 18px Fredoka, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, r.x + r.w / 2, r.y + r.h / 2);
}

function drawOverlay() {
  if (state.phase === "tap" || state.phase === "boot") {
    ctx.fillStyle = "rgba(7,20,40,0.45)";
    ctx.fillRect(0, 0, cssW, cssH);
    ctx.fillStyle = "#ffd43b";
    ctx.textAlign = "center";
    ctx.font = "700 42px Luckiest Guy, Impact, sans-serif";
    ctx.fillText("TAP TO PLAY", cssW / 2, cssH * 0.48);
    ctx.fillStyle = "#fff8e0";
    ctx.font = "600 16px Fredoka, sans-serif";
    ctx.fillText("Phone, tablet, or computer.", cssW / 2, cssH * 0.55);
    ctx.fillText("Tap a window or press 1–5. Enter starts.", cssW / 2, cssH * 0.60);
  }

  if (state.phase === "play" && state.popT > 0 && state.popCh) {
    const p = state.popT;
    ctx.save();
    ctx.translate(cssW / 2, cssH * 0.38);
    const s = 0.9 + p * 1.7;
    ctx.scale(s, s);
    ctx.globalAlpha = Math.min(1, p * 1.2);
    ctx.fillStyle = "#fff36a";
    ctx.strokeStyle = "#1a0a08";
    ctx.lineWidth = 10;
    ctx.font = `900 ${Math.min(cssW * 0.28, 150)}px Luckiest Guy, Impact, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.strokeText(state.popCh, 0, 0);
    ctx.fillText(state.popCh, 0, 0);
    ctx.restore();
  }

  if (state.phase === "lose") {
    const w = state.word.toUpperCase();
    if (state.loseStage === "fire" || state.loseStage === "collapse") {
      ctx.fillStyle = "rgba(80,8,0,0.72)";
      ctx.fillRect(0, 0, cssW, cssH);
      for (let i = 0; i < 18; i++) {
        const img = sprites.flames;
        const x = ((i * 97 + state.t0 * 40) % (cssW + 80)) - 40;
        const y = (i * 73 + state.t0 * 90) % cssH;
        const s = 140 + (i % 5) * 40;
        if (img && img.complete && img.naturalWidth > 0) {
          ctx.globalAlpha = 0.85;
          ctx.drawImage(img, x, y - s * 0.4, s, s);
          ctx.globalAlpha = 1;
        }
      }
      ctx.fillStyle = "#ffd43b";
      ctx.textAlign = "center";
      ctx.font = "700 28px Luckiest Guy, Impact, sans-serif";
      ctx.fillText("THE BUILDING BURNS", cssW / 2, cssH * 0.48);
      return;
    }

    const beam = ctx.createRadialGradient(cssW / 2, -20, 10, cssW / 2, cssH * 0.45, cssH * 0.7);
    beam.addColorStop(0, "rgba(255,255,220,0.95)");
    beam.addColorStop(0.25, "rgba(255,236,150,0.45)");
    beam.addColorStop(1, "rgba(20,10,0,0.55)");
    ctx.fillStyle = beam;
    ctx.fillRect(0, 0, cssW, cssH);
    ctx.fillStyle = "rgba(255,255,255,0.88)";
    for (let i = 0; i < 6; i++) {
      const cx = cssW * (0.12 + i * 0.15);
      const cy = 40 + Math.sin(state.t0 + i) * 8;
      ctx.beginPath();
      ctx.ellipse(cx, cy, 70, 28, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.beginPath();
    ctx.moveTo(cssW * 0.38, 0);
    ctx.lineTo(cssW * 0.62, 0);
    ctx.lineTo(cssW * 0.72, cssH);
    ctx.lineTo(cssW * 0.28, cssH);
    ctx.closePath();
    ctx.fillStyle = "rgba(255,250,200,0.22)";
    ctx.fill();
    drawAngelAscent();

    const shown = w.slice(0, state.slamI);
    const slamCh = state.slamI < w.length ? w[state.slamI] : "";
    const slamP = clamp(state.slamT / SLAM_MS, 0, 1);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#fff8c8";
    ctx.font = `900 ${Math.min(cssW * 0.22, 110)}px Luckiest Guy, Impact, sans-serif`;
    ctx.fillText(shown, cssW / 2, cssH * 0.50);
    if (slamCh) {
      const s = 0.5 + slamP * 1.3;
      ctx.save();
      ctx.translate(cssW / 2, cssH * 0.64);
      ctx.scale(s, s);
      ctx.globalAlpha = Math.min(1, slamP * 1.4);
      ctx.fillStyle = "#ffe27a";
      ctx.fillText(slamCh, 0, 0);
      ctx.restore();
    }
    if (state.slamI >= w.length && state.narrDone) {
      ctx.fillStyle = "#fff8e0";
      ctx.font = "700 22px Fredoka, sans-serif";
      ctx.fillText(`The word is ${w}`, cssW / 2, cssH * 0.72);
      drawButton({ x: cssW * 0.12, y: cssH * 0.82, w: cssW * 0.36, h: 56 }, "Try again", "#ffd43b");
      drawButton({ x: cssW * 0.52, y: cssH * 0.82, w: cssW * 0.36, h: 56 }, "Skip", "#7ad7ff");
    }
  }

  if (state.phase === "results") {
    ctx.fillStyle = "rgba(7,20,40,0.72)";
    ctx.fillRect(0, 0, cssW, cssH);
    ctx.textAlign = "center";
    ctx.fillStyle = "#ffd43b";
    ctx.font = "700 36px Luckiest Guy, Impact, sans-serif";
    ctx.fillText("RESCUE DONE", cssW / 2, cssH * 0.28);
    ctx.fillStyle = "#fff8e0";
    ctx.font = "700 20px Fredoka, sans-serif";
    const n = (state.pack && state.pack.items && state.pack.items.length) || 0;
    ctx.fillText(`Saved ${state.rescued}   Burned ${state.burned}   of ${n}`, cssW / 2, cssH * 0.42);
    ctx.fillText(`Score ${state.score}`, cssW / 2, cssH * 0.50);
    drawButton({ x: cssW * 0.18, y: cssH * 0.62, w: cssW * 0.64, h: 64 }, "PLAY AGAIN", "#ffd43b");
  }

  if (state.flash > 0) {
    ctx.fillStyle = `rgba(255,240,120,${state.flash * 0.35})`;
    ctx.fillRect(0, 0, cssW, cssH);
  }
}

function drawSparks() {
  for (const s of state.sparks) {
    ctx.globalAlpha = clamp(s.life, 0, 1);
    ctx.fillStyle = s.color;
    ctx.beginPath();
    ctx.arc(s.x, s.y, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function frame(ts) {
  const dt = lastTs ? Math.min(0.05, (ts - lastTs) / 1000) : 0.016;
  lastTs = ts;
  update(dt);
  ctx.clearRect(0, 0, cssW, cssH);
  drawSky();
  const clearLose = state.phase === "lose" && state.loseStage === "heaven";
  if (!clearLose) {
    drawGround();
    drawBuilding();
    drawHelo();
    drawSparks();
  }
  drawHud();
  drawOverlay();
  requestAnimationFrame(frame);
}

window.FirefighterSpelling = {
  getState() {
    return {
      api: API,
      version: VERSION,
      packId: state.packId,
      word: state.word,
      floor: state.floor,
      floors: state.floors,
      timerMs: Math.round(state.timerMs),
      timerMax: Math.round(state.timerMax),
      letterArmed: !!state.letterArmed,
      climbing: !!state.climbing,
      faces: (state.windowFaces[state.floor] || []).map((c) => c.ch),
      need: (state.word || "").toUpperCase()[state.floor] || "",
      phase: state.phase,
      score: state.score,
      lastRecord: state.lastRecord,
    };
  },
};

(async function boot() {
  state.phase = "boot";
  try {
    const savedVoice = localStorage.getItem(VOICE_KEY);
    if (savedVoice) setTtsGender(savedVoice);
    else setTtsGender(state.ttsGender);
  } catch {
    setTtsGender(state.ttsGender);
  }
  if (ttsStatusEl) {
    ttsStatusEl.textContent = "Voices are ready. Tap TAP TO PLAY to hear Grandma.";
  }
  let pack = null;
  try {
    const saved = localStorage.getItem(CUSTOM_KEY);
    if (saved && pasteEl) {
      pasteEl.value = saved;
      const custom = packFromLines(saved, "custom-paste");
      if (custom.items.length) pack = custom;
    }
  } catch { /* ignore */ }
  if (!pack) pack = await fetchPack();
  state.pack = pack;
  state.packId = pack.pack_id;
  state.phase = "tap";
  caption("Tap to play.");
  canvas.focus();
  requestAnimationFrame(frame);
})();
