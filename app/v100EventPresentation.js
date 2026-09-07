import {
  PRODUCTION_AUDIO_SCENE_IDS,
  sceneIdForStoryEvent,
} from "./productionAudio.js";
import { V100_STAGE_IDS, V100_STAGES } from "./v100Registry.js";
import { v100StageAudioFor } from "./v100StageRuntime.js";
import { PRODUCTION_VISUALS } from "./productionVisuals.js";
import { V100_RUNTIME_ASSET_MANIFEST } from "./v100RuntimeAssetManifest.js";

const visuals = PRODUCTION_VISUALS.stages;
const cuts = V100_RUNTIME_ASSET_MANIFEST.storyCuts;
export const V100_CREDITS_SCENES = Object.freeze({
  "西新商店街": { backgroundPath: visuals["stage-nishijin-shopping-street"], sceneId: "v100-credits-street" },
  "早良区役所": { backgroundPath: visuals["stage-sawara-ward-office"], sceneId: "v100-credits-room" },
  "西新駅": { backgroundPath: visuals["stage-nishijin-station-platform"], sceneId: "v100-credits-station" },
  "大学病院": { backgroundPath: visuals["stage-hospital-emergency-ward"], sceneId: "v100-credits-medical" },
  "河口防潮門": { backgroundPath: visuals["stage-estuary-floodgate-seal"], sceneId: "v100-credits-wind" },
  "ムガリアン施設": { backgroundPath: visuals["stage-mugarian-logistics-hq"], sceneId: "v100-credits-room" },
  "RED PANTHER装備庫": { backgroundPath: visuals["stage-mugarian-special-operations-armory"], sceneId: "v100-credits-room" },
  "ザキミヤ": { backgroundPath: cuts.kumayaReopened, sceneId: "v100-credits-kumaya" },
  "装甲車両": { backgroundPath: PRODUCTION_VISUALS.command, sceneId: "v100-credits-room" },
  "TAKUYA撃破地点": { backgroundPath: visuals["stage-nishijin-defense-line-takuya-omega"], sceneId: "v100-credits-wind" },
  "くまや": { backgroundPath: cuts.kumayaReopened, sceneId: "v100-credits-kumaya" },
});

function backdropFor(eventId, node) {
  const line = Number(node?.sourceLine) || 0;
  if (node?.kind === "title") return null;
  if (eventId === "v100:event:prologue") return line < 263 ? cuts.kumayaBeforeOutbreak : PRODUCTION_VISUALS.command;
  if (eventId === "v100:event:credits") return V100_CREDITS_SCENES[node?.sceneLabel]?.backgroundPath ?? null;
  if (eventId === "v100:event:epilogue") return cuts.kumayaReopened;
  if (eventId === "v100:event:ending") {
    if (line < 2527) return visuals["stage-nishijin-defense-line-takuya-omega"];
    if (line < 2551) return visuals["stage-hospital-emergency-ward"];
    if (line < 2563) return PRODUCTION_VISUALS.command;
    return cuts.kumayaReopened;
  }
  return null;
}

const EVENT_KIND_LABELS = Object.freeze({
  dialogue: "会話",
  action: "場面描写",
  "player-action": "主人公の行動",
  "battle-marker": "戦闘準備",
  system: "システム",
  montage: "戻った灯り",
  title: "",
});

function eventStage(eventId) {
  const match = /^v100:event:s(\d{2}):/u.exec(String(eventId ?? ""));
  if (!match) return null;
  return V100_STAGES[Number(match[1]) - 1] ?? null;
}

function categoryFor(eventId, phase, stage) {
  if (eventId === "v100:event:prologue") return "prologue";
  if (eventId === "v100:event:ending") return "ending";
  if (eventId === "v100:event:credits") return "credits";
  if (eventId === "v100:event:epilogue") return "epilogue";
  if (stage?.missionType === "boss" && phase === "event") return "boss-reveal";
  if (phase === "post" || phase === "first-clear-post") return "battle-post";
  return "battle-pre";
}

function sceneFor(eventId, phase, stage, category, node) {
  if (node?.kind === "title") return PRODUCTION_AUDIO_SCENE_IDS.SILENCE_PROLOGUE_TITLE;
  if (category === "credits") return V100_CREDITS_SCENES[node?.sceneLabel]?.sceneId ?? PRODUCTION_AUDIO_SCENE_IDS.SILENCE_PROLOGUE_TITLE;
  if (category === "prologue") {
    const line = Number(node?.sourceLine) || 0;
    if (line >= 287) return PRODUCTION_AUDIO_SCENE_IDS.STORY_CRAWLER_SIGNAL;
    if (line >= 263) return PRODUCTION_AUDIO_SCENE_IDS.STORY_CRAWLER_MONTAGE;
    if (line >= 259) return PRODUCTION_AUDIO_SCENE_IDS.SILENCE_PROLOGUE_TITLE;
    if (line >= 207) return PRODUCTION_AUDIO_SCENE_IDS.STORY_KUMAYA_CRISIS;
    return PRODUCTION_AUDIO_SCENE_IDS.STORY_KUMAYA_DAILY;
  }
  if (category === "ending") return PRODUCTION_AUDIO_SCENE_IDS.STORY_CHAPTER_ENDING;
  if (category === "epilogue") return PRODUCTION_AUDIO_SCENE_IDS.STORY_KUMAYA_DAILY;
  const stageAudio = stage ? v100StageAudioFor(stage.id, phase === "post" || phase === "first-clear-post" ? "post" : "pre") : null;
  return sceneIdForStoryEvent(eventId, 0) ?? stageAudio?.sceneId ?? PRODUCTION_AUDIO_SCENE_IDS.INTRO;
}

function transitionFor(node, nodeIndex) {
  if (node?.kind === "title") return "blackout-reveal";
  if (nodeIndex === 0) return "fade-in";
  if (node?.kind === "battle-marker") return "blackout-reveal";
  if (node?.kind === "player-action") return "system-cut";
  if (node?.kind === "action") return "scene-crossfade";
  return "dialogue-cut";
}

function cueFor(node, category) {
  if (category === "credits") return null;
  if (node?.kind === "battle-marker" || node?.kind === "system") return "ui-confirm";
  if (node?.kind === "player-action") return "radio-open";
  return null;
}

/**
 * Derives bounded presentation metadata from the canonical event/node. This
 * is intentionally a view contract: it never changes the event text, order,
 * IDs, rewards, or story flow transitions.
 */
export function v100EventPresentationFor({ eventId, phase, node = null, nodeIndex = 0 } = {}) {
  const stage = eventStage(eventId);
  const category = categoryFor(eventId, phase, stage);
  const portraitSide = node?.portraitKind === "right"
    || (node?.portraitKind !== "left" && ["segawa", "red-panther-commander"].includes(node?.portraitOwner))
    ? "right"
    : "left";
  const sceneId = sceneFor(eventId, phase, stage, category, node);
  return Object.freeze({
    eventId: eventId ?? null,
    phase: phase ?? null,
    stageId: stage?.id ?? (eventId === "v100:event:epilogue" ? V100_STAGE_IDS[29] : null),
    stageNumber: stage?.number ?? null,
    category,
    backgroundPath: backdropFor(eventId, node),
    sceneLabel: node?.sceneLabel ?? null,
    nodeIndex: Math.max(0, Math.floor(Number(nodeIndex) || 0)),
    nodeKind: node?.kind ?? "action",
    nodeLabel: EVENT_KIND_LABELS[node?.kind ?? "action"] ?? "場面",
    portraitOwner: node?.portraitOwner ?? null,
    portraitSide: node?.portraitOwner ? portraitSide : "none",
    portraitMode: node?.portraitOwner ? (node?.portraitKind ?? "major") : "silhouette",
    transition: transitionFor(node, nodeIndex),
    sceneId,
    cueId: cueFor(node, category),
    dialogueDucking: node?.kind === "dialogue",
    audioOwner: "v100-event-runtime",
  });
}

export const V100_EVENT_PRESENTATION_CATEGORIES = Object.freeze([
  "prologue",
  "battle-pre",
  "boss-reveal",
  "battle-post",
  "ending",
  "credits",
  "epilogue",
]);
