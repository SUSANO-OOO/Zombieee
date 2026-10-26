import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import {checkDevelopmentDocs} from '../scripts/check-development-docs.mjs';

function assertOperatingDocuments({agents,workflow,luna,mission,runbook,assetPolicy}){
 assert.match(agents,/PROJECT_STATE\.md/u);assert.match(agents,/ASSET_STORAGE_POLICY\.md/u);
 assert.match(agents,/変更前後の契約/u);assert.ok(Buffer.byteLength(agents)<8192);
 for(const history of [workflow,luna,mission]){
  assert.match(history.slice(0,650),/履歴資料/u);
  assert.match(history.slice(0,650),/PROJECT_STATE\.md/u);
 }
 assert.match(runbook,/独立read-only review/u);
 assert.match(runbook,/自分の変更の確認を独立reviewとは呼ばない/u);
 assert.match(runbook,/operation/u);assert.match(runbook,/deploy.*boolean/u);
 assert.match(assetPolicy,/production runtime/u);assert.match(assetPolicy,/provenance/u);assert.match(assetPolicy,/100 MiB/u);
}
test('current entry preserves safety while historical roles cannot become active instructions',async()=>{
 const files={agents:'AGENTS.md',workflow:'docs/CODEX_TWO_THREAD_WORKFLOW.md',luna:'docs/CODEX_LUNA_ROLE.md',
  mission:'docs/story/v10/CODEX_SOL_DESIGN_MISSION.md',runbook:'docs/RELEASE_BACKUP_RECOVERY.md',assetPolicy:'docs/ASSET_STORAGE_POLICY.md'};
 const docs=Object.fromEntries(await Promise.all(Object.entries(files).map(async([k,f])=>[k,await readFile(f,'utf8')])));
 assertOperatingDocuments(docs);checkDevelopmentDocs();
 for(const mutate of [
  d=>{d.agents=d.agents.replace('ASSET_STORAGE_POLICY.md','missing.md');},
  d=>{d.workflow=d.workflow.replace('履歴資料','現行ルール');},
  d=>{d.runbook=d.runbook.replace('自分の変更の確認を独立reviewとは呼ばない','自己承認してよい');},
 ]){
  const bad=structuredClone(docs);mutate(bad);assert.throws(()=>assertOperatingDocuments(bad));
 }
});
