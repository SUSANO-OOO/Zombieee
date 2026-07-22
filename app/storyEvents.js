export const STORY_SCRIPT_VERSION = "outbreak-origin-v8";

export const PROLOGUE_SYNOPSIS = Object.freeze({
  short: "金曜夜、大衆居酒屋「くまや」から始まった崩壊を生き延び、放置車両CRAWLERを確保した。四十三日後、あなたは西新で救助と封鎖を指揮する。",
  long: "大衆居酒屋「くまや」の常連客だったあなたは、発生夜にパイセンたちと客を裏口へ逃がし、避難者、燃料、乗員、経路を整理して大型移動拠点CRAWLERを動かした。四十三日後、無言の指揮官として西新商店街から地下鉄封鎖区域までの作戦を決める。",
  skip: "発生夜、「くまや」の常連客だったあなたは客を避難させ、CRAWLERを確保した。四十三日後、全員があなたの作戦判断を待っている。",
});

const STORY_EVENT_ORDER = Object.freeze([
  "prologue-kumaya-v070",
  "prologue-collapse-montage-v070",
  "prologue-crawler-montage-v070",
  "crawler-signal-v070",
  "prologue-skip-summary-v070",
  "stage-nishijin-pre-v070",
  "stage-nishijin-alert-v070",
  "stage-nishijin-post-v070",
  "stage-nishijin-defeat-v070",
  "stage-nishijin-retry-v070",
  "stage-nishijin-replay-v070",
  "stage-sawara-pre-v070",
  "stage-sawara-alert-v070",
  "stage-sawara-post-v070",
  "stage-sawara-defeat-v070",
  "stage-sawara-retry-v070",
  "stage-sawara-replay-v070",
  "stage-takuya-pre-v070",
  "stage-takuya-warning-v070",
  "stage-takuya-final-v070",
  "stage-takuya-base-remains-v070",
  "stage-takuya-post-v070",
  "stage-takuya-defeat-v070",
  "stage-takuya-defeat-after-boss-v070",
  "stage-takuya-retry-v070",
  "stage-takuya-replay-v070",
  "station-briefing-v070",
  "stage-station-gate-pre-v070",
  "stage-station-gate-alert-v070",
  "stage-station-gate-post-v070",
  "stage-station-gate-defeat-v070",
  "stage-station-gate-retry-v070",
  "stage-station-gate-replay-v070",
  "stage-station-platform-pre-v070",
  "stage-station-platform-alert-v070",
  "stage-station-platform-post-v070",
  "stage-station-platform-defeat-v070",
  "stage-station-platform-retry-v070",
  "stage-station-platform-replay-v070",
  "stage-station-tunnel-pre-v070",
  "stage-station-tunnel-power-v070",
  "stage-station-escape-v070",
  "stage-station-tunnel-post-v070",
  "stage-station-tunnel-defeat-v070",
  "stage-station-tunnel-retry-v070",
  "stage-station-tunnel-replay-v070",
  "chapter-ending-v070",
]);

export const REPLAY_STORY_EVENT_IDS = Object.freeze(
  STORY_EVENT_ORDER.filter((eventId) => eventId.includes("-replay-v070")),
);

export const REQUIRED_STORY_EVENT_IDS = Object.freeze(
  STORY_EVENT_ORDER.filter((eventId) => !REPLAY_STORY_EVENT_IDS.includes(eventId)),
);

export const STORY_EVENT_IDS = STORY_EVENT_ORDER;

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

export const STORY_SPEAKER_PROFILES = deepFreeze({
  "パイセン": { role: "前衛", portrait: "brawler", side: "left", approvedPortrait: true },
  "ハチ": { role: "遊撃", portrait: "scout", side: "left", approvedPortrait: true },
  "ミズチ": { role: "射撃", portrait: "ranger", side: "right", approvedPortrait: true },
  "ナオ": { role: "救護・損害抑制", portrait: "medic", side: "right", approvedPortrait: true },
  "タタラ": { role: "対装甲・構造破壊", portrait: "brute", side: "left", approvedPortrait: true },
  "クレイジーキング": { role: "近接範囲殲滅", portrait: "crazy-king", side: "left", approvedPortrait: true },
  "クマバーソン": { role: "前衛打撃・調理", portrait: "kumaverson", side: "left", approvedPortrait: true },
  "ババヤガ": { role: "精密射撃", portrait: "babayaga", side: "right", approvedPortrait: true },
  "レイダー": { role: "連射・制圧", portrait: "gunner", side: "right", approvedPortrait: true },
  "ガンテツ": { role: "防衛重装", portrait: "guardian", side: "left", approvedPortrait: true },
  "モンキー": { role: "罠・妨害", portrait: "engineer", side: "right", approvedPortrait: true },
  "いくらちゃん": { role: "通信・地図・情報分析", portrait: "guide", side: "right", approvedPortrait: true },
  "テレビ音声": { role: "緊急報道", portrait: "radio", side: "right", approvedPortrait: true },
  "救難無線": { role: "西新商店街", portrait: "radio", side: "left", approvedPortrait: true },
  "不明な男": { role: "商店街の生存者", portrait: "radio", side: "left", approvedPortrait: true },
  "避難者の女性": { role: "早良区役所避難者", portrait: "radio", side: "left", approvedPortrait: true },
  "研究補助員": { role: "T計画研究補助", portrait: "radio", side: "right", approvedPortrait: true },
  "TAKUYA": { role: "大型特殊感染者", portrait: "radio", side: "left", approvedPortrait: true },
  "システム": { role: "画面字幕", portrait: "radio", side: "left", approvedPortrait: true },
});

function parseDialogue(source) {
  return source.trim().split("\n").filter(Boolean).map((row) => {
    const separator = row.indexOf("\t");
    if (separator < 1) throw new TypeError(`Invalid outbreak-origin-v8 dialogue row: ${row}`);
    return [row.slice(0, separator), row.slice(separator + 1)];
  });
}

function dialogue([speaker, text], mode) {
  const profile = STORY_SPEAKER_PROFILES[speaker];
  if (!profile) throw new RangeError(`Unknown outbreak-origin-v8 speaker: ${speaker}`);
  return {
    speaker,
    role: profile.role,
    side: profile.side,
    portrait: profile.portrait,
    expression: "focused",
    mode,
    text,
  };
}

function event(id, {
  title,
  chapter,
  scene,
  background,
  kind = "dialogue",
  music = "scene",
  ambience = [],
  silenceAfterMs = 0,
  objective = null,
  results = [],
  beats = [],
  battleBarks = [],
  playerPresence = "reported-to",
  source,
}) {
  const mode = kind === "montage" || kind === "summary" || kind === "result"
    ? "caption"
    : kind === "battle-alert"
      ? "bark"
      : "dialogue";
  return deepFreeze({
    id,
    scriptVersion: STORY_SCRIPT_VERSION,
    title,
    background,
    lines: parseDialogue(source).map((row) => dialogue(row, mode)),
    presentation: {
      kind,
      chapter,
      scene,
      background,
      visualSource: "approved-existing-or-radio-placeholder",
      characterVoice: false,
      music,
      ambience,
      silenceAfterMs,
      objective,
      results,
      beats,
      battleBarks,
      playerPresence,
    },
  });
}

function bark(trigger, lineIndexes, {
  speakerKind = null,
  requiresDeployed = true,
  requiredDeployedKinds = [],
  npcSupport = false,
  operator = false,
  mandatory = false,
} = {}) {
  return {
    trigger,
    lineIndexes,
    speakerKind,
    requiresDeployed,
    requiredDeployedKinds,
    npcSupport,
    operator,
    mandatory,
  };
}

const EVENT_DEFINITIONS = {
  "prologue-kumaya-v070": {
    title: "西新が終わった夜",
    chapter: "PROLOGUE",
    scene: "大衆居酒屋「くまや」・金曜日22:13",
    background: "nishijin-night",
    music: "daily-then-stop",
    ambience: ["客の話し声", "食器", "テレビ", "車", "雨", "悲鳴", "ガラス"],
    beats: [
      "プレイヤーは大衆居酒屋「くまや」の常連客として入店する",
      "プレイヤーが入口へ向かうパイセンの肩を掴んで止める",
      "プレイヤーが厨房側の退路を示す",
      "プレイヤーが最後尾を確認し、クマバーソンも連れて避難する",
    ],
    playerPresence: "silent-protagonist",
    source: `クマバーソン\t遅かったな！　席は取っとるぞ！
パイセン\t一個だけっす
ババヤガ\t聞かれる前に自白しましたね
パイセン\tまかないの融通っすよ
クマバーソン\t人の皿から取るな！　食いたきゃ十個作る！
パイセン\t結局食わせるんすね
ババヤガ\t今から帰ります。……まだ店です。帰る準備には入っています
ババヤガ\t分かったって。帰るばい
パイセン\t最後だけ素が出てるじゃないすか
ババヤガ\t家庭内では上場廃止です
クマバーソン\t意味分からんけん、早よ帰れ！
テレビ音声\t大学病院周辺で複数の傷害事件が発生し、警察が道路を封鎖しています
ババヤガ\t傷害事件だけで道路封鎖。少し変です
クマバーソン\t飯がまずくなるニュースは消せ！
パイセン\t事故っすかね
パイセン\t何すか――
パイセン\t……まずいですよ、これ
クマバーソン\t客は裏！　荷物は置け！　命より高いもんは後で拾え！
ババヤガ\t警察も救急も不通。地下鉄も止まっています
ババヤガ\t裏口を確認します
クマバーソン\t先に出ろ！　ここは俺が押さえる！
クマバーソン\t……その顔やめろ！　分かった、行くぞ！
パイセン\tあれ……死んでたよな
ババヤガ\t死んだままでいてほしかったですね
クマバーソン\t分からんでも走れる！　生きるぞ！`,
  },
  "prologue-collapse-montage-v070": {
    title: "西新崩壊",
    chapter: "PROLOGUE",
    scene: "発生夜・崩壊モンタージュ",
    background: "nishijin-night",
    kind: "montage",
    music: "silence",
    ambience: [],
    silenceAfterMs: 2000,
    beats: [
      "地下鉄入口のシャッターが閉まる",
      "感染した犬が路地を走る",
      "救急車内で死亡者が起き上がる",
      "早良区役所の照明が消える",
      "西新商店街へ火が回る",
      "スマートフォンへ緊急速報",
    ],
    playerPresence: "silent-observer",
    source: `システム\t福岡市内の大学病院から、新型ウイルスが流出した可能性。
システム\t感染は動物と人を伝い、早良区へ拡大。
システム\t感染者は死亡後に再び活動し、生者を襲った。
システム\t西新は、一夜で崩壊した。`,
  },
  "prologue-crawler-montage-v070": {
    title: "CRAWLER確保",
    chapter: "PROLOGUE",
    scene: "発生夜から四十三日後",
    background: "crawler-operations-room",
    kind: "montage",
    music: "crawler-montage",
    ambience: ["遠い感染者", "大型車両始動", "エンジン"],
    beats: [
      "プレイヤーが避難者の人数と退路を確認する",
      "放置された大型移動拠点CRAWLERを発見する",
      "プレイヤーが燃料、乗員、経路を整理し出発判断を行う",
      "四十三日後、全員が作戦卓でプレイヤーの判断を待つ",
    ],
    playerPresence: "silent-protagonist",
    source: `システム\t避難者の人数と退路を確認。
システム\t放置された大型移動拠点CRAWLERを発見。
システム\t燃料、乗員、経路を整理。出発。
システム\t発生から四十三日後。
システム\t西新世紀末物語`,
  },
  "crawler-signal-v070": {
    title: "発生から四十三日",
    chapter: "CHAPTER 1",
    scene: "走行中のCRAWLER・食堂兼作戦室",
    background: "crawler-operations-room",
    music: "crawler-life",
    ambience: ["大型エンジン", "食器", "工具", "遠い無線"],
    beats: [
      "プレイヤーが作戦卓へ近づく",
      "全報告がプレイヤーへ向く",
      "プレイヤーが西新商店街を選択し出撃を決定する",
    ],
    playerPresence: "silent-commander",
    source: `パイセン\tおはようございます。……朝で合ってます？
ババヤガ\t午前六時です。空が腐っているだけです
パイセン\t天気予報で聞きたくない表現っすね
クマバーソン\t空より飯見ろ！　冷めるぞ！
いくらちゃん\t指揮官。西新商店街から救難信号です
救難無線\t……薬局二階……五人……聞こえたら……
いくらちゃん\t送信は四分前。北口から進入できます
ババヤガ\t燃料は往復でぎりぎりです。帰りにCRAWLERを押すのは避けたい
クマバーソン\t押せば動く！
ババヤガ\tあなたは動かせても、車体が壊れます
パイセン\t指揮官。俺は行けます
パイセン\t……行くんすね
クマバーソン\t指揮官も食え！　腹減った命令は雑になる！`,
  },
  "prologue-skip-summary-v070": {
    title: "これまでの経緯",
    chapter: "PROLOGUE",
    scene: "スキップ固定要約",
    background: "crawler-operations-room",
    kind: "summary",
    music: "crawler-life",
    ambience: ["大型エンジン", "遠い無線"],
    playerPresence: "silent-protagonist",
    source: `システム\t発生夜、「くまや」の常連客だったあなたは、パイセンたちと客を裏口へ避難させた。
システム\t放置されたCRAWLERを確保し、避難者、燃料、乗員、経路を整理して出発した。
システム\t四十三日後、全員が指揮官であるあなたの作戦判断を待っている。`,
  },
  "stage-nishijin-pre-v070": {
    title: "西新商店街・作戦前",
    chapter: "STAGE 1",
    scene: "閉鎖された商店街",
    background: "shopping-street",
    music: "none-until-contact",
    ambience: ["雨", "看板の軋み", "遠い感染者"],
    objective: "感染拠点を破壊し、薬局二階の生存者を救出せよ",
    beats: ["プレイヤーが中央の進路へマーカーを置く"],
    playerPresence: "silent-commander",
    source: `不明な男\t止マレ
パイセン\t危な……これ、敵用っすよね？
クレイジーキング\t敵カ？
パイセン\t違いますよ！
クマバーソン\t返事できるなら味方たい！
クレイジーキング\t上、五人
クレイジーキング\t下、巣
クレイジーキング\t壊セ
パイセン\t指揮官、中央から開けます
クレイジーキング\t俺、切ル`,
  },
  "stage-nishijin-alert-v070": {
    title: "西新商店街・戦闘通信",
    chapter: "STAGE 1",
    scene: "戦闘中bark",
    background: "shopping-street",
    kind: "battle-alert",
    battleBarks: [
      bark("deploy", [0], { speakerKind: "brawler" }),
      bark("fast-enemy", [1], { speakerKind: "babayaga" }),
      bark("frontline-open", [2], { speakerKind: "kumaverson" }),
      bark("grouped-enemies", [3, 4], { speakerKind: "crazy-king", requiresDeployed: false, npcSupport: true }),
    ],
    source: `パイセン\tもう、いいよ！　来いよ！
ババヤガ\t右、高速個体。あれは経費にならん
クマバーソン\t前が空いとる！　押せ！
クレイジーキング\t集メロ
クレイジーキング\t切ル`,
  },
  "stage-nishijin-post-v070": {
    title: "西新商店街・救助",
    chapter: "STAGE 1",
    scene: "薬局二階",
    background: "shopping-street",
    music: "rescue-short",
    ambience: ["雨", "遠いCRAWLER"],
    results: [
      "生存者五名を救出",
      "大学病院の搬送箱を回収",
      "クレイジーキング加入・無料所有",
      "タタラの情報判明・調達可能",
      "Stage 2 早良区役所解放",
    ],
    beats: [
      "プレイヤーが大学病院の搬送箱回収を指示する",
      "クレイジーキングが次の招集判断をプレイヤーへ預ける",
    ],
    playerPresence: "silent-commander",
    source: `クマバーソン\t食えるやつ、手上げろ！
パイセン\tまず怪我を聞かないんすか
クマバーソン\t食えるか聞けば大体分かる！
クマバーソン\tゆっくり食え。誰も取らん
ババヤガ\t五人。全員います
パイセン\t……はい
ババヤガ\t大学病院の搬送箱です
クレイジーキング\t燃ヤス
クマバーソン\t待て！　燃やすのは中身を見てからたい！
ババヤガ\t順序の問題なんですね
いくらちゃん\t回収指示、了解。隔離区画へ運びます
クマバーソン\tお前も食え
クレイジーキング\t食ウ
クマバーソン\tよし！　味方たい！
ババヤガ\t審査が一食で終わりました
クレイジーキング\t指揮官。次、呼ベ`,
  },
  "stage-nishijin-defeat-v070": {
    title: "西新商店街・撤退",
    chapter: "STAGE 1",
    scene: "敗北",
    background: "shopping-street",
    music: "defeat",
    source: `クレイジーキング\t上、守ル
パイセン\t一回戻る！　次は連れて帰る！`,
  },
  "stage-nishijin-retry-v070": {
    title: "西新商店街・再戦",
    chapter: "STAGE 1",
    scene: "再戦",
    background: "shopping-street",
    source: `クレイジーキング\t巣、壊セ
パイセン\t今度は迷わないっす`,
  },
  "stage-nishijin-replay-v070": {
    title: "西新商店街・再調査",
    chapter: "STAGE 1",
    scene: "クリア後再戦",
    background: "shopping-street",
    source: `いくらちゃん\t薬局二階に救難反応なし。今回は感染拠点だけを再確認します
クレイジーキング\t巣、戻ッタ
パイセン\t救助済みを確認。拠点だけ壊すっす`,
  },
  "stage-sawara-pre-v070": {
    title: "早良区役所・作戦前",
    chapter: "STAGE 2",
    scene: "早良区役所前",
    background: "ward-office",
    music: "low-tension",
    ambience: ["不調なエンジン", "案内板", "遠い感染者"],
    objective: "避難車両の始動まで防衛せよ",
    beats: [
      "研究資料より負傷者を優先するプレイヤーが担架を指す",
      "プレイヤーがもう一度担架を指し、研究補助員に運ばせる",
    ],
    playerPresence: "silent-commander",
    source: `避難者の女性\t子どもからでいいです
クマバーソン\t子どもはもう食いよる。これはあんたの分たい
避難者の女性\tでも、足りないでしょう
クマバーソン\t足りんかったら俺が食わん！　ほら、持て！
ババヤガ\t始動まで三分。音で周囲の感染者が寄ります
パイセン\t三分守ればいいんすね
ババヤガ\t三分を短いと思える人生なら、幸せでしたね
研究補助員\tあなたが指揮官ですね。これを車両へ。大学病院の研究記録です
ババヤガ\t指揮官は、負傷者が先だと
研究補助員\tこの資料を失えば、原因の特定が――
クマバーソン\t箱は歩かん！　お前は歩ける！　担架持て！
研究補助員\t……分かりました
ババヤガ\t来ます。話の続きは、生き残ってからです`,
  },
  "stage-sawara-alert-v070": {
    title: "早良区役所・戦闘通信",
    chapter: "STAGE 2",
    scene: "戦闘中bark",
    background: "ward-office",
    kind: "battle-alert",
    battleBarks: [
      bark("convoy-start", [0], { speakerKind: "brawler" }),
      bark("convoy-start", [1], { speakerKind: "babayaga" }),
      bark("heavy-enemy", [2], { speakerKind: "kumaverson" }),
      bark("heavy-enemy", [3, 4], { speakerKind: "crazy-king" }),
      bark("defense-30-remaining", [5], { speakerKind: "babayaga" }),
      bark("convoy-critical", [6], { speakerKind: "brawler", mandatory: true }),
    ],
    source: `パイセン\t一発でかからないんすか！
ババヤガ\t一発でかかるなら、三分も守りません
クマバーソン\tでかいの来たぞ！　前、空けろ！
クレイジーキング\t硬イ
クレイジーキング\t切ル
ババヤガ\t残り三十秒。妻の説教なら、まだ前置きです
パイセン\t車両が持たない！　前を止める！`,
  },
  "stage-sawara-post-v070": {
    title: "早良区役所・T-01",
    chapter: "STAGE 2",
    scene: "CRAWLER簡易診療区画",
    background: "crawler-operations-room",
    music: "none",
    ambience: ["大型エンジン", "医療器具"],
    results: [
      "避難車両の護衛に成功",
      "T計画の研究記録を回収",
      "レイダーの情報判明・調達可能",
      "Stage 3 西新防衛線・TAKUYA解放",
    ],
    beats: [
      "プレイヤーがクマバーソンと研究補助員の間へ入る",
      "プレイヤーが西新防衛線を次の目的地に指定する",
    ],
    playerPresence: "silent-commander",
    source: `研究補助員\tT計画。心停止後の脳と身体を、もう一度つなぐ研究でした
ナオ\tつながったのは？
研究補助員\t……身体だけです
パイセン\tあの夜、病院から何が出たんすか
研究補助員\t事故でした。私たちも止めようと――
ババヤガ\t言い換えると耳触りはよくなります。結果はそのままです
いくらちゃん\t指揮官。移送記録があります。T-01、西新防衛線へ移送。途中で失敗
パイセン\t知ってる人？
クマバーソン\t……拓也や
研究補助員\tT-01は、最初に長時間の再活動を示した――
クマバーソン\t番号で呼ぶな
研究補助員\t……
クマバーソン\t名前あるやろ
研究補助員\t……拓也さんです
いくらちゃん\t西新防衛線に大型反応。移送失敗地点と一致します
クマバーソン\t指揮官。俺も行く
ババヤガ\t救命の可能性は低いです
クマバーソン\t分かっとる。分かっとるけど、他人に終わったって決められたくない
パイセン\t一緒に行くっす
クマバーソン\tお前は言わんでも来るやろ`,
  },
  "stage-sawara-defeat-v070": {
    title: "早良区役所・撤退",
    chapter: "STAGE 2",
    scene: "敗北",
    background: "ward-office",
    music: "defeat",
    source: `ババヤガ\t車両は捨てません。人を庁舎へ戻します
クマバーソン\t次は動かす！　全員、生きて待っとけ！`,
  },
  "stage-sawara-retry-v070": {
    title: "早良区役所・再戦",
    chapter: "STAGE 2",
    scene: "再戦",
    background: "ward-office",
    source: `パイセン\t三分。今度は通さないっす`,
  },
  "stage-sawara-replay-v070": {
    title: "早良区役所・再護衛",
    chapter: "STAGE 2",
    scene: "クリア後再戦",
    background: "ward-office",
    source: `いくらちゃん\t避難者は移送済み。今回は回収車両の護衛です
ババヤガ\t三分。前回と同じなら、嫌な意味で親切ですね
クマバーソン\t水も飯も積む！　車両は通すぞ！`,
  },
  "stage-takuya-pre-v070": {
    title: "西新防衛線・TAKUYA",
    chapter: "STAGE 3",
    scene: "破壊された西新防衛線",
    background: "defense-line",
    music: "restrained-approach",
    ambience: ["風", "金属板", "重い呼吸"],
    objective: "TAKUYAを制圧せよ",
    beats: [
      "クマバーソンが端末の写真と遠くのTAKUYAを見比べる",
      "クマバーソンが前に出すぎた時の判断をプレイヤーへ預ける",
      "プレイヤーが戦闘開始を決定する",
    ],
    playerPresence: "silent-commander",
    source: `クマバーソン\t拓也は酒弱かった。二杯で寝るくせに、毎回三杯頼みよった
パイセン\t……
クマバーソン\t無理に何か言わんでよか
クレイジーキング\t大キイ
クレイジーキング\t切ル？
クマバーソン\tまだ
クマバーソン\t指揮官。俺が前に出すぎたら止めろ
パイセン\tそれ、俺の仕事じゃないすか
クマバーソン\tお前は一緒に出るやろ
ババヤガ\t配置に欠陥がありますね
いくらちゃん\t指揮官の合図で開始。先に周囲の小型を減らします`,
  },
  "stage-takuya-warning-v070": {
    title: "TAKUYA・戦闘通信",
    chapter: "STAGE 3",
    scene: "戦闘中bark",
    background: "defense-line",
    kind: "battle-alert",
    music: "boss-after-three-steps",
    battleBarks: [
      bark("takuya-entrance", [0], { speakerKind: "kumaverson" }),
      bark("takuya-approach", [1, 2], {
        speakerKind: "brawler",
        requiredDeployedKinds: ["brawler", "kumaverson"],
      }),
      bark("right-shoulder-exposed", [3], { speakerKind: "babayaga" }),
      bark("right-shoulder-exposed", [4], { speakerKind: "crazy-king" }),
      bark("kumaverson-critical", [5, 6], { speakerKind: "brawler", mandatory: true }),
    ],
    source: `クマバーソン\t拓也！
パイセン\tクマバーソン、下がって！
クマバーソン\t分かっとる！
ババヤガ\t右肩、開きました。数字が合わん。今です
クレイジーキング\t開イタ
クマバーソン\tどけ！　死ぬぞ！
パイセン\t一人で決めんな！`,
  },
  "stage-takuya-final-v070": {
    title: "TAKUYA・最終局面",
    chapter: "STAGE 3",
    scene: "最終弱点露出",
    background: "defense-line",
    music: "silence",
    ambience: ["風", "重い呼吸"],
    beats: [
      "クマバーソンが最後の判断をプレイヤーへ預ける",
      "既存総攻撃操作または自動最終フェーズへ接続し、選択肢を追加しない",
    ],
    playerPresence: "silent-commander",
    source: `クマバーソン\t拓也
クマバーソン\t……頼む
クレイジーキング\t終ワラセル`,
  },
  "stage-takuya-base-remains-v070": {
    title: "TAKUYA停止・感染拠点残存",
    chapter: "STAGE 3",
    scene: "ボス撃破後の必須警告",
    background: "defense-line",
    kind: "battle-alert",
    battleBarks: [
      bark("boss-defeated-base-remains", [0, 1, 2], {
        requiresDeployed: false,
        operator: true,
        mandatory: true,
      }),
    ],
    source: `いくらちゃん\tTAKUYA停止。感染拠点はまだ生きています
ババヤガ\t残存・後続反応あり。前を止めます
パイセン\t指揮官、奥まで行くっす`,
  },
  "stage-takuya-post-v070": {
    title: "西新防衛線・帰還判断",
    chapter: "STAGE 3",
    scene: "倒れたTAKUYAと輸送車両",
    background: "defense-line",
    music: "ambient-only",
    ambience: ["風", "金属板"],
    results: [
      "西新防衛線を突破",
      "TAKUYAを制圧",
      "病院と西新駅を結ぶ地下輸送経路を発見",
      "西新駅地下区域を解放",
    ],
    beats: [
      "クマバーソンが患者バンドを持ち帰る",
      "プレイヤーが帰還を決定する",
    ],
    playerPresence: "silent-commander",
    source: `ババヤガ\t持って帰りますか
クマバーソン\t持って帰る。ツケも残っとる
パイセン\t最後まで払わせるんすか
クマバーソン\t当たり前たい
いくらちゃん\t指揮官。病院から西新駅の保守線へ、試料と研究機材を運んだ記録です
ババヤガ\t防衛線で止まった箱は一部だけ。残りは地下ですね
パイセン\t次は西新駅？
クマバーソン\t今日は帰る
クマバーソン\t怪我人もおる。弾も飯も足りん。雑に行ったら拓也に笑われる
パイセン\t……帰って、準備してから行く
ババヤガ\t学習しましたね
クレイジーキング\t遅イ
パイセン\t急に喋ったと思ったらそれ！？`,
  },
  "stage-takuya-defeat-v070": {
    title: "西新防衛線・撤退",
    chapter: "STAGE 3",
    scene: "敗北",
    background: "defense-line",
    music: "defeat",
    source: `クマバーソン\t拓也は逃げん。俺らが戻ってくる！
パイセン\t全員で戻るっす！`,
  },
  "stage-takuya-defeat-after-boss-v070": {
    title: "TAKUYA停止後・撤退",
    chapter: "STAGE 3",
    scene: "感染拠点到達による敗北",
    background: "defense-line",
    music: "defeat",
    source: `いくらちゃん\tTAKUYAは停止。でも感染拠点がCRAWLERへ到達します
クマバーソン\t拓也は止めた。次は奥まで壊す
パイセン\t全員で戻って、今度こそ終わらせるっす`,
  },
  "stage-takuya-retry-v070": {
    title: "西新防衛線・再戦",
    chapter: "STAGE 3",
    scene: "再戦",
    background: "defense-line",
    source: `クレイジーキング\t右、壊ス
クマバーソン\t今度こそ、ちゃんと終わらせる`,
  },
  "stage-takuya-replay-v070": {
    title: "西新防衛線・再調査",
    chapter: "STAGE 3",
    scene: "クリア後再戦",
    background: "defense-line",
    source: `いくらちゃん\t防衛線に大型反応。地下輸送経路の再調査を行います
クマバーソン\t拓也やない。名前で呼ぶ相手は、もうおらん
パイセン\t指揮官。残った反応だけ止めるっす`,
  },
  "station-briefing-v070": {
    title: "地下へ",
    chapter: "INTERLUDE",
    scene: "CRAWLER作戦室",
    background: "crawler-operations-room",
    music: "low-percussion",
    ambience: ["大型エンジン", "紙", "端末", "遠い調理音"],
    beats: ["プレイヤーが西新駅を次の作戦地点に指定する"],
    playerPresence: "silent-commander",
    source: `いくらちゃん\t指揮官。病院から駅へ運ばれた箱は二十三。防衛線で見つかったのは七です
ババヤガ\t残り十六。人間の嫌いな算数ですね
モンキー\t地上の連中。算数が終わったら聞け。改札奥に七人いる
いくらちゃん\t所属と名前を
モンキー\t地下のモンキー。入口を押さえてる盾持ちがいる。そいつが礼儀正しく死のうとしてる
ガンテツ\t死ぬ予定はありません
モンキー\t予定表どおりに死ぬ奴がおるか
ガンテツ\t生存者七名。歩行不能二名、出血一名、子ども一名。私は数に入れなくて結構です
ナオ\t入れる。生きてるから
クマバーソン\t食える人は？
モンキー\tそれ今聞くか？
クマバーソン\t食えん人間は先に診てもらわないかん！
ガンテツ\t全員、少量なら食べられます
クマバーソン\tよし。八人分持つ！
パイセン\t行くんすね
ババヤガ\t妻なら絶対に行くなと言います
パイセン\tじゃあ残るんすか
ババヤガ\t行きます。怒られる理由が一つ増えるだけです`,
  },
  "stage-station-gate-pre-v070": {
    title: "西新駅・改札区域",
    chapter: "STAGE 4",
    scene: "西新駅入口",
    background: "station-gate",
    music: "none-until-contact",
    ambience: ["換気扇", "漏水", "遠い警報", "金属音"],
    objective: "感染中継点を破壊し、生存者の退路を確保せよ",
    beats: ["プレイヤーが感染中継点へマーカーを置く"],
    playerPresence: "silent-commander",
    source: `ガンテツ\t指揮官ですか。足元に血があります。止まってください
パイセン\t七人分？
ガンテツ\t忘れないためです
ナオ\tあなたの傷は
ガンテツ\t生存者を出した後に
ナオ\tあなたも生存者
いくらちゃん\t改札中央に病院の搬送箱。感染組織が周囲へ広がっています
クレイジーキング\t改札、切ル？
ガンテツ\t必要な箇所以外は残してください
クレイジーキング\t難シイ
ガンテツ\t開けます。三十秒後に閉めます`,
  },
  "stage-station-gate-alert-v070": {
    title: "改札区域・戦闘通信",
    chapter: "STAGE 4",
    scene: "戦闘中bark",
    background: "station-gate",
    kind: "battle-alert",
    battleBarks: [
      bark("grappler-seen", [0], { speakerKind: "ranger" }),
      bark("grappler-grab", [1], { speakerKind: "guardian", requiresDeployed: false, npcSupport: true, mandatory: true }),
      bark("container-exposed", [2], { speakerKind: "crazy-king" }),
      bark("container-exposed", [3], { speakerKind: "brute" }),
    ],
    source: `ミズチ\t長腕。付け根を撃つ
ガンテツ\t引かないでください。関節が持ちません
クレイジーキング\t箱、見エタ
タタラ\t外装だけ落とす。中は残す`,
  },
  "stage-station-gate-post-v070": {
    title: "改札区域・救助",
    chapter: "STAGE 4",
    scene: "駅務室前",
    background: "station-gate-rescue-cut",
    music: "rescue-short",
    results: [
      "生存者七名を救出",
      "改札区域を確保",
      "ガンテツ加入・無料所有",
      "Stage 5 ホーム／線路区域解放",
    ],
    beats: [
      "プレイヤーがガンテツをCRAWLER側へ下がらせる",
      "救助は感染中継点破壊後に自動成立する",
    ],
    playerPresence: "silent-commander",
    source: `ナオ\t七人、全員出せる。二人は担架
パイセン\t消さないんすか
ガンテツ\t地上へ着いた報告を受けてからです
モンキー\tガンテツ。返事一回
ガンテツ\t生存。七名救助。指揮官の部隊と合流しました
モンキー\tなら次。ホームに五人。保守台車で待ってる
クマバーソン\t食えるか？
モンキー\tその質問、先に来るようになったな。全員食える
クマバーソン\tよし！
ガンテツ\t承知しました。傷の処置後、再合流します
ナオ\t五針。値切らない
ガンテツ\tまだ何も言っていません`,
  },
  "stage-station-gate-defeat-v070": {
    title: "改札区域・撤退",
    chapter: "STAGE 4",
    scene: "敗北",
    background: "station-gate",
    music: "defeat",
    source: `ガンテツ\tシャッターを閉めます。生存者は私が守ります`,
  },
  "stage-station-gate-retry-v070": {
    title: "改札区域・再戦",
    chapter: "STAGE 4",
    scene: "再戦",
    background: "station-gate",
    source: `クレイジーキング\t長腕、先`,
  },
  "stage-station-gate-replay-v070": {
    title: "改札区域・再掃討",
    chapter: "STAGE 4",
    scene: "クリア後再戦",
    background: "station-gate",
    source: `いくらちゃん\t救助者はCRAWLERへ収容済み。改札区域の再汚染を除去します
ガンテツ\t盾の名前は消しません。守れた記録です
クレイジーキング\t長腕、先`,
  },
  "stage-station-platform-pre-v070": {
    title: "西新駅・ホーム／線路区域",
    chapter: "STAGE 5",
    scene: "暗いホーム",
    background: "station-platform-escort-cut",
    music: "mechanical-low-rhythm",
    ambience: ["レールの軋み", "変電設備", "漏水"],
    objective: "ホームを制圧し、感染拠点を破壊せよ",
    beats: ["プレイヤーが感染拠点へ攻撃マーカーを置き、戦闘後の搬送路を確保する"],
    playerPresence: "silent-commander",
    source: `モンキー\t触るな
パイセン\tまだ触ってないっす
モンキー\t顔が触ってる
ガンテツ\tこちらが指揮官です
モンキー\t見れば分かる。周りが勝手に報告し始める顔だ
モンキー\t人が五人。箱は水、薬、バッテリー、病院の記録。人は絶対落とすな
モンキー\t全部持って帰る気か。腰を壊すぞ
クマバーソン\t腰は飯じゃ治らんぞ！
ナオ\t私でも治せない
パイセン\t急に全員現実的っすね`,
  },
  "stage-station-platform-alert-v070": {
    title: "ホーム／線路区域・戦闘通信",
    chapter: "STAGE 5",
    scene: "戦闘中bark",
    background: "station-platform",
    kind: "battle-alert",
    battleBarks: [
      bark("ooze-seen", [0], { requiresDeployed: false, operator: true }),
      bark("ooze-seen", [1], { speakerKind: "engineer", requiresDeployed: false, npcSupport: true }),
      bark("sprinter-seen", [2], { speakerKind: "scout" }),
      bark("cart-stalled", [3], { speakerKind: "engineer", requiresDeployed: false, npcSupport: true, mandatory: true }),
      bark("cart-stalled", [4, 5, 6], { speakerKind: "babayaga", mandatory: true }),
    ],
    source: `いくらちゃん\t中央、床が変色。広がります
モンキー\t赤灯の内側へ入るな！
ハチ\t速いの、後ろで取る
モンキー\t二十秒！
ババヤガ\t先ほどは三十秒でした
モンキー\t十秒はもう使った！
ババヤガ\t数字が合いました`,
  },
  "stage-station-platform-post-v070": {
    title: "ホーム／線路区域・輸送記録",
    chapter: "STAGE 5",
    scene: "反対側の保守室",
    background: "station-platform",
    music: "none",
    ambience: ["変電設備", "漏水"],
    results: [
      "生存者五名を救出",
      "地下輸送記録を回収",
      "モンキーと共闘状態を継続",
      "Stage 6 保守トンネル／封鎖区域解放",
    ],
    beats: [
      "プレイヤーが封鎖地点を次の作戦として登録する",
      "即座に次の戦闘へ入らず、休息と補給を行う",
    ],
    playerPresence: "silent-commander",
    source: `ナオ\t生存者五名、全員上げられる
モンキー\t人は？
パイセン\t全員いるっす
モンキー\tならいい
いくらちゃん\t指揮官。病院と保守トンネルを結ぶ輸送線です。地上へ出た感染反応も、この経路と一致します
モンキー\t封鎖扉は動かせる。電源を三つ、順番に入れる。ただし動かした瞬間、奥の群れも起きる
ガンテツ\t生存者は救出しました。ここで撤退も選べます
ナオ\t一度休む。水を飲む。弾を数える。それから行く
パイセン\t了解っす`,
  },
  "stage-station-platform-defeat-v070": {
    title: "ホーム／線路区域・撤退",
    chapter: "STAGE 5",
    scene: "敗北",
    background: "station-platform",
    music: "defeat",
    source: `モンキー\t台車を捨てる！　人だけ連れて戻る！`,
  },
  "stage-station-platform-retry-v070": {
    title: "ホーム／線路区域・再戦",
    chapter: "STAGE 5",
    scene: "再戦",
    background: "station-platform",
    source: `モンキー\t床を汚す奴から落とせ`,
  },
  "stage-station-platform-replay-v070": {
    title: "ホーム／線路区域・再掃討",
    chapter: "STAGE 5",
    scene: "クリア後再戦",
    background: "station-platform",
    source: `いくらちゃん\t生存者は地上へ移送済み。残った物資を保守台車で回収します
モンキー\t人は乗せない。だからって台車を壊すなよ
パイセン\t今度は工具箱も触らないっす`,
  },
  "stage-station-tunnel-pre-v070": {
    title: "西新駅・保守トンネル／封鎖区域",
    chapter: "STAGE 6",
    scene: "保守トンネル",
    background: "station-tunnel",
    music: "irregular-machinery",
    ambience: ["放電", "レールの振動", "遠い群れ"],
    objective: "三つの電源を起動し、感染流出路を封鎖せよ",
    beats: [
      "プレイヤーが電源盤、退路、改札喰い側面へ順にマーカーを置く",
      "帰還命令で全員が下がることを確認する",
    ],
    playerPresence: "silent-commander",
    source: `モンキー\t一、二、三。順番を飛ばすな。途中で止めたら全部開く
ババヤガ\t実に嫌な設計です
モンキー\t作った奴に言え。生きてたら俺も言う
クレイジーキング\tデカイ
クレイジーキング\t切ル？
タタラ\t外装だけ。中の容器は切るな
クレイジーキング\t中、切ラナイ
ガンテツ\t最後に残る者は決めません。指揮官の帰還命令で全員下がります
パイセン\t今度は守るんすね
ガンテツ\t努力します`,
  },
  "stage-station-tunnel-power-v070": {
    title: "保守トンネル・電源／封鎖通信",
    chapter: "STAGE 6",
    scene: "戦闘中bark",
    background: "station-tunnel",
    kind: "battle-alert",
    battleBarks: [
      bark("power-1-activated", [0], { speakerKind: "engineer", requiresDeployed: false, npcSupport: true, mandatory: true }),
      bark("gate-eater-charge", [1], { speakerKind: "guardian", mandatory: true }),
      bark("gate-eater-flank", [2], { speakerKind: "ranger" }),
      bark("power-2-activated", [3], { speakerKind: "gunner" }),
      bark("research-container-exposed", [4], { speakerKind: "crazy-king" }),
      bark("power-3-activated", [5], { speakerKind: "engineer", requiresDeployed: false, npcSupport: true, mandatory: true }),
      bark("return-window-open", [6], { requiresDeployed: false, operator: true, mandatory: true }),
    ],
    source: `モンキー\t一番、入った！
ガンテツ\t受けます。側面を狙ってください
ミズチ\t側面、入る
レイダー\t右を止める。四つで撃って
クレイジーキング\t中、切ラナイ
モンキー\t三番、入った！　封鎖開始！
いくらちゃん\t退路、四十五秒。全員戻って`,
  },
  "stage-station-escape-v070": {
    title: "全員帰還",
    chapter: "STAGE 6",
    scene: "封鎖扉・帰還",
    background: "station-tunnel-containment-cut",
    music: "silence-after-seal",
    ambience: ["呼吸", "機械停止音"],
    silenceAfterMs: 2500,
    beats: [
      "プレイヤーがガンテツへ帰還マーカーを置く",
      "全員が退路へ戻る",
      "改札喰いを撃破し、確保した研究容器を封鎖扉の向こうへ収める",
    ],
    playerPresence: "silent-commander",
    source: `ガンテツ\t先に行ってください
パイセン\tそれ禁止っす！
クマバーソン\t言い訳は飯の後！
ガンテツ\t乱暴です！
ナオ\t生きてから苦情を出して！`,
  },
  "stage-station-tunnel-post-v070": {
    title: "西新駅・暫定封鎖",
    chapter: "STAGE 6",
    scene: "西新駅地上入口・夜明け前",
    background: "station-gate",
    music: "return-subdued",
    ambience: ["夜明け前の風", "CRAWLERエンジン"],
    results: [
      "西新駅地下区域を暫定封鎖",
      "生存者十二名を救出",
      "ガンテツ加入済み",
      "モンキー加入・無料所有",
      "次期調査地点：福岡市西部医科大学附属病院",
    ],
    beats: [
      "プレイヤーが病院を次期調査対象として記録する",
      "プレイヤーが現在の作戦を帰還完了にする",
    ],
    playerPresence: "silent-commander",
    source: `いくらちゃん\t救助者、全員乗車しました
モンキー\t駅へ一人で戻るとか言うなよ
ガンテツ\t一人では戻りません
モンキー\t覚えるの早いな
クマバーソン\t話は飯の後たい！　全員分ある！
ナオ\t十二人増えた
クマバーソン\t増えると思って多めに作った！
パイセン\tそれ、数え間違いじゃなかったんすか
クマバーソン\t今日は正解！
ババヤガ\t帰宅が遅れます。理由は地下鉄です。……分かったって。帰ったら話すばい
いくらちゃん\t指揮官。駅側の流出は止まりました。ただし、大学病院地下の電源はまだ生きています
パイセン\t次は病院っすね
クマバーソン\t今日は食って寝ろ！　次は明日たい！`,
  },
  "stage-station-tunnel-defeat-v070": {
    title: "保守トンネル・封鎖失敗",
    chapter: "STAGE 6",
    scene: "敗北",
    background: "station-tunnel",
    music: "defeat",
    source: `モンキー\t封鎖失敗！　電源を落とす！　全員戻れ！`,
  },
  "stage-station-tunnel-retry-v070": {
    title: "保守トンネル・再戦",
    chapter: "STAGE 6",
    scene: "再戦",
    background: "station-tunnel",
    source: `ガンテツ\t今度は一緒に下がります
クレイジーキング\t外、切ル。中、残ス`,
  },
  "stage-station-tunnel-replay-v070": {
    title: "保守トンネル・封鎖点検",
    chapter: "STAGE 6",
    scene: "クリア後再戦",
    background: "station-tunnel",
    source: `いくらちゃん\t封鎖扉の内側に再反応。三電源と帰還路を再点検します
モンキー\t順番は同じだ。一、二、三。勝手に四を作るな
ガンテツ\t今度も全員で戻ります`,
  },
  "chapter-ending-v070": {
    title: "帰還",
    chapter: "EPILOGUE",
    scene: "CRAWLER食堂・朝",
    background: "crawler-operations-room",
    kind: "result",
    music: "crawler-morning-thick",
    ambience: ["食器", "低い会話", "大型エンジン"],
    results: [
      "西新駅地下区域　暫定封鎖",
      "生存者十二名を救出",
      "次期調査地点　福岡市西部医科大学附属病院",
    ],
    beats: [
      "プレイヤーが最終報告を閉じる",
      "食堂の生活音が前へ戻る",
    ],
    playerPresence: "silent-commander",
    source: `クレイジーキング\t熱イ
クマバーソン\t飯は熱いうちが一番たい！
クレイジーキング\t良イ
モンキー\t名前、全部消せたな
ガンテツ\tはい
モンキー\tなら食え
システム\t西新駅地下区域　暫定封鎖
システム\t生存者十二名を救出
システム\t次期調査地点　福岡市西部医科大学附属病院`,
  },
};

const missingDefinitionIds = STORY_EVENT_IDS.filter((eventId) => !EVENT_DEFINITIONS[eventId]);
const extraDefinitionIds = Object.keys(EVENT_DEFINITIONS).filter((eventId) => !STORY_EVENT_IDS.includes(eventId));
if (missingDefinitionIds.length || extraDefinitionIds.length) {
  throw new Error(`Story event definition mismatch: missing=${missingDefinitionIds.join(",")} extra=${extraDefinitionIds.join(",")}`);
}

export const STORY_EVENTS = deepFreeze(Object.fromEntries(
  STORY_EVENT_IDS.map((eventId) => [eventId, event(eventId, EVENT_DEFINITIONS[eventId])]),
));

export const STORY_DIALOGUE_BY_SPEAKER = deepFreeze(Object.fromEntries(
  [...new Set(Object.values(STORY_EVENTS).flatMap(({ lines }) => lines.map(({ speaker }) => speaker)))]
    .sort((left, right) => left.localeCompare(right, "ja"))
    .map((speaker) => [
      speaker,
      Object.values(STORY_EVENTS).flatMap((storyEvent) => storyEvent.lines
        .map((line, index) => ({ eventId: storyEvent.id, index, speaker: line.speaker, text: line.text }))
        .filter((line) => line.speaker === speaker)),
    ]),
));

const LEGACY_STORY_EVENT_ALIASES = Object.freeze({
  intro: "prologue-kumaya-v070",
  "prologue-opening": "prologue-kumaya-v070",
  "prologue-operations-room": "crawler-signal-v070",
  "stage-nishijin-pre": "stage-nishijin-pre-v070",
  "stage-nishijin-battle-start": "stage-nishijin-alert-v070",
  "stage-nishijin-battle-runner": "stage-nishijin-alert-v070",
  "stage-nishijin-battle-spitter": "stage-nishijin-alert-v070",
  "stage-nishijin-battle-distress-voice": "stage-nishijin-alert-v070",
  "stage-nishijin-battle-base-exposed": "stage-nishijin-alert-v070",
  "stage-nishijin-post": "stage-nishijin-post-v070",
  "stage-nishijin-defeat": "stage-nishijin-defeat-v070",
  "stage-nishijin-retry": "stage-nishijin-retry-v070",
  "stage-nishijin-replay": "stage-nishijin-replay-v070",
  "stage-sawara-pre": "stage-sawara-pre-v070",
  "stage-sawara-battle-start": "stage-sawara-alert-v070",
  "stage-sawara-post": "stage-sawara-post-v070",
  "stage-sawara-defeat": "stage-sawara-defeat-v070",
  "stage-sawara-retry": "stage-sawara-retry-v070",
  "stage-sawara-replay": "stage-sawara-replay-v070",
  "stage-takuya-pre": "stage-takuya-pre-v070",
  "stage-takuya-warning": "stage-takuya-warning-v070",
  "stage-takuya-final": "stage-takuya-final-v070",
  "stage-takuya-base-remains": "stage-takuya-base-remains-v070",
  "stage-takuya-post": "stage-takuya-post-v070",
  "stage-takuya-defeat": "stage-takuya-defeat-v070",
  "stage-takuya-defeat-after-boss": "stage-takuya-defeat-after-boss-v070",
  "stage-takuya-retry": "stage-takuya-retry-v070",
  "stage-takuya-replay": "stage-takuya-replay-v070",
  "prologue-ending": "chapter-ending-v070",
});

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
