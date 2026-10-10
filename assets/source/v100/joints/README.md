# Issue #177: actual joint animation candidate

The current runtime connection covers ranger walking, stopping, aiming, firing,
recoil and recovery. It retains the approved head, rifle and hands. Clothing and
occluded limbs derive from a built-in imagegen parts study. This is one candidate
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
