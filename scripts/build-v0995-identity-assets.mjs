import { createHash } from "node:crypto";
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";

import { V080_CARD_READ_CONTRACTS } from "../app/visualProfiles.js";
import { buildFormationCard, buildIdentityPortrait } from "./v090-identity-derivatives.mjs";

const root = process.cwd();
const outputRoot = path.join(root, "public/art/v0995/characters");
const characterSourceRoot = path.join(root, "assets/source/v090/characters");

const newcomers = Object.freeze([
  Object.freeze({
    kind: "zakimiya",
    source: "zakimiya-identity-master-r1.png",
    sourceHash: "78405e4610f6d8d71c0e094bcf2cf125522ca9b869db2146e39b9e6122ba88d7",
    upperRatio: .8,
    cardRatio: .78,
    accent: "#e2a64b",
    label: "WHISKY",
    motif: `<path d="m340 398 56 56m-22-78 59 59-32 32-59-59z" fill="none" stroke="#e2a64b" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/>`,
  }),
  Object.freeze({
    kind: "tky",
    source: "tky-identity-master-r1.png",
    sourceHash: "6897a7406bcb6fc36b3e376f0f6db8c9240c83641e71e013a6252458531917c8",
    upperRatio: .76,
    cardRatio: .72,
    accent: "#ff42c8",
    label: "LIGHT BLADE",
    motif: `<path d="M343 390 448 285" stroke="#ff42c8" stroke-width="27" stroke-linecap="round" opacity=".72"/><path d="M343 390 448 285" stroke="#fff" stroke-width="9" stroke-linecap="round"/>`,
  }),
  Object.freeze({
    kind: "mrs-chiha",
    source: "mrs-chiha-identity-master-r1.png",
    sourceHash: "5f7b3cb8047804b595d5de57727e34a39fdd7eb6744a2ed859ebd22bb42f3b83",
    upperRatio: .78,
    cardRatio: .76,
    accent: "#cf9f50",
    label: "FULL SALVO",
    motif: `<circle cx="390" cy="374" r="54" fill="none" stroke="#cf9f50" stroke-width="12"/><path d="M390 320v108M336 374h108M351 335l78 78M429 335l-78 78" stroke="#cf9f50" stroke-width="8"/>`,
  }),
  Object.freeze({
    kind: "miyamoto-musashi",
    source: "miyamoto-musashi-identity-master-r1.png",
    sourceHash: "9d2a1ee6e8dd56b5993a1386bcecaa89c219b83cd77a0aaadab080553f6182e9",
    upperRatio: .83,
    cardRatio: .82,
    accent: "#6b90b2",
    label: "NITEN ICHIRYU",
    motif: `<path d="M327 435 459 303M330 306l130 130" stroke="#fff" stroke-width="11" stroke-linecap="round"/><path d="M312 449l31-31M313 292l31 31" stroke="#6b90b2" stroke-width="17" stroke-linecap="round"/>`,
  }),
  Object.freeze({
    kind: "mayo-chan",
    source: "mayo-chan-identity-master-r1.png",
    sourceHash: "dcbe04ca93d758da12e3c073c3b4fb36e5b8854ffcfcfcb6c1357596b589849c",
    upperRatio: .92,
    cardRatio: .9,
    accent: "#e2ba4b",
    label: "FERAL RESCUE",
    motif: `<path d="M335 395c0-35 25-64 56-64s56 29 56 64c0 31-25 51-56 51s-56-20-56-51z" fill="none" stroke="#f4df9a" stroke-width="10"/><circle cx="372" cy="387" r="6" fill="#cb593d"/><circle cx="410" cy="387" r="6" fill="#cb593d"/>`,
  }),
]);

const approvedMonkeyPortrait = path.join(root, "public/art/v070/characters/portraits/engineer-portrait-v1.webp");
const approvedMonkeyPortraitHash = "f0fc8f45f86c395ea604515444df3fbedd541faabbf749a4fbc6e4d70990f3e3";

await Promise.all([
  mkdir(path.join(outputRoot, "portraits"), { recursive: true }),
  mkdir(path.join(outputRoot, "cards"), { recursive: true }),
]);

async function verifyHash(filePath, expected) {
  const digest = createHash("sha256").update(await readFile(filePath)).digest("hex");
  if (digest !== expected) throw new Error(`Unapproved identity input: ${path.relative(root, filePath)}`);
}

for (const character of newcomers) {
  const inputPath = path.join(characterSourceRoot, character.source);
  await verifyHash(inputPath, character.sourceHash);
  await buildIdentityPortrait({
    inputPath,
    outputPath: path.join(outputRoot, `portraits/${character.kind}-event-portrait-r2.webp`),
    upperRatio: character.upperRatio,
  });
  await buildFormationCard({
    inputPath,
    outputPath: path.join(outputRoot, `cards/${character.kind}-formation-card-r2.webp`),
    accent: character.accent,
    roleLabel: character.label,
    motif: character.motif,
    upperRatio: character.cardRatio,
  });
}

await verifyHash(approvedMonkeyPortrait, approvedMonkeyPortraitHash);
await buildFormationCard({
  inputPath: approvedMonkeyPortrait,
  outputPath: path.join(outputRoot, "cards/monkey-formation-card-r3.webp"),
  accent: V080_CARD_READ_CONTRACTS.engineer.accent,
  roleLabel: "TRAP",
  upperRatio: .84,
  motif: `<path d="M330 396h138M354 366l39 30-39 30m76-60-39 30 39 30" fill="none" stroke="#45d6db" stroke-width="11" stroke-linecap="round" stroke-linejoin="round"/><circle cx="342" cy="396" r="13" fill="none" stroke="#fff" stroke-width="8"/><circle cx="456" cy="396" r="13" fill="none" stroke="#fff" stroke-width="8"/>`,
});

console.log(JSON.stringify({
  message: "Built Version 0.9.9.5 identity-preserving transparent UI derivatives.",
  newcomerCount: newcomers.length,
  monkeySource: "V070-CHAR-MONKEY-PORTRAIT@r2",
}, null, 2));
