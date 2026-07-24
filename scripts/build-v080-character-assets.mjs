import { mkdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

import { V080_CARD_READ_CONTRACTS } from "../app/visualProfiles.js";

const root = process.cwd();
const source = path.join(root, "assets/source/v080/characters/monkey-cutout-source-r1.png");
const combatPoseSource = path.join(root, "assets/source/v080/characters/monkey-combat-poses-source-r1.png");
const portraitDir = path.join(root, "public/art/v080/characters/portraits");
const cardDir = path.join(root, "public/art/v080/characters/cards");
const battleDir = path.join(root, "public/art/v080/characters");
await Promise.all([mkdir(portraitDir, { recursive: true }), mkdir(cardDir, { recursive: true }), mkdir(battleDir, { recursive: true })]);

const backgroundAlpha = (red, green, blue, { stricterNeutral = false } = {}) => {
  const minimum = Math.min(red, green, blue);
  const maximum = Math.max(red, green, blue);
  const spread = maximum - minimum;
  const luminance = red * .2126 + green * .7152 + blue * .0722;
  if (stricterNeutral && luminance >= 176 && spread <= 38) return 0;
  if (luminance >= 180 && spread <= 50) return 0;
  if (spread > 50 || luminance < 180) return 255;
  return Math.round(Math.max(0, Math.min(1, (205 - luminance) / 25 + spread / 100)) * 255);
};

const buildCutout = async (inputPath, { stricterNeutral = false, erosionPasses = 3 } = {}) => {
  const { data: sourcePixels, info: sourceInfo } = await sharp(inputPath)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const rgba = Buffer.alloc(sourceInfo.width * sourceInfo.height * 4);
  for (let sourceIndex = 0, targetIndex = 0; sourceIndex < sourcePixels.length; sourceIndex += 3, targetIndex += 4) {
    const red = sourcePixels[sourceIndex];
    const green = sourcePixels[sourceIndex + 1];
    const blue = sourcePixels[sourceIndex + 2];
    rgba[targetIndex] = red;
    rgba[targetIndex + 1] = green;
    rgba[targetIndex + 2] = blue;
    const rawAlpha = backgroundAlpha(red, green, blue, { stricterNeutral });
    rgba[targetIndex + 3] = rawAlpha <= 96
      ? 0
      : Math.min(255, Math.round((rawAlpha - 96) * 255 / 159));
  }
  for (let pass = 0; pass < erosionPasses; pass += 1) {
    const alphaSnapshot = Buffer.alloc(sourceInfo.width * sourceInfo.height);
    for (let pixel = 0; pixel < alphaSnapshot.length; pixel += 1) alphaSnapshot[pixel] = rgba[pixel * 4 + 3];
    for (let y = 1; y < sourceInfo.height - 1; y += 1) {
      for (let x = 1; x < sourceInfo.width - 1; x += 1) {
        const pixel = y * sourceInfo.width + x;
        if (alphaSnapshot[pixel] === 0) continue;
        const channel = pixel * 4;
        const red = rgba[channel];
        const green = rgba[channel + 1];
        const blue = rgba[channel + 2];
        const spread = Math.max(red, green, blue) - Math.min(red, green, blue);
        const luminance = red * .2126 + green * .7152 + blue * .0722;
        if (luminance < 135 || spread > 80) continue;
        const touchesTransparency = alphaSnapshot[pixel - 1] === 0
          || alphaSnapshot[pixel + 1] === 0
          || alphaSnapshot[pixel - sourceInfo.width] === 0
          || alphaSnapshot[pixel + sourceInfo.width] === 0;
        if (touchesTransparency) rgba[channel + 3] = 0;
      }
    }
  }
  for (let pixel = 0; pixel < sourceInfo.width * sourceInfo.height; pixel += 1) {
    const channel = pixel * 4;
    if (rgba[channel + 3] !== 0) continue;
    rgba[channel] = 0;
    rgba[channel + 1] = 0;
    rgba[channel + 2] = 0;
  }
  return { pixels: rgba, info: sourceInfo };
};

const removeSmallAlphaComponents = ({ pixels, info }, minimumPixels = 72) => {
  const pixelCount = info.width * info.height;
  const visited = new Uint8Array(pixelCount);
  const queue = new Int32Array(pixelCount);
  for (let start = 0; start < pixelCount; start += 1) {
    if (visited[start] || pixels[start * 4 + 3] <= 8) continue;
    let head = 0;
    let tail = 0;
    queue[tail++] = start;
    visited[start] = 1;
    const component = [];
    while (head < tail) {
      const pixel = queue[head++];
      component.push(pixel);
      const x = pixel % info.width;
      const y = Math.floor(pixel / info.width);
      for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
        for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
          if (offsetX === 0 && offsetY === 0) continue;
          const nextX = x + offsetX;
          const nextY = y + offsetY;
          if (nextX < 0 || nextX >= info.width || nextY < 0 || nextY >= info.height) continue;
          const next = nextY * info.width + nextX;
          if (visited[next] || pixels[next * 4 + 3] <= 8) continue;
          visited[next] = 1;
          queue[tail++] = next;
        }
      }
    }
    if (component.length >= minimumPixels) continue;
    for (const pixel of component) {
      const channel = pixel * 4;
      pixels[channel] = 0;
      pixels[channel + 1] = 0;
      pixels[channel + 2] = 0;
      pixels[channel + 3] = 0;
    }
  }
  return { pixels, info };
};

const { pixels: cutoutPixels, info } = removeSmallAlphaComponents(await buildCutout(source));
if (info.width !== 1024 || info.height !== 1536 || info.channels !== 3) {
  throw new Error(`Unexpected Monkey source geometry ${info.width}x${info.height}x${info.channels}`);
}
const cutout = () => sharp(cutoutPixels, {
  raw: { width: info.width, height: info.height, channels: 4 },
});

await cutout()
  .extract({ left: 92, top: 10, width: 840, height: 1050 })
  .resize(512, 640, { fit: "fill" })
  .webp({ quality: 92, alphaQuality: 100, effort: 6 })
  .toFile(path.join(portraitDir, "monkey-event-portrait-r2.webp"));

const monkeyCardSource = await cutout()
  .extract({ left: 200, top: 35, width: 620, height: 620 })
  .resize(512, 512, { fit: "fill" })
  .png()
  .toBuffer();

const existingPortraits = {
  brawler: "public/art/v060/characters/portraits/brawler-portrait-v2.webp",
  scout: "public/art/v070/characters/portraits/scout-portrait-v1.webp",
  ranger: "public/art/v070/characters/portraits/ranger-portrait-v1.webp",
  medic: "public/art/v070/characters/portraits/medic-portrait-v1.webp",
  brute: "public/art/v070/characters/portraits/brute-portrait-v1.webp",
  gunner: "public/art/v070/characters/portraits/gunner-portrait-v1.webp",
  "crazy-king": "public/art/v060/characters/portraits/crazy-king-portrait-v2.webp",
  kumaverson: "public/art/v060/characters/portraits/kumaverson-portrait-v2.webp",
  babayaga: "public/art/v060/characters/portraits/babayaga-portrait-v2.webp",
  guardian: "public/art/v070/characters/portraits/guardian-portrait-v1.webp",
};
const cardCrops = {
  brawler: { left: 45, top: 0, size: 420 },
  scout: { left: 75, top: 30, size: 420 },
  ranger: { left: 85, top: 20, size: 360 },
  medic: { left: 100, top: 40, size: 320 },
  brute: { left: 25, top: 0, size: 450 },
  gunner: { left: 80, top: 20, size: 360 },
  "crazy-king": { left: 35, top: 0, size: 440 },
  kumaverson: { left: 40, top: 30, size: 430 },
  babayaga: { left: 45, top: 0, size: 420 },
  guardian: { left: 45, top: 0, size: 420 },
};
const CARD_WEAPON_BADGES = Object.freeze(Object.fromEntries(
  Object.entries(V080_CARD_READ_CONTRACTS).map(([kind, contract]) => [kind, {
    label: contract.label,
    color: contract.accent,
    icon: contract.weaponId,
  }]),
));
const weaponIcon = (icon, color) => {
  const stroke = `stroke="${color}" stroke-width="14" stroke-linecap="round" stroke-linejoin="round" fill="none"`;
  const icons = {
    fist: `<path ${stroke} d="M33 78v-26l13-14 17 4 11 17-5 30-20 11-16-22zm50-7v-22l15-11 16 7 4 27-14 23-18-8-3-16z"/>`,
    crowbar: `<path ${stroke} d="M32 98 108 28m-75 70-10-3 1-18m84-49 17 2 7 13"/>`,
    rifle: `<path ${stroke} d="M18 74h92l19-15 25 6v20h-39l-20 22H72L62 84H18zm62-18 15-19h34"/>`,
    medic: `<path ${stroke} d="M18 76h92l20-16 25 7v18h-42l-18 19H70L60 85H18"/><path stroke="${color}" stroke-width="12" d="M30 24v34m-17-17h34"/>`,
    hammer: `<path ${stroke} d="m75 35 55 18-13 38-56-18zM79 76 38 132"/>`,
    lmg: `<path ${stroke} d="M17 69h101l24-13 18 10v19h-48l-18 17H65L55 84H17zm84 32 9 30h28v-29"/>`,
    chainsaw: `<path ${stroke} d="M20 83h92l31-26 19 14-27 36H53zM48 82 33 55H18"/><path stroke="${color}" stroke-width="8" stroke-dasharray="6 8" d="M70 99h58"/>`,
    pan: `<circle ${stroke} cx="67" cy="70" r="34"/><path ${stroke} d="m92 95 52 42"/>`,
    pistol: `<path ${stroke} d="M25 57h105v34H86l-5 47H50l-3-61H25zM128 64h35"/>`,
    shield: `<path ${stroke} d="M88 19 143 40v44c0 33-22 55-55 68-33-13-55-35-55-68V40z"/>`,
    carbine: `<path ${stroke} d="M16 71h104l18-12 27 9v18h-48l-18 21H69L58 87H16zm62-18 14-17h27"/><circle fill="${color}" cx="142" cy="121" r="9"/>`,
  };
  return icons[icon];
};
const cardBadgeSvg = ({ label, color, icon }) => Buffer.from(`
  <svg xmlns="http://www.w3.org/2000/svg" width="512" height="512">
    <rect x="16" y="16" width="10" height="480" rx="5" fill="${color}"/>
    <path d="M300 340h196v156H276l24-156z" fill="#090d12" fill-opacity=".88" stroke="${color}" stroke-width="5"/>
    <g transform="translate(310 350) scale(.9)">${weaponIcon(icon, color)}</g>
    <text x="474" y="480" text-anchor="end" font-family="Arial,sans-serif" font-weight="900" font-size="28" letter-spacing="2" fill="#fff">${label}</text>
  </svg>
`);
await Promise.all(Object.entries(existingPortraits).map(async ([kind, relativeSource]) => {
  const crop = cardCrops[kind];
  const cardBase = await sharp(path.join(root, relativeSource))
    .extract({ left: crop.left, top: crop.top, width: crop.size, height: crop.size })
    .resize(512, 512, { fit: "cover", position: "north" })
    .png()
    .toBuffer();
  await sharp(cardBase)
    .composite([{ input: cardBadgeSvg(CARD_WEAPON_BADGES[kind]) }])
    .webp({ quality: 91, alphaQuality: 100, effort: 6 })
    .toFile(path.join(cardDir, `${kind}-formation-card-r2.webp`));
}));
await sharp(monkeyCardSource)
  .composite([{ input: cardBadgeSvg(CARD_WEAPON_BADGES.engineer) }])
  .webp({ quality: 91, alphaQuality: 100, effort: 6 })
  .toFile(path.join(cardDir, "monkey-formation-card-r2.webp"));

const BATTLE_CELL = Object.freeze({ width: 480, height: 448, inset: 16 });
const battleStates = Object.freeze([
  { id: "idle", shiftX: 0, shiftY: 0 },
  { id: "walk-a", shiftX: -5, shiftY: 0 },
  { id: "walk-b", shiftX: 5, shiftY: 0 },
  { id: "attack-a", shiftX: 10, shiftY: 0 },
  { id: "attack-b", shiftX: 16, shiftY: 0 },
  { id: "hit", shiftX: -7, shiftY: 0 },
  { id: "death", shiftX: 4, shiftY: 0 },
]);
const { pixels: combatPixels, info: combatInfo } = await buildCutout(combatPoseSource, {
  stricterNeutral: true,
  erosionPasses: 2,
});
if (combatInfo.width !== 2172 || combatInfo.height !== 724) {
  throw new Error(`Unexpected Monkey combat pose sheet ${combatInfo.width}x${combatInfo.height}`);
}
const poseBounds = Object.freeze([
  { left: 0, width: 305 },
  { left: 305, width: 270 },
  { left: 575, width: 315 },
  { left: 890, width: 310 },
  { left: 1200, width: 320 },
  { left: 1520, width: 305 },
  { left: 1825, width: 347 },
]);
const keepLargestAlphaComponent = async (input) => {
  const decoded = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height } = decoded.info;
  const pixelCount = width * height;
  const visited = new Uint8Array(pixelCount);
  const queue = new Int32Array(pixelCount);
  let largest = [];
  for (let start = 0; start < pixelCount; start += 1) {
    if (visited[start] || decoded.data[start * 4 + 3] <= 8) continue;
    let head = 0;
    let tail = 0;
    queue[tail++] = start;
    visited[start] = 1;
    const component = [];
    while (head < tail) {
      const pixel = queue[head++];
      component.push(pixel);
      const x = pixel % width;
      const y = Math.floor(pixel / width);
      for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
        for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
          if (offsetX === 0 && offsetY === 0) continue;
          const nextX = x + offsetX;
          const nextY = y + offsetY;
          if (nextX < 0 || nextX >= width || nextY < 0 || nextY >= height) continue;
          const next = nextY * width + nextX;
          if (visited[next] || decoded.data[next * 4 + 3] <= 8) continue;
          visited[next] = 1;
          queue[tail++] = next;
        }
      }
    }
    if (component.length > largest.length) largest = component;
  }
  if (largest.length === 0) throw new Error("Monkey combat pose has no visible component");
  const keep = new Uint8Array(pixelCount);
  for (const pixel of largest) keep[pixel] = 1;
  for (let pixel = 0; pixel < pixelCount; pixel += 1) {
    if (keep[pixel]) continue;
    const channel = pixel * 4;
    decoded.data[channel] = 0;
    decoded.data[channel + 1] = 0;
    decoded.data[channel + 2] = 0;
    decoded.data[channel + 3] = 0;
  }
  return sharp(decoded.data, {
    raw: { width, height, channels: 4 },
  }).png().toBuffer();
};
const stripNeutralGroundFringe = async (input) => {
  const decoded = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height } = decoded.info;
  const floorStart = Math.floor(height * .78);
  for (let y = floorStart; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const channel = (y * width + x) * 4;
      if (decoded.data[channel + 3] <= 8) continue;
      const red = decoded.data[channel];
      const green = decoded.data[channel + 1];
      const blue = decoded.data[channel + 2];
      const spread = Math.max(red, green, blue) - Math.min(red, green, blue);
      const luminance = red * .2126 + green * .7152 + blue * .0722;
      if (luminance < 110 || spread > 45) continue;
      decoded.data[channel] = 0;
      decoded.data[channel + 1] = 0;
      decoded.data[channel + 2] = 0;
      decoded.data[channel + 3] = 0;
    }
  }
  return sharp(decoded.data, {
    raw: { width, height, channels: 4 },
  }).png().toBuffer();
};
const atlasComposites = [];
for (let column = 0; column < battleStates.length; column += 1) {
  const state = battleStates[column];
  const bounds = poseBounds[column];
  const poseRegion = await sharp(combatPixels, {
    raw: { width: combatInfo.width, height: combatInfo.height, channels: 4 },
  })
    .extract({ left: bounds.left, top: 0, width: bounds.width, height: combatInfo.height })
    .png()
    .toBuffer();
  const isolatedPose = await keepLargestAlphaComponent(poseRegion);
  const floorCleanPose = await stripNeutralGroundFringe(isolatedPose);
  const pose = await sharp(floorCleanPose)
    .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 }, threshold: 4 })
    .png()
    .toBuffer();
  const posed = await sharp(pose)
    .resize({
      width: BATTLE_CELL.width - BATTLE_CELL.inset * 2,
      height: BATTLE_CELL.height - BATTLE_CELL.inset * 2,
      fit: "inside",
      kernel: sharp.kernel.lanczos3,
    })
    .png()
    .toBuffer();
  const posedMetadata = await sharp(posed).metadata();
  const left = Math.max(BATTLE_CELL.inset, Math.min(
    BATTLE_CELL.width - BATTLE_CELL.inset - posedMetadata.width,
    Math.round((BATTLE_CELL.width - posedMetadata.width) / 2 + state.shiftX),
  ));
  const top = BATTLE_CELL.height - BATTLE_CELL.inset - posedMetadata.height - state.shiftY;
  atlasComposites.push({ input: posed, left: column * BATTLE_CELL.width + left, top });
  atlasComposites.push({
    input: await sharp(posed).flop().png().toBuffer(),
    left: column * BATTLE_CELL.width + left,
    top: BATTLE_CELL.height + top,
  });
}
const monkeyBattlePath = path.join(battleDir, "monkey-battle-r2.png");
await sharp({
  create: {
    width: BATTLE_CELL.width * battleStates.length,
    height: BATTLE_CELL.height * 2,
    channels: 4,
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  },
})
  .composite(atlasComposites)
  .png({ compressionLevel: 9, adaptiveFiltering: true })
  .toFile(monkeyBattlePath);

const decodedAtlas = await sharp(monkeyBattlePath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const visible = {};
for (let row = 0; row < 2; row += 1) {
  const direction = row === 0 ? "right" : "left";
  visible[direction] = battleStates.map((state, column) => {
    let left = BATTLE_CELL.width;
    let top = BATTLE_CELL.height;
    let right = -1;
    let bottom = -1;
    for (let y = 0; y < BATTLE_CELL.height; y += 1) {
      for (let x = 0; x < BATTLE_CELL.width; x += 1) {
        const pixel = ((row * BATTLE_CELL.height + y) * decodedAtlas.info.width + column * BATTLE_CELL.width + x) * 4;
        if (decodedAtlas.data[pixel + 3] === 0) continue;
        left = Math.min(left, x);
        top = Math.min(top, y);
        right = Math.max(right, x + 1);
        bottom = Math.max(bottom, y + 1);
      }
    }
    if (right < left || bottom < top) throw new Error(`No visible Monkey pixels for ${direction}/${state.id}`);
    return [left, top, right, bottom];
  });
}

console.log(JSON.stringify({
  message: "Built Version 0.8.0 Monkey portrait, authored carbine pose atlas, and eleven weapon-readable cards.",
  monkeyBattleVisible: visible,
}, null, 2));
