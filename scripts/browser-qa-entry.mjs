// Legacy QA modules run at import time. Guarded CLI modules expose this hook
// so the owned-server launcher can invoke them without changing process.argv.
export async function invokeBrowserQaModule(namespace) {
  if (!Object.hasOwn(namespace, 'runBrowserQa')) return 'legacy-top-level';
  if (typeof namespace.runBrowserQa !== 'function') throw new TypeError('runBrowserQa must be a function');
  await namespace.runBrowserQa();
  return 'explicit-hook';
}
