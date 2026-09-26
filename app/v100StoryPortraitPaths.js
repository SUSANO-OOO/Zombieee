import { V100_RUNTIME_ASSET_MANIFEST } from "./v100RuntimeAssetManifest.js";
import {
  EVENT_PORTRAIT_PROFILES,
  V075_VISUAL_PROFILES,
  V080_UNIT_VISUAL_PROFILES,
  V090_UNIT_VISUAL_PROFILES,
} from "./visualProfiles.js";

const STORY_PORTRAIT_PATHS = Object.freeze({
  "unit-hachi": V080_UNIT_VISUAL_PROFILES.scout.eventPortrait.path,
  "unit-paisen": V080_UNIT_VISUAL_PROFILES.brawler.eventPortrait.path,
  "unit-kumaverson": V080_UNIT_VISUAL_PROFILES.kumaverson.eventPortrait.path,
  "unit-babayaga": V080_UNIT_VISUAL_PROFILES.babayaga.eventPortrait.path,
  "unit-nao": V080_UNIT_VISUAL_PROFILES.medic.eventPortrait.path,
  "unit-mizuchi": V080_UNIT_VISUAL_PROFILES.ranger.eventPortrait.path,
  "unit-monkey": V080_UNIT_VISUAL_PROFILES.engineer.eventPortrait.path,
  "unit-crazy-king": V080_UNIT_VISUAL_PROFILES["crazy-king"].eventPortrait.path,
  "unit-raider": V080_UNIT_VISUAL_PROFILES.gunner.eventPortrait.path,
  "unit-tatara": V080_UNIT_VISUAL_PROFILES.brute.eventPortrait.path,
  "unit-gantetsu": V080_UNIT_VISUAL_PROFILES.guardian.eventPortrait.path,
  "unit-zakimiya": V090_UNIT_VISUAL_PROFILES.zakimiya.eventPortrait.path,
  "unit-tky": V090_UNIT_VISUAL_PROFILES.tky.eventPortrait.path,
  "unit-mrs-chiha": V090_UNIT_VISUAL_PROFILES["mrs-chiha"].eventPortrait.path,
  "unit-miyamoto-musashi": V090_UNIT_VISUAL_PROFILES["miyamoto-musashi"].eventPortrait.path,
  "guide-ikura": V075_VISUAL_PROFILES.ikura.eventPortrait.path,
  segawa: V100_RUNTIME_ASSET_MANIFEST.portraits.segawa,
  "mugarian-president": V100_RUNTIME_ASSET_MANIFEST.portraits.mugarianPresident,
  "red-panther-commander": V100_RUNTIME_ASSET_MANIFEST.portraits.redPantherCommander,
  "minor-human-shared-event-silhouette": V100_RUNTIME_ASSET_MANIFEST.portraits.minorHuman,
});

export function v100StoryPortraitPath(owner) {
  return owner ? STORY_PORTRAIT_PATHS[owner] ?? EVENT_PORTRAIT_PROFILES[owner]?.path ?? null : null;
}
