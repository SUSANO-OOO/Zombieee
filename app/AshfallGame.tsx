"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  COMMAND_MAX,
  LANE_NAMES,
  LANE_Y,
  MISSION_EVENTS,
  RAGE_MAX,
  SUPPORT_DEFS,
  UNIT_CARDS,
  advanceCommand,
  autonomousTargetScore,
  canDeploy,
  interceptorTargetScore,
  laneForY,
  objectiveFor,
  phaseAt,
  rageReward,
  scrapReward,
} from "./gameRules.js";

const W = 960;
const H = 540;
const BASE_X = 126;
const NEST_X = 836;
const MUSTER_X = 148;
const MUSTER_Y = LANE_Y[1];

type Lane = 0 | 1 | 2;
type UnitKind = "scout" | "ranger" | "brute" | "brawler" | "gunner" | "medic";
type SupportKind = "barrel" | "medkit" | "molotov" | "airstrike";
type MusicMode = "normal" | "danger" | "boss";
type SelectedAction = `support:${SupportKind}` | null;

type UnitCard = {
  kind: UnitKind;
  name: string;
  cost: number;
  key: string;
  desc: string;
  deployCooldown: number;
  hp: number;
  speed: number;
  damage: number;
  range: number;
  attackEvery: number;
};

type SupportDef = { kind: SupportKind; name: string; cost: number; key: string; desc: string };
type MissionEvent = { at: number; wave: number; label: string; bossOnly?: boolean; units: [string, Lane][] };

const cards = UNIT_CARDS as UnitCard[];
const supportDefs = SUPPORT_DEFS as SupportDef[];
const missionEvents = MISSION_EVENTS as MissionEvent[];

type Fighter = {
  id: number;
  side: "human" | "zombie";
  kind: string;
  lane: Lane;
  anchorLane: Lane | null;
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
  targetId: number | null;
  retargetIn: number;
  bodyRadius: number;
  laneSpeed: number;
  spawnGrace: number;
};

type Particle = { x: number; y: number; vx: number; vy: number; life: number; color: string; size: number };
type Shot = { x: number; y: number; tx: number; ty: number; life: number; side: "human" | "zombie" };
type DamageText = { x: number; y: number; value: string; life: number; color: string };
type Corpse = {
  x: number;
  y: number;
  lane: Lane;
  side: "human" | "zombie";
  kind: string;
  life: number;
  variant: number;
  reviveIn: number | null;
  prevented: boolean;
};
type FieldSupport = {
  id: number;
  kind: SupportKind;
  lane: Lane;
  x: number;
  y: number;
  life: number;
  tick: number;
  triggered: boolean;
};

type Game = {
  running: boolean;
  paused: boolean;
  over: boolean;
  won: boolean;
  time: number;
  last: number;
  energy: number;
  rage: number;
  scrap: number;
  kills: number;
  wave: number;
  phase: 1 | 2 | 3;
  eventIndex: number;
  baseHp: number;
  nestHp: number;
  nestUnlocked: boolean;
  fighters: Fighter[];
  particles: Particle[];
  shots: Shot[];
  damageTexts: DamageText[];
  corpses: Corpse[];
  supports: FieldSupport[];
  deployCooldowns: Record<UnitKind, number>;
  nextId: number;
  shake: number;
  strikeCooldown: number;
  banner: string;
  bannerTime: number;
  flashOverlay: number;
  combo: number;
  comboTime: number;
};

type Hud = {
  energy: number;
  rage: number;
  scrap: number;
  kills: number;
  wave: number;
  phase: 1 | 2 | 3;
  baseHp: number;
  nestHp: number;
  nestUnlocked: boolean;
  strike: number;
  combo: number;
  bossHp: number;
  bossMax: number;
  objective: string;
  deployCooldowns: Record<UnitKind, number>;
};

type SpriteMap = Record<string, HTMLImageElement>;
type MusicRuntime = {
  master: GainNode;
  normalBus: GainNode;
  dangerBus: GainNode;
  bossBus: GainNode;
  timer: number;
  step: number;
  nextStepAt: number;
  mode: MusicMode;
};
type JingleRuntime = { gain: GainNode; oscillators: OscillatorNode[] };

const emptyCooldowns = () => Object.fromEntries(cards.map((card) => [card.kind, 0])) as Record<UnitKind, number>;

const initialGame = (): Game => ({
  running: false,
  paused: false,
  over: false,
  won: false,
  time: 0,
  last: 0,
  energy: 55,
  rage: 0,
  scrap: 0,
  kills: 0,
  wave: 1,
  phase: 1,
  eventIndex: 0,
  baseHp: 520,
  nestHp: 620,
  nestUnlocked: false,
  fighters: [],
  particles: [],
  shots: [],
  damageTexts: [],
  corpses: [],
  supports: [],
  deployCooldowns: emptyCooldowns(),
  nextId: 1,
  shake: 0,
  strikeCooldown: 0,
  banner: "PHASE I — HOLD THE LINE",
  bannerTime: 2.7,
  flashOverlay: 0,
  combo: 0,
  comboTime: 0,
});

function addParticles(g: Game, x: number, y: number, color: string, count = 8) {
  for (let i = 0; i < count; i++) {
    g.particles.push({
      x,
      y,
      vx: (Math.random() - .5) * 120,
      vy: -Math.random() * 110 - 20,
      life: .4 + Math.random() * .5,
      color,
      size: 2 + Math.random() * 4,
    });
  }
}

function laneY(lane: Lane, id = 0) {
  return LANE_Y[lane] + ((id % 3) - 1) * 3;
}

function fighterDistance(a: Pick<Fighter, "x" | "y">, b: Pick<Fighter, "x" | "y">) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function effectDistance(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.hypot(a.x - b.x, (a.y - b.y) * 2);
}

function bodyRadiusFor(kind: string) {
  if (kind === "takuya" || kind === "abomination") return 20;
  if (kind === "crusher" || kind === "brute") return 16;
  return 11;
}

function enemyLaneSpeedFor(kind: string) {
  if (kind === "runner" || kind === "shade") return 64;
  if (kind === "spitter") return 42;
  if (kind === "walker" || kind === "turned") return 38;
  if (kind === "takuya") return 32;
  if (kind === "crusher") return 24;
  return 18;
}

function enemyStats(kind: string, wave: number) {
  if (kind === "takuya") return { hp: 1200, speed: 9, damage: 58, range: 38, attackEvery: 1.15 };
  if (kind === "shade") return { hp: 220, speed: 29, damage: 23, range: 27, attackEvery: .62 };
  if (kind === "abomination") return { hp: 480, speed: 8, damage: 50, range: 28, attackEvery: 1.18 };
  if (kind === "crusher") return { hp: 210 + wave * 5, speed: 11, damage: 35, range: 27, attackEvery: 1.18 };
  if (kind === "spitter") return { hp: 72 + wave * 3, speed: 14, damage: 13, range: 122, attackEvery: 1.5 };
  if (kind === "runner") return { hp: 52 + wave * 2, speed: 34, damage: 14, range: 25, attackEvery: .72 };
  if (kind === "turned") return { hp: 95, speed: 18, damage: 18, range: 25, attackEvery: .88 };
  return { hp: 86 + wave * 5, speed: 18, damage: 15, range: 25, attackEvery: 1.02 };
}

function spawnEnemy(g: Game, kind: string, lane: Lane, order = 0) {
  const data = enemyStats(kind, g.wave);
  const id = g.nextId++;
  g.fighters.push({
    id,
    side: "zombie",
    kind,
    lane,
    anchorLane: lane,
    x: kind === "turned" ? 0 : Math.min(842, 786 + order * 18),
    y: laneY(lane, id),
    maxHp: data.hp,
    ...data,
    cooldown: order * .18,
    supportCooldown: 0,
    flash: 0,
    step: Math.random() * 4,
    attack: 0,
    knock: 0,
    variant: id % 3,
    targetId: null,
    retargetIn: 0,
    bodyRadius: bodyRadiusFor(kind),
    laneSpeed: enemyLaneSpeedFor(kind),
    spawnGrace: 0,
  });
  return g.fighters[g.fighters.length - 1];
}

function damageEnemiesInRadius(g: Game, x: number, y: number, radius: number, damage: number, color: string, knock = 8) {
  for (const f of g.fighters) {
    if (f.side !== "zombie" || effectDistance(f, { x, y }) > radius || f.hp <= 0) continue;
    f.hp -= damage;
    f.flash = .18;
    f.knock = Math.max(f.knock, knock);
    g.damageTexts.push({ x: f.x, y: f.y - 48, value: String(Math.round(damage)), life: .75, color });
    addParticles(g, f.x, f.y - 18, color, damage > 100 ? 12 : 4);
  }
}

function drawSpriteFighter(ctx: CanvasRenderingContext2D, f: Fighter, sprites: SpriteMap) {
  const enemySheet = f.kind === "takuya" ? "takuya" : f.kind === "shade" ? "shade" : f.kind === "crusher" || f.kind === "abomination" ? "crusher" : f.kind === "spitter" ? "spitter" : "infected";
  const sprite = sprites[f.side === "human" ? f.kind : enemySheet];
  if (!sprite?.complete || !sprite.naturalWidth) return;
  const frameWidth = sprite.naturalWidth / 6;
  const frame = f.flash > 0 ? 5 : f.attack > .09 ? 4 : f.attack > 0 ? 3 : 1 + (Math.floor(f.step * (f.kind === "runner" ? 8 : 5)) % 2);
  const sizes: Record<string, { w: number; h: number }> = {
    scout: { w: 58, h: 98 }, ranger: { w: 58, h: 98 }, brute: { w: 72, h: 108 },
    brawler: { w: 62, h: 99 }, gunner: { w: 60, h: 100 }, medic: { w: 60, h: 100 },
    walker: { w: 58, h: 96 }, runner: { w: 53, h: 90 }, turned: { w: 58, h: 96 },
    shade: { w: 64, h: 101 }, spitter: { w: 62, h: 101 }, crusher: { w: 80, h: 112 },
    abomination: { w: 101, h: 132 }, takuya: { w: 94, h: 128 },
  };
  const size = sizes[f.kind] ?? { w: 58, h: 96 };
  const bob = Math.abs(Math.sin(f.step * 7)) * 1.1;
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,.42)";
  ctx.beginPath();
  ctx.ellipse(f.x, f.y + 8, size.w * .27, 4.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.imageSmoothingEnabled = true;
  if (f.flash > 0) {
    ctx.globalAlpha = .7;
    ctx.shadowColor = "#fff1ad";
    ctx.shadowBlur = 16;
  }
  ctx.drawImage(sprite, frame * frameWidth, 0, frameWidth, sprite.naturalHeight, f.x - size.w / 2, f.y - size.h + 24 - bob, size.w, size.h);
  ctx.restore();
}

function drawSupport(ctx: CanvasRenderingContext2D, support: FieldSupport, time: number) {
  ctx.save();
  ctx.translate(support.x, support.y);
  if (support.kind === "barrel") {
    ctx.fillStyle = "rgba(0,0,0,.35)";
    ctx.beginPath(); ctx.ellipse(0, 6, 17, 5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#783e2c"; ctx.fillRect(-12, -24, 24, 30);
    ctx.fillStyle = "#c17642"; ctx.fillRect(-13, -20, 26, 4); ctx.fillRect(-13, -2, 26, 4);
    ctx.fillStyle = "#e7b94e"; ctx.font = "bold 15px monospace"; ctx.textAlign = "center"; ctx.fillText("!", 0, -7);
  } else if (support.kind === "medkit") {
    ctx.strokeStyle = "rgba(105,226,155,.45)"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, 42 + Math.sin(time * 5) * 3, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = "#d9d0b5"; ctx.fillRect(-14, -18, 28, 23);
    ctx.fillStyle = "#3fa56f"; ctx.fillRect(-3, -14, 6, 15); ctx.fillRect(-8, -9, 16, 6);
  } else if (support.kind === "molotov") {
    const glow = ctx.createRadialGradient(0, 0, 3, 0, 0, 55);
    glow.addColorStop(0, "rgba(255,207,76,.65)"); glow.addColorStop(.35, "rgba(230,83,35,.42)"); glow.addColorStop(1, "rgba(120,24,13,0)");
    ctx.fillStyle = glow; ctx.beginPath(); ctx.ellipse(0, 0, 70, 24, 0, 0, Math.PI * 2); ctx.fill();
    for (let i = 0; i < 5; i++) {
      const fx = (i - 2) * 15 + Math.sin(time * 8 + i) * 4;
      const fy = -8 - Math.abs(Math.sin(time * 6 + i * 2)) * 18;
      ctx.fillStyle = i % 2 ? "#ffb33f" : "#e64e29";
      ctx.beginPath(); ctx.arc(fx, fy, 5 + (i % 3), 0, Math.PI * 2); ctx.fill();
    }
  } else {
    const radius = 34 + Math.sin(time * 12) * 4;
    ctx.strokeStyle = support.life < .3 ? "#fff0a2" : "#e3573c";
    ctx.lineWidth = 3; ctx.setLineDash([7, 5]);
    ctx.beginPath(); ctx.arc(0, 0, radius, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]); ctx.beginPath(); ctx.moveTo(-45, 0); ctx.lineTo(45, 0); ctx.moveTo(0, -24); ctx.lineTo(0, 24); ctx.stroke();
  }
  ctx.restore();
}

function drawWorld(ctx: CanvasRenderingContext2D, g: Game, background: HTMLImageElement | null, sprites: SpriteMap, nestSprite: HTMLImageElement | null) {
  const sx = g.shake > 0 ? (Math.random() - .5) * g.shake : 0;
  const sy = g.shake > 0 ? (Math.random() - .5) * g.shake : 0;
  ctx.save();
  ctx.translate(sx, sy);
  if (background?.complete) {
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(background, -10, -10, W + 20, H + 20);
  } else {
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, "#4d241b"); sky.addColorStop(1, "#191716");
    ctx.fillStyle = sky; ctx.fillRect(-10, -10, W + 20, H + 20);
  }
  const grade = ctx.createLinearGradient(0, 0, W, 0);
  grade.addColorStop(0, "rgba(23,28,31,.18)"); grade.addColorStop(.55, "rgba(15,13,12,.04)"); grade.addColorStop(1, "rgba(58,18,12,.2)");
  ctx.fillStyle = grade; ctx.fillRect(0, 0, W, H);

  // Three combat corridors used by adaptive routing and support targeting.
  for (let lane = 0; lane < 3; lane++) {
    const y = LANE_Y[lane];
    ctx.fillStyle = lane % 2 ? "rgba(18,20,19,.10)" : "rgba(211,166,101,.045)";
    ctx.fillRect(118, y - 26, 732, 52);
    ctx.strokeStyle = lane === 1 ? "rgba(231,176,93,.24)" : "rgba(220,202,170,.16)";
    ctx.lineWidth = 1; ctx.setLineDash([10, 10]);
    ctx.beginPath(); ctx.moveTo(126, y + 15); ctx.lineTo(840, y + 15); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "rgba(238,211,169,.44)"; ctx.font = "bold 9px monospace";
    ctx.fillText(`0${lane + 1} ${LANE_NAMES[lane]}`, 144, y - 17);
  }

  // Crawler and a three-gate perimeter on the survivor side.
  ctx.fillStyle = "rgba(16,18,18,.76)"; ctx.fillRect(103, 244, 25, 166);
  ctx.fillStyle = "#a85235"; ctx.fillRect(120, 250, 7, 155);
  for (const y of LANE_Y) {
    ctx.fillStyle = "#1b2020"; ctx.beginPath(); ctx.arc(BASE_X, y, 16, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "#b9693d"; ctx.lineWidth = 3; ctx.stroke();
    ctx.fillStyle = "#e6b957"; ctx.fillRect(BASE_X - 4, y - 4, 8, 8);
  }
  ctx.fillStyle = "#171b1c"; ctx.fillRect(18, 331, 95, 64);
  ctx.fillStyle = "#8c442c"; ctx.fillRect(28, 339, 79, 46);
  ctx.fillStyle = "#78918c"; ctx.fillRect(63, 344, 34, 19);
  ctx.fillStyle = "#171a1b"; ctx.beginPath(); ctx.arc(45, 397, 17, 0, Math.PI * 2); ctx.arc(91, 397, 17, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#73726a"; ctx.beginPath(); ctx.arc(45, 397, 7, 0, Math.PI * 2); ctx.arc(91, 397, 7, 0, Math.PI * 2); ctx.fill();

  // All survivor units enter through this single muster beacon, then choose their own route.
  const musterPulse = 18 + Math.sin(g.time * 5) * 3;
  ctx.strokeStyle = "rgba(236,181,78,.72)"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(MUSTER_X, MUSTER_Y, musterPulse, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = "rgba(226,163,66,.22)"; ctx.beginPath(); ctx.arc(MUSTER_X, MUSTER_Y, 11, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#f0c46d"; ctx.beginPath(); ctx.moveTo(MUSTER_X, MUSTER_Y - 7); ctx.lineTo(MUSTER_X + 7, MUSTER_Y); ctx.lineTo(MUSTER_X, MUSTER_Y + 7); ctx.lineTo(MUSTER_X - 7, MUSTER_Y); ctx.closePath(); ctx.fill();
  ctx.fillStyle = "rgba(239,211,166,.68)"; ctx.font = "bold 8px monospace"; ctx.fillText("MUSTER", MUSTER_X + 23, MUSTER_Y + 3);

  // Infected nest and its three approach nodes.
  if (nestSprite?.complete) {
    const pulse = 1 + Math.sin(g.time * 3) * .018;
    ctx.save(); ctx.translate(892, 328); ctx.scale(pulse, pulse);
    ctx.shadowColor = "rgba(235,78,38,.55)"; ctx.shadowBlur = 12 + Math.sin(g.time * 4) * 4;
    ctx.drawImage(nestSprite, -86, -86, 165, 165); ctx.restore();
  }
  ctx.strokeStyle = "rgba(184,63,42,.72)"; ctx.lineWidth = 6;
  for (const y of LANE_Y) {
    ctx.beginPath(); ctx.moveTo(846, y); ctx.lineTo(875, 328); ctx.stroke();
    ctx.fillStyle = "#57251f"; ctx.beginPath(); ctx.arc(NEST_X, y, 15, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "#c34e36"; ctx.lineWidth = 2; ctx.stroke();
  }
  if (!g.nestUnlocked) {
    ctx.fillStyle = "rgba(8,12,13,.7)"; ctx.fillRect(801, 233, 82, 22);
    ctx.strokeStyle = "#6f8791"; ctx.strokeRect(801.5, 233.5, 81, 21);
    ctx.fillStyle = "#a6bdc3"; ctx.font = "bold 9px monospace"; ctx.textAlign = "center"; ctx.fillText("NEST SEALED", 842, 248); ctx.textAlign = "left";
  }

  for (const support of [...g.supports].sort((a, b) => a.y - b.y)) drawSupport(ctx, support, g.time);

  for (const corpse of g.corpses) {
    ctx.save();
    ctx.globalAlpha = Math.min(.65, corpse.life / 2);
    ctx.translate(corpse.x, corpse.y + 7); ctx.scale(1, .45);
    ctx.fillStyle = corpse.kind === "takuya" || corpse.kind === "shade" ? "#292d31" : corpse.side === "zombie" ? "#4e5a3e" : "#5d392f";
    ctx.beginPath(); ctx.ellipse(0, 0, corpse.kind === "abomination" || corpse.kind === "takuya" ? 25 : 15, 7, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    if (corpse.reviveIn !== null) {
      ctx.strokeStyle = `rgba(225,67,46,${.45 + Math.sin(g.time * 10) * .25})`;
      ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(corpse.x, corpse.y - 8, 18, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = "#ff8a66"; ctx.font = "bold 10px monospace"; ctx.textAlign = "center";
      ctx.fillText(`TURN ${Math.max(1, Math.ceil(corpse.reviveIn))}`, corpse.x, corpse.y - 31); ctx.textAlign = "left";
    }
  }

  for (const f of [...g.fighters].sort((a, b) => a.y - b.y || a.x - b.x)) {
    drawSpriteFighter(ctx, f, sprites);
    const barW = f.kind === "takuya" ? 52 : f.kind === "crusher" || f.kind === "brute" ? 38 : f.kind === "abomination" ? 52 : 28;
    const height = f.kind === "takuya" ? 111 : f.kind === "abomination" ? 115 : f.kind === "crusher" || f.kind === "brute" ? 94 : 80;
    const barY = f.y - height;
    ctx.fillStyle = "rgba(0,0,0,.58)"; ctx.fillRect(f.x - barW / 2, barY, barW, 4);
    ctx.fillStyle = f.side === "human" ? "#e9c65a" : "#cb5037";
    ctx.fillRect(f.x - barW / 2, barY, barW * Math.max(0, f.hp / f.maxHp), 4);
  }

  for (const shot of g.shots) {
    const p = 1 - shot.life / .12;
    const x = shot.x + (shot.tx - shot.x) * p;
    const y = shot.y + (shot.ty - shot.y) * p;
    ctx.strokeStyle = shot.side === "human" ? "#ffe078" : "#e76747";
    ctx.shadowColor = ctx.strokeStyle; ctx.shadowBlur = 7; ctx.lineWidth = shot.side === "human" ? 2.5 : 4;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (shot.side === "human" ? -15 : 15), y); ctx.stroke();
  }
  ctx.shadowBlur = 0;
  for (const p of g.particles) {
    ctx.globalAlpha = Math.max(0, p.life * 1.6); ctx.fillStyle = p.color; ctx.fillRect(p.x, p.y, p.size, p.size);
  }
  ctx.globalAlpha = 1;
  for (const d of g.damageTexts) {
    ctx.globalAlpha = Math.min(1, d.life * 2); ctx.fillStyle = d.color; ctx.font = "bold 14px monospace"; ctx.textAlign = "center";
    ctx.shadowColor = "#000"; ctx.shadowBlur = 3; ctx.fillText(d.value, d.x, d.y);
  }
  ctx.globalAlpha = 1; ctx.shadowBlur = 0; ctx.textAlign = "left";
  if (g.flashOverlay > 0) {
    ctx.fillStyle = `rgba(255,193,106,${Math.min(.48, g.flashOverlay)})`; ctx.fillRect(0, 0, W, H);
  }
  ctx.restore();
}

export function AshfallGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const backgroundRef = useRef<HTMLImageElement | null>(null);
  const spriteRefs = useRef<SpriteMap>({});
  const nestSpriteRef = useRef<HTMLImageElement | null>(null);
  const gameRef = useRef<Game>(initialGame());
  const audioRef = useRef<AudioContext | null>(null);
  const musicRef = useRef<MusicRuntime | null>(null);
  const jingleRef = useRef<JingleRuntime | null>(null);
  const desiredMusicModeRef = useRef<MusicMode>("normal");
  const musicStartTokenRef = useRef(0);
  const lastHudRef = useRef(0);
  const selectedActionRef = useRef<SelectedAction>(null);
  const [started, setStarted] = useState(false);
  const [paused, setPaused] = useState(false);
  const [bgmMuted, setBgmMuted] = useState(false);
  const [sfxMuted, setSfxMuted] = useState(false);
  const [musicActive, setMusicActive] = useState(false);
  const [selectedAction, setSelectedAction] = useState<SelectedAction>(null);
  const [hud, setHud] = useState<Hud>({
    energy: 55, rage: 0, scrap: 0, kills: 0, wave: 1, phase: 1, baseHp: 520, nestHp: 620,
    nestUnlocked: false, strike: 0, combo: 0, bossHp: 0, bossMax: 0,
    objective: objectiveFor(1, false), deployCooldowns: emptyCooldowns(),
  });
  const [end, setEnd] = useState<"win" | "lose" | null>(null);

  const chooseAction = useCallback((action: SelectedAction) => {
    selectedActionRef.current = action;
    setSelectedAction(action);
  }, []);

  useEffect(() => {
    const image = new Image(); image.src = "/battlefield-v2.png"; image.onload = () => { backgroundRef.current = image; };
    const paths: Record<string, string> = {
      scout: "/scout-sprites-v2.png", ranger: "/ranger-sprites-v1.png", brute: "/breaker-sprites-v2.png",
      brawler: "/brawler-sprites-v1.png", gunner: "/gunner-sprites-v1.png", medic: "/medic-sprites-v1.png",
      infected: "/infected-sprites-v1.png", crusher: "/crusher-sprites-v1.png", spitter: "/spitter-sprites-v1.png",
      takuya: "/takuya-boss-sprites-v2.png", shade: "/shade-raider-sprites-v1.png",
    };
    Object.entries(paths).forEach(([key, src]) => {
      const sprite = new Image(); sprite.src = src; sprite.onload = () => { spriteRefs.current[key] = sprite; };
    });
    const nest = new Image(); nest.src = "/infected-nest-v1.png"; nest.onload = () => { nestSpriteRef.current = nest; };
  }, []);

  const ensureAudio = useCallback(() => {
    const AudioCtx = window.AudioContext || (window as typeof window & { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!audioRef.current || audioRef.current.state === "closed") audioRef.current = new AudioCtx();
    return audioRef.current;
  }, []);

  const tone = useCallback((freq: number, duration = .06, type: OscillatorType = "square") => {
    if (sfxMuted) return;
    try {
      const audio = ensureAudio();
      if (audio.state !== "running") void audio.resume().catch(() => undefined);
      const oscillator = audio.createOscillator(); const gain = audio.createGain();
      oscillator.type = type; oscillator.frequency.value = freq;
      gain.gain.setValueAtTime(.055, audio.currentTime);
      gain.gain.exponentialRampToValueAtTime(.001, audio.currentTime + duration);
      oscillator.connect(gain); gain.connect(audio.destination); oscillator.start(); oscillator.stop(audio.currentTime + duration);
    } catch { /* Audio remains optional. */ }
  }, [ensureAudio, sfxMuted]);

  const syncMusicMode = useCallback((mode: MusicMode) => {
    desiredMusicModeRef.current = mode;
    const music = musicRef.current;
    const audio = audioRef.current;
    if (!music || !audio || music.mode === mode) return;
    music.mode = mode;
    const danger = mode === "normal" ? .0001 : mode === "danger" ? 1 : .55;
    const boss = mode === "boss" ? 1 : .0001;
    for (const [bus, value] of [[music.dangerBus, danger], [music.bossBus, boss]] as [GainNode, number][]) {
      bus.gain.cancelScheduledValues(audio.currentTime);
      bus.gain.setTargetAtTime(value, audio.currentTime, .16);
    }
  }, []);

  const stopMusic = useCallback(() => {
    musicStartTokenRef.current++;
    setMusicActive(false);
    const music = musicRef.current;
    if (!music) return;
    window.clearInterval(music.timer);
    const audio = audioRef.current;
    if (audio && audio.state !== "closed") {
      music.master.gain.cancelScheduledValues(audio.currentTime);
      music.master.gain.setTargetAtTime(.0001, audio.currentTime, .055);
    }
    window.setTimeout(() => { try { music.master.disconnect(); } catch { /* Already disconnected. */ } }, 320);
    musicRef.current = null;
  }, []);

  const stopJingle = useCallback(() => {
    const jingle = jingleRef.current;
    if (!jingle) return;
    for (const oscillator of jingle.oscillators) {
      try { oscillator.stop(); } catch { /* The note may already have ended. */ }
    }
    try { jingle.gain.disconnect(); } catch { /* Already disconnected. */ }
    jingleRef.current = null;
  }, []);

  const startMusic = useCallback(() => {
    if (musicRef.current) return;
    const token = ++musicStartTokenRef.current;
    let audio: AudioContext;
    try { audio = ensureAudio(); } catch { setMusicActive(false); return; }
    if (audio.state !== "running") void audio.resume().catch(() => undefined);
    if (token !== musicStartTokenRef.current || musicRef.current) return;
    try {
      const master = audio.createGain(); const normalBus = audio.createGain(); const dangerBus = audio.createGain(); const bossBus = audio.createGain();
      master.gain.setValueAtTime(.16, audio.currentTime); normalBus.gain.value = 1;
      const mode = desiredMusicModeRef.current;
      dangerBus.gain.value = mode === "normal" ? .0001 : mode === "danger" ? 1 : .55;
      bossBus.gain.value = mode === "boss" ? 1 : .0001;
      normalBus.connect(master); dangerBus.connect(master); bossBus.connect(master); master.connect(audio.destination);
      const music: MusicRuntime = { master, normalBus, dangerBus, bossBus, timer: 0, step: 0, nextStepAt: audio.currentTime + .04, mode };
      musicRef.current = music;
      setMusicActive(true);
      const bassLine = [55, 55, 65.41, 55, 49, 49, 43.65, 49, 55, 55, 73.42, 65.41, 49, 43.65, 49, 41.2];
      const melody = [220, 0, 246.94, 0, 293.66, 0, 261.63, 0, 220, 0, 329.63, 0, 293.66, 0, 196, 0];
      const voice = (frequency: number, at: number, duration: number, volume: number, type: OscillatorType, bus: GainNode, endFrequency?: number) => {
        const oscillator = audio.createOscillator(); const gain = audio.createGain();
        oscillator.type = type; oscillator.frequency.setValueAtTime(frequency, at);
        if (endFrequency) oscillator.frequency.exponentialRampToValueAtTime(endFrequency, at + duration * .72);
        gain.gain.setValueAtTime(.0001, at); gain.gain.exponentialRampToValueAtTime(volume, at + .012); gain.gain.exponentialRampToValueAtTime(.0001, at + duration);
        oscillator.connect(gain); gain.connect(bus); oscillator.start(at); oscillator.stop(at + duration + .02);
      };
      const scheduleStep = (at: number, stepNumber: number) => {
        const step = stepNumber % bassLine.length;
        voice(bassLine[step] * 2, at, .19, .16, "sawtooth", normalBus);
        if (step % 4 === 0) voice(bassLine[step] * 4, at, .82, .045, "triangle", normalBus);
        if (melody[step]) voice(melody[step], at, .17, .052, "triangle", normalBus);
        if (step % 2 === 0) voice(step % 4 === 0 ? 145 : 190, at, .09, .12, "sine", normalBus, 56);
        if (step % 2 === 1) voice(330 + (step % 4) * 48, at, .055, .075, "square", dangerBus);
        if (step % 4 === 2) voice(184, at, .13, .1, "sine", dangerBus, 68);
        voice(step % 2 ? 92 : 116, at, .075, step % 2 ? .065 : .11, "sawtooth", bossBus, 62);
        if (step % 4 === 0) voice(bassLine[step] * 2, at, .75, .075, "square", bossBus);
      };
      const scheduler = () => {
        if (musicRef.current !== music || audio.state === "closed") return;
        if (music.nextStepAt < audio.currentTime - .02) music.nextStepAt = audio.currentTime + .05;
        let scheduled = 0;
        while (music.nextStepAt < audio.currentTime + .12 && scheduled < 2) {
          scheduleStep(music.nextStepAt, music.step++);
          music.nextStepAt += .24;
          scheduled++;
        }
      };
      scheduler();
      music.timer = window.setInterval(scheduler, 50);
    } catch { musicRef.current = null; setMusicActive(false); }
  }, [ensureAudio]);

  const playEndJingle = useCallback((won: boolean) => {
    if (sfxMuted) return;
    try {
      const audio = ensureAudio();
      stopJingle();
      const master = audio.createGain();
      master.gain.setValueAtTime(1, audio.currentTime);
      master.connect(audio.destination);
      const runtime: JingleRuntime = { gain: master, oscillators: [] };
      jingleRef.current = runtime;
      const notes = won ? [220, 293.66, 369.99, 440] : [164.81, 138.59, 110, 73.42];
      notes.forEach((frequency, index) => {
        const at = audio.currentTime + .08 + index * .14;
        const oscillator = audio.createOscillator(); const gain = audio.createGain();
        oscillator.type = won ? "square" : "sawtooth"; oscillator.frequency.setValueAtTime(frequency, at);
        gain.gain.setValueAtTime(.0001, at); gain.gain.exponentialRampToValueAtTime(.07, at + .02); gain.gain.exponentialRampToValueAtTime(.0001, at + .22);
        oscillator.connect(gain); gain.connect(master); oscillator.start(at); oscillator.stop(at + .24);
        runtime.oscillators.push(oscillator);
        if (index === notes.length - 1) {
          oscillator.onended = () => {
            if (jingleRef.current !== runtime) return;
            try { master.disconnect(); } catch { /* Already disconnected. */ }
            jingleRef.current = null;
          };
        }
      });
    } catch { /* Jingle is optional. */ }
  }, [ensureAudio, sfxMuted, stopJingle]);

  useEffect(() => () => {
    stopMusic();
    stopJingle();
    const audio = audioRef.current;
    if (audio && audio.state !== "closed") void audio.close();
  }, [stopJingle, stopMusic]);

  const deployHuman = useCallback((kind: UnitKind) => {
    const g = gameRef.current;
    const card = cards.find((item) => item.kind === kind);
    if (!card || !canDeploy({ running: g.running, paused: g.paused, over: g.over, command: g.energy, cost: card.cost, cooldown: g.deployCooldowns[kind] })) {
      tone(105, .1, "sawtooth");
      return false;
    }
    g.energy -= card.cost;
    g.deployCooldowns[kind] = card.deployCooldown;
    const id = g.nextId++;
    const laneSpeed = kind === "scout" ? 78 : kind === "brawler" ? 68 : kind === "brute" ? 42 : kind === "gunner" ? 54 : 60;
    g.fighters.push({
      id, side: "human", kind, lane: 1, anchorLane: null, x: MUSTER_X, y: MUSTER_Y, hp: card.hp, maxHp: card.hp,
      speed: card.speed, damage: card.damage, range: card.range, cooldown: 0, supportCooldown: 0,
      attackEvery: card.attackEvery, flash: 0, step: Math.random() * 4, attack: 0, knock: 0, variant: id % 3,
      targetId: null, retargetIn: 0, bodyRadius: bodyRadiusFor(kind), laneSpeed, spawnGrace: .24,
    });
    addParticles(g, MUSTER_X, MUSTER_Y, "#d0b48b", 7);
    g.banner = `${card.name} // MUSTER DEPLOYED`;
    g.bannerTime = .8;
    tone(kind === "brute" ? 110 : 220, .07);
    return true;
  }, [tone]);

  const deploySupport = useCallback((kind: SupportKind, lane: Lane, x: number) => {
    const g = gameRef.current;
    const def = supportDefs.find((item) => item.kind === kind);
    if (!def || !g.running || g.paused || g.over || g.rage < def.cost || (kind === "airstrike" && g.strikeCooldown > 0)) {
      tone(105, .1, "sawtooth");
      return false;
    }
    if (kind === "barrel" && g.supports.some((support) => support.kind === "barrel" && support.lane === lane)) {
      g.banner = "ONE BARREL PER LANE"; g.bannerTime = .9; tone(105, .1, "sawtooth"); return false;
    }
    g.rage -= def.cost;
    if (kind === "airstrike") g.strikeCooldown = 8;
    const life = kind === "barrel" ? 12 : kind === "medkit" ? 8 : kind === "molotov" ? 6 : .85;
    g.supports.push({ id: g.nextId++, kind, lane, x: Math.max(230, Math.min(790, x)), y: laneY(lane), life, tick: 0, triggered: false });
    g.banner = `${def.name} // ${LANE_NAMES[lane]} LANE`;
    g.bannerTime = 1;
    tone(kind === "airstrike" ? 68 : 160, kind === "airstrike" ? .35 : .08, kind === "airstrike" ? "sawtooth" : "square");
    return true;
  }, [tone]);

  const executeSelected = useCallback((lane: Lane, x: number) => {
    const action = selectedActionRef.current;
    if (!action) return;
    const [, kind] = action.split(":") as ["support", SupportKind];
    const succeeded = deploySupport(kind, lane, x);
    if (succeeded) chooseAction(null);
  }, [chooseAction, deploySupport]);

  const handleBattlefieldPointer = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!selectedActionRef.current) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - rect.left) * W / rect.width;
    const y = (event.clientY - rect.top) * H / rect.height;
    let lane: Lane = 0;
    if (Math.abs(y - LANE_Y[1]) < Math.abs(y - LANE_Y[lane])) lane = 1;
    if (Math.abs(y - LANE_Y[2]) < Math.abs(y - LANE_Y[lane])) lane = 2;
    executeSelected(lane, x);
  }, [executeSelected]);

  const startGame = useCallback(() => {
    const fresh = initialGame(); fresh.running = true; gameRef.current = fresh;
    desiredMusicModeRef.current = "normal";
    setStarted(true); setPaused(false); setEnd(null); chooseAction(null);
    setHud({ energy: 55, rage: 0, scrap: 0, kills: 0, wave: 1, phase: 1, baseHp: 520, nestHp: 620, nestUnlocked: false, strike: 0, combo: 0, bossHp: 0, bossMax: 0, objective: objectiveFor(1, false), deployCooldowns: emptyCooldowns() });
    stopMusic(); stopJingle(); if (!bgmMuted) startMusic();
    tone(180, .12); window.setTimeout(() => tone(260, .12), 90);
  }, [bgmMuted, chooseAction, startMusic, stopJingle, stopMusic, tone]);

  const togglePause = useCallback(() => {
    const g = gameRef.current;
    if (!g.running || g.over) return;
    g.paused = !g.paused; setPaused(g.paused);
    if (g.paused) stopMusic(); else if (!bgmMuted) startMusic();
  }, [bgmMuted, startMusic, stopMusic]);

  const toggleBgm = useCallback(() => {
    const next = !bgmMuted; setBgmMuted(next);
    if (next) stopMusic(); else if (started && !paused && !end) startMusic();
  }, [bgmMuted, end, paused, startMusic, started, stopMusic]);

  const toggleSfx = useCallback(() => {
    const next = !sfxMuted; setSfxMuted(next);
    if (next) stopJingle();
  }, [sfxMuted, stopJingle]);

  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      const card = cards.find((item) => item.key === event.key);
      if (card) deployHuman(card.kind);
      const support = supportDefs.find((item) => item.key.toLowerCase() === event.key.toLowerCase());
      if (support) chooseAction(`support:${support.kind}`);
      if (event.key === "Escape") {
        if (selectedActionRef.current) chooseAction(null); else togglePause();
      }
      if (event.key.toLowerCase() === "p") togglePause();
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [chooseAction, deployHuman, togglePause]);

  useEffect(() => {
    let frame = 0;
    const loop = (now: number) => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      const g = gameRef.current;
      if (!ctx) { frame = requestAnimationFrame(loop); return; }
      ctx.imageSmoothingEnabled = false;
      const dt = Math.min(.033, g.last ? (now - g.last) / 1000 : 0);
      g.last = now;

      if (g.running && !g.paused && !g.over) {
        g.time += dt;
        g.energy = advanceCommand(g.energy, dt);
        g.strikeCooldown = Math.max(0, g.strikeCooldown - dt);
        g.bannerTime = Math.max(0, g.bannerTime - dt);
        g.shake = Math.max(0, g.shake - dt * 38);
        g.flashOverlay = Math.max(0, g.flashOverlay - dt * 2.2);
        g.comboTime = Math.max(0, g.comboTime - dt);
        if (g.comboTime <= 0) g.combo = 0;
        for (const card of cards) g.deployCooldowns[card.kind] = Math.max(0, g.deployCooldowns[card.kind] - dt);

        const nextPhase = phaseAt(g.time) as Game["phase"];
        if (nextPhase !== g.phase) {
          g.phase = nextPhase;
          g.banner = nextPhase === 2 ? "PHASE II — PUSH THE CHECKPOINT" : "PHASE III — IRON JUDGE";
          g.bannerTime = 3; g.shake = 9; g.flashOverlay = .15;
        }

        while (g.eventIndex < missionEvents.length && g.time >= missionEvents[g.eventIndex].at) {
          const mission = missionEvents[g.eventIndex++];
          const bossAlive = g.fighters.some((fighter) => fighter.kind === "takuya" && fighter.hp > 0);
          if (mission.bossOnly && !bossAlive) continue;
          g.wave = mission.wave; g.banner = mission.label; g.bannerTime = mission.label.includes("TAKUYA") ? 3.2 : 2.1;
          if (mission.label.includes("WARNING")) { g.shake = 8; g.flashOverlay = .12; }
          mission.units.forEach(([kind, lane], index) => spawnEnemy(g, kind, lane, index % 3));
          if (mission.units.length) tone(mission.label.includes("TAKUYA") ? 58 : 82, mission.label.includes("TAKUYA") ? .45 : .24, "sawtooth");
        }

        // Field support simulation stays separate from fighters so targeting remains predictable.
        for (const support of g.supports) {
          support.life -= dt; support.tick -= dt;
          if (support.kind === "barrel") {
            const contact = g.fighters.some((fighter) => fighter.side === "zombie" && fighter.hp > 0 && effectDistance(fighter, support) <= 35);
            if (contact) {
              damageEnemiesInRadius(g, support.x, support.y, 92, 105, "#ffbd59", 15);
              addParticles(g, support.x, support.y - 10, "#f26a35", 24); g.shake = 13; g.flashOverlay = .25; support.life = -1;
              tone(64, .24, "sawtooth");
            }
          } else if (support.kind === "medkit" && support.tick <= 0) {
            support.tick = .5;
            for (const fighter of g.fighters) {
              if (fighter.side !== "human" || fighter.hp <= 0 || effectDistance(fighter, support) > 95) continue;
              const healed = Math.min(4, fighter.maxHp - fighter.hp);
              if (healed > 0) { fighter.hp += healed; g.damageTexts.push({ x: fighter.x, y: fighter.y - 55, value: `+${healed}`, life: .55, color: "#83e0a2" }); }
            }
          } else if (support.kind === "molotov" && support.tick <= 0) {
            support.tick = .4; damageEnemiesInRadius(g, support.x, support.y, 85, 7.2, "#ff8b45", 1);
            addParticles(g, support.x + (Math.random() - .5) * 70, support.y - 5, "#ee6436", 2);
          } else if (support.kind === "airstrike" && support.life <= .12 && !support.triggered) {
            support.triggered = true;
            damageEnemiesInRadius(g, support.x, support.y, 140, 150, "#ffe17a", 22);
            addParticles(g, support.x, support.y - 12, "#f28d46", 34); g.shake = 20; g.flashOverlay = .48; support.life = -.2;
            tone(52, .45, "sawtooth");
          }
        }
        g.supports = g.supports.filter((support) => support.life > 0);

        const fighterById = new Map(g.fighters.filter((fighter) => fighter.hp > 0).map((fighter) => [fighter.id, fighter]));
        const targetClaims = new Map<number, number>();
        const interceptorClaims = new Map<number, number>();
        for (const fighter of g.fighters) {
          if (fighter.hp <= 0 || fighter.targetId === null) continue;
          const claimed = fighterById.get(fighter.targetId);
          if (fighter.side === "human" && claimed?.side === "zombie" && claimed.hp > 0) {
            targetClaims.set(claimed.id, (targetClaims.get(claimed.id) ?? 0) + 1);
          } else if (fighter.side === "zombie" && claimed?.side === "human" && claimed.hp > 0) {
            interceptorClaims.set(claimed.id, (interceptorClaims.get(claimed.id) ?? 0) + 1);
          }
        }

        for (const f of g.fighters) {
          if (f.hp <= 0) continue;
          f.cooldown -= dt; f.supportCooldown -= dt; f.retargetIn = Math.max(0, f.retargetIn - dt); f.spawnGrace = Math.max(0, f.spawnGrace - dt);
          f.flash = Math.max(0, f.flash - dt); f.attack = Math.max(0, f.attack - dt); f.step += dt;
          if (Math.abs(f.knock) > .1) { f.x += (f.side === "human" ? -1 : 1) * f.knock * dt * 6; f.knock *= .9; }

          if (f.kind === "medic" && f.supportCooldown <= 0) {
            const wounded = g.fighters
              .filter((other) => other.side === "human" && other.id !== f.id && other.hp > 0 && other.hp < other.maxHp && fighterDistance(other, f) <= 108)
              .sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
            if (wounded) {
              const healed = Math.min(16, wounded.maxHp - wounded.hp);
              wounded.hp += healed; f.supportCooldown = 1.55;
              g.damageTexts.push({ x: wounded.x, y: wounded.y - 70, value: `+${Math.ceil(healed)}`, life: .8, color: "#83e0a2" });
              addParticles(g, wounded.x, wounded.y - 30, "#69d993", 7);
            }
          }

          let target: Fighter | undefined;
          let distance = Infinity;
          if (f.side === "human") {
            const enemies = g.fighters.filter((enemy) => enemy.side === "zombie" && enemy.hp > 0);
            const locked = f.targetId === null ? undefined : fighterById.get(f.targetId);
            const contact = enemies
              .filter((enemy) => fighterDistance(f, enemy) <= 48)
              .sort((a, b) => fighterDistance(f, a) - fighterDistance(f, b))[0];
            const targetCapacity = (enemy: Fighter) => enemy.kind === "takuya" ? 6 : enemy.kind === "abomination" ? 3 : enemy.kind === "crusher" || enemy.kind === "shade" ? 2 : 1;
            const targetScore = (enemy: Fighter) => autonomousTargetScore({ distance: fighterDistance(f, enemy), claims: targetClaims.get(enemy.id) ?? 0, capacity: targetCapacity(enemy), enemyX: enemy.x, isCurrent: f.targetId === enemy.id });
            const best = enemies.reduce<Fighter | undefined>((choice, enemy) => !choice || targetScore(enemy) < targetScore(choice) ? enemy : choice, undefined);
            if (contact) target = contact;
            else if (locked?.side === "zombie" && locked.hp > 0) {
              target = locked;
              if (f.retargetIn <= 0 && best && best.id !== locked.id && targetScore(best) + 34 < targetScore(locked)) target = best;
            } else target = best;
            if (f.retargetIn <= 0 || target?.id !== f.targetId) f.retargetIn = .34 + (f.variant % 3) * .05;
            if (target?.id !== f.targetId) {
              if (f.targetId !== null) targetClaims.set(f.targetId, Math.max(0, (targetClaims.get(f.targetId) ?? 1) - 1));
              if (target) targetClaims.set(target.id, (targetClaims.get(target.id) ?? 0) + 1);
              f.targetId = target?.id ?? null;
            }
          } else {
            const humans = g.fighters.filter((human) => human.side === "human" && human.hp > 0);
            const locked = f.targetId === null ? undefined : fighterById.get(f.targetId);
            const contact = humans
              .filter((human) => fighterDistance(f, human) <= f.range + human.bodyRadius + 4)
              .sort((a, b) => fighterDistance(f, a) - fighterDistance(f, b))[0];
            const validInterceptors = humans.filter((human) => {
              const alreadyEngaged = fighterDistance(f, human) <= f.range + human.bodyRadius + 4;
              return (human.x <= f.x || alreadyEngaged) && f.x - human.x <= 280;
            });
            const defenderCapacity = (human: Fighter) => human.kind === "brute" || human.kind === "brawler" ? 3 : human.kind === "scout" || human.kind === "medic" ? 1 : 2;
            const interceptorScore = (human: Fighter) => interceptorTargetScore({
              distance: fighterDistance(f, human),
              claims: interceptorClaims.get(human.id) ?? 0,
              capacity: defenderCapacity(human),
              isCurrent: f.targetId === human.id,
              rearward: human.x - f.x,
            });
            const bestInterceptor = validInterceptors.reduce<Fighter | undefined>((choice, human) => {
              return !choice || interceptorScore(human) < interceptorScore(choice) ? human : choice;
            }, undefined);
            const lockedValid = locked?.side === "human" && locked.hp > 0
              && (locked.x <= f.x || fighterDistance(f, locked) <= f.range + locked.bodyRadius + 4)
              && f.x - locked.x <= 310;
            target = contact ?? (lockedValid && f.retargetIn > 0 ? locked : bestInterceptor);
            if (f.retargetIn <= 0 || target?.id !== f.targetId) {
              if (target) {
                f.anchorLane = laneForY(target.y, f.lane, 0) as Lane;
              } else {
                const routes: Lane[] = [0, 1, 2];
                f.anchorLane = routes.reduce((bestLane, lane) => {
                  const routeScore = (candidate: Lane) => {
                    const defense = humans
                      .filter((human) => human.x < f.x && Math.abs(human.y - LANE_Y[candidate]) <= 34)
                      .reduce((sum, human) => sum + human.hp * .08 + human.damage * 1.2, 0);
                    const congestion = g.fighters.filter((enemy) => enemy.side === "zombie" && enemy.hp > 0 && enemy.anchorLane === candidate).length * 7;
                    const switchCost = Math.abs(f.y - LANE_Y[candidate]) * .34;
                    return defense + congestion + switchCost + ((f.id * 7 + candidate * 13) % 11);
                  };
                  return routeScore(lane) < routeScore(bestLane) ? lane : bestLane;
                }, f.anchorLane ?? f.lane);
              }
              f.retargetIn = .52 + (f.variant % 3) * .08;
            }
            if (target?.id !== f.targetId) {
              if (f.targetId !== null) interceptorClaims.set(f.targetId, Math.max(0, (interceptorClaims.get(f.targetId) ?? 1) - 1));
              if (target) interceptorClaims.set(target.id, (interceptorClaims.get(target.id) ?? 0) + 1);
            }
            f.targetId = target?.id ?? null;
          }
          distance = target ? fighterDistance(f, target) : Infinity;
          const zombieTargetFloor = f.side === "zombie" && target && target.x <= f.x ? target.x : null;
          const baseDistance = f.side === "human" ? NEST_X - f.x : f.x - BASE_X;
          if (target && distance <= f.range + target.bodyRadius) {
            if (f.cooldown <= 0) {
              const enragedTakuya = f.kind === "takuya" && f.hp / f.maxHp <= .5;
              target.hp -= f.damage; target.flash = .12;
              target.knock = f.kind === "brute" || f.kind === "abomination" || f.kind === "takuya" ? 9 : 3;
              f.attack = .18; f.cooldown = enragedTakuya ? .9 : f.attackEvery;
              g.damageTexts.push({ x: target.x + (Math.random() - .5) * 10, y: target.y - 45, value: String(f.damage), life: .65, color: f.side === "human" ? "#f6d278" : "#e98a72" });
              g.shake = Math.max(g.shake, f.kind === "takuya" ? 11 : f.kind === "brute" || f.kind === "abomination" ? 7 : 2.5);
              if (f.kind === "takuya") {
                for (const splash of g.fighters) {
                  if (splash.side === "human" && splash.id !== target.id && splash.hp > 0 && fighterDistance(splash, target) < 58) {
                    splash.hp -= 22; splash.flash = .12; splash.knock = 6;
                    g.damageTexts.push({ x: splash.x, y: splash.y - 46, value: "22", life: .65, color: "#e98a72" });
                  }
                }
                addParticles(g, target.x, target.y + 2, "#b78656", 13); tone(64, .16, "sawtooth");
              }
              if (["ranger", "gunner", "medic", "spitter"].includes(f.kind)) {
                g.shots.push({ x: f.x + (f.side === "human" ? 14 : -14), y: f.y - 32, tx: target.x, ty: target.y - 28, life: .12, side: f.side });
                if (f.side === "human") tone(310 + Math.random() * 50, .035);
              } else {
                addParticles(g, target.x, target.y - 18, target.kind === "takuya" || target.kind === "shade" ? "#b98a62" : target.side === "zombie" ? "#8aa66a" : "#c06d51", 3);
              }
            }
          } else if (!target && baseDistance <= f.range + 10) {
            if (f.cooldown <= 0) {
              if (f.side === "human") {
                if (g.nestUnlocked) g.nestHp -= f.damage;
              } else {
                g.baseHp -= f.damage;
              }
              f.attack = .18; f.cooldown = f.attackEvery; g.shake = Math.max(g.shake, 4);
            }
          } else if (target && f.side === "human") {
            const humanLimit = g.phase === 1 ? 520 : g.phase === 2 || !g.nestUnlocked ? 730 : NEST_X;
            const dx = target.x - f.x; const dy = target.y - f.y;
            const stoppingDistance = Math.max(18, f.range + target.bodyRadius * .55);
            if (Math.abs(dx) > stoppingDistance) {
              const nextX = f.x + Math.sign(dx) * Math.min(Math.abs(dx), f.speed * dt);
              f.x = Math.max(MUSTER_X - 8, Math.min(humanLimit, nextX));
            }
            if (Math.abs(dy) > 2) f.y += Math.sign(dy) * Math.min(Math.abs(dy), f.laneSpeed * dt);
            f.y = Math.max(LANE_Y[0], Math.min(LANE_Y[2], f.y));
            f.lane = laneForY(f.y, f.lane) as Lane;
          } else if (target && f.side === "zombie") {
            // Infected adapt their lane and intercept defenders, but never step away from the CRAWLER or phase through a target.
            const burning = g.supports.some((support) => support.kind === "molotov" && effectDistance(f, support) <= 85);
            const dx = target.x - f.x;
            const dy = target.y - f.y;
            const stoppingDistance = Math.max(18, f.range + target.bodyRadius * .55);
            const travel = Math.max(0, distance - stoppingDistance);
            const step = Math.min(travel, f.speed * dt * (burning ? .8 : 1));
            if (dx < 0 && distance > .1) f.x = Math.max(target.x, f.x + dx / distance * step);
            if (Math.abs(dy) > 2) f.y += Math.sign(dy) * Math.min(Math.abs(dy), f.laneSpeed * dt);
            f.y = Math.max(LANE_Y[0], Math.min(LANE_Y[2], f.y));
            f.lane = laneForY(f.y, f.lane) as Lane;
          } else {
            const humanLimit = g.phase === 1 ? 520 : g.phase === 2 || !g.nestUnlocked ? 730 : NEST_X;
            const heldAtLine = f.side === "human" && f.x >= humanLimit;
            if (!heldAtLine) {
              const burning = f.side === "zombie" && g.supports.some((support) => support.kind === "molotov" && effectDistance(f, support) <= 85);
              f.x += (f.side === "human" ? 1 : -1) * f.speed * dt * (burning ? .8 : 1);
            }
            if (f.side === "zombie" && f.anchorLane !== null) {
              const dy = LANE_Y[f.anchorLane] - f.y;
              if (Math.abs(dy) > 2) f.y += Math.sign(dy) * Math.min(Math.abs(dy), f.laneSpeed * dt);
              f.y = Math.max(LANE_Y[0], Math.min(LANE_Y[2], f.y));
              f.lane = laneForY(f.y, f.lane) as Lane;
            }
          }

          if (f.side === "human" || f.side === "zombie") {
            for (const other of g.fighters) {
              if (other.side !== f.side || other.id >= f.id || other.hp <= 0) continue;
              const dx = f.x - other.x; const dy = f.y - other.y; const separation = f.bodyRadius + other.bodyRadius;
              const gap = Math.hypot(dx, dy);
              if (gap >= separation || gap > 26) continue;
              const ux = gap > .1 ? dx / gap : (f.id % 2 ? 1 : -1) * .35;
              const uy = gap > .1 ? dy / gap : (f.id % 2 ? 1 : -1);
              const push = Math.min(2.2, (separation - gap) * (f.spawnGrace > 0 ? .2 : .08));
              if (f.side === "human") {
                f.x += ux * push; f.y += uy * push;
              } else {
                // Queue separation keeps the lead attacker fixed: followers fan out or yield away from the CRAWLER.
                const canFanOut = (uy < 0 && f.y > LANE_Y[0] + 3) || (uy > 0 && f.y < LANE_Y[2] - 3);
                if (canFanOut) f.y += uy * push * 1.25;
                else if (f.x >= other.x) f.x += push * .45;
              }
            }
            if (f.side === "human") f.x = Math.max(MUSTER_X - 8, f.x);
            else if (zombieTargetFloor !== null) f.x = Math.max(zombieTargetFloor, f.x);
            f.y = Math.max(LANE_Y[0], Math.min(LANE_Y[2], f.y));
            f.lane = laneForY(f.y, f.lane) as Lane;
          }
        }

        const dead = g.fighters.filter((fighter) => fighter.hp <= 0);
        for (const fighter of dead) {
          addParticles(g, fighter.x, fighter.y - 15, fighter.kind === "takuya" || fighter.kind === "shade" ? "#c08d62" : fighter.side === "zombie" ? "#7e965e" : "#b0614e", fighter.kind === "takuya" ? 20 : 11);
          g.corpses.push({ x: fighter.x, y: fighter.y, lane: fighter.lane, side: fighter.side, kind: fighter.kind, life: fighter.side === "human" ? 6 : 5, variant: fighter.variant, reviveIn: fighter.side === "human" ? 3.2 : null, prevented: false });
          if (fighter.side === "zombie") {
            g.kills++; g.combo++; g.comboTime = 2.3;
            g.scrap += scrapReward(fighter.kind);
            g.rage = Math.min(RAGE_MAX, g.rage + rageReward(fighter.kind));
            if (fighter.kind === "takuya") {
              g.nestUnlocked = true; g.banner = "TAKUYA DOWN — NEST EXPOSED"; g.bannerTime = 3.4; g.shake = 15; g.flashOverlay = .3;
            }
          }
        }
        g.fighters = g.fighters.filter((fighter) => fighter.hp > 0);

        const revived: Fighter[] = [];
        for (const corpse of g.corpses) {
          corpse.life -= dt;
          if (corpse.reviveIn === null) continue;
          const medicNearby = g.fighters.some((fighter) => fighter.side === "human" && fighter.kind === "medic" && fighter.hp > 0 && fighterDistance(fighter, corpse) <= 110);
          if (medicNearby) {
            corpse.reviveIn = null; corpse.prevented = true;
            g.damageTexts.push({ x: corpse.x, y: corpse.y - 34, value: "INFECTION STOPPED", life: 1.15, color: "#7de2a0" });
            addParticles(g, corpse.x, corpse.y - 15, "#69d993", 9);
          } else {
            corpse.reviveIn -= dt;
            if (corpse.reviveIn <= 0) {
              const data = enemyStats("turned", g.wave); const id = g.nextId++;
              revived.push({
                id, side: "zombie", kind: "turned", lane: corpse.lane, anchorLane: corpse.lane,
                x: corpse.x, y: corpse.y, hp: data.hp, maxHp: data.hp, speed: data.speed, damage: data.damage,
                range: data.range, cooldown: .4, supportCooldown: 0, attackEvery: data.attackEvery,
                flash: 0, step: 0, attack: 0, knock: 0, variant: corpse.variant,
                targetId: null, retargetIn: 0, bodyRadius: bodyRadiusFor("turned"), laneSpeed: enemyLaneSpeedFor("turned"), spawnGrace: 0,
              });
              corpse.life = -1; corpse.reviveIn = null;
              g.banner = `SURVIVOR TURNED // ${LANE_NAMES[corpse.lane]}`; g.bannerTime = 1.4;
              addParticles(g, corpse.x, corpse.y - 20, "#90a965", 14); tone(72, .22, "sawtooth");
            }
          }
        }
        if (revived.length) g.fighters.push(...revived);
        g.corpses = g.corpses.filter((corpse) => corpse.life > 0);

        for (const p of g.particles) { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 180 * dt; }
        g.particles = g.particles.filter((p) => p.life > 0);
        for (const d of g.damageTexts) { d.life -= dt; d.y -= dt * 23; }
        g.damageTexts = g.damageTexts.filter((d) => d.life > 0);
        for (const shot of g.shots) shot.life -= dt;
        g.shots = g.shots.filter((shot) => shot.life > 0);

        const bossAlive = g.fighters.some((fighter) => fighter.kind === "takuya" && fighter.hp > 0);
        syncMusicMode(bossAlive ? "boss" : g.phase >= 2 || g.baseHp <= 260 ? "danger" : "normal");

        if (g.baseHp <= 0 || g.nestHp <= 0) {
          g.over = true;
          // A simultaneous collapse is a loss: protecting the crawler always remains mandatory.
          g.won = g.baseHp > 0 && g.nestHp <= 0;
          g.shake = 18; setEnd(g.won ? "win" : "lose"); chooseAction(null);
          stopMusic(); playEndJingle(g.won);
        }
      }

      drawWorld(ctx, g, backgroundRef.current, spriteRefs.current, nestSpriteRef.current);
      if (g.bannerTime > 0 && g.running) {
        ctx.fillStyle = "rgba(15,14,14,.8)"; ctx.fillRect(302, 70, 356, 54);
        ctx.strokeStyle = "#d79647"; ctx.strokeRect(302.5, 70.5, 355, 53);
        ctx.fillStyle = "#f0d2a3"; ctx.font = "bold 19px monospace"; ctx.textAlign = "center";
        ctx.fillText(g.banner, W / 2, 104); ctx.textAlign = "left";
      }
      if (now - lastHudRef.current > 100) {
        lastHudRef.current = now;
        const boss = g.fighters.find((fighter) => fighter.kind === "takuya" && fighter.hp > 0);
        setHud({
          energy: Math.floor(g.energy), rage: Math.floor(g.rage), scrap: g.scrap, kills: g.kills,
          wave: g.wave, phase: g.phase, baseHp: Math.max(0, g.baseHp), nestHp: Math.max(0, g.nestHp), nestUnlocked: g.nestUnlocked,
          strike: Math.ceil(g.strikeCooldown), combo: g.combo, bossHp: boss?.hp ?? 0, bossMax: boss?.maxHp ?? 0,
          objective: objectiveFor(g.phase, g.nestUnlocked), deployCooldowns: { ...g.deployCooldowns },
        });
      }
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [chooseAction, playEndJingle, stopMusic, syncMusicMode, tone]);

  const healthPct = Math.max(0, hud.baseHp / 520 * 100);
  const nestPct = Math.max(0, hud.nestHp / 620 * 100);
  const bossPct = hud.bossMax ? Math.max(0, hud.bossHp / hud.bossMax * 100) : 0;
  const phaseName = hud.phase === 1 ? "HOLD" : hud.phase === 2 ? "PUSH" : "ASSAULT";
  const selectedName = selectedAction ? supportDefs.find((support) => `support:${support.kind}` === selectedAction)?.name : null;

  return (
    <main className="game-shell">
      <section className="game-frame" aria-label="ASHFALL OUTPOST game">
        <canvas ref={canvasRef} width={W} height={H} className={`battlefield ${selectedAction ? "targeting" : ""}`} aria-label="Three-lane wasteland battlefield" onPointerDown={handleBattlefieldPointer} />

        <div className="top-hud">
          <div className="brand-block"><span className="brand-mark">A</span><div><b>ASHFALL</b><small>OUTPOST // 07 <em>EARLY ACCESS 0.3.0</em></small></div></div>
          <div className="phase-block"><small>PHASE {hud.phase}</small><strong>{phaseName}</strong><em>W{String(hud.wave).padStart(2, "0")}</em></div>
          <button className="icon-btn" onClick={togglePause} aria-label={paused ? "再開" : "一時停止"}>{paused ? "▶" : "Ⅱ"}</button>
          <button className={`icon-btn audio-btn ${musicActive ? "playing" : ""}`} data-playing={musicActive} onClick={toggleBgm} aria-label={bgmMuted ? "BGMを再生" : "BGMをミュート"}><b>{bgmMuted ? "×" : "♫"}</b><small>BGM</small></button>
          <button className="icon-btn audio-btn" onClick={toggleSfx} aria-label={sfxMuted ? "効果音を再生" : "効果音をミュート"}><b>{sfxMuted ? "×" : "FX"}</b><small>SFX</small></button>
        </div>

        <div className="health-hud crawler-health"><div><span>CRAWLER</span><b>{Math.ceil(hud.baseHp)} / 520</b></div><i><em style={{ width: `${healthPct}%` }} /></i></div>
        <div className={`health-hud nest-health ${hud.nestUnlocked ? "unlocked" : "locked"}`}><div><span>INFECTED NEST</span><b>{hud.nestUnlocked ? `${Math.ceil(hud.nestHp)} / 620` : "SEALED"}</b></div><i><em style={{ width: `${nestPct}%` }} /></i></div>
        {hud.bossMax > 0 && <div className="boss-hud"><div><span>BOSS // TAKUYA</span><b>IRON JUDGE</b></div><i><em style={{ width: `${bossPct}%` }} /></i></div>}

        {selectedAction && started && !paused && !end && (
          <div className="placement-hint"><b>{selectedName} SELECTED</b><span>TAP A TARGET POSITION</span><small>ESC TO CANCEL</small></div>
        )}

        <div className="bottom-hud">
          <div className="resource-stack">
            <div className="resource command"><span>COMMAND</span><strong>{hud.energy}</strong><small>/{COMMAND_MAX}</small><i><em style={{ width: `${hud.energy}%` }} /></i></div>
            <div className="resource rage"><span>RAGE</span><strong>{hud.rage}</strong><small>/{RAGE_MAX}</small><i><em style={{ width: `${hud.rage}%` }} /></i></div>
          </div>

          <div className="combat-deck">
            <div className="unit-cards" aria-label="Survivor units">
              {cards.map((card) => {
                const cooldown = Math.ceil(hud.deployCooldowns[card.kind] ?? 0);
                return (
                  <button key={card.kind} className="unit-card" data-kind={card.kind} disabled={!started || paused || hud.energy < card.cost || cooldown > 0 || !!end} onClick={() => deployHuman(card.kind)}>
                    <span className="keycap">{card.key}</span><span className="portrait"><i /></span>
                    <span className="card-copy"><b>{card.name}</b><small>{card.desc}</small></span><span className="cost">⚡{card.cost}</span>
                    {cooldown > 0 && <span className="cooldown-mask"><b>{cooldown}</b><small>SEC</small></span>}
                  </button>
                );
              })}
            </div>
            <div className="support-row" aria-label="Rage field support">
              <span className="support-label">FIELD<br />SUPPORT</span>
              {supportDefs.map((support) => {
                const selected = selectedAction === `support:${support.kind}`;
                const cooling = support.kind === "airstrike" && hud.strike > 0;
                return (
                  <button key={support.kind} className={`support-btn ${support.kind} ${selected ? "selected" : ""}`} disabled={!started || paused || hud.rage < support.cost || cooling || !!end} onClick={() => chooseAction(selected ? null : `support:${support.kind}`)}>
                    <span className="support-key">{support.key}</span><b>{cooling ? `${hud.strike}s` : support.name}</b><small>{cooling ? "RELOADING" : support.desc}</small><em>◆{support.cost}</em>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="stats-strip"><span>☠ {hud.kills} KILLS</span><span>▰ {hud.scrap} SCRAP</span>{hud.combo > 1 && <span className="combo">×{hud.combo} COMBO</span>}<span className="objective">OBJECTIVE: {hud.objective}</span></div>

        {!started && (
          <div className="start-screen"><div className="start-panel">
            <p className="eyebrow">{"/// EARLY ACCESS BUILD 0.3.0 · THREE-LANE WARFARE · DYNAMIC BGM"}</p>
            <h1>ASHFALL<br /><span>OUTPOST</span></h1>
            <p className="mission">Deploy from one muster point. Survivors hunt threats across all three lanes while the infected adapt their route toward the crawler.</p>
            <button className="start-btn" onClick={startGame}><span>BEGIN OPERATION</span><small>TAP A UNIT CARD · AUTO-DEPLOY</small></button>
            <p className="controls">1–6 DEPLOY · Z/X/C/Q SUPPORT · P PAUSE</p>
          </div></div>
        )}

        {paused && started && !end && <div className="pause-screen"><div><small>OPERATION SUSPENDED</small><h2>PAUSED</h2><button onClick={togglePause}>RESUME</button></div></div>}
        {end && <div className={`end-screen ${end}`}><div><p>{end === "win" ? "SECTOR SECURED" : "CRAWLER LOST"}</p><h2>{end === "win" ? "OUTPOST HELD" : "THE LINE BROKE"}</h2><span>{hud.kills} infected eliminated · {hud.scrap} scrap recovered</span><button onClick={startGame}>RUN IT AGAIN</button></div></div>}
      </section>
      <div className="rotate-notice"><span>↻</span><b>スマホを横向きにしてください</b><small>この作戦は横画面に最適化されています</small></div>
    </main>
  );
}
