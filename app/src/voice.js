// Baked voices only (no TTS): narrator queue (letters / prompts / pack word mp3) + Grandma side lines.
import { BAKED_WORDS, cleanWord } from "./rules.js";
const NARRATOR_RATE = 1.45;
const GRANDMA_RATE = 1.12;
const GRANDMA_VOL = 0.55;
export const GRANDMA_HELP_SHORT = ["g-come-on", "g-oh-hurry", "g-you-can"];
export const GRANDMA_CHEER = ["g-you-can", "g-thats-it", "g-almost", "g-dont-give-up", "g-keep-climbing", "g-believe"];
const GRANDMA_ALL = ["g-help-me", "g-hurry-please", "g-oh-hurry", "g-waiting", "g-save-me", "g-scared", "g-quick", "g-come-on", ...GRANDMA_CHEER, "g-thank-you"];

export function createVoice(audio, { wm, packIdHint, voiceParam, caption }) {
  const nar = (id) => `./audio/narrator/${id}.mp3`;
  const gm = (id) => `./audio/grandma/${id}.mp3`;
  let q = [], busy = false, gen = 0, gmBusy = false, gmNow = null;
  const rot = { help: 0, cheer: 0 };
  function wordUrls(word, item) {
    const w = cleanWord(word), urls = [];
    if (item && item.audio) urls.push(item.audio);
    if (wm && packIdHint) urls.push(`../../packs/${packIdHint}/audio/${voiceParam || "us_m"}/${w}.mp3`);
    if (BAKED_WORDS.has(w)) urls.push(nar(`word-${w}`));
    return urls;
  }
  async function pump() {
    if (busy) return;
    const it = q.shift();
    if (!it) return;
    busy = true; const my = gen;
    it.onStart && it.onStart();
    if (it.text) caption(it.text);
    let ok = false;
    if (it.urls.length) ok = await audio.speak(it.urls, { rate: it.rate || 1 });
    if (!ok && it.fallbackLetters) { busy = false; if (my !== gen) return; q.unshift(...it.fallbackLetters.split("").map((ch) => ({ urls: [nar(`letter-${ch}`)], rate: NARRATOR_RATE, text: ch.toUpperCase(), gap: 80 }))); return pump(); }
    await new Promise((r) => setTimeout(r, ok ? (it.gap == null ? 280 : it.gap) : 450));
    if (my !== gen) return;
    busy = false;
    it.onEnd && it.onEnd();
    pump();
  }
  function say(item) { q.push({ urls: [], ...item }); pump(); }
  function stop() { q = []; busy = false; gen++; audio.stopVoice(); }
  function grandma(id) {
    if (!id || gmBusy) return;
    gmBusy = true;
    audio.clip(gm(id), { vol: GRANDMA_VOL, rate: GRANDMA_RATE }).then((h) => {
      gmNow = h; if (!h) { gmBusy = false; return; }
      h.done.then(() => { gmBusy = false; gmNow = null; });
    });
  }
  function stopGrandma() { if (gmNow) gmNow.stop(); gmNow = null; gmBusy = false; }
  return {
    idle: () => !busy && q.length === 0,
    gmIdle: () => !gmBusy,
    stop, stopGrandma,
    preload() { audio.preload([...GRANDMA_ALL.map(gm), ...["listen", "the-word-is", "again", "please-spell"].map(nar), ..."abcdefghijklmnopqrstuvwxyz".split("").map((c) => nar(`letter-${c}`))]); },
    preloadWord(word, item) { audio.preload(wordUrls(word, item).slice(0, 1)); },
    // the target word, twice (as before)
    announce(word, item) {
      stopGrandma(); stop();
      const urls = wordUrls(word, item);
      say({ urls, gap: 280, fallbackLetters: cleanWord(word), text: "Listen…" });
      say({ urls, gap: 200, text: "Listen…" });
    },
    no(word) {
      stopGrandma();
      const w = cleanWord(word);
      if (BAKED_WORDS.has(w)) say({ urls: [nar(`no-${w}`)], rate: NARRATOR_RATE, gap: 100 });
    },
    letter(ch) { say({ urls: [nar(`letter-${String(ch).toLowerCase()}`)], rate: NARRATOR_RATE, gap: 60 }); },
    // the "here is the spelling" replay after a fire
    spelling(word, item, onLetter, onDone) {
      stop(); stopGrandma();
      const w = cleanWord(word);
      say({ urls: [nar("listen")], rate: NARRATOR_RATE, text: "Listen. Here is the spelling.", gap: 280 });
      w.split("").forEach((ch, i) => say({ urls: [nar(`letter-${ch}`)], rate: NARRATOR_RATE, text: ch.toUpperCase(), gap: 220, onStart: () => onLetter(i) }));
      say({ urls: [nar("the-word-is")], rate: NARRATOR_RATE, text: "The word is spelled.", gap: 500, onStart: () => onLetter(w.length) });
      say({ urls: wordUrls(w, item), text: `The word is ${w.toUpperCase()}.`, gap: 800 });
      say({ urls: [nar("again")], rate: NARRATOR_RATE, text: "Now you know. Try again.", gap: 200, onEnd: onDone });
    },
    help() { grandma(GRANDMA_HELP_SHORT[rot.help++ % GRANDMA_HELP_SHORT.length]); },
    cheer() { grandma(GRANDMA_CHEER[rot.cheer++ % GRANDMA_CHEER.length]); },
    thanks() { stopGrandma(); grandma("g-thank-you"); },
    scream() { grandma("g-help-me"); },
  };
}
