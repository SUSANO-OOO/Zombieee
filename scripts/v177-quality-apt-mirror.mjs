import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {lstatSync,mkdirSync,readFileSync,realpathSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

const mirrorFile='/etc/apt/apt-mirrors.txt';
const azure='http://azure.archive.ubuntu.com/ubuntu/';
const archive='https://archive.ubuntu.com/ubuntu/';
const security='https://security.ubuntu.com/ubuntu/';

export function assertQualityMirrorHost(env,platform){
  assert.equal(platform,'linux','Only the ephemeral Linux quality runner may change its mirror');
  for(const [key,value] of Object.entries({GITHUB_ACTIONS:'true',RUNNER_ENVIRONMENT:'github-hosted',
    RUNNER_OS:'Linux',GITHUB_JOB:'quality-ui-play',V177_QUALITY_ENGINE:'webkit'}))assert.equal(env[key],value,key);
  assert.equal(env.GITHUB_REPOSITORY?.toLowerCase(),'susano-ooo/zombieee');
}

// Exact template from actions/runner-images ubuntu24/20261012.334,
// images/ubuntu/scripts/build/configure-apt-sources.sh. Keep priorities and signatures.
export function qualityMirrorText(before){
  assert.equal(typeof before,'string');
  const rows=before.split(/\r?\n/u).filter(line=>line.trim()&&!line.trimStart().startsWith('#'));
  assert.equal(rows.length,3,'Unexpected runner mirror list');
  const entries=rows.map(line=>{
    const match=/^[ \t]*(\S+)[ \t]+priority:([123])[ \t]*$/u.exec(line);
    assert.ok(match,'Unexpected runner mirror row');return{uri:match[1],priority:match[2]};
  });
  assert.ok([azure,archive].includes(entries[0].uri),'Unexpected first mirror');
  assert.deepEqual(entries.map(entry=>entry.priority),['1','2','3']);
  assert.deepEqual(entries.slice(1).map(entry=>entry.uri),[archive,security]);
  return entries[0].uri===archive?before:before.replace(/^([ \t]*)http:\/\/azure\.archive\.ubuntu\.com\/ubuntu\/(?=[ \t]+priority:1[ \t]*\r?$)/mu,'$1'+archive);
}

export function prepareQualityMirror(){
  assertQualityMirrorHost(process.env,process.platform);
  const output='quality-ui-evidence/apt-mirror-webkit.json';
  const receipt={at:new Date().toISOString(),file:mirrorFile,status:'pending',
    source:'https://github.com/actions/runner-images/blob/ubuntu24/20261012.334/images/ubuntu/scripts/build/configure-apt-sources.sh'};
  mkdirSync('quality-ui-evidence',{recursive:true});
  try{
    const stat=lstatSync(mirrorFile);
    assert.ok(stat.isFile()&&!stat.isSymbolicLink()&&stat.uid===0,'Expected root-owned regular mirror list');
    assert.equal(realpathSync(mirrorFile),mirrorFile);
    receipt.before=readFileSync(mirrorFile,'utf8');
    const after=qualityMirrorText(receipt.before);
    if(after!==receipt.before)execFileSync('sudo',['-n','tee',mirrorFile],{input:after,stdio:['pipe','ignore','pipe'],timeout:10_000});
    receipt.after=readFileSync(mirrorFile,'utf8');assert.equal(receipt.after,after,'Mirror write verification');
    for(const key of ['before','after'])receipt[key+'Sha256']=createHash('sha256').update(receipt[key]).digest('hex');
    receipt.status=after===receipt.before?'already-official':'official-mirror-selected';
  }catch(error){receipt.status='failed';receipt.error=error.message;throw error;}
  finally{writeFileSync(output,JSON.stringify(receipt,null,2)+'\n');}
  console.log(JSON.stringify({status:receipt.status,evidence:output}));
}

if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)prepareQualityMirror();
