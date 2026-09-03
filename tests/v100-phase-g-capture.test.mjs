import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { EventEmitter } from "node:events";
import { mkdtemp, readFile, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import { ESLint } from "eslint";
import ts from "typescript";
import { manualMarkerActivation, validateV100CaptureRepresentativeEvidence, deriveV100RuntimeObservation } from "../scripts/v100-phase-g-runtime-evidence.mjs";
import { V100_REPRESENTATIVE_COMBAT_CONTRACT, validateV100RepresentativeCombatEvidence } from "../app/v100PhaseGContract.js";
import { LEGACY_SFX_CUE_MAP } from "../app/productionAudio.js";
import { V100_STAGE_IDS, V100_STAGES, V100_UNITS } from "../app/v100Registry.js";
import { createV100PhaseGProofMachine } from "../scripts/v100-phase-g-proof-machine.mjs";

const matrixPath = "scripts/v100-phase-g-production-matrix.mjs";
const source = await readFile(matrixPath, "utf8");
const parsed = ts.createSourceFile(matrixPath, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
const checkpointDeclaration = parsed.statements.find((node) => ts.isVariableStatement(node)
  && node.declarationList.declarations.some((entry) => entry.name.getText(parsed) === "BATTLE_EXTRA_CHECKPOINTS"));
assert.ok(checkpointDeclaration, "actual checkpoint registry must exist");
const registeredCheckpoints = Array.from(vm.runInNewContext(checkpointDeclaration.getText(parsed) + "\nBATTLE_EXTRA_CHECKPOINTS"));
test("canonical capture selection rejects empty filters and missing/foreign results independently of results.length", () => {
  const constants = ["requiredViewports", "extraBattleViewports", "MAXED_QA_UNIT_LEVELS", "extraBattleContracts", "coreStates"];
  const declarations = constants.map((name) => parsed.statements.find((node) => ts.isVariableStatement(node)
    && node.declarationList.declarations.some((entry) => entry.name.getText(parsed) === name)).getText(parsed));
  const functions = ["phaseGCapturePlan", "phaseGResultsMatchPlan"].map((name) => parsed.statements.find((node) =>
    ts.isFunctionDeclaration(node) && node.name?.text === name).getText(parsed));
  const api = vm.runInNewContext(declarations.concat(functions).join("\n") +
    "\n({ select: (filters = {}) => phaseGCapturePlan({coreStates,requiredViewports,extraBattleContracts,...filters}), matches: phaseGResultsMatchPlan })",
  { V100_STAGE_IDS, V100_STAGES, V100_UNITS });
  const full = api.select();
  assert.equal(full.length, 54);
  assert.equal(api.select({ onlyState: "battle-extra" }).length, 6);
  assert.equal(api.select({ onlyState: "battle-extra", onlyEngine: "webkit" }).length, 3);
  assert.equal(api.select({ onlyState: "battle-normal" }).length, 3);
  for (const entry of full.filter((entry) => entry.state === "battle-extra")) {
    assert.equal(api.select({ onlyVariant: entry.variant, onlyEngine: entry.engine }).length, 1);
  }
  for (const filters of [{ onlyVariant: "stage21-panther-knife-smg" }, { onlyState: "unknown" },
    { onlyEngine: "unknown" }, { onlyVariant: "core-battle-normal" },
    { onlyVariant: "stage21-panther-knife", onlyEngine: "webkit" }]) {
    assert.throws(() => api.select(filters), /PHASE_G_EMPTY_CAPTURE_PLAN/u);
  }
  assert.equal(api.matches(full, [...full].reverse()), true);
  assert.equal(api.matches(full, []), false);
  assert.equal(api.matches([], []), false);
  assert.equal(api.matches(full, full.slice(1)), false);
  assert.equal(api.matches(full, [full[0], ...full.slice(0, -1)]), false);
  assert.equal(api.matches(full, [{ ...full[0], variant: "foreign" }, ...full.slice(1)]), false);
});
function checkpointCallAudit(text) {
  const ast = ts.createSourceFile(matrixPath, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const unknown = [];
  const visited = new Set();
  const visit = (node) => {
    if (ts.isCallExpression(node)) {
      const callee = node.expression;
      const method = ts.isPropertyAccessExpression(callee) ? callee.name.text : ts.isIdentifier(callee) ? callee.text : null;
      if (["mark", "markOnce"].includes(method) && ts.isStringLiteral(node.arguments[0])) {
        const name = node.arguments[0].text;
        visited.add(name);
        if (!registeredCheckpoints.includes(name)) unknown.push(name);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(ast);
  return { unknown, visited };
}
test("every checkpoint callsite, including setup branches, belongs to the actual registry", () => {
  const audit = checkpointCallAudit(source);
  assert.deepEqual(audit.unknown, []);
  assert.deepEqual(registeredCheckpoints.filter((name) => !audit.visited.has(name)), []);
  const broken = source.replace('mark("causal-proof-complete"', 'mark("unregistered-fixture-checkpoint"');
  assert.deepEqual(checkpointCallAudit(broken).unknown, ["unregistered-fixture-checkpoint"]);
});
const functionNames = [
  "captureStateImpl", "overflowAudit", "saveScreenshot", "writePhaseGCaptureTransaction",
  "invariant", "cloneDiagnosticValue", "phaseGBrowserLifecyclePolicy", "diagnosticsFor",
  "viewportLabel", "imagePath", "relativeEvidence", "assertRequiredBossRuntime", "sealCombatProofScreenshot",
];
const actualFunctions = functionNames.map((name) => {
  const node = parsed.statements.find((entry) => ts.isFunctionDeclaration(entry) && entry.name?.text === name);
  assert.ok(node, `capture dependency must exist: ${name}`);
  return node.getText(parsed);
}).join("\n");

// Browser/DOM and the preceding collector are fixture I/O. The complete actual
// capture coordinator, PNG checks, proof machine, diagnostics and disk writer
// run unchanged. These fixtures are not production/browser acceptance evidence.
async function fixture(t, options = {}) {
  const evidenceDir = await mkdtemp(path.join(os.tmpdir(), "v100-capture-contract-"));
  const events = [];
  const results = [];
  let collectionCalls = 0;
  const machine = createV100PhaseGProofMachine();
  const impacts = [
    { sourceId: 1, sourceSide: "human", sourceKind: "ranger", targetId: 3, targetSide: "zombie", targetKind: "spitter" },
    { sourceId: 3, sourceSide: "zombie", sourceKind: "spitter", targetId: 1, targetSide: "human", targetKind: "ranger" },
  ].map((identity) => ({
    schema: machine.receiptSchema, battleGeneration: 2, attackSequence: 1,
    impactOrdinal: 0, mode: "projectile", committedAtBattleTime: 30,
    contactAtBattleTime: 30.2, reactionOutcome: "hit", audioCueId: "fixture-attack",
    audioRequestObserved: true, audioReceiptId: `combat-attack:2:${identity.sourceId}:1`, ...identity,
  }));
  const snapshot = {
    schema: "v100-phase-g-combat-snapshot/v1", battleGeneration: 2, screen: "battle",
    stageId: "fixture-stage", time: 30.2, completedAttackImpacts: impacts, fighters: [],
  };
  const accepted = machine.observe(machine.createProof({
    battleGeneration: 2, requiredActorKeys: ["human:ranger", "zombie:spitter"],
    startedAtPageTime: 1000, startedAtBattleTime: 30, deadlineAtPageTime: 13000,
  }), { snapshot, pageNow: 1050 });
  assert.equal(accepted.state, "ATTACK_ACCEPTED");
  const element = { scrollWidth: 667 + (options.overflow ?? 0), clientWidth: 667,
    innerText: options.blank ? "" : "actual body fixture", getAttribute: () => "battle" };
  const document = {
    documentElement: { ...element, dataset: {} }, body: element,
    querySelector: () => element,
  };
  const browser = new EventEmitter();
  const context = new EventEmitter();
  const page = new EventEmitter();
  let stopped = 0;
  const window = { __ASHFALL_BATTLE_QA__: { getPhaseGCombatSnapshot: () => snapshot } };
  page.evaluate = async (callback, arg) => {
    if (callback.toString() === "() => performance.now()") {
      events.push("observer-stop"); stopped += 1;
      if (options.cleanupMissing) throw new Error("fixture cleanup read failed");
    }
    return vm.runInNewContext(`(${callback.toString()})(arg)`, {
    document, window, arg, location: { href: "http://fixture.invalid/" },
    performance: { now: () => events.includes("screenshot") ? options.screenshotTime ?? 1100 : options.lockTime ?? 1050 },
  });
  };
  page.locator = () => ({ evaluate: async (callback) => callback(element) });
  page.screenshot = async ({ path: filePath }) => {
    events.push("screenshot");
    const png = Buffer.alloc(options.invalidPng ? 8 : 1200);
    Buffer.from("89504e470d0a1a0a", "hex").copy(png);
    await writeFile(filePath, png);
  };
  context.newPage = async () => page;
  context.close = async () => { events.push("context-close"); context.emit("close"); };
  browser.newContext = async () => context;
  const recorder = {
    attach() {}, setLatestReadableState() {}, setAwaiting() {}, clearAwaiting() {},
    markOnce(name) { assert.ok(registeredCheckpoints.includes(name), "unregistered fixture checkpoint " + name); },
    mark(name) { assert.ok(registeredCheckpoints.includes(name), "unregistered fixture checkpoint " + name); },
    snapshot: () => ({ unresolvedCheckpoints: options.unresolved ? ["fixture-checkpoint"] : [] }),
    persistFailure: async () => ({ failure: true, unresolvedCheckpoints: [] }),
    writeFailureFile: async () => { events.push("checkpoint-persist"); },
  };
  const globals = {
    evidenceDir, path, process, readFile, stat, createHash, results,
    validateV100CaptureRepresentativeEvidence,
    writeFile: async (filePath, bytes) => {
      events.push("transaction-write");
      if (options.persistenceFailure) throw new Error("fixture disk write failed");
      await writeFile(filePath, bytes);
    },
    phaseGProofMachine: machine, combatProofDurationMs: 12000,
    withPhaseGPageInputLock: async (_page, operation) => { events.push("input-lock"); return operation(); },
    phaseGCheckpointRecorders: new Set(), pageCheckpointRecorders: new WeakMap(),
    phaseGBrowser: async () => browser,
    resetPhaseGBrowser: async () => { events.push("browser-reset"); },
    phaseGBrowserSessionForCapture: () => ({ sessionId: "fixture", captureOrdinal: 1 }),
    createBattleExtraCheckpointRecorder: () => recorder,
    createWebKitHostResourceTelemetry: async () => ({
      setContext() {}, event: (name, details) => {
        if (name === "operation-begin") events.push(details.operationId);
      }, reference: () => ({ fixture: true }), stop: async () => ({ supported: false }),
    }),
    productionStateContract: async () => ({ ok: true }),
    collectCombatCausalProof: async () => { collectionCalls += 1; return {
      ok: true, completedImpactProof: accepted,
      collection: { converged: true, withinReleaseDeadline: true },
    }; },
  };
  const capture = vm.runInNewContext(`${actualFunctions}\ncaptureStateImpl`, globals);
  const run = () => capture("webkit", { width: 667, height: 375 }, "battle-extra", async (_page, captureAction) => {
    if (options.setupFailure) throw Object.assign(new Error("fixture setup failure"), { phaseGBattleSetup: options.setupFailure });
    if (options.fatal === "console") page.emit("console", { type: () => "error", text: () => "fixture error" });
    if (options.fatal === "page") page.emit("pageerror", new Error("fixture page error"));
    if (options.fatal === "http") page.emit("response", { status: () => 404, url: () => "fixture://404" });
    if (options.fatal === "request") page.emit("requestfailed", { failure: () => ({ errorText: "failed" }), url: () => "fixture://failed" });
    const sealed = options.preparedProof ? await captureAction({
      requiredCompletedImpactActorKeys: ["human:ranger", "zombie:spitter"], durationMs: 12000,
    }) : null;
    if (options.sceneFailure) throw new Error("fixture later boss never appeared");
    return { variant: options.variant ?? "stage06-spitter-seal", setupEvidence: options.setupEvidence ?? null, bossKind: options.bossKind ?? null,
      sealedCombatCausalProof: sealed,
      requiredCompletedImpactActorKeys: options.noRequiredKeys ? [] : ["human:ranger", "zombie:spitter"] };
  }, { variant: "fixture", completedImpactProof: true });
  t.after(() => assert.ok(events.includes("context-close"), "capture must close its context"));
  return {
    run, events, results, stopped: () => stopped, collectionCalls: () => collectionCalls,
    receipt: async () => JSON.parse(await readFile(path.join(evidenceDir, "webkit-667x375-battle-extra.capture-transaction.json"), "utf8")),
  };
}

test("capture consumes its one prepared production proof and its own PNG without re-baselining or collecting again", async (t) => {
  const f = await fixture(t, { preparedProof: true });
  await f.run();
  assert.equal(f.collectionCalls(), 1);
  assert.equal((await f.receipt()).completedImpactProof.state, "COMPLETE");
  assert.equal(f.results[0].sealedCombatCausalProof, undefined);
});

test("a prepared proof for different required actors cannot satisfy this capture", async (t) => {
  const f = await fixture(t, { preparedProof: true, noRequiredKeys: true });
  await assert.rejects(f.run(), /does not match this capture/u);
  assert.equal(f.collectionCalls(), 1);
});

test("capture pipeline has no missing lexical dependencies before browser startup", async () => {
  const eslint = new ESLint({ overrideConfig: { rules: { "no-undef": "error" } } });
  const reports = await eslint.lintFiles([
    matrixPath, "scripts/v100-phase-g-proof-machine.mjs", "scripts/validate-v100-phase-g-manifest.mjs",
    "scripts/v100-phase-g-runtime-evidence.mjs",
    "scripts/browser-qa-build-identity.mjs", "scripts/webkit-host-resource-telemetry.mjs",
    "scripts/run-browser-qa-with-server.mjs", "scripts/v0995-enemy-runtime-shards.mjs",
  ]);
  const failures = reports.flatMap((report) => report.messages.filter((m) => m.severity === 2)
    .map((m) => `${report.filePath}:${m.line} ${m.ruleId}: ${m.message}`));
  assert.deepEqual(failures, []);
});

test("actual capture succeeds only after screenshot, deadline, cleanup, overflow, diagnostics and disk receipt", async (t) => {
  const f = await fixture(t);
  await f.run();
  assert.equal(f.results.length, 1);
  const receipt = await f.receipt();
  assert.equal(receipt.outcome, "success");
  assert.equal(receipt.completedImpactProof.state, "COMPLETE");
  assert.equal(receipt.cleanupOutcome, "success");
  assert.equal(receipt.overflow.length, 4);
  assert.equal(receipt.runtime.screen, "battle");
  assert.equal(f.stopped(), 1);
  const order = ["phase-g/causal-proof", "screenshot", "observer-stop", "phase-g/overflow-audit",
    "phase-g/runtime-readback", "phase-g/final-diagnostics", "transaction-write", "context-close"];
  for (let i = 1; i < order.length; i += 1) assert.ok(f.events.indexOf(order[i - 1]) < f.events.indexOf(order[i]), order[i]);
});

for (const [label, options, error] of [
  ["overflow", { overflow: 2 }, /horizontal overflow/u],
  ["blank body", { blank: true }, /blank body/u],
  ["console fatal", { fatal: "console" }, /console errors/u],
  ["page fatal", { fatal: "page" }, /page errors/u],
  ["HTTP fatal", { fatal: "http" }, /HTTP failures/u],
  ["request fatal", { fatal: "request" }, /request failures/u],
  ["unresolved checkpoint", { unresolved: true }, /checkpoint recorder incomplete/u],
  ["invalid PNG", { invalidPng: true }, /not a valid PNG/u],
  ["late screenshot", { screenshotTime: 13001 }, /production screenshot was not bound/u],
  ["missing observer cleanup", { cleanupMissing: true }, /cleanup read failed/u],
  ["missing required boss", { bossKind: "mugarian-president-mutated" }, /required live boss missing/u],
]) {
  test(`actual capture fails closed and persists ${label}`, async (t) => {
    const f = await fixture(t, options);
    await assert.rejects(f.run(), error);
    assert.equal(f.results.length, 0);
    assert.equal((await f.receipt()).outcome, "failure");
  });
}

test("actual capture cannot publish success when terminal evidence persistence fails", async (t) => {
  const f = await fixture(t, { persistenceFailure: true });
  await assert.rejects(f.run(), (error) => {
    assert.equal(error.phaseGFailure.phaseGCaptureTransactionPersistenceError.code, "PHASE_G_CAPTURE_TRANSACTION_PERSISTENCE_FAILED");
    return /fixture disk write failed/u.test(error.message);
  });
  assert.equal(f.results.length, 0);
});

test("battle captures without focused actor keys still persist their successful transaction", async (t) => {
  const f = await fixture(t, { noRequiredKeys: true });
  await f.run();
  assert.equal(f.results.length, 1);
  assert.equal((await f.receipt()).outcome, "success");
  assert.equal((await f.receipt()).completedImpactProof.state, "COMPLETE");
});

test("all browser capture wrappers return the first failure without a retry", async () => {
  const declaration = parsed.statements.find((entry) => ts.isFunctionDeclaration(entry) && entry.name?.text === "captureState");
  assert.ok(declaration);
  for (const engine of ["chromium", "webkit"]) {
    let calls = 0;
    const failure = new Error("Target page, context or browser has been closed");
    const capture = vm.runInNewContext(`${declaration.getText(parsed)}\ncaptureState`, {
      onlyEngine: "", onlyState: "", onlyVariant: "",
      captureStateImpl: async () => { calls += 1; throw failure; },
    });
    await assert.rejects(capture(engine, { width: 667, height: 375 }, "battle-extra", async () => ({})), (error) => error === failure);
    assert.equal(calls, 1);
  }
});

test("completed-impact boss opening may redeploy a recovered card but never bypass its production eligibility", () => {
  const names = ["deploymentCandidatesFromDiagnostics", "bossOpeningCandidates"];
  const code = names.map((name) => parsed.statements.find((entry) => ts.isFunctionDeclaration(entry) && entry.name?.text === name)?.getText(parsed));
  assert.ok(code.every(Boolean));
  const select = vm.runInNewContext(`${code.join("\n")}\nbossOpeningCandidates`, {});
  const sample = { cards: [
    { kind: "medic", actionability: { eligible: true } },
    { kind: "guardian", actionability: { eligible: false } },
    { kind: "ranger", actionability: { eligible: true } },
  ] };
  const deployed = ["medic", "guardian"];
  assert.deepEqual(Array.from(select(sample, deployed, true), (c) => c.kind), ["medic", "ranger"]);
  assert.deepEqual(Array.from(select(sample, deployed, false), (c) => c.kind), ["ranger"]);
  assert.deepEqual(deployed, ["medic", "guardian"]);
});

test("boss presentation barrier preserves actual entry and the existing per-lane attack requirement", async () => {
  const declaration = parsed.statements.find((entry) => ts.isFunctionDeclaration(entry) && entry.name?.text === "waitForRequiredBossPresentation");
  const boss = { side: "zombie", kind: "mugarian-president-mutated", hp: 100, combatReady: true, gateEntering: false, x: 775 };
  for (const waitForBossAttack of [true, false]) {
    const calls = [];
    const wait = vm.runInNewContext(`${declaration.getText(parsed)}\nwaitForRequiredBossPresentation`, {
      checkpointRecorderFor: () => null, battleTimeout: 45000,
      waitForCombatActivity: async (_page, options) => calls.push(options.bossKind),
    });
    await wait({ waitForFunction: async (callback, expectedKind, options) => {
      assert.equal(options.timeout, 45000);
      for (const [fighters, expected] of [
        [[], false], [[{ ...boss, kind: "red-panther-shield" }], false],
        [[{ ...boss, side: "human" }], false], [[{ ...boss, hp: 0 }], false],
        [[{ ...boss, gateEntering: true }], false], [[{ ...boss, combatReady: false }], false],
        [[{ ...boss, x: 970 }], false], [[boss], true],
      ]) {
        const actual = vm.runInNewContext(`(${callback.toString()})(expectedKind)`, {
          window: { __ASHFALL_BATTLE_QA__: { getPhaseGCombatSnapshot: () => ({ screen: "battle", fighters }) } }, expectedKind,
        });
        assert.equal(actual, expected);
      }
      calls.push("entry-complete");
    } }, { bossKind: boss.kind, waitForBossAttack });
    assert.deepEqual(calls, waitForBossAttack ? ["entry-complete", boss.kind] : ["entry-complete"]);
  }
  const battle = parsed.statements.find((entry) => ts.isFunctionDeclaration(entry) && entry.name?.text === "battlePage").getText(parsed);
  const barrier = battle.indexOf("await waitForRequiredBossPresentation");
  const stop = battle.indexOf("sustainActive = false;", barrier);
  assert.ok(barrier > 0 && stop > barrier);
  assert.ok(battle.indexOf("await sustainDone;", stop) > stop);
});

function bossWaitFixture(samples, { budget = 150000, readStatus = null } = {}) {
  const declaration = parsed.statements.find((entry) => ts.isFunctionDeclaration(entry) && entry.name?.text === "waitForCombatActivity");
  let now = 0, reads = 0;
  const budgets = [];
  const wait = vm.runInNewContext(`${declaration.getText(parsed)}\nwaitForCombatActivity`, {
    checkpointRecorderFor: () => null, battleTimeout: budget,
    invariant: (condition, message) => assert.ok(condition, message),
    V100_REPRESENTATIVE_COMBAT_CONTRACT, validateV100RepresentativeCombatEvidence, deriveV100RuntimeObservation,
    Date: { now: () => now }, setTimeout: (callback, ms) => { now += ms; callback(); },
    readPhaseGSetupRuntime: async () => samples[Math.min(reads++, samples.length - 1)],
    observePromiseWithin: async (promise, remaining) => {
      budgets.push(remaining);
      const value = await promise;
      return readStatus ? { status: readStatus, error: "fixture read failure" } : { status: "fulfilled", value };
    },
  });
  return { run: (kind = "mugarian-president-mutated") => wait({ waitForFunction: async (_callback, arg, options) => {
    assert.equal(arg, null); assert.equal(options.timeout, Math.min(budget, 45000)); assert.equal(options.polling, 100);
  } }, { bossKind: kind }), reads: () => reads, budgets, now: () => now };
}
const bossSample = (kind, values = {}) => ({
  screen: "battle", stageId: "stage", battleGeneration: 2, observedAtPageTime: 1000,
  fighters: [{ id: 25, side: "zombie", kind, hp: 6200, combatReady: true, gateEntering: false,
    x: 758, attackSequence: 0, attack: 0, attackWindup: 0, abilityWindup: 0,
    stationAbility: { phase: "warning", remainingSeconds: .45 }, ...values }],
});
test("boss wait uses the actual canonical validator for legacy and V1 signals, preserving the winning read", async () => {
  for (const kind of ["takuya", "mugarian-president-mutated", "takuya-omega"]) {
    const warning = bossSample(kind);
    const positive = kind === "takuya"
      ? { ...warning, audioCueRequests: [{ cueId: LEGACY_SFX_CUE_MAP["takuya-slam"] }] }
      : bossSample(kind, { attackSequence: 1 });
    const invalid = [
      warning, bossSample(kind, { hp: 0, attackSequence: 1 }), bossSample(kind, { side: "human", attackSequence: 1 }),
      bossSample(kind, { kind: "red-panther-shield", attackSequence: 1 }),
      bossSample(kind, { gateEntering: true, attackSequence: 1 }), bossSample(kind, { combatReady: false, attackSequence: 1 }),
      bossSample(kind, { x: 970, attackSequence: 1 }),
    ];
    const f = bossWaitFixture([...invalid, positive]);
    assert.equal(await f.run(kind), positive);
    assert.equal(f.reads(), invalid.length + 1);
    assert.equal(f.now(), invalid.length * 100);
    assert.equal(f.budgets.at(-1), 150000 - invalid.length * 100);
  }
});
test("boss waiting and final representative projection agree on the actual legacy preparation control", async () => {
  const sample = bossSample("takuya", { attackSequence: 0, abilityWindup: .16666666666666569 });
  const f = bossWaitFixture([sample]);
  assert.equal(await f.run("takuya"), sample);
  assert.equal(f.reads(), 1);
});
test("boss wait rejects battle loss and deadline without restarting the budget or retrying", async () => {
  const warning = bossSample("mugarian-president-mutated");
  const deadline = bossWaitFixture([warning], { budget: 250 });
  await assert.rejects(deadline.run(), (error) => {
    assert.match(error.message, /BOSS_REPRESENTATIVE_DEADLINE_EXCEEDED/u);
    assert.equal(error.phaseGBattleSetup.representativeLastRead, warning); return true;
  });
  assert.deepEqual(deadline.budgets, [250, 150, 50]); assert.equal(deadline.reads(), 3);
  const lost = { screen: "result" };
  const ended = bossWaitFixture([warning, lost]);
  await assert.rejects(ended.run(), (error) => {
    assert.match(error.message, /BATTLE_ENDED_BEFORE_BOSS_REPRESENTATIVE/u);
    assert.equal(error.phaseGBattleSetup.representativeLastRead, lost); return true;
  });
  assert.equal(ended.reads(), 2);
});
test("boss native read rejection or unresolved deadline is terminal and seals only the unresolved RPC", async () => {
  for (const status of ["rejected", "timeout"]) {
    const f = bossWaitFixture([bossSample("mugarian-president-mutated")], { readStatus: status });
    await assert.rejects(f.run(), (error) => {
      assert.match(error.message, new RegExp("BOSS_REPRESENTATIVE_READ_" + status.toUpperCase()));
      assert.equal(error.phaseGCausalNoFurtherPageRpc, status === "timeout"); return true;
    });
    assert.equal(f.reads(), 1);
  }
});

test("capture rejects missing canonical representative rows before success persistence", async (t) => {
  const f = await fixture(t, { variant: "stage25-president", preparedProof: true });
  await assert.rejects(f.run(), /representative evidence failed:.*combat-mutated-president/u);
  assert.equal(f.results.length, 0);
  const persisted = await f.receipt();
  assert.equal(persisted.outcome, "failure");
});

test("final runtime boss assertion rejects the real Stage25 false-green shape", () => {
  const declaration = parsed.statements.find((entry) => ts.isFunctionDeclaration(entry) && entry.name?.text === "assertRequiredBossRuntime");
  const check = vm.runInNewContext(`${declaration.getText(parsed)}\nassertRequiredBossRuntime`, {
    invariant: (condition, message) => assert.ok(condition, message),
  });
  const kind = "mugarian-president-mutated";
  const boss = { side: "zombie", kind, hp: 6200, combatReady: true, gateEntering: false, x: 775 };
  const early = { screen: "battle", fighters: [{ ...boss, kind: "red-panther-shield" }, { ...boss, side: "human", kind: "medic" }] };
  assert.throws(() => check(early, kind, "stage25"), /required live boss missing/u);
  for (const invalid of [{ ...boss, hp: 0 }, { ...boss, combatReady: false }, { ...boss, gateEntering: true }, { ...boss, x: 970 }]) {
    assert.throws(() => check({ screen: "battle", fighters: [invalid] }, kind, "stage25"));
  }
  check({ screen: "battle", fighters: [boss] }, kind, "stage25");
  check(early, null, "non-boss");
});

test("boss opening preserves its light responder then cannot starve the required expensive unit", () => {
  const names = ["deploymentCandidatesFromDiagnostics", "bossOpeningCandidates"];
  const code = names.map((name) => parsed.statements.find((entry) => ts.isFunctionDeclaration(entry) && entry.name?.text === name).getText(parsed));
  const select = vm.runInNewContext(`${code.join("\n")}\nbossOpeningCandidates`, {});
  const cards = [
    { kind: "medic", actionability: { eligible: true } },
    { kind: "brute", actionability: { eligible: false } },
    { kind: "scout", actionability: { eligible: true } },
  ];
  const options = { proofUnitKind: "brute", proofUnitDeployed: false };
  assert.deepEqual(Array.from(select({ cards }, [], false, options), (c) => c.kind), ["medic", "scout"]);
  assert.equal(select({ cards }, ["medic"], false, options).length, 0, "save command without bypassing brute affordability");
  const affordable = cards.map((c) => c.kind === "brute" ? { ...c, actionability: { eligible: true } } : c);
  assert.deepEqual(Array.from(select({ cards: affordable }, ["medic"], false, options), (c) => c.kind), ["brute"]);
  assert.deepEqual(Array.from(select({ cards: affordable }, ["medic", "brute"], false, { ...options, proofUnitDeployed: true }), (c) => c.kind), ["scout"]);
  assert.deepEqual(Array.from(select({ cards }, ["medic"], true, options), (c) => c.kind), ["medic", "scout"]);
});

test("required deployment fallback refuses an ended battle without another pointer or timeout", async () => {
  const declaration = parsed.statements.find((entry) => ts.isFunctionDeclaration(entry) && entry.name?.text === "assertBattleInputStillLive");
  const check = vm.runInNewContext(`${declaration.getText(parsed)}\nassertBattleInputStillLive`, {
    invariant: (condition, message) => assert.ok(condition, message),
  });
  await assert.rejects(check({ locator: () => ({ isVisible: async () => false }) }), /BATTLE_ENDED_BEFORE_REQUIRED_DEPLOYMENT/u);
  await check({ locator: () => ({ isVisible: async () => true }) });
});

test("actual capture preserves already-held setup evidence on configure failure", async (t) => {
  const setupFailure = { stageId: "fixture-stage", proofUnitKind: "brute", proofUnitDeployed: false,
    deploymentTrace: [{ slot: 1, requestedKind: "medic", accepted: true }] };
  const f = await fixture(t, { setupFailure });
  await assert.rejects(f.run(), /fixture setup failure/u);
  assert.deepEqual((await f.receipt()).setupEvidence, setupFailure);
  assert.equal(f.results.length, 0);
});

test("actual capture persists its same-page setup observations on success", async (t) => {
  const setupEvidence = { observations: { vehicle: { screen: "battle", stageId: "fixture-stage", battleGeneration: 2, observedAtPageTime: 800,
    crawlerAbility: { abilityId: "vehicle-barrage", phase: "firing" } } } };
  const f = await fixture(t, { setupEvidence });
  await f.run();
  assert.deepEqual((await f.receipt()).setupEvidence, setupEvidence);
});

test("capture rejects and preserves malformed setup identity instead of reporting success", async (t) => {
  const setupEvidence = { observations: { vehicle: { battleGeneration: 2, observedAtPageTime: 800,
    crawlerAbility: { abilityId: "vehicle-barrage", phase: "firing" } } } };
  const f = await fixture(t, { setupEvidence });
  await assert.rejects(f.run(), /REPRESENTATIVE_SETUP_CAPTURE_MISMATCH/u);
  assert.equal(f.results.length, 0);
  assert.deepEqual((await f.receipt()).setupEvidence, setupEvidence);
});

test("shared setup reader reads actual snapshot and audio once without adding a global", async () => {
  const declaration = parsed.statements.find((entry) => ts.isFunctionDeclaration(entry) && entry.name?.text === "readPhaseGSetupRuntime");
  const read = vm.runInNewContext(`${declaration.getText(parsed)}\nreadPhaseGSetupRuntime`, {});
  let calls = 0;
  const snapshot = { screen: "battle", stageId: "stage3", time: 30, battleGeneration: 2,
    fighters: [{ id: 1, side: "human", kind: "brute", hp: 10, attackSequence: 1 }],
    crawlerAbility: { abilityId: "vehicle-barrage", phase: "firing" } };
  const window = { __ASHFALL_BATTLE_QA__: { getPhaseGCombatSnapshot: () => snapshot },
    __ASHFALL_AUDIO_QA__: { getCueRequests: () => { calls += 1; return [{ cueId: "weapon-barrage" }]; } } };
  const keys = Object.keys(window);
  const value = await read({ evaluate: async (callback) => vm.runInNewContext(`(${callback.toString()})()`, { window, performance: { now: () => 40000 } }) });
  assert.equal(calls, 1);
  assert.equal(value.battleGeneration, 2);
  assert.equal(value.observedAtPageTime, 40000);
  assert.equal(value.fighters[0].id, 1);
  assert.deepEqual(Object.keys(window), keys);
  const battle = parsed.statements.find((entry) => ts.isFunctionDeclaration(entry) && entry.name?.text === "battlePage").getText(parsed);
  assert.equal(battle.includes('phase: "sustain-proof"'), false);
  const vehicleBlock = battle.slice(battle.indexOf("if (requireVehicleAction) {"), battle.indexOf("if (!completedImpactProofEnabled) {", battle.indexOf("if (requireVehicleAction) {")));
  assert.equal(vehicleBlock.includes("page.waitForFunction"), false, "completed action must not be polled again");
  assert.ok(vehicleBlock.includes('setupVehicleActionObserved(setupObservations["vehicle-barrage"])'));
});

function manualMarkerEvidence() {
  const owner = { id: 9, side: "human", kind: "babayaga", hp: 76, cooldown: .833333, attackSequence: 3, manualAbility: { activationId: 0 } };
  const target = { id: 3, side: "zombie", kind: "turned", hp: 95 };
  const beforeInput = { screen: "battle", stageId: "stage21", battleGeneration: 2, time: 34.16, fighters: [owner, target], pendingWeaponHits: [] };
  return { ownerId: "9", beforeInput, afterInput: { ...beforeInput, time: 34.31,
    fighters: [{ ...owner, manualAbility: { activationId: 1, target: { targetId: 3, hp: 95 } } }, target],
    manualAbilityReceipts: [{ ownerId: 9, activationId: 1, kind: "babayaga", eventType: "start", at: 34.3, attackSequence: 3 }],
  } };
}
test("manual marker wait rejects impact-only, unrelated activation and dead marked targets and retains the positive frame", async () => {
  const declaration = parsed.statements.find((entry) => ts.isFunctionDeclaration(entry) && entry.name?.text === "waitForManualMarkerObservation");
  const wait = vm.runInNewContext(`${declaration.getText(parsed)}\nwaitForManualMarkerObservation`, { battleTimeout: 150000, manualMarkerActivation, invariant: (ok, detail) => assert.ok(ok, detail) });
  const target = { id: 3, side: "zombie", kind: "red-panther-smg", hp: 80, marked: 6 };
  const receipt = { ownerId: 9, activationId: 1, kind: "babayaga", eventType: "impact", at: 34.72 };
  const snapshot = { screen: "battle", stageId: "stage21", battleGeneration: 2, fighters: [target], manualAbilityReceipts: [receipt] };
  let disposed = 0;
  const value = await wait({ waitForFunction: async (callback, kind, options) => {
    assert.equal(options.timeout, 10000);
    const check = (sample) => vm.runInNewContext(`(${callback.toString()})(kind)`, {
      window: { __ASHFALL_BATTLE_QA__: { getPhaseGCombatSnapshot: () => sample } }, kind, performance: { now: () => 34000 },
    });
    for (const invalid of [{ ...snapshot, fighters: [] },
      { ...snapshot, fighters: [{ ...target, hp: 0 }] },
      { ...snapshot, fighters: [{ ...target, marked: 0 }] },
      { ...snapshot, manualAbilityReceipts: [] },
      { ...snapshot, manualAbilityReceipts: [{ ...receipt, kind: "brute" }] },
      { ...snapshot, manualAbilityReceipts: [{ ...receipt, ownerId: 8 }] },
      { ...snapshot, manualAbilityReceipts: [{ ...receipt, activationId: 2 }] },
      { ...snapshot, fighters: [{ ...target, id: 4 }] },
      { ...snapshot, battleGeneration: 3 },
      { ...snapshot, stageId: "stage24" }]) assert.equal(Boolean(check(invalid)), false);
    const positive = check(snapshot);
    return { jsonValue: async () => positive, dispose: async () => { disposed += 1; } };
  } }, "babayaga", manualMarkerEvidence());
  assert.equal(value.fighters[0].marked, 6);
  assert.equal(value.observedAtPageTime, 34000);
  assert.equal(disposed, 1);
});

test("manual marker failure preserves one actual diagnostic snapshot and never retries or masks the primary failure", async () => {
  const declaration = parsed.statements.find((entry) => ts.isFunctionDeclaration(entry) && entry.name?.text === "waitForManualMarkerObservation");
  const primary = new Error("marker absent inside unchanged observation deadline");
  for (const readFails of [false, true]) {
    let polls = 0;
    let reads = 0;
    const actual = { battleGeneration: 2, fighters: [], manualAbilityReceipts: [{ kind: "babayaga", eventType: "impact" }] };
    const evidence = manualMarkerEvidence();
    const wait = vm.runInNewContext(`${declaration.getText(parsed)}\nwaitForManualMarkerObservation`, {
      battleTimeout: 150000, manualMarkerActivation, invariant: (ok, detail) => assert.ok(ok, detail), readPhaseGSetupRuntime: async () => {
        reads += 1;
        if (readFails) throw new Error("context closed after primary failure");
        return actual;
      },
    });
    await assert.rejects(wait({ waitForFunction: async () => { polls += 1; throw primary; } }, "babayaga", evidence), (error) => error === primary);
    assert.equal(polls, 1);
    assert.equal(reads, 1);
    assert.equal(evidence.beforeInput.time, 34.16);
    if (readFails) assert.match(evidence.readError, /context closed/u);
    else assert.equal(evidence.afterAction, actual);
  }
});
test("sealed action PNG is not replaced by the later primary scene PNG", async (t) => {
  const f = await fixture(t, { preparedProof: true });
  await f.run();
  const result = f.results[0];
  assert.notEqual(result.evidence.path, result.combatCausalProof.completedImpactProof.screenshot.path);
  assert.match(result.combatCausalProof.completedImpactProof.screenshot.path, /-action\.png$/u);
  assert.equal(f.collectionCalls(), 1);
  assert.equal(f.stopped(), 1);
});

test("a sealed action never passes a missing later boss scene", async (t) => {
  const f = await fixture(t, { preparedProof: true, sceneFailure: true });
  await assert.rejects(f.run(), /later boss never appeared/u);
  assert.equal(f.results.length, 0);
  assert.equal(f.collectionCalls(), 1);
  assert.equal((await f.receipt()).outcome, "failure");
  assert.equal((await f.receipt()).completedImpactProof.state, "COMPLETE");
});

test("waiting for existing input mutex consumes the original screenshot deadline", async (t) => {
  const f = await fixture(t, { lockTime: 13001 });
  await assert.rejects(f.run(), /action screenshot epoch\/generation invalid/u);
  assert.equal(f.events.includes("screenshot"), false);
});

test("snapshot capability check installs no page interval or global cache", async () => {
  const declaration = parsed.statements.find((entry) => ts.isFunctionDeclaration(entry) && entry.name?.text === "startCombatRuntimeObserver");
  const native = { getPhaseGCombatSnapshot: () => ({ schema: "v100-phase-g-combat-snapshot/v1",
    screen: "battle", stageId: "fixture", battleGeneration: 1, fighters: [], completedAttackImpacts: [] }) };
  const window = Object.freeze({ __ASHFALL_BATTLE_QA__: native });
  const check = vm.runInNewContext(declaration.getText(parsed) + "\nstartCombatRuntimeObserver", { checkpointRecorderFor: () => null });
  const profile = await check({ evaluate: async (callback) => vm.runInNewContext("(" + callback.toString() + ")()", { window, TextEncoder }) });
  assert.equal(profile.consumerMode, "awaited-direct-read");
  assert.deepEqual(Object.keys(window), ["__ASHFALL_BATTLE_QA__"]);
});
