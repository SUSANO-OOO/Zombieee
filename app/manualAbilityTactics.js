import {MANUAL_ABILITY_REGISTRY, canActivateManualAbility, selectManualAbilityTarget, manualAbilityCheckpointCooldown} from './manualAbilities.js';
import {V100_UNIT_BY_ID} from './v100Registry.js';
import {ENEMY_CONTENT} from './content/enemyCatalog.js';

export const MANUAL_ABILITY_TACTICS = Object.freeze({
 brawler:'近くの群れを押し返したいときに。拳波は最初に当たった敵へ大打撃。',
 scout:'後ろへ抜けそうな敵を止めたいときに。足の速い敵を迎え撃とう。',
 ranger:'厄介な射手や手強い敵を早く落としたいときに。射線上の敵も貫く。',
 medic:'傷ついた仲間を倒れる前に手当て。ナオ自身も回復できる。',
 brute:'近くの群れや装甲の厚い敵へ。ひるませて仲間の追撃につなげよう。',
 'crazy-king':'群れに攻め込む直前に。速さと巻き込みを活かして切り崩そう。',
 kumaverson:'強い一撃や包囲をしのぎたいときに。敵を引きつけて粘る。',
 babayaga:'手強い敵へ仲間の攻撃が集まる前に。弱点を付けて追撃を通そう。',
 gunner:'前方に敵が重なったら。動きと攻撃を鈍らせて押し止めよう。',
 guardian:'仲間もまとめて守りたいときに。近くで盾を構えて被害を抑える。',
 engineer:'足の速い敵が抜けそうなときに。進路へ罠を仕掛けて足止め。',
 zakimiya:'敵がかたまったら。炎の中を通る敵も巻き込もう。',
 tky:'前方へ群がる敵をまとめて押し返したいときに。',
 'mrs-chiha':'少し離れた敵の集まりへ。連続する爆発を重ねよう。',
 'miyamoto-musashi':'近接攻撃や予告攻撃が届く直前に。受け流して二刀で反撃。',
 'mayo-chan':'HPに余裕があり、一気に攻めたいときに。発動中はHPを消耗する。',
});
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
  summary:ability.summary,tactic:MANUAL_ABILITY_TACTICS[owner.kind],status,available,targetLabel,
  targetId:target?.targetId??target?.points?.[0]?.targetId??null,remaining});
}
