"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const W = 960;
const H = 540;
const GROUND = 390;

type Fighter = {
  id: number;
  side: "human" | "zombie";
  kind: string;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  speed: number;
  damage: number;
  range: number;
  cooldown: number;
  attackEvery: number;
  flash: number;
  step: number;
};

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
  size: number;
};

type Shot = { x: number; y: number; tx: number; ty: number; life: number; side: string };

type Game = {
  running: boolean;
  paused: boolean;
  over: boolean;
  won: boolean;
  time: number;
  last: number;
  energy: number;
  scrap: number;
  kills: number;
  wave: number;
  nextWave: number;
  baseHp: number;
  nestHp: number;
  fighters: Fighter[];
  particles: Particle[];
  shots: Shot[];
  nextId: number;
  shake: number;
  strikeCooldown: number;
  banner: string;
  bannerTime: number;
};

const cards = [
  { kind: "scout", name: "SCOUT", cost: 25, key: "1", desc: "FAST" },
  { kind: "ranger", name: "RANGER", cost: 45, key: "2", desc: "RANGED" },
  { kind: "brute", name: "BREAKER", cost: 70, key: "3", desc: "ARMORED" },
];

const initialGame = (): Game => ({
  running: false,
  paused: false,
  over: false,
  won: false,
  time: 0,
  last: 0,
  energy: 55,
  scrap: 0,
  kills: 0,
  wave: 1,
  nextWave: 15,
  baseHp: 320,
  nestHp: 420,
  fighters: [],
  particles: [],
  shots: [],
  nextId: 1,
  shake: 0,
  strikeCooldown: 0,
  banner: "WAVE 1 INCOMING",
  bannerTime: 2.4,
});

function addParticles(g: Game, x: number, y: number, color: string, count = 8) {
  for (let i = 0; i < count; i++) {
    g.particles.push({
      x,
      y,
      vx: (Math.random() - 0.5) * 120,
      vy: -Math.random() * 110 - 20,
      life: 0.4 + Math.random() * 0.5,
      color,
      size: 2 + Math.random() * 4,
    });
  }
}

function pixelRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

function drawHuman(ctx: CanvasRenderingContext2D, f: Fighter, t: number) {
  const bob = Math.sin(f.step * 7) * 2;
  ctx.save();
  ctx.translate(Math.round(f.x), Math.round(f.y + bob));
  if (f.flash > 0) ctx.globalAlpha = 0.55;
  const body = f.kind === "brute" ? "#d9903d" : f.kind === "ranger" ? "#7ca879" : "#d8c3a4";
  const scale = f.kind === "brute" ? 1.17 : 1;
  ctx.scale(scale, scale);
  pixelRect(ctx, -7, -38, 14, 12, "#c59a72");
  pixelRect(ctx, -8, -41, 17, 5, f.kind === "ranger" ? "#6e3f2d" : "#383230");
  pixelRect(ctx, -9, -26, 18, 22, body);
  pixelRect(ctx, -7, -4, 6, 15, "#393d3b");
  pixelRect(ctx, 3, -4, 6, 15, "#2b302f");
  pixelRect(ctx, -11, -24, 5, 16, "#c59a72");
  pixelRect(ctx, 7, -24, 5, 16, "#c59a72");
  if (f.kind === "ranger") {
    pixelRect(ctx, 8, -23, 24, 5, "#292829");
    pixelRect(ctx, 25, -20, 8, 2, "#a36d34");
  } else if (f.kind === "brute") {
    pixelRect(ctx, 7, -26, 8, 24, "#5d6360");
    pixelRect(ctx, 13, -28, 5, 29, "#b8aaa0");
  } else {
    pixelRect(ctx, 7, -22, 15, 6, "#836145");
  }
  pixelRect(ctx, 0, -34, 3, 2, "#17191a");
  ctx.restore();
}

function drawZombie(ctx: CanvasRenderingContext2D, f: Fighter) {
  const bob = Math.sin(f.step * 6) * 2;
  ctx.save();
  ctx.translate(Math.round(f.x), Math.round(f.y + bob));
  if (f.flash > 0) ctx.globalAlpha = 0.5;
  const big = f.kind === "crusher";
  const scale = big ? 1.35 : f.kind === "runner" ? 0.88 : 1;
  ctx.scale(scale, scale);
  pixelRect(ctx, -8, -38, 16, 13, big ? "#71855d" : "#88a36d");
  pixelRect(ctx, -7, -25, 15, 22, big ? "#4b3433" : "#514a42");
  pixelRect(ctx, -8, -3, 6, 15, "#333333");
  pixelRect(ctx, 3, -3, 7, 15, "#282a28");
  pixelRect(ctx, -15, -23, 9, 5, "#779463");
  pixelRect(ctx, 7, -21, 13, 5, "#779463");
  pixelRect(ctx, -5, -34, 3, 3, "#ff6b2d");
  pixelRect(ctx, 3, -34, 3, 3, "#ff6b2d");
  pixelRect(ctx, -2, -28, 7, 2, "#281c1b");
  ctx.restore();
}

function drawWorld(ctx: CanvasRenderingContext2D, g: Game) {
  const sx = g.shake > 0 ? (Math.random() - 0.5) * g.shake : 0;
  const sy = g.shake > 0 ? (Math.random() - 0.5) * g.shake : 0;
  ctx.save();
  ctx.translate(sx, sy);

  const sky = ctx.createLinearGradient(0, 0, 0, GROUND);
  sky.addColorStop(0, "#17232c");
  sky.addColorStop(0.52, "#54463e");
  sky.addColorStop(1, "#b66b3f");
  ctx.fillStyle = sky;
  ctx.fillRect(-10, -10, W + 20, H + 20);

  ctx.fillStyle = "rgba(232,129,71,.18)";
  ctx.beginPath();
  ctx.arc(745, 112, 55, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#d79b65";
  ctx.beginPath();
  ctx.arc(745, 112, 34, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#253037";
  ctx.beginPath();
  ctx.moveTo(0, 278);
  ctx.lineTo(90, 225);
  ctx.lineTo(170, 262);
  ctx.lineTo(280, 199);
  ctx.lineTo(372, 270);
  ctx.lineTo(470, 220);
  ctx.lineTo(570, 278);
  ctx.lineTo(690, 212);
  ctx.lineTo(790, 268);
  ctx.lineTo(890, 218);
  ctx.lineTo(960, 244);
  ctx.lineTo(960, 400);
  ctx.lineTo(0, 400);
  ctx.fill();

  ctx.fillStyle = "#30363a";
  for (let i = 0; i < 11; i++) {
    const x = 45 + i * 93;
    const bh = 35 + ((i * 37) % 62);
    ctx.fillRect(x, 305 - bh, 52, bh);
    ctx.fillStyle = "#20272b";
    ctx.fillRect(x + 11, 315 - bh, 8, 10);
    ctx.fillRect(x + 31, 325 - bh, 7, 8);
    ctx.fillStyle = "#30363a";
  }
  ctx.strokeStyle = "#27292a";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(610, 305);
  ctx.lineTo(630, 235);
  ctx.lineTo(655, 305);
  ctx.moveTo(616, 275);
  ctx.lineTo(649, 275);
  ctx.stroke();
  ctx.strokeStyle = "rgba(32,35,35,.8)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(628, 240);
  ctx.lineTo(850, 260);
  ctx.stroke();

  ctx.fillStyle = "#4b4136";
  ctx.fillRect(0, GROUND, W, H - GROUND);
  ctx.fillStyle = "#665545";
  ctx.fillRect(0, GROUND, W, 9);
  ctx.fillStyle = "#342f2a";
  for (let i = 0; i < 28; i++) {
    const x = (i * 97 + 33) % W;
    const y = GROUND + 15 + ((i * 43) % 115);
    ctx.fillRect(x, y, 9 + (i % 3) * 6, 3);
  }
  ctx.fillStyle = "rgba(151,96,62,.28)";
  ctx.fillRect(0, 430, W, 110);

  // Survivor crawler / base
  ctx.fillStyle = "#25292a";
  ctx.fillRect(25, 326, 130, 70);
  ctx.fillStyle = "#a35b31";
  ctx.fillRect(38, 337, 102, 48);
  ctx.fillStyle = "#50392f";
  ctx.fillRect(44, 343, 36, 22);
  ctx.fillStyle = "#88a29a";
  ctx.fillRect(87, 344, 38, 20);
  ctx.fillStyle = "#171a1b";
  ctx.beginPath(); ctx.arc(55, 397, 20, 0, Math.PI * 2); ctx.arc(126, 397, 20, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#73726a";
  ctx.beginPath(); ctx.arc(55, 397, 9, 0, Math.PI * 2); ctx.arc(126, 397, 9, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#d8a746";
  ctx.fillRect(145, 347, 8, 16);
  ctx.fillStyle = "#34393a";
  ctx.fillRect(28, 318, 75, 9);
  ctx.fillStyle = "#8b8d83";
  ctx.fillRect(91, 305, 7, 14);

  // Infected nest
  ctx.fillStyle = "#201c1c";
  ctx.fillRect(866, 315, 90, 80);
  ctx.fillStyle = "#493333";
  ctx.fillRect(878, 333, 66, 62);
  ctx.fillStyle = "#702e25";
  ctx.beginPath(); ctx.arc(911, 364, 24 + Math.sin(g.time * 3) * 2, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#ff5b2f";
  ctx.beginPath(); ctx.arc(911, 364, 9, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "rgba(255,91,47,.18)";
  ctx.beginPath(); ctx.arc(911, 364, 35, 0, Math.PI * 2); ctx.fill();

  for (const f of g.fighters) {
    if (f.side === "human") drawHuman(ctx, f, g.time);
    else drawZombie(ctx, f);
    const barW = f.kind === "crusher" || f.kind === "brute" ? 34 : 27;
    ctx.fillStyle = "rgba(0,0,0,.55)";
    ctx.fillRect(f.x - barW / 2, f.y - 52, barW, 4);
    ctx.fillStyle = f.side === "human" ? "#e9c65a" : "#cb5037";
    ctx.fillRect(f.x - barW / 2, f.y - 52, barW * Math.max(0, f.hp / f.maxHp), 4);
  }

  for (const s of g.shots) {
    const p = 1 - s.life / 0.12;
    const x = s.x + (s.tx - s.x) * p;
    const y = s.y + (s.ty - s.y) * p;
    ctx.strokeStyle = s.side === "human" ? "#ffe078" : "#e76747";
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 15, y); ctx.stroke();
  }
  for (const p of g.particles) {
    ctx.globalAlpha = Math.max(0, p.life * 1.6);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x, p.y, p.size, p.size);
  }
  ctx.globalAlpha = 1;

  ctx.fillStyle = "rgba(25,18,17,.1)";
  for (let i = 0; i < 18; i++) {
    const x = (i * 67 + g.time * (4 + (i % 3) * 2)) % W;
    const y = 45 + ((i * 53) % 270);
    ctx.fillRect(x, y, 2, 2);
  }
  ctx.restore();
}

export function AshfallGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Game>(initialGame());
  const audioRef = useRef<AudioContext | null>(null);
  const lastHudRef = useRef(0);
  const [started, setStarted] = useState(false);
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(false);
  const [hud, setHud] = useState({ energy: 55, scrap: 0, kills: 0, wave: 1, baseHp: 320, nestHp: 420, strike: 0 });
  const [end, setEnd] = useState<"win" | "lose" | null>(null);

  const tone = useCallback((freq: number, duration = 0.06, type: OscillatorType = "square") => {
    if (muted) return;
    try {
      const AudioCtx = window.AudioContext || (window as typeof window & { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!audioRef.current) audioRef.current = new AudioCtx();
      const a = audioRef.current;
      const o = a.createOscillator();
      const gain = a.createGain();
      o.type = type; o.frequency.value = freq;
      gain.gain.setValueAtTime(0.055, a.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, a.currentTime + duration);
      o.connect(gain); gain.connect(a.destination); o.start(); o.stop(a.currentTime + duration);
    } catch { /* Audio is optional. */ }
  }, [muted]);

  const spawnHuman = useCallback((kind: string) => {
    const g = gameRef.current;
    if (!g.running || g.paused || g.over) return;
    const data = kind === "ranger"
      ? { cost: 45, hp: 70, speed: 20, damage: 20, range: 145, attackEvery: 0.82 }
      : kind === "brute"
      ? { cost: 70, hp: 175, speed: 14, damage: 30, range: 28, attackEvery: 1.05 }
      : { cost: 25, hp: 80, speed: 27, damage: 13, range: 28, attackEvery: 0.62 };
    if (g.energy < data.cost) { tone(110, 0.1, "sawtooth"); return; }
    g.energy -= data.cost;
    g.fighters.push({ id: g.nextId++, side: "human", kind, x: 145, y: GROUND - 4, maxHp: data.hp, ...data, cooldown: 0, flash: 0, step: 0 });
    addParticles(g, 150, 370, "#d0b48b", 5);
    tone(kind === "brute" ? 110 : 220, 0.07);
  }, [tone]);

  const airStrike = useCallback(() => {
    const g = gameRef.current;
    if (!g.running || g.paused || g.over || g.strikeCooldown > 0) return;
    g.strikeCooldown = 20;
    g.shake = 16;
    for (const f of g.fighters) {
      if (f.side === "zombie" && f.x > 440) {
        f.hp -= 95;
        f.flash = 0.22;
        addParticles(g, f.x, f.y - 20, "#f28d46", 15);
      }
    }
    g.banner = "FIRE MISSION";
    g.bannerTime = 1.2;
    tone(68, 0.45, "sawtooth");
  }, [tone]);

  const startGame = useCallback(() => {
    const fresh = initialGame();
    fresh.running = true;
    gameRef.current = fresh;
    setStarted(true); setPaused(false); setEnd(null);
    tone(180, 0.12); setTimeout(() => tone(260, 0.12), 90);
  }, [tone]);

  const togglePause = useCallback(() => {
    const g = gameRef.current;
    if (!g.running || g.over) return;
    g.paused = !g.paused;
    setPaused(g.paused);
  }, []);

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "1") spawnHuman("scout");
      if (e.key === "2") spawnHuman("ranger");
      if (e.key === "3") spawnHuman("brute");
      if (e.key.toLowerCase() === "q") airStrike();
      if (e.key === "Escape" || e.key.toLowerCase() === "p") togglePause();
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [spawnHuman, airStrike, togglePause]);

  useEffect(() => {
    let frame = 0;
    const loop = (now: number) => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      const g = gameRef.current;
      if (!ctx) { frame = requestAnimationFrame(loop); return; }
      ctx.imageSmoothingEnabled = false;
      const dt = Math.min(0.033, g.last ? (now - g.last) / 1000 : 0);
      g.last = now;

      if (g.running && !g.paused && !g.over) {
        g.time += dt;
        g.energy = Math.min(100, g.energy + dt * 7.2);
        g.nextWave -= dt;
        g.strikeCooldown = Math.max(0, g.strikeCooldown - dt);
        g.bannerTime = Math.max(0, g.bannerTime - dt);
        g.shake = Math.max(0, g.shake - dt * 38);

        if (g.nextWave <= 0) {
          g.wave++;
          g.nextWave = Math.max(8, 16 - g.wave * 0.7);
          g.banner = `WAVE ${g.wave} — ${g.wave >= 5 ? "NIGHTMARE" : "INCOMING"}`;
          g.bannerTime = 2;
          const count = Math.min(7, 2 + g.wave);
          for (let i = 0; i < count; i++) {
            const kind = g.wave >= 3 && i === count - 1 ? "crusher" : Math.random() < 0.38 ? "runner" : "walker";
            const hp = kind === "crusher" ? 190 : kind === "runner" ? 50 : 82 + g.wave * 6;
            g.fighters.push({ id: g.nextId++, side: "zombie", kind, x: 850 + i * 23, y: GROUND - 4, hp, maxHp: hp, speed: kind === "runner" ? 34 : kind === "crusher" ? 11 : 18, damage: kind === "crusher" ? 34 : 14, range: 25, cooldown: i * 0.2, attackEvery: kind === "runner" ? 0.72 : 1.1, flash: 0, step: 0 });
          }
          tone(82, 0.25, "sawtooth");
        }

        if (g.time < 0.1 && g.fighters.length === 0) {
          for (let i = 0; i < 3; i++) {
            const hp = 76;
            g.fighters.push({ id: g.nextId++, side: "zombie", kind: i === 2 ? "runner" : "walker", x: 710 + i * 55, y: GROUND - 4, hp, maxHp: hp, speed: i === 2 ? 33 : 18, damage: 13, range: 25, cooldown: i * .35, attackEvery: .9, flash: 0, step: 0 });
          }
        }

        for (const f of g.fighters) {
          f.cooldown -= dt; f.flash = Math.max(0, f.flash - dt); f.step += dt;
          const enemies = g.fighters.filter(o => o.side !== f.side && o.hp > 0);
          let target: Fighter | undefined;
          let dist = Infinity;
          for (const e of enemies) {
            const d = Math.abs(e.x - f.x);
            if (d < dist) { dist = d; target = e; }
          }
          const baseDistance = f.side === "human" ? 880 - f.x : f.x - 125;
          if (target && dist <= f.range) {
            if (f.cooldown <= 0) {
              target.hp -= f.damage;
              target.flash = 0.12;
              f.cooldown = f.attackEvery;
              if (f.kind === "ranger") {
                g.shots.push({ x: f.x + 14, y: f.y - 22, tx: target.x, ty: target.y - 20, life: 0.12, side: f.side });
                tone(310 + Math.random() * 50, 0.035);
              } else {
                addParticles(g, target.x, target.y - 18, target.side === "zombie" ? "#8aa66a" : "#c06d51", 3);
              }
            }
          } else if (baseDistance <= f.range + 10) {
            if (f.cooldown <= 0) {
              if (f.side === "human") g.nestHp -= f.damage;
              else g.baseHp -= f.damage;
              f.cooldown = f.attackEvery;
              g.shake = Math.max(g.shake, 4);
            }
          } else {
            f.x += (f.side === "human" ? 1 : -1) * f.speed * dt;
          }
        }

        const dead = g.fighters.filter(f => f.hp <= 0);
        for (const f of dead) {
          addParticles(g, f.x, f.y - 15, f.side === "zombie" ? "#7e965e" : "#b0614e", 11);
          if (f.side === "zombie") { g.kills++; g.scrap += f.kind === "crusher" ? 18 : 6; g.energy = Math.min(100, g.energy + 4); }
        }
        g.fighters = g.fighters.filter(f => f.hp > 0);
        for (const p of g.particles) { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 180 * dt; }
        g.particles = g.particles.filter(p => p.life > 0);
        for (const s of g.shots) s.life -= dt;
        g.shots = g.shots.filter(s => s.life > 0);

        if (g.baseHp <= 0 || g.nestHp <= 0) {
          g.over = true; g.won = g.nestHp <= 0; g.shake = 18;
          setEnd(g.won ? "win" : "lose");
          tone(g.won ? 380 : 70, 0.65, g.won ? "square" : "sawtooth");
        }
      }

      drawWorld(ctx, g);
      if (g.bannerTime > 0 && g.running) {
        ctx.fillStyle = "rgba(15,14,14,.76)"; ctx.fillRect(315, 76, 330, 54);
        ctx.strokeStyle = "#d79647"; ctx.strokeRect(315.5, 76.5, 329, 53);
        ctx.fillStyle = "#f0d2a3"; ctx.font = "bold 22px monospace"; ctx.textAlign = "center";
        ctx.fillText(g.banner, W / 2, 110); ctx.textAlign = "left";
      }
      if (now - lastHudRef.current > 100) {
        lastHudRef.current = now;
        setHud({ energy: Math.floor(g.energy), scrap: g.scrap, kills: g.kills, wave: g.wave, baseHp: Math.max(0, g.baseHp), nestHp: Math.max(0, g.nestHp), strike: Math.ceil(g.strikeCooldown) });
      }
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [tone]);

  const healthPct = Math.max(0, hud.baseHp / 320 * 100);
  const nestPct = Math.max(0, hud.nestHp / 420 * 100);

  return (
    <main className="game-shell">
      <section className="game-frame" aria-label="ASHFALL OUTPOST game">
        <canvas ref={canvasRef} width={W} height={H} className="battlefield" aria-label="Wasteland battlefield" />

        <div className="top-hud">
          <div className="brand-block"><span className="brand-mark">A</span><div><b>ASHFALL</b><small>OUTPOST // 07</small></div></div>
          <div className="wave-block"><small>WAVE</small><strong>{String(hud.wave).padStart(2, "0")}</strong></div>
          <button className="icon-btn" onClick={togglePause} aria-label={paused ? "再開" : "一時停止"}>{paused ? "▶" : "Ⅱ"}</button>
          <button className="icon-btn" onClick={() => setMuted(v => !v)} aria-label={muted ? "音を出す" : "ミュート"}>{muted ? "×" : "♪"}</button>
        </div>

        <div className="health-hud crawler-health">
          <div><span>CRAWLER</span><b>{Math.ceil(hud.baseHp)} / 320</b></div>
          <i><em style={{ width: `${healthPct}%` }} /></i>
        </div>
        <div className="health-hud nest-health">
          <div><span>INFECTED NEST</span><b>{Math.ceil(hud.nestHp)} / 420</b></div>
          <i><em style={{ width: `${nestPct}%` }} /></i>
        </div>

        <div className="bottom-hud">
          <div className="resource-panel">
            <div className="energy-icon">⚡</div>
            <div className="energy-copy"><span>COMMAND</span><strong>{hud.energy}</strong><small>/100</small></div>
            <div className="energy-track"><i style={{ width: `${hud.energy}%` }} /></div>
          </div>

          <div className="unit-cards" aria-label="Survivor units">
            {cards.map((card) => (
              <button key={card.kind} className="unit-card" data-kind={card.kind} disabled={!started || paused || hud.energy < card.cost || !!end} onClick={() => spawnHuman(card.kind)}>
                <span className="keycap">{card.key}</span>
                <span className="portrait"><i /></span>
                <span className="card-copy"><b>{card.name}</b><small>{card.desc}</small></span>
                <span className="cost">⚡{card.cost}</span>
              </button>
            ))}
          </div>

          <button className={`strike-btn ${hud.strike ? "cooldown" : ""}`} onClick={airStrike} disabled={!started || paused || !!end || hud.strike > 0}>
            <span className="strike-rings">⌖</span><span><b>{hud.strike ? `${hud.strike}s` : "AIRSTRIKE"}</b><small>{hud.strike ? "RECHARGING" : "Q · READY"}</small></span>
          </button>
        </div>

        <div className="stats-strip"><span>☠ {hud.kills} KILLS</span><span>▰ {hud.scrap} SCRAP</span><span className="objective">OBJECTIVE: DESTROY THE NEST</span></div>

        {!started && (
          <div className="start-screen">
            <div className="start-panel">
              <p className="eyebrow">/// DISTRESS SIGNAL ACQUIRED</p>
              <h1>ASHFALL<br /><span>OUTPOST</span></h1>
              <p className="mission">The crawler is out of fuel. Hold the line, rally survivors, and burn the infected nest before the horde breaks through.</p>
              <button className="start-btn" onClick={startGame}><span>BEGIN OPERATION</span><small>TAP TO DEPLOY</small></button>
              <p className="controls">1–3 DEPLOY · Q AIRSTRIKE · P PAUSE</p>
            </div>
          </div>
        )}

        {paused && started && !end && (
          <div className="pause-screen"><div><small>OPERATION SUSPENDED</small><h2>PAUSED</h2><button onClick={togglePause}>RESUME</button></div></div>
        )}

        {end && (
          <div className={`end-screen ${end}`}><div><p>{end === "win" ? "SECTOR SECURED" : "CRAWLER LOST"}</p><h2>{end === "win" ? "OUTPOST HELD" : "THE LINE BROKE"}</h2><span>{hud.kills} infected eliminated · {hud.scrap} scrap recovered</span><button onClick={startGame}>RUN IT AGAIN</button></div></div>
        )}
      </section>
      <div className="rotate-notice"><span>↻</span><b>スマホを横向きにしてください</b><small>この作戦は横画面に最適化されています</small></div>
    </main>
  );
}
