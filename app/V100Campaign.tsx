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
  setV100EventCursor,
  updateV100PlayerName,
} from "./v100Save.js";
import {
  createV100BattleState,
  createV100BattleResult,
  finalizeV100PendingResult,
  recordV100PendingResult,
  reserveV100FormationSlot,
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
} from "./v100StoryFlow.js";
import { v100StoryEventView } from "./v100StoryEvents.js";
import { advanceV100StageBattle, createV100StageBattle, v100StageBattleResult } from "./v100BattleRuntime.js";
import { V100_SPRITE_MANIFEST } from "./spriteManifest.js";
import { v100StageRuntimeFor } from "./v100StageRuntime.js";
import {
  exportV100BrowserSave,
  importV100BrowserSave,
  persistV100BrowserSave,
  readV100BrowserSave,
} from "./v100CampaignStorage.js";
import { EVENT_PORTRAIT_PROFILES, V075_VISUAL_PROFILES, V080_UNIT_VISUAL_PROFILES, V090_UNIT_VISUAL_PROFILES } from "./visualProfiles.js";
import "./v100Campaign.css";

type Save = ReturnType<typeof createDefaultV100Save>;
type Flow = ReturnType<typeof createV100StoryFlowState>;
type Battle = ReturnType<typeof createV100StageBattle> extends { state: infer State } ? State : never;
type BattleState = ReturnType<typeof createV100BattleState>;
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
  segawa: "/art/v100/characters/segawa-event-portrait-v1.webp",
  "mugarian-president": "/art/v100/characters/mugarian-president-event-portrait-v1.webp",
  "red-panther-commander": "/art/v100/enemies/red-panther-commander-event-portrait-v1.webp",
  "minor-human-shared-event-silhouette": "/art/v100/portraits/minor-human-shared-event-silhouette-v1.webp",
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

export function V100Campaign() {
  const [save, setSave] = useState<Save>(() => createDefaultV100Save());
  const [flow, setFlow] = useState<Flow>(() => createV100StoryFlowState());
  const [battle, setBattle] = useState<Battle | null>(null);
  const [battleState, setBattleState] = useState<BattleState>(() => createV100BattleState());
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

  const commitSave = useCallback((nextSave: Save) => {
    const normalized = persistV100BrowserSave(nextSave).save;
    setSave(normalized);
    return normalized;
  }, []);

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
    setFlow(createV100StoryFlowState({
      playerName: nextSave.campaignStarted ? nextSave.playerName : "",
      completedStageIds: nextSave.completedStageIds,
      readStoryEventIds: nextSave.readStoryEventIds,
    }));
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated || flow.phase !== "map" || !save.legacy.eligible || save.legacy.entitlementClaimed) return;
    const result = claimV100LegacyGift(save, { legacyCandidate: readV100BrowserSave().rawLegacy });
    if (result.applied) {
      // The entitlement transaction is deliberately performed only after the
      // safe map screen is mounted.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      commitSave(result.save);
      setGiftPopup(true);
    }
  }, [commitSave, flow.phase, hydrated, save]);

  const event = useMemo(() => flow.eventId ? v100StoryEventView(flow.eventId, save.playerName) : null, [flow.eventId, save.playerName]);
  const currentNode = (event?.nodes?.[storyIndex] ?? null) as StoryNode | null;
  const runtime = v100StageRuntimeFor(selectedStageId);
  const replayEvent = useMemo(() => replayEventId ? v100StoryEventView(replayEventId, save.playerName) : null, [replayEventId, save.playerName]);
  const replayNode = (replayEvent?.nodes?.[replayNodeIndex] ?? null) as StoryNode | null;

  const updateFlow = useCallback((next: Flow) => {
    setFlow(next);
    setStoryIndex(0);
  }, []);

  const startCampaign = (eventSubmit: FormEvent<HTMLFormElement>) => {
    eventSubmit.preventDefault();
    const validated = normalizeV100PlayerName(nameInput);
    if (!validated.ok) {
      setNameError(validated.reason === "too-long" ? "1〜12文字で入力してください。" : "使用できない名前です。");
      return;
    }
    const nextSave = updateV100PlayerName(save, validated.value).save;
    const started = applyV100SaveMutation(nextSave, (draft) => ({ ...draft, campaignStarted: true })).save;
    commitSave(started);
    const nextFlow = createV100StoryFlowState({ playerName: validated.value, completedStageIds: [], readStoryEventIds: [] });
    updateFlow(nextFlow);
    setNameError("");
  };

  const markAndAdvanceEvent = (skipped = false) => {
    if (!flow.eventId || !event) return;
    let workingSave = save;
    const lastNode = storyIndex >= event.nodes.length - 1;
    if (!lastNode && !skipped) {
      const cursor = setV100EventCursor(workingSave, {
        eventId: flow.eventId,
        phase: flow.phase,
        nodeIndex: storyIndex + 1,
        nodeKey: `${flow.eventId}:${storyIndex + 1}`,
      });
      workingSave = cursor.save;
      commitSave(workingSave);
      setStoryIndex((index) => index + 1);
      return;
    }
    const marked = markV100EventRead(workingSave, flow.eventId).save;
    workingSave = marked;
    if (flow.phase === "post") {
      const finalized = finalizeV100PendingResult(workingSave);
      if (finalized.applied) workingSave = finalized.save;
    }
    commitSave(workingSave);
    const markedFlow = markV100FlowEventRead(flow, flow.eventId);
    const transition = completeV100Event(markedFlow, { skipped });
    if (!transition.accepted) {
      setNotice(formatReason(transition.reason));
      return;
    }
    updateFlow(transition.state);
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
    const created = createV100StageBattle({ stageId: flow.stageId ?? selectedStageId, vehicleMaxHp: save.vehicle.maxHp });
    if (!created.ok) {
      setNotice(formatReason(created.reason));
      return;
    }
    setBattle(created.state as Battle);
    setBattleState(createV100BattleState({ resource: 150 }));
    updateFlow(entered.state);
  };

  const deploy = (unitId: string) => {
    const result = reserveV100FormationSlot(save, battleState, {
      unitId,
      cost: 0,
      reservationId: `v100:ui-deploy:${unitId}:${battleState.activeReservations.length}`,
      now: battleState.now,
    });
    if (!result.accepted) {
      setNotice(formatReason(result.reason));
      return;
    }
    setBattleState(result.battleState);
    setNotice(`${activeUnitName(unitId)}を出撃させました。`);
  };

  const battleAction = (type: string, extra: Record<string, number> = {}) => {
    if (!battle) return;
    const advanced = advanceV100StageBattle(battle, { type, ...extra });
    if (!advanced.accepted) {
      setNotice(formatReason(advanced.reason));
      return;
    }
    setBattle(advanced.state as Battle);
    setNotice("");
  };

  const finishBattle = (won: boolean) => {
    if (!battle) return;
    const raw = v100StageBattleResult(battle);
    if (!raw) return;
    const result = createV100BattleResult({
      ...raw,
      battleRunId: `v100:ui:${battle.stageNumber}:${Date.now()}`,
      won,
      objectiveComplete: won ? raw.objectiveComplete : false,
    });
    const transition = finishV100Battle(flow, result);
    if (!transition.accepted) {
      setNotice(formatReason(transition.reason));
      return;
    }
    if (won) {
      const pending = recordV100PendingResult(save, result);
      if (!pending.applied) {
        setNotice(formatReason(pending.reason));
        return;
      }
      commitSave(pending.save);
    }
    updateFlow(transition.state);
  };

  const continueFromResult = () => {
    if (flow.pendingResult?.won !== true) {
      const retry = defeatV100Flow(flow);
      if (retry.accepted) {
        setBattle(null);
        updateFlow(retry.state);
      }
      return;
    }
    const next = enterV100PostResult(flow);
    if (next.accepted) updateFlow(next.state);
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
      commitSave(result.save);
      setFlow(createV100StoryFlowState({ playerName: result.save.playerName, completedStageIds: result.save.completedStageIds, readStoryEventIds: result.save.readStoryEventIds }));
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
        <section className="v100-event-layout" aria-label={`${flow.destination} event`}>
          <div className="v100-event-backdrop" style={{ backgroundImage: `url(${runtime?.backgroundPath ?? "/art/v060/title-key-visual-v1.webp"})` }} />
          <article className="v100-event-panel">
            <div className="v100-event-heading"><span className="v100-kicker">{flow.eventId}</span><span>{event.nodes.length ? `${Math.min(storyIndex + 1, event.nodes.length)} / ${event.nodes.length}` : "ACTION"}</span></div>
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

      {flow.phase === "battle" && battle && (
        <BattleView battle={battle} battleState={battleState} ownedUnitIds={save.ownedUnitIds} runtime={runtime} onDeploy={deploy} onAction={battleAction} onFinish={finishBattle} />
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
      <div><span className="v100-kicker">CAMPAIGN MAP / {save.postGameAvailable ? "POSTGAME" : `STAGE ${completedNumber + 1}`}</span><h2>{stage?.displayName ?? "キャンペーンマップ"}</h2><p>{stage?.objectiveId}</p></div>
    </div>
    <div className="v100-map-grid"><nav className="v100-stage-list" aria-label="Stage list">{V100_STAGES.map((entry) => {
      const available = save.availableStageIds.includes(entry.id);
      const completed = save.completedStageIds.includes(entry.id);
      return <button type="button" key={entry.id} className={`${selectedStageId === entry.id ? "selected" : ""} ${completed ? "completed" : ""}`} disabled={!available} onClick={() => onSelect(entry.id)}><span>S{String(entry.number).padStart(2, "0")}</span><strong>{entry.displayName}</strong><small>{completed ? `★${save.bestStars[entry.id] ?? 0}` : available ? entry.missionType : "LOCKED"}</small></button>;
    })}</nav><aside className="v100-map-side"><span className="v100-kicker">{stage ? `S${String(stage.number).padStart(2, "0")}` : "MAP"}</span><h3>{stage?.displayName}</h3><dl><div><dt>MISSION</dt><dd>{stage?.missionType}</dd></div><div><dt>ENEMY PACK</dt><dd>{stage?.enemyPack}</dd></div><div><dt>OBJECTIVE</dt><dd>{stage?.objectiveId}</dd></div><div><dt>CAPS</dt><dd>{save.caps}</dd></div></dl><button className="v100-primary" type="button" disabled={!stage || !save.availableStageIds.includes(stage.id)} onClick={() => stage && onStart(stage.id)}>{save.completedStageIds.includes(stage?.id ?? "") ? "再出撃" : "出撃"}</button><div className="v100-map-tools"><button type="button" onClick={onRename}>名前を変更</button><button type="button" onClick={onBackup}>バックアップ</button><label className="v100-file-button">復元<input type="file" accept="application/json" onChange={(event) => onImport(event.currentTarget.files?.[0])} /></label></div><div className="v100-replay-list"><span className="v100-kicker">READ EVENT REPLAY</span>{save.readStoryEventIds.slice(-6).map((eventId) => <button type="button" key={eventId} onClick={() => onReplay(eventId)}>{eventId}</button>)}</div></aside></div>
  </section>;
}

function FormationView({ save, onSlotChange, onStart }: { save: Save; onSlotChange: (slot: number, value: string) => void; onStart: () => void }) {
  return <section className="v100-panel v100-formation-panel"><div className="v100-panel-heading"><div><span className="v100-kicker">FORMATION / 7 ORDERED SLOTS</span><h2>出撃編成</h2></div><span>{save.formationSlots.filter(Boolean).length} / 7</span></div><div className="v100-formation-grid">{save.formationSlots.map((unitId, index) => <label className="v100-slot" key={`slot-${index}`}><span>SLOT {index + 1}</span><select value={unitId ?? ""} onChange={(event) => onSlotChange(index, event.currentTarget.value)} aria-label={`編成スロット${index + 1}`}>{index === 0 && <option value="">空き</option>}{index !== 0 && <option value="">空き</option>}{save.ownedUnitIds.map((ownedId) => <option key={ownedId} value={ownedId}>{activeUnitName(ownedId)}</option>)}</select></label>)}</div><p>同じcharacter IDを複数slotへ配置できます。出撃中のplayer instanceは7体で固定し、装甲車両・support・mission objectは含みません。</p><button className="v100-primary" type="button" disabled={!save.formationSlots.some(Boolean)} onClick={onStart}>戦闘へ</button></section>;
}

function BattleView({ battle, battleState, ownedUnitIds, runtime, onDeploy, onAction, onFinish }: { battle: Battle; battleState: BattleState; ownedUnitIds: string[]; runtime: ReturnType<typeof v100StageRuntimeFor>; onDeploy: (unitId: string) => void; onAction: (type: string, extra?: Record<string, number>) => void; onFinish: (won: boolean) => void }) {
  const boss = battle.boss;
  const canFinish = battle.objectiveComplete && battle.vehicleHp > 0;
  return <section className="v100-battle-layout"><div className="v100-battle-stage" style={{ backgroundImage: `url(${runtime?.backgroundPath ?? "/art/v060/battle-nishijin-shopping-street-v1.webp"})` }}><div className="v100-battle-hud"><span>S{String(battle.stageNumber).padStart(2, "0")} / {battle.displayName}</span><span>VEHICLE {battle.vehicleHp} / {battle.vehicleMaxHp}</span></div><div className="v100-objective-card"><span className="v100-kicker">{battle.missionType.toUpperCase()}</span><strong>{battle.objectiveState}</strong><small>{battle.missionProgress} / {battle.targetCount}</small>{boss && <><span className="v100-boss-name">{boss.id}</span><progress max={boss.maxHp} value={boss.hp} /></>}{battle.audio?.bossOwnsProductionSceneUntilDeath && <small className="v100-audio-owner">BOSS AUDIO: {boss?.musicActive ? "music-v099-boss" : "story post"}</small>}</div><div className="v100-battle-actors"><img className="v100-paisen-battle" src={V100_SPRITE_MANIFEST.paisen.path} alt="Paisen runtime atlas" /></div></div><aside className="v100-battle-controls"><div className="v100-panel-heading"><div><span className="v100-kicker">MISSION OBJECT / {battle.objectiveId}</span><h2>{battle.objectiveState}</h2></div><span>{battle.elapsedSeconds}s</span></div><div className="v100-deploy-list">{[...new Set(battleState.activeReservations.filter((entry) => entry.releasedAt === null).map((entry) => entry.unitId))].map((unitId) => <span key={unitId}>● {activeUnitName(unitId)}</span>)}</div><div className="v100-control-grid">{battle.missionType === "boss" ? <>{boss?.state === "entrance" && <button type="button" onClick={() => onAction("boss-entrance")}>BOSS ENTRANCE</button>}{boss && boss.hp > 0 && boss.state !== "entrance" && <button type="button" onClick={() => onAction("boss-hit", { amount: Math.max(1, Math.ceil(boss.maxHp / 3)) })}>ATTACK / HIT</button>}{boss?.state === "death" && <button type="button" onClick={() => onAction("boss-defeat")}>DEFEAT PRESENTATION</button>}</> : battle.missionType === "timed-defense" ? <button type="button" onClick={() => onAction("tick", { seconds: battle.timedDurationSeconds ?? 90 })}>防衛時間を進める</button> : battle.missionType === "escort" ? <button type="button" onClick={() => onAction("escort-progress")}>護送を進める</button> : battle.missionType === "power" || battle.missionType === "seal" ? battle.missionObjects.map((object) => <button type="button" key={object.id} onClick={() => onAction(battle.missionType === "power" ? "power-node" : "seal-node", { index: object.index })}>NODE {object.index + 1}: {object.state}</button>) : <button type="button" onClick={() => onAction("objective-hit")}>拠点を攻撃する</button>}{battle.vehicleHp > 0 && <button type="button" onClick={() => onAction("vehicle-damage", { amount: Math.max(1, Math.floor(battle.vehicleMaxHp / 10)) })}>車両損傷テスト</button>}</div><div className="v100-deploy-buttons">{battleState.activeReservations.length < 7 && ownedUnitIds.map((unitId) => <button type="button" key={unitId} onClick={() => onDeploy(unitId)}>召喚 {activeUnitName(unitId)}</button>)}</div><div className="v100-battle-actions"><button className="v100-primary" type="button" disabled={!canFinish} onClick={() => { onAction("resolve"); onFinish(true); }}>勝利結果を保存</button><button type="button" disabled={battle.vehicleHp > 0} onClick={() => onFinish(false)}>敗北</button></div></aside></section>;
}

function ResultView({ result, onContinue }: { result: Record<string, unknown> | null; onContinue: () => void }) {
  const won = result?.won === true;
  return <section className="v100-panel v100-result-panel"><span className="v100-kicker">BATTLE RESULT</span><h2>{won ? "MISSION CLEAR" : "DEFEAT"}</h2><p>{won ? `装甲車両 ${String(result?.vehicleHp ?? 0)} / ${String(result?.vehicleMaxHp ?? 0)}。post eventと保存済みpending resultを確認してください。` : "敗北時はpost、報酬、unlock、boss receiptへ進みません。"}</p>{won && <dl><div><dt>STARS</dt><dd>{String(result?.stars ?? 0)}</dd></div><div><dt>OBJECTIVE</dt><dd>{String(result?.objectiveComplete ?? false)}</dd></div></dl>}<button className="v100-primary" type="button" onClick={onContinue}>{won ? "POST EVENTへ" : "編成へ戻る"}</button></section>;
}

function EventLogView({ save, onReplay, onClose }: { save: Save; onReplay: (eventId: string) => void; onClose: () => void }) {
  return <div className="v100-modal-backdrop"><section className="v100-modal v100-log-modal" role="dialog" aria-modal="true" aria-label="Event log"><div className="v100-panel-heading"><div><span className="v100-kicker">EVENT LOG</span><h2>{save.readStoryEventIds.length} read events</h2></div><button type="button" onClick={onClose}>閉じる</button></div><div className="v100-log-list">{save.readStoryEventIds.map((eventId) => <button type="button" key={eventId} onClick={() => { onReplay(eventId); onClose(); }}>{eventId}</button>)}</div></section></div>;
}

function ReplayView({ event, node, index, onNext, onClose }: { event: ReturnType<typeof v100StoryEventView>; node: StoryNode | null; index: number; onNext: () => void; onClose: () => void }) {
  if (!event) return null;
  const hasNext = index < event.nodes.length - 1;
  return <div className="v100-modal-backdrop"><section className="v100-modal" role="dialog" aria-modal="true" aria-label="Event replay"><div className="v100-event-heading"><span className="v100-kicker">REPLAY / {event.id}</span><button type="button" onClick={onClose}>閉じる</button></div>{node ? <StoryNodeView node={node} /> : <p>このイベントには表示ノードがありません。</p>}<button className="v100-primary" type="button" onClick={hasNext ? onNext : onClose}>{hasNext ? "次へ" : "リプレイ終了"}</button></section></div>;
}
