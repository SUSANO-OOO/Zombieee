"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

import {
  V100_BOSSES,
  V100_STAGE_BY_ID,
  V100_STAGE_IDS,
  V100_STAGES,
  V100_SUPPORTS,
  V100_UNITS,
  V100_VEHICLE,
  V100_VERSION,
  normalizeV100PlayerName,
  v100LevelCost,
} from "./v100Registry.js";
import {
  createDefaultV100Save,
  applyV100SaveMutation,
  claimV100LegacyGift,
  acknowledgeV100LegacyGiftPopup,
  isEligibleV100LegacyHistory,
  markV100EventRead,
  updateV100PlayerName,
} from "./v100Save.js";
import {
  createV100BattleResult,
  equipV100Support,
  finalizeV100PendingResult,
  purchaseV100Support,
  purchaseV100Unit,
  recordV100PendingResult,
  upgradeV100Vehicle,
} from "./v100Transactions.js";
import {
  beginV100StageAttempt,
  completeV100Event,
  createV100StoryFlowState,
  defeatV100Flow,
  enterV100Battle,
  enterV100PostResult,
  finishV100Battle,
  markV100FlowEventRead,
  v100StoryFlowCheckpoint,
} from "./v100StoryFlow.js";
import { v100StoryEventView } from "./v100StoryEvents.js";
import { v100ProductionSessionFor } from "./v100BattleAdapter.js";
import { campaignUnitIdToCombatKind } from "./campaign.js";
import { AshfallGame, type AshfallBattleResult } from "./AshfallGame";
import { v100StageRuntimeFor } from "./v100StageRuntime.js";
import { V100_RUNTIME_ASSET_MANIFEST } from "./v100RuntimeAssetManifest.js";
import { FORMATION_CARD_ART } from "./spriteManifest.js";
import { PRODUCTION_VISUALS } from "./productionVisuals.js";
import { PROLOGUE_SYNOPSIS } from "./storyEvents.js";
import { V099_CRAWLER_RUNTIME_PROFILE } from "./crawlerEquipmentSprites.js";
import {
  exportV100BrowserSave,
  importV100BrowserSave,
  createV100SaveOwnerId,
  persistV100BrowserSave,
  readV100BrowserSave,
  V100_STORAGE_EVENT_KEYS,
} from "./v100CampaignStorage.js";
import { EVENT_PORTRAIT_PROFILES, V075_VISUAL_PROFILES, V080_UNIT_VISUAL_PROFILES, V090_UNIT_VISUAL_PROFILES } from "./visualProfiles.js";
import "./v100Campaign.css";

type Save = ReturnType<typeof createDefaultV100Save>;
type Flow = ReturnType<typeof createV100StoryFlowState>;
type StoryNode = { kind?: string; speaker?: string | null; text?: string; portraitOwner?: string | null; portraitKind?: string };
type CampaignSurface = "campaign" | "personnel" | "support-vehicle" | "data";

const PORTRAIT_PATHS: Record<string, string> = {
  "unit-kumaverson": V080_UNIT_VISUAL_PROFILES.kumaverson.eventPortrait.path,
  "unit-paisen": V080_UNIT_VISUAL_PROFILES.brawler.eventPortrait.path,
  "unit-babayaga": V080_UNIT_VISUAL_PROFILES.babayaga.eventPortrait.path,
  "unit-zakimiya": V090_UNIT_VISUAL_PROFILES.zakimiya.eventPortrait.path,
  "unit-tky": V090_UNIT_VISUAL_PROFILES.tky.eventPortrait.path,
  "unit-mrs-chiha": V090_UNIT_VISUAL_PROFILES["mrs-chiha"].eventPortrait.path,
  "unit-crazy-king": V080_UNIT_VISUAL_PROFILES["crazy-king"].eventPortrait.path,
  "unit-miyamoto-musashi": V090_UNIT_VISUAL_PROFILES["miyamoto-musashi"].eventPortrait.path,
  "guide-ikura": V075_VISUAL_PROFILES.ikura.eventPortrait.path,
  segawa: V100_RUNTIME_ASSET_MANIFEST.portraits.segawa,
  "mugarian-president": V100_RUNTIME_ASSET_MANIFEST.portraits.mugarianPresident,
  "red-panther-commander": V100_RUNTIME_ASSET_MANIFEST.portraits.redPantherCommander,
  "minor-human-shared-event-silhouette": V100_RUNTIME_ASSET_MANIFEST.portraits.minorHuman,
};

const UNIT_BY_ID = new Map(V100_UNITS.map((unit) => [unit.id, unit]));

function stageNumberFor(stageId: string | null) {
  return stageId ? V100_STAGE_BY_ID[stageId]?.number ?? 0 : 0;
}

function formatReason(reason: string | undefined) {
  const labels: Record<string, string> = {
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
    "unknown-unit": "隊員情報を読み込めませんでした。",
    "unknown-support": "支援情報を読み込めませんでした。",
  };
  return labels[reason ?? ""] ?? reason ?? "操作を完了できませんでした。";
}

function activeUnitName(unitId: string | null) {
  return unitId ? UNIT_BY_ID.get(unitId)?.displayName ?? unitId : "空き";
}

function portraitFor(owner: string | null | undefined) {
  return owner ? PORTRAIT_PATHS[owner] ?? EVENT_PORTRAIT_PROFILES[owner]?.path ?? null : null;
}

function isEventPhase(phase: Flow["phase"]) {
  return ["event", "post", "first-clear-post", "ending", "credits", "epilogue"].includes(phase);
}

const OPERATION_LABELS: Record<string, string> = {
  assault: "拠点制圧",
  "timed-defense": "防衛線維持",
  boss: "ボス撃破",
  escort: "目標護送",
  power: "電源ノード起動",
  seal: "封鎖ノード起動",
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

function missionLabelFor(value: string | undefined) {
  return OPERATION_LABELS[value ?? ""] ?? "キャンペーン作戦";
}

function enemyPackLabelFor(value: string | undefined) {
  return ENEMY_PACK_LABELS[value ?? ""] ?? "混成感染群";
}

function objectiveLabelFor(stage: (typeof V100_STAGES)[number] | undefined) {
  if (!stage) return "作戦目標を達成";
  if (stage.objectiveId.includes("four")) return "4つの電源ノードを起動して封鎖";
  if (stage.objectiveId.includes("three")) return "3つの電源ノードを起動して封鎖";
  if (stage.objectiveId.includes("95s")) return "95秒間、防衛対象を守り抜く";
  if (stage.objectiveId.includes("90s")) return "90秒間、防衛対象を守り抜く";
  if (stage.objectiveId.includes("100s")) return "100秒間、防衛対象を守り抜く";
  if (stage.missionType === "boss") return "異常個体を撃破する";
  if (stage.missionType === "escort") return "護送対象を出口まで届ける";
  return "感染拠点を制圧する";
}

function eventDisplayLabel(eventId: string | null | undefined) {
  if (!eventId) return "イベント";
  if (eventId === "v100:event:prologue") return "プロローグ";
  const match = /^v100:event:s(\d{2}):(pre|post|first-clear-post)$/u.exec(eventId);
  if (match) {
    const stage = V100_STAGES[Number(match[1]) - 1];
    const suffix = match[2] === "pre" ? "出撃前" : match[2] === "post" ? "作戦後" : "初回制圧後";
    return `${stage?.displayName ?? `第${match[1]}作戦`} / ${suffix}`;
  }
  if (eventId === "v100:event:ending") return "最終章";
  if (eventId === "v100:event:credits") return "クレジット";
  if (eventId === "v100:event:epilogue") return "エピローグ";
  return "記録済みイベント";
}

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

function formationCardForUnit(unitId: string) {
  const kind = campaignUnitIdToCombatKind(unitId);
  return kind ? FORMATION_CARD_ART[kind] ?? null : null;
}

export function V100Campaign() {
  const [save, setSave] = useState<Save>(() => createDefaultV100Save());
  const [flow, setFlow] = useState<Flow>(() => createV100StoryFlowState());
  const [storyIndex, setStoryIndex] = useState(0);
  const [selectedStageId, setSelectedStageId] = useState(V100_STAGE_IDS[0]);
  const [nameInput, setNameInput] = useState("");
  const [nameError, setNameError] = useState("");
  const [notice, setNotice] = useState("");
  const [giftPopup, setGiftPopup] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [replayEventId, setReplayEventId] = useState<string | null>(null);
  const [replayNodeIndex, setReplayNodeIndex] = useState(0);
  const [hydrated, setHydrated] = useState(false);
  const [saveOwnerId] = useState(() => createV100SaveOwnerId());
  const [surface, setSurface] = useState<CampaignSurface>("campaign");

  const commitSave = useCallback((nextSave: Save) => {
    const result = persistV100BrowserSave(nextSave, globalThis, { ownerId: saveOwnerId });
    if (!result.ok) {
      setNotice(result.reason === "ownership-conflict" ? "別のタブでセーブを更新中です。画面を再読み込みして続けてください。" : "セーブを書き込めませんでした。現在の進行を保持します。");
      return result.save;
    }
    const normalized = result.save;
    setSave(normalized);
    return normalized;
  }, [saveOwnerId]);

  useEffect(() => {
    if (!hydrated) return undefined;
    const refreshFromAnotherTab = (event: StorageEvent) => {
      if (event.key && !V100_STORAGE_EVENT_KEYS.includes(event.key)) return;
      const loaded = readV100BrowserSave();
      if (loaded.save.revision <= save.revision) return;
      if (flow.phase === "battle" || flow.phase === "result") {
        setNotice("別のタブで新しいセーブを検出しました。現在の戦闘・結果画面を終えてから再読み込みしてください。");
        return;
      }
      const restoredFlow = createV100StoryFlowState({
        playerName: loaded.save.campaignStarted ? loaded.save.playerName : "",
        completedStageIds: loaded.save.completedStageIds,
        readStoryEventIds: loaded.save.readStoryEventIds,
        flowState: loaded.save.campaignStarted ? loaded.save.flowState : null,
        eventCursor: loaded.save.eventCursor,
        pendingResult: loaded.save.pendingResult,
      });
      setSave(loaded.save);
      setSelectedStageId(loaded.save.availableStageIds[0] ?? V100_STAGE_IDS[0]);
      setFlow(restoredFlow);
      setStoryIndex(restoredFlow.nodeIndex ?? 0);
      setNotice("別のタブのセーブを反映しました。");
    };
    window.addEventListener("storage", refreshFromAnotherTab);
    return () => window.removeEventListener("storage", refreshFromAnotherTab);
  }, [flow.phase, hydrated, save.revision]);

  useEffect(() => {
    const loaded = readV100BrowserSave();
    let nextSave = loaded.save;
    if (loaded.source === "default" && loaded.rawLegacy) {
      const eligible = nextSave.legacy.eligible || isEligibleV100LegacyHistory(loaded.rawLegacy);
      nextSave = applyV100SaveMutation(nextSave, (draft) => ({
        ...draft,
        legacy: { ...draft.legacy, eligible },
      })).save;
    }
    // Browser storage is the external source of truth for this client-only
    // route; hydration necessarily updates the initial SSR placeholder.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSave(nextSave);
    setSelectedStageId(nextSave.availableStageIds[0] ?? V100_STAGE_IDS[0]);
    const restoredFlow = createV100StoryFlowState({
      playerName: nextSave.campaignStarted ? nextSave.playerName : "",
      completedStageIds: nextSave.completedStageIds,
      readStoryEventIds: nextSave.readStoryEventIds,
      flowState: nextSave.campaignStarted ? nextSave.flowState : null,
      eventCursor: nextSave.eventCursor,
      pendingResult: nextSave.pendingResult,
    });
    setFlow(restoredFlow);
    setStoryIndex(restoredFlow.nodeIndex ?? 0);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated || flow.phase !== "map" || !save.legacy.eligible || save.legacy.entitlementClaimed) return;
    const result = claimV100LegacyGift(save, { legacyCandidate: readV100BrowserSave().rawLegacy });
    if (!result.applied) return undefined;
    // The entitlement transaction is deliberately performed only after the
    // safe map screen is mounted.
    const timer = window.setTimeout(() => {
      commitSave(result.save);
      setGiftPopup(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [commitSave, flow.phase, hydrated, save]);

  useEffect(() => {
    const root = document.documentElement;
    const battleActive = flow.phase === "battle";
    const resultSaving = flow.phase === "result";
    // Stable V1 name/map/formation screens are equivalent to the legacy title
    // safety boundary. Story nodes remain unsafe so a release cannot interrupt
    // a cursor or first-clear transition; battle/result explicitly block it.
    const screen = battleActive ? "battle"
      : resultSaving ? "result"
        : isEventPhase(flow.phase) ? "event"
          : "title";
    root.dataset.pwaScreen = screen;
    root.dataset.pwaBattleActive = String(battleActive);
    root.dataset.pwaResultSaving = String(resultSaving);
    root.dataset.pwaSaveMutationPending = "false";
    return () => {
      delete root.dataset.pwaScreen;
      delete root.dataset.pwaBattleActive;
      delete root.dataset.pwaResultSaving;
      delete root.dataset.pwaSaveMutationPending;
    };
  }, [flow.phase]);

  const event = useMemo(() => flow.eventId ? v100StoryEventView(flow.eventId, save.playerName) : null, [flow.eventId, save.playerName]);
  const currentNode = (event?.nodes?.[storyIndex] ?? null) as StoryNode | null;
  const runtime = v100StageRuntimeFor(selectedStageId);
  const replayEvent = useMemo(() => replayEventId ? v100StoryEventView(replayEventId, save.playerName) : null, [replayEventId, save.playerName]);
  const replayNode = (replayEvent?.nodes?.[replayNodeIndex] ?? null) as StoryNode | null;

  const updateFlow = useCallback((next: Flow, { baseSave = save, nodeIndex = 0 }: { baseSave?: Save; nodeIndex?: number } = {}) => {
    const checkpoint = v100StoryFlowCheckpoint(next, nodeIndex);
    const persisted = applyV100SaveMutation(baseSave, (draft) => ({
      ...draft,
      flowState: checkpoint.flowState,
      eventCursor: checkpoint.eventCursor,
    }));
    const normalized = persisted.applied ? commitSave(persisted.save) : baseSave;
    setSave(normalized);
    setFlow(next);
    setStoryIndex(Math.max(0, Math.floor(Number(nodeIndex) || 0)));
    setSurface("campaign");
    return normalized;
  }, [commitSave, save]);

  const applySaveTransaction = useCallback((result: { applied?: boolean; duplicate?: boolean; unchanged?: boolean; save: Save; reason?: string }) => {
    if (!result.applied) {
      if (!result.duplicate && !result.unchanged) {
        setNotice(formatReason(result.reason));
      }
      return result.save;
    }
    setNotice("");
    return commitSave(result.save);
  }, [commitSave]);

  const openSurface = useCallback((next: CampaignSurface) => {
    setSurface(next);
    setNotice("");
  }, []);

  const handleProductionBattleResult = useCallback((raw: AshfallBattleResult) => {
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
    updateFlow(transition.state, { baseSave: nextSave });
  }, [flow, save, updateFlow]);

  const productionSession = useMemo(() => {
    if (flow.phase !== "battle" || !flow.stageId) return null;
    const session = v100ProductionSessionFor({
      save,
      stageId: flow.stageId,
      resultId: `v100:${flow.stageId}:${save.revision}`,
    });
    return { ...session, onBattleResult: handleProductionBattleResult };
  }, [flow.phase, flow.stageId, handleProductionBattleResult, save]);

  const startCampaign = (eventSubmit: FormEvent<HTMLFormElement>) => {
    eventSubmit.preventDefault();
    const validated = normalizeV100PlayerName(nameInput);
    if (!validated.ok) {
      setNameError(validated.reason === "too-long" ? "1〜12文字で入力してください。" : "使用できない名前です。");
      return;
    }
    const nextSave = updateV100PlayerName(save, validated.value).save;
    const started = applyV100SaveMutation(nextSave, (draft) => ({ ...draft, campaignStarted: true })).save;
    const nextFlow = createV100StoryFlowState({ playerName: validated.value, completedStageIds: [], readStoryEventIds: [] });
    updateFlow(nextFlow, { baseSave: started });
    setNameError("");
  };

  const markAndAdvanceEvent = (skipped = false) => {
    if (!flow.eventId || !event) return;
    let workingSave = save;
    const lastNode = storyIndex >= event.nodes.length - 1;
    if (!lastNode && !skipped) {
      updateFlow(flow, { baseSave: workingSave, nodeIndex: storyIndex + 1 });
      return;
    }
    const marked = markV100EventRead(workingSave, flow.eventId).save;
    workingSave = marked;
    if (flow.phase === "post") {
      const finalized = finalizeV100PendingResult(workingSave);
      if (finalized.applied) workingSave = finalized.save;
    }
    const markedFlow = markV100FlowEventRead(flow, flow.eventId);
    const transition = completeV100Event(markedFlow, { skipped });
    if (!transition.accepted) {
      setNotice(formatReason(transition.reason));
      return;
    }
    updateFlow(transition.state, { baseSave: workingSave });
  };

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

  const continueFromResult = () => {
    if (flow.pendingResult?.won !== true) {
      const retry = defeatV100Flow(flow);
      if (retry.accepted) {
        updateFlow(retry.state, { baseSave: save });
      }
      return;
    }
    const next = enterV100PostResult(flow);
    if (next.accepted) updateFlow(next.state, { baseSave: save });
  };

  const rename = () => {
    const value = window.prompt("主人公の名前", save.playerName);
    if (value === null) return;
    const result = updateV100PlayerName(save, value);
    if (!result.applied) {
      setNotice(formatReason(result.reason));
      return;
    }
    commitSave(result.save);
    setNotice("表示名だけを更新しました。イベント・報酬・解放状態は変更していません。");
  };

  const acknowledgeGift = () => {
    const result = acknowledgeV100LegacyGiftPopup(save, { screen: "map" });
    if (result.applied) commitSave(result.save);
    setGiftPopup(false);
  };

  const downloadBackup = () => {
    const blob = new Blob([exportV100BrowserSave(save)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "nishijin-campaign-v100-backup.json";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const importBackup = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = importV100BrowserSave(String(reader.result ?? ""));
      if (!result.ok) {
        setNotice("V1.0.0のセーブとして読み込めませんでした。現在のセーブは保持しています。");
        return;
      }
      const restoredSave = commitSave(result.save);
      const restoredFlow = createV100StoryFlowState({
        playerName: restoredSave.campaignStarted ? restoredSave.playerName : "",
        completedStageIds: restoredSave.completedStageIds,
        readStoryEventIds: restoredSave.readStoryEventIds,
        flowState: restoredSave.flowState,
        eventCursor: restoredSave.eventCursor,
        pendingResult: restoredSave.pendingResult,
      });
      setSave(restoredSave);
      setFlow(restoredFlow);
      setStoryIndex(restoredFlow.nodeIndex ?? 0);
      setNotice("セーブを検証して復元しました。");
    };
    reader.readAsText(file);
  };

  if (!hydrated) return <main className="v100-shell"><p className="v100-loading">V1.0.0 セーブを検証しています…</p></main>;

  return (
    <main className={`v100-shell v100-surface-${surface}`} data-v100-phase={flow.phase} data-v100-stage={flow.stageNumber ?? "map"} data-v100-surface={surface}>
      <header className="v100-topbar">
        <div><span className="v100-kicker">新西新作戦記録 / Version {V100_VERSION}</span><h1>西新世紀末物語</h1></div>
        <div className="v100-save-meta"><span>{save.caps} CAPS</span><span>記録 {save.readStoryEventIds.length}</span><button type="button" onClick={() => setLogOpen((open) => !open)}>会話記録</button></div>
      </header>

      {notice && <p className="v100-notice" role="status">{notice}</p>}

      {flow.phase === "name" && (
        <section className="v100-title-screen" aria-labelledby="v100-name-title" style={{ backgroundImage: `url(${PRODUCTION_VISUALS.title})` }}>
          <div className="v100-title-wash" />
          <div className="v100-title-copy">
            <span className="v100-kicker">新しい作戦記録 / EARLY ACCESS</span>
            <div className="v100-title-lockup" aria-label="西新世紀末物語">
              <strong>西新</strong><span>世紀末物語</span>
            </div>
            <p className="v100-title-synopsis">{PROLOGUE_SYNOPSIS.short}</p>
            <div className="v100-name-card">
              <span className="v100-kicker">新campaign導入</span>
              <h2 id="v100-name-title">あなたの名前を記録する</h2>
              <p>崩壊から四十三日後。西新の救助と封鎖を、あなたの判断で進めます。</p>
              <form onSubmit={startCampaign}>
                <label htmlFor="v100-player-name">主人公の名前</label>
                <input id="v100-player-name" value={nameInput} onChange={(event) => setNameInput(event.currentTarget.value)} maxLength={24} autoComplete="nickname" />
                {nameError && <small className="v100-error" role="alert">{nameError}</small>}
                <button className="v100-primary" type="submit">この名前で作戦を始める</button>
              </form>
              <button className="v100-secondary-data" type="button" onClick={downloadBackup}>データ管理（書き出し）</button>
            </div>
          </div>
        </section>
      )}

      {isEventPhase(flow.phase) && event && (
        <section className={`v100-event-layout v100-event-${flow.phase}`} aria-label={`${eventDisplayLabel(flow.eventId)}イベント`} data-v100-surface={flow.phase}>
          <div className="v100-event-backdrop" style={{ backgroundImage: `url(${runtime?.backgroundPath ?? "/art/v060/title-key-visual-v1.webp"})` }} />
          <article className="v100-event-panel">
            <div className="v100-event-heading"><span className="v100-kicker">{eventDisplayLabel(flow.eventId)}</span><span>{event.nodes.length ? `場面 ${Math.min(storyIndex + 1, event.nodes.length)}` : "場面転換"}</span></div>
            {currentNode ? <StoryNodeView node={currentNode} /> : <p className="v100-action-node">このイベントを確認して次へ進みます。</p>}
            <div className="v100-event-actions">
              <button type="button" className="v100-primary" onClick={() => markAndAdvanceEvent(false)}>{storyIndex < event.nodes.length - 1 ? "次へ" : flow.phase === "ending" ? "次の場面へ" : "続ける"}</button>
              {flow.canSkip && <button type="button" onClick={() => markAndAdvanceEvent(true)}>スキップ</button>}
            </div>
          </article>
        </section>
      )}

      {flow.phase === "map" && surface === "campaign" && (
        <MapView
          save={save}
          selectedStageId={selectedStageId}
          onSelect={setSelectedStageId}
          onStart={startStage}
          onRename={rename}
          onBackup={downloadBackup}
          onImport={importBackup}
          onReplay={(eventId) => { setReplayEventId(eventId); setReplayNodeIndex(0); }}
          onOpenPersonnel={() => openSurface("personnel")}
          onOpenSupportVehicle={() => openSurface("support-vehicle")}
          onOpenData={() => openSurface("data")}
        />
      )}

      {flow.phase === "map" && surface === "personnel" && (
        <PersonnelView
          save={save}
          onBack={() => openSurface("campaign")}
          onPurchase={(unitId) => applySaveTransaction(purchaseV100Unit(save, unitId))}
        />
      )}

      {flow.phase === "map" && surface === "support-vehicle" && (
        <SupportVehicleView
          save={save}
          onBack={() => openSurface("campaign")}
          onPurchaseSupport={(supportId) => applySaveTransaction(purchaseV100Support(save, supportId))}
          onEquipSupport={(supportId) => applySaveTransaction(equipV100Support(save, supportId))}
          onUpgradeVehicle={() => applySaveTransaction(upgradeV100Vehicle(save))}
        />
      )}

      {flow.phase === "map" && surface === "data" && (
        <DataManagementView save={save} onBack={() => openSurface("campaign")} onBackup={downloadBackup} onImport={importBackup} />
      )}

      {flow.phase === "formation" && (
        <FormationView save={save} onSlotChange={chooseFormation} onStart={startBattle} />
      )}

      {flow.phase === "battle" && productionSession && (
        <AshfallGame externalSession={productionSession} />
      )}

      {flow.phase === "result" && (
        <ResultView result={flow.pendingResult} firstClear={flow.firstClear} onContinue={continueFromResult} onRetry={continueFromResult} onMap={continueFromResult} />
      )}

      {logOpen && <EventLogView save={save} onReplay={(eventId) => { setReplayEventId(eventId); setReplayNodeIndex(0); }} onClose={() => setLogOpen(false)} />}
      {replayEvent && <ReplayView event={replayEvent} node={replayNode} index={replayNodeIndex} onNext={() => setReplayNodeIndex((index) => index + 1)} onClose={() => setReplayEventId(null)} />}
      {giftPopup && <div className="v100-modal-backdrop"><section className="v100-modal" role="dialog" aria-modal="true" aria-labelledby="v100-gift-title"><span className="v100-kicker">引き継ぎ特典</span><h2 id="v100-gift-title">新しいキャンペーンを開始しました</h2><p>これまでの遊び方に感謝を込めて、Version 1.0.0の作戦記録へ180 CAPSを一度だけ届けました。過去の記録はそのまま保管されています。</p><button className="v100-primary" type="button" onClick={acknowledgeGift}>確認する</button></section></div>}
    </main>
  );
}

function StoryNodeView({ node }: { node: StoryNode }) {
  const portrait = portraitFor(node.portraitOwner);
  const portraitSide = node.portraitKind === "right" || (node.portraitKind !== "left" && node.portraitOwner && ["unit-paisen", "segawa", "red-panther-commander"].includes(node.portraitOwner)) ? "right" : "left";
  return <div className={`v100-story-node v100-node-${node.kind ?? "action"}`} data-portrait-side={portraitSide} data-v100-state={`dialogue-${portraitSide}`}>
    {portrait && <img className="v100-portrait" src={portrait} alt={`${node.speaker ?? "登場人物"}の立ち絵`} />}
    <div className="v100-node-copy"><span className="v100-node-kind">{node.kind === "dialogue" ? node.speaker ?? "通信" : node.kind === "player-action" ? "主人公" : "場面"}</span><p>{node.text || "…"}</p></div>
  </div>;
}

function MapView({ save, selectedStageId, onSelect, onStart, onRename, onBackup, onImport, onReplay, onOpenPersonnel, onOpenSupportVehicle, onOpenData }: { save: Save; selectedStageId: string; onSelect: (id: string) => void; onStart: (id: string) => void; onRename: () => void; onBackup: () => void; onImport: (file: File | undefined) => void; onReplay: (eventId: string) => void; onOpenPersonnel: () => void; onOpenSupportVehicle: () => void; onOpenData: () => void }) {
  const stage = V100_STAGE_BY_ID[selectedStageId];
  const runtime = v100StageRuntimeFor(selectedStageId);
  const completedNumber = Math.max(0, ...save.completedStageIds.map(stageNumberFor));
  const [chapterIndex, setChapterIndex] = useState(() => chapterIndexForStage(stage?.number ?? 1));
  const chapter = V100_CHAPTERS[chapterIndex] ?? V100_CHAPTERS[0];
  const chapterStages = V100_STAGES.filter((entry) => entry.number >= chapter.start && entry.number <= chapter.end);
  const boss = stage?.missionType === "boss" ? V100_BOSSES.find((entry) => entry.stageNumber === stage.number) : null;
  const nextStage = V100_STAGES.find((entry) => entry.number === completedNumber + 1);
  const selectStage = (stageId: string) => {
    const next = V100_STAGE_BY_ID[stageId];
    if (next) setChapterIndex(chapterIndexForStage(next.number));
    onSelect(stageId);
  };
  return (
    <section className="v100-map-layout" aria-label="V1.0.0 campaign map" data-v100-surface="map">
      <div className="v100-map-hero" style={{ backgroundImage: `url(${runtime?.backgroundPath ?? PRODUCTION_VISUALS.command})` }}>
        <div><span className="v100-kicker">作戦地図 / {save.postGameAvailable ? "全作戦解放" : `次の目的地 ${nextStage?.displayName ?? `S${completedNumber + 1}`}`}</span><h2>{stage?.displayName ?? "西新ルート"}</h2><p>{objectiveLabelFor(stage)} / route {stage ? `S${String(stage.number).padStart(2, "0")}` : "準備中"}</p></div>
      </div>
      <nav className="v100-chapter-tabs" aria-label="章を選ぶ">{V100_CHAPTERS.map((entry, index) => <button type="button" key={entry.id} className={index === chapterIndex ? "selected" : ""} onClick={() => setChapterIndex(index)}><strong>{entry.label}</strong><small>作戦 {entry.range}</small></button>)}</nav>
      <div className="v100-route-label" aria-label="作戦 route"><span>西新救助線</span><i />{chapterStages.map((entry) => <b key={`route-${entry.id}`} className={`${entry.number === completedNumber + 1 ? "current" : ""} ${save.completedStageIds.includes(entry.id) ? "clear" : ""}`} aria-hidden="true" />)}<span>封鎖区域</span></div>
      <div className="v100-map-actions" aria-label="管理画面"><button type="button" onClick={onOpenPersonnel}>人員管理 <small>{save.ownedUnitIds.length}名</small></button><button type="button" onClick={onOpenSupportVehicle}>支援・車両管理 <small>{save.equippedSupportId ? "支援装備済み" : "装備を確認"}</small></button><button type="button" onClick={onOpenData}>データ管理 <small>保存・復元</small></button></div>
      <div className="v100-map-grid">
        <nav className="v100-stage-list" aria-label={`${chapter.label}の作戦一覧`}>{chapterStages.map((entry) => {
          const available = save.availableStageIds.includes(entry.id);
          const completed = save.completedStageIds.includes(entry.id);
          const isBoss = entry.missionType === "boss";
          return <button type="button" key={entry.id} className={`${selectedStageId === entry.id ? "selected" : ""} ${completed ? "completed" : ""} ${!available ? "locked" : ""} ${isBoss ? "boss-node" : ""}`} onClick={() => selectStage(entry.id)}><span>{isBoss ? "BOSS" : `S${String(entry.number).padStart(2, "0")}`}</span><strong>{entry.displayName}</strong><small>{completed ? `CLEAR ★${save.bestStars[entry.id] ?? 0}` : available ? missionLabelFor(entry.missionType) : "LOCKED / 前作戦未達"}</small></button>;
        })}</nav>
        <aside className="v100-map-side">
          <div className="v100-map-side-heading"><span className="v100-kicker">{stage ? `作戦 S${String(stage.number).padStart(2, "0")}` : "作戦地図"}</span><span>{stage && save.availableStageIds.includes(stage.id) ? "出撃可能" : "封鎖中"}</span></div>
          <h3>{stage?.displayName ?? "作戦を選択"}</h3>
          {boss && <div className="v100-boss-callout"><span>ボス作戦</span><strong>{boss.displayName}</strong><small>脅威 HP {boss.hp.toLocaleString()} / 特殊: {String(boss.special)}</small></div>}
          <dl><div><dt>作戦種別</dt><dd>{missionLabelFor(stage?.missionType)}</dd></div><div><dt>敵の脅威</dt><dd>{enemyPackLabelFor(stage?.enemyPack)}</dd></div><div><dt>作戦目標</dt><dd>{objectiveLabelFor(stage)}</dd></div><div><dt>CAPS</dt><dd>{save.caps}</dd></div></dl>
          <button className="v100-primary" type="button" disabled={!stage || !save.availableStageIds.includes(stage.id)} onClick={() => stage && onStart(stage.id)}>{save.completedStageIds.includes(stage?.id ?? "") ? "再出撃" : "この作戦を編成"}</button>
          <div className="v100-map-briefs"><article><span>人員</span><strong>{save.ownedUnitIds.length}名</strong><small>人員管理で登録</small></article><article><span>車両</span><strong>装甲車両</strong><small>耐久 {save.vehicle.maxHp}</small></article><article><span>支援</span><strong>{save.equippedSupportId ? "装備済み" : "選択可能"}</strong><small>支援・車両管理</small></article></div>
          <div className="v100-map-tools"><button type="button" onClick={onRename}>表示名を変更</button><button type="button" onClick={onBackup}>簡易バックアップ</button><label className="v100-file-button">復元<input type="file" accept="application/json" onChange={(event) => onImport(event.currentTarget.files?.[0])} /></label></div>
          <div className="v100-replay-list"><span className="v100-kicker">会話記録</span>{save.readStoryEventIds.slice(-6).map((eventId) => <button type="button" key={eventId} onClick={() => onReplay(eventId)}>{eventDisplayLabel(eventId)}</button>)}</div>
        </aside>
      </div>
    </section>
  );
}

function FormationView({ save, onSlotChange, onStart }: { save: Save; onSlotChange: (slot: number, value: string) => void; onStart: () => void }) {
  const [activeSlot, setActiveSlot] = useState(0);
  const ownedUnits = save.ownedUnitIds.map((unitId) => UNIT_BY_ID.get(unitId)).filter(Boolean) as Array<(typeof V100_UNITS)[number]>;
  const assignActiveSlot = (unitId: string) => onSlotChange(activeSlot, unitId);
  return <section className="v100-panel v100-formation-panel"><div className="v100-panel-heading"><div><span className="v100-kicker">出撃準備 / 7枠</span><h2>出撃編成</h2></div><span>{save.formationSlots.filter(Boolean).length} / 7 配置</span></div><p className="v100-formation-intro">枠を選び、隊員カードを押して配置します。同じ隊員を複数の枠に配置できます。支援と装甲車両は別の作戦装備です。</p><div className="v100-slot-rail" aria-label="7枠の編成"><div className="v100-slot-track">{save.formationSlots.map((unitId, index) => <button type="button" key={`slot-${index}`} className={`v100-slot ${activeSlot === index ? "selected" : ""} ${unitId ? "filled" : "empty"}`} onClick={() => setActiveSlot(index)} aria-pressed={activeSlot === index} aria-label={`編成枠${index + 1}`}><span>枠 {index + 1}</span><strong>{unitId ? activeUnitName(unitId) : "空き"}</strong><small>{unitId ? "配置中" : "隊員を選択"}</small></button>)}</div></div><div className="v100-formation-workspace"><div className="v100-roster-heading"><h3>隊員</h3><span>枠 {activeSlot + 1} に配置</span></div><div className="v100-roster-grid">{ownedUnits.map((unit) => { const art = formationCardForUnit(unit.id); const level = Math.max(1, Number(save.unitLevels[unit.id]) || 1); return <button type="button" className="v100-roster-card" key={unit.id} onClick={() => assignActiveSlot(unit.id)} aria-label={`${unit.displayName}を枠${activeSlot + 1}へ配置`}><span className="v100-roster-card-art">{art && <img src={art} alt="" />}</span><span className="v100-roster-card-copy"><strong>{unit.displayName}</strong><small>{unit.role} / Lv.{level}</small><small>武器・射程・固有能力</small></span></button>; })}</div><div className="v100-formation-loadout"><article><span>支援</span><strong>{save.equippedSupportId ? "装備済み" : "未選択"}</strong><small>戦場では隊員枠と別に使用</small></article><article><span>装甲車両</span><strong>耐久 {save.vehicle.maxHp}</strong><small>車両能力は戦闘画面で操作</small></article></div></div><div className="v100-formation-footer"><button type="button" onClick={() => onSlotChange(activeSlot, "")} disabled={!save.formationSlots[activeSlot]}>枠を空ける</button><button className="v100-primary" type="button" disabled={!save.formationSlots.some(Boolean)} onClick={onStart}>戦闘へ</button></div></section>;
}

function PersonnelView({ save, onBack, onPurchase }: { save: Save; onBack: () => void; onPurchase: (unitId: string) => void }) {
  return <section className="v100-panel v100-management-panel" data-v100-surface="personnel" aria-label="人員管理">
    <div className="v100-panel-heading"><div><span className="v100-kicker">作戦地図 / 人員</span><h2>人員管理</h2></div><button type="button" onClick={onBack}>作戦地図へ</button></div>
    <p className="v100-management-intro">登録済みの隊員をCAPSで迎え入れ、作戦に必要な役割を揃えます。登録・所有・レベル上限を別々に確認できます。</p>
    <div className="v100-management-summary"><span>所有 <strong>{save.ownedUnitIds.length}</strong> / {V100_UNITS.length}</span><span>登録済み <strong>{save.registeredUnitIds.length}</strong></span><span>Lv上限 <strong>{save.levelCap}</strong></span><span>CAPS <strong>{save.caps}</strong></span></div>
    <div className="v100-personnel-grid">{V100_UNITS.map((unit) => {
      const owned = save.ownedUnitIds.includes(unit.id);
      const registered = save.registeredUnitIds.includes(unit.id);
      const currentLevel = Math.max(1, Number(save.unitLevels[unit.id]) || 1);
      const nextCost = currentLevel < save.levelCap ? v100LevelCost(currentLevel + 1) : 0;
      const art = formationCardForUnit(unit.id);
      return <article className={`v100-personnel-card ${owned ? "owned" : registered ? "registered" : "locked"}`} key={unit.id}>
        <div className="v100-personnel-art">{art && <img src={art} alt="" />}</div>
        <div className="v100-personnel-copy"><span className="v100-kicker">{unit.role}</span><h3>{unit.displayName}</h3><p>{owned ? `Lv.${currentLevel} / 上限 ${save.levelCap}` : registered ? "迎撃準備中" : `S${String(unit.availabilityStageNumber).padStart(2, "0")} クリアで登録`}</p>{owned && <small>次Lvコスト {nextCost > 0 ? `${nextCost} CAPS` : "上限"}</small>}</div>
        {owned ? <span className="v100-state-badge">所有</span> : registered ? <button type="button" onClick={() => onPurchase(unit.id)} disabled={save.caps < unit.registrationCostCaps}>{unit.registrationCostCaps > 0 ? `加入 ${unit.registrationCostCaps} CAPS` : "加入"}</button> : <span className="v100-state-badge locked">未登録</span>}
      </article>;
    })}</div>
  </section>;
}

function SupportVehicleView({ save, onBack, onPurchaseSupport, onEquipSupport, onUpgradeVehicle }: { save: Save; onBack: () => void; onPurchaseSupport: (supportId: string) => void; onEquipSupport: (supportId: string | null) => void; onUpgradeVehicle: () => void }) {
  const vehicleLevel = save.vehicle.upgradeLevel;
  const nextCost = vehicleLevel < V100_VEHICLE.maxUpgradeLevel ? V100_VEHICLE.upgradeCosts[vehicleLevel] : 0;
  const nextHp = vehicleLevel < V100_VEHICLE.maxUpgradeLevel ? save.vehicle.maxHp + V100_VEHICLE.hpPerUpgrade : save.vehicle.maxHp;
  return <section className="v100-panel v100-management-panel" data-v100-surface="support-vehicle" aria-label="支援と車両管理">
    <div className="v100-panel-heading"><div><span className="v100-kicker">作戦地図 / 支援・車両</span><h2>支援・車両管理</h2></div><button type="button" onClick={onBack}>作戦地図へ</button></div>
    <div className="v100-support-vehicle-grid">
      <section className="v100-support-section" aria-labelledby="v100-support-title"><div className="v100-section-heading"><div><span className="v100-kicker">戦術支援</span><h3 id="v100-support-title">支援装備</h3></div><span>{save.equippedSupportId ? "選択済み" : "未選択"}</span></div><div className="v100-support-management-list">{V100_SUPPORTS.map((support) => {
        const owned = save.ownedSupportIds.includes(support.id);
        const unlocked = save.supportPurchaseUnlockedIds.includes(support.id);
        const selected = save.equippedSupportId === support.id;
        return <article className={`v100-support-management-card ${selected ? "selected" : ""} ${!unlocked ? "locked" : ""}`} key={support.id}><div><span className="v100-kicker">SUPPORT / {support.cooldownSeconds}s</span><h4>{support.displayName}</h4><p>必要 {support.battleCost} CAPS / 再使用 {support.cooldownSeconds}秒</p></div>{owned ? <button type="button" className={selected ? "selected" : ""} onClick={() => onEquipSupport(selected ? null : support.id)}>{selected ? "選択中" : "装備する"}</button> : unlocked ? <button type="button" onClick={() => onPurchaseSupport(support.id)} disabled={save.caps < support.unlockCostCaps}>{support.unlockCostCaps} CAPSで取得</button> : <span className="v100-state-badge locked">S{String(support.unlockStageNumber).padStart(2, "0")}後に解放</span>}</article>;
      })}</div></section>
      <section className="v100-vehicle-section" aria-labelledby="v100-vehicle-title"><div className="v100-section-heading"><div><span className="v100-kicker">MOBILE BASE / VEHICLE</span><h3 id="v100-vehicle-title">{V100_VEHICLE.displayName}</h3></div><span>Lv.{vehicleLevel} / {V100_VEHICLE.maxUpgradeLevel}</span></div><div className="v100-vehicle-art"><img src={V099_CRAWLER_RUNTIME_PROFILE.equipmentHost.closed.path} alt="装甲車両" /></div><dl className="v100-vehicle-stats"><div><dt>現在HP / 最大HP</dt><dd>{save.vehicle.maxHp} / {save.vehicle.maxHp}</dd></div><div><dt>強化後</dt><dd>{vehicleLevel >= V100_VEHICLE.maxUpgradeLevel ? "MAX" : `${save.vehicle.maxHp} → ${nextHp}`}</dd></div><div><dt>次の費用</dt><dd>{nextCost > 0 ? `${nextCost} CAPS` : "MAX"}</dd></div></dl><button className="v100-primary" type="button" onClick={onUpgradeVehicle} disabled={vehicleLevel >= V100_VEHICLE.maxUpgradeLevel || save.caps < nextCost}>{vehicleLevel >= V100_VEHICLE.maxUpgradeLevel ? "強化完了" : `装甲を強化する / ${nextCost} CAPS`}</button><div className="v100-vehicle-abilities"><span className="v100-kicker">使用可能な能力</span>{V100_VEHICLE.abilities.map((ability) => <div key={ability.id}><strong>{ability.displayName}</strong><small>必要 {ability.battleCost} / 再使用 {ability.cooldownSeconds}秒</small></div>)}</div></section>
    </div>
  </section>;
}

function DataManagementView({ save, onBack, onBackup, onImport }: { save: Save; onBack: () => void; onBackup: () => void; onImport: (file: File | undefined) => void }) {
  return <div className="v100-modal-backdrop" data-v100-surface="data" role="presentation"><section className="v100-modal v100-data-modal" role="dialog" aria-modal="true" aria-labelledby="v100-data-title"><div className="v100-panel-heading"><div><span className="v100-kicker">作戦記録</span><h2 id="v100-data-title">データ管理</h2></div><button type="button" onClick={onBack}>閉じる</button></div><p>現在の進行はブラウザ内のV1.0.0セーブへ保存されています。書き出し・復元は検証済みの形式だけを受け付けます。</p><dl className="v100-data-summary"><div><dt>主人公</dt><dd>{save.playerName}</dd></div><div><dt>到達作戦</dt><dd>{save.completedStageIds.length} / {V100_STAGES.length}</dd></div><div><dt>更新世代</dt><dd>{save.revision}</dd></div><div><dt>最終更新</dt><dd>{new Date(save.updatedAt).toLocaleString("ja-JP")}</dd></div></dl><div className="v100-data-actions"><button className="v100-primary" type="button" onClick={onBackup}>セーブを書き出す</button><label className="v100-file-button">セーブを復元<input type="file" accept="application/json" onChange={(event) => onImport(event.currentTarget.files?.[0])} /></label></div><small className="v100-data-note">復元に失敗した場合、現在のセーブは変更されません。</small></section></div>;
}

function ResultView({ result, firstClear, onContinue, onRetry, onMap }: { result: Record<string, unknown> | null; firstClear: boolean; onContinue: () => void; onRetry: () => void; onMap: () => void }) {
  const won = result?.won === true;
  const stageNumber = Number(result?.stageNumber) || 0;
  const nextStage = V100_STAGES[stageNumber];
  const rewardCaps = won ? Number(result?.rewardCaps ?? 0) || (firstClear ? 80 + stageNumber * 10 : Math.max(20, Math.round((80 + stageNumber * 10) * .2 / 5) * 5)) : 0;
  const unlocks = firstClear ? (V100_STAGE_BY_ID[String(result?.stageId)]?.firstClearPayload ?? []).map((item) => item.startsWith("unit-") ? UNIT_BY_ID.get(item)?.displayName ?? item : item.startsWith("support-") ? V100_SUPPORTS.find((support) => support.id === item)?.displayName ?? item : item.startsWith("level-cap-") ? `Lv.${item.slice(10)}上限` : item) : [];
  return <section className={`v100-panel v100-result-panel ${won ? "win" : "lose"}`} data-v100-surface={won ? "result-win" : "result-lose"} aria-label="作戦結果"><span className="v100-kicker">作戦結果 / {won ? "MISSION COMPLETE" : "MISSION FAILED"}</span><h2>{won ? "作戦成功" : "作戦失敗"}</h2><p>{won ? `装甲車両は作戦区域を離脱。S${String(stageNumber).padStart(2, "0")}の記録を確定します。` : "防衛線を立て直し、編成を整えて再挑戦できます。"}</p><div className="v100-result-highlight"><strong>{won ? `★${String(result?.stars ?? 0)}` : "—"}</strong><span>{won ? "作戦評価" : "再編成可能"}</span></div><dl className="v100-result-records"><div><dt>車両耐久</dt><dd>{String(result?.vehicleHp ?? 0)} / {String(result?.vehicleMaxHp ?? 0)}</dd></div><div><dt>作戦目標</dt><dd>{result?.objectiveComplete === true ? "達成" : "未達"}</dd></div><div><dt>経過時間</dt><dd>{Math.round(Number(result?.elapsedSeconds) || 0)}秒</dd></div><div><dt>損耗</dt><dd>{Number(result?.unitDeaths) || 0}名</dd></div></dl>{won && <div className="v100-result-rewards"><article><span>獲得CAPS</span><strong>+{rewardCaps}</strong></article><article><span>解放</span><strong>{unlocks.length > 0 ? unlocks.join(" / ") : "なし"}</strong></article></div>}<div className="v100-result-actions"><button className="v100-primary" type="button" onClick={won ? onContinue : onRetry}>{won ? "次の場面へ" : "編成へ戻る"}</button><button type="button" onClick={onMap}>{won ? (nextStage ? `次の作戦 S${String(nextStage.number).padStart(2, "0")}` : "作戦地図を確認") : "作戦地図を確認"}</button></div></section>;
}

function EventLogView({ save, onReplay, onClose }: { save: Save; onReplay: (eventId: string) => void; onClose: () => void }) {
  return <div className="v100-modal-backdrop"><section className="v100-modal v100-log-modal" role="dialog" aria-modal="true" aria-label="会話記録"><div className="v100-panel-heading"><div><span className="v100-kicker">会話記録</span><h2>{save.readStoryEventIds.length}件を読了</h2></div><button type="button" onClick={onClose}>閉じる</button></div><div className="v100-log-list">{save.readStoryEventIds.map((eventId) => <button type="button" key={eventId} onClick={() => { onReplay(eventId); onClose(); }}>{eventDisplayLabel(eventId)}</button>)}</div></section></div>;
}

function ReplayView({ event, node, index, onNext, onClose }: { event: ReturnType<typeof v100StoryEventView>; node: StoryNode | null; index: number; onNext: () => void; onClose: () => void }) {
  if (!event) return null;
  const hasNext = index < event.nodes.length - 1;
  return <div className="v100-modal-backdrop"><section className="v100-modal" role="dialog" aria-modal="true" aria-label="会話記録"><div className="v100-event-heading"><span className="v100-kicker">会話記録 / {eventDisplayLabel(event.id)}</span><button type="button" onClick={onClose}>閉じる</button></div>{node ? <StoryNodeView node={node} /> : <p>この会話には表示する場面がありません。</p>}<button className="v100-primary" type="button" onClick={hasNext ? onNext : onClose}>{hasNext ? "次へ" : "記録を閉じる"}</button></section></div>;
}
