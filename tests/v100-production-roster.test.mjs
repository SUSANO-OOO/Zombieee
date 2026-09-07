import assert from "node:assert/strict";
import test from "node:test";
import { createBattleDefinition } from "../app/battleDefinitions.js";
import { V100_STAGES } from "../app/v100Registry.js";

// Independent transcription of the fixed content contract, Design Lock 17.5.
// Exercise the actual definition injected into Ashfall, not the shadow battle.
const A = ["walker", "runner", "spitter", "crusher"];
const B = [...A, "grappler", "ooze", "sprinter"];
const C = [...B, "shade", "abomination"];
const D = ["resonator", "cagewalker", "spindle", "choir-knot", "pall-manta", "anchor-bloom"];
const P = ["red-panther-knife", "red-panther-shield", "red-panther-smg", "red-panther-commander"];
const rows = [A, [...A,"abomination"], [...A,"shade","abomination"], [...A,"grappler"], [...A,"ooze","sprinter"],
  B,B,B,B,C,C,[...B,"shade"],C,C,C,C,D,D,D,D,[...D,P[0],P[2]],[...D,P[1],P[2]],P,[P[1],P[3]],P,
  [...D,P[2],P[3]],P,[...D,P[1],P[2],P[3]],P,A];
const definitionFor = number => createBattleDefinition(V100_STAGES[number-1].id, {v100:true});

test("all thirty production timelines use the frozen operation's enemies and boss", () => {
  for (const stage of V100_STAGES) {
    const definition = definitionFor(stage.number);
    const allowed = [...rows[stage.number-1], definition.bossEnemyKind].filter(Boolean);
    for (const event of definition.timeline) for (const kind of event.units) assert.ok(allowed.includes(kind), `Stage ${stage.number} wave ${event.wave}: unauthorized ${kind}`);
    assert.ok(definition.timeline.every((event,index) => index===0 || event.at > definition.timeline[index-1].at));
    if (definition.bossEnemyKind) assert.equal(definition.timeline.flatMap(event=>event.units).filter(kind=>kind===definition.bossEnemyKind).length,1);
  }
});

test("Panther operations introduce the knife role and Stage 27 actually fields all four roles", () => {
  assert.deepEqual(definitionFor(23).timeline[0].units,[P[0],P[1]]);
  assert.deepEqual([...new Set(definitionFor(27).timeline.flatMap(event=>event.units))].sort(),[...P].sort());
  assert.deepEqual([...new Set(definitionFor(24).timeline.flatMap(event=>event.units))].sort(),[P[1],P[3],"futago"].sort());
});

test("Stage 29 owns six elite waves and Stage 30 only two A add waves after Omega", () => {
  const core=definitionFor(29), finale=definitionFor(30);
  assert.equal(core.timeline.length,6);
  assert.ok(core.timeline.flatMap(event=>event.units).every(kind=>P.includes(kind)));
  assert.equal(core.bossEnemyKind,null);
  assert.equal(finale.timeline.length,3);
  assert.deepEqual(finale.timeline[0].units,["takuya-omega"]);
  const adds=finale.timeline.filter(event=>event.addWave);
  assert.equal(adds.length,2);
  assert.deepEqual(adds.flatMap(event=>event.units),A);
  assert.ok(adds.every(event=>event.at>finale.timeline[0].at));
});

test("all timed operations use their fixed 85/90/95/100 second perimeter", () => {
  for (const [number,seconds] of [[2,90],[7,85],[18,95],[22,100]]) {
    const definition=definitionFor(number);
    assert.equal(definition.defenseEndAt-definition.prepSeconds,seconds);
  }
});
