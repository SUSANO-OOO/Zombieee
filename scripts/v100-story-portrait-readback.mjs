import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {r9StoryPlan} from './v100-r9-story-plan.mjs';
import {expectedStoryPortraits,assertStoryPortraitSources} from './v100-story-portrait-contract.mjs';

const [input,output]=process.argv.slice(2);
assert.ok(input&&output,'Provide original report and new readback report paths');
const hash=b=>createHash('sha256').update(b).digest('hex');
const bytes=await readFile(input),original=JSON.parse(bytes),plan=r9StoryPlan();
assert.equal(original.status,'passed');
assert.equal(original.fullStorySelection,true);
const source=original.sources.find(s=>s.file==='app/v100StoryEvents.js');
assert.equal(source?.sha256,hash(await readFile(source.file)),'Story changed since recording');
const sources=[];
for(const file of ['app/V100Campaign.tsx','app/v100StoryDirection.js','app/v100DialogueComposition.js',
  'app/v100StoryPortraitPaths.js','app/v100EventPresentation.js','app/visualProfiles.js',
  'app/v100StoryPages.js']){
  const current=await readFile(file);
  const recorded=execFileSync('git',['show',`${original.head}:${file}`],{maxBuffer:32*1024*1024,windowsHide:true});
  const normalized=bytes=>bytes.toString('utf8').replace(/\r\n/gu,'\n');
  assert.equal(normalized(current),normalized(recorded),`Rendering source changed beyond checkout line endings: ${file}`);
  sources.push({file,sha256:hash(current),recordedGitBlobSha256:hash(recorded),lineEndingNormalizedMatch:true});
}
const cases=[];
for(const row of original.cases){
  const event=plan.events.find(e=>e.eventId===row.eventId);
  assert.ok(event);assert.equal(row.status,'passed');assert.equal(row.pages.length,event.pages.length);
  const pages=row.pages.map((page,index)=>{
    const planned=event.pages[index];assert.equal(page.nodeIndex,planned.nodeIndex);
    const expected=expectedStoryPortraits(row.eventId,planned);
    assertStoryPortraitSources(page.portraitPaint,expected);
    return {nodeIndex:page.nodeIndex,expected,status:'passed'};
  });
  cases.push({eventId:row.eventId,engine:row.engine,viewport:row.viewport,pages});
}
assert.deepEqual([...new Set(cases.map(c=>c.eventId))].sort(),plan.events.map(e=>e.eventId).sort());
const result={status:'passed',scope:'Recorded DOM image count and exact speaker/listener expression asset paths; not face likeness, continuous viewing, sound or physical-device acceptance',
  input,originalSha256:hash(bytes),recordedHead:original.head,sources,
  verifierSha256:hash(await readFile('scripts/v100-story-portrait-contract.mjs')),
  events:cases.length,pages:cases.reduce((n,c)=>n+c.pages.length,0),
  portraitInstances:cases.reduce((n,c)=>n+c.pages.reduce((n,p)=>n+p.expected.length,0),0),cases};
await writeFile(output,JSON.stringify(result,null,2)+'\n',{flag:'wx'});
assert.equal(hash(await readFile(output)),hash(Buffer.from(JSON.stringify(result,null,2)+'\n')));
console.log(JSON.stringify({status:result.status,events:result.events,pages:result.pages,portraitInstances:result.portraitInstances,output}));
