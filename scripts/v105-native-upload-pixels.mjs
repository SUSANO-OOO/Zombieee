import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {webkit} from 'playwright';
assert.equal(process.platform,'darwin');assert.equal(process.arch,'arm64');assert.equal(process.env.GITHUB_ACTIONS,'true');
const browser=await webkit.launch({headless:true});
try{
 const page=await browser.newPage();
 const result=await page.evaluate(()=>{
  const rows=[];
  for(const [w,h]of [[31,29],[64,63],[96,60],[127,128]])for(const guard of ['none','row','column']){
   const bw=w+(guard==='column'?1:0),bh=h+(guard==='row'?1:0),a=document.createElement('canvas'),b=document.createElement('canvas');
   a.width=b.width=bw;a.height=b.height=bh;
   const ca=a.getContext('2d',{willReadFrequently:true}),cb=b.getContext('2d',{willReadFrequently:true}),data=ca.createImageData(bw,bh);
   for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=(y*bw+x)*4;for(let k=0;k<4;k++)data.data[i+k]=(x*37+y*59+k*83)%256;}
   ca.putImageData(data,0,0,0,0,w,h);cb.putImageData(data,0,0);
   const compare=(left,right)=>{if(left.length!==right.length)throw Error('length');for(let i=0;i<left.length;i++)if(left[i]!==right[i])throw Error('Native RGBA mismatch at '+i);return left.length;};
   let checked=compare(ca.getImageData(0,0,bw,bh).data,cb.getImageData(0,0,bw,bh).data);
   for(const facing of [1,-1])for(const composite of ['source-over','screen']){
    const targets=[a,b].map(source=>{const c=document.createElement('canvas');c.width=c.height=320;const ctx=c.getContext('2d');
     ctx.fillStyle='#514838';ctx.fillRect(0,0,320,320);ctx.globalAlpha=.73;ctx.globalCompositeOperation=composite;
     ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';ctx.filter='brightness(1.1)';
     ctx.setTransform(facing*.83,.03,.02,.91,160.125,90.375);ctx.drawImage(source,0,0,w,h,-w/2,0,w,h);
     return ctx.getImageData(0,0,320,320).data;});checked+=compare(...targets);
   }
   rows.push({w,h,bw,bh,guard,checkedBytes:checked,mismatches:0});
  }
  return {rows,sourceGeneratedRgbaUnchanged:true,clippedFinalBlitUnchanged:true,nativePixelsEqual:true,performanceAccepted:false,gamePlayed:false};
 });
 await mkdir('outputs/v105-native-upload-pixels',{recursive:true});
 await writeFile('outputs/v105-native-upload-pixels/report.json',JSON.stringify({browser:browser.version(),...result},null,2)+'\n');
 console.log(JSON.stringify({cases:result.rows.length,checkedBytes:result.rows.reduce((n,r)=>n+r.checkedBytes,0),nativePixelsEqual:result.nativePixelsEqual}));
}finally{await browser.close();}
