import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { buildV100MotionAtlases } from "./build-v100-motion-atlases.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const SOURCE = path.join(ROOT, "assets", "source", "v100");
const TRANSPARENT = { r: 0, g: 0, b: 0, alpha: 0 };
const STORY_SHA = "c7293d739998431c38f337a7ef8d4e724b74696537ff44ad8f0c30d854a017a4";

const MASTER_HASHES = Object.freeze({
  "assets/source/v100/characters/segawa-identity-master-r2.png": "0bb98569efa36dbc7df6fbd7fb7ec2cce11671ddbe58f4ce84d9ce26fb187c1d",
  "assets/source/v100/characters/mugarian-president-identity-master-r2.png": "c5c6a40e161197a15855ca7733dc3c4af7f32138516eb885130244a2c3b22ab6",
  "assets/source/v100/enemies/mugarian-president-mutated-identity-master-r4.png": "be58f640e7b918e0a37a04d6e128b448c71926483a95f9a5a161cd83dfae0d72",
  "assets/source/v100/enemies/takuya-omega-identity-master-r2.png": "d46f6a96f693dbf0aa9b81b9ef2b1f5797f461c87505c7390c80464e3a0249af",
  "assets/source/v100/enemies/red-panther-knife-identity-master-r1.png": "8875b636ed887caa34aa1a704c31291aa1a774c4429891d2c66e7356fc8082a2",
  "assets/source/v100/enemies/red-panther-shield-identity-master-r1.png": "584e03350283e6e7a92709c98d14ca63a9574e53f46961a39b466a3760d5ea2f",
  "assets/source/v100/enemies/red-panther-smg-identity-master-r1.png": "3f03c2e8e6eae37173e637ea801944b1016858222437b4e0c4d3d320b2f52fd8",
  "assets/source/v100/enemies/red-panther-commander-identity-master-r1.png": "dab75e9ec7e6e1075f969d021d8089477ca2e2cb40e3a1e416e5e029bade6dba",
  "assets/source/v100/portraits/minor-human-shared-event-silhouette-r2.png": "a5e58d69828d5dacf99ceae1ce427f88fe751fbf3b491eedd50e5992b8c0eeb7",
});

const EXISTING = Object.freeze({
  logistics: "public/art/v080/stages/logistics-relay-background-v1.webp",
  researchFreight: "public/art/v080/stages/research-freight-passage-background-v1.webp",
  researchAccess: "public/art/v080/stages/research-access-background-v1.webp",
  researchContainment: "public/art/v080/stages/research-containment-background-v1.webp",
  hospitalEmergency: "public/art/v080/stages/hospital-emergency-ward-background-v1.webp",
  hospitalEvacuation: "public/art/v080/stages/hospital-evacuation-route-background-v1.webp",
  evacuationFreight: "public/art/v080/stages/evacuation-freight-yard-background-v1.webp",
  bayTower: "public/art/v090/stages/bay-tower-service-background-v1.webp",
  civicArchive: "public/art/v090/stages/civic-archive-route-background-v1.webp",
  coastalBridge: "public/art/v090/stages/coastal-link-bridge-background-v1.webp",
  estuaryFloodgate: "public/art/v090/stages/estuary-floodgate-background-v1.webp",
  coastalRig: "public/art/v090/stages/coastal-power-rig-v1.png",
  defenseLine: "public/art/v060/battle-nishijin-defense-line-v1.webp",
  gateObjects: "public/art/v070/stages/objects/station-gate-objects-v1.png",
  platformObjects: "public/art/v070/stages/objects/station-platform-objects-v1.png",
  tunnelObjects: "public/art/v070/stages/objects/station-tunnel-objects-v1.png",
  defenseStaticDressing: "public/art/v060/stage-objects/defense-static-dressing-v1.png",
  maintenanceCart: "public/art/v095/mission-objects/maintenance-cart-v1.png",
  infectionNestDamaged: "public/art/v060/stage-objects/defense-infection-nest-damaged-v1.png",
  infectionNestDestroyed: "public/art/v060/stage-objects/defense-infection-nest-destroyed-v1.png",
  transmitterActive: "public/art/v060/stage-objects/defense-transmitter-active-v1.png",
  transmitterDamaged: "public/art/v060/stage-objects/defense-transmitter-damaged-v1.png",
});

const sourceFiles = new Map();
const outputs = {};

function absolute(relativePath) {
  return path.join(ROOT, relativePath.replaceAll("/", path.sep));
}

async function hashFile(filePath) {
  return crypto.createHash("sha256").update(await fs.readFile(filePath)).digest("hex");
}

async function registerSource(relativePath, expectedHash = null) {
  if (sourceFiles.has(relativePath)) return sourceFiles.get(relativePath);
  const filePath = absolute(relativePath);
  const actualHash = await hashFile(filePath);
  if (expectedHash && actualHash !== expectedHash) throw new Error(`source hash mismatch: ${relativePath}`);
  const record = { path: relativePath, sha256: actualHash };
  sourceFiles.set(relativePath, record);
  return record;
}

async function writeOutput(relativePath, buffer, { kind, sources, format, semanticStates = [] } = {}) {
  const filePath = absolute(relativePath);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  let existingHash = null;
  try {
    existingHash = crypto.createHash("sha256").update(await fs.readFile(filePath)).digest("hex");
  } catch {
    // New runtime derivative.
  }
  const outputHash = crypto.createHash("sha256").update(buffer).digest("hex");
  if (existingHash !== outputHash) await fs.writeFile(filePath, buffer);
  const metadata = await sharp(buffer).metadata();
  outputs[`/${relativePath.replaceAll("\\", "/")}`] = {
    kind,
    format: format ?? metadata.format,
    width: metadata.width,
    height: metadata.height,
    channels: metadata.channels,
    hasAlpha: metadata.hasAlpha === true,
    sha256: crypto.createHash("sha256").update(buffer).digest("hex"),
    sources: [...new Set(sources)],
    semanticStates,
  };
}

function sourceRelFromExisting(relativePath) {
  return relativePath;
}

async function preparedSource(relativePath) {
  await registerSource(relativePath);
  return absolute(relativePath);
}

async function portraitBuffer(sourcePath, width, height) {
  return sharp(sourcePath)
    .trim({ background: TRANSPARENT })
    .resize({ width, height, fit: "contain", background: TRANSPARENT })
    .webp({ quality: 92, alphaQuality: 100 })
    .toBuffer();
}

async function makePortraits(relativePath, stem, sourceLabel) {
  const sourcePath = await preparedSource(relativePath);
  const sourceSet = [sourceLabel];
  await writeOutput(`public/art/v100/portraits/${stem}-event-portrait-v1.webp`, await portraitBuffer(sourcePath, 480, 640), { kind: "event-portrait", sources: sourceSet, format: "webp" });
  await writeOutput(`public/art/v100/portraits/${stem}-dialogue-profile-v1.webp`, await portraitBuffer(sourcePath, 320, 432), { kind: "dialogue-profile", sources: sourceSet, format: "webp" });
}

async function makeCut(relativePath, stem, sourceLabel, backgroundRelativePath, { left, top, height = 670 } = {}) {
  const subjectPath = await preparedSource(relativePath);
  const backgroundPath = await preparedSource(backgroundRelativePath);
  const subject = await sharp(subjectPath).trim({ background: TRANSPARENT }).resize({ height, fit: "inside" }).png().toBuffer();
  const base = sharp(backgroundPath).resize(1600, 900, { fit: "cover" });
  const composed = await base.composite([{ input: subject, left, top }]).webp({ quality: 92 }).toBuffer();
  await writeOutput(`public/art/v100/cuts/${stem}-v1.webp`, composed, { kind: "story-cut", sources: [sourceLabel, sourceRelFromExisting(backgroundRelativePath)], format: "webp" });
}

async function cropObject(sourceRelativePath, outputStem, sourceLabel, extract, width = 520, height = 360, extraSources = []) {
  const sourcePath = await preparedSource(sourceRelativePath);
  // Extract is kept before any trim stage: sharp may reorder trim/extract and
  // reject a valid transparent crop when both are queued on one pipeline.
  const buffer = await sharp(sourcePath).extract(extract).resize({ width, height, fit: "contain", background: TRANSPARENT }).png().toBuffer();
  await writeOutput(`public/art/v100/mission-objects/${outputStem}-v1.png`, buffer, { kind: "mission-object", sources: [sourceLabel, ...extraSources], format: "png" });
}

async function resizedObject(sourceRelativePath, outputStem, sourceLabel, width = 520, height = 300, flop = false) {
  const sourcePath = await preparedSource(sourceRelativePath);
  let pipeline = sharp(sourcePath).trim({ background: TRANSPARENT }).resize({ width, height, fit: "contain", background: TRANSPARENT });
  if (flop) pipeline = pipeline.flop();
  await writeOutput(`public/art/v100/mission-objects/${outputStem}-v1.png`, await pipeline.png().toBuffer(), { kind: "mission-object", sources: [sourceLabel], format: "png" });
}

async function compositeObject(outputStem, sourceSpecs, width = 720, height = 420) {
  const layers = [];
  const sourceLabels = [];
  for (const spec of sourceSpecs) {
    const sourcePath = await preparedSource(spec.path);
    const input = await sharp(sourcePath).trim({ background: TRANSPARENT }).resize({ width: spec.width, height: spec.height, fit: "contain", background: TRANSPARENT }).png().toBuffer();
    layers.push({ input, left: spec.left, top: spec.top });
    sourceLabels.push(spec.label ?? spec.path);
  }
  const output = await sharp({ create: { width, height, channels: 4, background: TRANSPARENT } }).composite(layers).png().toBuffer();
  await writeOutput(`public/art/v100/mission-objects/${outputStem}-v1.png`, output, { kind: "mission-object", sources: sourceLabels, format: "png" });
}

async function stageBackground(outputStem, sourceRelativePath, sourceLabel, overlays, outputName = outputStem) {
  const backgroundPath = await preparedSource(sourceRelativePath);
  const layers = [];
  const sourceLabels = [sourceLabel];
  for (const overlay of overlays) {
    const overlayPath = await preparedSource(overlay.path);
    let objectPipeline = sharp(overlayPath).trim({ background: TRANSPARENT }).resize({ width: overlay.width, height: overlay.height, fit: "contain", background: TRANSPARENT });
    if (overlay.angle) objectPipeline = objectPipeline.rotate(overlay.angle, { background: TRANSPARENT });
    const input = await objectPipeline.png().toBuffer();
    if (overlay.shadow) {
      const shadowWidth = overlay.shadow.width ?? overlay.width;
      const shadowHeight = overlay.shadow.height ?? Math.max(24, Math.round(overlay.height * 0.18));
      const shadowOpacity = overlay.shadow.opacity ?? 0.34;
      const shadow = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${shadowWidth}" height="${shadowHeight}"><defs><filter id="blur" x="-30%" y="-80%" width="160%" height="260%"><feGaussianBlur stdDeviation="${overlay.shadow.blur ?? 14}" /></filter></defs><ellipse cx="${shadowWidth / 2}" cy="${shadowHeight / 2}" rx="${shadowWidth * 0.42}" ry="${shadowHeight * 0.22}" fill="#071016" fill-opacity="${shadowOpacity}" filter="url(#blur)" /></svg>`);
      layers.push({ input: shadow, left: Math.round(overlay.left + (overlay.shadow.left ?? 0)), top: Math.round(overlay.top + (overlay.shadow.top ?? overlay.height - shadowHeight * 0.45)) });
    }
    layers.push({ input, left: overlay.left, top: overlay.top });
    sourceLabels.push(overlay.label ?? overlay.path);
  }
  const output = await sharp(backgroundPath).resize(1600, 900, { fit: "cover" }).composite(layers).webp({ quality: 91 }).toBuffer();
  await writeOutput(`public/art/v100/stages/${outputName}-background-v1.webp`, output, { kind: "stage-background", sources: sourceLabels, format: "webp" });
}

async function makeVfx(outputStem, sourceRelativePath, sourceLabel, width = 260, height = 220, flop = false) {
  const sourcePath = await preparedSource(sourceRelativePath);
  let pipeline = sharp(sourcePath).trim({ background: TRANSPARENT }).resize({ width, height, fit: "contain", background: TRANSPARENT });
  if (flop) pipeline = pipeline.flop();
  await writeOutput(`public/art/v100/vfx/${outputStem}-v1.png`, await pipeline.png().toBuffer(), { kind: "vfx", sources: [sourceLabel], format: "png" });
}

async function main() {
  for (const [relativePath, expectedHash] of Object.entries(MASTER_HASHES)) await registerSource(relativePath, expectedHash);
  for (const relativePath of Object.values(EXISTING)) await registerSource(relativePath);

  const segawa = "assets/source/v100/characters/segawa-identity-master-r2.png";
  const president = "assets/source/v100/characters/mugarian-president-identity-master-r2.png";
  const mutatedPresident = "assets/source/v100/enemies/mugarian-president-mutated-identity-master-r4.png";
  const omega = "assets/source/v100/enemies/takuya-omega-identity-master-r2.png";
  const commander = "assets/source/v100/enemies/red-panther-commander-identity-master-r1.png";
  const minor = "assets/source/v100/portraits/minor-human-shared-event-silhouette-r2.png";

  const motionRecords = await buildV100MotionAtlases();
  for (const record of motionRecords) {
    if (record.source) await registerSource(record.source.path, record.source.sha256);
    if (record.output) outputs[record.output.path] = record.output;
  }

  await makePortraits(segawa, "segawa", segawa);
  await makePortraits(president, "mugarian-president", president);
  await makePortraits(mutatedPresident, "mugarian-president-mutated", mutatedPresident);
  await makePortraits(omega, "takuya-omega", omega);
  await makePortraits(commander, "red-panther-commander", commander);
  await makePortraits(minor, "minor-human-shared-event-silhouette", minor);

  await makeCut(segawa, "segawa-private-lab-reveal", segawa, EXISTING.researchContainment, { left: 115, top: 105, height: 660 });
  await makeCut(president, "mugarian-president-executive-lab", president, EXISTING.researchAccess, { left: 1030, top: 105, height: 660 });
  await makeCut(mutatedPresident, "mugarian-president-defeat", mutatedPresident, EXISTING.researchContainment, { left: 900, top: 80, height: 730 });
  await makeCut(omega, "takuya-omega-ending-defeat", omega, EXISTING.defenseLine, { left: 820, top: 55, height: 760 });

  await cropObject(EXISTING.gateObjects, "clinical-trial-wing", EXISTING.gateObjects, { left: 960, top: 180, width: 600, height: 680 }, 460, 420);
  await cropObject(EXISTING.tunnelObjects, "red-panther-armory-lockers", EXISTING.tunnelObjects, { left: 0, top: 180, width: 880, height: 680 }, 520, 420);
  await resizedObject(EXISTING.coastalRig, "twin-reactor-landmark", EXISTING.coastalRig, 620, 320);
  await cropObject(EXISTING.tunnelObjects, "president-arena-terminal", EXISTING.tunnelObjects, { left: 850, top: 160, width: 700, height: 680 }, 520, 420);
  await resizedObject(EXISTING.maintenanceCart, "escort-cart-intact", EXISTING.maintenanceCart, 660, 300);
  await resizedObject(EXISTING.maintenanceCart, "escort-cart-damaged", EXISTING.maintenanceCart, 610, 270, true);
  for (let index = 0; index < 4; index += 1) {
    await resizedObject(EXISTING.coastalRig, `national-dispersal-node-${index + 1}`, EXISTING.coastalRig, 250 + index * 12, 150 + index * 8, index % 2 === 1);
  }
  await cropObject(EXISTING.gateObjects, "high-security-research-core-gate", EXISTING.gateObjects, { left: 400, top: 160, width: 900, height: 680 }, 560, 430);
  await compositeObject("stage30-aftermath-core", [
    { path: EXISTING.infectionNestDestroyed, label: EXISTING.infectionNestDestroyed, width: 390, height: 290, left: 0, top: 110 },
    { path: EXISTING.transmitterDamaged, label: EXISTING.transmitterDamaged, width: 280, height: 340, left: 360, top: 40 },
  ], 720, 420);

  // The v080 research/hospital plates contain guide arrows and geometric
  // markers intended for layout review.  V1 runtime scenes use clean v090
  // production plates instead; gameplay guidance belongs to the UI layer.
  await stageBackground("s21-mugarian-hq", EXISTING.bayTower, EXISTING.bayTower, [], "s21-mugarian-hq-clean");
  await stageBackground("s22-clinical-trial-wing", EXISTING.civicArchive, EXISTING.civicArchive, [
    { path: "public/art/v100/mission-objects/clinical-trial-wing-v1.png", label: "/art/v100/mission-objects/clinical-trial-wing-v1.png", width: 420, height: 390, left: 1110, top: 240 },
  ], "s22-clinical-trial-wing-r2");
  await stageBackground("s23-special-operations-armory", EXISTING.civicArchive, EXISTING.civicArchive, [
    { path: "public/art/v100/mission-objects/red-panther-armory-lockers-v1.png", label: "/art/v100/mission-objects/red-panther-armory-lockers-v1.png", width: 460, height: 360, left: 1100, top: 260 },
  ], "s23-special-operations-armory-r2");
  await stageBackground("s24-tech-tower", EXISTING.bayTower, EXISTING.bayTower, [
    { path: "public/art/v100/mission-objects/twin-reactor-landmark-v1.png", label: "/art/v100/mission-objects/twin-reactor-landmark-v1.png", width: 480, height: 260, left: 1080, top: 260 },
  ]);
  await stageBackground("s25-executive-lab", EXISTING.civicArchive, EXISTING.civicArchive, [
    { path: "public/art/v100/mission-objects/president-arena-terminal-v1.png", label: "/art/v100/mission-objects/president-arena-terminal-v1.png", width: 470, height: 370, left: 1070, top: 230 },
  ], "s25-executive-lab-r2");
  await stageBackground("s26-bay-evacuation-yard", EXISTING.coastalBridge, EXISTING.coastalBridge, [
    { path: "public/art/v100/mission-objects/escort-cart-intact-v1.png", label: "/art/v100/mission-objects/escort-cart-intact-v1.png", width: 610, height: 275, left: 600, top: 460 },
  ], "s26-bay-evacuation-yard-r2");
  await stageBackground("s27-segawa-private-lab", EXISTING.civicArchive, EXISTING.civicArchive, [
    { path: "public/art/v100/mission-objects/clinical-trial-wing-v1.png", label: "/art/v100/mission-objects/clinical-trial-wing-v1.png", width: 390, height: 360, left: 1110, top: 250 },
    { path: "public/art/v100/mission-objects/red-panther-armory-lockers-v1.png", label: "/art/v100/mission-objects/red-panther-armory-lockers-v1.png", width: 360, height: 280, left: 735, top: 350 },
  ], "s27-segawa-private-lab-r2");
  // Four nodes remain authored/runtime assets and are tracked by the
  // objective HUD.  The battlefield plate itself is a clean floodgate
  // installation; pasted trailer copies are intentionally not used as a
  // finished background composition.
  await stageBackground("s28-national-dispersal-network", EXISTING.estuaryFloodgate, EXISTING.estuaryFloodgate, [], "s28-national-dispersal-network-clean");
  await stageBackground("s29-high-security-research-core", EXISTING.bayTower, EXISTING.bayTower, [
    { path: "public/art/v100/mission-objects/high-security-research-core-gate-v1.png", label: "/art/v100/mission-objects/high-security-research-core-gate-v1.png", width: 530, height: 400, left: 1030, top: 220 },
  ], "s29-high-security-research-core-r2");
  await stageBackground("s30-defense-line-aftermath", EXISTING.defenseLine, EXISTING.defenseLine, [
    { path: "public/art/v100/mission-objects/stage30-aftermath-core-v1.png", label: "/art/v100/mission-objects/stage30-aftermath-core-v1.png", width: 600, height: 350, left: 770, top: 360 },
  ]);

  await makeVfx("hq-security-warning", EXISTING.transmitterActive, EXISTING.transmitterActive, 260, 220);
  await makeVfx("armory-red-lens-alert", EXISTING.transmitterDamaged, EXISTING.transmitterDamaged, 260, 220);
  await makeVfx("dispersal-node-active", EXISTING.infectionNestDamaged, EXISTING.infectionNestDamaged, 260, 220);
  await makeVfx("stage30-dawn-damage", EXISTING.infectionNestDestroyed, EXISTING.infectionNestDestroyed, 300, 240);

  const provenance = {
    schema: "v100-runtime-asset-provenance-v1",
    designId: "V100-SOL-DL-001 r2",
    storySha256: STORY_SHA,
    generator: "scripts/build-v100-runtime-assets.mjs",
    policy: "finite-derivatives-from-selected-masters-and-existing-authored-production-sources",
    draftGuideTexturesRemoved: true,
    draftGuideTexturePolicy: "v080 arrow, chevron, route-marker and geometric guide textures are not used in V1 runtime backgrounds",
    privateReferencePhotosIncluded: false,
    rejectedCandidatePathsReferenced: [],
    sources: Object.fromEntries([...sourceFiles.entries()].sort(([left], [right]) => left.localeCompare(right))),
    outputs: Object.fromEntries(Object.entries(outputs).sort(([left], [right]) => left.localeCompare(right))),
  };
  const provenancePath = path.join(SOURCE, "runtime", "v100-runtime-assets-provenance.json");
  await fs.mkdir(path.dirname(provenancePath), { recursive: true });
  await fs.writeFile(provenancePath, `${JSON.stringify(provenance, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ sourceCount: sourceFiles.size, outputCount: Object.keys(outputs).length, provenance: path.relative(ROOT, provenancePath) }, null, 2));
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
