# Issue #177: actual joint animation candidate

The current runtime connections cover ranger walking, stopping, aiming, firing,
recoil and recovery, plus normal Mayo's diagonal run, ground settling and bite.
They retain the approved head, weapons and equipment. Clothing and
occluded limbs derive from built-in imagegen parts studies. These are two candidates
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
