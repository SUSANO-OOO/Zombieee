// PR1 keeps the production AudioMixer and its existing licensed/project-original
// assets. These semantic roles make the UI event matrix explicit without adding
// another sound format or a second mixer path.
export const UI_OPERATION_CUE_IDS = Object.freeze({
  selection: "ui-select",
  confirm: "ui-confirm",
  back: "ui-cancel",
  purchase: "sfx-v070-terminal-confirm",
  upgrade: "sfx-v070-power-switch",
  reward: "sfx-v070-rescue-confirm",
  deploy: "support-pod-deploy",
  reject: "ui-error",
});

export const UI_OPERATION_CUE_POLICIES = Object.freeze({
  selection: Object.freeze({ priority: 54, cooldownMs: 90, volume: .66, maxInstances: 1 }),
  confirm: Object.freeze({ priority: 66, cooldownMs: 120, volume: .74, maxInstances: 1 }),
  back: Object.freeze({ priority: 58, cooldownMs: 120, volume: .68, maxInstances: 1 }),
  purchase: Object.freeze({ priority: 78, cooldownMs: 180, volume: .82, maxInstances: 1 }),
  upgrade: Object.freeze({ priority: 76, cooldownMs: 160, volume: .78, maxInstances: 1 }),
  reward: Object.freeze({ priority: 82, cooldownMs: 220, volume: .84, maxInstances: 1 }),
  deploy: Object.freeze({ priority: 74, cooldownMs: 160, volume: .78, maxInstances: 1 }),
  reject: Object.freeze({ priority: 58, cooldownMs: 220, volume: .62, maxInstances: 1 }),
});

export const UI_OPERATION_ROLES = Object.freeze(Object.keys(UI_OPERATION_CUE_IDS));

export function operationRejectMessage(reason, subject = "操作") {
  const labels = {
    "already-owned": "すでに所有済みです",
    "already-processed": "この処理はすでに完了しています",
    "insufficient-caps": "キャップが不足しています",
    "not-recruitable": "現在は雇用できません",
    "not-owned": "対象を所有していません",
    "level-cap": "現在のLevel上限に達しています",
    "max-level": "最大Levelに達しています",
    "cooldown": "再使用まで待機してください",
    "locked": "まだ解放されていません",
    "capacity": "編成上限に達しています",
    "no-target": "対象を選択してください",
    "condition-unmet": "発動条件を満たしていません",
    "save-failed": "保存に失敗したため、処理を確定していません",
  };
  return `${subject}：${labels[reason] ?? "成立しませんでした"}`;
}
