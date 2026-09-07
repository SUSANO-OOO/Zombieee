// Source-bound additions for the 2026-09-07 completion pass. Existing published
// assets and the original 44 V1 derivatives retain their exact transport bytes.
export const V100_STORY_BACKGROUND_ADDITIONS = Object.freeze([
  Object.freeze({ path: "/art/v100/story/kumaya-before-outbreak-v1.webp", bytes: 158796, hash: "sha256-f209eb6b9dfee542e58b2dcd0a9ad32505e49eaff9c9b05d93de8fbe2d7fe9f1" }),
  Object.freeze({ path: "/art/v100/story/kumaya-reopened-v1.webp", bytes: 175738, hash: "sha256-5c388170fb89c3981a262aeaab4715e838d28d3b2cbaf61cc046b2d1d26b8eb8" }),
]);
const addedBytes = V100_STORY_BACKGROUND_ADDITIONS.reduce((sum, asset) => sum + asset.bytes, 0);
export const V100_RELEASE_ASSET_CONTRACT = Object.freeze({
  count: 459 + V100_STORY_BACKGROUND_ADDITIONS.length,
  distinctHashes: 457 + V100_STORY_BACKGROUND_ADDITIONS.length,
  additionsFromV0995: 44 + V100_STORY_BACKGROUND_ADDITIONS.length,
  bytesFromV0995: 14_821_106 + addedBytes,
  storyBytes: addedBytes,
});
