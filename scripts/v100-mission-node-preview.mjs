import assert from "node:assert/strict";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { chromium, webkit } from "playwright";
import path from "node:path";
const out = path.resolve(process.env.V100_NODE_PREVIEW_DIR ?? "outputs/v100-mission-node-preview");
await mkdir(out, { recursive: false });
const source = (await readFile("app/v100MissionNodes.js", "utf8")).replace(/^export /gmu, "");
const image = `data:image/webp;base64,${(await readFile("public/art/v100/mission-objects/node-states-v1.webp")).toString("base64")}`;
const report = { scope: "Isolated actual renderer with explicit state fixtures; production battle and normal play remain separate", cases: [] };
try {
  for (const [engine, api] of Object.entries({ chromium, webkit })) {
    const browser = await api.launch({ headless: true });
    try {
      const page = await browser.newPage({ viewport: { width: 1000, height: 420 } });
      await page.setContent('<body style="margin:0;background:#353c39;color:white;font:14px sans-serif"><canvas width="1000" height="420"></canvas></body>');
      await page.addScriptTag({ content: source + "\nwindow.nodeApi={drawV100MissionNode,V100_NODE_STATES};" });
      const result = await page.evaluate(async image => {
        const atlas = new Image(); atlas.src = image; await atlas.decode();
        const context = document.querySelector("canvas").getContext("2d");
        const cases = [];
        for (const [row, stageId] of ["stage-t-plan-central-seal", "stage-national-dispersal-network"].entries()) {
          for (const [column, state] of window.nodeApi.V100_NODE_STATES.entries()) {
            const shutdown = row === 1, now = 10;
            const runtime = state === "engaged" ? { powerOperating: true, powerOperationStartedAt: 8 }
              : state === "connection" ? { powerOperating: true, powerOperationStartedAt: now }
                : state === "disconnection" ? { powerInterruptedAt: now }
                  : state === (shutdown ? "off" : "on") ? { powerActivated: 1, powerCompletedAt: [8] } : {};
            const x = 100 + column * 200, y = 135 + row * 190;
            window.nodeApi.drawV100MissionNode(context, { definition: { stageId, missionConfig: { v100StageNumber: row ? 28 : 16 } }, stageMission: runtime, time: now }, { "v100-mission-node-states": atlas }, 0, x, y);
            context.fillStyle = "white"; context.font = "14px sans-serif"; context.textAlign = "center";
            context.fillText(`${row ? "散布装置" : "封鎖装置"} / ${state}`, x, y + 38);
            const pixels = context.getImageData(x - 85, y - 120, 170, 130).data;
            let visible = 0; for (let i = 3; i < pixels.length; i += 4) if (pixels[i] > 128) visible++;
            cases.push({ row, state, visible });
          }
        }
        return cases;
      }, image);
      assert.equal(result.length, 10);
      assert.ok(result.every(item => item.visible > 1800));
      const file = path.join(out, `${engine}-node-states.png`); await page.screenshot({ path: file });
      report.cases.push({ engine, result, file });
    } finally { await browser.close(); }
  }
  report.status = "passed";
} catch (error) { report.status = "failed"; report.error = String(error); process.exitCode = 1; }
finally { await writeFile(path.join(out, "report.json"), JSON.stringify(report, null, 2)); console.log(JSON.stringify({ status: report.status, engines: report.cases.length, error: report.error })); }
