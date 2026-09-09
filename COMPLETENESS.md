# Firefighter Spelling — completeness check (09SEP2026)

Live Pages source: GitHub Pages `main` `/` → https://mrjkorea.github.io/firefighter-spelling/

## What I checked (play path)

| Asset | Result |
| --- | --- |
| `index.html` | Present. Relative `src/` CSS/JS. Cache-bust `?v=1.6.1`. |
| `src/engine.js` | Canvas engine, pack fetch, phone tap + keys 1–5 / Enter. |
| `src/style.css` | Full-viewport canvas + classroom tools panel. |
| `packs/numbers-en.json` | Default pack (`one`–`five`). Engine does **not** hardcode the word list. |
| `packs/words.txt` | Fallback list (same five words). HTTP 200. |
| `packs/pack.schema.json` | Schema only; not required at runtime. |
| `audio/grandma/*.mp3` | All engine Grandma clips present (help/cheer/`g-thank-you`). Extra unused clips also present. |
| `audio/narrator/*.mp3` | `listen`, `the-word-is`, `again`, `please-spell`, `letter-a`–`letter-z`, `spell-*` / `no-*` / `word-*` for one–five. |
| `sprites/*.png` | `fireman`, `grandma`, `hug`, `truck`, `helicopter`, `ladder`, `flames` present. |
| `HOW-TO-PLAY.md` | Present (was terse). Expanded. |
| `how-to-play.html` | Added so classroom PCs can open a real page (`.md` is raw text on Pages). |
| `.nojekyll` | Present (needed so `src/` is not treated as Jekyll). |
| No `/api/tts` | Confirmed: no `/api/tts` in repo. |
| No `speechSynthesis` | Confirmed: no browser TTS. Offline `Audio()` mp3s only. |

Live HEAD (before this fix):

- `audio/grandma/g-help-me.mp3` **200**
- `audio/narrator/letter-a.mp3` **200**
- `public/audio/grandma/g-help-me.mp3` **404**
- `public/sprites/fireman.png` **404**
- `sprites/fireman.png` **200**

## What was broken

`src/engine.js` still used Vite-style `public/` prefixes:

- `preloadClip` → `public/audio/${folder}/${id}.mp3`
- `ttsUrl` / `letterAudioUrl` → `public/audio/narrator/...`
- sprites → `public/sprites/*.png`

GitHub Pages files live at repo-root `audio/` and `sprites/` (no `public/` folder). Grandma/narrator mp3s and PNG sprites 404’d even though the real files were HTTP 200.

Also: engine listed `public/sprites/angel.png` but **there is no angel sprite**. Heaven/lose uses canvas-drawn wings + Grandma, so the missing file was unused. The 404 was noise, not a gameplay crash.

## What I fixed

- Engine clip URLs: relative `audio/{grandma|narrator}/{id}.mp3` via `clipUrl()`.
- Sprite URLs: relative `sprites/{name}.png`. Dropped unused `angel` entry.
- Cache-bust `index.html` script/CSS to `?v=1.6.1` so Pages clients pick up the new engine.
- HOW-TO-PLAY: expanded `HOW-TO-PLAY.md` and added `how-to-play.html` plus a tools-panel link.
- No gameplay rewrite. Pack still `packs/numbers-en.json`. No TTS server. No `speechSynthesis`.

## Remaining gaps

- **Paste-list / “Hear it” for new words:** only baked clips speak (`one`–`five` plus letter A–Z and the Grandma/narrator lines). Custom pasted words play silently except letter-by-letter if you type a single letter. This is intended: do not add a Python TTS server.
- Bella / Puck buttons still toggle a stored gender, but baked mp3s are the only voices (no live TTS gender). Status text already says voices are ready.
- `?pack=session` falls back to `packs/animals.json`, which is **not in this repo** (404). Default play uses `packs/numbers-en.json` then `packs/words.txt`. Not on the normal play path.
- No `sprites/angel.png`. Lose/heaven already draws Grandma + wings in canvas; no gameplay gap.
- Extra unused Grandma mp3s (`help-me.mp3`, `hurry.mp3`, letter clips under `audio/grandma/`, etc.) are leftover files, not referenced by the engine. Harmless.
- GitHub Pages cache: after merge to `main`, wait for Pages build; hard-refresh if an old `engine.js` is cached.
