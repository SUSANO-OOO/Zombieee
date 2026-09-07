// A product-free precondition for persistent PWA verification. Never replaces
// CacheStorage, changes the browser backend or writes into a player profile.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { chromium, webkit } from "playwright";

const engine = process.env.NATIVE_PWA_PROBE_ENGINE ?? "webkit";
const type = { chromium, webkit }[engine];
assert.ok(type, `Unknown browser ${engine}`);
const output = path.resolve(process.env.NATIVE_PWA_PROBE_OUTPUT ?? "outputs/v100-native-pwa/storage-probe.json");
await mkdir(path.dirname(output), { recursive: true });
const worker = `self.addEventListener('install',e=>e.waitUntil(self.skipWaiting()));
self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));
self.addEventListener('message',e=>e.waitUntil((async()=>{try{
const c=await caches.open('native-probe');const r=await c.match('/page-write');
await c.put('/worker-write',new Response('worker-value'));
e.ports[0].postMessage({pageValue:r?await r.text():null,keys:(await c.keys()).map(r=>r.url)});
}catch(error){e.ports[0].postMessage({error:String(error)});}})()));`;
const server = createServer((request, response) => {
  response.writeHead(200, { "content-type":request.url === "/sw.js" ? "application/javascript" : "text/html", "cache-control":"no-store" });
  response.end(request.url === "/sw.js" ? worker : "<!doctype html><title>Native persistent storage probe</title>");
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const report = { engine, platform:process.platform, origin, scope:"Native page / service worker CacheStorage sharing and browser-process persistence; no product code", cases:[] };
const options = { headless:true, viewport:{width:844,height:390}, deviceScaleFactor:3, hasTouch:true, timeout:30_000 };
let context;
try {
  // The non-persistent context is a control only; it cannot satisfy relaunch.
  for (const persistent of [true, false]) {
    const item = { persistent }; report.cases.push(item);
    const profile = persistent ? await mkdtemp(path.join(os.tmpdir(), "v100-native-storage-")) : null;
    let browser;
    try {
      if (persistent) context = await type.launchPersistentContext(profile, options);
      else { browser = await type.launch({headless:true,timeout:30_000}); context = await browser.newContext(options); }
      const page = await context.newPage(); await page.goto(origin, {timeout:30_000});
      item.storage = await page.evaluate(async () => {
        await navigator.serviceWorker.register("/sw.js"); await navigator.serviceWorker.ready;
        if (!navigator.serviceWorker.controller) await new Promise((resolve,reject) => {
          const timer=setTimeout(()=>reject(Error("Service worker controller unavailable")),10_000);
          navigator.serviceWorker.addEventListener("controllerchange",()=>{clearTimeout(timer);resolve();},{once:true});
        });
        const cache=await caches.open("native-probe"); await cache.put("/page-write",new Response("page-value"));
        const own=await cache.match("/page-write");
        const fromWorker=await new Promise((resolve,reject)=>{
          const channel=new MessageChannel(),timer=setTimeout(()=>reject(Error("Worker storage response unavailable")),10_000);
          channel.port1.onmessage=event=>{clearTimeout(timer);resolve(event.data);};
          navigator.serviceWorker.controller.postMessage({},[channel.port2]);
        });
        const other=await cache.match("/worker-write");
        return {pageValue:own?await own.text():null,fromWorker,workerValue:other?await other.text():null,keys:(await cache.keys()).map(r=>r.url)};
      });
      await context.close(); context=null;
      if (persistent) {
        context=await type.launchPersistentContext(profile,options);
        const relaunched=await context.newPage(); await relaunched.goto(origin,{timeout:30_000});
        item.relaunch=await relaunched.evaluate(async()=>{
          const cache=await caches.open("native-probe"),keys=await cache.keys();
          return {keys:keys.map(r=>r.url),values:await Promise.all(keys.map(async r=>(await cache.match(r)).text()))};
        });
      }
      item.passed=item.storage.pageValue==="page-value" && item.storage.fromWorker.pageValue==="page-value"
        && item.storage.workerValue==="worker-value" && item.storage.keys.length===2
        && (!persistent || item.relaunch.values.length===2 && item.relaunch.values.includes("page-value") && item.relaunch.values.includes("worker-value"));
    } catch(error) { item.error=String(error.stack??error); item.passed=false; }
    finally { await context?.close(); context=null; await browser?.close(); }
  }
} finally {
  await context?.close(); await new Promise(resolve=>server.close(resolve));
  await writeFile(output,JSON.stringify(report,null,2)+"\n");
}
console.log(JSON.stringify(report,null,2));
assert.equal(report.cases.find(item=>item.persistent)?.passed,true,"Native persistent CacheStorage is unavailable; PWA acceptance remains blocked before product testing");
