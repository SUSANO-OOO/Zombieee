import assert from "node:assert/strict";
import path from "node:path";
import { createServer } from "node:http";
import { createReadStream } from "node:fs";
import { mkdir, writeFile, lstat } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { build } from "esbuild";
import { pwaBrowserType } from "./pwa-browser-runtime.mjs";
import { V100_POST_CREDITS_TITLES } from "../app/v100PostCreditsData.js";

const root = process.cwd();
const selection = process.env.V100_ENDING_LIFECYCLE_ONLY ?? "all";
assert.ok(["all", "motion", "skip"].includes(selection), "Unknown ending lifecycle selection");
const out = path.resolve(process.env.V100_ENDING_LIFECYCLE_OUT ?? "outputs/v100-ending-audio-lifecycle");
await mkdir(out, { recursive: true });
assert.equal(await lstat(path.join(out, "report.json")).then(() => true, () => false), false, "Keep previous evidence");
const entry = path.join(out, "fixture.tsx");
const modulePath = file => JSON.stringify(path.join(root, "app", file).replaceAll("\\", "/"));
await writeFile(entry, `import {useState} from 'react';
import {createRoot} from 'react-dom/client';
import {V100StaffRoll} from ${modulePath("V100EndingRoll.tsx")};
import {V100PostCreditsFilm} from ${modulePath("V100PostCreditsFilm.tsx")};
import {v100StoryEventView} from ${modulePath("v100StoryEvents.js")};
function Fixture(){
 const [view,setView]=useState('ready'),[enabled,setEnabled]=useState(true),[reducedMotion,setReducedMotion]=useState(false),[blocked,setBlocked]=useState(false);
 const settings={bgmEnabled:enabled,bgmVolume:.8,sfxEnabled:enabled,sfxVolume:.9,reducedMotion};
 return <main id='v100-campaign' data-v100-phase={view==='film'?'epilogue':'credits'} style={{height:'100%'}}><nav><button onClick={()=>setView('credits')}>Open credits</button><button onClick={()=>setView('film')}>Open film</button><button onClick={()=>setView('ready')}>Exit player</button><button onClick={()=>setEnabled(!enabled)}>Toggle sound</button><button onClick={()=>setReducedMotion(!reducedMotion)}>Toggle motion</button><button onClick={()=>setBlocked(!blocked)}>Toggle credits menu</button></nav>
 {view==='credits'?<V100StaffRoll nodes={v100StoryEventView('v100:event:credits','').nodes} playerName='' settings={settings} blocked={blocked} onComplete={()=>{setView('film');return true;}}/>:view==='film'?<V100PostCreditsFilm settings={settings} onComplete={()=>{setView('ready');return true;}}/>:<h1>Playback stopped</h1>}</main>;
}
createRoot(document.getElementById('root')).render(<Fixture/>);`);
await build({ entryPoints: [entry], bundle: true, outfile: path.join(out, "fixture.js"), platform: "browser", format: "esm", jsx: "automatic", define: { "process.env.NODE_ENV": '"production"' }, external: ["/fonts/v100/BIZUDPGothic-Regular.woff2", "/fonts/v100/ZenKakuGothicNew-Bold.woff2", "/fonts/v100/Rajdhani-Bold.woff2"] });
await writeFile(path.join(out, "index.html"), '<!doctype html><html lang="en"><head><meta charset="utf-8"><link rel="stylesheet" href="/fixture.css"><style>html,body,#root{height:100%;margin:0;overflow:hidden}nav{position:fixed;z-index:99999;top:0;left:0}button{padding:10px}</style></head><body><div id="root"></div><script type="module" src="/fixture.js"></script></body></html>');
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".webp": "image/webp", ".mp3": "audio/mpeg", ".woff2": "font/woff2" };
const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
    const directory = ["/", "/fixture.js", "/fixture.css"].includes(pathname) ? out : path.join(root, "public");
    const target = path.resolve(directory, pathname === "/" ? "index.html" : pathname.slice(1));
    if (!target.startsWith(directory + path.sep)) { response.writeHead(400).end(); return; }
    const info = await lstat(target).catch(() => null);
    if (!info?.isFile() || info.isSymbolicLink()) { response.writeHead(404).end(); return; }
    response.writeHead(200, { "content-type": types[path.extname(target)] ?? "application/octet-stream", "content-length": info.size });
    createReadStream(target).pipe(response);
  } catch { response.writeHead(500).end(); }
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const report = { status: "failed", selection, head: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8", windowsHide: true }).trim(), blobs: {}, evidenceKind: "Actual React ending components and native media; captured detached elements and delayed play promises. Test output is muted; no speaker acceptance.", cases: [] };
for (const file of ["app/V100EndingRoll.tsx", "app/V100PostCreditsFilm.tsx", "scripts/v100-ending-audio-lifecycle-browser.mjs"]) report.blobs[file] = execFileSync("git", ["hash-object", file], { encoding: "utf8", windowsHide: true }).trim();
const sample = page => page.evaluate(() => window.__endingMedia.map(audio => ({ paused: audio.paused, connected: audio.isConnected, time: audio.currentTime, rate: audio.playbackRate, volume: audio.volume })));
async function checkSkippedTitles(page, result) {
  await page.getByRole("button", { name: "スキップ", exact: true }).click();
  result.titles = [];
  for (const title of ["continuation", "sequel", "thanks"]) {
    await page.waitForFunction(expected => {
      const root = document.querySelector(".v100-post-credits-film");
      return root?.dataset.v100FilmTitle === expected && Number(getComputedStyle(root.querySelector(".v100-post-credit-title")).opacity) > .8;
    }, title, { timeout: 10000 });
    const shown = await page.locator(".v100-post-credits-film").evaluate(root => ({ title: root.dataset.v100FilmTitle, elapsed: Number(root.dataset.v100FilmElapsed), text: root.querySelector(".v100-post-credit-title").textContent }));
    assert.ok(shown.text.includes(V100_POST_CREDITS_TITLES[title]));
    if (title === "sequel") assert.ok(shown.text.includes(V100_POST_CREDITS_TITLES.season));
    result.titles.push(shown);
    if (title === "continuation") {
      await page.getByRole("button", { name: "スキップ", exact: true }).click();
      result.repeatedSkip = await page.locator(".v100-post-credits-film").evaluate(root => ({ title: root.dataset.v100FilmTitle, elapsed: Number(root.dataset.v100FilmElapsed) }));
      assert.equal(result.repeatedSkip.title, "continuation");
      assert.ok(result.repeatedSkip.elapsed >= shown.elapsed, "A second skip must not rewind or bypass the titles");
    }
  }
  await page.getByRole("heading", { name: "Playback stopped", exact: true }).waitFor({ state: "visible", timeout: 10000 });
  result.settled = await sample(page);
  assert.ok(result.settled.every(audio => audio.paused && !audio.connected), "Completing the retained titles stops every detached media element");
}
try {
  for (const engine of ["chromium", "webkit"]) {
    const browser = await (await pwaBrowserType(engine)).launch({ headless: true, ...(engine === "chromium" ? { channel: "msedge", args: ["--mute-audio"] } : {}) });
    try {
      for (const view of (selection === "skip" ? ["film"] : ["credits", "film"])) for (const mode of (selection === "skip" ? ["skip"] : selection === "motion" ? ["reduced-motion"] : ["exit", "delayed-exit", "delayed-pause", "delayed-mute", "delayed-hide", "remount", "delayed-remount", "reduced-motion", ...(view === "film" ? ["laugh-exit", "skip"] : [])])) {
        const result = { engine, browserVersion: browser.version(), view, mode, status: "failed", errors: [] };
        report.cases.push(result);
        const context = await browser.newContext({ viewport: { width: 844, height: 390 } });
        const page = await context.newPage();
        page.on("pageerror", error => result.errors.push(String(error)));
        await context.addInitScript(delayed => {
          window.__endingMedia = []; window.__endingRelease = []; window.__endingHold = delayed;
          const nativePlay = HTMLMediaElement.prototype.play;
          HTMLMediaElement.prototype.play = function () {
            // Suppress test sound at the output only. Native play, clock,
            // volume, pause and promises remain real browser media behavior.
            this.muted = true;
            if (!window.__endingMedia.includes(this)) window.__endingMedia.push(this);
            const pending = nativePlay.call(this);
            return pending.then(() => window.__endingHold ? new Promise(resolve => window.__endingRelease.push(resolve)) : undefined);
          };
        }, mode.startsWith("delayed"));
        try {
          await page.goto(origin, { waitUntil: "networkidle" });
          await page.getByRole("button", { name: view === "credits" ? "Open credits" : "Open film", exact: true }).click();
          await page.waitForFunction(() => window.__endingMedia.some(audio => !audio.paused && audio.currentTime > .1));
          if (mode.startsWith("delayed")) await page.waitForFunction(() => window.__endingRelease.length > 0);
          if (mode === "laugh-exit") await page.waitForFunction(() => document.querySelector("[data-v100-laugh-state='playing']") && window.__endingMedia.length === 3, null, { timeout: 45000 });
          result.before = await sample(page);
          if (mode === "skip") await checkSkippedTitles(page, result);
          else {
          if (mode === "reduced-motion") await page.getByRole("button", { name: "Toggle motion", exact: true }).click();
          else if (mode === "delayed-pause") {
            result.pauseSource = view === "credits" ? "owned parent-menu blocked prop fixture" : "film pause control";
            await page.getByRole("button", { name: view === "credits" ? "Toggle credits menu" : "一時停止", exact: true }).click();
          }
          else if (mode === "delayed-mute") await page.getByRole("button", { name: "Toggle sound", exact: true }).click();
          else if (mode === "delayed-hide") await page.evaluate(() => window.dispatchEvent(new Event("pagehide")));
          else await page.getByRole("button", { name: "Exit player", exact: true }).click();
          result.immediate = await sample(page);
          if (mode.endsWith("remount")) {
            await page.evaluate(() => { window.__endingHold = false; });
            await page.getByRole("button", { name: view === "credits" ? "Open credits" : "Open film", exact: true }).click();
            await page.waitForFunction(() => window.__endingMedia.some(audio => audio.isConnected && !audio.paused && audio.currentTime > .1));
          }
          await page.evaluate(() => { window.__endingHold = false; for (const resolve of window.__endingRelease.splice(0)) resolve(); });
          await page.waitForTimeout(350);
          result.afterRelease = await sample(page);
          await page.waitForTimeout(650);
          result.settled = await sample(page);
          if (mode === "reduced-motion") {
            assert.equal(result.settled.length, result.before.length, "A motion preference must retain the same media elements");
            assert.ok(result.settled.every(audio => audio.connected && !audio.paused), "A motion preference must not stop music or waves");
            result.settled.forEach((audio, index) => assert.ok(audio.time > result.afterRelease[index].time + .4, "Retained native media must keep advancing"));
          } else {
            assert.ok(result.immediate.every(audio => audio.paused), "Leaving, pausing or muting must stop all captured media immediately");
            assert.ok(result.settled.filter(audio => !audio.connected || !mode.endsWith("remount")).every(audio => audio.paused), "An old play promise must not leave audio playing");
            result.settled.forEach((audio, index) => { if (!audio.connected || !mode.endsWith("remount")) assert.ok(Math.abs(audio.time - result.afterRelease[index].time) < .1, "Stopped media clock must stay still"); });
          }
          if (mode.endsWith("remount")) assert.ok(result.settled.some(audio => audio.connected && !audio.paused), "A new player must still be able to play");
          }
          assert.equal(result.errors.length, 0);
          assert.ok(result.settled.every(audio => audio.rate === 1));
          result.status = "passed";
          if (engine === "chromium" && view === "film" && mode === "exit") await page.screenshot({ path: path.join(out, "stopped.png") });
        } catch (error) { result.failure = String(error); }
        finally { await context.close(); }
        console.log(JSON.stringify({ engine, view, mode, status: result.status, failure: result.failure }));
      }
    } finally { await browser.close(); }
  }
  report.status = report.cases.every(result => result.status === "passed") ? "passed" : "failed";
} finally {
  await new Promise(resolve => server.close(resolve));
  await writeFile(path.join(out, "report.json"), JSON.stringify(report, null, 2));
}
assert.equal(report.status, "passed", `${report.cases.filter(result => result.status !== "passed").length}/${report.cases.length} ending audio lifecycle cases failed`);
