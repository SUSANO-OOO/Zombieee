import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const sourcePath = process.argv[2];
if (!sourcePath) throw new Error("Usage: node scripts/generate-v100-story-events.mjs <reconstructed-story.md>");

const root = process.cwd();
const source = await readFile(sourcePath, "utf8");
const lines = source.split(/\r?\n/u);
const sourceSha = createHash("sha256").update(Buffer.from(source, "utf8")).digest("hex");

function clean(value) {
  return value
    .replaceAll("\\{{", "{{")
    .replaceAll("\\}}", "}}")
    .replaceAll("{{PLAYER\\_NAME}}", "{{PLAYER_NAME}}")
    .trim();
}

function ownerForSpeaker(speaker) {
  const major = new Map([
    ["パイセン", "unit-paisen"], ["クマバーソン", "unit-kumaverson"], ["ババヤガ", "unit-babayaga"],
    ["いくらちゃん", "guide-ikura"], ["ナオ", "unit-nao"], ["ミズチ", "unit-mizuchi"], ["タタラ", "unit-tatara"],
    ["クレイジーキング", "unit-crazy-king"], ["レイダー", "unit-raider"], ["ガンテツ", "unit-gantetsu"],
    ["モンキー", "unit-monkey"], ["マヨちゃん", "unit-mayo-chan"], ["ザキミヤ", "unit-zakimiya"],
    ["TKY", "unit-tky"], ["Mrs.チハ", "unit-mrs-chiha"], ["宮本武蔵", "unit-miyamoto-musashi"],
    ["セガワ", "segawa"], ["ムガリアン社長", "mugarian-president"], ["ムガリアン社長（人間）", "mugarian-president"],
    ["変異ムガリアン社長", "mugarian-president-mutated"], ["TAKUYA-Ω", "boss-takuya-omega"],
    ["RED PANTHER指揮官", "red-panther-commander"], ["RED PANTHER隊長", "red-panther-commander"],
    ["赤レンズの隊長", "red-panther-commander"], ["赤レンズの隊員", "red-panther-commander"],
  ]);
  if (major.has(speaker)) return { portraitOwner: major.get(speaker), portraitKind: "major" };
  if (/声$|無線|メッセージ|録音|アナウンス|テレビ/gu.test(speaker)) return { portraitOwner: null, portraitKind: "offscreen" };
  if (speaker === "▶ PLAYER" || speaker === "■ SYSTEM" || speaker === "◆ BATTLE") return { portraitOwner: null, portraitKind: "system" };
  return { portraitOwner: "minor-human-shared-event-silhouette", portraitKind: "minor" };
}

function parseNodes(sectionLines, offset) {
  const nodes = [];
  for (let index = 0; index < sectionLines.length; index += 1) {
    const raw = sectionLines[index];
    const sourceLine = offset + index + 1;
    let match = raw.match(/^\*\*(.+?)\*\*[ \t　]*(?:「(.*)」|『(.*)』)\s*$/u);
    if (match) {
      const speaker = clean(match[1]);
      const text = clean(match[2] ?? match[3] ?? "");
      const owner = ownerForSpeaker(speaker);
      nodes.push({ kind: "dialogue", speaker, text, ...owner, sourceLine });
      continue;
    }
    match = raw.match(/^\*\*(.+?)[ \t　]+[「『](.*)[」』]\*\*\s*$/u);
    if (match) {
      const speaker = clean(match[1]);
      const text = clean(match[2]);
      const owner = ownerForSpeaker(speaker);
      nodes.push({ kind: "dialogue", speaker, text, ...owner, sourceLine });
      continue;
    }
    match = raw.match(/^\*\*(▶ PLAYER|■ SYSTEM|◆ BATTLE|◆ BOSS)\*\*[ \t　]*(.*)$/u);
    if (match) {
      const marker = match[1];
      nodes.push({
        kind: marker === "◆ BATTLE" ? "battle-marker" : marker === "◆ BOSS" ? "boss-marker" : marker === "▶ PLAYER" ? "player-action" : "system",
        speaker: marker,
        text: clean(match[2]),
        portraitOwner: null,
        portraitKind: "system",
        sourceLine,
      });
      continue;
    }
    match = raw.match(/^\*(?!\*)(.*)\*\s*$/u);
    if (match && clean(match[1])) {
      nodes.push({ kind: "action", speaker: null, text: clean(match[1]), portraitOwner: null, portraitKind: "stage-direction", sourceLine });
    }
  }
  return nodes;
}

function findHeading(pattern, start = 0) {
  for (let index = start; index < lines.length; index += 1) if (pattern.test(lines[index])) return index;
  return -1;
}

function findNextTopHeading(start) {
  for (let index = start + 1; index < lines.length; index += 1) if (/^# /u.test(lines[index])) return index;
  return lines.length;
}

function findNextStageHeading(start) {
  for (let index = start + 1; index < lines.length; index += 1) if (/^## Stage \d+｜/u.test(lines[index]) || /^# /u.test(lines[index])) return index;
  return lines.length;
}

function sectionNodes(start, end, heading) {
  const headingIndex = findHeading(heading, start);
  if (headingIndex < 0 || headingIndex >= end) return { nodes: [], sourceStart: null, sourceEnd: null };
  let sectionEnd = end;
  for (let index = headingIndex + 1; index < end; index += 1) {
    if (/^### /u.test(lines[index])) {
      sectionEnd = index;
      break;
    }
  }
  return {
    nodes: parseNodes(lines.slice(headingIndex + 1, sectionEnd), headingIndex + 1),
    sourceStart: headingIndex + 1,
    sourceEnd: sectionEnd,
  };
}

function stageEvent(number, sectionStart, sectionEnd) {
  const pre = sectionNodes(sectionStart, sectionEnd, /^### 戦闘前/u);
  const post = sectionNodes(sectionStart, sectionEnd, /^### 戦闘後/u);
  const stage = String(number).padStart(2, "0");
  return [
    [`v100:event:s${stage}:pre`, {
      id: `v100:event:s${stage}:pre`, kind: "stage-pre", stageNumber: number, musicProfile: "locked-stage-profile", nodes: pre.nodes,
      source: { startLine: (pre.sourceStart ?? sectionStart) + 1, endLine: (pre.sourceEnd ?? sectionStart) },
    }],
    [`v100:event:s${stage}:post`, {
      id: `v100:event:s${stage}:post`, kind: "stage-post", stageNumber: number, musicProfile: "locked-stage-profile", nodes: post.nodes,
      source: { startLine: (post.sourceStart ?? sectionStart) + 1, endLine: (post.sourceEnd ?? sectionStart) },
    }],
    [`v100:event:s${stage}:first-clear-post`, {
      id: `v100:event:s${stage}:first-clear-post`, kind: "first-clear-post", stageNumber: number, musicProfile: "locked-stage-profile", nodes: [],
      finalizeOnly: true,
      source: { startLine: (post.sourceStart ?? sectionStart) + 1, endLine: (post.sourceEnd ?? sectionStart) },
    }],
  ];
}

const eventEntries = [];
const prologueStart = findHeading(/^# PROLOGUE/u);
const prologueEnd = findNextTopHeading(prologueStart);
eventEntries.push(["v100:event:prologue", {
  id: "v100:event:prologue", kind: "prologue", stageNumber: null, musicProfile: "FINAL", nodes: parseNodes(lines.slice(prologueStart + 1, prologueEnd), prologueStart + 1),
  source: { startLine: prologueStart + 2, endLine: prologueEnd },
}]);

for (let number = 1; number <= 30; number += 1) {
  const start = findHeading(new RegExp(`^## Stage ${number}｜`, "u"));
  if (start < 0) throw new Error(`Missing Stage ${number} heading`);
  eventEntries.push(...stageEvent(number, start, findNextStageHeading(start)));
}

for (const [id, heading, kind, musicProfile] of [
  ["v100:event:ending", /^# ENDING/u, "ending", "FINAL"],
  ["v100:event:credits", /^## エンドロール/u, "credits", null],
  ["v100:event:epilogue", /^# EPILOGUE/u, "epilogue", "FINAL"],
]) {
  const start = findHeading(heading);
  if (start < 0) throw new Error(`Missing ${id} source heading`);
  const end = id === "v100:event:credits" ? findHeading(/^# EPILOGUE/u, start) : findNextTopHeading(start);
  eventEntries.push([id, {
    id, kind, stageNumber: null, musicProfile, characterVoice: false, nodes: parseNodes(lines.slice(start + 1, end), start + 1),
    source: { startLine: start + 2, endLine: end },
  }]);
}

const output = `// Generated from the canonical v10 story source. Do not hand-edit.\nimport { V100_EVENT_IDS, V100_EVENT_BY_ID, renderV100PlayerName } from "./v100Registry.js";\n\nexport const V100_STORY_SOURCE_SHA256 = "${sourceSha}";\nexport const V100_STORY_SOURCE_LINE_COUNT = ${lines.length};\nexport const V100_STORY_SCRIPT_VERSION = "v10-final-release";\n\nexport const V100_STORY_EVENTS = Object.freeze(${JSON.stringify(Object.fromEntries(eventEntries), null, 2)});\n\nconst missing = V100_EVENT_IDS.filter((eventId) => !V100_STORY_EVENTS[eventId]);\nif (missing.length > 0) throw new Error(\`Missing V1.0.0 story event definitions: \${missing.join(", ")}\`);\n\nexport function v100StoryEventFor(eventId) {\n  return V100_STORY_EVENTS[eventId] ?? null;\n}\n\nexport function v100StoryEventIdsForStage(stageNumber) {\n  const stage = String(Number(stageNumber)).padStart(2, "0");\n  return [\`v100:event:s\${stage}:pre\`, \`v100:event:s\${stage}:post\`, \`v100:event:s\${stage}:first-clear-post\`].filter((eventId) => Boolean(V100_STORY_EVENTS[eventId]));\n}\n\nexport function v100StoryNodeText(node, playerName) {\n  return node?.text == null ? "" : renderV100PlayerName(node.text, playerName);\n}\n\nexport function v100StoryEventView(eventId, playerName) {\n  const event = v100StoryEventFor(eventId);\n  if (!event) return null;\n  return { ...event, nodes: event.nodes.map((node) => ({ ...node, text: v100StoryNodeText(node, playerName) })) };\n}\n\nexport function v100StoryContract() {\n  return Object.freeze({\n    eventIds: V100_EVENT_IDS,\n    eventCount: V100_EVENT_IDS.length,\n    prologueFirst: V100_EVENT_IDS[0],\n    endingSequence: ["v100:event:ending", "v100:event:credits", "v100:event:epilogue"],\n    creditsHasDialogue: V100_STORY_EVENTS["v100:event:credits"].nodes.some((node) => node.kind === "dialogue"),\n    creditsMusic: V100_STORY_EVENTS["v100:event:credits"].musicProfile,\n    sourceSha256: V100_STORY_SOURCE_SHA256,\n  });\n}\n\nvoid V100_EVENT_BY_ID;\n`;
await writeFile(path.join(root, "app", "v100StoryEvents.js"), output, "utf8");
console.log(JSON.stringify({ output: "app/v100StoryEvents.js", sourceSha, lines: lines.length, events: eventEntries.length }));
