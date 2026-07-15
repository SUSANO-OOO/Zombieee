export const STORY_SCRIPT_VERSION = "prologue-v5";

export const PROLOGUE_SYNOPSIS = Object.freeze({
  short: "早良区役所の救難信号を追い、封鎖された西新を突破する。だが同じ声が、誰もいない防衛線からも流れていた。",
  long: "感染拡大で孤立した西新・早良区。パイセンたちは商店街と区役所で生存者を救い、声を餌に人を誘う感染群と巨大変異個体TAKUYAを止めるため、西新防衛線へ向かう。",
});

export const REQUIRED_STORY_EVENT_IDS = Object.freeze([
  "prologue-opening",
  "prologue-operations-room",
  "stage-nishijin-pre",
  "stage-nishijin-battle-start",
  "stage-nishijin-battle-runner",
  "stage-nishijin-battle-spitter",
  "stage-nishijin-battle-distress-voice",
  "stage-nishijin-battle-base-exposed",
  "stage-nishijin-post",
  "stage-nishijin-defeat",
  "stage-nishijin-retry",
  "stage-sawara-pre",
  "stage-sawara-battle-start",
  "stage-sawara-battle-30",
  "stage-sawara-battle-60",
  "stage-sawara-battle-90",
  "stage-sawara-battle-120",
  "stage-sawara-battle-150",
  "stage-sawara-battle-success",
  "stage-sawara-post",
  "stage-sawara-defeat",
  "stage-sawara-retry",
  "stage-takuya-pre",
  "stage-takuya-battle-start",
  "stage-takuya-battle-mimic",
  "stage-takuya-battle-heavy",
  "stage-takuya-warning",
  "stage-takuya-phase-1",
  "stage-takuya-mimic-child",
  "stage-takuya-final",
  "stage-takuya-base-remains",
  "stage-takuya-post",
  "stage-takuya-defeat",
  "stage-takuya-defeat-after-boss",
  "stage-takuya-retry",
  "prologue-ending",
]);

export const REPLAY_STORY_EVENT_IDS = Object.freeze([
  "stage-nishijin-replay",
  "stage-sawara-replay",
  "stage-takuya-replay",
]);

export const STORY_EVENT_IDS = Object.freeze([
  ...REQUIRED_STORY_EVENT_IDS.slice(0, 11),
  REPLAY_STORY_EVENT_IDS[0],
  ...REQUIRED_STORY_EVENT_IDS.slice(11, 22),
  REPLAY_STORY_EVENT_IDS[1],
  ...REQUIRED_STORY_EVENT_IDS.slice(22, 35),
  REPLAY_STORY_EVENT_IDS[2],
  REQUIRED_STORY_EVENT_IDS[35],
]);

const SPEAKER_PROFILES = Object.freeze({
  "パイセン": { role: "格闘家", portrait: "brawler", side: "left" },
  "水城奈々": { role: "通信・地図・情報分析", portrait: "guide", side: "right" },
  "黒木凛": { role: "射撃手", portrait: "ranger", side: "right" },
  "橘迅": { role: "遊撃手", portrait: "scout", side: "left" },
  "白石直人": { role: "衛生兵", portrait: "medic", side: "right" },
  "大庭豪": { role: "破砕兵", portrait: "brute", side: "left" },
  "真壁玲奈": { role: "制圧射手", portrait: "gunner", side: "right" },
  "クレイジーキング": { role: "狂戦士", portrait: "crazy-king", side: "left" },
  "クマバーソン": { role: "前衛打撃", portrait: "kumaverson", side: "left" },
  "ババヤガ": { role: "精密射手", portrait: "babayaga", side: "right" },
  "不明な女性の無線": { role: "早良区役所", portrait: "radio", side: "left" },
  "不明な女性の声": { role: "反復通信", portrait: "radio", side: "left" },
  "不明な無線": { role: "百道浜避難所", portrait: "radio", side: "left" },
  "不明な男": { role: "商店街の生存者", portrait: "crazy-king", side: "left" },
  "不明な男の無線": { role: "上階の射手", portrait: "radio", side: "right" },
  "避難民": { role: "早良区役所避難民", portrait: "radio", side: "left" },
  "感染体の声": { role: "反復通信", portrait: "radio", side: "left" },
  "TAKUYAの声": { role: "巨大変異個体", portrait: "radio", side: "left" },
  "システム": { role: "章表示", portrait: "radio", side: "left" },
});

const STORY_EVENT_BACKGROUNDS = Object.freeze({
  "prologue-opening": "nishijin-night",
  "prologue-operations-room": "crawler-operations-room",
  "prologue-ending": "momochihama-signal",
  "stage-nishijin": "shopping-street",
  "stage-sawara": "ward-office",
  "stage-takuya": "defense-line",
});

function backgroundFor(eventId) {
  if (STORY_EVENT_BACKGROUNDS[eventId]) return STORY_EVENT_BACKGROUNDS[eventId];
  const prefix = Object.keys(STORY_EVENT_BACKGROUNDS).find((candidate) => eventId.startsWith(candidate));
  return prefix ? STORY_EVENT_BACKGROUNDS[prefix] : "nishijin-night";
}

function parseDialogue(source) {
  return source.trim().split("\n").filter(Boolean).map((row) => {
    const separator = row.indexOf("\t");
    if (separator < 1) throw new TypeError(`Invalid canonical dialogue row: ${row}`);
    return [row.slice(0, separator), row.slice(separator + 1)];
  });
}

function dialogue([speaker, text]) {
  const profile = SPEAKER_PROFILES[speaker];
  if (!profile) throw new RangeError(`Unknown canonical story speaker: ${speaker}`);
  return Object.freeze({
    speaker,
    role: profile.role,
    side: profile.side,
    portrait: profile.portrait,
    expression: "focused",
    text,
  });
}

function event(id, source) {
  return Object.freeze({
    id,
    scriptVersion: STORY_SCRIPT_VERSION,
    background: backgroundFor(id),
    lines: Object.freeze(parseDialogue(source).map(dialogue)),
  });
}

// Every fixed spoken line and ending title card is transcribed verbatim from
// docs/SCENARIO_0.6.0_COMPLETE.md prologue-v5. Display wrapping happens later.
const CANONICAL_EVENT_DIALOGUE = Object.freeze({
  "prologue-opening": `不明な女性の無線\tこちら早良区役所。救援車両が動きません。怪我人がいます。聞こえたら、返事を――
不明な女性の無線\t……怪我人がいます。聞こえたら、返事を――
水城奈々\t同じ部分が重なっています
黒木凛\t録音？
水城奈々\t途中からです。最初だけは録音じゃない
パイセン\tじゃあ、まだ誰かいるんすよね
水城奈々\t少なくとも、送った時点では
橘迅\t道は？
水城奈々\t区役所へ抜ける道は商店街だけです。中央が塞がれています
白石直人\t医療品を積み直します。足りないかもしれない
パイセン\t……行きましょう。今なら、まだ間に合うかもしれない`,
  "prologue-operations-room": `水城奈々\t商店街中央に大きな感染反応。薬局屋上に熱源が三つあります
黒木凛\t区役所だけじゃないのね
白石直人\t大人か子どもかは？
水城奈々\t映像がありません。動きは弱いです
橘迅\t俺が先に入る。通れる道だけ見て戻る
パイセン\t一人で行く気でしょ
橘迅\t見て戻るって言っただろ
黒木凛\t迅。三分で戻って。過ぎたら私たちも入る
橘迅\t分かった
パイセン\t……偽物の信号だったら、どうします？
水城奈々\t現地で判断します。でも屋上の反応は消えていません
パイセン\tなら、先にそっちを助けましょう`,
  "stage-nishijin-pre": `橘迅\t動くな
パイセン\tえ？
不明な男\t左足の前。細い線がある
パイセン\tこれ、踏んだら？
不明な男\t上の看板が落ちる。感染者なら潰れる。お前なら、たぶん死ぬ
黒木凛\t姿を見せて
クレイジーキング\tチェーンソーは止めた。燃料がもったいない
橘迅\tこの罠、あんたが？
クレイジーキング\t他に誰がいる
白石直人\t薬局の屋上に三人いますね
クレイジーキング\t大人二人、子ども一人。階段を巣が塞いだ
パイセン\t一人で守ってたんすか
クレイジーキング\t一人じゃない。中で扉を押さえてる奴がいる
橘迅\tあんた、名前は？
クレイジーキング\tキングでいい
パイセン\tキング……
クレイジーキング\t不満は生き残ってから聞く。中央を壊せば階段が開く
黒木凛\t話は終わり。来る
クレイジーキング\t右のシャッターには触るな。まだ詰まってる`,
  "stage-nishijin-battle-start": `クレイジーキング\t罠の線を越えるな。敵だけ通せ
橘迅\t上を回る。パイセン、中央を頼む
パイセン\t分かった。無茶すんなよ`,
  "stage-nishijin-battle-runner": `黒木凛\t上、速いのが二体
橘迅\t見えてる。一体だけ流す
パイセン\t一体でも流すなって！`,
  "stage-nishijin-battle-spitter": `黒木凛\t奥に吐く個体。顔を上げさせて
クレイジーキング\t俺が音を出す。寄ったら撃て`,
  "stage-nishijin-battle-distress-voice": `不明な女性の声\t……怪我人がいます。聞こえたら――
黒木凛\t前を見て
パイセン\t屋上の人じゃないんすか
水城奈々\t発信源は地上です。返事をしないで
白石直人\t本物なら、同じところで息をしない`,
  "stage-nishijin-battle-base-exposed": `水城奈々\t中心が開きました。今です
クレイジーキング\t道を作る。続け
パイセン\t中央、行くっす！
白石直人\tキング、左腕
クレイジーキング\t切れてない。動く
白石直人\t戦闘後に見ます。逃げないでください
クレイジーキング\t逃げる見た目に見えるか？`,
  "stage-nishijin-post": `白石直人\t大丈夫。少し脱水していますが、三人とも歩けます
パイセン\tよかった……
大庭豪\t悪い。二人、手を貸してくれ
パイセン\t重っ……これ、ずっと一人で？
大庭豪\t屋上へ上がる道を残したかった
クレイジーキング\tこいつが離したら、階段ごと塞がってた
白石直人\t肩を傷めています。もう押さえなくていい
大庭豪\t三人が出たなら、いい
水城奈々\t区役所の信号はまだ続いています。道は開きました
大庭豪\t怪我人がいるんだな
パイセン\tはい。俺たちは向かいます
大庭豪\tなら行く。瓦礫があれば、どける
クレイジーキング\t俺も行く。あの声が、まだ流れてる`,
  "stage-nishijin-defeat": `水城奈々\t移動拠点がもちません。撤退してください！
パイセン\t屋上の三人は？
白石直人\t今は戻るしかない。次で必ず開ける！`,
  "stage-nishijin-retry": `クレイジーキング\t次は中央から壊す。右へ寄せすぎるな
パイセン\t今度は屋上まで通す`,
  "stage-nishijin-replay": `クレイジーキング\t小さい巣が戻ってる。今のうちに潰す
パイセン\t屋上に反応は？
水城奈々\tありません。今回は拠点破壊だけです`,
  "stage-sawara-pre": `クマバーソン\t歩ける人は南口！ 子どもと怪我人が先たい！
パイセン\tその人、こっちへ。白石さん！
白石直人\t寝かせて。頭は動かさないで
クマバーソン\t助かった。あんたら、救難信号ば聞いて来たと？
パイセン\tはい。車が動かないって
クマバーソン\tその車たい。瓦礫が噛んどる
不明な男の無線\tクマ、北窓。二体。今日は机が泳いでる
クマバーソン\t意味分からんけど北やな！
橘迅\t上の射手、味方か？
クマバーソン\t友達たい。だいぶ変やけど
ババヤガ\t聞こえています
クマバーソン\tなら普通に喋れ！
真壁玲奈\t話は後。救援車両が動くまで三分です。中央を空けてください
パイセン\t三分で全員乗れます？
真壁玲奈\t足りません。でも車両はそれ以上もちません
白石直人\t重傷者から乗せます。歩ける人は最後
真壁玲奈\tそれでいきます。三方向、全部来ます
クマバーソン\t腹減っとる奴は後で言え！ 今は生き残れ！`,
  "stage-sawara-battle-start": `真壁玲奈\t中央に火線を通します。横切らないで
クマバーソン\t南口、詰めすぎるな！ 一列で行け！`,
  "stage-sawara-battle-30": `ババヤガ\t右上、吐く個体。クマ、鍋のふたみたいに伏せろ
クマバーソン\tフライパンしか持っとらん！
ババヤガ\tそれで十分`,
  "stage-sawara-battle-60": `避難民\t夫がまだ下にいます！
真壁玲奈\t今は掘れません。車両を先に――
パイセン\t豪さん、いけます？
大庭豪\t一人じゃ無理だ。二人来てくれ
白石直人\t私も行きます。真壁さん、十秒だけください
真壁玲奈\t……十秒。中央は私が持ちます`,
  "stage-sawara-battle-90": `クマバーソン\t出んでよかと？
ババヤガ\t帰った時の方が怖い。でも今は無理
ババヤガ\t左、落とした`,
  "stage-sawara-battle-120": `真壁玲奈\t一号車、前輪損傷。次を受けたら止まります
ババヤガ\t右上を落とす。クマ、車両前を空けろ。黒木、二発目を
黒木凛\t見えてる
クマバーソン\t前、空けるぞ！`,
  "stage-sawara-battle-150": `白石直人\t子どもの列へ一体！
パイセン\tさすがに許せないっす
橘迅\t脚を止める。正面を頼む
パイセン\t任せて！
真壁玲奈\t最後の担架、まだです！
クマバーソン\t俺が持つ！ 車は止めるな！
大庭豪\t反対側を持つ
ババヤガ\t左を片づける。走れ`,
  "stage-sawara-battle-success": `クマバーソン\t最後の一人、乗った！
水城奈々\t救援車両、発進しました
真壁玲奈\t追撃が来ます。ここで止めます`,
  "stage-sawara-post": `白石直人\t瓦礫の下の人も乗っています。重傷ですが、呼吸はあります
真壁玲奈\t……十秒、待って正解でした
白石直人\t結果が出たから言えることです。次も同じとは限りません
真壁玲奈\t分かっています
ババヤガ\tもしもし。無事です。牛乳は低脂肪。忘れてません
クマバーソン\tほんとにそれだけ？
ババヤガ\tそれだけで済むのが家庭です
水城奈々\t西新防衛線から、区役所と同じ救難音声が出ています
パイセン\t区役所の人は、もう全員出たんすよね
真壁玲奈\tはい。あそこに救助を待つ人はいません
黒木凛\tなら、誰かを呼び寄せてる
水城奈々\t断定はできません。でも音声は今も反復しています
クマバーソン\t放っといたら、また誰か来るばい
ババヤガ\tクマが行くなら俺も行く。一人にすると、弁当箱で殴り始める
クマバーソン\tフライパンたい
真壁玲奈\t防衛線は私が退却を遅らせた場所です。案内します
パイセン\t分かりました。戻ってから、話を聞かせてください`,
  "stage-sawara-defeat": `真壁玲奈\t車両が止まりました。これ以上は守れません！
クマバーソン\t避難民を庁舎へ戻す！ 先に下がれ！`,
  "stage-sawara-retry": `ババヤガ\t吐く個体を先に落とす。前輪へ近づけるな
クマバーソン\t今度は最後まで運ぶぞ`,
  "stage-sawara-replay": `真壁玲奈\t救援物資の回収車両です。前回と同じ経路を使います
クマバーソン\t今度は弁当やなくて水たい。積み終わるまで守るぞ`,
  "stage-takuya-pre": `黒木凛\t壁の向きが逆
橘迅\t外から守るためじゃないな
真壁玲奈\t感染した隊員を、街へ出さないためです
不明な女性の声\tこちら早良区役所。怪我人がいます――
白石直人\t同じ声です
ババヤガ\t息継ぎがない。人間じゃない
パイセン\t……あいつが喋ってる
クレイジーキング\t喋ってない。腹の奥で鳴らしてる
クマバーソン\t気色悪いな
真壁玲奈\t退却命令が遅れました。ここに残った人たちは――
パイセン\t今は止めましょう。話は戻ってから聞きます
水城奈々\t地下に大きな反応。上がってきます
真壁玲奈\t配置について。来ます`,
  "stage-takuya-battle-start": `真壁玲奈\t中央を厚く。左右は抜かれない程度で
黒木凛\t声を出す個体から落とす`,
  "stage-takuya-battle-mimic": `感染体の声\t……聞こえたら、返事を――
パイセン\tうるさい……
白石直人\t声じゃなく、目を見て。人間じゃない
黒木凛\tパイセン、前
パイセン\t分かってる`,
  "stage-takuya-battle-heavy": `大庭豪\t中央に重いのが来た
クマバーソン\t一人で持つな。俺も行く！
大庭豪\t助かる`,
  "stage-takuya-warning": `黒木凛\t下がる？
パイセン\t下がったら、また誰かがあの声を聞くんすよね
水城奈々\tそうなります
パイセン\t……もう、いいよ！ こいよ！`,
  "stage-takuya-phase-1": `クレイジーキング\t正面は硬い。脚から切る
真壁玲奈\t右膝へ集中。黒木、頭を上げさせないで
ババヤガ\tクマ、押さえろ。キング、右。パイセン、三秒だけ止めて
パイセン\t三秒、長いっす！
クマバーソン\t死ぬなよ！ あとで飯食わせるけん！`,
  "stage-takuya-mimic-child": `TAKUYAの声\t……おかあさん……
白石直人\t違う。そっちを見るな
パイセン\t……それ、さすがに許せないっす`,
  "stage-takuya-final": `ババヤガ\t口が開く。次で止める。射線を空けろ
黒木凛\t頭部、照準
真壁玲奈\t制圧開始
クレイジーキング\t入るぞ
クマバーソン\tパイセン、今たい！
パイセン\tあああああああうああ！`,
  "stage-takuya-base-remains": `水城奈々\t信号が残っています。奥の感染拠点が生きています
クレイジーキング\t親玉だけ倒して終わりじゃない
パイセン\t行くっす。ここまで来たんで`,
  "stage-takuya-post": `水城奈々\t西新防衛線の感染反応、消失しました
黒木凛\t……静かになった
白石直人\tこれで、あの声に呼ばれる人はいなくなる
真壁玲奈\t遅くなりました
大庭豪\t帰ったら話せばいい
クマバーソン\tおい、腹減っとんのか？
パイセン\t減ってます。めちゃくちゃ
クマバーソン\tとりあえず、うちの弁当食うていけや！
パイセン\t冷めてる
クマバーソン\t弁当は冷めても弁当たい
水城奈々\t待ってください。百道浜方面から新しい信号です
不明な無線\tこちら百道浜避難所。海側から感染体が来ています。聞こえますか
橘迅\tまた反復か？
水城奈々\t違います。音声が更新されています。今のところ、生の通信です
パイセン\tこちら移動拠点。聞こえています。今から向かいます
不明な無線\t……よかった。待っています
水城奈々\t進路を百道浜へ変更します`,
  "stage-takuya-defeat": `水城奈々\t防衛線を維持できません。撤退してください！
パイセン\tくそ……声を止められてない`,
  "stage-takuya-defeat-after-boss": `水城奈々\tTAKUYAは停止。でも感染拠点が移動拠点へ到達します！
真壁玲奈\t撤退。次は撃破後、全員で奥へ進みます`,
  "stage-takuya-retry": `ババヤガ\t脚を先に止める。口が開いたら射線を空けろ
パイセン\t今度は奥まで壊す`,
  "stage-takuya-replay": `水城奈々\t大型反応があります。前回と同一個体かは不明です
パイセン\t同じでも違っても、止めるしかないっすね`,
  "prologue-ending": `システム\t西新・早良区間　主要避難経路を確保
システム\t次の目的地　百道浜
システム\t序章　完`,
});

export const STORY_EVENTS = Object.freeze(Object.fromEntries(
  STORY_EVENT_IDS.map((eventId) => [eventId, event(eventId, CANONICAL_EVENT_DIALOGUE[eventId])]),
));

const LEGACY_STORY_EVENT_ALIASES = Object.freeze({ intro: "prologue-opening" });

export function getStoryEvent(eventId) {
  const resolvedId = LEGACY_STORY_EVENT_ALIASES[eventId] ?? eventId;
  return STORY_EVENTS[resolvedId] ?? null;
}

export function storyEventLog(eventId, throughIndex = Number.POSITIVE_INFINITY) {
  const selectedEvent = getStoryEvent(eventId);
  if (!selectedEvent) return [];
  return selectedEvent.lines.slice(0, Math.max(0, throughIndex + 1)).map((line, index) => ({
    id: `${selectedEvent.id}:${index}`,
    speaker: line.speaker,
    role: line.role,
    text: line.text,
  }));
}
