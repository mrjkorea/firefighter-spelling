// Progress + score hooks, unchanged from v1.15 (standalone) and the Word Master v1.11 copy.
//  - standalone: mrj-signin (MRJ_AUTH) gives the student + cloud progress; MRJ_SCORES.post saves word + pack rows.
//  - Word Master: posts mrj-wm-game-done to the parent once every word was played. A loss never posts.
// Nothing is written to localStorage.
import { PROGRAM, bindAuthProgress, idKey, mergeProgressRows, passedIdsFromProgress } from "../../src/auth-progress.js";
import { packFinishPostOptions, signedInStudent, wordRoundPostOptions } from "../../src/score-save.js";

export function createReport({ wm }) {
  let authRows = [];
  let studentId = "";
  let ignoreProgress = false;
  let roundPosted = false;
  const localPassed = new Set();
  const tally = { right: 0, tried: 0 };
  const student = () => signedInStudent(() => window.MRJ_AUTH && window.MRJ_AUTH.student && window.MRJ_AUTH.student());
  const scores = () => (window.MRJ_SCORES && typeof window.MRJ_SCORES.post === "function" ? window.MRJ_SCORES : null);

  function passedIds(packId) {
    const ids = new Set(localPassed);
    if (wm || ignoreProgress) return ids;
    for (const id of passedIdsFromProgress(authRows, PROGRAM, packId)) ids.add(id);
    return ids;
  }
  function postRoundScore(S, passed) {
    if (wm) return;
    const st = student(), api = scores();
    if (!st || !S.itemId || !api) return;
    tally.tried += 1; if (passed) tally.right += 1;
    api.post({ student: st, ...wordRoundPostOptions({ program: PROGRAM, packId: S.packId, pack: S.pack, itemId: S.itemId, word: S.word, timerMs: S.timerMs, passed }) });
  }
  function finishPack(S) {
    if (wm) return;
    const st = student(), api = scores();
    if (!st || tally.tried <= 0 || !api) return;
    api.post({ student: st, ...packFinishPostOptions({ program: PROGRAM, packId: S.packId, pack: S.pack, packRight: tally.right, packTried: tally.tried, score: S.score }) });
  }
  // Word Master: only from the finished last word (win or skip), never from loseRound.
  function postGameDone(S) {
    if (!wm || roundPosted) return;
    const n = (S.pack && S.pack.items && S.pack.items.length) || 0;
    const seen = S.itemIndex + 1;
    if (!n || seen < n) return;
    roundPosted = true;
    try {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({ type: "mrj-wm-game-done", game: "spellfire", items: seen, correct: S.rescued, finished: true }, "*");
      }
    } catch (e) { /* a quit or a closed frame must not unlock the test */ }
  }
  return {
    wm,
    passedIds,
    markPassed(id) { if (id) localPassed.add(id); },
    postRoundScore, finishPack, postGameDone,
    resetForReplay() { ignoreProgress = true; localPassed.clear(); tally.right = 0; tally.tried = 0; roundPosted = false; },
    resetTally() { tally.right = 0; tally.tried = 0; roundPosted = false; },
    student: () => studentId,
    // standalone: wait for mrj-signin. Calls onStudent(id) each time the signed-in student changes.
    bindAuth(onStudent) {
      const b = bindAuthProgress({
        onProgressApplied(rows) { authRows = mergeProgressRows(authRows, rows, PROGRAM); },
        onStudentReady(id) {
          const changed = idKey(studentId) !== idKey(id);
          studentId = id;
          if (changed) { authRows = []; localPassed.clear(); ignoreProgress = false; onStudent(id); }
        },
      });
      window.addEventListener("mrj-auth-ready", b.onAuthReady);
    },
  };
}
