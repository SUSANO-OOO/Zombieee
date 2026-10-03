"use client";

import { useState } from "react";
import { V100AssetCredits } from "./V100AssetCredits";

type Settings = { bgmEnabled: boolean; sfxEnabled: boolean; bgmVolume: number; sfxVolume: number; graphicsQuality: string; reducedMotion: boolean; autoSkipReadStory: boolean };
type Props = { settings: Settings; busy: boolean; onApply: (settings: Settings) => Promise<boolean>; onClose: () => void; onData: () => void; onLog: () => void };

export function V100PlayerMenu({ settings, busy, onApply, onClose, onData, onLog }: Props) {
  const [tab, setTab] = useState<"settings" | "credits">("settings");
  const [draft, setDraft] = useState(settings);
  const [failed, setFailed] = useState(false);
  const [saved, setSaved] = useState(false);
  const change = (values: Partial<Settings>) => { setDraft(current => ({ ...current, ...values })); setSaved(false); setFailed(false); };
  const apply = async () => { const accepted = await onApply(draft); setSaved(accepted); setFailed(!accepted); };
  return <div className="v100-modal-backdrop" role="presentation"><section className="v100-modal v100-player-menu" role="dialog" aria-modal="true" aria-labelledby="v100-menu-title">
    <div className="v100-panel-heading"><h2 id="v100-menu-title">メニュー</h2><button type="button" disabled={busy} onClick={onClose}>ゲームに戻る</button></div>
    <nav className="v100-menu-tabs" aria-label="メニューの種類"><button type="button" aria-pressed={tab === "settings"} onClick={() => setTab("settings")}>設定</button><button type="button" aria-pressed={tab === "credits"} onClick={() => setTab("credits")}>権利・クレジット</button><button type="button" disabled={busy} onClick={onData}>データ管理</button><button type="button" disabled={busy} onClick={onLog}>会話記録</button></nav>
    <div className="v100-menu-scroll">
      {tab === "credits" ? <V100AssetCredits expanded /> : <fieldset disabled={busy}>
        <legend>音・画面・会話</legend>
        <div className="v100-menu-audio"><label><input type="checkbox" checked={draft.bgmEnabled} onChange={e => change({ bgmEnabled: e.target.checked })} /> BGM</label><label>音量 <output>{Math.round(draft.bgmVolume * 100)}%</output><input aria-label="BGMの音量" type="range" min="0" max="100" value={Math.round(draft.bgmVolume * 100)} onChange={e => change({ bgmVolume: Number(e.target.value) / 100 })} /></label></div>
        <div className="v100-menu-audio"><label><input type="checkbox" checked={draft.sfxEnabled} onChange={e => change({ sfxEnabled: e.target.checked })} /> 効果音・戦闘ボイス</label><label>音量 <output>{Math.round(draft.sfxVolume * 100)}%</output><input aria-label="効果音と戦闘ボイスの音量" type="range" min="0" max="100" value={Math.round(draft.sfxVolume * 100)} onChange={e => change({ sfxVolume: Number(e.target.value) / 100 })} /></label></div>
        <div className="v100-menu-options"><label className="v100-menu-option">画質<select value={draft.graphicsQuality} onChange={e => change({ graphicsQuality: e.target.value })}><option value="high">高画質</option><option value="auto">自動</option><option value="power-save">省電力</option></select></label>
        <label className="v100-menu-option"><input type="checkbox" checked={draft.reducedMotion} onChange={e => change({ reducedMotion: e.target.checked })} /> 演出の動きを抑える</label>
        <label className="v100-menu-option"><input type="checkbox" checked={draft.autoSkipReadStory} onChange={e => change({ autoSkipReadStory: e.target.checked })} /> 読んだ会話を自動でスキップ</label>
        </div>
      </fieldset>}
    </div>
    {tab === "settings" && <div className="v100-menu-footer"><span role="status">{failed ? "設定を保存できませんでした。もう一度お試しください。" : saved ? "設定を保存しました。" : "初めて読む会話と報酬の確認は表示します。"}</span><button type="button" className="v100-primary" disabled={busy} onClick={() => void apply()}>設定を保存</button></div>}
  </section></div>;
}
