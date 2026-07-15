export const PROLOGUE_SYNOPSIS = Object.freeze({
  short: "早良区役所の救難信号を追い、封鎖された西新を突破する。だが同じ声が、誰もいない防衛線からも流れていた。",
  long: "感染拡大で孤立した西新・早良区。パイセンたちは商店街と区役所で生存者を救い、声を餌に人を誘う感染群と巨大変異個体TAKUYAを止めるため、西新防衛線へ向かう。",
});

function dialogue({ speaker, role, side, portrait, expression, text, effect }) {
  return Object.freeze({ speaker, role, side, portrait, expression, text, ...(effect ? { effect } : {}) });
}

function event(id, background, lines) {
  return Object.freeze({ id, background, lines: Object.freeze(lines.map(dialogue)) });
}

/**
 * Production dialogue for the 0.6.0 prologue.
 * The copy follows docs/SCENARIO_0.6.0_COMPLETE.md prologue-v5.
 */
export const STORY_EVENTS = Object.freeze({
  intro: event("intro", "nishijin-night", [
    { speaker: "不明な女性の無線", role: "早良区役所", side: "left", portrait: "radio", expression: "alert", text: "こちら早良区役所。怪我人がいます。応答を。", effect: "fade" },
    { speaker: "不明な女性の無線", role: "反復通信", side: "left", portrait: "radio", expression: "alert", text: "……怪我人がいます。応答を。", effect: "shake" },
    { speaker: "水城 奈々", role: "通信・地図・情報分析", side: "right", portrait: "guide", expression: "uneasy", text: "同じ部分が重なっています。" },
    { speaker: "黒木 凛", role: "射撃手", side: "left", portrait: "ranger", expression: "focused", text: "録音？" },
    { speaker: "水城 奈々", role: "通信・地図・情報分析", side: "right", portrait: "guide", expression: "steady", text: "途中からは。最初の送信は生です。" },
    { speaker: "パイセン", role: "格闘家", side: "left", portrait: "brawler", expression: "uneasy", text: "じゃあ、まだ誰かいるんすよね。" },
    { speaker: "橘 迅", role: "遊撃手", side: "left", portrait: "scout", expression: "focused", text: "道は？" },
    { speaker: "水城 奈々", role: "通信・地図・情報分析", side: "right", portrait: "guide", expression: "alert", text: "区役所へ抜ける道は商店街だけです。" },
    { speaker: "白石 直人", role: "衛生兵", side: "right", portrait: "medic", expression: "steady", text: "医療品を積み直します。選別が必要になる。" },
    { speaker: "パイセン", role: "格闘家", side: "left", portrait: "brawler", expression: "ready", text: "今なら、まだ間に合うかもしれない。" },
    { speaker: "水城 奈々", role: "通信・地図・情報分析", side: "right", portrait: "guide", expression: "steady", text: "進路を西新商店街へ。救助作戦を開始します。", effect: "fade" },
  ]),
  "stage-nishijin-pre": event("stage-nishijin-pre", "shopping-street", [
    { speaker: "橘 迅", role: "遊撃手", side: "left", portrait: "scout", expression: "alert", text: "動くな。" },
    { speaker: "パイセン", role: "格闘家", side: "right", portrait: "brawler", expression: "uneasy", text: "え？" },
    { speaker: "不明な男", role: "商店街の生存者", side: "left", portrait: "crazy-king", expression: "focused", text: "左足の前。細い線がある。" },
    { speaker: "パイセン", role: "格闘家", side: "right", portrait: "brawler", expression: "uneasy", text: "これ、踏んだら？" },
    { speaker: "不明な男", role: "商店街の生存者", side: "left", portrait: "crazy-king", expression: "steady", text: "看板が落ちる。お前なら、たぶん死ぬ。" },
    { speaker: "黒木 凛", role: "射撃手", side: "right", portrait: "ranger", expression: "focused", text: "姿を見せて。" },
    { speaker: "クレイジーキング", role: "狂戦士", side: "left", portrait: "crazy-king", expression: "ready", text: "止めた。燃料が減る。" },
    { speaker: "白石 直人", role: "衛生兵", side: "right", portrait: "medic", expression: "steady", text: "薬局の屋上に三人いますね。" },
    { speaker: "クレイジーキング", role: "狂戦士", side: "left", portrait: "crazy-king", expression: "focused", text: "大人二人、子ども一人。階段を巣が塞いだ。" },
    { speaker: "パイセン", role: "格闘家", side: "right", portrait: "brawler", expression: "uneasy", text: "一人で守ってたんすか。" },
    { speaker: "クレイジーキング", role: "狂戦士", side: "left", portrait: "crazy-king", expression: "steady", text: "中で扉を押さえてる奴がいる。" },
    { speaker: "橘 迅", role: "遊撃手", side: "right", portrait: "scout", expression: "focused", text: "呼び方は？" },
    { speaker: "クレイジーキング", role: "狂戦士", side: "left", portrait: "crazy-king", expression: "ready", text: "キングでいい。中央を壊せば階段が開く。" },
    { speaker: "黒木 凛", role: "射撃手", side: "right", portrait: "ranger", expression: "alert", text: "話は終わり。来る。", effect: "shake" },
  ]),
  "stage-nishijin-post": event("stage-nishijin-post", "shopping-street", [
    { speaker: "白石 直人", role: "衛生兵", side: "right", portrait: "medic", expression: "relieved", text: "三人とも歩けます。子どもも大丈夫。" },
    { speaker: "パイセン", role: "格闘家", side: "left", portrait: "brawler", expression: "relieved", text: "よかった……。" },
    { speaker: "大庭 豪", role: "商店街の生存者", side: "left", portrait: "brute", expression: "strained", text: "悪い。二人、手を貸してくれ。" },
    { speaker: "パイセン", role: "格闘家", side: "right", portrait: "brawler", expression: "uneasy", text: "重っ……これ、ずっと一人で？" },
    { speaker: "大庭 豪", role: "商店街の生存者", side: "left", portrait: "brute", expression: "steady", text: "屋上へ上がる道を残したかった。" },
    { speaker: "クレイジーキング", role: "狂戦士", side: "right", portrait: "crazy-king", expression: "steady", text: "こいつが離したら、階段ごと塞がってた。" },
    { speaker: "白石 直人", role: "衛生兵", side: "right", portrait: "medic", expression: "focused", text: "肩を傷めています。もう押さえなくていい。" },
    { speaker: "水城 奈々", role: "通信・地図・情報分析", side: "right", portrait: "guide", expression: "alert", text: "区役所の信号は続いています。経路は開通。" },
    { speaker: "大庭 豪", role: "破砕兵", side: "left", portrait: "brute", expression: "ready", text: "怪我人がいるなら行く。瓦礫はどける。" },
    { speaker: "クレイジーキング", role: "狂戦士", side: "left", portrait: "crazy-king", expression: "ready", text: "俺も行く。あの声が、まだ流れてる。" },
    { speaker: "パイセン", role: "格闘家", side: "right", portrait: "brawler", expression: "ready", text: "分かった。区役所へ急ぎましょう。", effect: "fade" },
  ]),
  "stage-sawara-pre": event("stage-sawara-pre", "ward-office", [
    { speaker: "クマバーソン", role: "弁当屋", side: "left", portrait: "kumaverson", expression: "alert", text: "歩ける人は南口！ 子どもと怪我人が先たい！" },
    { speaker: "パイセン", role: "格闘家", side: "right", portrait: "brawler", expression: "alert", text: "その人、こっちへ。白石さん！" },
    { speaker: "白石 直人", role: "衛生兵", side: "right", portrait: "medic", expression: "focused", text: "寝かせて。頭は動かさないで。" },
    { speaker: "クマバーソン", role: "弁当屋", side: "left", portrait: "kumaverson", expression: "steady", text: "あんたら、救難信号ば聞いて来たと？" },
    { speaker: "パイセン", role: "格闘家", side: "right", portrait: "brawler", expression: "steady", text: "はい。車が動かないって。" },
    { speaker: "クマバーソン", role: "弁当屋", side: "left", portrait: "kumaverson", expression: "alert", text: "その車たい。瓦礫が噛んどる。" },
    { speaker: "ババヤガ", role: "上階の射手", side: "right", portrait: "babayaga", expression: "focused", text: "クマ、北窓。今日は机が泳いでる。" },
    { speaker: "クマバーソン", role: "弁当屋", side: "left", portrait: "kumaverson", expression: "alert", text: "意味分からんけど北やな！" },
    { speaker: "橘 迅", role: "遊撃手", side: "right", portrait: "scout", expression: "focused", text: "上の射手、味方か？" },
    { speaker: "クマバーソン", role: "弁当屋", side: "left", portrait: "kumaverson", expression: "steady", text: "友達たい。だいぶ変やけど。" },
    { speaker: "ババヤガ", role: "精密射手", side: "right", portrait: "babayaga", expression: "steady", text: "聞こえています。" },
    { speaker: "真壁 玲奈", role: "撤収指揮", side: "left", portrait: "gunner", expression: "focused", text: "救援車両が動くまで三分。中央を空けて。" },
    { speaker: "パイセン", role: "格闘家", side: "right", portrait: "brawler", expression: "uneasy", text: "三分で全員乗れます？" },
    { speaker: "真壁 玲奈", role: "撤収指揮", side: "left", portrait: "gunner", expression: "steady", text: "足りません。でも車両はそれ以上もちません。", effect: "shake" },
  ]),
  "stage-sawara-post": event("stage-sawara-post", "ward-office", [
    { speaker: "白石 直人", role: "衛生兵", side: "right", portrait: "medic", expression: "relieved", text: "瓦礫の下の人も乗りました。呼吸があります。" },
    { speaker: "真壁 玲奈", role: "撤収指揮", side: "left", portrait: "gunner", expression: "uneasy", text: "……十秒、待って正解でした。" },
    { speaker: "白石 直人", role: "衛生兵", side: "right", portrait: "medic", expression: "steady", text: "結果が出たから言えることです。" },
    { speaker: "ババヤガ", role: "精密射手", side: "left", portrait: "babayaga", expression: "steady", text: "もしもし。無事です。牛乳は低脂肪。" },
    { speaker: "クマバーソン", role: "弁当屋", side: "right", portrait: "kumaverson", expression: "uneasy", text: "ほんとにそれだけ？" },
    { speaker: "ババヤガ", role: "精密射手", side: "left", portrait: "babayaga", expression: "steady", text: "それだけで済むのが家庭です。" },
    { speaker: "水城 奈々", role: "通信・地図・情報分析", side: "right", portrait: "guide", expression: "uneasy", text: "防衛線から、区役所と同じ声が出ています。" },
    { speaker: "パイセン", role: "格闘家", side: "left", portrait: "brawler", expression: "focused", text: "区役所の人は、もう全員出たんすよね。" },
    { speaker: "真壁 玲奈", role: "制圧射手", side: "right", portrait: "gunner", expression: "steady", text: "はい。あそこに救助を待つ人はいません。" },
    { speaker: "黒木 凛", role: "射撃手", side: "left", portrait: "ranger", expression: "focused", text: "なら、誰かを呼び寄せてる。" },
    { speaker: "クマバーソン", role: "前衛打撃", side: "right", portrait: "kumaverson", expression: "ready", text: "放っといたら、また誰か来るばい。" },
    { speaker: "ババヤガ", role: "精密射手", side: "left", portrait: "babayaga", expression: "ready", text: "クマが行くなら俺も行く。" },
    { speaker: "真壁 玲奈", role: "制圧射手", side: "right", portrait: "gunner", expression: "ready", text: "防衛線は私の責任です。案内します。", effect: "fade" },
  ]),
  "stage-takuya-pre": event("stage-takuya-pre", "defense-line", [
    { speaker: "黒木 凛", role: "射撃手", side: "left", portrait: "ranger", expression: "focused", text: "壁の向きが逆。" },
    { speaker: "橘 迅", role: "遊撃手", side: "right", portrait: "scout", expression: "focused", text: "外から守るためじゃないな。" },
    { speaker: "真壁 玲奈", role: "制圧射手", side: "left", portrait: "gunner", expression: "uneasy", text: "感染した隊員を、街へ出さないためです。" },
    { speaker: "不明な女性の無線", role: "反復通信", side: "right", portrait: "radio", expression: "alert", text: "こちら早良区役所。怪我人がいます。", effect: "shake" },
    { speaker: "白石 直人", role: "衛生兵", side: "right", portrait: "medic", expression: "focused", text: "同じ声です。" },
    { speaker: "ババヤガ", role: "精密射手", side: "left", portrait: "babayaga", expression: "focused", text: "息継ぎがない。人間じゃない。" },
    { speaker: "パイセン", role: "格闘家", side: "right", portrait: "brawler", expression: "uneasy", text: "……あいつが喋ってる。" },
    { speaker: "クレイジーキング", role: "狂戦士", side: "left", portrait: "crazy-king", expression: "focused", text: "喋ってない。腹の奥で鳴らしてる。" },
    { speaker: "真壁 玲奈", role: "制圧射手", side: "left", portrait: "gunner", expression: "uneasy", text: "退却命令が遅れました。ここに残った人は――" },
    { speaker: "パイセン", role: "格闘家", side: "right", portrait: "brawler", expression: "steady", text: "今は止めましょう。話は戻ってから聞きます。" },
    { speaker: "水城 奈々", role: "通信・地図・情報分析", side: "right", portrait: "guide", expression: "alert", text: "地下に巨大反応。上がってきます。" },
    { speaker: "真壁 玲奈", role: "制圧射手", side: "left", portrait: "gunner", expression: "ready", text: "配置について。来ます。", effect: "shake" },
  ]),
  "stage-takuya-post": event("stage-takuya-post", "defense-line", [
    { speaker: "水城 奈々", role: "通信・地図・情報分析", side: "right", portrait: "guide", expression: "relieved", text: "防衛線の感染反応、消失しました。" },
    { speaker: "黒木 凛", role: "射撃手", side: "left", portrait: "ranger", expression: "relieved", text: "……静かになった。" },
    { speaker: "白石 直人", role: "衛生兵", side: "right", portrait: "medic", expression: "steady", text: "これで、あの声に呼ばれる人はいません。" },
    { speaker: "真壁 玲奈", role: "制圧射手", side: "left", portrait: "gunner", expression: "uneasy", text: "遅くなりました。" },
    { speaker: "大庭 豪", role: "破砕兵", side: "right", portrait: "brute", expression: "steady", text: "帰ったら話せばいい。" },
    { speaker: "クマバーソン", role: "前衛打撃", side: "left", portrait: "kumaverson", expression: "steady", text: "おい、腹減っとんのか？" },
    { speaker: "パイセン", role: "格闘家", side: "right", portrait: "brawler", expression: "relieved", text: "減ってます。めちゃくちゃ。" },
    { speaker: "クマバーソン", role: "前衛打撃", side: "left", portrait: "kumaverson", expression: "grin", text: "とりあえず、うちの弁当食うていけや！" },
    { speaker: "水城 奈々", role: "通信・地図・情報分析", side: "right", portrait: "guide", expression: "alert", text: "待って。百道浜方面から新しい信号です。" },
    { speaker: "不明な無線", role: "百道浜避難所", side: "left", portrait: "radio", expression: "alert", text: "海側から感染体が来ています。聞こえますか。" },
    { speaker: "橘 迅", role: "遊撃手", side: "left", portrait: "scout", expression: "focused", text: "また反復か？" },
    { speaker: "水城 奈々", role: "通信・地図・情報分析", side: "right", portrait: "guide", expression: "steady", text: "違います。今のところ、生の通信です。" },
    { speaker: "パイセン", role: "格闘家", side: "left", portrait: "brawler", expression: "ready", text: "こちら移動拠点。聞こえています。今から行きます。" },
    { speaker: "不明な無線", role: "百道浜避難所", side: "right", portrait: "radio", expression: "relieved", text: "……よかった。待っています。", effect: "fade" },
  ]),
});

export function getStoryEvent(eventId) {
  return STORY_EVENTS[eventId] ?? null;
}

export function storyEventLog(eventId, throughIndex = Number.POSITIVE_INFINITY) {
  const selectedEvent = getStoryEvent(eventId);
  if (!selectedEvent) return [];
  return selectedEvent.lines.slice(0, Math.max(0, throughIndex + 1)).map((line, index) => ({
    id: `${eventId}:${index}`,
    speaker: line.speaker,
    role: line.role,
    text: line.text,
  }));
}
