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
export const V100_COMPLETION_ASSET_ADDITIONS = Object.freeze([...V100_STORY_BACKGROUND_ADDITIONS,...V100_MISSION_VEHICLE_ADDITIONS,...V100_MISSION_BACKGROUND_ADDITIONS]);
const addedBytes = V100_COMPLETION_ASSET_ADDITIONS.reduce((sum, asset) => sum + asset.bytes, 0);
export const V100_RELEASE_ASSET_CONTRACT = Object.freeze({
  count: 459 + V100_COMPLETION_ASSET_ADDITIONS.length,
  distinctHashes: 457 + V100_COMPLETION_ASSET_ADDITIONS.length,
  additionsFromV0995: 44 + V100_COMPLETION_ASSET_ADDITIONS.length,
  bytesFromV0995: 14_821_106 + addedBytes,
  storyBytes: V100_STORY_BACKGROUND_ADDITIONS.reduce((sum,asset)=>sum+asset.bytes,0),
  completionBytes: addedBytes,
});
