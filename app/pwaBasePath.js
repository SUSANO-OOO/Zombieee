function sameOriginUrl(windowRef, value) {
  try {
    const candidate = new URL(value, windowRef.location.origin);
    return candidate.origin === windowRef.location.origin ? candidate : null;
  } catch {
    return null;
  }
}

/**
 * PWA assets live at the application root, while the V1 campaign intentionally
 * lives at a nested `/v100` route. Pages writes the authoritative root into a
 * meta tag; local production keeps the same rule by resolving the known V1
 * route to its parent. The document URL itself remains untouched.
 */
export function resolvePwaBaseUrl(windowRef) {
  if (!windowRef?.location) return "/";
  const declaredBase = windowRef.document?.querySelector('meta[name="github-pages-base"]')?.getAttribute("content");
  const declaredUrl = declaredBase ? sameOriginUrl(windowRef, declaredBase) : null;
  if (declaredUrl) {
    declaredUrl.pathname = declaredUrl.pathname.replace(/\/{0,2}$/u, "/");
    return declaredUrl.toString();
  }
  if (/\/v100\/?$/u.test(windowRef.location.pathname)) {
    const routeUrl = new URL(windowRef.location.href);
    routeUrl.pathname = routeUrl.pathname.replace(/\/v100\/?$/u, "/");
    routeUrl.search = "";
    routeUrl.hash = "";
    return routeUrl.toString();
  }
  return new URL("./", windowRef.location.href).toString();
}
