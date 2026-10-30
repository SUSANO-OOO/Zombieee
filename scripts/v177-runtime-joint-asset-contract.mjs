import {readFileSync} from 'node:fs';
import {V177_JOINT_ASSET_ADDITIONS as authored} from './v177-joint-asset-contract.mjs';

// Keep the authored/historical contract unchanged. Current rendering uses
// source-bound head derivatives with the same body geometry and body pixels.
const read=file=>JSON.parse(readFileSync(new URL(file,import.meta.url),'utf8'));
const entries=[...new Map([
 ...read('../assets/source/quality-20261028/identity/head-runtime-provenance.json').entries,
 ...read('../assets/source/quality-20261028/identity/battle-heads-r3/runtime-provenance.json').entries,
].map(row=>[row.kind,row])).values()];
const byBase=new Map(entries.map(row=>[row.basePath,row]));
const asset=row=>Object.freeze({path:row.assetPath,bytes:row.bytes,hash:'sha256-'+row.sha256});
const rows=authored.map(row=>byBase.has(row.path)?asset(byBase.get(row.path)):row);
for(const row of entries)if(!rows.some(item=>item.path===row.assetPath))rows.push(asset(row));
export const V177_JOINT_ASSET_ADDITIONS=Object.freeze(rows);
