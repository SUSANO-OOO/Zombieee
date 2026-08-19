import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

import { V100_COMBAT_FX_AUDIT, V100_COMBAT_FX_INVENTORY } from "../app/v100CombatPresentation.js";
import { deriveV100ProductionEnemyCoverage, validateV100RepresentativeCombatEvidence, V100_REPRESENTATIVE_COMBAT_CONTRACT } from "../app/v100PhaseGContract.js";
import { validateProductionEnemyRuntimeShards } from "./v0995-enemy-runtime-shards.mjs";

const manifestPath = path.resolve("docs/qa/v100/phase-g-screenshot-manifest.json");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const evidenceDir = path.resolve(process.env.V100_PHASE_G_EVIDENCE_DIR ?? "outputs/v100-phase-g");
const reportPath = path.join(evidenceDir, "phase-g-report.json");
const report = JSON.parse(await readFile(reportPath, "utf8"));
const requiredSequence = ["source", "prep", "travel", "contact", "impact", "target-reaction", "aftermath"];
const requiredCoreStates = ["title-name", "dialogue-left", "dialogue-right", "map-normal", "map-locked-boss", "formation", "personnel", "support-vehicle-management", "battle-normal", "battle-boss", "result-win", "result-lose", "ending", "credits", "epilogue-postgame", "data-management-modal"];
const battleStates = new Set(["battle-normal", "battle-boss", "battle-extra"]);
const expectedCoreViewports = new Set(["1280x720", "844x390", "844x340"]);
const expectedExtraViewports = new Set(["667x375", "736x414", "932x430"]);
const errors = [];
const entries = Array.isArray(manifest.entries) ? manifest.entries : [];
const combatEvidence = Array.isArray(manifest.combatEvidence) ? manifest.combatEvidence : [];
const reportResults = Array.isArray(report.results) ? report.results : [];
const reportByPath = new Map(reportResults.map((entry) => [entry.evidence?.path, entry]));
const inventoryActors = new Set(V100_COMBAT_FX_INVENTORY.map(({ actor }) => actor));
const combatContractsById = new Map(V100_REPRESENTATIVE_COMBAT_CONTRACT.map((contract) => [contract.id, contract]));
const expectedEnemyCoverage = deriveV100ProductionEnemyCoverage();
const runtimeShardContract = validateProductionEnemyRuntimeShards();

function diagnosticsClean(diagnostics) {
  return [diagnostics?.consoleErrors, diagnostics?.pageErrors, diagnostics?.requestFailures, diagnostics?.httpFailures]
    .every((entries) => Array.isArray(entries) && entries.length === 0);
}

function fail(condition, message) { if (!condition) errors.push(message); }

fail(manifest.schemaVersion === 3, `schemaVersion ${manifest.schemaVersion}`);
fail(manifest.route === "/Zombieee/v100", "route mismatch");
fail(report.route === "/Zombieee/v100", "runtime report route mismatch");
fail(manifest.totalScreenshots === 54, `manifest total ${manifest.totalScreenshots}`);
fail(entries.length === 54, `entry count ${entries.length}`);
fail(manifest.runtimeContractVersion === 2, `runtimeContractVersion ${manifest.runtimeContractVersion}`);
fail(manifest.coreStateCount === 16, `coreStateCount ${manifest.coreStateCount}`);
fail(manifest.combatEvidenceCount === 16, `combatEvidenceCount ${manifest.combatEvidenceCount}`);
fail(Array.isArray(manifest.requiredEngines) && new Set(manifest.requiredEngines).size === 2 && new Set(manifest.requiredEngines).has("chromium") && new Set(manifest.requiredEngines).has("webkit"), "engine contract incomplete");
fail(Array.isArray(manifest.requiredCoreViewports) && new Set(manifest.requiredCoreViewports).size === 3 && [...expectedCoreViewports].every((viewport) => manifest.requiredCoreViewports.includes(viewport)), "core viewport contract incomplete");
fail(Array.isArray(manifest.additionalBattleViewports) && new Set(manifest.additionalBattleViewports).size === 3 && [...expectedExtraViewports].every((viewport) => manifest.additionalBattleViewports.includes(viewport)), "extra battle viewport contract incomplete");
fail(Array.isArray(manifest.requiredCoreStates) && JSON.stringify(manifest.requiredCoreStates) === JSON.stringify(requiredCoreStates), "required core state contract incomplete");
fail(new Set(entries.map(({ id }) => id)).size === entries.length, "duplicate entry IDs");
fail(new Set(entries.map(({ evidence }) => evidence)).size === entries.length, "duplicate evidence paths");

const coreEntries = entries.filter(({ category }) => category === "core");
const extraEntries = entries.filter(({ category }) => category === "battle-extra");
fail(coreEntries.length === 48, `core entry count ${coreEntries.length}`);
fail(extraEntries.length === 6, `extra battle entry count ${extraEntries.length}`);
for (const state of requiredCoreStates) {
  const stateEntries = coreEntries.filter((entry) => entry.state === state);
  fail(stateEntries.length === 3, `${state} core coverage ${stateEntries.length}`);
  fail(new Set(stateEntries.map(({ viewport }) => viewport)).size === 3, `${state} core viewport duplicate`);
}
for (const entry of entries) {
  const expected = entry.category === "core" ? expectedCoreViewports : expectedExtraViewports;
  fail(expected.has(entry.viewport), `${entry.id} viewport ${entry.viewport}`);
  fail(entry.category === "core" ? entry.engine === "chromium" : ["chromium", "webkit"].includes(entry.engine), `${entry.id} engine ${entry.engine}`);
  fail(typeof entry.evidence === "string" && entry.evidence.length > 0, `${entry.id} missing evidence path`);
  fail(typeof entry.evidence === "string" && entry.evidence.startsWith("outputs/v100-phase-g/"), `${entry.id} evidence outside Phase G output`);
  const reportEntry = reportByPath.get(entry.evidence);
  fail(Boolean(reportEntry), `${entry.id} missing runtime report linkage`);
  const productionContract = reportEntry?.productionContract;
  fail(productionContract?.ok === true, `${entry.id} production state contract failed`);
  fail(Number(productionContract?.observed?.bodyTextLength) > 0, `${entry.id} production body is blank`);
  fail(Array.isArray(productionContract?.expected?.selectors) && productionContract.expected.selectors.every((selector) => productionContract.observed?.selectorHits?.[selector] === true), `${entry.id} required production selector missing`);
  if (battleStates.has(entry.state)) {
    const runtime = reportEntry?.runtime;
    fail(runtime?.screen === "battle", `${entry.id} is not an actual mounted battle screen`);
    fail(Array.isArray(runtime?.fighters) && runtime.fighters.some((fighter) => fighter.hp > 0), `${entry.id} has no live combat fighter`);
    fail((runtime?.attackIdentity?.length ?? 0) > 0 || (runtime?.pendingWeaponHits?.length ?? 0) > 0 || (runtime?.battlePresentationEffects?.length ?? 0) > 0, `${entry.id} has no combat presentation activity`);
    fail(reportEntry?.combatCausalProof?.ok === true, `${entry.id} causal combat proof is incomplete`);
    fail((reportEntry?.productionContract?.observed?.canvas?.visiblePixels ?? 0) > 0, `${entry.id} canvas has no visible production pixels`);
    if (entry.state === "battle-boss") fail(runtime?.fighters?.some((fighter) => fighter.side === "zombie" && fighter.kind === "takuya-omega" && fighter.hp > 0), `${entry.id} has no TAKUYA-Ω boss HUD runtime`);
  }
}
fail(combatEvidence.length === 16, `combat evidence rows ${combatEvidence.length}`);
fail(new Set(combatEvidence.map(({ id }) => id)).size === combatEvidence.length, "duplicate combat evidence IDs");
fail(new Set(combatEvidence.map(({ actor }) => actor)).size === combatEvidence.length, "duplicate combat evidence actors");
fail(combatEvidence.length === V100_REPRESENTATIVE_COMBAT_CONTRACT.length, `combat evidence contract count ${combatEvidence.length}`);
for (const contract of V100_REPRESENTATIVE_COMBAT_CONTRACT) fail(combatEvidence.some((evidence) => evidence.id === contract.id), `required combat contract missing: ${contract.id}`);
for (const evidence of combatEvidence) {
  const contract = combatContractsById.get(evidence.id);
  fail(typeof evidence.actor === "string" && inventoryActors.has(evidence.actor), `${evidence.id} actor not in inventory`);
  fail(Boolean(contract), `${evidence.id} has no canonical representative contract`);
  for (const field of ["action", "source", "contactImpact", "reaction", "state"]) fail(typeof evidence[field] === "string" && evidence[field].length > 0, `${evidence.id} missing ${field}`);
  fail(Array.isArray(evidence.seVfx) && evidence.seVfx.length > 0, `${evidence.id} missing SE/VFX evidence`);
  fail(Array.isArray(evidence.runtimeSequence) && JSON.stringify(evidence.runtimeSequence) === JSON.stringify(requiredSequence), `${evidence.id} causal sequence mismatch`);
  fail(evidence.captureVariant === contract?.captureVariant, `${evidence.id} capture variant mismatch`);
  const linkedEntry = entries.find((entry) => entry.evidence === evidence.evidence);
  const linkedReport = reportResults.find((entry) => entry.variant === evidence.captureVariant);
  fail(Boolean(linkedEntry) && battleStates.has(linkedEntry.state), `${evidence.id} screenshot is not an actual battle entry`);
  fail(typeof evidence.evidence === "string" && reportByPath.has(evidence.evidence), `${evidence.id} screenshot linkage missing`);
  fail(Boolean(linkedReport), `${evidence.id} production capture variant missing`);
  fail(linkedReport?.productionContract?.ok === true, `${evidence.id} production state contract failed`);
  fail(linkedReport?.combatCausalProof?.ok === true, `${evidence.id} causal runtime proof failed`);
  fail(diagnosticsClean(linkedReport?.diagnostics), `${evidence.id} linked capture has diagnostics`);
  fail(typeof evidence.runtimeEvidence === "string" && evidence.runtimeEvidence.startsWith("outputs/v100-phase-g/combat/"), `${evidence.id} runtime evidence path invalid`);
  let runtimeEvidence = null;
  try {
    runtimeEvidence = JSON.parse(await readFile(path.resolve(evidence.runtimeEvidence), "utf8"));
    fail(runtimeEvidence.id === evidence.id, `${evidence.id} runtime evidence ID mismatch`);
    fail(runtimeEvidence.captureVariant === evidence.captureVariant, `${evidence.id} runtime evidence variant mismatch`);
    fail(JSON.stringify(runtimeEvidence.checkpoints) === JSON.stringify(requiredSequence), `${evidence.id} runtime checkpoints incomplete`);
    fail(runtimeEvidence.productionContract?.ok === true, `${evidence.id} runtime evidence production contract failed`);
    fail(runtimeEvidence.combatCausalProof?.ok === true, `${evidence.id} runtime evidence causal proof failed`);
    fail(diagnosticsClean(runtimeEvidence.diagnostics), `${evidence.id} runtime evidence diagnostics`);
    fail(typeof runtimeEvidence.stageId === "string" && runtimeEvidence.stageId.length > 0, `${evidence.id} runtime stage missing`);
  } catch (error) {
    errors.push(`${evidence.id} runtime evidence unreadable: ${String(error)}`);
  }
  const contractValidation = validateV100RepresentativeCombatEvidence({ contract, evidence, runtimeEvidence });
  fail(contractValidation.ok, `${evidence.id} canonical evidence mismatch: ${contractValidation.errors.join(", ")}`);
}
const enemyCoverage = manifest.enemyRuntimeCoverage;
fail(enemyCoverage?.expectedCount === expectedEnemyCoverage.expectedCount, `enemy expected count ${enemyCoverage?.expectedCount}`);
fail(Array.isArray(enemyCoverage?.requiredEnemyKinds) && JSON.stringify(enemyCoverage.requiredEnemyKinds) === JSON.stringify(expectedEnemyCoverage.requiredEnemyKinds), "enemy expected set is not canonical");
fail(enemyCoverage?.shardContractValid === true && runtimeShardContract.valid === true, "enemy runtime shard contract is not green");
fail(Number(enemyCoverage?.shardCount) === 6 && runtimeShardContract.shardCount === 6, "enemy runtime shard count is not six");
fail(Array.isArray(enemyCoverage?.runtimeSpriteStateMissing) && enemyCoverage.runtimeSpriteStateMissing.length === 0, "required runtime sprite/state missing");
fail(Array.isArray(enemyCoverage?.unknownReachableKinds) && enemyCoverage.unknownReachableKinds.length === 0, "unknown reachable enemy kind");
fail(Array.isArray(enemyCoverage?.missingBossKinds) && enemyCoverage.missingBossKinds.length === 0, "missing reachable boss kind");
fail(Array.isArray(enemyCoverage?.unreachableRegisteredKinds) && enemyCoverage.unreachableRegisteredKinds.length === 0, "unreachable registered enemy kind");
fail(enemyCoverage?.runtimeHarnessCoverage?.valid === true, "candidate enemy runtime harness coverage is not green");
fail(Array.isArray(enemyCoverage?.runtimeHarnessCoverage?.missing) && enemyCoverage.runtimeHarnessCoverage.missing.length === 0, "candidate enemy runtime harness missing coverage");
fail(Array.isArray(enemyCoverage?.runtimeHarnessCoverage?.duplicateCoverage) && enemyCoverage.runtimeHarnessCoverage.duplicateCoverage.length === 0, "candidate enemy runtime harness duplicate coverage");
fail(Array.isArray(enemyCoverage?.runtimeHarnessCoverage?.unknown) && enemyCoverage.runtimeHarnessCoverage.unknown.length === 0, "candidate enemy runtime harness unknown coverage");
fail(Array.isArray(enemyCoverage?.runtimeHarnessCoverage?.runtimeSpriteStateMissing) && enemyCoverage.runtimeHarnessCoverage.runtimeSpriteStateMissing.length === 0, "candidate enemy runtime harness sprite/state missing");
fail(V100_COMBAT_FX_AUDIT.ok, `combat inventory: ${V100_COMBAT_FX_AUDIT.errors.join(", ")}`);
fail(V100_COMBAT_FX_AUDIT.unclassifiedCount === 0, `combat inventory unclassified ${V100_COMBAT_FX_AUDIT.unclassifiedCount}`);
fail(V100_COMBAT_FX_AUDIT.unfinishedRefineCount === 0, `combat inventory unfinished REFINE ${V100_COMBAT_FX_AUDIT.unfinishedRefineCount}`);
fail(V100_COMBAT_FX_AUDIT.replaceIncompleteCount === 0, `combat inventory unfinished REPLACE ${V100_COMBAT_FX_AUDIT.replaceIncompleteCount}`);

const hashes = new Set();
const paths = new Set();
for (const entry of entries) {
  const filePath = path.resolve(entry.evidence);
  try {
    const bytes = await readFile(filePath);
    const metadata = await sharp(bytes).metadata();
    const imageStats = await sharp(bytes).greyscale().stats();
    const [width, height] = entry.viewport.split("x").map(Number);
    fail(metadata.format === "png", `${entry.id} is not PNG`);
    fail(metadata.width === width && metadata.height === height, `${entry.id} dimensions ${metadata.width}x${metadata.height}, expected ${width}x${height}`);
    fail(Number(imageStats.channels?.[0]?.stdev ?? 0) > 2, `${entry.id} screenshot lacks visual variation`);
    const hash = createHash("sha256").update(bytes).digest("hex");
    fail(!paths.has(filePath), `${entry.id} duplicate file path`);
    fail(!hashes.has(hash), `${entry.id} duplicate content hash`);
    paths.add(filePath);
    hashes.add(hash);
    const runtime = reportByPath.get(entry.evidence);
    fail(Boolean(runtime?.evidence?.sha256) && runtime.evidence.sha256 === hash, `${entry.id} report hash mismatch`);
  } catch (error) {
    errors.push(`${entry.id} evidence unreadable: ${String(error)}`);
  }
}
fail(paths.size === 54, `unique image paths ${paths.size}`);
fail(hashes.size === 54, `unique image hashes ${hashes.size}`);
fail(reportResults.length === 54, `runtime capture result count ${reportResults.length}`);
fail(Number(report.pwaOfferShownCount) > 0, "PWA offer was not observed in the production matrix");
fail(new Set(reportResults.map((entry) => entry.evidence?.path)).size === 54, `runtime report unique paths ${new Set(reportResults.map((entry) => entry.evidence?.path)).size}`);
fail([...new Set(entries.map((entry) => entry.evidence))].every((evidence) => reportByPath.has(evidence)), "runtime report is missing a manifest path");

if (errors.length > 0) throw new Error(`Phase G manifest validation failed:\n${errors.join("\n")}`);
console.log(JSON.stringify({ status: "passed", entries: entries.length, uniqueImages: paths.size, uniqueHashes: hashes.size, combatEvidence: combatEvidence.length, evidenceDir }, null, 2));
