# firefighter-spelling

MRJ kid English game. Live: https://mrjkorea.github.io/firefighter-spelling/

Grandma is stuck on the roof of a burning building. Listen to the word, then tap the window with the next
letter on each floor. Right letter: the hose puts out that window and the firefighter climbs. Wrong letter:
the fire flares and you stay on that floor. Each letter has a fire clock (pack `seconds_per_letter`, default 5 s).
If the clock runs out the fire spreads, the game spells the word for you, then you try again or skip.

## 2026-10 rebuild (v2.0)
Same rules, packs and score hooks as v1.15; new Vite + Canvas 2D source in `app/src/`:

| file | what |
| --- | --- |
| `rules.js` | pack format, letters per floor, timer, points (pure, tested in `test/rules.test.js`) |
| `game.js` | game flow (truck → listen → floors → rescue / fire → results) |
| `scene.js` | renderer: night city, burning tower, ladder, hose spray, smoke, embers, Grandma, helicopter |
| `voice.js` | baked mp3 voices (narrator letters / prompts, Grandma lines, pack word audio). No TTS |
| `report.js` | mrj-signin progress + `MRJ_SCORES.post` (standalone) / `mrj-wm-game-done` (Word Master) |
| `kit/` | shared MRJ game kit: WebAudio + iOS unlock + mute, responsive canvas + auto low quality, input, fx |

- Build: `npm i && npm run build` (writes `index.html` + `assets/` at the repo root for Pages).
- Word Master copy: `node scripts/publish.mjs --wm ../word-master/games/spellfire`.
- Tests: `npm test`. Smoke (Playwright, zz_test ids, posts intercepted): `npm run smoke`.
- `?q=low` forces low quality (it also switches on by itself when the frame rate drops).
- Nothing is saved on the device. Progress comes from the mrj-signin cloud.
- Portable: no desktop-only APIs; pointer + keyboard input; works in a Capacitor / Tauri webview.

Keys: `1`–`5` pick a window, `Enter` starts / tries again / plays again.
Old v1.15 files (`src/engine.js`, `sprites/`, `public/`) are kept for reference; the new build does not load them.
