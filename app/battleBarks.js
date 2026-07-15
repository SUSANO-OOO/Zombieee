export const BATTLE_BARK_CONFIG = Object.freeze({
  maxVisible: 2,
  defaultDuration: 1.8,
  globalCooldown: .8,
  speakerCooldown: 3.5,
  duplicateCooldown: 8,
  defaultProbability: 1,
  defaultWeight: 1,
});

/**
 * @typedef {{
 *   id: string,
 *   trigger: string,
 *   speakerKind?: string,
 *   voiceKind?: string,
 *   speaker: string,
 *   text: string,
 *   duration?: number,
 *   priority: number,
 *   probability?: number,
 *   weight?: number,
 *   tone?: string,
 *   cooldown?: number,
 * }} BattleBarkLine
 * @typedef {{
 *   id: string,
 *   lineId: string,
 *   trigger: string,
 *   speakerId: string,
 *   speakerKind: string,
 *   speaker: string,
 *   text: string,
 *   remaining: number,
 *   priority: number,
 *   sequence: number,
 *   tone: string,
 * }} BattleBark
 * @typedef {{
 *   clock: number,
 *   sequence: number,
 *   active: BattleBark[],
 *   globalReadyAt: number,
 *   speakerReadyAt: Record<string, number>,
 *   lineReadyAt: Record<string, number>,
 * }} BattleBarkRuntime
 * @typedef {{trigger: string, speakerKind: string, speakerId?: string | number}} BattleBarkEvent
 */

export const BATTLE_BARK_TRIGGER_IDS = Object.freeze({
  ROLE_CUE: "role-cue",
  WAVE_CONTACT: "wave-contact",
  ALLY_DOWN: "ally-down",
  INFECTION_WARNING: "infection-warning",
  SUPPORT_POD: "support-pod",
  SUPPORT_DRUM: "support-drum",
  SUPPORT_MEDICAL: "support-medical",
  AIRSTRIKE_REQUEST: "airstrike-request",
  CRAWLER_BARRAGE: "crawler-barrage",
  CRAWLER_CRITICAL: "crawler-critical",
  TAKUYA_ENTRANCE: "takuya-entrance",
  TAKUYA_ENRAGED: "takuya-enraged",
  TAKUYA_DOWN: "takuya-down",
  BASE_EXPOSED: "base-exposed",
  VICTORY: "victory",
  DEFEAT: "defeat",
});

function approvedLine({ duration = 1.7, cooldown = 12, ...line }) {
  return Object.freeze({
    duration,
    cooldown,
    probability: 1,
    weight: 1,
    tone: "radio",
    ...line,
  });
}

/**
 * Short, state-linked radio lines for normal play. Repeated triggers rotate to
 * another variant because each line has an independent cooldown. Corpse
 * infection warnings are intentionally diegetic and never expose timer data.
 */
export const APPROVED_BATTLE_BARK_LINES = /** @type {readonly BattleBarkLine[]} */ (Object.freeze([
  approvedLine({ id: "role-brawler-01", trigger: "role-cue", speakerKind: "brawler", voiceKind: "brawler", speaker: "パイセン", text: "前、行くっす！", priority: 24 }),
  approvedLine({ id: "role-brawler-02", trigger: "role-cue", speakerKind: "brawler", voiceKind: "brawler", speaker: "パイセン", text: "まだ動けるっす。", priority: 24 }),
  approvedLine({ id: "role-brawler-03", trigger: "role-cue", speakerKind: "brawler", voiceKind: "brawler", speaker: "パイセン", text: "近いのは俺が止める！", priority: 24 }),
  approvedLine({ id: "role-scout-01", trigger: "role-cue", speakerKind: "scout", voiceKind: "scout", speaker: "橘 迅", text: "先を見る。遅れないで。", priority: 23 }),
  approvedLine({ id: "role-scout-02", trigger: "role-cue", speakerKind: "scout", voiceKind: "scout", speaker: "橘 迅", text: "速い奴は俺が止める。", priority: 23 }),
  approvedLine({ id: "role-scout-03", trigger: "role-cue", speakerKind: "scout", voiceKind: "scout", speaker: "橘 迅", text: "上、空いてる。そっちへ行く。", priority: 23 }),
  approvedLine({ id: "role-ranger-01", trigger: "role-cue", speakerKind: "ranger", voiceKind: "ranger", speaker: "黒木 凛", text: "吐く個体を先に。", priority: 25 }),
  approvedLine({ id: "role-ranger-02", trigger: "role-cue", speakerKind: "ranger", voiceKind: "ranger", speaker: "黒木 凛", text: "危ないのから撃つ。", priority: 25 }),
  approvedLine({ id: "role-ranger-03", trigger: "role-cue", speakerKind: "ranger", voiceKind: "ranger", speaker: "黒木 凛", text: "遠いのは任せて。", priority: 25 }),
  approvedLine({ id: "role-medic-01", trigger: "role-cue", speakerKind: "medic", voiceKind: "medic", speaker: "白石 直人", text: "傷は塞ぎました。前を見て。", priority: 26 }),
  approvedLine({ id: "role-medic-02", trigger: "role-cue", speakerKind: "medic", voiceKind: "medic", speaker: "白石 直人", text: "傷を見ます。周りをお願い。", priority: 26 }),
  approvedLine({ id: "role-medic-03", trigger: "role-cue", speakerKind: "medic", voiceKind: "medic", speaker: "白石 直人", text: "立てます。無理なら言って。", priority: 26 }),
  approvedLine({ id: "role-brute-01", trigger: "role-cue", speakerKind: "brute", voiceKind: "brute", speaker: "大庭 豪", text: "ここは俺が開ける。", priority: 25 }),
  approvedLine({ id: "role-brute-02", trigger: "role-cue", speakerKind: "brute", voiceKind: "brute", speaker: "大庭 豪", text: "重いのは俺が止める。", priority: 25 }),
  approvedLine({ id: "role-brute-03", trigger: "role-cue", speakerKind: "brute", voiceKind: "brute", speaker: "大庭 豪", text: "前を開ける。少し下がってくれ。", priority: 25 }),
  approvedLine({ id: "role-gunner-01", trigger: "role-cue", speakerKind: "gunner", voiceKind: "gunner", speaker: "真壁 玲奈", text: "火線を空けて。", priority: 27 }),
  approvedLine({ id: "role-gunner-02", trigger: "role-cue", speakerKind: "gunner", voiceKind: "gunner", speaker: "真壁 玲奈", text: "大きいのを止めます。", priority: 27 }),
  approvedLine({ id: "role-gunner-03", trigger: "role-cue", speakerKind: "gunner", voiceKind: "gunner", speaker: "真壁 玲奈", text: "撃ちます。伏せて！", priority: 27 }),

  approvedLine({ id: "wave-contact-01", trigger: "wave-contact", voiceKind: "guide", speaker: "水城 奈々", text: "来ます。左右も見てください。", priority: 42, cooldown: 15 }),
  approvedLine({ id: "wave-contact-02", trigger: "wave-contact", voiceKind: "guide", speaker: "水城 奈々", text: "次が来ます。前を確認して。", priority: 42, cooldown: 15 }),
  approvedLine({ id: "wave-contact-03", trigger: "wave-contact", voiceKind: "guide", speaker: "水城 奈々", text: "数が増えました。両端も見て。", priority: 42, cooldown: 15 }),
  approvedLine({ id: "ally-down-01", trigger: "ally-down", voiceKind: "medic", speaker: "白石 直人", text: "一人倒れました。周りを空けて。", priority: 82, cooldown: 18 }),
  approvedLine({ id: "ally-down-02", trigger: "ally-down", voiceKind: "medic", speaker: "白石 直人", text: "まだ近づかないで。敵が残っています。", priority: 82, cooldown: 18 }),
  approvedLine({ id: "ally-down-03", trigger: "ally-down", voiceKind: "medic", speaker: "白石 直人", text: "場所は見ています。今は前を。", priority: 82, cooldown: 18 }),
  approvedLine({ id: "infection-warning-01", trigger: "infection-warning", voiceKind: "medic", speaker: "白石 直人", text: "死体が痙攣してる。距離を取って。", priority: 91, cooldown: 20 }),
  approvedLine({ id: "infection-warning-02", trigger: "infection-warning", voiceKind: "medic", speaker: "白石 直人", text: "皮膚の色が変わった。火を準備して。", priority: 91, cooldown: 20 }),
  approvedLine({ id: "infection-warning-03", trigger: "infection-warning", voiceKind: "medic", speaker: "白石 直人", text: "目が開いた。もう近づかないで。", priority: 91, cooldown: 20 }),
  approvedLine({ id: "support-pod-01", trigger: "support-pod", voiceKind: "guide", speaker: "水城 奈々", text: "防護投下ポッド、着弾します。", priority: 54 }),
  approvedLine({ id: "support-pod-02", trigger: "support-pod", voiceKind: "guide", speaker: "水城 奈々", text: "投下軌道よし。衝撃に備えて。", priority: 54 }),
  approvedLine({ id: "support-drum-01", trigger: "support-drum", voiceKind: "gunner", speaker: "真壁 玲奈", text: "爆薬ドラム、設置完了。", priority: 53 }),
  approvedLine({ id: "support-drum-02", trigger: "support-drum", voiceKind: "gunner", speaker: "真壁 玲奈", text: "起爆線を確保。巻き込まれないで。", priority: 53 }),
  approvedLine({ id: "support-medical-01", trigger: "support-medical", voiceKind: "medic", speaker: "白石 直人", text: "簡易救護所、使えます。", priority: 56 }),
  approvedLine({ id: "support-medical-02", trigger: "support-medical", voiceKind: "medic", speaker: "白石 直人", text: "救護所を展開。負傷者はこちらへ。", priority: 56 }),
  approvedLine({ id: "airstrike-request-01", trigger: "airstrike-request", voiceKind: "guide", speaker: "水城 奈々", text: "航空支援へ送信。着弾域を空けて。", priority: 72 }),
  approvedLine({ id: "airstrike-request-02", trigger: "airstrike-request", voiceKind: "guide", speaker: "水城 奈々", text: "目標座標を確認。全員、退避を。", priority: 72 }),
  approvedLine({ id: "crawler-barrage-01", trigger: "crawler-barrage", voiceKind: "guide", speaker: "水城 奈々", text: "移動拠点、砲撃姿勢へ。", priority: 74 }),
  approvedLine({ id: "crawler-barrage-02", trigger: "crawler-barrage", voiceKind: "guide", speaker: "水城 奈々", text: "主砲線上から退避してください。", priority: 74 }),
  approvedLine({ id: "crawler-critical-01", trigger: "crawler-critical", voiceKind: "guide", speaker: "水城 奈々", text: "移動拠点が削られています。戻って！", priority: 93, cooldown: 16 }),
  approvedLine({ id: "crawler-critical-02", trigger: "crawler-critical", voiceKind: "guide", speaker: "水城 奈々", text: "拠点がもちません。近い敵から！", priority: 93, cooldown: 16 }),
  approvedLine({ id: "crawler-critical-03", trigger: "crawler-critical", voiceKind: "guide", speaker: "水城 奈々", text: "防衛限界です。ここを通さないで。", priority: 93, cooldown: 16 }),
  approvedLine({ id: "takuya-entrance-01", trigger: "takuya-entrance", voiceKind: "ranger", speaker: "黒木 凛", text: "来る。中央から離れて。", priority: 95, cooldown: 20 }),
  approvedLine({ id: "takuya-entrance-02", trigger: "takuya-entrance", voiceKind: "ranger", speaker: "黒木 凛", text: "あれがTAKUYA。前を見て。", priority: 95, cooldown: 20 }),
  approvedLine({ id: "takuya-entrance-03", trigger: "takuya-entrance", voiceKind: "ranger", speaker: "黒木 凛", text: "効きが浅い。撃ち続ける。", priority: 95, cooldown: 20 }),
  approvedLine({ id: "takuya-enraged-01", trigger: "takuya-enraged", voiceKind: "gunner", speaker: "真壁 玲奈", text: "動きが変わった。正面を空けて。", priority: 96, cooldown: 20 }),
  approvedLine({ id: "takuya-enraged-02", trigger: "takuya-enraged", voiceKind: "gunner", speaker: "真壁 玲奈", text: "動きが荒い。正面を撃ちます。", priority: 96, cooldown: 20 }),
  approvedLine({ id: "takuya-down-01", trigger: "takuya-down", voiceKind: "ranger", speaker: "黒木 凛", text: "TAKUYAは止まった。奥へ進む。", priority: 98, cooldown: 24 }),
  approvedLine({ id: "takuya-down-02", trigger: "takuya-down", voiceKind: "ranger", speaker: "黒木 凛", text: "巨大反応、停止。まだ終わってない。", priority: 98, cooldown: 24 }),
  approvedLine({ id: "base-exposed-01", trigger: "base-exposed", voiceKind: "guide", speaker: "水城 奈々", text: "感染拠点が見えました。今なら届きます。", priority: 97, cooldown: 20 }),
  approvedLine({ id: "base-exposed-02", trigger: "base-exposed", voiceKind: "guide", speaker: "水城 奈々", text: "防壁が崩れました。奥へ集中して。", priority: 97, cooldown: 20 }),
  approvedLine({ id: "base-exposed-03", trigger: "base-exposed", voiceKind: "guide", speaker: "水城 奈々", text: "道が開きました。全員、前へ。", priority: 97, cooldown: 20 }),
  approvedLine({ id: "victory-01", trigger: "victory", voiceKind: "guide", speaker: "水城 奈々", text: "作戦完了。生存者を確認します。", priority: 100, cooldown: 30 }),
  approvedLine({ id: "victory-02", trigger: "victory", voiceKind: "guide", speaker: "水城 奈々", text: "反応が消えました。全員いますか。", priority: 100, cooldown: 30 }),
  approvedLine({ id: "victory-03", trigger: "victory", voiceKind: "guide", speaker: "水城 奈々", text: "道は開きました。移動拠点へ戻って。", priority: 100, cooldown: 30 }),
  approvedLine({ id: "defeat-01", trigger: "defeat", voiceKind: "guide", speaker: "水城 奈々", text: "移動拠点がもちません。撤退してください！", priority: 100, cooldown: 30 }),
  approvedLine({ id: "defeat-02", trigger: "defeat", voiceKind: "guide", speaker: "水城 奈々", text: "続けられません。生きて戻って。", priority: 100, cooldown: 30 }),
]));

// These diagnostic labels are only selected by localhost-only QA routes.
export const LOCAL_QA_BATTLE_BARK_LINES = /** @type {readonly BattleBarkLine[]} */ (Object.freeze([
  ...["scout", "ranger", "brute", "brawler", "gunner", "medic"].map((speakerKind, index) => Object.freeze({
    id: `qa-role-${speakerKind}`,
    trigger: "role-cue",
    speakerKind,
    speaker: speakerKind === "brute" ? "BREAKER" : speakerKind.toUpperCase(),
    text: `QA // ${speakerKind === "brute" ? "BREAKER" : speakerKind.toUpperCase()} ROLE CUE`,
    duration: 1.7,
    priority: 20 + index,
    probability: 1,
    weight: 1,
    tone: "qa",
  })),
  Object.freeze({ id: "qa-crawler-critical", trigger: "crawler-critical", speakerKind: "crawler", speaker: "CRAWLER", text: "QA // CRAWLER CRITICAL", duration: 2, priority: 90, probability: 1, weight: 1, tone: "qa" }),
  Object.freeze({ id: "qa-takuya-down", trigger: "takuya-down", speakerKind: "crawler", speaker: "TACTICAL", text: "QA // TAKUYA DOWN", duration: 1.9, priority: 95, probability: 1, weight: 1, tone: "qa" }),
  Object.freeze({ id: "qa-base-exposed", trigger: "base-exposed", speakerKind: "crawler", speaker: "TACTICAL", text: "QA // ENEMY BASE EXPOSED", duration: 1.9, priority: 96, probability: 1, weight: 1, tone: "qa" }),
  Object.freeze({ id: "qa-victory", trigger: "victory", speakerKind: "crawler", speaker: "TACTICAL", text: "QA // MISSION COMPLETE", duration: 2, priority: 100, probability: 1, weight: 1, tone: "qa" }),
]));

/** @returns {BattleBarkRuntime} */
export function createBattleBarkRuntime() {
  return {
    clock: 0,
    sequence: 0,
    active: [],
    globalReadyAt: 0,
    speakerReadyAt: {},
    lineReadyAt: {},
  };
}

/**
 * @param {BattleBarkRuntime} runtime
 * @param {number} seconds
 * @returns {BattleBarkRuntime}
 */
export function advanceBattleBarkRuntime(runtime, seconds) {
  const elapsed = Math.max(0, Number(seconds) || 0);
  const clock = runtime.clock + elapsed;
  return {
    ...runtime,
    clock,
    active: runtime.active
      .map((bark) => ({ ...bark, remaining: Math.max(0, bark.remaining - elapsed) }))
      .filter((bark) => bark.remaining > 0),
  };
}

/** @param {BattleBarkLine} line @param {BattleBarkEvent} event */
function lineMatches(line, event) {
  return line.trigger === event.trigger && (!line.speakerKind || line.speakerKind === event.speakerKind);
}

export function battleBarkPassesProbability(probability = BATTLE_BARK_CONFIG.defaultProbability, roll = Math.random()) {
  const chance = Math.max(0, Math.min(1, Number(probability) || 0));
  const normalizedRoll = Math.max(0, Math.min(1, Number(roll) || 0));
  return normalizedRoll < chance;
}

/**
 * @param {{runtime: BattleBarkRuntime, event: BattleBarkEvent, qa?: boolean, random?: () => number}} input
 * @returns {{shown: boolean, reason?: string, runtime: BattleBarkRuntime, bark?: BattleBark}}
 */
export function queueBattleBark({ runtime, event, qa = false, random = Math.random }) {
  const catalog = qa ? LOCAL_QA_BATTLE_BARK_LINES : APPROVED_BATTLE_BARK_LINES;
  const candidates = catalog.filter((line) => lineMatches(line, event)).sort((a, b) => b.priority - a.priority || (b.weight ?? BATTLE_BARK_CONFIG.defaultWeight) - (a.weight ?? BATTLE_BARK_CONFIG.defaultWeight) || a.id.localeCompare(b.id));
  if (!candidates.length) return { shown: false, reason: "no-approved-line", runtime };

  let reason = "lower-priority";
  for (const line of candidates) {
    const speakerId = String(event.speakerId ?? event.speakerKind ?? line.speaker);
    const duplicateActive = runtime.active.some((bark) => bark.lineId === line.id || (bark.speakerId === speakerId && bark.trigger === event.trigger));
    if (duplicateActive) { reason = "duplicate-active"; continue; }
    if ((runtime.lineReadyAt[line.id] ?? 0) > runtime.clock) { reason = "line-cooldown"; continue; }
    if ((runtime.speakerReadyAt[speakerId] ?? 0) > runtime.clock) { reason = "speaker-cooldown"; continue; }
    if (runtime.globalReadyAt > runtime.clock && line.priority < 90) { reason = "global-cooldown"; continue; }
    if (!battleBarkPassesProbability(line.probability, random())) { reason = "probability"; continue; }

    const sequence = runtime.sequence + 1;
    /** @type {BattleBark} */
    const bark = {
      id: `${line.id}:${sequence}`,
      lineId: line.id,
      trigger: event.trigger,
      speakerId,
      speakerKind: line.voiceKind ?? line.speakerKind ?? event.speakerKind,
      speaker: line.speaker,
      text: line.text,
      remaining: line.duration ?? BATTLE_BARK_CONFIG.defaultDuration,
      priority: line.priority,
      sequence,
      tone: line.tone ?? "neutral",
    };
    const ranked = [...runtime.active, bark]
      .sort((a, b) => b.priority - a.priority || b.sequence - a.sequence)
      .slice(0, BATTLE_BARK_CONFIG.maxVisible);
    if (!ranked.some((active) => active.id === bark.id)) { reason = "lower-priority"; continue; }

    const active = ranked.sort((a, b) => a.sequence - b.sequence);
    return {
      shown: true,
      bark,
      runtime: {
        ...runtime,
        sequence,
        active,
        globalReadyAt: runtime.clock + BATTLE_BARK_CONFIG.globalCooldown,
        speakerReadyAt: { ...runtime.speakerReadyAt, [speakerId]: runtime.clock + BATTLE_BARK_CONFIG.speakerCooldown },
        lineReadyAt: { ...runtime.lineReadyAt, [line.id]: runtime.clock + (line.cooldown ?? BATTLE_BARK_CONFIG.duplicateCooldown) },
      },
    };
  }
  return { shown: false, reason, runtime };
}
