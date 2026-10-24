import assert from 'node:assert/strict';
// Producer photo identity: pin both ends of every existing credits/R9 URL.
export const V177_PAISEN_CREDITS_REPLACEMENTS = Object.freeze([
  {
    "path": "/art/v100/credits/street-community-r1.webp",
    "previous": {
      "path": "/art/v100/credits/street-community-r1.webp",
      "bytes": 345594,
      "hash": "sha256-7a3614c3515b7e0403d2e4bc81ab83413c12134f969aa6b74b8c7ca6531b1a62"
    },
    "next": {
      "path": "/art/v100/credits/street-community-r1.webp",
      "bytes": 1762610,
      "hash": "sha256-1b336554b7b8baf9d0b3bbff8c1b7786cb7a262fe553b65990d1b3d24c53bc62"
    },
    "delta": 1417016
  },
  {
    "path": "/art/v100/credits/street-shutter-r2.webp",
    "previous": {
      "path": "/art/v100/credits/street-shutter-r2.webp",
      "bytes": 235866,
      "hash": "sha256-6f1a06e9e0273bcb7c42502dd936d64a9b3c7975accf21dbf3383c875aebf4f0"
    },
    "next": {
      "path": "/art/v100/credits/street-shutter-r2.webp",
      "bytes": 1451784,
      "hash": "sha256-3e585b642bdade97a9c6ebd8c3cee47d772d597e69558d14b8325209877ab103"
    },
    "delta": 1215918
  },
  {
    "path": "/art/v100/credits/street-paisen-broom-r1.webp",
    "previous": {
      "path": "/art/v100/credits/street-paisen-broom-r1.webp",
      "bytes": 292750,
      "hash": "sha256-f4fbcfe07a040abebbf7a61deb3e1bf0d5df92ac710125d8151082585e4d4796"
    },
    "next": {
      "path": "/art/v100/credits/street-paisen-broom-r1.webp",
      "bytes": 1710536,
      "hash": "sha256-e5d166760860292ff143c30729cc501d59886c4aa42869d9ef7cc4d43482eb26"
    },
    "delta": 1417786
  },
  {
    "path": "/art/v100/story-r5/cuts/ending-medical-progress.webp",
    "previous": {
      "path": "/art/v100/story-r5/cuts/ending-medical-progress.webp",
      "bytes": 266714,
      "hash": "sha256-28737f0a1326a81c46054807972ed27022dcc3a4311a2ee6f06f0c64cd275689"
    },
    "next": {
      "path": "/art/v100/story-r5/cuts/ending-medical-progress.webp",
      "bytes": 981894,
      "hash": "sha256-e5f0d6cc5d67a3b62fab08b4e5cc176e77532ed4fc4254980796b4ff27884f02"
    },
    "delta": 715180
  },
  {
    "path": "/art/v100/credits/armory-couple-dance-r1.webp",
    "previous": {
      "path": "/art/v100/credits/armory-couple-dance-r1.webp",
      "bytes": 286970,
      "hash": "sha256-b62271385452e9aa13ffac6f11ec75f548001435a5ab218607f83c11a8efa95e"
    },
    "next": {
      "path": "/art/v100/credits/armory-couple-dance-r1.webp",
      "bytes": 1578982,
      "hash": "sha256-ae7b72cc136174d49f64e910eae20ebe0b573133d1d1318ba0c47a4117ec83ef"
    },
    "delta": 1292012
  },
  {
    "path": "/art/v100/credits/defense-paisen-kuma-kiss-r1.webp",
    "previous": {
      "path": "/art/v100/credits/defense-paisen-kuma-kiss-r1.webp",
      "bytes": 227338,
      "hash": "sha256-5812ef67e127d5e3c4891f5f03bcea5112020fcfd5ceaa1903a4dfa7db2a6408"
    },
    "next": {
      "path": "/art/v100/credits/defense-paisen-kuma-kiss-r1.webp",
      "bytes": 1478320,
      "hash": "sha256-d7edb79d335dce91f9c0d57f928190f56c23c3808b97a86660e43149e283c3fd"
    },
    "delta": 1250982
  },
  {
    "path": "/art/v100/story-r5/cuts/epilogue-tky-receipt.webp",
    "previous": {
      "path": "/art/v100/story-r5/cuts/epilogue-tky-receipt.webp",
      "bytes": 321754,
      "hash": "sha256-87fd704b22647591633ada45a8b52e18d8e2792cf7007a57cc7093db13cb90b2"
    },
    "next": {
      "path": "/art/v100/story-r5/cuts/epilogue-tky-receipt.webp",
      "bytes": 1132306,
      "hash": "sha256-888b64289b35a60779de2d3acfe99257512b0f11b0188e6338b3ba1440f26932"
    },
    "delta": 810552
  },
  {
    "path": "/art/v100/story-r5/cuts/epilogue-main-table.webp",
    "previous": {
      "path": "/art/v100/story-r5/cuts/epilogue-main-table.webp",
      "bytes": 361902,
      "hash": "sha256-d3ec6d129f97a07700f4a96e1f315f213ea8ec59eecfbdda1bde98bd5cfdd2b5"
    },
    "next": {
      "path": "/art/v100/story-r5/cuts/epilogue-main-table.webp",
      "bytes": 1190224,
      "hash": "sha256-6d645384d976136a41b559a3cc02b541040cdab03f0aacb7a4a2388330980ba2"
    },
    "delta": 828322
  }
].map(Object.freeze));
export const V177_PAISEN_CREDITS_ASSETS = Object.freeze(V177_PAISEN_CREDITS_REPLACEMENTS.map(row => row.next));
export const V177_PAISEN_CREDITS_UPDATE_BYTES = V177_PAISEN_CREDITS_ASSETS.reduce((sum, asset) => sum + asset.bytes, 0);
export const V177_PAISEN_CREDITS_BYTES_DELTA = V177_PAISEN_CREDITS_REPLACEMENTS.reduce((sum, row) => sum + row.delta, 0);
const byPath = new Map(V177_PAISEN_CREDITS_REPLACEMENTS.map(row => [row.path, row]));
export function applyPaisenCreditsSource(asset) {
  const row = byPath.get(asset.path);
  if (!row) return asset;
  assert.ok([row.previous, row.next].some(bound => asset.hash === bound.hash && asset.bytes === bound.bytes), 'Unapproved source at Paisen credits URL: ' + asset.path);
  return Object.freeze({...asset, ...row.next});
}
