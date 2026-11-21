import { STATION_ENEMY_TUNING } from "./stationEnemyMechanics.js";

const WIDTH = 176;
const HEIGHT = 64;
const WARNING = 0;
const MUD = 1;
const FOAM = 2;
const TEXTURES = new Array(3);
const { windupSeconds, durationSeconds } = STATION_ENEMY_TUNING.leakMud;

const clamp = (value) => Math.min(1, Math.max(0, value));
const mix = (a, b, t) => a + (b - a) * t;
const smooth = (value) => {
  const t = clamp(value);
  return t * t * (3 - 2 * t);
};

function grit(x, y, seed) {
  let value = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(seed, 1274126177);
  value = Math.imul(value ^ (value >>> 13), 2246822519);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967295;
}

function mottling(x, y, seed) {
  const left = Math.floor(x);
  const top = Math.floor(y);
  const u = smooth(x - left);
  const v = smooth(y - top);
  return mix(
    mix(grit(left, top, seed), grit(left + 1, top, seed), u),
    mix(grit(left, top + 1, seed), grit(left + 1, top + 1, seed), u),
    v,
  );
}

function makeTextures(ctx, variant) {
  const ownerDocument = ctx.canvas.ownerDocument ?? globalThis.document;
  const sheet = ownerDocument?.createElement("canvas") ??
    (typeof OffscreenCanvas === "function" ? new OffscreenCanvas(WIDTH * 3, HEIGHT) : null);
  if (!sheet) return null;

  sheet.width = WIDTH * 3;
  sheet.height = HEIGHT;
  const painter = sheet.getContext("2d");
  if (!painter) return null;
  const pixels = painter.createImageData(sheet.width, sheet.height);
  const seed = 41 + variant * 23;

  for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < WIDTH; x++) {
      const u = (x + .5) / WIDTH * 2 - 1;
      const v = (y + .5) / HEIGHT * 2 - 1;
      const distance = Math.hypot(u, v);
      if (distance >= 1) continue;

      const angle = Math.atan2(v, u);
      const silt = mottling(x / 13, y / 7, seed);
      const shore = .897 + Math.sin(angle * 5 + variant * 2) * .054 +
        Math.sin(angle * 9 - variant) * .025 + (silt - .5) * .08;
      const depth = shore - distance;
      const coverage = smooth((depth + .034) * 17);
      if (!coverage) continue;

      const grain = grit(x, y, seed + 1);
      const oil = mottling(x / 27 + v * .8, y / 3.8, seed + 3);
      const clumps = mottling(x / 5.2, y / 3.6, seed + 2);
      const dark = smooth((silt - .2) * 1.6);
      const wetRim = smooth(1 - Math.abs(depth - .043) * 13) * smooth((clumps - .27) * 1.8);
      const reflected = smooth((oil - .49) * 2.8) * smooth((.71 - silt) * 1.7);
      const gloss = clamp(wetRim * .47 + reflected * .51 + clumps * .17);
      const fizz = smooth((grain - .86) * 7) * smooth((clumps - .47) * 2) * (1 - .58 * dark);
      const fracture = smooth(1 - Math.abs(silt * .64 + clumps * .36 - .493) * 15);

      const start = (y * sheet.width + x) * 4;
      const data = pixels.data;
      data[start] = 117 + 88 * fracture + 14 * grain;
      data[start + 1] = 117 + 80 * fracture + 13 * grain;
      data[start + 2] = 51 + 42 * fracture + 14 * grain;
      data[start + 3] = 239 * coverage * clamp(.33 + .64 * fracture + .26 * fizz + .20 * wetRim);

      const mud = start + WIDTH * 4;
      data[mud] = 32 + 85 * gloss + 24 * dark + 15 * grain;
      data[mud + 1] = 38 + 99 * gloss + 17 * dark + 17 * grain;
      data[mud + 2] = 20 + 53 * gloss + 17 * dark + 10 * grain;
      data[mud + 3] = 236 * coverage * clamp(.8 + gloss * .18 + clumps * .13);

      const crest = start + WIDTH * 8;
      data[crest] = 119 + 69 * reflected + 45 * fizz;
      data[crest + 1] = 122 + 71 * reflected + 54 * fizz;
      data[crest + 2] = 51 + 38 * reflected + 36 * fizz;
      data[crest + 3] = 195 * coverage * clamp(reflected * fizz + wetRim * .18 + fizz * .39) *
        smooth((.89 - distance) * 6);
    }
  }
  painter.putImageData(pixels, 0, 0);
  return sheet;
}

function mudVariant(ownerId) {
  const id = String(ownerId ?? "");
  let seed = 0;
  for (let at = 0; at < id.length; at++) seed = (31 * seed + id.charCodeAt(at)) % TEXTURES.length;
  return seed;
}

export function drawV100StationMud(ctx, field, time, warning = false) {
  const { centerX, centerY, radiusX, radiusY, remainingSeconds, ownerId } = field;
  if (![centerX, centerY, radiusX, radiusY, remainingSeconds, time].every(Number.isFinite) ||
      radiusX <= 0 || radiusY <= 0 || remainingSeconds <= 0) return false;

  const variant = mudVariant(ownerId);
  const sheet = TEXTURES[variant] ??= makeTextures(ctx, variant);
  if (!sheet) return false;

  const progress = warning ? 1 - clamp(remainingSeconds / windupSeconds) :
    clamp((durationSeconds - remainingSeconds) / .28);
  const slick = warning ? .88 + .12 * smooth(progress) : .69 + .31 * smooth(remainingSeconds / .55);
  const pulse = .68 + .22 * Math.sin(time * 5 + variant * 1.6);
  const alpha = ctx.globalAlpha;
  const left = centerX - radiusX;
  const top = centerY - radiusY;

  ctx.save();
  ctx.globalAlpha = alpha * slick;
  ctx.drawImage(sheet, WIDTH * (warning ? WARNING : MUD), 0, WIDTH, HEIGHT,
    left, top, radiusX * 2, radiusY * 2);
  const foamLight = warning ? .51 + progress * .35 : .60 + .40 * (1 - smooth(progress));
  ctx.globalAlpha = alpha * slick * pulse * foamLight;
  ctx.drawImage(sheet, WIDTH * FOAM, 0, WIDTH, HEIGHT,
    left + Math.sin(time * 2.9 + variant) * radiusX * .028,
    top + Math.cos(time * 2.2 - variant) * radiusY * .043, radiusX * 2, radiusY * 2);
  ctx.restore();
  return true;
}
