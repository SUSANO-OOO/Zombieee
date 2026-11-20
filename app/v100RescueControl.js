export const V100_RESCUE_CONTROL_STAGE = "stage-t-plan-outer-core";
export const V100_RESCUE_CONTROL = Object.freeze({
  rescueControl: true,
  powerCount: 3,
  powerHoldSeconds: 3.5,
  powerXs: Object.freeze([294, 455, 617]),
  powerYs: Object.freeze([282, 282, 282]),
  powerRadiusX: 68,
  powerRadiusY: 38,
  securityX: 790,
  securityY: 282,
});

export function hasRescueControl(missionType, config) {
  return missionType === "sequential-seal" && config?.rescueControl === true;
}

export function rescueControlReadout(runtime) {
  const restored = runtime.powerActivated ?? 0;
  const total = V100_RESCUE_CONTROL.powerCount;
  const label = "救難回線";
  if (runtime.completed) {
    return { phase: "secured", phaseLabel: "防衛完了", label, status: "防衛完了", progress: 1 };
  }
  if (restored >= total) {
    return { phase: "defending", phaseLabel: "制御区防衛", label, status: "復旧済み", progress: 1 };
  }
  return { phase: "restoring", phaseLabel: "回線復旧", label,
    status: `${restored}/${total} 復旧`, progress: restored / total };
}
