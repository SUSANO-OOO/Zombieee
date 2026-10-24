// Producer three-photo Paisen: opponent-facing body and exact runtime transports.
export const V177_PAISEN_ASSET_ADDITIONS = Object.freeze([
  {
    "path": "/art/v100/portraits/paisen-event-portrait-r2.webp",
    "bytes": 250342,
    "hash": "sha256-64c07142e86944e3764ac4d02de5c1edf3f19f84654672d5356cb7ca7caf7a22",
    "criticality": "optional"
  },
  {
    "path": "/art/v100/portraits/paisen-formation-card-r3.webp",
    "bytes": 160328,
    "hash": "sha256-75a83b82d6c0f6721b3bbcc9a638a276a74a4166179bf15b9839a4ebbb7da573",
    "criticality": "optional"
  },
  {
    "path": "/art/v100/portraits/paisen-warm-r2.webp",
    "bytes": 244534,
    "hash": "sha256-626251dba8c16b6db122684ca449444daba3cf8e230fc3c2af6ad34b43ba74da",
    "criticality": "critical"
  },
  {
    "path": "/art/v100/portraits/paisen-determined-r2.webp",
    "bytes": 249968,
    "hash": "sha256-1835312115771633a9ffd0ff449e8214671dfe49645f88f686a887b1259ec06d",
    "criticality": "critical"
  },
  {
    "path": "/art/v100/portraits/paisen-alarm-r2.webp",
    "bytes": 238130,
    "hash": "sha256-1131c3938ecc9b5315c463b3c8e6f4567a87b8c09ba0fbe97aab23c5c4bf3b20",
    "criticality": "critical"
  },
  {
    "path": "/art/v100/portraits/paisen-grief-r2.webp",
    "bytes": 244180,
    "hash": "sha256-2c9ae38f6e199dca2db145f783255c34d6a3784fc08f5def512d56e4e8e311b4",
    "criticality": "critical"
  },
  {
    "path": "/art/v100/characters/paisen-photo-battle-v177.png",
    "bytes": 437630,
    "hash": "sha256-36a94398689f43f9fbc173da98c2a55bf4c1bfc4f1db9b509f54e774dbd92b06",
    "criticality": "critical",
    "sourcePath": "/pwa-optimized/art/v100/characters/paisen-photo-battle-v177.webp"
  }
].map(Object.freeze));
export const V177_PAISEN_RETIRED_ASSETS = Object.freeze([
  {
    "path": "/art/v060/characters/portraits/brawler-portrait-v2.webp",
    "bytes": 257624,
    "hash": "sha256-9c4ea4d8bc5d2fd2bae10ea5bb455f45127d1d861edf2d3061866eb9c36df010"
  },
  {
    "path": "/art/v080/characters/cards/brawler-formation-card-r2.webp",
    "bytes": 42778,
    "hash": "sha256-aa2f878ab5d83233938b645f1b80bf85e861afda0f0a0731e39d6f7094ece02f"
  },
  {
    "path": "/art/v100/story-r5/portraits/paisen-alarm.webp",
    "bytes": 97078,
    "hash": "sha256-dedd979ab9ac2e3c7d3794aa014a850ad2fb0999c36303fcf139f799312ebe44"
  },
  {
    "path": "/art/v100/story-r5/portraits/paisen-determined.webp",
    "bytes": 93078,
    "hash": "sha256-6bb8e5325d18011ebf2b57f15d855704d430a465eae8ba91ebf53fa5e4ceafb8"
  },
  {
    "path": "/art/v100/story-r5/portraits/paisen-grief.webp",
    "bytes": 98676,
    "hash": "sha256-e3d95dc713336a30da62bd2f1c38b2787e692396abe4f3376e4156753cd645e8"
  },
  {
    "path": "/art/v100/story-r5/portraits/paisen-warm.webp",
    "bytes": 95984,
    "hash": "sha256-aedadf6fb528d77fe9e40a323616327875add224e2ec9073e4cbea9cfdaaf348"
  },
  {
    "path": "/art/v060/characters/legacy/brawler-battle-gutter-v1.png",
    "bytes": 535076,
    "hash": "sha256-fce4fe84289a6cbce8c6da7cd3f90e3602571b65803617b52e4a120909c74050",
    "criticality": "critical",
    "sourcePath": "/pwa-optimized/art/v060/characters/legacy/brawler-battle-gutter-v1.webp"
  }
].map(Object.freeze));
export const V177_PAISEN_LEGACY_RETIREMENTS = Object.freeze(V177_PAISEN_RETIRED_ASSETS.filter(asset => !asset.path.startsWith('/art/v100/')));
export const V177_PAISEN_ASSET_BYTES = V177_PAISEN_ASSET_ADDITIONS.reduce((sum, asset) => sum + asset.bytes, 0);
export const V177_PAISEN_BYTES_DELTA = V177_PAISEN_ASSET_BYTES - V177_PAISEN_RETIRED_ASSETS.reduce((sum, asset) => sum + asset.bytes, 0);
export const V177_PAISEN_UPDATE_BYTES = V177_PAISEN_ASSET_BYTES - V177_PAISEN_RETIRED_ASSETS.filter(asset => asset.path.startsWith('/art/v100/')).reduce((sum, asset) => sum + asset.bytes, 0);
