# Version 0.9.5.2 P0 Hotfix candidate QA

This file is implementation and QA evidence only. Issue #113 and its latest Producer physical-device comment remain the sole execution authority.

## Candidate boundary

- Branch: `codex/0.9.5.2-hotfix`
- Base: Version 0.9.5.1 release SHA `4a21e551d4a5e9641b2374a3ba1da6f37e28e4c8`
- Candidate identity: Version 0.9.5.2
- Formal publication: not performed
- Physical smartphone acceptance: pending Producer confirmation
- `.github/pages-release-request.json`: unchanged
- PWA, Service Worker, offline/install work: not included

## Root causes and corrections

### Asset loading

The player-facing retry button called `window.location.reload()`. A failed loadout therefore returned to title, recreated the same failing load session, and could loop indefinitely.

The candidate replaces that path with a generation-owned session:

- 12-second outer deadline for critical work and six-second deadline for optional work
- two-request mobile concurrency cap and path deduplication with fan-out to every kind sharing an atlas
- one readiness owner for each battlefield background; preload, CSS, and map preview no longer race the loader
- minimal critical set: battlefield, CRAWLER closed/open, enemy base, selected formation, and first-wave enemies
- Mayo's normal and feral atlases are both critical whenever Mayo is selected
- optional/background set: later-wave atlases, support objects, and stage objects
- stale generation abort protection
- same-loadout retry of failed/pending critical paths only
- terminal `ready`, `degraded-ready`, or `error`; no unbounded `loading`
- exact QA diagnostics for generation, reason, pending paths, failed paths, restart count, category, and failure reason
- player-facing `n / total`, category/reason, separate retry control, and optional-degradation notice
- critical recovery followed by optional background preload, without reopening the title screen
- Survival start/resume gate covering its formation, normal enemy set, dynamic boss pool, and CRAWLER

### Audio

Audio asset failure was previously folded into one global failed state, and fetch, `arrayBuffer`, and `decodeAudioData` could remain pending.

The candidate adds:

- eight-second bounded source load/`arrayBuffer` and three-second decode deadline
- separate AudioContext, confirmation tone, BGM, SFX, voice, and optional status
- category plus optional diagnostics for every failed asset
- failed-cache-only retry without creating another AudioContext
- working SFX/voice playback when BGM fails
- duplicate-loop and context-create diagnostics
- visible unavailable-category summary on smartphone layouts

## Automated QA

| Gate | Result |
|---|---:|
| Focused asset/image/audio tests | pass |
| Full tests | 776 / 776 pass |
| Production build | pass |
| ESLint | pass, 0 warnings |
| Content validator | pass, 0 errors/warnings |
| `git diff --check` | pass |
| Chromium/WebKit hotfix browser matrix | 34 / 34 pass |

The browser matrix covers 1280×720, 844×390, and 844×340; touch and DPR 3; Stage 1, 6, and 13; fresh save; v13-to-v14 save migration; HTTP failure; critical request hang; image decode hang; optional request hang; one initial critical-background request per generation; same-screen and rapid retry; shared-atlas fan-out; CRAWLER readiness; Mayo normal/feral critical readiness; Survival start; BGM failure and recovery while SFX/voice remain usable; BGM recovery while an unrelated optional asset remains failed; optional audio failure; AudioContext suspend/recovery; and title-to-battle flow. Intentional injected 503 responses are recorded as expected evidence. All ordinary scenarios have zero console error, page error, request failure, and HTTP error.

Chromium audio cases use native Web Audio. This Windows Playwright WebKit build exposes no Web Audio constructor, so its audio state-machine cases use an explicitly marked deterministic substitute (`audioContextMode: simulated-webkit-capability`). Native iPhone speaker output remains part of the physical gate and is not claimed by this automation.

## Production-build comparison

Chromium 844×390, touch, DPR 3, identical schema-v14 save, production builds. Cold and warm passes run in the same isolated browser context. Candidate optional loading is allowed to settle before the warm pass.

| Metric | 0.9.5 | 0.9.5.1 | 0.9.5.2 candidate |
|---|---:|---:|---:|
| Cold HTML response end | 18 ms | 15 ms | 16 ms |
| Cold title ready | 242 ms | 291 ms | 301 ms |
| Cold map ready | 168 ms | 98 ms | 108 ms |
| Cold loadout terminal | >15,000 ms timeout | 97 ms | 166 ms |
| Cold total requests | 70 | 48 | 37 |
| Cold transfer | 23.23 MB | 23.11 MB | 19.07 MB |
| Cold JavaScript transfer | 1.35 MB | 1.35 MB | 1.37 MB |
| Cold image requests | 34 | 34 | 23 |
| Cold image transfer | 19.31 MB | 19.31 MB | 15.26 MB |
| Cold audio preload requests | 24 | 2 | 2 |
| Candidate critical asset count | n/a | n/a | 11 |
| Warm HTML response end | 20 ms | 19 ms | 20 ms |
| Warm loadout terminal | >15,000 ms timeout | 54 ms | 66 ms |
| Warm transfer | 3.88 KB | 3.89 KB | 3.82 KB |
| Retained JS heap proxy | 14.3 MB | 12.7 MB | 13.4 MB |

The candidate removes the 0.9.5 terminal failure and reduces cold image requests by 32% and cold image transfer by 21% versus 0.9.5.1. Its retained JS heap proxy is 0.7 MB above 0.9.5.1 and 0.9 MB below 0.9.5. Its measured 166 ms cold and 66 ms warm loadout terminals include the corrected CRAWLER-critical set and stay bounded; single-run timing differences versus 0.9.5.1 are not claimed as durable improvements.

Raw local evidence is generated under `outputs/v0952-hotfix/` by:

- `npm run qa:v0952-hotfix`
- `node scripts/v0952-performance-comparison.mjs`

## Physical smartphone gate

Formal merge, tag, Release, Pages deployment, Public QA, and Issue #113 close remain blocked until Producer acceptance on the same physical smartphone:

1. fresh save and existing save
2. at least two stages
3. intentional critical failure followed by the same-screen retry
4. no return to title and no reload loop
5. ordinary reload does not recreate a loop
6. confirmation tone, BGM, SFX, and voice from the physical speaker
7. acceptable temperature, responsiveness, and memory behavior

After that gate, Issue #113 controls formal publication. Issue #114 does not begin until Version 0.9.5.2 is physically accepted and formally published.
