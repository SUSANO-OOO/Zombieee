// Generated from the Version 1.0.0 Producer rewrite. Do not hand-edit.
import { V100_EVENT_IDS, V100_EVENT_BY_ID, renderV100PlayerName } from "./v100Registry.js";

export const V100_STORY_SOURCE_SHA256 = "aee233b8c47bc9991bea439a5a0a2eee1b910155c59c7a87d48740d8a837c625";
export const V100_STORY_SOURCE_LINE_COUNT = 916;
export const V100_STORY_SCRIPT_VERSION = "v10-producer-rewrite";

export const V100_STORY_EVENTS = Object.freeze({
  "v100:event:prologue": {
    "id": "v100:event:prologue",
    "kind": "prologue",
    "stageNumber": null,
    "musicProfile": "FINAL",
    "nodes": [
      {
        "kind": "action",
        "speaker": null,
        "text": "雨が上がったばかりの西新。居酒屋「くまや」の窓に、通りの信号が滲む。{{PLAYER_NAME}}が戸を開けると、食器を置く音がした。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 9,
        "sceneTag": "daily"
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "厨房のクマバーソンは最後の唐揚げを皿へ移す。足元ではチワワのマヨちゃんが、落ちてこない一個を待っている。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 10,
        "sceneTag": "daily"
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "配達帰りのハチが橙色の雨具を椅子へ掛け、バールの先についた泥を拭く。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 11,
        "sceneTag": "daily"
      },
      {
        "kind": "dialogue",
        "speaker": "ハチ",
        "text": "裏道、工事で塞がってた。帰りは別の道を見ます",
        "portraitOwner": "unit-hachi",
        "portraitKind": "major",
        "sourceLine": 12,
        "sceneTag": "daily"
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "遅いっすよ、{{PLAYER_NAME}}さん。俺が取っといた席、もう俺が温めちゃいました",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 13,
        "sceneTag": "daily"
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "唐揚げは二個。誰が三個食べたかは聞かん",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 14,
        "sceneTag": "daily"
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "パイセンが空の小皿を伏せる。ババヤガはスマートフォンを見たまま、口元だけで笑う。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 15,
        "sceneTag": "daily"
      },
      {
        "kind": "dialogue",
        "speaker": "ババヤガ",
        "text": "妻から『牛乳』。句読点もない",
        "portraitOwner": "unit-babayaga",
        "portraitKind": "major",
        "sourceLine": 16,
        "sceneTag": "daily"
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "買って帰れってことっす。相場を読むより簡単でしょ",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 17,
        "sceneTag": "daily"
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が車の鍵を置き、烏龍茶を受け取る。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 18,
        "sceneTag": "daily"
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "今日は運転か。ちゃんと食ってけ",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 19,
        "sceneTag": "daily"
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "壁のテレビ。ムガリアン製薬の広告に、見慣れた商店街と区役所が映る。「災害にも備える街へ」。誰も画面を見ていない。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 20,
        "sceneTag": "daily"
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "同じ音で、店中のスマートフォンが鳴る。速報は「早良区内で複数の傷害事件」。その下に、外出を控えるよう短い指示。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 23,
        "sceneTag": "crisis"
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "……この辺ですよね",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 24,
        "sceneTag": "crisis"
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "表でガラスが割れる。引き戸に、一人の男が体重を預ける。通りの奥から、もう二つの足音。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 25,
        "sceneTag": "crisis"
      },
      {
        "kind": "dialogue",
        "speaker": "男の声",
        "text": "開けてくれ。頼む",
        "portraitOwner": null,
        "portraitKind": "offscreen",
        "sourceLine": 26,
        "sceneTag": "crisis"
      },
      {
        "kind": "dialogue",
        "speaker": "ババヤガ",
        "text": "後ろに二人おる。走り方が変や",
        "portraitOwner": "unit-babayaga",
        "portraitKind": "major",
        "sourceLine": 27,
        "sceneTag": "crisis"
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が戸の脇の椅子を退け、男を引き入れる。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 28,
        "sceneTag": "crisis"
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "パイセン、奥の客を車へ。マヨちゃんも連れてけ",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 29,
        "sceneTag": "crisis"
      },
      {
        "kind": "dialogue",
        "speaker": "ハチ",
        "text": "裏口を見てきます。車までの道、俺が先に開ける",
        "portraitOwner": "unit-hachi",
        "portraitKind": "major",
        "sourceLine": 30,
        "sceneTag": "crisis"
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "男の袖をまくると、歯形がある。彼はまだ名前を言える。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 31,
        "sceneTag": "crisis"
      },
      {
        "kind": "dialogue",
        "speaker": "男",
        "text": "娘が、駅に……",
        "portraitOwner": "minor-human-shared-event-silhouette",
        "portraitKind": "minor",
        "sourceLine": 32,
        "sceneTag": "crisis"
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "戸の外の影が、ガラスに額を打ちつける。割れても、その手は離れない。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 33,
        "sceneTag": "crisis"
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "車、表っすよね。俺、鍵を……",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 34,
        "sceneTag": "crisis"
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が鍵を渡す。パイセンは震える手で受け取り、客の方へ走る。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 35,
        "sceneTag": "crisis"
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "装甲車両が裏路地へ出る。店の暖簾が半分落ち、クマバーソンが拾いかけて、やめる。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 38,
        "sceneTag": "escape"
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "戻って、掛け直す。まず生きるぞ",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 39,
        "sceneTag": "escape"
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "無線から、商店街の薬局に取り残された人の声。主人公は帰路ではなく、その住所を地図に入れる。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 42,
        "sceneTag": "radio"
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "……そっち、危ない方っすよ",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 43,
        "sceneTag": "radio"
      },
      {
        "kind": "dialogue",
        "speaker": "ババヤガ",
        "text": "知っとる。だからハンドルを切った",
        "portraitOwner": "unit-babayaga",
        "portraitKind": "major",
        "sourceLine": 44,
        "sceneTag": "radio"
      },
      {
        "kind": "system",
        "speaker": "■ SYSTEM",
        "text": "西新商店街の薬局へ向かう。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 45,
        "sceneTag": "radio"
      }
    ],
    "source": {
      "startLine": 6,
      "endLine": 46
    }
  },
  "v100:event:s01:pre": {
    "id": "v100:event:s01:pre",
    "kind": "stage-pre",
    "stageNumber": 1,
    "musicProfile": "locked-stage-profile",
    "nodes": [
      {
        "kind": "action",
        "speaker": null,
        "text": "薬局二階の窓から、白いタオルが二度振られる。下の入口には感染した肉が棚ごと張りつき、階段を塞いでいる。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 51
      },
      {
        "kind": "dialogue",
        "speaker": "女の声",
        "text": "車の人。聞こえてたらライトを一回",
        "portraitOwner": null,
        "portraitKind": "offscreen",
        "sourceLine": 52
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公がライトを点滅させる。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 53
      },
      {
        "kind": "dialogue",
        "speaker": "女の声",
        "text": "五人います。一人は歩けません。……最初にそれ、言えてよかった",
        "portraitOwner": null,
        "portraitKind": "offscreen",
        "sourceLine": 54
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "裏階段まで道をつくる。窓からは出るな",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 55
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "パイセンが階段の幅を測る。老人を背負うには、両手が要る。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 56
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "{{PLAYER_NAME}}さん、俺、先に上がります。下で待つより、怖いんで",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 57
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が鉄パイプを渡し、車両の扉を開ける。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 58
      },
      {
        "kind": "battle-marker",
        "speaker": "◆ BATTLE",
        "text": "感染拠点を破壊し、裏階段を確保せよ。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 59
      }
    ],
    "source": {
      "startLine": 50,
      "endLine": 60
    }
  },
  "v100:event:s01:post": {
    "id": "v100:event:s01:post",
    "kind": "stage-post",
    "stageNumber": 1,
    "musicProfile": "locked-stage-profile",
    "nodes": [
      {
        "kind": "action",
        "speaker": null,
        "text": "老人を背負った主人公が階段を降りる。最後の女性は小さなアンテナを抱え、全員の足元を確かめてから続く。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 63
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "背後で、赤銅色の編み髪を肩に流した女性が老人の脈を取り直す。階段では自分の救急バッグより先に、包帯をパイセンへ渡していた。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 64
      },
      {
        "kind": "dialogue",
        "speaker": "ナオ",
        "text": "ナオです。あの人、車で横にしてください。揺れると傷が開く",
        "portraitOwner": "unit-nao",
        "portraitKind": "major",
        "sourceLine": 65
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "一緒に乗ってください。俺じゃ、次の人を見られない",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 66
      },
      {
        "kind": "dialogue",
        "speaker": "ナオ",
        "text": "薬を運べるなら行きます。ここで待ってても、もう一人は助けられない",
        "portraitOwner": "unit-nao",
        "portraitKind": "major",
        "sourceLine": 67
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "いくらです。話す方が落ち着くんで、うるさかったら言ってください",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 68
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "今は喋ってて。静かだと、さっきの音が戻ってくる",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 69
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "いくらちゃんは老人へ水を渡し、薬品箱の管理番号を指す。市のラベルの下に「MUGARIAN」。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 70
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "市の物資なら、上から貼り直す必要ないですよね",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 71
      },
      {
        "kind": "dialogue",
        "speaker": "ババヤガ",
        "text": "番号を隠したかった奴がおる",
        "portraitOwner": "unit-babayaga",
        "portraitKind": "major",
        "sourceLine": 72
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "区役所からの無線が途切れ途切れに入る。「最後の一台。まだ出せない」。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 73
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公がいくらちゃんのアンテナを車両へ積み、空いた座席を示す。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 74
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "連れてくんですか。……じゃあ、切れた声の続き、探します",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 75
      },
      {
        "kind": "system",
        "speaker": "■ SYSTEM",
        "text": "救護のナオが配備登録候補になった。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 76
      },
      {
        "kind": "system",
        "speaker": "■ SYSTEM",
        "text": "いくらちゃんが通信支援に加わる。次は早良区役所。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 77
      }
    ],
    "source": {
      "startLine": 62,
      "endLine": 78
    }
  },
  "v100:event:s01:first-clear-post": {
    "id": "v100:event:s01:first-clear-post",
    "kind": "first-clear-post",
    "stageNumber": 1,
    "musicProfile": "locked-stage-profile",
    "nodes": [],
    "finalizeOnly": true,
    "source": {
      "startLine": 62,
      "endLine": 78
    }
  },
  "v100:event:s02:pre": {
    "id": "v100:event:s02:pre",
    "kind": "stage-pre",
    "stageNumber": 2,
    "musicProfile": "locked-stage-profile",
    "nodes": [
      {
        "kind": "action",
        "speaker": null,
        "text": "区役所の前で避難バスがエンジンを掛けたまま待つ。車内は満員。コピー室の安藤だけが戻らない。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 83
      },
      {
        "kind": "dialogue",
        "speaker": "避難所職員",
        "text": "あと一分で出ます。ここに残ったら全員巻き込まれる",
        "portraitOwner": "minor-human-shared-event-silhouette",
        "portraitKind": "minor",
        "sourceLine": 84
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "待てって言いたい。でも、中の人にも顔がある",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 85
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公がバスの扉を押さえ、車椅子をパイセンへ渡す。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 86
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "……俺が行くんすね。分かった。怖いまま行きます",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 87
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "こっちは時間をつくる。戻る道、塞がせん",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 88
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "角を曲がった感染者の列が、車両のライトへ一斉に向く。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 89
      },
      {
        "kind": "battle-marker",
        "speaker": "◆ BATTLE",
        "text": "避難バスと救出経路を守れ。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 90
      }
    ],
    "source": {
      "startLine": 82,
      "endLine": 91
    }
  },
  "v100:event:s02:post": {
    "id": "v100:event:s02:post",
    "kind": "stage-post",
    "stageNumber": 2,
    "musicProfile": "locked-stage-profile",
    "nodes": [
      {
        "kind": "action",
        "speaker": null,
        "text": "パイセンが車椅子を押して飛び出す。安藤の膝には、古い携帯ラジオ。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 94
      },
      {
        "kind": "dialogue",
        "speaker": "安藤",
        "text": "駅員室で三人、生きとる。昨夜これで話した",
        "portraitOwner": "minor-human-shared-event-silhouette",
        "portraitKind": "minor",
        "sourceLine": 95
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "よかった。喋るのはバスで。今は息だけしてください",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 96
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "バスが出る。パイセンの手はまだ震えている。いくらちゃんが自分の手を隣へ置く。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 97
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "私もです。隠すの、やめます",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 98
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "バスの屋根から射手が降りてくる。撃ち残した薬莢を拾い、駅へ向かう道だけを見ている。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 99
      },
      {
        "kind": "dialogue",
        "speaker": "ミズチ",
        "text": "ミズチ。バスの後ろは任せて。駅へ行くなら、先の交差点に射線が要る",
        "portraitOwner": "unit-mizuchi",
        "portraitKind": "major",
        "sourceLine": 100
      },
      {
        "kind": "dialogue",
        "speaker": "ババヤガ",
        "text": "今ので弾は何発使った",
        "portraitOwner": "unit-babayaga",
        "portraitKind": "major",
        "sourceLine": 101
      },
      {
        "kind": "dialogue",
        "speaker": "ミズチ",
        "text": "必要な分。残りを数えてから出る",
        "portraitOwner": "unit-mizuchi",
        "portraitKind": "major",
        "sourceLine": 102
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "壁の避難図。商店街から駅、病院、湾岸まで、発生前の日付で「都市対応実証 B-02」と区切られている。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 105,
        "sceneTag": "evidence"
      },
      {
        "kind": "dialogue",
        "speaker": "ババヤガ",
        "text": "事故のあとに書いた線じゃない",
        "portraitOwner": "unit-babayaga",
        "portraitKind": "major",
        "sourceLine": 106,
        "sceneTag": "evidence"
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が図を撮り、安藤のラジオを駅の周波数へ合わせる。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 107,
        "sceneTag": "evidence"
      },
      {
        "kind": "system",
        "speaker": "■ SYSTEM",
        "text": "射撃のミズチが配備登録候補になった。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 108,
        "sceneTag": "evidence"
      },
      {
        "kind": "system",
        "speaker": "■ SYSTEM",
        "text": "駅員室の生存者へ向かう。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 109,
        "sceneTag": "evidence"
      }
    ],
    "source": {
      "startLine": 93,
      "endLine": 110
    }
  },
  "v100:event:s02:first-clear-post": {
    "id": "v100:event:s02:first-clear-post",
    "kind": "first-clear-post",
    "stageNumber": 2,
    "musicProfile": "locked-stage-profile",
    "nodes": [],
    "finalizeOnly": true,
    "source": {
      "startLine": 93,
      "endLine": 110
    }
  },
  "v100:event:s03:pre": {
    "id": "v100:event:s03:pre",
    "kind": "stage-pre",
    "stageNumber": 3,
    "musicProfile": "locked-stage-profile",
    "nodes": [
      {
        "kind": "action",
        "speaker": null,
        "text": "交差点の向こうで、橙の防災ベストを着た巨体が車を押しのける。胸の名札に「TAKUYA」。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 115
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "壊れた街頭放送が同じ声を繰り返す。「タクヤさん、薬局へ」。巨体は音の方を見た。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 116
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "名前、まだ聞こえてるんすか",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 117
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "分からん。分からんまま、ここを通すわけにいかん",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 118
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が横転車を遮蔽物にし、防衛線へ仲間を配置する。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 119
      },
      {
        "kind": "dialogue",
        "speaker": "ババヤガ",
        "text": "正面は任せるな。左右を使え",
        "portraitOwner": "unit-babayaga",
        "portraitKind": "major",
        "sourceLine": 120
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "パイセンが落とした鉄パイプを拾う。手は震えたまま、足だけが一歩前へ出る。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 121
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "一人で行かせる方が、もっと嫌っす",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 122
      },
      {
        "kind": "boss-marker",
        "speaker": "◆ BOSS",
        "text": "TAKUYA",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 123
      },
      {
        "kind": "battle-marker",
        "speaker": "◆ BATTLE",
        "text": "感染群を退け、TAKUYAを止めよ。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 124
      }
    ],
    "source": {
      "startLine": 114,
      "endLine": 125
    }
  },
  "v100:event:s03:post": {
    "id": "v100:event:s03:post",
    "kind": "stage-post",
    "stageNumber": 3,
    "musicProfile": "locked-stage-profile",
    "nodes": [
      {
        "kind": "action",
        "speaker": null,
        "text": "TAKUYAの指が、放送の鳴る方へ伸びたまま止まる。クマバーソンは防災ベストの端を拾い、顔へ掛ける。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 128
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "もう、呼ばんでやってくれ",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 129
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "駅の人、まだ待ってるんすよね",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 130
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "信号は生きてます。細いけど、切れてない",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 131
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が横転車へ牽引線を掛け、駅へ通る道を開く。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 132
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "装甲車両が去ったあと、赤いレンズの防護服が交差点へ入る。銃口を下げたまま、迷いなくTAKUYAへ向かう。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 135,
        "sceneTag": "retrieval"
      },
      {
        "kind": "dialogue",
        "speaker": "赤レンズの隊長",
        "text": "T-03、回収。記録は残すな",
        "portraitOwner": "red-panther-commander",
        "portraitKind": "major",
        "sourceLine": 136,
        "sceneTag": "retrieval"
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "防災ベストが剥がされ、黒い袋に収まる。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 137,
        "sceneTag": "retrieval"
      }
    ],
    "source": {
      "startLine": 127,
      "endLine": 138
    }
  },
  "v100:event:s03:first-clear-post": {
    "id": "v100:event:s03:first-clear-post",
    "kind": "first-clear-post",
    "stageNumber": 3,
    "musicProfile": "locked-stage-profile",
    "nodes": [],
    "finalizeOnly": true,
    "source": {
      "startLine": 127,
      "endLine": 138
    }
  },
  "v100:event:s04:pre": {
    "id": "v100:event:s04:pre",
    "kind": "stage-pre",
    "stageNumber": 4,
    "musicProfile": "locked-stage-profile",
    "nodes": [
      {
        "kind": "action",
        "speaker": null,
        "text": "駅のシャッターは腰の高さで止まっている。暗い構内から、非常電話の呼び出し音が続く。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 143
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "自動じゃない。誰かが、かけ直してます",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 144
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "地下は苦手っす。空が見えないと、逃げる方向が分からない",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 145
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が隙間から入り、内側のシャッターを押し上げる。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 146
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "受話器から、咳に混じって駅員の声。駅員室に三人、ホームの保守室に二人。一人は噛まれている。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 147
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "……そう言われたら、もう行くしかないっすね",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 148
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "行く。帰る道も残す",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 149
      },
      {
        "kind": "battle-marker",
        "speaker": "◆ BATTLE",
        "text": "閉鎖改札の感染拠点を破壊し、駅員室へ進め。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 150
      }
    ],
    "source": {
      "startLine": 142,
      "endLine": 151
    }
  },
  "v100:event:s04:post": {
    "id": "v100:event:s04:post",
    "kind": "stage-post",
    "stageNumber": 4,
    "musicProfile": "locked-stage-profile",
    "nodes": [
      {
        "kind": "action",
        "speaker": null,
        "text": "駅員室の女性は咬傷をタオルで押さえ、先にホームの二人を助けてと頼む。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 154
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "順番はこっちで決める。立てるなら一緒に来い",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 155
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "パイセンが反対側から肩を貸す。女性は、彼の震える手を見て何も言わない。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 156
      },
      {
        "kind": "dialogue",
        "speaker": "駅員",
        "text": "黒い防護服が、ホームへ冷蔵ケースを置いていきました。レンズが赤くて",
        "portraitOwner": "minor-human-shared-event-silhouette",
        "portraitKind": "minor",
        "sourceLine": 157
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "主人公が振り返る。交差点で見た防護服と同じだ。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 158
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "駅員室の配線盤から、罠装置を腰に下げた男が這い出す。非常電話を鳴らし続けたのは彼だった。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 159
      },
      {
        "kind": "dialogue",
        "speaker": "モンキー",
        "text": "モンキー。シャッターは直せる。でもホーム側を開けたら、こっちも見つかる",
        "portraitOwner": "unit-monkey",
        "portraitKind": "major",
        "sourceLine": 160
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が駅員室の退路を指し、開閉の合図をモンキーへ預ける。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 161
      },
      {
        "kind": "dialogue",
        "speaker": "モンキー",
        "text": "その順ならやれる。合図を飛ばすなよ",
        "portraitOwner": "unit-monkey",
        "portraitKind": "major",
        "sourceLine": 162
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が駅員を車両へ送り、ホームへの保守扉を開ける。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 163
      },
      {
        "kind": "system",
        "speaker": "■ SYSTEM",
        "text": "工兵のモンキーが配備登録候補になった。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 164
      },
      {
        "kind": "system",
        "speaker": "■ SYSTEM",
        "text": "ホームの二人と冷蔵ケースを確認する。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 165
      }
    ],
    "source": {
      "startLine": 153,
      "endLine": 166
    }
  },
  "v100:event:s04:first-clear-post": {
    "id": "v100:event:s04:first-clear-post",
    "kind": "first-clear-post",
    "stageNumber": 4,
    "musicProfile": "locked-stage-profile",
    "nodes": [],
    "finalizeOnly": true,
    "source": {
      "startLine": 153,
      "endLine": 166
    }
  },
  "v100:event:s05:pre": {
    "id": "v100:event:s05:pre",
    "kind": "stage-pre",
    "stageNumber": 5,
    "musicProfile": "locked-stage-profile",
    "nodes": [
      {
        "kind": "action",
        "speaker": null,
        "text": "非常灯の間で、改札機の電子音が鳴る。感染組織と一体になった巨体が、その音へ顔を向けた。保守室の扉が内側から叩かれる。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 171
      },
      {
        "kind": "dialogue",
        "speaker": "保守員の声",
        "text": "ここに二人！　扉が歪んで、開きません",
        "portraitOwner": null,
        "portraitKind": "offscreen",
        "sourceLine": 172
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "あれ、音を追う。反対ホームへ誘導すれば、扉まで届く",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 173
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "クマバーソンはフライパンを一度叩く。乾いた音が広がり、巨体が反応する。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 174
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "一回で足りるか",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 175
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "録れました。次は向こうの放送から鳴らします",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 176
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が仲間へ合図し、線路を越えて保守室へ向かう。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 177
      },
      {
        "kind": "boss-marker",
        "speaker": "◆ BOSS",
        "text": "改札喰い",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 178
      },
      {
        "kind": "battle-marker",
        "speaker": "◆ BATTLE",
        "text": "感染群を退け、改札喰いを倒して二人を救え。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 179
      }
    ],
    "source": {
      "startLine": 170,
      "endLine": 180
    }
  },
  "v100:event:s05:post": {
    "id": "v100:event:s05:post",
    "kind": "stage-post",
    "stageNumber": 5,
    "musicProfile": "locked-stage-profile",
    "nodes": [
      {
        "kind": "action",
        "speaker": null,
        "text": "保守室から出た二人が、互いの肩を離さない。いくらちゃんは二人を数え直して、初めて笑う。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 183
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "一人が、曲がったチェーンソーの刃を床へ置く。扉を破ろうとして噛み込み、動けなくなっていた。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 184
      },
      {
        "kind": "dialogue",
        "speaker": "クレイジーキング",
        "text": "俺、ここを切れなかった。外の音、聞こえた",
        "portraitOwner": "unit-crazy-king",
        "portraitKind": "major",
        "sourceLine": 185
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "扉を残したから二人とも出られた。次は一緒に道をつくろう",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 186
      },
      {
        "kind": "dialogue",
        "speaker": "クレイジーキング",
        "text": "……次は、先に聞く",
        "portraitOwner": "unit-crazy-king",
        "portraitKind": "major",
        "sourceLine": 187
      },
      {
        "kind": "dialogue",
        "speaker": "保守員",
        "text": "これ、病院へ。置いていった人たちは、中身を半分持っていった",
        "portraitOwner": "minor-human-shared-event-silhouette",
        "portraitKind": "minor",
        "sourceLine": 188
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "冷蔵ケースには「感染初期処置用」。薬局と同じムガリアンの管理番号。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 189
      },
      {
        "kind": "dialogue",
        "speaker": "ババヤガ",
        "text": "届けるために置いたんやない。残りを使わせたかった",
        "portraitOwner": "unit-babayaga",
        "portraitKind": "major",
        "sourceLine": 190
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "誰に",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 191
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "配送履歴は大学病院の地下搬入口。答えが残ってるなら、そこです",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 192
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公がケースを背負い、病院へ続く保守扉を開ける。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 193
      },
      {
        "kind": "system",
        "speaker": "■ SYSTEM",
        "text": "前衛のクレイジーキングが配備登録候補になった。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 194
      },
      {
        "kind": "system",
        "speaker": "■ SYSTEM",
        "text": "病院へ向かう保守トンネルを進む。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 195
      }
    ],
    "source": {
      "startLine": 182,
      "endLine": 196
    }
  },
  "v100:event:s05:first-clear-post": {
    "id": "v100:event:s05:first-clear-post",
    "kind": "first-clear-post",
    "stageNumber": 5,
    "musicProfile": "locked-stage-profile",
    "nodes": [],
    "finalizeOnly": true,
    "source": {
      "startLine": 182,
      "endLine": 196
    }
  },
  "v100:event:s06:pre": {
    "id": "v100:event:s06:pre",
    "kind": "stage-pre",
    "stageNumber": 6,
    "musicProfile": "locked-stage-profile",
    "nodes": [
      {
        "kind": "action",
        "speaker": null,
        "text": "トンネルの泥には、新しい軍靴の跡が等間隔に残る。赤いレンズ片のついたフィルターが、排水溝に引っかかっている。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 201
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "先に病院へ行ってる。足跡、同じ歩幅です",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 202
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "中継器が一度だけ点灯し、ババヤガの端末へ四十一日前の未着信メッセージが届く。差出人はMrs.チハ。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 203
      },
      {
        "kind": "dialogue",
        "speaker": "Mrs.チハのメッセージ",
        "text": "無事。湾岸へ移る。連絡はしないで",
        "portraitOwner": null,
        "portraitKind": "offscreen",
        "sourceLine": 204
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "奥さん、ですか",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 205
      },
      {
        "kind": "dialogue",
        "speaker": "ババヤガ",
        "text": "四十一日前には、生きとった",
        "portraitOwner": "unit-babayaga",
        "portraitKind": "major",
        "sourceLine": 206
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "今も探す。答えはそこにしかなかろう",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 207
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "奥の隔壁が開き、感染群とブレーキの外れた保守台車が見える。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 208
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が台車の輪止めを外し、退避の合図を出す。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 209
      },
      {
        "kind": "battle-marker",
        "speaker": "◆ BATTLE",
        "text": "保守台車で流入を分断し、隔壁を閉めよ。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 210
      }
    ],
    "source": {
      "startLine": 200,
      "endLine": 211
    }
  },
  "v100:event:s06:post": {
    "id": "v100:event:s06:post",
    "kind": "stage-post",
    "stageNumber": 6,
    "musicProfile": "locked-stage-profile",
    "nodes": [
      {
        "kind": "action",
        "speaker": null,
        "text": "隔壁が噛み合う。向こう側の爪が金属を打ち、次第に遠くなる。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 214
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "病院側の踊り場で、軽機関銃を構えた射手が最後の流入路を押さえている。銃身は熱く、弾帯はもう短い。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 215
      },
      {
        "kind": "dialogue",
        "speaker": "レイダー",
        "text": "レイダー。病院へ人を通すなら、私の後ろを走って。止まったら撃てない",
        "portraitOwner": "unit-raider",
        "portraitKind": "major",
        "sourceLine": 216
      },
      {
        "kind": "dialogue",
        "speaker": "ミズチ",
        "text": "その弾数で、何分持つ",
        "portraitOwner": "unit-mizuchi",
        "portraitKind": "major",
        "sourceLine": 217
      },
      {
        "kind": "dialogue",
        "speaker": "レイダー",
        "text": "何分も要らない。向こうにある弾を取りに行く",
        "portraitOwner": "unit-raider",
        "portraitKind": "major",
        "sourceLine": 218
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "ババヤガはメッセージを消さずに端末をしまう。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 219
      },
      {
        "kind": "dialogue",
        "speaker": "ババヤガ",
        "text": "返事を待っとるとは、言わんつもりやった",
        "portraitOwner": "unit-babayaga",
        "portraitKind": "major",
        "sourceLine": 220
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "言わんでも、分かる",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 221
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "病院側の非常回線が開く。救急搬入口で薬と人手が足りない。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 222
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が冷蔵ケースを持ち直し、病院の扉へ走る。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 223
      },
      {
        "kind": "system",
        "speaker": "■ SYSTEM",
        "text": "制圧射撃のレイダーが配備登録候補になった。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 224
      }
    ],
    "source": {
      "startLine": 213,
      "endLine": 225
    }
  },
  "v100:event:s06:first-clear-post": {
    "id": "v100:event:s06:first-clear-post",
    "kind": "first-clear-post",
    "stageNumber": 6,
    "musicProfile": "locked-stage-profile",
    "nodes": [],
    "finalizeOnly": true,
    "source": {
      "startLine": 213,
      "endLine": 225
    }
  },
  "v100:event:s07:pre": {
    "id": "v100:event:s07:pre",
    "kind": "stage-pre",
    "stageNumber": 7,
    "musicProfile": "locked-stage-profile",
    "nodes": [
      {
        "kind": "action",
        "speaker": null,
        "text": "ストレッチャーが廊下まで続く。駅で救った女性駅員は、咬傷を押さえながら自分の足で入ってきた。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 230
      },
      {
        "kind": "dialogue",
        "speaker": "医師",
        "text": "噛まれてから、どれくらい",
        "portraitOwner": "minor-human-shared-event-silhouette",
        "portraitKind": "minor",
        "sourceLine": 231
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "一時間ないです。まだ話せます",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 232
      },
      {
        "kind": "dialogue",
        "speaker": "医師",
        "text": "初期なら進行を遅らせられる。治せるとは、まだ言えません",
        "portraitOwner": "minor-human-shared-event-silhouette",
        "portraitKind": "minor",
        "sourceLine": 233
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が冷蔵ケースを渡す。医師は不足した容器の跡を見て、唇を結ぶ。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 234
      },
      {
        "kind": "dialogue",
        "speaker": "医師",
        "text": "残りだけでも使える。患者を中へ運ぶまで、外を守って",
        "portraitOwner": "minor-human-shared-event-silhouette",
        "portraitKind": "minor",
        "sourceLine": 235
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "運ぶのもやる。先生は、その人らを見て",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 236
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "救急車へ感染者がぶつかる。搬入口の防火扉が半分しか閉まらない。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 237
      },
      {
        "kind": "battle-marker",
        "speaker": "◆ BATTLE",
        "text": "医薬品と負傷者の移送が終わるまで搬入口を守れ。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 238
      }
    ],
    "source": {
      "startLine": 229,
      "endLine": 239
    }
  },
  "v100:event:s07:post": {
    "id": "v100:event:s07:post",
    "kind": "stage-post",
    "stageNumber": 7,
    "musicProfile": "locked-stage-profile",
    "nodes": [
      {
        "kind": "action",
        "speaker": null,
        "text": "最後のストレッチャーが中へ入る。駅員の腕の黒い変色は止まった。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 242
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "防火扉の留め具が外れかける。大きなハンマーを持つ男が、扉ではなく歪んだ枠だけを叩き戻す。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 243
      },
      {
        "kind": "dialogue",
        "speaker": "タタラ",
        "text": "タタラ。そこを壊したら患者の方へ開く。枠だけでいい",
        "portraitOwner": "unit-tatara",
        "portraitKind": "major",
        "sourceLine": 244
      },
      {
        "kind": "dialogue",
        "speaker": "医師",
        "text": "朝から一人で搬入口を支えてくれたんです",
        "portraitOwner": "minor-human-shared-event-silhouette",
        "portraitKind": "minor",
        "sourceLine": 245
      },
      {
        "kind": "dialogue",
        "speaker": "タタラ",
        "text": "次の扉も同じ作りだ。道をつくるなら、叩く場所を教えてくれ",
        "portraitOwner": "unit-tatara",
        "portraitKind": "major",
        "sourceLine": 246
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "止まってますよね",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 247
      },
      {
        "kind": "dialogue",
        "speaker": "医師",
        "text": "今は。次の投与まで六時間です",
        "portraitOwner": "minor-human-shared-event-silhouette",
        "portraitKind": "minor",
        "sourceLine": 248
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "六時間、使い切る前に戻る",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 249
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "医師が救急病棟の鍵を渡す。薬品庫と、残った看護師が二人。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 250
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が空の冷蔵ケースを受け取り、東病棟の扉を開ける。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 251
      },
      {
        "kind": "system",
        "speaker": "■ SYSTEM",
        "text": "破砕兵のタタラが配備登録候補になった。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 252
      },
      {
        "kind": "system",
        "speaker": "■ SYSTEM",
        "text": "救急病棟で薬と職員を探す。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 253
      }
    ],
    "source": {
      "startLine": 241,
      "endLine": 254
    }
  },
  "v100:event:s07:first-clear-post": {
    "id": "v100:event:s07:first-clear-post",
    "kind": "first-clear-post",
    "stageNumber": 7,
    "musicProfile": "locked-stage-profile",
    "nodes": [],
    "finalizeOnly": true,
    "source": {
      "startLine": 241,
      "endLine": 254
    }
  },
  "v100:event:s08:pre": {
    "id": "v100:event:s08:pre",
    "kind": "stage-pre",
    "stageNumber": 8,
    "musicProfile": "locked-stage-profile",
    "nodes": [
      {
        "kind": "action",
        "speaker": null,
        "text": "処置室の扉が、内側から三回叩かれる。主人公も三回、叩き返す。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 259
      },
      {
        "kind": "dialogue",
        "speaker": "看護師の声",
        "text": "二人います。右の個室は開けないで",
        "portraitOwner": null,
        "portraitKind": "offscreen",
        "sourceLine": 260
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "ガラスの向こうには患者の名札と家族写真。病衣の人影が、何度も窓へ額を当てている。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 261
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "あの人は、戻せないんすよね",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 262
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "……今の薬じゃ、無理や",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 263
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "パイセンは写真の顔を見てから、処置室の扉へ向き直る。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 264
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "じゃあ中の二人を出します。あの人の前を、空振りで通りたくない",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 265
      },
      {
        "kind": "battle-marker",
        "speaker": "◆ BATTLE",
        "text": "処置室への道を開き、感染拠点を破壊せよ。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 266
      }
    ],
    "source": {
      "startLine": 258,
      "endLine": 267
    }
  },
  "v100:event:s08:post": {
    "id": "v100:event:s08:post",
    "kind": "stage-post",
    "stageNumber": 8,
    "musicProfile": "locked-stage-profile",
    "nodes": [
      {
        "kind": "action",
        "speaker": null,
        "text": "看護師は薬と一緒に、破れた紙台帳を渡す。発生初日、会話のできた患者十二人が地下へ搬送されていた。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 270
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "処置室の内側から、大きな防護盾が運び出される。看護師二人の前に立っていた男は、肩の傷を見せようとしない。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 271
      },
      {
        "kind": "dialogue",
        "speaker": "ガンテツ",
        "text": "ガンテツです。お二人は歩けます。私は最後で結構です",
        "portraitOwner": "unit-gantetsu",
        "portraitKind": "major",
        "sourceLine": 272
      },
      {
        "kind": "dialogue",
        "speaker": "ナオ",
        "text": "肩を見せて。数に入らないつもりなら、なおさら",
        "portraitOwner": "unit-nao",
        "portraitKind": "major",
        "sourceLine": 273
      },
      {
        "kind": "dialogue",
        "speaker": "ガンテツ",
        "text": "……では、処置を受けてから後列を守ります",
        "portraitOwner": "unit-gantetsu",
        "portraitKind": "major",
        "sourceLine": 274
      },
      {
        "kind": "dialogue",
        "speaker": "看護師",
        "text": "名前を呼んでも、番号で答えろと言われました",
        "portraitOwner": "minor-human-shared-event-silhouette",
        "portraitKind": "minor",
        "sourceLine": 275
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "搬送先はB3-L。病院の図面には、そんな階がない",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 276
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "パイセンが個室の家族写真を元の位置へ戻す。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 277
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "名前は消させないでください",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 278
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が台帳を撮り、薬を搬入口へ送り出す。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 279
      },
      {
        "kind": "system",
        "speaker": "■ SYSTEM",
        "text": "防衛重装のガンテツが配備登録候補になった。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 280
      },
      {
        "kind": "system",
        "speaker": "■ SYSTEM",
        "text": "地下機械室からB3-Lの入口を探す。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 281
      }
    ],
    "source": {
      "startLine": 269,
      "endLine": 282
    }
  },
  "v100:event:s08:first-clear-post": {
    "id": "v100:event:s08:first-clear-post",
    "kind": "first-clear-post",
    "stageNumber": 8,
    "musicProfile": "locked-stage-profile",
    "nodes": [],
    "finalizeOnly": true,
    "source": {
      "startLine": 269,
      "endLine": 282
    }
  },
  "v100:event:s09:pre": {
    "id": "v100:event:s09:pre",
    "kind": "stage-pre",
    "stageNumber": 9,
    "musicProfile": "locked-stage-profile",
    "nodes": [
      {
        "kind": "action",
        "speaker": null,
        "text": "病院の発電機は止まりかけている。制御盤だけが動き、「研究区画優先」の赤い表示が消えない。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 287
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "上の病棟より、下の階へ電気が流れてる",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 288
      },
      {
        "kind": "dialogue",
        "speaker": "ババヤガ",
        "text": "発生前からか",
        "portraitOwner": "unit-babayaga",
        "portraitKind": "major",
        "sourceLine": 289
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "設定した日付が残ってます。半年前",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 290
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "冷却ファンを感染組織が巻き込み、室温が上がる。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 291
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が主電源を落とし、手動始動レバーへ取り付く。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 292
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "病棟の灯りを戻す。下の扉も、開ける",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 293
      },
      {
        "kind": "battle-marker",
        "speaker": "◆ BATTLE",
        "text": "発電機を守り、非常電源を再起動せよ。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 294
      }
    ],
    "source": {
      "startLine": 286,
      "endLine": 295
    }
  },
  "v100:event:s09:post": {
    "id": "v100:event:s09:post",
    "kind": "stage-post",
    "stageNumber": 9,
    "musicProfile": "locked-stage-profile",
    "nodes": [
      {
        "kind": "action",
        "speaker": null,
        "text": "照明が戻る。壁の継ぎ目が開き、隠されたエレベーターに「B3-L」の表示。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 298
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "いくらちゃんの端末が鳴る。戦闘映像が、知らない回線へ自動で送られていた。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 299
      },
      {
        "kind": "system",
        "speaker": "■ SYSTEM",
        "text": "外部転送完了／転送先：SEG-LAB",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 300
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "私たち、見られてた。病院でもムガリアンでもない回線です",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 301
      },
      {
        "kind": "dialogue",
        "speaker": "ババヤガ",
        "text": "次を止められるか",
        "portraitOwner": "unit-babayaga",
        "portraitKind": "major",
        "sourceLine": 302
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が表示を撮り、送信線を根元から抜く。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 303
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "もう送られた分は消せない。でも、こっちにも記録が残った",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 304
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "エレベーターの下から、短い救難音が返る。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 305
      }
    ],
    "source": {
      "startLine": 297,
      "endLine": 306
    }
  },
  "v100:event:s09:first-clear-post": {
    "id": "v100:event:s09:first-clear-post",
    "kind": "first-clear-post",
    "stageNumber": 9,
    "musicProfile": "locked-stage-profile",
    "nodes": [],
    "finalizeOnly": true,
    "source": {
      "startLine": 297,
      "endLine": 306
    }
  },
  "v100:event:s10:pre": {
    "id": "v100:event:s10:pre",
    "kind": "stage-pre",
    "stageNumber": 10,
    "musicProfile": "locked-stage-profile",
    "nodes": [
      {
        "kind": "action",
        "speaker": null,
        "text": "地下三階は病院の壁ではない。防弾ガラスの奥に、商店街、駅、区役所の監視映像が同時に並ぶ。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 311
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "{{PLAYER_NAME}}さん、俺たちが逃げてた場所、全部映ってる",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 312
      },
      {
        "kind": "system",
        "speaker": "■ SYSTEM",
        "text": "T計画／都市対応実証フィールド／区画B-01〜B-09",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 313
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "備えとったんやない。ここで何が起こるか、待っとった",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 314
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "除染ゲートが異常を告げ、隔壁が閉まる。天井の配管から感染個体が落ちる。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 315
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が非常解除盤へ走り、仲間の退路を確保する。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 316
      },
      {
        "kind": "battle-marker",
        "speaker": "◆ BATTLE",
        "text": "除染制御を復旧し、隔離区画への扉を開け。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 317
      }
    ],
    "source": {
      "startLine": 310,
      "endLine": 318
    }
  },
  "v100:event:s10:post": {
    "id": "v100:event:s10:post",
    "kind": "stage-post",
    "stageNumber": 10,
    "musicProfile": "locked-stage-profile",
    "nodes": [
      {
        "kind": "action",
        "speaker": null,
        "text": "ゲートの表示が緑へ変わる。奥のモニターに、生存反応三つと大型検体一つ。管理企業はムガリアン製薬。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 321
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "装甲車両から飛び出したマヨちゃんが、開いた扉の前で急に止まる。低い唸りに気づいて、ハチが先回りをやめた。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 322
      },
      {
        "kind": "dialogue",
        "speaker": "ハチ",
        "text": "あの小さいの、奥の音を先に聞いた。俺より足が速い",
        "portraitOwner": "unit-hachi",
        "portraitKind": "major",
        "sourceLine": 323
      },
      {
        "kind": "dialogue",
        "speaker": "ナオ",
        "text": "傷を作らせないなら前に出せる。戻る合図は、必ず出して",
        "portraitOwner": "unit-nao",
        "portraitKind": "major",
        "sourceLine": 324
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公がマヨちゃんの医療ハーネスを確かめ、車両へ戻る経路を空ける。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 325
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "薬局の箱、病院の備蓄、ここ。番号の親が同じです",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 326
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "生きてる三人を先に。会社の話は、そのあとで聞かせてください",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 327
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "俺もそう思う",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 328
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が防疫扉を開き、隔離区画へ踏み込む。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 329
      },
      {
        "kind": "system",
        "speaker": "■ SYSTEM",
        "text": "マヨちゃんが遊撃の配備登録候補になった。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 330
      },
      {
        "kind": "system",
        "speaker": "■ SYSTEM",
        "text": "生存者を救出し、大型検体を止める。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 331
      }
    ],
    "source": {
      "startLine": 320,
      "endLine": 332
    }
  },
  "v100:event:s10:first-clear-post": {
    "id": "v100:event:s10:first-clear-post",
    "kind": "first-clear-post",
    "stageNumber": 10,
    "musicProfile": "locked-stage-profile",
    "nodes": [],
    "finalizeOnly": true,
    "source": {
      "startLine": 320,
      "endLine": 332
    }
  },
  "v100:event:s11:pre": {
    "id": "v100:event:s11:pre",
    "kind": "stage-pre",
    "stageNumber": 11,
    "musicProfile": "locked-stage-profile",
    "nodes": [
      {
        "kind": "action",
        "speaker": null,
        "text": "待機室のガラスに、内側から三つの手形。研究員たちは酸素の残量を指で示す。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 337
      },
      {
        "kind": "dialogue",
        "speaker": "研究員の声",
        "text": "隔離を戻して。扉を開けたら、あれも出ます",
        "portraitOwner": null,
        "portraitKind": "offscreen",
        "sourceLine": 338
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "最大槽の札には「MOTHER」。製造日は発生より前だった。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 339
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "人を助けるために、これを置いたんすか",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 340
      },
      {
        "kind": "dialogue",
        "speaker": "研究員の声",
        "text": "……今、答えたら言い訳になる。先に止めてください",
        "portraitOwner": null,
        "portraitKind": "offscreen",
        "sourceLine": 341
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が酸素供給を待機室へ切り替え、隔離レバーを引く。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 342
      },
      {
        "kind": "boss-marker",
        "speaker": "◆ BOSS",
        "text": "MOTHER",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 343
      },
      {
        "kind": "battle-marker",
        "speaker": "◆ BATTLE",
        "text": "供給管を復旧し、待機室を守りながらMOTHERを止めよ。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 344
      }
    ],
    "source": {
      "startLine": 336,
      "endLine": 345
    }
  },
  "v100:event:s11:post": {
    "id": "v100:event:s11:post",
    "kind": "stage-post",
    "stageNumber": 11,
    "musicProfile": "locked-stage-profile",
    "nodes": [
      {
        "kind": "action",
        "speaker": null,
        "text": "封鎖扉が閉まる。出てきた研究員の一人は、MOTHERを見ないよう壁づたいに歩く。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 348
      },
      {
        "kind": "dialogue",
        "speaker": "研究員",
        "text": "私がここへ来た時には、もういたんです。地上へ出した検体も",
        "portraitOwner": "minor-human-shared-event-silhouette",
        "portraitKind": "minor",
        "sourceLine": 349
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "差し出された搬送票には、発生前の日付と回収班の赤い認識灯の記録。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 350
      },
      {
        "kind": "dialogue",
        "speaker": "ババヤガ",
        "text": "赤いレンズのやつらか",
        "portraitOwner": "unit-babayaga",
        "portraitKind": "major",
        "sourceLine": 351
      },
      {
        "kind": "dialogue",
        "speaker": "研究員",
        "text": "もう一つ。抑制液の処方を持ってください。感染組織が自分を壊すのを遅らせます。治療薬ではありません",
        "portraitOwner": "minor-human-shared-event-silhouette",
        "portraitKind": "minor",
        "sourceLine": 352
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "それでも医者に渡す。待っとる人がおる",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 353
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が票と処方を封じ、三人を地上へ送り出す。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 354
      }
    ],
    "source": {
      "startLine": 347,
      "endLine": 355
    }
  },
  "v100:event:s11:first-clear-post": {
    "id": "v100:event:s11:first-clear-post",
    "kind": "first-clear-post",
    "stageNumber": 11,
    "musicProfile": "locked-stage-profile",
    "nodes": [],
    "finalizeOnly": true,
    "source": {
      "startLine": 347,
      "endLine": 355
    }
  },
  "v100:event:s12:pre": {
    "id": "v100:event:s12:pre",
    "kind": "stage-pre",
    "stageNumber": 12,
    "musicProfile": "locked-stage-profile",
    "nodes": [
      {
        "kind": "action",
        "speaker": null,
        "text": "坑道で炎が上がる。搬送車の陰の男が、空の瓶を握ったまま回収班へ叫ぶ。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 360
      },
      {
        "kind": "dialogue",
        "speaker": "ザキミヤ",
        "text": "その車、妻と娘の記録が入っとる。燃やすなら俺ごとにしろ",
        "portraitOwner": "unit-zakimiya",
        "portraitKind": "major",
        "sourceLine": 361
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "赤いレンズが男を捉える。銃声。瓶が砕け、男はまだ立っている。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 362
      },
      {
        "kind": "dialogue",
        "speaker": "ババヤガ",
        "text": "次は外さん",
        "portraitOwner": "unit-babayaga",
        "portraitKind": "major",
        "sourceLine": 363
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "こっちに来い！",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 364
      },
      {
        "kind": "dialogue",
        "speaker": "ザキミヤ",
        "text": "車を置いては行けん！",
        "portraitOwner": "unit-zakimiya",
        "portraitKind": "major",
        "sourceLine": 365
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が搬送車と男の間へ装甲車両を滑り込ませる。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 366
      },
      {
        "kind": "battle-marker",
        "speaker": "◆ BATTLE",
        "text": "回収班を退け、搬送記録とザキミヤを守れ。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 367
      }
    ],
    "source": {
      "startLine": 359,
      "endLine": 368
    }
  },
  "v100:event:s12:post": {
    "id": "v100:event:s12:post",
    "kind": "stage-post",
    "stageNumber": 12,
    "musicProfile": "locked-stage-profile",
    "nodes": [
      {
        "kind": "action",
        "speaker": null,
        "text": "表示盤に妻子の名前。「湾岸封鎖区へ移送／以後不明」。ザキミヤは画面を消さない。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 371
      },
      {
        "kind": "dialogue",
        "speaker": "ザキミヤ",
        "text": "不明なら、まだ探せるよな",
        "portraitOwner": "unit-zakimiya",
        "portraitKind": "major",
        "sourceLine": 372
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "中央台帳に続きがあります。ここには死亡記録もない",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 373
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "ザキミヤが乳児の写真を見せる。親指が小さな顔を隠さないよう、端を持つ。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 374
      },
      {
        "kind": "dialogue",
        "speaker": "ザキミヤ",
        "text": "怖いよ。ほんとは、ここから一歩も出たくない",
        "portraitOwner": "unit-zakimiya",
        "portraitKind": "major",
        "sourceLine": 375
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "怖いままで乗れ。うちにも、そういうやつはおる",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 376
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が空席の扉を開く。ザキミヤは写真を胸へ戻して乗る。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 377
      },
      {
        "kind": "system",
        "speaker": "■ SYSTEM",
        "text": "ザキミヤ加入／火酒投擲・範囲制圧",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 378
      }
    ],
    "source": {
      "startLine": 370,
      "endLine": 379
    }
  },
  "v100:event:s12:first-clear-post": {
    "id": "v100:event:s12:first-clear-post",
    "kind": "first-clear-post",
    "stageNumber": 12,
    "musicProfile": "locked-stage-profile",
    "nodes": [],
    "finalizeOnly": true,
    "source": {
      "startLine": 370,
      "endLine": 379
    }
  },
  "v100:event:s13:pre": {
    "id": "v100:event:s13:pre",
    "kind": "stage-pre",
    "stageNumber": 13,
    "musicProfile": "locked-stage-profile",
    "nodes": [
      {
        "kind": "action",
        "speaker": null,
        "text": "救援薬の冷蔵コンテナは、企業の認証がなければ開かない。奥で民間人の救難灯が点滅する。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 384
      },
      {
        "kind": "dialogue",
        "speaker": "セガワの声",
        "text": "青い端子を繋いでください。薬も、出口も開けられます",
        "portraitOwner": null,
        "portraitKind": "offscreen",
        "sourceLine": 385
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "あなたの回線、病院で私たちの戦闘映像を持っていった",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 386
      },
      {
        "kind": "dialogue",
        "speaker": "セガワの声",
        "text": "無断で保存しました。謝ります。記録は消せませんが、今は倉庫の人を出したい",
        "portraitOwner": null,
        "portraitKind": "offscreen",
        "sourceLine": 387
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "信用させたいなら、先に何を開けるか言ってください",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 388
      },
      {
        "kind": "dialogue",
        "speaker": "セガワの声",
        "text": "救援薬の庫、続けて奥の避難室です",
        "portraitOwner": null,
        "portraitKind": "offscreen",
        "sourceLine": 389
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が端子を繋ぎ、開いた扉の前へ立つ。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 390
      },
      {
        "kind": "battle-marker",
        "speaker": "◆ BATTLE",
        "text": "避難室と薬品庫を確保し、物資の搬出を守れ。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 391
      }
    ],
    "source": {
      "startLine": 383,
      "endLine": 392
    }
  },
  "v100:event:s13:post": {
    "id": "v100:event:s13:post",
    "kind": "stage-post",
    "stageNumber": 13,
    "musicProfile": "locked-stage-profile",
    "nodes": [
      {
        "kind": "action",
        "speaker": null,
        "text": "避難者が二人、薬箱と一緒に出てくる。セガワの指示は本当だった。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 395
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "人も薬もいた。次も聞く。だが、映像は勝手に使うな",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 396
      },
      {
        "kind": "dialogue",
        "speaker": "セガワ",
        "text": "分かりました",
        "portraitOwner": "segawa",
        "portraitKind": "major",
        "sourceLine": 397
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "輸送記録には、発生前に結ばれた封鎖と復旧の契約。別都市の契約書には、まだ地名がない。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 398
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "災害より先に、請求先だけ決めていた",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 399
      },
      {
        "kind": "dialogue",
        "speaker": "ザキミヤ",
        "text": "これ、誰に見せたら止まる",
        "portraitOwner": "unit-zakimiya",
        "portraitKind": "major",
        "sourceLine": 400
      },
      {
        "kind": "dialogue",
        "speaker": "セガワ",
        "text": "一人には消されます。複製して、持って行ってください",
        "portraitOwner": "segawa",
        "portraitKind": "major",
        "sourceLine": 401
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が紙の原本を回収し、次の救難信号が出る線路へ向かう。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 402
      }
    ],
    "source": {
      "startLine": 394,
      "endLine": 403
    }
  },
  "v100:event:s13:first-clear-post": {
    "id": "v100:event:s13:first-clear-post",
    "kind": "first-clear-post",
    "stageNumber": 13,
    "musicProfile": "locked-stage-profile",
    "nodes": [],
    "finalizeOnly": true,
    "source": {
      "startLine": 394,
      "endLine": 403
    }
  },
  "v100:event:s14:pre": {
    "id": "v100:event:s14:pre",
    "kind": "stage-pre",
    "stageNumber": 14,
    "musicProfile": "locked-stage-profile",
    "nodes": [
      {
        "kind": "action",
        "speaker": null,
        "text": "民間車両が冷蔵貨車に繋がれたまま、感染体に押されている。白い光刃の男が連結部を守る。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 408
      },
      {
        "kind": "dialogue",
        "speaker": "TKY",
        "text": "そこの車！　人が乗っとる方、三か所外してくれ！",
        "portraitOwner": "unit-tky",
        "portraitKind": "major",
        "sourceLine": 409
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "あんたは？",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 410
      },
      {
        "kind": "dialogue",
        "speaker": "TKY",
        "text": "こいつの口を塞ぐ。名前ならTKYでええ！",
        "portraitOwner": "unit-tky",
        "portraitKind": "major",
        "sourceLine": 411
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "貨車が軋む。窓の内側から子どもが手を振り、すぐ引っ込める。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 412
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が一つ目の連結器へ走り、解除ハンドルを握る。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 413
      },
      {
        "kind": "boss-marker",
        "speaker": "◆ BOSS",
        "text": "オオグチ",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 414
      },
      {
        "kind": "battle-marker",
        "speaker": "◆ BATTLE",
        "text": "連結を三つ外し、民間車両を逃がせ。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 415
      }
    ],
    "source": {
      "startLine": 407,
      "endLine": 416
    }
  },
  "v100:event:s14:post": {
    "id": "v100:event:s14:post",
    "kind": "stage-post",
    "stageNumber": 14,
    "musicProfile": "locked-stage-profile",
    "nodes": [
      {
        "kind": "action",
        "speaker": null,
        "text": "車両が安全側へ動く。TKYは刃を消し、全員が降りるまで線路に残る。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 419
      },
      {
        "kind": "dialogue",
        "speaker": "避難者",
        "text": "もう一人、刀を二本持った人が本社の方へ行った。名前は聞けなかった",
        "portraitOwner": "minor-human-shared-event-silhouette",
        "portraitKind": "minor",
        "sourceLine": 420
      },
      {
        "kind": "dialogue",
        "speaker": "TKY",
        "text": "俺より急いでるんやろな",
        "portraitOwner": "unit-tky",
        "portraitKind": "major",
        "sourceLine": 421
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "いくらちゃんがババヤガへ端末を向ける。「チハ／湾岸封鎖区／十七日目生存」。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 422
      },
      {
        "kind": "dialogue",
        "speaker": "ババヤガ",
        "text": "……この人、俺の妻",
        "portraitOwner": "unit-babayaga",
        "portraitKind": "major",
        "sourceLine": 423
      },
      {
        "kind": "dialogue",
        "speaker": "TKY",
        "text": "湾岸へ行くんやな。俺も手伝う。助けた人の行き先を、見届けたい",
        "portraitOwner": "unit-tky",
        "portraitKind": "major",
        "sourceLine": 424
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が車両の扉を開く。TKYが避難者へ一度手を振って乗る。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 425
      },
      {
        "kind": "system",
        "speaker": "■ SYSTEM",
        "text": "TKY加入／光刃近接",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 426
      }
    ],
    "source": {
      "startLine": 418,
      "endLine": 427
    }
  },
  "v100:event:s14:first-clear-post": {
    "id": "v100:event:s14:first-clear-post",
    "kind": "first-clear-post",
    "stageNumber": 14,
    "musicProfile": "locked-stage-profile",
    "nodes": [],
    "finalizeOnly": true,
    "source": {
      "startLine": 418,
      "endLine": 427
    }
  },
  "v100:event:s15:pre": {
    "id": "v100:event:s15:pre",
    "kind": "stage-pre",
    "stageNumber": 15,
    "musicProfile": "locked-stage-profile",
    "nodes": [
      {
        "kind": "action",
        "speaker": null,
        "text": "民間救難回線のランプだけが消えている。企業警備回線は明るく点いたまま。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 432
      },
      {
        "kind": "dialogue",
        "speaker": "セガワ",
        "text": "左の回線だけを起こしてください。右へ触れると回収班に位置が出ます",
        "portraitOwner": "segawa",
        "portraitKind": "major",
        "sourceLine": 433
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "図面は私も見ます。みんな、右には触らないで",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 434
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "向こうでババヤガが無線の周波数を合わせる。雑音の中に、避難者へ指示する女性の声。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 435
      },
      {
        "kind": "dialogue",
        "speaker": "ババヤガ",
        "text": "……チハ？",
        "portraitOwner": "unit-babayaga",
        "portraitKind": "major",
        "sourceLine": 436
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "声が途切れ、制御盤へ感染者が押し寄せる。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 437
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が左の盤を起動し、仲間を回線の前へ配置する。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 438
      },
      {
        "kind": "battle-marker",
        "speaker": "◆ BATTLE",
        "text": "救難回線を復旧し、制御盤を守れ。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 439
      }
    ],
    "source": {
      "startLine": 431,
      "endLine": 440
    }
  },
  "v100:event:s15:post": {
    "id": "v100:event:s15:post",
    "kind": "stage-post",
    "stageNumber": 15,
    "musicProfile": "locked-stage-profile",
    "nodes": [
      {
        "kind": "action",
        "speaker": null,
        "text": "回線が繋がる。女性は十二人の避難者を数え終え、ようやく無線へ出る。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 443
      },
      {
        "kind": "dialogue",
        "speaker": "ババヤガ",
        "text": "チハ。俺や",
        "portraitOwner": "unit-babayaga",
        "portraitKind": "major",
        "sourceLine": 444
      },
      {
        "kind": "dialogue",
        "speaker": "Mrs.チハの声",
        "text": "分かってる。さっきから声が聞こえた",
        "portraitOwner": null,
        "portraitKind": "offscreen",
        "sourceLine": 445
      },
      {
        "kind": "dialogue",
        "speaker": "ババヤガ",
        "text": "今行く",
        "portraitOwner": "unit-babayaga",
        "portraitKind": "major",
        "sourceLine": 446
      },
      {
        "kind": "dialogue",
        "speaker": "Mrs.チハの声",
        "text": "中央から、まだ流れ込んでくる。先にそこを閉めて。こっちは待つ",
        "portraitOwner": null,
        "portraitKind": "offscreen",
        "sourceLine": 447
      },
      {
        "kind": "dialogue",
        "speaker": "ババヤガ",
        "text": "待ってて",
        "portraitOwner": "unit-babayaga",
        "portraitKind": "major",
        "sourceLine": 448
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "一拍だけ無線が静かになる。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 449
      },
      {
        "kind": "dialogue",
        "speaker": "Mrs.チハの声",
        "text": "うん。今度は、待ってる",
        "portraitOwner": null,
        "portraitKind": "offscreen",
        "sourceLine": 450
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が中央封鎖区への地図を受け取り、出発する。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 451
      }
    ],
    "source": {
      "startLine": 442,
      "endLine": 452
    }
  },
  "v100:event:s15:first-clear-post": {
    "id": "v100:event:s15:first-clear-post",
    "kind": "first-clear-post",
    "stageNumber": 15,
    "musicProfile": "locked-stage-profile",
    "nodes": [],
    "finalizeOnly": true,
    "source": {
      "startLine": 442,
      "endLine": 452
    }
  },
  "v100:event:s16:pre": {
    "id": "v100:event:s16:pre",
    "kind": "stage-pre",
    "stageNumber": 16,
    "musicProfile": "locked-stage-profile",
    "nodes": [
      {
        "kind": "action",
        "speaker": null,
        "text": "三基のゲートが開いたまま、湾岸へ感染者を送り出している。遠くの塔から銃声。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 457
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "全部閉めます。一本残せば、地下から抜ける",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 458
      },
      {
        "kind": "dialogue",
        "speaker": "Mrs.チハの声",
        "text": "弾は二十七発。子どもたちを先に下ろしたい",
        "portraitOwner": null,
        "portraitKind": "offscreen",
        "sourceLine": 459
      },
      {
        "kind": "dialogue",
        "speaker": "ババヤガ",
        "text": "こちらで流れを止める。合流の時、一発残して",
        "portraitOwner": "unit-babayaga",
        "portraitKind": "major",
        "sourceLine": 460
      },
      {
        "kind": "dialogue",
        "speaker": "Mrs.チハの声",
        "text": "そんな使い道、贅沢ね",
        "portraitOwner": null,
        "portraitKind": "offscreen",
        "sourceLine": 461
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が三基の担当を指示し、最初の閉鎖盤へ向かう。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 462
      },
      {
        "kind": "battle-marker",
        "speaker": "◆ BATTLE",
        "text": "三基のゲートを閉鎖し、湾岸への流入を止めよ。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 463
      }
    ],
    "source": {
      "startLine": 456,
      "endLine": 464
    }
  },
  "v100:event:s16:post": {
    "id": "v100:event:s16:post",
    "kind": "stage-post",
    "stageNumber": 16,
    "musicProfile": "locked-stage-profile",
    "nodes": [
      {
        "kind": "action",
        "speaker": null,
        "text": "三つ目のゲートが閉じる。塔の銃声も止まる。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 467
      },
      {
        "kind": "dialogue",
        "speaker": "Mrs.チハの声",
        "text": "こっちは静かになった。残り、一発",
        "portraitOwner": null,
        "portraitKind": "offscreen",
        "sourceLine": 468
      },
      {
        "kind": "dialogue",
        "speaker": "ババヤガ",
        "text": "使わずに済みそう？",
        "portraitOwner": "unit-babayaga",
        "portraitKind": "major",
        "sourceLine": 469
      },
      {
        "kind": "dialogue",
        "speaker": "Mrs.チハの声",
        "text": "それはまだ、分からない",
        "portraitOwner": null,
        "portraitKind": "offscreen",
        "sourceLine": 470
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "地図に塔への細い通路が現れる。セガワが所要時間を読み上げ、いくらちゃんは時刻だけ記録する。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 471
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が車両を塔へ発進させる。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 472
      }
    ],
    "source": {
      "startLine": 466,
      "endLine": 473
    }
  },
  "v100:event:s16:first-clear-post": {
    "id": "v100:event:s16:first-clear-post",
    "kind": "first-clear-post",
    "stageNumber": 16,
    "musicProfile": "locked-stage-profile",
    "nodes": [],
    "finalizeOnly": true,
    "source": {
      "startLine": 466,
      "endLine": 473
    }
  },
  "v100:event:s17:pre": {
    "id": "v100:event:s17:pre",
    "kind": "stage-pre",
    "stageNumber": 17,
    "musicProfile": "locked-stage-profile",
    "nodes": [
      {
        "kind": "action",
        "speaker": null,
        "text": "回廊の奥に十二人。Mrs.チハは最後尾で一発だけ残ったランチャーを構える。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 478
      },
      {
        "kind": "dialogue",
        "speaker": "Mrs.チハ",
        "text": "子どもを真ん中に。押さないで、歩いて",
        "portraitOwner": "unit-mrs-chiha",
        "portraitKind": "major",
        "sourceLine": 479
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "多眼の感染体が明かりへ向く。ババヤガが呼ぶより先に、Mrs.チハが撃つ。左側の眼が潰れた。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 480
      },
      {
        "kind": "dialogue",
        "speaker": "Mrs.チハ",
        "text": "左から。私の弾は終わり",
        "portraitOwner": "unit-mrs-chiha",
        "portraitKind": "major",
        "sourceLine": 481
      },
      {
        "kind": "dialogue",
        "speaker": "ババヤガ",
        "text": "チハ、そこを離れて",
        "portraitOwner": "unit-babayaga",
        "portraitKind": "major",
        "sourceLine": 482
      },
      {
        "kind": "dialogue",
        "speaker": "Mrs.チハ",
        "text": "十二人が通るまで、離れない",
        "portraitOwner": "unit-mrs-chiha",
        "portraitKind": "major",
        "sourceLine": 483
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が左の死角へ部隊を展開させ、回廊の前へ出る。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 484
      },
      {
        "kind": "boss-marker",
        "speaker": "◆ BOSS",
        "text": "クロメ",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 485
      },
      {
        "kind": "battle-marker",
        "speaker": "◆ BATTLE",
        "text": "大型個体を退け、十二人の避難路を確保せよ。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 486
      }
    ],
    "source": {
      "startLine": 477,
      "endLine": 487
    }
  },
  "v100:event:s17:post": {
    "id": "v100:event:s17:post",
    "kind": "stage-post",
    "stageNumber": 17,
    "musicProfile": "locked-stage-profile",
    "nodes": [
      {
        "kind": "action",
        "speaker": null,
        "text": "十二人目が車両へ乗る。Mrs.チハは数え直してから、ババヤガへ歩く。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 490
      },
      {
        "kind": "dialogue",
        "speaker": "Mrs.チハ",
        "text": "遅かった",
        "portraitOwner": "unit-mrs-chiha",
        "portraitKind": "major",
        "sourceLine": 491
      },
      {
        "kind": "dialogue",
        "speaker": "ババヤガ",
        "text": "うん。ごめん",
        "portraitOwner": "unit-babayaga",
        "portraitKind": "major",
        "sourceLine": 492
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "彼女が首筋と腕を確かめる。噛み傷がないのを見て、初めて肩に額を寄せる。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 493
      },
      {
        "kind": "dialogue",
        "speaker": "ババヤガ",
        "text": "そっちは",
        "portraitOwner": "unit-babayaga",
        "portraitKind": "major",
        "sourceLine": 494
      },
      {
        "kind": "dialogue",
        "speaker": "Mrs.チハ",
        "text": "大丈夫。先にこの人たちを病院へ",
        "portraitOwner": "unit-mrs-chiha",
        "portraitKind": "major",
        "sourceLine": 495
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "いくらちゃんが防疫扉へ触れる前に、Mrs.チハが八桁の番号で開ける。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 496
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "その番号は？",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 497
      },
      {
        "kind": "dialogue",
        "speaker": "Mrs.チハ",
        "text": "以前の仕事で見た。説明は、全員を運んでからでいい？",
        "portraitOwner": "unit-mrs-chiha",
        "portraitKind": "major",
        "sourceLine": 498
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が予備弾薬と空席を渡す。いくらちゃんは入力履歴を保存する。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 499
      },
      {
        "kind": "system",
        "speaker": "■ SYSTEM",
        "text": "Mrs.チハ加入／グレネード制圧",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 500
      }
    ],
    "source": {
      "startLine": 489,
      "endLine": 501
    }
  },
  "v100:event:s17:first-clear-post": {
    "id": "v100:event:s17:first-clear-post",
    "kind": "first-clear-post",
    "stageNumber": 17,
    "musicProfile": "locked-stage-profile",
    "nodes": [],
    "finalizeOnly": true,
    "source": {
      "startLine": 489,
      "endLine": 501
    }
  },
  "v100:event:s18:pre": {
    "id": "v100:event:s18:pre",
    "kind": "stage-pre",
    "stageNumber": 18,
    "musicProfile": "locked-stage-profile",
    "nodes": [
      {
        "kind": "action",
        "speaker": null,
        "text": "紙の台帳が天井まで積まれ、端末では遠隔消去が始まっている。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 506
      },
      {
        "kind": "dialogue",
        "speaker": "ザキミヤ",
        "text": "妻と娘だけ先に探して――",
        "portraitOwner": "unit-zakimiya",
        "portraitKind": "major",
        "sourceLine": 507
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "棚の無数の名前を見る。彼は息を吸い直す。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 508
      },
      {
        "kind": "dialogue",
        "speaker": "ザキミヤ",
        "text": "いや、全部持って出よう。誰かの二人を置いていけん",
        "portraitOwner": "unit-zakimiya",
        "portraitKind": "major",
        "sourceLine": 509
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "モニターにムガリアン社長。救援薬と、家族の解放を提示する。代価は台帳の返却。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 510
      },
      {
        "kind": "dialogue",
        "speaker": "ムガリアン社長",
        "text": "あなた方に必要なものは、何でも用意しマス",
        "portraitOwner": "mugarian-president",
        "portraitKind": "major",
        "sourceLine": 511
      },
      {
        "kind": "dialogue",
        "speaker": "ザキミヤ",
        "text": "俺の家族を、あんたの取引に入れるな",
        "portraitOwner": "unit-zakimiya",
        "portraitKind": "major",
        "sourceLine": 512
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が画面の音量を切り、最上段の紙箱を仲間へ渡す。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 513
      },
      {
        "kind": "battle-marker",
        "speaker": "◆ BATTLE",
        "text": "遠隔消去を止め、紙台帳を搬出せよ。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 514
      }
    ],
    "source": {
      "startLine": 505,
      "endLine": 515
    }
  },
  "v100:event:s18:post": {
    "id": "v100:event:s18:post",
    "kind": "stage-post",
    "stageNumber": 18,
    "musicProfile": "locked-stage-profile",
    "nodes": [
      {
        "kind": "action",
        "speaker": null,
        "text": "原本もデータも残った。いくらちゃんが検索結果をザキミヤへ見せる。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 518
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "二人とも三日前に生存確認。臨床試験棟Cです",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 519
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "ザキミヤは床へ座る。写真を見て、掌で目を覆う。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 520
      },
      {
        "kind": "dialogue",
        "speaker": "ザキミヤ",
        "text": "……まだ、間に合う",
        "portraitOwner": "unit-zakimiya",
        "portraitKind": "major",
        "sourceLine": 521
      },
      {
        "kind": "dialogue",
        "speaker": "Mrs.チハ",
        "text": "行こう。ただ、この台帳を先に三か所へ送る。奪い返されたら、誰の居場所も消える",
        "portraitOwner": "unit-mrs-chiha",
        "portraitKind": "major",
        "sourceLine": 522
      },
      {
        "kind": "dialogue",
        "speaker": "ババヤガ",
        "text": "やり方を知っとるね",
        "portraitOwner": "unit-babayaga",
        "portraitKind": "major",
        "sourceLine": 523
      },
      {
        "kind": "dialogue",
        "speaker": "Mrs.チハ",
        "text": "知ってる。あとで話す",
        "portraitOwner": "unit-mrs-chiha",
        "portraitKind": "major",
        "sourceLine": 524
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が原本を封じ、搬送車を海浜連絡橋へ向ける。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 525
      }
    ],
    "source": {
      "startLine": 517,
      "endLine": 526
    }
  },
  "v100:event:s18:first-clear-post": {
    "id": "v100:event:s18:first-clear-post",
    "kind": "first-clear-post",
    "stageNumber": 18,
    "musicProfile": "locked-stage-profile",
    "nodes": [],
    "finalizeOnly": true,
    "source": {
      "startLine": 517,
      "endLine": 526
    }
  },
  "v100:event:s19:pre": {
    "id": "v100:event:s19:pre",
    "kind": "stage-pre",
    "stageNumber": 19,
    "musicProfile": "locked-stage-profile",
    "nodes": [
      {
        "kind": "action",
        "speaker": null,
        "text": "橋上を企業の装甲車両が塞ぐ。背後には台帳を積んだ搬送車。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 531
      },
      {
        "kind": "dialogue",
        "speaker": "セガワ",
        "text": "保守車線が開くのは七秒。一台だけ抜けます",
        "portraitOwner": "segawa",
        "portraitKind": "major",
        "sourceLine": 532
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "俺が運ぶ",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 533
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "運転席へ座り、彼は震える手でベルトを引く。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 534
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "怖いなら言え",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 535
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "怖いっす。でも、誰かが持って行かないと",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 536
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が搬送車の扉を一度叩き、自分たちの車両を盾の位置へ出す。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 537
      },
      {
        "kind": "battle-marker",
        "speaker": "◆ BATTLE",
        "text": "七秒の通路を確保し、証拠搬送車を橋の向こうへ通せ。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 538
      }
    ],
    "source": {
      "startLine": 530,
      "endLine": 539
    }
  },
  "v100:event:s19:post": {
    "id": "v100:event:s19:post",
    "kind": "stage-post",
    "stageNumber": 19,
    "musicProfile": "locked-stage-profile",
    "nodes": [
      {
        "kind": "action",
        "speaker": null,
        "text": "搬送車が遮断機を擦って抜ける。パイセンの荒い呼吸が無線に残る。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 542
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "病院、区役所、外周。複製は三か所へ届いた",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 543
      },
      {
        "kind": "dialogue",
        "speaker": "パイセンの声",
        "text": "よかった。……手、まだ震えてる",
        "portraitOwner": null,
        "portraitKind": "offscreen",
        "sourceLine": 544
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "着いたら水飲んで待ってて。迎えに行く",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 545
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "河口防潮門から大型感染者が西新側へ流入したと知らせが入る。ザキミヤは試験棟の方を見る。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 546
      },
      {
        "kind": "dialogue",
        "speaker": "ザキミヤ",
        "text": "先に門を閉めよう。二人を連れて帰る道まで、失くしたくない",
        "portraitOwner": "unit-zakimiya",
        "portraitKind": "major",
        "sourceLine": 547
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が車両を河口へ向け直す。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 548
      }
    ],
    "source": {
      "startLine": 541,
      "endLine": 549
    }
  },
  "v100:event:s19:first-clear-post": {
    "id": "v100:event:s19:first-clear-post",
    "kind": "first-clear-post",
    "stageNumber": 19,
    "musicProfile": "locked-stage-profile",
    "nodes": [],
    "finalizeOnly": true,
    "source": {
      "startLine": 541,
      "endLine": 549
    }
  },
  "v100:event:s20:pre": {
    "id": "v100:event:s20:pre",
    "kind": "stage-pre",
    "stageNumber": 20,
    "musicProfile": "locked-stage-profile",
    "nodes": [
      {
        "kind": "action",
        "speaker": null,
        "text": "開いた防潮門に大型感染体が身体を挟み、流入が止まらない。向こう側は病院へ続く生活道路。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 554
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "ここを閉めれば、商店街から病院まで歩いて薬を運べる",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 555
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "食べ物も、人も。取り戻すなら、その道からや",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 556
      },
      {
        "kind": "dialogue",
        "speaker": "TKY",
        "text": "門から引き剥がす。閉めるのは任せた",
        "portraitOwner": "unit-tky",
        "portraitKind": "major",
        "sourceLine": 557
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が手動閉鎖盤を起動し、感染体を水路側へ誘う。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 558
      },
      {
        "kind": "boss-marker",
        "speaker": "◆ BOSS",
        "text": "ガイレン",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 559
      },
      {
        "kind": "battle-marker",
        "speaker": "◆ BATTLE",
        "text": "ガイレンを退け、防潮門を閉鎖せよ。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 560
      }
    ],
    "source": {
      "startLine": 553,
      "endLine": 561
    }
  },
  "v100:event:s20:post": {
    "id": "v100:event:s20:post",
    "kind": "stage-post",
    "stageNumber": 20,
    "musicProfile": "locked-stage-profile",
    "nodes": [
      {
        "kind": "action",
        "speaker": null,
        "text": "門が閉じる。夜、仮設灯の下を薬を積んだ自転車が病院へ走る。初めて住民が道を歩く。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 566,
        "sceneTag": "corridor"
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "昨日、ここは通れなかったんすよね",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 567,
        "sceneTag": "corridor"
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "明日も通れるようにする",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 568,
        "sceneTag": "corridor"
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "本社へ続く道には、感染者が急所を断たれて倒れている。二刀の男が路地から出てくる。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 571,
        "sceneTag": "musashi"
      },
      {
        "kind": "dialogue",
        "speaker": "TKY",
        "text": "あの刃の人か",
        "portraitOwner": "unit-tky",
        "portraitKind": "major",
        "sourceLine": 572,
        "sceneTag": "musashi"
      },
      {
        "kind": "dialogue",
        "speaker": "宮本武蔵",
        "text": "血の流れは、あの黒い楼へ向かう。お主らも行くのか",
        "portraitOwner": "unit-miyamoto-musashi",
        "portraitKind": "major",
        "sourceLine": 573,
        "sceneTag": "musashi"
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "名前を聞いてもいい？",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 574,
        "sceneTag": "musashi"
      },
      {
        "kind": "dialogue",
        "speaker": "宮本武蔵",
        "text": "宮本武蔵",
        "portraitOwner": "unit-miyamoto-musashi",
        "portraitKind": "major",
        "sourceLine": 575,
        "sceneTag": "musashi"
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "誰もすぐには返さない。武蔵はその沈黙を気にせず、遠くの塔を見上げる。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 576,
        "sceneTag": "musashi"
      },
      {
        "kind": "dialogue",
        "speaker": "宮本武蔵",
        "text": "道が同じなら、刃を貸す",
        "portraitOwner": "unit-miyamoto-musashi",
        "portraitKind": "major",
        "sourceLine": 577,
        "sceneTag": "musashi"
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が空いた席を示す。武蔵は二刀を納めて乗る。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 578,
        "sceneTag": "musashi"
      },
      {
        "kind": "system",
        "speaker": "■ SYSTEM",
        "text": "宮本武蔵加入／二刀近接",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 579,
        "sceneTag": "musashi"
      }
    ],
    "source": {
      "startLine": 563,
      "endLine": 580
    }
  },
  "v100:event:s20:first-clear-post": {
    "id": "v100:event:s20:first-clear-post",
    "kind": "first-clear-post",
    "stageNumber": 20,
    "musicProfile": "locked-stage-profile",
    "nodes": [],
    "finalizeOnly": true,
    "source": {
      "startLine": 563,
      "endLine": 580
    }
  },
  "v100:event:s21:pre": {
    "id": "v100:event:s21:pre",
    "kind": "stage-pre",
    "stageNumber": 21,
    "musicProfile": "locked-stage-profile",
    "nodes": [
      {
        "kind": "action",
        "speaker": null,
        "text": "ゲートには赤いレンズの回収班。背後の建物に「臨床試験棟C」の表示。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 585
      },
      {
        "kind": "dialogue",
        "speaker": "赤レンズの隊長",
        "text": "記録を置いて退去しろ",
        "portraitOwner": "red-panther-commander",
        "portraitKind": "major",
        "sourceLine": 586
      },
      {
        "kind": "dialogue",
        "speaker": "ザキミヤ",
        "text": "中の人を出せ。四十三人、いるんやろ",
        "portraitOwner": "unit-zakimiya",
        "portraitKind": "major",
        "sourceLine": 587
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "隊員が音響誘導装置を構える。Mrs.チハが東塔を指した。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 588
      },
      {
        "kind": "dialogue",
        "speaker": "Mrs.チハ",
        "text": "あれを先に止めて。鳴らされたら、周りの感染者が集まる",
        "portraitOwner": "unit-mrs-chiha",
        "portraitKind": "major",
        "sourceLine": 589
      },
      {
        "kind": "dialogue",
        "speaker": "ババヤガ",
        "text": "仕様書で見た？",
        "portraitOwner": "unit-babayaga",
        "portraitKind": "major",
        "sourceLine": 590
      },
      {
        "kind": "dialogue",
        "speaker": "Mrs.チハ",
        "text": "うん。今は信じて",
        "portraitOwner": "unit-mrs-chiha",
        "portraitKind": "major",
        "sourceLine": 591
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が車両を避難路へ置き、東塔に照準を合わせる。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 592
      },
      {
        "kind": "battle-marker",
        "speaker": "◆ BATTLE",
        "text": "誘導装置を止め、臨床試験棟への道を開け。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 593
      }
    ],
    "source": {
      "startLine": 584,
      "endLine": 594
    }
  },
  "v100:event:s21:post": {
    "id": "v100:event:s21:post",
    "kind": "stage-post",
    "stageNumber": 21,
    "musicProfile": "locked-stage-profile",
    "nodes": [
      {
        "kind": "action",
        "speaker": null,
        "text": "護送予定表に四十三人の名前。ザキミヤの妻子にも、今朝の確認時刻がある。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 597
      },
      {
        "kind": "dialogue",
        "speaker": "ザキミヤ",
        "text": "今朝、ここにおった",
        "portraitOwner": "unit-zakimiya",
        "portraitKind": "major",
        "sourceLine": 598
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "処分警報が鳴る。表示より先にMrs.チハが残り時間を口にする。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 599
      },
      {
        "kind": "dialogue",
        "speaker": "Mrs.チハ",
        "text": "八分。電源を落としてから焼却する",
        "portraitOwner": "unit-mrs-chiha",
        "portraitKind": "major",
        "sourceLine": 600
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "なんで分かるんすか",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 601
      },
      {
        "kind": "dialogue",
        "speaker": "Mrs.チハ",
        "text": "終わったら話す。八分を使わせて",
        "portraitOwner": "unit-mrs-chiha",
        "portraitKind": "major",
        "sourceLine": 602
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が棟の扉へ走り、全員が続く。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 603
      }
    ],
    "source": {
      "startLine": 596,
      "endLine": 604
    }
  },
  "v100:event:s21:first-clear-post": {
    "id": "v100:event:s21:first-clear-post",
    "kind": "first-clear-post",
    "stageNumber": 21,
    "musicProfile": "locked-stage-profile",
    "nodes": [],
    "finalizeOnly": true,
    "source": {
      "startLine": 596,
      "endLine": 604
    }
  },
  "v100:event:s22:pre": {
    "id": "v100:event:s22:pre",
    "kind": "stage-pre",
    "stageNumber": 22,
    "musicProfile": "locked-stage-profile",
    "nodes": [
      {
        "kind": "action",
        "speaker": null,
        "text": "白い廊下。部屋の扉を叩く音が、警報と重なる。C-4は一番奥。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 609
      },
      {
        "kind": "dialogue",
        "speaker": "ザキミヤ",
        "text": "C-4から開けられんのか",
        "portraitOwner": "unit-zakimiya",
        "portraitKind": "major",
        "sourceLine": 610
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "東から電源を戻さないと、全部ロックされます",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 611
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "ザキミヤが走り出して止まる。拳を握ったまま、隣の扉を見る。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 612
      },
      {
        "kind": "dialogue",
        "speaker": "ザキミヤ",
        "text": "分かった。ここからやろう。最後まで手伝って",
        "portraitOwner": "unit-zakimiya",
        "portraitKind": "major",
        "sourceLine": 613
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "四十三人、全部開ける",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 614
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が最初の生命維持レバーを上げる。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 615
      },
      {
        "kind": "battle-marker",
        "speaker": "◆ BATTLE",
        "text": "処分手順を止め、四十三人を順に救出せよ。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 616
      }
    ],
    "source": {
      "startLine": 608,
      "endLine": 617
    }
  },
  "v100:event:s22:post": {
    "id": "v100:event:s22:post",
    "kind": "stage-post",
    "stageNumber": 22,
    "musicProfile": "locked-stage-profile",
    "nodes": [
      {
        "kind": "action",
        "speaker": null,
        "text": "C-4の扉が開く。ザキミヤの妻が、娘を抱いて立っている。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 620
      },
      {
        "kind": "dialogue",
        "speaker": "ザキミヤの妻",
        "text": "生きとったん",
        "portraitOwner": "minor-human-shared-event-silhouette",
        "portraitKind": "minor",
        "sourceLine": 621
      },
      {
        "kind": "dialogue",
        "speaker": "ザキミヤ",
        "text": "うん。遅くなった",
        "portraitOwner": "unit-zakimiya",
        "portraitKind": "major",
        "sourceLine": 622
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "彼が手を伸ばす。妻は煤と血で黒い指を見る。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 623
      },
      {
        "kind": "dialogue",
        "speaker": "ザキミヤの妻",
        "text": "まず洗ってきて。娘に触る手やから",
        "portraitOwner": "minor-human-shared-event-silhouette",
        "portraitKind": "minor",
        "sourceLine": 624
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "ザキミヤは流しで何度も洗う。戻ると、妻が娘を渡す。小さな指が彼の指を握った。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 625
      },
      {
        "kind": "dialogue",
        "speaker": "ザキミヤ",
        "text": "父ちゃんや。今日から、覚えて",
        "portraitOwner": "unit-zakimiya",
        "portraitKind": "major",
        "sourceLine": 626
      },
      {
        "kind": "dialogue",
        "speaker": "ザキミヤの妻",
        "text": "また出るんやろ。帰ってきてね",
        "portraitOwner": "minor-human-shared-event-silhouette",
        "portraitKind": "minor",
        "sourceLine": 627
      },
      {
        "kind": "dialogue",
        "speaker": "ザキミヤ",
        "text": "帰る。今度は、帰るところが分かっとる",
        "portraitOwner": "unit-zakimiya",
        "portraitKind": "major",
        "sourceLine": 628
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "無線に回収班の声。「エージェントCH-17、帰投しろ」。Mrs.チハが振り向く。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 629
      },
      {
        "kind": "dialogue",
        "speaker": "ババヤガ",
        "text": "チハ？",
        "portraitOwner": "unit-babayaga",
        "portraitKind": "major",
        "sourceLine": 630
      },
      {
        "kind": "dialogue",
        "speaker": "Mrs.チハ",
        "text": "私のこと。ここを出たら、全部話す",
        "portraitOwner": "unit-mrs-chiha",
        "portraitKind": "major",
        "sourceLine": 631
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が救出者を安全回廊へ送り、Mrs.チハと共に追撃から離れる。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 632
      }
    ],
    "source": {
      "startLine": 619,
      "endLine": 633
    }
  },
  "v100:event:s22:first-clear-post": {
    "id": "v100:event:s22:first-clear-post",
    "kind": "first-clear-post",
    "stageNumber": 22,
    "musicProfile": "locked-stage-profile",
    "nodes": [],
    "finalizeOnly": true,
    "source": {
      "startLine": 619,
      "endLine": 633
    }
  },
  "v100:event:s23:pre": {
    "id": "v100:event:s23:pre",
    "kind": "stage-pre",
    "stageNumber": 23,
    "musicProfile": "locked-stage-profile",
    "nodes": [
      {
        "kind": "action",
        "speaker": null,
        "text": "防爆扉の外に追撃部隊。Mrs.チハが武器と認証カードを床へ置く。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 638
      },
      {
        "kind": "dialogue",
        "speaker": "Mrs.チハ",
        "text": "ムガリアンの専属エージェントだった。発生前は、限定事故を起こして回収すると聞かされていた",
        "portraitOwner": "unit-mrs-chiha",
        "portraitKind": "major",
        "sourceLine": 639
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "人を噛ませる話やろ",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 640
      },
      {
        "kind": "dialogue",
        "speaker": "Mrs.チハ",
        "text": "そう。仕事だと自分に言って、見ないふりをした",
        "portraitOwner": "unit-mrs-chiha",
        "portraitKind": "major",
        "sourceLine": 641
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "彼女はババヤガを見る。彼はカードではなく、妻の顔を見ている。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 642
      },
      {
        "kind": "dialogue",
        "speaker": "ババヤガ",
        "text": "俺も知っとった？",
        "portraitOwner": "unit-babayaga",
        "portraitKind": "major",
        "sourceLine": 643
      },
      {
        "kind": "dialogue",
        "speaker": "Mrs.チハ",
        "text": "あなたの裏の仕事も。最初は調べた。好きになってからも言えなかった",
        "portraitOwner": "unit-mrs-chiha",
        "portraitKind": "major",
        "sourceLine": 644
      },
      {
        "kind": "dialogue",
        "speaker": "ババヤガ",
        "text": "……俺には、あとで全部聞かせて",
        "portraitOwner": "unit-babayaga",
        "portraitKind": "major",
        "sourceLine": 645
      },
      {
        "kind": "dialogue",
        "speaker": "Mrs.チハ",
        "text": "逃げない。いま私ができることを見てて",
        "portraitOwner": "unit-mrs-chiha",
        "portraitKind": "major",
        "sourceLine": 646
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "カードで内部記録を開く。主人公が外部送信先を示し、実行キーの前を空ける。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 647
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が扉を支える。Mrs.チハが自分の手で送信を実行し、カードを失効させる。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 648
      },
      {
        "kind": "dialogue",
        "speaker": "Mrs.チハ",
        "text": "もう、あそこへは戻らない",
        "portraitOwner": "unit-mrs-chiha",
        "portraitKind": "major",
        "sourceLine": 649
      },
      {
        "kind": "battle-marker",
        "speaker": "◆ BATTLE",
        "text": "追撃を退け、指揮車から本社塔の認証キーを奪え。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 650
      }
    ],
    "source": {
      "startLine": 637,
      "endLine": 651
    }
  },
  "v100:event:s23:post": {
    "id": "v100:event:s23:post",
    "kind": "stage-post",
    "stageNumber": 23,
    "musicProfile": "locked-stage-profile",
    "nodes": [
      {
        "kind": "action",
        "speaker": null,
        "text": "指揮車の命令書。社長の承認を経ない「S特級権限」で、TAKUYAの再生と戦闘記録の複製が指示されていた。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 654
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "病院で私たちを見ていた回線と同じ署名です",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 655
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "セガワさん。これは何ですか",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 656
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "無線に返事が来るまで、長い間がある。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 657
      },
      {
        "kind": "dialogue",
        "speaker": "セガワ",
        "text": "原本は技術開発塔です。そこまで来れば、答えます",
        "portraitOwner": "segawa",
        "portraitKind": "major",
        "sourceLine": 658
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "今でも答えられるやろ",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 659
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "無線は切れない。ただ、セガワは答えない。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 660
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "ババヤガが弾倉をMrs.チハへ渡す。彼女は黙って受け取る。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 661
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が認証キーを抜き、技術開発塔へ向かう。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 662
      }
    ],
    "source": {
      "startLine": 653,
      "endLine": 663
    }
  },
  "v100:event:s23:first-clear-post": {
    "id": "v100:event:s23:first-clear-post",
    "kind": "first-clear-post",
    "stageNumber": 23,
    "musicProfile": "locked-stage-profile",
    "nodes": [],
    "finalizeOnly": true,
    "source": {
      "startLine": 653,
      "endLine": 663
    }
  },
  "v100:event:s24:pre": {
    "id": "v100:event:s24:pre",
    "kind": "stage-pre",
    "stageNumber": 24,
    "musicProfile": "locked-stage-profile",
    "nodes": [
      {
        "kind": "action",
        "speaker": null,
        "text": "透明な隔壁に、大型感染体が二体。片方の動きが、わずかに遅れてもう片方へ移る。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 668
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "社長の映像が点く。左袖の下に黒い血がにじんでいる。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 669
      },
      {
        "kind": "dialogue",
        "speaker": "ムガリアン社長",
        "text": "小さな危機を起こし、当社が止める。街には復旧、会社には契約。そういう計画デシタ",
        "portraitOwner": "mugarian-president",
        "portraitKind": "major",
        "sourceLine": 670
      },
      {
        "kind": "dialogue",
        "speaker": "ザキミヤ",
        "text": "小さな危機に、うちの娘も入ってたんか",
        "portraitOwner": "unit-zakimiya",
        "portraitKind": "major",
        "sourceLine": 671
      },
      {
        "kind": "dialogue",
        "speaker": "ムガリアン社長",
        "text": "この規模は計画外です。変異も、拡大も。聞くべき相手は私だけではない",
        "portraitOwner": "mugarian-president",
        "portraitKind": "major",
        "sourceLine": 672
      },
      {
        "kind": "dialogue",
        "speaker": "セガワの声",
        "text": "中央制御を切れば二体は連動しません。先に止めてください",
        "portraitOwner": null,
        "portraitKind": "offscreen",
        "sourceLine": 673
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "社長の映像と無線を切り、いくらちゃんが制御線を現物で確かめる。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 674
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "言っている場所は合ってる。切るかは、私たちで決めます",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 675
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が切断箇所を確認し、隔壁の開放に備える。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 676
      },
      {
        "kind": "boss-marker",
        "speaker": "◆ BOSS",
        "text": "フタゴ",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 677
      },
      {
        "kind": "battle-marker",
        "speaker": "◆ BATTLE",
        "text": "制御を切り、二体の連携を崩して倒せ。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 678
      }
    ],
    "source": {
      "startLine": 667,
      "endLine": 679
    }
  },
  "v100:event:s24:post": {
    "id": "v100:event:s24:post",
    "kind": "stage-post",
    "stageNumber": 24,
    "musicProfile": "locked-stage-profile",
    "nodes": [
      {
        "kind": "action",
        "speaker": null,
        "text": "二体が離れて倒れる。役員研究所への昇降路が開いた。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 682
      },
      {
        "kind": "dialogue",
        "speaker": "Mrs.チハ",
        "text": "社長は噛まれてる。あの腕を見た",
        "portraitOwner": "unit-mrs-chiha",
        "portraitKind": "major",
        "sourceLine": 683
      },
      {
        "kind": "dialogue",
        "speaker": "セガワ",
        "text": "未承認の処置薬を持っているはずです。使わせないでください",
        "portraitOwner": "segawa",
        "portraitKind": "major",
        "sourceLine": 684
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "あんたも、何を持っとるか後で聞く",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 685
      },
      {
        "kind": "dialogue",
        "speaker": "セガワ",
        "text": "ええ",
        "portraitOwner": "segawa",
        "portraitKind": "major",
        "sourceLine": 686
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が昇降路に入り、仲間を呼ぶ。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 687
      }
    ],
    "source": {
      "startLine": 681,
      "endLine": 688
    }
  },
  "v100:event:s24:first-clear-post": {
    "id": "v100:event:s24:first-clear-post",
    "kind": "first-clear-post",
    "stageNumber": 24,
    "musicProfile": "locked-stage-profile",
    "nodes": [],
    "finalizeOnly": true,
    "source": {
      "startLine": 681,
      "endLine": 688
    }
  },
  "v100:event:s25:pre": {
    "id": "v100:event:s25:pre",
    "kind": "stage-pre",
    "stageNumber": 25,
    "musicProfile": "locked-stage-profile",
    "nodes": [
      {
        "kind": "action",
        "speaker": null,
        "text": "ガラスの向こうの社長は、左腕を机の下に隠す。壁には未承認薬が一本。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 693
      },
      {
        "kind": "dialogue",
        "speaker": "ムガリアン社長",
        "text": "設備も薬も渡しましょう。私の退路だけ保証してクダサイ",
        "portraitOwner": "mugarian-president",
        "portraitKind": "major",
        "sourceLine": 694
      },
      {
        "kind": "dialogue",
        "speaker": "Mrs.チハ",
        "text": "設備は残す。働く人も守る。でも、あなたへは返さない",
        "portraitOwner": "unit-mrs-chiha",
        "portraitKind": "major",
        "sourceLine": 695
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "社長が膝をつく。黒い変色が肩まで上がり、彼は薬を抜く。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 696
      },
      {
        "kind": "dialogue",
        "speaker": "セガワの声",
        "text": "人間への試験は終わっていません。打てば感染組織が増えます",
        "portraitOwner": null,
        "portraitKind": "offscreen",
        "sourceLine": 697
      },
      {
        "kind": "dialogue",
        "speaker": "ムガリアン社長",
        "text": "ほかの薬は？",
        "portraitOwner": "mugarian-president",
        "portraitKind": "major",
        "sourceLine": 698
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "答えはない。社長が自分の腕に針を刺す。数秒だけ変色が止まり、ガラスに亀裂が走る。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 699
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が仲間を退かせ、医療設備を守る位置へ出る。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 700
      },
      {
        "kind": "boss-marker",
        "speaker": "◆ BOSS",
        "text": "変異ムガリアン社長",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 701
      },
      {
        "kind": "battle-marker",
        "speaker": "◆ BATTLE",
        "text": "変異した社長を止め、薬と医療設備を守れ。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 702
      }
    ],
    "source": {
      "startLine": 692,
      "endLine": 703
    }
  },
  "v100:event:s25:post": {
    "id": "v100:event:s25:post",
    "kind": "stage-post",
    "stageNumber": 25,
    "musicProfile": "locked-stage-profile",
    "nodes": [
      {
        "kind": "action",
        "speaker": null,
        "text": "社長が倒れる。窓の外の街を見たまま、声が細くなる。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 706
      },
      {
        "kind": "dialogue",
        "speaker": "ムガリアン社長",
        "text": "こんなに広がるはずでは……",
        "portraitOwner": "mugarian-president",
        "portraitKind": "major",
        "sourceLine": 707
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "最初に人のおる場所へ出した。その先も、お前が決めたことや",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 708
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "施設警報が静まる。病院へ、救出した人と薬が届いた知らせ。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 709
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "夜。仮設の炊き出しで、全員が紙コップの味噌汁を持つ。ザキミヤは妻子のそばで哺乳瓶を冷ましている。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 712,
        "sceneTag": "soup"
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "熱いっすね",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 713,
        "sceneTag": "soup"
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "ゆっくり飲め",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 714,
        "sceneTag": "soup"
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "冷蔵車列の追跡信号が無線に入る。社長の台帳にはない車。湯気の向こうで、全員が顔を上げる。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 715,
        "sceneTag": "soup"
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が残りを飲み、冷蔵車列の行き先を地図に示す。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 716,
        "sceneTag": "soup"
      }
    ],
    "source": {
      "startLine": 705,
      "endLine": 717
    }
  },
  "v100:event:s25:first-clear-post": {
    "id": "v100:event:s25:first-clear-post",
    "kind": "first-clear-post",
    "stageNumber": 25,
    "musicProfile": "locked-stage-profile",
    "nodes": [],
    "finalizeOnly": true,
    "source": {
      "startLine": 705,
      "endLine": 717
    }
  },
  "v100:event:s26:pre": {
    "id": "v100:event:s26:pre",
    "kind": "stage-pre",
    "stageNumber": 26,
    "musicProfile": "locked-stage-profile",
    "nodes": [
      {
        "kind": "action",
        "speaker": null,
        "text": "社員と家族を乗せたバスは正門へ。番号のない冷蔵車三台だけが保守路へ逸れる。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 722
      },
      {
        "kind": "dialogue",
        "speaker": "研究員の声",
        "text": "バスは通して！　止めるのは冷蔵車です。撤収台帳にありません",
        "portraitOwner": null,
        "portraitKind": "offscreen",
        "sourceLine": 723
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "一台に追跡タグが残ってる。味噌汁の時、配車データへ仕込みました",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 724
      },
      {
        "kind": "dialogue",
        "speaker": "Mrs.チハ",
        "text": "あれは社長の命令じゃない。研究部門の私設回収",
        "portraitOwner": "unit-mrs-chiha",
        "portraitKind": "major",
        "sourceLine": 725
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が社員バスを先に通し、冷蔵車へ進路を切る。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 726
      },
      {
        "kind": "battle-marker",
        "speaker": "◆ BATTLE",
        "text": "民間車両を巻き込まず、冷蔵車列を止めよ。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 727
      }
    ],
    "source": {
      "startLine": 721,
      "endLine": 728
    }
  },
  "v100:event:s26:post": {
    "id": "v100:event:s26:post",
    "kind": "stage-post",
    "stageNumber": 26,
    "musicProfile": "locked-stage-profile",
    "nodes": [
      {
        "kind": "action",
        "speaker": null,
        "text": "荷室には、薬局を出た日からの戦闘写真。負傷、退避、誰を待ったかまで記録されている。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 731
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "区役所で俺が戻った時間まである",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 732
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "助けた人数も、逃げた道も。私たち、人じゃなくて観測項目だった",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 733
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "セガワ。これ、お前やな",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 734
      },
      {
        "kind": "dialogue",
        "speaker": "セガワの声",
        "text": "はい。薬を届けたのも、観測したのも僕です",
        "portraitOwner": null,
        "portraitKind": "offscreen",
        "sourceLine": 735
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "助けたことを、言い訳に使うな",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 736
      },
      {
        "kind": "dialogue",
        "speaker": "セガワの声",
        "text": "言い訳はしません。原本を見に来てください",
        "portraitOwner": null,
        "portraitKind": "offscreen",
        "sourceLine": 737
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "座標が送られる。いくらちゃんは受信だけ確かめ、回線を切った。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 738
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が物理ファイルを押収し、座標を地図へ写す。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 739
      }
    ],
    "source": {
      "startLine": 730,
      "endLine": 740
    }
  },
  "v100:event:s26:first-clear-post": {
    "id": "v100:event:s26:first-clear-post",
    "kind": "first-clear-post",
    "stageNumber": 26,
    "musicProfile": "locked-stage-profile",
    "nodes": [],
    "finalizeOnly": true,
    "source": {
      "startLine": 730,
      "endLine": 740
    }
  },
  "v100:event:s27:pre": {
    "id": "v100:event:s27:pre",
    "kind": "stage-pre",
    "stageNumber": 27,
    "musicProfile": "locked-stage-profile",
    "nodes": [
      {
        "kind": "action",
        "speaker": null,
        "text": "旧物流網の奥で企業標章が削られ、赤い豹の章だけが残る。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 745
      },
      {
        "kind": "system",
        "speaker": "■ SYSTEM",
        "text": "SPECIAL OPERATIONS UNIT：RED PANTHER",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 746
      },
      {
        "kind": "dialogue",
        "speaker": "Mrs.チハ",
        "text": "研究部門の直轄。社長より特級博士の命令を優先する",
        "portraitOwner": "unit-mrs-chiha",
        "portraitKind": "major",
        "sourceLine": 747
      },
      {
        "kind": "dialogue",
        "speaker": "RED PANTHER隊長",
        "text": "ネコ殺しのセガワ特級博士命令。ここから先へ入れるな",
        "portraitOwner": "red-panther-commander",
        "portraitKind": "major",
        "sourceLine": 748
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "本人が呼んだんすけど",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 749
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "隊長は銃口を下げない。主人公は押収した命令書を示し、返答を待つ。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 750
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が仲間を遮蔽物へ移し、前進する。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 751
      },
      {
        "kind": "battle-marker",
        "speaker": "◆ BATTLE",
        "text": "RED PANTHERの封鎖を突破せよ。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 752
      }
    ],
    "source": {
      "startLine": 744,
      "endLine": 753
    }
  },
  "v100:event:s27:post": {
    "id": "v100:event:s27:post",
    "kind": "stage-post",
    "stageNumber": 27,
    "musicProfile": "locked-stage-profile",
    "nodes": [
      {
        "kind": "action",
        "speaker": null,
        "text": "紙の原本に「特級博士 セガワ／内部通称：ネコ殺し」。壁には発生前からの西新の地図。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 756
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "なんで、うちの街やった",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 757
      },
      {
        "kind": "dialogue",
        "speaker": "セガワの声",
        "text": "狭い場所に病院、交通、住宅、行政が揃っている。変化を一度に観測できます",
        "portraitOwner": null,
        "portraitKind": "offscreen",
        "sourceLine": 758
      },
      {
        "kind": "dialogue",
        "speaker": "ザキミヤ",
        "text": "人が住んどるから、都合がよかったと？",
        "portraitOwner": "unit-zakimiya",
        "portraitKind": "major",
        "sourceLine": 759
      },
      {
        "kind": "dialogue",
        "speaker": "セガワの声",
        "text": "ええ",
        "portraitOwner": null,
        "portraitKind": "offscreen",
        "sourceLine": 760
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "別の映像には、Stage 3で倒したTAKUYAの遺骸を回収する赤レンズ部隊。再生処置の記録が続く。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 761
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "あの日、終わったと思ってた",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 762
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "終わらせなかった人がいる",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 763
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が映像を止め、次の管制室へ進む。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 764
      }
    ],
    "source": {
      "startLine": 755,
      "endLine": 765
    }
  },
  "v100:event:s27:first-clear-post": {
    "id": "v100:event:s27:first-clear-post",
    "kind": "first-clear-post",
    "stageNumber": 27,
    "musicProfile": "locked-stage-profile",
    "nodes": [],
    "finalizeOnly": true,
    "source": {
      "startLine": 755,
      "endLine": 765
    }
  },
  "v100:event:s28:pre": {
    "id": "v100:event:s28:pre",
    "kind": "stage-pre",
    "stageNumber": 28,
    "musicProfile": "locked-stage-profile",
    "nodes": [
      {
        "kind": "action",
        "speaker": null,
        "text": "日本地図から各都市へ線が伸びる。災害用の噴霧器と医療設備に、起動命令を送る仕組み。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 770
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "まだ実行されていない線は、ここから止められる",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 771
      },
      {
        "kind": "dialogue",
        "speaker": "ザキミヤ",
        "text": "うちの娘にも、次の街の子にも、またやる気か",
        "portraitOwner": "unit-zakimiya",
        "portraitKind": "major",
        "sourceLine": 772
      },
      {
        "kind": "dialogue",
        "speaker": "セガワの声",
        "text": "人間は、自分で止まれません。傷つけると知っていて、使い続ける",
        "portraitOwner": null,
        "portraitKind": "offscreen",
        "sourceLine": 773
      },
      {
        "kind": "dialogue",
        "speaker": "ザキミヤ",
        "text": "あの子に罪がないと分かって、それでも殺すのか",
        "portraitOwner": "unit-zakimiya",
        "portraitKind": "major",
        "sourceLine": 774
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "セガワの返事はない。最初の保護カバーが閉まり始める。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 775
      },
      {
        "kind": "dialogue",
        "speaker": "宮本武蔵",
        "text": "治すと称して民を斬る者は、我の時代にもおった",
        "portraitOwner": "unit-miyamoto-musashi",
        "portraitKind": "major",
        "sourceLine": 776
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公がカバーを開き、物理停止レバーへ手を伸ばす。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 777
      },
      {
        "kind": "battle-marker",
        "speaker": "◆ BATTLE",
        "text": "国内の散布装置を物理停止せよ。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 778
      }
    ],
    "source": {
      "startLine": 769,
      "endLine": 779
    }
  },
  "v100:event:s28:post": {
    "id": "v100:event:s28:post",
    "kind": "stage-post",
    "stageNumber": 28,
    "musicProfile": "locked-stage-profile",
    "nodes": [
      {
        "kind": "action",
        "speaker": null,
        "text": "国内の未実行線が消える。通信断の地域は、いまも状況が分からない。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 782
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "ここから出す分は止めた。それは言い切れます",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 783
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "地下への扉に三つの表示。「国外一斉起動」「感染源原株」「T-03最終収容区」。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 784
      },
      {
        "kind": "dialogue",
        "speaker": "Mrs.チハ",
        "text": "外へ出る回線と原株を先に潰す。T-03の扉は、開けさせない",
        "portraitOwner": "unit-mrs-chiha",
        "portraitKind": "major",
        "sourceLine": 785
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が仲間の位置を確かめ、地下扉を開ける。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 786
      }
    ],
    "source": {
      "startLine": 781,
      "endLine": 787
    }
  },
  "v100:event:s28:first-clear-post": {
    "id": "v100:event:s28:first-clear-post",
    "kind": "first-clear-post",
    "stageNumber": 28,
    "musicProfile": "locked-stage-profile",
    "nodes": [],
    "finalizeOnly": true,
    "source": {
      "startLine": 781,
      "endLine": 787
    }
  },
  "v100:event:s29:pre": {
    "id": "v100:event:s29:pre",
    "kind": "stage-pre",
    "stageNumber": 29,
    "musicProfile": "locked-stage-profile",
    "nodes": [
      {
        "kind": "action",
        "speaker": null,
        "text": "国外の提携先へ伸びる線の前に、主人公たちの戦闘映像。誰を待ち、誰を運んだかが並ぶ。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 792
      },
      {
        "kind": "dialogue",
        "speaker": "セガワ",
        "text": "あなたたちは予測から外れました。効率の悪い選択を、何度もする",
        "portraitOwner": "segawa",
        "portraitKind": "major",
        "sourceLine": 793
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "人を待ったことか",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 794
      },
      {
        "kind": "dialogue",
        "speaker": "セガワ",
        "text": "その選択を観測したかった",
        "portraitOwner": "segawa",
        "portraitKind": "major",
        "sourceLine": 795
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "主人公はセガワのいるガラス室を見ず、起動回線と原株の位置を仲間へ示す。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 796
      },
      {
        "kind": "dialogue",
        "speaker": "Mrs.チハ",
        "text": "あなたを追うのは、外へ出るものを止めてから",
        "portraitOwner": "unit-mrs-chiha",
        "portraitKind": "major",
        "sourceLine": 797
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "二つとも同時に。片方だけでは再起動されます",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 798
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が二班へ指示し、原株の焼却盤へ向かう。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 799
      },
      {
        "kind": "battle-marker",
        "speaker": "◆ BATTLE",
        "text": "国外起動回線と感染源原株を同時破壊せよ。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 800
      }
    ],
    "source": {
      "startLine": 791,
      "endLine": 801
    }
  },
  "v100:event:s29:post": {
    "id": "v100:event:s29:post",
    "kind": "stage-post",
    "stageNumber": 29,
    "musicProfile": "locked-stage-profile",
    "nodes": [
      {
        "kind": "action",
        "speaker": null,
        "text": "世界地図から予定線が消え、原株が高熱槽へ落ちる。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 804
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "止まった。ここから外へは、もう出ない",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 805
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "ガラス室でセガワが物理鍵を回す。拘束具の外れる音が、地下から響く。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 806
      },
      {
        "kind": "dialogue",
        "speaker": "セガワ",
        "text": "では、最後の観測です",
        "portraitOwner": "segawa",
        "portraitKind": "major",
        "sourceLine": 807
      },
      {
        "kind": "system",
        "speaker": "■ SYSTEM",
        "text": "T-03／最終強化形態／個体名：TAKUYA-Ω",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 808
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "画面に、人工装甲をまとったTAKUYA。進路は西新の安全回廊。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 809
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "避難してる人の方へ、向かってる",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 810
      },
      {
        "kind": "dialogue",
        "speaker": "セガワ",
        "text": "あなたたちが教えました。人がどこへ集まるか",
        "portraitOwner": "segawa",
        "portraitKind": "major",
        "sourceLine": 811
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が車両の鍵を取り、崩れた研究区画を迂回して西新へ戻る。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 812
      }
    ],
    "source": {
      "startLine": 803,
      "endLine": 813
    }
  },
  "v100:event:s29:first-clear-post": {
    "id": "v100:event:s29:first-clear-post",
    "kind": "first-clear-post",
    "stageNumber": 29,
    "musicProfile": "locked-stage-profile",
    "nodes": [],
    "finalizeOnly": true,
    "source": {
      "startLine": 803,
      "endLine": 813
    }
  },
  "v100:event:s30:pre": {
    "id": "v100:event:s30:pre",
    "kind": "stage-pre",
    "stageNumber": 30,
    "musicProfile": "locked-stage-profile",
    "nodes": [
      {
        "kind": "action",
        "speaker": null,
        "text": "最初に戻った交差点。避難バスの最後尾が、まだ安全回廊へ入れない。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 818
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "人工装甲の上に、顔の傷、流した淡い髪、黒い眼帯。TAKUYA-Ωが建物の陰から現れる。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 819
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "あの日のTAKUYAっす。顔が、変わってない",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 820
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "主人公が装甲車両で指揮車の退路を塞ぐ。セガワは携帯発信器を掲げる。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 821
      },
      {
        "kind": "dialogue",
        "speaker": "セガワ",
        "text": "停止",
        "portraitOwner": "segawa",
        "portraitKind": "major",
        "sourceLine": 822
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "巨体が止まる。セガワが発信器を主人公たちへ向ける。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 823
      },
      {
        "kind": "dialogue",
        "speaker": "セガワ",
        "text": "対象を除去",
        "portraitOwner": "segawa",
        "portraitKind": "major",
        "sourceLine": 824
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃんの声",
        "text": "バス、あと三台。まだ後ろに人がいます！",
        "portraitOwner": null,
        "portraitKind": "offscreen",
        "sourceLine": 825
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公がセガワを追わず、TAKUYA-Ωとバスの間へ立つ。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 826
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "高い制御音が続く。TAKUYA-Ωは標的ではなく音源へ振り向き、発信器を砕く。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 827
      },
      {
        "kind": "dialogue",
        "speaker": "セガワ",
        "text": "停止。僕の命令だ",
        "portraitOwner": "segawa",
        "portraitKind": "major",
        "sourceLine": 828
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "背の投薬管がセガワを貫く。彼は最後まで巨体の反応を追い、言葉を失う。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 829
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "セガワの呼吸が止まる。巨体は避難バスへ向き直る。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 830
      },
      {
        "kind": "system",
        "speaker": "■ SYSTEM",
        "text": "ネコ殺しのセガワ特級博士：死亡",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 831
      },
      {
        "kind": "dialogue",
        "speaker": "ザキミヤ",
        "text": "家族が後ろにおる。ここで止める",
        "portraitOwner": "unit-zakimiya",
        "portraitKind": "major",
        "sourceLine": 832
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "{{PLAYER_NAME}}、全員、前へ。バスを通す",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 833
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が仲間の配置を確かめ、巨体へ向かう。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 834
      },
      {
        "kind": "boss-marker",
        "speaker": "◆ BOSS",
        "text": "TAKUYA-Ω",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 835
      },
      {
        "kind": "battle-marker",
        "speaker": "◆ BATTLE",
        "text": "TAKUYA-Ωを倒し、避難バスと安全回廊を守れ。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 836
      }
    ],
    "source": {
      "startLine": 817,
      "endLine": 837
    }
  },
  "v100:event:s30:post": {
    "id": "v100:event:s30:post",
    "kind": "stage-post",
    "stageNumber": 30,
    "musicProfile": "locked-stage-profile",
    "nodes": [
      {
        "kind": "action",
        "speaker": null,
        "text": "巨体が交差点へ崩れる。誰もすぐには近づかない。いくらちゃんが離れた位置から再生反応を測る。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 840
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "ない。今度は、動かない",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 841
      },
      {
        "kind": "dialogue",
        "speaker": "研究員の声",
        "text": "焼く前に、背中の投薬管だけ採ってください。中和因子が残っています",
        "portraitOwner": null,
        "portraitKind": "offscreen",
        "sourceLine": 842
      },
      {
        "kind": "dialogue",
        "speaker": "Mrs.チハ",
        "text": "人に使えるの？",
        "portraitOwner": "unit-mrs-chiha",
        "portraitKind": "major",
        "sourceLine": 843
      },
      {
        "kind": "dialogue",
        "speaker": "研究員の声",
        "text": "まだ分からない。でも、初期感染を止める材料になるかもしれません",
        "portraitOwner": null,
        "portraitKind": "offscreen",
        "sourceLine": 844
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が試料を密閉し、回収を確認して残りの組織に火を入れる。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 845
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "最後の避難バスが安全回廊へ入る。いくらちゃんの地図から、大型反応が消えた。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 846
      },
      {
        "kind": "dialogue",
        "speaker": "ザキミヤ",
        "text": "帰ろう。今度はみんなで",
        "portraitOwner": "unit-zakimiya",
        "portraitKind": "major",
        "sourceLine": 847
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が通行止めの標識を外し、西新側へ倒す。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 848
      }
    ],
    "source": {
      "startLine": 839,
      "endLine": 849
    }
  },
  "v100:event:s30:first-clear-post": {
    "id": "v100:event:s30:first-clear-post",
    "kind": "first-clear-post",
    "stageNumber": 30,
    "musicProfile": "locked-stage-profile",
    "nodes": [],
    "finalizeOnly": true,
    "source": {
      "startLine": 839,
      "endLine": 849
    }
  },
  "v100:event:ending": {
    "id": "v100:event:ending",
    "kind": "ending",
    "stageNumber": null,
    "musicProfile": "FINAL",
    "characterVoice": false,
    "nodes": [
      {
        "kind": "action",
        "speaker": null,
        "text": "朝霧の旧道。試料を運ぶ車が病院へ先行する。武蔵は二刀を差し、別の道の前で立ち止まる。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 854,
        "sceneTag": "dawn"
      },
      {
        "kind": "dialogue",
        "speaker": "宮本武蔵",
        "text": "我が行くのは、こちららしい",
        "portraitOwner": "unit-miyamoto-musashi",
        "portraitKind": "major",
        "sourceLine": 855,
        "sceneTag": "dawn"
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が歩み寄る。武蔵は礼をして、霧へ進む。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 856,
        "sceneTag": "dawn"
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "搬送車が一台横切る。通過後、そこに武蔵の姿はない。主人公はしばらく道を見てから病院へ向く。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 857,
        "sceneTag": "dawn"
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "数日後。医師と研究員が、採取した中和因子を別々の検査器で確かめる。初期感染者の同意を得て、少量を投与する。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 860,
        "sceneTag": "hospital"
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "一時間、六時間、二十四時間。腕の変色は広がらない。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 861,
        "sceneTag": "hospital"
      },
      {
        "kind": "dialogue",
        "speaker": "女性駅員",
        "text": "もう、戻らないんですか",
        "portraitOwner": "minor-human-shared-event-silhouette",
        "portraitKind": "minor",
        "sourceLine": 862,
        "sceneTag": "hospital"
      },
      {
        "kind": "dialogue",
        "speaker": "医師",
        "text": "今は止まっています。治ったと言うには、まだ早い",
        "portraitOwner": "minor-human-shared-event-silhouette",
        "portraitKind": "minor",
        "sourceLine": 863,
        "sceneTag": "hospital"
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "でも、明日を待てるんやね",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 864,
        "sceneTag": "hospital"
      },
      {
        "kind": "dialogue",
        "speaker": "医師",
        "text": "ええ。明日、もう一度確かめられます",
        "portraitOwner": "minor-human-shared-event-silhouette",
        "portraitKind": "minor",
        "sourceLine": 865,
        "sceneTag": "hospital"
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "連絡室では、いくらちゃんが西新の外へ呼びかける。返事のない回線にも時刻を記録し、翌日また呼ぶ。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 868,
        "sceneTag": "signal"
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "くまやの裏口。ババヤガとMrs.チハが、別々の武器を同じ机で整備している。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 871,
        "sceneTag": "kumaya"
      },
      {
        "kind": "dialogue",
        "speaker": "ババヤガ",
        "text": "全部聞くって言った",
        "portraitOwner": "unit-babayaga",
        "portraitKind": "major",
        "sourceLine": 872,
        "sceneTag": "kumaya"
      },
      {
        "kind": "dialogue",
        "speaker": "Mrs.チハ",
        "text": "一晩では終わらない",
        "portraitOwner": "unit-mrs-chiha",
        "portraitKind": "major",
        "sourceLine": 873,
        "sceneTag": "kumaya"
      },
      {
        "kind": "dialogue",
        "speaker": "ババヤガ",
        "text": "なら、明日も聞く",
        "portraitOwner": "unit-babayaga",
        "portraitKind": "major",
        "sourceLine": 874,
        "sceneTag": "kumaya"
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "Mrs.チハが頷く。二人は手を動かし続ける。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 875,
        "sceneTag": "kumaya"
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "{{PLAYER_NAME}}、明日はくまやのガスを見に来てくれ。暖簾も掛け直す",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 876,
        "sceneTag": "kumaya"
      }
    ],
    "source": {
      "startLine": 851,
      "endLine": 877
    }
  },
  "v100:event:credits": {
    "id": "v100:event:credits",
    "kind": "credits",
    "stageNumber": null,
    "musicProfile": null,
    "characterVoice": false,
    "nodes": [
      {
        "kind": "montage",
        "speaker": null,
        "sceneLabel": "西新商店街",
        "text": "薬局の二階に仮設診療所の札。シャッターが一枚ずつ上がる。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 882
      },
      {
        "kind": "montage",
        "speaker": null,
        "sceneLabel": "早良区役所",
        "text": "紙の名簿へ帰還者の名前が書き足される。空欄も消さない。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 883
      },
      {
        "kind": "montage",
        "speaker": null,
        "sceneLabel": "西新駅",
        "text": "列車は止まったまま。改札の灯りだけが、人の歩く道を照らす。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 884
      },
      {
        "kind": "montage",
        "speaker": null,
        "sceneLabel": "大学病院",
        "text": "試作血清が少量だけ冷蔵庫へ入る。翌日の検査予定が隣に貼られる。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 885
      },
      {
        "kind": "montage",
        "speaker": null,
        "sceneLabel": "河口防潮門",
        "text": "交代の見張りに缶詰が届く。門は閉じたまま。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 886
      },
      {
        "kind": "montage",
        "speaker": null,
        "sceneLabel": "ムガリアン施設",
        "text": "企業標章を覆い、救出した技術者が医療設備を再起動する。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 887
      },
      {
        "kind": "montage",
        "speaker": null,
        "sceneLabel": "RED PANTHER装備庫",
        "text": "赤いレンズと焼けた認証カードが、それぞれ証拠袋へ入る。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 888
      },
      {
        "kind": "montage",
        "speaker": null,
        "sceneLabel": "ザキミヤ",
        "text": "手を洗い、妻から娘を受け取る。腰の瓶の代わりにおむつを持つ。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 889
      },
      {
        "kind": "montage",
        "speaker": null,
        "sceneLabel": "装甲車両",
        "text": "色の違う新しい装甲板が付く。車内の地図には街の外へ一本の線。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 890
      },
      {
        "kind": "montage",
        "speaker": null,
        "sceneLabel": "TAKUYA撃破地点",
        "text": "撤去した標識の跡に、見張りの当番表が立つ。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 891
      },
      {
        "kind": "montage",
        "speaker": null,
        "sceneLabel": "くまや",
        "text": "{{PLAYER_NAME}}とクマバーソンが厨房のガス栓を開く。青い火が点く。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 892
      }
    ],
    "source": {
      "startLine": 879,
      "endLine": 893
    }
  },
  "v100:event:epilogue": {
    "id": "v100:event:epilogue",
    "kind": "epilogue",
    "stageNumber": null,
    "musicProfile": "FINAL",
    "characterVoice": false,
    "nodes": [
      {
        "kind": "action",
        "speaker": null,
        "text": "西新奪還から三十日。補強板は半分残っているが、くまやの戸は開き、厨房に油の音が戻った。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 896
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "主人公が暖簾をくぐる。パイセンが席の荷物を急いでどける。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 897
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "{{PLAYER_NAME}}さん、こっち空いてます",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 898
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "そこは最初から空けとった",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 899
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が席に着く。マヨちゃんが足元を一周して伏せる。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 900
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "ザキミヤの妻が娘を寝かせる。ザキミヤが「静かに」と言い、一番大きな声になった。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 901
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "ババヤガが牛乳を持って入る。Mrs.チハは受け取り、冷蔵庫を指す。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 902
      },
      {
        "kind": "dialogue",
        "speaker": "Mrs.チハ",
        "text": "今度は忘れなかったね",
        "portraitOwner": "unit-mrs-chiha",
        "portraitKind": "major",
        "sourceLine": 903
      },
      {
        "kind": "dialogue",
        "speaker": "ババヤガ",
        "text": "一か月遅れやけど",
        "portraitOwner": "unit-babayaga",
        "portraitKind": "major",
        "sourceLine": 904
      },
      {
        "kind": "dialogue",
        "speaker": "Mrs.チハ",
        "text": "残りの話も、忘れないで",
        "portraitOwner": "unit-mrs-chiha",
        "portraitKind": "major",
        "sourceLine": 905
      },
      {
        "kind": "dialogue",
        "speaker": "ババヤガ",
        "text": "忘れん",
        "portraitOwner": "unit-babayaga",
        "portraitKind": "major",
        "sourceLine": 906
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "いくらちゃんの無線は静かだ。壁の地図には、西新の外へ伸びる未確認の道が一本。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 907
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "{{PLAYER_NAME}}、何食う？",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 908
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が唐揚げを指す。クマバーソンは頷き、油の温度を確かめる。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 909
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "俺も一皿、追加で",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 910
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "まず自分のを食え",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 911
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "主人公の前へ烏龍茶が置かれる。外に停めた装甲車両は、今夜は動かない。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 912
      },
      {
        "kind": "title",
        "speaker": null,
        "text": "西新世紀末物語",
        "portraitOwner": null,
        "portraitKind": "title",
        "sourceLine": 913
      }
    ],
    "source": {
      "startLine": 895,
      "endLine": 916
    }
  }
});

const missing = V100_EVENT_IDS.filter((eventId) => !V100_STORY_EVENTS[eventId]);
if (missing.length > 0) throw new Error(`Missing V1.0.0 story event definitions: ${missing.join(", ")}`);

export function v100StoryEventFor(eventId) {
  return V100_STORY_EVENTS[eventId] ?? null;
}

export function v100StoryEventIdsForStage(stageNumber) {
  const stage = String(Number(stageNumber)).padStart(2, "0");
  return [`v100:event:s${stage}:pre`, `v100:event:s${stage}:post`, `v100:event:s${stage}:first-clear-post`].filter((eventId) => Boolean(V100_STORY_EVENTS[eventId]));
}

export function v100StoryNodeText(node, playerName) {
  return node?.text == null ? "" : renderV100PlayerName(node.text, playerName);
}

export function v100StoryEventView(eventId, playerName) {
  const event = v100StoryEventFor(eventId);
  if (!event) return null;
  return { ...event, nodes: event.nodes.map((node) => ({ ...node, text: v100StoryNodeText(node, playerName) })) };
}

export function v100StoryContract() {
  return Object.freeze({
    eventIds: V100_EVENT_IDS,
    eventCount: V100_EVENT_IDS.length,
    prologueFirst: V100_EVENT_IDS[0],
    endingSequence: ["v100:event:ending", "v100:event:credits", "v100:event:epilogue"],
    creditsHasDialogue: V100_STORY_EVENTS["v100:event:credits"].nodes.some((node) => node.kind === "dialogue"),
    creditsMusic: V100_STORY_EVENTS["v100:event:credits"].musicProfile,
    sourceSha256: V100_STORY_SOURCE_SHA256,
  });
}

void V100_EVENT_BY_ID;
