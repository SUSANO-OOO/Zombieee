// Renders the shipped Version 0.9.9.0 icon set from the exact Gate A approved
// A2 raster master. Candidate B2/C2 and the generated source files remain
// authoring-only; no approval fallback is permitted.

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

import { V099_APP_ICON_IDENTITY } from "../app/appIconIdentity.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ledgerPath = path.join(root, "assets", "source", "brand", "candidates", "v099", "v2", "candidate-ledger.json");
const ledger = JSON.parse(await readFile(ledgerPath, "utf8"));
const masterPath = path.join(root, V099_APP_ICON_IDENTITY.masterPath);
const master = await readFile(masterPath);
const outputDir = path.join(root, "public", "icons", "v099");
const check = process.argv.includes("--check");

const TARGETS = [
  { path: V099_APP_ICON_IDENTITY.paths.favicon48, size: 48 },
  { path: V099_APP_ICON_IDENTITY.paths.appleTouch180, size: 180 },
  { path: V099_APP_ICON_IDENTITY.paths.icon192, size: 192 },
  { path: V099_APP_ICON_IDENTITY.paths.maskable192, size: 192 },
  { path: V099_APP_ICON_IDENTITY.paths.icon512, size: 512 },
  { path: V099_APP_ICON_IDENTITY.paths.maskable512, size: 512 },
  { path: V099_APP_ICON_IDENTITY.paths.icon1024, size: 1024 },
];

function digest(value) {
  return createHash("sha256").update(value).digest("hex");
}

function assertApprovalContract() {
  const approved = ledger.candidates.find(({ id }) => id === ledger.provenance.approvedCandidateId);
  if (ledger.gateA.iconV2 !== "approved" || !approved) throw new Error("Gate A icon approval is missing");
  if (ledger.provenance.approvedCandidateId !== V099_APP_ICON_IDENTITY.candidateId) {
    throw new Error("production candidate ID does not match the Gate A approval");
  }
  if (ledger.provenance.approvedMasterSha256 !== V099_APP_ICON_IDENTITY.masterSha256
    || approved.masterSha256 !== V099_APP_ICON_IDENTITY.masterSha256
    || ledger.productionSelection?.masterSha256 !== V099_APP_ICON_IDENTITY.masterSha256) {
    throw new Error("approved icon master SHA-256 contract drift");
  }
  if (digest(master) !== V099_APP_ICON_IDENTITY.masterSha256) throw new Error("approved icon master bytes drift");
  if (ledger.provenance.approvalCommentUrl !== V099_APP_ICON_IDENTITY.approvalCommentUrl) {
    throw new Error("approved icon evidence URL drift");
  }
  if (approved.faceCoveragePercent < 70 || approved.faceCoveragePercent > 85) {
    throw new Error("approved face coverage is outside the Producer range");
  }
  for (const feature of ledger.maskable.requiredFeatures) {
    const point = approved.featurePoints[feature];
    if (!point || Math.hypot(point.x - ledger.maskable.canvas / 2, point.y - ledger.maskable.canvas / 2) > ledger.maskable.safeRadius) {
      throw new Error(`${feature} is outside the approved maskable safe zone`);
    }
  }
  return approved;
}

const approved = assertApprovalContract();
const metadata = await sharp(master).metadata();
if (metadata.width !== 1024 || metadata.height !== 1024 || metadata.format !== "png") {
  throw new Error("approved production master must be a 1024x1024 PNG");
}

await mkdir(outputDir, { recursive: true });
const rendered = [];
let drift = false;
for (const target of TARGETS) {
  const png = target.size === 1024
    ? master
    : await sharp(master).resize(target.size, target.size).png({ compressionLevel: 9, palette: false }).toBuffer();
  const relative = target.path.replace(/^\/+/, "");
  const destination = path.join(root, "public", ...relative.split("/"));
  const sha256 = digest(png);
  if (check) {
    const existing = await readFile(destination).catch(() => null);
    if (!existing || digest(existing) !== sha256) {
      drift = true;
      console.error(`drift: ${target.path} does not match the approved master`);
    }
  } else {
    await writeFile(destination, png);
  }
  rendered.push({ path: target.path, size: target.size, bytes: png.length, sha256 });
}

console.log(JSON.stringify({
  candidateId: approved.id,
  master: V099_APP_ICON_IDENTITY.masterPath,
  masterSha256: V099_APP_ICON_IDENTITY.masterSha256,
  approvalCommentUrl: V099_APP_ICON_IDENTITY.approvalCommentUrl,
  faceCoveragePercent: approved.faceCoveragePercent,
  safeArea: {
    radiusPx: ledger.maskable.safeRadius,
    featureDistancesPx: Object.fromEntries(Object.entries(approved.featurePoints).map(([name, point]) => [
      name,
      Number(Math.hypot(point.x - 512, point.y - 512).toFixed(1)),
    ])),
  },
  icons: rendered,
}, null, 2));

if (drift) {
  console.error("Versioned app icons are out of date. Run: node scripts/build-app-icons.mjs");
  process.exit(1);
}
