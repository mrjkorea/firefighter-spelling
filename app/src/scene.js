// Firefighter Spelling — canvas renderer (night city, burning tower, truck + ladder, hose spray, Grandma).
import { roundRect } from "./kit/ui.js";
import { ease, clamp, lerp } from "./kit/fx.js";
import { WINDOWS } from "./rules.js";

const IMG = {};
for (const k of ["fireman", "grandma", "hug", "truck", "helicopter", "flames"]) { const i = new Image(); i.decoding = "async"; i.src = `./textures/${k}.webp`; IMG[k] = i; }
const ok = (i) => i && i.complete && i.naturalWidth > 0;
const FONT = "Fredoka, system-ui, sans-serif";

export function createScene(stage, S, fx) {
  const g = stage.g;
  let bg = null, bgKey = "";
  const smoke = [], embers = [];
  let L = null;

  function layout() {
    const w = stage.w, h = stage.h;
    const floors = Math.max(1, S.floors || 3);
    const top = h < 560 ? 104 : 124;
    const groundY = h - clamp(h * 0.09, 40, 76);
    const leftLane = clamp(w * (w < 600 ? 0.2 : 0.3), 74, 400);
    const pad = w < 600 ? 10 : 40;
    const bw = Math.min(w - leftLane - pad, 640);
    const bx = leftLane + Math.max(0, (w - leftLane - pad - bw) / 2);
    const gH = clamp(h * 0.14, 64, 150);
    const lobby = clamp(h * 0.05, 26, 50);
    const floorH = clamp((groundY - top - gH - lobby - 10) / floors, 30, 108);
    const bh = floorH * floors + lobby + 10;
    const by = groundY - bh;
    const wp = clamp(bw * 0.025, 4, 14);
    const ww = (bw - wp * (WINDOWS + 1)) / WINDOWS;
    const wh = Math.min(floorH * 0.8, ww * 1.18);
    const truckW = clamp(leftLane * 1.05, 120, 330), truckH = truckW / 3;
    const tIn = S.phase === "truck" ? ease.outCubic(clamp(S.truckT / 2.2, 0, 1)) : 1;
    const truckX = lerp(-truckW - 20, Math.max(4, bx - truckW * 0.92), tIn);
    return { w, h, floors, top, groundY, bx, by, bw, bh, floorH, lobby, wp, ww, wh, gH, truckW, truckH, truckX, truckY: groundY - truckH };
  }
  const floorTop = (f) => L.groundY - L.lobby - (f + 1) * L.floorH;
  const floorMidY = (f) => (f >= L.floors ? L.by - L.gH * 0.35 : floorTop(f) + L.floorH * 0.5);
  function windowRect(f, i) {
    L = L || layout();
    const y = floorTop(f) + (L.floorH - L.wh) * 0.5;
    return { x: L.bx + L.wp + i * (L.ww + L.wp), y, w: L.ww, h: L.wh };
  }
  function hitWindow(px, py) {
    L = layout();
    let best = -1, bestD = 34;
    for (let i = 0; i < WINDOWS; i++) {
      const r = windowRect(S.floor, i), p = 10;
      if (px >= r.x - p && px <= r.x + r.w + p && py >= r.y - p && py <= r.y + r.h + p) return i;
      const d = Math.hypot(px - (r.x + r.w / 2), py - (r.y + r.h / 2));
      if (d < bestD) { bestD = d; best = i; }
    }
    return best;
  }
  function grandmaPos() {
    L = L || layout();
    const s = L.gH;
    return { x: L.bx + L.bw * 0.7, y: L.by - s * 0.5, s };
  }

  // ---------- background (cached) ----------
  function buildBg() {
    const key = `${Math.round(L.w)}x${Math.round(L.h)}:${stage.dpr}`;
    if (key === bgKey) return;
    bgKey = key;
    bg = document.createElement("canvas");
    bg.width = Math.round(L.w * stage.dpr); bg.height = Math.round(L.h * stage.dpr);
    const c = bg.getContext("2d"); c.scale(stage.dpr, stage.dpr);
    const sky = c.createLinearGradient(0, 0, 0, L.h);
    sky.addColorStop(0, "#0b1033"); sky.addColorStop(0.55, "#2a1747"); sky.addColorStop(1, "#6b2a2a");
    c.fillStyle = sky; c.fillRect(0, 0, L.w, L.h);
    // moon
    const mx = L.w * 0.12, my = L.h * 0.16, mr = clamp(L.w * 0.035, 18, 44);
    const mg = c.createRadialGradient(mx, my, mr * 0.5, mx, my, mr * 3);
    mg.addColorStop(0, "rgba(255,240,200,.35)"); mg.addColorStop(1, "rgba(255,240,200,0)");
    c.fillStyle = mg; c.fillRect(mx - mr * 3, my - mr * 3, mr * 6, mr * 6);
    c.fillStyle = "#fff4d6"; c.beginPath(); c.arc(mx, my, mr, 0, Math.PI * 2); c.fill();
    c.fillStyle = "#e9dcb8"; c.beginPath(); c.arc(mx + mr * 0.3, my - mr * 0.2, mr * 0.18, 0, 7); c.arc(mx - mr * 0.35, my + mr * 0.3, mr * 0.12, 0, 7); c.fill();
    // two skyline layers
    let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    [["#1a1436", 0.62, 0.5], ["#120d26", 0.74, 0.8]].forEach(([col, base, k]) => {
      let x = -10;
      while (x < L.w + 10) {
        const bw = 30 + rnd() * 70 * k, bh = L.h * (0.12 + rnd() * 0.2) * k;
        const y = L.groundY - bh - L.h * (1 - base) * 0.2;
        c.fillStyle = col; c.fillRect(x, y, bw, L.groundY - y);
        c.fillStyle = "rgba(255,210,120,.22)";
        for (let wy = y + 8; wy < L.groundY - 10; wy += 14) for (let wx = x + 6; wx < x + bw - 6; wx += 12) if (rnd() < 0.18) c.fillRect(wx, wy, 5, 7);
        x += bw + 2 + rnd() * 10;
      }
    });
    // ground + street
    const gr = c.createLinearGradient(0, L.groundY, 0, L.h);
    gr.addColorStop(0, "#3a3346"); gr.addColorStop(1, "#1d1828");
    c.fillStyle = gr; c.fillRect(0, L.groundY, L.w, L.h - L.groundY);
    c.fillStyle = "#595066"; c.fillRect(0, L.groundY, L.w, 4);
    c.fillStyle = "rgba(255,230,140,.5)";
    for (let x = 10; x < L.w; x += 70) c.fillRect(x, L.groundY + (L.h - L.groundY) * 0.55, 34, 4);
  }

  // ---------- pieces ----------
  function drawFlame(x, y, s, a = 1, seed = 0) {
    const fl = 1 + Math.sin(S.t * 13 + seed * 3.1) * 0.08 + Math.sin(S.t * 7.3 + seed) * 0.06;
    g.globalAlpha = a;
    if (ok(IMG.flames)) {
      const iw = s * 0.7 * fl, ih = s * fl * (1 + Math.sin(S.t * 9 + seed) * 0.05);
      g.drawImage(IMG.flames, x - iw / 2, y - ih, iw, ih);
    } else {
      g.fillStyle = "#ff7a1a"; g.beginPath(); g.ellipse(x, y - s * 0.4, s * 0.3, s * 0.5 * fl, 0, 0, 7); g.fill();
    }
    g.globalAlpha = 1;
  }
  function glow(x, y, r, col) {
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, col); gr.addColorStop(1, "rgba(255,120,30,0)");
    g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  function tile(r, ch, { state = "live", pop = 0, idx = 0 }) {
    const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
    g.save(); g.translate(cx, cy);
    let sc = 1;
    if (state === "live") sc = 1 + Math.sin(S.t * 4 + idx * 0.9) * 0.025;
    if (pop > 0) sc *= 1 + Math.sin(pop * Math.PI) * 0.18;
    if (state === "wrong" && pop > 0) g.translate(Math.sin(S.t * 70) * 5 * pop, 0);
    g.scale(sc, sc);
    const w = r.w, h = r.h;
    // frame
    g.fillStyle = "#2b1d22"; roundRect(g, -w / 2 - 3, -h / 2 - 3, w + 6, h + 6, 8); g.fill();
    let fill;
    if (state === "live") { fill = g.createLinearGradient(0, -h / 2, 0, h / 2); fill.addColorStop(0, "#fff6c9"); fill.addColorStop(1, "#ffc861"); }
    else if (state === "done") { fill = g.createLinearGradient(0, -h / 2, 0, h / 2); fill.addColorStop(0, "#9ef0b0"); fill.addColorStop(1, "#3fbf6a"); }
    else if (state === "wrong") fill = "#ff7b6b";
    else if (state === "wet") fill = "#30415c";
    else { fill = g.createLinearGradient(0, -h / 2, 0, h / 2); fill.addColorStop(0, "#ff9a3c"); fill.addColorStop(1, "#c2361b"); }
    g.fillStyle = fill; roundRect(g, -w / 2, -h / 2, w, h, 6); g.fill();
    // sill + cross bar
    g.fillStyle = "rgba(0,0,0,.18)"; g.fillRect(-w / 2, h * 0.08, w, 2);
    g.fillStyle = "#e9d7c2"; g.fillRect(-w / 2 - 4, h / 2 - 2, w + 8, 5);
    if (ch) {
      const fs = Math.min(w * 0.72, h * 0.68);
      g.font = `700 ${fs}px ${FONT}`; g.textAlign = "center"; g.textBaseline = "middle";
      g.lineWidth = Math.max(3, fs * 0.1); g.strokeStyle = state === "live" ? "#fff" : "rgba(0,0,0,.25)";
      if (state === "live" || state === "done" || state === "wrong") g.strokeText(ch, 0, 2);
      g.fillStyle = state === "live" ? "#5a2410" : state === "done" ? "#0f4b26" : state === "wrong" ? "#5a0f0f" : "rgba(255,230,200,.45)";
      g.fillText(ch, 0, 2);
    }
    g.restore();
  }
  function drawBuilding(dropY) {
    g.save(); g.translate(0, dropY);
    const { bx, by, bw, bh } = L;
    // body
    const body = g.createLinearGradient(bx, 0, bx + bw, 0);
    body.addColorStop(0, "#8a3b2c"); body.addColorStop(0.5, "#a44a35"); body.addColorStop(1, "#7a3326");
    g.fillStyle = body; g.fillRect(bx, by, bw, bh);
    // bricks
    if (!stage.low) {
      g.strokeStyle = "rgba(40,10,5,.18)"; g.lineWidth = 1;
      for (let y = by + 8, r = 0; y < by + bh; y += 9, r++) { g.beginPath(); g.moveTo(bx, y); g.lineTo(bx + bw, y); g.stroke(); }
    }
    // soot gets heavier with the fire
    const soot = g.createLinearGradient(0, by, 0, by + bh);
    soot.addColorStop(0, `rgba(20,8,8,${0.25 + S.engulf * 0.35})`); soot.addColorStop(1, "rgba(20,8,8,0)");
    g.fillStyle = soot; g.fillRect(bx, by, bw, bh);
    // roof ledge
    g.fillStyle = "#4b2220"; g.fillRect(bx - 8, by - 8, bw + 16, 12);
    g.fillStyle = "#5e2b27"; g.fillRect(bx + bw * 0.08, by - 26, bw * 0.16, 18);
    // lobby + door
    const ly = L.groundY - L.lobby;
    g.fillStyle = "#5e2b27"; g.fillRect(bx, ly, bw, 4);
    g.fillStyle = "#2a1414"; roundRect(g, bx + bw * 0.44, ly + 6, bw * 0.12, L.lobby - 6, 4); g.fill();
    // floors
    const word = (S.word || "").toUpperCase();
    for (let f = 0; f < L.floors; f++) {
      const row = S.rows[f] || [];
      for (let i = 0; i < WINDOWS; i++) {
        const r = windowRect(f, i);
        let st = "above";
        if (S.phase === "lose" || f > S.floor) st = "above";
        else if (f < S.floor) st = S.wet[f] === i ? "done" : "wet";
        else if (f === S.floor) {
          if (S.phase === "play" || S.phase === "intro") st = S.popSlot === i && S.popT > 0 && !S.popOk ? "wrong" : "live";
          else st = "above";
          if (S.climbing && S.wet[f] === i) st = "done";
        }
        if (S.phase === "win" || S.phase === "fly" || S.phase === "wait" || S.phase === "results") st = f < S.floor ? (S.wet[f] === i ? "done" : "wet") : st;
        const showCh = st === "live" || st === "done" || st === "wrong" || (st === "above" && f === S.floor + 1 && S.phase === "play");
        tile(r, showCh ? row[i] : "", { state: st, pop: S.popSlot === i && f === S.floor ? S.popT : 0, idx: i + f * 5 });
      }
      // current floor highlight
      if (f === S.floor && S.phase === "play") {
        const a = 0.55 + Math.sin(S.t * 6) * 0.25;
        g.strokeStyle = `rgba(255,236,120,${a})`; g.lineWidth = 3;
        roundRect(g, bx - 4, floorTop(f) + 2, bw + 8, L.floorH - 4, 10); g.stroke();
      }
    }
    // flames on burning floors
    const low = stage.low;
    for (let f = Math.max(0, S.floor); f < L.floors + 1; f++) {
      if (S.phase === "results") break;
      const heatHere = f === S.floor && S.phase === "play" ? 0.5 + (1 - S.timerMs / Math.max(1, S.timerMax)) * 0.7 + (S.engulf - 0.12) * 0.6 : 0.6;
      const yb = f >= L.floors ? by + 2 : floorTop(f) + L.floorH * 0.18;
      const count = low ? 2 : f >= L.floors ? 4 : 3;
      for (let k = 0; k < count; k++) {
        const fx_ = bx + bw * ((k + 0.5) / count) + Math.sin(f * 3 + k) * bw * 0.08;
        const s = L.floorH * (0.55 + 0.25 * Math.sin(f + k * 2)) * heatHere;
        if (!low) { g.globalCompositeOperation = "lighter"; glow(fx_, yb - s * 0.3, s * 0.9, "rgba(255,140,40,.35)"); g.globalCompositeOperation = "source-over"; }
        drawFlame(fx_, yb + s * 0.15, s, 0.92, f * 5 + k);
      }
    }
    g.restore();
  }
  function ladderGeom() {
    const baseX = L.truckX + L.truckW * 0.55, baseY = L.truckY + L.truckH * 0.12;
    const fTop = S.floor + (S.climbing ? ease.inOut(S.ladderT) : 0);
    const topF = Math.min(L.floors - 0.0001, fTop);
    const topY = lerp(floorMidY(Math.floor(topF)), floorMidY(Math.floor(topF) + 1), topF - Math.floor(topF)) + L.floorH * 0.35;
    return { baseX, baseY, topX: L.bx - 4, topY };
  }
  function drawLadder(lg) {
    const { baseX, baseY, topX, topY } = lg;
    const dx = topX - baseX, dy = topY - baseY, len = Math.hypot(dx, dy), ang = Math.atan2(dy, dx);
    g.save(); g.translate(baseX, baseY); g.rotate(ang);
    const wid = clamp(L.truckW * 0.09, 10, 22);
    g.fillStyle = "#c9ced8";
    g.fillRect(0, -wid / 2, len, 3); g.fillRect(0, wid / 2 - 3, len, 3);
    g.fillStyle = "#9aa2b2";
    for (let x = 6; x < len; x += 12) g.fillRect(x, -wid / 2, 3, wid);
    g.restore();
  }
  function pointOnLadder(lg, y) {
    const t = clamp((y - lg.baseY) / (lg.topY - lg.baseY || 1), 0, 1);
    return { x: lerp(lg.baseX, lg.topX, t), y: lerp(lg.baseY, lg.topY, t) };
  }
  function drawTruck() {
    const { truckX: x, truckY: y, truckW: w, truckH: h } = L;
    if (ok(IMG.truck)) g.drawImage(IMG.truck, x, y, w, h);
    else { g.fillStyle = "#d32020"; roundRect(g, x, y, w, h, 8); g.fill(); }
    // light bar
    const on = Math.floor(S.t * 6) % 2;
    const lx = x + w * 0.83, ly = y + h * 0.08;
    if (!stage.low) { g.globalCompositeOperation = "lighter"; glow(lx, ly, h * 0.9, on ? "rgba(255,40,40,.55)" : "rgba(60,120,255,.55)"); g.globalCompositeOperation = "source-over"; }
  }
  function drawFirefighter(lg) {
    if (S.phase === "win" || S.phase === "fly" || S.phase === "wait" || S.phase === "results") return;
    const f = S.floor + (S.climbing && S.ladderT >= 1 ? ease.inOut(S.climbT) : 0);
    const fy = lerp(floorMidY(Math.floor(f)), floorMidY(Math.floor(f) + 1), f - Math.floor(f)) + L.floorH * 0.55;
    const p = S.phase === "truck" || S.phase === "tap" ? { x: L.truckX + L.truckW * 0.3, y: L.truckY + L.truckH * 0.2 } : pointOnLadder(lg, fy);
    const hgt = clamp(L.floorH * 1.05, 46, 110), wid = hgt * (147 / 384);
    const bob = S.climbing ? Math.sin(S.t * 18) * 2 : Math.sin(S.t * 3) * 1.5;
    if (ok(IMG.fireman)) g.drawImage(IMG.fireman, p.x - wid * 0.6, p.y - hgt + bob, wid, hgt);
    S._nozzle = { x: p.x + wid * 0.35, y: p.y - hgt * 0.55 + bob };
  }
  function drawSpray() {
    if (S.sprayT <= 0 || !S.sprayTo || !S._nozzle) return;
    const a = S._nozzle, b = S.sprayTo, k = S.sprayT / 0.55;
    const cx = (a.x + b.x) / 2, cy = Math.min(a.y, b.y) - 40;
    g.save();
    g.globalAlpha = Math.min(1, k * 2);
    g.lineCap = "round";
    g.strokeStyle = "rgba(120,200,255,.55)"; g.lineWidth = 12;
    g.beginPath(); g.moveTo(a.x, a.y); g.quadraticCurveTo(cx, cy, b.x, b.y); g.stroke();
    g.strokeStyle = "rgba(230,248,255,.9)"; g.lineWidth = 4; g.setLineDash([14, 10]); g.lineDashOffset = -S.t * 220;
    g.beginPath(); g.moveTo(a.x, a.y); g.quadraticCurveTo(cx, cy, b.x, b.y); g.stroke();
    g.restore();
    if (Math.random() < 0.6) fx.burst(b.x, b.y, { n: 3, color: ["#e6f7ff", "#9fd8ff"], speed: 160, size: 4, life: 0.5, grav: 500 });
    if (!stage.low && Math.random() < 0.4) smoke.push({ x: b.x, y: b.y, r: 10, vx: (Math.random() - 0.5) * 20, vy: -50, life: 1.2, max: 1.2, col: "230,235,245" });
  }
  function drawGrandma() {
    const gp = grandmaPos();
    if ((S.phase === "lose" || S.phase === "over") && S.loseKind === "tries") return drawGrandmaLost(gp);
    if (S.phase === "win" || S.phase === "wait" || S.phase === "fly" || S.phase === "results") return drawRescue(gp);
    if (S.phase === "lose" && S.loseStage !== "fire") return;
    const h = gp.s * 1.05, w = h * (228 / 384);
    const wob = Math.sin(S.t * 5) * 0.07;
    g.save(); g.translate(gp.x, L.by - 4); g.rotate(wob);
    if (ok(IMG.grandma)) g.drawImage(IMG.grandma, -w / 2, -h, w, h);
    g.restore();
    if (S.phase === "play" || S.phase === "intro" || S.phase === "truck") bubble(gp.x - w * 0.6, L.by - h - 8, S.phase === "intro" ? "Listen!" : S.timerMs / S.timerMax < 0.3 ? "HURRY!" : "HELP!");
  }
  function drawRescue(gp) {
    const lg = ladderGeom();
    const t = S.phase === "win" ? ease.inOut(clamp(S.winT / 1.6, 0, 1)) : 1;
    const startY = L.by - 4, endY = L.groundY - 2;
    const y = lerp(startY, endY, t), x = lerp(gp.x, L.bx - L.truckW * 0.25, t);
    const h = clamp(L.h * 0.22, 90, 210), w = h * (235 / 420);
    if (S.phase !== "fly" || S.grandmaFly <= 0) { if (ok(IMG.hug)) g.drawImage(IMG.hug, x - w / 2, y - h, w, h); if (S.phase === "win" && S.winT > 0.3) bubble(x + w * 0.2, y - h - 6, "Thank you!"); }
    void lg;
  }
  function bubble(x, y, text) {
    g.font = `700 ${clamp(L.h * 0.024, 13, 20)}px ${FONT}`;
    const tw = g.measureText(text).width + 18, th = clamp(L.h * 0.04, 24, 34);
    const bx = clamp(x - tw / 2, 6, L.w - tw - 6), by = Math.max(L.top - 10, y - th);
    g.fillStyle = "#fff"; roundRect(g, bx, by, tw, th, th / 2); g.fill();
    g.beginPath(); g.moveTo(bx + tw * 0.6, by + th - 1); g.lineTo(bx + tw * 0.72, by + th + 9); g.lineTo(bx + tw * 0.8, by + th - 1); g.fill();
    g.fillStyle = "#c2361b"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(text, bx + tw / 2, by + th / 2 + 1);
  }
  function drawHelo() {
    if (S.phase !== "fly") return;
    const w = clamp(L.w * 0.3, 160, 340), h = w * (160 / 360), y = L.top + 10 + Math.sin(S.t * 3) * 6;
    if (ok(IMG.helicopter)) g.drawImage(IMG.helicopter, S.heloX - w / 2, y, w, h);
    if (S.grandmaFly > 0) {
      const gh = h * 1.1, gw = gh * (235 / 420);
      g.strokeStyle = "#ddd"; g.lineWidth = 2; g.beginPath(); g.moveTo(S.heloX, y + h * 0.8); g.lineTo(S.heloX, y + h * 1.3); g.stroke();
      if (ok(IMG.hug)) g.drawImage(IMG.hug, S.heloX - gw / 2, y + h * 1.25, gw, gh);
    }
  }
  function drawSmoke(dt) {
    if (!stage.low && S.phase !== "results" && Math.random() < dt * 6) {
      smoke.push({ x: L.bx + Math.random() * L.bw, y: L.by - 10, r: 16 + Math.random() * 20, vx: 8 + Math.random() * 14, vy: -26 - Math.random() * 20, life: 4, max: 4, col: "40,30,45" });
    }
    if (S.phase === "play" || S.phase === "lose") {
      if (Math.random() < dt * (stage.low ? 4 : 12)) embers.push({ x: L.bx + Math.random() * L.bw, y: L.by + Math.random() * L.bh * 0.6, vx: (Math.random() - 0.5) * 30, vy: -60 - Math.random() * 60, life: 1.6 });
    }
    for (let i = smoke.length - 1; i >= 0; i--) {
      const p = smoke[i]; p.life -= dt; if (p.life <= 0) { smoke.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt; p.r += dt * 14;
      g.fillStyle = `rgba(${p.col},${0.35 * (p.life / p.max)})`; g.beginPath(); g.arc(p.x, p.y, p.r, 0, 7); g.fill();
    }
    g.fillStyle = "#ffb347";
    for (let i = embers.length - 1; i >= 0; i--) {
      const e = embers[i]; e.life -= dt; if (e.life <= 0) { embers.splice(i, 1); continue; }
      e.x += (e.vx + Math.sin(S.t * 4 + i) * 20) * dt; e.y += e.vy * dt;
      g.globalAlpha = Math.min(1, e.life); g.fillRect(e.x, e.y, 2.5, 2.5);
    }
    g.globalAlpha = 1;
    if (smoke.length > 90) smoke.splice(0, smoke.length - 90);
  }
  // ---------- HUD on canvas ----------
  function drawHeat() {
    if (!(S.phase === "play" || S.phase === "intro")) return;
    const pct = S.phase === "play" ? clamp(S.timerMs / S.timerMax, 0, 1) : 1;
    const bw = Math.min(L.w * 0.6, 420), bx = (L.w - bw) / 2, by = L.top - (L.h < 560 ? 52 : 62), bh = 18;
    g.fillStyle = "rgba(10,6,20,.7)"; roundRect(g, bx - 3, by - 3, bw + 6, bh + 6, 12); g.fill();
    const col = pct > 0.6 ? "#3ddc84" : pct > 0.3 ? "#ffb02e" : "#ff4b3a";
    const pulse = pct < 0.3 ? 0.75 + Math.sin(S.t * 18) * 0.25 : 1;
    g.globalAlpha = pulse; g.fillStyle = col; roundRect(g, bx, by, Math.max(bh, bw * pct), bh, 9); g.fill(); g.globalAlpha = 1;
    g.font = `700 13px ${FONT}`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillStyle = "#fff";
    g.fillText(S.phase === "play" ? `🔥 ${Math.ceil(S.timerMs / 1000)}s` : "🔥", L.w / 2, by + bh / 2 + 1);
    // spelled so far
    const word = S.word.toUpperCase(), n = word.length;
    const sz = clamp(Math.min((L.w * 0.8) / n - 6, 34), 18, 34), tot = n * (sz + 6) - 6;
    let x = (L.w - tot) / 2; const y = by + bh + 8;
    for (let i = 0; i < n; i++) {
      const done = i < S.floor;
      g.fillStyle = done ? "#3fbf6a" : i === S.floor ? "rgba(255,236,120,.9)" : "rgba(255,255,255,.18)";
      roundRect(g, x, y, sz, sz, 7); g.fill();
      if (done) { g.fillStyle = "#fff"; g.font = `700 ${sz * 0.7}px ${FONT}`; g.fillText(word[i], x + sz / 2, y + sz / 2 + 1); }
      x += sz + 6;
    }
  }
  function drawBanner() {
    let line = "";
    if (S.phase === "intro") line = "🔊 LISTEN…";
    else if (S.phase === "play") line = `FLOOR ${S.floor + 1} OF ${S.floors}`;
    else if (S.phase === "truck") line = "🚒 ON THE WAY!";
    if (!line) return;
    const size = clamp(L.h * 0.04, 20, 34), y = L.h - (L.h - L.groundY) / 2;
    g.font = `700 ${size}px ${FONT}`; g.textAlign = "center"; g.textBaseline = "middle";
    g.lineJoin = "round"; g.lineWidth = size * 0.22; g.strokeStyle = "#1a0f1f"; g.strokeText(line, L.w / 2, y);
    g.fillStyle = S.phase === "intro" ? `rgba(255,243,106,${0.75 + Math.sin(S.t * 6) * 0.25})` : "#fff36a"; g.fillText(line, L.w / 2, y);
  }
  // ---- 2-tries loss: pseudo-3D crumble (chunks tumble toward/away from the camera) + dust ----
  const chunks = [], dust = [];
  function crumble() {
    chunks.length = 0; dust.length = 0;
    const { bx, by, bw, bh } = L, cols = 5, rows = 8, cw = bw / cols, ch = bh / rows;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) chunks.push({ x: bx + c * cw + cw / 2, y: by + r * ch + ch / 2, w: cw * 0.96, h: ch * 0.96, vx: -(c - (cols - 1) / 2) * 18 + (Math.random() - 0.5) * 30,
      vy: -40 - Math.random() * 60, rot: 0, vr: (Math.random() - 0.5) * 5, z: 0, vz: (Math.random() - 0.5) * 0.7, tilt: 0, vt: (Math.random() - 0.5) * 6, delay: (rows - 1 - r) * 0.035 + Math.random() * 0.12, col: Math.random() < 0.3 ? "#6e2a1f" : "#a44a35", win: Math.random() < 0.25 });
  }
  function drawCrumble(dt) {
    const t = S.crumbleT, ground = L.groundY;
    // dust clouds rolling out from the base
    if (t < 2.4 && dust.length < (stage.low ? 30 : 70)) for (let i = 0; i < 3; i++) dust.push({ x: L.bx + Math.random() * L.bw, y: ground - Math.random() * 20, r: 20 + Math.random() * 30, vx: (Math.random() - 0.5) * 220, vy: -30 - Math.random() * 60, life: 2.4, max: 2.4 });
    for (const c of chunks) {
      if (t < c.delay) { drawChunk(c, 0); continue; }
      if (t > 2.6) { drawChunk(c, 0); continue; } // settled pile
      c.vy += 900 * dt; c.x += c.vx * dt; c.y += c.vy * dt; c.rot += c.vr * dt; c.z = clamp(c.z + c.vz * dt, -0.4, 0.5); c.tilt += c.vt * dt;
      if (c.y + c.h / 2 > ground) { c.y = ground - c.h / 2; c.vy *= -0.25; c.vx *= 0.6; c.vr *= 0.5; c.vt *= 0.5; }
      drawChunk(c, 1);
    }
    for (let i = dust.length - 1; i >= 0; i--) { const p = dust[i]; p.life -= dt; if (p.life <= 0) { dust.splice(i, 1); continue; } p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.97; p.r += 40 * dt;
      g.fillStyle = `rgba(190,175,160,${0.55 * p.life / p.max})`; g.beginPath(); g.arc(p.x, p.y, p.r, 0, Math.PI * 2); g.fill(); }
    if (t > 0.2 && t < 2.6) { // big cartoon text
      const s = clamp(L.w * 0.07, 26, 56), k = ease.outBack(clamp((t - 0.2) / 0.4, 0, 1));
      g.save(); g.translate(L.w / 2, L.h * 0.28); g.scale(k, k); g.font = `700 ${s}px ${FONT}`; g.textAlign = "center"; g.textBaseline = "middle";
      g.lineWidth = 8; g.strokeStyle = "#3a0700"; g.strokeText("CRASH!", 0, 0); g.fillStyle = "#ffd43b"; g.fillText("CRASH!", 0, 0); g.restore();
    }
  }
  function drawChunk(c, live) {
    const sc = 1 + c.z * 0.35, sq = Math.max(0.15, Math.abs(Math.cos(c.tilt))); // z = toward camera, tilt = 3D flip
    g.save(); g.translate(c.x, c.y); g.rotate(c.rot); g.scale(sc, sc * sq);
    const d = 6 * sc; g.fillStyle = "#4a1a12"; g.fillRect(-c.w / 2 + d, -c.h / 2 + d, c.w, c.h); // side/back face
    g.fillStyle = c.col; g.fillRect(-c.w / 2, -c.h / 2, c.w, c.h);
    if (c.win) { g.fillStyle = live ? "#ff9a3c" : "#ffcf6a"; g.fillRect(-c.w * 0.25, -c.h * 0.3, c.w * 0.5, c.h * 0.6); }
    g.strokeStyle = "rgba(40,10,5,.35)"; g.lineWidth = 1.5; g.strokeRect(-c.w / 2, -c.h / 2, c.w, c.h);
    g.restore();
  }
  function drawGrandmaLost(gp) { // cartoon: Grandma fades away as a little ghost floating up — no injury shown
    const t = S.crumbleT; if (t > 2.8) return;
    const h = gp.s * 1.05, w = h * (228 / 384), up = t * 60;
    g.save(); g.globalAlpha = clamp(1 - t / 2.8, 0, 1) * 0.85; g.translate(gp.x, L.by - 4 - up);
    if (ok(IMG.grandma)) g.drawImage(IMG.grandma, -w / 2, -h, w, h);
    g.font = `${h * 0.35}px ${FONT}`; g.textAlign = "center"; g.fillText("💨", w * 0.4, -h * 0.2); g.restore();
  }
  function drawLose() {
    if (S.phase !== "lose" || S.loseKind === "tries") return;
    if (S.loseStage === "fire" || S.loseStage === "collapse") {
      const k = S.loseStage === "fire" ? clamp(S.loseT / 1.2, 0, 1) : 1;
      g.fillStyle = `rgba(90,10,0,${0.55 * k})`; g.fillRect(0, 0, L.w, L.h);
      const cnt = stage.low ? 7 : 14;
      for (let i = 0; i < cnt; i++) {
        const x = ((i + 0.5) / cnt) * L.w + Math.sin(S.t * 2 + i) * 20, s = L.h * (0.25 + 0.2 * Math.sin(i * 1.7 + S.t * 3)) * k;
        drawFlame(x, L.h + 10, s, 0.9, i);
      }
      g.font = `700 ${clamp(L.w * 0.07, 26, 54)}px ${FONT}`; g.textAlign = "center"; g.textBaseline = "middle";
      g.lineWidth = 8; g.strokeStyle = "#3a0700"; g.strokeText("THE FIRE SPREAD!", L.w / 2, L.h * 0.4); g.fillStyle = "#ffd43b"; g.fillText("THE FIRE SPREAD!", L.w / 2, L.h * 0.4);
      if (Math.random() < 0.5) fx.burst(Math.random() * L.w, L.h, { n: 3, color: ["#ffb347", "#ff6a1a"], speed: 300, size: 4, life: 1, grav: -100 });
      return;
    }
    // calm spelling replay
    const sky = g.createLinearGradient(0, 0, 0, L.h); sky.addColorStop(0, "rgba(16,24,64,.94)"); sky.addColorStop(1, "rgba(52,32,90,.94)");
    g.fillStyle = sky; g.fillRect(0, 0, L.w, L.h);
    const word = S.word.toUpperCase(), n = word.length;
    const sz = clamp(Math.min((L.w * 0.86) / n - 10, L.h * 0.16), 36, 110), tot = n * (sz + 10) - 10;
    let x = (L.w - tot) / 2; const y = L.h * 0.3;
    g.font = `700 ${clamp(L.h * 0.035, 18, 30)}px ${FONT}`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillStyle = "#cfe2ff";
    g.fillText("Here is the spelling:", L.w / 2, y - sz * 0.5);
    for (let i = 0; i < n; i++) {
      const shown = i <= S.slamI || S.narrDone;
      g.fillStyle = shown ? "#ffe27a" : "rgba(255,255,255,.12)";
      g.save(); g.translate(x + sz / 2, y + sz / 2 + 10);
      if (i === S.slamI && !S.narrDone) { const k = clamp(S.slamT / 0.25, 0, 1); const sc = lerp(1.8, 1, ease.outBack(k)); g.scale(sc, sc); }
      roundRect(g, -sz / 2, -sz / 2, sz, sz, sz * 0.18); g.fill();
      if (shown) { g.fillStyle = "#5a2410"; g.font = `700 ${sz * 0.7}px ${FONT}`; g.fillText(word[i], 0, 3); }
      g.restore();
      x += sz + 10;
    }
  }

  // ---------- frame ----------
  function draw(dt) {
    L = layout();
    buildBg();
    g.clearRect(0, 0, L.w, L.h);
    g.drawImage(bg, 0, 0, L.w, L.h);
    if (!stage.low) {
      g.fillStyle = "#fff";
      for (let i = 0; i < 40; i++) { const sx = (i * 137.5) % L.w, sy = (i * 71.3) % (L.h * 0.45); g.globalAlpha = 0.3 + 0.5 * Math.abs(Math.sin(S.t * 1.3 + i)); g.fillRect(sx, sy, 1.6, 1.6); }
      g.globalAlpha = 1;
      // fire glow behind tower
      g.globalCompositeOperation = "lighter";
      glow(L.bx + L.bw / 2, L.by + L.bh * 0.3, Math.max(L.bw, L.bh) * 0.8, `rgba(255,90,20,${0.18 + S.engulf * 0.12})`);
      g.globalCompositeOperation = "source-over";
    }
    g.save(); fx.applyShake(g);
    const drop = S.phase === "lose" && S.loseStage === "collapse" ? ease.inOut(clamp(S.collapseT / 1.7, 0, 1)) * L.bh * 0.7 : 0;
    const clearLose = S.phase === "lose" && S.loseStage === "heaven";
    const crumbling = (S.phase === "lose" || S.phase === "over") && S.loseKind === "tries";
    if (crumbling) { drawCrumble(dt); drawSmoke(dt); drawTruck(); drawFirefighter(ladderGeom()); drawGrandma(); }
    else if (!clearLose) {
      drawBuilding(drop);
      drawSmoke(dt);
      const lg = ladderGeom();
      if (S.phase !== "truck" && S.phase !== "tap" && S.phase !== "lose") drawLadder(lg);
      drawTruck();
      drawFirefighter(lg);
      drawSpray();
      drawGrandma();
      drawHelo();
    }
    fx.draw(g);
    g.restore();
    drawLose();
    drawHeat();
    drawBanner();
    fx.drawFlash(g, L.w, L.h);
  }
  return { draw, windowRect, hitWindow, grandmaPos, newWord() { smoke.length = 0; chunks.length = 0; dust.length = 0; }, crumble };
}
