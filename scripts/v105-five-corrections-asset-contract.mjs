// Exact reviewed payload delta from immutable e22b134 / v1.0.4. Old media
// remains in Git; it must not be selected as the current runtime fallback.
export const V105_MEDIA_ADDITIONS=Object.freeze([
  {path:'/art/v105/abilities/paisen-fist-wave-ready.svg',bytes:1000,hash:'sha256-a880922b3a8b0c86f439529ee91c6e4002d8a44bea6199a1cfdf5e38f8d14391',criticality:'critical'},
  {path:'/art/v105/joints/crazy-king-skirt-r1.webp',bytes:40584,hash:'sha256-962b29c823dfa65eaf60a56ba26d22c015a943eb142f91e2743a2c76581da031',criticality:'critical'},
  {path:'/art/v105/combat-vfx/fist-wave-r1.webp',bytes:40952,hash:'sha256-2471d4b8a4e15328cde86fc0e06cc0738be2c5d26ceaf3543cf7c3ba77fd7963',criticality:'critical'},
  {path:'/audio/v105/fist-wave-charge.mp3',bytes:5059,hash:'sha256-366f1fd9b6d96129b39423f5f0a95fe500d006cf296ede64758b4a593453d2e0',criticality:'optional'},
  {path:'/audio/v105/fist-wave-impact.mp3',bytes:6731,hash:'sha256-b0cbec28f6966b11997fc2864dc525491bc0cd7d12b0f49ac709c79ca6279334',criticality:'optional'},
  {path:'/audio/v105/fist-wave-launch.mp3',bytes:5895,hash:'sha256-6cdca9ee478ef025006f0b9e4d4404e46d6cf7e6b101f57f6551db8641716bb3',criticality:'optional'},
].map(Object.freeze));
export const V105_MEDIA_RETIREMENTS=Object.freeze([
  {path:'/art/v090/characters/abilities/paisen-kiai-combo-ready-r1.svg',bytes:985,hash:'sha256-58631e79195c6d9d0c88d46ce83f3a9498644953feb256d2a8b73736a42008f2',criticality:'critical'},
  {path:'/art/v100/joints/crazy-king-r1.webp',bytes:39606,hash:'sha256-7310422fc7238d89c8194c40bbafd2f70724a3b979b76be7d4d939f7a773f257',criticality:'critical'},
].map(Object.freeze));
export const V105_NEW_RUNTIME_ASSETS=Object.freeze(V105_MEDIA_ADDITIONS.filter(row=>!row.path.includes('/joints/')));
export const V105_AUDIO_ADDITIONS=Object.freeze(V105_MEDIA_ADDITIONS.filter(row=>row.path.startsWith('/audio/')));
export const V105_ASSET_BYTES_DELTA=59630;
// Older compared releases already have the old ready icon, but none of the
// original joint atlas. Count its new icon bytes as a new download, not a
// negative old-icon transfer which never occurred in those update plans.
export const V105_LEGACY_DOWNLOAD_BYTES_DELTA=60615;
export const applyV105Source=asset=>{
  const index=V105_MEDIA_RETIREMENTS.findIndex(row=>row.path===asset.path);
  return index<0?asset:{...asset,...V105_MEDIA_ADDITIONS[index]};
};
