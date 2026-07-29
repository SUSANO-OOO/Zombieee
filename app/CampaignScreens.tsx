"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { PRODUCTION_VISUALS, STORY_BACKGROUND_VISUALS, stageVisualFor } from "./productionVisuals.js";
import { FORMATION_CARD_ART, PERSONNEL_CARD_ART, PORTRAIT_ART } from "./spriteManifest.js";
import { PROLOGUE_SYNOPSIS, getStoryEvent, storyEventLog } from "./storyEvents.js";
import { CAMPAIGN_IMPORT_MAX_BYTES } from "./campaignStorage.js";
import { RELEASE_LABEL } from "./releaseIdentity.js";
import { MANUAL_ABILITY_REGISTRY } from "./manualAbilities.js";

export type CampaignScreen = "title" | "event" | "map" | "personnel" | "loadout" | "battle" | "result" | "survival" | "survival-result" | "outbreak" | "outbreak-result" | "records";

export type StageScreenView = {
  id: string;
  stageNumber: number;
  regionId: string;
  regionLabel: string;
  regionName: string;
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

const MAP_LANDMARKS: Record<string, readonly { className: string; label: string; status: string }[]> = {
  "region-nishijin": [
    { className: "tower", label: "福岡タワー", status: "高危険区域" },
    { className: "subway", label: "西新駅地下", status: "暫定封鎖" },
    { className: "police", label: "警察署周辺", status: "調査中" },
    { className: "hospital", label: "大学病院", status: "地下信号を確認" },
  ],
  "region-university-hospital": [
    { className: "hospital", label: "救急搬入口", status: "感染体接近" },
    { className: "shelter", label: "救急病棟", status: "中継反応あり" },
    { className: "subway", label: "地下搬送口", status: "研究区画へ接続" },
  ],
  "region-underground-research": [
    { className: "blockade", label: "除染ゲート", status: "隔離扉停止" },
    { className: "police", label: "検体隔離環", status: "制御再起動待ち" },
    { className: "subway", label: "搬送坑道", status: "地上線へ接続" },
  ],
  "region-logistics-line": [
    { className: "coast", label: "中継ヤード", status: "通信汚染" },
    { className: "shelter", label: "貨物退避場", status: "避難列待機" },
    { className: "shoreline", label: "湾岸搬出路", status: "高危険区域" },
  ],
  "region-t-plan-core": [
    { className: "blockade", label: "外郭制御環", status: "指令核稼働" },
    { className: "hospital", label: "中央封鎖核", status: "感染裂孔を確認" },
    { className: "coast", label: "観測区画", status: "応答なし" },
  ],
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
  level: number;
  maxLevel: number;
  levelCap: number;
  nextUpgradeCost: number | null;
  upgradeBlockedReason: string;
  upgradeBaseCost: number;
  upgradeDiscount: number;
  catchUp: boolean;
  milestones: readonly string[];
  nextMilestones: readonly string[];
  statSummary: string;
  nextStatSummary: string;
  nextStatCompact: string;
};

export type UpgradeFeedbackView = {
  unitId: string;
  level: number;
  reachedMax: boolean;
  spentCaps: number;
  statDelta: string;
  milestones: readonly string[];
  receipt: string;
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
  missionFacts: readonly string[];
  newlyUnlockedUnits: readonly string[];
  newlyUnlockedStages: readonly string[];
};

export type OutbreakMissionScreenView = {
  id: string;
  displayName: string;
  location: string;
  objective: string;
  bossName: string;
  bossClassification: string;
  bossImagePath: string;
  prerequisiteLabel: string;
  unlocked: boolean;
  cleared: boolean;
  defeatCount: number;
  baseRewardCaps: number;
  equipmentName: string;
};

export type OutbreakResultView = {
  missionId: string;
  displayName: string;
  bossName: string;
  won: boolean;
  firstClear: boolean;
  time: number;
  kills: number;
  unitsLost: number;
  earnedCaps: number;
  equipmentGrants: readonly { equipmentId: string; displayName: string; quantity: number }[];
  survivalUnlocked: boolean;
  capsAfter: number;
};

export type RecordsSummaryView = {
  battles: number;
  victories: number;
  defeats: number;
  withdrawals: number;
  battleSeconds: number;
  kills: number;
  bossKills: number;
  unitsLost: number;
  capsEarned: number;
  clearedStages: number;
  totalStages: number;
  collectedStars: number;
  highestSurvivalWave: number;
  survivalRuns: number;
  outbreakClears: number;
  recentResults: readonly {
    resultId: string;
    operationLabel: string;
    categoryLabel: string;
    outcomeLabel: string;
    kills: number;
    reachedWave: number;
    completedAt: string;
  }[];
  unitStats: readonly {
    kind: string;
    displayName: string;
    damage: number;
    damageTaken: number;
    healing: number;
  }[];
};

export type EnemyCompendiumView = {
  id: string;
  displayName: string;
  classification: string;
  encountered: boolean;
  firstEncounterLabel: string;
  encounterCount: number;
  defeatCount: number;
  attackProfile: string;
  artStyle: CSSProperties;
};

export type BossCompendiumView = {
  id: string;
  displayName: string;
  classification: string;
  encountered: boolean;
  firstEncounterLabel: string;
  defeatCount: number;
  attackName: string;
  attackSummary: string;
  weakness: string;
  equipmentName: string;
  artStyle: CSSProperties;
};

export type SaveEnvironmentView = {
  kind: string;
  label: string;
  origin: string;
  storageScope: string;
  isolationNotice: string;
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
  outbreakMissions: readonly OutbreakMissionScreenView[];
  selectedOutbreakMissionId: string | null;
  outbreakResult: OutbreakResultView | null;
  recordsSummary: RecordsSummaryView;
  enemyCompendium: readonly EnemyCompendiumView[];
  bossCompendium: readonly BossCompendiumView[];
  loadoutReturnLabel: string;
  assetsReady: boolean;
  assetError: boolean;
  hasCampaignSave: boolean;
  saveRecoveryRequired: boolean;
  saveRecoveryReason: string;
  saveRecoveryCandidateSources: readonly string[];
  saveRecoveryCanExport: boolean;
  saveMutationPending: boolean;
  upgradePendingUnitIds: readonly string[];
  upgradeFeedback: UpgradeFeedbackView | null;
  personnelInitialMode: "roster" | "acquisition";
  savePersistence: "checking" | "saved" | "recovered" | "unavailable";
  saveEnvironment: SaveEnvironmentView;
  readStoryEventIds: readonly string[];
  autoSkipReadStory: boolean;
  forceStoryReplay: boolean;
  onBegin: () => void;
  onRestartCampaign: () => void;
  onExportSave: () => void;
  onExportCorruptSave: () => void;
  onImportSave: (serialized: string) => void;
  onUseRecoveryCandidate: (source: string) => void;
  onResetCorruptSave: () => void;
  onEventComplete: () => void;
  onEventSkip: () => void;
  onStoryAudioPositionChange: (eventId: string, lineIndex: number) => void;
  onSetAutoSkipReadStory: (enabled: boolean) => void;
  onReplayPrologue: () => void;
  onSelectStage: (stageId: string) => void;
  onOpenPersonnel: () => void;
  onOpenLoadout: () => void;
  onOpenSurvival: () => void;
  onOpenOutbreak: () => void;
  onOpenRecords: () => void;
  onSelectOutbreakMission: (missionId: string) => void;
  onPrepareOutbreak: () => void;
  onReturnToMap: () => void;
  onReturnFromLoadout: () => void;
  onSelectFormationPreset: (presetId: string) => void;
  onToggleFormation: (unitId: string) => void;
  onRecruitUnit: (unitId: string) => void;
  onUpgradeUnit: (unitId: string) => void;
  onSelectSupply: (kind: string) => void;
  onStartBattle: () => void;
  onRetry: () => void;
  onContinueResult: () => void;
  onContinueOutbreakResult: () => void;
  onResetSave: () => void;
  onReloadAssets: () => void;
};

const portraitArt = PORTRAIT_ART as Record<string, string>;
const formationCardArt = FORMATION_CARD_ART as Record<string, string>;
const personnelCardArt = PERSONNEL_CARD_ART as Record<string, string>;
const v090IdentityMasterKinds = new Set(["zakimiya", "tky", "mrs-chiha", "miyamoto-musashi", "mayo-chan"]);

export function EmploymentAvailablePopup({
  unit,
  pending,
  saveError,
  onOpenEmployment,
  onDismiss,
}: {
  unit: UnitScreenView;
  pending: boolean;
  saveError: boolean;
  onOpenEmployment: () => void;
  onDismiss: () => void;
}) {
  const portrait = personnelCardArt[unit.kind] ?? "";
  return <div className="employment-available-popup" role="alertdialog" aria-modal="true" aria-label={`${unit.name}が雇用可能`}>
    <section>
      <small>NEW EMPLOYMENT DOSSIER</small>
      <div className="employment-dossier">
        <div className="employment-dossier-art" data-kind={unit.kind} style={portrait ? { backgroundImage: `url('${portrait}')` } : undefined} role="img" aria-label={`${unit.name}正式人物カード`} />
        <div>
          <em>雇用可能</em>
          <h2>{unit.name}</h2>
          <b>{unit.role}{" // "}{unit.weaponName}</b>
          <p>{unit.description}</p>
          <dl><div><dt>解放理由</dt><dd>{unit.unlockHint}</dd></div><div><dt>雇用費</dt><dd>{unit.recruitCost} キャップ</dd></div></dl>
        </div>
      </div>
      {saveError && <p className="employment-save-error" role="alert">通知確認を端末へ保存できませんでした。通常ブラウザの保存設定を確認して、もう一度お試しください。</p>}
      <footer><button className="campaign-primary" disabled={pending} onClick={onOpenEmployment}>{pending ? "保存中" : "雇用画面へ"}</button><button disabled={pending} onClick={onDismiss}>あとで</button></footer>
    </section>
  </div>;
}

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
    if (!file) return;
    if (file.size > CAMPAIGN_IMPORT_MAX_BYTES) {
      window.alert("バックアップのサイズが上限を超えています。現在のセーブは変更していません。");
      return;
    }
    void file.text()
      .then(onImport)
      .catch(() => window.alert("バックアップを読み込めませんでした。現在のセーブは変更していません。"));
  }} /></>;
}

function recoverySourceLabel(source: string) {
  if (source === "localStorage") return "端末保存";
  if (source === "indexedDB") return "予備保存";
  if (source === "memory-before-reset") return "操作前メモリ";
  return source;
}

function SaveEnvironmentBadge({ environment }: { environment: SaveEnvironmentView }) {
  return <aside
    className="save-environment-badge"
    data-save-environment={environment.kind}
    data-save-origin={environment.origin}
    aria-label="セーブ保存環境"
  >
    <span><b>{environment.label}</b><code>{environment.origin}</code></span>
    <small>{environment.storageScope}　{environment.isolationNotice}</small>
  </aside>;
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
  saveEnvironment,
}: Pick<Props, "saveRecoveryReason" | "saveRecoveryCandidateSources" | "saveRecoveryCanExport" | "saveMutationPending" | "onExportCorruptSave" | "onImportSave" | "onUseRecoveryCandidate" | "onResetCorruptSave" | "saveEnvironment">) {
  const explanation = saveRecoveryReason === "both-corrupt"
    ? "端末内の2つの保存先がどちらも破損しています。自動で初期化せず、復旧方法を選べる状態で停止しました。"
    : saveRecoveryReason === "replica-unreadable"
      ? "保存先の一方を現在読み取れません。見えていない新しいデータの上書きを避けるため、再読込または明示的な復旧まで停止しました。"
    : saveRecoveryReason === "revealed-replica-conflict"
      ? "先ほど読めなかった保存先から別の有効なセーブが見つかりました。自動上書きせず、使う候補を改めて選べる状態で停止しました。"
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
    <section><small>SAVE RECOVERY</small><h1>セーブデータを自動選択できません</h1><SaveEnvironmentBadge environment={saveEnvironment} /><p>{explanation}</p><div>{saveRecoveryCanExport && <button disabled={saveMutationPending} onClick={onExportCorruptSave}>候補データを書き出す</button>}{saveRecoveryCandidateSources.map((source) => <button key={source} disabled={saveMutationPending} onClick={() => onUseRecoveryCandidate(source)}>{recoverySourceLabel(source)}の候補を使う</button>)}<SaveImportButton onImport={onImportSave} disabled={saveMutationPending} /><button className="danger" disabled={saveMutationPending} onClick={onResetCorruptSave}>{saveMutationPending ? "保存処理中" : "完全初期化"}</button></div><em>完全初期化すると、星・報酬・加入・編成を元に戻せません。</em></section>
  </div>;
}

function TitleScreen({ hasCampaignSave, savePersistence, saveMutationPending, saveEnvironment, onBegin, onRestartCampaign, onExportSave, onImportSave }: Pick<Props, "hasCampaignSave" | "savePersistence" | "saveMutationPending" | "saveEnvironment" | "onBegin" | "onRestartCampaign" | "onExportSave" | "onImportSave">) {
  const saveUnavailable = savePersistence === "checking" || savePersistence === "unavailable" || saveMutationPending;
  return <div className="campaign-overlay title-screen-v060" style={artStyle(PRODUCTION_VISUALS.title)} aria-label="西新世紀末物語 タイトル画面">
    <div className="title-atmosphere" aria-hidden="true"><i /><i /><i /><i /></div>
    <div className="title-logo" aria-label="西新世紀末物語">
      <small>にしじんせいきまつものがたり</small>
      <h1><span>西新</span><b>世紀末物語</b></h1>
      <p>アーリーアクセス版　{RELEASE_LABEL}</p>
    </div>
    <p className="title-copy">西新が終わった夜から四十三日。指揮官の作戦が、街の明日をつなぐ。</p>
    <SaveEnvironmentBadge environment={saveEnvironment} />
    <section className="title-synopsis" aria-label="物語のあらすじ"><b>物語のあらすじ</b><p>{PROLOGUE_SYNOPSIS.short}</p></section>
    <div className="title-actions">
      <button className="campaign-primary title-start" disabled={saveUnavailable} onClick={onBegin}><span>{savePersistence === "checking" ? "セーブ確認中" : hasCampaignSave ? "物語を続ける" : "物語を始める"}</span><small>{savePersistence === "unavailable" ? "Safariの通常タブで開き直してください" : hasCampaignSave ? "保存した進行から再開" : "PROLOGUE　西新が終わった夜"}</small></button>
      {hasCampaignSave && <button className="campaign-secondary title-restart" disabled={saveUnavailable} onClick={onRestartCampaign}>{saveMutationPending ? "保存処理中" : "最初から始める"}</button>}
    </div>
    <div className="title-save-tools" aria-label="セーブ管理">{hasCampaignSave && <button disabled={saveMutationPending} onClick={onExportSave}>バックアップを書き出す</button>}<SaveImportButton onImport={onImportSave} disabled={saveMutationPending} /></div>
  </div>;
}

function StoryScreen({ eventId, readStoryEventIds, autoSkipReadStory, forceStoryReplay, onEventComplete, onEventSkip, onStoryAudioPositionChange, onSetAutoSkipReadStory }: Pick<Props, "eventId" | "readStoryEventIds" | "autoSkipReadStory" | "forceStoryReplay" | "onEventComplete" | "onEventSkip" | "onStoryAudioPositionChange" | "onSetAutoSkipReadStory">) {
  const [index, setIndex] = useState(0);
  const [logOpen, setLogOpen] = useState(false);
  const [skipOpen, setSkipOpen] = useState(false);
  const [silenceTail, setSilenceTail] = useState(false);
  const completedRef = useRef(false);
  const silenceTailStartedRef = useRef(false);
  const silenceTimerRef = useRef<number | null>(null);
  const event = eventId ? getStoryEvent(eventId) : null;
  const line = event?.lines[index] ?? null;
  const log = useMemo(() => eventId ? storyEventLog(eventId, index) : [], [eventId, index]);
  const completeOnce = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    onEventComplete();
  }, [onEventComplete]);
  const skipOnce = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    onEventSkip();
  }, [onEventSkip]);
  const completeWithAuthoredSilence = useCallback(() => {
    if (!event || completedRef.current || silenceTailStartedRef.current) return;
    const holdMs = event.presentation.silenceAfterMs;
    if (!(holdMs > 0)) {
      completeOnce();
      return;
    }
    silenceTailStartedRef.current = true;
    setSilenceTail(true);
    onStoryAudioPositionChange(event.id, event.lines.length);
    silenceTimerRef.current = window.setTimeout(completeOnce, holdMs);
  }, [completeOnce, event, onStoryAudioPositionChange]);
  const eventRead = Boolean(eventId && readStoryEventIds.includes(eventId));
  useEffect(() => {
    if (!event || silenceTailStartedRef.current) return;
    onStoryAudioPositionChange(event.id, index);
  }, [event, index, onStoryAudioPositionChange]);
  useEffect(() => () => {
    if (silenceTimerRef.current !== null) window.clearTimeout(silenceTimerRef.current);
  }, []);
  useEffect(() => {
    if (!eventId || !eventRead || !autoSkipReadStory || forceStoryReplay || completedRef.current) return;
    const timer = window.setTimeout(completeOnce, 0);
    return () => window.clearTimeout(timer);
  }, [autoSkipReadStory, completeOnce, eventId, eventRead, forceStoryReplay]);
  if (!event || !line) return <div className="campaign-overlay event-screen"><button className="campaign-primary" onClick={completeOnce}>地図へ進む</button></div>;
  const art = portraitArt[line.portrait] ?? "";
  const advance = () => {
    if (silenceTail) return;
    if (index + 1 < event.lines.length) setIndex((value) => value + 1);
    else completeWithAuthoredSilence();
  };
  const backgroundArt = STORY_BACKGROUND_VISUALS[event.background as keyof typeof STORY_BACKGROUND_VISUALS] ?? PRODUCTION_VISUALS.command;
  return <div className={`campaign-overlay event-screen event-${event.background} effect-${line.effect ?? "none"}`} style={artStyle(backgroundArt)} aria-label="会話イベント">
    <div className="event-vignette" />
    <div className={`event-portrait active ${line.side} ${line.portrait === "guide" ? "guide" : line.portrait === "radio" ? "radio" : ""}`} data-expression={line.expression} style={art ? { backgroundImage: `url('${art}')` } : undefined} aria-hidden="true" />
    <div className="event-controls"><button onClick={() => setLogOpen((value) => !value)}>会話ログ</button><button onClick={() => setSkipOpen(true)}>スキップ</button></div>
    {logOpen && <section className="event-log" aria-label="会話ログ"><header><b>会話ログ</b><button onClick={() => setLogOpen(false)}>閉じる</button></header>{log.map((entry: { id: string; speaker: string; text: string }) => <p key={entry.id}><b>{entry.speaker}</b><span>{entry.text}</span></p>)}</section>}
    <button className="dialogue-box" onClick={advance} disabled={silenceTail} aria-busy={silenceTail} aria-label="セリフを送る">
      <span className="dialogue-name"><b>{line.speaker}</b><small>{line.role}</small></span>
      <span className="dialogue-text">{line.text}</span>
      <em>{silenceTail ? "無音" : index + 1 < event.lines.length ? "次へ" : "完了"} ▾</em>
    </button>
    {skipOpen && <div className="story-skip-confirm" role="alertdialog" aria-modal="true" aria-label="会話をスキップ"><section><h2>会話をスキップしますか？</h2><p>進行・加入・報酬・解放の結果は変わりません。プロローグでは固定要約を表示して四十三日後へ進みます。</p><button onClick={skipOnce}>この会話をスキップ</button><button onClick={() => { onSetAutoSkipReadStory(true); skipOnce(); }}>既読会話を今後自動スキップ</button><button className="cancel" onClick={() => setSkipOpen(false)}>キャンセル</button></section></div>}
  </div>;
}

function AreaMapScreen({ stages, selectedStage, supplyCurrency, saveMutationPending, onSelectStage, onOpenPersonnel, onOpenLoadout, onOpenSurvival, onOpenOutbreak, onOpenRecords, onReplayPrologue, onResetSave }: Pick<Props, "stages" | "selectedStage" | "supplyCurrency" | "saveMutationPending" | "onSelectStage" | "onOpenPersonnel" | "onOpenLoadout" | "onOpenSurvival" | "onOpenOutbreak" | "onOpenRecords" | "onReplayPrologue" | "onResetSave">) {
  const [activeRegionId, setActiveRegionId] = useState(selectedStage.regionId);
  const regions = useMemo(() => {
    const seen = new Set<string>();
    return stages.flatMap((stage) => {
      if (seen.has(stage.regionId)) return [];
      seen.add(stage.regionId);
      return [{
        id: stage.regionId,
        label: stage.regionLabel,
        name: stage.regionName,
        unlocked: stages.some((candidate) => candidate.regionId === stage.regionId && candidate.unlocked),
      }];
    });
  }, [stages]);
  const visibleStages = stages.filter((stage) => stage.regionId === activeRegionId);
  const displayedStage = selectedStage.regionId === activeRegionId
    ? selectedStage
    : visibleStages.find((stage) => stage.unlocked) ?? visibleStages[0] ?? selectedStage;
  const activeRegion = regions.find((region) => region.id === activeRegionId) ?? regions[0];
  const landmarks = MAP_LANDMARKS[activeRegionId] ?? MAP_LANDMARKS["region-nishijin"];
  const selectRegion = (regionId: string) => {
    const firstOpenStage = stages.find((stage) => stage.regionId === regionId && stage.unlocked);
    if (!firstOpenStage) return;
    setActiveRegionId(regionId);
    if (firstOpenStage.id !== selectedStage.id) onSelectStage(firstOpenStage.id);
  };
  return <div className="campaign-overlay map-screen" style={artStyle(PRODUCTION_VISUALS.command)} aria-label="エリアマップ">
    <header className="campaign-header"><div><small>CHAPTER 1</small><h1>発生から四十三日</h1></div><div className="map-resource"><small>キャップ</small><b>{supplyCurrency}</b></div></header>
    <nav className="map-operation-tabs" aria-label="特殊作戦と部隊管理">
      <button className="special-operation survival-entry" onClick={onOpenSurvival}><small>SURVIVAL</small><b>防衛継続作戦</b></button>
      <button className="special-operation outbreak-entry" onClick={onOpenOutbreak}><small>OUTBREAK</small><b>異常発生任務</b></button>
      <span className="map-operation-tools"><button className="records-entry" onClick={onOpenRecords}>記録・図鑑</button><button onClick={onOpenPersonnel}>部隊</button></span>
    </nav>
    <nav className="map-region-tabs" aria-label="作戦区域">
      {regions.map((region) => <button
        key={region.id}
        type="button"
        data-active={region.id === activeRegionId}
        disabled={!region.unlocked}
        onClick={() => selectRegion(region.id)}
        aria-pressed={region.id === activeRegionId}
      ><b>{region.label}</b><small>{region.unlocked ? region.name : "未到達"}</small></button>)}
    </nav>
    <div className="map-layout">
      <section className="nishijin-map" data-region={activeRegionId} aria-label={`${activeRegion?.name ?? "作戦区域"} エリアマップ`}>
        <div className="map-water" /><div className="map-road road-a" /><div className="map-road road-b" /><div className="map-road road-c" />
        {landmarks.map((landmark) => <div key={landmark.label} className={`map-landmark ${landmark.className}`}><span>{landmark.label}<small>{landmark.status}</small></span></div>)}
        <div className="stage-node-grid">
          {visibleStages.map((stage) => <button
            key={stage.id}
            className={`stage-node ${stage.unlocked ? "open" : "locked"} ${displayedStage.id === stage.id ? "selected" : ""}`}
            disabled={!stage.unlocked}
            onClick={() => onSelectStage(stage.id)}
            aria-label={`${stage.displayName} ${stage.unlocked ? stars(stage.bestStars) : "封鎖中"}`}
          ><span>{stage.stageNumber}</span><b>{stage.displayName}</b><em>{stage.unlocked ? stars(stage.bestStars) : "封鎖"}</em></button>)}
        </div>
      </section>
      <aside className="stage-detail" aria-label="選択中のステージ詳細">
        <div className="stage-preview" style={artStyle(stageVisualFor(displayedStage.id))} role="img" aria-label={`${displayedStage.displayName}の作戦区域`} />
        <header><small>{displayedStage.missionLabel}</small><h2>{displayedStage.displayName}</h2><p>{displayedStage.threat}</p></header>
        <div className="stage-actions"><button className="campaign-primary" disabled={!displayedStage.unlocked} onClick={onOpenLoadout}>この作戦を編成</button></div>
        <dl><div><dt>目的</dt><dd>{displayedStage.objective}</dd></div><div><dt>過去最高星</dt><dd className="star-text">{stars(displayedStage.bestStars)}</dd></div><div><dt>基本報酬</dt><dd>{displayedStage.baseReward} キャップ</dd></div><div><dt>次の未取得星報酬</dt><dd>{displayedStage.nextStarReward ? `${displayedStage.nextStarReward} キャップ` : "取得済み"}</dd></div></dl>
        <div className="star-criteria"><b>星判定</b>{displayedStage.starCriteria.map((criterion) => <span key={criterion}>{criterion}</span>)}</div>
      </aside>
    </div>
    <details className="map-maintenance">
      <summary>管理</summary>
      <div><button disabled={saveMutationPending} onClick={onReplayPrologue}>プロローグを回想</button><button disabled={saveMutationPending} onClick={onResetSave}>{saveMutationPending ? "保存処理中" : "セーブデータを初期化"}</button></div>
    </details>
  </div>;
}

function LoadoutScreen({ selectedStage, units, formationUnitIds, formationPresets, selectedFormationPresetId, supplies, selectedSupply, assetsReady, assetError, loadoutReturnLabel, onReturnFromLoadout, onSelectFormationPreset, onToggleFormation, onSelectSupply, onStartBattle, onReloadAssets }: Pick<Props, "selectedStage" | "units" | "formationUnitIds" | "formationPresets" | "selectedFormationPresetId" | "supplies" | "selectedSupply" | "assetsReady" | "assetError" | "loadoutReturnLabel" | "onReturnFromLoadout" | "onSelectFormationPreset" | "onToggleFormation" | "onSelectSupply" | "onStartBattle" | "onReloadAssets">) {
  const visibleUnits = units.filter((unit) => unit.owned);
  return <div className="campaign-overlay formation-screen" style={artStyle(PRODUCTION_VISUALS.command)} aria-label="出撃編成">
    <header className="campaign-header"><button className="campaign-back" onClick={onReturnFromLoadout}>← {loadoutReturnLabel}</button><div><small>出撃編成</small><h1>{selectedStage.displayName}</h1></div><p>{selectedStage.objective}</p></header>
    <div className="formation-layout">
      <section className="formation-units" data-mode="roster" aria-label="使用ユニットを選択"><header className="formation-roster-header"><div><h2>出撃可能ユニット <small>{formationUnitIds.length}/7名選択中</small></h2></div><nav aria-label="部隊プリセット">{formationPresets.map((preset) => <button key={preset.id} data-active={preset.id === selectedFormationPresetId} onClick={() => onSelectFormationPreset(preset.id)} aria-pressed={preset.id === selectedFormationPresetId}><b>{preset.name}</b><small>{preset.unitIds.length}/7</small></button>)}</nav></header><div>{visibleUnits.map((unit) => {
        const selected = formationUnitIds.includes(unit.id);
        const atCapacity = formationUnitIds.length >= 7 && !selected;
        const portrait = unit.discovered ? formationCardArt[unit.kind] : "";
        const ability = MANUAL_ABILITY_REGISTRY[unit.kind as keyof typeof MANUAL_ABILITY_REGISTRY];
        return <article key={unit.id} className="formation-unit-card" data-state="owned" data-selected={selected}>
          <button className="formation-unit-select" data-kind={unit.kind} data-unit-id={unit.id} data-selected={selected} disabled={atCapacity} onClick={() => onToggleFormation(unit.id)} aria-pressed={selected} aria-label={`${unit.name}、Level ${unit.level}、${unit.role}、${unit.weaponName}、${unit.deploymentHint}`} title={`${ability?.displayName ?? "能力未登録"}：${ability?.summary ?? ""}`} style={portrait ? { "--formation-art": `url('${portrait}')` } as CSSProperties : undefined}>
            <span className="formation-portrait" /><span><b>{unit.name}</b><em><i>{unit.roleIcon}</i>{unit.role}</em><small className="unit-combat">{unit.weaponName}・{unit.rangeBand}・{unit.primaryTarget}</small><small className="unit-ability">能力：{ability?.displayName ?? "未登録"}</small></span><i>Lv {unit.level} / 上限 {unit.levelCap}</i>
          </button>
        </article>;
      })}</div></section>
      <section className="formation-support" aria-label="戦場物資を選択"><h2>戦場物資</h2>{supplies.map((supply) => <button key={supply.kind} data-supply={supply.kind} data-selected={selectedSupply === supply.kind} onClick={() => onSelectSupply(supply.kind)} aria-pressed={selectedSupply === supply.kind}><b>{supply.name}</b><small>{supply.description}</small><em>▰{supply.cost}</em></button>)}<div className="formation-note"><b>固定支援</b><span>緊急航空支援 / 移動拠点一斉掃射</span></div></section>
    </div>
    <footer className="formation-footer"><p>1〜7名で出撃できます。同じ仲間は戦闘中に何度でも再召喚できます。</p><button className="campaign-primary" disabled={formationUnitIds.length === 0 || (!assetsReady && !assetError)} onClick={assetError ? onReloadAssets : onStartBattle}><span>{assetError ? "アセット再読込" : assetsReady ? "この編成で出撃" : "アセット準備中"}</span><small>{assetError ? "タップして再読込" : assetsReady ? selectedStage.missionLabel : "移動拠点を点検中"}</small></button></footer>
  </div>;
}

function PersonnelScreen({ units, caps, upgradePendingUnitIds, upgradeFeedback, personnelInitialMode, onReturnToMap, onRecruitUnit, onUpgradeUnit }: Pick<Props, "units" | "caps" | "upgradePendingUnitIds" | "upgradeFeedback" | "personnelInitialMode" | "onReturnToMap" | "onRecruitUnit" | "onUpgradeUnit">) {
  const [mode, setMode] = useState<"roster" | "acquisition" | "upgrade">(personnelInitialMode);
  const visibleUnits = units.filter((unit) => mode === "acquisition" ? !unit.owned : unit.owned);
  return <div className="campaign-overlay personnel-screen" style={artStyle(PRODUCTION_VISUALS.command)} aria-label="人員管理">
    <header className="campaign-header"><button className="campaign-back" onClick={onReturnToMap}>← 地図へ</button><div><small>人員管理</small><h1>所有・雇用・強化</h1></div><div className="map-resource"><small>キャップ</small><b>{caps}</b></div></header>
    <main className="personnel-layout">
      <section className="formation-units personnel-units" data-mode={mode} aria-label={mode === "roster" ? "所有ユニット一覧" : mode === "upgrade" ? "ユニットを強化" : "ユニットを雇用"}>
        <header className="formation-roster-header"><div><h2>{mode === "roster" ? "所有一覧" : mode === "upgrade" ? "Level強化" : "雇用候補"} <small>{mode === "roster" ? `${visibleUnits.length}/${units.length}名` : `所持 ${caps}キャップ`}</small></h2><nav className="formation-mode-tabs" aria-label="人員管理メニュー"><button data-active={mode === "roster"} onClick={() => setMode("roster")}>所有一覧</button><button data-active={mode === "acquisition"} onClick={() => setMode("acquisition")}>雇用</button><button data-active={mode === "upgrade"} onClick={() => setMode("upgrade")}>Level</button></nav></div></header>
        <div>{visibleUnits.map((unit) => {
          const portrait = unit.discovered ? personnelCardArt[unit.kind] : "";
          const ability = MANUAL_ABILITY_REGISTRY[unit.kind as keyof typeof MANUAL_ABILITY_REGISTRY];
          const state = unit.owned ? "owned" : unit.recruitable ? "recruitable" : unit.discovered ? "discovered" : "unknown";
          const feedback = upgradeFeedback?.unitId === unit.id ? upgradeFeedback : null;
          return <article key={unit.id} className="formation-unit-card" data-state={state} data-upgrade-effect={feedback ? feedback.reachedMax ? "max" : "normal" : undefined}>
            <div className="formation-unit-select personnel-unit-summary" data-kind={unit.kind} data-unit-id={unit.id} style={portrait ? { "--formation-art": `url('${portrait}')` } as CSSProperties : undefined}>
              <span className="formation-portrait" /><span><b>{unit.discovered ? unit.name : "未発見"}</b><em>{unit.discovered && <><i>{unit.roleIcon}</i>{unit.role}</>}</em><small className="unit-combat">{unit.discovered ? `${unit.weaponName}・${unit.rangeBand}・${unit.primaryTarget}` : "物語を進めると情報が明らかになります"}</small><small className="unit-ability">{unit.discovered ? `能力：${ability?.displayName ?? "未登録"} — ${ability?.summary ?? ""}` : "能力情報未解禁"}</small><small className="unit-intent">{unit.owned ? `${unit.statSummary}${unit.milestones.length ? ` / ${unit.milestones.join("・")}` : ""}` : unit.unlockHint}</small></span><i>{unit.owned ? `Lv ${unit.level} / 上限 ${unit.levelCap}` : unit.recruitable ? "雇用可能" : unit.discovered ? "加入条件未達" : "未発見"}</i>
            </div>
            {mode === "acquisition" && unit.recruitable && !unit.owned && <button className="formation-unit-recruit" disabled={caps < unit.recruitCost} onClick={() => onRecruitUnit(unit.id)}><b>{unit.recruitCost}キャップで雇用</b><small>所持 {caps}</small></button>}
            {mode === "upgrade" && unit.owned && (feedback
              ? <div className="upgrade-feedback" data-level={feedback.reachedMax ? "max" : "normal"} role="status" aria-live="polite">
                <b>{feedback.reachedMax ? "Lv50 到達" : `Lv${feedback.level} 強化完了`}</b>
                <span>{feedback.statDelta}</span>
                <small>{feedback.milestones.length > 0 ? feedback.milestones.join("・") : `${feedback.spentCaps}キャップ使用`}</small>
              </div>
              : <button className="formation-unit-upgrade" disabled={upgradePendingUnitIds.includes(unit.id) || unit.nextUpgradeCost === null || caps < unit.nextUpgradeCost} onClick={() => onUpgradeUnit(unit.id)}><b>{upgradePendingUnitIds.includes(unit.id) ? "強化処理中" : unit.nextUpgradeCost === null ? unit.upgradeBlockedReason === "level-cap" ? `Level上限 ${unit.levelCap}` : "Lv50到達済み" : `Lv${unit.level + 1}へ：${unit.nextUpgradeCost}キャップ`}</b><small>{unit.nextUpgradeCost === null ? unit.upgradeBlockedReason === "level-cap" ? "本編Stage進行でLevel上限が解放されます" : unit.statSummary : `${unit.catchUp ? `追いつき割引 -${unit.upgradeDiscount} / ` : ""}${unit.nextMilestones.length ? `${unit.nextMilestones.join("・")} / ` : ""}${unit.nextStatCompact}`}</small></button>)}
          </article>;
        })}{visibleUnits.length === 0 && <p className="formation-empty">{mode === "acquisition" ? "現在雇用できる候補はいません。物語やSurvivalを進めると候補が増えます。" : "対象ユニットがいません。"}</p>}</div>
      </section>
    </main>
  </div>;
}

function ResultScreen({ selectedStage, result, onRetry, onContinueResult }: Pick<Props, "selectedStage" | "result" | "onRetry" | "onContinueResult">) {
  if (!result) return null;
  return <div className={`campaign-overlay result-screen ${result.won ? "win" : "lose"}`} style={artStyle(stageVisualFor(selectedStage.id))} aria-label="作戦結果">
    <section className="result-panel">
      <header><small>{selectedStage.displayName}</small><h1>{result.won ? "作戦成功" : "戦線崩壊"}</h1><div className="result-stars" aria-label={`今回の星 ${result.currentStars}`}>{stars(result.currentStars)}</div></header>
      <div className="result-records"><span><small>今回の星</small><b>{stars(result.currentStars)}</b></span><span><small>過去最高星</small><b>{stars(result.previousBestStars)}</b></span><span data-highlight={result.newBest}><small>最高記録更新</small><b>{result.newBest ? "更新" : "維持"}</b></span></div>
      <div className="result-rewards"><h2>獲得報酬</h2><dl><div><dt>通常クリア報酬</dt><dd>{result.clearReward}</dd></div><div><dt>新規星到達報酬</dt><dd>{result.newStarReward}</dd></div><div className="total"><dt>合計獲得キャップ</dt><dd>{result.totalReward}</dd></div></dl><p>所持：{result.capsAfter} キャップ</p></div>
      {result.missionFacts.length > 0 && <section className="result-mission-facts" aria-live="polite"><h2>作戦記録</h2>{result.missionFacts.map((fact) => <p key={fact}>{fact}</p>)}</section>}
      {(result.newlyUnlockedUnits.length > 0 || result.newlyUnlockedStages.length > 0) && <section className="result-unlocks" aria-live="polite"><h2>新たな戦力を解放</h2>{result.newlyUnlockedUnits.map((label) => <p key={`unit-${label}`}><b>ユニット</b><span>{label}</span></p>)}{result.newlyUnlockedStages.map((label) => <p key={`stage-${label}`}><b>作戦区域</b><span>{label}</span></p>)}</section>}
      <div className="result-stats"><span><small>作戦時間</small><b>{formatTime(result.time)}</b></span><span><small>撃破数</small><b>{result.kills}</b></span><span><small>移動拠点HP</small><b>{Math.round(result.baseHpRatio * 100)}%</b></span><span><small>戦闘不能</small><b>{result.unitsLost}</b></span></div>
      <footer><button className="campaign-secondary" onClick={onRetry}>同じ編成で再戦</button><button className="campaign-primary" onClick={onContinueResult}>エリアマップへ</button></footer>
    </section>
  </div>;
}

function OutbreakMissionScreen({
  outbreakMissions,
  selectedOutbreakMissionId,
  onSelectOutbreakMission,
  onPrepareOutbreak,
  onReturnToMap,
}: Pick<Props, "outbreakMissions" | "selectedOutbreakMissionId" | "onSelectOutbreakMission" | "onPrepareOutbreak" | "onReturnToMap">) {
  const selected = outbreakMissions.find(({ id }) => id === selectedOutbreakMissionId)
    ?? outbreakMissions.find(({ unlocked }) => unlocked)
    ?? outbreakMissions[0];
  if (!selected) return null;
  return <div className="campaign-overlay outbreak-screen" style={artStyle(PRODUCTION_VISUALS.command)} aria-label="異常発生任務">
    <header className="campaign-header"><button className="campaign-back" onClick={onReturnToMap}>← 出撃へ</button><div><small>OUTBREAK OPERATIONS</small><h1>異常発生任務</h1></div><p>異常発生個体を撃破すると、Survivalのboss抽選へ追加されます。</p></header>
    <main className="outbreak-layout">
      <nav className="outbreak-mission-list" aria-label="異常発生任務一覧">{outbreakMissions.map((mission) => <button
        key={mission.id}
        type="button"
        data-selected={mission.id === selected.id}
        data-state={mission.cleared ? "cleared" : mission.unlocked ? "open" : "locked"}
        disabled={!mission.unlocked}
        onClick={() => onSelectOutbreakMission(mission.id)}
        aria-pressed={mission.id === selected.id}
      ><small>{mission.cleared ? "制圧済み" : mission.unlocked ? "出撃可能" : "封鎖中"}</small><b>{mission.displayName}</b><span>{mission.location}</span></button>)}</nav>
      <section className="outbreak-detail" data-state={selected.cleared ? "cleared" : selected.unlocked ? "open" : "locked"}>
        <div className="outbreak-boss-art" style={{ backgroundImage: `url('${selected.bossImagePath}')` }} role="img" aria-label={`${selected.bossName} 全身記録`} />
        <div className="outbreak-intel">
          <small>{selected.bossClassification}</small><h2>{selected.bossName}</h2><p>{selected.objective}</p>
          <dl><div><dt>発生地点</dt><dd>{selected.location}</dd></div><div><dt>出撃条件</dt><dd>{selected.prerequisiteLabel}</dd></div><div><dt>撃破記録</dt><dd>{selected.defeatCount}回</dd></div><div><dt>基本報酬</dt><dd>{selected.baseRewardCaps} キャップ</dd></div><div><dt>初回固有装備</dt><dd>{selected.equipmentName}</dd></div></dl>
          <button className="campaign-primary" disabled={!selected.unlocked} onClick={onPrepareOutbreak}>{selected.unlocked ? "この任務の編成へ" : `${selected.prerequisiteLabel}で解放`}</button>
        </div>
      </section>
    </main>
  </div>;
}

function OutbreakResultScreen({ outbreakResult, onRetry, onContinueOutbreakResult }: Pick<Props, "outbreakResult" | "onRetry" | "onContinueOutbreakResult">) {
  if (!outbreakResult) return null;
  return <div className={`campaign-overlay outbreak-result-screen ${outbreakResult.won ? "win" : "lose"}`} style={artStyle(PRODUCTION_VISUALS.command)} aria-label="異常発生任務結果">
    <section className="outbreak-result-panel">
      <header><small>{outbreakResult.displayName}</small><h1>{outbreakResult.won ? "異常個体を制圧" : "制圧失敗"}</h1><p>{outbreakResult.bossName}</p></header>
      <div className="outbreak-result-stats"><span><small>作戦時間</small><b>{formatTime(outbreakResult.time)}</b></span><span><small>撃破数</small><b>{outbreakResult.kills}</b></span><span><small>戦闘不能</small><b>{outbreakResult.unitsLost}</b></span><span><small>獲得キャップ</small><b>+{outbreakResult.earnedCaps}</b></span></div>
      {outbreakResult.won && <section className="outbreak-result-unlock"><h2>{outbreakResult.firstClear ? "初回制圧報酬" : "再制圧記録"}</h2>{outbreakResult.survivalUnlocked && <p><b>SURVIVAL</b><span>{outbreakResult.bossName}をboss抽選へ追加</span></p>}{outbreakResult.equipmentGrants.map((grant) => <p key={grant.equipmentId}><b>固有装備</b><span>{grant.displayName} ×{grant.quantity}</span></p>)}<small>所持 {outbreakResult.capsAfter} キャップ</small></section>}
      <footer><button className="campaign-secondary" onClick={onRetry}>同じ編成で再戦</button><button className="campaign-primary" onClick={onContinueOutbreakResult}>任務一覧へ</button></footer>
    </section>
  </div>;
}

function formatRecordTime(seconds: number) {
  const total = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  return hours > 0 ? `${hours}時間 ${minutes}分` : `${minutes}分`;
}

function RecordsScreen({
  recordsSummary,
  enemyCompendium,
  bossCompendium,
  units,
  onReturnToMap,
}: Pick<Props, "recordsSummary" | "enemyCompendium" | "bossCompendium" | "units" | "onReturnToMap">) {
  const [section, setSection] = useState<"summary" | "unit" | "enemy" | "boss">("summary");
  const tabs = [
    { id: "summary" as const, label: "戦績" },
    { id: "unit" as const, label: "ユニット図鑑" },
    { id: "enemy" as const, label: "敵図鑑" },
    { id: "boss" as const, label: "BOSS図鑑" },
  ];
  return <div className="campaign-overlay records-screen" style={artStyle(PRODUCTION_VISUALS.command)} aria-label="記録">
    <header className="campaign-header"><button className="campaign-back" onClick={onReturnToMap}>← 出撃へ</button><div><small>ARCHIVE // FIELD INTELLIGENCE</small><h1>記録</h1></div><p>交戦記録から感染体の情報と部隊戦績を更新します。</p></header>
    <nav className="records-tabs" aria-label="記録分類">{tabs.map((tab) => <button key={tab.id} aria-pressed={section === tab.id} onClick={() => setSection(tab.id)}>{tab.label}</button>)}</nav>
    {section === "summary" && <main className="records-summary">
      <section className="records-totals"><article><small>本編制圧</small><b>{recordsSummary.clearedStages}/{recordsSummary.totalStages}</b><span>★ {recordsSummary.collectedStars}</span></article><article><small>SURVIVAL最高</small><b>WAVE {recordsSummary.highestSurvivalWave}</b><span>{recordsSummary.survivalRuns} runs</span></article><article><small>異常発生制圧</small><b>{recordsSummary.outbreakClears}/5</b><span>BOSS累計 {recordsSummary.bossKills}</span></article><article><small>0.9.0戦闘記録</small><b>{recordsSummary.victories}勝 / {recordsSummary.defeats}敗</b><span>撤退 {recordsSummary.withdrawals}</span></article><article><small>交戦時間</small><b>{formatRecordTime(recordsSummary.battleSeconds)}</b><span>撃破 {recordsSummary.kills}</span></article><article><small>獲得CAPS</small><b>{recordsSummary.capsEarned.toLocaleString("ja-JP")}</b><span>戦闘不能 {recordsSummary.unitsLost}</span></article></section>
      <section className="records-unit-stats"><h2>隊員別累計</h2>{recordsSummary.unitStats.length > 0 ? <table><thead><tr><th>隊員</th><th>与damage</th><th>被damage</th><th>回復</th></tr></thead><tbody>{recordsSummary.unitStats.map((unit) => <tr key={unit.kind}><th>{unit.displayName}</th><td>{unit.damage.toLocaleString("ja-JP")}</td><td>{unit.damageTaken.toLocaleString("ja-JP")}</td><td>{unit.healing.toLocaleString("ja-JP")}</td></tr>)}</tbody></table> : <p>0.9.0で確定した隊員別記録はまだありません。</p>}</section>
      <section className="records-recent"><h2>最近の作戦</h2>{recordsSummary.recentResults.length > 0 ? recordsSummary.recentResults.map((result) => <article key={result.resultId}><div><small>{result.categoryLabel}</small><b>{result.operationLabel}</b></div><strong data-outcome={result.outcomeLabel}>{result.outcomeLabel}</strong><span>撃破 {result.kills}{result.reachedWave > 0 ? ` / WAVE ${result.reachedWave}` : ""}</span></article>) : <p>0.9.0で確定した作戦記録はまだありません。</p>}</section>
    </main>}
    {section === "unit" && <main className="compendium-grid unit-compendium">{units.map((unit) => {
      const ability = MANUAL_ABILITY_REGISTRY[unit.kind as keyof typeof MANUAL_ABILITY_REGISTRY];
      const art = unit.discovered ? personnelCardArt[unit.kind] : "";
      return <article key={unit.id} data-locked={!unit.discovered}><div className="unit-compendium-art" data-identity-master={v090IdentityMasterKinds.has(unit.kind) ? "v090" : "legacy"} style={art ? { backgroundImage: `url('${art}')` } : undefined} role="img" aria-label={unit.discovered ? `${unit.name}人物記録` : "未確認隊員"} /><section><small>{unit.discovered ? `${unit.role} // ${unit.rangeBand}` : "CLASSIFIED"}</small><h2>{unit.discovered ? unit.name : "未確認隊員"}</h2>{unit.discovered ? <><p>{unit.description}</p><p className="compendium-ability"><b>{ability?.displayName ?? "能力未登録"}</b>{ability?.summary ?? "能力情報を確認できません。"}</p><dl><div><dt>武器</dt><dd>{unit.weaponName}</dd></div><div><dt>優先対象</dt><dd>{unit.primaryTarget}</dd></div><div><dt>Level</dt><dd>{unit.owned ? `${unit.level} / 上限 ${unit.levelCap}` : "未加入"}</dd></div><div><dt>再使用</dt><dd>{ability ? `${ability.cooldownSeconds}秒` : "未登録"}</dd></div></dl></> : <p>物語を進めると人物・武器・能力情報が解禁されます。</p>}</section></article>;
    })}</main>}
    {section === "enemy" && <main className="compendium-grid enemy-compendium">{enemyCompendium.map((enemy) => <article key={enemy.id} data-locked={!enemy.encountered}><div className="compendium-art" aria-label={enemy.encountered ? `${enemy.displayName}戦闘記録` : "未確認感染体"}><i style={enemy.artStyle} aria-hidden="true" /></div><section><small>{enemy.encountered ? enemy.classification : "UNIDENTIFIED"}</small><h2>{enemy.encountered ? enemy.displayName : "未確認感染体"}</h2>{enemy.encountered ? <><p>{enemy.attackProfile}</p><dl><div><dt>初回遭遇</dt><dd>{enemy.firstEncounterLabel}</dd></div><div><dt>交戦</dt><dd>{enemy.encounterCount}回</dd></div><div><dt>撃破</dt><dd>{enemy.defeatCount}</dd></div></dl></> : <p>実戦で遭遇すると記録が解禁されます。</p>}</section></article>)}</main>}
    {section === "boss" && <main className="compendium-grid boss-compendium">{bossCompendium.map((boss) => <article key={boss.id} data-locked={!boss.encountered}><div className="compendium-art" aria-label={boss.encountered ? `${boss.displayName}図鑑画像` : "未確認BOSS"}><i style={boss.artStyle} aria-hidden="true" /></div><section><small>{boss.encountered ? boss.classification : "CLASSIFIED"}</small><h2>{boss.encountered ? boss.displayName : "未確認BOSS"}</h2>{boss.encountered ? <><p><b>{boss.attackName}</b>{boss.attackSummary}</p><dl><div><dt>初回遭遇</dt><dd>{boss.firstEncounterLabel}</dd></div><div><dt>撃破</dt><dd>{boss.defeatCount}</dd></div><div><dt>発見済み弱点</dt><dd>{boss.defeatCount > 0 ? boss.weakness : "未発見"}</dd></div><div><dt>固有装備</dt><dd>{boss.defeatCount > 0 ? boss.equipmentName : "解析中"}</dd></div></dl></> : <p>初遭遇前は攻撃特性と弱点を開示しません。</p>}</section></article>)}</main>}
  </div>;
}

export function CampaignScreens(props: Props) {
  if (props.saveRecoveryRequired) return <SaveRecoveryScreen saveRecoveryReason={props.saveRecoveryReason} saveRecoveryCandidateSources={props.saveRecoveryCandidateSources} saveRecoveryCanExport={props.saveRecoveryCanExport} saveMutationPending={props.saveMutationPending} saveEnvironment={props.saveEnvironment} onExportCorruptSave={props.onExportCorruptSave} onImportSave={props.onImportSave} onUseRecoveryCandidate={props.onUseRecoveryCandidate} onResetCorruptSave={props.onResetCorruptSave} />;
  if (props.screen === "battle" || props.screen === "survival" || props.screen === "survival-result") return null;
  if (props.screen === "title") return <TitleScreen hasCampaignSave={props.hasCampaignSave} savePersistence={props.savePersistence} saveMutationPending={props.saveMutationPending} saveEnvironment={props.saveEnvironment} onBegin={props.onBegin} onRestartCampaign={props.onRestartCampaign} onExportSave={props.onExportSave} onImportSave={props.onImportSave} />;
  if (props.screen === "event") return <StoryScreen key={props.eventId ?? "missing"} eventId={props.eventId} readStoryEventIds={props.readStoryEventIds} autoSkipReadStory={props.autoSkipReadStory} forceStoryReplay={props.forceStoryReplay} onEventComplete={props.onEventComplete} onEventSkip={props.onEventSkip} onStoryAudioPositionChange={props.onStoryAudioPositionChange} onSetAutoSkipReadStory={props.onSetAutoSkipReadStory} />;
  if (props.screen === "map") return <AreaMapScreen stages={props.stages} selectedStage={props.selectedStage} supplyCurrency={props.supplyCurrency} saveMutationPending={props.saveMutationPending} onSelectStage={props.onSelectStage} onOpenPersonnel={props.onOpenPersonnel} onOpenLoadout={props.onOpenLoadout} onOpenSurvival={props.onOpenSurvival} onOpenOutbreak={props.onOpenOutbreak} onOpenRecords={props.onOpenRecords} onReplayPrologue={props.onReplayPrologue} onResetSave={props.onResetSave} />;
  if (props.screen === "outbreak") return <OutbreakMissionScreen outbreakMissions={props.outbreakMissions} selectedOutbreakMissionId={props.selectedOutbreakMissionId} onSelectOutbreakMission={props.onSelectOutbreakMission} onPrepareOutbreak={props.onPrepareOutbreak} onReturnToMap={props.onReturnToMap} />;
  if (props.screen === "outbreak-result") return <OutbreakResultScreen outbreakResult={props.outbreakResult} onRetry={props.onRetry} onContinueOutbreakResult={props.onContinueOutbreakResult} />;
  if (props.screen === "records") return <RecordsScreen recordsSummary={props.recordsSummary} enemyCompendium={props.enemyCompendium} bossCompendium={props.bossCompendium} units={props.units} onReturnToMap={props.onReturnToMap} />;
  if (props.screen === "personnel") return <PersonnelScreen key={props.personnelInitialMode} units={props.units} caps={props.caps} upgradePendingUnitIds={props.upgradePendingUnitIds} upgradeFeedback={props.upgradeFeedback} personnelInitialMode={props.personnelInitialMode} onReturnToMap={props.onReturnToMap} onRecruitUnit={props.onRecruitUnit} onUpgradeUnit={props.onUpgradeUnit} />;
  if (props.screen === "loadout") return <LoadoutScreen selectedStage={props.selectedStage} units={props.units} formationUnitIds={props.formationUnitIds} formationPresets={props.formationPresets} selectedFormationPresetId={props.selectedFormationPresetId} supplies={props.supplies} selectedSupply={props.selectedSupply} assetsReady={props.assetsReady} assetError={props.assetError} loadoutReturnLabel={props.loadoutReturnLabel} onReturnFromLoadout={props.onReturnFromLoadout} onSelectFormationPreset={props.onSelectFormationPreset} onToggleFormation={props.onToggleFormation} onSelectSupply={props.onSelectSupply} onStartBattle={props.onStartBattle} onReloadAssets={props.onReloadAssets} />;
  return <ResultScreen selectedStage={props.selectedStage} result={props.result} onRetry={props.onRetry} onContinueResult={props.onContinueResult} />;
}
