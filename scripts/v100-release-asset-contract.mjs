import { V100_MOTION_ATLAS_REPLACEMENTS, V100_PHONE_REVIEW_ASSET_ADDITIONS, V100_PHONE_REVIEW_ASSET_REMOVALS } from "./v100-phone-review-asset-contract.mjs";
// Source-bound additions for the 2026-09-07 completion pass. Existing published
// assets and the original 44 V1 derivatives retain their exact transport bytes.
export const V100_STORY_BACKGROUND_ADDITIONS = Object.freeze([
  Object.freeze({ path: "/art/v100/story/kumaya-before-outbreak-v1.webp", bytes: 158796, hash: "sha256-f209eb6b9dfee542e58b2dcd0a9ad32505e49eaff9c9b05d93de8fbe2d7fe9f1" }),
  Object.freeze({ path: "/art/v100/story/kumaya-reopened-v1.webp", bytes: 175738, hash: "sha256-5c388170fb89c3981a262aeaab4715e838d28d3b2cbaf61cc046b2d1d26b8eb8" }),
]);
export const V100_MISSION_VEHICLE_ADDITIONS = Object.freeze([
  Object.freeze({path:"/art/v100/mission-objects/sealed-transport-intact-v1.webp",bytes:1157784,hash:"sha256-f1bde18daf10dc41a5c67ba783b198dd4aa7707370d7b9b655de326b75be33af"}),
  Object.freeze({path:"/art/v100/mission-objects/sealed-transport-damaged-v1.webp",bytes:1342174,hash:"sha256-f5dde41efd128d5ac735835ed5fefe26ac449b8b82b01c7a02c4826a1dcd12f5"}),
]);
export const V100_MISSION_BACKGROUND_ADDITIONS = Object.freeze([
  Object.freeze({path:"/art/v100/stages/s26-bay-evacuation-yard-clean-v1.webp",bytes:294056,hash:"sha256-595837341ec8d20229441d7e775ec2c3ed0f600759e1803fb0e23bf7443f9964"}),
]);
export const V100_RESEARCH_CORE_ADDITIONS = Object.freeze([
  Object.freeze({path:"/art/v100/mission-objects/research-core-targets-v1.webp",bytes:1362558,hash:"sha256-fce826389e3a8a65d82ca0fb82033addfda2a3ff120fa193ca74a5f05115855c"}),
  Object.freeze({path:"/art/v100/stages/s29-underground-research-core-v1.webp",bytes:226744,hash:"sha256-575ef05c2dc0a37f553422b1d3badb88133535dfd0b31e39b1532f8e920ef4a8"}),
]);
export const V100_MISSION_NODE_ADDITIONS = Object.freeze([
  Object.freeze({path:"/art/v100/stages/s09-hospital-mechanical-room-v1.webp",bytes:298998,hash:"sha256-1307a7aa6fdb7a0022b04bad8414dd91ec8a07d2e0eb409e2484d248ed45697d"}),
  Object.freeze({path:"/art/v100/mission-objects/node-states-v1.webp",bytes:1126436,hash:"sha256-1a9b66050dbfefe685e02de8a0d80d18ae28bf28a5766780613283aa55520ffc"}),
  Object.freeze({path:"/art/v100/stages/s16-central-seal-clean-v1.webp",bytes:278536,hash:"sha256-7fed3511f9b3401993d5917a9c241c9733c594c3dcc70898c9e2b62f3e081985"}),
]);
export const V100_FUTAGO_BODY_ADDITIONS = Object.freeze([
  Object.freeze({path:"/art/v100/bosses/futago-separated-a-battle-v1.webp",bytes:811268,hash:"sha256-9150a4c69f4c62cf5f9ae929db6b733abaf66e10f67a2169e2b7657daf060368"}),
  Object.freeze({path:"/art/v100/bosses/futago-separated-b-battle-v1.webp",bytes:968436,hash:"sha256-800b062ce9b8225d45fd82fba6e5310d8131b5ebc30fd1f53761d9bba02ed609"}),
]);
export const V100_CLINICAL_CONTROL_ADDITIONS = Object.freeze([
  Object.freeze({path:"/art/v100/stages/s22-clinical-clean-v1.webp",bytes:384054,hash:"sha256-680b4f146b7d81d4514eb19b54752facee9e2f9a163c5a923de994a23934432a"}),
  Object.freeze({path:"/art/v100/mission-objects/clinical-control-states-v1.webp",bytes:674210,hash:"sha256-cdb6661eb9d35fe07ef2d9dceaadce27f4a4bddb86dd5b732ef427c75326731b"}),
]);
export const V100_CORPORATE_MISSION_ADDITIONS = Object.freeze([
  Object.freeze({path:"/art/v100/mission-objects/lure-control-states-v1.webp",bytes:845958,hash:"sha256-1dd1c3b5f11cd21ff73e83ee81debfd3a99b89fa85a2f7d7cf515599b655ca88"}),
  Object.freeze({path:"/art/v100/stages/s23-armory-clean-v1.webp",bytes:474222,hash:"sha256-80bc6ed00bd20bc75db9bdea507623764b0a3a932ae79440f407e5616fcd64c0"}),
  Object.freeze({path:"/art/v100/stages/s25-executive-lab-clean-v1.webp",bytes:455144,hash:"sha256-a42f401eeac2263d7b6d162beb9e1152b37f8ba30121cb40b57871126bde377f"}),
  Object.freeze({path:"/art/v100/stages/s27-private-lab-clean-v1.webp",bytes:369420,hash:"sha256-a445f68f30e2ab369b95bec006d01398e3973c3fba6230c892667f7e2df4a12f"}),
  Object.freeze({path:"/art/v100/mission-objects/corporate-control-states-v1.webp",bytes:1484110,hash:"sha256-ab80d308c2cf4b741d3af07d91142ca952ff874ab272d9db85f609b6a3fb7025"}),
]);
export const V100_OBJECTIVE_STATE_ADDITIONS = Object.freeze([
  Object.freeze({"path":"/art/v100/mission-objects/transport-states-v1.webp","bytes":1211036,"hash":"sha256-aadf0a5ab67e4733ffbf4197b765269236ec4b733e9f82a893b52023d0ce992f"}),
  Object.freeze({"path":"/art/v100/mission-objects/maintenance-cart-states-v1.webp","bytes":739792,"hash":"sha256-0bbf0611ecd8b928d0fe19785ff9747c64479c3dd26e41a1824d95412d6abd2c"}),
  Object.freeze({"path":"/art/v100/mission-objects/escort-destination-states-v1.webp","bytes":620172,"hash":"sha256-a50b842236356e0f447384f28560f01840d4c3175854c04034b8d0497aaf09d6"}),
  Object.freeze({"path":"/art/v100/mission-objects/infected-stronghold-states-v1.webp","bytes":937562,"hash":"sha256-1d669b996d4d95f4f290a7584d162522c2febdf65f0b08dd910fbb57f23761ed"}),
  Object.freeze({"path":"/art/v100/mission-objects/station-relay-states-v1.webp","bytes":1016762,"hash":"sha256-ac5d07de80bada9a9530cca33e0a85e2362a617f097c41bf60cf721c196ed206"}),
]);
export const V100_DEFENSE_PERIMETER_ADDITIONS = Object.freeze([Object.freeze({"path":"/art/v100/mission-objects/defense-perimeter-states-v1.webp","bytes":508180,"hash":"sha256-3b7a240eeff611e0ee7eb82a5ee2f771c0b8b559aabf28e1d0676c3db9673ec6"})]);
export const V100_ADVANCED_COMBAT_VFX_ADDITIONS = Object.freeze([
  Object.freeze({ path: "/art/v100/combat-vfx/lightblade-six-frames-r1.webp", bytes: 837874, hash: "sha256-ed4a8daaf82d6962caa3c61069033060a406b269e01c1fde30e88b882409a588", criticality: "critical" }),
  Object.freeze({ path: "/art/v100/combat-vfx/countercut-six-frames-r1.webp", bytes: 349086, hash: "sha256-80f7b6ee1453ee292ea52033db63ea40334ac3a58d7b98e09ca9c567c9c1304a", criticality: "critical" }),
  Object.freeze({ path: "/art/v100/combat-vfx/fire-whisky-projectile-r1.webp", bytes: 8646, hash: "sha256-79239e88afe4e1873c09958ad252ff5e8e5ac5ca3252996a5fa6160c76a5f296", criticality: "critical" }),
  Object.freeze({ path: "/art/v100/combat-vfx/grenade-projectile-r1.webp", bytes: 11680, hash: "sha256-7b79a10a19f5379627ee40fb9de905e2577127dca79f9c853446d2363edd2119", criticality: "critical" }),
  Object.freeze({ path: "/art/v100/combat-vfx/ground-fire-smoke-r1.webp", bytes: 62034, hash: "sha256-48137f3e70be5a1df0286cf88099af4761313416f56b96d4ea062530daa135be", criticality: "critical" }),
]);
const removedCandidatePaths = new Set(V100_PHONE_REVIEW_ASSET_REMOVALS.map(asset=>asset.path));
const replacedMotionPaths = new Set(V100_MOTION_ATLAS_REPLACEMENTS.map(asset=>asset.newPath));
export const V100_COMPLETION_ASSET_ADDITIONS = Object.freeze([...V100_STORY_BACKGROUND_ADDITIONS,...V100_MISSION_VEHICLE_ADDITIONS,...V100_MISSION_BACKGROUND_ADDITIONS,...V100_RESEARCH_CORE_ADDITIONS,...V100_MISSION_NODE_ADDITIONS,...V100_FUTAGO_BODY_ADDITIONS,...V100_CLINICAL_CONTROL_ADDITIONS,...V100_CORPORATE_MISSION_ADDITIONS,...V100_OBJECTIVE_STATE_ADDITIONS,...V100_DEFENSE_PERIMETER_ADDITIONS,...V100_ADVANCED_COMBAT_VFX_ADDITIONS].filter(asset=>!removedCandidatePaths.has(asset.path)).concat(V100_PHONE_REVIEW_ASSET_ADDITIONS.filter(asset=>!replacedMotionPaths.has(asset.path))));
const addedBytes = V100_COMPLETION_ASSET_ADDITIONS.reduce((sum, asset) => sum + asset.bytes, 0);
// The 28 foley/UI/ambience/score MP3s have distinct content hashes but share
// one physical transport. Pin this separately from logical asset coverage.
const bundledAudioAdditionsFromV0995 = 28;
export const V100_RELEASE_ASSET_CONTRACT = Object.freeze({
  count: 459 + V100_COMPLETION_ASSET_ADDITIONS.length,
  distinctHashes: 457 + V100_COMPLETION_ASSET_ADDITIONS.length,
  additionsFromV0995: 44 + V100_COMPLETION_ASSET_ADDITIONS.length,
  bundledAudioAdditionsFromV0995,
  audioBundlePath: "/pwa-bundles/audio-v1.bin",
  networkSourcesFromV0995: 44 + V100_COMPLETION_ASSET_ADDITIONS.length - bundledAudioAdditionsFromV0995 + 1,
  artAdditionsFromV0995: 44 + V100_COMPLETION_ASSET_ADDITIONS.filter(asset=>asset.path.startsWith("/art/v100/")).length,
  // Measured against the frozen 0.9.9.5 manifest: 111 new logical paths,
  // including the six v2 motion paths and repaired Takuya atlas transported
  // through optimized WebP. The published Takuya gutter remains retained.
  bytesFromV0995: 49_624_054,
  storyBytes: V100_STORY_BACKGROUND_ADDITIONS.reduce((sum,asset)=>sum+asset.bytes,0),
  completionBytes: addedBytes,
  motionAtlasReplacements: V100_MOTION_ATLAS_REPLACEMENTS,
  candidateTotalBytes: 139_365_619,
  candidateDistinctHashBytes: 138_825_716,
  updateFromV0982Bytes: 66_314_502,
  updateFromV0993Bytes: 55_939_808,
});
