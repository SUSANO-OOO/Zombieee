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

// Divide only the work, never the original cases or their acceptance limits.
export function correctionCapturePart(scope,part='all'){
  const plan=correctionCases(scope);
  assert.ok(part==='all'||scope==='desktop'&&['1','2'].includes(part),'Unknown correction partition');
  return part==='all'?plan:plan.filter((_,i)=>i%2===Number(part)-1);
}
export function correctionCaptureFolder(scope,part='all'){
  correctionCapturePart(scope,part);
  return scope+(part==='all'?'':'-'+part);
}
