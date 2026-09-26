import {chromium} from 'playwright';
import {readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const {token}=JSON.parse(await readFile('outputs/completion/audio-review-access.json'));
const origin='http://192.168.1.16:64362';
const access=await fetch(origin+'/access/'+token,{redirect:'manual'});
const cookie=access.headers.get('set-cookie')?.split(';')[0];assert.ok(cookie);
for(const extension of ['mp4','webm']){
 const response=await fetch(origin+'/contact-native.'+extension,{headers:{cookie,range:'bytes=0-255'}});
 assert.equal(response.status,206);assert.equal((await response.arrayBuffer()).byteLength,256);
}
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage({viewport:{width:844,height:390},hasTouch:true,isMobile:true});
 const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.goto(origin+'/access/'+token+'#contact-review');
 const video=page.locator('#contact-review video');await video.scrollIntoViewIfNeeded();
 await video.evaluate(el=>el.play());
 await page.waitForFunction(()=>document.querySelector('#contact-review video').currentTime>.3);
 const playback=await video.evaluate(v=>({source:v.currentSrc,duration:v.duration,width:v.videoWidth,height:v.videoHeight,time:v.currentTime,paused:v.paused}));
 assert.ok(playback.duration>=15.9&&playback.duration<=16.2);assert.equal(playback.width,844);assert.equal(playback.height,340);
 for(const [name,time] of [['combo',2.4],['ground',10.4]]){
  await video.evaluate(async (el,time)=>{el.pause();el.currentTime=time;await new Promise(resolve=>el.addEventListener('seeked',resolve,{once:true}));},time);
  await page.screenshot({path:'outputs/completion/contact-review-'+name+'.png'});
 }
 await video.evaluate(el=>el.play());
 const audio=page.locator('#scene-music-review audio').first();await audio.evaluate(el=>el.play());
 assert.equal(await video.evaluate(v=>v.paused),true);
 assert.equal(await page.locator('audio,video').evaluateAll(es=>es.filter(e=>!e.paused).length),1);
 await video.evaluate(el=>el.play());await page.waitForTimeout(800);
 assert.equal(await audio.evaluate(v=>v.paused),true);
 await page.screenshot({path:'outputs/completion/contact-review-mobile.png'});
 assert.deepEqual(errors,[]);
 await writeFile('outputs/completion/contact-review-playback.json',JSON.stringify({httpRange:{mp4:206,webm:206},playback,exclusiveMedia:true,errors,scope:'Review video decode/playback only; recording has no audio.'},null,2)+'\n');
 console.log(JSON.stringify({playback,exclusiveMedia:true,errors}));
}finally{await browser.close();}
