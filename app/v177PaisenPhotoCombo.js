import { v100BrawlerCanAct } from './v100BrawlerCombo.js';
import { V177_JOINT_ATLASES, v177JointPose } from './v177JointPresentation.js';
import { V177_PAISEN_PHOTO_JOINT_ATLASES } from './v177PaisenPhotoJointData.js';

const PHOTO_RIG = V177_PAISEN_PHOTO_JOINT_ATLASES.brawler;
const RELEASE_SECONDS = .065;
const clamp = value => Math.max(0, Math.min(1, value));
const partMeaning=part=>JSON.stringify(Object.fromEntries(Object.entries(part)
 .filter(([key])=>key!=='source'&&!(key==='destination'&&part.bone==='head'))
 .sort(([a],[b])=>a.localeCompare(b))));
const photoMeanings=new Map(PHOTO_RIG.parts.map(part=>[part.name,partMeaning(part)]));

// A material repack changes UVs and adds the source collar. It must not
// substitute a different action rig or discard per-part pose ownership.
export function v177PaisenPhotoPoseOwner(atlas){
 if(atlas?.poses!==PHOTO_RIG.poses||!Array.isArray(atlas.parts))return false;
 if(atlas.key!==PHOTO_RIG.key||atlas.armConstraints!==PHOTO_RIG.armConstraints||atlas.legConstraints!==PHOTO_RIG.legConstraints)return false;
 if(atlas.parts===PHOTO_RIG.parts)return true;
 const names=new Set();let originals=0;
 for(const part of atlas.parts){
  if(names.has(part.name))return false;names.add(part.name);
  const expected=photoMeanings.get(part.name);
  if(expected!==undefined){if(partMeaning(part)!==expected)return false;originals++;}
  else if(part.name==='source-neck-garment'){
   const head=PHOTO_RIG.parts.find(p=>p.bone==='head');
   if(partMeaning(part)!==partMeaning({...head,name:'source-neck-garment',bone:'spine',upper:true}))return false;
  }else return false;
 }
 return originals===PHOTO_RIG.parts.length;
}

// Keep the approved photo identity on its current rig for the complete
// fist-wave stance, two-hand release and return. No timed damage is applied.
export function v177PaisenPhotoComboSample(runtime, definition) {
  if (!runtime || !['windup', 'recovery'].includes(runtime.phase)
    || !Number.isFinite(runtime.abilityElapsed) || runtime.abilityElapsed < 0
    || !(definition?.windupSeconds > 0) || !(definition.recoverySeconds > RELEASE_SECONDS)
    || runtime.phase==='windup'&&!Number.isFinite(runtime.windupRemaining)
    || runtime.abilityElapsed>=definition.windupSeconds+definition.recoverySeconds) return null;
  const time = runtime.abilityElapsed;
  let sample;
  if (runtime.phase === 'windup') sample = { requestedState: 'wind-up',
    clipProgress: clamp((definition.windupSeconds - runtime.windupRemaining) / definition.windupSeconds) };
  else if (time < definition.windupSeconds + RELEASE_SECONDS) sample = { requestedState: 'active',
    clipProgress: clamp((time - definition.windupSeconds) / RELEASE_SECONDS) };
  else sample = { requestedState: 'recovery',
    clipProgress: clamp((time - definition.windupSeconds - RELEASE_SECONDS) / (definition.recoverySeconds - RELEASE_SECONDS)) };
  return { ...sample, abilityPresentation: 'fist-wave' };
}

export function v177PaisenPhotoComboJointPose(owner, definition, { world } = {}) {
  const atlas=V177_JOINT_ATLASES.brawler;
  if (owner?.kind !== 'brawler' || !v100BrawlerCanAct(owner)
    // Identity repainting may change the texture URL. The authored body and
    // pose data own the fist-wave timing, rather than that historical URL.
    || !v177PaisenPhotoPoseOwner(atlas)) return null;
  const sample = v177PaisenPhotoComboSample(owner.manualAbility, definition);
  return sample ? v177JointPose('brawler', sample, owner.animationPresentation,
    { grounded:true, actor:owner, world, stunRemaining:owner.stunned }) : null;
}
