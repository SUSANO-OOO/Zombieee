export function legacyQaUrl(baseUrl) {
  const url = new URL(baseUrl);
  if (!["localhost", "127.0.0.1"].includes(url.hostname)) throw new Error("Legacy QA entry is localhost-only");
  if (url.searchParams.has("qa")) throw new Error("Legacy QA entry refuses to replace an existing qa parameter");
  url.searchParams.set("qa", "legacy");
  return url.href;
}
