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
