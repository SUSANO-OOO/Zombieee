const MAX_SEMANTIC_RECEIPTS = 4096;
const MAX_DELAYED_CUES = 128;
const MAX_DIAGNOSTICS = 32;

function normalizeReceiptPart(value) {
  return typeof value === "string" || typeof value === "number" ? String(value) : "";
}

function normalizeGeneration(value, fallback) {
  const generation = Number(value);
  return Number.isInteger(generation) && generation >= 0 ? generation : fallback;
}

function diagnosticKey(generation, code) {
  return `${generation}:${code}`;
}

function pushDiagnostic(runtime, code, details = {}) {
  const key = diagnosticKey(runtime.battleGeneration, code);
  if (runtime.diagnosticKeys.has(key)) return false;
  runtime.diagnosticKeys.add(key);
  runtime.diagnostics.push(Object.freeze({
    code,
    generation: runtime.battleGeneration,
    at: runtime.diagnostics.length,
    ...details,
  }));
  if (runtime.diagnostics.length > MAX_DIAGNOSTICS) runtime.diagnostics.shift();
  return true;
}

export function createBattleAudioRuntime({ maxReceipts = MAX_SEMANTIC_RECEIPTS } = {}) {
  const boundedMaxReceipts = Math.max(1, Math.min(MAX_SEMANTIC_RECEIPTS, Number(maxReceipts) || MAX_SEMANTIC_RECEIPTS));
  return {
    battleGeneration: 0,
    maxReceipts: boundedMaxReceipts,
    playedSemanticReceipts: new Set(),
    delayedCues: [],
    diagnosticKeys: new Set(),
    diagnostics: [],
    stopped: false,
  };
}

export function resetBattleAudioRuntime(runtime, reason = "reset") {
  if (!runtime || typeof runtime !== "object") return 0;
  runtime.battleGeneration += 1;
  runtime.playedSemanticReceipts.clear();
  runtime.delayedCues.length = 0;
  runtime.diagnosticKeys.clear();
  runtime.stopped = false;
  pushDiagnostic(runtime, "battle-audio-generation-reset", { reason });
  return runtime.battleGeneration;
}

export function stopBattleAudioRuntime(runtime, reason = "stop") {
  if (!runtime || typeof runtime !== "object") return 0;
  runtime.battleGeneration += 1;
  runtime.playedSemanticReceipts.clear();
  runtime.delayedCues.length = 0;
  runtime.diagnosticKeys.clear();
  runtime.stopped = true;
  pushDiagnostic(runtime, "battle-audio-stopped", { reason });
  return runtime.battleGeneration;
}

export function battleSemanticReceiptKey({ battleGeneration, semantic, receiptId } = {}) {
  const generation = normalizeReceiptPart(battleGeneration);
  const normalizedSemantic = normalizeReceiptPart(semantic);
  const normalizedReceipt = normalizeReceiptPart(receiptId);
  if (!generation || !normalizedSemantic || !normalizedReceipt) return null;
  return `battle:${generation}:${normalizedSemantic}:${normalizedReceipt}`;
}

export function tryConsumeSemanticReceipt(runtime, {
  battleGeneration = runtime?.battleGeneration,
  semantic,
  receiptId,
} = {}) {
  if (!runtime || runtime.stopped) return false;
  const generation = normalizeGeneration(battleGeneration, runtime.battleGeneration);
  if (generation !== runtime.battleGeneration) {
    pushDiagnostic(runtime, "semantic-receipt-generation-mismatch", { generation, semantic, receiptId });
    return false;
  }
  const key = battleSemanticReceiptKey({ battleGeneration: generation, semantic, receiptId });
  if (!key) {
    pushDiagnostic(runtime, "semantic-receipt-invalid", { semantic, receiptId });
    return false;
  }
  if (runtime.playedSemanticReceipts.has(key)) return false;
  if (runtime.playedSemanticReceipts.size >= runtime.maxReceipts) {
    pushDiagnostic(runtime, "semantic-receipt-ledger-capacity", { maxReceipts: runtime.maxReceipts });
    return false;
  }
  runtime.playedSemanticReceipts.add(key);
  return true;
}

export function scheduleDelayedBattleAudioCue(runtime, entry = {}) {
  if (!runtime || runtime.stopped) return false;
  const battleGeneration = normalizeGeneration(entry.battleGeneration, runtime.battleGeneration);
  const ownerId = normalizeReceiptPart(entry.ownerId);
  const semantic = normalizeReceiptPart(entry.semantic);
  const receiptId = normalizeReceiptPart(entry.receiptId);
  const cueId = normalizeReceiptPart(entry.cueId);
  const activationId = Number(entry.activationId ?? 0);
  const dueSimulationTime = Number(entry.dueSimulationTime);
  if (battleGeneration !== runtime.battleGeneration
    || !ownerId
    || !semantic
    || !receiptId
    || !cueId
    || !Number.isInteger(activationId)
    || !Number.isFinite(dueSimulationTime)) {
    pushDiagnostic(runtime, "delayed-cue-invalid", { semantic, receiptId, cueId });
    return false;
  }
  if (runtime.delayedCues.length >= MAX_DELAYED_CUES) {
    pushDiagnostic(runtime, "delayed-cue-capacity", { maxDelayedCues: MAX_DELAYED_CUES });
    return false;
  }
  runtime.delayedCues.push(Object.freeze({
    battleGeneration,
    ownerId,
    activationId,
    semantic,
    receiptId,
    cueId,
    dueSimulationTime,
    x: Number.isFinite(Number(entry.x)) ? Number(entry.x) : 0,
    priority: entry.priority,
    cooldownMs: entry.cooldownMs,
    volume: entry.volume,
    maxInstances: entry.maxInstances,
  }));
  return true;
}

export function takeDueBattleAudioCues(runtime, {
  simulationTime,
  isBattleActive = true,
  resolveOwner = () => null,
} = {}) {
  if (!runtime || runtime.stopped || !isBattleActive) return [];
  const now = Number(simulationTime);
  if (!Number.isFinite(now)) return [];
  const due = [];
  const pending = [];
  for (const entry of runtime.delayedCues.splice(0)) {
    if (entry.battleGeneration !== runtime.battleGeneration || entry.dueSimulationTime > now) {
      pending.push(entry);
      continue;
    }
    const owner = resolveOwner(entry.ownerId);
    const ownerActive = owner?.alive === true && owner.retreat !== true;
    const activationActive = entry.activationId === 0
      || (Number(owner.activationId) === entry.activationId && owner.phase !== "retreat" && owner.phase !== "cooldown");
    if (!ownerActive || !activationActive) continue;
    if (!tryConsumeSemanticReceipt(runtime, entry)) continue;
    due.push(entry);
  }
  runtime.delayedCues.push(...pending.slice(-MAX_DELAYED_CUES));
  return due;
}

export function clearDelayedBattleAudioCues(runtime) {
  if (!runtime) return 0;
  const count = runtime.delayedCues.length;
  runtime.delayedCues.length = 0;
  return count;
}

export function battleAudioRuntimeSnapshot(runtime) {
  if (!runtime) return null;
  return Object.freeze({
    battleGeneration: runtime.battleGeneration,
    playedSemanticReceipts: runtime.playedSemanticReceipts.size,
    delayedCues: runtime.delayedCues.map((entry) => ({ ...entry })),
    diagnostics: runtime.diagnostics.map((entry) => ({ ...entry })),
    stopped: runtime.stopped,
  });
}

export const BATTLE_AUDIO_RUNTIME_LIMITS = Object.freeze({
  MAX_SEMANTIC_RECEIPTS,
  MAX_DELAYED_CUES,
  MAX_DIAGNOSTICS,
});
