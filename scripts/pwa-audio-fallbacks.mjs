import { INSTALL_AUDIO_ASSETS, V100_AUDIO_MANIFEST } from "../app/productionAudio.js";
import { audioChannelFor, selectPreferredAudioSource } from "../app/pwaAssetManifest.js";

export const FALLBACK_AUDIO_BUNDLE_NAME = "audio-fallback-v1";

export const DIRECT_AUDIO_FALLBACKS = [
  ["/audio/v100/foley/treatment.ogg", "offline-treatment-fallback"],
  ["/audio/v104/combat/armor-hit.ogg", "offline-armor-hit-fallback"],
  ["/audio/v060/sfx/enemy-runner-hurt-02.ogg", "offline-runner-hurt-02-fallback", "voice"],
  ["/audio/v060/sfx/enemy-turned-hurt-01.ogg", "offline-turned-hurt-01-fallback", "voice"],
  ["/audio/v060/sfx/enemy-turned-hurt-02.ogg", "offline-turned-hurt-fallback", "voice"],
  ["/audio/v060/sfx/human-male-light-attack-01.ogg", "offline-human-male-light-attack-01-fallback", "voice"],
];

export function v100OfflineAudioFallbacks() {
  const paths = new Set(DIRECT_AUDIO_FALLBACKS.map(([src]) => src));
  for (const cue of INSTALL_AUDIO_ASSETS) {
    const primary = selectPreferredAudioSource(cue.sources);
    if (primary) paths.add(primary.src);
  }

  const alternates = [];
  for (const cue of V100_AUDIO_MANIFEST.assets) {
    const channel = audioChannelFor(cue.category);
    if (channel === "bgm") continue; // The music tracks already ship in their preferred encoding.
    for (const source of cue.sources) {
      if (paths.has(source.src)) continue;
      paths.add(source.src);
      const pathId = source.src.replace(/^\/audio\//, "").replace(/[/.]/g, "-");
      alternates.push({ id: "offline-audio-" + pathId, channel, source });
    }
  }
  return alternates;
}
