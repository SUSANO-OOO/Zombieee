import {createHash} from 'node:crypto';
import {deflateRawSync} from 'node:zlib';
export function provenanceFixture({runId,head,base,merge='d'.repeat(40),baseRef='main',artifactId=91,method=8}={}){
 const name=Buffer.from('pr-provenance.txt'),payload=Buffer.from(`base_ref=${baseRef}\nbase_sha=${base}\nhead_sha=${head}\nmerge_sha=${merge}\n`);
 const compressed=method===0?payload:deflateRawSync(payload),local=Buffer.alloc(30),central=Buffer.alloc(46),end=Buffer.alloc(22);
 local.writeUInt32LE(0x04034b50);local.writeUInt16LE(20,4);local.writeUInt16LE(method,8);
 local.writeUInt32LE(compressed.length,18);local.writeUInt32LE(payload.length,22);local.writeUInt16LE(name.length,26);
 central.writeUInt32LE(0x02014b50);central.writeUInt16LE(20,4);central.writeUInt16LE(20,6);central.writeUInt16LE(method,10);
 central.writeUInt32LE(compressed.length,20);central.writeUInt32LE(payload.length,24);central.writeUInt16LE(name.length,28);
 const offset=local.length+name.length+compressed.length;end.writeUInt32LE(0x06054b50);end.writeUInt16LE(1,8);end.writeUInt16LE(1,10);
 end.writeUInt32LE(central.length+name.length,12);end.writeUInt32LE(offset,16);
 const zip=Buffer.concat([local,name,compressed,central,name,end]);
 const artifact={id:artifactId,name:'pr-verify-provenance',expired:false,size_in_bytes:zip.length,
  digest:'sha256:'+createHash('sha256').update(zip).digest('hex'),workflow_run:{id:runId,head_sha:head}};
 return{zip,payload,artifact,artifacts:{total_count:1,artifacts:[artifact]}};
}
