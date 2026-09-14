import{readFile,writeFile}from'node:fs/promises';
import{chromium,webkit}from'playwright';
import assert from'node:assert/strict';
const access=JSON.parse(await readFile('outputs/completion/audio-review-access.json','utf8'));
const origin='http://192.168.1.16:64362',link=origin+'/access/'+access.token;
const results=[];
for(const [name,browserType]of Object.entries({chromium,webkit})){
 console.log('Checking '+name);
 const browser=await browserType.launch({headless:true});
 try{const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(String(e)));
  assert.equal((await context.request.get(origin+'/combat.mp4')).status(),401);
  await page.goto(link);await page.getByRole('heading',{name:'音の方向性・確認用',exact:true}).waitFor();
  const range=await context.request.get(origin+'/combat.mp4',{headers:{Range:'bytes=0-99'}});assert.equal(range.status(),206);assert.equal((await range.body()).length,100);
  const media=page.locator('video,audio');const samples=[];
  for(let i=0;i<3;i++){
   const element=media.nth(i);await element.scrollIntoViewIfNeeded();await element.tap();
   await element.evaluate(e=>Promise.race([e.play(),new Promise((_,reject)=>setTimeout(()=>reject(new Error('Media play did not start: '+e.currentSrc+' / '+e.readyState)),10000))]));await page.waitForFunction(i=>document.querySelectorAll('video,audio')[i].currentTime>0.6,i,{timeout:15000});
   samples.push(await element.evaluate(e=>({src:new URL(e.currentSrc).pathname,currentTime:e.currentTime,duration:e.duration,readyState:e.readyState,error:e.error?.message??null})));
   await element.evaluate(e=>e.pause());
  }
  await page.screenshot({path:'outputs/v100-audio-review-r2/'+name+'-phone.png'});assert.deepEqual(errors,[]);results.push({name,samples,errors,status:'passed'});await context.close();
 }catch(error){results.push({name,status:'playback-unavailable',error:String(error)});}finally{await browser.close();await writeFile('outputs/v100-audio-review-r2/browser-report.json',JSON.stringify(results,null,2));}
}
await writeFile('outputs/v100-audio-review-r2/browser-report.json',JSON.stringify(results,null,2));console.log(JSON.stringify({link,results}));
