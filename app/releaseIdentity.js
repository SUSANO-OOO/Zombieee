export function releaseTitleForVersion(version) {
  const label = /^[1-9]\d*\./u.test(String(version)) ? "Version" : "アーリーアクセス版";
  return `西新世紀末物語｜${label} ${version}`;
}

export const RELEASE_VERSION = "1.0.0";
export const RELEASE_TAG = `v${RELEASE_VERSION}`;
export const RELEASE_LABEL = `Version ${RELEASE_VERSION}`;
export const RELEASE_TITLE = releaseTitleForVersion(RELEASE_VERSION);

export const RELEASE_IDENTITY = Object.freeze({
  version: RELEASE_VERSION,
  tag: RELEASE_TAG,
  label: RELEASE_LABEL,
  title: RELEASE_TITLE,
});
