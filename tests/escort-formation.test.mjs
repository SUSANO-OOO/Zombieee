import assert from "node:assert/strict";
import test from "node:test";

import { escortFormationDestination, escortMayPursueTarget } from "../app/escortFormation.js";
import { decideAllyIntent } from "../app/allyAi.js";
import { stationSpatialSnapshot } from "../app/stationSpatialMechanics.js";
import { STATION_MISSION_TYPES } from "../app/stationStageMechanics.js";

const human = (id, kind, range) => ({
  id,
  side: "human",
  kind,
  range,
  hp: 100,
  combatReady: true,
  gateEntering: false,
  contained: false,
  stunned: 0,
});

test("escort formation keeps one support in coverage and sends combat roles ahead", () => {
  const units = [
    human(10, "brawler", 42),
    human(11, "gunner", 230),
    human(12, "medic", 210),
    human(13, "scout", 46),
  ];
  const destinations = units.map((unit) => ({
    unit,
    destination: escortFormationDestination({
      unit,
      humans: units,
      cartX: 500,
      cartLane: 1,
    }),
  }));
  const anchor = destinations.find(({ destination }) => destination.duty === "escort-anchor");
  assert.equal(anchor.unit.kind, "medic");
  assert.deepEqual(anchor.destination, { x: 490, lane: 1, duty: "escort-anchor" });
  assert.ok(destinations.filter(({ unit }) => unit.kind !== "medic")
    .every(({ destination }) => destination.x > 500));
  assert.ok(new Set(destinations.map(({ destination }) => destination.lane)).size > 1);
});

test("escort coverage transfers deterministically when the anchor is incapacitated", () => {
  const medic = human(12, "medic", 210);
  const engineer = human(15, "engineer", 210);
  const brawler = human(10, "brawler", 42);
  const humans = [brawler, medic, engineer];
  assert.equal(escortFormationDestination({
    unit: medic,
    humans,
    cartX: 500,
    cartLane: 1,
  }).duty, "escort-anchor");
  medic.stunned = 2;
  assert.equal(escortFormationDestination({
    unit: engineer,
    humans,
    cartX: 500,
    cartLane: 1,
  }).duty, "escort-anchor");
});

test("escort formation accepts legacy runtime units without an explicit stunned counter", () => {
  const medic = human(12, "medic", 210);
  delete medic.stunned;
  assert.equal(escortFormationDestination({
    unit: medic,
    humans: [medic, human(10, "brawler", 42)],
    cartX: 500,
    cartLane: 1,
  }).duty, "escort-anchor");
});

test("a solo melee escort anchors forward while remaining inside cart coverage", () => {
  const brawler = human(11, "brawler", 42);
  assert.deepEqual(escortFormationDestination({
    unit: brawler,
    humans: [brawler],
    cartX: 500,
    cartLane: 1,
  }), {
    x: 586,
    lane: 1,
    duty: "escort-anchor",
  });
});

test("an all-melee formation keeps exactly one forward anchor and screens the rest", () => {
  const units = [
    human(10, "brawler", 42),
    human(13, "scout", 46),
    human(16, "brute", 34),
  ];
  const destinations = units.map((unit) => escortFormationDestination({
    unit,
    humans: units,
    cartX: 500,
    cartLane: 1,
  }));
  assert.equal(destinations.filter(({ duty }) => duty === "escort-anchor").length, 1);
  assert.deepEqual(destinations[0], { x: 586, lane: 1, duty: "escort-anchor" });
  assert.ok(destinations.slice(1).every(({ x, duty }) => x > 500 && duty === "front-screen"));
});

test("the melee-only anchor is counted by the production cart ellipse", () => {
  const unit = human(11, "brawler", 42);
  const destination = escortFormationDestination({
    unit,
    humans: [unit],
    cartX: 500,
    cartLane: 1,
  });
  const snapshot = stationSpatialSnapshot({
    missionType: STATION_MISSION_TYPES.ESCORT,
    missionRuntime: { progress: 0 },
    config: {
      startX: 500,
      endX: 500,
      cartLane: 1,
      escortRadiusX: 110,
      escortRadiusY: 48,
    },
    laneCenters: [100, 180, 260],
    fighters: [{
      ...unit,
      x: destination.x,
      y: 180,
      lane: destination.lane,
    }],
  });
  assert.equal(snapshot.escortCount, 1);
});

test("ranged coverage preserves one deterministic anchor when no support is available", () => {
  const melee = human(10, "brawler", 42);
  const ranged = human(11, "gunner", 230);
  const humans = [melee, ranged];
  assert.deepEqual(escortFormationDestination({
    unit: ranged,
    humans,
    cartX: 500,
    cartLane: 1,
  }), {
    x: 490,
    lane: 1,
    duty: "escort-anchor",
  });
  assert.equal(escortFormationDestination({
    unit: melee,
    humans,
    cartX: 500,
    cartLane: 1,
  }).duty, "front-screen");
});

test('solo melee escort can reach a cart intruder, then returns to cart coverage', () => {
  const unit = { ...human(1, 'scout', 46), x: 586, y: 180, lane: 1 };
  const target = { id: 3, hp: 85, side: 'zombie', x: 470, y: 180, lane: 1, bodyRadius: 16 };
  const duty = escortFormationDestination({unit, humans:[unit], cartX:500}).duty;
  const intent = decideAllyIntent({missionType:'escort', unit, enemies:[target]});
  assert.equal(intent.targetId, target.id);
  assert.ok(intent.destinationX < unit.x, 'must close the gap rather than hold the forward anchor');
  const args = {unit, humans:[unit], target, duty, cartX:500, cartY:180, leash:220};
  assert.equal(escortMayPursueTarget(args), true);
  assert.equal(escortMayPursueTarget({...args,target:{...target,hp:0}}), false);
  const returned = escortFormationDestination({unit,humans:[unit],cartX:500});
  assert.equal(stationSpatialSnapshot({missionType:STATION_MISSION_TYPES.ESCORT,
    missionRuntime:{progress:0},config:{startX:500,endX:500,cartLane:1},laneCenters:[100,180,260],
    fighters:[{...unit,x:returned.x,lane:returned.lane}]}).escortCount,1);
});

test('guard pursuit stays bounded to the cart even when the guard is already far away', () => {
  const unit={...human(1,'scout',46),x:760,y:180,lane:1};
  const args={unit,humans:[unit,human(2,'medic',210)],duty:'front-screen',cartX:500,cartY:180,leash:220};
  assert.equal(escortMayPursueTarget({...args,target:{hp:85,x:700,y:180}}),true);
  assert.equal(escortMayPursueTarget({...args,target:{hp:85,x:740,y:180}}),false);
  assert.equal(escortMayPursueTarget({...args,target:{hp:85,x:270,y:180}}),false);
  for(const target of [null,{hp:0,x:500,y:180},{hp:85,x:500,y:180,contained:true}]) {
    assert.equal(escortMayPursueTarget({...args,target}),false);
  }
});

test('an anchor only leaves its post for threats inside the production cart ellipse', () => {
  const unit=human(1,'medic',210),humans=[unit,human(2,'scout',46)];
  const args={unit,humans,duty:'escort-anchor',cartX:500,cartY:180,leash:220};
  for(const [x,y,expected] of [[470,180,true],[580,220,false],[500,235,true],[500,236,false],[640,180,false]]) {
    const target={id:3,side:'zombie',hp:85,combatReady:true,x,y,lane:1};
    const spatial=stationSpatialSnapshot({missionType:STATION_MISSION_TYPES.ESCORT,
      missionRuntime:{progress:0},config:{startX:500,endX:500,cartLane:1},laneCenters:[100,180,260],fighters:[target]});
    assert.equal(spatial.nearbyThreats>0,expected);
    assert.equal(escortMayPursueTarget({...args,target}),expected);
  }
});

test('the sole available replacement may fight while another escort is incapacitated', () => {
  const unit=human(1,'scout',46),medic=human(2,'medic',210);
  const args={unit,duty:'escort-anchor',cartX:500,cartY:180,leash:220,target:{hp:85,x:650,y:180}};
  for(const state of [{stunned:4},{hp:0},{gateEntering:true},{contained:true}]) {
    const humans=[unit,{...medic,...state}],before=structuredClone(humans);
    assert.equal(escortFormationDestination({unit,humans,cartX:500}).duty,'escort-anchor');
    assert.equal(escortMayPursueTarget({...args,humans}),true);
    assert.deepEqual(humans,before);
  }
  assert.equal(escortFormationDestination({unit:medic,humans:[unit,medic],cartX:500}).duty,'escort-anchor');
  assert.equal(escortMayPursueTarget({...args,unit:{...unit,stunned:1},humans:[unit]}),false);
});
