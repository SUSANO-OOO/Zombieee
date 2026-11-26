import {MANUAL_ABILITY_REGISTRY, canActivateManualAbility, selectManualAbilityTarget, manualAbilityCheckpointCooldown} from './manualAbilities.js';
import {V100_UNIT_BY_ID} from './v100Registry.js';
import {ENEMY_CONTENT} from './content/enemyCatalog.js';

const enemyNames = new Map(ENEMY_CONTENT.flatMap(enemy => [enemy.id,...enemy.aliases].map(id=>[id,enemy.displayName])));
function nameFor(fighter) {
 const unit = V100_UNIT_BY_ID[MANUAL_ABILITY_REGISTRY[fighter?.kind]?.unitId];
 return unit?.displayName ?? (fighter?.kind === 'infected-base' ? '敵拠点' : enemyNames.get(fighter?.kind)) ?? '敵';
}

// This is a read-only view of the production selector, never a second aim rule.
// The caller supplies the same candidate list used by actual activation.
export function manualAbilityTacticalView({owner, fighters=[], actionSelected=false}={}) {
 const ability=MANUAL_ABILITY_REGISTRY[owner?.kind];
 if(!ability || owner?.side!=='human' || !owner.manualAbility)return null;
 const available=!actionSelected && canActivateManualAbility({fighter:owner,fighters});
 const remaining=Math.ceil(manualAbilityCheckpointCooldown(owner.manualAbility));
 let status='再開後に使える';
 if(Number(owner.hp)<=0)status='戦闘不能';
 else if(owner.contained===true)status='捕らわれている';
 else if(owner.gateEntering===true || owner.combatReady!==true)status='戦場へ移動中';
 else if(Number(owner.stunned)>0)status='ひるみ中';
 else if(owner.manualAbility.phase==='cooldown')status='あと'+remaining+'秒';
 else if(owner.manualAbility.phase!=='ready')status='発動中';
 else if(actionSelected)status='先に支援の狙いを取り消す';
 else if(!available)status=owner.kind==='medic'?'近くに負傷者がいない':'届く相手を待っている';
 const target=available?selectManualAbilityTarget({owner,fighters}):null;
 let targetLabel=null;
 if(target){
  const ids=target.points?target.points.map(p=>p.targetId):target.targetIds??[target.targetId];
  const targets=[...new Set(ids)].map(id=>fighters.find(f=>f.id===id)).filter(Boolean);
  if(owner.kind==='medic')targetLabel='手当て：'+(target.targetId===owner.id?'自分':nameFor(targets[0]));
  else if(owner.kind==='guardian')targetLabel='自分と近くの仲間を守る';
  else if(owner.kind==='kumaverson')targetLabel='近くの敵'+targets.length+'体を引きつける';
  else if(owner.kind==='tky')targetLabel='前方の敵'+targets.length+'体を薙ぎ払う';
  else if(owner.kind==='gunner')targetLabel='前方の敵'+targets.length+'体を掃射';
  else {
   const primary=fighters.find(f=>f.id===(target.targetId??target.points?.[0]?.targetId));
   targetLabel='いまの狙い：'+nameFor(primary);
   if(target.points)targetLabel+='周辺';
  }
 }
 return Object.freeze({ownerId:owner.id,kind:owner.kind,name:nameFor(owner),abilityName:ability.displayName,
  summary:ability.summary,status,available,targetLabel,
  targetId:target?.targetId??target?.points?.[0]?.targetId??null,remaining});
}
