import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import { readFile } from "node:fs/promises";
import ts from "typescript";
import { canDeploy } from "../app/gameRules.js";
import { humanDeploymentCapacity } from "../app/deploymentCapacity.js";
import { V100_FORMATION_MAX_SLOTS } from "../app/v100Registry.js";

const source = await readFile("app/AshfallGame.tsx", "utf8");
const ast = ts.createSourceFile("AshfallGame.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const functions = ["humanDeploymentCapacityForGame", "spawnHuman"].map(name => {
  const found = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === name);
  assert.ok(found, `actual runtime function ${name}`); return found.getText(ast);
});
let deployDeclaration;
const visit = node => {
  if (ts.isVariableDeclaration(node) && node.name.getText(ast) === "deployHuman") deployDeclaration = node.getText(ast);
  ts.forEachChild(node, visit);
};
visit(ast); assert.ok(deployDeclaration);
const code = ts.transpileModule(functions.join("\n") + `\nconst ${deployDeclaration};\n({deployHuman,spawnHuman});`, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
}).outputText;
const human = id => ({ id, kind:"scout", side:"human", hp:100, anchorLane:0 });
function fixture(active = 6, queued = [], v100 = true) {
  const game = { definition:{missionConfig:v100?{v100StageNumber:6}:{}},fighters:Array.from({length:active},(_,id)=>human(id)),
    nextId:50,deployQueue:[...queued],formationKinds:["scout"],energy:150,deployCooldowns:{scout:0},running:true,paused:false,over:false };
  const cues=[];
  const runtime = vm.runInNewContext(code, {
    humanDeploymentCapacity,V100_FORMATION_MAX_SLOTS,canDeploy,gameRef:{current:game},useCallback:fn=>fn,
    equippedCardForGame:()=>({kind:"scout",name:"ハチ",cost:25,deployCooldown:5,hp:100}),
    playUiOperationCue:(...args)=>cues.push(args),rejectBattleSaveBoundary:()=>false,
    survivalUpgradeEffects:()=>({redeployMultiplier:1}),
    MUSTER_X:10,MUSTER_LANE:0,activeMusterY:()=>10,createManualAbilityRuntime:()=>({}),bodyRadiusFor:()=>4,
    createCombatAnimationRuntime:()=>({}),createNavigationRecoveryState:()=>({}),createStationAbilityRuntime:()=>({}),
    createUnitRoleRuntime:()=>({}),addParticles:()=>{},chooseHumanDeploymentLane:()=>0,
  });
  return {game,cues,...runtime};
}

test("the actual deployment callback reserves the seventh slot once and rejects the eighth without spending", () => {
  const f=fixture();
  assert.equal(f.deployHuman("scout"),true);
  f.game.deployCooldowns.scout=0;
  const before=JSON.stringify(f.game.deployQueue),energy=f.game.energy;
  assert.equal(f.deployHuman("scout"),false);
  assert.equal(f.game.energy,energy);assert.equal(f.game.deployCooldowns.scout,0);
  assert.equal(JSON.stringify(f.game.deployQueue),before);
  assert.equal(f.cues.at(-1)[1],"deploy:scout:formation-full");
});

test("actual spawn refuses an eighth live instance and permits replacement after a death", () => {
  const f=fixture(7);
  assert.equal(f.spawnHuman(f.game,"scout"),null);assert.equal(f.game.nextId,50);assert.equal(f.game.fighters.length,7);
  f.game.fighters[0].hp=0;
  assert.ok(f.spawnHuman(f.game,"scout"));
  assert.equal(humanDeploymentCapacity({fighters:f.game.fighters,limit:7}).active,7);
  assert.equal(f.spawnHuman(f.game,"scout"),null);
});

test("queue reservations include door entrants and duplicate characters but exclude enemies and dead units", () => {
  const f=fixture(5,["scout","scout"]);
  f.game.fighters[0].gateEntering=true;
  f.game.fighters.push({...human(20),side:"zombie"},{...human(21),hp:0});
  assert.equal(f.deployHuman("scout"),false);
  f.game.fighters[1].hp=0;
  assert.equal(f.deployHuman("scout"),true);
  assert.equal(f.game.deployQueue.length,3);
});

test("seven separate copies of one character are allowed and legacy admission is preserved", () => {
  const f=fixture(0);
  for(let n=0;n<7;n++)assert.ok(f.spawnHuman(f.game,"scout"));
  assert.equal(f.spawnHuman(f.game,"scout"),null);
  const legacy=fixture(7,[],false);
  assert.equal(legacy.deployHuman("scout"),true);
});
