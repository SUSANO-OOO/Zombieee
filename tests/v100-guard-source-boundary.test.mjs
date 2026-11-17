import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {restorePreGuardSpectacleSource} from './helpers/guard-spectacle-source.mjs';
const file='app/AshfallGame.tsx';
const current=fs.readFileSync(file,'utf8').replaceAll('\r\n','\n');
const before=execFileSync('git',['show','8d056f979d33f5c2111e7bdeffaf8680a446736f:'+file],{maxBuffer:4*1024*1024}).toString('utf8').replaceAll('\r\n','\n');
const assertOnlyDeclaredPaintChanges=source=>assert.equal(restorePreGuardSpectacleSource(file,source)===before,true,'Unlisted source change outside the three declared guard paint edits');
test('guard back-layer integration changes only its import, early paint and later exclusion; every other source byte stays intact',()=>{
 assertOnlyDeclaredPaintChanges(current);
});
test('the full-source boundary still rejects a change to effect timing outside the declared paint edits',()=>{
 const timing='drawAreaEffect(ctx, effect, g.time, stageObjects';
 assert.equal(current.split(timing).length,2);
 assert.throws(()=>assertOnlyDeclaredPaintChanges(current.replace(timing,'drawAreaEffect(ctx, effect, g.time + 0.25, stageObjects')),/Unlisted source change/);
});
test('a second guard paint call is rejected rather than removed as an allowed edit',()=>{
 assert.throws(()=>restorePreGuardSpectacleSource(file,current+'\n'+String.fromCharCode(32,32)+'// Guard preparation paint stays behind actors, hazards and their health readouts.'+'\n'+String.fromCharCode(32,32)+'if (g.definition.missionConfig.v100StageNumber) drawV100GuardActivations(ctx, stageObjects, g);'+'\n'+String.fromCharCode(32,32)+'for (const effect of g.manualAbilityVfx) drawManualAbilityVfx(ctx, effect,Boolean(g.definition.missionConfig.v100StageNumber));'),/guard paint edit must occur exactly once/);
});
