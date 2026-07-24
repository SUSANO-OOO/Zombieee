import { mkdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const source = path.join(root, "assets/source/v080/characters/monkey-cutout-source-r1.png");
const portraitDir = path.join(root, "public/art/v080/characters/portraits");
const cardDir = path.join(root, "public/art/v080/characters/cards");
await Promise.all([mkdir(portraitDir, { recursive: true }), mkdir(cardDir, { recursive: true })]);

const backgroundAlpha = (red, green, blue) => {
  const minimum = Math.min(red, green, blue);
  const maximum = Math.max(red, green, blue);
  const spread = maximum - minimum;
  const luminance = red * .2126 + green * .7152 + blue * .0722;
  if (spread > 28 || luminance < 195) return 255;
  if (luminance >= 205 && spread <= 28) return 0;
  return Math.round(Math.max(0, Math.min(1, (205 - luminance) / 10 + spread / 56)) * 255);
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
  cutoutPixels[targetIndex + 3] = backgroundAlpha(red, green, blue);
}

const cutout = sharp(cutoutPixels, {
  raw: { width: info.width, height: info.height, channels: 4 },
});

await cutout
  .clone()
  .extract({ left: 92, top: 10, width: 840, height: 1312 })
  .resize(512, 640, { fit: "fill" })
  .webp({ quality: 92, alphaQuality: 100, effort: 6 })
  .toFile(path.join(portraitDir, "monkey-event-portrait-r1.webp"));

await cutout
  .clone()
  .extract({ left: 105, top: 16, width: 835, height: 900 })
  .resize(512, 512, { fit: "fill" })
  .webp({ quality: 91, alphaQuality: 100, effort: 6 })
  .toFile(path.join(cardDir, "monkey-formation-card-r1.webp"));

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
await Promise.all(Object.entries(existingPortraits).map(async ([kind, relativeSource]) => {
  await sharp(path.join(root, relativeSource))
    .resize(512, 512, { fit: "cover", position: "north" })
    .webp({ quality: 91, alphaQuality: 100, effort: 6 })
    .toFile(path.join(cardDir, `${kind}-formation-card-r1.webp`));
}));

console.log("Built Version 0.8.0 Monkey portrait and all eleven formation cards.");
