export const V100_RESEARCH_CORE_STAGE = "stage-segawa-research-core";
export const V100_RESEARCH_CORE_ART = "/art/v100/mission-objects/research-core-targets-v1.webp";
export const V100_RESEARCH_TARGETS = Object.freeze([
  Object.freeze({ id:"overseas-activation-line", label:"国外起動回線", maxHp:500, offsetX:-80, artRow:0 }),
  Object.freeze({ id:"source-stock", label:"感染源原株", maxHp:500, offsetX:0, artRow:1 }),
]);

export function createResearchCoreTargets(definition) {
  return definition.missionConfig?.v100StageNumber === 29
    ? V100_RESEARCH_TARGETS.map(target=>({...target,hp:target.maxHp})) : null;
}

export function researchCoreAttackTarget(game, fallback) {
  const target=game.researchCoreTargets?.find(target=>target.hp>0);
  return target ? {...fallback,x:fallback.x+target.offsetX,researchTargetId:target.id} : fallback;
}

/** The same entry point serves melee, manual impacts and delayed projectiles.
 * A projectile retains the selected object's ID and cannot spill damage into
 * the other objective after its original target has been destroyed. */
export function applyEnemyBaseDamage(game, amount, targetId) {
  if (!game.barricadeVulnerable) return 0;
  const damage=Math.max(0,Number(amount)||0);
  if (!game.researchCoreTargets) {
    const applied=Math.min(game.barricadeHp,damage);
    game.barricadeHp=Math.max(0,game.barricadeHp-applied);
    return applied;
  }
  const target=targetId ? game.researchCoreTargets.find(target=>target.id===targetId) : game.researchCoreTargets.find(target=>target.hp>0);
  if (!target) return 0;
  const applied=Math.min(target.hp,damage);
  target.hp=Math.max(0,target.hp-applied);
  game.barricadeHp=game.researchCoreTargets.reduce((sum,target)=>sum+target.hp,0);
  return applied;
}

export function researchCoreComplete(targets) {
  return Array.isArray(targets) && targets.length===2
    && V100_RESEARCH_TARGETS.every(expected=>targets.some(target=>target.id===expected.id&&target.hp<=0));
}

export function researchCoreObjective(targets) {
  if (!targets) return "国外起動回線と感染源原株を破壊";
  const destroyed=targets.filter(target=>target.hp<=0).length;
  return destroyed===2 ? "二目標破壊完了・残る精鋭部隊を掃討" : `二目標を破壊 ${destroyed}/2：${targets.filter(target=>target.hp>0).map(target=>target.label).join("・")}`;
}

export function researchCoreVisualState(target) {
  const ratio=target.hp/target.maxHp;
  return ratio<=0 ? 3 : ratio<=.3 ? 2 : ratio<=.7 ? 1 : 0;
}

export function drawResearchCoreTargets(context,game,stageObjects,barrier,laneCenters) {
  if (!game.researchCoreTargets) return false;
  const sprite=stageObjects["v100-research-core-targets"];
  if (!sprite?.complete||!sprite.naturalWidth) throw new Error("Research core target art must be decoded before battle starts");
  const cellWidth=sprite.naturalWidth/4,cellHeight=sprite.naturalHeight/2;
  const width=102,height=width*cellHeight/cellWidth,y=laneCenters[2]+18;
  context.save();
  for (const target of game.researchCoreTargets) {
    const x=barrier.attackX+target.offsetX;
    context.drawImage(sprite,researchCoreVisualState(target)*cellWidth,target.artRow*cellHeight,cellWidth,cellHeight,x-18,y-height,width,height);
    context.fillStyle="rgba(0,0,0,.82)";context.fillRect(x-13,y-height-21,100,18);
    context.font="bold 10px sans-serif";context.fillStyle=target.hp<=0?"#b0a58d":"#ead294";
    context.fillText(target.hp<=0?`${target.label} 破壊済`:target.label,x-9,y-height-8);
    context.fillStyle="#302b25";context.fillRect(x-12,y-height,96,4);
    context.fillStyle=target.hp/target.maxHp<=.3?"#dd704d":"#d9bd64";context.fillRect(x-12,y-height,96*Math.max(0,target.hp)/target.maxHp,3);
  }
  context.restore();return true;
}
