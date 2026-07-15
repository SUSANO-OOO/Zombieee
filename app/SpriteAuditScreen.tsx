"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { SPRITE_DIRECTIONS, fitSpriteBattleDisplaySize, spriteFrameFor, spriteKinds, spriteStatesFor } from "./spriteManifest.js";

type AuditMode = "original" | "enlarged" | "battle";
type Selection = { kind: string; state: string; direction: string };

const BATTLE_SIZES: Record<string, { w: number; h: number }> = {
  scout: { w: 58, h: 98 }, ranger: { w: 58, h: 98 }, brute: { w: 72, h: 108 }, brawler: { w: 62, h: 99 }, gunner: { w: 60, h: 100 }, medic: { w: 60, h: 100 },
  "crazy-king": { w: 72, h: 104 }, kumaverson: { w: 64, h: 102 }, babayaga: { w: 62, h: 103 }, walker: { w: 58, h: 96 }, runner: { w: 53, h: 90 }, turned: { w: 58, h: 96 },
  shade: { w: 64, h: 101 }, spitter: { w: 62, h: 101 }, crusher: { w: 80, h: 112 }, abomination: { w: 101, h: 132 }, takuya: { w: 94, h: 128 },
};

function SpriteCanvas({ selection, mode, gallery = false }: { selection: Selection; mode: AuditMode; gallery?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frame = spriteFrameFor(selection.kind, selection.state, selection.direction);
  const { w: battleWidth, h: battleHeight } = BATTLE_SIZES[selection.kind] ?? { w: 58, h: 96 };
  const battleSize = fitSpriteBattleDisplaySize(selection.kind, frame, { w: battleWidth, h: battleHeight });
  const dimensions = gallery ? { w: 112, h: 104 }
    : mode === "original" ? { w: frame.w, h: frame.h }
      : mode === "enlarged" ? { w: frame.w * 2, h: frame.h * 2 }
        : { w: Math.max(120, battleSize.w + 24), h: Math.max(144, battleSize.h + 24) };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let cancelled = false;
    const image = new Image();
    image.decoding = "async";
    image.onload = () => {
      if (cancelled) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.imageSmoothingEnabled = mode !== "enlarged";
      const target = gallery
        ? (() => { const scale = Math.min((canvas.width - 8) / frame.w, (canvas.height - 8) / frame.h); return { w: frame.w * scale, h: frame.h * scale }; })()
        : mode === "battle" ? battleSize : { w: canvas.width, h: canvas.height };
      ctx.save();
      ctx.translate(canvas.width / 2, canvas.height / 2);
      if (frame.flipX) ctx.scale(-1, 1);
      ctx.drawImage(image, frame.sourceRect.x, frame.sourceRect.y, frame.sourceRect.w, frame.sourceRect.h, -target.w / 2, -target.h / 2, target.w, target.h);
      ctx.restore();
    };
    image.src = frame.path;
    return () => { cancelled = true; };
  }, [battleSize, frame, gallery, mode]);

  return <canvas ref={canvasRef} width={dimensions.w} height={dimensions.h} data-mode={mode} data-flip-x={frame.flipX} aria-label={`${selection.kind} ${selection.state} ${selection.direction} ${mode}`} />;
}

export function SpriteAuditScreen() {
  const [selection, setSelection] = useState<Selection | null>(null);
  const [mode, setMode] = useState<AuditMode>("original");
  const frameCount = useMemo(() => spriteKinds.reduce((total, kind) => total + spriteStatesFor(kind).length * SPRITE_DIRECTIONS.length, 0), []);
  return <section className="sprite-audit-screen" aria-label="全戦闘スプライト監査">
    <header><div><small>LOCALHOST QA / SOURCE RECT MANIFEST</small><h1>全戦闘スプライト</h1></div><p><b>{spriteKinds.length}</b> kind / <b>{frameCount}</b> directional frames</p></header>
    <div className="sprite-audit-kinds">
      {spriteKinds.map((kind) => <article key={kind} data-kind={kind}><h2>{kind}<small>{spriteStatesFor(kind).length} states × 2 directions</small></h2><div>
        {spriteStatesFor(kind).flatMap((state) => SPRITE_DIRECTIONS.map((direction) => {
          const current = { kind, state, direction };
          const frame = spriteFrameFor(kind, state, direction);
          return <button key={`${state}-${direction}`} onClick={() => { setSelection(current); setMode("original"); }} aria-label={`${kind} ${state} ${direction}を原寸確認`}>
            <SpriteCanvas selection={current} mode="battle" gallery />
            <span><b>{state}</b><em>{direction}</em></span><small>src {frame.x},{frame.y} {frame.w}×{frame.h}<br />gutter {frame.gutter.left}/{frame.gutter.top}/{frame.gutter.right}/{frame.gutter.bottom}</small>
          </button>;
        }))}
      </div></article>)}
    </div>
    {selection && <div className="sprite-audit-detail" role="dialog" aria-modal="true" aria-label={`${selection.kind}フレーム詳細`}><section>
      <header><div><small>{selection.direction}</small><h2>{selection.kind} / {selection.state}</h2></div><button onClick={() => setSelection(null)}>閉じる</button></header>
      <nav aria-label="表示倍率"><button data-selected={mode === "original"} onClick={() => setMode("original")}>原寸</button><button data-selected={mode === "enlarged"} onClick={() => setMode("enlarged")}>2倍・補間なし</button><button data-selected={mode === "battle"} onClick={() => setMode("battle")}>実戦サイズ</button></nav>
      <div className="sprite-detail-canvas"><SpriteCanvas selection={selection} mode={mode} /></div>
      <dl>{Object.entries(spriteFrameFor(selection.kind, selection.state, selection.direction)).filter(([key]) => !["path", "sourceRect", "contentRect", "gutter", "anchor"].includes(key)).map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{String(value)}</dd></div>)}</dl>
    </section></div>}
  </section>;
}
