"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

import {
  V100_STAGE_BY_ID,
  V100_STAGE_IDS,
  V100_STAGES,
  V100_UNITS,
  normalizeV100PlayerName,
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
  finalizeV100PendingResult,
  recordV100PendingResult,
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
import { AshfallGame, type AshfallBattleResult } from "./AshfallGame";
import { v100StageRuntimeFor } from "./v100StageRuntime.js";
import { V100_RUNTIME_ASSET_MANIFEST } from "./v100RuntimeAssetManifest.js";
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
    "stage-locked": "前のStageを先に完了してください。",
    "objective-incomplete": "ミッション目標が未完了です。",
    "vehicle-destroyed": "装甲車両が破壊されています。",
    "formation-full": "出撃中の7体上限に達しています。",
    "unit-not-owned": "未所有のunitです。",
    "insufficient-battle-resource": "出撃資源が不足しています。",
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

const MISSION_LABELS: Record<string, string> = {
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
  "D+panther-knife/smg": "RED PANTHER先遣隊",
  "D+panther-shield/smg": "RED PANTHER防衛隊",
  "D+panther-smg/commander": "RED PANTHER指揮隊",
  "D+panther-shield/smg/commander": "RED PANTHER制圧隊",
  P: "RED PANTHER本隊",
  "A-add-waves": "追加波状感染群",
};

function missionLabelFor(value: string | undefined) {
  return MISSION_LABELS[value ?? ""] ?? "キャンペーン作戦";
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
    return `${stage?.displayName ?? `Stage ${match[1]}`} / ${suffix}`;
  }
  if (eventId === "v100:event:ending") return "最終章";
  if (eventId === "v100:event:credits") return "クレジット";
  if (eventId === "v100:event:epilogue") return "エピローグ";
  return "記録済みイベント";
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
    return normalized;
  }, [commitSave, save]);

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
    <main className="v100-shell" data-v100-phase={flow.phase} data-v100-stage={flow.stageNumber ?? "map"}>
      <header className="v100-topbar">
        <div><span className="v100-kicker">西新世紀末物語 / LUNA RUNTIME</span><h1>Version 1.0.0</h1></div>
        <div className="v100-save-meta"><span>{save.caps} CAPS</span><span>REV {save.revision}</span><button type="button" onClick={() => setLogOpen((open) => !open)}>EVENT LOG</button></div>
      </header>

      {notice && <p className="v100-notice" role="status">{notice}</p>}

      {flow.phase === "name" && (
        <section className="v100-panel v100-name-panel" aria-labelledby="v100-name-title">
          <span className="v100-kicker">PROLOGUE ENTRY</span>
          <h2 id="v100-name-title">物語を始める</h2>
          <p>この記録はVersion 1.0.0の新しいキャンペーンです。既存の進行、所有unit、CAPS、既読、receiptは引き継ぎません。</p>
          <form onSubmit={startCampaign}>
            <label htmlFor="v100-player-name">主人公の名前</label>
            <input id="v100-player-name" value={nameInput} onChange={(event) => setNameInput(event.currentTarget.value)} maxLength={24} autoComplete="nickname" />
            {nameError && <small className="v100-error" role="alert">{nameError}</small>}
            <button className="v100-primary" type="submit">物語を始める</button>
          </form>
        </section>
      )}

      {isEventPhase(flow.phase) && event && (
        <section className="v100-event-layout" aria-label={`${eventDisplayLabel(flow.eventId)}イベント`}>
          <div className="v100-event-backdrop" style={{ backgroundImage: `url(${runtime?.backgroundPath ?? "/art/v060/title-key-visual-v1.webp"})` }} />
          <article className="v100-event-panel">
            <div className="v100-event-heading"><span className="v100-kicker">{eventDisplayLabel(flow.eventId)}</span><span>{event.nodes.length ? `${Math.min(storyIndex + 1, event.nodes.length)} / ${event.nodes.length}` : "ACTION"}</span></div>
            {currentNode ? <StoryNodeView node={currentNode} /> : <p className="v100-action-node">このイベントを確認して次へ進みます。</p>}
            <div className="v100-event-actions">
              <button type="button" className="v100-primary" onClick={() => markAndAdvanceEvent(false)}>{storyIndex < event.nodes.length - 1 ? "次へ" : flow.phase === "ending" ? "ENDINGを閉じる" : "続ける"}</button>
              {flow.canSkip && <button type="button" onClick={() => markAndAdvanceEvent(true)}>スキップ</button>}
            </div>
          </article>
        </section>
      )}

      {flow.phase === "map" && (
        <MapView
          save={save}
          selectedStageId={selectedStageId}
          onSelect={setSelectedStageId}
          onStart={startStage}
          onRename={rename}
          onBackup={downloadBackup}
          onImport={importBackup}
          onReplay={(eventId) => { setReplayEventId(eventId); setReplayNodeIndex(0); }}
        />
      )}

      {flow.phase === "formation" && (
        <FormationView save={save} onSlotChange={chooseFormation} onStart={startBattle} />
      )}

      {flow.phase === "battle" && productionSession && (
        <AshfallGame externalSession={productionSession} />
      )}

      {flow.phase === "result" && (
        <ResultView result={flow.pendingResult} onContinue={continueFromResult} />
      )}

      {logOpen && <EventLogView save={save} onReplay={(eventId) => { setReplayEventId(eventId); setReplayNodeIndex(0); }} onClose={() => setLogOpen(false)} />}
      {replayEvent && <ReplayView event={replayEvent} node={replayNode} index={replayNodeIndex} onNext={() => setReplayNodeIndex((index) => index + 1)} onClose={() => setReplayEventId(null)} />}
      {giftPopup && <div className="v100-modal-backdrop"><section className="v100-modal" role="dialog" aria-modal="true" aria-labelledby="v100-gift-title"><span className="v100-kicker">LEGACY ENTITLEMENT</span><h2 id="v100-gift-title">新しいキャンペーンを開始しました</h2><p>旧キャンペーンの利用資格を確認したため、Version 1.0.0の新しい記録へ180 CAPSを一度だけ付与しました。旧データは変更していません。</p><button className="v100-primary" type="button" onClick={acknowledgeGift}>確認する</button></section></div>}
    </main>
  );
}

function StoryNodeView({ node }: { node: StoryNode }) {
  const portrait = portraitFor(node.portraitOwner);
  return <div className={`v100-story-node v100-node-${node.kind ?? "action"}`}>
    {portrait && <img className="v100-portrait" src={portrait} alt={`${node.speaker ?? "登場人物"}のportrait`} />}
    <div className="v100-node-copy"><span className="v100-node-kind">{node.kind === "dialogue" ? node.speaker ?? "通信" : node.kind === "system" ? "SYSTEM" : "ACTION"}</span><p>{node.text || "…"}</p></div>
  </div>;
}

function MapView({ save, selectedStageId, onSelect, onStart, onRename, onBackup, onImport, onReplay }: { save: Save; selectedStageId: string; onSelect: (id: string) => void; onStart: (id: string) => void; onRename: () => void; onBackup: () => void; onImport: (file: File | undefined) => void; onReplay: (eventId: string) => void }) {
  const stage = V100_STAGE_BY_ID[selectedStageId];
  const runtime = v100StageRuntimeFor(selectedStageId);
  const completedNumber = Math.max(0, ...save.completedStageIds.map(stageNumberFor));
  return <section className="v100-map-layout" aria-label="V1.0.0 campaign map">
    <div className="v100-map-hero" style={{ backgroundImage: `url(${runtime?.backgroundPath ?? "/art/v060/campaign-operations-room-v1.webp"})` }}>
      <div><span className="v100-kicker">CAMPAIGN MAP / {save.postGameAvailable ? "POSTGAME" : `STAGE ${completedNumber + 1}`}</span><h2>{stage?.displayName ?? "キャンペーンマップ"}</h2><p>{objectiveLabelFor(stage)}</p></div>
    </div>
    <div className="v100-map-grid"><nav className="v100-stage-list" aria-label="Stage list">{V100_STAGES.map((entry) => {
      const available = save.availableStageIds.includes(entry.id);
      const completed = save.completedStageIds.includes(entry.id);
      return <button type="button" key={entry.id} className={`${selectedStageId === entry.id ? "selected" : ""} ${completed ? "completed" : ""}`} disabled={!available} onClick={() => onSelect(entry.id)}><span>S{String(entry.number).padStart(2, "0")}</span><strong>{entry.displayName}</strong><small>{completed ? `★${save.bestStars[entry.id] ?? 0}` : available ? missionLabelFor(entry.missionType) : "LOCKED"}</small></button>;
    })}</nav><aside className="v100-map-side"><span className="v100-kicker">{stage ? `S${String(stage.number).padStart(2, "0")}` : "MAP"}</span><h3>{stage?.displayName}</h3><dl><div><dt>MISSION</dt><dd>{missionLabelFor(stage?.missionType)}</dd></div><div><dt>ENEMY PACK</dt><dd>{enemyPackLabelFor(stage?.enemyPack)}</dd></div><div><dt>OBJECTIVE</dt><dd>{objectiveLabelFor(stage)}</dd></div><div><dt>CAPS</dt><dd>{save.caps}</dd></div></dl><button className="v100-primary" type="button" disabled={!stage || !save.availableStageIds.includes(stage.id)} onClick={() => stage && onStart(stage.id)}>{save.completedStageIds.includes(stage?.id ?? "") ? "再出撃" : "出撃"}</button><div className="v100-map-tools"><button type="button" onClick={onRename}>名前を変更</button><button type="button" onClick={onBackup}>バックアップ</button><label className="v100-file-button">復元<input type="file" accept="application/json" onChange={(event) => onImport(event.currentTarget.files?.[0])} /></label></div><div className="v100-replay-list"><span className="v100-kicker">READ EVENT REPLAY</span>{save.readStoryEventIds.slice(-6).map((eventId) => <button type="button" key={eventId} onClick={() => onReplay(eventId)}>{eventDisplayLabel(eventId)}</button>)}</div></aside></div>
  </section>;
}

function FormationView({ save, onSlotChange, onStart }: { save: Save; onSlotChange: (slot: number, value: string) => void; onStart: () => void }) {
  return <section className="v100-panel v100-formation-panel"><div className="v100-panel-heading"><div><span className="v100-kicker">FORMATION / 7 ORDERED SLOTS</span><h2>出撃編成</h2></div><span>{save.formationSlots.filter(Boolean).length} / 7</span></div><div className="v100-formation-grid">{save.formationSlots.map((unitId, index) => <label className="v100-slot" key={`slot-${index}`}><span>SLOT {index + 1}</span><select value={unitId ?? ""} onChange={(event) => onSlotChange(index, event.currentTarget.value)} aria-label={`編成スロット${index + 1}`}><option value="">空き</option>{save.ownedUnitIds.map((ownedId) => <option key={ownedId} value={ownedId}>{activeUnitName(ownedId)}</option>)}</select></label>)}</div><p>同じユニットを複数スロットへ配置できます。出撃中の個体は最大7体で管理し、装甲車両・支援・作戦目標は編成枠に含みません。</p><button className="v100-primary" type="button" disabled={!save.formationSlots.some(Boolean)} onClick={onStart}>戦闘へ</button></section>;
}

function ResultView({ result, onContinue }: { result: Record<string, unknown> | null; onContinue: () => void }) {
  const won = result?.won === true;
  return <section className="v100-panel v100-result-panel"><span className="v100-kicker">BATTLE RESULT</span><h2>{won ? "MISSION CLEAR" : "DEFEAT"}</h2><p>{won ? `装甲車両 ${String(result?.vehicleHp ?? 0)} / ${String(result?.vehicleMaxHp ?? 0)}。post eventと保存済みpending resultを確認してください。` : "敗北時はpost、報酬、unlock、boss receiptへ進みません。"}</p>{won && <dl><div><dt>STARS</dt><dd>{String(result?.stars ?? 0)}</dd></div><div><dt>OBJECTIVE</dt><dd>{String(result?.objectiveComplete ?? false)}</dd></div></dl>}<button className="v100-primary" type="button" onClick={onContinue}>{won ? "POST EVENTへ" : "編成へ戻る"}</button></section>;
}

function EventLogView({ save, onReplay, onClose }: { save: Save; onReplay: (eventId: string) => void; onClose: () => void }) {
  return <div className="v100-modal-backdrop"><section className="v100-modal v100-log-modal" role="dialog" aria-modal="true" aria-label="Event log"><div className="v100-panel-heading"><div><span className="v100-kicker">EVENT LOG</span><h2>{save.readStoryEventIds.length} read events</h2></div><button type="button" onClick={onClose}>閉じる</button></div><div className="v100-log-list">{save.readStoryEventIds.map((eventId) => <button type="button" key={eventId} onClick={() => { onReplay(eventId); onClose(); }}>{eventDisplayLabel(eventId)}</button>)}</div></section></div>;
}

function ReplayView({ event, node, index, onNext, onClose }: { event: ReturnType<typeof v100StoryEventView>; node: StoryNode | null; index: number; onNext: () => void; onClose: () => void }) {
  if (!event) return null;
  const hasNext = index < event.nodes.length - 1;
  return <div className="v100-modal-backdrop"><section className="v100-modal" role="dialog" aria-modal="true" aria-label="Event replay"><div className="v100-event-heading"><span className="v100-kicker">REPLAY / {eventDisplayLabel(event.id)}</span><button type="button" onClick={onClose}>閉じる</button></div>{node ? <StoryNodeView node={node} /> : <p>このイベントには表示ノードがありません。</p>}<button className="v100-primary" type="button" onClick={hasNext ? onNext : onClose}>{hasNext ? "次へ" : "リプレイ終了"}</button></section></div>;
}
