// Firefighter Spelling rules — kept exactly as the original engine (v1.15 / Word Master v1.11).
// Pure functions: no DOM, so they run in node tests and in any webview (Capacitor / Tauri).
export const WINDOWS = 5;
export const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
export const DEFAULT_SEC_PER_LETTER = 5;
export const HEAVEN_AFTER = 2.4; // seconds of fire before the spelling replay
export const COLLAPSE_S = 1.7;
export const HURRY_EVERY = 16; // Grandma calls for help after this many quiet seconds
export const BAKED_WORDS = new Set(["one", "two", "three", "four", "five"]);

export function cleanWord(w) { return String(w || "").trim().toLowerCase().replace(/[^a-z]/g, ""); }

export function normalizePack(raw, sourceId) {
  const items = (raw.items || [])
    .map((it, i) => {
      const word = cleanWord(it.word || it);
      if (!word) return null;
      return { item_id: it.item_id || `${sourceId}-${i}-${word}`, word, audio: it.audio || "" };
    })
    .filter(Boolean);
  return {
    pack_id: raw.pack_id || sourceId || "custom",
    title: raw.title || "",
    module_id: raw.module_id || "firefighter_spelling",
    activity_id: raw.activity_id || "grandma_rescue",
    skill_tags: raw.skill_tags || ["spelling"],
    seconds_per_letter: Number(raw.seconds_per_letter) > 0 ? Number(raw.seconds_per_letter) : DEFAULT_SEC_PER_LETTER,
    items,
  };
}

export function packFromLines(text, id) {
  const items = String(text || "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"))
    .map((word, i) => ({ item_id: `${id}-${i}`, word: cleanWord(word) }))
    .filter((it) => it.word);
  return normalizePack({ pack_id: id, seconds_per_letter: DEFAULT_SEC_PER_LETTER, items }, id);
}

// Word Master ?words=a,b,c fallback (same as the WM v1.11 engine).
export function packFromWordsParam(raw, packId, voice = "us_m") {
  const items = String(raw || "").split(",").map(cleanWord).filter(Boolean).map((word) => ({
    item_id: word, word, audio: packId ? `../../packs/${packId}/audio/${voice}/${word}.mp3` : "",
  }));
  if (!items.length) return null;
  return normalizePack({ pack_id: packId || "url-words", seconds_per_letter: DEFAULT_SEC_PER_LETTER, items }, "url-words");
}

// Five window letters for one floor: the needed letter + 4 decoys, shuffled.
export function lettersForFloor(correctLetter, floorSeed, rnd = Math.random) {
  const set = new Set([correctLetter]);
  let guard = 0;
  while (set.size < WINDOWS && guard++ < 80) {
    const L = LETTERS[Math.abs((floorSeed * 17 + guard * 31) % LETTERS.length)];
    if (L !== correctLetter) set.add(L);
  }
  const arr = [...set];
  for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; }
  return arr.slice(0, WINDOWS);
}

export function layoutFloors(word, itemIndex, rnd = Math.random) {
  const w = String(word || "").toUpperCase();
  const rows = [];
  for (let f = 0; f < w.length; f++) rows.push(lettersForFloor(w[f], f + w.length * 13 + itemIndex * 7, rnd));
  return rows;
}

export function letterBudgetMs(pack) {
  const sec = (pack && pack.seconds_per_letter) || DEFAULT_SEC_PER_LETTER;
  return Math.max(1000, Number(sec) * 1000);
}

// Points for a rescued word: 100 + time left / 50 (unchanged).
export function winPoints(timerMs) { return 100 + Math.round(timerMs / 50); }

// Day-1 record "points" field (unchanged; in-memory only now).
export function recordPoints(ok, floors, errors) { return ok ? Math.max(0, 100 * floors - 15 * errors) : 0; }

export function nextOpenIndex(items, from, done) {
  for (let i = from; i < items.length; i++) if (!done.has(items[i].item_id)) return i;
  return -1;
}
