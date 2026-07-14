"use client";

import { useMemo, useState } from "react";
import { getStoryEvent, storyEventLog } from "./storyEvents.js";

export type CampaignScreen = "title" | "event" | "map" | "loadout" | "battle" | "result";

export type StageScreenView = {
  id: string;
  displayName: string;
  chapterName: string;
  objective: string;
  missionLabel: string;
  threat: string;
  unlocked: boolean;
  completed: boolean;
  bestStars: number;
  baseReward: number;
  nextStarReward: number;
  mapPosition: { x: number; y: number };
  starCriteria: readonly string[];
};

export type UnitScreenView = {
  id: string;
  kind: string;
  name: string;
  role: string;
  description: string;
  unlocked: boolean;
  unlockHint: string;
};

export type SupplyScreenView = {
  kind: string;
  name: string;
  cost: number;
  description: string;
};

export type CampaignResultView = {
  won: boolean;
  currentStars: number;
  previousBestStars: number;
  bestStars: number;
  newBest: boolean;
  clearReward: number;
  newStarReward: number;
  totalReward: number;
  suppliesAfter: number;
  time: number;
  kills: number;
  unitsLost: number;
  baseHpRatio: number;
  newlyUnlockedUnits: readonly string[];
  newlyUnlockedStages: readonly string[];
};

type Props = {
  screen: CampaignScreen;
  eventId: string | null;
  stages: readonly StageScreenView[];
  selectedStage: StageScreenView;
  units: readonly UnitScreenView[];
  formationKinds: readonly string[];
  supplies: readonly SupplyScreenView[];
  selectedSupply: string;
  supplyCurrency: number;
  result: CampaignResultView | null;
  assetsReady: boolean;
  assetError: boolean;
  hasCampaignSave: boolean;
  onBegin: () => void;
  onRestartCampaign: () => void;
  onEventComplete: () => void;
  onSelectStage: (stageId: string) => void;
  onOpenLoadout: () => void;
  onReturnToMap: () => void;
  onToggleFormation: (kind: string) => void;
  onSelectSupply: (kind: string) => void;
  onStartBattle: () => void;
  onRetry: () => void;
  onContinueResult: () => void;
  onResetSave: () => void;
  onReloadAssets: () => void;
};

const portraitArt: Record<string, string> = {
  scout: "/scout-sprites-v2.png",
  ranger: "/ranger-sprites-v1.png",
  brute: "/breaker-sprites-v2.png",
  brawler: "/brawler-sprites-v1.png",
  gunner: "/gunner-sprites-v1.png",
  medic: "/medic-sprites-v1.png",
};

function stars(value: number) {
  return `${"★".repeat(Math.max(0, Math.min(3, value)))}${"☆".repeat(Math.max(0, 3 - value))}`;
}

function formatTime(seconds: number) {
  const whole = Math.max(0, Math.floor(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

function TitleScreen({ hasCampaignSave, onBegin, onRestartCampaign }: Pick<Props, "hasCampaignSave" | "onBegin" | "onRestartCampaign">) {
  return <div className="campaign-overlay title-screen-v060" aria-label="西新世紀末物語 タイトル画面">
    <div className="title-atmosphere" aria-hidden="true"><i /><i /><i /><i /></div>
    <div className="title-logo" aria-label="西新世紀末物語">
      <small>にしじんせいきまつものがたり</small>
      <h1><span>西新</span><b>世紀末物語</b></h1>
      <p>アーリーアクセス版</p>
    </div>
    <p className="title-copy">三本の道。途切れた通信。まだ終わっていない街。</p>
    <div className="title-actions">
      <button className="campaign-primary title-start" onClick={onBegin}><span>{hasCampaignSave ? "物語を続ける" : "物語を始める"}</span><small>{hasCampaignSave ? "保存した進行から再開" : "序章　新たな世界の始まり"}</small></button>
      {hasCampaignSave && <button className="campaign-secondary title-restart" onClick={onRestartCampaign}>最初から始める</button>}
    </div>
  </div>;
}

function StoryScreen({ eventId, onEventComplete }: Pick<Props, "eventId" | "onEventComplete">) {
  const [index, setIndex] = useState(0);
  const [logOpen, setLogOpen] = useState(false);
  const event = eventId ? getStoryEvent(eventId) : null;
  const line = event?.lines[index] ?? null;
  const log = useMemo(() => eventId ? storyEventLog(eventId, index) : [], [eventId, index]);
  if (!event || !line) return <div className="campaign-overlay event-screen"><button className="campaign-primary" onClick={onEventComplete}>地図へ進む</button></div>;
  const art = portraitArt[line.portrait] ?? "";
  const advance = () => index + 1 < event.lines.length ? setIndex((value) => value + 1) : onEventComplete();
  return <div className={`campaign-overlay event-screen event-${event.background} effect-${line.effect ?? "none"}`} aria-label="会話イベント">
    <div className="event-vignette" />
    <div className={`event-portrait ${line.side} ${line.portrait === "guide" ? "guide" : ""}`} data-expression={line.expression} style={art ? { backgroundImage: `url('${art}')` } : undefined} aria-hidden="true" />
    <div className="event-controls"><button onClick={() => setLogOpen((value) => !value)}>会話ログ</button><button onClick={onEventComplete}>スキップ</button></div>
    {logOpen && <section className="event-log" aria-label="会話ログ"><header><b>会話ログ</b><button onClick={() => setLogOpen(false)}>閉じる</button></header>{log.map((entry: { id: string; speaker: string; text: string }) => <p key={entry.id}><b>{entry.speaker}</b><span>{entry.text}</span></p>)}</section>}
    <button className="dialogue-box" onClick={advance} aria-label="セリフを送る">
      <span className="dialogue-name"><b>{line.speaker}</b><small>{line.role}</small></span>
      <span className="dialogue-text">{line.text}</span>
      <em>{index + 1 < event.lines.length ? "次へ" : "完了"} ▾</em>
    </button>
  </div>;
}

function AreaMapScreen({ stages, selectedStage, supplyCurrency, onSelectStage, onOpenLoadout, onResetSave }: Pick<Props, "stages" | "selectedStage" | "supplyCurrency" | "onSelectStage" | "onOpenLoadout" | "onResetSave">) {
  const prologueComplete = stages.every((stage) => stage.completed);
  return <div className="campaign-overlay map-screen" aria-label="エリアマップ">
    <header className="campaign-header"><div><small>序章</small><h1>新たな世界の始まり</h1></div><div className="map-resource"><small>補給物資</small><b>{supplyCurrency}</b></div></header>
    <div className="map-layout">
      <section className="nishijin-map" aria-label="西新・早良区・百道浜 エリアマップ">
        <div className="map-water" /><div className="map-road road-a" /><div className="map-road road-b" /><div className="map-road road-c" />
        <div className="map-landmark tower"><i /><span>福岡タワー<small>高危険区域</small></span></div>
        <div className={`map-landmark coast ${prologueComplete ? "anomaly" : ""}`}><span>百道浜<small>{prologueComplete ? "異常反応" : "通信途絶"}</small></span></div>
        <div className="map-landmark subway"><span>地下鉄区域<small>経路封鎖</small></span></div>
        <div className="map-landmark police"><span>警察署周辺<small>調査中</small></span></div>
        <div className="map-landmark hospital"><span>病院<small>救難信号</small></span></div>
        <div className="map-landmark shelter"><span>学校・避難所<small>応答なし</small></span></div>
        <div className="map-landmark shoreline"><span>海岸線<small>高危険区域</small></span></div>
        <div className="map-landmark blockade"><span>封鎖区域<small>進入不能</small></span></div>
        {stages.map((stage, index) => <button
          key={stage.id}
          className={`stage-node ${stage.unlocked ? "open" : "locked"} ${selectedStage.id === stage.id ? "selected" : ""}`}
          style={{ left: `${stage.mapPosition.x}%`, top: `${stage.mapPosition.y}%` }}
          disabled={!stage.unlocked}
          onClick={() => onSelectStage(stage.id)}
          aria-label={`${stage.displayName} ${stage.unlocked ? stars(stage.bestStars) : "封鎖中"}`}
        ><span>{index + 1}</span><b>{stage.displayName}</b><em>{stage.unlocked ? stars(stage.bestStars) : "封鎖"}</em></button>)}
      </section>
      <aside className="stage-detail" aria-label="選択中のステージ詳細">
        <header><small>{selectedStage.missionLabel}</small><h2>{selectedStage.displayName}</h2><p>{selectedStage.threat}</p></header>
        <dl><div><dt>目的</dt><dd>{selectedStage.objective}</dd></div><div><dt>過去最高星</dt><dd className="star-text">{stars(selectedStage.bestStars)}</dd></div><div><dt>基本報酬</dt><dd>{selectedStage.baseReward} 補給物資</dd></div><div><dt>次の未取得星報酬</dt><dd>{selectedStage.nextStarReward ? `${selectedStage.nextStarReward} 補給物資` : "取得済み"}</dd></div></dl>
        <div className="star-criteria"><b>星判定</b>{selectedStage.starCriteria.map((criterion) => <span key={criterion}>{criterion}</span>)}</div>
        <button className="campaign-primary" onClick={onOpenLoadout}>編成へ進む</button>
      </aside>
    </div>
    <footer className="map-footer"><span>封鎖地点は今後の調査で解放されます</span><button onClick={onResetSave}>セーブデータを初期化</button></footer>
  </div>;
}

function LoadoutScreen({ selectedStage, units, formationKinds, supplies, selectedSupply, assetsReady, assetError, onReturnToMap, onToggleFormation, onSelectSupply, onStartBattle, onReloadAssets }: Pick<Props, "selectedStage" | "units" | "formationKinds" | "supplies" | "selectedSupply" | "assetsReady" | "assetError" | "onReturnToMap" | "onToggleFormation" | "onSelectSupply" | "onStartBattle" | "onReloadAssets">) {
  return <div className="campaign-overlay formation-screen" aria-label="出撃編成">
    <header className="campaign-header"><button className="campaign-back" onClick={onReturnToMap}>← 地図へ</button><div><small>出撃編成</small><h1>{selectedStage.displayName}</h1></div><p>{selectedStage.objective}</p></header>
    <div className="formation-layout">
      <section className="formation-units" aria-label="使用ユニットを選択"><h2>出撃可能ユニット <small>{formationKinds.length}名選択中</small></h2><div>{units.map((unit) => {
        const selected = formationKinds.includes(unit.kind);
        return <button key={unit.id} data-kind={unit.kind} data-selected={selected} disabled={!unit.unlocked} onClick={() => onToggleFormation(unit.kind)} aria-pressed={selected}>
          <span className="formation-portrait" /><span><b>{unit.name}</b><em>{unit.role}</em><small>{unit.unlocked ? unit.description : unit.unlockHint}</small></span><i>{unit.unlocked ? selected ? "選択中" : "待機" : "未解放"}</i>
        </button>;
      })}</div></section>
      <section className="formation-support" aria-label="戦場物資を選択"><h2>戦場物資</h2>{supplies.map((supply) => <button key={supply.kind} data-supply={supply.kind} data-selected={selectedSupply === supply.kind} onClick={() => onSelectSupply(supply.kind)} aria-pressed={selectedSupply === supply.kind}><b>{supply.name}</b><small>{supply.description}</small><em>▰{supply.cost}</em></button>)}<div className="formation-note"><b>固定支援</b><span>緊急航空支援 / 移動拠点一斉掃射</span></div></section>
    </div>
    <footer className="formation-footer"><p>3レーンを維持。倒れた仲間の異変に注意し、炎で感染を防いでください。</p><button className="campaign-primary" disabled={formationKinds.length === 0 || (!assetsReady && !assetError)} onClick={assetError ? onReloadAssets : onStartBattle}><span>{assetError ? "アセット再読込" : assetsReady ? "この編成で出撃" : "アセット準備中"}</span><small>{assetError ? "タップして再読込" : assetsReady ? selectedStage.missionLabel : "移動拠点を点検中"}</small></button></footer>
  </div>;
}

function ResultScreen({ selectedStage, result, onRetry, onContinueResult }: Pick<Props, "selectedStage" | "result" | "onRetry" | "onContinueResult">) {
  if (!result) return null;
  return <div className={`campaign-overlay result-screen ${result.won ? "win" : "lose"}`} aria-label="作戦結果">
    <section className="result-panel">
      <header><small>{selectedStage.displayName}</small><h1>{result.won ? "作戦成功" : "戦線崩壊"}</h1><div className="result-stars" aria-label={`今回の星 ${result.currentStars}`}>{stars(result.currentStars)}</div></header>
      <div className="result-records"><span><small>今回の星</small><b>{stars(result.currentStars)}</b></span><span><small>過去最高星</small><b>{stars(result.previousBestStars)}</b></span><span data-highlight={result.newBest}><small>最高記録更新</small><b>{result.newBest ? "更新" : "維持"}</b></span></div>
      <div className="result-rewards"><h2>獲得報酬</h2><dl><div><dt>通常クリア報酬</dt><dd>{result.clearReward}</dd></div><div><dt>新規星到達報酬</dt><dd>{result.newStarReward}</dd></div><div className="total"><dt>合計獲得補給物資</dt><dd>{result.totalReward}</dd></div></dl><p>所持：{result.suppliesAfter} 補給物資</p></div>
      {(result.newlyUnlockedUnits.length > 0 || result.newlyUnlockedStages.length > 0) && <section className="result-unlocks" aria-live="polite"><h2>新たな戦力を解放</h2>{result.newlyUnlockedUnits.map((label) => <p key={`unit-${label}`}><b>ユニット</b><span>{label}</span></p>)}{result.newlyUnlockedStages.map((label) => <p key={`stage-${label}`}><b>作戦区域</b><span>{label}</span></p>)}</section>}
      <div className="result-stats"><span><small>作戦時間</small><b>{formatTime(result.time)}</b></span><span><small>撃破数</small><b>{result.kills}</b></span><span><small>移動拠点HP</small><b>{Math.round(result.baseHpRatio * 100)}%</b></span><span><small>戦闘不能</small><b>{result.unitsLost}</b></span></div>
      <footer><button className="campaign-secondary" onClick={onRetry}>同じ編成で再戦</button><button className="campaign-primary" onClick={onContinueResult}>{result.won ? "作戦後の通信へ" : "エリアマップへ"}</button></footer>
    </section>
  </div>;
}

export function CampaignScreens(props: Props) {
  if (props.screen === "battle") return null;
  if (props.screen === "title") return <TitleScreen hasCampaignSave={props.hasCampaignSave} onBegin={props.onBegin} onRestartCampaign={props.onRestartCampaign} />;
  if (props.screen === "event") return <StoryScreen key={props.eventId ?? "missing"} eventId={props.eventId} onEventComplete={props.onEventComplete} />;
  if (props.screen === "map") return <AreaMapScreen stages={props.stages} selectedStage={props.selectedStage} supplyCurrency={props.supplyCurrency} onSelectStage={props.onSelectStage} onOpenLoadout={props.onOpenLoadout} onResetSave={props.onResetSave} />;
  if (props.screen === "loadout") return <LoadoutScreen selectedStage={props.selectedStage} units={props.units} formationKinds={props.formationKinds} supplies={props.supplies} selectedSupply={props.selectedSupply} assetsReady={props.assetsReady} assetError={props.assetError} onReturnToMap={props.onReturnToMap} onToggleFormation={props.onToggleFormation} onSelectSupply={props.onSelectSupply} onStartBattle={props.onStartBattle} onReloadAssets={props.onReloadAssets} />;
  return <ResultScreen selectedStage={props.selectedStage} result={props.result} onRetry={props.onRetry} onContinueResult={props.onContinueResult} />;
}
