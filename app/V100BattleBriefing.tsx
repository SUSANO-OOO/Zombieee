"use client";

import {useEffect,useState,type ReactNode} from "react";
import {createPortal} from "react-dom";
import { v100BasePresentationFor } from "./v100BasePresentation.js";
import "./v100BattleBriefing.css";

export function V100BattleBriefing({ children, initiallyShowControls = false, allowControls = true, stageNumber, onClose }: {
  children: ReactNode;
  initiallyShowControls?: boolean;
  allowControls?: boolean;
  stageNumber?: number;
  onClose: () => void;
}) {
  const [controls,setControls]=useState(initiallyShowControls);
  const base = v100BasePresentationFor(stageNumber);
  useEffect(()=>{
    const escape=(event:KeyboardEvent)=>{if(event.key==="Escape"){event.preventDefault();onClose();}};
    window.addEventListener("keydown",escape);
    return()=>window.removeEventListener("keydown",escape);
  },[onClose]);
  if(typeof document==="undefined")return null;
  return createPortal(<div className="v100-briefing-backdrop">
    <section className="v100-battle-briefing" role="dialog" aria-modal="true" aria-labelledby="v100-battle-briefing-title">
      <header><div className="v100-briefing-heading"><small aria-hidden="true">西新 生存者部隊 / 作戦資料</small><h2 id="v100-battle-briefing-title">{allowControls?"作戦と戦い方":"編成の確認"}</h2></div>{allowControls && <nav aria-label="説明の切り替え"><button type="button" aria-pressed={!controls} onClick={()=>setControls(false)}>作戦</button><button type="button" aria-pressed={controls} onClick={()=>setControls(true)}>戦い方</button></nav>}<button type="button" data-ui-sound="cancel" onClick={onClose}>閉じる</button></header>
      <div className="v100-briefing-page" tabIndex={0} aria-label={controls?"戦闘の操作":"今回の作戦"}>
        {controls?<>
          <ol className="v100-battle-instructions">
            <li><span aria-hidden="true">01</span><h3>仲間を呼ぶ</h3><p>画面下のカードを押すと、{base.onFoot ? "退路側" : "車両"}から出撃。移動と通常攻撃は、仲間が自動で行う。</p></li>
            <li><span aria-hidden="true">02</span><h3>手動アビリティ</h3><p>仲間の頭上の技ボタンで発動。使いどきや狙い先に迷ったら、一時停止から「仲間の技」を確かめよう。</p></li>
            <li><span aria-hidden="true">03</span><h3>支援を使う</h3><p>航空支援はボタンを押し、戦場で着弾地点をタップ。着弾まで少し時間がかかる。{base.barrageLabel}はボタンを押すだけ。どちらも支援ゲージを使う。</p></li>
          </ol>
          <p className="v100-battle-instructions-note">指揮は時間で回復する。仲間は同時に7体まで。{base.healthLabel}がなくなる前に、画面上の目標を達成しよう。</p>
        </>:children}
      </div>
    </section>
  </div>,document.body);
}
