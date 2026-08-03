import { execFileSync } from "node:child_process";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceDir = path.resolve(process.env.V099_ICON_CANDIDATE_V2_OUTPUT_DIR
  ?? path.join(root, "outputs", "v099-icon-candidates-v2"));
const outputDir = path.resolve(process.env.V099_GATE_A_ICON_V2_OUTPUT_DIR
  ?? path.join(root, "outputs", "v099-gate-a-icon-v2"));
const report = JSON.parse(await readFile(path.join(sourceDir, "report.json"), "utf8"));
const head = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
const integrationSourceSha = "3e09b4c09cb1bc67cf1322bd539f5b0bc7e5d060";

if (report.gateA.audio !== "approved" || report.gateA.vfx !== "approved"
  || !["pending", "approved"].includes(report.gateA.iconV2)) {
  throw new Error("Gate A decision state drift");
}
if (report.productionDistributionChanged || report.publicFiles || report.runtimeReferences) {
  throw new Error("icon candidate unexpectedly entered production distribution");
}

await mkdir(path.join(outputDir, "icons"), { recursive: true });
const files = new Set(["gate-a-icon-v2-contact-sheet.png"]);
for (const candidate of report.candidates) {
  for (const output of Object.values(candidate.outputs)) files.add(output.file);
}
for (const file of files) await copyFile(path.join(sourceDir, file), path.join(outputDir, "icons", file));

const packageData = {
  version: report.version,
  status: "Gate A icon-only candidate; not a formal release",
  head,
  integrationSourceSha,
  audio: "approved and fixed",
  vfx: "approved and fixed",
  icon: "v2 Producer decision pending",
  productionIconWiring: false,
  productionDistributionChanged: false,
  candidates: report.candidates,
};
const data = JSON.stringify(packageData).replaceAll("<", "\\u003c");
const html = `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Version 0.9.9.0 Gate A Icon-only Candidate v2</title><style>
:root{color-scheme:dark;font-family:ui-monospace,Consolas,monospace;background:#070908;color:#e7ddca}*{box-sizing:border-box}body{margin:0;background:radial-gradient(circle at 50% 0,#30231b 0,#111614 36%,#070908 100%);line-height:1.55}main{max-width:1240px;margin:auto;padding:24px 18px 70px}h1,h2{color:#efc27f;line-height:1.15}h1{font-size:clamp(25px,5vw,46px)}.notice{border:1px solid #9d5b38;background:#26150f;padding:14px;border-radius:10px}.meta{display:grid;grid-template-columns:max-content 1fr;gap:4px 14px;font-size:13px;word-break:break-all}.sheet{width:100%;border:1px solid #815535;border-radius:12px}.card{margin:28px 0;padding:18px;background:#111615;border:1px solid #3b463f;border-radius:14px}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.preview{margin:0;background:#090c0b;border:1px solid #323b36;border-radius:10px;padding:9px}.preview img{display:block;width:100%;height:auto;border-radius:6px}.row{display:flex;align-items:end;gap:16px;flex-wrap:wrap}.row img{background:#090b0a;border:1px solid #3c463f;border-radius:10px}.master{width:min(100%,430px)}.p192{width:192px}.p48{width:48px}.caption,.details{font-size:12px;color:#aab8af}.swatches{display:flex;gap:8px}.swatch{width:45px;height:24px;border:1px solid #d5c09f;border-radius:5px}@media(max-width:680px){.grid{grid-template-columns:1fr}.meta{grid-template-columns:1fr}.p192{width:144px}}
</style></head><body><main><h1>Version 0.9.9.0<br>Gate A Icon-only Candidate v2</h1>
<p class="notice"><strong>正式公開ではありません。</strong> AudioとVFXはProducer承認済みで固定されています。このページの判定対象はicon A2／B2／C2だけです。production iconへの配線はありません。</p>
<dl class="meta"><dt>candidate HEAD</dt><dd><code>${head}</code></dd><dt>integration source</dt><dd><code>${integrationSourceSha}</code></dd><dt>PR</dt><dd>Draft PR #140</dd></dl>
<h2>Comparison</h2><img class="sheet" src="icons/gate-a-icon-v2-contact-sheet.png" alt="A2 B2 C2 comparison">
<div id="candidates"></div><h2>Producer reply</h2><p>A2／B2／C2の採否、または差戻し方向を指定してください。Audio／VFXの再判定は不要です。</p>
</main><script>const DATA=${data};const root=document.querySelector('#candidates');
for(const c of DATA.candidates){const section=document.createElement('section');section.className='card';const o=c.outputs;section.innerHTML='<h2>'+c.id+' — '+c.direction+'</h2><div class="row"><img class="master" src="icons/'+o['1024'].file+'" alt="'+c.id+' 1024 master"><img class="p192" src="icons/'+o['192'].file+'" alt="'+c.id+' 192"><img class="p192" src="icons/'+o.rounded.file+'" alt="'+c.id+' rounded"><img class="p192" src="icons/'+o.maskable.file+'" alt="'+c.id+' maskable"><img class="p48" src="icons/'+o['48'].file+'" alt="'+c.id+' 48"></div><p class="details">face '+c.faceCoveragePercent+'% / safe radius '+c.safeZone.radiusPx+'px / eye '+c.safeZone.featureDistancesPx.abnormalEye+'px / mouth '+c.safeZone.featureDistancesPx.mouth+'px<br>48px: '+c.majorShapesAt48.join(' / ')+'<br>master SHA-256: '+c.master.sha256+'</p><div class="swatches">'+c.primaryColors.map(x=>'<span class="swatch" style="background:'+x+'" title="'+x+'"></span>').join('')+'</div><div class="grid"><figure class="preview"><img src="icons/'+o.homeLight.file+'"><figcaption class="caption">明るいホーム画面背景</figcaption></figure><figure class="preview"><img src="icons/'+o.homeDark.file+'"><figcaption class="caption">暗いホーム画面背景</figcaption></figure><figure class="preview"><img src="icons/'+o.safeZone.file+'"><figcaption class="caption">maskable safe zone（目・口）</figcaption></figure><figure class="preview"><img src="icons/'+o.faceCoverage.file+'"><figcaption class="caption">face coverage '+c.faceCoveragePercent+'%</figcaption></figure></div>';root.append(section)}
</script></body></html>`;

await writeFile(path.join(outputDir, "index.html"), html);
await writeFile(path.join(outputDir, "candidate-report.json"), `${JSON.stringify(packageData, null, 2)}\n`);
console.log(JSON.stringify({ outputDir, head, integrationSourceSha, candidates: report.candidates.map(({ id, master }) => ({ id, masterSha256: master.sha256 })) }, null, 2));
