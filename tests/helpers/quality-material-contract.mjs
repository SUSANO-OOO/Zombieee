import assert from 'node:assert/strict';

// UV coordinates, head placement and one recovered collar are intentional
// material changes. Every other property remains an exact source contract.
export function assertMaterialRigGeometry(current,source){
 const a=current.parts??current.upperRig.parts,b=source.parts??source.upperRig.parts;
 for(const original of b){
  const actual=a.find(p=>p.name===original.name);assert.ok(actual,original.name);
  assert.deepEqual({...actual,source:original.source,...(original.bone==='head'?{destination:original.destination}:{})},original,original.name+' semantic/geometry contract');
 }
 for(const extra of a.filter(p=>!b.some(o=>o.name===p.name))){assert.equal(extra.name,'source-neck-garment');assert.equal(extra.bone,'spine');assert.equal(extra.upper,true);}
 const comparable={...current};
 for(const key of ['path','decodedWidth','decodedHeight','decodedBytes']){
  if(Object.hasOwn(source,key))comparable[key]=source[key];else delete comparable[key];
 }
 if(source.parts)comparable.parts=source.parts;else comparable.upperRig={...current.upperRig,parts:source.upperRig.parts};
 assert.deepEqual(comparable,source,'All non-material rig contracts remain exact');
}

// Mizuchi's full-body repaint replaces all texture crops AND fallback cells.
// Its actual movement, hand constraints, manual aiming and cloth mesh stay exact.
export function assertRangerRepaintGeometry(current,source){
 assert.equal(current.path,'/art/v100/joints/ranger-combat-r1.webp');
 const {parts:currentUpper,...upper}=current.upperRig,{parts:sourceUpper,...oldUpper}=source.upperRig;
 assert.deepEqual(upper,oldUpper);
 const {parts:currentLower,...lower}=current.lowerRig,{parts:sourceLower,...oldLower}=source.lowerRig;
 assert.deepEqual(lower,oldLower);
 const semantics=parts=>parts.map(({name,bone})=>({name,bone}));
 assert.deepEqual(semantics(currentUpper),semantics(sourceUpper));assert.deepEqual(semantics(currentLower),semantics(sourceLower));
 for(const key of ['key','width','height','frameCount','settleLevels','cycleDistance','lowerCount','muzzles'])assert.deepEqual(current[key],source[key],key);
 assert.equal(current.frames.length,source.frames.length);
 for(const part of [...currentUpper,...currentLower,...current.frames])for(const rect of [part.source,part.destination])for(const key of ['x','y','w','h'])assert.ok(Number.isFinite(rect[key]),key);
}
