import test from "node:test";
import assert from "node:assert/strict";
import {
  GRAPHICS_QUALITY_MODES,
  RUNTIME_MAX_CATCH_UP_STEPS,
  RUNTIME_SIMULATION_HZ,
  advanceRuntimeFrameSchedule,
  createRuntimeFrameSchedule,
  resolveGraphicsProfile,
  resetRuntimeFrameSchedule,
} from "../app/renderPerformance.js";

test("graphics profiles bound mobile DPR, render cadence, and visual-only density", () => {
  const mobile = { width: 844, height: 390, deviceMemory: 8, hardwareConcurrency: 8 };
  const automatic = resolveGraphicsProfile(GRAPHICS_QUALITY_MODES.AUTO, mobile);
  const high = resolveGraphicsProfile(GRAPHICS_QUALITY_MODES.HIGH, mobile);
  const powerSave = resolveGraphicsProfile(GRAPHICS_QUALITY_MODES.POWER_SAVE, mobile);

  assert.deepEqual(
    [automatic.resolvedMode, automatic.dprCap, automatic.renderHz, automatic.simulationHz],
    ["balanced", 1.5, 45, RUNTIME_SIMULATION_HZ],
  );
  assert.deepEqual(
    [high.resolvedMode, high.dprCap, high.renderHz, high.simulationHz],
    ["high", 2, 60, RUNTIME_SIMULATION_HZ],
  );
  assert.deepEqual(
    [powerSave.resolvedMode, powerSave.dprCap, powerSave.renderHz, powerSave.simulationHz],
    ["power-save", 1, 30, RUNTIME_SIMULATION_HZ],
  );
  assert.ok(high.effectDensity > automatic.effectDensity);
  assert.ok(automatic.effectDensity > powerSave.effectDensity);
});

test("desktop Auto retains the high profile while constrained devices use balanced", () => {
  assert.equal(resolveGraphicsProfile("auto", {
    width: 1280,
    height: 720,
    deviceMemory: 8,
    hardwareConcurrency: 8,
  }).resolvedMode, "high");
  assert.equal(resolveGraphicsProfile("auto", {
    width: 1280,
    height: 720,
    deviceMemory: 4,
    hardwareConcurrency: 4,
  }).resolvedMode, "balanced");
  assert.equal(resolveGraphicsProfile("invalid", {
    width: 844,
    height: 390,
  }).requestedMode, "auto");
});

test("fixed simulation cadence stays at 60Hz while render cadence is independently bounded", () => {
  const profile = resolveGraphicsProfile("power-save", { width: 844, height: 390 });
  const schedule = createRuntimeFrameSchedule(0);
  let simulationSteps = 0;
  let renderFrames = 0;
  for (let frame = 1; frame <= 120; frame += 1) {
    const result = advanceRuntimeFrameSchedule(schedule, frame * (1000 / 60), profile);
    simulationSteps += result.simulationStepCount;
    if (result.shouldRender) renderFrames += 1;
  }
  assert.ok(simulationSteps >= 119 && simulationSteps <= 120, `unexpected steps ${simulationSteps}`);
  assert.ok(renderFrames >= 55 && renderFrames <= 61, `unexpected renders ${renderFrames}`);
  assert.equal(profile.simulationHz, 60);
  assert.equal(profile.renderHz, 30);

  const automatic = resolveGraphicsProfile("auto", { width: 844, height: 390 });
  const automaticSchedule = createRuntimeFrameSchedule(0);
  let automaticRenders = 0;
  for (let frame = 1; frame <= 120; frame += 1) {
    if (advanceRuntimeFrameSchedule(
      automaticSchedule,
      frame * (1000 / 60),
      automatic,
    ).shouldRender) automaticRenders += 1;
  }
  assert.ok(automaticRenders >= 88 && automaticRenders <= 91,
    `unexpected Auto renders ${automaticRenders}`);
});

test("long background gaps are capped and an explicit reset discards hidden time", () => {
  const profile = resolveGraphicsProfile("high");
  const schedule = createRuntimeFrameSchedule(0);
  const capped = advanceRuntimeFrameSchedule(schedule, 5_000, profile);
  assert.equal(capped.simulationStepCount, RUNTIME_MAX_CATCH_UP_STEPS);
  assert.ok(capped.droppedSimulationSeconds > 4.8);

  resetRuntimeFrameSchedule(schedule, 9_000);
  const resumed = advanceRuntimeFrameSchedule(schedule, 9_000 + 1000 / 60, profile);
  assert.equal(resumed.simulationStepCount, 1);
  assert.ok(resumed.droppedSimulationSeconds < 1e-9);
});
