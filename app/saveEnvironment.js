const FORMAL_PAGES_HOST = "susano-ooo.github.io";
const FORMAL_PAGES_PATH = "/Zombieee";

function normalizedOrigin(locationLike) {
  const explicit = String(locationLike?.origin ?? "").trim();
  if (explicit && explicit !== "null") return explicit;
  const protocol = String(locationLike?.protocol ?? "").trim();
  const host = String(locationLike?.host ?? "").trim();
  return protocol && host ? `${protocol}//${host}` : "origin不明";
}

function isPrivateIpv4(hostname) {
  const octets = String(hostname).split(".").map(Number);
  if (octets.length !== 4 || octets.some((value) => !Number.isInteger(value) || value < 0 || value > 255)) {
    return false;
  }
  return octets[0] === 10
    || (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31)
    || (octets[0] === 192 && octets[1] === 168);
}

export function describeSaveEnvironment(locationLike) {
  const hostname = String(locationLike?.hostname ?? "").toLowerCase();
  const pathname = String(locationLike?.pathname ?? "/");
  const origin = normalizedOrigin(locationLike);
  let kind = "preview";
  let label = "プレビュー環境";

  if (hostname === FORMAL_PAGES_HOST && (
    pathname === FORMAL_PAGES_PATH
    || pathname.startsWith(`${FORMAL_PAGES_PATH}/`)
  )) {
    kind = "github-pages";
    label = "正式公開・GitHub Pages";
  } else if (hostname === "localhost") {
    kind = "localhost";
    label = "開発・localhost";
  } else if (hostname === "127.0.0.1" || hostname === "::1" || hostname === "[::1]") {
    kind = "loopback";
    label = "開発・loopback";
  } else if (isPrivateIpv4(hostname) || hostname.endsWith(".local")) {
    kind = "lan";
    label = "LAN試遊";
  }

  return Object.freeze({
    kind,
    label,
    origin,
    storageScope: "このorigin専用",
    isolationNotice: "セーブはこのorigin専用です。localhost・LAN・GitHub Pagesとは自動共有されません。",
  });
}
