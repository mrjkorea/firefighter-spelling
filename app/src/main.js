import "@fontsource/fredoka/latin-500.css";
import "@fontsource/fredoka/latin-700.css";
import "./kit/base.css";
import "./style.css";
import { loadPack } from "./pack.js";
import { startGame } from "./game.js";
import { createReport } from "./report.js";
const app = document.getElementById("app");
const qs = new URLSearchParams(location.search);
// Word Master copy carries <meta name="mrj-host" content="word-master">: session words only, no word list choices.
const wm = !!document.querySelector('meta[name="mrj-host"][content="word-master"]');
const dflt = document.querySelector('meta[name="ff-default-pack"]');
document.addEventListener("gesturestart", (e) => e.preventDefault());
const report = createReport({ wm });
const q = qs.get("q");
async function boot(studentLabel) {
  const pack = await loadPack({ wm, packParam: qs.get("pack"), packIdHint: qs.get("packid") || "", wordsParam: qs.get("words"), voice: qs.get("voice") || "us_m", defaultUrl: dflt ? dflt.content : "" });
  if (!pack.items.length) throw new Error(wm ? "No words in this set. Open Firefighter Spelling from Word Master." : "No word pack.");
  await startGame(app, { pack, wm, report, packIdHint: qs.get("packid") || "", voiceParam: qs.get("voice") || "us_m", quality: q === "low" || q === "high" ? q : undefined, studentLabel });
}
const fatal = (err) => { console.error(err); app.innerHTML = `<div class="fatal"><h2>UH-OH</h2><p></p></div>`; app.querySelector(".fatal p").textContent = err.message || String(err); };
if (wm) boot("").catch(fatal);
else report.bindAuth((id) => boot(id).catch(fatal)); // standalone waits for mrj-signin, as before
