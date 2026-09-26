import { resolveLocalQaMode, resolveLocalQaScenario } from "./localQa.js";

export function resolveGameEntry(hostname, search = "") {
  if (hostname !== "localhost" && hostname !== "127.0.0.1") return "v100";
  const qa = new URLSearchParams(search).getAll("qa");
  if (qa.length !== 1) return "v100";
  return qa[0] === "legacy" || resolveLocalQaMode(hostname, search) || resolveLocalQaScenario(hostname, search)
    ? "legacy" : "v100";
}
