# Version 0.9.5 animation foundation evidence

## Scope and provenance

- Integration base: `9694e624227a6840a859ad2f06d92e8ac3335a54`
- Phase branch: `codex/0.9.5-animation-foundation`
- Production build and local-only QA route; no Pages deployment
- Reference viewports: `844x390`, `844x340`
- Device pixel ratio emulation: `3`
- Browser engines: Chromium and Playwright WebKit

This phase implements the shared state, anchor, transition, and event contract.
It does not claim that the representative six or remaining ten playable-unit
animation passes are complete.

Raw continuous-frame captures and the full browser summary are generated under
`outputs/v095-animation-foundation/` and are intentionally not release assets.
The stable review result is copied into
`animation-foundation-summary.json`.

## Runtime contract

The original nine states remain stable:

`idle`, `move`, `wind-up`, `active`, `recovery`, `hit`,
`incapacitated`, `death`, `special`.

Twelve optional semantic clips are available to every runtime sprite kind:

`deploy`, `start-move`, `stop-move`, `turn`, `reload`,
`weapon-cycle`, `hit-light`, `hit-heavy`, `down`, `get-up`, `retreat`,
`phase-change`.

Each optional state has an explicit safe fallback. Hurt and down clips use only
hurt, incapacitated, or death sprite states; death remains death. They never
fall back to an attack or manual-ability frame.

The per-fighter animation runtime is updated from actual world displacement and
locked facing, rather than treating every zombie as permanently moving. Gate
entry selects deploy once, then continues with a movement clip for the remaining
door/ramp route instead of clamping to an idle end frame. Displacement selects
start/move/stop, a facing reversal selects turn, knockback strength selects
light/heavy hit, Mayo retreat selects retreat, and Raider overheat recovery
selects reload.

Procedural transforms are applied around the authored foot point. Vertical pose
offset remains exactly zero, so squash, lean, turn compression, and recoil do
not lift the fighter from the floor. Directional rotation and horizontal offset
mirror with facing.

Clip events use an elapsed-time cursor. Entry, footstep, turn, settle, reload,
and phase events are emitted once when their timeline boundary is crossed,
including loop wraparound.

## Browser matrix

Focused animation tests passed `16/16`; the complete suite passed `712/712`.
Production build, Lint, content validation, and `git diff --check` also passed.

`npm.cmd run qa:v095-animation-foundation` completed all four
engine/viewport cases:

- passed: `4/4`
- failed: `0`
- captured states per case: deploy, gate-entry move after deploy completion,
  stop-move, start-move, move-right, turn-left, hit-heavy, reload
- gate-entry proof remains `gateEntering=true` beyond the `0.32 s` deploy clip
  and samples a `walk-*` frame
- distinct player-facing Canvas captures: at least `7/8` per case
- authored ground anchor: `1` in every capture
- procedural vertical offset: `0` in every capture
- logical off-floor fighters: `0`
- visually off-floor fighters: `0`
- right-facing movement and left-facing turn lock: passed
- resident production sprites: `45`
- console errors, page errors, request failures, HTTP errors: `0`

The existing combat-presentation regression also passed `4/4` cases. Across
fighter, infected-base, pierce, and Gate Eater targets it observed all three
Raider rounds, a `0.055 s` runtime travel contract per round, three scheduled
damage applications with the exact expected total, synchronized casing/recoil/
hit-stop metadata, later rounds in a positive-remaining deferred state before
impact, and zero diagnostics. Headless wall-clock observation is not treated as
an exact projectile timer because a browser callback may first observe a shot
after part of its simulation lifetime has elapsed or coalesce two HP changes.

The Mayo vertical-slice regression passed `4/4` engine/viewport runs. Her
incapacitation still uses the authored death/hit phases before the new semantic
retreat clip takes over for the run phase.

Independent read-only review completed at `High 0 / Medium 0 / Low 0`.
The initial Medium finding—moving gate entrants sliding on the terminal deploy
frame—was corrected with a one-shot deploy-completion transition and verified
by focused tests plus all four browser cases.

The browser fixture pauses simulation internally and advances real fighter
coordinates through the production animation state machine. The normal Canvas
render path then samples and draws those states; it does not render a separate
test-only animation.

## Validation boundary

This evidence establishes the reusable player-facing foundation and its
cross-browser behavior. Per-unit motion identity, the representative-six
vertical slice, all-sixteen proof, complete VFX/SE timing, and physical
smartphone acceptance remain later Issue #96 phases.
