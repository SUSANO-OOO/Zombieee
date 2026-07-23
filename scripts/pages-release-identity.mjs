const VERSIONED_PRODUCT_TITLE_PATTERN = /西新世紀末物語｜アーリーアクセス版 (?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-[0-9A-Za-z]+(?:[.-][0-9A-Za-z]+)*)?/gu;

export function normalizeReleaseTitle(source, releaseVersion) {
  const expectedTitle = `西新世紀末物語｜アーリーアクセス版 ${releaseVersion}`;
  const versionedTitles = source.match(VERSIONED_PRODUCT_TITLE_PATTERN) ?? [];
  if (!versionedTitles.length) {
    throw new Error("Rendered document does not contain the versioned product title");
  }

  const normalized = source.replace(VERSIONED_PRODUCT_TITLE_PATTERN, expectedTitle);
  const renderedTitles = normalized.match(/<title>[^<]*<\/title>/gu) ?? [];
  if (renderedTitles.length !== 1) {
    throw new Error(`Expected one rendered title, found ${renderedTitles.length}`);
  }
  if (renderedTitles[0] !== `<title>${expectedTitle}</title>`) {
    throw new Error(`Rendered title does not equal "${expectedTitle}"`);
  }
  return normalized;
}
