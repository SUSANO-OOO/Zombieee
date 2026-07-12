# ASHFALL OUTPOST — Project State

Updated: 2026-07-12

## Current release

- Public version: Early Access 0.4.0
- Public URL: https://ashfall-outpost-defense.paopao9.chatgpt.site/
- Baseline commit: `a68b731 Ship Early Access 0.4.0 iron barricade breach`
- Deployment remote: ChatGPT Sites remote named `sites`

## Product direction

ASHFALL OUTPOST is intended to grow beyond the current mission. Future additions may include playable characters, monsters, bosses, stages, story, progression, new game modes, high-density enemy waves, and other ideas not yet specified. Stability is the current foundation, not a reason to postpone expansion indefinitely.

## Current gameplay baseline

- Mobile landscape support
- Free movement across three roadway lanes
- Allies deploy from the CRAWLER through a three-slot bay
- Enemies advance toward the CRAWLER and intercept physical blockers
- Defend, balanced, and assault tactical modes
- TAKUYA boss encounter
- A shared-HP barricade spanning all three lanes becomes vulnerable after TAKUYA falls
- Barricade destruction wins; CRAWLER destruction loses

## Verified state

- Production build succeeds
- `npm.cmd test`: 12 passing tests
- `npm.cmd run lint`: succeeds
- PC landscape and 844x390 mobile-equivalent playtests completed
- Full endgame transition verified: TAKUYA defeat, barricade exposure, shared barricade damage, victory, and retry
- Public build and normal localhost flow are unaffected by the local QA mode

## Local development additions awaiting a backup commit

- Local-only `?qa=endgame` endgame QA mode
- Small local QA badge
- Cross-platform vinext runner for Windows-compatible npm scripts
- Lint exclusions for generated and archived build output

The QA mode is enabled only on `localhost` or `127.0.0.1` with `?qa=endgame`. It exercises normal TAKUYA death, barricade damage, and victory logic rather than directly setting the win state.

## Pending development task

The QA location gate has been verified in a real browser but does not yet have dedicated unit tests. A future small task may extract the gate into a pure helper and test localhost, 127.0.0.1, missing query, wrong query, and public-domain cases.

## Recovery notes

After cloning the backup repository on a new computer:

1. Install a supported Node.js version (`>=22.13.0`).
2. Run `npm install`.
3. Run `npm.cmd test` and `npm.cmd run lint` on Windows.
4. Reconnect the ChatGPT Sites project before deploying.

Generated folders such as `node_modules`, `dist`, `work`, and `outputs` are intentionally not source backups and can be recreated or transferred separately when needed.
