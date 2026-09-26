"use client";

import { useSyncExternalStore } from "react";
import { AshfallGame } from "./AshfallGame";
import { V100Campaign } from "./V100Campaign";
import { resolveGameEntry } from "./gameEntryPolicy.js";

const subscribe = () => () => {};
const getClientEntry = () => resolveGameEntry(window.location.hostname, window.location.search);
const getServerEntry = () => null;

export function GameEntry() {
  const entry = useSyncExternalStore(subscribe, getClientEntry, getServerEntry);
  if (entry === null) return <p role="status">ゲームを準備しています。</p>;
  return entry === "legacy" ? <AshfallGame /> : <V100Campaign />;
}
