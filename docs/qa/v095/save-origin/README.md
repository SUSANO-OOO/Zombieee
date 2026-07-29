# Version 0.9.5 save migration / origin evidence

## Scope

- Baseline release: Version 0.9.0 at
  `f2633c538756385f13d166d3adbcdd39b3a08b21`
- Source save: `nishijin-campaign-v1`, schema 13
- Target save: same stable key, schema 14
- Runtime origins exercised: `127.0.0.1` and `localhost`
- Environment labels covered by deterministic classification:
  GitHub Pages, localhost, loopback, LAN, and other preview

## Player-facing result

The title and save-recovery screens now show the environment label, exact
origin, and the warning that the save belongs to that origin and is not
automatically shared with localhost, LAN, or GitHub Pages. This distinguishes
a fresh save on a different URL from loss of the formal Pages save.

No cross-origin fetch, cloud synchronization, Service Worker, PWA, or automatic
save reset was added. Moving a save between origins remains an explicit
export/import operation.

## Version 0.9.0 migration proof

The browser fixture uses the exact top-level field order and post-0.9.0 field
absence from `v0.9.0`'s `createDefaultCampaignSave`, then fills those release
fields with progressed data and stamps a valid schema 13 checksum. It does not
spread the current schema 14 save into the source fixture. The resulting save
is verified by full-payload deep equality in both localStorage and IndexedDB,
with only the declared schema 14 normalization of equipment ordering, Survival
schema/start-wave state, outbreak boss state, employment notices, and graphics
quality accepted. The following are preserved:

- ownership, discovery, and recruitable state
- completed Stages, unlock chain, stars, and claimed star rewards
- caps and supply alias
- unit Levels
- equipment quantities, unknown future equipment, enhancement Levels
- formation presets, personal equipment, tactical equipment, selected preset
- campaign records and unit statistics
- Survival progress and reward/run receipts
- outbreak progress and receipts
- story, accessibility, graphics, BGM, and SFX settings
- campaign result, employment, upgrade, equipment, and migration receipts
- pre-migration and last-known-good recovery snapshots

Migration advances the revision once, creates the Mayo employment notice
receipt without marking it seen, and remains idempotent on another
deserialize/serialize pass.

## Origin proof

Within one browser context, the same production build is opened at
`127.0.0.1:<port>` and `localhost:<port>`.

- The source origin contains the Version 0.9.0 save.
- The target origin starts fresh and does not acquire the source save.
- The UI reports a distinct exact origin on each page.
- Export from the source and explicit import at the target transfers the save.
- Import creates matching durable localStorage and IndexedDB replicas.
- The source-origin serialized save remains byte-for-byte unchanged.

This proves origin separation and the supported manual transfer path. It does
not claim access to, mutation of, or loss of a real player's formal Pages
browser storage.

## Browser matrix

`npm.cmd run qa:save-migration`

- Chromium 844 x 390: 13/13
- Chromium 844 x 340: 13/13
- Chromium 1280 x 720: 13/13
- WebKit 844 x 390: 13/13
- WebKit 844 x 340: 13/13
- WebKit 1280 x 720: 13/13
- Total: 78/78
- console errors: 0
- page errors: 0
- request failures: 0
- HTTP errors: 0
- overflow: 0

Raw evidence is retained under the ignored local path
`outputs/save-migration-browser-matrix/`. Each invocation creates a unique,
new run-id directory without deleting an existing path. The root summary points
only to that run, so stale failure screenshots cannot coexist with its current
matrix cells. The current run contains 0 `*-FAILED.png` files. The matrix
summary SHA-256 is recorded in `save-origin-summary.json`.

Physical smartphone storage behavior was not exercised. No physical-device,
thermal, or formal-Pages-save claim is made by this phase.
