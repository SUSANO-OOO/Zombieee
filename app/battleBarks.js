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
  approvedLine({ id: "role-brawler-01", trigger: "role-cue", speakerKind: "brawler", voiceKind: "brawler", speaker: "パイセン", text: "前、借りるぞ。", priority: 24 }),
  approvedLine({ id: "role-brawler-02", trigger: "role-cue", speakerKind: "brawler", voiceKind: "brawler", speaker: "パイセン", text: "まだ拳は動く。", priority: 24 }),
  approvedLine({ id: "role-brawler-03", trigger: "role-cue", speakerKind: "brawler", voiceKind: "brawler", speaker: "パイセン", text: "近い奴は任せろ。", priority: 24 }),
  approvedLine({ id: "role-scout-01", trigger: "role-cue", speakerKind: "scout", voiceKind: "scout", speaker: "橘 迅", text: "走る。遅れんなよ。", priority: 23 }),
  approvedLine({ id: "role-scout-02", trigger: "role-cue", speakerKind: "scout", voiceKind: "scout", speaker: "橘 迅", text: "速い奴は俺が止める。", priority: 23 }),
  approvedLine({ id: "role-scout-03", trigger: "role-cue", speakerKind: "scout", voiceKind: "scout", speaker: "橘 迅", text: "薄い道から抜く。", priority: 23 }),
  approvedLine({ id: "role-ranger-01", trigger: "role-cue", speakerKind: "ranger", voiceKind: "ranger", speaker: "黒木 凛", text: "吐く前に落とす。", priority: 25 }),
  approvedLine({ id: "role-ranger-02", trigger: "role-cue", speakerKind: "ranger", voiceKind: "ranger", speaker: "黒木 凛", text: "危険個体から狙う。", priority: 25 }),
  approvedLine({ id: "role-ranger-03", trigger: "role-cue", speakerKind: "ranger", voiceKind: "ranger", speaker: "黒木 凛", text: "遠いのは任せて。", priority: 25 }),
  approvedLine({ id: "role-medic-01", trigger: "role-cue", speakerKind: "medic", voiceKind: "medic", speaker: "白石 直人", text: "傷は塞いだ。前を見て。", priority: 26 }),
  approvedLine({ id: "role-medic-02", trigger: "role-cue", speakerKind: "medic", voiceKind: "medic", speaker: "白石 直人", text: "治療する。援護を。", priority: 26 }),
  approvedLine({ id: "role-medic-03", trigger: "role-cue", speakerKind: "medic", voiceKind: "medic", speaker: "白石 直人", text: "動ける。戦列へ戻って。", priority: 26 }),
  approvedLine({ id: "role-brute-01", trigger: "role-cue", speakerKind: "brute", voiceKind: "brute", speaker: "大庭 豪", text: "ここは俺が割る。", priority: 25 }),
  approvedLine({ id: "role-brute-02", trigger: "role-cue", speakerKind: "brute", voiceKind: "brute", speaker: "大庭 豪", text: "重い奴から砕く。", priority: 25 }),
  approvedLine({ id: "role-brute-03", trigger: "role-cue", speakerKind: "brute", voiceKind: "brute", speaker: "大庭 豪", text: "前を開ける。下がれ。", priority: 25 }),
  approvedLine({ id: "role-gunner-01", trigger: "role-cue", speakerKind: "gunner", voiceKind: "gunner", speaker: "真壁 玲奈", text: "火線を空けて。", priority: 27 }),
  approvedLine({ id: "role-gunner-02", trigger: "role-cue", speakerKind: "gunner", voiceKind: "gunner", speaker: "真壁 玲奈", text: "大型、縫い止める。", priority: 27 }),
  approvedLine({ id: "role-gunner-03", trigger: "role-cue", speakerKind: "gunner", voiceKind: "gunner", speaker: "真壁 玲奈", text: "弾幕を張る。伏せて。", priority: 27 }),

  approvedLine({ id: "wave-contact-01", trigger: "wave-contact", voiceKind: "guide", speaker: "水城 奈々", text: "全経路、接敵。配置を維持。", priority: 42, cooldown: 15 }),
  approvedLine({ id: "wave-contact-02", trigger: "wave-contact", voiceKind: "guide", speaker: "水城 奈々", text: "次の群れが来ます。前線確認。", priority: 42, cooldown: 15 }),
  approvedLine({ id: "wave-contact-03", trigger: "wave-contact", voiceKind: "guide", speaker: "水城 奈々", text: "反応増加。両端にも警戒を。", priority: 42, cooldown: 15 }),
  approvedLine({ id: "ally-down-01", trigger: "ally-down", voiceKind: "medic", speaker: "白石 直人", text: "味方が倒れた。周囲を確保して。", priority: 82, cooldown: 18 }),
  approvedLine({ id: "ally-down-02", trigger: "ally-down", voiceKind: "medic", speaker: "白石 直人", text: "一人倒れた。まだ近づくな。", priority: 82, cooldown: 18 }),
  approvedLine({ id: "ally-down-03", trigger: "ally-down", voiceKind: "medic", speaker: "白石 直人", text: "倒れた場所を覚えて。後で戻る。", priority: 82, cooldown: 18 }),
  approvedLine({ id: "infection-warning-01", trigger: "infection-warning", voiceKind: "medic", speaker: "白石 直人", text: "死体が痙攣してる。距離を取って。", priority: 91, cooldown: 20 }),
  approvedLine({ id: "infection-warning-02", trigger: "infection-warning", voiceKind: "medic", speaker: "白石 直人", text: "皮膚の色が変わった。火を準備して。", priority: 91, cooldown: 20 }),
  approvedLine({ id: "infection-warning-03", trigger: "infection-warning", voiceKind: "medic", speaker: "白石 直人", text: "目が開いた。もう味方として見るな。", priority: 91, cooldown: 20 }),
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
  approvedLine({ id: "crawler-critical-01", trigger: "crawler-critical", voiceKind: "guide", speaker: "水城 奈々", text: "移動拠点、外殻損傷。前線を戻して。", priority: 93, cooldown: 16 }),
  approvedLine({ id: "crawler-critical-02", trigger: "crawler-critical", voiceKind: "guide", speaker: "水城 奈々", text: "拠点がもちません。接近個体を優先。", priority: 93, cooldown: 16 }),
  approvedLine({ id: "crawler-critical-03", trigger: "crawler-critical", voiceKind: "guide", speaker: "水城 奈々", text: "防衛限界です。ここを通さないで。", priority: 93, cooldown: 16 }),
  approvedLine({ id: "takuya-entrance-01", trigger: "takuya-entrance", voiceKind: "ranger", speaker: "黒木 凛", text: "巨大反応、来る。中央を空けて。", priority: 95, cooldown: 20 }),
  approvedLine({ id: "takuya-entrance-02", trigger: "takuya-entrance", voiceKind: "ranger", speaker: "黒木 凛", text: "あれがTAKUYA。頭を上げないで。", priority: 95, cooldown: 20 }),
  approvedLine({ id: "takuya-entrance-03", trigger: "takuya-entrance", voiceKind: "ranger", speaker: "黒木 凛", text: "通常弾が浅い。撃ち続ける。", priority: 95, cooldown: 20 }),
  approvedLine({ id: "takuya-enraged-01", trigger: "takuya-enraged", voiceKind: "gunner", speaker: "真壁 玲奈", text: "動きが変わった。正面を空けて。", priority: 96, cooldown: 20 }),
  approvedLine({ id: "takuya-enraged-02", trigger: "takuya-enraged", voiceKind: "gunner", speaker: "真壁 玲奈", text: "激昂してる。火線を重ねる。", priority: 96, cooldown: 20 }),
  approvedLine({ id: "takuya-down-01", trigger: "takuya-down", voiceKind: "ranger", speaker: "黒木 凛", text: "TAKUYA、沈黙。次は感染拠点。", priority: 98, cooldown: 24 }),
  approvedLine({ id: "takuya-down-02", trigger: "takuya-down", voiceKind: "ranger", speaker: "黒木 凛", text: "巨大反応、停止。まだ終わってない。", priority: 98, cooldown: 24 }),
  approvedLine({ id: "base-exposed-01", trigger: "base-exposed", voiceKind: "guide", speaker: "水城 奈々", text: "感染拠点が露出。今なら届きます。", priority: 97, cooldown: 20 }),
  approvedLine({ id: "base-exposed-02", trigger: "base-exposed", voiceKind: "guide", speaker: "水城 奈々", text: "防壁崩壊。感染拠点へ集中を。", priority: 97, cooldown: 20 }),
  approvedLine({ id: "base-exposed-03", trigger: "base-exposed", voiceKind: "guide", speaker: "水城 奈々", text: "目標まで開通。全火力を前へ。", priority: 97, cooldown: 20 }),
  approvedLine({ id: "victory-01", trigger: "victory", voiceKind: "guide", speaker: "水城 奈々", text: "作戦完了。生存者を確認します。", priority: 100, cooldown: 30 }),
  approvedLine({ id: "victory-02", trigger: "victory", voiceKind: "guide", speaker: "水城 奈々", text: "戦闘反応、消失。全員、点呼を。", priority: 100, cooldown: 30 }),
  approvedLine({ id: "victory-03", trigger: "victory", voiceKind: "guide", speaker: "水城 奈々", text: "経路を確保。移動拠点へ帰還を。", priority: 100, cooldown: 30 }),
  approvedLine({ id: "defeat-01", trigger: "defeat", voiceKind: "guide", speaker: "水城 奈々", text: "拠点を維持できません。撤退を。", priority: 100, cooldown: 30 }),
  approvedLine({ id: "defeat-02", trigger: "defeat", voiceKind: "guide", speaker: "水城 奈々", text: "作戦中止。生存者の離脱を優先。", priority: 100, cooldown: 30 }),
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
