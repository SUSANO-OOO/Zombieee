"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  BARRICADE_MAX_HP,
  COMMAND_MAX,
  CONTAINER_DEF,
  LANE_NAMES,
  LANE_Y,
  MISSION_EVENTS,
  PREP_SECONDS,
  RAGE_MAX,
  SUPPORT_DEFS,
  TACTIC_MODES,
  UNIT_CARDS,
  WORLD_GEOMETRY,
  advanceZombieX,
  advanceLimitFor,
  advanceCommand,
  autonomousTargetScore,
  barricadeState,
  battleOutcome,
  canDeploy,
  containerPlacementCheck,
  crawlerSiegeDamage,
  crawlerThreatLevel,
  applyContainerDamage,
  humanAttackMultiplier,
  interceptorTargetScore,
  isCrawlerRouteBlocker,
  laneForY,
  objectiveFor,
  phaseAt,
  rageReward,
  resolveContainerPlacement,
  resolveFieldSupportPlacement,
  roleTargetBias,
  scrapReward,
  selectBlockingContainer,
  structureDamageMultiplier,
  tacticTargetBias,
} from "./gameRules.js";

const W = 960;
const H = 540;

type Lane = 0 | 1 | 2;
type UnitKind = "scout" | "ranger" | "brute" | "brawler" | "gunner" | "medic";
type SupportKind = "barrel" | "medkit" | "molotov" | "airstrike";
type SupplyKind = "container";
type MusicMode = "normal" | "danger" | "boss";
type TacticMode = "defend" | "balanced" | "assault";
type SelectedAction = `support:${SupportKind}` | `supply:${SupplyKind}` | null;

const BASE_X = WORLD_GEOMETRY.baseX;
const BARRICADE_X = WORLD_GEOMETRY.barricade.attackX;
const MUSTER_X = WORLD_GEOMETRY.musterX;
const MUSTER_Y = WORLD_GEOMETRY.musterY;
const MUSTER_LANE = laneForY(MUSTER_Y, 2, 0) as Lane;
const LANE_NAMES_JA = ["上", "中央", "下"] as const;

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
  targetObjectId: number | null;
  retargetIn: number;
  bodyRadius: number;
  laneSpeed: number;
  spawnGrace: number;
  marked: number;
  abilityCooldown: number;
  abilityWindup: number;
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
type BattlefieldObjectPhase = "dropping" | "active" | "destroying" | "expired";
type BattlefieldObject = {
  id: number;
  kind: SupplyKind;
  lane: Lane;
  x: number;
  y: number;
  phase: BattlefieldObjectPhase;
  phaseTime: number;
  hp: number;
  maxHp: number;
  blocksEnemies: boolean;
  targetable: boolean;
  hitFlash: number;
};
type PlacementIndicator = { lane: Lane; x: number; y: number; valid: boolean; reason: string };

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
  barricadeHp: number;
  barricadeVulnerable: boolean;
  barricadeHitFlash: number;
  barricadeHitY: number;
  barricadeBucklingAnnounced: boolean;
  barricadeCriticalAnnounced: boolean;
  fighters: Fighter[];
  particles: Particle[];
  shots: Shot[];
  damageTexts: DamageText[];
  corpses: Corpse[];
  supports: FieldSupport[];
  battlefieldObjects: BattlefieldObject[];
  placementIndicator: PlacementIndicator | null;
  deployCooldowns: Record<UnitKind, number>;
  deployQueue: UnitKind[];
  deployTimer: number;
  tactic: TacticMode;
  nextId: number;
  shake: number;
  strikeCooldown: number;
  banner: string;
  bannerTime: number;
  flashOverlay: number;
  combo: number;
  comboTime: number;
  maxCombo: number;
  unitsLost: number;
  crawlerHitFlash: number;
  crawlerHitSfxCooldown: number;
  criticalAnnounced: boolean;
};

type Hud = {
  energy: number;
  rage: number;
  scrap: number;
  kills: number;
  wave: number;
  phase: 1 | 2 | 3;
  baseHp: number;
  barricadeHp: number;
  barricadeVulnerable: boolean;
  barricadeHitFlash: number;
  tactic: TacticMode;
  deployQueue: number;
  strike: number;
  combo: number;
  bossHp: number;
  bossMax: number;
  crawlerHitFlash: number;
  threat: number;
  objective: string;
  deployCooldowns: Record<UnitKind, number>;
};

type BattleResult = {
  won: boolean;
  time: number;
  wave: number;
  kills: number;
  scrap: number;
  baseHp: number;
  maxCombo: number;
  unitsLost: number;
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
  energy: 70,
  rage: 0,
  scrap: 0,
  kills: 0,
  wave: 1,
  phase: 1,
  eventIndex: 0,
  baseHp: 520,
  barricadeHp: BARRICADE_MAX_HP,
  barricadeVulnerable: false,
  barricadeHitFlash: 0,
  barricadeHitY: LANE_Y[1],
  barricadeBucklingAnnounced: false,
  barricadeCriticalAnnounced: false,
  fighters: [],
  particles: [],
  shots: [],
  damageTexts: [],
  corpses: [],
  supports: [],
  battlefieldObjects: [],
  placementIndicator: null,
  deployCooldowns: emptyCooldowns(),
  deployQueue: [],
  deployTimer: 0,
  tactic: "balanced",
  nextId: 1,
  shake: 0,
  strikeCooldown: 0,
  banner: `DEPLOYMENT WINDOW // ${PREP_SECONDS}`,
  bannerTime: .2,
  flashOverlay: 0,
  combo: 0,
  comboTime: 0,
  maxCombo: 0,
  unitsLost: 0,
  crawlerHitFlash: 0,
  crawlerHitSfxCooldown: 0,
  criticalAnnounced: false,
});

function formatMissionTime(seconds: number) {
  const whole = Math.max(0, Math.floor(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

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
    x: kind === "turned" ? 0 : Math.min(WORLD_GEOMETRY.barricade.enemySpawnMaxX, WORLD_GEOMETRY.barricade.enemySpawnMinX + order * 16),
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
    targetObjectId: null,
    retargetIn: 0,
    bodyRadius: bodyRadiusFor(kind),
    laneSpeed: enemyLaneSpeedFor(kind),
    spawnGrace: 0,
    marked: 0,
    abilityCooldown: kind === "takuya" ? 4.2 : 0,
    abilityWindup: 0,
  });
  return g.fighters[g.fighters.length - 1];
}

function spawnHuman(g: Game, kind: UnitKind) {
  const card = cards.find((item) => item.kind === kind);
  if (!card) return null;
  const id = g.nextId++;
  const laneSpeed = kind === "scout" ? 78 : kind === "brawler" ? 68 : kind === "brute" ? 42 : kind === "gunner" ? 54 : 60;
  g.fighters.push({
    id, side: "human", kind, lane: MUSTER_LANE, anchorLane: null, x: MUSTER_X, y: MUSTER_Y, hp: card.hp, maxHp: card.hp,
    speed: card.speed, damage: card.damage, range: card.range, cooldown: 0, supportCooldown: 0,
    attackEvery: card.attackEvery, flash: 0, step: Math.random() * 4, attack: 0, knock: 0, variant: id % 3,
    targetId: null, targetObjectId: null, retargetIn: 0, bodyRadius: bodyRadiusFor(kind), laneSpeed, spawnGrace: .95,
    marked: 0, abilityCooldown: 0, abilityWindup: 0,
  });
  addParticles(g, MUSTER_X, MUSTER_Y, "#d0b48b", 7);
  g.banner = `${card.name} // CRAWLER DEPLOYED`;
  g.bannerTime = .8;
  return card;
}

function prepareEndgameQa(g: Game) {
  g.time = 148;
  g.phase = 3;
  g.wave = 8;
  g.eventIndex = missionEvents.length;
  g.baseHp = 500;
  g.barricadeHp = 240;
  g.energy = COMMAND_MAX;
  g.tactic = "assault";

  const lineup: [UnitKind, Lane, number][] = [
    ["brute", 0, 730],
    ["gunner", 1, 690],
    ["brawler", 2, 730],
  ];
  for (const [kind, lane, x] of lineup) {
    spawnHuman(g, kind);
    const fighter = g.fighters[g.fighters.length - 1];
    fighter.lane = lane;
    fighter.x = x;
    fighter.y = laneY(lane, fighter.id);
    fighter.cooldown = 2.2;
    fighter.spawnGrace = 0;
  }

  const takuya = spawnEnemy(g, "takuya", 1);
  takuya.hp = 35;
  takuya.x = 720;
  takuya.y = laneY(1, takuya.id);
  takuya.cooldown = 4;
  takuya.abilityCooldown = 99;
  g.banner = "QA ENDGAME // TAKUYA ACTIVE";
  g.bannerTime = 2.2;

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
  const sprite = sprites[f.side === "human" ? f.kind : enemySheet] ?? (f.side === "zombie" ? sprites.infected : undefined);
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
  if (f.side === "human" && f.spawnGrace > 0) {
    ctx.beginPath();
    ctx.rect(WORLD_GEOMETRY.crawler.exitX - 2, 0, W - WORLD_GEOMETRY.crawler.exitX + 2, H);
    ctx.clip();
  }
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

function drawContainer(ctx: CanvasRenderingContext2D, object: BattlefieldObject) {
  const dropOffset = object.phase === "dropping" ? Math.max(0, object.phaseTime / .45) * 86 : 0;
  const destroyRatio = object.phase === "destroying" ? Math.max(0, object.phaseTime / .42) : 1;
  const drawY = object.y - dropOffset;
  ctx.save();
  ctx.globalAlpha = object.phase === "destroying" ? destroyRatio : 1;
  ctx.fillStyle = "rgba(0,0,0,.42)";
  ctx.beginPath(); ctx.ellipse(object.x, object.y + 8, 35 + dropOffset * .08, 7, 0, 0, Math.PI * 2); ctx.fill();
  ctx.translate(object.x, drawY);
  if (object.phase === "destroying") ctx.scale(.78 + destroyRatio * .22, .58 + destroyRatio * .42);
  if (object.hitFlash > 0) { ctx.shadowColor = "#fff0a4"; ctx.shadowBlur = 14; }
  ctx.fillStyle = "#263b3d"; ctx.fillRect(-33, -38, 66, 43);
  ctx.fillStyle = "#3f5f5f"; ctx.fillRect(-29, -34, 58, 35);
  ctx.strokeStyle = "#8da49b"; ctx.lineWidth = 2; ctx.strokeRect(-29, -34, 58, 35);
  ctx.strokeStyle = "#1d2d2e"; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(-25, -31); ctx.lineTo(25, -2); ctx.moveTo(25, -31); ctx.lineTo(-25, -2); ctx.stroke();
  ctx.fillStyle = "#d19b4d"; ctx.fillRect(-32, -21, 64, 7);
  ctx.fillStyle = "#172324"; ctx.font = "900 11px monospace"; ctx.textAlign = "center"; ctx.fillText("CRAWLER", 0, -11);
  ctx.shadowBlur = 0;
  if (object.phase === "active") {
    ctx.fillStyle = "rgba(0,0,0,.68)"; ctx.fillRect(-32, -48, 64, 6);
    ctx.fillStyle = object.hp / object.maxHp <= .3 ? "#ef6448" : "#70c59d";
    ctx.fillRect(-31, -47, 62 * Math.max(0, object.hp / object.maxHp), 4);
  }
  ctx.restore();
}

function drawPlacementIndicator(ctx: CanvasRenderingContext2D, indicator: PlacementIndicator | null) {
  if (!indicator) return;
  ctx.save();
  ctx.translate(indicator.x, indicator.y);
  ctx.strokeStyle = indicator.valid ? "#71d8aa" : "#ef6448";
  ctx.fillStyle = indicator.valid ? "rgba(74,180,135,.18)" : "rgba(221,73,52,.2)";
  ctx.lineWidth = 3; ctx.setLineDash([8, 5]);
  ctx.beginPath(); ctx.ellipse(0, 4, 43, 20, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.setLineDash([]); ctx.globalAlpha = .68;
  ctx.fillRect(-31, -35, 62, 38);
  ctx.globalAlpha = 1; ctx.fillStyle = indicator.valid ? "#a7f0cf" : "#ff9a82";
  ctx.font = "900 12px monospace"; ctx.textAlign = "center";
  ctx.fillText(indicator.reason, 0, -47);
  ctx.restore();
}

function drawCrawler(ctx: CanvasRenderingContext2D, g: Game, sprites: SpriteMap) {
  const crawlerSprite = sprites.crawler;
  const crawler = WORLD_GEOMETRY.crawler;
  const deploymentGlow = g.fighters.reduce((glow, fighter) => fighter.side === "human" ? Math.max(glow, fighter.spawnGrace) : glow, 0);
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,.48)";
  ctx.beginPath();
  ctx.ellipse(crawler.x + crawler.width * .5, crawler.y + crawler.height * .92, crawler.width * .45, 12, 0, 0, Math.PI * 2);
  ctx.fill();
  if (g.baseHp <= 260) {
    for (let i = 0; i < 4; i++) {
      const smokeY = crawler.y + 26 - ((g.time * 18 + i * 13) % 48);
      ctx.globalAlpha = .12 + i * .035;
      ctx.fillStyle = "#1b1c1b";
      ctx.beginPath();
      ctx.arc(crawler.x + crawler.width * .46 + Math.sin(g.time * 2 + i) * 7, smokeY, 9 + i * 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
  if (crawlerSprite?.complete && crawlerSprite.naturalWidth) {
    ctx.globalAlpha = .92 + Math.max(0, g.baseHp / 520) * .08;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(crawlerSprite, crawler.x, crawler.y, crawler.width, crawler.height);
  } else {
    ctx.fillStyle = "#5d3329";
    ctx.fillRect(crawler.x + 18, crawler.y + 45, crawler.width - 36, crawler.height - 50);
  }
  if (deploymentGlow > 0) {
    ctx.globalAlpha = Math.min(.92, .38 + deploymentGlow * .58);
    ctx.fillStyle = "#14120f";
    ctx.fillRect(crawler.exitX - 21, MUSTER_Y - 79, 22, 76);
    const glow = ctx.createRadialGradient(crawler.exitX - 3, MUSTER_Y - 34, 2, crawler.exitX - 3, MUSTER_Y - 34, 42);
    glow.addColorStop(0, `rgba(255,205,112,${Math.min(.48, deploymentGlow * .56)})`);
    glow.addColorStop(1, "rgba(221,103,47,0)");
    ctx.globalAlpha = 1;
    ctx.fillStyle = glow;
    ctx.fillRect(crawler.exitX - 45, MUSTER_Y - 86, 90, 92);
    ctx.fillStyle = `rgba(242,178,82,${Math.min(.72, deploymentGlow * .76)})`;
    ctx.fillRect(crawler.exitX - 5, MUSTER_Y - 69, 4, 66);
  }
  ctx.restore();
}

function drawCrawlerExitFrame(ctx: CanvasRenderingContext2D, g: Game) {
  const deploymentGlow = g.fighters.reduce((glow, fighter) => fighter.side === "human" ? Math.max(glow, fighter.spawnGrace) : glow, 0);
  if (deploymentGlow <= 0) return;
  const exitX = WORLD_GEOMETRY.crawler.exitX;
  ctx.save();
  ctx.globalAlpha = Math.min(1, .35 + deploymentGlow);
  ctx.fillStyle = "#281d16";
  ctx.fillRect(exitX - 2, MUSTER_Y - 80, 4, 78);
  ctx.fillStyle = "rgba(242,178,82,.72)";
  ctx.fillRect(exitX, MUSTER_Y - 69, 2, 66);
  ctx.restore();
}

function drawBarricade(ctx: CanvasRenderingContext2D, g: Game, barricadeSprite: HTMLImageElement | null) {
  const barrier = WORLD_GEOMETRY.barricade;
  const ratio = Math.max(0, g.barricadeHp / BARRICADE_MAX_HP);
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,.42)";
  ctx.beginPath();
  ctx.ellipse(barrier.drawX + barrier.width * .55, barrier.drawY + barrier.height - 5, barrier.width * .5, 12, 0, 0, Math.PI * 2);
  ctx.fill();
  if (barricadeSprite?.complete && barricadeSprite.naturalWidth) {
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    if (g.barricadeHitFlash > 0) {
      ctx.shadowColor = "rgba(255,144,65,.9)";
      ctx.shadowBlur = 12 + g.barricadeHitFlash * 24;
    }
    ctx.globalAlpha = .94 + ratio * .06;
    ctx.drawImage(barricadeSprite, barrier.drawX, barrier.drawY, barrier.width, barrier.height);
  }
  ctx.shadowBlur = 0;
  ctx.globalAlpha = 1;
  if (!g.barricadeVulnerable) {
    const shield = ctx.createLinearGradient(barrier.drawX, 0, barrier.drawX + 36, 0);
    shield.addColorStop(0, "rgba(103,198,220,.28)");
    shield.addColorStop(1, "rgba(103,198,220,0)");
    ctx.fillStyle = shield;
    ctx.fillRect(barrier.drawX - 4, barrier.drawY + 42, 52, barrier.height - 58);
    ctx.strokeStyle = `rgba(122,220,238,${.3 + Math.sin(g.time * 5) * .1})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(barrier.drawX + 3, barrier.drawY + 40);
    ctx.lineTo(barrier.drawX + 3, barrier.drawY + barrier.height - 12);
    ctx.stroke();
  }
  if (ratio <= .7) {
    const damageLevel = ratio <= .35 ? 2 : 1;
    for (let i = 0; i < 2 + damageLevel; i++) {
      const y = LANE_Y[i % 3] - 22 - ((g.time * (12 + i * 2) + i * 19) % 38);
      ctx.globalAlpha = .12 + damageLevel * .04;
      ctx.fillStyle = "#191716";
      ctx.beginPath();
      ctx.arc(barrier.drawX + 34 + (i % 2) * 22, y, 8 + i * 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  if (g.barricadeHitFlash > 0) {
    const glow = ctx.createRadialGradient(barrier.drawX + 10, g.barricadeHitY - 18, 4, barrier.drawX + 10, g.barricadeHitY - 18, 52);
    glow.addColorStop(0, `rgba(255,213,108,${Math.min(.75, g.barricadeHitFlash * 3)})`);
    glow.addColorStop(1, "rgba(218,67,32,0)");
    ctx.globalAlpha = 1;
    ctx.fillStyle = glow;
    ctx.fillRect(barrier.drawX - 48, g.barricadeHitY - 76, 110, 116);
  }
  ctx.restore();
}

function drawWorld(ctx: CanvasRenderingContext2D, g: Game, background: HTMLImageElement | null, sprites: SpriteMap, barricadeSprite: HTMLImageElement | null) {
  const sx = g.shake > 0 ? (Math.random() - .5) * g.shake : 0;
  const sy = g.shake > 0 ? (Math.random() - .5) * g.shake : 0;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.restore();
  if (background?.complete) {
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(background, 0, 0, W, H);
    ctx.restore();
  }
  ctx.save();
  ctx.translate(sx, sy);
  const grade = ctx.createLinearGradient(0, 0, W, 0);
  grade.addColorStop(0, "rgba(23,28,31,.18)"); grade.addColorStop(.55, "rgba(15,13,12,.04)"); grade.addColorStop(1, "rgba(58,18,12,.2)");
  ctx.fillStyle = grade; ctx.fillRect(0, 0, W, H);

  // Units reveal the three routes through movement; no lane-map overlay is drawn over the battlefield.

  // The Crawler stays behind combatants; only its doorway masks a unit during deployment.
  drawCrawler(ctx, g, sprites);

  // A single shared-HP barricade physically closes all three routes.
  drawBarricade(ctx, g, barricadeSprite);

  for (const support of [...g.supports].sort((a, b) => a.y - b.y)) drawSupport(ctx, support, g.time);
  drawPlacementIndicator(ctx, g.placementIndicator);

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

  const renderables = [
    ...g.fighters.map((fighter) => ({ type: "fighter" as const, x: fighter.x, y: fighter.y, fighter })),
    ...g.battlefieldObjects.filter((object) => object.phase !== "expired").map((object) => ({ type: "object" as const, x: object.x, y: object.y, object })),
  ].sort((a, b) => a.y - b.y || a.x - b.x);
  for (const renderable of renderables) {
    if (renderable.type === "object") { drawContainer(ctx, renderable.object); continue; }
    const f = renderable.fighter;
    if (f.kind === "takuya" && f.abilityWindup > 0) {
      const slamRadius = f.hp / f.maxHp <= .5 ? 145 : 118;
      const pulse = slamRadius + Math.sin(g.time * 18) * 4;
      ctx.strokeStyle = `rgba(255,94,56,${.55 + Math.sin(g.time * 14) * .18})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(f.x, f.y + 2, pulse, pulse / 2, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    drawSpriteFighter(ctx, f, sprites);
    const barW = f.kind === "takuya" ? 52 : f.kind === "crusher" || f.kind === "brute" ? 38 : f.kind === "abomination" ? 52 : 28;
    const height = f.kind === "takuya" ? 111 : f.kind === "abomination" ? 115 : f.kind === "crusher" || f.kind === "brute" ? 94 : 80;
    const barY = f.y - height;
    ctx.fillStyle = "rgba(0,0,0,.58)"; ctx.fillRect(f.x - barW / 2, barY, barW, 4);
    ctx.fillStyle = f.side === "human" ? "#e9c65a" : "#cb5037";
    ctx.fillRect(f.x - barW / 2, barY, barW * Math.max(0, f.hp / f.maxHp), 4);
    if (f.side === "zombie" && f.marked > 0) {
      ctx.save();
      ctx.translate(f.x, barY - 10);
      ctx.rotate(Math.PI / 4);
      ctx.strokeStyle = `rgba(255,210,85,${Math.min(1, .45 + f.marked * .18)})`;
      ctx.lineWidth = 2;
      ctx.strokeRect(-5, -5, 10, 10);
      ctx.restore();
    }
  }

  drawCrawlerExitFrame(ctx, g);

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

  const nearestEnemyX = g.fighters.reduce((nearest, fighter) => fighter.side === "zombie" && fighter.hp > 0 ? Math.min(nearest, fighter.x) : nearest, Infinity);
  const threat = crawlerThreatLevel(nearestEnemyX);
  if (threat > 0 || g.crawlerHitFlash > 0) {
    ctx.save();
    const danger = ctx.createLinearGradient(0, 0, W * .38, 0);
    danger.addColorStop(0, `rgba(155,31,22,${.08 + threat * .2})`);
    danger.addColorStop(1, "rgba(155,31,22,0)");
    ctx.fillStyle = danger; ctx.fillRect(0, 0, W * .38, H);
    if (g.crawlerHitFlash > 0) {
      const hitGlow = ctx.createRadialGradient(112, 345, 6, 112, 345, 118);
      hitGlow.addColorStop(0, `rgba(255,126,69,${Math.min(.5, g.crawlerHitFlash * 2.8)})`);
      hitGlow.addColorStop(1, "rgba(178,35,22,0)");
      ctx.fillStyle = hitGlow; ctx.fillRect(0, 220, 250, 220);
    }
    ctx.restore();
  }
}

export function AshfallGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const backgroundRef = useRef<HTMLImageElement | null>(null);
  const spriteRefs = useRef<SpriteMap>({});
  const barricadeSpriteRef = useRef<HTMLImageElement | null>(null);
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
  const [assetsReady, setAssetsReady] = useState(false);
  const [assetError, setAssetError] = useState(false);
  const [qaEndgame, setQaEndgame] = useState(false);
  const [selectedAction, setSelectedAction] = useState<SelectedAction>(null);
  const [hud, setHud] = useState<Hud>({
    energy: 70, rage: 0, scrap: 0, kills: 0, wave: 1, phase: 1, baseHp: 520,
    barricadeHp: BARRICADE_MAX_HP, barricadeVulnerable: false, barricadeHitFlash: 0,
    tactic: "balanced", deployQueue: 0, strike: 0, combo: 0, bossHp: 0, bossMax: 0,
    crawlerHitFlash: 0, threat: 0,
    objective: objectiveFor(1, false), deployCooldowns: emptyCooldowns(),
  });
  const [end, setEnd] = useState<BattleResult | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const localHost = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
      setQaEndgame(localHost && new URLSearchParams(window.location.search).get("qa") === "endgame");
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const chooseAction = useCallback((action: SelectedAction) => {
    selectedActionRef.current = action;
    gameRef.current.placementIndicator = null;
    setSelectedAction(action);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadImage = (src: string, onReady: (image: HTMLImageElement) => void) => new Promise<void>((resolve, reject) => {
      const image = new Image();
      image.decoding = "async";
      image.onload = () => {
        const finish = () => {
          if (!image.naturalWidth) { reject(new Error(`Image unavailable: ${src}`)); return; }
          if (!cancelled) onReady(image);
          resolve();
        };
        if (typeof image.decode === "function") void image.decode().catch(() => undefined).finally(finish);
        else finish();
      };
      image.onerror = () => reject(new Error(`Image unavailable: ${src}`));
      image.src = src;
    });
    const criticalPaths: Record<string, string> = {
      scout: "/scout-sprites-v2.png", ranger: "/ranger-sprites-v1.png", brute: "/breaker-sprites-v2.png",
      brawler: "/brawler-sprites-v1.png", gunner: "/gunner-sprites-v1.png", medic: "/medic-sprites-v1.png",
      infected: "/infected-sprites-v1.png", crawler: "/crawler-bus-v1.png",
    };
    const criticalJobs = [
      loadImage("/battlefield-v4.png", (image) => { backgroundRef.current = image; }),
      loadImage("/iron-barricade-v1.png", (image) => { barricadeSpriteRef.current = image; }),
      ...Object.entries(criticalPaths).map(([key, src]) => loadImage(src, (image) => { spriteRefs.current[key] = image; })),
    ];
    void Promise.all(criticalJobs).then(() => {
      if (cancelled) return;
      setAssetsReady(true);
      const laterPaths: Record<string, string> = {
        crusher: "/crusher-sprites-v1.png", spitter: "/spitter-sprites-v1.png",
        takuya: "/takuya-boss-sprites-v2.png", shade: "/shade-raider-sprites-v1.png",
      };
      for (const [key, src] of Object.entries(laterPaths)) {
        void loadImage(src, (image) => { spriteRefs.current[key] = image; }).catch(() => undefined);
      }
    }).catch(() => { if (!cancelled) setAssetError(true); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const configureCanvas = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const dpr = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
      const rect = canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const pixelWidth = Math.max(1, Math.round(rect.width * dpr));
      const pixelHeight = Math.max(1, Math.round(rect.height * dpr));
      if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
        canvas.width = pixelWidth;
        canvas.height = pixelHeight;
      }
      canvas.dataset.dpr = String(dpr);
      const ctx = canvas.getContext("2d");
      ctx?.setTransform(pixelWidth / W, 0, 0, pixelHeight / H, 0, 0);
    };
    configureCanvas();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(configureCanvas);
    if (canvasRef.current) observer?.observe(canvasRef.current);
    window.addEventListener("resize", configureCanvas);
    return () => { observer?.disconnect(); window.removeEventListener("resize", configureCanvas); };
  }, []);

  const ensureAudio = useCallback(() => {
    const AudioCtx = window.AudioContext || (window as typeof window & { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!audioRef.current || audioRef.current.state === "closed") audioRef.current = new AudioCtx();
    return audioRef.current;
  }, []);

  const tone = useCallback((freq: number, duration = .06, type: OscillatorType = "square", volume = .055) => {
    if (sfxMuted) return;
    try {
      const audio = ensureAudio();
      if (audio.state !== "running") void audio.resume().catch(() => undefined);
      const oscillator = audio.createOscillator(); const gain = audio.createGain();
      oscillator.type = type; oscillator.frequency.value = freq;
      gain.gain.setValueAtTime(volume, audio.currentTime);
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
    if (!card || g.deployQueue.length >= 3 || !canDeploy({ running: g.running, paused: g.paused, over: g.over, command: g.energy, cost: card.cost, cooldown: g.deployCooldowns[kind] })) {
      tone(105, .1, "sawtooth");
      if (g.deployQueue.length >= 3) { g.banner = "CRAWLER BAY FULL // 3"; g.bannerTime = .9; }
      return false;
    }
    g.energy -= card.cost;
    g.deployCooldowns[kind] = card.deployCooldown;
    g.deployQueue.push(kind);
    if (g.deployQueue.length === 1 && g.deployTimer <= 0) g.deployTimer = .04;
    g.banner = `${card.name} // BAY QUEUED ${g.deployQueue.length}/3`;
    g.bannerTime = .7;
    tone(170, .05, "square");
    return true;
  }, [tone]);

  const placeContainer = useCallback((lane: Lane, x: number) => {
    const g = gameRef.current;
    const result = resolveContainerPlacement({
      running: g.running, paused: g.paused, over: g.over, scrap: g.scrap, lane, x,
      objects: g.battlefieldObjects, fighters: g.fighters, supports: g.supports, nextId: g.nextId,
    });
    g.placementIndicator = { lane, x, y: laneY(lane), valid: result.ok, reason: result.reason };
    if (!result.ok) {
      g.banner = `配置不可 // ${result.reason}`; g.bannerTime = 1.15; tone(105, .1, "sawtooth");
      return false;
    }
    g.scrap = result.scrap;
    g.battlefieldObjects = result.objects as BattlefieldObject[];
    g.nextId = result.nextId;
    g.banner = `防護コンテナ投下 // ${LANE_NAMES_JA[lane]}レーン`;
    g.bannerTime = 1.2; g.shake = Math.max(g.shake, 4); tone(118, .11, "square");
    return true;
  }, [tone]);

  const deploySupport = useCallback((kind: SupportKind, lane: Lane, x: number) => {
    const g = gameRef.current;
    const def = supportDefs.find((item) => item.kind === kind);
    if (!def) {
      tone(105, .1, "sawtooth");
      return false;
    }
    const result = resolveFieldSupportPlacement({
      running: g.running, paused: g.paused, over: g.over, rage: g.rage, cost: def.cost, kind, lane, x,
      strikeCooldown: g.strikeCooldown, supports: g.supports, containers: g.battlefieldObjects,
    });
    if (!result.ok) {
      g.banner = `配置不可 // ${result.reason}`; g.bannerTime = 1.15; tone(105, .1, "sawtooth"); return false;
    }
    g.rage = result.rage;
    if (kind === "airstrike") g.strikeCooldown = 8;
    const life = kind === "barrel" ? 12 : kind === "medkit" ? 8 : kind === "molotov" ? 6 : .85;
    g.supports.push({ id: g.nextId++, kind, lane, x: result.x, y: laneY(lane), life, tick: 0, triggered: false });
    g.banner = `${def.name} // ${LANE_NAMES[lane]} LANE`;
    g.bannerTime = 1;
    tone(kind === "airstrike" ? 68 : 160, kind === "airstrike" ? .35 : .08, kind === "airstrike" ? "sawtooth" : "square");
    return true;
  }, [tone]);

  const executeSelected = useCallback((lane: Lane, x: number) => {
    const action = selectedActionRef.current;
    if (!action) return;
    if (action === "supply:container") {
      if (placeContainer(lane, x)) chooseAction(null);
      return;
    }
    const [, kind] = action.split(":") as ["support", SupportKind];
    const succeeded = deploySupport(kind, lane, x);
    if (succeeded) chooseAction(null);
  }, [chooseAction, deploySupport, placeContainer]);

  const pointerWorldPosition = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - rect.left) * W / rect.width;
    const y = (event.clientY - rect.top) * H / rect.height;
    let lane: Lane = 0;
    if (Math.abs(y - LANE_Y[1]) < Math.abs(y - LANE_Y[lane])) lane = 1;
    if (Math.abs(y - LANE_Y[2]) < Math.abs(y - LANE_Y[lane])) lane = 2;
    return { x, lane };
  }, []);

  const handleBattlefieldPointerMove = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    if (selectedActionRef.current !== "supply:container") return;
    const { x, lane } = pointerWorldPosition(event);
    const g = gameRef.current;
    const check = containerPlacementCheck({
      running: g.running, paused: g.paused, over: g.over, scrap: g.scrap, lane, x,
      objects: g.battlefieldObjects, fighters: g.fighters, supports: g.supports,
    });
    g.placementIndicator = { lane, x, y: laneY(lane), valid: check.ok, reason: check.reason };
  }, [pointerWorldPosition]);

  const handleBattlefieldPointer = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!selectedActionRef.current) return;
    const { x, lane } = pointerWorldPosition(event);
    executeSelected(lane, x);
  }, [executeSelected, pointerWorldPosition]);

  const startGame = useCallback(() => {
    const fresh = initialGame();
    fresh.running = true;
    if (qaEndgame) prepareEndgameQa(fresh);
    gameRef.current = fresh;
    const boss = fresh.fighters.find((fighter) => fighter.kind === "takuya" && fighter.hp > 0);
    desiredMusicModeRef.current = "normal";
    setStarted(true); setPaused(false); setEnd(null); chooseAction(null);
    setHud({ energy: Math.floor(fresh.energy), rage: Math.floor(fresh.rage), scrap: fresh.scrap, kills: fresh.kills,
      wave: fresh.wave, phase: fresh.phase, baseHp: fresh.baseHp,
      barricadeHp: fresh.barricadeHp, barricadeVulnerable: fresh.barricadeVulnerable, barricadeHitFlash: 0,
      tactic: fresh.tactic, deployQueue: fresh.deployQueue.length, strike: 0, combo: 0,
      bossHp: boss?.hp ?? 0, bossMax: boss?.maxHp ?? 0,
      crawlerHitFlash: 0, threat: 0, objective: objectiveFor(fresh.phase, fresh.barricadeVulnerable),
      deployCooldowns: { ...fresh.deployCooldowns } });
    stopMusic(); stopJingle(); if (!bgmMuted) startMusic();
    tone(180, .12); window.setTimeout(() => tone(260, .12), 90);
  }, [bgmMuted, chooseAction, qaEndgame, startMusic, stopJingle, stopMusic, tone]);

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

  const setTactic = useCallback((tactic: TacticMode) => {
    const g = gameRef.current;
    if (!g.running || g.paused || g.over || g.tactic === tactic) return;
    g.tactic = tactic;
    g.banner = `TACTIC // ${tactic.toUpperCase()}`;
    g.bannerTime = .9;
    setHud((current) => ({ ...current, tactic }));
    tone(tactic === "defend" ? 130 : tactic === "assault" ? 250 : 190, .06, "square");
  }, [tone]);

  const cycleTactic = useCallback(() => {
    const current = gameRef.current.tactic;
    const modes = TACTIC_MODES as TacticMode[];
    setTactic(modes[(modes.indexOf(current) + 1) % modes.length]);
  }, [setTactic]);

  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      const card = cards.find((item) => item.key === event.key);
      if (card) deployHuman(card.kind);
      const support = supportDefs.find((item) => item.key.toLowerCase() === event.key.toLowerCase());
      if (support) chooseAction(`support:${support.kind}`);
      if (event.key.toLowerCase() === "v") chooseAction(selectedActionRef.current === "supply:container" ? null : "supply:container");
      if (event.key === "Escape") {
        if (selectedActionRef.current) chooseAction(null); else togglePause();
      }
      if (event.key.toLowerCase() === "p") togglePause();
      if (event.key.toLowerCase() === "r") cycleTactic();
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [chooseAction, cycleTactic, deployHuman, togglePause]);

  useEffect(() => {
    let frame = 0;
    const loop = (now: number) => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      const g = gameRef.current;
      if (!ctx) { frame = requestAnimationFrame(loop); return; }
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      const dt = Math.min(.033, g.last ? (now - g.last) / 1000 : 0);
      g.last = now;

      if (g.running && !g.paused && !g.over) {
        g.time += dt;
        g.energy = advanceCommand(g.energy, dt);
        g.strikeCooldown = Math.max(0, g.strikeCooldown - dt);
        g.bannerTime = Math.max(0, g.bannerTime - dt);
        g.shake = Math.max(0, g.shake - dt * 38);
        g.flashOverlay = Math.max(0, g.flashOverlay - dt * 2.2);
        g.crawlerHitFlash = Math.max(0, g.crawlerHitFlash - dt);
        g.barricadeHitFlash = Math.max(0, g.barricadeHitFlash - dt);
        g.crawlerHitSfxCooldown = Math.max(0, g.crawlerHitSfxCooldown - dt);
        g.comboTime = Math.max(0, g.comboTime - dt);
        if (g.comboTime <= 0) g.combo = 0;
        for (const card of cards) g.deployCooldowns[card.kind] = Math.max(0, g.deployCooldowns[card.kind] - dt);
        g.deployTimer = Math.max(0, g.deployTimer - dt);
        if (g.deployQueue.length && g.deployTimer <= 0) {
          const kind = g.deployQueue.shift();
          if (kind) {
            const deployed = spawnHuman(g, kind);
            g.deployTimer = .45;
            if (deployed) tone(kind === "brute" ? 110 : 220, .07);
          }
        }
        if (g.time < PREP_SECONDS && g.bannerTime <= .05) {
          g.banner = `DEPLOYMENT WINDOW // ${Math.max(1, Math.ceil(PREP_SECONDS - g.time))}`;
          g.bannerTime = .22;
        }

        const nextPhase = phaseAt(g.time) as Game["phase"];
        if (nextPhase !== g.phase) {
          g.phase = nextPhase;
          g.banner = nextPhase === 2 ? "PHASE II — PUSH THE IRON LINE" : "PHASE III — IRON JUDGE";
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

        for (const object of g.battlefieldObjects) {
          object.hitFlash = Math.max(0, object.hitFlash - dt);
          if (object.phase === "dropping") {
            object.phaseTime = Math.max(0, object.phaseTime - dt);
            if (object.phaseTime <= 0) {
              object.phase = "active";
              addParticles(g, object.x, object.y + 4, "#b49a71", 12);
              g.shake = Math.max(g.shake, 5);
            }
          } else if (object.phase === "destroying") {
            object.phaseTime = Math.max(0, object.phaseTime - dt);
            if (object.phaseTime <= 0) object.phase = "expired";
          }
        }
        g.battlefieldObjects = g.battlefieldObjects.filter((object) => object.phase !== "expired");

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
          f.flash = Math.max(0, f.flash - dt); f.attack = Math.max(0, f.attack - dt); f.marked = Math.max(0, f.marked - dt); f.step += dt;
          f.abilityCooldown = Math.max(0, f.abilityCooldown - dt);
          if (Math.abs(f.knock) > .1) { f.x += (f.side === "human" ? -1 : 1) * f.knock * dt * 6; f.knock *= .9; }

          if (f.kind === "takuya") {
            let abilityFrame = false;
            if (f.abilityWindup > 0) {
              abilityFrame = true;
              const before = f.abilityWindup;
              f.abilityWindup = Math.max(0, f.abilityWindup - dt);
              if (before > 0 && f.abilityWindup <= 0) {
                const enraged = f.hp / f.maxHp <= .5;
                const radius = enraged ? 145 : 118;
                const damage = enraged ? 28 : 22;
                for (const victim of g.fighters) {
                  // Perspective-scaled distance matches the on-ground warning ellipse.
                  if (victim.side !== "human" || victim.hp <= 0 || effectDistance(victim, f) > radius) continue;
                  victim.hp -= damage; victim.flash = .16; victim.knock = Math.max(victim.knock, 12);
                  g.damageTexts.push({ x: victim.x, y: victim.y - 48, value: String(damage), life: .8, color: "#ff7658" });
                }
                addParticles(g, f.x, f.y - 4, "#e7653d", 28);
                g.shake = 16; g.flashOverlay = Math.max(g.flashOverlay, .22);
                g.banner = enraged ? "TAKUYA // ENRAGED IRON SLAM" : "TAKUYA // IRON SLAM";
                g.bannerTime = 1.15; tone(54, .3, "sawtooth");
              }
            } else if (f.abilityCooldown <= 0 && g.fighters.some((human) => human.side === "human" && human.hp > 0 && fighterDistance(human, f) <= 150)) {
              abilityFrame = true;
              f.abilityWindup = .85;
              f.abilityCooldown = f.hp / f.maxHp <= .5 ? 4.8 : 6.5;
              g.banner = "TAKUYA // IRON SLAM INCOMING";
              g.bannerTime = .9;
            }
            if (abilityFrame) continue;
          }

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
          let objectTarget: BattlefieldObject | undefined;
          let distance = Infinity;
          if (f.side === "human") {
            f.targetObjectId = null;
            const enemies = g.fighters.filter((enemy) => enemy.side === "zombie" && enemy.hp > 0);
            const locked = f.targetId === null ? undefined : fighterById.get(f.targetId);
            const contact = enemies
              .filter((enemy) => fighterDistance(f, enemy) <= 48)
              .sort((a, b) => fighterDistance(f, a) - fighterDistance(f, b))[0];
            const targetCapacity = (enemy: Fighter) => enemy.kind === "takuya" ? 6 : enemy.kind === "abomination" ? 3 : enemy.kind === "crusher" || enemy.kind === "shade" ? 2 : 1;
            const targetScore = (enemy: Fighter) => autonomousTargetScore({ distance: fighterDistance(f, enemy), claims: targetClaims.get(enemy.id) ?? 0, capacity: targetCapacity(enemy), enemyX: enemy.x, isCurrent: f.targetId === enemy.id }) + roleTargetBias(f.kind, enemy.kind) + tacticTargetBias(g.tactic, enemy.x);
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
            const routeLane = f.lane;
            const blockingContainer = selectBlockingContainer({ enemyX: f.x, enemyLane: routeLane, objects: g.battlefieldObjects }) as BattlefieldObject | undefined;
            const crawlerInRange = !blockingContainer && f.x - BASE_X <= f.range + 10;
            const physicalContact = crawlerInRange ? undefined : humans
              .filter((human) => fighterDistance(f, human) <= f.range + human.bodyRadius + 4)
              .sort((a, b) => fighterDistance(f, a) - fighterDistance(f, b))[0];
            const routeY = LANE_Y[f.anchorLane ?? f.lane];
            const lookAhead = Math.max(105, f.range + 36);
            const defenderCapacity = (human: Fighter) => human.kind === "brute" ? 3 : human.kind === "scout" || human.kind === "medic" ? 1 : 2;
            const routeBlockers = crawlerInRange ? [] : humans.filter((human) => isCrawlerRouteBlocker({
              enemyX: f.x, defenderX: human.x, defenderY: human.y, routeY, lookAhead,
            }));
            const availableBlockers = routeBlockers.filter((human) => {
              const claimsFromOthers = Math.max(0, (interceptorClaims.get(human.id) ?? 0) - (f.targetId === human.id ? 1 : 0));
              return claimsFromOthers < defenderCapacity(human);
            });
            const interceptorScore = (human: Fighter) => interceptorTargetScore({
              distance: fighterDistance(f, human),
              claims: interceptorClaims.get(human.id) ?? 0,
              capacity: defenderCapacity(human),
              isCurrent: f.targetId === human.id,
              rearward: human.x - f.x,
            }) + (human.kind === "brute" ? -45 : 0);
            const bestInterceptor = availableBlockers.reduce<Fighter | undefined>((choice, human) => {
              return !choice || interceptorScore(human) < interceptorScore(choice) ? human : choice;
            }, undefined);
            const lockedValid = locked?.side === "human" && locked.hp > 0 && availableBlockers.some((human) => human.id === locked.id);
            target = physicalContact ?? (blockingContainer ? undefined : (lockedValid && f.retargetIn > 0 ? locked : bestInterceptor));
            if (!target && blockingContainer) objectTarget = blockingContainer;
            if (f.retargetIn <= 0 || target?.id !== f.targetId) {
              if (!target && !objectTarget && f.x > 520) {
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
            f.targetObjectId = objectTarget?.id ?? null;
          }
          distance = target ? fighterDistance(f, target) : Infinity;
          if (
            f.side === "human" && g.barricadeVulnerable && target &&
            BARRICADE_X - f.x <= Math.max(110, f.range + 20) &&
            distance > Math.max(84, f.range + 36)
          ) {
            // A remote straggler must not pull the whole squad away from the win condition.
            targetClaims.set(target.id, Math.max(0, (targetClaims.get(target.id) ?? 1) - 1));
            f.targetId = null;
            target = undefined;
            distance = Infinity;
          }
          const objectDistance = objectTarget ? Math.abs(f.x - objectTarget.x) : Infinity;
          const zombieTargetX = f.side === "zombie" ? (target?.x ?? objectTarget?.x) : undefined;
          const zombieTargetFloor = zombieTargetX !== undefined && zombieTargetX <= f.x ? zombieTargetX : null;
          const baseDistance = f.side === "human" ? (g.barricadeVulnerable ? BARRICADE_X - f.x : Infinity) : f.x - BASE_X;
          if (objectTarget && objectTarget.phase === "active") {
            const stoppingDistance = f.range + 30;
            if (objectDistance <= stoppingDistance) {
              if (f.cooldown <= 0) {
                const result = applyContainerDamage(objectTarget, f.damage) as BattlefieldObject;
                Object.assign(objectTarget, result);
                objectTarget.hitFlash = .18;
                f.attack = .18;
                f.cooldown = f.kind === "takuya" && f.hp / f.maxHp <= .5 ? 1 : f.attackEvery;
                g.damageTexts.push({ x: objectTarget.x, y: objectTarget.y - 58, value: `-${Math.round(f.damage)}`, life: .65, color: "#ff9a70" });
                addParticles(g, objectTarget.x + 24, objectTarget.y - 18, "#9aa58d", f.kind === "takuya" || f.kind === "crusher" ? 9 : 4);
                if (f.kind === "spitter") g.shots.push({ x: f.x - 14, y: f.y - 32, tx: objectTarget.x, ty: objectTarget.y - 22, life: .12, side: "zombie" });
                if (result.phase === "destroying") {
                  f.targetObjectId = null;
                  g.banner = `防護コンテナ破壊 // ${LANE_NAMES_JA[objectTarget.lane]}レーン`; g.bannerTime = 1.25;
                  g.shake = Math.max(g.shake, 9); addParticles(g, objectTarget.x, objectTarget.y - 12, "#7e8e82", 18); tone(72, .18, "sawtooth");
                } else tone(94, .045, "square", .022);
              }
            } else {
              const stopX = objectTarget.x + stoppingDistance;
              f.x = Math.max(stopX, f.x - f.speed * dt);
              const routeY = LANE_Y[f.anchorLane ?? f.lane];
              const dy = routeY - f.y;
              if (Math.abs(dy) > 2) f.y += Math.sign(dy) * Math.min(Math.abs(dy), f.laneSpeed * dt);
              f.y = Math.max(LANE_Y[0], Math.min(LANE_Y[2], f.y));
              f.lane = laneForY(f.y, f.lane) as Lane;
            }
          } else if (target && distance <= f.range + target.bodyRadius) {
            if (f.cooldown <= 0) {
              const enragedTakuya = f.kind === "takuya" && f.hp / f.maxHp <= .5;
              const attackDamage = f.side === "human" ? f.damage * humanAttackMultiplier(f.kind, target.kind, target.hp / target.maxHp, target.marked > 0) : f.damage;
              target.hp -= attackDamage; target.flash = .12;
              if (f.kind === "scout" && target.side === "zombie") target.marked = Math.max(target.marked, 3.2);
              target.knock = f.kind === "brute" || f.kind === "abomination" || f.kind === "takuya" ? 9 : 3;
              f.attack = .18; f.cooldown = enragedTakuya ? .9 : f.attackEvery;
              g.damageTexts.push({ x: target.x + (Math.random() - .5) * 10, y: target.y - 45, value: String(Math.round(attackDamage)), life: .65, color: f.side === "human" ? "#f6d278" : "#e98a72" });
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
                const beforeHit = g.barricadeHp;
                const structureDamage = f.damage * structureDamageMultiplier(f.kind, g.tactic);
                g.barricadeHp = Math.max(0, g.barricadeHp - structureDamage);
                g.barricadeHitFlash = .2;
                g.barricadeHitY = f.y;
                g.damageTexts.push({ x: WORLD_GEOMETRY.barricade.drawX + 10, y: f.y - 38, value: `-${Math.round(structureDamage)}`, life: .7, color: "#ffd06b" });
                addParticles(g, WORLD_GEOMETRY.barricade.drawX + 4, f.y - 18, "#e78b45", f.kind === "brute" ? 10 : 5);
                g.shake = Math.max(g.shake, f.kind === "brute" ? 8 : 4);
                if (["ranger", "gunner", "medic"].includes(f.kind)) {
                  g.shots.push({ x: f.x + 14, y: f.y - 32, tx: WORLD_GEOMETRY.barricade.drawX + 8, ty: f.y - 24, life: .12, side: "human" });
                }
                if (!g.barricadeBucklingAnnounced && beforeHit > BARRICADE_MAX_HP * .7 && g.barricadeHp <= BARRICADE_MAX_HP * .7) {
                  g.barricadeBucklingAnnounced = true; g.banner = "IRON BARRICADE // BUCKLING"; g.bannerTime = 1.5;
                }
                if (!g.barricadeCriticalAnnounced && beforeHit > BARRICADE_MAX_HP * .35 && g.barricadeHp <= BARRICADE_MAX_HP * .35) {
                  g.barricadeCriticalAnnounced = true; g.banner = "IRON BARRICADE // BREACH IMMINENT"; g.bannerTime = 1.7; g.flashOverlay = Math.max(g.flashOverlay, .12);
                }
                tone(f.kind === "brute" ? 78 : 132, .055, "square", .024);
              } else {
                const beforeHit = g.baseHp;
                const siegeDamage = crawlerSiegeDamage(f.damage, g.phase);
                g.baseHp = Math.max(0, g.baseHp - siegeDamage);
                g.crawlerHitFlash = .18;
                g.shake = Math.max(g.shake, 6);
                if (beforeHit === 520) { g.banner = "BREACH — CRAWLER UNDER ATTACK"; g.bannerTime = 1.4; }
                if (g.crawlerHitSfxCooldown <= 0 && g.baseHp > 0) {
                  g.crawlerHitSfxCooldown = .28;
                  tone(96, .06, "sawtooth", .028);
                  addParticles(g, BASE_X + 5, f.y - 10, "#d76a45", 5);
                  g.damageTexts.push({ x: BASE_X + 12, y: f.y - 36, value: `CRAWLER -${siegeDamage}`, life: .7, color: "#ff7658" });
                }
                if (!g.criticalAnnounced && beforeHit > 130 && g.baseHp <= 130 && g.baseHp > 0) {
                  g.criticalAnnounced = true; g.banner = "CRAWLER CRITICAL"; g.bannerTime = 1.6; g.flashOverlay = Math.max(g.flashOverlay, .12);
                  g.crawlerHitSfxCooldown = Math.max(g.crawlerHitSfxCooldown, .5); tone(76, .18, "sawtooth", .035);
                }
              }
              const enragedSiege = f.kind === "takuya" && f.hp / f.maxHp <= .5;
              f.attack = .18; f.cooldown = enragedSiege ? 1 : f.attackEvery; g.shake = Math.max(g.shake, 4);
            }
          } else if (target && f.side === "human") {
            const humanLimit = advanceLimitFor(g.tactic, g.phase, g.barricadeVulnerable);
            const dx = target.x - f.x; const dy = target.y - f.y;
            const stoppingDistance = Math.max(18, f.range + target.bodyRadius * .55);
            const moveMultiplier = g.tactic === "assault" ? 1.12 : g.tactic === "defend" ? .92 : 1;
            if (f.x > humanLimit + 2) {
              f.x = Math.max(humanLimit, f.x - f.speed * dt * 1.15);
            } else if (Math.abs(dx) > stoppingDistance) {
              const nextX = f.x + Math.sign(dx) * Math.min(Math.abs(dx), f.speed * dt * moveMultiplier);
              f.x = Math.max(MUSTER_X - 8, Math.min(humanLimit, nextX));
            }
            if (Math.abs(dy) > 2) f.y += Math.sign(dy) * Math.min(Math.abs(dy), f.laneSpeed * dt);
            f.y = Math.max(LANE_Y[0], Math.min(LANE_Y[2], f.y));
            f.lane = laneForY(f.y, f.lane) as Lane;
          } else if (target && f.side === "zombie") {
            // The CRAWLER remains the objective: enemies advance on their route and only stop for a physical blocker.
            const burning = g.supports.some((support) => support.kind === "molotov" && effectDistance(f, support) <= 85);
            f.x = advanceZombieX({ enemyX: f.x, speed: f.speed, seconds: dt, burning, targetFloor: zombieTargetFloor });
            const routeY = LANE_Y[f.anchorLane ?? f.lane];
            const dy = routeY - f.y;
            if (Math.abs(dy) > 2) f.y += Math.sign(dy) * Math.min(Math.abs(dy), f.laneSpeed * dt);
            f.y = Math.max(LANE_Y[0], Math.min(LANE_Y[2], f.y));
            f.lane = laneForY(f.y, f.lane) as Lane;
          } else {
            const humanLimit = advanceLimitFor(g.tactic, g.phase, g.barricadeVulnerable);
            const heldAtLine = f.side === "human" && f.x >= humanLimit;
            if (f.side === "human" && f.x > humanLimit + 2) {
              f.x = Math.max(humanLimit, f.x - f.speed * dt * 1.15);
            } else if (!heldAtLine) {
              const burning = f.side === "zombie" && g.supports.some((support) => support.kind === "molotov" && effectDistance(f, support) <= 85);
              if (f.side === "human") {
                const moveMultiplier = g.tactic === "assault" ? 1.12 : g.tactic === "defend" ? .92 : 1;
                f.x += f.speed * dt * moveMultiplier;
              } else {
                f.x = advanceZombieX({ enemyX: f.x, speed: f.speed, seconds: dt, burning });
              }
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
            g.maxCombo = Math.max(g.maxCombo, g.combo);
            g.scrap += scrapReward(fighter.kind);
            g.rage = Math.min(RAGE_MAX, g.rage + rageReward(fighter.kind));
            if (fighter.kind === "takuya") {
              g.barricadeVulnerable = true; g.banner = "TAKUYA DOWN — BARRICADE EXPOSED"; g.bannerTime = 3.4; g.shake = 15; g.flashOverlay = .3;
            }
          } else g.unitsLost++;
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
                targetId: null, targetObjectId: null, retargetIn: 0, bodyRadius: bodyRadiusFor("turned"), laneSpeed: enemyLaneSpeedFor("turned"), spawnGrace: 0,
                marked: 0, abilityCooldown: 0, abilityWindup: 0,
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

        const outcome = battleOutcome(g.baseHp, g.barricadeHp);
        if (outcome) {
          g.over = true;
          // A simultaneous collapse is a loss: protecting the crawler always remains mandatory.
          g.won = outcome === "won";
          g.shake = 18;
          setEnd({ won: g.won, time: g.time, wave: g.wave, kills: g.kills, scrap: g.scrap, baseHp: Math.max(0, g.baseHp), maxCombo: g.maxCombo, unitsLost: g.unitsLost });
          chooseAction(null);
          stopMusic(); playEndJingle(g.won);
        }
      }

      drawWorld(ctx, g, backgroundRef.current, spriteRefs.current, barricadeSpriteRef.current);
      if (g.bannerTime > 0 && g.running) {
        ctx.fillStyle = "rgba(15,14,14,.8)"; ctx.fillRect(302, 70, 356, 54);
        ctx.strokeStyle = "#d79647"; ctx.strokeRect(302.5, 70.5, 355, 53);
        ctx.fillStyle = "#f0d2a3"; ctx.font = "bold 19px monospace"; ctx.textAlign = "center";
        ctx.fillText(g.banner, W / 2, 104); ctx.textAlign = "left";
      }
      if (now - lastHudRef.current > 100) {
        lastHudRef.current = now;
        const boss = g.fighters.find((fighter) => fighter.kind === "takuya" && fighter.hp > 0);
        const nearestEnemyX = g.fighters.reduce((nearest, fighter) => fighter.side === "zombie" && fighter.hp > 0 ? Math.min(nearest, fighter.x) : nearest, Infinity);
        setHud({
          energy: Math.floor(g.energy), rage: Math.floor(g.rage), scrap: g.scrap, kills: g.kills,
          wave: g.wave, phase: g.phase, baseHp: Math.max(0, g.baseHp),
          barricadeHp: Math.max(0, g.barricadeHp), barricadeVulnerable: g.barricadeVulnerable, barricadeHitFlash: g.barricadeHitFlash,
          tactic: g.tactic, deployQueue: g.deployQueue.length,
          strike: Math.ceil(g.strikeCooldown), combo: g.combo, bossHp: boss?.hp ?? 0, bossMax: boss?.maxHp ?? 0,
          crawlerHitFlash: g.crawlerHitFlash, threat: crawlerThreatLevel(nearestEnemyX),
          objective: objectiveFor(g.phase, g.barricadeVulnerable), deployCooldowns: { ...g.deployCooldowns },
        });
      }
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [chooseAction, playEndJingle, stopMusic, syncMusicMode, tone]);

  const healthPct = Math.max(0, hud.baseHp / 520 * 100);
  const barricadePct = Math.max(0, hud.barricadeHp / BARRICADE_MAX_HP * 100);
  const barricadeCondition = barricadeState(hud.barricadeHp);
  const bossPct = hud.bossMax ? Math.max(0, hud.bossHp / hud.bossMax * 100) : 0;
  const phaseName = hud.phase === 1 ? "HOLD" : hud.phase === 2 ? "PUSH" : "ASSAULT";
  const selectedName = selectedAction === "supply:container"
    ? CONTAINER_DEF.name
    : selectedAction ? supportDefs.find((support) => `support:${support.kind}` === selectedAction)?.name : null;

  return (
    <main className="game-shell">
      <section className="game-frame" aria-label="ASHFALL OUTPOST game">
        <canvas ref={canvasRef} width={W} height={H} className={`battlefield ${selectedAction ? "targeting" : ""}`} aria-label="Three-lane wasteland battlefield" onPointerMove={handleBattlefieldPointerMove} onPointerDown={handleBattlefieldPointer} />
        {qaEndgame && <div className="qa-badge" role="status">LOCAL QA // ENDGAME</div>}

        <div className="top-hud">
          <div className="brand-block"><span className="brand-mark">A</span><div><b>ASHFALL</b><small>OUTPOST // 07 <em>EARLY ACCESS 0.4.0</em></small></div></div>
          <div className="phase-block"><small>PHASE {hud.phase}</small><strong>{phaseName}</strong><em>W{String(hud.wave).padStart(2, "0")}</em></div>
          <button className={`tactic-cycle ${hud.tactic}`} onClick={cycleTactic} aria-label={`作戦方針を切り替え（現在：${hud.tactic}）`}><small>TACTIC</small><b>{hud.tactic.toUpperCase()}</b><em>R</em></button>
          <button className="icon-btn" onClick={togglePause} aria-label={paused ? "再開" : "一時停止"}>{paused ? "▶" : "Ⅱ"}</button>
          <button className={`icon-btn audio-btn ${musicActive ? "playing" : ""}`} data-playing={musicActive} onClick={toggleBgm} aria-label={bgmMuted ? "BGMを再生" : "BGMをミュート"}><b>{bgmMuted ? "×" : "♫"}</b><small>BGM</small></button>
          <button className="icon-btn audio-btn" onClick={toggleSfx} aria-label={sfxMuted ? "効果音を再生" : "効果音をミュート"}><b>{sfxMuted ? "×" : "FX"}</b><small>SFX</small></button>
        </div>

        <div className={`health-hud crawler-health ${healthPct <= 25 ? "critical" : ""} ${hud.crawlerHitFlash > 0 ? "hit" : ""}`}><div><span>CRAWLER</span><b>{Math.ceil(hud.baseHp)} / 520</b></div><i><em style={{ width: `${healthPct}%` }} /></i></div>
        <div className={`health-hud barrier-health ${hud.barricadeVulnerable ? "vulnerable" : "reinforced"} ${hud.barricadeHitFlash > 0 ? "hit" : ""}`}><div><span>IRON BARRICADE</span><b>{hud.barricadeVulnerable ? `${Math.ceil(hud.barricadeHp)} / ${BARRICADE_MAX_HP}` : "REINFORCED"}</b></div><i><em style={{ width: `${barricadePct}%` }} /></i>{hud.barricadeVulnerable && <small>{barricadeCondition}</small>}</div>
        {hud.bossMax > 0 && <div className="boss-hud"><div><span>BOSS // TAKUYA</span><b>IRON JUDGE</b></div><i><em style={{ width: `${bossPct}%` }} /></i></div>}
        {started && !end && hud.threat > .55 && <div className={`crawler-alert ${hud.threat > .82 ? "imminent" : ""}`}><b>CRAWLER THREAT</b><span>{hud.threat > .82 ? "IMMINENT" : "APPROACHING"}</span></div>}

        {selectedAction && started && !paused && !end && (
          selectedAction === "supply:container"
            ? <div className="placement-hint"><b>{selectedName}選択中</b><span>戦場をタップして配置</span><small>再タップ／ESCで解除</small></div>
            : <div className="placement-hint"><b>{selectedName} SELECTED</b><span>TAP A TARGET POSITION</span><small>ESC TO CANCEL</small></div>
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
            <div className="support-row" aria-label="戦場物資とRage field support">
              <span className="support-label">物資<br />支援</span>
              <button
                className={`support-btn container ${selectedAction === "supply:container" ? "selected" : ""}`}
                disabled={!started || paused || hud.scrap < CONTAINER_DEF.cost || !!end}
                onClick={() => chooseAction(selectedAction === "supply:container" ? null : "supply:container")}
                aria-label={`防護コンテナ ${CONTAINER_DEF.cost}スクラップ`}
              >
                <span className="support-key">V</span><b>防護コンテナ</b><small>敵の進行を阻止</small><em>▰{CONTAINER_DEF.cost}</em>
              </button>
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

        <div className="stats-strip"><span>☠ {hud.kills} KILLS</span><span>▰ スクラップ {hud.scrap}</span><span className="bay-status">BAY {hud.deployQueue}/3</span>{hud.combo > 1 && <span className="combo">×{hud.combo} COMBO</span>}<span className="objective">OBJECTIVE: {hud.objective}</span></div>

        {!started && (
          <div className="start-screen"><div className="start-panel">
            <p className="eyebrow">{"/// EARLY ACCESS BUILD 0.4.0 · TACTICAL COMMAND · IRON BREACH"}</p>
            <h1>ASHFALL<br /><span>OUTPOST</span></h1>
            <p className="mission">Deploy during the five-second window. Defend the Crawler, bring down TAKUYA, then break the iron barricade sealing all three routes.</p>
            <button className="start-btn" disabled={!assetsReady && !assetError} onClick={assetError ? () => window.location.reload() : startGame}><span>{assetError ? "RETRY ASSET LOAD" : assetsReady ? "BEGIN OPERATION" : "PREPARING ASSETS"}</span><small>{assetError ? "TAP TO RELOAD" : assetsReady ? "TAP A UNIT CARD · AUTO-DEPLOY" : "CRAWLER SYSTEM CHECK"}</small></button>
            <p className="controls">1–6 DEPLOY · R TACTIC · V 防護コンテナ · Z/X/C/Q SUPPORT · P PAUSE</p>
          </div></div>
        )}

        {paused && started && !end && <div className="pause-screen"><div><small>OPERATION SUSPENDED</small><h2>PAUSED</h2><button onClick={togglePause}>RESUME</button></div></div>}
        {end && <div className={`end-screen ${end.won ? "win" : "lose"}`}><div className="end-panel">
          <p>{end.won ? "ENEMY LINE BROKEN" : "CRAWLER LOST"}</p><h2>{end.won ? "BARRICADE BREACHED" : "THE LINE BROKE"}</h2>
          <div className="battle-report" aria-label="Operation battle report">
            <span><small>TIME</small><b>{formatMissionTime(end.time)}</b></span>
            <span><small>WAVE</small><b>{String(end.wave).padStart(2, "0")}</b></span>
            <span><small>KILLS</small><b>{end.kills}</b></span>
            <span><small>SCRAP</small><b>{end.scrap}</b></span>
            <span><small>CRAWLER</small><b>{Math.round(end.baseHp / 520 * 100)}%</b></span>
            <span><small>LOSSES</small><b>{end.unitsLost}</b></span>
          </div>
          <div className="report-footer"><span>BEST COMBO ×{end.maxCombo}</span><span>{end.won ? "MISSION COMPLETE" : "RECALIBRATE AND RETRY"}</span></div>
          <button onClick={startGame}>RUN IT AGAIN</button>
        </div></div>}
      </section>
      <div className="rotate-notice"><span>↻</span><b>スマホを横向きにしてください</b><small>この作戦は横画面に最適化されています</small></div>
    </main>
  );
}
