# Issue #177: actual joint animation candidate

The current runtime connections cover ranger walking, stopping, aiming, firing,
recoil and recovery, normal Mayo's diagonal run, ground settling and bite,
Scout's biped gait, ground settling and crowbar anticipation/contact/return,
and Walker/Turned's gait, settling and claw reach/return.
They retain the approved head, weapons and equipment. Clothing and
occluded limbs derive from built-in imagegen parts studies. These are five form candidates
within the Producer's complete 48-form scope, including allies, enemies, bosses
and derived forms. Other units, hits, defeat, deployment, turns and abilities
still require authoring and visual acceptance. No overall acceptance or release
approval is implied by this source or the tests.

`ranger-r1/parts.json` binds each painted layer to actual Blender bones.
`author.py` builds fixed-length leg and arm chains, explicit clothing weights,
four settling levels and the carry/aim/recoil/return action. The compressed
`motion.json.gz` stores the evaluated bone matrices and clothing vertices, not
an analytical approximation of Blender. Absolute authoring paths are omitted.
The approved source atlas hash, reference transform, derived layer hashes and
output WebP hash are recorded in `parts.json` and `provenance.json`.

The runtime atlas has 30 travel phases, four settling levels, one carry pose and
31 attack poses. The lower layer holds the real-travel phase during attacks;
the upper layer follows the attack state and the lower pelvis height. The same
evaluated weapon transform places the projectile muzzle. Special abilities,
damage and defeat keep their existing owners. Only the current battle's needed
atlas is decoded, through the ordinary critical-image loader and cleanup path.

To reproduce the baked texture from the frozen joint export, install
`@napi-rs/canvas@1.0.10` into a separate tools directory, leaving shared project
dependencies intact:

```powershell
npm install --prefix output/joint-authoring-tools --no-save --ignore-scripts --package-lock=false @napi-rs/canvas@1.0.10
node scripts/build-v177-joint-atlas.mjs --canvas-module output/joint-authoring-tools/node_modules/@napi-rs/canvas/index.js
node scripts/build-asset-manifest.mjs
node --test tests/v177-joint-presentation.test.mjs tests/v177-installed-asset-contract.test.mjs
```

For further authoring, run Blender 5.2 in background mode with `--factory-startup`,
`--disable-autoexec`, `--python-exit-code 1`, the saved `author.py`, and its source
directory after `--`. Use a separate output copy; the `.blend` and uncompressed
motion export are workshop files. Disable file previews before saving, as the
script does. Recompress a changed motion export and rebake only after checking
all planted painted soles, grip attachment, fixed bone lengths, mesh winding,
clipping and identity. A changed output requires a new exact asset contract.

Failed trials remain in the local workshop: r11 used too narrow a knee blend
and produced 18 inverted triangles. The r12 export uses the established 32 px
blend and has zero inverted triangles; the smallest signed area ratio is
0.0046994. This is a geometry result, not a claim that clothing or gait looks
natural. Normal-speed continuous visual review and native WebKit performance
remain acceptance requirements. Local game/browser/audio playback is disabled;
browser verification runs through remote Actions.

`mayo-r1/` uses 17 explicitly bound rigid paint layers and a parented jaw. The
original head is partitioned into head and jaw without repainting its identity;
tail and harness remain original paint. The 0.3 stance fraction and 56 px span
give a 186.667 px source travel cycle, rather than speeding up a short walking
cycle. Diagonal pairs share support, with a short flight interval and no bone
stretching. Painted planted soles meet y=432. Four settle banks retain each
foot's travel phase through attacks. The jaw closes at the beginning of the
engine's active attack state; the melee effect uses the rendered mouth socket.

The quadruped texture contains cropped parts rather than repeated body frames:
80,006 bytes downloaded and 421,888 bytes decoded. Its 151 real Blender poses
are interpolated as rigid transforms, preserving limb proportions between keys.
The original painter order and a small moving mouth interior preserve occlusion.
The generated data and texture can be reproduced with project Sharp alone:

```powershell
node scripts/build-v177-quadruped-joints.mjs
node scripts/build-asset-manifest.mjs
node --test tests/v177-quadruped-joints.test.mjs tests/v177-joint-presentation.test.mjs
```

Mayo r6 clipped two head-edge pixels at maximum attack extension and was
rejected. R7 reduced head extension; R8 additionally aligned the bite with real
damage contact. Expanded-pixel review rejected R8's detached old chin edge and
R9's exposed hinge gap. R10 moves the complete chin with the jaw and retains
original neck fur behind the hinge, with no new face painting. Its unchanged
bone export retains fixed lengths and painted ground support within 0.01 source
pixels. The feral form, retreat, other owned actions, all remaining
units, normal-speed continuous play and native performance still require work.
The iPhone saved-recording audio defect remains unresolved.

`scout-r1/` binds 16 explicit paint parts to fixed-length Blender leg and arm
chains. The original face, backpack, holding hand and crowbar retain their
source pixels. Both knees bend forward; each boot faces the travel direction.
The 94 px span and 0.62 stance fraction give 151.613 px per travel cycle,
approximately 23.79 world pixels before depth/compact scaling. The earlier
60 px span trial was rejected because it made the legs cycle too quickly at
the increased ally speed. All 300 exported action frames clear the source-cell
edges, and planted painted soles stay at y=432 within 0.001 source pixels.

Ordinary attacks hold the current settled leg phase. The weapon and hand use
the same evaluated transform. Interpolating the arm and weapon independently
exposed a wrist gap between source keys; the runtime now resolves the authored
two-bone arms against that same shoulder and hand. This preserves limb lengths,
shoulder/elbow/wrist continuity and the evaluated Blender bend at source keys.
The combat melee effect uses the transformed painted crowbar tip. The texture
downloads 46,982 bytes and decodes 407,552 bytes only when Scout is required.

```powershell
node scripts/build-v177-biped-joints.mjs
node scripts/build-asset-manifest.mjs
node --test tests/v177-biped-joints.test.mjs tests/v177-quadruped-joints.test.mjs tests/v177-joint-presentation.test.mjs
```

The biped and quadruped builders share the explicit rigid-parts baker. This
refactor reproduces Mayo's existing texture, pose data and provenance exactly.
Offline production-render contact sheets were reviewed in both directions,
through windup, contact, recovery and stopping. They do not replace continuous
normal battle review, remote native WebKit performance, or the remaining
actions/forms in the Producer's full 48-form requirement.

`walker-r1/` retains the original head and both hands. Twelve hidden clothing
and limb pieces were adopted from the built-in imagegen study; 15 visible parts
bind to the actual Blender biped. The source's charcoal shirt, muddy brown
pants, worn brown boots and hunched silhouette remain its identity. Walker
and Turned already share every source frame in both directions, so they use
one texture and pose object. The battle loader deduplicates this shared key.

The legacy source cell is 394x757 with substantial transparent padding. Its
authoring reference was normalized to 480x448. The runtime explicitly inverts
that normalization for paint, gait distance and claw sockets, preserving the
original source-pixel scale and ground anchor through movement, contact, hit
and defeat. Ordinary contact uses the new joint owner when its texture is
ready; existing abilities, hit and death owners remain intact. Both unit and
enemy QA loading paths ensure the joint texture before reusing an old sprite.

The r2 authoring trial failed because a walking hand target exceeded its arm
reach. R3 raises that swinging hand enough to keep the original fixed lengths;
no reach clamp or bone stretch was added. All 300 exported frames clear the
source-cell edges. Both painted soles, lengths and hand attachment stay within
0.001 source pixels. Production interpolation also checks 1,803 gait/settle
samples for elbow/wrist continuity. Cropped clothing avoids the study's lower
leg paint being duplicated in a thigh or pelvis layer.

The texture downloads 36,616 bytes and decodes 325,632 bytes. Reproduce it with:

```powershell
node scripts/build-v177-enemy-joints.mjs
node scripts/build-asset-manifest.mjs
node --test tests/v177-enemy-joints.test.mjs tests/v177-installed-asset-contract.test.mjs
```

Normal-speed play, the remaining forms/actions and physical recording audio
remain unaccepted. These source checks do not close the complete quality goal.
