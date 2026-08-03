# Version 0.9.9.0 battle audio generation

The 36 runtime MP3 files are generated from project-original procedural recipes in
`scripts/build-v099-battle-audio.mjs`. No external sample, voice model, Web audio,
master recording, or alternate runtime source is used.

## Pinned encoder

- npm package: `@ffmpeg-installer/ffmpeg@1.1.0`
- required FFmpeg build: `N-92722-gf22fcd4483`
- default executable: the platform binary resolved by the locked npm package
- optional override: `FFMPEG_PATH`, accepted only when `ffmpeg -version` reports
  the same required build

## Clean-checkout reproduction

```powershell
npm.cmd ci
npm.cmd run audio:v099:build
npm.cmd run audio:v099:verify
npm.cmd run build:pwa-assets
```

The reproducibility test also generates into an isolated temporary output root and
compares every WAV and MP3 SHA-256 with the checked-in provenance ledger. The
checked-in WAV masters stay under `reference/`; only one versioned MP3 per physical
asset is placed under `public/audio/v099/` and included in the PWA audio bundle.

The current creative candidate ID is `v099-pr2-audio-r2`. Producer Gate A physical
speaker and earphone acceptance is still pending and is not implied by automated
Chromium or WebKit QA.
