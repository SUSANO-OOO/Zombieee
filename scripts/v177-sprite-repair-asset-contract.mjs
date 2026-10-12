import { V177_GAIREN_SPRITE_REPLACEMENTS } from './v177-gairen-repair-asset-contract.mjs';
import { V177_ANCHOR_SPRITE_REPLACEMENTS } from './v177-anchor-repair-asset-contract.mjs';
import { V177_MAYO_SPRITE_REPLACEMENTS } from './v177-mayo-repair-asset-contract.mjs';
import { V177_REACTION_SPRITE_REPLACEMENTS } from './v177-reaction-repair-asset-contract.mjs';
import { V177_GROUND_MATTE_SPRITE_REPLACEMENTS } from './v177-ground-matte-repair-asset-contract.mjs';
// Exact source-bound sprite fixes; no other published art changes.
export const V177_SPRITE_REPLACEMENTS = Object.freeze([
  {
    "path": "/art/v100/bosses/mugarian-president-mutated-battle-v2.png",
    "previous": {
      "path": "/art/v100/bosses/mugarian-president-mutated-battle-v2.png",
      "bytes": 2317698,
      "hash": "sha256-eaa46570186d3c382956f1ad915f88e279db7c23d13918c3535fde5063c88586",
      "criticality": "critical"
    },
    "next": {
      "path": "/art/v100/bosses/mugarian-president-mutated-battle-v2.png",
      "sourcePath": "/pwa-optimized/art/v100/bosses/mugarian-president-mutated-battle-v2.webp",
      "bytes": 2308850,
      "hash": "sha256-5dbf4de7a5c32463ca80b4035cde995562660f14011fc78d9f56c3841ebc1274",
      "criticality": "critical"
    },
    "delta": -8848
  },
  {
    "path": "/art/v100/bosses/takuya-omega-battle-v2.png",
    "previous": {
      "path": "/art/v100/bosses/takuya-omega-battle-v2.png",
      "bytes": 2026194,
      "hash": "sha256-69b07efe91c9e97c56bf644dff4c2360ca9b1708239e920280962f01a6b98cd5",
      "criticality": "critical"
    },
    "next": {
      "path": "/art/v100/bosses/takuya-omega-battle-v2.png",
      "sourcePath": "/pwa-optimized/art/v100/bosses/takuya-omega-battle-v2.webp",
      "bytes": 2018816,
      "hash": "sha256-8fa9cb272f06459c460be09f131248e6ce3d9d3db1f3e75c28b1c87264cec534",
      "criticality": "critical"
    },
    "delta": -7378
  },
  {
    "path": "/art/v090/characters/miyamoto-musashi-battle-r1.png",
    "previous": {
      "path": "/art/v090/characters/miyamoto-musashi-battle-r1.png",
      "bytes": 1277560,
      "hash": "sha256-b364a9c87a6641aa30e7cdaf611111ddd058e90a8768a2e92cd306945506a321",
      "criticality": "critical"
    },
    "next": {
      "path": "/art/v090/characters/miyamoto-musashi-battle-r1.png",
      "sourcePath": "/pwa-optimized/art/v090/characters/miyamoto-musashi-battle-r1.webp",
      "bytes": 1325976,
      "hash": "sha256-01b7cc40d256041d99414552f4c922e5d267b72782c59bdf31f0ff658857caea",
      "criticality": "critical"
    },
    "delta": 48416
  },
  ...V177_ANCHOR_SPRITE_REPLACEMENTS,
  ...V177_GAIREN_SPRITE_REPLACEMENTS,
  ...V177_MAYO_SPRITE_REPLACEMENTS,
  ...V177_REACTION_SPRITE_REPLACEMENTS,
  ...V177_GROUND_MATTE_SPRITE_REPLACEMENTS,
]);
export const V177_SPRITE_BYTES_DELTA = V177_SPRITE_REPLACEMENTS.reduce((sum, asset) => sum + asset.delta, 0);
