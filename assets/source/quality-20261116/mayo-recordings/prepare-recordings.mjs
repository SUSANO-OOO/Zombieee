import fs from 'node:fs/promises';
import process from 'node:process';
import {Buffer} from 'node:buffer';
import console from 'node:console';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const root=fileURLToPath(new URL('.',import.meta.url));
const binary=process.argv[2];
const sha=b=>createHash('sha256').update(b).digest('hex');
const binaryHash=sha(await fs.readFile(binary));
if(binaryHash!=='c8abc49e7be62dde8e12972af373959e0076a7b8dc8040eb45978e0608f8781e')throw Error('Unverified decoder');
const run=promisify(execFile), rate=44100, targetPeak=.707;
const sources=[
 {name:'bark',id:350591,expected:'d868ea0c990a20c91b347ca9cc765fe8aaba2c4d655a29e1c57ea343c2d170f1'},
 {name:'whine',id:350593,expected:'842e3ccb9a8517a3b479c7e510e47898c11ada58a9b93c50a91ca83e3e22188b'},
];
const rows=[];
for(const item of sources){
 const input=path.join(root,item.name+'-public-preview.mp3');
 const inputBytes=await fs.readFile(input);
 if(sha(inputBytes)!==item.expected)throw Error('Source changed');
 const args=['-hide_banner','-loglevel','error','-i',input,'-vn','-ac','1','-ar',String(rate),'-f','f32le','pipe:1'];
 const result=await run(binary,args,{encoding:'buffer',maxBuffer:5*1024*1024,windowsHide:true});
 if(result.stderr.length)throw Error(result.stderr.toString());
 const pcm=result.stdout, samples=pcm.length/4;
 let peak=0;
 for(let i=0;i<samples;i++)peak=Math.max(peak,Math.abs(pcm.readFloatLE(i*4)));
 if(!Number.isFinite(peak)||peak<=0)throw Error('Invalid source level');
 const gain=targetPeak/peak;
 const wav=Buffer.alloc(44+samples*2);
 wav.write('RIFF',0);wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);
 wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);
 wav.writeUInt32LE(rate,24);wav.writeUInt32LE(rate*2,28);wav.writeUInt16LE(2,32);
 wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(samples*2,40);
 let finalPeak=0;
 for(let i=0;i<samples;i++){
  const value=Math.round(pcm.readFloatLE(i*4)*gain*32767);
  if(Math.abs(value)>32767)throw Error('Output clipping');
  wav.writeInt16LE(value,44+i*2);finalPeak=Math.max(finalPeak,Math.abs(value)/32768);
 }
 const output='mayo-recorded-'+item.name+'.wav';
 await fs.writeFile(path.join(root,output),wav,{flag:'wx'});
 const readback=await fs.readFile(path.join(root,output));
 if(!readback.equals(wav))throw Error('Output readback mismatch');
 rows.push({name:item.name,creator:'AustinXYZ',collection:'Robin',sourcePage:`https://freesound.org/people/AustinXYZ/sounds/${item.id}/`,license:'CC0-1.0',commercialUse:true,adaptation:true,redistribution:true,sourceKind:'public HQ MP3 preview linked in creator page',originalWavRetrieved:false,sourceBytes:inputBytes.length,sourceSha256:sha(inputBytes),output,outputBytes:wav.length,outputSha256:sha(wav),sampleRate:rate,samples,seconds:samples/rate,sourceDecodedPeak:peak,linearGain:gain,finalPeak,clippedSamples:0,channels:1,bitsPerSample:16,trim:false,pitchShift:false,timeStretch:false});
}
const receipt={createdAt:new Date().toISOString(),status:'recorded-candidates-prepared-not-integrated',decoder:{path:binary,sha256:binaryHash},recipe:'Decode the public MP3 once to mono float PCM, attenuate linearly to peak .707, store losslessly as PCM16 WAVE; keep full original duration.',producerDirection:'Free wordless reactions; preserve Chihuahua identity. These files are a candidate and have no subjective or physical-device acceptance.',rows,runtimeChanged:false,paidUse:0,subjectiveListeningAccepted:false,physicalDeviceAccepted:false};
await fs.writeFile(path.join(root,'prepared-recordings.json'),JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({status:receipt.status,rows:rows.map(({name,seconds,finalPeak,outputBytes,clippedSamples})=>({name,seconds,finalPeak,outputBytes,clippedSamples}))}));
