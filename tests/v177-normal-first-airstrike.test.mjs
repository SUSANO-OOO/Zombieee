import test from 'node:test';
import assert from 'node:assert/strict';
import {normalCampaignCanSpendVehicleGauge} from '../scripts/v100-normal-play-contract.mjs';
import {createCrawlerAbilityRuntime,requestCrawlerBarrage,createEmergencySupportRuntime,requestAirstrike} from '../app/gameRules.js';

test('the real 70-support vehicle action would starve the first 85-support aircraft',()=>{
 const vehicle=requestCrawlerBarrage({running:true,paused:false,over:false,runtime:createCrawlerAbilityRuntime(1,true),supportGauge:100});assert.equal(vehicle.ok,true);assert.equal(vehicle.supportGauge,30);
 const blocked=requestAirstrike({running:true,paused:false,over:false,runtime:createEmergencySupportRuntime(true),supportGauge:vehicle.supportGauge,x:500,lane:1});assert.equal(blocked.ok,false);assert.equal(blocked.reason,'支援ゲージが不足しています');
 const first=requestAirstrike({running:true,paused:false,over:false,runtime:createEmergencySupportRuntime(true),supportGauge:100,x:500,lane:1});assert.equal(first.ok,true);assert.equal(first.supportGauge,15);
});
test('an aimed click or unrelated disabled control does not release the reserved gauge',()=>{
 for(const inputs of [undefined,[],[{action:'airstrike'}],[{action:'airstrike',acknowledgment:{disabled:'false'}}],[{action:'barrage',acknowledgment:{disabled:'true'}}]])assert.equal(normalCampaignCanSpendVehicleGauge(inputs),false);
 assert.equal(normalCampaignCanSpendVehicleGauge([{action:'airstrike',acknowledgment:{state:'active',disabled:'true'}}]),true);
 assert.equal(normalCampaignCanSpendVehicleGauge([{action:'airstrike',acknowledgment:{state:'cooldown',disabled:'true'}}]),true);
});
