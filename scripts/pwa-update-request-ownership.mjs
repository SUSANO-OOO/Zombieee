// HTTP paths retain their recorded multiplicity. The updater consumes manifest
// transport paths; AudioMixer can separately read known bundled logical sources.
export function partitionPwaUpdateTransportPaths(paths, downloadTransportPaths, bundledAudioSourcePaths) {
  const result = { repair: [], runtimeAudio: [], unexpected: [] };
  for (const pathname of paths) {
    if (downloadTransportPaths.has(pathname)) result.repair.push(pathname);
    else if (bundledAudioSourcePaths.has(pathname)) result.runtimeAudio.push(pathname);
    else result.unexpected.push(pathname);
  }
  return result;
}
