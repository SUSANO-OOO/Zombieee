"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { PRODUCTION_VISUALS, STORY_BACKGROUND_VISUALS, stageVisualFor } from "./productionVisuals.js";
import { PORTRAIT_ART } from "./spriteManifest.js";
import { PROLOGUE_SYNOPSIS, getStoryEvent, storyEventLog } from "./storyEvents.js";

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
  roleIcon: string;
  weaponName: string;
  attackMode: string;
  rangeBand: string;
  primaryTarget: string;
  deploymentHint: string;
  owned: boolean;
  discovered: boolean;
  recruitable: boolean;
  recruitCost: number;
  unlockHint: string;
};

export type FormationPresetView = {
  id: string;
  name: string;
  unitIds: readonly string[];
};

function artStyle(path: string) {
  return { "--campaign-art": `url('${path}')` } as CSSProperties;
}

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
  capsAfter: number;
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
  formationUnitIds: readonly string[];
  formationPresets: readonly FormationPresetView[];
  selectedFormationPresetId: string;
  supplies: readonly SupplyScreenView[];
  selectedSupply: string;
  supplyCurrency: number;
  caps: number;
  result: CampaignResultView | null;
  assetsReady: boolean;
  assetError: boolean;
  hasCampaignSave: boolean;
  saveRecoveryRequired: boolean;
  saveRecoveryReason: string;
  saveRecoveryCandidateSources: readonly string[];
  saveRecoveryCanExport: boolean;
  saveMutationPending: boolean;
  savePersistence: "checking" | "saved" | "recovered" | "unavailable";
  readStoryEventIds: readonly string[];
  autoSkipReadStory: boolean;
  onBegin: () => void;
  onRestartCampaign: () => void;
  onExportSave: () => void;
  onExportCorruptSave: () => void;
  onImportSave: (serialized: string) => void;
  onUseRecoveryCandidate: (source: string) => void;
  onResetCorruptSave: () => void;
  onEventComplete: () => void;
  onSetAutoSkipReadStory: (enabled: boolean) => void;
  onSelectStage: (stageId: string) => void;
  onOpenLoadout: () => void;
  onReturnToMap: () => void;
  onSelectFormationPreset: (presetId: string) => void;
  onToggleFormation: (unitId: string) => void;
  onRecruitUnit: (unitId: string) => void;
  onSelectSupply: (kind: string) => void;
  onStartBattle: () => void;
  onRetry: () => void;
  onContinueResult: () => void;
  onResetSave: () => void;
  onReloadAssets: () => void;
};

const portraitArt = PORTRAIT_ART as Record<string, string>;

function stars(value: number) {
  return `${"★".repeat(Math.max(0, Math.min(3, value)))}${"☆".repeat(Math.max(0, 3 - value))}`;
}

function formatTime(seconds: number) {
  const whole = Math.max(0, Math.floor(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

function SaveImportButton({ onImport, label = "バックアップを読み込む", disabled = false }: { onImport: (serialized: string) => void; label?: string; disabled?: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null);
  return <><button type="button" disabled={disabled} onClick={() => inputRef.current?.click()}>{disabled ? "保存処理中" : label}</button><input ref={inputRef} className="campaign-save-file" type="file" accept="application/json,.json" disabled={disabled} onChange={(event) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (file) void file.text().then(onImport);
  }} /></>;
}

function recoverySourceLabel(source: string) {
  if (source === "localStorage") return "端末保存";
  if (source === "indexedDB") return "予備保存";
  if (source === "memory-before-reset") return "操作前メモリ";
  return source;
}

function SaveRecoveryScreen({
  saveRecoveryReason,
  saveRecoveryCandidateSources,
  saveRecoveryCanExport,
  saveMutationPending,
  onExportCorruptSave,
  onImportSave,
  onUseRecoveryCandidate,
  onResetCorruptSave,
}: Pick<Props, "saveRecoveryReason" | "saveRecoveryCandidateSources" | "saveRecoveryCanExport" | "saveMutationPending" | "onExportCorruptSave" | "onImportSave" | "onUseRecoveryCandidate" | "onResetCorruptSave">) {
  const explanation = saveRecoveryReason === "both-corrupt"
    ? "端末内の2つの保存先がどちらも破損しています。自動で初期化せず、復旧方法を選べる状態で停止しました。"
    : saveRecoveryReason === "equal-freshness-conflict"
      ? "2つの保存先はどちらも読み取れますが、同じ更新番号で内容が異なります。誤った上書きを避けるため、自動選択を停止しました。"
      : saveRecoveryReason === "pre-migration-snapshot-failed"
        ? "旧セーブは読み取れますが、移行前バックアップを保存できません。元データを上書きせず、復旧方法を選べる状態で停止しました。"
        : saveRecoveryReason === "last-known-good-snapshot-failed"
          ? "有効なセーブは読み取れますが、更新前の退避を保存できません。別の保存候補を上書きせず、復旧方法を選べる状態で停止しました。"
        : saveRecoveryReason === "reset-rollback-failed"
          ? "初期化中の一部削除を元へ戻せませんでした。再読み込みせず、候補データを書き出してから復旧方法を選んでください。"
      : "有効なセーブを自動選択できませんでした。現在の候補を上書きせず、復旧方法を選べる状態で停止しました。";
  return <div className="campaign-overlay save-recovery-screen" role="alert" aria-label="セーブデータ復旧">
    <section><small>SAVE RECOVERY</small><h1>セーブデータを自動選択できません</h1><p>{explanation}</p><div>{saveRecoveryCanExport && <button disabled={saveMutationPending} onClick={onExportCorruptSave}>候補データを書き出す</button>}{saveRecoveryCandidateSources.map((source) => <button key={source} disabled={saveMutationPending} onClick={() => onUseRecoveryCandidate(source)}>{recoverySourceLabel(source)}の候補を使う</button>)}<SaveImportButton onImport={onImportSave} disabled={saveMutationPending} /><button className="danger" disabled={saveMutationPending} onClick={onResetCorruptSave}>{saveMutationPending ? "保存処理中" : "完全初期化"}</button></div><em>完全初期化すると、星・報酬・加入・編成を元に戻せません。</em></section>
  </div>;
}

function TitleScreen({ hasCampaignSave, savePersistence, saveMutationPending, onBegin, onRestartCampaign, onExportSave, onImportSave }: Pick<Props, "hasCampaignSave" | "savePersistence" | "saveMutationPending" | "onBegin" | "onRestartCampaign" | "onExportSave" | "onImportSave">) {
  const saveUnavailable = savePersistence === "checking" || savePersistence === "unavailable" || saveMutationPending;
  return <div className="campaign-overlay title-screen-v060" style={artStyle(PRODUCTION_VISUALS.title)} aria-label="西新世紀末物語 タイトル画面">
    <div className="title-atmosphere" aria-hidden="true"><i /><i /><i /><i /></div>
    <div className="title-logo" aria-label="西新世紀末物語">
      <small>にしじんせいきまつものがたり</small>
      <h1><span>西新</span><b>世紀末物語</b></h1>
      <p>アーリーアクセス版</p>
    </div>
    <p className="title-copy">三本の道。途切れた通信。まだ終わっていない街。</p>
    <section className="title-synopsis" aria-label="序章のあらすじ"><b>序章のあらすじ</b><p>{PROLOGUE_SYNOPSIS.short}</p></section>
    <div className="title-actions">
      <button className="campaign-primary title-start" disabled={saveUnavailable} onClick={onBegin}><span>{savePersistence === "checking" ? "セーブ確認中" : hasCampaignSave ? "物語を続ける" : "物語を始める"}</span><small>{savePersistence === "unavailable" ? "Safariの通常タブで開き直してください" : hasCampaignSave ? "保存した進行から再開" : "序章　新たな世界の始まり"}</small></button>
      {hasCampaignSave && <button className="campaign-secondary title-restart" disabled={saveUnavailable} onClick={onRestartCampaign}>{saveMutationPending ? "保存処理中" : "最初から始める"}</button>}
    </div>
    <div className="title-save-tools" aria-label="セーブ管理">{hasCampaignSave && <button disabled={saveMutationPending} onClick={onExportSave}>バックアップを書き出す</button>}<SaveImportButton onImport={onImportSave} disabled={saveMutationPending} /></div>
  </div>;
}

function StoryScreen({ eventId, readStoryEventIds, autoSkipReadStory, onEventComplete, onSetAutoSkipReadStory }: Pick<Props, "eventId" | "readStoryEventIds" | "autoSkipReadStory" | "onEventComplete" | "onSetAutoSkipReadStory">) {
  const [index, setIndex] = useState(0);
  const [logOpen, setLogOpen] = useState(false);
  const [skipOpen, setSkipOpen] = useState(false);
  const completedRef = useRef(false);
  const event = eventId ? getStoryEvent(eventId) : null;
  const line = event?.lines[index] ?? null;
  const log = useMemo(() => eventId ? storyEventLog(eventId, index) : [], [eventId, index]);
  const contextLine = useMemo(() => {
    if (!event || !line) return null;
    const candidates = [
      ...event.lines.slice(0, index).reverse(),
      ...event.lines.slice(index + 1),
    ];
    return candidates.find((candidate) => (
      candidate.portrait !== line.portrait
      && candidate.side !== line.side
      && Boolean(portraitArt[candidate.portrait])
    )) ?? null;
  }, [event, index, line]);
  const completeOnce = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    onEventComplete();
  }, [onEventComplete]);
  const eventRead = Boolean(eventId && readStoryEventIds.includes(eventId));
  useEffect(() => {
    if (!eventId || !eventRead || !autoSkipReadStory || completedRef.current) return;
    const timer = window.setTimeout(completeOnce, 0);
    return () => window.clearTimeout(timer);
  }, [autoSkipReadStory, completeOnce, eventId, eventRead]);
  if (!event || !line) return <div className="campaign-overlay event-screen"><button className="campaign-primary" onClick={completeOnce}>地図へ進む</button></div>;
  const art = portraitArt[line.portrait] ?? "";
  const contextArt = contextLine ? portraitArt[contextLine.portrait] ?? "" : "";
  const advance = () => index + 1 < event.lines.length ? setIndex((value) => value + 1) : completeOnce();
  const backgroundArt = STORY_BACKGROUND_VISUALS[event.background as keyof typeof STORY_BACKGROUND_VISUALS] ?? PRODUCTION_VISUALS.command;
  return <div className={`campaign-overlay event-screen event-${event.background} effect-${line.effect ?? "none"}`} style={artStyle(backgroundArt)} aria-label="会話イベント">
    <div className="event-vignette" />
    {contextLine && contextArt && <div className={`event-portrait inactive ${contextLine.side} ${contextLine.portrait === "guide" ? "guide" : contextLine.portrait === "radio" ? "radio" : ""}`} style={{ backgroundImage: `url('${contextArt}')` }} aria-hidden="true" />}
    <div className={`event-portrait active ${line.side} ${line.portrait === "guide" ? "guide" : line.portrait === "radio" ? "radio" : ""}`} data-expression={line.expression} style={art ? { backgroundImage: `url('${art}')` } : undefined} aria-hidden="true" />
    <div className="event-controls"><button onClick={() => setLogOpen((value) => !value)}>会話ログ</button><button onClick={() => setSkipOpen(true)}>スキップ</button></div>
    {logOpen && <section className="event-log" aria-label="会話ログ"><header><b>会話ログ</b><button onClick={() => setLogOpen(false)}>閉じる</button></header>{log.map((entry: { id: string; speaker: string; text: string }) => <p key={entry.id}><b>{entry.speaker}</b><span>{entry.text}</span></p>)}</section>}
    <button className="dialogue-box" onClick={advance} aria-label="セリフを送る">
      <span className="dialogue-name"><b>{line.speaker}</b><small>{line.role}</small></span>
      <span className="dialogue-text">{line.text}</span>
      <em>{index + 1 < event.lines.length ? "次へ" : "完了"} ▾</em>
    </button>
    {skipOpen && <div className="story-skip-confirm" role="alertdialog" aria-modal="true" aria-label="会話をスキップ"><section><h2>会話をスキップしますか？</h2><p>進行・加入・報酬・解放の結果は変わりません。</p><button onClick={completeOnce}>この会話だけスキップ</button><button onClick={() => { onSetAutoSkipReadStory(true); completeOnce(); }}>既読会話を今後自動スキップ</button><button className="cancel" onClick={() => setSkipOpen(false)}>キャンセル</button></section></div>}
  </div>;
}

function AreaMapScreen({ stages, selectedStage, supplyCurrency, saveMutationPending, onSelectStage, onOpenLoadout, onResetSave }: Pick<Props, "stages" | "selectedStage" | "supplyCurrency" | "saveMutationPending" | "onSelectStage" | "onOpenLoadout" | "onResetSave">) {
  const prologueComplete = stages.every((stage) => stage.completed);
  return <div className="campaign-overlay map-screen" style={artStyle(PRODUCTION_VISUALS.command)} aria-label="エリアマップ">
    <header className="campaign-header"><div><small>序章</small><h1>新たな世界の始まり</h1></div><div className="map-resource"><small>キャップ</small><b>{supplyCurrency}</b></div></header>
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
        <div className="stage-preview" style={artStyle(stageVisualFor(selectedStage.id))} role="img" aria-label={`${selectedStage.displayName}の作戦区域`} />
        <header><small>{selectedStage.missionLabel}</small><h2>{selectedStage.displayName}</h2><p>{selectedStage.threat}</p></header>
        <dl><div><dt>目的</dt><dd>{selectedStage.objective}</dd></div><div><dt>過去最高星</dt><dd className="star-text">{stars(selectedStage.bestStars)}</dd></div><div><dt>基本報酬</dt><dd>{selectedStage.baseReward} キャップ</dd></div><div><dt>次の未取得星報酬</dt><dd>{selectedStage.nextStarReward ? `${selectedStage.nextStarReward} キャップ` : "取得済み"}</dd></div></dl>
        <div className="star-criteria"><b>星判定</b>{selectedStage.starCriteria.map((criterion) => <span key={criterion}>{criterion}</span>)}</div>
        <button className="campaign-primary" onClick={onOpenLoadout}>編成へ進む</button>
      </aside>
    </div>
    <footer className="map-footer"><span>封鎖地点は今後の調査で解放されます</span><button disabled={saveMutationPending} onClick={onResetSave}>{saveMutationPending ? "保存処理中" : "セーブデータを初期化"}</button></footer>
  </div>;
}

function LoadoutScreen({ selectedStage, units, formationUnitIds, formationPresets, selectedFormationPresetId, caps, supplies, selectedSupply, assetsReady, assetError, onReturnToMap, onSelectFormationPreset, onToggleFormation, onRecruitUnit, onSelectSupply, onStartBattle, onReloadAssets }: Pick<Props, "selectedStage" | "units" | "formationUnitIds" | "formationPresets" | "selectedFormationPresetId" | "caps" | "supplies" | "selectedSupply" | "assetsReady" | "assetError" | "onReturnToMap" | "onSelectFormationPreset" | "onToggleFormation" | "onRecruitUnit" | "onSelectSupply" | "onStartBattle" | "onReloadAssets">) {
  return <div className="campaign-overlay formation-screen" style={artStyle(PRODUCTION_VISUALS.command)} aria-label="出撃編成">
    <header className="campaign-header"><button className="campaign-back" onClick={onReturnToMap}>← 地図へ</button><div><small>出撃編成</small><h1>{selectedStage.displayName}</h1></div><p>{selectedStage.objective}</p></header>
    <div className="formation-layout">
      <section className="formation-units" aria-label="使用ユニットを選択"><header className="formation-roster-header"><h2>出撃可能ユニット <small>{formationUnitIds.length}/7名選択中</small></h2><nav aria-label="部隊プリセット">{formationPresets.map((preset) => <button key={preset.id} data-active={preset.id === selectedFormationPresetId} onClick={() => onSelectFormationPreset(preset.id)} aria-pressed={preset.id === selectedFormationPresetId}><b>{preset.name}</b><small>{preset.unitIds.length}/7</small></button>)}</nav></header><div>{units.map((unit) => {
        const selected = formationUnitIds.includes(unit.id);
        const atCapacity = formationUnitIds.length >= 7 && !selected;
        const portrait = unit.discovered ? portraitArt[unit.kind] : "";
        const state = unit.owned ? "owned" : unit.recruitable ? "recruitable" : unit.discovered ? "discovered" : "unknown";
        return <article key={unit.id} className="formation-unit-card" data-state={state} data-selected={selected}>
          <button className="formation-unit-select" data-kind={unit.kind} data-unit-id={unit.id} data-selected={selected} disabled={!unit.owned || atCapacity} onClick={() => onToggleFormation(unit.id)} aria-pressed={selected} aria-label={unit.discovered ? `${unit.name}、${unit.role}、${unit.weaponName}、${unit.deploymentHint}` : "未発見の仲間"} title={unit.discovered ? `${unit.attackMode} / ${unit.primaryTarget} / ${unit.deploymentHint}` : undefined} style={portrait ? { "--formation-art": `url('${portrait}')` } as CSSProperties : undefined}>
            <span className="formation-portrait" /><span><b>{unit.discovered ? unit.name : "未発見"}</b><em>{unit.discovered && <><i>{unit.roleIcon}</i>{unit.role}</>}</em><small className="unit-combat">{unit.discovered ? `${unit.weaponName}・${unit.rangeBand}・${unit.primaryTarget}` : "物語を進めると情報が明らかになります"}</small>{unit.owned && <small className="unit-intent">配置：{unit.deploymentHint}</small>}</span><i>{unit.owned ? selected ? "選択中" : "待機" : unit.recruitable ? "調達可能" : unit.discovered ? "加入条件未達" : "未発見"}</i>
          </button>
          {unit.recruitable && !unit.owned && <button className="formation-unit-recruit" disabled={caps < unit.recruitCost} onClick={() => onRecruitUnit(unit.id)}><b>{unit.recruitCost}キャップで調達</b><small>所持 {caps}</small></button>}
        </article>;
      })}</div></section>
      <section className="formation-support" aria-label="戦場物資を選択"><h2>戦場物資</h2>{supplies.map((supply) => <button key={supply.kind} data-supply={supply.kind} data-selected={selectedSupply === supply.kind} onClick={() => onSelectSupply(supply.kind)} aria-pressed={selectedSupply === supply.kind}><b>{supply.name}</b><small>{supply.description}</small><em>▰{supply.cost}</em></button>)}<div className="formation-note"><b>固定支援</b><span>緊急航空支援 / 移動拠点一斉掃射</span></div></section>
    </div>
    <footer className="formation-footer"><p>1〜7名で出撃できます。同じ仲間は戦闘中に何度でも再召喚できます。</p><button className="campaign-primary" disabled={formationUnitIds.length === 0 || (!assetsReady && !assetError)} onClick={assetError ? onReloadAssets : onStartBattle}><span>{assetError ? "アセット再読込" : assetsReady ? "この編成で出撃" : "アセット準備中"}</span><small>{assetError ? "タップして再読込" : assetsReady ? selectedStage.missionLabel : "移動拠点を点検中"}</small></button></footer>
  </div>;
}

function ResultScreen({ selectedStage, result, onRetry, onContinueResult }: Pick<Props, "selectedStage" | "result" | "onRetry" | "onContinueResult">) {
  if (!result) return null;
  return <div className={`campaign-overlay result-screen ${result.won ? "win" : "lose"}`} style={artStyle(stageVisualFor(selectedStage.id))} aria-label="作戦結果">
    <section className="result-panel">
      <header><small>{selectedStage.displayName}</small><h1>{result.won ? "作戦成功" : "戦線崩壊"}</h1><div className="result-stars" aria-label={`今回の星 ${result.currentStars}`}>{stars(result.currentStars)}</div></header>
      <div className="result-records"><span><small>今回の星</small><b>{stars(result.currentStars)}</b></span><span><small>過去最高星</small><b>{stars(result.previousBestStars)}</b></span><span data-highlight={result.newBest}><small>最高記録更新</small><b>{result.newBest ? "更新" : "維持"}</b></span></div>
      <div className="result-rewards"><h2>獲得報酬</h2><dl><div><dt>通常クリア報酬</dt><dd>{result.clearReward}</dd></div><div><dt>新規星到達報酬</dt><dd>{result.newStarReward}</dd></div><div className="total"><dt>合計獲得キャップ</dt><dd>{result.totalReward}</dd></div></dl><p>所持：{result.capsAfter} キャップ</p></div>
      {(result.newlyUnlockedUnits.length > 0 || result.newlyUnlockedStages.length > 0) && <section className="result-unlocks" aria-live="polite"><h2>新たな戦力を解放</h2>{result.newlyUnlockedUnits.map((label) => <p key={`unit-${label}`}><b>ユニット</b><span>{label}</span></p>)}{result.newlyUnlockedStages.map((label) => <p key={`stage-${label}`}><b>作戦区域</b><span>{label}</span></p>)}</section>}
      <div className="result-stats"><span><small>作戦時間</small><b>{formatTime(result.time)}</b></span><span><small>撃破数</small><b>{result.kills}</b></span><span><small>移動拠点HP</small><b>{Math.round(result.baseHpRatio * 100)}%</b></span><span><small>戦闘不能</small><b>{result.unitsLost}</b></span></div>
      <footer><button className="campaign-secondary" onClick={onRetry}>同じ編成で再戦</button><button className="campaign-primary" onClick={onContinueResult}>{result.won ? "作戦後の通信へ" : "エリアマップへ"}</button></footer>
    </section>
  </div>;
}

export function CampaignScreens(props: Props) {
  if (props.saveRecoveryRequired) return <SaveRecoveryScreen saveRecoveryReason={props.saveRecoveryReason} saveRecoveryCandidateSources={props.saveRecoveryCandidateSources} saveRecoveryCanExport={props.saveRecoveryCanExport} saveMutationPending={props.saveMutationPending} onExportCorruptSave={props.onExportCorruptSave} onImportSave={props.onImportSave} onUseRecoveryCandidate={props.onUseRecoveryCandidate} onResetCorruptSave={props.onResetCorruptSave} />;
  if (props.screen === "battle") return null;
  if (props.screen === "title") return <TitleScreen hasCampaignSave={props.hasCampaignSave} savePersistence={props.savePersistence} saveMutationPending={props.saveMutationPending} onBegin={props.onBegin} onRestartCampaign={props.onRestartCampaign} onExportSave={props.onExportSave} onImportSave={props.onImportSave} />;
  if (props.screen === "event") return <StoryScreen key={props.eventId ?? "missing"} eventId={props.eventId} readStoryEventIds={props.readStoryEventIds} autoSkipReadStory={props.autoSkipReadStory} onEventComplete={props.onEventComplete} onSetAutoSkipReadStory={props.onSetAutoSkipReadStory} />;
  if (props.screen === "map") return <AreaMapScreen stages={props.stages} selectedStage={props.selectedStage} supplyCurrency={props.supplyCurrency} saveMutationPending={props.saveMutationPending} onSelectStage={props.onSelectStage} onOpenLoadout={props.onOpenLoadout} onResetSave={props.onResetSave} />;
  if (props.screen === "loadout") return <LoadoutScreen selectedStage={props.selectedStage} units={props.units} formationUnitIds={props.formationUnitIds} formationPresets={props.formationPresets} selectedFormationPresetId={props.selectedFormationPresetId} caps={props.caps} supplies={props.supplies} selectedSupply={props.selectedSupply} assetsReady={props.assetsReady} assetError={props.assetError} onReturnToMap={props.onReturnToMap} onSelectFormationPreset={props.onSelectFormationPreset} onToggleFormation={props.onToggleFormation} onRecruitUnit={props.onRecruitUnit} onSelectSupply={props.onSelectSupply} onStartBattle={props.onStartBattle} onReloadAssets={props.onReloadAssets} />;
  return <ResultScreen selectedStage={props.selectedStage} result={props.result} onRetry={props.onRetry} onContinueResult={props.onContinueResult} />;
}
