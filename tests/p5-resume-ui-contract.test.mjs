import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { P5_CURRENT_RESUME_BUTTON_TEXT, assertP5ResumeButtonText, p5ResumeButtonTextForSource } from "../scripts/p5-resume-ui-contract.mjs";

test("current and published Stage 3 controls use the label from the selected checkout", async () => {
  const source = await readFile(new URL("../app/AshfallGame.tsx", import.meta.url), "utf8");
  assert.equal(p5ResumeButtonTextForSource(source), P5_CURRENT_RESUME_BUTTON_TEXT);
  const historical = source.replace(">戦闘を再開</button>", ">作戦を再開</button>");
  assert.notEqual(historical, source);
  assert.equal(p5ResumeButtonTextForSource(historical), "作戦を再開");
});

test("an unrelated string, comment or different button handler is not the resume control", () => {
  const source = `const copy = "戦闘を再開";
    // <button onClick={togglePause}>作戦を再開</button>
    const view = <button onClick={launch}>戦闘を再開</button>;`;
  assert.throws(() => p5ResumeButtonTextForSource(source), /found 0/);
});

test("exact-base controls remain unambiguous and supported", () => {
  assert.throws(() => p5ResumeButtonTextForSource(`const view = <>
    <button onClick={togglePause}>作戦を再開</button>
    <button onClick={togglePause}>戦闘を再開</button></>;`), /found 2/);
  assert.throws(() => p5ResumeButtonTextForSource("const view = <button onClick={togglePause}>再開</button>;"), /found 0/);
  assert.throws(() => p5ResumeButtonTextForSource("const view = <button"), /Cannot parse/);
  assert.throws(() => assertP5ResumeButtonText("作戦を再開|戦闘を再開"), /Unsupported/);
});
