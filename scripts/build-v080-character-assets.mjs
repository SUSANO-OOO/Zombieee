import { mkdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const source = path.join(root, "assets/source/v080/characters/monkey-cutout-source-r1.png");
const portraitDir = path.join(root, "public/art/v080/characters/portraits");
const cardDir = path.join(root, "public/art/v080/characters/cards");
const battleDir = path.join(root, "public/art/v080/characters");
await Promise.all([mkdir(portraitDir, { recursive: true }), mkdir(cardDir, { recursive: true }), mkdir(battleDir, { recursive: true })]);

const backgroundAlpha = (red, green, blue) => {
  const minimum = Math.min(red, green, blue);
  const maximum = Math.max(red, green, blue);
  const spread = maximum - minimum;
  const luminance = red * .2126 + green * .7152 + blue * .0722;
  if (luminance >= 180 && spread <= 50) return 0;
  if (spread > 50 || luminance < 180) return 255;
  return Math.round(Math.max(0, Math.min(1, (205 - luminance) / 25 + spread / 100)) * 255);
};

const { data: sourcePixels, info } = await sharp(source)
  .removeAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });
if (info.width !== 1024 || info.height !== 1536 || info.channels !== 3) {
  throw new Error(`Unexpected Monkey source geometry ${info.width}x${info.height}x${info.channels}`);
}

const cutoutPixels = Buffer.alloc(info.width * info.height * 4);
for (let sourceIndex = 0, targetIndex = 0; sourceIndex < sourcePixels.length; sourceIndex += 3, targetIndex += 4) {
  const red = sourcePixels[sourceIndex];
  const green = sourcePixels[sourceIndex + 1];
  const blue = sourcePixels[sourceIndex + 2];
  cutoutPixels[targetIndex] = red;
  cutoutPixels[targetIndex + 1] = green;
  cutoutPixels[targetIndex + 2] = blue;
  const rawAlpha = backgroundAlpha(red, green, blue);
  cutoutPixels[targetIndex + 3] = rawAlpha <= 96
    ? 0
    : Math.min(255, Math.round((rawAlpha - 96) * 255 / 159));
}
for (let pass = 0; pass < 3; pass += 1) {
  const alphaSnapshot = Buffer.alloc(info.width * info.height);
  for (let pixel = 0; pixel < alphaSnapshot.length; pixel += 1) alphaSnapshot[pixel] = cutoutPixels[pixel * 4 + 3];
  for (let y = 1; y < info.height - 1; y += 1) {
    for (let x = 1; x < info.width - 1; x += 1) {
      const pixel = y * info.width + x;
      if (alphaSnapshot[pixel] === 0) continue;
      const channel = pixel * 4;
      const red = cutoutPixels[channel];
      const green = cutoutPixels[channel + 1];
      const blue = cutoutPixels[channel + 2];
      const spread = Math.max(red, green, blue) - Math.min(red, green, blue);
      const luminance = red * .2126 + green * .7152 + blue * .0722;
      if (luminance < 135 || spread > 80) continue;
      const touchesTransparency = alphaSnapshot[pixel - 1] === 0
        || alphaSnapshot[pixel + 1] === 0
        || alphaSnapshot[pixel - info.width] === 0
        || alphaSnapshot[pixel + info.width] === 0;
      if (touchesTransparency) cutoutPixels[channel + 3] = 0;
    }
  }
}
for (let pixel = 0; pixel < info.width * info.height; pixel += 1) {
  const channel = pixel * 4;
  if (cutoutPixels[channel + 3] !== 0) continue;
  cutoutPixels[channel] = 0;
  cutoutPixels[channel + 1] = 0;
  cutoutPixels[channel + 2] = 0;
}

const cutout = () => sharp(cutoutPixels, {
  raw: { width: info.width, height: info.height, channels: 4 },
});

await cutout()
  .extract({ left: 92, top: 10, width: 840, height: 1050 })
  .resize(512, 640, { fit: "fill" })
  .webp({ quality: 92, alphaQuality: 100, effort: 6 })
  .toFile(path.join(portraitDir, "monkey-event-portrait-r2.webp"));

await cutout()
  .extract({ left: 200, top: 35, width: 620, height: 620 })
  .resize(512, 512, { fit: "fill" })
  .webp({ quality: 91, alphaQuality: 100, effort: 6 })
  .toFile(path.join(cardDir, "monkey-formation-card-r2.webp"));

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
await Promise.all(Object.entries(existingPortraits).map(async ([kind, relativeSource]) => {
  const crop = cardCrops[kind];
  await sharp(path.join(root, relativeSource))
    .extract({ left: crop.left, top: crop.top, width: crop.size, height: crop.size })
    .resize(512, 512, { fit: "cover", position: "north" })
    .webp({ quality: 91, alphaQuality: 100, effort: 6 })
    .toFile(path.join(cardDir, `${kind}-formation-card-r2.webp`));
}));

const BATTLE_CELL = Object.freeze({ width: 480, height: 448, inset: 16 });
const battleStates = Object.freeze([
  { id: "idle", angle: 0, scale: 1, shiftX: 0, shiftY: 0 },
  { id: "walk-a", angle: -2, scale: .985, shiftX: -5, shiftY: 2 },
  { id: "walk-b", angle: 2, scale: .995, shiftX: 5, shiftY: 0 },
  { id: "attack-a", angle: -4, scale: 1.025, shiftX: 12, shiftY: -1 },
  { id: "attack-b", angle: -7, scale: 1.04, shiftX: 20, shiftY: 0 },
  { id: "hit", angle: 8, scale: .96, shiftX: -8, shiftY: 4 },
  { id: "death", angle: 84, scale: .9, shiftX: 0, shiftY: 0 },
]);
const fullSubjectRegion = await cutout()
  .extract({ left: 70, top: 0, width: 900, height: 1490 })
  .png()
  .toBuffer();
const fullSubject = await sharp(fullSubjectRegion)
  .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 }, threshold: 4 })
  .png()
  .toBuffer();
const atlasComposites = [];
for (let column = 0; column < battleStates.length; column += 1) {
  const state = battleStates[column];
  const targetHeight = Math.round((state.id === "death" ? 382 : 416) * state.scale);
  const rotated = await sharp(fullSubject)
    .resize({ height: targetHeight, fit: "contain", kernel: sharp.kernel.lanczos3 })
    .rotate(state.angle, { background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  const posed = await sharp(rotated)
    .resize({
      width: BATTLE_CELL.width - BATTLE_CELL.inset * 2,
      height: BATTLE_CELL.height - BATTLE_CELL.inset * 2,
      fit: "inside",
      withoutEnlargement: true,
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
  message: "Built Version 0.8.0 Monkey portrait, carbine battle atlas, and eleven upper-body cards.",
  monkeyBattleVisible: visible,
}, null, 2));
