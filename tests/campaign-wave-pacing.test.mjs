import test from 'node:test';
import assert from 'node:assert/strict';
import { campaignWaveReady, campaignWavePrompt, requestCampaignWave, withClearDrivenAssaultWaves } from '../app/wavePacing.js';

const mission = { at: 25, clearDelaySeconds: 2.5 };
const readyTeam = () => Array.from({length:3},()=>({side:'human',hp:100,combatReady:true}));
const fresh = () => ({ definition: {timeline:[{},mission]}, eventIndex: 1, time: 10, bannerTime: 0,
  fighters: readyTeam(), enemySpawn: { pending: [] } });

test('empty-field recovery uses real elapsed battle time, not a scheduled timestamp', () => {
  const game = fresh();
  assert.equal(campaignWaveReady(game, mission), false);
  game.time = 12.49; assert.equal(campaignWaveReady(game, mission), false);
  game.time = 12.5; assert.equal(campaignWaveReady(game, mission), true);
  assert.equal(game.time, 12.5);
});

test('living enemies, queued spawns and active presentations reset the clear window even after the scheduled time', () => {
  for (const occupy of [g => g.fighters.push({ side: 'zombie', hp: 1 }),
    g => g.enemySpawn.pending.push({ kind: 'walker' }), g => { g.bannerTime = 1; },
    g => { g.bossDefeatPending = true; }]) {
    const game = fresh();
    campaignWaveReady(game, mission);
    game.time = 30; occupy(game);
    assert.equal(campaignWaveReady(game, mission), false);
    game.fighters = []; game.enemySpawn.pending = []; game.bannerTime = 0; game.bossDefeatPending = false;
    assert.equal(campaignWaveReady(game, mission), false);
    game.time = 32.5; assert.equal(campaignWaveReady(game, mission), true);
  }
});

test('a corpse does not block progress; a summoned living enemy does', () => {
  const game = fresh(); game.fighters.push({ side: 'zombie', hp: 0 });
  campaignWaveReady(game, mission); game.time = 12.5;
  assert.equal(campaignWaveReady(game, mission), true);
  game.fighters.push({ side: 'zombie', hp: 10, summoned: true });
  assert.equal(campaignWaveReady(game, mission), false);
});

test('an airstrike-only clearance preserves deployment time; prepared teams and deliberate calls can advance',()=>{
  for(const mode of ['scheduled','three-ready','deploying','call']){
    const game=fresh();game.fighters=readyTeam().slice(0,2);
    campaignWaveReady(game,mission);game.time=12.5;
    assert.equal(campaignWaveReady(game,mission),false);
    assert.equal(campaignWavePrompt(game).canAdvance,true);
    if(mode==='scheduled')game.time=25;
    if(mode==='three-ready'||mode==='deploying')game.fighters.push(readyTeam()[0]);
    if(mode==='deploying')game.deployQueue=[{kind:'brawler'}];
    if(mode==='call')assert.equal(requestCampaignWave(game),true);
    assert.equal(campaignWaveReady(game,mission),mode!=='deploying');
  }
});

test('future infected corpses block both automatic and requested waves, while burnt remains do not',()=>{
  for(const state of ['dying','ally-corpse','infection-warning','generic-zombie']){
    const game=fresh();campaignWaveReady(game,mission);game.time=30;
    game.corpses=[{side:'human',state,prevented:false}];
    assert.equal(campaignWaveReady(game,mission),false);
    assert.equal(requestCampaignWave(game),false);
    assert.equal(campaignWavePrompt(game).label,'感染源を処理');
    game.corpses[0]={side:'human',state:'burning',prevented:true};
    assert.equal(campaignWaveReady(game,mission),false);
    game.time=32.5;assert.equal(campaignWaveReady(game,mission),true);
  }
});

test('a call cannot skip the breath, survive a new threat, or leak into another wave',()=>{
  const game=fresh();game.fighters=readyTeam().slice(0,1);
  campaignWaveReady(game,mission);assert.equal(requestCampaignWave(game),false);
  game.time=12.5;assert.equal(requestCampaignWave(game),true);
  game.fighters.push({side:'zombie',hp:1});assert.equal(campaignWaveReady(game,mission),false);
  game.fighters.pop();game.time=13;assert.equal(campaignWaveReady(game,mission),false);
  game.time=15.5;assert.equal(campaignWaveReady(game,mission),false,'new threat cancels call');
  requestCampaignWave(game);game.eventIndex=2;assert.equal(campaignWaveReady(game,mission),false);
});

test('next event, restarted battle and another battle cannot inherit an elapsed clear window', () => {
  for (const reset of [g => { g.eventIndex++; }, g => { g.definition = {}; }, g => { g.time = 0; }]) {
    const game = fresh(); campaignWaveReady(game, mission); game.time = 15;
    assert.equal(campaignWaveReady(game, mission), true);
    reset(game); assert.equal(campaignWaveReady(game, mission), false);
  }
  assert.equal(campaignWaveReady(fresh(), mission), false);
});

test('the first contact, escort, defense, devices and boss schedules retain their authored gates', () => {
  const timeline = Object.freeze([{ at: 5, units: ['walker'] }, { at: 25, units: ['runner'] }]);
  for (const type of ['escort', 'timed-defense', 'sequential-seal', 'boss-assault']) {
    assert.equal(withClearDrivenAssaultWaves(timeline, type), timeline);
    assert.equal(campaignWaveReady(fresh(), timeline[1]), true);
  }
  const changed = withClearDrivenAssaultWaves(timeline, 'assault');
  assert.equal(changed[0], timeline[0]);
  assert.equal(changed[1].at, 25);
  assert.equal(changed[1].units, timeline[1].units);
  assert.equal(changed[1].clearDelaySeconds, 2.5);
});
