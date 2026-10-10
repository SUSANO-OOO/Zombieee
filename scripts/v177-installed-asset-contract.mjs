import { V100_R9_ASSET_ADDITIONS } from "./v100-r9-asset-contract.mjs";
import { V100_OPENING_ASSET_ADDITIONS } from "./v100-opening-asset-contract.mjs";
import { V177_SPRITE_REPLACEMENTS } from "./v177-sprite-repair-asset-contract.mjs";
import { V102_ASSET_ADDITIONS } from "./v102-asset-contract.mjs";
import { V177_JOINT_ASSET_ADDITIONS } from "./v177-joint-asset-contract.mjs";

// These installed releases already include the two bosses and Musashi. Each
// repaired texture must therefore be downloaded in full, alongside R9 and the
// opening score. The earlier no-media 1.0.3 contract cannot cover this update.
const replacements = Object.freeze(V177_SPRITE_REPLACEMENTS.map(asset => asset.path).sort());
const additions = Object.freeze([
  ...V100_R9_ASSET_ADDITIONS,
  ...V100_OPENING_ASSET_ADDITIONS,
  ...V177_SPRITE_REPLACEMENTS.map(asset => asset.next),
  ...V177_JOINT_ASSET_ADDITIONS,
]);
function contract(assets, distinct, changed) {
  const bundled = changed.filter(asset => asset.path.startsWith("/audio/")).length;
  return Object.freeze({
    assets, distinct, replaced: replacements,
    changed: Object.freeze(changed), additions: changed.length,
    bytes: changed.reduce((sum, asset) => sum + asset.bytes, 0),
    bundled, network: changed.length - bundled + Number(bundled > 0),
  });
}
export const V177_INSTALLED_ASSET_CONTRACT = Object.freeze({
  "1.0.1": contract(680, 678, [...V102_ASSET_ADDITIONS, ...additions]),
  "1.0.2": contract(681, 679, [...additions]),
});
