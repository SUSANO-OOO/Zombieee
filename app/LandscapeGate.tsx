"use client";

import { useState, useSyncExternalStore, type ReactNode } from "react";
import { LANDSCAPE_BLOCK_QUERY, readLandscape } from "./landscapePolicy.js";
import "./LandscapeGate.css";

const subscribe = (notify: () => void) => {
  const media = window.matchMedia(LANDSCAPE_BLOCK_QUERY);
  media.addEventListener("change", notify);
  return () => media.removeEventListener("change", notify);
};

export function LandscapeGate({ children }: { children: ReactNode }) {
  const landscape = useSyncExternalStore(subscribe, readLandscape, () => false);
  const [opened, setOpened] = useState(false);
  if (landscape && !opened) setOpened(true);
  return <div className="landscape-gate" data-landscape-ready={landscape}>
    <div className="landscape-gate-content" inert={!landscape} aria-hidden={!landscape}>{opened && children}</div>
    <section className="landscape-rotate-message" role="status" aria-label="横画面でプレイ">
      <svg viewBox="0 0 96 96" aria-hidden="true"><rect x="32" y="17" width="32" height="62" rx="5" /><path d="M12 43a37 37 0 0 1 30-31M12 43l-6-9m6 9 10-4M84 53a37 37 0 0 1-30 31m30-31 6 9m-6-9-10 4" /><circle cx="48" cy="70" r="1.5" /></svg>
      <h1>画面を横向きにしてください</h1>
      <p>横画面に戻すと続きから再開します。</p>
    </section>
  </div>;
}
