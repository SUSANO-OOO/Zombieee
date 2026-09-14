import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";

const useCurrentWebKit = process.env.NEW_V100_NATIVE_CURRENT_WEBKIT === "1";
const { chromium, webkit } = await import(useCurrentWebKit ? "./pwa-native-runtime/node_modules/playwright/index.mjs" : "playwright");
import { createDefaultV100Save, normalizeV100Save, serializeV100Save } from "../app/v100Save.js";
import { V100_STAGE_IDS, V100_VEHICLE } from "../app/v100Registry.js";
import { normalTacticalInput } from "./v100-normal-tactical-input.mjs";
import { productionBuildIdentity } from "./browser-qa-build-identity.mjs";

const DEFAULT_TARGET_KINDS = Object.freeze(["brawler", "medic", "brute", "engineer"]);
const requestedKindsValue = process.env.V100_MANUAL_SPECIAL_KINDS;
const TARGET_KINDS = requestedKindsValue === undefined
  ? [...DEFAULT_TARGET_KINDS]
  : requestedKindsValue.split(",").map((kind) => kind.trim()).filter(Boolean);
assert.ok(TARGET_KINDS.length > 0, "V100_MANUAL_SPECIAL_KINDS must contain at least one kind");
assert.equal(new Set(TARGET_KINDS).size, TARGET_KINDS.length, "V100_MANUAL_SPECIAL_KINDS must not contain duplicates");
assert.ok(TARGET_KINDS.every((kind) => DEFAULT_TARGET_KINDS.includes(kind)), "V100_MANUAL_SPECIAL_KINDS must be a subset of the supported kinds");
const TARGET_UNIT_IDS = ["unit-paisen", "unit-nao", "unit-kumaverson", "unit-tatara", "unit-monkey"];
const safeCaptureName = (name) => String(name).replaceAll(":", "-");
const origin = process.env.V100_CAMPAIGN_QA_BASE_URL ? new URL(process.env.V100_CAMPAIGN_QA_BASE_URL) : null;
const engine = process.env.V100_MANUAL_SPECIAL_ENGINE ?? "chromium";
const output = process.env.V100_MANUAL_SPECIAL_OUT ?? "outputs/v100-manual-special-r1";
const viewport = { width: 844, height: 340 };
const MAX_SAMPLES_PER_OWNER = 800;

assert.ok(["chromium", "webkit"].includes(engine));

function installManualSpecialSampler(options = {}, injectedRuntime = null) {
  const windowRef = injectedRuntime?.windowRef ?? window;
  const documentRef = injectedRuntime?.documentRef ?? document;
  const maxSamples = Number(options.maxSamples) || 800;
  const maxCaptures = Number(options.maxCaptures) || 24;
  const expectedKinds = new Set(Array.isArray(options.kinds) ? options.kinds : []);
  const state = {
    running: false, samples: [], captures: new Map(), seenRenderSequences: new Map(), owners: new Map(),
    missingApi: false, contractFailures: [], phaseOnlyObservations: [], deployedKinds: new Set(), selectedOwnerIds: new Map(),
  };
  const copyCanvas = (name) => {
    if (state.captures.has(name) || state.captures.size >= maxCaptures) return;
    const source = documentRef.querySelector(".game-shell canvas");
    if (!source) { state.contractFailures.push({ type: "missing-canvas", name }); return; }
    const copy = documentRef.createElement("canvas"); copy.width = source.width; copy.height = source.height;
    copy.getContext("2d")?.drawImage(source, 0, 0); state.captures.set(name, copy);
  };
  const fail = (type, detail = {}) => { if (state.contractFailures.length < 128) state.contractFailures.push({ type, ...detail }); };
  const observe = () => {
    const qa = windowRef.__ASHFALL_BATTLE_QA__;
    if (typeof qa?.getSnapshot !== "function") { state.missingApi = true; return; }
    const snapshot = qa.getSnapshot();
    if (!Number.isFinite(snapshot?.time) || !Array.isArray(snapshot?.fighters)) { fail("invalid-snapshot"); return; }
    const receipts = snapshot.manualAbilityReceipts;
    const vfx = snapshot.manualAbilityVfx;
    const supportEffects = snapshot.v100SupportEffects;
    if (!Array.isArray(receipts) || !Array.isArray(vfx) || !Array.isArray(supportEffects)) { state.missingApi = true; fail("missing-manual-ledgers"); return; }
    for (const fighter of snapshot.fighters) {
      if (fighter.side !== "human" || !expectedKinds.has(fighter.kind)) continue;
      state.deployedKinds.add(fighter.kind);
      const manual = fighter.manualAbility;
      if (!manual) continue;
      const required = ["phase", "activationId", "windupRemaining", "activeRemaining", "abilityElapsed"];
      if (required.some((key) => manual[key] === undefined || manual[key] === null)) { fail("missing-manual-field", { id: fighter.id, kind: fighter.kind, activationId: manual.activationId }); continue; }
      if (!Number.isFinite(manual.activationId) || !Number.isFinite(manual.windupRemaining) || !Number.isFinite(manual.activeRemaining) || !Number.isFinite(manual.abilityElapsed)) { fail("invalid-manual-field", { id: fighter.id, activationId: manual.activationId }); continue; }
      if (manual.activationId <= 0) continue;
      if (!(Number.isFinite(fighter.hp) && fighter.hp > 0)) continue;
      const selectedOwnerId = state.selectedOwnerIds.get(fighter.kind);
      if (selectedOwnerId === undefined) state.selectedOwnerIds.set(fighter.kind, fighter.id);
      else if (selectedOwnerId !== fighter.id) continue;
      const audit = fighter.renderAudit;
      if (!audit) {
        if (fighter.combatReady !== true || fighter.gateEntering === true) continue;
        const owner = state.owners.get(fighter.id);
        if (owner && owner.activationId === manual.activationId && (owner.restored || (owner.hadActive && owner.vfxExpired))) continue;
        const hasFiniteRenderHistory = Array.isArray(fighter.renderAuditHistory)
          && fighter.renderAuditHistory.some((historyAudit) => Number.isFinite(historyAudit?.renderSequence));
        if (hasFiniteRenderHistory) {
          if (state.phaseOnlyObservations.length < 8) state.phaseOnlyObservations.push({ time: snapshot.time, id: fighter.id, kind: fighter.kind, hp: fighter.hp, phase: manual.phase, activationId: manual.activationId });
          continue;
        }
        fail("missing-render-audit", { id: fighter.id, kind: fighter.kind, activationId: manual.activationId, hp: fighter.hp, phase: manual.phase, time: snapshot.time }); continue;
      }
      if (typeof audit.spriteState !== "string" || typeof audit.spritePath !== "string" || typeof audit.direction !== "string" || typeof audit.frameFlipX !== "boolean") { fail("invalid-render-audit", { id: fighter.id, activationId: manual.activationId }); continue; }
      const key = `${fighter.id}:${manual.activationId}`;
      const owner = state.owners.get(fighter.id) ?? { kind: fighter.kind, activationId: manual.activationId, key, samples: [], overflow: 0, windupSeen: false, effectReceiptSeen: false, vfxSeen: false, vfxDuration: null, vfxStart: null, supportEffectSeen: false, supportEffectDuration: null, supportEffectStart: null, supportEffectExpired: false, hadActive: false, hadRecovery: false, restored: false, vfxExpired: false, targetId: null, targetIds: [], targetHp: null, targetHps: [] };
      // Keep the first real activation for each owner through expiry. Later
      // casts must not replace its captures or make the evidence ambiguous.
      if (owner.activationId !== manual.activationId) continue;
      const sequences = state.seenRenderSequences.get(fighter.id) ?? new Set();
      if (Number.isFinite(audit.renderSequence) && sequences.has(audit.renderSequence)) continue;
      if (Number.isFinite(audit.renderSequence)) { sequences.add(audit.renderSequence); while (sequences.size > maxSamples * 2) sequences.delete(sequences.values().next().value); } state.seenRenderSequences.set(fighter.id, sequences);
      const ownerReceipts = receipts.filter((receipt) => receipt?.ownerId === fighter.id);
      const matchingReceipts = ownerReceipts.filter((receipt) => receipt.activationId === manual.activationId);
      const effectReceipts = matchingReceipts.filter((receipt) => !["start", "retreat", "retreat-safe-floor"].includes(receipt.eventType));
      const matchingVfx = vfx.filter((effect) => effect?.ownerId === fighter.id && effect.activationId === manual.activationId);
      const matchingSupportEffects = supportEffects.filter((effect) => effect?.ownerId === fighter.id && effect.activationId === manual.activationId);
      const contacts = Array.isArray(snapshot.v100SkillContacts) ? snapshot.v100SkillContacts : [];
      if (!Array.isArray(snapshot.v100SkillContacts)) fail("missing-skill-contacts", { id: fighter.id, activationId: manual.activationId });
      const matchingContacts = contacts.filter((contact) => contact?.ownerId === fighter.id && contact.activationId === manual.activationId);
      if (ownerReceipts.some((receipt) => !Number.isFinite(receipt.at))) fail("invalid-receipt-time", { id: fighter.id, activationId: manual.activationId });
      const currentTargetIds = Array.isArray(manual.target?.targetIds) ? manual.target.targetIds : (manual.target?.targetId !== undefined && manual.target?.targetId !== null ? [manual.target.targetId] : []);
      for (const id of currentTargetIds) if (!owner.targetIds.some((savedId) => String(savedId) === String(id))) owner.targetIds.push(id);
      if (manual.target?.targetId !== undefined && manual.target?.targetId !== null) owner.targetId = manual.target.targetId;
      const targetId = owner.targetId ?? owner.targetIds[0] ?? null;
      const targets = snapshot.fighters.filter((candidate) => owner.targetIds.some((savedId) => String(savedId) === String(candidate.id)) || String(candidate.id) === String(targetId));
      owner.targetHp = targets[0]?.hp ?? owner.targetHp ?? null;
      owner.targetHps = targets.map((targetEntry) => ({ id: targetEntry.id, hp: targetEntry.hp, maxHp: targetEntry.maxHp }));
      const sample = { time: snapshot.time, id: fighter.id, kind: fighter.kind, hp: fighter.hp, maxHp: fighter.maxHp, targetId, targetIds: owner.targetIds.slice(), targetHp: owner.targetHp, targetHps: owner.targetHps, phase: manual.phase, activationId: manual.activationId, windupRemaining: manual.windupRemaining, activeRemaining: manual.activeRemaining, abilityElapsed: manual.abilityElapsed, target: manual.target ?? null, renderAudit: { spriteState: audit.spriteState, spritePath: audit.spritePath, direction: audit.direction, frameFlipX: audit.frameFlipX, renderSequence: audit.renderSequence ?? null }, receipts: matchingReceipts.map((receipt) => ({ ...receipt })), effectReceipts: effectReceipts.map((receipt) => ({ ...receipt })), vfx: matchingVfx.map((effect) => ({ ...effect })), supportEffects: matchingSupportEffects.map((effect) => ({ ...effect })), skillContacts: matchingContacts.map((contact) => ({ ...contact })), phaseFieldsPresent: true };
      if (manual.phase === "windup" && matchingSupportEffects.length) fail("support-effect-during-windup", { id: fighter.id, kind: fighter.kind, activationId: manual.activationId });
      if (fighter.kind === "medic" && matchingSupportEffects.some((effect) => !Number.isFinite(effect.targetId))) fail("medic-support-effect-target-invalid", { id: fighter.id, activationId: manual.activationId });
      if (manual.phase === "windup") owner.windupSeen = true;
      if (effectReceipts.length) { owner.effectReceiptSeen = true; copyCanvas(`${key}-receipt`); }
      if (matchingVfx.length) { owner.vfxSeen = true; owner.vfxDuration = Number(matchingVfx[0].duration); owner.vfxStart ??= sample.time - Number(matchingVfx[0].elapsed ?? 0); }
      if (matchingSupportEffects.length) { owner.supportEffectSeen = true; owner.supportEffectDuration = Number(matchingSupportEffects[0].duration); owner.supportEffectStart ??= Number.isFinite(matchingSupportEffects[0].startedAt) ? matchingSupportEffects[0].startedAt : sample.time - Number(matchingSupportEffects[0].elapsed ?? 0); if (!owner.supportEffectCapture) { owner.supportEffectCapture = true; copyCanvas(`${key}-support-effect`); } }
      if (manual.phase === "windup") copyCanvas(`${key}-windup`);
      if (manual.phase === "active") { owner.hadActive = true; copyCanvas(`${key}-active`); }
      if (manual.phase === "recovery") { owner.hadRecovery = true; copyCanvas(`${key}-recovery`); }
      if ((owner.hadActive || owner.hadRecovery || owner.effectReceiptSeen) && ["cooldown", "ready"].includes(manual.phase) && !owner.restored) { owner.restored = true; copyCanvas(`${key}-restored`); }
      if (owner.vfxSeen && !matchingVfx.length && Number.isFinite(owner.vfxStart) && Number.isFinite(owner.vfxDuration) && sample.time >= owner.vfxStart + owner.vfxDuration) { owner.vfxExpired = true; copyCanvas(`${key}-vfx-expired`); }
      if (owner.supportEffectSeen && !matchingSupportEffects.length && Number.isFinite(owner.supportEffectStart) && Number.isFinite(owner.supportEffectDuration) && sample.time >= owner.supportEffectStart + owner.supportEffectDuration) { owner.supportEffectExpired = true; copyCanvas(`${key}-support-effect-expired`); }
      if (owner.samples.length < maxSamples) owner.samples.push(sample); else owner.overflow += 1; state.owners.set(fighter.id, owner); if (state.samples.length < maxSamples * expectedKinds.size) state.samples.push(sample);
    }
    if (state.running) windowRef.requestAnimationFrame(observe);
  };
  windowRef.__V100_MANUAL_SPECIAL_QA__ = {
    start() { state.running = true; windowRef.requestAnimationFrame(observe); }, stop() { state.running = false; },
    samples() { return state.samples.slice(); }, phaseOnlyObservations() { return state.phaseOnlyObservations.slice(0, 8); }, missingApi() { return state.missingApi; }, contractFailures() { return state.contractFailures.slice(); }, deployedKinds() { return [...state.deployedKinds]; }, sufficientKinds() { return [...new Set([...state.owners.values()].filter((owner) => owner.windupSeen && owner.effectReceiptSeen && (owner.hadRecovery || owner.restored) && owner.vfxExpired && (owner.kind === "medic" || owner.kind === "engineer" ? owner.supportEffectSeen && owner.supportEffectExpired : true)).map((owner) => owner.kind))]; }, ownerStats() { return [...state.owners.values()].map((owner) => ({ key: owner.key, kind: owner.kind, activationId: owner.activationId, samples: owner.samples.length, overflow: owner.overflow, windupSeen: owner.windupSeen, effectReceiptSeen: owner.effectReceiptSeen, supportEffectSeen: owner.supportEffectSeen, supportEffectExpired: owner.supportEffectExpired, hadRecovery: owner.hadRecovery, restored: owner.restored, vfxExpired: owner.vfxExpired })); }, complete() { return new Set(this.sufficientKinds()).size >= expectedKinds.size; }, captureNames() { return [...state.captures.keys()]; },
    exportCaptures() { return Object.fromEntries([...state.captures].map(([name, canvas]) => [name, canvas.toDataURL("image/png")])); },
  };
}

function runSamplerControl() {
  const snapshots = [
    { time: 1, fighters: [{ id: 1, side: "human", kind: "brawler", hp: 100, maxHp: 100, manualAbility: { phase: "windup", activationId: 4, windupRemaining: .2, activeRemaining: 0, abilityElapsed: 0, target: { targetId: 9 }, }, renderAudit: { spriteState: "attack-a", spritePath: "/art/v060/characters/legacy/paisen-battle-gutter-v1.png", direction: "right", frameFlipX: false, renderSequence: 1 } }], manualAbilityReceipts: [], manualAbilityVfx: [{ ownerId: 1, activationId: 4, duration: .6, elapsed: 0 }], v100SupportEffects: [], v100SkillContacts: [] },
    { time: 1.2, fighters: [{ id: 1, side: "human", kind: "brawler", hp: 100, maxHp: 100, manualAbility: { phase: "active", activationId: 4, windupRemaining: 0, activeRemaining: .4, abilityElapsed: .2, target: { targetId: 9 }, }, renderAudit: { spriteState: "special", spritePath: "/art/v060/characters/legacy/paisen-battle-gutter-v1.png", direction: "right", frameFlipX: false, renderSequence: 2 } }], manualAbilityReceipts: [{ ownerId: 1, activationId: 4, at: 1.2, eventType: "impact" }], manualAbilityVfx: [{ ownerId: 1, activationId: 4, duration: .6, elapsed: 0 }], v100SupportEffects: [], v100SkillContacts: [{ ownerId: 1, activationId: 4, sourceId: "control", kind: "impact", resolvedSocket: { x: 1, y: 2 } }] },
    { time: 1.9, fighters: [{ id: 1, side: "human", kind: "brawler", hp: 100, maxHp: 100, manualAbility: { phase: "recovery", activationId: 4, windupRemaining: 0, activeRemaining: 0, abilityElapsed: .9, target: null }, renderAudit: { spriteState: "walk-a", spritePath: "/art/v060/characters/legacy/paisen-battle-gutter-v1.png", direction: "right", frameFlipX: false, renderSequence: 3 } }], manualAbilityReceipts: [{ ownerId: 1, activationId: 4, at: 1.2 }], manualAbilityVfx: [], v100SupportEffects: [], v100SkillContacts: [] },
    { time: 2.7, fighters: [{ id: 1, side: "human", kind: "brawler", hp: 100, maxHp: 100, manualAbility: { phase: "ready", activationId: 4, windupRemaining: 0, activeRemaining: 0, abilityElapsed: 1.7, target: null }, renderAudit: { spriteState: "idle", spritePath: "/art/v060/characters/legacy/paisen-battle-gutter-v1.png", direction: "right", frameFlipX: false, renderSequence: 4 } }], manualAbilityReceipts: [{ ownerId: 1, activationId: 4, at: 1.2 }], manualAbilityVfx: [], v100SupportEffects: [], v100SkillContacts: [] },
  ];
  const phase = { index: 0 }; const raf = []; const fakeCanvas = { width: 8, height: 8, getContext: () => ({ drawImage() {} }), toDataURL: () => "data:image/png;base64,AA==" };
  const fakeWindow = { __ASHFALL_BATTLE_QA__: { getSnapshot: () => snapshots[Math.min(phase.index, snapshots.length - 1)] }, requestAnimationFrame: (callback) => raf.push(callback) }; const fakeDocument = { querySelector: () => fakeCanvas, createElement: () => fakeCanvas };
  const serialized = Function(`return (${installManualSpecialSampler.toString()})`)(); serialized({ maxSamples: 8, maxCaptures: 24, kinds: DEFAULT_TARGET_KINDS }, { windowRef: fakeWindow, documentRef: fakeDocument }); fakeWindow.__V100_MANUAL_SPECIAL_QA__.start(); for (phase.index = 0; phase.index < snapshots.length; phase.index += 1) raf.shift()?.();
  const state = fakeWindow.__V100_MANUAL_SPECIAL_QA__; const samples = state.samples(); assert.equal(state.missingApi(), false); assert.deepEqual(state.contractFailures(), []); assert.ok(samples.some((sample) => sample.phase === "windup")); assert.ok(samples.some((sample) => sample.phase === "active")); assert.ok(samples.some((sample) => sample.phase === "recovery")); assert.ok(samples.some((sample) => sample.phase === "ready")); assert.ok(state.captureNames().some((name) => name.endsWith("-windup"))); assert.ok(state.captureNames().some((name) => name.endsWith("-restored")));
  const wrongOwner = structuredClone(snapshots[1]); wrongOwner.manualAbilityReceipts = [{ ownerId: 2, activationId: 4, at: 1.2 }]; wrongOwner.fighters.push({ ...structuredClone(wrongOwner.fighters[0]), id: 2, kind: "engineer", renderAudit: { ...wrongOwner.fighters[0].renderAudit, renderSequence: 20 } }); let wrongIndex = 1; const wrongWindow = { __ASHFALL_BATTLE_QA__: { getSnapshot: () => wrongOwner }, requestAnimationFrame: (callback) => raf.push(callback) }; raf.length = 0; serialized({ maxSamples: 2, kinds: DEFAULT_TARGET_KINDS }, { windowRef: wrongWindow, documentRef: fakeDocument }); wrongWindow.__V100_MANUAL_SPECIAL_QA__.start(); raf.shift()?.(); assert.deepEqual(wrongWindow.__V100_MANUAL_SPECIAL_QA__.contractFailures(), [], "other-owner same activation is ignored"); assert.equal(wrongIndex, 1);
  const staleReceipt = structuredClone(snapshots[1]); staleReceipt.manualAbilityReceipts = [{ ownerId: 1, activationId: 3, at: 1.2, eventType: "impact" }]; const staleWindow = { __ASHFALL_BATTLE_QA__: { getSnapshot: () => staleReceipt }, requestAnimationFrame: (callback) => raf.push(callback) }; raf.length = 0; serialized({ maxSamples: 2, kinds: DEFAULT_TARGET_KINDS }, { windowRef: staleWindow, documentRef: fakeDocument }); staleWindow.__V100_MANUAL_SPECIAL_QA__.start(); raf.shift()?.(); assert.deepEqual(staleWindow.__V100_MANUAL_SPECIAL_QA__.contractFailures(), [], "stale history is not attributed to the current activation");
  const timeSkew = structuredClone(snapshots[1]); timeSkew.manualAbilityReceipts = [{ ownerId: 1, activationId: 4, at: "skew" }]; const skewWindow = { __ASHFALL_BATTLE_QA__: { getSnapshot: () => timeSkew }, requestAnimationFrame: (callback) => raf.push(callback) }; raf.length = 0; serialized({ maxSamples: 2, kinds: DEFAULT_TARGET_KINDS }, { windowRef: skewWindow, documentRef: fakeDocument }); skewWindow.__V100_MANUAL_SPECIAL_QA__.start(); raf.shift()?.(); assert.ok(skewWindow.__V100_MANUAL_SPECIAL_QA__.contractFailures().some((failure) => failure.type === "invalid-receipt-time"), "control rejects a receipt with a skewed time");
  const nullTime = structuredClone(snapshots[1]); nullTime.time = null; const nullTimeWindow = { __ASHFALL_BATTLE_QA__: { getSnapshot: () => nullTime }, requestAnimationFrame: (callback) => raf.push(callback) }; raf.length = 0; serialized({ maxSamples: 2, kinds: DEFAULT_TARGET_KINDS }, { windowRef: nullTimeWindow, documentRef: fakeDocument }); nullTimeWindow.__V100_MANUAL_SPECIAL_QA__.start(); raf.shift()?.(); assert.ok(nullTimeWindow.__V100_MANUAL_SPECIAL_QA__.contractFailures().some((failure) => failure.type === "invalid-snapshot"), "control rejects null snapshot time");
  const historyOnly = structuredClone(snapshots[0]); historyOnly.fighters[0].combatReady = true; historyOnly.fighters[0].renderAudit = null; historyOnly.fighters[0].renderAuditHistory = [{ renderSequence: 7 }]; const historyWindow = { __ASHFALL_BATTLE_QA__: { getSnapshot: () => historyOnly }, requestAnimationFrame: (callback) => raf.push(callback) }; raf.length = 0; serialized({ maxSamples: 2, kinds: DEFAULT_TARGET_KINDS }, { windowRef: historyWindow, documentRef: fakeDocument }); historyWindow.__V100_MANUAL_SPECIAL_QA__.start(); raf.shift()?.(); const historyState = historyWindow.__V100_MANUAL_SPECIAL_QA__; assert.deepEqual(historyState.contractFailures(), [], "historical render audit does not create a current-render failure"); assert.equal(historyState.samples().length, 0, "historical render audit is not a rendered sample"); assert.equal(historyState.captureNames().length, 0, "historical render audit never captures a PNG"); assert.equal(historyState.phaseOnlyObservations().length, 1, "finite phase evidence is retained separately");
  const noHistory = structuredClone(historyOnly); delete noHistory.fighters[0].renderAuditHistory; const noHistoryWindow = { __ASHFALL_BATTLE_QA__: { getSnapshot: () => noHistory }, requestAnimationFrame: (callback) => raf.push(callback) }; raf.length = 0; serialized({ maxSamples: 2, kinds: DEFAULT_TARGET_KINDS }, { windowRef: noHistoryWindow, documentRef: fakeDocument }); noHistoryWindow.__V100_MANUAL_SPECIAL_QA__.start(); raf.shift()?.(); assert.ok(noHistoryWindow.__V100_MANUAL_SPECIAL_QA__.contractFailures().some((failure) => failure.type === "missing-render-audit"), "null current audit without history remains a failure");
  const supportSnapshots = [
    { time: 1, fighters: [{ id: 3, side: "human", kind: "medic", hp: 100, maxHp: 100, manualAbility: { phase: "windup", activationId: 8, windupRemaining: .2, activeRemaining: 0, abilityElapsed: 0, target: { targetId: 9 } }, renderAudit: { spriteState: "attack-a", spritePath: "/art/v060/characters/legacy/nao-battle-v1.png", direction: "right", frameFlipX: false, renderSequence: 1 } }], manualAbilityReceipts: [], manualAbilityVfx: [], v100SupportEffects: [], v100SkillContacts: [] },
    { time: 1.55, fighters: [{ id: 3, side: "human", kind: "medic", hp: 100, maxHp: 100, manualAbility: { phase: "recovery", activationId: 8, windupRemaining: .1, activeRemaining: 0, abilityElapsed: .45, target: { targetId: 9 } }, renderAudit: { spriteState: "attack-b", spritePath: "/art/v060/characters/legacy/nao-battle-v1.png", direction: "right", frameFlipX: false, renderSequence: 2 } }], manualAbilityReceipts: [{ ownerId: 3, activationId: 8, at: 1.4, eventType: "impact" }], manualAbilityVfx: [{ ownerId: 3, activationId: 8, duration: .3, elapsed: .15 }], v100SupportEffects: [{ ownerId: 3, activationId: 8, eventType: "medic-impact", targetId: 9, x: 100, y: 200, startedAt: 1.4, duration: .3, elapsed: .15 }], v100SkillContacts: [] },
    { time: 1.9, fighters: [{ id: 3, side: "human", kind: "medic", hp: 100, maxHp: 100, manualAbility: { phase: "ready", activationId: 8, windupRemaining: 0, activeRemaining: 0, abilityElapsed: 0, target: null }, renderAudit: { spriteState: "idle", spritePath: "/art/v060/characters/legacy/nao-battle-v1.png", direction: "right", frameFlipX: false, renderSequence: 3 } }], manualAbilityReceipts: [{ ownerId: 3, activationId: 8, at: 1.4, eventType: "impact" }], manualAbilityVfx: [], v100SupportEffects: [], v100SkillContacts: [] },
  ];
  const supportPhase = { index: 0 }; const supportWindow = { __ASHFALL_BATTLE_QA__: { getSnapshot: () => supportSnapshots[Math.min(supportPhase.index, supportSnapshots.length - 1)] }, requestAnimationFrame: (callback) => raf.push(callback) }; raf.length = 0; serialized({ maxSamples: 8, kinds: ["medic"] }, { windowRef: supportWindow, documentRef: fakeDocument }); supportWindow.__V100_MANUAL_SPECIAL_QA__.start(); for (supportPhase.index = 0; supportPhase.index < supportSnapshots.length; supportPhase.index += 1) raf.shift()?.(); const supportState = supportWindow.__V100_MANUAL_SPECIAL_QA__; assert.deepEqual(supportState.contractFailures(), []); assert.deepEqual(supportState.sufficientKinds(), ["medic"]); assert.ok(supportState.samples().some((sample) => sample.supportEffects.length === 1 && Number.isFinite(sample.supportEffects[0].targetId))); assert.ok(supportState.captureNames().some((name) => name.endsWith("-support-effect")));
  return { serialized: true, samples: samples.length, captures: state.captureNames(), otherOwnerIgnored: true, staleReceiptIgnored: true, receiptTimeRejected: true, nullTimeRejected: true, historyOnlySkipped: true, noHistoryRejected: true, phaseOnlyObservations: historyState.phaseOnlyObservations(), windupDecorationLegal: true };
}

const samplerControl = runSamplerControl();
if (process.env.V100_MANUAL_SPECIAL_CONTROL_ONLY === "1") { console.log(JSON.stringify({ control: samplerControl })); process.exit(0); }
assert.ok(origin, "V100_CAMPAIGN_QA_BASE_URL is required");
const stageId = V100_STAGE_IDS[2]; const base = createDefaultV100Save({ playerName: "Manual special phase audit" });
const rawSave = { ...base, campaignStarted: true, revision: 1, availableStageIds: V100_STAGE_IDS.slice(0, 3), completedStageIds: V100_STAGE_IDS.slice(0, 2), ownedUnitIds: TARGET_UNIT_IDS, registeredUnitIds: TARGET_UNIT_IDS, formationSlots: TARGET_UNIT_IDS, unitLevels: Object.fromEntries(TARGET_UNIT_IDS.map((id) => [id, 1])), vehicle: { ...base.vehicle, upgradeLevel: V100_VEHICLE.maxUpgradeLevel }, flowState: { phase: "formation", stageId, stageNumber: 3, eventId: null, destination: "formation", nodeIndex: 0, firstClear: false, finalized: true } };
const saveObject = normalizeV100Save(rawSave); const save = serializeV100Save(saveObject);
const report = { status: "running", scope: "S3 ordinary UI manual-special observation only; no actor/time/HP/result setters; native appearance acceptance remains pending", engine, runtimeChoice: useCurrentWebKit ? "current-webkit-runtime" : "default-playwright-runtime", targetSelection: { requestedEnv: requestedKindsValue ?? null, defaultKinds: DEFAULT_TARGET_KINDS, selectedKinds: TARGET_KINDS }, build: await productionBuildIdentity(), fixture: { requestedUnitIds: TARGET_UNIT_IDS, normalizedOwnedUnitIds: saveObject.ownedUnitIds, normalizedRegisteredUnitIds: saveObject.registeredUnitIds, formationSlots: saveObject.formationSlots, unitLevels: Object.fromEntries(TARGET_UNIT_IDS.map((id) => [id, saveObject.unitLevels[id]])), vehicleUpgradeLevel: saveObject.vehicle.upgradeLevel, vehicleMaxHp: saveObject.vehicle.maxHp, completedStageIds: saveObject.completedStageIds }, deadlineSeconds: 120, samplerControl, phaseOnlyObservations: [], samples: [], captures: [], deployedKinds: [], sufficientKinds: [], unobservedKinds: TARGET_KINDS.slice(), errors: [], inputs: [] };
await mkdir(output, { recursive: true });
const browser = await ({ chromium, webkit }[engine]).launch({ headless: true }); const context = await browser.newContext({ viewport, hasTouch: true, isMobile: true, recordVideo: { dir: `${output}/videos`, size: viewport } }); const page = await context.newPage(); page.setDefaultTimeout(15000); page.on("pageerror", (error) => report.errors.push(String(error))); page.on("console", (message) => { if (message.type() === "error") report.errors.push(message.text()); }); page.on("requestfailed", (request) => report.errors.push(`requestfailed ${request.url()} ${request.failure()?.errorText ?? "unknown"}`));
try {
  await page.addInitScript(installManualSpecialSampler, { maxSamples: MAX_SAMPLES_PER_OWNER, kinds: TARGET_KINDS }); await page.addInitScript((value) => { for (const key of ["nishijin-campaign-v100", "nishijin-campaign-v100:mirror", "nishijin-campaign-v100:last-known-good"]) localStorage.setItem(key, value); }, save);
  await page.goto(new URL("v100", origin).href); const play = page.getByRole("button", { name: "ブラウザで遊ぶ", exact: true }); const start = page.getByRole("button", { name: "戦闘へ", exact: true }); await play.or(start).first().waitFor(); if (await play.isVisible()) await play.click(); await start.click(); await page.locator(".game-shell canvas").waitFor(); await page.waitForFunction(() => window.__ASHFALL_BATTLE_QA__?.getSnapshot?.().running); await page.evaluate(() => window.__V100_MANUAL_SPECIAL_QA__?.start());
  const deadline = Date.now() + report.deadlineSeconds * 1000; const record = { inputs: [], samples: [] };
  while (Date.now() < deadline) { if (await page.evaluate(() => window.__V100_MANUAL_SPECIAL_QA__?.complete?.() ?? false)) break; const snapshot = await page.evaluate(() => window.__ASHFALL_BATTLE_QA__?.getSnapshot?.()); if (snapshot?.running && !snapshot.over) { await normalTacticalInput(page, record); } if (snapshot?.over || snapshot?.running === false) break; await page.waitForTimeout(350); }
  await page.evaluate(() => window.__V100_MANUAL_SPECIAL_QA__?.stop()); const observed = await page.evaluate(() => ({ samples: window.__V100_MANUAL_SPECIAL_QA__?.samples?.() ?? [], phaseOnlyObservations: window.__V100_MANUAL_SPECIAL_QA__?.phaseOnlyObservations?.() ?? [], missingApi: window.__V100_MANUAL_SPECIAL_QA__?.missingApi?.() ?? true, contractFailures: window.__V100_MANUAL_SPECIAL_QA__?.contractFailures?.() ?? [{ missing: true }], deployedKinds: window.__V100_MANUAL_SPECIAL_QA__?.deployedKinds?.() ?? [], sufficientKinds: window.__V100_MANUAL_SPECIAL_QA__?.sufficientKinds?.() ?? [], ownerStats: window.__V100_MANUAL_SPECIAL_QA__?.ownerStats?.() ?? [], captures: window.__V100_MANUAL_SPECIAL_QA__?.exportCaptures?.() ?? {} })); report.samples = observed.samples; report.phaseOnlyObservations = observed.phaseOnlyObservations; report.inputs = record.inputs; report.deployedKinds = observed.deployedKinds; report.sufficientKinds = observed.sufficientKinds; report.ownerStats = observed.ownerStats; report.unobservedKinds = TARGET_KINDS.filter((kind) => !observed.sufficientKinds.includes(kind)); report.missingApi = observed.missingApi; report.contractFailures = observed.contractFailures; report.captureFiles = {}; for (const [name, data] of Object.entries(observed.captures)) { assert.match(data, /^data:image\/png;base64,/); const bytes = Buffer.from(data.split(",")[1], "base64"); assert.ok(bytes.length > 24); const relativePath = `${safeCaptureName(name)}.png`; await writeFile(`${output}/${relativePath}`, bytes); report.captureFiles[name] = { file: relativePath, bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") }; report.captures.push(name); } report.observationMetadata = { sampleCount: report.samples.length, phaseOnlyObservationCount: report.phaseOnlyObservations.length, captureCount: report.captures.length, deployedKinds: report.deployedKinds.slice(), sufficientKinds: report.sufficientKinds.slice(), unobservedKinds: report.unobservedKinds.slice(), missingApi: report.missingApi, contractFailureCount: report.contractFailures.length, errorCount: report.errors.length }; report.status = (report.missingApi || report.contractFailures.length > 0 || report.errors.length > 0) ? "observation-error" : "observed";
} catch (error) { report.status = "failed"; report.error = String(error.stack ?? error); process.exitCode = 1; } finally { await context.close(); await browser.close(); await writeFile(`${output}/report.json`, `${JSON.stringify(report, null, 2)}\n`); console.log(JSON.stringify({ status: report.status, observedKinds: report.observedKinds, unobservedKinds: report.unobservedKinds, captures: report.captures.length })); }
