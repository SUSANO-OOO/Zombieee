import test from "node:test";
import assert from "node:assert/strict";

import {
  PRESSURE_LATCH_SECONDS,
  advancePressureLatch,
  createPressureLatchRuntime,
  pressureLatchSnapshot,
  resetPressureLatchRuntime,
} from "../app/battleMusicRuntime.js";

test("pressure remains latched for 750ms after raw pressure falls", () => {
  const runtime = createPressureLatchRuntime();
  advancePressureLatch(runtime, { rawPressure: true, simulationTime: 10 });
  advancePressureLatch(runtime, { rawPressure: false, simulationTime: 10.1 });
  assert.equal(runtime.latched, true);
  assert.equal(runtime.deadline, 10.1 + PRESSURE_LATCH_SECONDS);
  advancePressureLatch(runtime, { rawPressure: false, simulationTime: 10.84 });
  assert.equal(runtime.latched, true);
  advancePressureLatch(runtime, { rawPressure: false, simulationTime: 10.85 });
  assert.equal(runtime.latched, false);
});

test("raw pressure returning before deadline cancels the release", () => {
  const runtime = createPressureLatchRuntime();
  advancePressureLatch(runtime, { rawPressure: true, simulationTime: 1 });
  advancePressureLatch(runtime, { rawPressure: false, simulationTime: 2 });
  advancePressureLatch(runtime, { rawPressure: true, simulationTime: 2.2 });
  assert.deepEqual(pressureLatchSnapshot(runtime), { latched: true, deadline: null, battleGeneration: 0 });
});

test("reset clears latch and increments battle generation", () => {
  const runtime = createPressureLatchRuntime();
  advancePressureLatch(runtime, { rawPressure: true, simulationTime: 1 });
  resetPressureLatchRuntime(runtime, "retry");
  assert.deepEqual(pressureLatchSnapshot(runtime), { latched: false, deadline: null, battleGeneration: 1 });
});
