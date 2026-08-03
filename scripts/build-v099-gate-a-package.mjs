import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  PRODUCTION_AUDIO_MANIFEST,
  V099_MANUAL_ABILITY_AUDIO_CONTRACTS,
  V099_SUPPORT_POD_AUDIO_CONTRACT,
} from "../app/productionAudio.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputDir = path.resolve(process.env.V099_GATE_A_OUTPUT_DIR
  ?? path.join(root, "outputs", "v099-gate-a"));
const iconDir = path.resolve(process.env.V099_ICON_CANDIDATE_OUTPUT_DIR
  ?? path.join(root, "outputs", "v099-icon-candidates"));
const pr3EvidenceDir = path.resolve(process.env.V099_PR3_EVIDENCE_DIR
  ?? "C:/Users/okait/Documents/Codex/2026-08-03/zombieee-v099-pr3/outputs/v099-presentation-browser-smoke");
const head = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
const manifestBytes = await readFile(path.join(root, "public", "asset-manifest.json"));
const manifestSha256 = createHash("sha256").update(manifestBytes).digest("hex");

await mkdir(path.join(outputDir, "audio"), { recursive: true });
await mkdir(path.join(outputDir, "icons"), { recursive: true });
await mkdir(path.join(outputDir, "vfx"), { recursive: true });

const assetById = new Map(PRODUCTION_AUDIO_MANIFEST.assets.map((asset) => [asset.id, asset]));
const poolById = new Map(PRODUCTION_AUDIO_MANIFEST.pools.map((pool) => [pool.id, pool]));
const aliasById = new Map(PRODUCTION_AUDIO_MANIFEST.aliases.map((alias) => [alias.id, alias]));

function resolveAsset(cueId, seen = new Set()) {
  if (seen.has(cueId)) throw new Error(`audio cue cycle at ${cueId}`);
  seen.add(cueId);
  if (assetById.has(cueId)) return assetById.get(cueId);
  const pool = poolById.get(cueId);
  if (pool?.assetIds?.length) return resolveAsset(pool.assetIds[0], seen);
  const alias = aliasById.get(cueId);
  if (alias?.targetId) return resolveAsset(alias.targetId, seen);
  throw new Error(`unresolved production cue: ${cueId}`);
}

const copiedAudio = new Map();
async function packageCue(cueId) {
  if (copiedAudio.has(cueId)) return copiedAudio.get(cueId);
  const asset = resolveAsset(cueId);
  const source = asset.sources.find(({ type }) => type === "audio/mpeg") ?? asset.sources[0];
  if (!source?.src?.startsWith("/")) throw new Error(`${cueId}: invalid source`);
  const extension = path.extname(new URL(source.src, "https://candidate.invalid").pathname) || ".bin";
  const destinationName = `${cueId}${extension}`;
  const sourcePath = path.join(root, "public", ...source.src.split("/").filter(Boolean));
  await copyFile(sourcePath, path.join(outputDir, "audio", destinationName));
  const packaged = { cueId, assetId: asset.id, url: `audio/${destinationName}`, type: source.type };
  copiedAudio.set(cueId, packaged);
  return packaged;
}

function sceneBgm(sceneId) {
  const scene = PRODUCTION_AUDIO_MANIFEST.scenes.find(({ id }) => id === sceneId);
  if (!scene?.bgm) throw new Error(`scene ${sceneId} has no BGM`);
  return scene.bgm;
}

const music = {
  normal: await packageCue(sceneBgm("stage3")),
  pressureSurface: await packageCue(sceneBgm("pressure-surface")),
  pressureStation: await packageCue(sceneBgm("pressure-station")),
  boss: await packageCue(sceneBgm("boss")),
};

const abilities = [];
for (const [unitKind, contract] of Object.entries(V099_MANUAL_ABILITY_AUDIO_CONTRACTS)) {
  abilities.push({
    unitKind,
    ready: await packageCue(contract.readyCue),
    root: await packageCue(contract.activationRoot),
    timeline: await Promise.all(Object.entries(contract.timeline).map(async ([semantic, cueId]) => ({
      semantic,
      ...(await packageCue(cueId)),
    }))),
  });
}

const support = [
  { semantic: "PR1 placement confirmation", ...(await packageCue("support-pod-deploy")) },
  { semantic: "PR2 inbound", ...(await packageCue(V099_SUPPORT_POD_AUDIO_CONTRACT.inbound)) },
  { semantic: "PR2 landing impact", ...(await packageCue(V099_SUPPORT_POD_AUDIO_CONTRACT.landing)) },
  { semantic: "PR2 activation", ...(await packageCue(V099_SUPPORT_POD_AUDIO_CONTRACT.activation)) },
  { semantic: "PR2 complete", ...(await packageCue(V099_SUPPORT_POD_AUDIO_CONTRACT.complete)) },
];

const iconReport = JSON.parse(await readFile(path.join(iconDir, "report.json"), "utf8"));
const iconFiles = ["gate-a-icon-contact-sheet.png"];
for (const candidate of iconReport.candidates) {
  iconFiles.push(
    candidate.outputs["1024"].file,
    candidate.outputs["192"].file,
    candidate.outputs["48"].file,
    candidate.outputs.maskable.file,
  );
}
for (const file of iconFiles) await copyFile(path.join(iconDir, file), path.join(outputDir, "icons", file));

const vfxFiles = [
  "chromium-844x390-high-boss-entrance.png",
  "chromium-844x390-high-small.png",
  "chromium-844x390-high-medium.png",
  "chromium-844x390-high-large.png",
  "chromium-844x390-boss-defeat-0.05s.png",
  "chromium-844x390-boss-defeat-0.30s.png",
  "chromium-844x390-boss-defeat-0.90s.png",
  "chromium-844x390-boss-defeat-1.08s.png",
  "chromium-844x390-boss-defeat-1.70s.png",
  "chromium-844x390-drum-impact.png",
  "chromium-844x390-crawler-stored.png",
  "chromium-844x390-crawler-input-firing.png",
  "chromium-844x390-airstrike-input-radio.png",
  "chromium-844x390-airstrike-input-inbound.png",
  "chromium-844x390-airstrike-input-impact.png",
  "chromium-1280x720-terminal-boss-hold.png",
  "chromium-844x390-terminal-boss-hold.png",
  "chromium-844x340-terminal-boss-hold.png",
  "webkit-844x390-terminal-boss-hold.png",
];
for (const file of vfxFiles) await copyFile(path.join(pr3EvidenceDir, file), path.join(outputDir, "vfx", file));

const packageData = {
  version: "0.9.9.0",
  status: "Gate A creative candidate; not a formal release",
  head,
  integrationSourceSha: "3e09b4c09cb1bc67cf1322bd539f5b0bc7e5d060",
  manifestSha256,
  manifestAssets: 410,
  manifestLogicalBytes: 84020677,
  v099PhysicalAudioAssets: 36,
  v099DistinctAudioBytes: 4690238,
  audioBundleSlices: 249,
  audioBundleBytes: 17604607,
  iconCandidates: iconReport.candidates.map(({ id, masterSha256, safeArea, outputs }) => ({ id, masterSha256, safeArea, outputs })),
  audio: { music, abilities, support },
  vfxFiles,
};

const data = JSON.stringify(packageData).replaceAll("<", "\\u003c");
const html = `<!doctype html>
<html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Version 0.9.9.0 Gate A Creative Acceptance Package</title>
<style>
:root{color-scheme:dark;font-family:ui-monospace,Consolas,monospace;background:#080b0a;color:#e8dec8}*{box-sizing:border-box}body{margin:0;background:radial-gradient(circle at 50% 0,#292018 0,#0d1110 38%,#070909 100%);line-height:1.55}main{max-width:1180px;margin:auto;padding:28px 22px 80px}h1,h2,h3{color:#f1c477;line-height:1.2}h1{font-size:clamp(24px,4vw,44px)}h2{margin-top:50px;border-left:7px solid #d76d38;padding-left:14px}.notice{border:1px solid #a64b31;background:#24140f;padding:14px 16px;border-radius:10px}.meta{display:grid;grid-template-columns:max-content 1fr;gap:5px 18px;font-size:13px;word-break:break-all}.panel,.ability{background:#111615;border:1px solid #39413b;border-radius:12px;padding:16px;margin:14px 0}.controls{display:flex;flex-wrap:wrap;gap:9px;margin:12px 0}button{border:1px solid #d58743;background:#2b2119;color:#ffe0a2;padding:10px 13px;border-radius:8px;font:inherit;cursor:pointer}button:hover{background:#453021}button.secondary{border-color:#5eb39e;color:#bff6e8;background:#142622}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:14px}.frame{background:#0e1211;border:1px solid #2b3430;border-radius:10px;padding:10px}.frame img{width:100%;height:auto;display:block;border-radius:6px}.caption{font-size:12px;color:#aab8af;margin-top:6px}.icon-sheet{width:100%;border:1px solid #5e482f;border-radius:10px}.icon-row{display:flex;align-items:end;gap:14px;flex-wrap:wrap}.icon-row img{background:#0b0d0d;border:1px solid #3a433e;border-radius:8px}.icon-hero{width:240px}.icon-192{width:192px}.icon-48{width:48px;image-rendering:auto}.timeline{font-size:12px;color:#a9b7ae}.status{min-height:24px;color:#72d9b6}.sticky{position:sticky;bottom:8px;background:#0d1211e8;border:1px solid #3d4a43;border-radius:10px;padding:8px 12px;backdrop-filter:blur(8px)}
</style></head><body><main>
<h1>Version 0.9.9.0<br>Gate A Creative Acceptance Package</h1>
<p class="notice"><strong>正式公開ではありません。</strong> 音響方向、VFX方向、感染者face icon masterを一度に選ぶための固定candidateです。物理iPhone確認済みとは扱いません。</p>
<dl class="meta"><dt>candidate HEAD</dt><dd><code>${head}</code></dd><dt>integration source</dt><dd><code>${packageData.integrationSourceSha}</code></dd><dt>asset manifest SHA-256</dt><dd><code>${manifestSha256}</code></dd><dt>PWA pack</dt><dd>410 assets / 84,020,677 logical bytes</dd></dl>

<h2>1. Audio</h2>
<div class="panel"><h3>Music transition</h3><p>音量を小さめにして「normal → pressure → boss → boss exit」の順に押してください。ボタン間のfadeはproduction契約（600ms / 250ms / 600ms）です。</p><div class="controls"><button data-scene="normal">Normal surface</button><button data-scene="pressureSurface">Pressure surface</button><button data-scene="pressureStation">Pressure station</button><button data-scene="boss">Boss</button><button data-scene="pressureSurface">Boss exit → current pressure</button></div></div>
<div class="panel"><h3>16 ability contracts</h3><p>各行のSequenceはactivation rootを1件鳴らし、その後に明示timeline subcueを順に鳴らします。readyは別buttonです。</p><div id="abilities"></div></div>
<div class="panel"><h3>Support pod lifecycle</h3><p>placement confirmationはPR1だけ、inbound / landing / activation / completeはPR2が所有します。</p><div class="controls"><button id="support-sequence">Play full lifecycle</button></div><div id="support-list" class="timeline"></div></div>

<h2>2. VFX / CRAWLER / Support</h2>
<h3>Boss entrance and explosion scale</h3><div class="grid" id="vfx-scale"></div>
<h3>Boss defeat continuous keyframes</h3><div class="grid" id="boss-frames"></div>
<h3>Drum, CRAWLER, barrage, airstrike</h3><div class="grid" id="support-frames"></div>
<h3>Viewport / engine evidence</h3><div class="grid" id="viewport-frames"></div>

<h2>3. Infected-face icon candidates</h2>
<p>3候補とも1024px project-original SVG masterから生成。192px、48px、円形maskable previewを同時表示します。承認前の候補はpublic/runtime assetに含まれていません。</p>
<img class="icon-sheet" src="icons/gate-a-icon-contact-sheet.png" alt="3 icon candidates contact sheet">
<div id="icons"></div>

<h2>Gate A reply</h2><p>次の3点を指定してください。</p><ol><li>Audio: approve / correction direction</li><li>VFX: approve / correction direction</li><li>Icon: candidate A / B / C（または差戻し）</li></ol>
<div class="sticky"><button id="stop-all" class="secondary">Stop all audio</button> <span id="status" class="status">音声は最初のbutton操作で開始します。</span></div>
</main><script>
const DATA=${data};
const status=document.querySelector('#status');let musicAudio=null;const active=new Set();
function audioFor(item,{loop=false,volume=.72}={}){const a=new Audio(item.url);a.loop=loop;a.volume=volume;active.add(a);a.addEventListener('ended',()=>active.delete(a),{once:true});return a}
async function playCue(item,volume=.78){const a=audioFor(item,{volume});await a.play();status.textContent='playing: '+item.cueId;return a}
function ramp(audio,from,to,ms){const start=performance.now();audio.volume=from;const tick=(now)=>{const p=Math.min(1,(now-start)/ms);audio.volume=from+(to-from)*p;if(p<1)requestAnimationFrame(tick);else if(to===0){audio.pause();active.delete(audio)}};requestAnimationFrame(tick)}
async function setMusic(key){const next=audioFor(DATA.audio.music[key],{loop:true,volume:0});await next.play();const fade=key==='boss'?250:600;ramp(next,0,.62,fade);if(musicAudio)ramp(musicAudio,musicAudio.volume,0,fade);musicAudio=next;status.textContent='scene: '+key}
document.querySelectorAll('[data-scene]').forEach(b=>b.addEventListener('click',()=>setMusic(b.dataset.scene).catch(error=>{status.textContent='このbrowserでは音声を再生できません: '+error.name})));
const abilityRoot=document.querySelector('#abilities');
for(const a of DATA.audio.abilities){const row=document.createElement('div');row.className='ability';row.innerHTML='<strong>'+a.unitKind+'</strong><div class="timeline">ready '+a.ready.cueId+' / root '+a.root.cueId+' / '+a.timeline.map(x=>x.semantic+': '+x.cueId).join(' / ')+'</div><div class="controls"></div>';const controls=row.querySelector('.controls');const ready=document.createElement('button');ready.className='secondary';ready.textContent='Ready';ready.onclick=()=>playCue(a.ready,.64).catch(error=>{status.textContent='再生不可: '+error.name});controls.append(ready);const root=document.createElement('button');root.textContent='Root only';root.onclick=()=>playCue(a.root).catch(error=>{status.textContent='再生不可: '+error.name});controls.append(root);const sequence=document.createElement('button');sequence.textContent='Sequence';sequence.onclick=async()=>{try{await playCue(a.root);a.timeline.forEach((cue,i)=>setTimeout(()=>playCue(cue).catch(()=>{}),420*(i+1)))}catch(error){status.textContent='再生不可: '+error.name}};controls.append(sequence);abilityRoot.append(row)}
document.querySelector('#support-list').textContent=DATA.audio.support.map(x=>x.semantic+' → '+x.cueId).join(' / ');
document.querySelector('#support-sequence').onclick=()=>DATA.audio.support.forEach((cue,i)=>setTimeout(()=>playCue(cue).catch(()=>{}),[0,420,1250,1660,2360][i]));
function frameGrid(id,items){const root=document.querySelector(id);for(const [file,label] of items){const f=document.createElement('figure');f.className='frame';f.innerHTML='<img loading="lazy" src="vfx/'+file+'" alt="'+label+'"><figcaption class="caption">'+label+'</figcaption>';root.append(f)}}
frameGrid('#vfx-scale',[["chromium-844x390-high-boss-entrance.png","boss entrance"],["chromium-844x390-high-small.png","small explosion"],["chromium-844x390-high-medium.png","medium explosion"],["chromium-844x390-high-large.png","large explosion"]]);
frameGrid('#boss-frames',[["chromium-844x390-boss-defeat-0.05s.png","0.05s stop/stagger"],["chromium-844x390-boss-defeat-0.30s.png","0.30s small chain"],["chromium-844x390-boss-defeat-0.90s.png","0.90s medium"],["chromium-844x390-boss-defeat-1.08s.png","1.08s major"],["chromium-844x390-boss-defeat-1.70s.png","1.70s smoke/residue"]]);
frameGrid('#support-frames',[["chromium-844x390-drum-impact.png","drum arrival impact"],["chromium-844x390-crawler-stored.png","CRAWLER stored roof equipment"],["chromium-844x390-crawler-input-firing.png","production G barrage"],["chromium-844x390-airstrike-input-radio.png","production Q radio"],["chromium-844x390-airstrike-input-inbound.png","aircraft inbound"],["chromium-844x390-airstrike-input-impact.png","airstrike impact"]]);
frameGrid('#viewport-frames',[["chromium-1280x720-terminal-boss-hold.png","Chromium 1280×720"],["chromium-844x390-terminal-boss-hold.png","Chromium 844×390"],["chromium-844x340-terminal-boss-hold.png","Chromium 844×340"],["webkit-844x390-terminal-boss-hold.png","WebKit 844×390 (not physical iPhone)"]]);
const icons=document.querySelector('#icons');for(const c of DATA.iconCandidates){const id=c.id;const row=document.createElement('section');row.className='panel';row.innerHTML='<h3>'+id+'</h3><div class="icon-row"><img class="icon-hero" src="icons/'+c.outputs['1024'].file+'"><img class="icon-192" src="icons/'+c.outputs['192'].file+'"><img class="icon-192" src="icons/'+c.outputs.maskable.file+'"><img class="icon-48" src="icons/'+c.outputs['48'].file+'"></div><p class="caption">master SHA-256 '+c.masterSha256+' / safe radius '+c.safeArea.artworkRadiusPx+' ≤ '+c.safeArea.maskableSafeRadiusPx+'</p>';icons.append(row)}
document.querySelector('#stop-all').onclick=()=>{for(const a of active){a.pause();a.currentTime=0}active.clear();musicAudio=null;status.textContent='all audio stopped'};
</script></body></html>`;

await writeFile(path.join(outputDir, "index.html"), html);
await writeFile(path.join(outputDir, "candidate-report.json"), `${JSON.stringify(packageData, null, 2)}\n`);
console.log(JSON.stringify({ outputDir, ...packageData }, null, 2));
