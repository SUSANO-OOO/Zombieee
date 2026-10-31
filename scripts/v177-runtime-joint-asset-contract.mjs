import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {V177_JOINT_ASSET_ADDITIONS as authored} from './v177-joint-asset-contract.mjs';

// Keep the authored/historical contract unchanged. Current rendering uses
// source-bound identity/material derivatives. New coherent bodies and visible
// neck attachments retain their own source contracts rather than claiming
// every active version is an unchanged-body head replacement.
const read=file=>JSON.parse(readFileSync(new URL(file,import.meta.url),'utf8'));
const entries=[...new Map([
 ...read('../assets/source/quality-20261028/identity/head-runtime-provenance.json').entries,
 ...read('../assets/source/quality-20261028/identity/battle-heads-r3/runtime-provenance.json').entries,
].map(row=>[row.kind,row])).values()];
const byBase=new Map(entries.map(row=>[row.basePath,row]));
const asset=row=>Object.freeze({path:row.assetPath,bytes:row.bytes,hash:'sha256-'+row.sha256});
const rows=authored.map(row=>byBase.has(row.path)?asset(byBase.get(row.path)):row);
for(const row of entries)if(!rows.some(item=>item.path===row.assetPath))rows.push(asset(row));
// A versioned weapon layer replaces its retained head-only base in distribution.
for(const row of read('../assets/source/quality-20261028/weapon-sidearm-r1/runtime-provenance.json').entries){
 const index=rows.findIndex(item=>item.path===row.basePath);assert.ok(index>=0,'Sidearm base must be the registered head version');
 rows[index]=asset(row);
}
const calibrated=read('../assets/source/quality-20261028/identity/battle-neck-calibration-r4-provenance.json').entries;
const kuma=read('../assets/source/quality-20261028/rigs/kumaverson-combat-r4/provenance.json');
for(const row of [...calibrated,{...kuma,basePath:'/art/v100/joints/kumaverson-quality-head-r1.webp'}]){
 const index=rows.findIndex(item=>item.path===row.basePath);assert.ok(index>=0,'Current identity material must have a registered predecessor: '+row.kind);
 rows[index]=asset(row);
}
export const V177_JOINT_ASSET_ADDITIONS=Object.freeze(rows);
