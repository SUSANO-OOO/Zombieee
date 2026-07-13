export const LOCAL_QA_MODES = Object.freeze(["endgame", "roles", "supplies", "airstrike", "crawler", "loadout", "dialogue", "stress"]);

export function resolveLocalQaMode(hostname, search = "") {
  if (hostname !== "localhost" && hostname !== "127.0.0.1") return null;
  const value = new URLSearchParams(search).get("qa");
  return LOCAL_QA_MODES.includes(value) ? value : null;
}
