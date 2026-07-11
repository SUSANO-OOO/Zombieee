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

function pixelRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

function drawHuman(ctx: CanvasRenderingContext2D, f: Fighter, rangerSprite: HTMLImageElement | null) {
  if (f.kind === "ranger" && rangerSprite?.complete) {
    const frameWidth = rangerSprite.naturalWidth / 6;
    const frame = f.flash > 0 ? 5 : f.attack > .09 ? 4 : f.attack > 0 ? 3 : 1 + (Math.floor(f.step * 5) % 2);
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,.42)";
    ctx.beginPath(); ctx.ellipse(f.x, f.y + 10, 17, 5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.imageSmoothingEnabled = true;
    if (f.flash > 0) { ctx.globalAlpha = .72; ctx.shadowColor = "#fff2b0"; ctx.shadowBlur = 14; }
    ctx.drawImage(rangerSprite, frame * frameWidth, 0, frameWidth, rangerSprite.naturalHeight, f.x - 32, f.y - 80, 64, 108);
    ctx.restore();
    return;
  }
  const stride = Math.sin(f.step * 8);
  const bob = Math.abs(stride) * -1.6;
  const recoil = f.attack > 0 ? -3 : 0;
  const brute = f.kind === "brute";
  const ranger = f.kind === "ranger";
  ctx.save();
  ctx.translate(Math.round(f.x), Math.round(f.y + bob));
  ctx.scale(brute ? 1.22 : 1, brute ? 1.22 : 1);
  ctx.fillStyle = "rgba(0,0,0,.38)";
  ctx.beginPath(); ctx.ellipse(0, 10, brute ? 18 : 14, 5, 0, 0, Math.PI * 2); ctx.fill();
  if (f.flash > 0) { ctx.shadowColor = "#fff3c4"; ctx.shadowBlur = 12; }
  const skin = f.variant % 2 ? "#9c6649" : "#c99268";
  const coat = brute ? "#8b4b2d" : ranger ? "#536b55" : "#8f7756";
  // articulated legs
  ctx.save(); ctx.translate(-4, -3); ctx.rotate(stride * .18); pixelRect(ctx, -3, 0, 6, 15, "#282c2d"); pixelRect(ctx, -5, 12, 9, 4, "#171a1c"); ctx.restore();
  ctx.save(); ctx.translate(5, -3); ctx.rotate(-stride * .18); pixelRect(ctx, -3, 0, 6, 15, "#363a39"); pixelRect(ctx, -4, 12, 9, 4, "#171a1c"); ctx.restore();
  pixelRect(ctx, -10, -27, 20, 25, coat);
  pixelRect(ctx, -12, -25, 3, 18, brute ? "#b7743c" : "#493f35");
  pixelRect(ctx, 9, -25, 3, 18, "#343331");
  pixelRect(ctx, -8, -39, 16, 12, skin);
  pixelRect(ctx, -9, -42, 18, 6, ranger ? "#493c31" : "#252829");
  pixelRect(ctx, 2, -35, 3, 2, "#16191a");
  pixelRect(ctx, -9, -22, 5, 10, brute ? "#6a3528" : "#4d473e");
  pixelRect(ctx, -11, -26, 4, 4, "#b8a170");
  if (ranger) {
    ctx.save(); ctx.translate(recoil, 0); pixelRect(ctx, 5, -22, 30, 5, "#171a1a"); pixelRect(ctx, 14, -18, 9, 3, "#61452f"); pixelRect(ctx, 31, -21, 8, 2, "#4b4f4b"); ctx.restore();
    if (f.attack > .08) { ctx.fillStyle = "#fff2a3"; ctx.beginPath(); ctx.moveTo(39, -24); ctx.lineTo(51, -19); ctx.lineTo(39, -16); ctx.fill(); ctx.fillStyle = "#e96b33"; ctx.fillRect(39, -22, 7, 4); }
  } else if (brute) {
    ctx.save(); ctx.translate(7, -20); ctx.rotate(f.attack > 0 ? -.65 : -.15); pixelRect(ctx, 0, -3, 7, 29, "#565b58"); pixelRect(ctx, -4, 18, 17, 9, "#aeb0a4"); pixelRect(ctx, -1, 20, 11, 3, "#d5b868"); ctx.restore();
    pixelRect(ctx, -13, -31, 5, 19, "#6a3528");
  } else {
    ctx.save(); ctx.translate(5, -21); ctx.rotate(f.attack > 0 ? .42 : -.05); pixelRect(ctx, 0, -3, 18, 5, "#322b27"); pixelRect(ctx, 13, -5, 7, 8, "#9a6b37"); ctx.restore();
  }
  ctx.restore();
}

function drawZombie(ctx: CanvasRenderingContext2D, f: Fighter) {
  const stride = Math.sin(f.step * (f.kind === "runner" ? 11 : 6));
  const big = f.kind === "crusher" || f.kind === "abomination";
  const spitter = f.kind === "spitter";
  const scale = f.kind === "abomination" ? 1.72 : f.kind === "crusher" ? 1.38 : f.kind === "runner" ? .88 : 1;
  ctx.save(); ctx.translate(Math.round(f.x), Math.round(f.y - Math.abs(stride) * 1.2)); ctx.scale(-scale, scale);
  ctx.fillStyle = "rgba(0,0,0,.42)"; ctx.beginPath(); ctx.ellipse(0, 10, big ? 18 : 13, 5, 0, 0, Math.PI * 2); ctx.fill();
  if (f.flash > 0) { ctx.globalCompositeOperation = "screen"; ctx.shadowColor = "#f5f0c0"; ctx.shadowBlur = 15; }
  const skin = f.kind === "abomination" ? "#75543f" : spitter ? "#758d57" : f.variant % 2 ? "#839760" : "#71865b";
  ctx.save(); ctx.translate(-4,-2); ctx.rotate(stride*.2); pixelRect(ctx,-3,0,6,15,"#262827"); pixelRect(ctx,-5,12,9,4,"#171918"); ctx.restore();
  ctx.save(); ctx.translate(5,-2); ctx.rotate(-stride*.2); pixelRect(ctx,-3,0,6,15,"#34312d"); pixelRect(ctx,-4,12,9,4,"#171918"); ctx.restore();
  pixelRect(ctx,-10,-27,20,26,big?"#47312d":spitter?"#454b37":"#48413a");
  pixelRect(ctx,-8,-40,16,13,skin); pixelRect(ctx,-9,-42,11,4,"#302925");
  pixelRect(ctx,-5,-36,3,3,"#ff5a29"); pixelRect(ctx,3,-36,3,3,"#ff5a29"); pixelRect(ctx,-2,-29,8,2,"#261916");
  ctx.save(); ctx.translate(-9,-23); ctx.rotate(.38 + stride*.08); pixelRect(ctx,-15,-2,17,5,skin); ctx.restore();
  ctx.save(); ctx.translate(9,-22); ctx.rotate(f.attack>0?-.6:-.16); pixelRect(ctx,0,-2,18,5,skin); ctx.restore();
  if (spitter) { pixelRect(ctx,-13,-24,6,17,"#829d45"); ctx.fillStyle="rgba(146,205,51,.55)"; ctx.beginPath(); ctx.arc(-11,-17,7,0,Math.PI*2); ctx.fill(); }
  if (f.kind === "abomination") { pixelRect(ctx,-16,-29,7,22,"#5a382f"); pixelRect(ctx,9,-29,8,23,"#5a382f"); pixelRect(ctx,-13,-45,5,13,"#9b704a"); pixelRect(ctx,9,-45,5,13,"#9b704a"); }
  ctx.restore();
}

function drawWorld(ctx: CanvasRenderingContext2D, g: Game, background: HTMLImageElement | null, rangerSprite: HTMLImageElement | null) {
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

  // Infected nest
  const pulse=1+Math.sin(g.time*3)*.06; ctx.save(); ctx.translate(911,366); ctx.scale(pulse,pulse);
  ctx.fillStyle="#1b1516"; ctx.beginPath(); ctx.arc(0,0,49,0,Math.PI*2); ctx.fill();
  for(let i=0;i<10;i++){ctx.rotate(.63); ctx.fillStyle=i%2?"#55251f":"#3d2b25"; ctx.fillRect(12,-5,49,10);}
  ctx.fillStyle="#74291f"; ctx.beginPath();ctx.arc(0,0,30,0,Math.PI*2);ctx.fill();
  ctx.fillStyle="#e54a25";ctx.beginPath();ctx.arc(0,0,12,0,Math.PI*2);ctx.fill();ctx.fillStyle="#ffd05a";ctx.beginPath();ctx.arc(-3,-3,4,0,Math.PI*2);ctx.fill();ctx.restore();

  for (const corpse of g.corpses) { ctx.save(); ctx.globalAlpha=Math.min(.62,corpse.life/2); ctx.translate(corpse.x,corpse.y+7); ctx.scale(1,.45); ctx.fillStyle=corpse.side==="zombie"?"#4e5a3e":"#5d392f"; ctx.beginPath();ctx.ellipse(0,0,corpse.kind==="abomination"?25:15,7,0,0,Math.PI*2);ctx.fill();ctx.restore(); }
  for (const f of [...g.fighters].sort((a,b)=>a.y-b.y)) {
    if (f.side === "human") drawHuman(ctx, f, rangerSprite);
    else drawZombie(ctx, f);
    const barW = f.kind === "crusher" || f.kind === "brute" ? 38 : f.kind === "abomination" ? 52 : 28;
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
  const rangerSpriteRef = useRef<HTMLImageElement | null>(null);
  const gameRef = useRef<Game>(initialGame());
  const audioRef = useRef<AudioContext | null>(null);
  const lastHudRef = useRef(0);
  const [started, setStarted] = useState(false);
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(false);
  const [hud, setHud] = useState({ energy: 55, scrap: 0, kills: 0, wave: 1, baseHp: 320, nestHp: 420, strike: 0, combo: 0 });
  const [end, setEnd] = useState<"win" | "lose" | null>(null);

  useEffect(() => {
    const image = new Image();
    image.src = "/battlefield-v2.png";
    image.onload = () => { backgroundRef.current = image; };
    const ranger = new Image();
    ranger.src = "/ranger-sprites-v1.png";
    ranger.onload = () => { rangerSpriteRef.current = ranger; };
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
      : kind === "brute"
      ? { cost: 70, hp: 175, speed: 14, damage: 30, range: 28, attackEvery: 1.05 }
      : { cost: 25, hp: 80, speed: 27, damage: 13, range: 28, attackEvery: 0.62 };
    if (g.energy < data.cost) { tone(110, 0.1, "sawtooth"); return; }
    g.energy -= data.cost;
    g.fighters.push({ id: g.nextId++, side: "human", kind, x: 145, y: GROUND - 7 + Math.random() * 10, maxHp: data.hp, ...data, cooldown: 0, flash: 0, step: Math.random() * 4, attack: 0, knock: 0, variant: g.nextId % 3 });
    addParticles(g, 150, 370, "#d0b48b", 5);
    tone(kind === "brute" ? 110 : 220, 0.07);
  }, [tone]);

  const airStrike = useCallback(() => {
    const g = gameRef.current;
    if (!g.running || g.paused || g.over || g.strikeCooldown > 0) return;
    g.strikeCooldown = 20;
    g.shake = 16;
    g.flashOverlay = .48;
    for (const f of g.fighters) {
      if (f.side === "zombie" && f.x > 440) {
        f.hp -= 95;
        f.flash = 0.22;
        f.knock = 12;
        g.damageTexts.push({ x: f.x, y: f.y - 48, value: "95", life: .8, color: "#ffd36a" });
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
            const kind = g.wave % 4 === 0 && i === count - 1 ? "abomination" : g.wave >= 3 && i === count - 2 ? "crusher" : g.wave >= 2 && i === 1 ? "spitter" : Math.random() < 0.38 ? "runner" : "walker";
            const hp = kind === "abomination" ? 420 : kind === "crusher" ? 190 : kind === "runner" ? 50 : kind === "spitter" ? 66 : 82 + g.wave * 6;
            g.fighters.push({ id: g.nextId++, side: "zombie", kind, x: 845 + i * 24, y: GROUND - 7 + Math.random() * 12, hp, maxHp: hp, speed: kind === "runner" ? 34 : kind === "crusher" ? 11 : kind === "abomination" ? 8 : kind === "spitter" ? 14 : 18, damage: kind === "abomination" ? 48 : kind === "crusher" ? 34 : kind === "spitter" ? 12 : 14, range: kind === "spitter" ? 120 : 25, cooldown: i * 0.2, attackEvery: kind === "runner" ? 0.72 : kind === "spitter" ? 1.55 : 1.1, flash: 0, step: Math.random() * 4, attack: 0, knock: 0, variant: i % 3 });
          }
          if (g.wave % 4 === 0) { g.banner = `WAVE ${g.wave} — ABOMINATION`; g.bannerTime = 2.7; }
          tone(82, 0.25, "sawtooth");
        }

        if (g.time < 0.1 && g.fighters.length === 0) {
          for (let i = 0; i < 3; i++) {
            const hp = 76;
            g.fighters.push({ id: g.nextId++, side: "zombie", kind: i === 2 ? "runner" : "walker", x: 710 + i * 55, y: GROUND - 7 + i * 4, hp, maxHp: hp, speed: i === 2 ? 33 : 18, damage: 13, range: 25, cooldown: i * .35, attackEvery: .9, flash: 0, step: i, attack: 0, knock: 0, variant: i });
          }
        }

        for (const f of g.fighters) {
          f.cooldown -= dt; f.flash = Math.max(0, f.flash - dt); f.attack = Math.max(0, f.attack - dt); f.step += dt;
          if (Math.abs(f.knock) > .1) { f.x += (f.side === "human" ? -1 : 1) * f.knock * dt * 6; f.knock *= .9; }
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
              target.knock = f.kind === "brute" || f.kind === "abomination" ? 9 : 3;
              f.attack = .18;
              f.cooldown = f.attackEvery;
              g.damageTexts.push({ x: target.x + (Math.random() - .5) * 10, y: target.y - 45, value: String(f.damage), life: .65, color: f.side === "human" ? "#f6d278" : "#e98a72" });
              g.shake = Math.max(g.shake, f.kind === "brute" || f.kind === "abomination" ? 7 : 2.5);
              if (f.kind === "ranger" || f.kind === "spitter") {
                g.shots.push({ x: f.x + 14, y: f.y - 22, tx: target.x, ty: target.y - 20, life: 0.12, side: f.side });
                if (f.side === "human") tone(310 + Math.random() * 50, 0.035);
              } else {
                addParticles(g, target.x, target.y - 18, target.side === "zombie" ? "#8aa66a" : "#c06d51", 3);
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
          addParticles(g, f.x, f.y - 15, f.side === "zombie" ? "#7e965e" : "#b0614e", 11);
          g.corpses.push({ x: f.x, y: f.y, side: f.side, kind: f.kind, life: 5, variant: f.variant });
          if (f.side === "zombie") { g.kills++; g.combo++; g.comboTime = 2.3; g.scrap += f.kind === "abomination" ? 40 : f.kind === "crusher" ? 18 : 6; g.energy = Math.min(100, g.energy + 4); }
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

      drawWorld(ctx, g, backgroundRef.current, rangerSpriteRef.current);
      if (g.bannerTime > 0 && g.running) {
        ctx.fillStyle = "rgba(15,14,14,.76)"; ctx.fillRect(315, 76, 330, 54);
        ctx.strokeStyle = "#d79647"; ctx.strokeRect(315.5, 76.5, 329, 53);
        ctx.fillStyle = "#f0d2a3"; ctx.font = "bold 22px monospace"; ctx.textAlign = "center";
        ctx.fillText(g.banner, W / 2, 110); ctx.textAlign = "left";
      }
      if (now - lastHudRef.current > 100) {
        lastHudRef.current = now;
        setHud({ energy: Math.floor(g.energy), scrap: g.scrap, kills: g.kills, wave: g.wave, baseHp: Math.max(0, g.baseHp), nestHp: Math.max(0, g.nestHp), strike: Math.ceil(g.strikeCooldown), combo: g.combo });
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
          <div className="brand-block"><span className="brand-mark">A</span><div><b>ASHFALL</b><small>OUTPOST // 07 <em>VER 1.2 PREVIEW</em></small></div></div>
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

        <div className="stats-strip"><span>☠ {hud.kills} KILLS</span><span>▰ {hud.scrap} SCRAP</span>{hud.combo > 1 && <span className="combo">×{hud.combo} COMBO</span>}<span className="objective">OBJECTIVE: DESTROY THE NEST</span></div>

        {!started && (
          <div className="start-screen">
            <div className="start-panel">
              <p className="eyebrow">/// VER 1.2 PREVIEW · RANGER SPRITE TEST</p>
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
