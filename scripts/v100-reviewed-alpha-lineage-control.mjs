import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";

const root = path.resolve(import.meta.dirname, "..");
const browserSource = await fs.readFile(path.join(root, "scripts/v100-reviewed-alpha-browser.mjs"), "utf8");
const match = browserSource.match(/await page\.addInitScript\(\(\{ save, sourcePaths \}\) => \{([\s\S]*?)\n    \}, \{ save, sourcePaths \}\);/u);
assert.ok(match, "could not extract the production addInitScript callback");

class HTMLCanvasElement { constructor(width = 544, height = 512) { this.width = width; this.height = height; } }
class CanvasRenderingContext2D {
  constructor(canvas) { this.canvas = canvas; this.globalAlpha = 1; }
  getTransform() { return { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }; }
  drawImage() {}
}
const production = new HTMLCanvasElement(844, 340);
const stage1 = new HTMLCanvasElement(272, 256);
const stage2 = new HTMLCanvasElement(136, 128);
const stage3 = new HTMLCanvasElement(68, 64);
const source = { src: "/art/v100/enemies/red-panther-smg-battle-v2.png", naturalWidth: 544, naturalHeight: 512 };
const unrelated = { src: "/art/v060/irrelevant.png", naturalWidth: 8, naturalHeight: 8 };
const localStorage = { setItem() {} };
const document = { querySelector(selector) { return selector === ".game-shell canvas" ? production : null; } };
const window = {};
const context = vm.createContext({ window, document, localStorage, CanvasRenderingContext2D, HTMLCanvasElement });
const install = vm.runInContext(`({ save, sourcePaths }) => {${match[1]}\n}`, context);
install({ save: "control-fixture", sourcePaths: { "red-panther-smg": "/art/v100/enemies/red-panther-smg-battle-v2.png" } });
const audit = window.__V100_REVIEWED_ALPHA__;
assert.ok(audit && audit.drawCalls.length === 0 && audit.active === false);
const draw = (target, image, ...args) => new CanvasRenderingContext2D(target).drawImage(image, ...args);

draw(stage1, source, 0, 0, 272, 256);
draw(stage2, stage1, 0, 0, 272, 256, 0, 0, 136, 128);
audit.active = true;
draw(production, stage2, 0, 0, 136, 128, 40, 50, 100, 120);
draw(production, source, 0, 0, 544, 512, 1, 2, 20, 30);
assert.equal(audit.drawCalls.length, 2, "real hook must track derived and direct production draws");
assert.equal(audit.drawCalls[0].kind, "red-panther-smg");
assert.deepEqual([...audit.drawCalls[0].sourceRect], [0, 0, 544, 512]);
assert.deepEqual([...audit.drawCalls[0].destination], [40, 50, 100, 120]);

draw(stage2, unrelated, 0, 0, 8, 8, 0, 0, 136, 128);
draw(production, stage2, 0, 0, 136, 128, 0, 0, 136, 128);
assert.equal(audit.drawCalls.length, 2, "real hook must reject stale lineage after unrelated redraw");
draw(stage3, production, 0, 0, 136, 128, 0, 0, 68, 64);
draw(production, stage3, 0, 0, 68, 64, 0, 0, 68, 64);
assert.equal(audit.drawCalls.length, 2, "real hook must reject production canvas as a lineage source");

const output = process.env.V100_REVIEWED_ALPHA_LINEAGE_REAL_HOOK_OUT ?? "outputs/completion/v100-reviewed-alpha-lineage-real-hook-result.json";
await fs.mkdir(path.dirname(output), { recursive: true });
await fs.writeFile(output, `${JSON.stringify({ passed: true, source: "extracted production addInitScript callback", cases: ["pre-active two-stage lineage", "active direct source", "unrelated redraw rejection", "production-source rejection"], drawCalls: audit.drawCalls }, null, 2)}\n`);
console.log(JSON.stringify({ status: "passed", output }));
