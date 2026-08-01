// Renders the shipped application icons from the authored master.
//
// The master is one SVG (assets/source/brand/app-icon-master.svg) drawn so that
// every meaningful shape already sits inside the maskable safe zone, which is
// why the same artwork serves both the "any" and "maskable" purposes: there is
// no second composition to keep in sync, and no padded variant whose flat
// border would seam against the master's gradient sky.
//
// Run with --check to fail instead of writing, which is how the build verifies
// the shipped PNGs still match the master.

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const masterPath = path.join(root, "assets", "source", "brand", "app-icon-master.svg");
const outputDir = path.join(root, "public", "icons");

// The safe zone a maskable icon must respect: content inside the centred circle
// of 80% diameter survives every mask shape a platform applies.
const MASKABLE_SAFE_DIAMETER_RATIO = 0.8;

const TARGETS = [
  { file: "icon-1024.png", size: 1024 },
  { file: "icon-512.png", size: 512 },
  { file: "icon-192.png", size: 192 },
  { file: "icon-maskable-512.png", size: 512 },
  { file: "icon-maskable-192.png", size: 192 },
  { file: "apple-touch-icon-180.png", size: 180 },
];

const check = process.argv.includes("--check");
const master = await readFile(masterPath);

/**
 * Confirms the artwork keeps clear of the maskable safe-zone boundary.
 *
 * Rendering the master and looking at where non-background pixels actually land
 * is stronger than trusting the numbers in the SVG: it catches a stroke width or
 * a glow radius pushing past the edge, which reading coordinates never would.
 */
async function assertSafeArea() {
  const size = 512;
  // Measure the mark on its own. The backdrop bleeds to the canvas edge on
  // purpose - a mask cutting sky costs nothing - so including it would make the
  // check meaningless. Dropping the backdrop group leaves the artwork that must
  // survive every mask shape, rendered on transparency.
  const markOnly = Buffer.from(
    master.toString("utf8").replace(/ {2}<g id="backdrop">[\s\S]*?\n {2}<\/g>/u, ""),
    "utf8",
  );
  if (markOnly.length >= master.length) {
    throw new Error("Could not isolate the icon mark: the backdrop group was not found");
  }
  const { data, info } = await sharp(markOnly, { density: 384 })
    .resize(size, size)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const centre = size / 2;
  const safeRadius = (size * MASKABLE_SAFE_DIAMETER_RATIO) / 2;
  let worstRadius = 0;
  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      // Alpha alone decides what is artwork, so a dark silhouette counts just as
      // much as a bright rim light. The floor ignores anti-aliasing fringes.
      if (data[(y * info.width + x) * info.channels + 3] <= 8) continue;
      const radius = Math.hypot(x + 0.5 - centre, y + 0.5 - centre);
      if (radius > worstRadius) worstRadius = radius;
    }
  }
  if (worstRadius > safeRadius) {
    throw new Error(
      `App icon artwork reaches ${worstRadius.toFixed(1)}px from centre, outside the `
      + `${safeRadius.toFixed(1)}px maskable safe radius. A platform mask would cut it.`,
    );
  }
  return { worstRadius, safeRadius };
}

const safeArea = await assertSafeArea();

await mkdir(outputDir, { recursive: true });
const rendered = [];
let drift = false;
for (const target of TARGETS) {
  // Density is scaled with the target so small sizes are rasterised from the
  // vector at full resolution rather than downsampled from a fixed bitmap.
  const png = await sharp(master, { density: Math.max(96, Math.round(target.size * 0.75)) })
    .resize(target.size, target.size)
    .png({ compressionLevel: 9, palette: false })
    .toBuffer();
  const destination = path.join(outputDir, target.file);
  const digest = createHash("sha256").update(png).digest("hex");
  if (check) {
    const existing = await readFile(destination).catch(() => null);
    const existingDigest = existing ? createHash("sha256").update(existing).digest("hex") : null;
    if (existingDigest !== digest) {
      drift = true;
      console.error(`drift: ${target.file} does not match the master`);
    }
  } else {
    await writeFile(destination, png);
  }
  rendered.push({ file: target.file, size: target.size, bytes: png.length, sha256: digest });
}

console.log(JSON.stringify({
  master: path.relative(root, masterPath).replace(/\\/g, "/"),
  safeArea: {
    artworkRadiusPx: Number(safeArea.worstRadius.toFixed(1)),
    maskableSafeRadiusPx: Number(safeArea.safeRadius.toFixed(1)),
    measuredAt: "512px",
  },
  icons: rendered,
}, null, 2));

if (drift) {
  console.error("App icons are out of date. Run: node scripts/build-app-icons.mjs");
  process.exit(1);
}
