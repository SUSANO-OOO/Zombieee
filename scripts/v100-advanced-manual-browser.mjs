// Bounded ordinary-UI observation for the advanced V1 manual actors.
// This harness never sets actor state, time, HP, result, or effect queues.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
const useCurrentWebKit = process.env.NEW_V100_NATIVE_CURRENT_WEBKIT === "1";
const { chromium, webkit } = await import(useCurrentWebKit ? "./pwa-native-runtime/node_modules/playwright/index.mjs" : "playwright");
import { createDefaultV100Save, normalizeV100Save, serializeV100Save } from "../app/v100Save.js";
import { V100_STAGES, V100_VEHICLE } from "../app/v100Registry.js";
import { v100FormationCombatKinds } from "../app/v100BattleAdapter.js";
import { nativeBattleTap, normalTacticalInput } from "./v100-normal-tactical-input.mjs";
import { productionBuildIdentity } from "./browser-qa-build-identity.mjs";

const SUPPORTED_KINDS = Object.freeze(["scout", "tky", "mrs-chiha", "miyamoto-musashi", "zakimiya", "mayo-chan", "brute", "gunner", "crazy-king"]);
const UNIT_IDS = Object.freeze({
  scout: "unit-hachi", tky: "unit-tky", "mrs-chiha": "unit-mrs-chiha", "miyamoto-musashi": "unit-miyamoto-musashi",
  zakimiya: "unit-zakimiya", "mayo-chan": "unit-mayo-chan", brute: "unit-tatara", gunner: "unit-raider", "crazy-king": "unit-crazy-king",
});
const rawKinds = process.env.V100_ADVANCED_MANUAL_KINDS;
const TARGET_KINDS = rawKinds === undefined ? SUPPORTED_KINDS.slice(0, 4) : rawKinds.split(",").map((kind) => kind.trim()).filter(Boolean);
assert.ok(TARGET_KINDS.length > 0 && TARGET_KINDS.length <= 4, "V100_ADVANCED_MANUAL_KINDS must select one to four actors per batch");
assert.equal(new Set(TARGET_KINDS).size, TARGET_KINDS.length, "V100_ADVANCED_MANUAL_KINDS must not contain duplicates");
assert.ok(TARGET_KINDS.every((kind) => SUPPORTED_KINDS.includes(kind)), "V100_ADVANCED_MANUAL_KINDS contains an unsupported actor");
const stageNumber = Number(process.env.V100_ADVANCED_MANUAL_STAGE_NUMBER ?? "3");
assert.ok(Number.isInteger(stageNumber) && stageNumber > 0, "V100_ADVANCED_MANUAL_STAGE_NUMBER must be a positive integer");
const stage = V100_STAGES.find((candidate) => candidate.number === stageNumber);
assert.ok(stage, `Unknown V100 stage ${stageNumber}`);
const origin = process.env.V100_CAMPAIGN_QA_BASE_URL ? new URL(process.env.V100_CAMPAIGN_QA_BASE_URL) : null;
const engine = process.env.V100_ADVANCED_MANUAL_ENGINE ?? "chromium";
const output = process.env.V100_ADVANCED_MANUAL_OUT ?? "outputs/v100-advanced-manual-browser-r1";
assert.ok(["chromium", "webkit"].includes(engine));
function installAdvancedSampler(options = {}, injected = null) {
  const effectKinds = new Set(["tky", "mrs-chiha", "miyamoto-musashi", "zakimiya"]);
  const requiredEffectTypes = {
    tky: ["tky-lightblade"],
    "mrs-chiha": ["mrs-grenade-flight", "mrs-grenade-impact"],
    "miyamoto-musashi": ["musashi-crosscut"],
    zakimiya: ["zakimiya-bottle", "zakimiya-impact"],
    "mayo-chan": ["mayo-dust"],
  };
  const tataraKind = "brute-ground-hammer";
  const tataraEffectSource = "/art/v100/combat-vfx/ground-impact-six-frames-r1.webp";
  const tataraBodySource = "/art/v100/characters/tatara-ground-strike-r1.webp";
  const windowRef = injected?.windowRef ?? window;
  const documentRef = injected?.documentRef ?? document;
  const expected = new Set(options.kinds ?? []);
  const state = { running: false, samples: [], owners: new Map(), missingApi: false, sceneEnded: false, lastValidSnapshot: null, contractFailures: [], seenEffects: new Map(), captures: new Map(), zakimiyaArea: { sourceId: null, areaId: null, seen: false, statuses: new Set(), expired: false, proof: [] }, tataraContact: { ownerId: null, activationId: null, kind: tataraKind, sourcePath: tataraEffectSource, effectSourcePath: tataraEffectSource, bodySourcePath: tataraBodySource, startedAt: null, duration: null, expectedExpiryAt: null, expiredAt: null, seen: false, resolved: false, expired: false, bodyCaptured: false, contactCaptured: false, proof: [] } };
  const fail = (type, detail = {}) => { if (state.contractFailures.length < 128) state.contractFailures.push({ type, ...detail }); };
  const copyCanvas = (name) => {
    if (state.captures.has(name) || state.captures.size >= 24) return;
    const source = documentRef.querySelector(".game-shell canvas");
    if (!source) { fail("missing-canvas", { name }); return; }
    const copy = documentRef.createElement("canvas"); copy.width = source.width; copy.height = source.height;
    copy.getContext("2d")?.drawImage(source, 0, 0); state.captures.set(name, copy);
  };
  const observe = () => {
    const qa = windowRef.__ASHFALL_BATTLE_QA__;
    if (typeof qa?.getSnapshot !== "function") {
      if (state.lastValidSnapshot) { state.sceneEnded = true; state.running = false; return; }
      state.missingApi = true;
      return;
    }
    const snapshot = qa.getSnapshot();
    if (!snapshot) {
      if (state.lastValidSnapshot) { state.sceneEnded = true; state.running = false; return; }
      state.missingApi = true;
      return;
    }
    if (!Number.isFinite(snapshot?.time) || !Array.isArray(snapshot?.fighters)) { fail("invalid-snapshot"); return; }
    if (expected.has("zakimiya") && !Array.isArray(snapshot.areaEffects)) { state.missingApi = true; fail("missing-area-effects"); return; }
    if (expected.has("brute") && !Array.isArray(snapshot.v100SkillContacts)) { state.missingApi = true; fail("missing-skill-contacts"); return; }
    if (!Array.isArray(snapshot.manualAbilityReceipts) || !Array.isArray(snapshot.v100AdvancedAbilityEffects)) { state.missingApi = true; fail("missing-advanced-ledgers"); return; }
    state.lastValidSnapshot = snapshot;
    for (const fighter of snapshot.fighters) {
      if (fighter.side !== "human" || !expected.has(fighter.kind)) continue;
      const manual = fighter.manualAbility;
      if (!manual || !Number.isFinite(manual.activationId) || manual.activationId <= 0) continue;
      const key = fighter.kind;
      const owner = state.owners.get(key) ?? { id: fighter.id, kind: fighter.kind, activationId: manual.activationId, phases: [], states: [], phaseOnlyStates: [], effects: [], effectTypes: new Set(), expiredTypes: new Set(), effectStarted: false, effectExpired: false, ownerMismatch: false, finiteEffects: true, recoveryBody: false, cooldownReadyBody: false, activeBody: false, recoveryNormalBody: false, receiptSeen: false, mrsLaunches: new Set(), mrsImpacts: new Set(), musashiCounter: false, mayoFeral: false, mayoRetreatStarted: false, mayoRetreatComplete: false, mayoRetreatReceipt: null, approachPositions: [], scoutWalkA: false, scoutWalkB: false, lastTime: -Infinity, captureKeys: new Set() };
      if (fighter.kind === "zakimiya" && state.zakimiyaArea.sourceId === null) state.zakimiyaArea.sourceId = -(100000 + fighter.id);
      if (fighter.kind === "brute" && state.tataraContact.ownerId === null) { state.tataraContact.ownerId = fighter.id; state.tataraContact.activationId = manual.activationId; }
      if (owner.id !== fighter.id || owner.activationId !== manual.activationId) continue;
      if (snapshot.time < owner.lastTime) fail("time-regressed", { key });
      owner.lastTime = snapshot.time;
      if (manual.phase && !owner.phases.includes(manual.phase)) owner.phases.push(manual.phase);
      const audit = fighter.renderAudit;
      const currentRenderValid = Boolean(audit && typeof audit.spriteState === "string" && typeof audit.spritePath === "string");
      if (!audit || typeof audit.spriteState !== "string" || typeof audit.spritePath !== "string") {
        if (Array.isArray(fighter.renderAuditHistory) && fighter.renderAuditHistory.length > 0) owner.phaseOnlyStates.push({ time: snapshot.time, phase: manual.phase, historyCount: fighter.renderAuditHistory.length });
        else fail("missing-current-render-audit", { key });
      } else {
        if (manual.phase === "windup") owner.windupBody = true;
        if (manual.phase === "recovery") owner.recoveryBody = true;
        if (["cooldown", "ready"].includes(manual.phase)) owner.cooldownReadyBody = true;
        if (manual.phase === "active") owner.activeBody = true;
        owner.recoveryNormalBody = owner.recoveryBody && owner.cooldownReadyBody;
        owner.states.push({ time: snapshot.time, phase: manual.phase, spriteState: audit.spriteState, spritePath: audit.spritePath });
        if (owner.states.length > 80) owner.states.shift();
        if (fighter.kind === "scout" && manual.phase === "windup" && Number.isFinite(fighter.x) && Number.isFinite(fighter.y)) {
          if (owner.approachPositions.every((point) => Math.hypot(point.x - fighter.x, point.y - fighter.y) >= .05)) {
            if (owner.approachPositions.length < 32) owner.approachPositions.push({ time: snapshot.time, x: fighter.x, y: fighter.y, spriteState: audit.spriteState });
          }
          if (audit.spriteState === "walk-a") owner.scoutWalkA = true;
          if (audit.spriteState === "walk-b") owner.scoutWalkB = true;
          if ((audit.spriteState === "walk-a" || audit.spriteState === "walk-b") && owner.approachPositions.length >= 2 && !owner.captureKeys.has("scout-approach")) { copyCanvas("scout-approach"); owner.captureKeys.add("scout-approach"); }
        }
        const capturePhase = ["windup", "recovery", "retreat", "feral", "guard", "salvo", "active", "cooldown", "ready"].includes(manual.phase) ? manual.phase : "normal";
        if (!owner.captureKeys.has(capturePhase)) { copyCanvas(`${fighter.kind}-${capturePhase}`); owner.captureKeys.add(capturePhase); }
      }
      if (fighter.kind === "mayo-chan" && manual.phase === "feral") owner.mayoFeral = true;
      if (fighter.kind === "mayo-chan" && manual.phase === "retreat") owner.mayoRetreatStarted = true;
      for (const receipt of snapshot.manualAbilityReceipts.filter((entry) => entry?.ownerId === fighter.id && entry.activationId === manual.activationId)) {
        if (!['start', 'ready', 'retreat', 'retreat-safe-floor'].includes(receipt.eventType)) owner.receiptSeen = true;
        if (fighter.kind === "mrs-chiha" && receipt.eventType === "launch") owner.mrsLaunches.add(receipt.salvoIndex);
        if (fighter.kind === "mrs-chiha" && receipt.eventType === "impact") owner.mrsImpacts.add(receipt.salvoIndex);
        if (fighter.kind === "miyamoto-musashi" && receipt.mode === "counter") owner.musashiCounter = true;
      }
      const activeEffects = snapshot.v100AdvancedAbilityEffects.filter((effect) => effect?.ownerId === fighter.id && effect.activationId === manual.activationId);
      for (const effect of activeEffects) {
        const pending = effect.pendingOrigin === true;
        const validClock = Number.isFinite(effect.startedAt) && Number.isFinite(effect.duration) && effect.duration > 0 && Number.isFinite(effect.elapsed) && effect.elapsed >= 0 && effect.elapsed < effect.duration;
        if (!validClock) { owner.finiteEffects = false; fail("invalid-effect-clock", { key, effectType: effect.type ?? null, startedAt: effect.startedAt ?? null, duration: effect.duration ?? null, elapsed: effect.elapsed ?? null }); }
        if (!pending && (!Number.isFinite(effect.x) || !Number.isFinite(effect.y))) owner.finiteEffects = false;
        const effectKey = `${effect.type}:${effect.startedAt}`;
        if (!pending) {
          owner.effectStarted = true;
          if (currentRenderValid && Number.isFinite(effect.elapsed) && Number.isFinite(effect.duration) && effect.elapsed >= effect.duration * .25 && effect.elapsed < effect.duration * .85 && Number.isFinite(effect.x) && Number.isFinite(effect.y)) {
            const visibleCapture = fighter.kind === "mrs-chiha" && ["mrs-grenade-flight", "mrs-grenade-impact"].includes(effect.type)
              ? `${fighter.kind}-${effect.type === "mrs-grenade-flight" ? "flight" : "impact"}-visible`
              : fighter.kind === "zakimiya" && ["zakimiya-bottle", "zakimiya-impact"].includes(effect.type)
              ? `${fighter.kind}-${effect.type === "zakimiya-bottle" ? "bottle" : "impact"}-visible`
              : null;
            if (visibleCapture && !owner.captureKeys.has(visibleCapture)) { copyCanvas(visibleCapture); owner.captureKeys.add(visibleCapture); }
            if (!visibleCapture && !owner.captureKeys.has("impact-effect")) { copyCanvas(`${fighter.kind}-impact-effect`); owner.captureKeys.add("impact-effect"); }
          }
        }
        if (owner.effects.length < 160) owner.effects.push({ time: snapshot.time, type: effect.type, targetId: effect.targetId ?? null, elapsed: effect.elapsed ?? null, startedAt: effect.startedAt, duration: effect.duration, x: effect.x, y: effect.y, pendingOrigin: pending });
        owner.effectTypes.add(effect.type);
        if (!pending && validClock) state.seenEffects.set(`${key}:${effectKey}`, { startedAt: effect.startedAt, duration: effect.duration, lastSeen: snapshot.time });
      }
      for (const [effectKey, effectState] of state.seenEffects) if (effectKey.startsWith(`${key}:`) && snapshot.time >= effectState.startedAt + effectState.duration && !activeEffects.some((effect) => `${key}:${effect.type}:${effect.startedAt}` === effectKey)) { owner.effectExpired = true; owner.expiredTypes.add(effectKey.slice(`${key}:`.length).split(":")[0]); }
      if (owner.effectExpired && currentRenderValid && !owner.captureKeys.has("effect-expired")) { copyCanvas(`${fighter.kind}-effect-expired`); owner.captureKeys.add("effect-expired"); }
      state.owners.set(key, owner);
      if (state.samples.length < 800) state.samples.push({ time: snapshot.time, id: fighter.id, kind: fighter.kind, phase: manual.phase, activationId: manual.activationId, spriteState: audit?.spriteState ?? null, advancedEffects: activeEffects.map((effect) => ({ type: effect.type, targetId: effect.targetId ?? null, elapsed: effect.elapsed ?? null, x: effect.x, y: effect.y, pendingOrigin: effect.pendingOrigin === true })) });
    }
    for (const owner of state.owners.values()) {
      if (owner.kind !== "mayo-chan" || !owner.mayoFeral || !owner.mayoRetreatStarted || owner.mayoRetreatComplete) continue;
      const receipt = snapshot.manualAbilityReceipts.find((entry) => entry?.eventType === "retreat-complete" && entry.ownerId === owner.id && entry.activationId === owner.activationId && entry.kind === "mayo-chan");
      const stillPresent = snapshot.fighters.some((fighter) => fighter.id === owner.id && fighter.kind === "mayo-chan");
      if (!receipt || stillPresent || !Number.isFinite(receipt.x) || !Number.isFinite(receipt.baseX) || receipt.x > receipt.baseX + 1) continue;
      owner.mayoRetreatComplete = true;
      owner.receiptSeen = true;
      owner.mayoRetreatReceipt = { ownerId: receipt.ownerId, activationId: receipt.activationId, kind: receipt.kind, at: receipt.at, mode: receipt.mode, x: receipt.x, baseX: receipt.baseX };
      if (!owner.captureKeys.has("retreat-complete")) { copyCanvas("mayo-chan-retreat-complete"); owner.captureKeys.add("retreat-complete"); }
    }
    if (state.zakimiyaArea.sourceId !== null) {
      const matchingArea = snapshot.areaEffects.find((effect) => effect.kind === "burn" && effect.sourceSupplyId === state.zakimiyaArea.sourceId && (state.zakimiyaArea.areaId === null || effect.id === state.zakimiyaArea.areaId));
      if (matchingArea) {
        state.zakimiyaArea.seen = true;
        if (state.zakimiyaArea.areaId === null) state.zakimiyaArea.areaId = matchingArea.id;
        if (state.zakimiyaArea.proof.length < 8) state.zakimiyaArea.proof.push({ id: matchingArea.id, sourceSupplyId: matchingArea.sourceSupplyId, time: snapshot.time, remaining: matchingArea.remaining });
        const status = matchingArea.remaining < .8 ? "late" : matchingArea.remaining < 4 ? "ongoing" : null;
        if (status && !state.zakimiyaArea.statuses.has(status)) { state.zakimiyaArea.statuses.add(status); copyCanvas(`zakimiya-area-${status}`); }
      } else if (state.zakimiyaArea.seen && !state.zakimiyaArea.expired) {
        state.zakimiyaArea.expired = true;
        state.zakimiyaArea.statuses.add("expired");
        copyCanvas("zakimiya-area-expired");
      }
    }
    if (state.tataraContact.ownerId !== null) {
      const contact = snapshot.v100SkillContacts.find((entry) => entry?.kind === tataraKind && entry.ownerId === state.tataraContact.ownerId && entry.activationId === state.tataraContact.activationId);
      if (contact) {
        const resolvedPoint = contact.resolvedSocket && Number.isFinite(contact.resolvedSocket.x) && Number.isFinite(contact.resolvedSocket.y) ? contact.resolvedSocket : null;
        const sourcePixel = contact.sourcePixel && Number.isFinite(contact.sourcePixel.x) && Number.isFinite(contact.sourcePixel.y) ? contact.sourcePixel : null;
        const validSourceContract = (contact.sourcePath === tataraEffectSource || contact.sourcePath === tataraBodySource) && contact.effectSourcePath === tataraEffectSource && contact.bodySourcePath === tataraBodySource;
        const validContact = validSourceContract && sourcePixel && Number.isFinite(contact.startedAt) && Number.isFinite(contact.duration) && contact.duration > 0 && Number.isFinite(contact.x) && Number.isFinite(contact.y) && resolvedPoint && Number.isFinite(snapshot.time) && snapshot.time >= contact.startedAt && snapshot.time < contact.startedAt + contact.duration;
        if (validContact) {
          if (state.tataraContact.startedAt !== null && (state.tataraContact.startedAt !== contact.startedAt || state.tataraContact.duration !== contact.duration)) fail("tatara-contact-lifetime-changed", { previousStartedAt: state.tataraContact.startedAt, previousDuration: state.tataraContact.duration, startedAt: contact.startedAt, duration: contact.duration });
          state.tataraContact.seen = true; state.tataraContact.resolved = true;
          if (state.tataraContact.startedAt === null) { state.tataraContact.startedAt = contact.startedAt; state.tataraContact.duration = contact.duration; state.tataraContact.expectedExpiryAt = contact.startedAt + contact.duration; }
          if (state.tataraContact.proof.length < 8) state.tataraContact.proof.push({ ownerId: contact.ownerId, activationId: contact.activationId, kind: contact.kind, sourcePath: contact.sourcePath, effectSourcePath: contact.effectSourcePath, bodySourcePath: contact.bodySourcePath, sourcePixel: contact.sourcePixel && { x: contact.sourcePixel.x, y: contact.sourcePixel.y }, time: snapshot.time, startedAt: contact.startedAt, duration: contact.duration, x: contact.x, y: contact.y, resolvedSocket: { x: resolvedPoint.x, y: resolvedPoint.y } });
          const brute = state.owners.get("brute");
          const elapsed = snapshot.time - contact.startedAt;
          if (brute && elapsed >= .05 && elapsed < contact.duration && !brute.captureKeys.has("tatara-ground-hammer-body")) { copyCanvas("tatara-ground-hammer-body"); brute.captureKeys.add("tatara-ground-hammer-body"); state.tataraContact.bodyCaptured = true; }
          if (brute && elapsed >= .05 && elapsed < contact.duration && !brute.captureKeys.has("tatara-ground-hammer-contact")) { copyCanvas("tatara-ground-hammer-contact"); brute.captureKeys.add("tatara-ground-hammer-contact"); state.tataraContact.contactCaptured = true; }
        }
      } else if (state.tataraContact.seen && state.tataraContact.startedAt !== null && snapshot.time >= state.tataraContact.startedAt + state.tataraContact.duration) {
        state.tataraContact.expired = true; state.tataraContact.expectedExpiryAt = state.tataraContact.startedAt + state.tataraContact.duration; state.tataraContact.expiredAt = snapshot.time;
        if (!state.captures.has("tatara-ground-hammer-expired")) copyCanvas("tatara-ground-hammer-expired");
      }
    }
    if (state.running) windowRef.requestAnimationFrame(observe);
  };
  windowRef.__V100_ADVANCED_MANUAL_QA__ = {
    start() { state.running = true; windowRef.requestAnimationFrame(observe); },
    stop() { state.running = false; },
    samples() { return state.samples.slice(); },
    missingApi() { return state.missingApi; },
    sceneEnded() { return state.sceneEnded; },
    lastValidSnapshot() { return state.lastValidSnapshot; },
    contractFailures() { return state.contractFailures.slice(); },
    owners() { return [...state.owners.values()].map((owner) => ({ ...owner, effectTypes: [...owner.effectTypes], expiredTypes: [...owner.expiredTypes], mrsLaunches: [...owner.mrsLaunches], mrsImpacts: [...owner.mrsImpacts], states: owner.states.slice(), phaseOnlyStates: owner.phaseOnlyStates.slice(), effects: owner.effects.slice() })); },
    zakimiyaArea() { return { sourceId: state.zakimiyaArea.sourceId, areaId: state.zakimiyaArea.areaId, seen: state.zakimiyaArea.seen, statuses: [...state.zakimiyaArea.statuses], expired: state.zakimiyaArea.expired, proof: state.zakimiyaArea.proof.slice() }; },
    tataraContact() { return { ...state.tataraContact, proof: state.tataraContact.proof.slice() }; },
    sufficientKinds() { return [...state.owners.values()].filter((owner) => owner.windupBody && owner.receiptSeen && (owner.kind === "mayo-chan" ? owner.mayoRetreatStarted : owner.recoveryBody && owner.cooldownReadyBody) && (owner.kind !== "crazy-king" || owner.activeBody) && (owner.kind !== "scout" || (owner.approachPositions.length >= 3 && owner.scoutWalkA && owner.scoutWalkB)) && (owner.kind !== "zakimiya" || (state.zakimiyaArea.seen && ["ongoing", "late", "expired"].every((status) => state.zakimiyaArea.statuses.has(status)) && state.zakimiyaArea.expired)) && (owner.kind !== "brute" || (state.tataraContact.seen && state.tataraContact.resolved && state.tataraContact.expired && state.tataraContact.bodyCaptured && state.tataraContact.contactCaptured)) && owner.finiteEffects && !owner.ownerMismatch && (!effectKinds.has(owner.kind) || (owner.effectStarted && owner.effectExpired && requiredEffectTypes[owner.kind].every((type) => owner.effectTypes.has(type) && owner.expiredTypes.has(type)))) && (owner.kind !== "mrs-chiha" || (owner.mrsLaunches.size >= 4 && owner.mrsImpacts.size >= 4)) && (owner.kind !== "miyamoto-musashi" || owner.musashiCounter) && (owner.kind !== "mayo-chan" || (owner.mayoFeral && owner.mayoRetreatStarted && owner.mayoRetreatComplete))).map((owner) => owner.kind); },
    captures() { return Object.fromEntries([...state.captures].map(([name, canvas]) => [name, canvas.toDataURL("image/png")])); },
  };
}

function runSamplerControl() {
  const baseFighter = { id: 1, side: "human", kind: TARGET_KINDS[0], hp: 100, x: 100, y: 160, manualAbility: { phase: "windup", activationId: 1 }, renderAudit: { spriteState: "attack-a", spritePath: "/art/control.png" } };
  const fakeCanvas = { width: 8, height: 8, getContext: () => ({ drawImage() {} }), toDataURL: () => "data:image/png;base64,AA==" }; const fakeDocument = { querySelector: () => fakeCanvas, createElement: () => fakeCanvas };
  const runCase = (fighter, effects, snapshots = null) => {
    const raf = []; const fakeWindow = { __ASHFALL_BATTLE_QA__: { getSnapshot: () => ({ time: 1.1, fighters: [fighter], manualAbilityReceipts: [], v100AdvancedAbilityEffects: effects, v100SkillContacts: [], areaEffects: [] }) }, requestAnimationFrame: (callback) => raf.push(callback) };
    if (snapshots) { let index = 0; fakeWindow.__ASHFALL_BATTLE_QA__.getSnapshot = () => { const snapshot = snapshots[Math.min(index++, snapshots.length - 1)]; return snapshot && snapshot.areaEffects === undefined ? { ...snapshot, v100SkillContacts: [], areaEffects: [] } : snapshot; }; }
    const serialized = Function(`return (${installAdvancedSampler.toString()})`)();
    serialized({ kinds: TARGET_KINDS }, { windowRef: fakeWindow, documentRef: fakeDocument }); fakeWindow.__V100_ADVANCED_MANUAL_QA__.start(); raf.shift()?.(); if (snapshots) { raf.shift()?.(); fakeWindow.__V100_ADVANCED_MANUAL_QA__.stop(); }
    return { qa: fakeWindow.__V100_ADVANCED_MANUAL_QA__, owner: fakeWindow.__V100_ADVANCED_MANUAL_QA__.owners()[0] ?? null };
  };
  const positive = runCase(baseFighter, [{ ownerId: 1, activationId: 1, type: "control", x: 1, y: 2, startedAt: 1, duration: .6, elapsed: 0 }]);
  assert.deepEqual(positive.qa.contractFailures(), []); assert.equal(positive.owner.effectStarted, true);
  assert.deepEqual(positive.qa.sufficientKinds(), []);
  const runEffectCaptureCase = (kind, effect) => {
    const raf = []; const fighter = { id: 1, side: "human", kind, hp: 100, x: 100, y: 160, manualAbility: { phase: "windup", activationId: 1 }, renderAudit: { spriteState: "attack-a", spritePath: "/art/control.png" } };
    const fakeWindow = { __ASHFALL_BATTLE_QA__: { getSnapshot: () => ({ time: 1.1, fighters: [fighter], manualAbilityReceipts: [], v100AdvancedAbilityEffects: [effect], areaEffects: [] }) }, requestAnimationFrame: (callback) => raf.push(callback) };
    const serialized = Function(`return (${installAdvancedSampler.toString()})`)();
    serialized({ kinds: [kind] }, { windowRef: fakeWindow, documentRef: fakeDocument }); fakeWindow.__V100_ADVANCED_MANUAL_QA__.start(); raf.shift()?.(); fakeWindow.__V100_ADVANCED_MANUAL_QA__.stop();
    return Object.keys(fakeWindow.__V100_ADVANCED_MANUAL_QA__.captures());
  };
  const visibleMrsFlight = runEffectCaptureCase("mrs-chiha", { ownerId: 1, activationId: 1, type: "mrs-grenade-flight", x: 1, y: 2, startedAt: 1, duration: .6, elapsed: .2 });
  assert.ok(visibleMrsFlight.includes("mrs-chiha-flight-visible")); assert.equal(visibleMrsFlight.includes("mrs-chiha-impact-visible"), false);
  assert.equal(runEffectCaptureCase("mrs-chiha", { ownerId: 1, activationId: 1, type: "mrs-grenade-flight", x: 1, y: 2, startedAt: 1, duration: .6, elapsed: 0 }).some((name) => name.includes("flight-visible") || name.includes("impact-visible")), false);
  assert.equal(runEffectCaptureCase("mrs-chiha", { ownerId: 1, activationId: 1, type: "mrs-grenade-impact", pendingOrigin: true, x: null, y: null, startedAt: 1, duration: .6, elapsed: .2 }).some((name) => name.includes("flight-visible") || name.includes("impact-visible")), false);
  const wrongOwner = runCase(baseFighter, [{ ownerId: 2, activationId: 1, type: "control", x: 1, y: 2, startedAt: 1, duration: .6, elapsed: 0 }]);
  assert.deepEqual(wrongOwner.qa.contractFailures(), []); assert.equal(wrongOwner.owner.effectStarted, false);
  assert.deepEqual(wrongOwner.qa.sufficientKinds(), []);
  const continuedOwner = runCase(baseFighter, [], [
    { time: 1.1, fighters: [baseFighter], manualAbilityReceipts: [], v100AdvancedAbilityEffects: [] },
    { time: 1.2, fighters: [{ ...baseFighter, manualAbility: { phase: "recovery", activationId: 2 } }, { ...baseFighter, id: 2, manualAbility: { phase: "windup", activationId: 1 } }], manualAbilityReceipts: [], v100AdvancedAbilityEffects: [] },
  ]);
  assert.deepEqual(continuedOwner.qa.contractFailures(), []); assert.equal(continuedOwner.qa.owners()[0].id, 1); assert.deepEqual(continuedOwner.qa.sufficientKinds(), []);
  const staleActivation = runCase(baseFighter, [{ ownerId: 1, activationId: 0, type: "control", x: 1, y: 2, startedAt: 1, duration: .6, elapsed: 0 }]);
  assert.deepEqual(staleActivation.qa.contractFailures(), []); assert.equal(staleActivation.owner.effectStarted, false);
  const pendingOrigin = runCase(baseFighter, [{ ownerId: 1, activationId: 1, type: "control", pendingOrigin: true, x: null, y: null, startedAt: 1, duration: .6, elapsed: 0 }]);
  assert.deepEqual(pendingOrigin.qa.contractFailures(), []); assert.equal(pendingOrigin.owner.effectStarted, false);
  for (const invalidEffect of [
    { ownerId: 1, activationId: 1, type: "control", x: 1, y: 2, startedAt: 1, duration: 0, elapsed: 0 },
    { ownerId: 1, activationId: 1, type: "control", x: 1, y: 2, startedAt: 1, duration: .6, elapsed: -.01 },
    { ownerId: 1, activationId: 1, type: "control", x: 1, y: 2, startedAt: 1, duration: .6, elapsed: .6 },
    { ownerId: 1, activationId: 1, type: "control", x: 1, y: 2, startedAt: Number.NaN, duration: .6, elapsed: .1 },
  ]) {
    const invalid = runCase(baseFighter, [invalidEffect]);
    assert.equal(invalid.owner.finiteEffects, false); assert.equal(invalid.qa.contractFailures()[0].type, "invalid-effect-clock");
  }
  const nullRenderHistory = runCase({ ...baseFighter, renderAudit: null, renderAuditHistory: [{ spriteState: "attack-a" }] }, []);
  assert.deepEqual(nullRenderHistory.qa.contractFailures(), []); assert.equal(nullRenderHistory.owner.phaseOnlyStates.length, 1);
  const runMayoCase = (finalReceipt, finalFighters = []) => {
    const mayo = (phase, retreat = null) => ({ id: 7, side: "human", kind: "mayo-chan", hp: 100, manualAbility: { phase, activationId: 1 }, mayoRetreat: retreat, renderAudit: { spriteState: phase, spritePath: "/art/mayo.png" } });
    const snapshots = [
      { time: 1, fighters: [mayo("windup")], manualAbilityReceipts: [], v100AdvancedAbilityEffects: [] },
      { time: 2, fighters: [mayo("feral")], manualAbilityReceipts: [], v100AdvancedAbilityEffects: [] },
      { time: 3, fighters: [mayo("retreat", { phase: "run", complete: false })], manualAbilityReceipts: [], v100AdvancedAbilityEffects: [] },
      { time: 4, fighters: finalFighters, manualAbilityReceipts: finalReceipt ? [finalReceipt] : [], v100AdvancedAbilityEffects: [] },
    ];
    const raf = []; const fakeWindow = { __ASHFALL_BATTLE_QA__: { getSnapshot: () => snapshots.shift() }, requestAnimationFrame: (callback) => raf.push(callback) };
    const serialized = Function(`return (${installAdvancedSampler.toString()})`)();
    serialized({ kinds: ["mayo-chan"] }, { windowRef: fakeWindow, documentRef: fakeDocument }); fakeWindow.__V100_ADVANCED_MANUAL_QA__.start();
    for (let index = 0; index < 4; index += 1) raf.shift()?.();
    fakeWindow.__V100_ADVANCED_MANUAL_QA__.stop();
    return fakeWindow.__V100_ADVANCED_MANUAL_QA__;
  };
  const validMayoReceipt = { eventType: "retreat-complete", ownerId: 7, activationId: 1, kind: "mayo-chan", at: 4, mode: "ability", x: 100, baseX: 100 };
  const mayoComplete = runMayoCase(validMayoReceipt);
  assert.equal(mayoComplete.owners()[0].mayoRetreatComplete, true); assert.deepEqual(mayoComplete.sufficientKinds(), ["mayo-chan"]);
  assert.equal(runMayoCase({ ...validMayoReceipt, ownerId: 8 }).owners()[0].mayoRetreatComplete, false);
  assert.equal(runMayoCase({ ...validMayoReceipt, activationId: 2 }).owners()[0].mayoRetreatComplete, false);
  assert.equal(runMayoCase(null).owners()[0].mayoRetreatComplete, false);
  assert.equal(runMayoCase({ ...validMayoReceipt, x: 150 }).owners()[0].mayoRetreatComplete, false);
  const runZakiAreaCase = (areaEffectsBySnapshot) => {
    const fighter = (phase = "windup") => ({ id: 9, side: "human", kind: "zakimiya", hp: 100, manualAbility: { phase, activationId: 1 }, renderAudit: { spriteState: phase, spritePath: "/art/zaki.png" } });
    const snapshots = areaEffectsBySnapshot.map((areaEffects, index) => ({ time: index + 1, fighters: [fighter(index > 0 ? "recovery" : "windup")], manualAbilityReceipts: index > 0 ? [{ eventType: "impact", ownerId: 9, activationId: 1 }] : [], v100AdvancedAbilityEffects: [], ...(areaEffects === undefined ? {} : { areaEffects }) }));
    const raf = []; const fakeWindow = { __ASHFALL_BATTLE_QA__: { getSnapshot: () => snapshots.shift() }, requestAnimationFrame: (callback) => raf.push(callback) };
    const serialized = Function(`return (${installAdvancedSampler.toString()})`)();
    serialized({ kinds: ["zakimiya"] }, { windowRef: fakeWindow, documentRef: fakeDocument }); fakeWindow.__V100_ADVANCED_MANUAL_QA__.start();
    for (let index = 0; index < areaEffectsBySnapshot.length; index += 1) raf.shift()?.();
    fakeWindow.__V100_ADVANCED_MANUAL_QA__.stop();
    return fakeWindow.__V100_ADVANCED_MANUAL_QA__;
  };
  const zakiSource = -100009;
  const zakiComplete = runZakiAreaCase([[{ id: 20, kind: "burn", sourceSupplyId: zakiSource, remaining: 3 }], [{ id: 20, kind: "burn", sourceSupplyId: zakiSource, remaining: .5 }], []]);
  assert.deepEqual(zakiComplete.zakimiyaArea().statuses.sort(), ["expired", "late", "ongoing"]); assert.equal(zakiComplete.zakimiyaArea().expired, true);
  assert.equal(runZakiAreaCase([[{ id: 20, kind: "burn", sourceSupplyId: zakiSource, remaining: 3 }], [{ id: 20, kind: "burn", sourceSupplyId: zakiSource, remaining: .5 }]]).zakimiyaArea().expired, false);
  assert.equal(runZakiAreaCase([[{ id: 20, kind: "burn", sourceSupplyId: zakiSource, remaining: 3 }], [{ id: 21, kind: "burn", sourceSupplyId: zakiSource, remaining: .5 }]]).zakimiyaArea().statuses.includes("late"), false);
  const zakiMissing = runZakiAreaCase([[{ id: 20, kind: "burn", sourceSupplyId: zakiSource, remaining: 3 }], undefined]);
  assert.equal(zakiMissing.missingApi(), true); assert.equal(zakiMissing.zakimiyaArea().expired, false);
  const runTataraCase = (contact, { missing = false } = {}) => {
    const fighter = (phase) => ({ id: 9, side: "human", kind: "brute", hp: 100, x: 120, y: 180, manualAbility: { phase, activationId: 1 }, renderAudit: { spriteState: phase, spritePath: "/art/brute.png" } });
    const contacts = Array.isArray(contact) ? contact : [contact, contact, null];
    const snapshots = [
      { time: 1, fighters: [fighter("windup")], manualAbilityReceipts: [], v100AdvancedAbilityEffects: [], v100SkillContacts: [] },
      { time: 1.2, fighters: [fighter("recovery")], manualAbilityReceipts: [{ eventType: "impact", ownerId: 9, activationId: 1 }], v100AdvancedAbilityEffects: [], ...(missing ? {} : { v100SkillContacts: contacts[0] ? [contacts[0]] : [] }) },
      { time: 1.3, fighters: [fighter("recovery")], manualAbilityReceipts: [], v100AdvancedAbilityEffects: [], ...(missing ? {} : { v100SkillContacts: contacts[1] ? [contacts[1]] : [] }) },
      { time: 1.8, fighters: [fighter("ready")], manualAbilityReceipts: [], v100AdvancedAbilityEffects: [], v100SkillContacts: [] },
    ];
    const raf = []; const fakeWindow = { __ASHFALL_BATTLE_QA__: { getSnapshot: () => snapshots.shift() }, requestAnimationFrame: (callback) => raf.push(callback) };
    const serialized = Function(`return (${installAdvancedSampler.toString()})`)();
    serialized({ kinds: ["brute"] }, { windowRef: fakeWindow, documentRef: fakeDocument }); fakeWindow.__V100_ADVANCED_MANUAL_QA__.start(); for (let index = 0; index < 4; index += 1) raf.shift()?.(); fakeWindow.__V100_ADVANCED_MANUAL_QA__.stop();
    return fakeWindow.__V100_ADVANCED_MANUAL_QA__;
  };
  const tataraContact = { kind: "brute-ground-hammer", ownerId: 9, activationId: 1, sourcePath: "/art/v100/combat-vfx/ground-impact-six-frames-r1.webp", effectSourcePath: "/art/v100/combat-vfx/ground-impact-six-frames-r1.webp", bodySourcePath: "/art/v100/characters/tatara-ground-strike-r1.webp", sourcePixel: { x: 81.89, y: 491.909 }, startedAt: 1.1, duration: .6, x: 200, y: 220, resolvedSocket: { x: 200, y: 220 } };
  const tataraPositive = runTataraCase(tataraContact); assert.equal(tataraPositive.tataraContact().resolved, true); assert.equal(tataraPositive.tataraContact().expired, true); assert.ok(Math.abs(tataraPositive.tataraContact().expectedExpiryAt - 1.7) < 1e-9); assert.equal(tataraPositive.tataraContact().expiredAt, 1.8); assert.deepEqual(tataraPositive.tataraContact().proof[0].sourcePixel, tataraContact.sourcePixel); assert.ok(Object.keys(tataraPositive.captures()).includes("tatara-ground-hammer-expired"));
  assert.equal(runTataraCase({ ...tataraContact, ownerId: 10 }).tataraContact().seen, false);
  assert.equal(runTataraCase({ ...tataraContact, activationId: 2 }).tataraContact().seen, false);
  assert.equal(runTataraCase({ ...tataraContact, resolvedSocket: null }).tataraContact().seen, false);
  const changedTataraLifetime = runTataraCase([tataraContact, { ...tataraContact, startedAt: 1.05 }, null]);
  assert.equal(changedTataraLifetime.tataraContact().seen, true);
  assert.equal(changedTataraLifetime.contractFailures()[0].type, "tatara-contact-lifetime-changed");
  const changedTataraSource = runTataraCase({ ...tataraContact, sourcePath: "/art/v100/characters/other.webp" });
  assert.equal(changedTataraSource.tataraContact().seen, false);
  assert.equal(runTataraCase(tataraContact, { missing: true }).missingApi(), true);
  const cases = { positive: true, wrongOwner: true, staleActivation: true, pendingOrigin: true, nullRenderHistory: true };
  return { serialized: true, selectedKinds: TARGET_KINDS.slice(), cases };
}

const samplerControl = runSamplerControl();
if (process.env.V100_ADVANCED_MANUAL_CONTROL_ONLY === "1") {
  assert.deepEqual(v100FormationCombatKinds(TARGET_KINDS.map((kind) => UNIT_IDS[kind])), TARGET_KINDS, "control fixture unit IDs must normalize to selected kinds");
  console.log(JSON.stringify({ control: samplerControl, fixtureKinds: TARGET_KINDS })); process.exit(0);
}
assert.ok(origin, "V100_CAMPAIGN_QA_BASE_URL is required");
assert.ok(["localhost", "127.0.0.1"].includes(origin.hostname));
const selectedUnitIds = TARGET_KINDS.map((kind) => UNIT_IDS[kind]);
const base = createDefaultV100Save({ playerName: "Advanced manual observation" });
const rawSave = { ...base, campaignStarted: true, revision: 1, availableStageIds: V100_STAGES.filter((candidate) => candidate.number <= stageNumber).map((candidate) => candidate.id), completedStageIds: V100_STAGES.filter((candidate) => candidate.number < stageNumber).map((candidate) => candidate.id), ownedUnitIds: selectedUnitIds, registeredUnitIds: selectedUnitIds, formationSlots: selectedUnitIds, unitLevels: Object.fromEntries(selectedUnitIds.map((id) => [id, 1])), vehicle: { ...base.vehicle, upgradeLevel: V100_VEHICLE.maxUpgradeLevel }, flowState: { phase: "formation", stageId: stage.id, stageNumber, eventId: null, destination: "formation", nodeIndex: 0, firstClear: false, finalized: true } };
const saveBytes = Buffer.from(serializeV100Save(normalizeV100Save(rawSave)));
const normalizedSave = normalizeV100Save(rawSave);
assert.deepEqual(v100FormationCombatKinds(normalizedSave.formationSlots), TARGET_KINDS, "normalized formation combat kinds must match selected actors");
const report = { status: "running", scope: `S${stageNumber} ordinary UI advanced manual actor observation; no setters or result mutation`, engine, runtimeChoice: useCurrentWebKit ? "current-webkit-runtime" : "default-playwright-runtime", targetSelection: { requestedEnv: rawKinds ?? null, selectedKinds: TARGET_KINDS }, fixture: { stageNumber, unitIds: selectedUnitIds, normalizedFormationKinds: v100FormationCombatKinds(normalizedSave.formationSlots), saveSha256: createHash("sha256").update(saveBytes).digest("hex") }, build: await productionBuildIdentity(), samplerControl, samples: [], owners: [], sufficientKinds: [], unobservedKinds: TARGET_KINDS.slice(), captures: [], captureFiles: {}, errors: [], inputs: [], contractFailures: [], missingApi: false, sceneEnded: false, lastValidSnapshot: null, deploymentDiagnostic: null, zakimiyaArea: null, tataraContact: null };
await mkdir(output, { recursive: true });
const browser = await ({ chromium, webkit }[engine]).launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 844, height: 340 }, hasTouch: true, isMobile: true, recordVideo: { dir: `${output}/videos`, size: { width: 844, height: 340 } } });
const page = await context.newPage(); page.setDefaultTimeout(15000);
page.on("pageerror", (error) => report.errors.push({ kind: "page", message: String(error) }));
page.on("console", (message) => { if (message.type() === "error") report.errors.push({ kind: "console", message: message.text() }); });
page.on("requestfailed", (request) => report.errors.push({ kind: "request", url: request.url(), message: request.failure()?.errorText }));
try {
  await page.addInitScript(installAdvancedSampler, { kinds: TARGET_KINDS });
  await page.addInitScript((value) => { for (const key of ["nishijin-campaign-v100", "nishijin-campaign-v100:mirror", "nishijin-campaign-v100:last-known-good"]) localStorage.setItem(key, value); }, saveBytes.toString("utf8"));
  await page.goto(new URL("v100", origin).href);
  const play = page.getByRole("button", { name: "ブラウザで遊ぶ", exact: true }); const start = page.getByRole("button", { name: "戦闘へ", exact: true });
  await play.or(start).first().waitFor(); if (await play.isVisible()) await play.click(); await start.click(); await page.locator(".game-shell canvas").waitFor(); await page.waitForFunction(() => window.__ASHFALL_BATTLE_QA__?.getSnapshot?.().running); await page.evaluate(() => window.__V100_ADVANCED_MANUAL_QA__?.start());
  const record = { inputs: [], samples: [] }; const deadline = Date.now() + 120000; let firstSimTime = null;
  while (Date.now() < deadline) {
    const snapshot = await page.evaluate(() => window.__ASHFALL_BATTLE_QA__?.getSnapshot?.());
    if (!snapshot?.running || snapshot.over) break;
    if (firstSimTime === null && Number.isFinite(snapshot.time)) firstSimTime = snapshot.time;
    const selectedLive = (snapshot.fighters ?? []).some((fighter) => fighter.side === "human" && fighter.hp > 0 && TARGET_KINDS.includes(fighter.kind));
    const selectedQueued = (snapshot.deployQueue ?? []).some((fighter) => TARGET_KINDS.includes(fighter.kind));
    for (const kind of TARGET_KINDS) {
      const count = (snapshot.fighters ?? []).filter((fighter) => fighter.side === "human" && fighter.hp > 0 && fighter.kind === kind).length
        + (snapshot.deployQueue ?? []).filter((fighter) => fighter.kind === kind).length;
      if (count > 0) continue;
      const cards = page.locator(`button.unit-card[data-kind="${kind}"]`);
      if (await cards.count() > 0 && await nativeBattleTap(page, cards.first())) {
        record.inputs.push({ time: snapshot.time, action: "fallback-deploy", kind });
        break;
      }
    }
    const hadDeployInput = record.inputs.some((input) => input.action === "deploy" || input.action === "fallback-deploy");
    if (!hadDeployInput && !selectedLive && !selectedQueued && firstSimTime !== null && snapshot.time - firstSimTime >= 10) {
      const cards = await page.locator("button.unit-card[data-kind]").evaluateAll((elements) => elements.map((element) => ({ kind: element.dataset.kind, disabled: element.disabled, ariaDisabled: element.getAttribute("aria-disabled") })));
      report.deploymentDiagnostic = { simSeconds: snapshot.time - firstSimTime, selectedKinds: TARGET_KINDS.slice(), liveKinds: [], queuedKinds: [], cardCount: cards.length, cards };
      break;
    }
    const sufficient = await page.evaluate(() => window.__V100_ADVANCED_MANUAL_QA__?.sufficientKinds?.() ?? []);
    if (TARGET_KINDS.every((kind) => sufficient.includes(kind))) break;
    if (TARGET_KINDS.length === 1 && TARGET_KINDS[0] === "miyamoto-musashi") {
      const musashi = (snapshot.fighters ?? []).find((fighter) => fighter.side === "human" && fighter.kind === "miyamoto-musashi" && fighter.hp > 0);
      const enemy = musashi && (snapshot.fighters ?? []).find((fighter) => {
        if (fighter.side !== "zombie" || fighter.hp <= 0 || fighter.lane !== musashi.lane) return false;
        const distance = Math.hypot((fighter.x ?? Infinity) - (musashi.x ?? -Infinity), (fighter.y ?? 0) - (musashi.y ?? 0));
        const reach = (fighter.range ?? 0) + (fighter.bodyRadius ?? 0) + (musashi.bodyRadius ?? 0) + 12;
        return distance <= reach || fighter.attackWindupTargetId === musashi.id || musashi.attackWindupTargetId === fighter.id;
      });
      if (musashi && enemy) {
        const distance = Math.hypot((enemy.x ?? Infinity) - (musashi.x ?? -Infinity), (enemy.y ?? 0) - (musashi.y ?? 0));
        const ability = page.locator(`button.manual-ability-ready.available[data-fighter-id="${musashi.id}"][aria-disabled="false"]`);
        if (await nativeBattleTap(page, ability)) record.inputs.push({ time: snapshot.time, action: "musashi-counter-window", ownerId: musashi.id, enemyId: enemy.id, enemyDistance: distance });
      }
    } else await normalTacticalInput(page, record);
    await page.waitForTimeout(350);
  }
  await page.evaluate(() => window.__V100_ADVANCED_MANUAL_QA__?.stop());
  const observed = await page.evaluate(() => ({ samples: window.__V100_ADVANCED_MANUAL_QA__?.samples?.() ?? [], owners: window.__V100_ADVANCED_MANUAL_QA__?.owners?.() ?? [], sufficientKinds: window.__V100_ADVANCED_MANUAL_QA__?.sufficientKinds?.() ?? [], captures: window.__V100_ADVANCED_MANUAL_QA__?.captures?.() ?? {}, missingApi: window.__V100_ADVANCED_MANUAL_QA__?.missingApi?.() ?? true, sceneEnded: window.__V100_ADVANCED_MANUAL_QA__?.sceneEnded?.() ?? false, lastValidSnapshot: window.__V100_ADVANCED_MANUAL_QA__?.lastValidSnapshot?.() ?? null, zakimiyaArea: window.__V100_ADVANCED_MANUAL_QA__?.zakimiyaArea?.() ?? null, tataraContact: window.__V100_ADVANCED_MANUAL_QA__?.tataraContact?.() ?? null, contractFailures: window.__V100_ADVANCED_MANUAL_QA__?.contractFailures?.() ?? [{ missing: true }] }));
  report.samples = observed.samples; report.owners = observed.owners; report.sufficientKinds = observed.sufficientKinds; report.unobservedKinds = TARGET_KINDS.filter((kind) => !observed.sufficientKinds.includes(kind)); report.inputs = record.inputs; report.missingApi = observed.missingApi; report.sceneEnded = observed.sceneEnded; report.lastValidSnapshot = observed.lastValidSnapshot; report.zakimiyaArea = observed.zakimiyaArea; report.tataraContact = observed.tataraContact; report.contractFailures = observed.contractFailures;
  for (const [name, data] of Object.entries(observed.captures)) { const bytes = Buffer.from(data.split(",")[1], "base64"); const file = `${name}.png`; await writeFile(`${output}/${file}`, bytes); report.captureFiles[name] = { file, bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") }; report.captures.push(name); }
  report.status = report.errors.length || report.missingApi || report.contractFailures.length || report.deploymentDiagnostic ? "observation-error" : "observed";
} catch (error) { report.status = "failed"; report.error = String(error.stack ?? error); process.exitCode = 1; } finally { await context.close().catch(() => {}); await browser.close().catch(() => {}); await writeFile(`${output}/report.json`, `${JSON.stringify(report, null, 2)}\n`); console.log(JSON.stringify({ status: report.status, selectedKinds: TARGET_KINDS, output })); }
