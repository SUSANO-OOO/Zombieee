export const PRODUCTION_VISUALS = Object.freeze({
  title: "/art/v060/title-key-visual-v1.webp",
  command: "/art/v060/campaign-operations-room-v1.webp",
  guide: "/art/v060/characters/portraits/guide-portrait-v2.webp",
  stages: Object.freeze({
    "stage-nishijin-shopping-street": "/art/v060/battle-nishijin-shopping-street-v1.webp",
    "stage-sawara-ward-office": "/art/v060/battle-sawara-ward-office-v1.webp",
    "stage-nishijin-defense-line-takuya": "/art/v060/battle-nishijin-defense-line-v1.webp",
  }),
});

export const STORY_BACKGROUND_VISUALS = Object.freeze({
  "nishijin-night": PRODUCTION_VISUALS.title,
  "shopping-street": PRODUCTION_VISUALS.stages["stage-nishijin-shopping-street"],
  "ward-office": PRODUCTION_VISUALS.stages["stage-sawara-ward-office"],
  "defense-line": PRODUCTION_VISUALS.stages["stage-nishijin-defense-line-takuya"],
});

export function stageVisualFor(stageId) {
  return PRODUCTION_VISUALS.stages[stageId] ?? "/battlefield-v4.png";
}
