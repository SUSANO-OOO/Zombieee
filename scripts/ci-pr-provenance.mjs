import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {inflateRawSync} from 'node:zlib';

// Read only GitHub's tiny, single-file provenance archive. No extraction,
// general ZIP support, external command or application dependency is needed.
export function readSingleTextArchive(input,name='pr-provenance.txt'){
  assert.ok(['pr-provenance.txt','validation-scope.json'].includes(name));
  const bytes=Buffer.from(input);assert.ok(bytes.length>=98&&bytes.length<=65536);
  const end=bytes.length-22;assert.equal(bytes.readUInt32LE(end),0x06054b50);
  assert.equal(bytes.readUInt16LE(end+4),0);assert.equal(bytes.readUInt16LE(end+6),0);
  assert.equal(bytes.readUInt16LE(end+8),1);assert.equal(bytes.readUInt16LE(end+10),1);assert.equal(bytes.readUInt16LE(end+20),0);
  const size=bytes.readUInt32LE(end+12),central=bytes.readUInt32LE(end+16);
  assert.ok(central>=30&&central+size===end&&size>=46);assert.equal(bytes.readUInt32LE(central),0x02014b50);
  const flags=bytes.readUInt16LE(central+8),method=bytes.readUInt16LE(central+10);
  assert.equal(flags&~0x0808,0);assert.ok(method===0||method===8);
  const compressed=bytes.readUInt32LE(central+20),uncompressed=bytes.readUInt32LE(central+24);
  const nameSize=bytes.readUInt16LE(central+28),extra=bytes.readUInt16LE(central+30),comment=bytes.readUInt16LE(central+32);
  assert.equal(bytes.readUInt16LE(central+34),0);const local=bytes.readUInt32LE(central+42);
  assert.equal(local,0);assert.equal(size,46+nameSize+extra+comment);
  assert.equal(bytes.subarray(central+46,central+46+nameSize).toString('utf8'),name);
  const limit=name==='validation-scope.json'?60000:4096;
  assert.ok(compressed>0&&compressed<=limit&&uncompressed>0&&uncompressed<=limit);
  assert.equal(bytes.readUInt32LE(local),0x04034b50);assert.equal(bytes.readUInt16LE(local+6),flags);assert.equal(bytes.readUInt16LE(local+8),method);
  const localNameSize=bytes.readUInt16LE(local+26),localExtra=bytes.readUInt16LE(local+28);
  assert.equal(localNameSize,nameSize);
  assert.equal(bytes.subarray(local+30,local+30+localNameSize).toString('utf8'),name);
  const start=local+30+localNameSize+localExtra;assert.ok(start+compressed<=central);
  const payload=method===0?bytes.subarray(start,start+compressed):inflateRawSync(bytes.subarray(start,start+compressed),{maxOutputLength:limit});
  assert.equal(payload.length,uncompressed);
  const text=new TextDecoder('utf-8',{fatal:true}).decode(payload);
  return text;
}
export function readPrProvenanceArchive(input){
  const text=readSingleTextArchive(input);
  const payload=Buffer.from(text,'utf8');
  const match=/^base_ref=(main|integration\/[^\s]+|codex\/v1\.0\.0-sol-design)\r?\nbase_sha=([a-f0-9]{40})\r?\nhead_sha=([a-f0-9]{40})\r?\nmerge_sha=([a-f0-9]{40})\r?\n$/u.exec(text);
  assert.ok(match,'invalid immutable PR provenance');
  return{baseRef:match[1],base:match[2],head:match[3],merge:match[4],textSha256:createHash('sha256').update(payload).digest('hex')};
}

export async function immutablePrProvenance({get,runId,head,base}){
  const data=await get(`actions/runs/${runId}/artifacts?per_page=100`);
  assert.ok(Number.isSafeInteger(data.total_count)&&data.total_count<=100);
  assert.ok(Array.isArray(data.artifacts)&&data.artifacts.length===data.total_count);
  const matches=(data.artifacts??[]).filter(a=>a.name==='pr-verify-provenance');assert.equal(matches.length,1);
  const artifact=matches[0];assert.ok(Number.isSafeInteger(artifact.id)&&artifact.id>0);
  assert.equal(artifact.expired,false);assert.equal(artifact.workflow_run?.id,runId);assert.equal(artifact.workflow_run?.head_sha,head);
  assert.ok(artifact.size_in_bytes>=98&&artifact.size_in_bytes<=65536);assert.match(artifact.digest??'',/^sha256:[a-f0-9]{64}$/u);
  const bytes=Buffer.from(await get(`actions/artifacts/${artifact.id}/zip`,true));assert.equal(bytes.length,artifact.size_in_bytes);
  const archiveSha256=createHash('sha256').update(bytes).digest('hex');assert.equal('sha256:'+archiveSha256,artifact.digest);
  const record=readPrProvenanceArchive(bytes);assert.equal(record.head,head);assert.equal(record.base,base);
  return{...record,artifactId:artifact.id,artifactDigest:artifact.digest,archiveBytes:bytes.length,archiveSha256};
}
