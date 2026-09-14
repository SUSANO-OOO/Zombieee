import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";

const useCurrentWebKit = process.env.NEW_V100_NATIVE_CURRENT_WEBKIT === "1";
const { chromium, webkit } = await import(
  useCurrentWebKit ? "./pwa-native-runtime/node_modules/playwright/index.mjs" : "playwright",
);
import { createDefaultV100Save, normalizeV100Save, serializeV100Save } from "../app/v100Save.js";
import { V100_INITIAL_UNIT_IDS, V100_STAGE_IDS, V100_VEHICLE } from "../app/v100Registry.js";
import { createBattleDefinition } from "../app/battleDefinitions.js";
import { spriteFrameFor } from "../app/spriteManifest.js";
import { TAKUYA_SLAM_PRESENTATION } from "../app/v100TakuyaPresentation.js";
import { normalTacticalInput } from "./v100-normal-tactical-input.mjs";
import { productionBuildIdentity } from "./browser-qa-build-identity.mjs";

const origin = process.env.V100_CAMPAIGN_QA_BASE_URL;
const engine = process.env.V100_TAKUYA_SLAM_ENGINE ?? "chromium";
const out = process.env.V100_TAKUYA_SLAM_OUT ?? "outputs/v100-takuya-slam-r1";
const viewport = { width: 844, height: 340 };
const RECOVERY_SECONDS = .10;
const TAKUYA_SPRITE_PATH = spriteFrameFor("takuya", "idle", "right").path;

assert.ok(["chromium", "webkit"].includes(engine), "engine must be chromium or webkit");
// Control: an ordinary attack-b frame is never a slam without a positive
// takuyaSlamPresentationRemaining observed after the same boss windup.
const isSlamActive = (sample, activation) => Boolean(
  activation && sample.id === activation.id && sample.remaining > 0 && sample.spriteState === "attack-b",
);
assert.equal(isSlamActive({ id: 7, remaining: 0, spriteState: "attack-b" }, { id: 7 }), false);
assert.equal(isSlamActive({ id: 7, remaining: .2, spriteState: "attack-b" }, { id: 7 }), true);
assert.equal(TAKUYA_SLAM_PRESENTATION.impactSeconds, .24);
assert.equal(TAKUYA_SLAM_PRESENTATION.recoverySeconds, .10);

function installTakuyaSlamSampler(options = 400, injectedRuntime = null) {
  const configured = typeof options === "object" ? options : { maxSamples: options };
  const maxSamples = Number(configured.maxSamples) || 400;
  const expectedSpritePath = configured.spritePath ?? null;
  const windowRef = injectedRuntime?.windowRef ?? window;
  const documentRef = injectedRuntime?.documentRef ?? document;
  const impactSeconds = .24;
  const recoverySeconds = .10;
  const isSlamActiveSample = (sample, activation) => Boolean(
    activation && sample.id === activation.id && sample.remaining > 0 && sample.spriteState === "attack-b",
  );
  const state = {
    running: false,
    samples: [],
    seenRenderSequences: new Set(),
    captures: new Map(),
    activation: null,
    nextActivation: 0,
    invalidRemaining: false,
    missingApi: false,
    joinFailures: [],
    timeMismatches: [],
    missingSkillContacts: false,
    skillContractFailures: [],
  };
  const copyCanvas = (name) => {
    if (state.captures.has(name)) return;
    const source = documentRef.querySelector(".game-shell canvas");
    if (!source) return;
    const copy = documentRef.createElement("canvas");
    copy.width = source.width; copy.height = source.height;
    copy.getContext("2d").drawImage(source, 0, 0);
    state.captures.set(name, copy);
  };
  const sample = () => {
    const qa = windowRef.__ASHFALL_BATTLE_QA__;
    if (typeof qa?.getSnapshot !== "function" || typeof qa?.getPhaseGCombatSnapshot !== "function") {
      state.missingApi = true;
      return;
    }
    // Both QA views are read synchronously in this one rAF callback. The phase-G
    // view owns the presentation timer; the ordinary view owns renderAudit.
    const snapshot = qa.getSnapshot();
    const phaseSnapshot = qa.getPhaseGCombatSnapshot();
    const snapshotTime = Number(snapshot?.time);
    const phaseTime = Number(phaseSnapshot?.time);
    if (!Number.isFinite(snapshotTime) || !Number.isFinite(phaseTime)) return;
    if (snapshotTime !== phaseTime) {
      state.timeMismatches.push({ snapshotTime, phaseTime });
      return;
    }
    const boss = snapshot?.fighters?.find((fighter) => fighter.kind === "takuya" && fighter.hp > 0);
    const phaseBoss = phaseSnapshot?.fighters?.find((fighter) => fighter.kind === "takuya" && fighter.hp > 0);
    if (!boss || !phaseBoss) return;
    if (boss.id !== phaseBoss.id) {
      state.joinFailures.push({ snapshotId: boss.id, phaseId: phaseBoss.id });
      return;
    }
    if (!Array.isArray(snapshot?.v100SkillContacts)) {
      state.missingSkillContacts = true;
      return;
    }
    const audit = boss.renderAudit ?? null;
    if (expectedSpritePath && audit?.spritePath !== expectedSpritePath) return;
    const renderSequence = Number(audit?.renderSequence);
    if (!Number.isFinite(renderSequence) || state.seenRenderSequences.has(renderSequence)) return;
    state.seenRenderSequences.add(renderSequence);
    const rawRemaining = phaseBoss.takuyaSlamPresentationRemaining;
    const phaseTimerPresent = rawRemaining !== undefined;
    const remaining = rawRemaining === undefined ? 0 : Number(rawRemaining);
    if (!Number.isFinite(remaining)) { state.invalidRemaining = true; return; }
    const entry = {
      time: phaseTime,
      snapshotTime,
      phaseTime,
      id: boss.id,
      hp: boss.hp,
      maxHp: boss.maxHp,
      abilityWindup: boss.abilityWindup,
      remaining,
      phaseTimerPresent,
      renderDirection: audit?.direction ?? null,
      frameFlipX: audit?.frameFlipX ?? null,
      skillContacts: snapshot.v100SkillContacts,
      vfxExpired: false,
      spriteState: audit?.spriteState ?? null,
      spritePath: audit?.spritePath ?? null,
      renderSequence,
      combatReady: boss.combatReady === true,
      gateEntering: boss.gateEntering === true,
    };
    if (entry.abilityWindup > 0 && entry.remaining === 0
      && (!state.activation || state.activation.id !== entry.id || !state.activation.inWindup)) {
      state.activation = { id: entry.id, activationId: ++state.nextActivation, hadPositive: false, restored: false, inWindup: true, skillStartedAt: null, skillContactSeen: false, skillContactResolved: false, skillExpiryCaptured: false };
      copyCanvas(`${state.activation.activationId}-windup`);
    }
    const allSkillContacts = snapshot.v100SkillContacts.filter((contact) => (
      contact?.sourceId === "takuya-battle-repaired-v1"
      && contact?.kind === "takuya-ground-blade"
    ));
    const skillContacts = allSkillContacts.filter((contact) => contact?.ownerId === entry.id);
    if (entry.abilityWindup > 0 && allSkillContacts.length > 0) {
      state.skillContractFailures.push({ type: "windup-ground-contact", time: entry.time });
    }
    if (allSkillContacts.some((contact) => contact?.ownerId !== entry.id)) {
      state.skillContractFailures.push({ type: "wrong-owner", time: entry.time });
    }
    if (skillContacts.length > 0 && state.activation?.id === entry.id) {
      const expectedStartedAt = Number.isFinite(state.activation.skillStartedAt)
        ? state.activation.skillStartedAt
        : (entry.remaining > 0 ? entry.time - (impactSeconds - entry.remaining) : null);
      for (const contact of skillContacts) {
        if (!Number.isFinite(contact.startedAt)) {
          state.skillContractFailures.push({ type: "nonfinite-startedAt", time: entry.time });
          continue;
        }
        if (Number.isFinite(expectedStartedAt) && Math.abs(contact.startedAt - expectedStartedAt) > 1e-6) {
          state.skillContractFailures.push({ type: "startedAt-mismatch", time: entry.time, expected: expectedStartedAt, actual: contact.startedAt });
          continue;
        }
        const resolved = contact.resolvedSocket && [contact.resolvedSocket.x, contact.resolvedSocket.y].every(Number.isFinite);
        if (!resolved) state.skillContractFailures.push({ type: "unresolved-ground-contact", time: entry.time });
        if (entry.remaining > 0 && !Number.isFinite(state.activation.skillStartedAt)) {
          state.activation.skillStartedAt = expectedStartedAt;
        }
        state.activation.skillContactSeen = true;
        state.activation.skillContactResolved ||= resolved;
      }
    }
    if (state.activation?.id === entry.id && state.activation.skillContactSeen
      && Number.isFinite(state.activation.skillStartedAt)
      && entry.time - state.activation.skillStartedAt >= .6
      && skillContacts.length === 0) {
      entry.vfxExpired = true;
      if (!state.activation.skillExpiryCaptured) copyCanvas(`${state.activation.activationId}-vfx-expired`);
      state.activation.skillExpiryCaptured = true;
    }
    if (state.activation?.id === entry.id && entry.remaining > 0) {
      state.activation.hadPositive = true;
      state.activation.inWindup = false;
      if (isSlamActiveSample(entry, state.activation) && entry.remaining <= impactSeconds) copyCanvas(`${state.activation.activationId}-impact`);
      else if (entry.remaining <= recoverySeconds && entry.spriteState === "walk-a") copyCanvas(`${state.activation.activationId}-recovery`);
    }
    if (state.activation?.hadPositive && state.activation.id === entry.id && entry.remaining === 0 && entry.abilityWindup === 0
      && entry.hp > 0 && entry.combatReady && !entry.gateEntering && ["idle", "walk-a", "walk-b"].includes(entry.spriteState)) {
      copyCanvas(`${state.activation.activationId}-restored`);
      state.activation.restored = true;
    }
    entry.slamActivationId = state.activation?.id === entry.id ? state.activation.activationId : null;
    state.samples.push(entry);
    if (state.samples.length > maxSamples) state.samples.splice(0, state.samples.length - maxSamples);
    while (state.seenRenderSequences.size > maxSamples * 2) state.seenRenderSequences.delete(state.seenRenderSequences.values().next().value);
    while (state.captures.size > 32) state.captures.delete(state.captures.keys().next().value);
  };
  const frame = () => { if (state.running) { sample(); windowRef.requestAnimationFrame(frame); } };
  windowRef.__V100_TAKUYA_SLAM_QA__ = {
    start() { state.running = true; windowRef.requestAnimationFrame(frame); },
    stop() { state.running = false; },
    samples() { return state.samples.slice(); },
    invalidRemaining() { return state.invalidRemaining; },
    missingApi() { return state.missingApi; },
    joinFailures() { return state.joinFailures.slice(); },
    timeMismatches() { return state.timeMismatches.slice(); },
    missingSkillContacts() { return state.missingSkillContacts; },
    skillContractFailures() { return state.skillContractFailures.slice(); },
    captureNames() { return [...state.captures.keys()]; },
    exportCaptures() {
      return Object.fromEntries([...state.captures].map(([name, canvas]) => [name, canvas.toDataURL("image/png")]));
    },
  };
}

function runSamplerControl() {
  const snapshots = [
    { time: 1, fighters: [{ kind: "takuya", id: 7, hp: 1600, maxHp: 1600, abilityWindup: .2, combatReady: true, gateEntering: false, renderAudit: { renderSequence: 1, spriteState: "attack-a", spritePath: TAKUYA_SPRITE_PATH, direction: "left", frameFlipX: false } }] },
    { time: 2, fighters: [{ kind: "takuya", id: 7, hp: 1600, maxHp: 1600, abilityWindup: 0, combatReady: true, gateEntering: false, renderAudit: { renderSequence: 2, spriteState: "attack-b", spritePath: TAKUYA_SPRITE_PATH, direction: "left", frameFlipX: false } }] },
    { time: 2.05, fighters: [{ kind: "takuya", id: 7, hp: 1600, maxHp: 1600, abilityWindup: 0, combatReady: true, gateEntering: false, renderAudit: { renderSequence: 3, spriteState: "walk-a", spritePath: TAKUYA_SPRITE_PATH, direction: "left", frameFlipX: false } }] },
    { time: 2.2, fighters: [{ kind: "takuya", id: 7, hp: 1600, maxHp: 1600, abilityWindup: 0, combatReady: true, gateEntering: false, renderAudit: { renderSequence: 4, spriteState: "idle", spritePath: TAKUYA_SPRITE_PATH, direction: "left", frameFlipX: false } }] },
    { time: 2.25, fighters: [{ kind: "takuya", id: 7, hp: 1600, maxHp: 1600, abilityWindup: 0, combatReady: true, gateEntering: false, renderAudit: { renderSequence: 4, spriteState: "idle", spritePath: TAKUYA_SPRITE_PATH, direction: "left", frameFlipX: false } }] },
    { time: 2.3, fighters: [{ kind: "takuya", id: 7, hp: 1600, maxHp: 1600, abilityWindup: 0, combatReady: true, gateEntering: false, renderAudit: { renderSequence: 6, spriteState: "attack-b", spritePath: TAKUYA_SPRITE_PATH, direction: "left", frameFlipX: false } }] },
    { time: 2.65, fighters: [{ kind: "takuya", id: 7, hp: 1600, maxHp: 1600, abilityWindup: 0, combatReady: true, gateEntering: false, renderAudit: { renderSequence: 8, spriteState: "idle", spritePath: TAKUYA_SPRITE_PATH, direction: "left", frameFlipX: false } }] },
    { time: 3, fighters: [{ kind: "takuya", id: 8, hp: 1600, maxHp: 1600, abilityWindup: 0, combatReady: true, gateEntering: false, renderAudit: { renderSequence: 9, spriteState: "attack-b", spritePath: TAKUYA_SPRITE_PATH, direction: "left", frameFlipX: false } }] },
  ];
  const phaseSnapshots = snapshots.map((snapshot, index) => ({
    ...snapshot,
    fighters: snapshot.fighters.map((fighter) => ({
      ...fighter,
      ...(index === 0 ? { takuyaSlamPresentationRemaining: 0 } : {}),
      ...(index === 1 ? { takuyaSlamPresentationRemaining: .24 } : {}),
      ...(index === 2 ? { takuyaSlamPresentationRemaining: .05 } : {}),
      ...(index === 5 ? { takuyaSlamPresentationRemaining: 0 } : {}),
      ...(index === 7 ? { id: 9, takuyaSlamPresentationRemaining: .2 } : {}),
    })),
  }));
  const normalSnapshots = snapshots.map((snapshot, index) => ({
    ...snapshot,
    v100SkillContacts: index === 1 || index === 2
      ? [{ sourceId: "takuya-battle-repaired-v1", kind: "takuya-ground-blade", ownerId: 7, startedAt: 2, duration: .6, resolvedSocket: { x: 300, y: 220 } }]
      : [],
  }));
  let index = 0;
  const raf = [];
  const fakeCanvas = { width: 8, height: 8, getContext: () => ({ drawImage() {} }), toDataURL: () => "data:image/png;base64,AA==" };
  const fakeWindow = { __ASHFALL_BATTLE_QA__: {
    getSnapshot: () => normalSnapshots[Math.min(index, normalSnapshots.length - 1)],
    getPhaseGCombatSnapshot: () => phaseSnapshots[Math.min(index, phaseSnapshots.length - 1)],
  }, requestAnimationFrame: (callback) => raf.push(callback) };
  const fakeDocument = { querySelector: () => fakeCanvas, createElement: () => fakeCanvas };
  // Exercise the exact function source sent through Playwright's addInitScript serialization.
  const serialized = Function(`return (${installTakuyaSlamSampler.toString()})`)();
  serialized({ maxSamples: 16, spritePath: TAKUYA_SPRITE_PATH }, { windowRef: fakeWindow, documentRef: fakeDocument });
  fakeWindow.__V100_TAKUYA_SLAM_QA__.start();
  for (index = 0; index < snapshots.length; index += 1) raf.shift()?.();
  const samples = fakeWindow.__V100_TAKUYA_SLAM_QA__.samples();
  assert.equal(samples.length, 6, "sampler deduplicates duplicate renderSequence and fails closed on a different fighter ID");
  assert.ok(samples.some((sample) => sample.spriteState === "attack-b" && sample.remaining > 0), "control sees slam attack-b");
  assert.equal(samples.filter((sample) => sample.spriteState === "attack-b" && sample.remaining === 0).length, 1, "control retains ordinary attack-b as non-slam data only");
  assert.equal(samples.find((sample) => sample.renderSequence === 8)?.remaining, 0, "omitted remaining is the QA-contract zero outside impact");
  assert.equal(samples.find((sample) => sample.renderSequence === 2)?.phaseTimerPresent, true, "phase-G positive timer is present");
  assert.ok(samples.every((sample) => sample.renderDirection === "left" && sample.frameFlipX === false), "control records left-native unflipped rendering");
  assert.equal(samples.find((sample) => sample.renderSequence === 8)?.vfxExpired, true, "ground contact expires after .6 seconds");
  assert.equal(samples.find((sample) => sample.renderSequence === 9), undefined, "different fighter IDs are never joined");
  assert.deepEqual(fakeWindow.__V100_TAKUYA_SLAM_QA__.joinFailures(), [{ snapshotId: 8, phaseId: 9 }], "different IDs fail closed");
  assert.deepEqual(fakeWindow.__V100_TAKUYA_SLAM_QA__.skillContractFailures(), [], "ground contact contract has no violations");
  assert.equal(fakeWindow.__V100_TAKUYA_SLAM_QA__.missingSkillContacts(), false, "normal snapshot exposes v100SkillContacts");
  assert.deepEqual(fakeWindow.__V100_TAKUYA_SLAM_QA__.captureNames(), ["1-windup", "1-impact", "1-recovery", "1-restored", "1-vfx-expired"]);
  raf.length = 0;
  const missingApiWindow = { __ASHFALL_BATTLE_QA__: { getSnapshot: () => snapshots[0] }, requestAnimationFrame: (callback) => raf.push(callback) };
  serialized({ maxSamples: 2, spritePath: TAKUYA_SPRITE_PATH }, { windowRef: missingApiWindow, documentRef: fakeDocument });
  missingApiWindow.__V100_TAKUYA_SLAM_QA__.start();
  raf.shift()?.();
  assert.equal(missingApiWindow.__V100_TAKUYA_SLAM_QA__.missingApi(), true, "missing Phase-G API fails closed");
  raf.length = 0;
  const mismatchWindow = { __ASHFALL_BATTLE_QA__: {
    getSnapshot: () => snapshots[0],
    getPhaseGCombatSnapshot: () => ({ ...phaseSnapshots[0], time: 1.1 }),
  }, requestAnimationFrame: (callback) => raf.push(callback) };
  serialized({ maxSamples: 2, spritePath: TAKUYA_SPRITE_PATH }, { windowRef: mismatchWindow, documentRef: fakeDocument });
  mismatchWindow.__V100_TAKUYA_SLAM_QA__.start();
  raf.shift()?.();
  assert.deepEqual(mismatchWindow.__V100_TAKUYA_SLAM_QA__.timeMismatches(), [{ snapshotTime: 1, phaseTime: 1.1 }], "snapshot and Phase-G time must match");
  const runContactContractCase = (contact) => {
    let caseIndex = 0;
    const caseRaf = [];
    const caseSnapshots = [
      { time: 1, fighters: [{ kind: "takuya", id: 7, hp: 1600, maxHp: 1600, abilityWindup: .2, combatReady: true, gateEntering: false, renderAudit: { renderSequence: 1, spriteState: "attack-a", spritePath: TAKUYA_SPRITE_PATH, direction: "left", frameFlipX: false } }], v100SkillContacts: [] },
      { time: 2, fighters: [{ kind: "takuya", id: 7, hp: 1600, maxHp: 1600, abilityWindup: 0, combatReady: true, gateEntering: false, renderAudit: { renderSequence: 2, spriteState: "attack-b", spritePath: TAKUYA_SPRITE_PATH, direction: "left", frameFlipX: false } }], v100SkillContacts: [contact] },
    ];
    const casePhase = caseSnapshots.map((snapshot, index) => ({
      ...snapshot,
      fighters: snapshot.fighters.map((fighter) => ({ ...fighter, takuyaSlamPresentationRemaining: index === 1 ? .24 : 0 })),
    }));
    const caseWindow = {
      __ASHFALL_BATTLE_QA__: {
        getSnapshot: () => caseSnapshots[Math.min(caseIndex, 1)],
        getPhaseGCombatSnapshot: () => casePhase[Math.min(caseIndex, 1)],
      },
      requestAnimationFrame: (callback) => caseRaf.push(callback),
    };
    serialized({ maxSamples: 4, spritePath: TAKUYA_SPRITE_PATH }, { windowRef: caseWindow, documentRef: fakeDocument });
    caseWindow.__V100_TAKUYA_SLAM_QA__.start();
    for (caseIndex = 0; caseIndex < 2; caseIndex += 1) caseRaf.shift()?.();
    return caseWindow.__V100_TAKUYA_SLAM_QA__.skillContractFailures();
  };
  const wrongOwnerFailures = runContactContractCase({ sourceId: "takuya-battle-repaired-v1", kind: "takuya-ground-blade", ownerId: 8, startedAt: 2, duration: .6, resolvedSocket: { x: 300, y: 220 } });
  assert.ok(wrongOwnerFailures.some((failure) => failure.type === "wrong-owner"), "control rejects a contact owned by another fighter");
  const oldActivationFailures = runContactContractCase({ sourceId: "takuya-battle-repaired-v1", kind: "takuya-ground-blade", ownerId: 7, startedAt: 1, duration: .6, resolvedSocket: { x: 300, y: 220 } });
  assert.ok(oldActivationFailures.some((failure) => failure.type === "startedAt-mismatch"), "control rejects a contact from an older activation");
  return { serialized: true, samples: samples.length, captures: fakeWindow.__V100_TAKUYA_SLAM_QA__.captureNames(), joinFailures: fakeWindow.__V100_TAKUYA_SLAM_QA__.joinFailures(), missingApiRejected: true, timeMismatchRejected: true, skillContacts: true, wrongOwnerRejected: true, oldActivationRejected: true, groundContactFailures: [] };
}

const samplerControl = runSamplerControl();
const base = createDefaultV100Save({ playerName: "TAKUYA slam phase audit" });
const stageId = V100_STAGE_IDS[2];
const stageDefinition = createBattleDefinition(stageId, { v100: true });
const timelineEndSeconds = Math.max(
  stageDefinition.defenseEndAt ?? 0,
  ...stageDefinition.timeline.map((event) => Number(event.at) || 0),
);
const save = normalizeV100Save({
  ...base,
  campaignStarted: true,
  revision: 7,
  availableStageIds: V100_STAGE_IDS.slice(0, 3),
  completedStageIds: V100_STAGE_IDS.slice(0, 2),
  ownedUnitIds: [...V100_INITIAL_UNIT_IDS],
  registeredUnitIds: [...V100_INITIAL_UNIT_IDS],
  formationSlots: [...V100_INITIAL_UNIT_IDS, null, null, null],
  vehicle: { ...base.vehicle, upgradeLevel: V100_VEHICLE.maxUpgradeLevel },
  flowState: { phase: "formation", stageId, stageNumber: 3, eventId: null, destination: "formation", nodeIndex: 0, firstClear: false, finalized: true },
});
const expectedStarterUnits = [...V100_INITIAL_UNIT_IDS];
assert.deepEqual(save.ownedUnitIds, expectedStarterUnits);
assert.deepEqual(save.registeredUnitIds, expectedStarterUnits);
assert.deepEqual(save.formationSlots, [...V100_INITIAL_UNIT_IDS, null, null, null]);
for (const unitId of V100_INITIAL_UNIT_IDS) assert.equal(save.unitLevels[unitId], 1);
assert.equal(save.vehicle.upgradeLevel, V100_VEHICLE.maxUpgradeLevel);
assert.equal(save.vehicle.maxHp, V100_VEHICLE.baseHp + V100_VEHICLE.hpPerUpgrade * V100_VEHICLE.maxUpgradeLevel);
const fixtureControl = {
  ownedUnitIds: save.ownedUnitIds,
  registeredUnitIds: save.registeredUnitIds,
  formationSlots: save.formationSlots,
  starterLevels: Object.fromEntries(V100_INITIAL_UNIT_IDS.map((unitId) => [unitId, save.unitLevels[unitId]])),
  vehicleUpgradeLevel: save.vehicle.upgradeLevel,
  vehicleMaxHp: save.vehicle.maxHp,
};
if (process.env.V100_TAKUYA_SLAM_CONTROL_ONLY === "1") {
  console.log(JSON.stringify({ control: samplerControl, fixture: fixtureControl }));
  process.exit(0);
}
assert.ok(origin, "V100_CAMPAIGN_QA_BASE_URL is required");

await mkdir(`${out}/frames`, { recursive: true });
await mkdir(`${out}/videos`, { recursive: true });
const report = {
  scope: "Native S3 ordinary progress only; default four-starter roster and formation, vehicle level 5 fixture grant, stages 1-2 fixture-completed. No forced Guardian actor. This is phase/render evidence, not victory, difficulty, campaign, audio, or physical-device acceptance.",
  engine,
  runtimeChoice: useCurrentWebKit ? "current-webkit-runtime" : "default-playwright-runtime",
  build: await productionBuildIdentity(),
  fixture: { stageId, ownedUnitIds: save.ownedUnitIds, registeredUnitIds: save.registeredUnitIds, formationSlots: save.formationSlots, starterLevels: fixtureControl.starterLevels, vehicleUpgradeLevel: save.vehicle.upgradeLevel, vehicleMaxHp: save.vehicle.maxHp, completedStageIds: save.completedStageIds, timelineEndSeconds, observationDeadlineSeconds: timelineEndSeconds + 180 },
  samplerControl,
  inputs: [],
  tacticalSamples: [],
  slamSamples: [],
  captures: [],
  errors: [],
  samplerMissingApi: false,
  samplerJoinFailures: [],
  samplerTimeMismatches: [],
  samplerMissingSkillContacts: false,
  samplerSkillContractFailures: [],
};
const tacticalRecord = { inputs: report.inputs, samples: [] };

const browser = await ({ chromium, webkit }[engine]).launch({ headless: true });
const context = await browser.newContext({ viewport, hasTouch: true, isMobile: true, recordVideo: { dir: `${out}/videos`, size: viewport } });
const page = await context.newPage();
page.setDefaultTimeout(15000);
page.on("pageerror", (error) => report.errors.push(String(error)));
page.on("console", (message) => { if (message.type() === "error") report.errors.push(message.text()); });
page.on("response", (response) => { if (response.status() >= 400) report.errors.push(`${response.status()} ${response.url()}`); });
page.on("requestfailed", (request) => report.errors.push(`requestfailed ${request.url()} ${request.failure()?.errorText ?? "unknown"}`));

try {
  await page.addInitScript(installTakuyaSlamSampler, { maxSamples: 400, spritePath: TAKUYA_SPRITE_PATH });
  await page.addInitScript((value) => {
    for (const key of ["nishijin-campaign-v100", "nishijin-campaign-v100:mirror", "nishijin-campaign-v100:last-known-good"]) localStorage.setItem(key, value);
  }, serializeV100Save(save));
  await page.goto(new URL("v100", origin).href);
  const play = page.getByRole("button", { name: "ブラウザで遊ぶ", exact: true });
  const start = page.getByRole("button", { name: "戦闘へ", exact: true });
  await play.or(start).first().waitFor();
  if (await play.isVisible()) await play.click();
  await start.click();
  await page.locator(".game-shell canvas").waitFor();
  await page.waitForFunction(() => window.__ASHFALL_BATTLE_QA__?.getSnapshot?.().running);
  await page.evaluate(() => window.__V100_TAKUYA_SLAM_QA__?.start());

  const wallDeadline = Date.now() + (timelineEndSeconds + 180) * 1000;
  let lastTime = 0;
  let complete = false;
  while (Date.now() < wallDeadline && !complete) {
    const snapshot = await page.evaluate(() => window.__ASHFALL_BATTLE_QA__?.getSnapshot?.());
    const samplerState = await page.evaluate(() => ({
      missingApi: window.__V100_TAKUYA_SLAM_QA__?.missingApi?.() ?? true,
      joinFailures: window.__V100_TAKUYA_SLAM_QA__?.joinFailures?.() ?? [{ missing: true }],
      timeMismatches: window.__V100_TAKUYA_SLAM_QA__?.timeMismatches?.() ?? [{ missing: true }],
      missingSkillContacts: window.__V100_TAKUYA_SLAM_QA__?.missingSkillContacts?.() ?? true,
      skillContractFailures: window.__V100_TAKUYA_SLAM_QA__?.skillContractFailures?.() ?? [{ missing: true }],
    }));
    report.samplerMissingApi = samplerState.missingApi;
    report.samplerJoinFailures = samplerState.joinFailures;
    report.samplerTimeMismatches = samplerState.timeMismatches;
    report.samplerMissingSkillContacts = samplerState.missingSkillContacts;
    report.samplerSkillContractFailures = samplerState.skillContractFailures;
    assert.equal(samplerState.missingApi, false, "TAKUYA sampler requires both QA APIs");
    assert.deepEqual(samplerState.joinFailures, [], "TAKUYA sampler requires same fighter ID");
    assert.deepEqual(samplerState.timeMismatches, [], "TAKUYA sampler requires same QA time");
    assert.equal(samplerState.missingSkillContacts, false, "TAKUYA sampler requires v100SkillContacts");
    assert.deepEqual(samplerState.skillContractFailures, [], "TAKUYA ground contact contract remains valid");
    const boss = snapshot?.fighters?.find((fighter) => fighter.kind === "takuya" && fighter.hp > 0);
    if (boss) {
      lastTime = snapshot.time;
      const samples = await page.evaluate(() => window.__V100_TAKUYA_SLAM_QA__?.samples?.() ?? []);
      report.slamSamples = samples;
      if (samples.some((sample) => sample.remaining > 0)) report.snapshotFieldPositive = true;
      assert.equal(Number.isFinite(boss.maxHp), true);
      assert.equal(boss.maxHp, 1600);
      const byActivation = new Map();
      for (const sample of samples) {
        const key = `${sample.id}:${sample.slamActivationId ?? "none"}`;
        const bucket = byActivation.get(key) ?? { id: sample.id, activationId: sample.slamActivationId, windup: [], impact: [], recovery: [], restored: [], expired: [] };
        if (sample.abilityWindup > 0 && sample.remaining === 0 && sample.spriteState === "attack-a") bucket.windup.push(sample);
        if (sample.remaining > 0 && sample.spriteState === "attack-b") bucket.impact.push(sample);
        if (sample.remaining > 0 && sample.remaining <= RECOVERY_SECONDS && sample.spriteState === "walk-a") bucket.recovery.push(sample);
        if (sample.remaining === 0 && sample.abilityWindup === 0 && bucket.impact.length && ["idle", "walk-a", "walk-b"].includes(sample.spriteState)) bucket.restored.push(sample);
        if (sample.vfxExpired === true) bucket.expired.push(sample);
        byActivation.set(key, bucket);
      }
      const validSample = (sample) => sample.hp > 0 && sample.combatReady === true && sample.gateEntering === false
        && Number.isFinite(sample.time) && Number.isFinite(sample.hp) && Number.isFinite(sample.maxHp)
        && sample.spritePath === TAKUYA_SPRITE_PATH;
      const valid = [...byActivation.values()].find((bucket) => bucket.windup.some(validSample)
        && bucket.impact.some(validSample) && bucket.recovery.some(validSample) && bucket.restored.some(validSample)
        && bucket.expired.some(validSample)
        && bucket.windup.every((sample) => sample.renderDirection === "left" && sample.frameFlipX === false)
        && bucket.impact.every((sample) => sample.renderDirection === "left" && sample.frameFlipX === false));
      if (valid) { report.slamEvidence = valid; complete = true; }
    }
    if (snapshot?.over || snapshot?.running === false) break;
    // This helper performs only the existing ordinary deployment/ability/input policy.
    await normalTacticalInput(page, tacticalRecord);
    await page.waitForTimeout(350);
  }
  await page.evaluate(() => window.__V100_TAKUYA_SLAM_QA__?.stop());
  const captures = await page.evaluate(() => window.__V100_TAKUYA_SLAM_QA__?.exportCaptures?.() ?? {});
  for (const [name, data] of Object.entries(captures)) {
    assert.match(data, /^data:image\/png;base64,/);
    const bytes = Buffer.from(data.split(",")[1], "base64");
    assert.ok(bytes.length > 24, `non-empty PNG capture: ${name}`);
    assert.deepEqual([...bytes.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10], `PNG signature: ${name}`);
    await writeFile(`${out}/frames/${name}.png`, bytes);
    report.captures.push(name);
  }
  report.tacticalSamples = tacticalRecord.samples;
  report.lastBattleTime = lastTime;
  report.samplerInvalidRemaining = await page.evaluate(() => window.__V100_TAKUYA_SLAM_QA__?.invalidRemaining?.() ?? true);
  report.samplerMissingApi = await page.evaluate(() => window.__V100_TAKUYA_SLAM_QA__?.missingApi?.() ?? true);
  report.samplerJoinFailures = await page.evaluate(() => window.__V100_TAKUYA_SLAM_QA__?.joinFailures?.() ?? [{ missing: true }]);
  report.samplerTimeMismatches = await page.evaluate(() => window.__V100_TAKUYA_SLAM_QA__?.timeMismatches?.() ?? [{ missing: true }]);
  report.samplerMissingSkillContacts = await page.evaluate(() => window.__V100_TAKUYA_SLAM_QA__?.missingSkillContacts?.() ?? true);
  report.samplerSkillContractFailures = await page.evaluate(() => window.__V100_TAKUYA_SLAM_QA__?.skillContractFailures?.() ?? [{ missing: true }]);
  assert.equal(report.samplerMissingApi, false, "TAKUYA sampler requires both QA APIs at completion");
  assert.deepEqual(report.samplerJoinFailures, [], "TAKUYA sampler has no fighter join failures");
  assert.deepEqual(report.samplerTimeMismatches, [], "TAKUYA sampler has no time mismatches");
  assert.equal(report.samplerMissingSkillContacts, false, "TAKUYA sampler has v100SkillContacts");
  assert.deepEqual(report.samplerSkillContractFailures, [], "TAKUYA ground contact contract has no violations");
  report.observed = complete;
  report.status = "observed";
  assert.equal(report.samplerInvalidRemaining, false, "TAKUYA slam remaining must be finite when exposed");
  assert.equal(report.snapshotFieldPositive, true, "TAKUYA slam remaining must be observed positive in getSnapshot");
  assert.ok(complete, "One same-boss slam must show windup, attack-b impact, walk-a recovery, and normal restored pose");
  assert.ok(report.slamEvidence?.activationId, "accepted evidence must identify one activation");
  const expectedCaptureNames = ["windup", "impact", "recovery", "restored", "vfx-expired"]
    .map((phase) => `${report.slamEvidence.activationId}-${phase}`);
  assert.deepEqual(expectedCaptureNames.filter((name) => report.captures.includes(name)), expectedCaptureNames, "all accepted phases must have same-cycle PNG captures");
  assert.deepEqual(report.errors, []);
} catch (error) {
  report.status = "failed";
  report.error = String(error);
  await page.screenshot({ path: `${out}/failure.png` }).catch(() => {});
  throw error;
} finally {
  report.video = await page.video()?.path();
  await context.close();
  await browser.close();
  await writeFile(`${out}/report.json`, `${JSON.stringify(report, null, 2)}\n`);
}

if (!report.observed) process.exitCode = 1;
