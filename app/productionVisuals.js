import { V075_VISUAL_PROFILES } from "./visualProfiles.js";

export const PRODUCTION_VISUALS = Object.freeze({
  title: "/art/v060/title-key-visual-v1.webp",
  command: "/art/v060/campaign-operations-room-v1.webp",
  guide: V075_VISUAL_PROFILES.ikura.eventPortrait.path,
  stages: Object.freeze({
    "stage-nishijin-shopping-street": "/art/v060/battle-nishijin-shopping-street-v1.webp",
    "stage-sawara-ward-office": "/art/v060/battle-sawara-ward-office-v1.webp",
    "stage-nishijin-defense-line-takuya": "/art/v060/battle-nishijin-defense-line-v1.webp",
    "stage-nishijin-station-gate": "/art/v070/stages/station-gate-background-v1.webp",
    "stage-nishijin-station-platform": "/art/v070/stages/station-platform-background-v1.webp",
    "stage-nishijin-station-tunnel-seal": "/art/v070/stages/station-tunnel-background-v1.webp",
  }),
  eventCuts: Object.freeze({
    "station-gate-rescue-cut": "/art/v070/events/station-gate-rescue-cut-v1.webp",
    "station-platform-escort-cut": "/art/v070/events/station-platform-escort-cut-v1.webp",
    "station-tunnel-containment-cut": "/art/v070/events/station-tunnel-containment-cut-v1.webp",
  }),
});

export const STORY_BACKGROUND_VISUALS = Object.freeze({
  "nishijin-night": PRODUCTION_VISUALS.title,
  "shopping-street": PRODUCTION_VISUALS.stages["stage-nishijin-shopping-street"],
  "ward-office": PRODUCTION_VISUALS.stages["stage-sawara-ward-office"],
  "defense-line": PRODUCTION_VISUALS.stages["stage-nishijin-defense-line-takuya"],
  "station-gate": PRODUCTION_VISUALS.stages["stage-nishijin-station-gate"],
  "station-platform": PRODUCTION_VISUALS.stages["stage-nishijin-station-platform"],
  "station-tunnel": PRODUCTION_VISUALS.stages["stage-nishijin-station-tunnel-seal"],
  "station-gate-rescue-cut": PRODUCTION_VISUALS.eventCuts["station-gate-rescue-cut"],
  "station-platform-escort-cut": PRODUCTION_VISUALS.eventCuts["station-platform-escort-cut"],
  "station-tunnel-containment-cut": PRODUCTION_VISUALS.eventCuts["station-tunnel-containment-cut"],
});

export function stageVisualFor(stageId) {
  return PRODUCTION_VISUALS.stages[stageId] ?? "/battlefield-v4.png";
}
