import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const assetRoot = path.join(root, "public", "art", "v080", "stages");
const masterRoot = path.join(root, "assets", "source", "v080", "stages");
const outputWidth = 1600;
const outputHeight = 900;

const variants = [
  {
    id: "university-hospital-approach",
    master: "hospital-master.png",
    focus: "centre",
    zoom: 1.03,
    grade: { brightness: 0.91, saturation: 0.82 },
    accent: "#ffb34a",
    layout: "hold",
  },
  {
    id: "hospital-emergency-ward",
    master: "hospital-master.png",
    focus: "west",
    zoom: 1.13,
    grade: { brightness: 0.78, saturation: 0.62 },
    accent: "#e94b55",
    layout: "relay",
  },
  {
    id: "hospital-evacuation-route",
    master: "hospital-master.png",
    focus: "east",
    zoom: 1.09,
    grade: { brightness: 0.88, saturation: 0.74 },
    accent: "#ffca64",
    layout: "route",
  },
  {
    id: "research-access",
    master: "research-master.png",
    focus: "west",
    zoom: 1.12,
    grade: { brightness: 0.92, saturation: 0.82 },
    accent: "#55d9ff",
    layout: "gate",
  },
  {
    id: "research-containment",
    master: "research-master.png",
    focus: "centre",
    zoom: 1.07,
    grade: { brightness: 0.76, saturation: 0.72 },
    accent: "#ff455c",
    layout: "hold",
  },
  {
    id: "research-freight-passage",
    master: "research-master.png",
    focus: "east",
    zoom: 1.14,
    grade: { brightness: 0.84, saturation: 0.58 },
    accent: "#f2c35b",
    layout: "route",
  },
  {
    id: "logistics-relay",
    master: "logistics-master.png",
    focus: "west",
    zoom: 1.11,
    grade: { brightness: 0.78, saturation: 0.72 },
    accent: "#ff3f50",
    layout: "relay",
  },
  {
    id: "evacuation-freight-yard",
    master: "logistics-master.png",
    focus: "east",
    zoom: 1.05,
    grade: { brightness: 0.96, saturation: 0.88 },
    accent: "#ffc462",
    layout: "hold",
  },
  {
    id: "t-plan-outer-core",
    master: "t-plan-master.png",
    focus: "west",
    zoom: 1.13,
    grade: { brightness: 0.76, saturation: 0.68 },
    accent: "#a98bff",
    layout: "gate",
  },
  {
    id: "t-plan-central-seal",
    master: "t-plan-master.png",
    focus: "centre",
    zoom: 1.01,
    grade: { brightness: 0.9, saturation: 0.92 },
    accent: "#ff355d",
    layout: "seal",
  },
];

function overlaySvg({ accent, layout }) {
  const layoutShapes = {
    hold: `
      <path d="M250 695 L350 660 L440 692 M1160 692 L1255 660 L1350 695" class="mark"/>
      <path d="M350 660 L350 625 M1255 660 L1255 625" class="thin"/>`,
    relay: `
      <circle cx="1240" cy="300" r="42" class="glow"/>
      <circle cx="1240" cy="300" r="19" class="core"/>
      <path d="M1240 250 L1240 176 M1192 300 L1134 300 M1288 300 L1346 300" class="thin"/>`,
    route: `
      <path d="M250 688 C520 652 835 704 1340 650" class="route"/>
      <path d="M1290 632 L1340 650 L1298 684" class="route"/>`,
    gate: `
      <path d="M1190 170 L1320 170 L1350 430 L1160 430 Z" class="gate"/>
      <path d="M1208 385 L1302 385" class="thin"/>`,
    seal: `
      <circle cx="425" cy="326" r="18" class="seal-light"/>
      <circle cx="800" cy="294" r="21" class="seal-light"/>
      <circle cx="1175" cy="326" r="18" class="seal-light"/>`,
  };
  return Buffer.from(`
    <svg width="${outputWidth}" height="${outputHeight}" viewBox="0 0 ${outputWidth} ${outputHeight}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="vignette">
          <stop offset="58%" stop-color="#000" stop-opacity="0"/>
          <stop offset="100%" stop-color="#000" stop-opacity=".38"/>
        </radialGradient>
        <filter id="blur"><feGaussianBlur stdDeviation="13"/></filter>
      </defs>
      <style>
        .mark,.thin,.route,.gate{fill:none;stroke:${accent};stroke-linecap:round;stroke-linejoin:round}
        .mark{stroke-width:7;opacity:.46}.thin{stroke-width:4;opacity:.5}.route{stroke-width:8;opacity:.34;stroke-dasharray:24 22}
        .gate{stroke-width:7;opacity:.24}.glow{fill:${accent};opacity:.18;filter:url(#blur)}
        .core{fill:${accent};opacity:.34}.seal-light{fill:${accent};opacity:.16}
      </style>
      <path d="M0 785 L145 756 L240 795 L335 764 L470 818 L0 900 Z" fill="#090b0f" opacity=".78"/>
      <path d="M1600 770 L1460 744 L1375 792 L1270 758 L1140 820 L1600 900 Z" fill="#090b0f" opacity=".78"/>
      <path d="M120 805 L205 775 L285 820 M1320 815 L1410 775 L1500 806" stroke="#69717a" stroke-width="5" opacity=".28" fill="none"/>
      <path d="M360 620 l55 18 44-28 62 21 M930 688 l61-25 55 28 72-18" stroke="#121820" stroke-width="7" opacity=".42" fill="none"/>
      ${layoutShapes[layout]}
      <rect width="${outputWidth}" height="${outputHeight}" fill="url(#vignette)"/>
    </svg>
  `);
}

async function renderVariant(spec) {
  const scaledWidth = Math.round(outputWidth * spec.zoom);
  const scaledHeight = Math.round(outputHeight * spec.zoom);
  await sharp(path.join(masterRoot, spec.master))
    .resize(scaledWidth, scaledHeight, { fit: "cover", position: spec.focus })
    .extract({
      left: Math.max(0, Math.round((scaledWidth - outputWidth) * (
        spec.focus === "west" ? 0 : spec.focus === "east" ? 1 : 0.5
      ))),
      top: Math.max(0, Math.round((scaledHeight - outputHeight) / 2)),
      width: outputWidth,
      height: outputHeight,
    })
    .modulate(spec.grade)
    .composite([{ input: overlaySvg(spec), blend: "over" }])
    .webp({ quality: 86, effort: 5 })
    .toFile(path.join(assetRoot, `${spec.id}-background-v1.webp`));
}

await mkdir(assetRoot, { recursive: true });
for (const spec of variants) await renderVariant(spec);
console.log(`Built ${variants.length} Version 0.8.0 stage variants in ${assetRoot}`);
