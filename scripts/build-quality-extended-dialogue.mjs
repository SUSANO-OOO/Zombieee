import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
const check=process.argv.includes('--check');
const hash=b=>createHash('sha256').update(b).digest('hex');
const base='assets/source/quality-20261028/identity/';
// Crown, chin, and face centre measured in a 256 x 384 contain preview.
// Normalize each independently framed extension into the same camera; don't
// squeeze bodies or faces to a rectangle, or hide a short torso with a fade.
const anchors={
  segawa:{warm:[8,103,126],determined:[14,100,114],alarm:[7,102,116],grief:[43,123,115]},
  president:{warm:[34,116,133],determined:[36,118,121],alarm:[5,88,124],grief:[36,119,127]},
  commander:{warm:[23,113,127],determined:[8,100,129],alarm:[11,104,126],grief:[40,130,123]},
  'minor-human':{neutral:[24,115,125]},
};
const records=[];
for(const [kind,expressions] of Object.entries(anchors))for(const [expression,[crown,chin,center]] of Object.entries(expressions)) {
  const input=base+`${kind}-${expression}-extended-r1.png`,bytes=await readFile(input),m=await sharp(bytes).metadata();
  assert.ok(m.hasAlpha);
  const previewScale=Math.min(256/m.width,384/m.height);
  const px=(256-m.width*previewScale)/2,py=(384-m.height*previewScale)/2;
  const sourceCrown=(crown-py)/previewScale,sourceCenter=(center-px)/previewScale,sourceHead=(chin-crown)/previewScale;
  const scale=300/sourceHead;
  const cropTop=Math.max(0,Math.floor(sourceCrown-120/scale));
  const croppedHeight=m.height-cropTop;
  const width=Math.round(m.width*scale),height=Math.round(croppedHeight*scale);
  const left=Math.round(768-sourceCenter*scale),top=Math.round(120-(sourceCrown-cropTop)*scale);
  assert.ok(left>=0&&top>=0&&left+width<=1536,`${kind}/${expression}: canvas would cut a side`);
  const resized=await sharp(bytes).extract({left:0,top:cropTop,width:m.width,height:croppedHeight}).resize(width,height).png().toBuffer();
  assert.ok(top+height<=2048,`${kind}/${expression}: canvas would cut lower coverage`);
  const output=`public/art/v100/portraits/${kind}-${expression}-stage-r1.webp`;
  const result=await sharp({create:{width:1536,height:2048,channels:4,background:'#00000000'}})
    .composite([{input:resized,left,top}]).webp({quality:94,alphaQuality:100,effort:6}).toBuffer();
  if(check)assert.deepEqual(await readFile(output),result,output);else await writeFile(output,result);
  records.push({kind,expression,input,inputSha256:hash(bytes),previewAnchor:{crown,chin,center},cropTop,scale,left,top,width,height,output,sha256:hash(result),bytes:result.length});
}
const report={generator:'scripts/build-quality-extended-dialogue.mjs',records,pixelDensity:2,headAnchor:{top:60,height:150,center:384,width:768},logicalBytes:records.reduce((n,r)=>n+r.bytes,0),scope:'Dialogue framing only. Existing R5 source and runtime files preserved; no battle replacement or visual acceptance implied.'};
const reportBytes=Buffer.from(JSON.stringify(report,null,2)+'\n'),reportPath=base+'extended-dialogue-provenance-r1.json';
if(check)assert.deepEqual(await readFile(reportPath),reportBytes);else await writeFile(reportPath,reportBytes);
console.log(JSON.stringify({check,count:records.length,bytes:report.logicalBytes}));
