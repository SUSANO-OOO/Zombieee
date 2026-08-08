# Version 0.9.9.0 final remediation root-cause lock

Baseline: `7c89b102287f0a9b1ae50b207ef6f4e5c6dd3751` (`2af03003c7aa4192d80168ff1838f63e298257ea`)

This report freezes the five Producer findings into four implementation owners. It is intentionally narrower than a redesign: save, gameplay values, the Service Worker, the A2 icon, the approved ability/support audio, and the accepted VFX remain out of scope.

## A/B — battle music and TAKUYA entrance

Owner: the production music scene/mix path.

- The current normal scenes use legacy Stage 1–3/station tracks, while pressure and boss use three quiet, mono, static v099 recipes. Production-gain measurements put the v099 pressure tracks near -32 LUFS and boss near -30.5 LUFS, compared with legacy normal values from -17.3 to -25 LUFS. The escalation therefore sounds weaker, and the low-frequency-heavy arrangements do not survive a small speaker reliably.
- `TAKUYA_ENTRANCE_AUDIO.silenceSceneId`, `battleSilenceSceneId()`, and the React scene effect deliberately select a scene with no BGM for the 3.4-second entrance. That is the direct cause of the missing Stage 3 boss music.
- Dialogue ducking and transient cue ducking currently automate the same GainNode. A bark state update can cancel the entrance envelope.

Locked fix:

- Add a versioned project-original normal battle arrangement and rebuild normal/pressure/boss as distinct, midrange-readable arrangements with a strong opening identity, section changes, clean loop boundaries, matched production loudness, and retained voice/SE headroom.
- Select the boss scene at TAKUYA incoming and keep one boss BGM instance while the boss is alive. The entrance cue applies only a transient gain duck; it never selects silence. Boss defeat resolves the current pressure latch/normal mode once.
- Split persistent dialogue duck and transient cue duck into composable gain stages. This is a minimal graph extension, not an AudioMixer replacement.
- Capture the three 30-second assets, the three required transitions, and the real Stage 3 route with scene ID, asset ID, AudioContext state, effective gains, instance count, peak, LUFS, centroid, onset density, and loop boundary evidence.

## C — deployment visibility and occlusion

Owner: the CRAWLER deployment layer compositor.

- `friendlyCrawlerRevealRect()` clips each entire fighter to one hard rectangle. The rectangle is validated against itself by the existing audit, does not represent the authored vehicle contour, and releases before the real ramp end.
- The open CRAWLER is later redrawn as three rectangular strips in `drawCrawlerExitFrame()`, without the exact suspension transform used by the base. This produces missing bodies, ghosts, and incorrect over/under ordering even though the fighter alpha is already 1.

Locked fix:

- Generate versioned project-original base/interior and foreground hull/door-frame mask derivatives from the approved open CRAWLER master without changing historic v075 assets.
- Draw base/interior, then the deploying fighter exactly once at alpha 1, then the authored foreground mask while the visible bounds still intersect it. Once clear, draw the fighter once after the mask with no clip. Preserve gameplay/combat-ready timing.
- Replace the self-referential rectangle audit with Chromium/WebKit composite evidence for Hachi, Mizuchi, Paisen, Crazy King, Mayo-chan, Tatara, and Nao (standard human), at the six locked checkpoints and both 844x390/844x340 viewports.

## D — mobile battle HUD

Owner: one DOM safe-zone layout.

- The current deployment/ability banner remains a fixed 480x42 Canvas rectangle with 22px text. Cover scaling places it over the independent DOM bark and phase regions.
- Top controls, battle barks, health/boss panels, bottom resources, cards, support controls, and the stats strip do not share explicit zone ownership. Minimum-width grids then collide at 844 pixels.

Locked fix:

- Remove Canvas banner rendering and publish the banner in HUD state. A single DOM top grid owns 28% CRAWLER, 38% serialized dialogue/banner, and 34% phase/wave/pause/audio.
- A single bottom grid owns left resources/stats, center unit cards, and right support/objective. Required text keeps the 14px/12px minimums, disabled readability, backplates/shadows, full objective text, and no cross-zone overlap.
- Record raw nine-state screenshots at both mobile viewports in Chromium and WebKit, plus computed font, overflow, and bounding-box assertions.

## E — CRAWLER barrage and airstrike equipment

Owner: project-original versioned raster sheets.

- `drawAirstrikeObserver()` and the active barrage gun are improvised Canvas line/arc/polygon equipment. They do not inherit the CRAWLER material, lighting, perspective, or physical attachment.
- The approved v075 CRAWLER images already bake a legacy turret and communications array. Overlaying retractable sheets at those same pixels would leave ghost hardware.

Locked fix:

- Preserve the historic v075 files. Emit versioned clean deployment derivatives and two independent seven-frame RGBA equipment sheets with fixed vehicle anchors: barrage (stowed, hatch-open, turret-rise, aim, firing, recoil, retract) and airstrike (stowed, mast-deploy, antenna-extend, targeting, inbound-signal, impact-confirmation, retract).
- Render the sheets in the exact CRAWLER suspension transform. Authored muzzle metadata owns barrage tracer origin. Runtime Canvas keeps only transient muzzle/trajectory/target/inbound/impact effects; the module bodies have no Canvas fallback.
- The runtime asset registry blocks readiness on missing/decode failure. The provenance ledger records project-original source, creator/license/commercial-use, generator, master/output hashes, dimensions, anchors, alpha bounds, lossless WebP transport, manifest membership, update/offline/rollback evidence.

## Stop/acceptance boundary

The correction stays on `codex/0.9.9.0-final-remediation` and a Draft integration PR until all five owners pass focused/full tests, lint/build/content/drift checks, Chromium/WebKit evidence, PWA install/update/offline/rollback, save migration/preservation, CI, and an independent fixed-HEAD Sol review with High 0 / Medium 0 / Low 0. No `main` merge, tag, Release, Pages publication, or Issue closure occurs before those gates.
