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
  supportCooldown: number;
  attackEvery: number;
  flash: number;
  step: number;
  attack: number;
  knock: number;
  variant: number;
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
type DamageText = { x: number; y: number; value: string; life: number; color: string };
type Corpse = { x: number; y: number; side: "human" | "zombie"; kind: string; life: number; variant: number };

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
  damageTexts: DamageText[];
  corpses: Corpse[];
  nextId: number;
  shake: number;
  strikeCooldown: number;
  banner: string;
  bannerTime: number;
  flashOverlay: number;
  combo: number;
  comboTime: number;
};

const cards = [
  { kind: "scout", name: "SCOUT", cost: 25, key: "1", desc: "FAST" },
  { kind: "ranger", name: "RANGER", cost: 45, key: "2", desc: "RANGED" },
  { kind: "brute", name: "BREAKER", cost: 70, key: "3", desc: "ARMORED" },
  { kind: "brawler", name: "BRAWLER", cost: 55, key: "4", desc: "FIGHTER" },
  { kind: "gunner", name: "GUNNER", cost: 60, key: "5", desc: "BURST" },
  { kind: "medic", name: "MEDIC", cost: 50, key: "6", desc: "SUPPORT" },
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
  baseHp: 400,
  nestHp: 620,
  fighters: [],
  particles: [],
  shots: [],
  damageTexts: [],
  corpses: [],
  nextId: 1,
  shake: 0,
  strikeCooldown: 0,
  banner: "WAVE 1 INCOMING",
  bannerTime: 2.4,
  flashOverlay: 0,
  combo: 0,
  comboTime: 0,
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

type SpriteMap = Record<string, HTMLImageElement>;

function drawSpriteFighter(ctx: CanvasRenderingContext2D, f: Fighter, sprites: SpriteMap) {
  const enemySheet = f.kind === "takuya" ? "takuya" : f.kind === "crusher" || f.kind === "abomination" ? "crusher" : f.kind === "spitter" ? "spitter" : "infected";
  const sprite = sprites[f.side === "human" ? f.kind : enemySheet];
  if (!sprite?.complete || !sprite.naturalWidth) return;
  const frameWidth = sprite.naturalWidth / 6;
  const frame = f.flash > 0 ? 5 : f.attack > .09 ? 4 : f.attack > 0 ? 3 : 1 + (Math.floor(f.step * (f.kind === "runner" ? 8 : 5)) % 2);
  const sizes: Record<string, { w: number; h: number }> = {
    scout: { w: 64, h: 108 }, ranger: { w: 64, h: 108 }, brute: { w: 82, h: 120 },
    brawler: { w: 70, h: 108 }, gunner: { w: 66, h: 108 }, medic: { w: 66, h: 108 },
    walker: { w: 64, h: 106 }, runner: { w: 58, h: 98 }, spitter: { w: 68, h: 110 },
    crusher: { w: 91, h: 124 }, abomination: { w: 116, h: 148 }, takuya: { w: 106, h: 142 },
  };
  const size = sizes[f.kind] ?? { w: 64, h: 106 };
  const bob = Math.abs(Math.sin(f.step * 7)) * 1.2;
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,.42)";
  ctx.beginPath(); ctx.ellipse(f.x, f.y + 10, size.w * .27, 5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.imageSmoothingEnabled = true;
  if (f.flash > 0) { ctx.globalAlpha = .7; ctx.shadowColor = "#fff1ad"; ctx.shadowBlur = 16; }
  ctx.drawImage(sprite, frame * frameWidth, 0, frameWidth, sprite.naturalHeight, f.x - size.w / 2, f.y - size.h + 27 - bob, size.w, size.h);
  ctx.restore();
}

function drawWorld(ctx: CanvasRenderingContext2D, g: Game, background: HTMLImageElement | null, sprites: SpriteMap, nestSprite: HTMLImageElement | null) {
  const sx = g.shake > 0 ? (Math.random() - 0.5) * g.shake : 0;
  const sy = g.shake > 0 ? (Math.random() - 0.5) * g.shake : 0;
  ctx.save();
  ctx.translate(sx, sy);

  if (background?.complete) { ctx.imageSmoothingEnabled = true; ctx.drawImage(background, -10, -10, W + 20, H + 20); ctx.imageSmoothingEnabled = false; }
  else { const sky=ctx.createLinearGradient(0,0,0,H); sky.addColorStop(0,"#4d241b"); sky.addColorStop(1,"#191716"); ctx.fillStyle=sky; ctx.fillRect(-10,-10,W+20,H+20); }
  const grade=ctx.createLinearGradient(0,0,W,0); grade.addColorStop(0,"rgba(23,28,31,.2)"); grade.addColorStop(.55,"rgba(15,13,12,.05)"); grade.addColorStop(1,"rgba(58,18,12,.18)"); ctx.fillStyle=grade; ctx.fillRect(0,0,W,H);
  ctx.fillStyle="rgba(24,18,14,.2)"; ctx.fillRect(0,GROUND+8,W,H-GROUND);

  // Survivor crawler / base
  ctx.fillStyle = "#171b1c"; ctx.fillRect(19, 319, 142, 78);
  ctx.fillStyle = "#8c442c"; ctx.fillRect(30, 329, 116, 57);
  ctx.fillStyle = "#4d3029"; ctx.fillRect(37, 337, 40, 25);
  ctx.fillStyle = "#78918c"; ctx.fillRect(87, 336, 42, 22);
  ctx.fillStyle = "#222626"; ctx.fillRect(21,315,84,7); ctx.fillRect(95,303,8,18); ctx.fillRect(105,308,31,5);
  ctx.fillStyle = "#c27a3e"; ctx.fillRect(31, 363, 115, 5); ctx.fillStyle="#49261f"; ctx.fillRect(70,329,4,56);
  ctx.fillStyle = "#171a1b";
  ctx.beginPath(); ctx.arc(55, 397, 20, 0, Math.PI * 2); ctx.arc(126, 397, 20, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#73726a";
  ctx.beginPath(); ctx.arc(55, 397, 9, 0, Math.PI * 2); ctx.arc(126, 397, 9, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#d8a746";
  ctx.fillRect(145, 347, 8, 16);
  ctx.fillStyle="#1b1e1f"; ctx.fillRect(9,349,20,38); ctx.fillStyle="#70736d"; ctx.fillRect(12,353,14,5);

  // Detailed infected checkpoint / nest artwork with a subtle living pulse.
  if (nestSprite?.complete) {
    const pulse = 1 + Math.sin(g.time * 3) * .018;
    ctx.save(); ctx.translate(891, 327); ctx.scale(pulse, pulse);
    ctx.shadowColor = "rgba(235,78,38,.55)"; ctx.shadowBlur = 12 + Math.sin(g.time * 4) * 4;
    ctx.drawImage(nestSprite, -86, -82, 165, 165); ctx.restore();
  }

  for (const corpse of g.corpses) { ctx.save(); ctx.globalAlpha=Math.min(.62,corpse.life/2); ctx.translate(corpse.x,corpse.y+7); ctx.scale(1,.45); ctx.fillStyle=corpse.kind==="takuya"?"#292d31":corpse.side==="zombie"?"#4e5a3e":"#5d392f"; ctx.beginPath();ctx.ellipse(0,0,corpse.kind==="abomination"||corpse.kind==="takuya"?25:15,7,0,0,Math.PI*2);ctx.fill();ctx.restore(); }
  for (const f of [...g.fighters].sort((a,b)=>a.y-b.y)) {
    drawSpriteFighter(ctx, f, sprites);
    const barW = f.kind === "takuya" ? 52 : f.kind === "crusher" || f.kind === "brute" ? 38 : f.kind === "abomination" ? 52 : 28;
    const barY = f.y - (f.kind === "takuya" ? 120 : f.kind === "abomination" ? 126 : f.kind === "crusher" || f.kind === "brute" ? 101 : 86);
    ctx.fillStyle = "rgba(0,0,0,.55)";
    ctx.fillRect(f.x - barW / 2, barY, barW, 4);
    ctx.fillStyle = f.side === "human" ? "#e9c65a" : "#cb5037";
    ctx.fillRect(f.x - barW / 2, barY, barW * Math.max(0, f.hp / f.maxHp), 4);
  }

  for (const s of g.shots) {
    const p = 1 - s.life / 0.12;
    const x = s.x + (s.tx - s.x) * p;
    const y = s.y + (s.ty - s.y) * p;
    ctx.strokeStyle = s.side === "human" ? "#ffe078" : "#e76747";
    ctx.shadowColor=ctx.strokeStyle; ctx.shadowBlur=7; ctx.lineWidth = s.side === "human" ? 2.5 : 4;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 15, y); ctx.stroke();
  }
  ctx.shadowBlur=0;
  for (const p of g.particles) {
    ctx.globalAlpha = Math.max(0, p.life * 1.6);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x, p.y, p.size, p.size);
  }
  ctx.globalAlpha = 1;
  for (const d of g.damageTexts) { ctx.globalAlpha=Math.min(1,d.life*2); ctx.fillStyle=d.color; ctx.font="bold 15px monospace"; ctx.textAlign="center"; ctx.shadowColor="#000";ctx.shadowBlur=3;ctx.fillText(d.value,d.x,d.y); }
  ctx.globalAlpha=1;ctx.shadowBlur=0;ctx.textAlign="left";

  ctx.fillStyle = "rgba(25,18,17,.1)";
  for (let i = 0; i < 18; i++) {
    const x = (i * 67 + g.time * (4 + (i % 3) * 2)) % W;
    const y = 45 + ((i * 53) % 270);
    ctx.fillRect(x, y, 2, 2);
  }
  if(g.flashOverlay>0){ctx.fillStyle=`rgba(255,193,106,${Math.min(.48,g.flashOverlay)})`;ctx.fillRect(0,0,W,H);}
  ctx.restore();
}

export function AshfallGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const backgroundRef = useRef<HTMLImageElement | null>(null);
  const spriteRefs = useRef<SpriteMap>({});
  const nestSpriteRef = useRef<HTMLImageElement | null>(null);
  const gameRef = useRef<Game>(initialGame());
  const audioRef = useRef<AudioContext | null>(null);
  const lastHudRef = useRef(0);
  const [started, setStarted] = useState(false);
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(false);
  const [hud, setHud] = useState({ energy: 55, scrap: 0, kills: 0, wave: 1, baseHp: 400, nestHp: 620, strike: 0, combo: 0, bossHp: 0, bossMax: 0 });
  const [end, setEnd] = useState<"win" | "lose" | null>(null);

  useEffect(() => {
    const image = new Image();
    image.src = "/battlefield-v2.png";
    image.onload = () => { backgroundRef.current = image; };
    const paths: Record<string, string> = {
      scout: "/scout-sprites-v2.png", ranger: "/ranger-sprites-v1.png", brute: "/breaker-sprites-v2.png",
      brawler: "/brawler-sprites-v1.png", gunner: "/gunner-sprites-v1.png", medic: "/medic-sprites-v1.png",
      infected: "/infected-sprites-v1.png", crusher: "/crusher-sprites-v1.png", spitter: "/spitter-sprites-v1.png",
      takuya: "/takuya-boss-sprites-v2.png",
    };
    Object.entries(paths).forEach(([key, src]) => {
      const sprite = new Image(); sprite.src = src;
      sprite.onload = () => { spriteRefs.current[key] = sprite; };
    });
    const nest = new Image(); nest.src = "/infected-nest-v1.png";
    nest.onload = () => { nestSpriteRef.current = nest; };
  }, []);

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
      : kind === "gunner"
      ? { cost: 60, hp: 95, speed: 18, damage: 36, range: 92, attackEvery: 1.08 }
      : kind === "medic"
      ? { cost: 50, hp: 82, speed: 19, damage: 11, range: 118, attackEvery: 0.96 }
      : kind === "brawler"
      ? { cost: 55, hp: 135, speed: 23, damage: 26, range: 30, attackEvery: 0.72 }
      : kind === "brute"
      ? { cost: 70, hp: 175, speed: 14, damage: 30, range: 28, attackEvery: 1.05 }
      : { cost: 25, hp: 80, speed: 27, damage: 13, range: 28, attackEvery: 0.62 };
    if (g.energy < data.cost) { tone(110, 0.1, "sawtooth"); return; }
    g.energy -= data.cost;
    g.fighters.push({ id: g.nextId++, side: "human", kind, x: 145, y: GROUND - 7 + Math.random() * 10, maxHp: data.hp, ...data, cooldown: 0, supportCooldown: 0, flash: 0, step: Math.random() * 4, attack: 0, knock: 0, variant: g.nextId % 3 });
    addParticles(g, 150, 370, "#d0b48b", 5);
    tone(kind === "brute" ? 110 : 220, 0.07);
  }, [tone]);

  const airStrike = useCallback(() => {
    const g = gameRef.current;
    if (!g.running || g.paused || g.over || g.strikeCooldown > 0) return;
    g.strikeCooldown = 20;
    g.shake = 16;
    g.flashOverlay = .48;
    g.fighters = g.fighters.map((f) => {
      if (f.side === "zombie" && f.x > 440) {
        g.damageTexts.push({ x: f.x, y: f.y - 48, value: "95", life: .8, color: "#ffd36a" });
        addParticles(g, f.x, f.y - 20, "#f28d46", 15);
        return { ...f, hp: f.hp - 95, flash: .22, knock: 12 };
      }
      return f;
    });
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
      if (e.key === "4") spawnHuman("brawler");
      if (e.key === "5") spawnHuman("gunner");
      if (e.key === "6") spawnHuman("medic");
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
        g.flashOverlay = Math.max(0, g.flashOverlay - dt * 2.2);
        g.comboTime = Math.max(0, g.comboTime - dt);
        if (g.comboTime <= 0) g.combo = 0;

        if (g.nextWave <= 0) {
          g.wave++;
          g.nextWave = Math.max(8, 16 - g.wave * 0.7);
          g.banner = `WAVE ${g.wave} — ${g.wave >= 5 ? "NIGHTMARE" : "INCOMING"}`;
          g.bannerTime = 2;
          const count = Math.min(8, 2 + g.wave);
          for (let i = 0; i < count; i++) {
            const kind = g.wave === 3 && i === count - 1 ? "takuya" : g.wave % 4 === 0 && i === count - 1 ? "abomination" : g.wave >= 3 && i === count - 2 ? "crusher" : g.wave >= 2 && i === 1 ? "spitter" : Math.random() < 0.38 ? "runner" : "walker";
            const hp = kind === "takuya" ? 520 : kind === "abomination" ? 420 : kind === "crusher" ? 190 : kind === "runner" ? 50 : kind === "spitter" ? 66 : 82 + g.wave * 6;
            const speed = kind === "runner" ? 34 : kind === "takuya" ? 12 : kind === "crusher" ? 11 : kind === "abomination" ? 8 : kind === "spitter" ? 14 : 18;
            const damage = kind === "takuya" ? 54 : kind === "abomination" ? 48 : kind === "crusher" ? 34 : kind === "spitter" ? 12 : 14;
            const range = kind === "spitter" ? 120 : kind === "takuya" ? 36 : 25;
            const attackEvery = kind === "runner" ? .72 : kind === "spitter" ? 1.55 : kind === "takuya" ? 1.2 : 1.1;
            g.fighters.push({ id: g.nextId++, side: "zombie", kind, x: 845 + i * 24, y: GROUND - 7 + Math.random() * 12, hp, maxHp: hp, speed, damage, range, cooldown: i * 0.2, supportCooldown: 0, attackEvery, flash: 0, step: Math.random() * 4, attack: 0, knock: 0, variant: i % 3 });
          }
          if (g.wave === 3) { g.banner = "BOSS — TAKUYA / IRON JUDGE"; g.bannerTime = 3.1; g.shake = 12; g.flashOverlay = .22; }
          else if (g.wave % 4 === 0) { g.banner = `WAVE ${g.wave} — ABOMINATION`; g.bannerTime = 2.7; }
          tone(82, 0.25, "sawtooth");
        }

        if (g.time < 0.1 && g.fighters.length === 0) {
          for (let i = 0; i < 3; i++) {
            const hp = 76;
            g.fighters.push({ id: g.nextId++, side: "zombie", kind: i === 2 ? "runner" : "walker", x: 710 + i * 55, y: GROUND - 7 + i * 4, hp, maxHp: hp, speed: i === 2 ? 33 : 18, damage: 13, range: 25, cooldown: i * .35, supportCooldown: 0, attackEvery: .9, flash: 0, step: i, attack: 0, knock: 0, variant: i });
          }
        }

        for (const f of g.fighters) {
          f.cooldown -= dt; f.supportCooldown -= dt; f.flash = Math.max(0, f.flash - dt); f.attack = Math.max(0, f.attack - dt); f.step += dt;
          if (Math.abs(f.knock) > .1) { f.x += (f.side === "human" ? -1 : 1) * f.knock * dt * 6; f.knock *= .9; }
          if (f.kind === "medic" && f.supportCooldown <= 0) {
            const wounded = g.fighters
              .filter(o => o.side === "human" && o.id !== f.id && o.hp > 0 && o.hp < o.maxHp && Math.abs(o.x - f.x) <= 105)
              .sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
            if (wounded) {
              const healed = Math.min(16, wounded.maxHp - wounded.hp);
              wounded.hp += healed; f.supportCooldown = 1.55;
              g.damageTexts.push({ x: wounded.x, y: wounded.y - 74, value: `+${Math.ceil(healed)}`, life: .8, color: "#83e0a2" });
              addParticles(g, wounded.x, wounded.y - 30, "#69d993", 7);
            }
          }
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
              target.knock = f.kind === "brute" || f.kind === "abomination" || f.kind === "takuya" ? 9 : 3;
              f.attack = .18;
              f.cooldown = f.attackEvery;
              g.damageTexts.push({ x: target.x + (Math.random() - .5) * 10, y: target.y - 45, value: String(f.damage), life: .65, color: f.side === "human" ? "#f6d278" : "#e98a72" });
              g.shake = Math.max(g.shake, f.kind === "takuya" ? 11 : f.kind === "brute" || f.kind === "abomination" ? 7 : 2.5);
              if (f.kind === "takuya") {
                for (const splash of g.fighters) {
                  if (splash.side === "human" && splash.id !== target.id && splash.hp > 0 && Math.abs(splash.x - target.x) < 58) {
                    splash.hp -= 22; splash.flash = .12; splash.knock = 6;
                    g.damageTexts.push({ x: splash.x, y: splash.y - 46, value: "22", life: .65, color: "#e98a72" });
                  }
                }
                addParticles(g, target.x, target.y + 2, "#b78656", 13);
                tone(64, .16, "sawtooth");
              }
              if (f.kind === "ranger" || f.kind === "gunner" || f.kind === "medic" || f.kind === "spitter") {
                g.shots.push({ x: f.x + (f.side === "human" ? 14 : -14), y: f.y - 32, tx: target.x, ty: target.y - 28, life: 0.12, side: f.side });
                if (f.side === "human") tone(310 + Math.random() * 50, 0.035);
              } else {
                addParticles(g, target.x, target.y - 18, target.kind === "takuya" ? "#b98a62" : target.side === "zombie" ? "#8aa66a" : "#c06d51", 3);
              }
            }
          } else if (baseDistance <= f.range + 10) {
            if (f.cooldown <= 0) {
              if (f.side === "human") g.nestHp -= f.damage;
              else g.baseHp -= f.damage;
              f.attack = .18;
              f.cooldown = f.attackEvery;
              g.shake = Math.max(g.shake, 4);
            }
          } else {
            f.x += (f.side === "human" ? 1 : -1) * f.speed * dt;
          }
        }

        const dead = g.fighters.filter(f => f.hp <= 0);
        for (const f of dead) {
          addParticles(g, f.x, f.y - 15, f.kind === "takuya" ? "#c08d62" : f.side === "zombie" ? "#7e965e" : "#b0614e", f.kind === "takuya" ? 18 : 11);
          g.corpses.push({ x: f.x, y: f.y, side: f.side, kind: f.kind, life: 5, variant: f.variant });
          if (f.side === "zombie") { g.kills++; g.combo++; g.comboTime = 2.3; g.scrap += f.kind === "takuya" ? 80 : f.kind === "abomination" ? 40 : f.kind === "crusher" ? 18 : 6; g.energy = Math.min(100, g.energy + (f.kind === "takuya" ? 18 : 4)); }
        }
        g.fighters = g.fighters.filter(f => f.hp > 0);
        for (const p of g.particles) { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 180 * dt; }
        g.particles = g.particles.filter(p => p.life > 0);
        for (const d of g.damageTexts) { d.life -= dt; d.y -= dt * 23; }
        g.damageTexts = g.damageTexts.filter(d => d.life > 0);
        for (const c of g.corpses) c.life -= dt;
        g.corpses = g.corpses.filter(c => c.life > 0);
        for (const s of g.shots) s.life -= dt;
        g.shots = g.shots.filter(s => s.life > 0);

        if (g.baseHp <= 0 || g.nestHp <= 0) {
          g.over = true; g.won = g.nestHp <= 0; g.shake = 18;
          setEnd(g.won ? "win" : "lose");
          tone(g.won ? 380 : 70, 0.65, g.won ? "square" : "sawtooth");
        }
      }

      drawWorld(ctx, g, backgroundRef.current, spriteRefs.current, nestSpriteRef.current);
      if (g.bannerTime > 0 && g.running) {
        ctx.fillStyle = "rgba(15,14,14,.76)"; ctx.fillRect(315, 76, 330, 54);
        ctx.strokeStyle = "#d79647"; ctx.strokeRect(315.5, 76.5, 329, 53);
        ctx.fillStyle = "#f0d2a3"; ctx.font = "bold 22px monospace"; ctx.textAlign = "center";
        ctx.fillText(g.banner, W / 2, 110); ctx.textAlign = "left";
      }
      if (now - lastHudRef.current > 100) {
        lastHudRef.current = now;
        const boss = g.fighters.find(f => f.kind === "takuya" && f.hp > 0);
        setHud({ energy: Math.floor(g.energy), scrap: g.scrap, kills: g.kills, wave: g.wave, baseHp: Math.max(0, g.baseHp), nestHp: Math.max(0, g.nestHp), strike: Math.ceil(g.strikeCooldown), combo: g.combo, bossHp: boss?.hp ?? 0, bossMax: boss?.maxHp ?? 0 });
      }
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [tone]);

  const healthPct = Math.max(0, hud.baseHp / 400 * 100);
  const nestPct = Math.max(0, hud.nestHp / 620 * 100);
  const bossPct = hud.bossMax ? Math.max(0, hud.bossHp / hud.bossMax * 100) : 0;

  return (
    <main className="game-shell">
      <section className="game-frame" aria-label="ASHFALL OUTPOST game">
        <canvas ref={canvasRef} width={W} height={H} className="battlefield" aria-label="Wasteland battlefield" />

        <div className="top-hud">
          <div className="brand-block"><span className="brand-mark">A</span><div><b>ASHFALL</b><small>OUTPOST // 07 <em>VER 2.1 TAKUYA</em></small></div></div>
          <div className="wave-block"><small>WAVE</small><strong>{String(hud.wave).padStart(2, "0")}</strong></div>
          <button className="icon-btn" onClick={togglePause} aria-label={paused ? "再開" : "一時停止"}>{paused ? "▶" : "Ⅱ"}</button>
          <button className="icon-btn" onClick={() => setMuted(v => !v)} aria-label={muted ? "音を出す" : "ミュート"}>{muted ? "×" : "♪"}</button>
        </div>

        <div className="health-hud crawler-health">
          <div><span>CRAWLER</span><b>{Math.ceil(hud.baseHp)} / 400</b></div>
          <i><em style={{ width: `${healthPct}%` }} /></i>
        </div>
        <div className="health-hud nest-health">
          <div><span>INFECTED NEST</span><b>{Math.ceil(hud.nestHp)} / 620</b></div>
          <i><em style={{ width: `${nestPct}%` }} /></i>
        </div>
        {hud.bossMax > 0 && (
          <div className="boss-hud">
            <div><span>BOSS // TAKUYA</span><b>IRON JUDGE</b></div>
            <i><em style={{ width: `${bossPct}%` }} /></i>
          </div>
        )}

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

        <div className="stats-strip"><span>☠ {hud.kills} KILLS</span><span>▰ {hud.scrap} SCRAP</span>{hud.combo > 1 && <span className="combo">×{hud.combo} COMBO</span>}<span className="objective">OBJECTIVE: DESTROY THE NEST</span></div>

        {!started && (
          <div className="start-screen">
            <div className="start-panel">
              <p className="eyebrow">{"/// VER 2.1 · TAKUYA BOSS ENCOUNTER"}</p>
              <h1>ASHFALL<br /><span>OUTPOST</span></h1>
              <p className="mission">The crawler is out of fuel. Hold the line, rally survivors, and burn the infected nest before the horde breaks through.</p>
              <button className="start-btn" onClick={startGame}><span>BEGIN OPERATION</span><small>TAP TO DEPLOY</small></button>
              <p className="controls">1–6 DEPLOY · Q AIRSTRIKE · P PAUSE</p>
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
