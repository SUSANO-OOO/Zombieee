import {V177_PAISEN_STORY_REPLACEMENTS, V177_PAISEN_STORY_ASSETS, V177_PAISEN_STORY_EXISTING_REPLACEMENTS, V177_PAISEN_STORY_EXISTING_ASSETS} from './v177-paisen-story-asset-contract.mjs';
import { V177_PAISEN_CREDITS_REPLACEMENTS, V177_PAISEN_CREDITS_ASSETS } from './v177-paisen-credits-asset-contract.mjs';
import { V177_PAISEN_ASSET_ADDITIONS, V177_PAISEN_RETIRED_ASSETS, V177_PAISEN_LEGACY_RETIREMENTS } from './v177-paisen-asset-contract.mjs';
import { V100_R9_ASSET_ADDITIONS } from "./v100-r9-asset-contract.mjs";
import { V100_OPENING_ASSET_ADDITIONS } from "./v100-opening-asset-contract.mjs";
import { V177_SPRITE_REPLACEMENTS } from "./v177-sprite-repair-asset-contract.mjs";
import { V102_ASSET_ADDITIONS } from "./v102-asset-contract.mjs";
import { V177_JOINT_ASSET_ADDITIONS } from "./v177-joint-asset-contract.mjs";
import { V100_RELEASE_ASSET_CONTRACT } from "./v100-release-asset-contract.mjs";
import{applyV104Source,V104_MEDIA_ADDITIONS,V104_AUDIO_RETIREMENTS}from'./v104-combat-asset-contract.mjs';

// These installed releases already include the two bosses and Musashi. Each
// repaired texture must therefore be downloaded in full, alongside R9 and the
// opening score. The earlier no-media 1.0.3 contract cannot cover this update.
const sourceReplacements = Object.freeze([...V177_SPRITE_REPLACEMENTS, ...V177_PAISEN_CREDITS_REPLACEMENTS, ...V177_PAISEN_STORY_EXISTING_REPLACEMENTS]);
const replacements = Object.freeze([...sourceReplacements, ...V177_PAISEN_RETIRED_ASSETS, ...V104_AUDIO_RETIREMENTS].map(asset => asset.path).sort());
const additions = Object.freeze([
  ...V100_R9_ASSET_ADDITIONS,
  ...V100_OPENING_ASSET_ADDITIONS,
  ...V177_SPRITE_REPLACEMENTS.map(asset => asset.next),
  ...V177_JOINT_ASSET_ADDITIONS.map(applyV104Source),
  ...V104_MEDIA_ADDITIONS,
  ...V177_PAISEN_ASSET_ADDITIONS,
  ...V177_PAISEN_CREDITS_ASSETS,
  ...V177_PAISEN_STORY_EXISTING_ASSETS,
]);
function contract(assets, distinct, changed) {
  const bundled = changed.filter(asset => asset.path.startsWith("/audio/")).length;
  return Object.freeze({
    assets, distinct, replaced: replacements,
    sourceReplacements,
    sourceRetirements: Object.freeze([...V177_PAISEN_RETIRED_ASSETS,...V104_AUDIO_RETIREMENTS]),
    changed: Object.freeze(changed), additions: changed.length,
    bytes: changed.reduce((sum, asset) => sum + asset.bytes, 0),
    bundled, network: changed.length - bundled + Number(bundled > 0),
  });
}
export const V177_INSTALLED_ASSET_CONTRACT = Object.freeze({
  "0.9.9.5": Object.freeze({
    assets: 415, distinct: 413,
    replaced: Object.freeze(['/art/v080/characters/cards/kumaverson-formation-card-r2.webp', ...V177_SPRITE_REPLACEMENTS
      .filter(asset => ['/v060/','/v090/','/v090-prototypes/','/v0995/'].some(version=>asset.path.includes(version))).map(asset => asset.path), ...V177_PAISEN_LEGACY_RETIREMENTS.map(asset=>asset.path)].sort()),
    sourceReplacements: Object.freeze(V177_SPRITE_REPLACEMENTS
      .filter(asset => ['/v060/','/v090/','/v090-prototypes/','/v0995/'].some(version=>asset.path.includes(version)))),
    sourceRetirements: V177_PAISEN_LEGACY_RETIREMENTS,
    additions: V100_RELEASE_ASSET_CONTRACT.additionsFromV0995,
    bytes: V100_RELEASE_ASSET_CONTRACT.bytesFromV0995,
    bundled: V100_RELEASE_ASSET_CONTRACT.bundledAudioAdditionsFromV0995,
    network: V100_RELEASE_ASSET_CONTRACT.networkSourcesFromV0995,
  }),
  "1.0.1": contract(680, 678, [...V102_ASSET_ADDITIONS, ...additions]),
  "1.0.2": contract(681, 679, [...additions]),
  "1.0.3": contract(681, 679, [...additions]),
});

// Pin both ends of each approved source repair. Listing a path alone must not
// authorize a different image, size or preferred transport at that path.
export function v177InstalledSourceReplacementsMatch(oldManifest, candidateManifest, version) {
  const expected=V177_INSTALLED_ASSET_CONTRACT[version];
  if(!expected)return false;
  const oldByPath=new Map(oldManifest.assets.map(asset=>[asset.path,asset]));
  const nextByPath=new Map(candidateManifest.assets.map(asset=>[asset.path,asset]));
  const matches=(actual,bound)=>actual?.hash===bound.hash&&actual?.bytes===bound.bytes
    && (!Object.hasOwn(bound,'sourcePath')||actual?.sourcePath===bound.sourcePath);
  return expected.sourceReplacements.every(asset=>matches(oldByPath.get(asset.path),asset.previous)
    &&matches(nextByPath.get(asset.path),asset.next))
    && expected.sourceRetirements.every(asset=>matches(oldByPath.get(asset.path),asset) && !nextByPath.has(asset.path))
    && V177_PAISEN_STORY_REPLACEMENTS.filter(row=>row.path.includes("/story-r9/")).every(row=>!oldByPath.has(row.path))
    && [...V177_PAISEN_ASSET_ADDITIONS, ...V177_PAISEN_CREDITS_ASSETS, ...V177_PAISEN_STORY_ASSETS].every(asset=>matches(nextByPath.get(asset.path),asset));
}
