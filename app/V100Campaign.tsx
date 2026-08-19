"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";

import {
  V100_BOSSES,
  V100_STAGE_BY_ID,
  V100_STAGE_IDS,
  V100_STAGES,
  V100_SUPPORTS,
  V100_UNITS,
  V100_VEHICLE,
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
import { createV100EventAudioOwner } from "./v100EventAudio.js";
import { v100EventPresentationFor } from "./v100EventPresentation.js";
import { v100RoleLabelFor } from "./v100Terminology.js";
import { campaignUnitIdToCombatKind } from "./campaign.js";
import { AshfallGame, type AshfallBattleResult } from "./AshfallGame";
import { v100StageRuntimeFor } from "./v100StageRuntime.js";
import { V100_RUNTIME_ASSET_MANIFEST } from "./v100RuntimeAssetManifest.js";
import { FORMATION_CARD_ART } from "./spriteManifest.js";
import { PRODUCTION_VISUALS, stageVisualFor } from "./productionVisuals.js";
import { PROLOGUE_SYNOPSIS } from "./storyEvents.js";
import { publicDisplayText } from "./publicDisplayNames.js";
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

function portraitFor(owner: string | null | undefined) {
  return owner ? PORTRAIT_PATHS[owner] ?? EVENT_PORTRAIT_PROFILES[owner]?.path ?? null : null;
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

function enemyPackLabelFor(value: string | undefined, stageNumber = 99) {
  const label = ENEMY_PACK_LABELS[value ?? ""] ?? "混成感染群";
  return stageNumber < 27 && label.includes("レッドパンサー") ? "赤レンズ部隊" : label;
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

const V100_PROLOGUE_SYNOPSIS = PROLOGUE_SYNOPSIS.short.replace("放置車両CRAWLERを確保", "放置された装甲車両を確保");

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
  const positions = [
    [14, 56], [31, 35], [48, 58], [64, 34], [79, 57], [91, 35],
  ];
  if (total <= positions.length) return positions[index] ?? positions[positions.length - 1];
  const progress = total <= 1 ? 0.5 : index / (total - 1);
  return [12 + progress * 76, index % 2 === 0 ? 65 : 35];
}

function eventBackdropFor(presentation: ReturnType<typeof v100EventPresentationFor>, fallback: string) {
  if (!presentation) return fallback;
  if (presentation.category === "ending") return V100_RUNTIME_ASSET_MANIFEST.storyCuts.takuyaOmegaEndingDefeat;
  if (presentation.category === "credits") return PRODUCTION_VISUALS.command;
  if (presentation.category === "epilogue") return V100_RUNTIME_ASSET_MANIFEST.storyCuts.mutatedPresidentDefeat;
  return fallback;
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
    // Stable V1 preparation screens publish their actual identity. Story nodes
    // remain unsafe so a release cannot interrupt a cursor or first-clear
    // transition; battle/result explicitly block it.
    const screen = battleActive ? "battle"
      : resultSaving ? "result"
        : isEventPhase(flow.phase) ? "event"
          : flow.phase === "map"
            ? surface === "personnel" ? "personnel" : surface === "support-vehicle" ? "loadout" : surface === "data" ? "storage" : "map"
            : flow.phase === "formation" ? "formation" : "title";
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
  }, [flow.phase, surface]);

  useEffect(() => {
    const shell = document.querySelector<HTMLElement>(".v100-shell");
    if (!shell) return;
    shell.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [flow.phase, surface]);

  const event = useMemo(() => flow.eventId ? v100StoryEventView(flow.eventId, save.playerName) : null, [flow.eventId, save.playerName]);
  const currentNode = (event?.nodes?.[storyIndex] ?? null) as StoryNode | null;
  const eventPresentation = useMemo(() => flow.eventId
    ? v100EventPresentationFor({ eventId: flow.eventId, phase: flow.phase, node: currentNode, nodeIndex: storyIndex })
    : null, [currentNode, flow.eventId, flow.phase, storyIndex]);
  const eventRuntime = v100StageRuntimeFor(eventPresentation?.stageId ?? selectedStageId);
  useEffect(() => {
    const owner = eventAudioOwnerRef.current;
    if (!owner) return undefined;
    if (eventPresentation) {
      void owner.present(eventPresentation);
    } else {
      void owner.stop("route-transition");
    }
    return undefined;
  }, [eventPresentation]);
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
    void eventAudioOwnerRef.current?.activate(eventPresentation);
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
        setNotice("作戦セーブとして読み込めませんでした。現在のセーブは保持しています。");
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

  if (!hydrated) return <main className="v100-shell"><p className="v100-loading">作戦セーブを検証しています…</p></main>;

  const immersiveFlow = flow.phase === "name" || isEventPhase(flow.phase) || flow.phase === "battle";
  const screenLabel = surface === "personnel" ? "隊員" : surface === "support-vehicle" ? "出撃装備" : surface === "data" ? "セーブ" : flow.phase === "formation" ? "出撃編成" : flow.phase === "result" ? "戦果" : "作戦地図";

  return (
    <main className={`v100-shell v100-surface-${surface}`} data-v100-phase={flow.phase} data-v100-stage={flow.stageNumber ?? "map"} data-v100-surface={surface} style={{ "--v100-command-art": `url(${PRODUCTION_VISUALS.command})` } as CSSProperties}>
      {!immersiveFlow && <header className="v100-topbar v100-compact-topbar">
        <div className="v100-topbar-title"><span className="v100-backmark" aria-hidden="true">西新</span><div><span className="v100-kicker">現場指揮</span><h1>{screenLabel}</h1></div></div>
        <div className="v100-save-meta"><span>{save.caps} CAPS</span>{surface === "campaign" && <button type="button" onClick={() => setLogOpen((open) => !open)}>会話記録</button>}</div>
      </header>}

      {notice && <p className="v100-notice" role="status">{notice}</p>}

      {flow.phase === "name" && (
        <section className="v100-title-screen" aria-labelledby="v100-name-title" style={{ backgroundImage: `url(${PRODUCTION_VISUALS.title})` }}>
          <div className="v100-title-wash" />
          <div className="v100-title-copy">
            <span className="v100-kicker">西新 / 物語</span>
            <div className="v100-title-lockup" aria-label="西新世紀末物語">
              <strong>西新</strong><span>世紀末物語</span>
            </div>
            <p className="v100-title-synopsis">{V100_PROLOGUE_SYNOPSIS}</p>
            <div className="v100-name-card">
              <span className="v100-kicker">名前を入力</span>
              <h2 id="v100-name-title">名前を入力</h2>
              <p>この名前は、物語の中で仲間たちがあなたを呼ぶ名前になります。</p>
              <form onSubmit={startCampaign}>
                <label htmlFor="v100-player-name">呼ばれたい名前</label>
                <input id="v100-player-name" value={nameInput} onChange={(event) => setNameInput(event.currentTarget.value)} maxLength={24} autoComplete="nickname" />
                {nameError && <small className="v100-error" role="alert">{nameError}</small>}
                <button className="v100-primary" type="submit" aria-label="この名前で作戦を始める">この名前で始める</button>
              </form>
              <button className="v100-secondary-data" type="button" onClick={downloadBackup}>データ管理（書き出し）</button>
            </div>
          </div>
        </section>
      )}

      {isEventPhase(flow.phase) && event && (
        <section className={`v100-event-layout v100-event-${flow.phase} v100-event-category-${eventPresentation?.category ?? "scene"}`} aria-label={`${eventDisplayLabel(flow.eventId)}イベント`} data-v100-surface={flow.phase} data-v100-event-id={flow.eventId ?? undefined} data-v100-event-category={eventPresentation?.category ?? undefined} data-v100-node-index={eventPresentation?.nodeIndex ?? undefined} data-v100-transition={eventPresentation?.transition ?? undefined} data-v100-audio-owner={eventPresentation?.audioOwner ?? undefined} data-v100-audio-state={eventAudioSnapshot?.audioStatus?.state ?? "locked"} data-v100-audio-revision={eventAudioRevision}>
          <div className="v100-event-backdrop" style={{ backgroundImage: `url(${eventBackdropFor(eventPresentation, eventRuntime?.backgroundPath ?? "/art/v060/title-key-visual-v1.webp")})` }} />
          <article className="v100-event-panel">
            <div className="v100-event-heading"><span className="v100-kicker">{eventDisplayLabel(flow.eventId)}</span><span>{eventPresentation?.nodeLabel ?? "通信"}{event.nodes.length > 1 ? ` / ${Math.min(storyIndex + 1, event.nodes.length)}` : ""}</span></div>
            {currentNode ? <StoryNodeView node={currentNode} eventId={flow.eventId} phase={flow.phase} nodeIndex={storyIndex} presentation={eventPresentation} /> : <p className="v100-action-node">このイベントを確認して次へ進みます。</p>}
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
        <FormationView save={save} stageId={flow.stageId} onSlotChange={chooseFormation} onStart={startBattle} />
      )}

      {flow.phase === "battle" && productionSession && (
        <AshfallGame externalSession={productionSession} />
      )}

      {flow.phase === "result" && (
        <ResultView result={flow.pendingResult} firstClear={flow.firstClear} onContinue={continueFromResult} onRetry={continueFromResult} onMap={continueFromResult} />
      )}

      {logOpen && <EventLogView save={save} onReplay={(eventId) => { setReplayEventId(eventId); setReplayNodeIndex(0); }} onClose={() => setLogOpen(false)} />}
      {replayEvent && <ReplayView event={replayEvent} node={replayNode} index={replayNodeIndex} onNext={() => setReplayNodeIndex((index) => index + 1)} onClose={() => setReplayEventId(null)} />}
      {giftPopup && <div className="v100-modal-backdrop"><section className="v100-modal" role="dialog" aria-modal="true" aria-labelledby="v100-gift-title"><span className="v100-kicker">引き継ぎ特典</span><h2 id="v100-gift-title">新しい作戦記録を開始しました</h2><p>これまでの遊び方に感謝を込めて、作戦記録へ180 CAPSを一度だけ届けました。過去の記録はそのまま保管されています。</p><button className="v100-primary" type="button" onClick={acknowledgeGift}>確認する</button></section></div>}
    </main>
  );
}

function StoryNodeView({ node, eventId = null, phase = "event", nodeIndex = 0, presentation = null }: { node: StoryNode; eventId?: string | null; phase?: string; nodeIndex?: number; presentation?: ReturnType<typeof v100EventPresentationFor> | null }) {
  const portrait = portraitFor(node.portraitOwner);
  const resolvedPresentation = presentation ?? v100EventPresentationFor({ eventId, phase, node, nodeIndex });
  const portraitSide = resolvedPresentation?.portraitSide ?? (node.portraitKind === "right" || (node.portraitKind !== "left" && node.portraitOwner && ["segawa", "red-panther-commander"].includes(node.portraitOwner)) ? "right" : "left");
  const nodeLabel = node.kind === "dialogue" ? storySpeakerLabel(node.speaker) : node.kind === "player-action" ? "主人公" : node.kind === "battle-marker" ? "作戦情報" : node.kind === "system" ? "無線記録" : "";
  const playerFacingText = publicDisplayText(node.text || "…");
  return <div className={`v100-story-node v100-node-${node.kind ?? "action"}`} data-portrait-side={portraitSide} data-v100-state={`dialogue-${portraitSide}`} data-v100-node-kind={resolvedPresentation?.nodeKind ?? node.kind ?? "action"} data-v100-node-label={resolvedPresentation?.nodeLabel ?? "場面"} data-v100-transition={resolvedPresentation?.transition ?? undefined} data-v100-audio-cue={resolvedPresentation?.cueId ?? undefined}>
    {portrait && <img className="v100-portrait" src={portrait} alt={`${node.speaker ?? "登場人物"}の立ち絵`} />}
    <div className="v100-node-copy">{nodeLabel && <span className="v100-node-kind">{nodeLabel}</span>}<p>{playerFacingText}</p></div>
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
  const routePoints = chapterStages.map((entry, index) => {
    const [x, y] = mapNodePosition(index, chapterStages.length);
    return `${x},${y}`;
  }).join(" ");
  return (
    <section className={`v100-map-layout ${stage?.missionType === "boss" ? "v100-map-boss-focus" : ""} ${stage && !save.availableStageIds.includes(stage.id) ? "v100-map-locked-focus" : ""}`} aria-label="作戦地図" data-v100-surface="map">
      <div className="v100-map-hero" style={{ backgroundImage: `url(${runtime?.backgroundPath ?? PRODUCTION_VISUALS.command})` }}>
        <div className="v100-map-hero-copy"><span className="v100-kicker">作戦地図 / {save.postGameAvailable ? "全作戦解放" : `次の目的地 ${stageDisplayNameFor(nextStage)}`}</span><h2>{stageDisplayNameFor(stage)}</h2><p>{objectiveLabelFor(stage)} / 作戦 {stage ? `S${String(stage.number).padStart(2, "0")}` : "準備中"}</p><div className="v100-map-hero-meta"><span>{stage?.missionType === "boss" ? "脅威指定" : "出撃準備"}</span><strong>{stage && save.availableStageIds.includes(stage.id) ? "出撃可能" : "前作戦クリアで解放"}</strong><span>{stage ? `S${String(stage.number).padStart(2, "0")}` : "—"}</span></div></div>
      </div>
      <nav className="v100-chapter-tabs" aria-label="作戦区域を選ぶ">{V100_CHAPTERS.map((entry, index) => <button type="button" key={entry.id} className={index === chapterIndex ? "selected" : ""} onClick={() => setChapterIndex(index)} aria-pressed={index === chapterIndex}><strong>{entry.label}</strong><small>S{entry.range}</small></button>)}</nav>
      <div className="v100-route-label" aria-label="作戦経路"><span>西新救助線</span><i />{chapterStages.map((entry) => <b key={`route-${entry.id}`} className={`${entry.number === completedNumber + 1 ? "current" : ""} ${save.completedStageIds.includes(entry.id) ? "clear" : ""}`} aria-hidden="true" />)}<span>封鎖区域</span></div>
      <div className="v100-map-grid">
        <div className="v100-map-canvas-shell">
          <div className="v100-map-canvas-heading"><span className="v100-kicker">{chapter.label} / 作戦区域</span><strong>{chapterStages.length}地点</strong></div>
          <nav className="v100-map-canvas v100-stage-list" aria-label={`${chapter.label}の作戦地点`}>
            <svg className="v100-map-route-art" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><polyline points={routePoints} /></svg>
            {chapterStages.map((entry, index) => {
              const available = save.availableStageIds.includes(entry.id);
              const completed = save.completedStageIds.includes(entry.id);
              const isBoss = entry.missionType === "boss";
              const [x, y] = mapNodePosition(index, chapterStages.length);
              const nodeState = completed ? "制圧済み" : available ? "出撃可" : "封鎖中";
              return <button type="button" key={entry.id} className={`v100-map-node ${selectedStageId === entry.id ? "selected" : ""} ${completed ? "completed" : ""} ${!available ? "locked" : "available"} ${isBoss ? "boss-node" : ""}`} style={{ "--node-x": `${x}%`, "--node-y": `${y}%` } as CSSProperties} onClick={() => selectStage(entry.id)} aria-label={`${stageDisplayNameFor(entry)} ${nodeState}`}>
                <span className="v100-map-node-marker"><i>{isBoss ? "◆" : completed ? "✓" : `S${String(entry.number).padStart(2, "0")}`}</i></span><strong>{stageDisplayNameFor(entry)}</strong><small>{nodeState}{completed ? ` ★${save.bestStars[entry.id] ?? 0}` : ` / ${missionLabelFor(entry.missionType)}`}</small>
              </button>;
            })}
          </nav>
          <div className="v100-map-canvas-legend"><span><i className="is-current" />選択地点</span><span><i className="is-clear" />制圧済み</span><span><i className="is-locked" />封鎖</span></div>
        </div>
        <aside className={`v100-map-side ${stage?.missionType === "boss" ? "is-boss" : ""} ${stage && !save.availableStageIds.includes(stage.id) ? "is-locked" : ""}`}>
          <div className="v100-map-side-heading"><span className="v100-kicker">{stage ? `作戦 S${String(stage.number).padStart(2, "0")}` : "作戦地図"}</span><span>{stage && save.availableStageIds.includes(stage.id) ? "出撃可能" : "封鎖中"}</span></div>
          <h3>{stageDisplayNameFor(stage)}</h3>
          <div className="v100-map-actions" aria-label="出撃準備"><button type="button" aria-label="隊員を編成" onClick={onOpenPersonnel}><strong>隊員</strong><small>{save.ownedUnitIds.length}名 / 出撃編成</small></button><button type="button" aria-label="出撃装備を選ぶ" onClick={onOpenSupportVehicle}><strong>出撃装備</strong><small>{save.equippedSupportId ? "支援装備中" : "支援を選ぶ"}</small></button></div>
          {stage && !save.availableStageIds.includes(stage.id) && <div className="v100-lock-banner"><strong>作戦封鎖中</strong><span>前作戦クリアで解放</span></div>}
          {boss && <div className="v100-boss-callout"><div className="v100-boss-callout-heading"><span>ボス作戦</span><strong>標的指定</strong></div><strong className="v100-boss-name">{boss.displayName}</strong><small>脅威 HP {boss.hp.toLocaleString()} / 特殊: {String(boss.special)}</small><div className="v100-threat-meter"><i style={{ width: `${Math.min(100, Math.max(8, boss.hp / 92))}%` }} /></div></div>}
          <div className="v100-stage-intel"><span>作戦目標</span><strong>{missionLabelFor(stage?.missionType)}</strong><p>{objectiveLabelFor(stage)}</p></div>
          <dl><div><dt>脅威分類</dt><dd>{enemyPackLabelFor(stage?.enemyPack, stage?.number)}</dd></div><div><dt>配置枠</dt><dd>{save.formationSlots.filter(Boolean).length} / 7</dd></div></dl>
          <button className="v100-primary" type="button" disabled={!stage || !save.availableStageIds.includes(stage.id)} onClick={() => stage && onStart(stage.id)}>{save.completedStageIds.includes(stage?.id ?? "") ? "再出撃" : "この作戦を編成"}</button>
          <div className="v100-map-briefs"><article><span>隊員</span><strong>{save.ownedUnitIds.length}名</strong><small>出撃編成</small></article><article><span>装甲車両</span><strong>装甲車両</strong><small>耐久 {save.vehicle.maxHp}</small></article><article><span>戦術支援</span><strong>{save.equippedSupportId ? "装備中" : "未選択"}</strong><small>出撃装備</small></article></div>
          <div className="v100-map-tools"><button type="button" onClick={onRename}>表示名を変更</button><button type="button" onClick={onBackup}>簡易バックアップ</button><label className="v100-file-button">復元<input type="file" accept="application/json" onChange={(event) => onImport(event.currentTarget.files?.[0])} /></label><button className="v100-utility-button" type="button" onClick={onOpenData}>データ管理</button></div>
          <div className="v100-replay-list"><span className="v100-kicker">会話記録</span>{save.readStoryEventIds.slice(-6).map((eventId) => <button type="button" key={eventId} onClick={() => onReplay(eventId)}>{eventDisplayLabel(eventId)}</button>)}</div>
        </aside>
      </div>
    </section>
  );
}

function FormationView({ save, stageId, onSlotChange, onStart }: { save: Save; stageId: string | null; onSlotChange: (slot: number, value: string) => void; onStart: () => void }) {
  const [activeSlot, setActiveSlot] = useState(0);
  const stage = stageId ? V100_STAGE_BY_ID[stageId] : null;
  const ownedUnits = save.ownedUnitIds.map((unitId) => UNIT_BY_ID.get(unitId)).filter(Boolean) as Array<(typeof V100_UNITS)[number]>;
  const activeUnitId = save.formationSlots[activeSlot] ?? null;
  const activeUnit = activeUnitId ? UNIT_BY_ID.get(activeUnitId) ?? null : null;
  const assignActiveSlot = (unitId: string) => onSlotChange(activeSlot, unitId);
  return <section className="v100-panel v100-formation-panel v100-sortie-panel" data-v100-surface="formation" style={{ "--v100-stage-art": `url(${stage ? stageVisualFor(stage.id) : PRODUCTION_VISUALS.command})` } as CSSProperties}>
    <div className="v100-panel-heading v100-sortie-heading"><div><span className="v100-kicker">{stage ? `作戦 S${String(stage.number).padStart(2, "0")} / 出撃準備` : "出撃準備 / 7枠"}</span><h2>出撃編成</h2>{stage && <p className="v100-formation-stage-name">{stageDisplayNameFor(stage)}</p>}</div><strong className="v100-sortie-count">{save.formationSlots.filter(Boolean).length} <small>/ 7 配置</small></strong></div>
    <div className="v100-formation-brief"><strong>今回の部隊</strong><span>枠を選び、隊員を配置</span><em>支援・装甲車両は出撃装備</em></div>
    <div className="v100-slot-rail" aria-label="7枠の編成"><div className="v100-slot-track">{save.formationSlots.map((unitId, index) => { const art = unitId ? formationCardForUnit(unitId) : null; const unit = unitId ? UNIT_BY_ID.get(unitId) : null; return <button type="button" key={`slot-${index}`} className={`v100-slot ${activeSlot === index ? "selected" : ""} ${unitId ? "filled" : "empty"}`} onClick={() => setActiveSlot(index)} aria-pressed={activeSlot === index} aria-label={`編成枠${index + 1}${unit ? ` ${unit.displayName}` : " 空き"}`}><span className="v100-slot-portrait">{art ? <img src={art} alt="" /> : <i aria-hidden="true">＋</i>}</span><span className="v100-slot-meta"><small>枠 {index + 1}</small><strong>{unit ? unit.displayName : "空席"}</strong><em>{unit ? v100RoleLabelFor(unit.role) : "隊員を選択"}</em></span></button>; })}</div></div>
    <div className="v100-formation-workspace"><div className="v100-roster-heading"><h3>隊員</h3><span>枠 {activeSlot + 1} に配置</span></div><div className="v100-formation-columns"><div className="v100-roster-grid">{ownedUnits.map((unit) => { const art = formationCardForUnit(unit.id); const level = Math.max(1, Number(save.unitLevels[unit.id]) || 1); return <button type="button" className={`v100-roster-card game-unit-card ${activeUnitId === unit.id ? "selected" : ""}`} key={unit.id} onClick={() => assignActiveSlot(unit.id)} aria-label={`${unit.displayName}を枠${activeSlot + 1}へ配置`}><span className="v100-roster-card-art">{art && <img src={art} alt="" />}</span><span className="v100-roster-card-copy"><strong>{unit.displayName}</strong><small>{v100RoleLabelFor(unit.role)} / Lv.{level}</small><small>武器・射程・固有能力</small></span></button>; })}</div><aside className="v100-formation-focus" aria-label="選択中の隊員">{activeUnit ? <><span className="v100-kicker">選択中 / 枠 {activeSlot + 1}</span><div className="v100-formation-focus-art">{formationCardForUnit(activeUnit.id) && <img src={formationCardForUnit(activeUnit.id) as string} alt="" />}</div><h3>{activeUnit.displayName}</h3><strong>{v100RoleLabelFor(activeUnit.role)}</strong><p>武器・射程・固有能力</p><button type="button" onClick={() => onSlotChange(activeSlot, activeUnit.id)}>この隊員を配置</button></> : <><span className="v100-kicker">枠 {activeSlot + 1}</span><div className="v100-empty-focus"><i aria-hidden="true">＋</i><span>隊員を選択</span></div></>}</aside></div><div className="v100-formation-loadout"><article><span>支援</span><strong>{save.equippedSupportId ? "装備中" : "未選択"}</strong><small>出撃装備で選択</small></article><article><span>装甲車両</span><strong>耐久 {save.vehicle.maxHp}</strong><small>戦場で操作</small></article></div></div>
    <div className="v100-formation-footer"><button type="button" onClick={() => onSlotChange(activeSlot, "")} disabled={!save.formationSlots[activeSlot]}>枠を空ける</button><button className="v100-primary" type="button" aria-label="戦闘へ" disabled={!save.formationSlots.some(Boolean)} onClick={onStart}>出撃</button></div>
  </section>;
}

function PersonnelView({ save, onBack, onPurchase }: { save: Save; onBack: () => void; onPurchase: (unitId: string) => void }) {
  const [selectedUnitId, setSelectedUnitId] = useState(() => save.ownedUnitIds[0] ?? V100_UNITS[0]?.id ?? "");
  const selectedUnit = UNIT_BY_ID.get(selectedUnitId) ?? V100_UNITS[0];
  const selectedOwned = Boolean(selectedUnit && save.ownedUnitIds.includes(selectedUnit.id));
  const selectedRegistered = Boolean(selectedUnit && save.registeredUnitIds.includes(selectedUnit.id));
  const selectedLevel = selectedUnit ? Math.max(1, Number(save.unitLevels[selectedUnit.id]) || 1) : 1;
  const selectedNextCost = selectedLevel < save.levelCap ? v100LevelCost(selectedLevel + 1) : 0;
  return <section className="v100-panel v100-management-panel v100-personnel-screen" data-v100-surface="personnel" aria-label="隊員">
    <div className="v100-panel-heading v100-management-heading"><div><span className="v100-kicker">作戦地図 / 隊員</span><h2>隊員</h2></div><button type="button" onClick={onBack}>作戦地図へ</button></div>
    <div className="v100-personnel-workspace"><div className="v100-personnel-roster"><div className="v100-roster-heading"><h3>隊員一覧</h3><span>{save.ownedUnitIds.length}名</span></div><div className="v100-personnel-grid">{V100_UNITS.map((unit) => {
      const owned = save.ownedUnitIds.includes(unit.id);
      const registered = save.registeredUnitIds.includes(unit.id);
      const art = formationCardForUnit(unit.id);
      return <button type="button" className={`v100-personnel-card game-unit-card ${selectedUnit?.id === unit.id ? "selected" : ""} ${owned ? "owned" : registered ? "registered" : "locked"}`} key={unit.id} onClick={() => setSelectedUnitId(unit.id)} aria-pressed={selectedUnit?.id === unit.id}>
        <div className="v100-personnel-art">{art && <img src={art} alt="" />}</div><div className="v100-personnel-copy"><h3>{unit.displayName}</h3><span>{v100RoleLabelFor(unit.role)}</span><small>{owned ? `Lv.${Math.max(1, Number(save.unitLevels[unit.id]) || 1)}` : registered ? "配備登録可" : "未解放"}</small></div>
      </button>;
    })}</div></div><aside className="v100-personnel-focus" aria-label="選択中の隊員">{selectedUnit && <><span className="v100-kicker">選択中の隊員</span><div className="v100-personnel-focus-art">{formationCardForUnit(selectedUnit.id) && <img src={formationCardForUnit(selectedUnit.id) as string} alt={`${selectedUnit.displayName}の立ち絵`} />}</div><div className="v100-personnel-focus-copy"><h3>{selectedUnit.displayName}</h3><strong>{v100RoleLabelFor(selectedUnit.role)}</strong><p>武器・射程・固有能力</p><dl><div><dt>状態</dt><dd>{selectedOwned ? "配備登録済" : selectedRegistered ? "配備登録可" : "未解放"}</dd></div><div><dt>レベル</dt><dd>{selectedOwned ? `Lv.${selectedLevel} / ${save.levelCap}` : "—"}</dd></div></dl>{selectedOwned ? <button type="button" className="v100-primary" disabled={selectedNextCost <= 0 || save.caps < selectedNextCost}>強化 {selectedNextCost > 0 ? `${selectedNextCost} CAPS` : "上限"}</button> : selectedRegistered ? <button type="button" className="v100-primary" onClick={() => onPurchase(selectedUnit.id)} disabled={save.caps < selectedUnit.registrationCostCaps}>配備登録 {selectedUnit.registrationCostCaps > 0 ? `${selectedUnit.registrationCostCaps} CAPS` : ""}</button> : <p className="v100-focus-lock">S{String(selectedUnit.availabilityStageNumber).padStart(2, "0")} クリアで解放</p>}</div></>}</aside></div>
  </section>;
}

function SupportVehicleView({ save, onBack, onPurchaseSupport, onEquipSupport, onUpgradeVehicle }: { save: Save; onBack: () => void; onPurchaseSupport: (supportId: string) => void; onEquipSupport: (supportId: string | null) => void; onUpgradeVehicle: () => void }) {
  const [vehicleUpgradeOpen, setVehicleUpgradeOpen] = useState(false);
  const vehicleLevel = save.vehicle.upgradeLevel;
  const nextCost = vehicleLevel < V100_VEHICLE.maxUpgradeLevel ? V100_VEHICLE.upgradeCosts[vehicleLevel] : 0;
  const nextHp = vehicleLevel < V100_VEHICLE.maxUpgradeLevel ? save.vehicle.maxHp + V100_VEHICLE.hpPerUpgrade : save.vehicle.maxHp;
  if (vehicleUpgradeOpen) return <section className="v100-panel v100-vehicle-upgrade-screen" data-v100-surface="vehicle-upgrade" aria-label="装甲車両強化">
    <div className="v100-panel-heading v100-management-heading"><div><span className="v100-kicker">出撃装備 / 装甲車両</span><h2>装甲車両を強化</h2></div><button type="button" onClick={() => setVehicleUpgradeOpen(false)}>出撃装備へ</button></div>
    <div className="v100-vehicle-upgrade-hero"><div className="v100-vehicle-upgrade-art"><img src={V099_CRAWLER_RUNTIME_PROFILE.equipmentHost.closed.path} alt="装甲車両" /></div><div className="v100-vehicle-upgrade-copy"><span className="v100-kicker">車体強化</span><h3>装甲車両</h3><p>損耗した車体を補修し、次の作戦へ備える。</p><dl><div><dt>現在Lv</dt><dd>{vehicleLevel}</dd></div><div><dt>現在耐久</dt><dd>{save.vehicle.maxHp}</dd></div><div><dt>強化後</dt><dd>{vehicleLevel >= V100_VEHICLE.maxUpgradeLevel ? "強化上限" : nextHp}</dd></div><div><dt>必要CAPS</dt><dd>{nextCost > 0 ? nextCost : "—"}</dd></div></dl><button className="v100-primary" type="button" onClick={onUpgradeVehicle} disabled={vehicleLevel >= V100_VEHICLE.maxUpgradeLevel || save.caps < nextCost}>{vehicleLevel >= V100_VEHICLE.maxUpgradeLevel ? "強化上限" : `HPを強化 / ${nextCost} CAPS`}</button></div></div>
  </section>;
  return <section className="v100-panel v100-management-panel v100-loadout-screen" data-v100-surface="support-vehicle" aria-label="出撃装備">
    <div className="v100-panel-heading v100-management-heading"><div><span className="v100-kicker">作戦地図 / 出撃装備</span><h2>出撃装備</h2></div><button type="button" onClick={onBack}>作戦地図へ</button></div>
    <div className="v100-management-hero v100-loadout-hero"><div><strong>持ち込む支援を選ぶ</strong><span>支援は1種まで装備可能</span></div><b>{save.equippedSupportId ? "装備中" : "未選択"}</b></div>
    <div className="v100-support-vehicle-grid">
      <section className="v100-support-section v100-loadout-column" aria-labelledby="v100-support-title"><div className="v100-section-heading"><div><span className="v100-kicker">戦術支援</span><h3 id="v100-support-title">支援</h3></div><span>{save.equippedSupportId ? "装備中" : "未選択"}</span></div><p className="v100-loadout-intro">戦場で使う支援をひとつ選択</p><div className="v100-support-management-list">{V100_SUPPORTS.map((support) => {
        const owned = save.ownedSupportIds.includes(support.id);
        const unlocked = save.supportPurchaseUnlockedIds.includes(support.id);
        const selected = save.equippedSupportId === support.id;
        return <article className={`v100-support-management-card game-loadout-card ${selected ? "selected" : ""} ${!unlocked ? "locked" : ""}`} key={support.id}><span className={`v100-support-art support-art-${support.id}`} aria-hidden="true" /><div className="v100-loadout-card-copy"><span className="v100-kicker">再使用 {support.cooldownSeconds}秒</span><h4>{support.displayName}</h4><p>必要 {support.battleCost} CAPS</p></div>{owned ? <button type="button" className={selected ? "selected" : ""} onClick={() => onEquipSupport(selected ? null : support.id)}>{selected ? "装備中" : "装備"}</button> : unlocked ? <button type="button" onClick={() => onPurchaseSupport(support.id)} disabled={save.caps < support.unlockCostCaps}>{support.unlockCostCaps} CAPSで取得</button> : <span className="v100-state-badge locked">S{String(support.unlockStageNumber).padStart(2, "0")}で解放</span>}</article>;
      })}</div></section>
      <section className="v100-vehicle-section v100-loadout-column" aria-labelledby="v100-vehicle-title"><div className="v100-section-heading"><div><span className="v100-kicker">装甲車両</span><h3 id="v100-vehicle-title">{V100_VEHICLE.displayName}</h3></div><span>Lv.{vehicleLevel} / {V100_VEHICLE.maxUpgradeLevel}</span></div><div className="v100-vehicle-art"><img src={V099_CRAWLER_RUNTIME_PROFILE.equipmentHost.closed.path} alt="装甲車両" /></div><div className="v100-vehicle-readout"><strong>{save.vehicle.maxHp}</strong><span>/ {save.vehicle.maxHp} 耐久</span></div><dl className="v100-vehicle-stats"><div><dt>次の強化</dt><dd>{vehicleLevel >= V100_VEHICLE.maxUpgradeLevel ? "強化上限" : `${save.vehicle.maxHp} → ${nextHp}`}</dd></div><div><dt>必要CAPS</dt><dd>{nextCost > 0 ? nextCost : "—"}</dd></div></dl><button className="v100-primary" type="button" onClick={() => setVehicleUpgradeOpen(true)}>装甲車両を強化</button><div className="v100-vehicle-abilities"><span className="v100-kicker">戦場で使用可能</span>{V100_VEHICLE.abilities.map((ability) => <div key={ability.id}><strong>{ability.displayName}</strong><small>必要 {ability.battleCost} / 再使用 {ability.cooldownSeconds}秒</small></div>)}</div></section>
    </div>
  </section>;
}

function DataManagementView({ save, onBack, onBackup, onImport }: { save: Save; onBack: () => void; onBackup: () => void; onImport: (file: File | undefined) => void }) {
  return <div className="v100-modal-backdrop" data-v100-surface="data" role="presentation"><section className="v100-modal v100-data-modal" role="dialog" aria-modal="true" aria-labelledby="v100-data-title"><div className="v100-panel-heading"><div><span className="v100-kicker">作戦記録</span><h2 id="v100-data-title">データ管理</h2></div><button type="button" onClick={onBack}>閉じる</button></div><p>現在の進行はブラウザ内の作戦セーブへ保存されています。書き出し・復元は検証済みの形式だけを受け付けます。</p><dl className="v100-data-summary"><div><dt>主人公</dt><dd>{save.playerName}</dd></div><div><dt>到達作戦</dt><dd>{save.completedStageIds.length} / {V100_STAGES.length}</dd></div><div><dt>保存状態</dt><dd>保管済み</dd></div><div><dt>最終更新</dt><dd>{new Date(save.updatedAt).toLocaleString("ja-JP")}</dd></div></dl><div className="v100-data-actions"><button className="v100-primary" type="button" onClick={onBackup}>セーブを書き出す</button><label className="v100-file-button">セーブを復元<input type="file" accept="application/json" onChange={(event) => onImport(event.currentTarget.files?.[0])} /></label></div><small className="v100-data-note">復元に失敗した場合、現在のセーブは変更されません。</small></section></div>;
}

function ResultView({ result, firstClear, onContinue, onRetry, onMap }: { result: Record<string, unknown> | null; firstClear: boolean; onContinue: () => void; onRetry: () => void; onMap: () => void }) {
  const won = result?.won === true;
  const stageNumber = Number(result?.stageNumber) || 0;
  const nextStage = V100_STAGES[stageNumber];
  const rewardCaps = won ? Number(result?.rewardCaps ?? 0) || (firstClear ? 80 + stageNumber * 10 : Math.max(20, Math.round((80 + stageNumber * 10) * .2 / 5) * 5)) : 0;
  const unlocks = firstClear ? (V100_STAGE_BY_ID[String(result?.stageId)]?.firstClearPayload ?? []).map((item) => item.startsWith("unit-") ? UNIT_BY_ID.get(item)?.displayName ?? item : item.startsWith("support-") ? V100_SUPPORTS.find((support) => support.id === item)?.displayName ?? item : item.startsWith("level-cap-") ? `Lv.${item.slice(10)}上限` : item) : [];
  return <section className={`v100-panel v100-result-panel ${won ? "win" : "lose"}`} data-v100-surface={won ? "result-win" : "result-lose"} aria-label="作戦結果"><span className="v100-kicker">作戦結果 / {won ? "成功" : "失敗"}</span><h2>{won ? "作戦成功" : "作戦失敗"}</h2><p>{won ? `装甲車両は作戦区域を離脱。S${String(stageNumber).padStart(2, "0")}の記録を確定します。` : "防衛線を立て直し、編成を整えて再挑戦できます。"}</p><div className="v100-result-highlight"><strong>{won ? `★${String(result?.stars ?? 0)}` : "—"}</strong><span>{won ? "作戦評価" : "再編成可能"}</span></div><dl className="v100-result-records"><div><dt>車両耐久</dt><dd>{String(result?.vehicleHp ?? 0)} / {String(result?.vehicleMaxHp ?? 0)}</dd></div><div><dt>作戦目標</dt><dd>{result?.objectiveComplete === true ? "達成" : "未達"}</dd></div><div><dt>経過時間</dt><dd>{Math.round(Number(result?.elapsedSeconds) || 0)}秒</dd></div><div><dt>損耗</dt><dd>{Number(result?.unitDeaths) || 0}名</dd></div></dl>{won && <div className="v100-result-rewards"><article><span>獲得CAPS</span><strong>+{rewardCaps}</strong></article><article><span>{firstClear ? "初回解放" : "追加記録"}</span><strong>{unlocks.length > 0 ? unlocks.join(" / ") : "なし"}</strong></article></div>}<div className="v100-result-actions"><button className="v100-primary" type="button" onClick={won ? onContinue : onRetry}>{won ? "次の場面へ" : "編成へ戻る"}</button>{!won && <button type="button" onClick={onRetry}>再挑戦する</button>}<button type="button" onClick={onMap}>作戦地図へ</button>{won && nextStage && <button type="button" onClick={onMap}>{`次の作戦 S${String(nextStage.number).padStart(2, "0")}`}</button>}</div></section>;
}

function EventLogView({ save, onReplay, onClose }: { save: Save; onReplay: (eventId: string) => void; onClose: () => void }) {
  return <div className="v100-modal-backdrop"><section className="v100-modal v100-log-modal" role="dialog" aria-modal="true" aria-label="会話記録"><div className="v100-panel-heading"><div><span className="v100-kicker">会話記録</span><h2>{save.readStoryEventIds.length}件を読了</h2></div><button type="button" onClick={onClose}>閉じる</button></div><div className="v100-log-list">{save.readStoryEventIds.map((eventId) => <button type="button" key={eventId} onClick={() => { onReplay(eventId); onClose(); }}>{eventDisplayLabel(eventId)}</button>)}</div></section></div>;
}

function ReplayView({ event, node, index, onNext, onClose }: { event: ReturnType<typeof v100StoryEventView>; node: StoryNode | null; index: number; onNext: () => void; onClose: () => void }) {
  if (!event) return null;
  const hasNext = index < event.nodes.length - 1;
  return <div className="v100-modal-backdrop"><section className="v100-modal" role="dialog" aria-modal="true" aria-label="会話記録"><div className="v100-event-heading"><span className="v100-kicker">会話記録 / {eventDisplayLabel(event.id)}</span><button type="button" onClick={onClose}>閉じる</button></div>{node ? <StoryNodeView node={node} eventId={event.id} phase={eventPhaseForId(event.id)} nodeIndex={index} /> : <p>この会話には表示する場面がありません。</p>}<button className="v100-primary" type="button" onClick={hasNext ? onNext : onClose}>{hasNext ? "次へ" : "記録を閉じる"}</button></section></div>;
}
