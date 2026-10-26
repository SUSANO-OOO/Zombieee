import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const entries=['README.md','AGENTS.md','docs/PROJECT_STATE.md','docs/RELEASE_BACKUP_RECOVERY.md'];
export function checkDevelopmentDocs(root=process.cwd()){
 for(const file of entries){
  const body=readFileSync(path.join(root,file),'utf8');
  for(const [,raw] of body.matchAll(/\[[^\]]*\]\(([^)]+)\)/gu)){
   const target=raw.replace(/^<|>$/gu,'').split('#')[0];
   if(!target||/^[\w+.-]+:/u.test(target))continue;
   const resolved=path.resolve(root,path.dirname(file),decodeURIComponent(target));
   assert.ok(resolved.startsWith(path.resolve(root)+path.sep),'Documentation link escapes repository: '+file);
   assert.ok(existsSync(resolved),'Missing documentation target: '+file+' -> '+target);
  }
 }
 assert.ok(Buffer.byteLength(readFileSync(path.join(root,'AGENTS.md')))<8192,'Keep the execution entry short');
 return entries;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)
 console.log('Current documentation links verified: '+checkDevelopmentDocs().join(', '));
