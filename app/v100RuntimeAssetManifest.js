const V100_ROOT = "/art/v100";

function freezeRecord(record) {
  return Object.freeze(record);
}

const portraits = freezeRecord({
  segawa: `${V100_ROOT}/portraits/segawa-event-portrait-v1.webp`,
  segawaProfile: `${V100_ROOT}/portraits/segawa-dialogue-profile-v1.webp`,
  mugarianPresident: `${V100_ROOT}/portraits/mugarian-president-event-portrait-v1.webp`,
  mugarianPresidentProfile: `${V100_ROOT}/portraits/mugarian-president-dialogue-profile-v1.webp`,
  mutatedPresident: `${V100_ROOT}/portraits/mugarian-president-mutated-event-portrait-v1.webp`,
  takuyaOmega: `${V100_ROOT}/portraits/takuya-omega-event-portrait-v1.webp`,
  redPantherCommander: `${V100_ROOT}/portraits/red-panther-commander-event-portrait-v1.webp`,
  minorHuman: `${V100_ROOT}/portraits/minor-human-shared-event-silhouette-event-portrait-v1.webp`,
});

const storyCuts = freezeRecord({
  segawaPrivateLab: `${V100_ROOT}/cuts/segawa-private-lab-reveal-v1.webp`,
  mugarianPresidentExecutiveLab: `${V100_ROOT}/cuts/mugarian-president-executive-lab-v1.webp`,
  mutatedPresidentDefeat: `${V100_ROOT}/cuts/mugarian-president-defeat-v1.webp`,
  takuyaOmegaEndingDefeat: `${V100_ROOT}/cuts/takuya-omega-ending-defeat-v1.webp`,
});

const bosses = freezeRecord({
  "boss-mugarian-president-mutated": `${V100_ROOT}/bosses/mugarian-president-mutated-battle-v1.png`,
  "boss-takuya-omega": `${V100_ROOT}/bosses/takuya-omega-battle-v1.png`,
});

const redPanther = freezeRecord({
  knife: `${V100_ROOT}/enemies/red-panther-knife-battle-v1.png`,
  shield: `${V100_ROOT}/enemies/red-panther-shield-battle-v1.png`,
  smg: `${V100_ROOT}/enemies/red-panther-smg-battle-v1.png`,
  commander: `${V100_ROOT}/enemies/red-panther-commander-battle-v1.png`,
});

const missionObjects = freezeRecord({
  clinicalTrialWing: `${V100_ROOT}/mission-objects/clinical-trial-wing-v1.png`,
  redPantherArmoryLockers: `${V100_ROOT}/mission-objects/red-panther-armory-lockers-v1.png`,
  twinReactorLandmark: `${V100_ROOT}/mission-objects/twin-reactor-landmark-v1.png`,
  presidentArenaTerminal: `${V100_ROOT}/mission-objects/president-arena-terminal-v1.png`,
  escortCartIntact: `${V100_ROOT}/mission-objects/escort-cart-intact-v1.png`,
  escortCartDamaged: `${V100_ROOT}/mission-objects/escort-cart-damaged-v1.png`,
  nationalDispersalNode1: `${V100_ROOT}/mission-objects/national-dispersal-node-1-v1.png`,
  nationalDispersalNode2: `${V100_ROOT}/mission-objects/national-dispersal-node-2-v1.png`,
  nationalDispersalNode3: `${V100_ROOT}/mission-objects/national-dispersal-node-3-v1.png`,
  nationalDispersalNode4: `${V100_ROOT}/mission-objects/national-dispersal-node-4-v1.png`,
  highSecurityResearchCoreGate: `${V100_ROOT}/mission-objects/high-security-research-core-gate-v1.png`,
  stage30AftermathCore: `${V100_ROOT}/mission-objects/stage30-aftermath-core-v1.png`,
});

const vfx = freezeRecord({
  hqSecurityWarning: `${V100_ROOT}/vfx/hq-security-warning-v1.png`,
  armoryRedLensAlert: `${V100_ROOT}/vfx/armory-red-lens-alert-v1.png`,
  dispersalNodeActive: `${V100_ROOT}/vfx/dispersal-node-active-v1.png`,
  stage30DawnDamage: `${V100_ROOT}/vfx/stage30-dawn-damage-v1.png`,
});

const stages = freezeRecord({
  "stage-mugarian-logistics-hq": freezeRecord({ background: `${V100_ROOT}/stages/s21-mugarian-hq-clean-background-v1.webp`, missionObjects: [], vfx: [vfx.hqSecurityWarning] }),
  "stage-mugarian-clinical-trial-wing": freezeRecord({ background: `${V100_ROOT}/stages/s22-clinical-trial-wing-r2-background-v1.webp`, missionObjects: [missionObjects.clinicalTrialWing], vfx: [] }),
  "stage-mugarian-special-operations-armory": freezeRecord({ background: `${V100_ROOT}/stages/s23-special-operations-armory-r2-background-v1.webp`, missionObjects: [missionObjects.redPantherArmoryLockers], vfx: [vfx.armoryRedLensAlert] }),
  "stage-mugarian-tech-tower": freezeRecord({ background: `${V100_ROOT}/stages/s24-tech-tower-background-v1.webp`, missionObjects: [missionObjects.twinReactorLandmark], vfx: [] }),
  "stage-mugarian-executive-lab": freezeRecord({ background: `${V100_ROOT}/stages/s25-executive-lab-r2-background-v1.webp`, missionObjects: [missionObjects.presidentArenaTerminal], vfx: [] }),
  "stage-bay-evacuation-yard": freezeRecord({ background: `${V100_ROOT}/stages/s26-bay-evacuation-yard-r2-background-v1.webp`, missionObjects: [missionObjects.escortCartIntact, missionObjects.escortCartDamaged], vfx: [] }),
  "stage-segawa-private-lab": freezeRecord({ background: `${V100_ROOT}/stages/s27-segawa-private-lab-r2-background-v1.webp`, missionObjects: [missionObjects.clinicalTrialWing, missionObjects.redPantherArmoryLockers], vfx: [] }),
  "stage-national-dispersal-network": freezeRecord({ background: `${V100_ROOT}/stages/s28-national-dispersal-network-clean-background-v1.webp`, missionObjects: [missionObjects.nationalDispersalNode1, missionObjects.nationalDispersalNode2, missionObjects.nationalDispersalNode3, missionObjects.nationalDispersalNode4], vfx: [vfx.dispersalNodeActive] }),
  "stage-segawa-research-core": freezeRecord({ background: `${V100_ROOT}/stages/s29-high-security-research-core-r2-background-v1.webp`, missionObjects: [missionObjects.highSecurityResearchCoreGate], vfx: [] }),
  "stage-nishijin-defense-line-takuya-omega": freezeRecord({ background: `${V100_ROOT}/stages/s30-defense-line-aftermath-background-v1.webp`, missionObjects: [missionObjects.stage30AftermathCore], vfx: [vfx.stage30DawnDamage] }),
});

export const V100_RUNTIME_ASSET_MANIFEST = Object.freeze({
  schema: "v100-runtime-asset-manifest-v1",
  designId: "V100-SOL-DL-001 r2",
  storySha256: "c7293d739998431c38f337a7ef8d4e724b74696537ff44ad8f0c30d854a017a4",
  provenancePath: "assets/source/v100/runtime/v100-runtime-assets-provenance.json",
  generatedBy: "scripts/build-v100-runtime-assets.mjs",
  portraits,
  storyCuts,
  bosses,
  redPanther,
  missionObjects,
  vfx,
  stages,
});

export function v100RuntimeAssetPathsForStage(stageId) {
  const stage = stages[stageId];
  if (!stage) return Object.freeze([]);
  return Object.freeze([stage.background, ...stage.missionObjects, ...stage.vfx]);
}

export function v100RuntimeAssetPathList() {
  const paths = [
    ...Object.values(portraits),
    ...Object.values(storyCuts),
    ...Object.values(bosses),
    ...Object.values(redPanther),
    ...Object.values(missionObjects),
    ...Object.values(vfx),
    ...Object.values(stages).flatMap((stage) => [stage.background, ...stage.missionObjects, ...stage.vfx]),
  ];
  return Object.freeze([...new Set(paths)]);
}

export function validateV100RuntimeAssetManifest() {
  const errors = [];
  const paths = v100RuntimeAssetPathList();
  if (new Set(paths).size !== paths.length) errors.push("duplicate-runtime-path");
  if (V100_RUNTIME_ASSET_MANIFEST.storySha256 !== "c7293d739998431c38f337a7ef8d4e724b74696537ff44ad8f0c30d854a017a4") errors.push("story-source-drift");
  if (Object.keys(stages).length !== 10) errors.push("stage-21-30-count");
  if (Object.keys(redPanther).length !== 4) errors.push("red-panther-role-count");
  if (Object.keys(bosses).length !== 2) errors.push("new-boss-atlas-count");
  return Object.freeze({ ok: errors.length === 0, errors: Object.freeze(errors), pathCount: paths.length });
}
