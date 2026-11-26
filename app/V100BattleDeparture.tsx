import { useMemo, useState, type CSSProperties } from "react";
import { combatKindToCampaignUnitId } from "./campaign.js";
import { MANUAL_ABILITY_REGISTRY } from "./manualAbilities.js";
import { v100MissionObjectiveFor } from "./v100BattleAdapter.js";
import { V100_BOSS_DOSSIER_ART, V100_BOSS_DOSSIER_FRAMING } from "./v100BossDossierArt.js";
import { v100MissionThreatsFor } from "./v100MissionBriefing.js";
import { v100PortraitFraming } from "./v100PortraitFraming.js";
import { V100_BOSSES, V100_STAGE_BY_ID, V100_UNIT_BY_ID } from "./v100Registry.js";
import { v100RoleLabelFor } from "./v100Terminology.js";

type DepartureSession = {
  stageId: string;
  displayName?: string;
  battleMode?: "campaign" | "outbreak" | null;
  survivalRun?: unknown;
  formationKinds: readonly string[];
  enemyKinds: readonly string[];
};

type DepartureProgress = {
  completed: number;
  total: number;
  failed: number;
  retryAvailable: boolean;
  retrying: boolean;
};

type BattleDepartureProps = {
  session: DepartureSession;
  progress: DepartureProgress;
  assetError: boolean;
  background?: HTMLImageElement | null;
  images: Readonly<Record<string, HTMLImageElement | undefined>>;
  onRetry: () => void;
};

function decodedSource(image?: HTMLImageElement | null) {
  return image?.complete && image.naturalWidth > 0 ? image.currentSrc || image.src : undefined;
}

function departureStageFor(session: DepartureSession) {
  return session.survivalRun || session.battleMode === "outbreak" ? null : V100_STAGE_BY_ID[session.stageId];
}

export function v100DepartureCrewKind(session: DepartureSession) {
  const stageNumber = departureStageFor(session)?.number ?? 1;
  return session.formationKinds[(stageNumber - 1) % Math.max(1, session.formationKinds.length)];
}

export function V100BattleDeparture({ session, progress, assetError, background, images, onRetry }: BattleDepartureProps) {
  const stage = departureStageFor(session);
  const boss = stage?.missionType === "boss" ? V100_BOSSES.find(entry => entry.stageNumber === stage.number) : null;
  const bossArt = boss && typeof document !== "undefined" && document.documentElement.dataset.pwaBossDossiers === "ready"
    ? V100_BOSS_DOSSIER_ART[boss.id] : null;
  const bossFrame = bossArt && boss ? V100_BOSS_DOSSIER_FRAMING[boss.id] : null;
  const [loadedBoss, setLoadedBoss] = useState<string | null>(null);
  const showBoss = Boolean(bossArt && boss && loadedBoss === boss.id);
  const threats = useMemo(() => stage ? v100MissionThreatsFor(stage.id) : [], [stage]);
  const threat = threats.find((candidate) => session.enemyKinds.includes(candidate.id));
  const stageNumber = stage?.number ?? 1;
  const crewKind = v100DepartureCrewKind(session);
  const crewId = crewKind ? combatKindToCampaignUnitId(crewKind) : null;
  const crew = crewId ? V100_UNIT_BY_ID[crewId] : null;
  const ability = crewKind ? MANUAL_ABILITY_REGISTRY[crewKind] : null;
  const portrait = crew ? decodedSource(images["card-" + crewKind]) : undefined;
  const backdrop = decodedSource(background);
  const style = backdrop ? { "--departure-backdrop": "url('" + backdrop + "')" } as CSSProperties : undefined;
  const stageTitle = stage
    ? stage.number < 27 ? stage.displayName.replace(/RED PANTHER/gu, "赤レンズ部隊") : stage.displayName
    : session.survivalRun ? "サバイバル" : session.displayName || "迎撃任務";
  const briefing = stage ? v100MissionObjectiveFor(stage.id) : null;
  const progressValue = Math.max(0, Math.min(progress.total, progress.completed));

  return <section className="v100-battle-asset-status" aria-label="戦闘データの準備" style={style}>
    <div className="v100-departure-layout" data-has-crew={Boolean(crew)}>
      <article className="v100-departure-briefing">
        <div className="v100-departure-stage"><span>出撃準備</span>{stage && <b>S{String(stageNumber).padStart(2, "0")}</b>}</div>
        <h2>{stageTitle}</h2>
        {briefing && <p className="v100-departure-objective">{briefing}</p>}
        {threat && !assetError && <div className="v100-departure-threat">
          <strong>{threat.name}</strong><span>{threat.purpose}</span>
        </div>}
        <div className="v100-departure-progress">
          <p role={assetError ? "alert" : "status"}>
            {assetError ? "戦闘に必要な画像を読み込めませんでした。" : progress.retrying ? "画像を読み込み直しています" : "戦場を準備しています"}
          </p>
          {!assetError && <progress aria-label="画像の読み込み" max={Math.max(1, progress.total)}
            value={progress.total > 0 ? progressValue : undefined} />}
          {assetError && progress.failed > 0 && <small>読み込めなかった画像 {progress.failed}件</small>}
          {(progress.retryAvailable || assetError || progress.retrying) &&
            <button type="button" disabled={progress.retrying} onClick={onRetry}>
              {progress.retrying ? "画像を再読み込みしています…" : "画像をもう一度読み込む"}
            </button>}
        </div>
      </article>
      {crew && crewId && <figure className="v100-departure-crew" data-portrait-ready={Boolean(portrait) || showBoss} data-boss-ready={showBoss} style={v100PortraitFraming(crewId) as CSSProperties}>
        <div className="v100-departure-portrait" aria-hidden="true">
          {portrait && !showBoss && <img src={portrait} alt="" draggable={false} />}
        </div>
        {boss && bossArt && bossFrame && <div className="v100-departure-specimen" aria-hidden="true">
          <img key={boss.id} src={bossArt.path} alt="" draggable={false} onLoad={() => setLoadedBoss(boss.id)}
            style={{ "--specimen-x": bossFrame.centerX, "--specimen-top": bossFrame.top,
              "--specimen-width": bossFrame.widthFit, "--specimen-height": bossFrame.heightFit } as CSSProperties} />
        </div>}
        <figcaption>
          <span>{showBoss ? "交戦対象" : v100RoleLabelFor(crew.role)}</span>
          <strong>{showBoss ? boss?.displayName : crew.displayName}</strong>
          {!showBoss && ability && <small>{ability.displayName}</small>}
        </figcaption>
      </figure>}
    </div>
  </section>;
}
