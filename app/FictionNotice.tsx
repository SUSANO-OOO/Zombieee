"use client";

import { useEffect, useState, type ReactNode } from "react";
import "./FictionNotice.css";

export function FictionNotice({ children }: { children: ReactNode }) {
  const [dismissed, setDismissed] = useState(false);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (leaving || dismissed) return;
    let remaining = 6000;
    let started = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let pageHidden = false;
    const pause = () => {
      if (timer === undefined) return;
      clearTimeout(timer);
      timer = undefined;
      remaining = Math.max(0, remaining - (performance.now() - started));
    };
    const visibility = () => {
      pause();
      if (document.hidden || pageHidden) return;
      started = performance.now();
      timer = setTimeout(() => { timer = undefined; setLeaving(true); }, remaining);
    };
    const hide = () => { pageHidden = true; visibility(); };
    const show = () => { pageHidden = false; visibility(); };
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("pagehide", hide);
    window.addEventListener("pageshow", show);
    visibility();
    return () => {
      pause();
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("pagehide", hide);
      window.removeEventListener("pageshow", show);
    };
  }, [leaving, dismissed]);

  useEffect(() => {
    if (!leaving) return;
    const timer = setTimeout(() => setDismissed(true), 500);
    return () => clearTimeout(timer);
  }, [leaving]);

  if (dismissed) return children;
  return <main className={`fiction-notice${leaving ? " fiction-notice-leaving" : ""}`} aria-labelledby="fiction-notice-title">
    <div className="fiction-notice-copy">
      <h1 id="fiction-notice-title">本作品はフィクションです。</h1>
      <p>登場する人物・団体・出来事などは架空であり、<br className="fiction-notice-line-break" />実在するものとは関係ありません。</p>
      <button type="button" onClick={() => setLeaving(true)} disabled={leaving}>続ける</button>
    </div>
  </main>;
}
