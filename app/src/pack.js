// Pack loading. Word Master copy: sessionStorage mrj.wm.gamepack (or ?words=) only. Standalone: ?pack= URL or the default pack.
import { normalizePack, packFromWordsParam } from "./rules.js";
const empty = () => normalizePack({ pack_id: "empty", items: [] }, "empty");
export async function loadPack({ wm, packParam, packIdHint, wordsParam, voice, defaultUrl }) {
  if (wm || packParam === "session") {
    try {
      const raw = sessionStorage.getItem("mrj.wm.gamepack");
      if (raw) { const p = normalizePack(JSON.parse(raw), "session"); if (p.items.length) return p; }
    } catch (e) { /* no other pack */ }
    return packFromWordsParam(wordsParam, packIdHint, voice) || empty();
  }
  const url = packParam ? "./" + String(packParam).replace(/^\.\//, "").replace(/^\/+/, "") : defaultUrl;
  if (!url) return empty();
  try {
    const r = await fetch(url, { cache: "no-store" });
    if (r.ok) { const j = await r.json(); const p = normalizePack(j, j.pack_id || "fetched"); if (p.items.length) return p; }
  } catch (e) { /* fall through */ }
  return empty();
}
