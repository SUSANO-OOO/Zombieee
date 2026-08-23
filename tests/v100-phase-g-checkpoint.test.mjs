import { strict as assert } from "node:assert";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import test from "node:test";
import path from "node:path";

const repositoryRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));

function runContractProbe(input) {
  const result = spawnSync(process.execPath, ["scripts/v100-phase-g-production-matrix.mjs"], {
    cwd: repositoryRoot,
    env: {
      ...process.env,
      V100_PHASE_G_CONTRACT_PROBE: "1",
      V100_PHASE_G_CONTRACT_PROBE_INPUT: JSON.stringify(input),
    },
    encoding: "utf8",
  });
  const output = `${result.stdout}\n${result.stderr}`;
  assert.equal(result.status, 0, output);
  return JSON.parse(result.stdout.trim());
}

function readyCard(kind, cost) {
  return {
    kind,
    state: "ready",
    ariaDisabled: "false",
    cost,
    rect: { visible: true, width: 80, height: 80 },
  };
}

function liveBattle(overrides = {}) {
  return {
    screen: "battle",
    running: true,
    paused: false,
    over: false,
    won: false,
    energy: 100,
    deployQueue: [],
    deployCooldowns: { ranger: 0, medic: 0 },
    ...overrides,
  };
}

test("Phase G checkpoint recorder negative mode names the unresolved predicate and lifecycle", () => {
  const result = spawnSync(process.execPath, ["scripts/v100-phase-g-production-matrix.mjs"], {
    cwd: repositoryRoot,
    env: { ...process.env, V100_PHASE_G_CHECKPOINT_NEGATIVE: "1" },
    encoding: "utf8",
  });
  const output = `${result.stdout}\n${result.stderr}`;
  assert.notEqual(result.status, 0, output);
  assert.match(output, /unresolvedCheckpoint=deployment-attempts-recorded/u);
  assert.match(output, /lastCompletedCheckpoint=combat-observer-started/u);
  assert.match(output, /lifecycleStatus=attached/u);
});

test("Phase G rejects a stale ready DOM card when runtime affordability is insufficient without a click", () => {
  const result = runContractProbe({
    cards: [readyCard("ranger", 45)],
    battle: liveBattle({ energy: 27.8 }),
  });
  assert.deepEqual(result.candidates, []);
  assert.match(JSON.stringify(result.sample), /insufficient-energy/u);
});

test("Phase G selects an affordable cooldown-zero candidate from the coherent sample", () => {
  const result = runContractProbe({
    cards: [readyCard("ranger", 45), readyCard("medic", 30)],
    battle: liveBattle({ energy: 45, deployCooldowns: { ranger: 0, medic: 1.2 } }),
  });
  assert.deepEqual(result.candidates, ["ranger"]);
});

test("Phase G records pre-click invalidation and reselects instead of clicking a stale candidate", () => {
  const result = runContractProbe({
    requestedKind: "ranger",
    cards: [readyCard("ranger", 45)],
    battle: liveBattle({ energy: 45 }),
    error: "TimeoutError: locator.click: element is not actionable",
    after: {
      cards: [readyCard("ranger", 45)],
      battle: liveBattle({ energy: 20 }),
    },
  });
  assert.deepEqual(result.candidates, ["ranger"]);
  assert.equal(result.outcome, "candidate-invalidated");
});

test("Phase G fails closed on persistent actionability divergence and lifecycle loss", () => {
  const divergence = runContractProbe({
    requestedKind: "ranger",
    cards: [readyCard("ranger", 45)],
    battle: liveBattle({ energy: 45 }),
    error: "TimeoutError: locator.click: element is not actionable",
    after: {
      cards: [readyCard("ranger", 45)],
      battle: liveBattle({ energy: 45 }),
    },
  });
  assert.equal(divergence.outcome, "QA_HARNESS_ACTIONABILITY_DIVERGENCE");
  const lifecycle = runContractProbe({
    requestedKind: "ranger",
    cards: [readyCard("ranger", 45)],
    battle: liveBattle({ energy: 45 }),
    error: "locator.click: Target page, context or browser has been closed",
    after: { pageClosed: true },
  });
  assert.equal(lifecycle.outcome, "lifecycle-loss");
});

test("Phase G keeps the named deployment deadline, normal click, acceptance, and fourteen checkpoints", async () => {
  const source = await readFile(path.join(repositoryRoot, "scripts/v100-phase-g-production-matrix.mjs"), "utf8");
  assert.match(source, /const DEPLOYMENT_ACTIONABILITY_DEADLINE_MS = 2_000/u);
  assert.match(source, /clickDeploymentCard/u);
  assert.match(source, /locator\.click\(\{ timeout: DEPLOYMENT_ACTIONABILITY_DEADLINE_MS \}\)/u);
  assert.match(source, /deploymentWasAccepted/u);
  assert.match(source, /candidate-invalidated-before-click/u);
  assert.match(source, /QA_HARNESS_ACTIONABILITY_DIVERGENCE/u);
  assert.doesNotMatch(source, /force\s*:\s*true/u);
  const checkpointBlock = source.match(/const BATTLE_EXTRA_CHECKPOINTS = Object\.freeze\(\[([\s\S]*?)\]\);/u)?.[1] ?? "";
  assert.equal((checkpointBlock.match(/"[^"]+"/gu) ?? []).length, 14);
});
