"use client";

import { lazy, Suspense, useSyncExternalStore } from "react";
import { resolveGameEntry } from "./gameEntryPolicy.js";

// The install screen must open without downloading either game.
const LegacyGame = lazy(() => import("./AshfallGame").then(({ AshfallGame }) => ({ default: AshfallGame })));
const Campaign = lazy(() => import("./V100Campaign").then(({ V100Campaign }) => ({ default: V100Campaign })));

const subscribe = () => () => {};
const getClientEntry = () => resolveGameEntry(window.location.hostname, window.location.search);
const getServerEntry = () => null;

export function GameEntry({ campaignOnly = false }: { campaignOnly?: boolean }) {
  const entry = useSyncExternalStore(subscribe, getClientEntry, getServerEntry);
  const loading = <p role="status">ゲームを準備しています。</p>;
  if (entry === null) return loading;
  return <Suspense fallback={loading}>
    {entry === "legacy" && !campaignOnly ? <LegacyGame /> : <Campaign />}
  </Suspense>;
}
