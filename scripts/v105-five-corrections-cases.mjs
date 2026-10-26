import assert from 'node:assert/strict';
import {MANUAL_ABILITY_REGISTRY as manual} from '../app/manualAbilities.js';
export function correctionCases(scope){
  assert.ok(['desktop','mobile390','mobile340'].includes(scope));
  if(scope!=='desktop')return [...['brawler','crazy-king','guardian','gunner','zakimiya','mrs-chiha'].map(kind=>({kind,mode:'manual'})),{kind:'brawler',mode:'duet'}];
  return [...Object.keys(manual).map(kind=>({kind,mode:'manual'})),
    ...['grappler','ooze','sprinter','gate-eater','spindle','resonator','cagewalker','choir-knot','pall-manta','anchor-bloom',
      'kurome','mother','ooguchi','gairen','mugarian-president-mutated','takuya-omega','takuya'].map(kind=>({kind,mode:'enemy'})),
    ...['brute','guardian','tky','takuya','takuya-omega','crazy-king','kumaverson','babayaga','brawler'].map(kind=>({kind,mode:'engage'}))];
}
