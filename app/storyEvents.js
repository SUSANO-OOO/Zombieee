/**
 * Production dialogue for the 0.6.0 prologue. Each beat is deliberately short
 * enough for the landscape-mobile dialogue box while preserving a complete
 * dramatic arc when replayed through the conversation log.
 */
export const STORY_EVENTS = Object.freeze({
  intro: Object.freeze({
    id: "intro",
    background: "nishijin-night",
    lines: Object.freeze([
      Object.freeze({ speaker: "水城 奈々", role: "通信・地図・情報分析", side: "right", portrait: "guide", expression: "alert", text: "……聞こえますか。こちら移動拠点。応答を。", effect: "fade" }),
      Object.freeze({ speaker: "黒木 凛", role: "射撃手", side: "left", portrait: "ranger", expression: "focused", text: "黒木です。西新一帯、通信断。煙が三本上がっています。" }),
      Object.freeze({ speaker: "水城 奈々", role: "通信・地図・情報分析", side: "right", portrait: "guide", expression: "steady", text: "生体反応を確認。商店街の奥、まだ誰かがいます。" }),
      Object.freeze({ speaker: "橘 迅", role: "遊撃手", side: "left", portrait: "scout", expression: "alert", text: "上の通路は塞がれた。手信号で行く。静かすぎるな。" }),
      Object.freeze({ speaker: "白石 直人", role: "衛生兵", side: "right", portrait: "medic", expression: "steady", text: "反応が弱い。急がないと、救える命まで消えます。" }),
      Object.freeze({ speaker: "水城 奈々", role: "通信・地図・情報分析", side: "right", portrait: "guide", expression: "alert", text: "進路は三つ。商店街、区役所、それから西の防衛線。" }),
      Object.freeze({ speaker: "不明な無線", role: "断続通信", side: "left", portrait: "radio", expression: "alert", text: "……たすけ……シャッターの……向こう……", effect: "shake" }),
      Object.freeze({ speaker: "パイセン", role: "格闘家", side: "left", portrait: "brawler", expression: "ready", text: "聞こえたなら、行く理由は十分だ。扉を開けろ。" }),
      Object.freeze({ speaker: "水城 奈々", role: "通信・地図・情報分析", side: "right", portrait: "guide", expression: "steady", text: "移動拠点を接続。救助作戦を開始します。", effect: "fade" }),
    ]),
  }),
  "stage-nishijin-pre": Object.freeze({
    id: "stage-nishijin-pre",
    background: "shopping-street",
    lines: Object.freeze([
      Object.freeze({ speaker: "黒木 凛", role: "射撃手", side: "left", portrait: "ranger", expression: "focused", text: "アーケード奥で着弾音。感染拠点が脈打ってる。" }),
      Object.freeze({ speaker: "水城 奈々", role: "通信・地図・情報分析", side: "right", portrait: "guide", expression: "alert", text: "接近路は三本。中央に密集、両端から高速反応。" }),
      Object.freeze({ speaker: "橘 迅", role: "遊撃手", side: "left", portrait: "scout", expression: "ready", text: "上側は俺が走る。速い奴だけ先に借りるぞ。" }),
      Object.freeze({ speaker: "白石 直人", role: "衛生兵", side: "right", portrait: "medic", expression: "steady", text: "閉じた店内から咳。生存者です。火線を外して。" }),
      Object.freeze({ speaker: "パイセン", role: "格闘家", side: "left", portrait: "brawler", expression: "ready", text: "迅は上、凛は奥。白石は俺の背中から離れるな。" }),
      Object.freeze({ speaker: "パイセン", role: "格闘家", side: "left", portrait: "brawler", expression: "ready", text: "中央は俺が開ける。生きてる声まで拳を通すぞ。", effect: "shake" }),
    ]),
  }),
  "stage-nishijin-post": Object.freeze({
    id: "stage-nishijin-post",
    background: "shopping-street",
    lines: Object.freeze([
      Object.freeze({ speaker: "黒木 凛", role: "射撃手", side: "left", portrait: "ranger", expression: "focused", text: "感染拠点、沈黙。シャッターの向こうに呼吸音。" }),
      Object.freeze({ speaker: "白石 直人", role: "衛生兵", side: "right", portrait: "medic", expression: "alert", text: "返事があります。でも、扉が歪んで開かない。" }),
      Object.freeze({ speaker: "大庭 豪", role: "破砕兵", side: "left", portrait: "brute", expression: "grin", text: "そこを退け。扉なら、叩けば道になる。", effect: "shake" }),
      Object.freeze({ speaker: "パイセン", role: "格闘家", side: "right", portrait: "brawler", expression: "ready", text: "いい音だ。名前を聞く前に、もう一枚頼む。" }),
      Object.freeze({ speaker: "大庭 豪", role: "破砕兵", side: "left", portrait: "brute", expression: "grin", text: "大庭だ。壊す先を示せ。次は一緒に行く。", effect: "fade" }),
    ]),
  }),
  "stage-sawara-pre": Object.freeze({
    id: "stage-sawara-pre",
    background: "ward-office",
    lines: Object.freeze([
      Object.freeze({ speaker: "水城 奈々", role: "通信・地図・情報分析", side: "right", portrait: "guide", expression: "alert", text: "早良区役所前。救援車両が瓦礫で止まっています。" }),
      Object.freeze({ speaker: "白石 直人", role: "衛生兵", side: "left", portrait: "medic", expression: "steady", text: "先に重傷者を乗せる。歩ける人は壁際へ。" }),
      Object.freeze({ speaker: "大庭 豪", role: "破砕兵", side: "right", portrait: "brute", expression: "ready", text: "瓦礫は俺がどける。前から来る奴も同じだ。" }),
      Object.freeze({ speaker: "黒木 凛", role: "射撃手", side: "left", portrait: "ranger", expression: "focused", text: "庁舎屋上に吐瀉型。撃たれる前に落とします。" }),
      Object.freeze({ speaker: "水城 奈々", role: "通信・地図・情報分析", side: "right", portrait: "guide", expression: "alert", text: "全経路から接近。撤収車両が動くまで死守を。" }),
      Object.freeze({ speaker: "パイセン", role: "格闘家", side: "left", portrait: "brawler", expression: "ready", text: "三本とも通さない。帰る席は全員分ある。", effect: "shake" }),
    ]),
  }),
  "stage-sawara-post": Object.freeze({
    id: "stage-sawara-post",
    background: "ward-office",
    lines: Object.freeze([
      Object.freeze({ speaker: "水城 奈々", role: "通信・地図・情報分析", side: "right", portrait: "guide", expression: "relieved", text: "救援車両、離脱。追跡反応がまだ残っています。" }),
      Object.freeze({ speaker: "真壁 玲奈", role: "制圧射手", side: "left", portrait: "gunner", expression: "calm", text: "追わせない。火線を引くから、車両はそのまま。" }),
      Object.freeze({ speaker: "白石 直人", role: "衛生兵", side: "right", portrait: "medic", expression: "steady", text: "負傷者は全員乗った。失った人は、ここに残る。" }),
      Object.freeze({ speaker: "真壁 玲奈", role: "制圧射手", side: "left", portrait: "gunner", expression: "calm", text: "弾はある。次の戦線にも、この火線を持っていく。" }),
      Object.freeze({ speaker: "水城 奈々", role: "通信・地図・情報分析", side: "right", portrait: "guide", expression: "uneasy", text: "西の防衛線に巨大反応。周囲の無線が消えました。", effect: "fade" }),
    ]),
  }),
  "stage-takuya-pre": Object.freeze({
    id: "stage-takuya-pre",
    background: "defense-line",
    lines: Object.freeze([
      Object.freeze({ speaker: "水城 奈々", role: "通信・地図・情報分析", side: "right", portrait: "guide", expression: "uneasy", text: "西新防衛線。味方の発砲も、救難信号もありません。" }),
      Object.freeze({ speaker: "不明な無線", role: "途絶直前の記録", side: "left", portrait: "radio", expression: "alert", text: "……TAKUYA……来る……壁が、もたな……", effect: "shake" }),
      Object.freeze({ speaker: "橘 迅", role: "遊撃手", side: "left", portrait: "scout", expression: "focused", text: "冗談を言う空気じゃないな。足音が地面から来る。" }),
      Object.freeze({ speaker: "黒木 凛", role: "射撃手", side: "right", portrait: "ranger", expression: "focused", text: "取り巻きを剥がして頭を上げさせる。順番を崩さないで。" }),
      Object.freeze({ speaker: "真壁 玲奈", role: "制圧射手", side: "left", portrait: "gunner", expression: "calm", text: "大型は私が縫い止める。火線の前へ出ないで。" }),
      Object.freeze({ speaker: "大庭 豪", role: "破砕兵", side: "right", portrait: "brute", expression: "ready", text: "中央は俺が持つ。倒れた壁も、立て直す。" }),
      Object.freeze({ speaker: "パイセン", role: "格闘家", side: "left", portrait: "brawler", expression: "ready", text: "名前があるなら倒せる。西新を返してもらうぞ。", effect: "shake" }),
    ]),
  }),
  "stage-takuya-post": Object.freeze({
    id: "stage-takuya-post",
    background: "defense-line",
    lines: Object.freeze([
      Object.freeze({ speaker: "黒木 凛", role: "射撃手", side: "left", portrait: "ranger", expression: "focused", text: "TAKUYA、停止。……防衛線から足音が消えた。", effect: "shake" }),
      Object.freeze({ speaker: "水城 奈々", role: "通信・地図・情報分析", side: "right", portrait: "guide", expression: "steady", text: "巨大反応の消失を確認。感染拠点も沈黙しました。" }),
      Object.freeze({ speaker: "白石 直人", role: "衛生兵", side: "left", portrait: "medic", expression: "steady", text: "生存者を確認します。呼吸のある人から運んで。" }),
      Object.freeze({ speaker: "橘 迅", role: "遊撃手", side: "right", portrait: "scout", expression: "relieved", text: "静かだな。今だけは、この街の音を聞ける。" }),
      Object.freeze({ speaker: "水城 奈々", role: "通信・地図・情報分析", side: "right", portrait: "guide", expression: "alert", text: "待って。百道浜、福岡タワー方面から信号です。", effect: "fade" }),
      Object.freeze({ speaker: "パイセン", role: "格闘家", side: "left", portrait: "brawler", expression: "ready", text: "返事をしろ。助けを待つ声に、次は遅れない。" }),
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
