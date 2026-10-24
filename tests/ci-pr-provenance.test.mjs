import test from 'node:test';import assert from 'node:assert/strict';
import {readPrProvenanceArchive,immutablePrProvenance} from '../scripts/ci-pr-provenance.mjs';
import {provenanceFixture} from './helpers/ci-pr-provenance.mjs';
const source={runId:51,head:'a'.repeat(40),base:'c'.repeat(40)};
test('immutable source evidence validates the exact run, archive digest and original head/base/merge',async()=>{
 for(const method of [0,8]){
  const fixture=provenanceFixture({...source,method}),get=async(_suffix,binary)=>binary?fixture.zip:fixture.artifacts;
  const proof=await immutablePrProvenance({...source,get});
  assert.equal(proof.head,source.head);assert.equal(proof.base,source.base);assert.equal(proof.merge,'d'.repeat(40));
  assert.equal(proof.artifactId,91);assert.equal(proof.artifactDigest,fixture.artifact.digest);
 }
});
test('missing, expired, duplicate, rebound and corrupt provenance never grants reuse',async()=>{
 for(const mutate of [
  f=>{f.artifacts.artifacts=[];},f=>{f.artifacts.artifacts.push({...f.artifact});},
  f=>{f.artifact.expired=true;},f=>{f.artifact.workflow_run.id=52;},f=>{f.artifact.workflow_run.head_sha='f'.repeat(40);},
  f=>{f.artifact.digest='sha256:'+'f'.repeat(64);},f=>{f.artifact.size_in_bytes++;},
  f=>{f.artifacts.total_count=101;},f=>{f.artifacts.total_count=2;},f=>{f.zip[31]^=1;},
 ]){
  const f=provenanceFixture(source);mutate(f);await assert.rejects(immutablePrProvenance({...source,get:async(_s,binary)=>binary?f.zip:f.artifacts}));
 }
 for(const changed of [{base:'f'.repeat(40)},{head:'f'.repeat(40)},{baseRef:'unapproved/branch'},{merge:'invalid'}]){
  const f=provenanceFixture({...source,...changed});await assert.rejects(immutablePrProvenance({...source,get:async(_s,binary)=>binary?f.zip:f.artifacts}));
 }
});
test('the narrow archive reader rejects multiple entries, paths, oversized output and unsupported ZIP formats',()=>{
 for(const mutate of [b=>b.writeUInt16LE(2,b.length-12),b=>b.writeUInt16LE(1,b.length-2),
  b=>b.writeUInt32LE(0,b.length-22),b=>b.writeUInt32LE(50000,b.readUInt32LE(b.length-6)+24),
  b=>b.writeUInt16LE(1,b.readUInt32LE(b.length-6)+8),b=>b.writeUInt16LE(12,b.readUInt32LE(b.length-6)+10),
  b=>{b[30]=46;},b=>b.writeUInt32LE(1,b.readUInt32LE(b.length-6)+42)]){
  const bytes=Buffer.from(provenanceFixture(source).zip);mutate(bytes);assert.throws(()=>readPrProvenanceArchive(bytes));
 }
 assert.throws(()=>readPrProvenanceArchive(Buffer.alloc(65537)));
});
