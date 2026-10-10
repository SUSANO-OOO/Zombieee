import {readFile,writeFile} from 'node:fs/promises';
const art=JSON.parse(await readFile('assets/source/v100/story-r9/runtime-provenance.json','utf8')).records;
const audio=JSON.parse(await readFile('assets/source/v100/audio/r9-sound-provenance.json','utf8')).records.filter(row=>row.file.endsWith('.mp3'));
const records=[...art.map(({path,bytes,hash,criticality})=>({path,bytes,hash,criticality})),...audio.map(row=>({path:row.file.slice('public'.length),bytes:row.bytes,hash:'sha256-'+row.sha256,criticality:'optional'}))];
if(new Set(records.map(row=>row.path)).size!==records.length)throw new Error('Duplicate R9 asset path');
const bytes=records.reduce((sum,row)=>sum+row.bytes,0);
await writeFile('scripts/v100-r9-asset-contract.mjs','// Exact R9 scene art and sound delta, bound to authoring provenance.\nexport const V100_R9_ASSET_ADDITIONS=Object.freeze('+JSON.stringify(records,null,2)+');\nexport const V100_R9_ASSET_BYTES='+bytes+';\n');
console.log(JSON.stringify({assets:records.length,bytes}));
