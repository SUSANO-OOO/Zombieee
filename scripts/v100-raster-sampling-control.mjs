import {mkdir,writeFile} from 'node:fs/promises';
import {chromium,webkit} from 'playwright';
const origin=process.env.V100_CAMPAIGN_QA_BASE_URL;
const out=process.env.V100_SAMPLING_OUTPUT??'outputs/v100-raster-sampling-control-r1';
await mkdir(out,{recursive:false});
const report={scope:'Browser sampling diagnosis only. No product or source-image changes; not physical Safari evidence.',engines:[]};
for(const [engine,type] of Object.entries({chromium,webkit})){
 const browser=await type.launch({headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1264,height:740}});
  await page.route('**/sampling-control',route=>route.fulfill({contentType:'text/html',body:'<body style="margin:12px;background:#182026;color:white;font:16px sans-serif"><h2>Browser sampling controls</h2><main style="display:grid;grid-template-columns:repeat(4,300px);gap:12px"></main></body>'}));
  await page.goto(new URL('sampling-control',origin).href);
  const result=await page.evaluate(async()=>{
   const source=new Image();source.src='/art/v060/battle-nishijin-shopping-street-v1.webp';await source.decode();
   const modes=['css-auto','css-optimizeQuality','canvas-low','canvas-medium','canvas-high','canvas-nearest','canvas-halves-high','canvas-halves-low','canvas-source-high','canvas-source-low'];
   const records=[];const samples={};
   for(const mode of modes){
    const wrapper=document.createElement('section'),label=document.createElement('p');label.textContent=mode;wrapper.append(label);document.querySelector('main').append(wrapper);
    if(mode.startsWith('css')){const img=source.cloneNode();img.style=`width:300px;height:169px;image-rendering:${mode==='css-auto'?'auto':'optimizeQuality'}`;wrapper.append(img);continue;}
    const canvas=document.createElement('canvas');canvas.width=300;canvas.height=169;wrapper.append(canvas);
    const context=canvas.getContext('2d',{willReadFrequently:true});const quality=mode.endsWith('low')?'low':mode.endsWith('medium')?'medium':'high';
    context.imageSmoothingEnabled=mode!=='canvas-nearest';context.imageSmoothingQuality=quality;
    let input=source,steps=0;
    if(mode.includes('source')){const native=document.createElement('canvas');native.width=source.width;native.height=source.height;native.getContext('2d').drawImage(source,0,0);input=native;}
    if(mode.includes('halves'))while(input.width/2>=300&&input.height/2>=169){
     const half=document.createElement('canvas');half.width=Math.round(input.width/2);half.height=Math.round(input.height/2);
     const c=half.getContext('2d');c.imageSmoothingEnabled=true;c.imageSmoothingQuality=quality;c.drawImage(input,0,0,half.width,half.height);input=half;steps++;
    }
    const start=performance.now();context.drawImage(input,0,0,300,169);const drawMs=performance.now()-start;
    const data=context.getImageData(0,0,300,169).data;samples[mode]=data;
    records.push({mode,quality:context.imageSmoothingQuality,smoothing:context.imageSmoothingEnabled,steps,drawMs});
   }
   for(const record of records){let delta=0,different=0;const sample=samples[record.mode],nearest=samples['canvas-nearest'];for(let i=0;i<sample.length;i+=4){for(let c=0;c<3;c++)delta+=Math.abs(sample[i+c]-nearest[i+c]);if(sample[i]!==nearest[i]||sample[i+1]!==nearest[i+1]||sample[i+2]!==nearest[i+2])different++;}record.meanRgbDeltaFromNearest=delta/(300*169*3);record.pixelsDifferentFromNearest=different;}
   return {source:{width:source.naturalWidth,height:source.naturalHeight},records};
  });
  report.engines.push({engine,...result});await page.screenshot({path:out+'/'+engine+'.png'});
 }finally{await browser.close();}
}
await writeFile(out+'/report.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
