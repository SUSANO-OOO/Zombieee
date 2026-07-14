/**
 * Early-access dialogue data. The renderer consumes only these declarative
 * fields so later art, comic panels, video, or in-battle presentation can
 * replace the provisional UI without rewriting scenario data.
 */
export const STORY_EVENTS = Object.freeze({
  intro: Object.freeze({
    id: "intro",
    background: "nishijin-night",
    lines: Object.freeze([
      Object.freeze({ speaker: "水城 奈々", role: "通信・地図・情報分析", side: "right", portrait: "guide", expression: "alert", text: "西新一帯の通信が途切れました。生存者の反応は、まだ消えていません。", effect: "fade" }),
      Object.freeze({ speaker: "黒木 凛", role: "射撃手", side: "left", portrait: "ranger", expression: "focused", text: "商店街から煙。感染者だけじゃない。誰かが、道を塞いで戦ってる。" }),
      Object.freeze({ speaker: "水城 奈々", role: "通信・地図・情報分析", side: "right", portrait: "guide", expression: "steady", text: "移動拠点を接続。ここから先は、私たちの物語です。", effect: "shake" }),
    ]),
  }),
  "stage-nishijin-pre": Object.freeze({
    id: "stage-nishijin-pre",
    background: "shopping-street",
    lines: Object.freeze([
      Object.freeze({ speaker: "黒木 凛", role: "射撃手", side: "left", portrait: "ranger", expression: "focused", text: "西新商店街、感染拠点を確認。通路は三本、買い物客はいません。たぶん。" }),
      Object.freeze({ speaker: "パイセン", role: "格闘家", side: "right", portrait: "brawler", expression: "ready", text: "道が三本なら、拳も三倍いるな。まず中央から開ける。" }),
    ]),
  }),
  "stage-nishijin-post": Object.freeze({
    id: "stage-nishijin-post",
    background: "shopping-street",
    lines: Object.freeze([
      Object.freeze({ speaker: "水城 奈々", role: "通信・地図・情報分析", side: "right", portrait: "guide", expression: "relieved", text: "商店街の経路を確保。大庭 豪の反応が合流しました。" }),
      Object.freeze({ speaker: "大庭 豪", role: "破砕兵", side: "left", portrait: "brute", expression: "grin", text: "遅かったな。シャッターも感染拠点も、壊すなら任せろ。" }),
    ]),
  }),
  "stage-sawara-pre": Object.freeze({
    id: "stage-sawara-pre",
    background: "ward-office",
    lines: Object.freeze([
      Object.freeze({ speaker: "水城 奈々", role: "通信・地図・情報分析", side: "right", portrait: "guide", expression: "alert", text: "早良区役所前。救援車両の撤収まで三分、全レーンから接近中です。" }),
      Object.freeze({ speaker: "白石 直人", role: "衛生兵", side: "left", portrait: "medic", expression: "steady", text: "倒れた仲間は放置しないで。火を使うなら、敵か死体か、よく見て決めて。" }),
    ]),
  }),
  "stage-sawara-post": Object.freeze({
    id: "stage-sawara-post",
    background: "ward-office",
    lines: Object.freeze([
      Object.freeze({ speaker: "真壁 玲奈", role: "制圧射手", side: "left", portrait: "gunner", expression: "calm", text: "救援車両、離脱完了。弾は残ってる。次の戦線にも付き合う。" }),
      Object.freeze({ speaker: "水城 奈々", role: "通信・地図・情報分析", side: "right", portrait: "guide", expression: "uneasy", text: "西側の防衛線に、通常個体では説明できない大きな反応があります。" }),
    ]),
  }),
  "stage-takuya-pre": Object.freeze({
    id: "stage-takuya-pre",
    background: "defense-line",
    lines: Object.freeze([
      Object.freeze({ speaker: "橘 迅", role: "遊撃手", side: "left", portrait: "scout", expression: "alert", text: "防衛線の奥に変異種。呼び名はTAKUYA。笑える名前だが、圧は笑えない。" }),
      Object.freeze({ speaker: "黒木 凛", role: "射撃手", side: "right", portrait: "ranger", expression: "focused", text: "先に取り巻きを削る。あれを倒したら、感染拠点まで一気に抜く。", effect: "shake" }),
    ]),
  }),
  "stage-takuya-post": Object.freeze({
    id: "stage-takuya-post",
    background: "defense-line",
    lines: Object.freeze([
      Object.freeze({ speaker: "水城 奈々", role: "通信・地図・情報分析", side: "right", portrait: "guide", expression: "relieved", text: "西新防衛線、沈黙。序章の作戦経路はすべて確保しました。" }),
      Object.freeze({ speaker: "水城 奈々", role: "通信・地図・情報分析", side: "right", portrait: "guide", expression: "alert", text: "待って。百道浜、福岡タワー方面に異常反応。通信は途絶したままです。", effect: "shake" }),
      Object.freeze({ speaker: "パイセン", role: "格闘家", side: "left", portrait: "brawler", expression: "ready", text: "海の方か。今日はここまでだ。拳にも整備がいる。" }),
    ]),
  }),
});

export function getStoryEvent(eventId) {
  return STORY_EVENTS[eventId] ?? null;
}

export function storyEventLog(eventId, throughIndex = Number.POSITIVE_INFINITY) {
  const event = getStoryEvent(eventId);
  if (!event) return [];
  return event.lines.slice(0, Math.max(0, throughIndex + 1)).map((line, index) => ({
    id: `${eventId}:${index}`,
    speaker: line.speaker,
    role: line.role,
    text: line.text,
  }));
}
