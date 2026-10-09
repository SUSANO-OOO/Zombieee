"use client";

import { FormEvent, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { RELEASE_LABEL } from "./releaseIdentity.js";
import { V100LockChain } from "./V100LockChain";
import { V100AssetCredits } from "./V100AssetCredits";
import { V100StaffRoll } from "./V100EndingRoll";
import { V100PostCreditsFilm } from "./V100PostCreditsFilm";
import { V100PlayerMenu } from "./V100PlayerMenu";
import { V100TitleScreen } from "./V100TitleScreen";
import { V100EventBackdrop } from "./V100EventBackdrop";
import { v100EventPortraitPath, v100StoryExpressionFor } from "./v100StoryDirection.js";
import { v100BasePresentationFor } from "./v100BasePresentation.js";
import { describeSaveEnvironment } from "./saveEnvironment.js";
import { V100_PREPARATION_ART } from "./v100PreparationArt.js";

import {
  V100_BOSSES,
  V100_STAGE_BY_ID,
  V100_STAGE_IDS,
  V100_STAGES,
  V100_SUPPORTS,
  V100_UNITS,
  V100_VEHICLE,
  normalizeV100PlayerName,
  v100StageReward,
  v100StarTargetsForVehicle,
} from "./v100Registry.js";
import {
  createDefaultV100Save,
  applyV100SaveMutation,
  markV100EventRead,
  updateV100PlayerName,
} from "./v100Save.js";
import {
  createV100BattleResult,
  equipV100Support,
  equipV100Equipment,
  purchaseV100Equipment,
  upgradeV100Equipment,
  finalizeV100PendingResult,
  purchaseV100Support,
  purchaseV100Unit,
  recordV100PendingResult,
  upgradeV100Vehicle,
  upgradeV100Unit,
} from "./v100Transactions.js";
import {
  beginV100StageAttempt,
  completeV100Event,
  createV100StoryFlowState,
  defeatV100Flow,
  enterV100Battle,
  enterV100PostResult,
  finishV100Battle,
  leaveV100Battle,
  leaveV100Preparation,
  markV100FlowEventRead,
  shouldAutoSkipV100StoryEvent,
  v100StoryFlowCheckpoint,
} from "./v100StoryFlow.js";
import { v100StoryEventFor, v100StoryEventView } from "./v100StoryEvents.js";
import { v100MissionObjectiveFor, v100ProductionSessionFor } from "./v100BattleAdapter.js";
import { createV100EventAudioOwner } from "./v100EventAudio.js";
import { v100EventPresentationFor } from "./v100EventPresentation.js";
import { v100SurfaceScore } from "./v100Music.js";
import { v100ActionPortraitSubjects, v100DialogueSlots, v100PortraitFraming } from "./v100DialogueComposition.js";
import { normalizeV100BattleReport, v100BattleReportFor, v100LastVehicleHitText } from "./v100BattleReport.js";
import { v100MissionBriefingFor, v100MissionThreatsFor } from "./v100MissionBriefing.js";
import { v100StoryPortraitPath } from "./v100StoryPortraitPaths.js";
import { v100RewardPresentationFor } from "./v100RewardPresentation.js";
import { v100MapStageName, v100StageDiscovered } from "./v100MapDisclosure.js";
import { v100StoryPageFor } from "./v100StoryPages.js";
import { formatV100Number, v100SupportPurposeFor, v100TacticalHintFor, v100UnitPresentation } from "./v100UnitPresentation.js";
import { v100RoleLabelFor } from "./v100Terminology.js";
import { campaignUnitIdToCombatKind } from "./campaign.js";
import { unitContentFor } from "./content/unitCatalog.js";
import { AshfallGame, type AshfallBattleResult } from "./AshfallGame";
import { v100StageRuntimeFor } from "./v100StageRuntime.js";
import { FORMATION_CARD_ART } from "./spriteManifest.js";
import { PRODUCTION_VISUALS, stageVisualFor } from "./productionVisuals.js";
import { PROLOGUE_SYNOPSIS } from "./storyEvents.js";
import { publicDisplayText } from "./publicDisplayNames.js";
import { V099_CRAWLER_RUNTIME_PROFILE } from "./crawlerEquipmentSprites.js";
import {
  exportV100BrowserSave,
  createV100SaveOwnerId,
  persistV100BrowserSave,
  readV100BrowserSave,
  claimV100BrowserGift,
  acknowledgeV100BrowserGift,
  releaseV100PopupOwnership,
  registerV100LegacyHistory,
  restoreV100BrowserSave,
  subscribeV100SaveChanges,
  startNewV100BrowserCampaign,
  readV100NewGameArchive,
} from "./v100CampaignStorage.js";
import { V100EquipmentView } from "./V100EquipmentView";
import { V100ModesView } from "./V100ModesView";
import { v100RegionalMapDisclosure, v100RegionalMapForChapter, v100RegionalMapPinPoints, v100RegionalMapPoints } from "./v100RegionalMap.js";
import "./v100Campaign.css";
import "./v100Preparation.css";
import "./v100FormationField.css";
import "./v100MapField.css";
import "./v100BattlePresentation.css";
import "./v100CommandPolish.css";
import "./v100ExperiencePolish.css";
import "./v100RegionalMap.css";
import "./v100MobileLayout.css";

type Save = NonNullable<StorageOutcome["save"]> & { bestStars: Record<string, number> };
type StorageOutcome = Awaited<ReturnType<typeof readV100BrowserSave>>;
type GiftDisplay = NonNullable<StorageOutcome["popup"]> & { acknowledged: boolean };
type Flow = ReturnType<typeof createV100StoryFlowState>;
type StoryNode = { kind?: string; speaker?: string | null; text?: string; portraitOwner?: string | null; portraitKind?: string; sourceLine?: number; sceneLabel?: string; sceneTag?: string };
type CampaignSurface = "campaign" | "personnel" | "support-vehicle" | "vehicle" | "equipment" | "modes" | "mode-formation" | "data" | "rename";

const UNIT_BY_ID = new Map(V100_UNITS.map((unit) => [unit.id, unit]));

function stageNumberFor(stageId: string | null) {
  return stageId ? V100_STAGE_BY_ID[stageId]?.number ?? 0 : 0;
}

function formatReason(reason: string | undefined) {
  const labels: Record<string, string> = {
    "invalid-characters": "使用できない文字が含まれています",
    "too-long": "名前は12文字以内で入力してください",
    "stage-locked": "前の作戦を先に完了してください。",
    "objective-incomplete": "ミッション目標が未完了です。",
    "vehicle-destroyed": "装甲車両が破壊されています。",
    "formation-full": "出撃中の7体上限に達しています。",
    "unit-not-owned": "未登録の隊員です。",
    "insufficient-battle-resource": "出撃資源が不足しています。",
    "not-unlocked": "この装備はまだ解放されていません。",
    "insufficient-caps": "CAPSが不足しています。",
    "support-not-owned": "先に支援装備を取得してください。",
    "upgrade-cap": "この装備は最大強化です。",
    "level-cap": "現在の育成上限です。作戦を進めると上限が解放されます。",
    "stale-level": "育成段階が更新されました。現在のレベルを確認してください。",
    "unknown-unit": "隊員情報を読み込めませんでした。",
    "boss-undiscovered": "物語での初回撃破後に再戦できます。",
    "activity-active": "現在の戦闘・戦果を先に完了してください。",
    "formation-empty": "出撃する隊員を編成してください。",
    "invalid-mode-run": "現在の作戦と一致しません。保存済みの進行を確認してください。",
    "equipment-unavailable": "この装備は購入できません。",
    "equipment-locked": "この装備は指定の作戦クリア後に購入できます。",
    "equipment-not-owned": "先に装備を取得してください。",
    "equipment-cap": "この装備は所持上限です。",
    "stale-equipment": "装備情報が更新されました。現在の所持数と強化段階をご確認ください。",
    "invalid-equipment-slot": "この枠には装備できません。",
    "equipment-in-use": "同じ装備を重ねて装着できません。別の隊員が使用中の場合は追加購入するか外してください。",
    "unknown-support": "支援情報を読み込めませんでした。",
    "invalid-result": "戦果の内容を確認できませんでした。保存データは保持しています。",
    "duplicate-result": "この戦果は確定済みです。報酬は重ねて受け取れません。",
    "pending-result-exists": "先に保存済みの戦果を確定してください。",
    "pending-result-missing": "確定する戦果が見つかりません。保存データを確認してください。",
    "pending-result-mismatch": "保存済みの戦果と一致しません。保存データは保持しています。",
  };
  return labels[reason ?? ""] ?? "操作を完了できませんでした。現在の進行を保持しています。";
}

function storageFailureMessage(reason: string | undefined) {
  if (reason === "stale-writer" || reason === "popup-owned-by-another-tab") return "別のタブでセーブが更新されました。現在の画面を保持しています。再読み込みして確認してください。";
  if (reason === "invalid-export-size") return "ファイルが空か、容量が大きすぎます。このゲームから書き出したセーブファイルを選んでください。現在のセーブは変更していません。";
  if (["invalid-export-json", "invalid-export-envelope"].includes(reason ?? "")) return "このファイルは復元できません。このゲームから書き出したセーブファイルを選んでください。現在のセーブは変更していません。";
  if (reason === "invalid-inner-save") return "セーブの内容を確認できませんでした。別のバックアップを選んでください。現在のセーブは変更していません。";
  if (reason === "legacy-history-not-eligible") return "このファイルでは旧版のプレイ履歴を確認できません。旧版から書き出したデータを選んでください。現在の進行と残高は変更していません。";
  if (reason === "recovery-source-changed") return "復旧対象のセーブが更新されました。再読み込みして確認してください。";
  if (reason === "recovery-required") return "セーブの復旧が必要です。再読み込みして復旧画面を確認してください。";
  return "セーブを書き込めませんでした。現在の画面と進行を保持します。";
}

function portraitFor(owner: string | null | undefined) {
  return v100StoryPortraitPath(owner);
}

function isEventPhase(phase: Flow["phase"]) {
  return ["event", "post", "first-clear-post", "ending", "credits", "epilogue"].includes(phase);
}

function eventPhaseForId(eventId: string | null | undefined) {
  if (eventId === "v100:event:ending") return "ending";
  if (eventId === "v100:event:credits") return "credits";
  if (eventId === "v100:event:epilogue") return "epilogue";
  if (/:(?:post|first-clear-post)$/u.test(String(eventId ?? ""))) return String(eventId).endsWith("first-clear-post") ? "first-clear-post" : "post";
  return "event";
}

const OPERATION_LABELS: Record<string, string> = {
  assault: "拠点制圧",
  "timed-defense": "防衛線維持",
  boss: "ボス撃破",
  escort: "目標護送",
  power: "電源ノード起動",
  seal: "封鎖ノード起動",
};

const BOSS_SPECIAL_LABELS: Record<string, string> = {
  "2 adds": "増援を呼ぶ",
  "3 adds": "増援を呼ぶ",
  "brood 4/6": "幼体を放出",
  charge: "突進",
  clones: "分身",
  "shell cycle": "装甲を開閉",
  "survivor enrages": "片側撃破で残存個体が激昂",
  "four-arm form": "四腕形態",
  "2 add waves": "増援2波",
};

const ENEMY_PACK_LABELS: Record<string, string> = {
  A: "標準感染群",
  "A+abomination": "重装感染群",
  "A+shade/abomination": "潜伏・重装感染群",
  "A+grappler": "捕縛個体群",
  "A+ooze/sprinter": "漏泥・走鬼群",
  B: "遠隔・重装感染群",
  "B+shade": "潜伏・重装混成群",
  C: "異常感染混成群",
  D: "特殊部隊混成群",
  "D+panther-knife/smg": "レッドパンサー先遣隊",
  "D+panther-shield/smg": "レッドパンサー防衛隊",
  "D+panther-smg/commander": "レッドパンサー指揮隊",
  "D+panther-shield/smg/commander": "レッドパンサー制圧隊",
  P: "レッドパンサー本隊",
  "A-add-waves": "追加波状感染群",
};

function missionLabelFor(stage: (typeof V100_STAGES)[number] | undefined) {
  if (stage?.number === 26) return "車列停止・確保";
  if (stage?.number === 28) return "散布装置停止";
  return OPERATION_LABELS[stage?.missionType ?? ""] ?? "キャンペーン作戦";
}

function enemyPackLabelFor(value: string | undefined, stageNumber = 99) {
  const label = ENEMY_PACK_LABELS[value ?? ""] ?? "混成感染群";
  return stageNumber < 27 && label.includes("レッドパンサー") ? "赤レンズ部隊" : label;
}

function objectiveLabelFor(stage: (typeof V100_STAGES)[number] | undefined) {
  return stage ? v100MissionObjectiveFor(stage.id) : "作戦目標を達成";
}

function eventDisplayLabel(eventId: string | null | undefined) {
  if (!eventId) return "イベント";
  if (eventId === "v100:event:prologue") return "プロローグ";
  const match = /^v100:event:s(\d{2}):(pre|post|first-clear-post)$/u.exec(eventId);
  if (match) {
    const stage = V100_STAGES[Number(match[1]) - 1];
    const suffix = match[2] === "pre" ? "出撃前" : match[2] === "post" ? "作戦後" : "初回制圧後";
    return `${stage ? stageDisplayNameFor(stage) : `第${match[1]}作戦`} / ${suffix}`;
  }
  if (eventId === "v100:event:ending") return "最終章";
  if (eventId === "v100:event:credits") return "クレジット";
  if (eventId === "v100:event:epilogue") return "エピローグ";
  return "記録済みイベント";
}

function storySpeakerLabel(speaker: string | null | undefined) {
  const labels: Record<string, string> = {
    "◆ BATTLE": "作戦情報",
    "◆ BOSS": "ボス通信",
    "■ SYSTEM": "無線記録",
    "▶ PLAYER": "主人公",
  };
  return labels[speaker ?? ""] ?? speaker ?? "通信";
}

function stageDisplayNameFor(stage: (typeof V100_STAGES)[number] | undefined) {
  if (!stage) return "西新ルート";
  return stage.number < 27 ? stage.displayName.replace(/RED PANTHER/gu, "赤レンズ部隊") : stage.displayName;
}

const V100_PROLOGUE_SYNOPSIS = PROLOGUE_SYNOPSIS.short.replace("放置車両CRAWLERを確保", "放置された装甲車両を確保").replace("あなたは西新で", "西新で");

const V100_CHAPTERS = Object.freeze([
  { id: "chapter-1", label: "第一章", range: "1–6", start: 1, end: 6 },
  { id: "chapter-2", label: "第二章", range: "7–12", start: 7, end: 12 },
  { id: "chapter-3", label: "第三章", range: "13–20", start: 13, end: 20 },
  { id: "chapter-4", label: "第四章", range: "21–25", start: 21, end: 25 },
  { id: "chapter-5", label: "第五章", range: "26–29", start: 26, end: 29 },
  { id: "chapter-final", label: "最終章", range: "30", start: 30, end: 30 },
]);

function chapterIndexForStage(stageNumber: number) {
  const index = V100_CHAPTERS.findIndex((chapter) => stageNumber >= chapter.start && stageNumber <= chapter.end);
  return index >= 0 ? index : 0;
}

function mapNodePosition(index: number, total: number) {
  if (total === 1) return [50, 52];
  const positions = [
    [14, 56], [31, 35], [48, 58], [64, 34], [79, 57], [91, 35],
  ];
  if (total <= positions.length) return positions[index] ?? positions[positions.length - 1];
  const progress = total <= 1 ? 0.5 : index / (total - 1);
  return [12 + progress * 76, index % 2 === 0 ? 65 : 35];
}

function eventBackdropFor(presentation: ReturnType<typeof v100EventPresentationFor>, fallback: string) {
  if (!presentation) return fallback;
  if (presentation.backgroundPath) return presentation.backgroundPath;
  return fallback;
}

function unitDescriptionFor(unitId: string) {
  return unitContentFor(campaignUnitIdToCombatKind(unitId))?.desc ?? "";
}

function formationCardForUnit(unitId: string) {
  const kind = campaignUnitIdToCombatKind(unitId);
  return kind ? FORMATION_CARD_ART[kind] ?? null : null;
}

export function V100Campaign() {
  const [save, setSave] = useState<Save>(() => createDefaultV100Save());
  const [flow, setFlow] = useState<Flow>(() => createV100StoryFlowState());
  const autoSkipAttemptRef = useRef<Flow | null>(null);
  const [storyIndex, setStoryIndex] = useState(0);
  const [saveAdoptionEpoch, setSaveAdoptionEpoch] = useState(0);
  const [battleRunId, setBattleRunId] = useState<string | null>(null);
  const [selectedStageId, setSelectedStageId] = useState(V100_STAGE_IDS[0]);
  const [nameInput, setNameInput] = useState("");
  const [nameError, setNameError] = useState("");
  const [notice, setNotice] = useState("");
  const [unsavedBattleResult, setUnsavedBattleResult] = useState<AshfallBattleResult | null>(null);
  const [giftPopup, setGiftPopup] = useState<GiftDisplay | null>(null);
  const [giftError, setGiftError] = useState(false);
  const [giftWake, setGiftWake] = useState(0);
  const giftDialogRef = useRef<HTMLElement | null>(null);
  const [documentVisible, setDocumentVisible] = useState(true);
  const [saveBusy, setSaveBusy] = useState(false);
  const saveBusyRef = useRef(false);
  const saveRef = useRef(save);
  const [loadFailure, setLoadFailure] = useState(false);
  const [recovery, setRecovery] = useState<StorageOutcome["recovery"]>(null);
  const [logOpen, setLogOpen] = useState(false);
  const [creditsOpen, setCreditsOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [entryOpen, setEntryOpen] = useState(true);
  const [titleRollOpen, setTitleRollOpen] = useState(false);
  const [newGameConfirm, setNewGameConfirm] = useState(false);
  const dataReturnSurfaceRef = useRef<CampaignSurface>("campaign");
  const [modePreparation, setModePreparation] = useState(false);
  const [modeTab, setModeTab] = useState<"overview" | "outbreak" | "survival" | "compendium" | "records">("overview");
  const [replayEventId, setReplayEventId] = useState<string | null>(null);
  const [replayNodeIndex, setReplayNodeIndex] = useState(0);
  const [replayFinale, setReplayFinale] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [saveOwnerId] = useState(() => createV100SaveOwnerId());
  const [surface, setSurface] = useState<CampaignSurface>("campaign");
  const [personnelSelection, setPersonnelSelection] = useState<string | null>(null);
  const eventAudioOwnerRef = useRef<ReturnType<typeof createV100EventAudioOwner> | null>(null);
  const [eventAudioRevision, setEventAudioRevision] = useState(0);
  const [eventAudioSnapshot, setEventAudioSnapshot] = useState<ReturnType<ReturnType<typeof createV100EventAudioOwner>["snapshot"]> | null>(null);

  useEffect(() => {
    const owner = createV100EventAudioOwner({
      onState: (_state, snapshot) => {
        setEventAudioSnapshot(snapshot);
        setEventAudioRevision((revision) => revision + 1);
      },
    });
    eventAudioOwnerRef.current = owner;
    return () => {
      eventAudioOwnerRef.current = null;
      void owner.dispose();
    };
  }, []);

  useEffect(() => { eventAudioOwnerRef.current?.setSettings(save.settings); }, [save.settings]);

  const publishSave = useCallback((next: Save) => { saveRef.current = next; setSave(next); }, []);
  const adoptSave = useCallback((next: Save) => {
    publishSave(next);
    setSaveAdoptionEpoch(epoch => epoch + 1);
    const restored = createV100StoryFlowState({
      playerName: next.campaignStarted ? next.playerName : "",
      completedStageIds: next.completedStageIds, readStoryEventIds: next.readStoryEventIds,
      flowState: next.campaignStarted ? next.flowState : null, eventCursor: next.eventCursor,
      pendingResult: next.pendingResult, lastResult: next.lastResult,
    });
    setSelectedStageId(next.availableStageIds.find((id: string) => !next.completedStageIds.includes(id)) ?? next.availableStageIds.at(-1) ?? V100_STAGE_IDS[0]);
    setFlow(restored); setStoryIndex(restored.nodeIndex ?? 0);
    setBattleRunId(restored.phase === "battle" ? `v100:${restored.stageId}:${next.revision}` : null);
    setSurface(next.outbreak.view === "hub" && next.survival.view === "hub" ? "campaign" : "modes"); setReplayEventId(null); setLogOpen(false);
    setRecovery(null); setLoadFailure(false); setHydrated(true);
  }, [publishSave]);

  const runStorage = useCallback(async (operation: () => Promise<StorageOutcome>, publish?: (next: Save, outcome: StorageOutcome) => void) => {
    if (saveBusyRef.current) return null;
    saveBusyRef.current = true;
    document.documentElement.dataset.pwaSaveMutationPending = "true";
    setSaveBusy(true);
    try {
      const outcome = await operation();
      if (!outcome.ok || !outcome.save) {
        setNotice(storageFailureMessage(outcome.reason));
        return null;
      }
      publishSave(outcome.save);
      publish?.(outcome.save, outcome);
      if (!outcome.mirrorSaved) setNotice("セーブは保存済みです。予備コピーを作れませんでした。データ管理から書き出してください。");
      return outcome.save;
    } catch { setNotice("セーブを書き込めませんでした。現在の画面と進行を保持します。"); return null; }
    finally {
      saveBusyRef.current = false;
      // Balance the immediate publication even when React batches true -> false
      // and no saveBusy-dependent layout effect runs for a fast failed write.
      document.documentElement.dataset.pwaSaveMutationPending = String(!hydrated);
      setSaveBusy(false);
    }
  }, [hydrated, publishSave]);

  const commitSave = useCallback((next: Save, publish?: (next: Save) => void) => runStorage(
    () => persistV100BrowserSave(next, globalThis, { expectedRevision: save.revision, ownerId: saveOwnerId }), publish,
  ), [runStorage, saveOwnerId, save.revision]);

  const loadSave = useCallback(async (isActive: () => boolean = () => true) => {
    const loaded = await readV100BrowserSave();
    if (!isActive()) return;
    if (loaded.ok && loaded.save) { adoptSave(loaded.save); if (!loaded.mirrorSaved) setNotice("セーブは保存済みです。予備コピーを作れませんでした。"); }
    else { setRecovery(loaded.recovery); setLoadFailure(true); }
  }, [adoptSave]);
  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => { void loadSave(() => active); }, 0);
    return () => { active = false; clearTimeout(timer); };
  }, [loadSave]);

  useEffect(() => {
    if (!hydrated) return undefined;
    let active = true;
    return (() => {
      const unsubscribe = subscribeV100SaveChanges(async () => {
        if (saveBusyRef.current) return;
        const loaded = await readV100BrowserSave();
        if (!active || saveBusyRef.current || !loaded.ok || !loaded.save || loaded.save.revision <= saveRef.current.revision) return;
        if (!entryOpen && (flow.phase === "battle" || flow.phase === "result" || saveRef.current.outbreak.view !== "hub" || saveRef.current.survival.view !== "hub")) {
          setNotice("別のタブで新しいセーブを検出しました。現在の戦闘・結果画面を保持しています。再読み込みして確認してください。");
          return;
        }
        adoptSave(loaded.save); setGiftPopup(null); setGiftWake(value => value + 1);
        setNotice("別のタブのセーブを反映しました。");
      });
      return () => { active = false; unsubscribe(); };
    })();
  }, [adoptSave, entryOpen, flow.phase, hydrated]);

  useEffect(() => {
    const release = () => { void releaseV100PopupOwnership(globalThis, saveOwnerId); };
    const visibility = () => {
      const visible = document.visibilityState === "visible";
      setDocumentVisible(visible);
      if (!visible) { setGiftPopup(null); release(); }
      else setGiftWake(value => value + 1);
    };
    window.addEventListener("pagehide", release);
    document.addEventListener("visibilitychange", visibility);
    return () => { window.removeEventListener("pagehide", release); document.removeEventListener("visibilitychange", visibility); release(); };
  }, [saveOwnerId]);

  const giftScreen = !entryOpen && hydrated && documentVisible && surface === "campaign" && !menuOpen && !creditsOpen && !logOpen && !replayEventId && !unsavedBattleResult
    ? flow.phase === "name" ? "title" : flow.phase === "map" ? "map" : "" : "";
  useEffect(() => {
    if (!giftScreen || giftPopup || giftError || save.legacy.popupAcknowledged || !hydrated) return undefined;
    let active = true;
    let wakeTimer = 0;
    const timer = window.setTimeout(async () => {
      if (saveBusyRef.current) return;
      const completed = await runStorage(() => claimV100BrowserGift(globalThis, { ownerId: saveOwnerId, screen: giftScreen }), (_next, outcome) => {
        if (!active) { void releaseV100PopupOwnership(globalThis, saveOwnerId); return; }
        if (outcome.popup) setGiftPopup({ ...outcome.popup, acknowledged: false });
        else if (outcome.retryAt) wakeTimer = window.setTimeout(() => setGiftWake(value => value + 1), Math.max(1, outcome.retryAt - Date.now()));
      });
      if (!completed && active) setGiftError(true);
    }, 0);
    return () => { active = false; clearTimeout(timer); clearTimeout(wakeTimer); };
  }, [giftScreen, giftPopup, giftError, giftWake, hydrated, runStorage, save.legacy.popupAcknowledged, saveOwnerId]);

  useEffect(() => {
    if (!giftPopup || giftPopup.acknowledged || giftError || !giftScreen) return undefined;
    let frame = 0;
    let active = true;
    let visibleFrames = 0;
    const visiblyPainted = (element: HTMLElement | null, container: HTMLElement | null) => {
      if (!element?.isConnected || !container) return false;
      const rect = element.getBoundingClientRect();
      const viewport = window.visualViewport;
      const left = viewport?.offsetLeft ?? 0, top = viewport?.offsetTop ?? 0;
      const right = left + (viewport?.width ?? innerWidth), bottom = top + (viewport?.height ?? innerHeight);
      const style = getComputedStyle(element);
      if (style.visibility !== "visible" || style.display === "none" || Number(style.opacity) === 0 || rect.width <= 0 || rect.height <= 0
        || rect.left < left || rect.top < top || rect.right > right || rect.bottom > bottom) return false;
      const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
      return Boolean(hit && container.contains(hit));
    };
    const observePaint = async () => {
      if (!active) return;
      if (Date.now() >= giftPopup.expiresAt) {
        void releaseV100PopupOwnership(globalThis, saveOwnerId);
        setGiftPopup(null); setGiftWake(value => value + 1);
        return;
      }
      const dialog = giftDialogRef.current;
      const amount = dialog?.querySelector<HTMLElement>("#v100-gift-amount") ?? null;
      const balance = dialog?.querySelector<HTMLElement>("#v100-gift-balance") ?? null;
      const visible = document.visibilityState === "visible" && dialog
        && visiblyPainted(dialog, dialog) && visiblyPainted(amount, amount) && visiblyPainted(balance, balance);
      visibleFrames = visible ? visibleFrames + 1 : 0;
      if (visibleFrames < 2) { frame = requestAnimationFrame(() => { void observePaint(); }); return; }
      const acknowledged = await runStorage(() => acknowledgeV100BrowserGift(globalThis, {
        ownerId: saveOwnerId, claimId: giftPopup.claimId, screen: giftScreen, painted: true,
      }), () => setGiftPopup(current => current?.claimId === giftPopup.claimId ? { ...current, acknowledged: true } : current));
      if (!acknowledged && active) setGiftError(true);
    };
    frame = requestAnimationFrame(() => { void observePaint(); });
    return () => { active = false; cancelAnimationFrame(frame); };
  }, [giftPopup, giftScreen, giftError, runStorage, saveOwnerId]);

  useLayoutEffect(() => {
    const root = document.documentElement;
    const battleActive = !entryOpen && (flow.phase === "battle" || save.outbreak.view === "battle" || save.survival.view === "battle");
    const resultSaving = !entryOpen && (flow.phase === "result" || save.outbreak.view === "result" || save.survival.view === "result");
    // Stable V1 preparation screens publish their actual identity. Story nodes
    // remain unsafe so a release cannot interrupt a cursor or first-clear
    // transition; battle/result explicitly block it.
    const screen = !hydrated || loadFailure || menuOpen || creditsOpen || logOpen || replayEventId || giftPopup || surface === "rename" ? "event"
      : surface === "data" && (entryOpen || ["name", "map", "formation"].includes(flow.phase)) ? "storage"
      : entryOpen ? titleRollOpen ? "event" : "title"
      : battleActive ? "battle"
      : resultSaving ? "result"
        : isEventPhase(flow.phase) ? "event"
          : flow.phase === "map"
            ? surface === "mode-formation" ? "formation" : surface === "personnel" ? "personnel" : (surface === "support-vehicle" || surface === "equipment") ? "loadout" : "map"
            : flow.phase === "formation" ? "formation" : "title";
    root.dataset.pwaScreen = screen;
    root.dataset.pwaBattleActive = String(battleActive);
    root.dataset.pwaResultSaving = String(resultSaving);
    root.dataset.pwaSaveMutationPending = String(saveBusy || !hydrated);
    const environment = describeSaveEnvironment(window.location);
    root.dataset.saveEnvironmentKind = environment.kind;
    root.dataset.saveEnvironmentLabel = environment.label;
    root.dataset.saveEnvironmentOrigin = environment.origin;
    root.dataset.saveEnvironmentScope = environment.storageScope;
    root.dataset.saveEnvironmentIsolation = environment.isolationNotice;
    return () => {
      delete root.dataset.pwaScreen;
      delete root.dataset.pwaBattleActive;
      delete root.dataset.pwaResultSaving;
      delete root.dataset.pwaSaveMutationPending;
    };
  }, [entryOpen, titleRollOpen, flow.phase, surface, save.outbreak.view, save.survival.view, saveBusy, hydrated, loadFailure, menuOpen, creditsOpen, logOpen, replayEventId, giftPopup]);

  useEffect(() => {
    const shell = document.querySelector<HTMLElement>(".v100-shell");
    if (!shell) return;
    shell.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [flow.phase, surface]);

  const event = useMemo(() => flow.eventId ? v100StoryEventView(flow.eventId, save.playerName) : null, [flow.eventId, save.playerName]);
  const storyPage = useMemo(() => v100StoryPageFor(flow.eventId, event?.nodes ?? [], storyIndex), [event, flow.eventId, storyIndex]);
  const currentNode = storyPage.node as StoryNode | null;
  const eventPresentation = useMemo(() => flow.eventId
    ? v100EventPresentationFor({ eventId: flow.eventId, phase: flow.phase, node: currentNode, nodeIndex: storyPage.nodeIndex })
    : null, [currentNode, flow.eventId, flow.phase, storyPage.nodeIndex]);
  const eventRuntime = v100StageRuntimeFor(eventPresentation?.stageId ?? selectedStageId);
  // The durable cursor after the last R5 epilogue line owns the film. It is
  // still unread until the film completes, so a close/relaunch resumes it.
  const postCreditsFilmActive = flow.phase === "epilogue" && Boolean(event) && storyIndex >= (event?.nodes.length ?? Infinity);
  const replayEvent = useMemo(() => replayEventId ? v100StoryEventView(replayEventId, save.playerName) : null, [replayEventId, save.playerName]);
  const replayNode = (replayEvent?.nodes?.[replayNodeIndex] ?? null) as StoryNode | null;
  const replayPresentation = useMemo(() => replayEventId ? v100EventPresentationFor({
    eventId: replayEventId, phase: eventPhaseForId(replayEventId), node: replayNode, nodeIndex: replayNodeIndex,
  }) : null, [replayEventId, replayNode, replayNodeIndex]);
  const battleAudioActive = !entryOpen && (flow.phase === "battle" || save.outbreak.view === "battle" || save.survival.view === "battle");
  const modeScoreResult = surface !== "modes" ? null : save.survival.view === "result"
    ? save.survival.lastResult?.endReason === "withdrawal" ? "victory" : "defeat"
    : save.outbreak.view === "result" ? save.outbreak.lastResult?.won ? "victory" : "defeat" : null;
  const surfacePresentation = useMemo(() => v100SurfaceScore({
    ready: hydrated && !loadFailure, battleActive: battleAudioActive, modeResult: modeScoreResult,
    phase: flow.phase, won: flow.pendingResult?.won ?? null,
  }), [hydrated, loadFailure, battleAudioActive, modeScoreResult, flow.phase, flow.pendingResult?.won]);
  const audibleEventPresentation = entryOpen || battleAudioActive || flow.phase === "credits" || postCreditsFilmActive || replayEventId === "v100:event:credits" ? null
    : replayPresentation ?? (isEventPhase(flow.phase) ? eventPresentation : surfacePresentation);
  useEffect(() => {
    const owner = eventAudioOwnerRef.current;
    if (!owner) return undefined;
    if (audibleEventPresentation) {
      void owner.present(audibleEventPresentation);
    } else {
      void owner.stop("route-transition");
    }
    return undefined;
  }, [audibleEventPresentation]);

  const updateFlow = useCallback(async (next: Flow, { baseSave = save, nodeIndex = 0 }: { baseSave?: Save; nodeIndex?: number } = {}) => {
    const checkpoint = v100StoryFlowCheckpoint(next, nodeIndex);
    const persisted = applyV100SaveMutation(baseSave, (draft: Save) => ({
      ...draft,
      flowState: checkpoint.flowState,
      eventCursor: checkpoint.eventCursor,
      lastResult: next.phase === "result" && next.pendingResult?.won === false ? next.pendingResult : draft.lastResult,
    }));
    if (!persisted.applied) { setNotice(formatReason(persisted.reason)); return null; }
    return commitSave(persisted.save, (committed) => {
      setFlow(next);
      setBattleRunId(next.phase === "battle" ? `v100:${next.stageId}:${committed.revision}` : null);
      setStoryIndex(Math.max(0, Math.floor(Number(nodeIndex) || 0)));
      setSurface("campaign");
      if (next.phase === "map" && next.firstClear && next.finalized) {
        setSelectedStageId(committed.availableStageIds.find((id: string) => !committed.completedStageIds.includes(id)) ?? committed.availableStageIds.at(-1) ?? V100_STAGE_IDS[0]);
      }
    });
  }, [commitSave, save]);

  const applySaveTransaction = useCallback((result: { applied?: boolean; duplicate?: boolean; unchanged?: boolean; save: Save; reason?: string }) => {
    if (!result.applied) {
      if (!result.duplicate && !result.unchanged) {
        setNotice(formatReason(result.reason));
        void eventAudioOwnerRef.current?.operation("reject");
      }
      return result.save;
    }
    setNotice("");
    return commitSave(result.save).then(saved => { void eventAudioOwnerRef.current?.operation(saved ? "confirm" : "reject"); return saved; });
  }, [commitSave]);

  const openSurface = useCallback((next: CampaignSurface, unitId: string | null = null) => {
    if (next === "data") dataReturnSurfaceRef.current = surface;
    if (next === "mode-formation") setModePreparation(true);
    if (next === "modes" || next === "campaign") setModePreparation(false);
    setSurface(next);
    setPersonnelSelection(next === "personnel" ? unitId : null);
    setNotice("");
  }, [surface]);

  const handleProductionBattleResult = useCallback(async (raw: AshfallBattleResult) => {
    if (flow.phase !== "battle" || raw.resultId !== battleRunId) return;
    const result = createV100BattleResult({
      stageId: raw.stageId,
      battleRunId: raw.resultId,
      won: raw.won,
      vehicleHp: raw.baseHp,
      vehicleMaxHp: raw.baseMaxHp,
      objectiveComplete: raw.won,
      bossDefeated: raw.bossDefeated,
      elapsedSeconds: raw.time,
      unitDeaths: raw.unitsLost,
      researchCoreTargets: raw.researchCoreTargets,
      battleReport: v100BattleReportFor(raw),
    });
    if (result?.ok === false) {
      setNotice(formatReason(result.reason));
      return;
    }
    const transition = finishV100Battle(flow, result);
    if (!transition.accepted) {
      setNotice(formatReason(transition.reason));
      return;
    }
    let nextSave = save;
    if (result.won) {
      const pending = recordV100PendingResult(save, result);
      if (!pending.applied) {
        setNotice(formatReason(pending.reason));
        return;
      }
      nextSave = pending.save;
    }
    if (await updateFlow(transition.state, { baseSave: nextSave })) {
      setUnsavedBattleResult(null);
      setNotice("");
    } else {
      setUnsavedBattleResult(raw);
    }
  }, [battleRunId, flow, save, updateFlow]);

  const handleProductionBattleAction = useCallback(async (action: "withdraw" | "loadout" | "restart") => {
    if (unsavedBattleResult) return false;
    const transition = leaveV100Battle(flow, action);
    if (!transition.accepted) return false;
    const accepted = Boolean(await updateFlow(transition.state));
    if (accepted) setNotice("");
    return accepted;
  }, [flow, unsavedBattleResult, updateFlow]);

  const handleProductionSettingsChange = useCallback(async (settings: Partial<Save["settings"]>) => {
    if (flow.phase !== "battle" || unsavedBattleResult) return false;
    const changed = applyV100SaveMutation(save, (draft: Save) => ({ ...draft, settings: { ...draft.settings, ...settings } }));
    if (!changed.applied) return false;
    setNotice("");
    return Boolean(await commitSave(changed.save));
  }, [commitSave, flow.phase, save, unsavedBattleResult]);

  const productionSession = useMemo(() => {
    if (flow.phase !== "battle" || !flow.stageId || !battleRunId) return null;
    return v100ProductionSessionFor({
      save,
      stageId: flow.stageId,
      resultId: battleRunId,
    });
  }, [battleRunId, flow.phase, flow.stageId, save]);

  const startCampaign = (eventSubmit: FormEvent<HTMLFormElement>) => {
    eventSubmit.preventDefault();
    const validated = normalizeV100PlayerName(nameInput);
    if (!validated.ok) {
      setNameError(formatReason(validated.reason));
      return;
    }
    const nextSave = updateV100PlayerName(save, validated.value).save;
    const started = applyV100SaveMutation(nextSave, (draft) => ({ ...draft, campaignStarted: true })).save;
    const nextFlow = createV100StoryFlowState({ playerName: validated.value, completedStageIds: [], readStoryEventIds: [] });
    updateFlow(nextFlow, { baseSave: started });
    setNameError("");
  };

  const markAndAdvanceEvent = useCallback(async (skipped = false) => {
    if (!flow.eventId || !event || saveBusy) return false;
    if (flow.phase !== "credits" && !postCreditsFilmActive) void eventAudioOwnerRef.current?.activate(eventPresentation);
    let workingSave = save;
    const lastNode = storyPage.endIndex >= event.nodes.length - 1;
    if (!lastNode && !skipped) {
      return Boolean(await updateFlow(flow, { baseSave: workingSave, nodeIndex: storyPage.endIndex + 1 }));
    }
    if (flow.phase === "epilogue" && !postCreditsFilmActive) {
      return Boolean(await updateFlow(flow, { baseSave: workingSave, nodeIndex: event.nodes.length }));
    }
    const marked = markV100EventRead(workingSave, flow.eventId).save;
    workingSave = marked;
    if (flow.phase === "post") {
      const finalized = finalizeV100PendingResult(workingSave);
      if (!finalized.applied) { setNotice(formatReason(finalized.reason)); return false; }
      workingSave = finalized.save;
    }
    const markedFlow = markV100FlowEventRead(flow, flow.eventId);
    const transition = completeV100Event(markedFlow, { skipped });
    if (!transition.accepted) {
      setNotice(formatReason(transition.reason));
      return false;
    }
    return Boolean(await updateFlow(transition.state, { baseSave: workingSave }));
  }, [event, eventPresentation, flow, postCreditsFilmActive, save, saveBusy, storyPage.endIndex, updateFlow]);

  useEffect(() => {
    if (entryOpen || !hydrated || loadFailure || saveBusy || logOpen || menuOpen || creditsOpen || surface !== "campaign" || !shouldAutoSkipV100StoryEvent(flow, { enabled: save.settings.autoSkipReadStory, replay: Boolean(replayEventId) })) return;
    // A failed write keeps this flow object active. Leave its retry to the
    // player instead of starting another automatic save on every render.
    if (autoSkipAttemptRef.current === flow) return;
    autoSkipAttemptRef.current = flow;
    void markAndAdvanceEvent(true);
  }, [entryOpen, flow, hydrated, loadFailure, logOpen, menuOpen, creditsOpen, surface, markAndAdvanceEvent, replayEventId, save.settings.autoSkipReadStory, saveBusy]);

  const startStage = (stageId: string) => {
    const transition = beginV100StageAttempt(flow, stageId);
    if (!transition.accepted) {
      setNotice(formatReason(transition.reason));
      return;
    }
    setSelectedStageId(stageId);
    setNotice("");
    updateFlow(transition.state);
  };

  const chooseFormation = (slot: number, value: string) => {
    const next = applyV100SaveMutation(save, (draft) => {
      const formationSlots = [...draft.formationSlots];
      formationSlots[slot] = value || null;
      return { ...draft, formationSlots };
    });
    if (next.applied) commitSave(next.save);
  };

  const startBattle = () => {
    const entered = enterV100Battle(flow);
    if (!entered.accepted) {
      setNotice(formatReason(entered.reason));
      return;
    }
    setNotice("");
    updateFlow(entered.state, { baseSave: save });
  };

  const leavePreparation = () => {
    const next = leaveV100Preparation(flow);
    if (next.accepted) updateFlow(next.state);
  };

  const continueFromResult = () => {
    const next = enterV100PostResult(flow);
    if (next.accepted) updateFlow(next.state, { baseSave: save });
  };

  const leaveDefeatResult = (destination: "formation" | "map") => {
    const next = defeatV100Flow(flow, destination);
    if (next.accepted) updateFlow(next.state);
  };

  const openRename = () => {
    setNameInput(saveRef.current.playerName);
    setNameError("");
    openSurface("rename");
  };
  const rename = async (event: FormEvent) => {
    event.preventDefault();
    const result = updateV100PlayerName(saveRef.current, nameInput);
    if (result.unchanged) { openSurface("campaign"); return; }
    if (!result.applied) {
      setNameError(formatReason(result.reason));
      return;
    }
    setNameError("");
    await commitSave(result.save, () => { openSurface("campaign"); setNotice("表示名を更新しました。"); });
  };

  const downloadSaveFile = (exportedSave: Save, filename: string) => {
    const blob = new Blob([exportV100BrowserSave(exportedSave)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  };
  const downloadBackup = () => downloadSaveFile(save, "nishijin-campaign-v100-backup.json");
  const downloadNewGameBackup = async () => {
    const archive = await readV100NewGameArchive();
    if (!archive.ok || !archive.save) { setNotice("「初めから」を選ぶ前のバックアップはありません。"); return; }
    downloadSaveFile(archive.save, "nishijin-campaign-v100-before-new-game.json");
  };
  const beginNewCampaign = async () => {
    const started = await runStorage(() => startNewV100BrowserCampaign(globalThis, {
      confirmed: true, expectedRevision: saveRef.current.revision, ownerId: saveOwnerId,
    }), adoptSave);
    if (!started) return;
    setNewGameConfirm(false); setNameInput(""); setNameError(""); setGiftPopup(null); setEntryOpen(false);
  };

  const importBackup = (file: File | undefined) => {
    if (!file) return;
    void runStorage(async () => restoreV100BrowserSave(await file.text(), globalThis, {
      expectedRevision: saveRef.current.revision, recoveryToken: recovery?.token ?? null, ownerId: saveOwnerId,
    }), (restored) => { adoptSave(restored); setNotice("選んだバックアップの残高と進行を復元しました。"); });
  };
  const importLegacyHistory = (file: File | undefined) => {
    if (!file) return;
    void runStorage(async () => registerV100LegacyHistory(await file.text(), globalThis, {
      expectedRevision: saveRef.current.revision, ownerId: saveOwnerId,
    }), () => setNotice("過去のプレイ履歴を確認しました。現在の進行と残高は保持しています。"));
  };
  const recoverSnapshot = () => {
    if (!recovery?.candidate) return;
    void runStorage(() => restoreV100BrowserSave(exportV100BrowserSave(recovery.candidate), globalThis, {
      recoveryToken: recovery.token, ownerId: saveOwnerId,
    }), (restored) => { adoptSave(restored); setNotice("直前の正常なセーブを復元しました。"); });
  };
  const exportCorruptData = () => {
    if (!recovery) return;
    const url = URL.createObjectURL(new Blob([recovery.raw], { type: "application/json" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = "nishijin-v100-recovery-data.json"; anchor.click(); URL.revokeObjectURL(url);
  };
  const blockPendingInput = (event: FormEvent<HTMLElement>) => {
    if (saveBusyRef.current || (giftPopup && !(event.target as HTMLElement).closest(".v100-modal"))) {
      event.preventDefault(); event.stopPropagation();
    }
  };
  const onInterfaceClick = (event: FormEvent<HTMLElement>) => {
    blockPendingInput(event);
    if (event.defaultPrevented || (!entryOpen && (flow.phase === "battle" || save.outbreak.view === "battle" || save.survival.view === "battle"))) return;
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>("button");
    if (!button || button.disabled || button.getAttribute("aria-disabled") === "true") return;
    const role = button.dataset.uiSound ?? (button.closest(".v100-event-actions") ? "advance" : "navigate");
    if (role === "transaction") {
      void eventAudioOwnerRef.current?.activate(null);
      return;
    }
    void eventAudioOwnerRef.current?.operation(role);
  };

  if (!hydrated) return <main className="v100-shell" aria-busy={saveBusy}>
    {!loadFailure ? <p className="v100-loading">作戦セーブを検証しています…</p> : <section className="v100-panel" aria-label="セーブの復旧">
      <h1>セーブを確認できませんでした</h1><p>新しいセーブで上書きせず、元の記録を保持しています。</p>
      {notice && <p role="status">{notice}</p>}
      <button type="button" disabled={saveBusy} onClick={() => void loadSave()}>もう一度確認する</button>
      {recovery && <><button type="button" disabled={saveBusy} onClick={exportCorruptData}>元のデータを書き出す</button>
        {recovery.candidate && <button type="button" disabled={saveBusy} onClick={recoverSnapshot}>直前の正常なセーブを復元する</button>}
        <label>バックアップから復元<input type="file" accept="application/json,.json" disabled={saveBusy} onChange={event => importBackup(event.currentTarget.files?.[0])} /></label></>}
    </section>}
  </main>;

  if (entryOpen) return <main id="v100-campaign" className="v100-shell v100-entry-shell" data-v100-phase="title" aria-busy={saveBusy} onClickCapture={onInterfaceClick}>
    {titleRollOpen ? <><V100StaffRoll nodes={v100StoryEventView("v100:event:credits", save.playerName)?.nodes ?? []} playerName={save.playerName} settings={save.settings} onComplete={() => { setTitleRollOpen(false); return true; }} /><button type="button" className="v100-title-credits-close" onClick={() => setTitleRollOpen(false)}>タイトルへ</button></> : <V100TitleScreen
      canContinue={save.campaignStarted} canOpenModes={save.campaignStarted && flow.phase === "map" && save.outbreak.view === "hub" && save.survival.view === "hub"}
      busy={saveBusy} reducedMotion={save.settings.reducedMotion} settings={save.settings}
      onNew={() => { setNotice(""); if (save.campaignStarted) setNewGameConfirm(true); else { setSurface("campaign"); setEntryOpen(false); } }}
      onContinue={() => { setNotice(""); setEntryOpen(false); }} onSettings={() => setMenuOpen(true)} onCredits={() => setTitleRollOpen(true)}
      onModes={() => { setModeTab("overview"); openSurface("modes"); setEntryOpen(false); }} onData={() => openSurface("data")} />}
    {notice && surface !== "data" && <p className="v100-title-feedback" role="status">{notice}</p>}
    {menuOpen && <V100PlayerMenu settings={save.settings} busy={saveBusy} returnLabel="タイトルへ" showLog={false} onClose={() => setMenuOpen(false)} onData={() => { setMenuOpen(false); openSurface("data"); }} onLog={() => {}} onApply={async settings => {
      const changed = applyV100SaveMutation(saveRef.current, (draft: Save) => ({ ...draft, settings: { ...draft.settings, ...settings } }));
      return changed.applied && Boolean(await commitSave(changed.save));
    }} />}
    {surface === "data" && <DataManagementView save={save} notice={notice} onBack={() => openSurface("campaign")} onBackup={downloadBackup} onNewGameBackup={downloadNewGameBackup} onImport={importBackup} onLegacyHistory={importLegacyHistory} />}
    {newGameConfirm && <div className="v100-modal-backdrop"><section className="v100-modal v100-new-game-confirm" role="alertdialog" aria-modal="true" aria-labelledby="v100-new-game-title"><h2 id="v100-new-game-title">初めから始めますか？</h2><p>現在の進行・隊員の育成・装備・CAPSは、新しいゲームの初期状態に戻ります。設定は引き継ぎます。</p><p>今の進行はバックアップとして保存します。データ管理から書き出して復元できます。</p><div className="v100-new-game-actions"><button type="button" disabled={saveBusy} onClick={() => setNewGameConfirm(false)}>戻る</button><button type="button" className="v100-primary" disabled={saveBusy} onClick={() => void beginNewCampaign()}>バックアップして初めから</button></div></section></div>}
  </main>;

  const immersiveFlow = flow.phase === "name" || isEventPhase(flow.phase) || flow.phase === "battle" || save.outbreak.view === "battle" || save.survival.view === "battle";
  const recruitOffer = flow.phase === "map" && surface === "campaign" && save.lastResult?.firstClear === true
    ? V100_UNITS.find((unit) => unit.availabilityStageNumber === save.lastResult?.stageNumber
      && save.registeredUnitIds.includes(unit.id) && !save.ownedUnitIds.includes(unit.id)
      && !save.receipts.includes(`v100:recruit-offer:${unit.id}:seen`)) ?? null
    : null;
  const modeResult = save.outbreak.view === "result" || save.survival.view === "result";
  const screenLabel = surface === "personnel" ? "隊員" : surface === "vehicle" ? "装甲車両" : surface === "support-vehicle" ? "戦術支援" : surface === "equipment" ? "装備" : surface === "data" ? "セーブ" : surface === "rename" ? "名前の変更" : flow.phase === "formation" ? "出撃編成" : flow.phase === "result" || modeResult ? "戦果" : "作戦地図";

  return (
    <main id="v100-campaign" onClickCapture={onInterfaceClick} onSubmitCapture={blockPendingInput} onKeyDownCapture={blockPendingInput} onPointerDownCapture={blockPendingInput} aria-busy={saveBusy} className={`v100-shell v100-surface-${surface}`} data-v100-phase={save.outbreak.view === "battle" || save.survival.view === "battle" ? "battle" : flow.phase} data-v100-stage={save.survival.active ? "survival" : save.outbreak.active?.bossId ?? flow.stageNumber ?? "map"} data-v100-surface={surface} style={{ "--v100-command-art": `url(${PRODUCTION_VISUALS.command})` } as CSSProperties}>
      {!immersiveFlow && <header className="v100-topbar v100-compact-topbar">
        <div className="v100-topbar-title"><div><span className="v100-kicker">現場指揮</span><h1>{flow.phase === "map" || flow.phase === "formation" ? `西新 / ${screenLabel}` : screenLabel}</h1></div></div>
        <div className="v100-save-meta"><span>{RELEASE_LABEL}</span><span className="v100-caps-balance">{save.caps} CAPS</span>{flow.phase === "map" && <button className="v100-modes-launch" type="button" onClick={() => { setModeTab("overview"); openSurface("modes"); }}>モード選択</button>}<button className="v100-menu-launch" type="button" onClick={() => setMenuOpen(true)}>メニュー</button></div>
      </header>}
      {immersiveFlow && !battleAudioActive && !replayEventId && <button className="v100-menu-launch" type="button" onClick={() => setMenuOpen(true)}>メニュー</button>}

      {!immersiveFlow && !modeResult && (flow.phase === "map" || flow.phase === "formation") && <nav className="v100-command-tabs" aria-label="作戦準備メニュー">{([
        ["campaign", flow.phase === "formation" ? "編成" : "作戦"], ["personnel", "隊員"], ["support-vehicle", "支援"], ["equipment", "装備"], ["vehicle", "車両"],
      ] as const).map(([id,label]) => <button type="button" key={id} aria-current={surface === id ? "page" : undefined} onClick={() => openSurface(id)}>{label}</button>)}</nav>}

      {notice && surface !== "data" && <div className="v100-notice v100-command-notice" role="status"><span className="v100-notice-message" tabIndex={0}>{notice}</span><button type="button" aria-label="通知を閉じる" onClick={() => setNotice("")}>閉じる</button></div>}
      {unsavedBattleResult && <div className="v100-save-retry" role="alertdialog" aria-modal="true" aria-label="戦闘結果の保存"><div><h2>戦闘結果を保存できませんでした</h2><p>結果はこの画面で保持しています。保存を再試行してください。</p><button type="button" className="v100-primary" onClick={() => handleProductionBattleResult(unsavedBattleResult)}>結果の保存を再試行</button></div></div>}

      {flow.phase === "name" && surface === "campaign" && (
        <section className="v100-title-screen" aria-labelledby="v100-name-title" style={{ backgroundImage: `url(${PRODUCTION_VISUALS.title})` }}>
          <div className="v100-title-wash" />
          <div className="v100-title-copy">
            <span className="v100-kicker">西新 / 物語</span>
            <div className="v100-title-lockup" aria-label="西新世紀末物語">
              <strong>西新</strong><span>世紀末物語</span>
            </div>
            <p className="v100-title-synopsis">{V100_PROLOGUE_SYNOPSIS}</p>
            <div className="v100-name-card">
              <h2 id="v100-name-title">名前を入力</h2>
              <p>物語の中で仲間たちに呼ばれる名前です。</p>
              <form onSubmit={startCampaign}>
                <label htmlFor="v100-player-name">呼ばれたい名前</label>
                <input id="v100-player-name" value={nameInput} onChange={(event) => setNameInput(event.currentTarget.value)} autoComplete="nickname" />
                {nameError && <small className="v100-error" role="alert">{nameError}</small>}
                <button className="v100-primary" type="submit" aria-label="この名前で作戦を始める" disabled={saveBusy}>この名前で始める</button>
              </form>
              <button className="v100-secondary-data" type="button" disabled={saveBusy} onClick={() => openSurface("data")}>データ管理</button>
              <button className="v100-secondary-data" type="button" onClick={() => setCreditsOpen(true)}>権利・クレジット</button>
            </div>
          </div>
        </section>
      )}

      {flow.phase === "credits" && event && <V100StaffRoll key={saveAdoptionEpoch} nodes={event.nodes} playerName={save.playerName} initialNodeIndex={storyIndex} settings={save.settings} busy={saveBusy} blocked={menuOpen || logOpen || Boolean(replayEventId) || Boolean(giftPopup) || surface === "data"} onScene={index => { void updateFlow(flow, { nodeIndex: index }); }} onComplete={() => markAndAdvanceEvent(true)} />}
      {postCreditsFilmActive && event && <V100PostCreditsFilm key={saveAdoptionEpoch} settings={save.settings} busy={saveBusy} blocked={menuOpen || logOpen || Boolean(replayEventId) || Boolean(giftPopup) || surface === "data"} onComplete={() => markAndAdvanceEvent(true)} />}

      {isEventPhase(flow.phase) && flow.phase !== "credits" && !postCreditsFilmActive && event && (
        <section key={flow.eventId ?? flow.phase} className={`v100-event-layout v100-event-${flow.phase} v100-event-category-${eventPresentation?.category ?? "scene"}`} aria-label={flow.phase === "first-clear-post" ? "確定した作戦報酬" : `${eventDisplayLabel(flow.eventId)}イベント`} data-v100-surface={flow.phase} data-v100-event-id={flow.eventId ?? undefined} data-v100-event-category={eventPresentation?.category ?? undefined} data-v100-node-index={eventPresentation?.nodeIndex ?? undefined} data-v100-transition={eventPresentation?.transition ?? undefined} data-v100-audio-owner={eventPresentation?.audioOwner ?? undefined} data-v100-audio-state={eventAudioSnapshot?.audioStatus?.state ?? "locked"} data-v100-audio-revision={eventAudioRevision}>
          <V100EventBackdrop src={eventBackdropFor(eventPresentation, eventRuntime?.backgroundPath ?? "/art/v060/title-key-visual-v1.webp")} scene={eventPresentation?.sceneLabel} location={currentNode?.sceneTag ?? currentNode?.sceneLabel} title={currentNode?.kind === "title"} cinematic={eventPresentation?.cinematic} />
          <article className="v100-event-panel">
            <div className="v100-event-heading"><span className="v100-kicker">{flow.phase === "first-clear-post" && !flow.firstClear ? `${V100_STAGE_BY_ID[flow.stageId ?? ""]?.displayName ?? "作戦"} / 作戦報酬` : eventDisplayLabel(flow.eventId)}</span></div>
            {flow.phase === "first-clear-post" ? <><RewardSummaryView result={save.lastResult} /><div className="v100-event-actions"><button type="button" className="v100-primary" onClick={() => markAndAdvanceEvent(false)}>続ける</button></div></> : currentNode ? <StoryNodeView node={currentNode} leadingActions={storyPage.leadingActions} eventId={flow.eventId} phase={flow.phase} nodeIndex={storyPage.nodeIndex} presentation={eventPresentation} actions={<div className="v100-event-actions">
              <button type="button" className="v100-primary" onClick={() => markAndAdvanceEvent(false)}>{storyPage.endIndex < event.nodes.length - 1 ? "次へ" : flow.phase === "ending" ? "次の場面へ" : "続ける"}</button>
              {flow.canSkip && <button type="button" onClick={() => markAndAdvanceEvent(true)}>スキップ</button>}
            </div>} /> : <p className="v100-action-node">このイベントを確認して次へ進みます。</p>}
          </article>
        </section>
      )}

      {flow.phase === "map" && surface === "campaign" && (
        <MapView
          save={save}
          selectedStageId={selectedStageId}
          onSelect={setSelectedStageId}
          onStart={startStage}
          onRename={openRename}
          onBackup={downloadBackup}
          onImport={importBackup}
          onReplay={(eventId) => { setReplayEventId(eventId); setReplayNodeIndex(0); }}
          onOpenPersonnel={() => openSurface("personnel")}
          onOpenSupportVehicle={() => openSurface("support-vehicle")}
          onOpenData={() => openSurface("data")}
        />
      )}

      {flow.phase === "map" && surface === "rename" && (
        <section className="v100-panel v100-name-card v100-rename-panel" aria-labelledby="v100-rename-title" data-v100-surface="rename">
          <h2 id="v100-rename-title">呼ばれたい名前を変更</h2>
          <p>仲間たちに呼ばれる名前です。12文字以内で入力してください。</p>
          <form onSubmit={rename} onKeyDown={event => { if (event.key === "Escape") openSurface("campaign"); }}>
            <label htmlFor="v100-rename-input">呼ばれたい名前</label>
            <input id="v100-rename-input" value={nameInput} onChange={event => { setNameInput(event.currentTarget.value); setNameError(""); }} autoComplete="nickname" aria-describedby={nameError ? "v100-rename-error" : undefined} />
            {nameError && <small id="v100-rename-error" className="v100-error" role="alert">{nameError}</small>}
            <div className="v100-rename-actions">
              <button type="button" onClick={() => openSurface("campaign")}>変更せず戻る</button>
              <button className="v100-primary" type="submit">この名前に変更</button>
            </div>
          </form>
        </section>
      )}

      {(flow.phase === "map" || flow.phase === "formation") && surface === "personnel" && (
        <PersonnelView
          save={save}
          initialUnitId={personnelSelection}
          returnLabel={flow.phase === "formation" || modePreparation ? "出撃編成へ" : "作戦地図へ"}
          onBack={() => openSurface(modePreparation ? "mode-formation" : "campaign")}
          onPurchase={(unitId) => applySaveTransaction(purchaseV100Unit(save, unitId))}
          onLevel={(unitId, expectedLevel) => applySaveTransaction(upgradeV100Unit(save, unitId, { expectedLevel }))}
        />
      )}

      {(flow.phase === "map" || flow.phase === "formation") && (surface === "support-vehicle" || surface === "vehicle") && (
        <SupportVehicleView
          key={surface}
          vehicleOnly={surface === "vehicle"}
          save={save}
          returnLabel={flow.phase === "formation" || modePreparation ? "出撃編成へ" : "作戦地図へ"}
          onBack={() => openSurface(modePreparation ? "mode-formation" : "campaign")}
          onPurchaseSupport={(supportId) => applySaveTransaction(purchaseV100Support(save, supportId))}
          onEquipSupport={(supportId) => applySaveTransaction(equipV100Support(save, supportId))}
          onUpgradeVehicle={() => applySaveTransaction(upgradeV100Vehicle(save))}
          onOpenSupport={() => openSurface("support-vehicle")}
        />
      )}

      {flow.phase === "map" && surface === "modes" && <V100ModesView save={save}
        initialTab={modeTab} onBack={() => openSurface("campaign")} onLoadout={(tab = "outbreak") => { setModeTab(tab); openSurface("mode-formation"); }}
        onSave={async result => {
          if (!result.applied) { setNotice(formatReason(result.reason)); return false; }
          setNotice(""); return Boolean(await commitSave(result.save));
        }}
      />}
      {(flow.phase === "map" || flow.phase === "formation") && surface === "equipment" && <V100EquipmentView save={save}
        onBack={() => openSurface("support-vehicle")}
        onPurchase={(id, expectedQuantity) => applySaveTransaction(purchaseV100Equipment(save, id, { expectedQuantity }))}
        onUpgrade={(id, expectedLevel) => applySaveTransaction(upgradeV100Equipment(save, id, { expectedLevel }))}
        onEquip={(unitId, slot, equipmentId) => applySaveTransaction(equipV100Equipment(save, { unitId, slot, equipmentId }))}
      />}

      {!battleAudioActive && surface === "data" && (
        <DataManagementView save={save} notice={notice} onBack={() => openSurface(dataReturnSurfaceRef.current)} onBackup={downloadBackup} onNewGameBackup={downloadNewGameBackup} onImport={importBackup} onLegacyHistory={importLegacyHistory} />
      )}

      {flow.phase === "map" && surface === "mode-formation" && <FormationView save={save} stageId={null} onSlotChange={chooseFormation} onStart={() => openSurface("modes")} onBack={() => openSurface("modes")} onLoadout={() => openSurface("support-vehicle")} onPersonnel={id => openSurface("personnel", id)} modePreparation />}

      {flow.phase === "formation" && surface === "campaign" && (
        <FormationView save={save} stageId={flow.stageId} onSlotChange={chooseFormation} onStart={startBattle} onBack={leavePreparation} onLoadout={() => openSurface("support-vehicle")} onPersonnel={(unitId) => openSurface("personnel", unitId)} />
      )}

      {flow.phase === "battle" && productionSession && (
        <AshfallGame externalSession={{ ...productionSession, onBattleResult: handleProductionBattleResult, onBattleAction: handleProductionBattleAction, onSettingsChange: handleProductionSettingsChange }} key={productionSession.resultId} />
      )}

      {flow.phase === "result" && (
        <ResultView result={flow.pendingResult} previousBestStars={Number(save.bestStars[String(flow.pendingResult?.stageId ?? "")]) || 0} alreadyCompleted={save.completedStageIds.includes(String(flow.pendingResult?.stageId ?? ""))} onContinue={continueFromResult} onRetry={() => leaveDefeatResult("formation")} onMap={() => leaveDefeatResult("map")} />
      )}

      {logOpen && <EventLogView save={save} busy={saveBusy} onAutoSkipChange={enabled => applySaveTransaction(applyV100SaveMutation(save, draft => ({ ...draft, settings: { ...draft.settings, autoSkipReadStory: enabled } })))} onReplay={(eventId) => { setReplayEventId(eventId); setReplayNodeIndex(0); }} onClose={() => setLogOpen(false)} />}
      {menuOpen && <V100PlayerMenu settings={save.settings} busy={saveBusy} onClose={() => setMenuOpen(false)} onData={() => { setMenuOpen(false); openSurface("data"); }} onLog={() => { setMenuOpen(false); setLogOpen(true); }} onApply={async settings => {
        if (battleAudioActive || saveBusyRef.current) return false;
        const changed = applyV100SaveMutation(saveRef.current, (draft: Save) => ({ ...draft, settings: { ...draft.settings, ...settings } }));
        return changed.applied && Boolean(await commitSave(changed.save));
      }} />}
      {recruitOffer && <div className="v100-modal-backdrop" role="presentation"><section className="v100-modal v100-recruit-modal" role="dialog" aria-modal="true" aria-labelledby="v100-recruit-title"><span className="v100-kicker">新しい隊員 / 配備登録可能</span><div className="v100-recruit-content"><div className="v100-recruit-art">{formationCardForUnit(recruitOffer.id) && <img src={formationCardForUnit(recruitOffer.id) as string} alt={`${recruitOffer.displayName}の立ち絵`} />}</div><div><h2 id="v100-recruit-title">{recruitOffer.displayName}</h2><strong>{v100RoleLabelFor(recruitOffer.role)}</strong><p>{unitDescriptionFor(recruitOffer.id)}</p><dl><div><dt>配備登録</dt><dd>{recruitOffer.registrationCostCaps} CAPS</dd></div><div><dt>所持</dt><dd>{save.caps} CAPS</dd></div></dl>{save.caps < recruitOffer.registrationCostCaps && <p className="v100-recruit-shortage">あと {recruitOffer.registrationCostCaps - save.caps} CAPSで登録できます。</p>}</div></div><div className="v100-recruit-actions"><button type="button" onClick={() => applySaveTransaction(applyV100SaveMutation(save, next => ({ ...next, receipts: [...new Set([...next.receipts, `v100:recruit-offer:${recruitOffer.id}:seen`])] })))}>後で決める</button><button className="v100-primary" type="button" data-ui-sound="transaction" disabled={saveBusy || save.caps < recruitOffer.registrationCostCaps} onClick={() => applySaveTransaction(purchaseV100Unit(save, recruitOffer.id))}>{recruitOffer.registrationCostCaps} CAPSで配備登録</button></div></section></div>}
      {creditsOpen && flow.phase === "name" && <div className="v100-modal-backdrop" role="presentation"><section className="v100-modal v100-credits-modal" role="dialog" aria-modal="true" aria-labelledby="v100-credits-title"><div className="v100-panel-heading"><div><span className="v100-kicker">Version 1.0.0</span><h2 id="v100-credits-title">権利・クレジット</h2></div><button type="button" onClick={() => setCreditsOpen(false)}>閉じる</button></div><V100AssetCredits expanded /></section></div>}
      {replayEventId === "v100:event:credits" && replayEvent ? <div className="v100-staff-roll-replay">{replayFinale ? <V100PostCreditsFilm settings={save.settings} onComplete={() => { setReplayFinale(false); setReplayEventId(null); return true; }} /> : <V100StaffRoll nodes={replayEvent.nodes} playerName={save.playerName} settings={save.settings} onComplete={() => { setReplayFinale(true); return true; }} />}</div> : replayEvent && <ReplayView event={replayEvent} node={replayNode} index={replayNodeIndex} onNext={() => setReplayNodeIndex((index) => index + 1)} onClose={() => setReplayEventId(null)} />}
      {giftError && !giftPopup && <button type="button" onClick={() => { setGiftError(false); setGiftWake(value => value + 1); }}>特典の保存を再試行</button>}
      {giftPopup && giftScreen && <div className="v100-modal-backdrop"><section ref={giftDialogRef} className="v100-modal v100-gift-modal" role="dialog" aria-modal="true" aria-labelledby="v100-gift-title" aria-describedby="v100-gift-amount v100-gift-balance"><span className="v100-kicker">引き継ぎ特典</span><h2 id="v100-gift-title">新しい作戦記録を開始しました</h2><p>これまでのプレイへの感謝として、180 CAPSを付与しました。過去の記録は保持しています。</p><div className="v100-gift-balances"><p id="v100-gift-amount">付与CAPS: 180</p><p id="v100-gift-balance">新しいCAPS残高: {giftPopup.balance}</p></div>{giftError ? <button type="button" onClick={() => setGiftError(false)}>表示の保存を再試行</button> : <button className="v100-primary" type="button" disabled={!giftPopup.acknowledged || saveBusy} onClick={() => setGiftPopup(null)}>確認する</button>}</section></div>}
    </main>
  );
}

function StoryNodeView({ node, eventId = null, phase = "event", nodeIndex = 0, presentation = null, actions = null, leadingActions = [] }: { node: StoryNode; eventId?: string | null; phase?: string; nodeIndex?: number; presentation?: ReturnType<typeof v100EventPresentationFor> | null; actions?: ReactNode; leadingActions?: StoryNode[] }) {
  const actionSubjects = v100ActionPortraitSubjects(eventId, node, nodeIndex);
  const displayOwner = node.portraitOwner ?? actionSubjects[0] ?? null;
  const resolvedPresentation = presentation ?? v100EventPresentationFor({ eventId, phase, node, nodeIndex });
  const expression = v100StoryExpressionFor(eventId, nodeIndex, node, displayOwner);
  const portrait = resolvedPresentation.cinematic ? null : v100EventPortraitPath(displayOwner, expression) ?? portraitFor(displayOwner);
  const slots = v100DialogueSlots(eventId ? v100StoryEventFor(eventId)?.nodes ?? [node] : [node], nodeIndex);
  const portraitSide = portrait ? slots.right?.portraitOwner === displayOwner ? "right" : "left" : "none";
  // An offscreen/radio voice has no on-screen speaker. Do not leave the
  // previous interlocutor's portrait beside that voice as a false speaker.
  const secondaryNode = node.kind === "dialogue" && portrait ? slots[portraitSide === "right" ? "left" : "right"] : null;
  const secondaryOwner = secondaryNode?.portraitOwner ?? actionSubjects[1] ?? null;
  // The listener reacts to this beat, rather than retaining the expression
  // from their most recent spoken line.
  const secondaryExpression = v100StoryExpressionFor(eventId, nodeIndex, node, secondaryOwner);
  const secondaryPortrait = resolvedPresentation.cinematic ? null : v100EventPortraitPath(secondaryOwner, secondaryExpression) ?? portraitFor(secondaryOwner);
  const secondaryPortraitSide = portraitSide === "right" ? "left" : portraitSide === "left" ? "right" : "none";
  const nodeLabel = node.kind === "dialogue" ? storySpeakerLabel(node.speaker) : node.kind === "player-action" ? "主人公" : node.kind === "battle-marker" ? "作戦情報" : node.kind === "system" ? "無線記録" : "";
  const playerFacingText = publicDisplayText(node.text || "…");
  const framingStyle = (owner: string | null | undefined) => { const framing = v100EventPortraitPath(owner) ? {scale:"100%",shift:"0%",headroom:"0px"} : v100PortraitFraming(owner); return { "--portrait-scale": framing.scale, "--portrait-shift": framing.shift, "--portrait-headroom": framing.headroom } as CSSProperties; };
  if (node.kind === "title") return <div className="v100-story-node v100-node-title" data-v100-node-kind="title"><h2>{playerFacingText}</h2>{actions}</div>;
  if (node.kind === "montage") return <div className="v100-story-node v100-credits-shot" data-v100-node-kind="montage" data-v100-credit-scene={node.sceneLabel}><span className="v100-kicker">西新の、その後</span><h2>{node.sceneLabel}</h2><p>{playerFacingText}</p>{actions}</div>;
  return <div className={`v100-story-node v100-node-${node.kind ?? "action"}`} data-portrait-side={portraitSide} data-portrait-count={portrait ? secondaryPortrait ? "2" : "1" : "0"} data-v100-state={`dialogue-${portraitSide}`} data-v100-node-kind={resolvedPresentation?.nodeKind ?? node.kind ?? "action"} data-v100-node-label={resolvedPresentation?.nodeLabel ?? "場面"} data-v100-transition={resolvedPresentation?.transition ?? undefined} data-v100-audio-cue={resolvedPresentation?.cueId ?? undefined}>
    {secondaryPortrait && <div className="v100-portrait-frame v100-portrait-frame-secondary" style={framingStyle(secondaryOwner)} data-portrait-framing="waist-up-common" data-portrait-owner={secondaryOwner ?? undefined} data-portrait-side={secondaryPortraitSide} data-v100-expression={secondaryExpression}><img key={secondaryPortrait} className="v100-portrait v100-portrait-secondary" src={secondaryPortrait} alt="" aria-hidden="true" decoding="async" /></div>}
    {portrait && <div className="v100-portrait-frame" style={framingStyle(displayOwner)} data-portrait-framing="waist-up-common" data-portrait-owner={displayOwner ?? undefined} data-portrait-side={portraitSide} data-v100-expression={expression}><img key={portrait} className="v100-portrait" src={portrait} alt={`${node.speaker ?? UNIT_BY_ID.get(displayOwner ?? "")?.displayName ?? "登場人物"}の立ち絵`} decoding="async" /></div>}
    <div className="v100-node-copy">{nodeLabel && <span className="v100-node-kind">{nodeLabel}</span>}{leadingActions.length ? <div className="v100-story-prose">{leadingActions.map((action, index) => <p className="v100-story-action-beat" key={index}>{publicDisplayText(action.text ?? "")}</p>)}<p>{playerFacingText}</p></div> : <p>{playerFacingText}</p>}{actions}</div>
  </div>;
}

function MapView({ save, selectedStageId, onSelect, onStart, onRename, onBackup, onImport, onReplay, onOpenPersonnel, onOpenSupportVehicle, onOpenData }: { save: Save; selectedStageId: string; onSelect: (id: string) => void; onStart: (id: string) => void; onRename: () => void; onBackup: () => void; onImport: (file: File | undefined) => void; onReplay: (eventId: string) => void; onOpenPersonnel: () => void; onOpenSupportVehicle: () => void; onOpenData: () => void }) {
  const stage = V100_STAGE_BY_ID[selectedStageId];
  const discovered = v100StageDiscovered(save, selectedStageId);
  const completedNumber = Math.max(0, ...save.completedStageIds.map(stageNumberFor));
  const [chapterIndex, setChapterIndex] = useState(() => chapterIndexForStage(stage?.number ?? 1));
  const chapter = V100_CHAPTERS[chapterIndex] ?? V100_CHAPTERS[0];
  const chapterStages = V100_STAGES.filter((entry) => entry.number >= chapter.start && entry.number <= chapter.end);
  const regionalMap = v100RegionalMapForChapter(chapter.id);
  const mapDisclosure = v100RegionalMapDisclosure(regionalMap, chapterStages.map((entry) => entry.id), save);
  const chapterPoints = v100RegionalMapPoints(chapter.id, chapterStages.length);
  const chapterPinPoints = v100RegionalMapPinPoints(chapter.id, chapterStages.length);
  const chapterComplete = chapterStages.filter((entry) => save.completedStageIds.includes(entry.id)).length;
  const chapterStars = chapterStages.reduce((sum, entry) => sum + Math.max(0, Math.min(3, Number(save.bestStars[entry.id]) || 0)), 0);
  const campaignStars = V100_STAGES.reduce((sum, entry) => sum + Math.max(0, Math.min(3, Number(save.bestStars[entry.id]) || 0)), 0);
  const boss = discovered && stage?.missionType === "boss" ? V100_BOSSES.find((entry) => entry.stageNumber === stage.number) : null;
  const nextStage = V100_STAGES.find((entry) => entry.number === completedNumber + 1);
  const selectStage = (stageId: string) => {
    const next = V100_STAGE_BY_ID[stageId];
    if (next) setChapterIndex(chapterIndexForStage(next.number));
    onSelect(stageId);
  };
  const selectChapter = (index: number) => {
    const nextChapter = V100_CHAPTERS[index];
    if (!nextChapter) return;
    setChapterIndex(index);
    if (stage && stage.number >= nextChapter.start && stage.number <= nextChapter.end) return;
    const stages = V100_STAGES.filter((entry) => entry.number >= nextChapter.start && entry.number <= nextChapter.end);
    const nextStage = stages.find((entry) => save.availableStageIds.includes(entry.id) && !save.completedStageIds.includes(entry.id))
      ?? stages.find((entry) => save.availableStageIds.includes(entry.id))
      ?? stages[0];
    if (nextStage) onSelect(nextStage.id);
  };
  const routePoints = chapterPoints.map(([x, y]) => {
    return `${x},${y}`;
  }).join(" ");
  const regionStyle = { "--v100-region-map": `url("${regionalMap.assetPath}")` } as CSSProperties;
  return (
    <section className={`v100-map-layout v100-command-map ${discovered && stage?.missionType === "boss" ? "v100-map-boss-focus" : ""} ${stage && !save.availableStageIds.includes(stage.id) ? "v100-map-locked-focus" : ""}`} aria-label="作戦地図" data-v100-surface="map" style={regionStyle}>
      <div className="v100-map-hero v100-regional-map-banner">
        <div className="v100-map-hero-copy"><span className="v100-kicker">作戦地図 / {mapDisclosure.regionLabel} / {save.postGameAvailable ? "全作戦解放" : `次の目的地 ${v100MapStageName(nextStage, save)}`}</span><h2>{v100MapStageName(stage, save)}</h2><p>{discovered ? objectiveLabelFor(stage) : "現地情報は到達後に確認"} / 作戦 {stage ? `S${String(stage.number).padStart(2, "0")}` : "準備中"}</p><div className="v100-map-hero-meta"><span>{chapter.label} / {mapDisclosure.subregionLabel}</span><strong>{stage && save.availableStageIds.includes(stage.id) ? "出撃可能" : "前作戦クリアで解放"}</strong><span>S{chapter.range}</span></div></div>
      </div>
      <nav className="v100-chapter-tabs" aria-label="作戦区域を選ぶ">{V100_CHAPTERS.map((entry, index) => {
        const entries = V100_STAGES.filter((candidate) => candidate.number >= entry.start && candidate.number <= entry.end);
        const complete = entries.filter((candidate) => save.completedStageIds.includes(candidate.id)).length;
        const stars = entries.reduce((sum, candidate) => sum + Math.max(0, Math.min(3, Number(save.bestStars[candidate.id]) || 0)), 0);
        const region = v100RegionalMapForChapter(entry.id);
        const disclosure = v100RegionalMapDisclosure(region, entries.map((candidate) => candidate.id), save);
        return <button type="button" key={entry.id} className={index === chapterIndex ? "selected" : ""} onClick={() => selectChapter(index)} aria-pressed={index === chapterIndex} aria-label={`${entry.label} ${disclosure.regionLabel}、作戦 ${complete}/${entries.length}、記録星 ${stars}/${entries.length * 3}`}><strong>{entry.label}</strong><small>{disclosure.regionLabel}</small><span className="v100-chapter-counts"><b>{complete}/{entries.length}作戦</b><b>★{stars}/{entries.length * 3}</b></span></button>;
      })}</nav>
      <div className="v100-regional-progress" aria-label={`全作戦の記録 ${save.completedStageIds.length} / ${V100_STAGES.length} 作戦、星 ${campaignStars} / ${V100_STAGES.length * 3}`}><strong>{mapDisclosure.regionLabel}</strong><span>{chapterComplete}/{chapterStages.length} 作戦完了</span><span>記録星 {chapterStars}/{chapterStages.length * 3}</span><span>全体 {save.completedStageIds.length}/{V100_STAGES.length} / ★ {campaignStars}/{V100_STAGES.length * 3}</span></div>
      <div className="v100-route-label" aria-label={`${mapDisclosure.regionLabel} 作戦経路`}><span>{mapDisclosure.regionLabel}</span><i />{chapterStages.map((entry) => <b key={`route-${entry.id}`} className={`${entry.number === completedNumber + 1 ? "current" : ""} ${save.completedStageIds.includes(entry.id) ? "clear" : ""}`} aria-hidden="true" />)}<span>次の区域</span></div>
      <div className="v100-map-grid">
        <div className="v100-map-canvas-shell v100-regional-map-canvas" data-map-region={chapter.id}>
          <div className="v100-map-canvas-heading"><span className="v100-kicker">{chapter.label} / {mapDisclosure.regionLabel}</span><strong>{chapterStages.length}地点 / ★{chapterStars}/{chapterStages.length * 3}</strong></div>
          <nav className="v100-map-canvas v100-stage-list" aria-label={`${chapter.label}の作戦地点`}>
            <svg className="v100-map-route-art" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><polyline points={routePoints} />{chapterPoints.map(([x, y], index) => { const [pinX, pinY] = chapterPinPoints[index] ?? [x, y]; return x === pinX && y === pinY ? null : <line key={`pin-leader-${index}`} className="v100-map-pin-leader" x1={x} y1={y} x2={pinX} y2={pinY} />; })}</svg>
            {chapterStages.map((entry, index) => {
              const available = save.availableStageIds.includes(entry.id);
              const completed = save.completedStageIds.includes(entry.id);
              const isBoss = v100StageDiscovered(save, entry.id) && entry.missionType === "boss";
              const [x, y] = chapterPinPoints[index] ?? mapNodePosition(index, chapterStages.length);
              const nodeState = completed ? "制圧済み" : available ? "出撃可" : "封鎖中";
              const stageStars = Math.max(0, Math.min(3, Number(save.bestStars[entry.id]) || 0));
              const stageName = available || completed ? v100MapStageName(entry, save) : "封鎖地点";
              return <button type="button" key={entry.id} data-stage-number={entry.number} className={`v100-map-node v100-regional-pin ${selectedStageId === entry.id ? "selected" : ""} ${completed ? "completed" : ""} ${!available ? "locked" : "available"} ${isBoss ? "boss-node" : ""}`} style={{ "--node-x": `${x}%`, "--node-y": `${y}%` } as CSSProperties} onClick={() => selectStage(entry.id)} aria-label={`${stageName} S${String(entry.number).padStart(2, "0")} ${nodeState}、記録星 ${stageStars}/3`}>
                <span className="v100-map-node-marker"><i>{`S${String(entry.number).padStart(2, "0")}`}</i>{!available && <V100LockChain />}</span><span className="v100-map-node-copy"><strong>{stageName}</strong><small>{!available ? "前作戦クリアで解放" : `${nodeState} / ${missionLabelFor(entry)}`}</small><V100StageStars stars={stageStars} /></span>
              </button>;
            })}
          </nav>
          <div className="v100-map-canvas-legend"><span><i className="is-current" />選択地点</span><span><i className="is-clear" />制圧済み</span><span><i className="is-locked" />封鎖</span></div>
        </div>
        <aside className={`v100-map-side ${discovered && stage?.missionType === "boss" ? "is-boss" : ""} ${stage && !save.availableStageIds.includes(stage.id) ? "is-locked" : ""}`}>
          <div className="v100-map-briefing">
            <div className="v100-map-side-heading"><span className="v100-kicker">{stage ? `作戦 S${String(stage.number).padStart(2, "0")}` : "作戦地図"}</span><span>{stage && save.availableStageIds.includes(stage.id) ? "出撃可能" : "封鎖中"}</span></div>
            <h3>{v100MapStageName(stage, save)}</h3>
            {stage && !save.availableStageIds.includes(stage.id) && <div className="v100-lock-banner"><strong>作戦封鎖中</strong><span>前作戦クリアで解放</span></div>}
            <div className="v100-stage-intel"><span>作戦目標</span><strong>{discovered ? missionLabelFor(stage) : "情報未取得"}</strong><p>{discovered ? objectiveLabelFor(stage) : "前作戦をクリアして、この区域を調査します。"}</p></div>
            {discovered && <p className="v100-map-tactical-hint">{v100TacticalHintFor(stage)}</p>}
          </div>
          <details className="v100-map-detail"><summary>作戦詳細・記録</summary>
            <div className="v100-map-detail-content">
              {boss && <div className="v100-boss-callout"><strong className="v100-boss-name">{boss.displayName}</strong><small>脅威 HP {boss.hp.toLocaleString()} / 特殊：{BOSS_SPECIAL_LABELS[boss.special]}</small></div>}
              <dl><div><dt>脅威分類</dt><dd>{discovered ? enemyPackLabelFor(stage?.enemyPack, stage?.number) : "情報未取得"}</dd></div><div><dt>配置枠</dt><dd>{save.formationSlots.filter(Boolean).length} / 7</dd></div></dl>
              <StarCriteria vehicleMaxHp={save.vehicle.maxHp} />
              <div className="v100-map-actions" aria-label="出撃準備"><button type="button" aria-label="隊員を編成" onClick={onOpenPersonnel}>隊員</button><button type="button" aria-label="出撃装備を選ぶ" onClick={onOpenSupportVehicle}>戦術支援</button></div>
              <div className="v100-map-briefs"><article><span>隊員</span><strong>{save.ownedUnitIds.length}名</strong><small>出撃編成</small></article><article><span>装甲車両</span><strong>装甲車両</strong><small>耐久 {save.vehicle.maxHp}</small></article><article><span>戦術支援</span><strong>{save.equippedSupportId ? "装備中" : "未選択"}</strong><small>出撃装備</small></article></div>
              <div className="v100-map-tools"><button type="button" onClick={onRename}>表示名を変更</button><button type="button" onClick={onBackup}>簡易バックアップ</button><label className="v100-file-button">復元<input type="file" accept="application/json" onChange={(event) => onImport(event.currentTarget.files?.[0])} /></label><button className="v100-utility-button" type="button" onClick={onOpenData}>データ管理</button></div>
              <div className="v100-replay-list"><span className="v100-kicker">会話記録</span>{save.readStoryEventIds.slice(-6).map((eventId) => <button type="button" key={eventId} onClick={() => onReplay(eventId)}>{eventDisplayLabel(eventId)}</button>)}</div>
              <V100AssetCredits />
            </div>
          </details>
          <button className="v100-primary" type="button" disabled={!stage || !save.availableStageIds.includes(stage.id)} onClick={() => stage && onStart(stage.id)}>{save.completedStageIds.includes(stage?.id ?? "") ? "再出撃" : "この作戦を編成"}</button>
        </aside>
      </div>
    </section>
  );
}

function MissionBriefingDiagram({ stageId }: { stageId: string | null }) {
  const briefing = v100MissionBriefingFor(stageId);
  if (!briefing) return null;
  const isHold = briefing.mode === "hold";
  return <svg className={"v100-field-map-drawing v100-mission-diagram " + (isHold ? "is-hold" : "")} viewBox="0 -8 320 100" role="img" aria-label="作戦の流れ" data-v100-mission-mode={briefing.mode}>
    <defs><marker id="v100-briefing-arrow" markerWidth="7" markerHeight="7" refX="5" refY="3" orient="auto"><path d="M0 0L6 3L0 6" fill="none" stroke="currentColor" strokeWidth="1.5" /></marker></defs>
    <path className="v100-briefing-streets" d="M15 30H304M15 59H304M90 25V66M230 25V66" />
    {briefing.mode === "sequence" ? <>
      <text className="v100-briefing-label" x="160" y="17" textAnchor="middle">{briefing.label} / {briefing.count}基</text>
      <path className="v100-briefing-route" d="M44 43H274" markerEnd="url(#v100-briefing-arrow)" />
      {Array.from({ length: briefing.count }, (_, index) => <g key={index}><circle className="v100-briefing-node" cx={44 + index * 232 / (briefing.count - 1)} cy="43" r="12" /><text className="v100-briefing-step" x={44 + index * 232 / (briefing.count - 1)} y="49" textAnchor="middle">{index + 1}</text></g>)}
      <text className="v100-briefing-label" x="160" y="77" textAnchor="middle">順番に{briefing.verb}</text>
    </> : briefing.mode === "dual-target" ? <>
      <circle className="v100-briefing-node" cx="43" cy="43" r="12" /><text className="v100-briefing-label" x="43" y="77" textAnchor="middle">部隊</text>
      {briefing.targets.map((target, index) => <g key={target}><path className="v100-briefing-route" d={"M58 43L251 " + (index ? 57 : 29)} markerEnd="url(#v100-briefing-arrow)" /><circle className="v100-briefing-node target" cx="271" cy={index ? 57 : 29} r="9" /><text className="v100-briefing-label" x="310" y={index ? 80 : 17} textAnchor="end">{target}</text></g>)}
    </> : <>
      <text className="v100-briefing-label" x="16" y="17">{briefing.origin}</text><text className="v100-briefing-label" x="304" y="17" textAnchor="end">{briefing.target}</text>
      <circle className="v100-briefing-node" cx="43" cy="43" r="12" /><circle className="v100-briefing-node target" cx="276" cy="43" r="12" />
      <path className="v100-briefing-route" d={isHold ? "M260 43H62" : "M59 43H255"} markerEnd="url(#v100-briefing-arrow)" />
      <text className="v100-briefing-label" x="160" y="77" textAnchor="middle">{briefing.verb}</text>
    </>}
  </svg>;
}

function V100StageStars({ stars, label = "記録星" }: { stars: number; label?: string }) {
  const earned = Math.max(0, Math.min(3, Math.floor(stars)));
  return <span className="v100-stage-stars" role="img" aria-label={`${label} ${earned} / 3`} data-best-stars={earned}>
    {[1, 2, 3].map((star) => <svg key={star} viewBox="0 0 24 24" aria-hidden="true" className={star <= earned ? "earned" : "pending"}><path d="m12 1.8 3.15 6.38 7.04 1.02-5.1 4.97 1.2 7.02L12 17.88l-6.29 3.31 1.2-7.02-5.1-4.97 7.04-1.02L12 1.8Z" /></svg>)}
  </span>;
}

function FormationView({ save, stageId, onSlotChange, onStart, onBack, onLoadout, onPersonnel, modePreparation = false }: { save: Save; stageId: string | null; onSlotChange: (slot: number, value: string) => void; onStart: () => void; onBack: () => void; onLoadout: () => void; onPersonnel: (unitId: string | null) => void; modePreparation?: boolean }) {
  const [activeSlot, setActiveSlot] = useState(0);
  const [pickerOpen, setPickerOpen] = useState(false);
  const stage = stageId ? V100_STAGE_BY_ID[stageId] : null;
  const basePresentation = v100BasePresentationFor(stage?.number);
  const threats = v100MissionThreatsFor(stageId);
  const ownedUnits = save.ownedUnitIds.map((unitId) => UNIT_BY_ID.get(unitId)).filter(Boolean) as Array<(typeof V100_UNITS)[number]>;
  const activeUnitId = save.formationSlots[activeSlot] ?? null;
  const activeUnit = activeUnitId ? UNIT_BY_ID.get(activeUnitId) ?? null : null;
  const activePresentation = activeUnitId ? v100UnitPresentation(save, activeUnitId) : null;
  const support = V100_SUPPORTS.find((entry) => entry.id === save.equippedSupportId);
  const assignActiveSlot = (unitId: string) => { onSlotChange(activeSlot, unitId); setPickerOpen(false); };
  return <section className={"v100-panel v100-formation-panel v100-sortie-panel v100-command-formation " + (pickerOpen ? "picker-open" : "")} data-v100-surface="formation" style={{ "--v100-stage-art": "url(" + (stage ? stageVisualFor(stage.id) : PRODUCTION_VISUALS.command) + ")" } as CSSProperties}>
    <div className="v100-panel-heading v100-sortie-heading"><h2>出撃編成</h2><strong className="v100-sortie-count">{save.formationSlots.filter(Boolean).length}<small>/ 7 呼び出し枠</small></strong></div>
    <div className="v100-formation-board">
      <div className="v100-slot-rail" aria-label="7枠の編成">
        <div className="v100-field-map-pane">
          <span className="v100-field-map-title"><strong>{stage ? "S" + String(stage.number).padStart(2, "0") + " / " + stageDisplayNameFor(stage) : "異常発生・サバイバル / 出撃準備"}</strong></span>
          <div className="v100-field-map-intel"><strong>{modePreparation ? "仲間を選び、次の迎撃に備える" : objectiveLabelFor(stage)}</strong></div>
          {activeUnit && activePresentation ? <div className="v100-briefing-person" data-v100-focused-unit={activeUnit.id}>
            <img src={portraitFor(activeUnit.id) ?? formationCardForUnit(activeUnit.id) ?? ""} alt={activeUnit.displayName} />
            <div tabIndex={0} aria-label={`${activeUnit.displayName}の役割・固有技`}><h3>{activeUnit.displayName} <small>Lv.{activePresentation.level}</small></h3><strong className="v100-briefing-role-description">{activePresentation.description.split("・").map((part, index, parts) => <span key={`${index}-${part}`}>{part}{index < parts.length - 1 ? "・" : ""}</span>)}</strong><span className="v100-briefing-callin">指揮 {activePresentation.commandCost} / 再配備 {formatV100Number(activePresentation.redeploySeconds)}秒</span>{activePresentation.skill && <p>{activePresentation.skill.name}：{activePresentation.skill.summary}</p>}</div>
          </div> : <div className="v100-briefing-empty"><strong>この枠に呼ぶ仲間を選ぶ</strong><span>出撃中は、同じ仲間を繰り返し呼べます。</span></div>}
        </div>
        <div className="v100-callin-roster">
          <div className="v100-callin-heading"><strong>呼び出し枠 {save.formationSlots.filter(Boolean).length} / 7</strong><details className="v100-briefing-details"><summary>作戦情報・操作</summary><div><strong>{modePreparation ? "各作戦の条件は出撃前に確認できます" : objectiveLabelFor(stage)}</strong>{stage && <><MissionBriefingDiagram stageId={stageId} /><p>{missionLabelFor(stage)} / {enemyPackLabelFor(stage?.enemyPack, stage?.number)}</p>{threats.length > 0 && <ul aria-label="出現候補の行動">{threats.map(threat => <li key={threat.id}>{threat.name}：{threat.purpose}</li>)}</ul>}<p>{v100TacticalHintFor(stage)}</p></>}<p>同時出撃は全隊員合わせて7体まで。同じ隊員を複数枠に入れても、出撃ボタンの待ち時間は共通です。枠を増やしても、上限や再配備の速さは変わりません。</p>{!modePreparation && <StarCriteria vehicleMaxHp={save.vehicle.maxHp} />}</div></details><small>1枠で同じ隊員を繰り返し呼べます。重複枠は待ち時間を共有。</small></div>
          <div className="v100-slot-track">{save.formationSlots.map((unitId, index) => {
            const art = unitId ? portraitFor(unitId) ?? formationCardForUnit(unitId) : null;
            const unit = unitId ? UNIT_BY_ID.get(unitId) : null;
            const info = unitId ? v100UnitPresentation(save, unitId) : null;
            return <button type="button" key={"slot-" + index} className={"v100-slot " + (activeSlot === index ? "selected " : "") + (unitId ? "filled" : "empty")} onClick={() => { setActiveSlot(index); setPickerOpen(true); }} aria-pressed={activeSlot === index} aria-label={"編成枠" + (index + 1) + (unit ? " " + unit.displayName : " 空き")}>
              <span className="v100-slot-portrait">{art ? <img key={art} src={art} alt="" onLoad={(event) => { const image = event.currentTarget; const decoded = typeof image.decode === "function" ? image.decode().catch(() => {}) : Promise.resolve(); void decoded.then(() => requestAnimationFrame(() => { if (image.isConnected && image.naturalWidth > 0) image.dataset.loaded = "true"; })); }} /> : <i aria-hidden="true">＋</i>}</span>
              <span className="v100-slot-meta"><small>{index + 1}枠</small><strong>{unit ? unit.displayName : "空き"}</strong><b>{info ? `指揮 ${info.commandCost}` : "隊員を選ぶ"}</b></span>
            </button>;
          })}</div>
        </div>
      </div>
      <div className="v100-formation-workspace">
        <div className="v100-roster-heading"><h3>枠 {activeSlot + 1} / 隊員を選ぶ</h3><span>選ぶとこの枠に編成</span><button type="button" className="v100-picker-close" onClick={() => setPickerOpen(false)}>編成に戻る</button></div>
        <div className="v100-formation-columns"><div className="v100-roster-grid">{ownedUnits.map((unit) => {
          const art = formationCardForUnit(unit.id);
          const info = v100UnitPresentation(save, unit.id);
          return <button type="button" className={"v100-roster-card game-unit-card " + (activeUnitId === unit.id ? "selected" : "")} key={unit.id} onClick={() => assignActiveSlot(unit.id)} aria-label={unit.displayName + "を枠" + (activeSlot + 1) + "へ配置"}>
            <span className="v100-roster-card-art">{art && <img src={art} alt="" />}</span>
            <span className="v100-roster-card-copy"><strong>{unit.displayName} <b>Lv.{info?.level ?? 1}</b></strong><small>{v100RoleLabelFor(unit.role)} / {info?.description}</small><small>指揮 {info?.commandCost} / 再配備 <span className="v100-time-value">{formatV100Number(info?.redeploySeconds ?? 0)}秒</span></small></span>
          </button>;
        })}</div></div>
      </div>
    </div>
    <div className="v100-sortie-status">
      <button type="button" className="v100-sortie-selected" onClick={() => onPersonnel(activeUnitId)}><strong>隊員の育成</strong><small>{activeUnit ? `${activeUnit.displayName}の能力・強化効果を確認` : "仲間の能力・強化効果を確認"}</small></button>
      <button type="button" className="v100-sortie-loadout" onClick={onLoadout}><strong>支援：{support?.displayName ?? "未選択"}</strong><small>{basePresentation.label} 耐久 {save.vehicle.maxHp} / 装備を確認</small></button>
    </div>
    <div className="v100-formation-footer"><button type="button" onClick={onBack}>{modePreparation ? "作戦一覧へ" : "作戦地図へ"}</button><button type="button" onClick={() => onSlotChange(activeSlot, "")} disabled={!save.formationSlots[activeSlot]}>枠を空ける</button><button className="v100-primary" type="button" aria-label={modePreparation ? "この編成で作戦を選ぶ" : "戦闘へ"} disabled={!save.formationSlots.some(Boolean)} onClick={onStart}>{modePreparation ? "この編成で作戦を選ぶ" : "出撃"}</button></div>
  </section>;
}

function PersonnelView({ save, initialUnitId, returnLabel, onBack, onPurchase, onLevel }: { save: Save; initialUnitId: string | null; returnLabel: string; onBack: () => void; onPurchase: (unitId: string) => void; onLevel: (unitId: string, expectedLevel: number) => void }) {
  const focusedUnitId = initialUnitId && save.ownedUnitIds.includes(initialUnitId) ? initialUnitId : null;
  const [selectedUnitId, setSelectedUnitId] = useState(() => focusedUnitId ?? save.ownedUnitIds[0] ?? V100_UNITS[0]?.id ?? "");
  const [detailOpen, setDetailOpen] = useState(Boolean(focusedUnitId));
  const selectedUnit = UNIT_BY_ID.get(selectedUnitId) ?? V100_UNITS[0];
  const info = selectedUnit ? v100UnitPresentation(save, selectedUnit.id) : null;
  const currentStats = info?.current;
  const nextStats = info?.next;
  const nextGrowth = currentStats && nextStats ? [
    nextStats.hp > currentStats.hp ? "HP +" + (nextStats.hp - currentStats.hp) : null,
    nextStats.defense > currentStats.defense ? "防御力 +" + ((nextStats.defense - currentStats.defense) * 100).toFixed(2) + "ポイント" : null,
    nextStats.damage > currentStats.damage ? (info?.attackType === "ranged" ? "射撃 +" : "近接 +") + formatV100Number(nextStats.damage - currentStats.damage) : null,
    nextStats.healing > currentStats.healing ? "治療 +" + formatV100Number(nextStats.healing - currentStats.healing) : null,
  ].filter(Boolean).join(" / ") : "";
  const showStat = (name: string, value: number | string, next: number | string | null = null) => <div className={`v100-unit-stat ${next !== null && next !== value ? "v100-stat-improves" : ""}`} key={name}><span>{name}</span><strong>{value}</strong>{next !== null && next !== value && <small>→ {next}</small>}</div>;
  const price = info?.owned ? info.upgradeCost : info?.registrationCost ?? 0;
  return <section className={"v100-panel v100-management-panel v100-personnel-screen v100-command-personnel " + (detailOpen ? "detail-open" : "")} data-v100-surface="personnel" aria-label="隊員">
    <div className="v100-panel-heading v100-management-heading"><h2>隊員記録</h2><button type="button" onClick={onBack}>{returnLabel}</button></div>
    <div className="v100-personnel-workspace">
      <div className="v100-personnel-roster"><div className="v100-roster-heading"><h3>隊員一覧</h3><span>配備登録 {save.ownedUnitIds.length}名 / 16名</span></div>
        <div className="v100-personnel-grid">{V100_UNITS.map((unit) => {
          const owned = save.ownedUnitIds.includes(unit.id), registered = save.registeredUnitIds.includes(unit.id);
          const art = formationCardForUnit(unit.id);
          return <button type="button" className={"v100-personnel-card game-unit-card " + (selectedUnit?.id === unit.id ? "selected " : "") + (owned ? "owned" : registered ? "registered" : "locked")} key={unit.id} onClick={() => { setSelectedUnitId(unit.id); setDetailOpen(true); }} aria-pressed={selectedUnit?.id === unit.id}>
            <div className="v100-personnel-art">{art && <img src={art} alt="" />}{!owned && !registered && <V100LockChain />}</div>
            <div className="v100-personnel-copy"><h3>{unit.displayName}</h3><span>{v100RoleLabelFor(unit.role)}</span><small>{owned ? "Lv." + Math.max(1, Number(save.unitLevels[unit.id]) || 1) : registered ? "配備登録 " + unit.registrationCostCaps + " CAPS" : "S" + String(unit.availabilityStageNumber).padStart(2, "0") + "で解放"}</small></div>
          </button>;
        })}</div>
      </div>
      <aside className="v100-personnel-focus v100-unit-focus" aria-label="選択中の隊員" data-unit-id={selectedUnit?.id} data-unit-level={info?.level}>
        {selectedUnit && info && currentStats && <>
          <div className="v100-personnel-focus-art">{formationCardForUnit(selectedUnit.id) && <img src={formationCardForUnit(selectedUnit.id) as string} alt={selectedUnit.displayName + "の立ち絵"} />}</div>
          <div className="v100-unit-growth-notes"><details><summary>育成の変化</summary><p>{nextStats ? "今回：" + (nextGrowth || "数値変化なし") : "現在の育成上限"}{info.nextOutputGrowth && <><br />{info.nextOutputGrowth.stat === "healing" ? "治療" : info.attackType === "ranged" ? "射撃ダメージ" : "近接ダメージ"}はLv.{info.nextOutputGrowth.level}で{formatV100Number(info.nextOutputGrowth.value)}。{!info.nextOutputGrowth.withinCap && "上限解禁後に育成できます。"}</>}<br />{info.equipmentNames.length ? info.equipmentNames.join(" / ") : "装備なし"}<br />防御力は受けるダメージの軽減率です。{info.skill && <><br />{info.skill.name}：{info.skill.detail}</>}{info.treatmentProtection && <><br />通常治療後は {Math.round(info.treatmentProtection.reduction * 100)}%の被害軽減が{info.treatmentProtection.seconds}秒間続きます。</>}</p></details></div>
          <button type="button" className="v100-personnel-detail-back" onClick={() => focusedUnitId ? onBack() : setDetailOpen(false)}>{focusedUnitId ? returnLabel : "隊員一覧へ"}</button>
          <div className="v100-personnel-focus-copy">
            <div className="v100-unit-record-heading"><h3>{selectedUnit.displayName}</h3><span className="v100-unit-level">Lv.{info.level}{info.nextLevel !== null && <> → {info.nextLevel}</>} <small>/ 上限 {info.levelCap}</small></span><small className="v100-unit-registration">{info.status}</small></div>
            <p className="v100-unit-record-meta">{info.roleLabel} / 指揮 {info.commandCost} / 再配備 {formatV100Number(info.redeploySeconds)}秒</p>
            {info.skill && <p className="v100-unit-skill"><strong>固有技：{info.skill.name}</strong><span>再使用 {info.skill.cooldownSeconds}秒</span><br />{info.skill.summary}</p>}
            <div key={selectedUnit.id + ":" + info.level} className={"v100-personnel-stats v100-stat-reveal " + (currentStats.healing > 0 ? "is-healer" : "")} aria-label="装備込みの戦闘能力と強化後の値">{[
              showStat("HP", currentStats.hp, nextStats?.hp ?? null),
              showStat("防御力", (currentStats.defense * 100).toFixed(2) + "%", nextStats ? (nextStats.defense * 100).toFixed(2) + "%" : null),
              showStat("近接ダメージ", info.attackType === "melee" ? formatV100Number(currentStats.damage) : "—", info.attackType === "melee" && nextStats ? formatV100Number(nextStats.damage) : null),
              showStat("射撃ダメージ", info.attackType === "ranged" ? formatV100Number(currentStats.damage) : "—", info.attackType === "ranged" && nextStats ? formatV100Number(nextStats.damage) : null),
              showStat("移動速度", formatV100Number(currentStats.speed)),
              showStat("攻撃間隔", formatV100Number(currentStats.attackEvery) + "秒"),
              ...(currentStats.healing > 0 ? [
                showStat("回復量 HP/回", formatV100Number(currentStats.healing), nextStats ? formatV100Number(nextStats.healing) : null),
                showStat("射程", formatV100Number(currentStats.range)),
              ] : []),
            ]}</div>
            <div className="v100-unit-transaction"><p>所持 {save.caps} CAPS{price > 0 && <> / 必要 {price}{save.caps < price && <> / あと {price - save.caps}</>}</>}</p>
              {info.owned ? <button type="button" className="v100-primary" data-ui-sound="transaction" onClick={() => onLevel(selectedUnit.id, info.level)} disabled={info.upgradeCost <= 0 || save.caps < info.upgradeCost}>{info.upgradeCost <= 0 ? "強化上限" : save.caps < info.upgradeCost ? "あと " + (info.upgradeCost - save.caps) + " CAPS必要" : "Lv." + info.nextLevel + "へ強化 / " + info.upgradeCost + " CAPS"}</button>
                : info.registered ? <button type="button" className="v100-primary" data-ui-sound="transaction" onClick={() => onPurchase(selectedUnit.id)} disabled={save.caps < info.registrationCost}>{save.caps < info.registrationCost ? "あと " + (info.registrationCost - save.caps) + " CAPS必要" : "配備登録 / " + info.registrationCost + " CAPS"}</button>
                  : <p className="v100-focus-lock">S{String(selectedUnit.availabilityStageNumber).padStart(2, "0")}クリアで解放</p>}
            </div>
          </div>
        </>}
      </aside>
    </div>
  </section>;
}

function SupportVehicleView({ save, vehicleOnly, returnLabel, onBack, onPurchaseSupport, onEquipSupport, onUpgradeVehicle, onOpenSupport }: { save: Save; vehicleOnly: boolean; returnLabel: string; onBack: () => void; onPurchaseSupport: (supportId: string) => void; onEquipSupport: (supportId: string | null) => void; onUpgradeVehicle: () => void; onOpenSupport: () => void }) {
  const vehicleLevel = save.vehicle.upgradeLevel;
  const nextCost = vehicleLevel < V100_VEHICLE.maxUpgradeLevel ? V100_VEHICLE.upgradeCosts[vehicleLevel] : 0;
  const nextHp = vehicleLevel < V100_VEHICLE.maxUpgradeLevel ? save.vehicle.maxHp + V100_VEHICLE.hpPerUpgrade : save.vehicle.maxHp;
  const maximumHp = V100_VEHICLE.baseHp + V100_VEHICLE.hpPerUpgrade * V100_VEHICLE.maxUpgradeLevel;
  if (vehicleOnly) return <section className="v100-panel v100-vehicle-upgrade-screen v100-command-garage" data-v100-surface="vehicle-upgrade" aria-label="装甲車両強化">
    <div className="v100-panel-heading v100-management-heading"><h2>車両整備</h2><button type="button" onClick={onOpenSupport}>支援を選ぶ</button></div>
    <div className="v100-vehicle-upgrade-hero v100-support-grid vehicle-grid">
      <div className="v100-vehicle-upgrade-art"><img src={V099_CRAWLER_RUNTIME_PROFILE.equipmentHost.closed.path} alt="装甲車両" /><span className="v100-garage-vehicle-label">全作戦共通 / 装甲車両</span></div>
      <div className="v100-vehicle-upgrade-copy">
        <span className="v100-kicker">車体強化 / Lv.{vehicleLevel}</span><h3>防衛線を支える装甲</h3>
        <dl><div><dt>現在耐久</dt><dd>{save.vehicle.maxHp}</dd></div><div><dt>強化後</dt><dd>{vehicleLevel >= V100_VEHICLE.maxUpgradeLevel ? "上限" : nextHp}</dd></div><div><dt>所持CAPS</dt><dd>{save.caps}</dd></div></dl>
        <div key={vehicleLevel} className="v100-vehicle-strength-meter" role="img" aria-label={"現在耐久" + save.vehicle.maxHp + "、強化後" + nextHp}><i style={{ width: (save.vehicle.maxHp / maximumHp * 100) + "%" }} /><b style={{ left: (save.vehicle.maxHp / maximumHp * 100) + "%", width: ((nextHp - save.vehicle.maxHp) / maximumHp * 100) + "%" }} /></div>
        <p className="v100-vehicle-quote">{vehicleLevel < V100_VEHICLE.maxUpgradeLevel ? "耐久 +" + V100_VEHICLE.hpPerUpgrade + " / 必要 " + nextCost + " CAPS" : "車体の強化上限に到達"}{nextCost > save.caps && <strong> / あと {nextCost - save.caps} CAPS</strong>}</p>
        <button className="v100-primary" type="button" data-ui-sound="transaction" onClick={onUpgradeVehicle} disabled={vehicleLevel >= V100_VEHICLE.maxUpgradeLevel || save.caps < nextCost}>{vehicleLevel >= V100_VEHICLE.maxUpgradeLevel ? "強化上限" : "耐久を強化 / " + nextCost + " CAPS"}</button>
        <div className="v100-vehicle-abilities">{V100_VEHICLE.abilities.map(ability => <div key={ability.id}><strong>{ability.displayName}</strong><small>支援 {ability.battleCost} / 再使用 {ability.cooldownSeconds}秒</small></div>)}</div>
      </div>
    </div>
  </section>;
  return <section className="v100-panel v100-management-panel v100-loadout-screen v100-command-supply" data-v100-surface="support-vehicle" aria-label="出撃装備">
    <div className="v100-panel-heading v100-management-heading"><div><h2>戦術支援</h2><p>1種を装備。戦闘中は物資を使用。CAPSとは別で、敵撃破で補充。</p></div><button type="button" onClick={onBack}>{returnLabel}</button></div>
    <div className="v100-support-management-list">{V100_SUPPORTS.map(support => {
      const owned = save.ownedSupportIds.includes(support.id), unlocked = save.supportPurchaseUnlockedIds.includes(support.id), selected = save.equippedSupportId === support.id;
      return <article className={"v100-support-management-card game-loadout-card " + (selected ? "selected " : "") + (!unlocked ? "locked " : "") + (support.id === "support-incendiary-drum" ? "is-incendiary" : support.id === "support-healing" ? "is-medical" : "is-barrier")} key={support.id}>
        <span className="v100-support-art v100-support-illustration" aria-hidden="true"><img src={support.id === "support-healing" ? V100_PREPARATION_ART.medical : support.id === "support-incendiary-drum" ? V100_PREPARATION_ART.incendiary : V100_PREPARATION_ART.explosive} alt="" />{!unlocked && <V100LockChain />}</span>
        <div className="v100-loadout-card-copy"><h3>{support.displayName}</h3><p className="v100-support-purpose">{v100SupportPurposeFor(support.id)}</p><p>物資 {support.battleCost} / 再使用 {support.cooldownSeconds}秒</p>{!unlocked && <p className="v100-unlock-condition">S{String(support.unlockStageNumber).padStart(2, "0")}クリアで解放</p>}{unlocked && !owned && save.caps < support.unlockCostCaps && <p className="v100-price-shortage">あと {support.unlockCostCaps - save.caps} CAPS</p>}</div>
        {owned ? <button type="button" className={selected ? "selected" : ""} data-ui-sound="transaction" onClick={() => onEquipSupport(selected ? null : support.id)}>{selected ? "装備中" : "装備"}</button>
          : unlocked ? <button type="button" data-ui-sound="transaction" onClick={() => onPurchaseSupport(support.id)} disabled={save.caps < support.unlockCostCaps}>{support.unlockCostCaps} CAPSで取得</button>
            : <span className="v100-state-badge locked">未解放</span>}
      </article>;
    })}</div>
  </section>;
}

function DataManagementView({ save, notice, onBack, onBackup, onNewGameBackup, onImport, onLegacyHistory }: { save: Save; notice: string; onBack: () => void; onBackup: () => void; onNewGameBackup: () => Promise<void>; onImport: (file: File | undefined) => void; onLegacyHistory: (file: File | undefined) => void }) {
  return <div className="v100-modal-backdrop" data-v100-surface="data" role="presentation"><section className="v100-modal v100-data-modal" role="dialog" aria-modal="true" aria-labelledby="v100-data-title">
    <div className="v100-panel-heading"><div><span className="v100-kicker">作戦記録</span><h2 id="v100-data-title">データ管理</h2></div><button type="button" onClick={onBack}>閉じる</button></div>
    <div className="v100-data-scroll" tabIndex={0} aria-label="保存内容と過去のプレイ履歴">
      {notice && <p className="v100-notice v100-data-feedback" role="status">{notice}</p>}
      <p>現在の進行はブラウザ内の作戦セーブへ保存されています。復元する時は、このゲームから書き出したセーブファイルを選んでください。</p>
      <dl className="v100-data-summary"><div><dt>主人公</dt><dd>{save.playerName}</dd></div><div><dt>クリア済み作戦</dt><dd>{save.completedStageIds.length} / {V100_STAGES.length}</dd></div><div><dt>保存状態</dt><dd>保管済み</dd></div><div><dt>最終更新</dt><dd>{new Date(save.updatedAt).toLocaleString("ja-JP")}</dd></div></dl>
      <article><h3>過去のプレイ履歴</h3><p>旧版の書き出しデータで引き継ぎ特典の対象か確認します。現在の進行・残高・設定は変更しません。</p><label>旧版のプレイ履歴を選ぶ<input type="file" accept="application/json,.json" onChange={event => onLegacyHistory(event.currentTarget.files?.[0])} /></label></article>
      <button type="button" onClick={() => void onNewGameBackup()}>「初めから」の直前のセーブを書き出す</button>
      <div data-v100-pwa-storage />
    </div>
    <div className="v100-data-actions"><button className="v100-primary" type="button" onClick={onBackup}>セーブを書き出す</button><label className="v100-file-button">セーブを復元<input type="file" accept="application/json" onChange={(event) => onImport(event.currentTarget.files?.[0])} /></label></div>
    <small className="v100-data-note">復元に失敗した場合、現在のセーブは変更されません。</small>
  </section></div>;
}

function RewardSummaryView({ result }: { result: Record<string, unknown> | null }) {
  const summary = v100RewardPresentationFor(result);
  if (!summary) return null;
  const rewardLabels = { firstClear: "初回達成", replay: "再挑戦報酬", star2: "★2 初達成", star3: "★3 初達成" };
  return <div className="v100-reward-summary" aria-label="確定した作戦報酬"><h2>作戦 S{String(summary.stageNumber).padStart(2, "0")} 達成</h2>
    <div className="v100-result-rewards"><article><span>獲得CAPS</span><strong>+{summary.rewardCaps}</strong></article>{summary.unlocks.length > 0 && <article className="v100-reward-unlocks">
      {summary.unlockedUnitIds.map(id => formationCardForUnit(id) && <img key={id} src={formationCardForUnit(id) as string} alt={`${UNIT_BY_ID.get(id)?.displayName ?? "隊員"}の配備登録が解禁`} />)}
      <div><span>新しい解禁・記録</span><strong>{summary.unlocks.join(" / ")}</strong></div></article>}</div>
    {summary.breakdown && <details className="v100-reward-breakdown"><summary>CAPSの内訳</summary><p>{Object.entries(summary.breakdown).filter(([, value]) => value > 0).map(([key, value]) => rewardLabels[key as keyof typeof rewardLabels] + " +" + value).join(" / ") || "支給なし"}</p></details>}
    <p>次の作戦に備え、隊員を育てるか、新しい隊員を配備登録するか選べます。</p><small className="v100-reward-saved">報酬と作戦進行は保存済み</small></div>;
}

function StarCriteria({ vehicleMaxHp }: { vehicleMaxHp: number }) {
  const targets = v100StarTargetsForVehicle(vehicleMaxHp);
  return <div className="v100-star-criteria" aria-label={`作戦達成と車両生存で星1。星2は耐久70%以上で${targets[2]}、星3は90%以上で${targets[3]}`}>
    <span><V100StageStars stars={1} label="条件" /> 作戦達成・車両生存</span>
    <span><V100StageStars stars={2} label="条件" /> 耐久70%以上 / {targets[2]}</span>
    <span><V100StageStars stars={3} label="条件" /> 耐久90%以上 / {targets[3]}</span>
  </div>;
}

function ResultView({ result, previousBestStars, alreadyCompleted, onContinue, onRetry, onMap }: { result: Record<string, unknown> | null; previousBestStars: number; alreadyCompleted: boolean; onContinue: () => void; onRetry: () => void; onMap: () => void }) {
  const won = result?.won === true;
  const stageNumber = Number(result?.stageNumber) || 0;
  const runStars = won ? Math.max(0, Math.min(3, Number(result?.stars) || 0)) : 0;
  const nextBestStars = Math.max(previousBestStars, runStars);
  const report = normalizeV100BattleReport(result?.battleReport);
  const nextStar = runStars === 1 ? 2 : runStars === 2 ? 3 : null;
  const maxHp = Math.max(0, Number(result?.vehicleMaxHp) || 0);
  const basePresentation = v100BasePresentationFor(stageNumber);
  const vehicleHp = Math.max(0, Number(result?.vehicleHp) || 0);
  const hpPercent = maxHp > 0 ? Math.max(0, Math.min(100, vehicleHp / maxHp * 100)) : 0;
  const starTargets = v100StarTargetsForVehicle(maxHp);
  const rewardCaps = alreadyCompleted ? v100StageReward(stageNumber, "replay") : v100StageReward(stageNumber, "first-clear");
  const bonusStar2 = runStars >= 2 && previousBestStars < 2 ? v100StageReward(stageNumber, "star:2") : 0;
  const bonusStar3 = runStars >= 3 && previousBestStars < 3 ? v100StageReward(stageNumber, "star:3") : 0;
  const boss = report?.bossProgress;
  const lastVehicleHit = v100LastVehicleHitText(result);
  const outcome = won ? "作戦目標を達成。部隊を回収し、作戦後の報告へ進みます。"
    : Number(result?.vehicleHp) <= 0 ? `${basePresentation.label}の耐久が尽き、作戦を中断しました。`
      : "作戦目標を達成できず、作戦を中断しました。";
  return <section className={`v100-panel v100-result-panel ${won ? "win" : "lose"}`} data-v100-surface={won ? "result-win" : "result-lose"} aria-label="作戦結果">
    <div className="v100-result-scroll" role="region" aria-label="作戦結果の詳細" tabIndex={0}>
      <span className="v100-kicker">作戦結果 / {won ? "成功" : "失敗"}</span><h2>{won ? "作戦成功" : "作戦失敗"}</h2><p>{outcome}<span className="v100-result-scroll-guide">結果の詳細は下へスクロール</span></p>
      <div className={`v100-result-highlight ${won ? "has-earned-stars" : "no-earned-stars"}`}><strong>{won ? <V100StageStars stars={runStars} label="今回の評価" /> : <V100StageStars stars={previousBestStars} label="現在の記録" />}</strong><span>{won ? `今回 ${runStars}/3　記録 ${previousBestStars} → ${nextBestStars}/3` : `今回 —　現在の記録 ${previousBestStars}/3`}</span></div>
      <dl className="v100-result-records"><div><dt>{basePresentation.healthLabel}</dt><dd>{vehicleHp} / {maxHp}（{Math.floor(hpPercent)}%）</dd></div><div><dt>作戦目標</dt><dd>{result?.objectiveComplete === true ? stageNumber === 22 ? "収容室43室の開放完了" : "達成" : "未達"}</dd></div><div><dt>経過時間</dt><dd>{Math.round(Number(result?.elapsedSeconds) || 0)}秒</dd></div><div><dt>戦闘不能</dt><dd>{Number(result?.unitDeaths) || 0}回</dd></div></dl>
      <div className="v100-result-feedback">
        {lastVehicleHit && <p className="v100-result-last-hit"><strong>直前の被害</strong> {lastVehicleHit}</p>}
        <div className="v100-vehicle-hp-meter" role="meter" aria-label={basePresentation.healthLabel} aria-valuemin={0} aria-valuemax={maxHp} aria-valuenow={vehicleHp} aria-valuetext={`${vehicleHp} / ${maxHp}、${Math.floor(hpPercent)}%`}>
          <i style={{ width: `${hpPercent}%` }} /><b className="threshold-70" style={{ left: `${maxHp ? starTargets[2] / maxHp * 100 : 70}%` }} /><b className="threshold-90" style={{ left: `${maxHp ? starTargets[3] / maxHp * 100 : 90}%` }} />
        </div>
        <div className="v100-result-threshold-labels"><span><V100StageStars stars={2} label="条件" /> 70% / {starTargets[2]} HP</span><span><V100StageStars stars={3} label="条件" /> 90% / {starTargets[3]} HP</span></div>
        {won && nextStar && <p className="v100-result-next-star">次の★{nextStar}まであと {Math.max(0, Math.ceil(starTargets[nextStar] - vehicleHp))} HP（耐久{starTargets[nextStar]}以上）</p>}
        {won && <div className="v100-result-caps-preview" aria-label="確定後に加算されるCAPSの内訳"><span>{alreadyCompleted ? "再挑戦報酬" : "初回達成"}<strong>+{rewardCaps} CAPS</strong></span>{bonusStar2 > 0 && <span><V100StageStars stars={2} label="新規獲得" /><strong>+{bonusStar2} CAPS</strong></span>}{bonusStar3 > 0 && <span><V100StageStars stars={3} label="新規獲得" /><strong>+{bonusStar3} CAPS</strong></span>}</div>}
        {boss && <p className="v100-result-boss"><strong>{boss.displayName}</strong>：{boss.state === "not-encountered" ? "出現前に作戦終了" : boss.state === "defeated" ? "撃破済み" : `残りHP ${Math.ceil(boss.hp ?? 0)} / ${boss.maxHp}（${Math.round((boss.hp ?? 0) / (boss.maxHp ?? 1) * 100)}%）`}</p>}
      </div>
    </div>
    <div className="v100-result-footer">
      {report && <details className="v100-battle-report"><summary>戦闘記録 / 第{report.wave}波・撃破{report.kills}</summary><div><p>隊員ごとの合計。再配備と自己回復を含み、支援・車両の実績は含みません。</p>{report.units.length > 0 ? <table><thead><tr><th scope="col">隊員</th><th scope="col">与ダメージ</th><th scope="col">被ダメージ</th><th scope="col">回復したHP</th></tr></thead><tbody>{report.units.map(unit => <tr key={unit.unitId}><th scope="row">{UNIT_BY_ID.get(unit.unitId)?.displayName}</th><td>{Math.round(unit.damage)}</td><td>{Math.round(unit.damageTaken)}</td><td>{Math.round(unit.healing)}</td></tr>)}</tbody></table> : <p>隊員の実績は記録されていません。</p>}</div></details>}
      <div className="v100-result-actions"><button className="v100-primary" type="button" onClick={won ? onContinue : onRetry}>{won ? "次の場面へ" : "編成へ戻る"}</button>{!won && <button type="button" onClick={onMap}>作戦地図へ</button>}</div>
    </div>
  </section>;
}

function EventLogView({ save, busy, onAutoSkipChange, onReplay, onClose }: { save: Save; busy: boolean; onAutoSkipChange: (enabled: boolean) => void; onReplay: (eventId: string) => void; onClose: () => void }) {
  return <div className="v100-modal-backdrop"><section className="v100-modal v100-log-modal" role="dialog" aria-modal="true" aria-label="会話記録"><div className="v100-panel-heading"><div><span className="v100-kicker">会話記録</span><h2>{save.readStoryEventIds.length}件を読了</h2></div><button type="button" onClick={onClose}>閉じる</button></div><label className="v100-read-story-setting"><input type="checkbox" checked={save.settings.autoSkipReadStory} disabled={busy} onChange={event => onAutoSkipChange(event.currentTarget.checked)} /><span>既読の会話を自動でスキップ<small>この記録から選んだ会話は、いつでも再生できます。</small></span></label><div className="v100-log-list">{save.readStoryEventIds.map((eventId) => <button type="button" key={eventId} onClick={() => { onReplay(eventId); onClose(); }}>{eventDisplayLabel(eventId)}</button>)}</div></section></div>;
}

function ReplayView({ event, node, index, onNext, onClose }: { event: ReturnType<typeof v100StoryEventView>; node: StoryNode | null; index: number; onNext: () => void; onClose: () => void }) {
  if (!event) return null;
  const hasNext = index < event.nodes.length - 1;
  const presentation = v100EventPresentationFor({ eventId: event.id, phase: eventPhaseForId(event.id), node, nodeIndex: index });
  const runtime = v100StageRuntimeFor(presentation?.stageId ?? V100_STAGE_IDS[0]);
  return <div className="v100-modal-backdrop"><section className="v100-event-layout v100-replay-layout" role="dialog" aria-modal="true" aria-label="会話記録" data-v100-replay-index={index}>
    <div className="v100-event-backdrop" style={{ backgroundImage: node?.kind === "title" ? "none" : `url(${eventBackdropFor(presentation, runtime?.backgroundPath ?? PRODUCTION_VISUALS.command)})` }} />
    <article className="v100-event-panel"><div className="v100-event-heading"><span className="v100-kicker">{eventDisplayLabel(event.id)}</span></div>
      {node ? <StoryNodeView node={node} eventId={event.id} phase={eventPhaseForId(event.id)} nodeIndex={index} presentation={presentation} actions={<div className="v100-event-actions"><button className="v100-primary" type="button" data-ui-sound="advance" onClick={hasNext ? onNext : onClose}>{hasNext ? "次へ" : "記録を閉じる"}</button><button type="button" data-ui-sound="cancel" onClick={onClose}>閉じる</button></div>} /> : <button type="button" onClick={onClose}>記録を閉じる</button>}
    </article></section></div>;
}
