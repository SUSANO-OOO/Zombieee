// This function is passed directly to page.evaluate. Project before crossing
// the browser protocol; keep the detailed snapshot available to visual audits.
export function readRuntimeObservation() {
  const snapshot = window.__ASHFALL_BATTLE_QA__?.getSnapshot?.();
  if (!snapshot) return null;
  const living = (snapshot.fighters ?? []).filter((fighter) => Number(fighter.hp) > 0);
  return {
    stageId: snapshot.stageId,
    operationId: snapshot.operationId,
    time: snapshot.time,
    running: snapshot.running,
    over: snapshot.over,
    won: typeof snapshot.won === "boolean" ? snapshot.won : null,
    baseHp: snapshot.baseHp,
    baseMaxHp: snapshot.baseMaxHp,
    humanCount: living.filter((fighter) => fighter.side === "human").length,
    enemyCount: living.filter((fighter) => fighter.side === "zombie").length,
    boss: living.filter((fighter) => fighter.side === "zombie" && fighter.kind === "mugarian-president-mutated")
      .map(({ id, kind, hp, maxHp, x, y, lane, combatReady }) => ({ id, kind, hp, maxHp, x, y, lane, combatReady })),
    humans: living.filter((fighter) => fighter.side === "human")
      .map(({ id, kind, hp, maxHp, x, y, lane }) => ({ id, kind, hp, maxHp, x, y, lane })),
  };
}

// Project only after measurement has stopped. Full samples stay in report.json;
// both successful controls and failures need readable costs in bounded CI logs.
export function runtimePerformanceConsoleSummary(value) {
  if (!value) return null;
  const diagnostic = value.callbackDiagnostic;
  const costs = diagnostic?.timeline?.costs;
  return {
    p95RafMs: value.p95RafMs,
    medianFps: value.medianFps,
    effectiveRenderHz: value.effectiveRenderHz,
    rafSampleCount: value.raf?.count,
    rafElapsedMs: value.raf?.elapsedMs,
    callbackDiagnosticStoredInReport: Boolean(diagnostic),
    callbackDiagnostic: diagnostic ? {
      diagnosticOnly: diagnostic.diagnosticOnly,
      count: diagnostic.count,
      p50Ms: diagnostic.p50Ms,
      p95Ms: diagnostic.p95Ms,
      maxMs: diagnostic.maxMs,
      over8Ms: diagnostic.over8Ms,
      over16Ms: diagnostic.over16Ms,
      over33Ms: diagnostic.over33Ms,
      timeline: {
        clock: diagnostic.timeline?.clock,
        maxRecords: diagnostic.timeline?.maxRecords,
        overflow: diagnostic.timeline?.overflow,
        costs: Object.fromEntries(["raf", "layout", "snapshot", "pointerdown", "pointerup"].flatMap(kind => {
          const cost = costs?.[kind];
          return cost ? [[kind, { count: cost.count, p95Ms: cost.p95Ms, maxMs: cost.maxMs }]] : [];
        })),
      },
    } : null,
    gates: value.gates,
  };
}

// Optional read-only timing, on the same clock as the existing rAF samples.
// No extra polling, input, frame, timer, or state setter is introduced.
export function installRuntimeObservationDiagnostics() {
  const originalRaf = window.requestAnimationFrame;
  const originalRect = Element.prototype.getBoundingClientRect;
  const records = [];
  const maxRecords = 12_000;
  let active = false;
  let overflow = 0;
  let snapshotOwner = null;
  let originalSnapshot = null;
  let snapshotWrapper = null;
  const record = (kind, startedAt, endedAt, frameTimestamp = null) => {
    if (records.length < maxRecords) records.push({ kind, startedAt, endedAt, durationMs: endedAt - startedAt, frameTimestamp });
    else overflow += 1;
  };
  window.requestAnimationFrame = function(callback) {
    return originalRaf.call(window, (timestamp) => {
      if (!active) return callback(timestamp);
      const startedAt = performance.now();
      try { return callback(timestamp); }
      finally { record("raf", startedAt, performance.now(), timestamp); }
    });
  };
  Element.prototype.getBoundingClientRect = function(...args) {
    if (!active) return originalRect.apply(this, args);
    const startedAt = performance.now();
    try { return originalRect.apply(this, args); }
    finally { record("layout", startedAt, performance.now()); }
  };
  const pointer = (event) => {
    if (active) {
      const at = performance.now();
      record(event.type, at, at);
    }
  };
  const pointerTypes = ["pointerdown", "pointerup"];
  for (const type of pointerTypes) window.addEventListener(type, pointer, { capture: true, passive: true });
  window.__V100_RAF_CALLBACK_DIAG__ = {
    start() {
      records.length = 0;
      overflow = 0;
      snapshotOwner = window.__ASHFALL_BATTLE_QA__;
      originalSnapshot = snapshotOwner?.getSnapshot;
      if (typeof originalSnapshot !== "function") throw new Error("Runtime observation diagnostic requires the live snapshot getter");
      snapshotWrapper = function(...args) {
        if (!active) return originalSnapshot.apply(this, args);
        const startedAt = performance.now();
        try { return originalSnapshot.apply(this, args); }
        finally { record("snapshot", startedAt, performance.now()); }
      };
      snapshotOwner.getSnapshot = snapshotWrapper;
      if (snapshotOwner.getSnapshot !== snapshotWrapper) throw new Error("Runtime snapshot timing hook was not installed");
      active = true;
    },
    stop() {
      active = false;
      if (snapshotOwner?.getSnapshot === snapshotWrapper) snapshotOwner.getSnapshot = originalSnapshot;
      window.requestAnimationFrame = originalRaf;
      Element.prototype.getBoundingClientRect = originalRect;
      for (const type of pointerTypes) window.removeEventListener(type, pointer, { capture: true });
      const durations = records.filter((row) => row.kind === "raf").map((row) => row.durationMs).sort((a, b) => a - b);
      const at = (fraction) => durations[Math.min(durations.length - 1, Math.ceil(durations.length * fraction) - 1)] ?? null;
      const kinds = [...new Set(records.map((row) => row.kind))];
      const costs = Object.fromEntries(kinds.map((kind) => {
        const samples = records.filter((row) => row.kind === kind).map((row) => row.durationMs).sort((a, b) => a - b);
        return [kind, { count: samples.length, p95Ms: samples[Math.ceil(samples.length * .95) - 1], maxMs: samples.at(-1) }];
      }));
      return {
        diagnosticOnly: true,
        count: durations.length,
        p50Ms: at(.5),
        p95Ms: at(.95),
        maxMs: durations.at(-1) ?? null,
        over8Ms: durations.filter((duration) => duration > 8).length,
        over16Ms: durations.filter((duration) => duration > 16).length,
        over33Ms: durations.filter((duration) => duration > 33).length,
        timeline: { clock: "performance.now", maxRecords, overflow, costs, records },
      };
    },
  };
}
