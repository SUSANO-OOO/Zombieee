import assert from "node:assert/strict";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { chromium, webkit } from "playwright";
import { orderedNativePointer } from "./ordered-native-pointer.mjs";

const out = path.resolve(process.env.NATIVE_POINTER_EVIDENCE_DIR ?? "outputs/native-pointer-probe");
await mkdir(path.dirname(out), { recursive: true });
await mkdir(out, { recursive: false });
const report = { host: process.platform, scope: "Isolated native browser input diagnostic, not game acceptance", source: createHash("sha256").update(await readFile("scripts/ordered-native-pointer.mjs")).digest("hex"), cases: [] };
try {
  for (const [engine, api] of Object.entries({ chromium, webkit })) {
    const browser = await api.launch({ headless: true });
    try {
      const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
      await page.setContent('<style>body{margin:0}.rail{position:absolute;left:186px;top:543px;width:731px;overflow:auto;display:flex}button{flex:0 0 141px;height:168px;margin-right:6px}</style><div class="rail">'+Array.from({length:7},(_,i)=>`<button data-slot="${i}">${i}</button>`).join('')+'</div>');
      await page.evaluate(() => {
        window.receipts = [];
        for (const type of ["pointerdown", "pointerup", "click"]) document.addEventListener(type, event => window.receipts.push({ type, trusted: event.isTrusted, slot: event.target.closest("button")?.dataset.slot, x: event.clientX, y: event.clientY }), true);
      });
      for (const mode of ["pipelined-control", "ordered"]) {
        const record = { engine, mode, attempts: [] }; report.cases.push(record);
        for (let index = 0; index < 40; index++) {
          const slot = String(index % 7);
          const point = await page.evaluate(slot => {
            const el = document.querySelector(`button[data-slot="${slot}"]`);
            el.scrollIntoView({ block: "nearest", inline: "center", behavior: "instant" });
            window.receipts = [];
            const r = el.getBoundingClientRect(); return { x: r.x+r.width/2, y: r.y+r.height/2 };
          }, slot);
          const phases = [], attempt = { slot, point, phases }; record.attempts.push(attempt);
          let timer;
          try {
            await Promise.race([
              mode === "ordered" ? orderedNativePointer(page, point, phases) : page.mouse.click(point.x, point.y),
              new Promise((_,reject) => { timer=setTimeout(()=>reject(new Error("Native input exceeded unchanged 2000ms dispatch bound")),2000); }),
            ]);
          } finally { clearTimeout(timer); }
          attempt.receipts = await page.evaluate(() => window.receipts);
          attempt.passed = JSON.stringify(attempt.receipts.map(r=>r.type)) === JSON.stringify(["pointerdown","pointerup","click"])
            && attempt.receipts.every(r=>r.trusted && r.slot===slot);
          if(mode === "ordered") assert.ok(attempt.passed,JSON.stringify(attempt));
        }
        record.passed = record.attempts.filter(a=>a.passed).length;
      }
    } finally { await browser.close(); }
  }
  report.status = "passed-ordered-input";
} catch(error) { report.status="failed";report.error=String(error);process.exitCode=1; }
finally { await writeFile(path.join(out,"report.json"),JSON.stringify(report,null,2));console.log(JSON.stringify({status:report.status,cases:report.cases.map(c=>({engine:c.engine,mode:c.mode,passed:c.passed})),error:report.error})); }
