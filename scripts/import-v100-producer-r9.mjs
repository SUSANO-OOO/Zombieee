import {createHash} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
import {V100_EVENT_IDS} from '../app/v100Registry.js';
import {V100_CREDITS_FILM} from '../app/v100CreditsFilm.js';
import {v100R9NodeStaging} from '../app/v100R9Staging.js';

const sourcePath=process.argv[2]??'docs/story/v10/STORY_SCRIPT_V100_PRODUCER_R9.md';
const outputPath=process.argv[3]??'app/v100StoryEvents.js';
const sourceBytes=await readFile(sourcePath),source=sourceBytes.toString('utf8'),lines=source.split(/\r?\n/u);
const sha=createHash('sha256').update(sourceBytes).digest('hex');
const sourceDocument='STORY_SCRIPT_V100_PRODUCER_R9.md';
const cast=new Map(Object.entries({
 'パイセン':'unit-paisen','クマバーソン':'unit-kumaverson','ババヤガ':'unit-babayaga',
 'いくらちゃん':'guide-ikura','ナオ':'unit-nao','ミズチ':'unit-mizuchi','モンキー':'unit-monkey',
 'クレイジーキング':'unit-crazy-king','レイダー':'unit-raider','タタラ':'unit-tatara',
 'ガンテツ':'unit-gantetsu','ザキミヤ':'unit-zakimiya','TKY':'unit-tky','Mrs.チハ':'unit-mrs-chiha',
 '宮本武蔵':'unit-miyamoto-musashi','ムガリアン社長':'mugarian-president','セガワ':'segawa',
 '赤レンズの隊長':'red-panther-commander','RED PANTHER隊長':'red-panther-commander',
}));
const sections=[],ownedLines=new Set();
let section=null;
for(let index=0;index<lines.length;index++){
 const raw=lines[index];
 let line=raw.trim();const sourceLine=index+1,sourceLines=[sourceLine];
 if(!line)continue;
 if(line==='# 西新世紀末物語')continue;
 if(line.startsWith('## ')){
  let id,kind,number=null;
  if(line==='## プロローグ'){id='v100:event:prologue';kind='prologue';}
  else if(line==='## エンディング'){id='v100:event:ending';kind='ending';}
  else{
   const heading=/^## 第(\d+)作戦｜(.+)｜戦闘(前|後)$/u.exec(line);
   if(!heading)throw Error(`Unknown R9 heading at ${sourceLine}: ${line}`);
   number=Number(heading[1]);
   if(number<1||number>30)throw Error(`Invalid R9 stage ${number}`);
   const phase=heading[3]==='前'?'pre':'post';
   id=`v100:event:s${String(number).padStart(2,'0')}:${phase}`;kind=`stage-${phase}`;
  }
  if(sections.some(event=>event.id===id))throw Error(`Duplicate R9 section ${id}`);
  section={id,kind,stageNumber:number,musicProfile:number?'locked-stage-profile':'FINAL',
   source:{document:sourceDocument,startLine:sourceLine+1,endLine:sourceLine},nodes:[]};
  sections.push(section);continue;
 }
 if(!section)throw Error(`R9 narrative outside a section at ${sourceLine}`);
 // A quotation in the bridge scene spans two physical Markdown lines. Keep
 // its newline and attribution together; the continuation is never narration.
 if(/^\*\*.+?\*\*\s*「/u.test(line)&&!line.endsWith('」')){
  while(!line.endsWith('」')){
   index++;
   if(index>=lines.length||!lines[index].trim()||/^(?:#|\*\*)/u.test(lines[index]))throw Error(`Unclosed R9 dialogue at ${sourceLine}`);
   line+='\n'+lines[index].trim();sourceLines.push(index+1);
  }
 }
 let node;
 const dialogue=/^\*\*(.+?)\*\*\s*「([\s\S]*)」$/u.exec(line);
 const display=/^\*\*(案内表示|戦闘開始表示|ボス名表示)\*\*\s+(.+)$/u.exec(line);
 if(dialogue){
  const speaker=dialogue[1],offscreen=/声$|メッセージ$/u.test(speaker);
  node={kind:'dialogue',speaker,text:dialogue[2],portraitOwner:offscreen?null:cast.get(speaker)??'minor-human-shared-event-silhouette',portraitKind:offscreen?'offscreen':cast.has(speaker)?'major':'minor'};
 }else if(display){
  node={kind:display[1]==='戦闘開始表示'?'battle-marker':display[1]==='ボス名表示'?'boss-marker':'system',speaker:null,text:display[2],portraitOwner:null,portraitKind:'system'};
 }else if(!/^[#*]|\*\*/u.test(line)){
  node={kind:'action',speaker:null,text:line,portraitOwner:null,portraitKind:'stage-direction'};
 }else throw Error(`Unparsed R9 narrative at ${sourceLine}: ${line}`);
 if(!node.text||ownedLines.has(sourceLine))throw Error(`Invalid or duplicate R9 source line ${sourceLine}`);
 for(const consumed of sourceLines)ownedLines.add(consumed);
 section.nodes.push({...node,sourceLine,sourceLines,sourceDocument,sourceKey:`r9:${sourceLine}`,
  ...v100R9NodeStaging(section.id,sourceLine)});
 section.source.endLine=sourceLines.at(-1);
}
const events={};
for(const eventId of V100_EVENT_IDS){
 const event=sections.find(entry=>entry.id===eventId);
 if(event){if(!event.nodes.length)throw Error(`Empty R9 narrative ${eventId}`);events[eventId]=event;continue;}
 const firstClear=/^v100:event:s(\d{2}):first-clear-post$/u.exec(eventId);
 if(firstClear){events[eventId]={id:eventId,kind:'first-clear-post',stageNumber:Number(firstClear[1]),musicProfile:'locked-stage-profile',nodes:[],finalizeOnly:true};continue;}
 if(eventId==='v100:event:credits'){
  const labels=[...new Set(V100_CREDITS_FILM.map(shot=>shot.sceneLabel))];
  events[eventId]={id:eventId,kind:'credits',stageNumber:null,musicProfile:null,characterVoice:false,
   nodes:labels.map(label=>({kind:'montage',speaker:null,sceneLabel:label,text:V100_CREDITS_FILM.find(shot=>shot.sceneLabel===label).description,
    portraitOwner:null,portraitKind:'stage-direction',sourceDocument:'existing-production-credits',sourceLine:null,sourceKey:`credits:${label}`}))};
  continue;
 }
 if(eventId==='v100:event:epilogue'){
  // R9 already includes the return to Kumaya in its ending. The stable ID is
  // retained for saves, without appending obsolete R5 dialogue or its film.
  events[eventId]={id:eventId,kind:'epilogue',stageNumber:null,musicProfile:null,characterVoice:false,nodes:[],finalizeOnly:true,postCreditsFilm:false};continue;
 }
 throw Error(`Missing R9 event ${eventId}`);
}
if(sections.length!==62)throw Error(`Expected prologue, 60 stage sections and ending; got ${sections.length}`);
const expected=lines.flatMap((line,index)=>line.trim()&&!line.startsWith('#')?[index+1]:[]);
if(expected.length!==ownedLines.size||expected.some(line=>!ownedLines.has(line)))throw Error('R9 narrative coverage mismatch');
const output=`// Generated by scripts/import-v100-producer-r9.mjs. Do not hand-edit.\nimport {V100_EVENT_IDS,renderV100PlayerName} from './v100Registry.js';\n\nexport const V100_STORY_SOURCE_SHA256=${JSON.stringify(sha)};\nexport const V100_STORY_SOURCE_LINE_COUNT=${lines.length};\nexport const V100_STORY_SCRIPT_VERSION='producer-r9';\nexport const V100_STORY_SOURCE_DOCUMENT=${JSON.stringify(sourceDocument)};\nexport const V100_STORY_POST_CREDITS_FILM=false;\nexport const V100_STORY_EVENTS=Object.freeze(${JSON.stringify(events,null,2)});\n\nexport function v100StoryEventFor(id){return V100_STORY_EVENTS[id]??null;}\nexport function v100StoryEventIdsForStage(number){const stage=String(Number(number)).padStart(2,'0');return ['pre','post','first-clear-post'].map(phase=>\`v100:event:s\${stage}:\${phase}\`).filter(id=>Boolean(V100_STORY_EVENTS[id]));}\nexport function v100StoryNodeText(node,playerName){return node?.text==null?'':renderV100PlayerName(node.text,playerName);}\nexport function v100StoryEventView(id,playerName){const event=v100StoryEventFor(id);return event?{...event,nodes:event.nodes.map(node=>({...node,text:v100StoryNodeText(node,playerName)}))}:null;}\nexport function v100StoryContract(){return Object.freeze({eventIds:V100_EVENT_IDS,eventCount:V100_EVENT_IDS.length,prologueFirst:V100_EVENT_IDS[0],endingSequence:['v100:event:ending','v100:event:credits'],creditsHasDialogue:false,creditsMusic:null,sourceSha256:V100_STORY_SOURCE_SHA256});}\n`;
// Validation finishes before any write; a malformed revision keeps the old data.
await writeFile(outputPath,output,'utf8');
console.log(JSON.stringify({source:sourceDocument,sha,lines:lines.length,narrative:ownedLines.size,events:Object.keys(events).length,output:outputPath}));
