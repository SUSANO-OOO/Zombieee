import {
  PRODUCTION_AUDIO_SCENE_IDS,
  sceneIdForStoryEvent,
} from "./productionAudio.js";
import { V100_STAGE_IDS, V100_STAGES } from "./v100Registry.js";
import { v100StageAudioFor } from "./v100StageRuntime.js";

const EVENT_KIND_LABELS = Object.freeze({
  dialogue: "会話",
  action: "場面描写",
  "player-action": "主人公の行動",
  "battle-marker": "戦闘準備",
  system: "システム",
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

function sceneFor(eventId, phase, stage, category) {
  if (category === "credits") return PRODUCTION_AUDIO_SCENE_IDS.SILENCE_PROLOGUE_TITLE;
  if (category === "prologue") return PRODUCTION_AUDIO_SCENE_IDS.STORY_KUMAYA_DAILY;
  if (category === "ending") return PRODUCTION_AUDIO_SCENE_IDS.STORY_CHAPTER_ENDING;
  if (category === "epilogue") return stage ? sceneIdForStoryEvent(stage.eventIds.post, 0) : PRODUCTION_AUDIO_SCENE_IDS.STORY_CHAPTER_ENDING;
  const stageAudio = stage ? v100StageAudioFor(stage.id, phase === "post" || phase === "first-clear-post" ? "post" : "pre") : null;
  return sceneIdForStoryEvent(eventId, 0) ?? stageAudio?.sceneId ?? PRODUCTION_AUDIO_SCENE_IDS.INTRO;
}

function transitionFor(node, nodeIndex) {
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
  const sceneId = sceneFor(eventId, phase, stage, category);
  return Object.freeze({
    eventId: eventId ?? null,
    phase: phase ?? null,
    stageId: stage?.id ?? (eventId === "v100:event:epilogue" ? V100_STAGE_IDS[29] : null),
    stageNumber: stage?.number ?? null,
    category,
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
