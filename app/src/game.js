// Firefighter Spelling — game flow. Rules come from rules.js; drawing from scene.js.
import { createStage } from "./kit/stage.js";
import { createAudio } from "./kit/audio.js";
import { createFx } from "./kit/fx.js";
import { createInput } from "./kit/input.js";
import { el, esc, muteButton } from "./kit/ui.js";
import { WINDOWS, HEAVEN_AFTER, COLLAPSE_S, HURRY_EVERY, layoutFloors, letterBudgetMs, winPoints, recordPoints, nextOpenIndex } from "./rules.js";
import { createVoice } from "./voice.js";
import { createScene } from "./scene.js";

const API = "1.6.0";
export const VERSION = "2.0";
const SFX = ["pop", "whoosh", "splash", "thud", "buzz", "chime", "sparkle", "spray", "sizzle", "click", "fanfare", "lose", "boom"];

export async function startGame(host, { pack, wm, report, packIdHint, voiceParam, quality, studentLabel }) {
  host.innerHTML = "";
  const stage = createStage(host, { quality });
  const audio = createAudio({ sfx: Object.fromEntries(SFX.map((k) => [k, `./audio/sfx/${k}.mp3`])), music: "./audio/music-battle-theme-a.mp3", musicVol: 0.16 });
  const fx = createFx(stage);
  const cap = document.createElement("p"); cap.className = "sr"; cap.setAttribute("aria-live", "polite"); host.appendChild(cap);
  const caption = (t) => { cap.textContent = t || ""; };
  const voice = createVoice(audio, { wm, packIdHint, voiceParam, caption });
  const S = {
    phase: "tap", pack, packId: pack.pack_id, itemIndex: 0, word: "", itemId: "", item: null,
    floor: 0, floors: 0, rows: [], timerMs: 0, timerMax: 0, letterArmed: false, climbing: false, queuedSlot: null,
    ladderT: 0, climbT: 0, engulf: 0.12, score: 0, rescued: 0, burned: 0, taps: [], errors: 0, streak: 0, bestStreak: 0,
    introT: 0, hurryT: 0, winT: 0, loseT: 0, loseStage: "fire", collapseT: 0, slamI: 0, slamT: 0, narrDone: false,
    truckT: 0, heloX: -200, grandmaFly: 0, popSlot: -1, popT: 0, popOk: false, sprayT: 0, sprayTo: null, t: 0,
    lastRecord: null, roundStartedAt: "", wet: [], tiltT: 0,
  };
  const scene = createScene(stage, S, fx);

  // ---------- HUD (DOM) ----------
  const hud = el(`<div class="hud">
    <div class="topbar"><span class="pill" id="ff-score">★ 0</span><span class="pill" id="ff-word">Word 1/1</span><span class="pill tries" id="ff-tries">❤️❤️ Tries: 2</span><span class="pill hidden" id="ff-student"></span></div>
    <div class="tries-warn hidden" id="ff-warn">⚠️ Careful! Only 1 try left!</div>
    <div class="combo" id="ff-combo"></div>
    <div class="card" id="ff-start">
      <div class="badge">🚒</div>
      <h1>Firefighter<br/>Spelling</h1>
      <div class="mrj-h2p" id="mrj-h2p"><h2>HOW TO PLAY</h2><ul class="mrj-h2p-list"><li><span class="ic">👂</span>Listen to the word.</li><li><span class="ic">🔥</span>Spell it: one letter on each floor.</li><li><span class="ic">🪟</span>Pick the window with the next letter.</li><li><span class="ic">👵</span>Spell it fast to save Grandma!</li><li><span class="ic">❤️</span>Only 2 tries per word. 2 wrong letters = the house falls!</li></ul><div class="mrj-h2p-ctl"><div class="ctl"><b>💻 Computer</b><span>🖱️ Click a window</span><span><kbd>1</kbd>–<kbd>5</kbd> pick a window</span><span><kbd>Enter</kbd> start</span></div><div class="ctl"><b>📱 Touch</b><span>👆 Tap a window</span><span>👆 Tap to start</span></div></div></div>
      <button class="go" id="ff-go" type="button">TAP TO PLAY</button>
      ${wm ? "" : `<p class="how"><a href="./how-to-play.html" target="_blank" rel="noopener">How to play</a></p>`}
    </div>
    <div class="card hidden" id="ff-lose"><h2 id="ff-lose-word"></h2><p class="lead">Now you know. Try again!</p>
      <div class="row"><button class="go" id="ff-retry" type="button">TRY AGAIN</button><button class="go blue" id="ff-skip" type="button">SKIP</button></div></div>
    <div class="card hidden" id="ff-over"><div class="badge">🏚️</div><h2>Grandma didn't make it! 😢</h2><p class="lead">The house fell down. The word was:</p><p class="over-word" id="ff-over-word"></p><button class="go" id="ff-over-again" type="button">PLAY AGAIN</button></div>
    <div class="card hidden" id="ff-end"></div>
    <div class="fade" id="ff-fade"></div>
  </div>`);
  host.appendChild(hud);
  hud.appendChild(muteButton(audio));
  const $ = (id) => hud.querySelector("#" + id);
  if (studentLabel) { $("ff-student").textContent = studentLabel; $("ff-student").classList.remove("hidden"); }
  const n = () => (S.pack.items || []).length;
  function hudUpdate(bump) {
    $("ff-score").textContent = "★ " + S.score;
    $("ff-word").textContent = `Word ${Math.min(n(), S.itemIndex + 1)}/${n()}`;
    const tr = $("ff-tries"); const left = S.tries == null ? 2 : S.tries;
    tr.textContent = `${"❤️".repeat(left)}${"🤍".repeat(2 - left)} Tries: ${left}`; tr.classList.toggle("low", left <= 1);
    if (bump) { const p = $("ff-score"); p.classList.remove("bump"); void p.offsetWidth; p.classList.add("bump"); }
  }
  function comboShow() {
    const c = $("ff-combo");
    if (S.streak >= 3) { c.textContent = `🔥 ${S.streak} in a row!`; c.classList.remove("on"); void c.offsetWidth; c.classList.add("on"); }
    else c.classList.remove("on");
  }
  const show = (id, on) => $(id).classList.toggle("hidden", !on);
  function fade(fn) { const f = $("ff-fade"); f.classList.add("on"); setTimeout(() => { fn(); f.classList.remove("on"); }, 330); }

  // ---------- record (memory only; the cloud copy goes through MRJ_SCORES) ----------
  function record(fields) {
    const ended = new Date().toISOString(), started = S.roundStartedAt || ended;
    const ok = fields.correct === 1 || fields.won === true;
    S.lastRecord = {
      student_id: report.student() || "", module_id: S.pack.module_id, activity_id: S.pack.activity_id, item_id: S.itemId,
      skill_tags: S.pack.skill_tags, response: S.taps.join(""), correct: ok ? 1 : 0,
      latency_ms: Math.max(0, Date.parse(ended) - Date.parse(started)), accuracy: ok ? 1 : 0,
      points: recordPoints(ok, S.floors, S.errors), errors: S.errors, started_at: started, ended_at: ended,
      ui_locale: "en", pack_id: S.packId, word: S.word, score: S.score, ...fields,
    };
  }

  // ---------- flow ----------
  function armTimer() { S.timerMax = letterBudgetMs(S.pack); S.timerMs = S.timerMax; S.letterArmed = true; }
  function startWord(index) {
    if (!n()) { S.phase = "tap"; caption("No words in this set."); return; }
    S.itemIndex = ((index % n()) + n()) % n();
    const it = S.pack.items[S.itemIndex];
    Object.assign(S, { item: it, word: it.word.toLowerCase(), itemId: it.item_id, floors: it.word.length, floor: 0, queuedSlot: null, letterArmed: false,
      introT: 0, hurryT: 0, slamI: 0, slamT: 0, winT: 0, loseT: 0, heloX: -200, grandmaFly: 0, climbing: false, ladderT: 0, climbT: 0,
      engulf: 0.12, taps: [], errors: 0, tries: 2, loseKind: "", crumbleT: 0, overShown: false, roundStartedAt: new Date().toISOString(), popSlot: -1, popT: 0, wet: [], sprayT: 0 });
    show("ff-warn", false);
    armTimer();
    S.rows = layoutFloors(S.word, S.itemIndex);
    S.phase = "intro";
    scene.newWord();
    hudUpdate();
    voice.announce(S.word, it);
    const nx = S.pack.items[S.itemIndex + 1]; if (nx) voice.preloadWord(nx.word, nx);
  }
  function beginPlay() { S.phase = "play"; S.queuedSlot = null; armTimer(); S.hurryT = 0; }
  function nextWord() {
    if (wm) {
      if (!n() || S.itemIndex >= n() - 1) {
        if (n()) report.postGameDone(S);
        return results();
      }
      return startWord(S.itemIndex + 1);
    }
    const nxt = nextOpenIndex(S.pack.items, S.itemIndex + 1, report.passedIds(S.packId));
    if (!n() || nxt < 0) { report.finishPack(S); return results(); }
    startWord(nxt);
  }
  function results() {
    S.phase = "results";
    audio.stopMusic(); setTimeout(() => { if (S.phase === "results") { voice.stop(); voice.stopGrandma(); audio.stopAll(); } }, 3500); // run end: music off, then AudioContext suspended
    caption(`Done. Score ${S.score}.`);
    voice.thanks();
    audio.play("fanfare");
    fx.confetti(stage.w / 2, stage.h * 0.3, 120);
    const total = n(), stars = S.rescued >= total ? 3 : S.rescued >= Math.ceil(total * 0.6) ? 2 : S.rescued > 0 ? 1 : 0;
    const end = $("ff-end");
    end.innerHTML = `<div class="badge">🏆</div><h2>Rescue done!</h2>
      <div class="stars">${"★".repeat(stars)}<span class="dim">${"★".repeat(3 - stars)}</span></div>
      <div class="stats"><div><b>${S.rescued}</b><span>saved</span></div><div><b>${S.burned}</b><span>fires</span></div><div><b>${total}</b><span>words</span></div></div>
      <p class="big">Score <b>${S.score}</b></p>${S.bestStreak >= 3 ? `<p class="lead">Best streak: ${S.bestStreak} letters 🔥</p>` : ""}
      <button class="go" id="ff-again" type="button">PLAY AGAIN</button>`;
    show("ff-end", true);
    end.querySelector("#ff-again").addEventListener("click", () => { audio.play("click"); playAgain(); });
  }
  function playAgain() {
    voice.stop(); voice.stopGrandma(); audio.unlock(); audio.startMusic();
    report.resetForReplay();
    Object.assign(S, { score: 0, rescued: 0, burned: 0, streak: 0, bestStreak: 0 });
    show("ff-end", false); show("ff-over", false);
    fade(() => startWord(0));
  }
  function tryAgain() { voice.stop(); voice.stopGrandma(); show("ff-lose", false); fade(() => startWord(S.itemIndex)); }
  function skipWord() { voice.stop(); voice.stopGrandma(); show("ff-lose", false); record({ result: "skip", skipped: true }); fade(() => nextWord()); }
  function tapToPlay() {
    audio.unlock(); audio.startMusic(); voice.preload();
    audio.play("click");
    show("ff-start", false);
    S.phase = "truck"; S.truckT = 0;
  }
  function onCorrect(slot) {
    if (S.climbing) return;
    S.letterArmed = false; S.queuedSlot = null;
    S.streak++; S.bestStreak = Math.max(S.bestStreak, S.streak);
    S.climbing = true; S.ladderT = 0; S.climbT = 0;
    S.wet[S.floor] = slot;
    const r = scene.windowRect(S.floor, slot);
    S.sprayT = 0.55; S.sprayTo = { x: r.x + r.w / 2, y: r.y + r.h / 2 };
    audio.play("spray", { vol: 0.7 }); audio.play("sizzle", { vol: 0.5, delay: 0.18 });
    audio.combo(S.streak);
    voice.letter(S.rows[S.floor][slot]);
    fx.burst(r.x + r.w / 2, r.y + r.h / 2, { n: 26, color: ["#bfe9ff", "#ffffff", "#7fd0ff"], speed: 260, size: 6, life: 0.7, grav: 300 });
    fx.float(r.x + r.w / 2, r.y - 6, S.streak >= 3 ? `${S.rows[S.floor][slot]} ×${S.streak}` : S.rows[S.floor][slot], { color: "#9dffb0", size: 34 });
    fx.flash("#bfe9ff", 0.18);
    comboShow();
  }
  function finishClimb() {
    S.climbing = false; S.floor += 1; S.engulf = 0.12;
    audio.play("thud", { vol: 0.5 });
    if (S.floor >= S.floors) return winRound();
    armTimer();
    voice.cheer();
    const qd = S.queuedSlot; S.queuedSlot = null;
    if (qd != null) tapWindow(qd);
  }
  function onWrong(slot) {
    audio.play("buzz", { vol: 0.8 }); audio.play("whoosh", { vol: 0.5, rate: 0.7 });
    S.streak = 0; comboShow();
    S.engulf = 1;
    fx.shake(12); fx.flash("#ff3b1a", 0.22);
    const r = scene.windowRect(S.floor, slot);
    fx.burst(r.x + r.w / 2, r.y + r.h / 2, { n: 22, color: ["#ff7a1a", "#ffd23f", "#ff3b1a"], speed: 240, size: 6, life: 0.6, grav: -200 });
    fx.float(r.x + r.w / 2, r.y - 6, "✗", { color: "#ff6a5a", size: 36 });
    voice.no(S.word);
  }
  function winRound() {
    S.phase = "win"; S.winT = 0; S.rescued += 1;
    const pts = winPoints(S.timerMs);
    S.score += pts;
    audio.play("fanfare"); audio.play("sparkle", { delay: 0.25 });
    voice.thanks();
    record({ result: "win", won: true, correct: 1 });
    report.markPassed(S.itemId);
    report.postRoundScore(S, true);
    const g = scene.grandmaPos();
    fx.confetti(g.x, g.y, 90);
    fx.float(stage.w / 2, stage.h * 0.3, `+${pts}`, { color: "#ffe066", size: 54, life: 1.5 });
    hudUpdate(true);
  }
  // 2nd wrong try: the burning house crumbles, Grandma is lost (cartoon), run over.
  function houseFalls() {
    voice.stopGrandma(); voice.stop(); show("ff-warn", false);
    Object.assign(S, { phase: "lose", loseKind: "tries", loseStage: "crumble", crumbleT: 0, loseT: 0, engulf: 1, letterArmed: false, climbing: false, queuedSlot: null, streak: 0, overShown: false });
    S.burned += 1; comboShow();
    audio.play("buzz", { vol: 0.8 }); audio.play("boom", { vol: 1, delay: 0.15 }); audio.play("thud", { vol: 1, delay: 0.55 }); audio.play("boom", { vol: 0.8, rate: 0.6, delay: 0.9 }); audio.play("lose", { vol: 0.8, delay: 1.6 });
    fx.shake(30); fx.flash("#ff6a1a", 0.45);
    scene.crumble();
    record({ result: "lose", won: false, correct: 0, reason: "tries" });
    report.postRoundScore(S, false);
    caption("The house fell down. Grandma didn't make it.");
  }
  function showOver() {
    if (S.overShown) return; S.overShown = true; S.phase = "over";
    $("ff-over-word").textContent = S.word.toUpperCase(); show("ff-over", true);
    audio.stopMusic(); setTimeout(() => { if (S.phase === "over") { voice.stop(); voice.stopGrandma(); audio.stopAll(); } }, 2500); // run end
  }
  function loseRound() {
    if (S.phase === "lose") return;
    if (S.climbing || !S.letterArmed) return;
    voice.stopGrandma(); voice.stop();
    Object.assign(S, { phase: "lose", engulf: 1, loseT: 0, loseStage: "fire", collapseT: 0, slamI: -1, slamT: 0, narrDone: false, streak: 0 });
    S.burned += 1;
    comboShow();
    audio.play("boom"); audio.play("lose", { delay: 0.3 });
    fx.shake(22); fx.flash("#ff6a1a", 0.5);
    record({ result: "lose", won: false, correct: 0 });
    report.postRoundScore(S, false);
  }
  function tapWindow(slot) {
    if (S.phase !== "play") return;
    if (slot < 0 || slot >= WINDOWS) return;
    if (S.climbing) { S.queuedSlot = slot; return; }
    if (S.floor >= S.floors) return;
    const row = S.rows[S.floor]; if (!row) return;
    const ch = row[slot], need = S.word.toUpperCase()[S.floor];
    S.taps.push(ch);
    S.popSlot = slot; S.popT = 1; S.popOk = ch === need;
    audio.play("pop", { vol: 0.5 });
    if (ch === need) onCorrect(slot);
    else {
      // a TRY = one wrong window (letter) click. 2 tries per word; the 2nd miss ends the run.
      S.errors += 1; S.tries = Math.max(0, S.tries - 1); hudUpdate();
      if (S.tries <= 0) return houseFalls();
      onWrong(slot);
      const w = $("ff-warn"); w.classList.remove("hidden", "pop"); void w.offsetWidth; w.classList.add("pop");
    }
  }

  // ---------- input ----------
  $("ff-go").addEventListener("click", tapToPlay);
  $("ff-over-again").addEventListener("click", () => { audio.unlock(); audio.play("click"); playAgain(); });
  $("ff-retry").addEventListener("click", () => { audio.play("click"); tryAgain(); });
  $("ff-skip").addEventListener("click", () => { audio.play("click"); skipWord(); });
  const keys = { Enter: "enter", " ": "enter", 1: "w0", 2: "w1", 3: "w2", 4: "w3", 5: "w4" };
  createInput(host, {
    keys,
    onKey(a) {
      audio.unlock();
      if (a === "enter") {
        if (S.phase === "tap" && n()) tapToPlay();
        else if (S.phase === "lose" && !$("ff-lose").classList.contains("hidden")) tryAgain();
        else if (S.phase === "results" || S.phase === "over") playAgain();
        return;
      }
      if (S.phase === "play") tapWindow(Number(a.slice(1)));
    },
    onTap(x, y) {
      audio.unlock();
      if (S.phase === "tap" && n()) return tapToPlay();
      if (S.phase !== "play") return;
      const slot = scene.hitWindow(x, y);
      if (slot >= 0) tapWindow(slot);
    },
  });

  // ---------- update ----------
  function update(dt) {
    S.t += dt;
    if (S.popT > 0) S.popT = Math.max(0, S.popT - dt * 2.2);
    if (S.sprayT > 0) S.sprayT = Math.max(0, S.sprayT - dt);
    if (S.phase === "truck") {
      S.truckT += dt;
      if (S.truckT < 2.2 && Math.floor(S.t * 2.4) !== Math.floor((S.t - dt) * 2.4)) audio.tone(Math.floor(S.t * 2.4) % 2 ? 660 : 880, 0.38, { type: "sawtooth", vol: 0.05 });
      if (S.truckT > 2.6) {
        if (wm) startWord(0);
        else { const nxt = nextOpenIndex(S.pack.items, 0, report.passedIds(S.packId)); if (nxt < 0) { report.finishPack(S); results(); } else startWord(nxt); }
      }
    }
    if (S.phase === "intro") { S.introT += dt; if ((S.introT > 0.35 && voice.idle()) || S.introT > 8) beginPlay(); }
    if (S.phase === "play") {
      if (!S.climbing && S.letterArmed) { S.timerMs = Math.max(0, S.timerMs - dt * 1000); if (S.timerMs <= 0) loseRound(); }
      const pct = S.timerMs / S.timerMax;
      if (pct < 0.3 && S.letterArmed && !S.climbing && Math.floor(S.timerMs / 500) !== Math.floor((S.timerMs + dt * 1000) / 500)) audio.tone(980, 0.06, { type: "square", vol: 0.05 });
      S.hurryT += dt;
      if (S.hurryT >= HURRY_EVERY && voice.gmIdle() && voice.idle()) { S.hurryT = 0; voice.help(); }
      if (S.climbing) {
        if (S.ladderT < 1) S.ladderT = Math.min(1, S.ladderT + dt * 2.4);
        else { S.climbT = Math.min(1, S.climbT + dt * 1.8); if (S.climbT >= 1) finishClimb(); }
      }
      if (!S.climbing && S.engulf > 0.12) S.engulf = Math.max(0.12, S.engulf - dt * 0.35);
    }
    if (S.phase === "win") {
      S.winT += dt;
      if (S.winT > 2.1) {
        const last = S.itemIndex >= n() - 1;
        if (S.burned === 0 && last) { S.phase = "fly"; S.heloX = -200; S.grandmaFly = 0; audio.play("whoosh", { rate: 0.5 }); }
        else fade(() => nextWord());
        if (S.phase === "win") S.phase = "wait";
      }
    }
    if (S.phase === "fly") {
      S.heloX += 220 * dt;
      if (S.heloX > stage.w * 0.38) S.grandmaFly += dt;
      if (S.heloX > stage.w + 220) { S.phase = "wait"; nextWord(); }
    }
    if (S.phase === "lose" && S.loseKind === "tries") { S.crumbleT += dt; if (S.crumbleT >= 3.2) showOver(); }
    else if (S.phase === "lose") {
      S.loseT += dt;
      if (S.loseStage === "fire" && S.loseT >= HEAVEN_AFTER) { S.loseStage = "collapse"; S.collapseT = 0; audio.play("boom", { rate: 0.6 }); fx.shake(26); }
      if (S.loseStage === "collapse") {
        S.collapseT += dt;
        if (S.collapseT >= COLLAPSE_S) {
          S.loseStage = "heaven";
          voice.spelling(S.word, S.item, (i) => { S.slamI = i; S.slamT = 0; if (i < S.word.length) audio.play("thud", { vol: 0.6 }); },
            () => { S.narrDone = true; $("ff-lose-word").textContent = S.word.toUpperCase(); show("ff-lose", true); });
          setTimeout(() => { if (S.phase === "lose" && !S.narrDone) { S.narrDone = true; S.slamI = S.word.length; $("ff-lose-word").textContent = S.word.toUpperCase(); show("ff-lose", true); } }, 4000 + S.word.length * 1400);
        }
      }
      if (S.loseStage === "heaven") S.slamT += dt;
    }
    fx.update(dt);
  }

  stage.run((dt, st) => { update(dt); scene.draw(dt); });

  // Word Master close / tab hidden / page unload: stop all sound
  const mrjHardStop = () => { voice.stop(); voice.stopGrandma(); audio.stopAll(); };
  window.addEventListener("message", (ev) => { const d = ev.data; if (d === "mrj-stop" || (d && d.type === "mrj-stop")) mrjHardStop(); });
  window.addEventListener("pagehide", mrjHardStop);
  document.addEventListener("visibilitychange", () => { if (document.hidden) mrjHardStop(); else if (S.phase !== "results" && S.phase !== "tap" && S.phase !== "over") { audio.unlock(); audio.startMusic(); } });
  window.FirefighterSpelling = {
    getState() {
      return {
        api: API, version: VERSION, host: wm ? "word-master" : "standalone", packId: S.packId, word: S.word, floor: S.floor, floors: S.floors,
        timerMs: Math.round(S.timerMs), timerMax: Math.round(S.timerMax), letterArmed: !!S.letterArmed, climbing: !!S.climbing,
        tries: S.tries, loseKind: S.loseKind, crumbleT: S.crumbleT, faces: (S.rows[S.floor] || []).slice(), need: (S.word || "").toUpperCase()[S.floor] || "", phase: S.phase, score: S.score,
        rescued: S.rescued, burned: S.burned, itemIndex: S.itemIndex, items: n(), streak: S.streak, low: stage.low, lastRecord: S.lastRecord,
      };
    },
    // test hook: run the letter clock out now (zz_test smoke only)
    _expire() { if (S.phase === "play") { S.timerMs = 1; } },
  };
  hudUpdate();
  return { S };
}
