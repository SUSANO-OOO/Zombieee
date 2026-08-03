# Version 0.9.9.0 battle audio generation

The 36 runtime MP3 files are generated from project-original procedural recipes in
`scripts/build-v099-battle-audio.mjs`. No external sample, voice model, Web audio,
master recording, or alternate runtime source is used.

## Pinned encoder

- npm package: `@ffmpeg-installer/ffmpeg@1.1.0`
- production platform package: `@ffmpeg-installer/win32-x64@4.1.0`
- production platform: Windows x64
- required FFmpeg build: `N-92722-gf22fcd4483`
- default production executable: the Windows x64 binary resolved by the locked npm package
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
compares every WAV SHA-256 on every platform. On the pinned Windows x64 production
encoder it additionally regenerates and compares every MP3 SHA-256. Other platform
binaries supplied by the umbrella npm package have different FFmpeg identities, so
full MP3 generation fails closed there; CI still verifies checked-in MP3 hashes,
decode, signal bounds, distinctness, and actual loop seams using its read-only decoder. The
checked-in WAV masters stay under `reference/`; only one versioned MP3 per physical
asset is placed under `public/audio/v099/` and included in the PWA audio bundle.

The current creative candidate ID is `v099-pr2-audio-r2`. Producer Gate A physical
speaker and earphone acceptance is still pending and is not implied by automated
Chromium or WebKit QA.
