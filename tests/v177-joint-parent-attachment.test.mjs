import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {validateJointParentAttachment} from '../scripts/build-v177-rigid-joint-atlas.mjs';
const source=()=>({rig:{head:[[30,20],[32,5]],extras:[{name:'fin',parent:'spine',a:[10,15],b:[1,30]}]},parts:[{bone:'spine'},{bone:'head'},{bone:'fin'}],interpolationPivots:{head:[30,20],fin:[10,15]}});

test('source-bound head and leaf thorax fin use their original painted attachment points',()=>{
 assert.doesNotThrow(()=>validateJointParentAttachment(source(),'head',{parent:'spine',pivot:[30,20]}));
 assert.doesNotThrow(()=>validateJointParentAttachment(source(),'fin',{parent:'spine',pivot:[10,15]}));
});

test('attachment contract rejects moved joints, cycles, missing paint and rerouting constrained anatomy',()=>{
 const failures=[
  [source(),'head',{parent:'head',pivot:[30,20]}],
  [source(),'head',{parent:'spine',pivot:[31,20]}],
  [source(),'fin',{parent:'pelvis',pivot:[10,15]}],
  [source(),'fin',{parent:'head',pivot:[10,15]}],
  [source(),'fin',{parent:'spine',pivot:[10,NaN]}],
  [source(),'unknown',{parent:'spine',pivot:[10,15]}],
  [{...source(),parts:[{bone:'head'},{bone:'fin'}]},'fin',{parent:'spine',pivot:[10,15]}],
  [{...source(),interpolationPivots:{fin:[11,15]}},'fin',{parent:'spine',pivot:[10,15]}],
 ];
 const parent=source();parent.rig.extras.push({name:'child',parent:'fin',a:[1,30]});failures.push([parent,'fin',{parent:'spine',pivot:[10,15]}]);
 const limb=source();limb.rig.extras.push({name:'arm-0-upper',parent:'spine',a:[10,15]});limb.parts.push({bone:'arm-0-upper'});limb.interpolationPivots['arm-0-upper']=[10,15];failures.push([limb,'arm-0-upper',{parent:'spine',pivot:[10,15]}]);
 for(const [definition,name,attachment]of failures)assert.throws(()=>validateJointParentAttachment(definition,name,attachment));
});

test('existing source-bound Spitter jaw and soft throat retain their original contract',async()=>{
 const d=JSON.parse(await readFile(new URL('../assets/source/v100/joints/spitter-r1/parts.json',import.meta.url),'utf8'));
 for(const [name,attachment]of Object.entries(d.parentAttachments))assert.doesNotThrow(()=>validateJointParentAttachment(d,name,attachment));
});
