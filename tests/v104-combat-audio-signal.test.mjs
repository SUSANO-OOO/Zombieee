import test from'node:test';import assert from'node:assert/strict';import fs from'node:fs';import{execFileSync}from'node:child_process';import ffmpeg from'@ffmpeg-installer/ffmpeg';import{createHash}from'node:crypto';
test('new combat codecs preserve the existing true-peak, silence, DC and tail-click limits',()=>{
 const dir='public/audio/v104/combat',names=fs.readdirSync(dir).filter(n=>/\.(mp3|ogg)$/.test(n));assert.equal(names.length,38);
 for(const name of ['handgun','suppressed-pistol'])for(const ext of ['mp3','ogg'])assert.ok(names.includes(name+'.'+ext));
 const fingerprints=new Map();
 for(const name of names){
  const bytes=execFileSync(ffmpeg.path,['-v','error','-i',dir+'/'+name,'-f','f32le','-ac','1','-ar','44100','pipe:1'],{maxBuffer:8*1024*1024,stdio:['ignore','pipe','pipe']}),v=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),samples=Array.from({length:bytes.length/4},(_,i)=>v.getFloat32(i*4,true));
  let peak=0,sum=0,squares=0;
  for(let i=0;i<samples.length;i++){
   const p=samples[i];peak=Math.max(peak,Math.abs(p));sum+=p;squares+=p*p;
   if(i>0&&i<samples.length-2)for(const t of[.25,.5,.75]){const a=samples[i-1],b=p,c=samples[i+1],d=samples[i+2];peak=Math.max(peak,Math.abs(.5*(2*b+(-a+c)*t+(2*a-5*b+4*c-d)*t*t+(-a+3*b-3*c+d)*t*t*t)));}
  }
  assert.ok(samples.length>4000,name+' empty');assert.ok(Math.sqrt(squares/samples.length)>.003,name+' silent');assert.ok(peak<.72,name+' true peak '+peak);assert.ok(Math.abs(sum/samples.length)<.01,name+' DC');assert.ok(Math.abs(samples[0]-samples.at(-1))<.08,name+' tail click');assert.ok(Math.abs(samples.at(-1))<.08,name+' nonzero tail');
  if(name.endsWith('.mp3'))fingerprints.set(name,createHash('sha256').update(bytes).digest('hex'));
 }
 assert.notEqual(fingerprints.get('armor-hit.mp3'),fingerprints.get('pan-hit.mp3'));assert.notEqual(fingerprints.get('pan-hit.mp3'),fingerprints.get('pan-heavy.mp3'));
 assert.notEqual(fingerprints.get('handgun.mp3'),fingerprints.get('suppressed-pistol.mp3'));
});
