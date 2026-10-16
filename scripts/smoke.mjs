// Headless smoke: real Chromium, stubbed sign-in (zz_test ids only), score posts intercepted (never sent).
// node scripts/smoke.mjs [outDir] [wmGameDir]
import { chromium } from "playwright";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const out = path.resolve(process.argv[2] || "/workspace/firefighter-shots");
const wmDir = process.argv[3] ? path.resolve(process.argv[3]) : null;
fs.mkdirSync(out, { recursive: true });
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".mp3": "audio/mpeg", ".woff2": "font/woff2", ".woff": "font/woff", ".webp": "image/webp", ".png": "image/png" };
const serve = (dir, extra = {}) => new Promise((res) => { const s = http.createServer((req, rsp) => {
  const u = decodeURIComponent(req.url.split("?")[0]);
  if (extra[u]) { rsp.writeHead(200, { "content-type": TYPES[path.extname(u)] || "text/html; charset=utf-8" }); return rsp.end(extra[u]); }
  const f = path.join(dir, u.endsWith("/") ? u + "index.html" : u);
  if (!f.startsWith(dir) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { rsp.writeHead(404); return rsp.end("nf"); }
  rsp.writeHead(200, { "content-type": TYPES[path.extname(f)] || "application/octet-stream" }); fs.createReadStream(f).pipe(rsp); }).listen(0, () => res(s)); });
const STUDENT = "zz_test_firefighter";
const AUTH_STUB = `window.MRJ_AUTH={student:function(){return ${JSON.stringify(STUDENT)}},loadProgressForApp:function(){return Promise.resolve({ok:true,progress:[]})},noteScore:function(){}};
setTimeout(function(){window.dispatchEvent(new CustomEvent("mrj-auth-ready",{detail:{id:${JSON.stringify(STUDENT)},progress:[]}}))},300);`;
const fails = []; const check = (ok, m) => { console.log((ok ? "PASS " : "FAIL ") + m); if (!ok) fails.push(m); };
// pilot: press the key (1-5) of the needed window; "wrong" presses one wrong window once.
const PILOT = (mode) => { clearInterval(window.__p); window.__p = setInterval(() => { const A = window.FirefighterSpelling, s = A && A.getState(); if (!s || s.phase !== "play" || s.climbing) return;
  let i = s.faces.indexOf(s.need); if (mode === "wrong") { i = s.faces.findIndex((c) => c !== s.need); clearInterval(window.__p); }
  if (mode === "idle") return;
  window.dispatchEvent(new KeyboardEvent("keydown", { key: String(i + 1) })); }, mode === "slow" ? 700 : 260); };
async function newPage(browser, opts, posts) {
  const ctx = await browser.newContext(opts);
  await ctx.route("https://mrjkorea.github.io/mrj-signin/**", (r) => r.fulfill({ contentType: "text/plain", body: "" }));
  await ctx.route("https://mrjkorea.github.io/mrj-signin/mrj-auth.js", (r) => r.fulfill({ contentType: "text/javascript", body: AUTH_STUB }));
  await ctx.route("https://script.google.com/**", (r) => { try { const b = JSON.parse(r.request().postData()); for (const ev of b.events || []) posts.push({ student: b.student_name, program: ev.curriculum_program, itemId: ev.item_id, itemType: ev.item_type, scoreValue: ev.score_value, scoreMax: ev.score_max, metadata: JSON.parse(ev.metadata_json || "{}") }); } catch (e) {} r.fulfill({ contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: '{"status":"ok"}' }); });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => fails.push("pageerror: " + e.message));
  return { ctx, page };
}
const st = (p) => p.evaluate(() => window.FirefighterSpelling.getState());
const waitS = (p, fn, arg, t = 30000) => p.waitForFunction(fn, arg, { timeout: t });
const browser = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });
const ZZ = JSON.stringify({ pack_id: "zz_test_two", title: "zz test", seconds_per_letter: 5, items: [{ item_id: "zz-one", word: "one" }, { item_id: "zz-two", word: "two" }] });
const server = await serve(root, { "/zz/zz_test_two.json": ZZ }); const B = `http://localhost:${server.address().port}`;
try {
  const posts = [];
  const { ctx, page } = await newPage(browser, { viewport: { width: 1280, height: 800 } }, posts);
  await page.goto(`${B}/index.html`);
  await page.waitForSelector("#ff-go", { timeout: 15000 });
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${out}/01-start-desktop.png` });
  await page.click("#ff-go");
  await page.waitForTimeout(1300); await page.screenshot({ path: `${out}/02-truck-arrives.png` });
  await waitS(page, () => window.FirefighterSpelling.getState().phase === "play");
  await page.waitForTimeout(400); await page.screenshot({ path: `${out}/03-play-windows.png` });
  let s = await st(page); check(s.word === "one" && s.faces.length === 5 && s.faces.includes("O") && s.timerMax === 5000, `word one, 5 windows, 5 s/letter (${s.word} ${s.faces} ${s.timerMax})`);
  await page.evaluate(PILOT, "wrong"); await page.waitForTimeout(130); await page.screenshot({ path: `${out}/04-wrong-window.png` });
  s = await st(page); check(s.floor === 0 && s.phase === "play", "wrong letter: stay on the floor");
  await page.evaluate(() => { const s = window.FirefighterSpelling.getState(); window.dispatchEvent(new KeyboardEvent("keydown", { key: String(s.faces.indexOf(s.need) + 1) })); });
  await page.waitForTimeout(200); await page.screenshot({ path: `${out}/05-hose-spray.png` });
  await waitS(page, () => window.FirefighterSpelling.getState().floor === 1 && !window.FirefighterSpelling.getState().climbing);
  await page.evaluate(PILOT, "fast");
  await waitS(page, () => window.FirefighterSpelling.getState().phase === "win");
  await page.waitForTimeout(900); await page.screenshot({ path: `${out}/06-rescue-hug.png` });
  s = await st(page); check(s.rescued === 1 && s.score >= 100 && s.lastRecord.correct === 1 && s.lastRecord.errors === 1, `win: score ${s.score}, record errors ${s.lastRecord.errors}`);
  // word two: let the fire win
  await page.evaluate(PILOT, "idle");
  await waitS(page, () => window.FirefighterSpelling.getState().word === "two" && window.FirefighterSpelling.getState().phase === "play");
  await page.evaluate(() => window.FirefighterSpelling._expire());
  await waitS(page, () => window.FirefighterSpelling.getState().phase === "lose");
  await page.waitForTimeout(900); await page.screenshot({ path: `${out}/07-fire-spread.png` });
  await page.waitForTimeout(3400); await page.screenshot({ path: `${out}/08-spelling-replay.png` });
  await page.waitForSelector("#ff-lose:not(.hidden)", { timeout: 30000 });
  await page.waitForTimeout(400); await page.screenshot({ path: `${out}/09-try-again.png` });
  s = await st(page); check(s.burned === 1 && s.lastRecord.correct === 0, "timer out: building burns, record correct 0");
  await page.click("#ff-skip");
  await page.evaluate(PILOT, "fast");
  await waitS(page, () => window.FirefighterSpelling.getState().phase === "results", null, 90000);
  await page.waitForTimeout(900); await page.screenshot({ path: `${out}/10-results.png` });
  s = await st(page);
  const words = posts.filter((p) => p.itemType === "word"), pk = posts.filter((p) => p.itemType === "pack");
  check(s.rescued === 4 && s.burned === 1, `results: 4 saved, 1 burned (${s.rescued}/${s.burned})`);
  check(words.length === 5 && words.filter((w) => w.scoreValue === 1).length === 4 && words.every((w) => w.student === STUDENT && w.program === "firefighter-spelling" && /^numbers-en-v1:num-/.test(w.itemId)), "5 word rows (4 correct), pack-scoped ids " + JSON.stringify(words.map((w) => w.itemId + "=" + w.scoreValue)));
  check(pk.length === 1 && pk[0].itemId === "pack:numbers-en-v1" && pk[0].scoreValue === 4 && pk[0].scoreMax === 5 && pk[0].metadata.points === s.score, "pack row 4/5 with points " + JSON.stringify(pk[0]));
  const ls = await page.evaluate(() => Object.keys(localStorage)); check(ls.length === 0, "nothing saved to localStorage " + JSON.stringify(ls));
  await ctx.close();

  // clean sweep -> helicopter finale (zz_test pack)
  const posts2 = [];
  const p2 = await newPage(browser, { viewport: { width: 1280, height: 800 } }, posts2);
  await p2.page.goto(`${B}/index.html?pack=zz/zz_test_two.json`);
  await p2.page.click("#ff-go", { timeout: 15000 });
  await p2.page.evaluate(PILOT, "fast");
  await waitS(p2.page, () => window.FirefighterSpelling.getState().phase === "fly", null, 60000);
  await p2.page.waitForTimeout(2200); await p2.page.screenshot({ path: `${out}/11-helicopter-finale.png` });
  await waitS(p2.page, () => window.FirefighterSpelling.getState().phase === "results", null, 30000);
  check(posts2.filter((p) => p.itemType === "word").length === 2 && posts2.some((p) => p.itemId === "pack:zz_test_two"), "zz_test pack: 2 word rows + pack row");
  await p2.ctx.close();

  const p3 = await newPage(browser, { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true }, []);
  await p3.page.goto(`${B}/index.html?q=low`);
  await p3.page.tap("#ff-go", { timeout: 15000 });
  await waitS(p3.page, () => window.FirefighterSpelling.getState().phase === "play");
  await p3.page.waitForTimeout(300); await p3.page.screenshot({ path: `${out}/12-phone-layout.png` });
  s = await st(p3.page); check(s.low, "?q=low forces low quality");
  await p3.ctx.close();

  if (wmDir) {
    const items = ["one", "two"].map((w, i) => ({ item_id: "zz-" + w, word: w, audio: i === 0 ? "audio/narrator/word-one.mp3" : "../../packs/zz_test_pack/audio/us_m/two.mp3" }));
    const pack = { pack_id: "zz_test_pack", title: "zz test", seconds_per_letter: 5, items };
    const ws = await serve(wmDir, { "/host.html": `<!doctype html><body style="margin:0"><iframe id=f style="width:1000px;height:700px;border:0"></iframe><script>
      window.msgs=[];addEventListener("message",e=>msgs.push(e.data));sessionStorage.setItem("mrj.wm.gamepack",${JSON.stringify(JSON.stringify(pack))});
      document.getElementById("f").src="index.html?pack=session&packid=zz_test_pack&words=one,two&voice=us_m&v=1.11&student=zz_test_wm&locale=ko";</script>` });
    const wp = await newPage(browser, { viewport: { width: 1000, height: 700 } }, posts);
    const net = []; wp.page.on("request", (r) => { if (/mrj-signin|script\.google/.test(r.url())) net.push(r.url()); });
    await wp.page.goto(`http://localhost:${ws.address().port}/host.html`);
    const f = await (await wp.page.waitForSelector("#f")).contentFrame();
    await f.waitForSelector("#ff-go", { timeout: 15000 });
    check(await f.evaluate(() => !document.querySelector(".how") && window.FirefighterSpelling.getState().host === "word-master" && window.FirefighterSpelling.getState().items === 2), "WM: session pack (2 words), no how-to link");
    await f.click("#ff-go");
    await waitS(f, () => window.FirefighterSpelling.getState().phase === "play");
    await f.evaluate(() => window.FirefighterSpelling._expire());
    await waitS(f, () => window.FirefighterSpelling.getState().phase === "lose");
    await f.waitForSelector("#ff-lose:not(.hidden)", { timeout: 30000 });
    let msgs = await wp.page.evaluate(() => window.msgs);
    check(!msgs.some((m) => m && m.type === "mrj-wm-game-done"), "WM: a loss posts nothing");
    await f.click("#ff-retry");
    await f.evaluate(PILOT, "fast");
    await waitS(f, () => window.FirefighterSpelling.getState().phase === "play" && window.FirefighterSpelling.getState().word === "two", null, 30000);
    await f.waitForTimeout(300); await wp.page.screenshot({ path: `${out}/13-wordmaster-play.png` });
    await waitS(f, () => window.FirefighterSpelling.getState().phase === "results", null, 60000);
    await f.waitForTimeout(700); await wp.page.screenshot({ path: `${out}/14-wordmaster-end.png` });
    msgs = await wp.page.evaluate(() => window.msgs); const done = msgs.filter((m) => m && m.type === "mrj-wm-game-done");
    check(done.length === 1 && done[0].game === "spellfire" && done[0].items === 2 && done[0].correct === 2 && done[0].finished === true, "WM: one mrj-wm-game-done " + JSON.stringify(done));
    check(net.length === 0, "WM copy loads no sign-in / score scripts");
    check((await f.evaluate(() => Object.keys(localStorage))).length === 0, "WM: nothing in localStorage");
    await wp.ctx.close(); ws.close();
  }
} catch (err) { fails.push("exception: " + err.message); console.log(err); }
await browser.close(); server.close();
console.log(fails.length ? `SMOKE FAIL (${fails.length})\n` + fails.join("\n") : "SMOKE OK"); process.exit(fails.length ? 1 : 0);
