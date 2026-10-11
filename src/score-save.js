/** Pack-scoped score payloads for MRJ_SCORES.post (browser + tests). */

export const SCORE_APP_NAME = "MRJ Firefighter Spelling";

export function scopedWordItemId(packId, itemId) {
  return `${packId || "pack"}:${itemId}`;
}

export function packResultItemId(packId) {
  return `pack:${packId}`;
}

export function signedInStudent(getStudent) {
  try {
    const s = getStudent ? getStudent() : "";
    return String(s || "").trim();
  } catch {
    return "";
  }
}

export function wordRoundPostOptions({
  program,
  packId,
  pack,
  itemId,
  word,
  timerMs,
  passed,
}) {
  return {
    program,
    itemId: scopedWordItemId(packId, itemId),
    appName: SCORE_APP_NAME,
    bookTitle: (pack && pack.title) || packId,
    itemType: "word",
    correctness: passed ? "correct" : "incorrect",
    scoreValue: passed ? 1 : 0,
    scoreMax: 1,
    metadata: {
      word,
      seconds_left: Math.round((timerMs || 0) / 1000),
    },
  };
}

export function packFinishPostOptions({ program, packId, pack, packRight, packTried, score }) {
  const pack_items = (pack && pack.items && pack.items.length) || 0;
  return {
    program,
    itemId: packResultItemId(packId),
    appName: SCORE_APP_NAME,
    bookTitle: (pack && pack.title) || packId,
    itemType: "pack",
    scoreValue: packRight,
    scoreMax: packTried,
    metadata: { points: score, pack_items },
  };
}
