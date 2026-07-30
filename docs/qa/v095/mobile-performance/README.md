# Version 0.9.5 mobile performance evidence

## Scope and provenance

- Integration base: `6f65672059b9e75c3a31fb6cf1630c4a11d44fd1`
- Phase branch: `codex/0.9.5-mobile-performance`
- Production build, local-only QA route, no Pages deployment
- Reference viewports: `844x390`, `844x340`
- Device pixel ratio emulation: `3`
- Browser engines: Chromium and Playwright WebKit

The raw browser artifacts are generated under
`outputs/v095-mobile-performance/` and are intentionally not release assets.
The stable measurements needed for review are copied into
`mobile-performance-summary.json`.

## Implemented runtime contract

- Simulation uses a fixed 60 Hz step independently from rendering.
- Rendering is bounded to High 60 fps, mobile Auto 45 fps, and Power save 30 fps.
- Survival 2x multiplies the fixed simulation step, but never raises the render
  ceiling above 60 fps.
- Canvas DPR is capped at High 2, mobile Auto 1.5, and Power save 1.
- The player can change Auto / High / Power save in the pause menu. The setting
  round-trips through the existing campaign save normalizer; older saves default
  to Auto.
- The stage plate is rendered once into a static battlefield cache and reused.
- Purely visual particles use bounded per-profile density. Offscreen particles,
  damage labels, and shot traces are not submitted to Canvas.
- Particle, shot, and damage-label objects return to bounded reuse pools.
  Dedicated scalar writers populate those objects directly, so generation does
  not allocate temporary payload objects before pooling them.
  Expiry and capacity compaction mutate the active arrays in place instead of
  allocating replacement arrays every simulation step.
- Hidden/pagehide lifecycle cancels the pending RAF. Visible/pageshow resets the
  accumulator, resumes one RAF chain, and does not simulate hidden elapsed time.
- Image residency remains stage-and-formation scoped outside local QA.

Quality selection changes only rendering work. Combat timers, damage, AI, weapon
impact timing, movement, save progression, and audio decisions remain inside the
same fixed simulation path.

## Browser lifecycle and quality matrix

`MOBILE_LIFECYCLE_QA_MODE=diagnostic npm.cmd run qa:v095-mobile-performance`
completed all four engine/viewport cases with zero functional failures:

- hidden simulation delta: `0` in 4/4
- hidden render delta: `0` in 4/4
- hidden battle-time delta: `0` in 4/4
- resumed simulation and battle time: positive in 4/4
- AudioContext create delta after Chromium foreground/pageshow: `0`
- duplicate audio loop keys: `0`
- console errors, page errors, request failures, HTTP errors, warnings: `0`
- static background cache: ready with reuse hits in 4/4

At emulated DPR 3, both reference viewports resolved exactly to:

| Setting | Simulation | Render ceiling | Canvas DPR | Effect density |
| --- | ---: | ---: | ---: | ---: |
| High | 60 Hz | 60 fps | 2 | 1.00 |
| Auto | 60 Hz | 45 fps | 1.5 | 0.72 |
| Power save | 60 Hz | 30 fps | 1 | 0.48 |

Relative to High, Auto uses 43.75% fewer canvas backing pixels and Power save
uses 75% fewer. This is a direct GPU fill/memory-bandwidth proxy, not a physical
temperature reading.

## Chromium DPR 3 stress comparison

Both 30-second runs used the same build, `844x390`, DPR 3, and stress scenario.
Battle coverage was 99.83% in High and 100% in Auto.

| Metric | High | Auto | Auto result |
| --- | ---: | ---: | ---: |
| RAF samples | 759 | 1,371 | +80.6% |
| Median frame interval | 33.3 ms | 16.7 ms | improved |
| p95 frame interval | 83.4 ms | 50.0 ms | improved 40.0% |
| Maximum frame gap | 133.3 ms | 83.4 ms | improved 37.4% |
| Long tasks over 100 ms | 9 | 0 | eliminated |
| Simulation ticks | 1,785 | 1,810 | equivalent cadence |
| Rendered battle frames | 767 | 1,107 | +44.3% effective output |
| Retained heap growth | -5.81% | -1.03% | both within 25% budget |
| Runtime proxy growth | -22.85% | -18.90% | both bounded |
| Console/page/request/HTTP errors | 0 | 0 | clean |

The Auto render ceiling is lower, but its smaller backing canvas and bounded
visual work let the browser deliver more real frames than High under the same
DPR 3 load.

The Auto run also recorded bounded pool reuse without overflow:

- particles: `created 310`, `reused 704`, `available 310 / capacity 420`
- shots: `created 46`, `reused 232`, `available 46 / capacity 180`
- damage labels: `created 102`, `reused 284`, `available 102 / capacity 140`
- total reuse events: `1,220`
- discarded because a pool was full: `0`

## Capability boundary

The headless environment did not expose native tab visibility or a native BFCache
restore in either engine, and its WebKit build did not expose AudioContext. Those
items are recorded as capability gaps, not passes. Synthetic visibility and
pagehide/pageshow exercised the runtime contract; Chromium exercised the full
AudioContext lifecycle. Physical-device temperature, native Safari BFCache, and
touch-lock/orientation heat remain RC physical-smartphone checks.

This phase comparison is High versus Auto within Version 0.9.5. The formal
Version 0.9.0 versus 0.9.5 15-minute comparison remains an RC deliverable.
