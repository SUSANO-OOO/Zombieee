// Generated from the Version 1.0.0 Producer rewrite. Do not hand-edit.
import { V100_EVENT_IDS, V100_EVENT_BY_ID, renderV100PlayerName } from "./v100Registry.js";

export const V100_STORY_SOURCE_SHA256 = "514b9f278b936dc762aa5625bcbbad9324f1a285b8a4b28e14a683ac3f3343af";
export const V100_STORY_SOURCE_LINE_COUNT = 1019;
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
        "text": "雨上がりの西新。居酒屋「くまや」の暖簾が、通る車の風で裏返る。{{PLAYER_NAME}}が戸を開けると、揚げ油の音が先に届いた。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 11,
        "sceneTag": "daily"
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "クマバーソンは唐揚げを二つ皿へ移す。足元のマヨちゃんは、落ちてこない三つ目を見上げている。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 12,
        "sceneTag": "daily"
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "配達帰りのハチが橙色の雨具を畳む。靴には、商店街の工事現場の泥。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 13,
        "sceneTag": "daily"
      },
      {
        "kind": "dialogue",
        "speaker": "ハチ",
        "text": "裏道、また工事してました。帰りは表から出た方がいいですよ",
        "portraitOwner": "unit-hachi",
        "portraitKind": "major",
        "sourceLine": 14,
        "sceneTag": "daily"
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "{{PLAYER_NAME}}さん、こっちっす。唐揚げも取っときました。……一個だけ、味見しましたけど",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 15,
        "sceneTag": "daily"
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "味見は俺がしとる。お前の分はあとで揚げるけん、その二個は残しとけ",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 16,
        "sceneTag": "daily"
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "了解っす。危なかった、もう一個いくところでした",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 17,
        "sceneTag": "daily"
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "パイセンが空の小皿を伏せる。ババヤガの端末が震え、彼は画面を一度だけ見た。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 18,
        "sceneTag": "daily"
      },
      {
        "kind": "dialogue",
        "speaker": "ババヤガ",
        "text": "……牛乳買ってこい、やって",
        "portraitOwner": "unit-babayaga",
        "portraitKind": "major",
        "sourceLine": 19,
        "sceneTag": "daily"
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "奥さんからっすか？",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 20,
        "sceneTag": "daily"
      },
      {
        "kind": "dialogue",
        "speaker": "ババヤガ",
        "text": "『牛乳』の二文字だけ。こっちの用件は聞いてくれん",
        "portraitOwner": "unit-babayaga",
        "portraitKind": "major",
        "sourceLine": 21,
        "sceneTag": "daily"
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "先に返事しとけ。どうせまた忘れるやろ",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 22,
        "sceneTag": "daily"
      },
      {
        "kind": "dialogue",
        "speaker": "ババヤガ",
        "text": "今回は覚えとる",
        "portraitOwner": "unit-babayaga",
        "portraitKind": "major",
        "sourceLine": 23,
        "sceneTag": "daily"
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が車の鍵を置き、烏龍茶のグラスを受け取る。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 24,
        "sceneTag": "daily"
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "壁のテレビにムガリアン製薬の広告。市の防災物資、病院設備、商店街の薬局が順に映る。客の誰も見ていない。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 25,
        "sceneTag": "daily"
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "店中の端末が同時に鳴る。「早良区内で複数の傷害事件」。テレビの広告も緊急速報に切り替わった。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 28,
        "sceneTag": "crisis"
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "工事の事故……じゃないっすよね",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 29,
        "sceneTag": "crisis"
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "引き戸に血のついた手。通りの奥から、靴を引きずる音が二つ近づく。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 30,
        "sceneTag": "crisis"
      },
      {
        "kind": "dialogue",
        "speaker": "男の声",
        "text": "頼む、開けてくれ！",
        "portraitOwner": null,
        "portraitKind": "offscreen",
        "sourceLine": 31,
        "sceneTag": "crisis"
      },
      {
        "kind": "dialogue",
        "speaker": "ババヤガ",
        "text": "男の後ろ、二人ついてきとる。こっちは見とく",
        "portraitOwner": "unit-babayaga",
        "portraitKind": "major",
        "sourceLine": 32,
        "sceneTag": "crisis"
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が戸を細く開け、男を引き入れる。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 33,
        "sceneTag": "crisis"
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "男の腕には歯形がある。クマバーソンが布巾を当てる。男は水を求めて口を開くが、声にならない。掴んでいた布巾から、指が一本ずつ離れた。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 34,
        "sceneTag": "crisis"
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "大丈夫か。名前、言えるか？",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 35,
        "sceneTag": "crisis"
      },
      {
        "kind": "dialogue",
        "speaker": "男",
        "text": "……たす、け……",
        "portraitOwner": "minor-human-shared-event-silhouette",
        "portraitKind": "minor",
        "sourceLine": 36,
        "sceneTag": "crisis"
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "言い終える前に呼吸が止まる。クマバーソンが脈を探した瞬間、男が跳ね起き、主人公へ噛みつく。椅子の脚が顎を受け止めた。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 37,
        "sceneTag": "crisis"
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が椅子を押し返し、客の退路を空ける。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 38,
        "sceneTag": "crisis"
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "パイセン、客を裏へ。マヨちゃんも！",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 39,
        "sceneTag": "crisis"
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "立てる人から裏へ！　俺が最後に出ます！",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 40,
        "sceneTag": "crisis"
      },
      {
        "kind": "dialogue",
        "speaker": "ハチ",
        "text": "俺が先に出ます！　みんな、角を曲がったとこで待って！",
        "portraitOwner": "unit-hachi",
        "portraitKind": "major",
        "sourceLine": 41,
        "sceneTag": "crisis"
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "ババヤガの消火器が白く噴く。クマバーソンがフライパンで男を押さえ、最後の客とともに退く。パイセンが外から勝手口を閉めた。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 42,
        "sceneTag": "crisis"
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "クマバーソンが、消毒薬を取りに出たタクヤへ電話する。呼び出し音が三度鳴って切れた。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 43,
        "sceneTag": "crisis"
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "裏路地へ出たところで、くまやの暖簾が片方だけ落ちる。クマバーソンは手を伸ばしかけ、客を支えるパイセンを見て引っ込めた。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 45,
        "sceneTag": "escape"
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "暖簾はあとでよか。走れ！",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 46,
        "sceneTag": "escape"
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "発生から三日目。災害対策倉庫に放置された装甲車両。荷室には毛布、燃料計にはまだ半分。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 47,
        "sceneTag": "escape"
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "これ、俺が運転するんすか？　いや、こんなでかいの、絶対こするって！",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 48,
        "sceneTag": "escape"
      },
      {
        "kind": "dialogue",
        "speaker": "ハチ",
        "text": "まず鍵です。車内になければ、整備箱を探します",
        "portraitOwner": "unit-hachi",
        "portraitKind": "major",
        "sourceLine": 49,
        "sceneTag": "escape"
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "ババヤガは始動盤の配線に手を伸ばすが、主人公が非常始動キーを見つける方が早い。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 50,
        "sceneTag": "escape"
      },
      {
        "kind": "dialogue",
        "speaker": "ババヤガ",
        "text": "あったか。助かった。配線で始動させるのは、自信なかったんよ",
        "portraitOwner": "unit-babayaga",
        "portraitKind": "major",
        "sourceLine": 51,
        "sceneTag": "escape"
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公がキーを差し、全員を乗せて倉庫を出る。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 52,
        "sceneTag": "escape"
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "発生から四十三日目。装甲車両の側面には、避難所を渡り歩く間についた傷が重なる。西新へ入る道だけが、地図の上でまだ途切れている。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 55,
        "sceneTag": "radio"
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "一行は外周で生存者を拾いながら帰る道を探してきた。外へ送った無線には、二週間、返事がない。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 56,
        "sceneTag": "radio"
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "四十三日か。……店、どうなってるんすかね。またあそこで飯、食えますか",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 57,
        "sceneTag": "radio"
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "帰ってみらんと分からん。揚げ方は忘れとらんけどな",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 58,
        "sceneTag": "radio"
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "ババヤガは圏外のままの妻の連絡先を伏せる。ハチが商店街からの細い救難信号を拾った。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 59,
        "sceneTag": "radio"
      },
      {
        "kind": "dialogue",
        "speaker": "ハチ",
        "text": "薬局の二階。まだ誰かが呼んでます",
        "portraitOwner": "unit-hachi",
        "portraitKind": "major",
        "sourceLine": 60,
        "sceneTag": "radio"
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が薬局へ進入線を引き、装甲車両を発進させる。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 61,
        "sceneTag": "radio"
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "薬局なら、くまやのすぐそばっすね",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 62,
        "sceneTag": "radio"
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "ああ。店はあとで見に行く。まず、呼んどる人を乗せよう",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 63,
        "sceneTag": "radio"
      },
      {
        "kind": "system",
        "speaker": "■ SYSTEM",
        "text": "西新商店街の薬局へ向かう。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 64,
        "sceneTag": "radio"
      }
    ],
    "source": {
      "startLine": 8,
      "endLine": 65
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
        "text": "薬局二階の窓から、白いタオルが二度振られる。入口では棚を巻き込んだ感染組織が、シャッターを内側から押している。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 70
      },
      {
        "kind": "dialogue",
        "speaker": "女の声",
        "text": "そこの装甲車！　聞こえたらライト、一回！",
        "portraitOwner": null,
        "portraitKind": "offscreen",
        "sourceLine": 71
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公がライトを点滅させる。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 72
      },
      {
        "kind": "dialogue",
        "speaker": "女の声",
        "text": "五人です。一人、階段を降りられません。……全員、乗れますか",
        "portraitOwner": null,
        "portraitKind": "offscreen",
        "sourceLine": 73
      },
      {
        "kind": "dialogue",
        "speaker": "ババヤガ",
        "text": "乗れる。下の棚ごと燃やしたら、入口も空くやろ",
        "portraitOwner": "unit-babayaga",
        "portraitKind": "major",
        "sourceLine": 74
      },
      {
        "kind": "dialogue",
        "speaker": "女の声",
        "text": "薬局ごと？　さっきのライトの人と代わってください",
        "portraitOwner": null,
        "portraitKind": "offscreen",
        "sourceLine": 75
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "焼かん。裏階段まで道をつくる。窓から離れとって",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 76
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "パイセンが鉄パイプを車内へ放り、両手を空ける。二階の窓では、誰かが老人の身体を支えている。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 77
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "俺が上がります！　{{PLAYER_NAME}}さん、車を裏階段へ。降りてきた人、頼みます！",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 78
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が車両を裏階段の前へ寄せ、救出路を示す。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 79
      },
      {
        "kind": "battle-marker",
        "speaker": "◆ BATTLE",
        "text": "感染拠点を破壊し、裏階段を確保せよ。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 80
      }
    ],
    "source": {
      "startLine": 69,
      "endLine": 81
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
        "text": "主人公が老人を背負って降りる。パイセンは途中で足を滑らせた女性を支え、最下段まで手を離さなかった。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 84
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "赤銅色の編み髪の女性が老人の脈を取り直す。救急バッグの包帯は、階段でほかの人の手当に使い切っていた。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 85
      },
      {
        "kind": "dialogue",
        "speaker": "ナオ",
        "text": "おじいちゃんは車の中で寝かせてください。私はナオ。さっきまで手当てしてました。隣に乗りますね",
        "portraitOwner": "unit-nao",
        "portraitKind": "major",
        "sourceLine": 86
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "まだ運べるもん、あります？",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 87
      },
      {
        "kind": "dialogue",
        "speaker": "ナオ",
        "text": "あの人の靴を。階段に片方、落ちています。また歩く時に必要だから",
        "portraitOwner": "unit-nao",
        "portraitKind": "major",
        "sourceLine": 88
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "私も乗せてください。いくらです。ライトが見えた時、私が『迎えが来た！』って。……ほんとに来てくれて、よかった",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 89
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "いくらちゃんは老人へ水を渡し、薬品箱の市のラベルをめくる。その下に「MUGARIAN」の印字。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 90
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "あれ？　市の救援箱ですよね。下にムガリアンの管理番号があるんだけど",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 91
      },
      {
        "kind": "dialogue",
        "speaker": "ババヤガ",
        "text": "上から貼っただけやな",
        "portraitOwner": "unit-babayaga",
        "portraitKind": "major",
        "sourceLine": 92
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "ふうん。誰が送ってきた箱なのか、あとで調べてみます",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 93
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "区役所からの無線が途切れ途切れに入る。「最後の一台。まだ出せない」。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 94
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公がいくらちゃんのアンテナを車両へ積み、空いた座席を示す。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 95
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "このアンテナも？　ありがとうございます。じゃ、車に付けてもいいですか。区役所の無線、もう少しちゃんと聞けるはず",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 96
      },
      {
        "kind": "system",
        "speaker": "■ SYSTEM",
        "text": "救護のナオが配備登録候補になった。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 97
      },
      {
        "kind": "system",
        "speaker": "■ SYSTEM",
        "text": "いくらちゃんが通信支援に加わる。次は早良区役所。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 98
      }
    ],
    "source": {
      "startLine": 83,
      "endLine": 99
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
      "startLine": 83,
      "endLine": 99
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
        "text": "区役所前に残った最後の救援車。エンジンを掛けたまま、一席だけ空けて待つ。屋根の射手が退路を見張る。足を痛めた安藤が、コピー室から戻らない。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 104
      },
      {
        "kind": "dialogue",
        "speaker": "避難所職員",
        "text": "もう待てません。あの群れが来たら、車の人たちも逃げられなくなる。安藤さんは……",
        "portraitOwner": "minor-human-shared-event-silhouette",
        "portraitKind": "minor",
        "sourceLine": 105
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "後部座席で毛布を握る子どもが、開いた扉越しにパイセンを見る。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 106
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "……俺が行きます。扉、閉めて待っててください。安藤さんと戻るんで",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 107
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が装甲車両を救援車の前へ寄せ、パイセンへ車椅子を渡す。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 108
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "こっちは出口を守る。安藤さんから離れるなよ",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 109
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "はい。{{PLAYER_NAME}}さん、その車椅子、借ります。……足、動け。今だけでいいから",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 110
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "角を曲がった感染者の列が、車両のライトへ一斉に向く。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 111
      },
      {
        "kind": "battle-marker",
        "speaker": "◆ BATTLE",
        "text": "救援車と救出経路を守れ。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 112
      }
    ],
    "source": {
      "startLine": 103,
      "endLine": 113
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
        "text": "パイセンが車椅子を押して飛び出す。安藤の膝には、古い携帯ラジオ。救援車の運転手が後部扉を開く。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 116
      },
      {
        "kind": "dialogue",
        "speaker": "安藤",
        "text": "駅員室で三人、生きとる。昨夜これで話した",
        "portraitOwner": "minor-human-shared-event-silhouette",
        "portraitKind": "minor",
        "sourceLine": 117
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "いくらちゃん、ラジオ受け取って！　安藤さんは俺が。運転手さん、この人が乗ったら出してください。俺はこっちに戻るんで！",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 118
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "安藤がラジオを渡す。パイセンと運転手が彼を空席へ座らせ、車椅子を畳んで積む。屋根の射手も降りた。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 119
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "救援車が出る。パイセンは手袋を外し、震える指を一度だけ握り直す。いくらちゃんが黙ってラジオの周波数を合わせた。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 120
      },
      {
        "kind": "dialogue",
        "speaker": "ミズチ",
        "text": "車は抜けた。俺はミズチ。あんたらが駅へ行くなら、防衛線まで援護する",
        "portraitOwner": "unit-mizuchi",
        "portraitKind": "major",
        "sourceLine": 121
      },
      {
        "kind": "dialogue",
        "speaker": "ババヤガ",
        "text": "残弾は",
        "portraitOwner": "unit-babayaga",
        "portraitKind": "major",
        "sourceLine": 122
      },
      {
        "kind": "dialogue",
        "speaker": "ミズチ",
        "text": "七発。無駄撃ちはしない",
        "portraitOwner": "unit-mizuchi",
        "portraitKind": "major",
        "sourceLine": 123
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "壁の避難図。商店街から駅、病院、湾岸まで、発生前の日付で「都市対応実証 B-02」と区切られている。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 126,
        "sceneTag": "evidence"
      },
      {
        "kind": "dialogue",
        "speaker": "ババヤガ",
        "text": "この日付、発生前や。事故が起きる前から、封鎖する場所を決めとったんか",
        "portraitOwner": "unit-babayaga",
        "portraitKind": "major",
        "sourceLine": 127,
        "sceneTag": "evidence"
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が避難図を撮り、駅員室へ向かう道を地図に記す。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 128,
        "sceneTag": "evidence"
      },
      {
        "kind": "system",
        "speaker": "■ SYSTEM",
        "text": "射撃のミズチが配備登録候補になった。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 129,
        "sceneTag": "evidence"
      },
      {
        "kind": "system",
        "speaker": "■ SYSTEM",
        "text": "駅員室の生存者へ向かう。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 130,
        "sceneTag": "evidence"
      }
    ],
    "source": {
      "startLine": 115,
      "endLine": 131
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
      "startLine": 115,
      "endLine": 131
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
        "text": "防衛線の照明がひとつ消える。向こう側に黒い拘束帯と、縫い合わされた裸の胸。大刃を引きずる音が、感染群の足音より先に来た。頬の傷と防護眼鏡で、パイセンにも分かる。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 136
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "……タクヤさん？",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 137
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "返事はない。TAKUYAが刃を振ると、柵の留め具が一列に飛んだ。パイセンの足元へ鉄板が滑る。巨体は柵を越えず、暗がりへ引いた。刃を引きずる音だけが群れの後ろを移っていく。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 138
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公がパイセンの襟をつかんで引き戻す。鉄板は二人のいた場所を抜け、装甲車両の車輪に当たった。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 139
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "あの日、薬を取りに行ってくれって頼んだ。……俺が頼んだんや",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 140
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "裏口、俺が閉めました。まだ帰ってきてないのに。……タクヤさん、俺らを探してたんすか",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 141
      },
      {
        "kind": "dialogue",
        "speaker": "ババヤガ",
        "text": "パイセン、前を見ろ。群れが柵を越えた",
        "portraitOwner": "unit-babayaga",
        "portraitKind": "major",
        "sourceLine": 142
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "……はい！　右からも来ます！",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 143
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が装甲車両を横に寄せ、左右の進入路へ仲間を割り振る。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 144
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "パイセンは扉を閉め、クマバーソンの横へ走る。後ろでは駅へ向かう避難者が、まだ防壁を通り抜けていた。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 145
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "みんな先に通って！　タクヤさんが来たら、俺が知らせます！",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 146
      },
      {
        "kind": "boss-marker",
        "speaker": "◆ BOSS",
        "text": "TAKUYA",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 147
      },
      {
        "kind": "battle-marker",
        "speaker": "◆ BATTLE",
        "text": "感染群を退け、TAKUYAを止めよ。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 148
      }
    ],
    "source": {
      "startLine": 135,
      "endLine": 149
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
        "text": "TAKUYAの大刃が地面へ落ちる。開いた手は何かを渡す形のままだった。クマバーソンが胸元の鎖の留め具をそっと外す。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 152
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "薬、取りに行ってくれたんやな。……タクヤ、待っとれんで、すまん",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 153
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "パイセンは刃を見ないようにして、外れた鎖を端へ寄せる。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 154
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "駅の人が待ってます。……行きましょう",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 155
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "駅の無線、まだ聞こえてます。……向こうも、待ってます",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 156
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が防壁の残骸に牽引線を掛け、駅へ通る道を開く。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 157
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "装甲車両が去ったあと、赤いレンズの防護服が防衛線へ入る。銃口を下げたまま、迷いなくTAKUYAへ向かう。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 160,
        "sceneTag": "retrieval"
      },
      {
        "kind": "dialogue",
        "speaker": "赤レンズの隊長",
        "text": "T-03、回収。記録は残すな",
        "portraitOwner": "red-panther-commander",
        "portraitKind": "major",
        "sourceLine": 161,
        "sceneTag": "retrieval"
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "隊員がTAKUYAの遺体を黒い袋へ収め、クマバーソンの外した鎖も拾い上げる。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 162,
        "sceneTag": "retrieval"
      }
    ],
    "source": {
      "startLine": 151,
      "endLine": 163
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
      "startLine": 151,
      "endLine": 163
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
        "text": "駅のシャッターは腰の高さで止まっている。地上の風が途切れ、暗い構内から非常電話の呼び出し音だけが続く。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 168
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "この電話、かけ直してる。中に誰かいるんだ",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 169
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "すいません。暗いとこ、ちょっと……。{{PLAYER_NAME}}さん、先に行ってもらっていいっすか",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 170
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が隙間から入り、内側のシャッターを押し上げる。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 171
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "受話器から、咳に混じって駅員の声。駅員室に三人、ホームの保守室に二人。一人は噛まれている。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 172
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "駅員室に三人、ホームに二人。……五人とも連れて、ここから出るんすよね",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 173
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "そのつもりや。俺がシャッターを押さえとく。まず駅員室へ行こう",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 174
      },
      {
        "kind": "battle-marker",
        "speaker": "◆ BATTLE",
        "text": "閉鎖改札の感染拠点を破壊し、駅員室へ進め。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 175
      }
    ],
    "source": {
      "startLine": 167,
      "endLine": 176
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
        "text": "駅員室の女性は咬傷をタオルで押さえ、ホームの二人を先に助けてと頼む。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 179
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "ホームの二人も助ける。あんたも車で待っとって。ほら、肩につかまって",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 180
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "パイセンが反対側から肩を貸す。女性は、彼の震える手に体重を預けすぎないよう歩く。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 181
      },
      {
        "kind": "dialogue",
        "speaker": "駅員",
        "text": "黒い防護服が、ホームへ冷蔵ケースを置いていきました。レンズが赤くて",
        "portraitOwner": "minor-human-shared-event-silhouette",
        "portraitKind": "minor",
        "sourceLine": 182
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "主人公が赤いレンズの証言を記録する。駅員は、奥の保守扉を指した。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 183
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "駅員室の配線盤裏の点検口から、罠装置を腰に下げた男が這い出す。非常電話を鳴らし続けたのは彼だった。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 184
      },
      {
        "kind": "dialogue",
        "speaker": "モンキー",
        "text": "やっと来た！　俺、モンキー。電話の回線、つないでよかった。シャッターもこっちから動かせるぞ",
        "portraitOwner": "unit-monkey",
        "portraitKind": "major",
        "sourceLine": 185
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が駅員室の退路を指し、開閉の合図をモンキーへ預ける。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 186
      },
      {
        "kind": "dialogue",
        "speaker": "モンキー",
        "text": "駅員さんたちが先だな。分かった。音が響くから、開けるのは一回にしよう。全員そろったら、合図してくれ",
        "portraitOwner": "unit-monkey",
        "portraitKind": "major",
        "sourceLine": 187
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が駅員を車両へ送り、ホームへの保守扉を開ける。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 188
      },
      {
        "kind": "system",
        "speaker": "■ SYSTEM",
        "text": "工兵のモンキーが配備登録候補になった。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 189
      },
      {
        "kind": "system",
        "speaker": "■ SYSTEM",
        "text": "ホームの二人と冷蔵ケースを確認する。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 190
      }
    ],
    "source": {
      "startLine": 178,
      "endLine": 191
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
      "startLine": 178,
      "endLine": 191
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
        "text": "地下ホーム。保守室の扉が内側から叩かれる。反対側には感染者の群れ。さらに奥、壊れた改札機の向こうで、何か大きなものが金属を引きずっている。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 196
      },
      {
        "kind": "dialogue",
        "speaker": "保守員の声",
        "text": "二人います！　扉が曲がって、内側から押しても開きません！",
        "portraitOwner": null,
        "portraitKind": "offscreen",
        "sourceLine": 197
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "うわ、こっちにもいる！　……奥で引きずってるの、あれ、何すか？",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 198
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "改札の奥で電子音が一度鳴る。金属を引きずる音が止まる。やがて、反対側の暗がりを回るように、ゆっくり遠ざかった。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 199
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "見に行く前に、手前の群れをどけましょ。放送、まだ使えるんです",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 200
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "何を流す",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 201
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "そのフライパン、一回叩いてください。録った音を、向こうのスピーカーから流します",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 202
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "クマバーソンがフライパンを叩く。いくらちゃんがその一打を録り、反対ホームのスピーカーで繰り返した。群れの先頭が向きを変える。奥の大きな影は、まだ動かない。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 203
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "そっち行った！　フライパンでこんなに呼べるんすね",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 204
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "今や！　扉の前まで通すぞ！",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 205
      },
      {
        "kind": "dialogue",
        "speaker": "保守員の声",
        "text": "扉が、もう！",
        "portraitOwner": null,
        "portraitKind": "offscreen",
        "sourceLine": 206
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が仲間を保守室側へ展開し、放送の切り替えをいくらちゃんに任せる。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 207
      },
      {
        "kind": "boss-marker",
        "speaker": "◆ BOSS",
        "text": "改札喰い",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 208
      },
      {
        "kind": "battle-marker",
        "speaker": "◆ BATTLE",
        "text": "感染群を退け、改札喰いを倒して保守室の二人を救え。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 209
      }
    ],
    "source": {
      "startLine": 195,
      "endLine": 210
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
        "text": "保守室から出た二人が、互いの肩を離さない。いくらちゃんは人数を数え、端末を握る指から力を抜いた。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 213
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "一人が、曲がったチェーンソーを床へ置く。扉の内側には浅い切り傷が一筋。刃を止めた彼は、保守員を背に、外から押される扉を支え続けていた。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 214
      },
      {
        "kind": "dialogue",
        "speaker": "クレイジーキング",
        "text": "余の剣が……。折れるとは……",
        "portraitOwner": "unit-crazy-king",
        "portraitKind": "major",
        "sourceLine": 215
      },
      {
        "kind": "dialogue",
        "speaker": "保守員",
        "text": "その人、ずっと扉を支えてくれたんです。私を後ろにかばって",
        "portraitOwner": "minor-human-shared-event-silhouette",
        "portraitKind": "minor",
        "sourceLine": 216
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "剣はあとで直そう。二人とも立てるか？",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 217
      },
      {
        "kind": "dialogue",
        "speaker": "クレイジーキング",
        "text": "うむ。民も、余も、まだ歩ける",
        "portraitOwner": "unit-crazy-king",
        "portraitKind": "major",
        "sourceLine": 218
      },
      {
        "kind": "dialogue",
        "speaker": "保守員",
        "text": "これ、病院へ。置いていった人たちは、中身を半分持っていった",
        "portraitOwner": "minor-human-shared-event-silhouette",
        "portraitKind": "minor",
        "sourceLine": 219
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "冷蔵ケースには「感染初期処置用」。薬局と同じムガリアンの管理番号。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 220
      },
      {
        "kind": "dialogue",
        "speaker": "ババヤガ",
        "text": "半分だけ残す。拾った奴が、どこへ運ぶか見ようとしたんやろ",
        "portraitOwner": "unit-babayaga",
        "portraitKind": "major",
        "sourceLine": 221
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "あの赤いレンズの連中が？",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 222
      },
      {
        "kind": "dialogue",
        "speaker": "ババヤガ",
        "text": "そこまでは分からん。持っていくなら、見られとるつもりでな",
        "portraitOwner": "unit-babayaga",
        "portraitKind": "major",
        "sourceLine": 223
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "これ、大学病院宛てです。地下搬入口まで届けましょ。線路沿いの保守扉から行けます",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 224
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公がケースを背負い、病院へ続く保守扉を開ける。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 225
      },
      {
        "kind": "system",
        "speaker": "■ SYSTEM",
        "text": "前衛のクレイジーキングが配備登録候補になった。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 226
      },
      {
        "kind": "system",
        "speaker": "■ SYSTEM",
        "text": "病院へ向かう保守トンネルを進む。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 227
      }
    ],
    "source": {
      "startLine": 212,
      "endLine": 228
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
      "startLine": 212,
      "endLine": 228
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
        "text": "トンネルの泥に、同じ歩幅の軍靴の跡。排水溝には赤いレンズの欠片が残る。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 233
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "足跡、病院まで続いてます。……向こうにも、あの連中がいるかもしれません",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 234
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "中継器が一瞬だけ電波を戻し、発生二日目に送られた未着信メッセージがババヤガの端末へ届く。差出人はMrs.チハ。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 235
      },
      {
        "kind": "dialogue",
        "speaker": "Mrs.チハのメッセージ",
        "text": "無事。湾岸へ移る。連絡はしないで",
        "portraitOwner": null,
        "portraitKind": "offscreen",
        "sourceLine": 236
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "奥さん、ですか",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 237
      },
      {
        "kind": "dialogue",
        "speaker": "ババヤガ",
        "text": "ああ。……二日目か。あの時は、無事やったんやな",
        "portraitOwner": "unit-babayaga",
        "portraitKind": "major",
        "sourceLine": 238
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "湾岸……。そこに行けば、会えるんすかね",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 239
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "病院で、そっちから来た人に聞いてみよう。まず、この薬を届けるぞ",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 240
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "奥の隔壁が開いたまま、感染群が病院側へ押し寄せる。手前には輪止めを噛ませた保守台車。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 241
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "冷蔵ケースを台車に。あの隔壁まで運べたら、追ってくる奴らを閉め出せます！",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 242
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公がケースを台車に固定し、輪止めを外して発進させる。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 243
      },
      {
        "kind": "battle-marker",
        "speaker": "◆ BATTLE",
        "text": "保守台車を病院側の隔壁まで護衛し、感染群の流入を止めよ。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 244
      }
    ],
    "source": {
      "startLine": 232,
      "endLine": 245
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
        "text": "台車が病院側の隔壁を越える。主人公が閉鎖盤を叩き、扉が噛み合う。向こう側の爪が金属を打ち、次第に遠くなる。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 248
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "病院側の踊り場で、軽機関銃を構えた射手が最後の流入路を押さえている。銃身は熱く、弾帯はもう短い。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 249
      },
      {
        "kind": "dialogue",
        "speaker": "レイダー",
        "text": "病院はこっち！　私の後ろを走って。銃の前には出ないでよ！",
        "portraitOwner": "unit-raider",
        "portraitKind": "major",
        "sourceLine": 250
      },
      {
        "kind": "dialogue",
        "speaker": "ミズチ",
        "text": "弾が少ない。いつまで撃てる？",
        "portraitOwner": "unit-mizuchi",
        "portraitKind": "major",
        "sourceLine": 251
      },
      {
        "kind": "dialogue",
        "speaker": "レイダー",
        "text": "あんたらが通るまでは。私も中へ下がって、補充する。……レイダーって呼んで",
        "portraitOwner": "unit-raider",
        "portraitKind": "major",
        "sourceLine": 252
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "ババヤガは返信欄に「無事や。今から探しに行く」と打つ。圏外の表示を見ても消さず、端末を胸ポケットへ入れた。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 253
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "ババヤガ、こっちや。病院まで行けば、無線も使える",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 254
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "病院側の非常回線が開く。救急搬入口で薬と人手が足りない。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 255
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が冷蔵ケースを持ち直し、病院の扉へ走る。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 256
      },
      {
        "kind": "system",
        "speaker": "■ SYSTEM",
        "text": "制圧射撃のレイダーが配備登録候補になった。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 257
      }
    ],
    "source": {
      "startLine": 247,
      "endLine": 258
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
      "startLine": 247,
      "endLine": 258
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
        "text": "搬入口からストレッチャーが廊下まで続く。駅で救った女性駅員は、咬傷を押さえながら自分の足で入ってきた。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 263
      },
      {
        "kind": "dialogue",
        "speaker": "医師",
        "text": "噛まれてから、どれくらい",
        "portraitOwner": "minor-human-shared-event-silhouette",
        "portraitKind": "minor",
        "sourceLine": 264
      },
      {
        "kind": "dialogue",
        "speaker": "ナオ",
        "text": "一時間未満。会話できます。腕の変色はここまで",
        "portraitOwner": "unit-nao",
        "portraitKind": "major",
        "sourceLine": 265
      },
      {
        "kind": "dialogue",
        "speaker": "医師",
        "text": "まだ間に合うかもしれません。進行を遅らせる処置をします。ただ、治す薬はないんです",
        "portraitOwner": "minor-human-shared-event-silhouette",
        "portraitKind": "minor",
        "sourceLine": 266
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が冷蔵ケースを渡す。医師は不足した容器の跡を見て、唇を結ぶ。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 267
      },
      {
        "kind": "dialogue",
        "speaker": "医師",
        "text": "残りで何人分になるか、すぐ確かめます。患者を入れる間、外を守って",
        "portraitOwner": "minor-human-shared-event-silhouette",
        "portraitKind": "minor",
        "sourceLine": 268
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "患者さんも俺らが運ぶ。先生は、この人を診てやってくれ",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 269
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "救急車へ感染者がぶつかる。搬入口の防火扉が半分しか閉まらない。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 270
      },
      {
        "kind": "battle-marker",
        "speaker": "◆ BATTLE",
        "text": "医薬品と負傷者の移送が終わるまで搬入口を守れ。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 271
      }
    ],
    "source": {
      "startLine": 262,
      "endLine": 272
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
        "text": "最後のストレッチャーが中へ入る。駅員の腕の変色に、医師が新しい線を引く。そこからは、まだ広がっていない。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 275
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "防火扉の留め具が外れかける。大きなハンマーを持つ男が、扉ではなく歪んだ枠だけを叩き戻す。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 276
      },
      {
        "kind": "dialogue",
        "speaker": "タタラ",
        "text": "そこ、離れてくれ。枠を叩き戻す。扉ごと向こうへ倒したくないんだ",
        "portraitOwner": "unit-tatara",
        "portraitKind": "major",
        "sourceLine": 277
      },
      {
        "kind": "dialogue",
        "speaker": "医師",
        "text": "この人、朝から扉と口喧嘩してるんです",
        "portraitOwner": "minor-human-shared-event-silhouette",
        "portraitKind": "minor",
        "sourceLine": 278
      },
      {
        "kind": "dialogue",
        "speaker": "タタラ",
        "text": "文句ぐらい言わせてくれよ。直しても直しても、閉まらねえんだ。……俺はタタラ。道具は貸せるが、こいつは重いぞ",
        "portraitOwner": "unit-tatara",
        "portraitKind": "major",
        "sourceLine": 279
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "先生。駅員さんの腕、線から広がってないっすよね？",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 280
      },
      {
        "kind": "dialogue",
        "speaker": "医師",
        "text": "ええ、今のところは。六時間後にまた調べます。不安だと思うから、それまでは誰か隣にいてあげて",
        "portraitOwner": "minor-human-shared-event-silhouette",
        "portraitKind": "minor",
        "sourceLine": 281
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "分かった。薬品庫の方は、俺らに任せて",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 282
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "医師が救急病棟の鍵を渡す。薬品庫と、残った看護師が二人。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 283
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が空の冷蔵ケースを受け取り、東病棟の扉を開ける。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 284
      },
      {
        "kind": "system",
        "speaker": "■ SYSTEM",
        "text": "破砕兵のタタラが配備登録候補になった。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 285
      },
      {
        "kind": "system",
        "speaker": "■ SYSTEM",
        "text": "救急病棟で薬と職員を探す。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 286
      }
    ],
    "source": {
      "startLine": 274,
      "endLine": 287
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
      "startLine": 274,
      "endLine": 287
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
        "text": "処置室の扉が、内側から三回叩かれる。主人公も三回、叩き返す。返事は、今度は二回。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 292
      },
      {
        "kind": "dialogue",
        "speaker": "看護師の声",
        "text": "二人います。右の個室は開けないで",
        "portraitOwner": null,
        "portraitKind": "offscreen",
        "sourceLine": 293
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "ガラスの向こうには患者の名札と家族写真。病衣の人影が、何度も窓へ額を当てている。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 294
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "名前も、家族の写真もある。……置いていくしかないんすか",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 295
      },
      {
        "kind": "dialogue",
        "speaker": "ナオ",
        "text": "もう感染が進んでいます。今あの扉を開けたら、私たちも、奥で待っている二人も噛まれる",
        "portraitOwner": "unit-nao",
        "portraitKind": "major",
        "sourceLine": 296
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "パイセンはガラスに映った自分の顔から目を逸らし、処置室の扉へ向き直る。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 297
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "……分かりました。{{PLAYER_NAME}}さん、奥の二人を。俺も行きます",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 298
      },
      {
        "kind": "battle-marker",
        "speaker": "◆ BATTLE",
        "text": "処置室への道を開き、感染拠点を破壊せよ。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 299
      }
    ],
    "source": {
      "startLine": 291,
      "endLine": 300
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
        "text": "看護師は薬と一緒に、破れた紙台帳を渡す。発生初日、まだ会話のできた患者十二人が地下へ運ばれていた。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 303
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "処置室の内側から、大きな防護盾が運び出される。看護師二人の前に立っていた男は、肩の傷を見せようとしない。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 304
      },
      {
        "kind": "dialogue",
        "speaker": "ガンテツ",
        "text": "看護師さんを先にお願いします。私、ガンテツと言います。まだ立てるから、最後でいい",
        "portraitOwner": "unit-gantetsu",
        "portraitKind": "major",
        "sourceLine": 305
      },
      {
        "kind": "dialogue",
        "speaker": "ナオ",
        "text": "肩、血が出ています。二人とも出られたんですから、今度はあなたの手当てをさせてください",
        "portraitOwner": "unit-nao",
        "portraitKind": "major",
        "sourceLine": 306
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "ガンテツは一度だけ看護師二人を見る。二人が頷くのを見て、ようやく盾を置いた。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 307
      },
      {
        "kind": "dialogue",
        "speaker": "看護師",
        "text": "名前を呼んでも、番号で答えろと言われました",
        "portraitOwner": "minor-human-shared-event-silhouette",
        "portraitKind": "minor",
        "sourceLine": 308
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "B3-L……地下三階？　図面、地下二階までしかないんですけど",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 309
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "パイセンが紙台帳の端を揃え、破れたページを掌で押さえる。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 310
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "俺が持ちます。破れたとこ、落ちそうなんで。……この十二人、どこにいるんすかね",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 311
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が台帳を撮り、薬を搬入口へ送り出す。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 312
      },
      {
        "kind": "system",
        "speaker": "■ SYSTEM",
        "text": "防衛重装のガンテツが配備登録候補になった。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 313
      },
      {
        "kind": "system",
        "speaker": "■ SYSTEM",
        "text": "地下機械室からB3-Lの入口を探す。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 314
      }
    ],
    "source": {
      "startLine": 302,
      "endLine": 315
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
      "startLine": 302,
      "endLine": 315
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
        "text": "病院の発電機は止まりかけている。病棟側の灯りが一つ消えるたび、制御盤の「研究区画優先」だけが明るくなる。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 320
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "上の病棟より、下の階へ電気が流れてる",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 321
      },
      {
        "kind": "dialogue",
        "speaker": "ババヤガ",
        "text": "発生前からか",
        "portraitOwner": "unit-babayaga",
        "portraitKind": "major",
        "sourceLine": 322
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "うん。設定の日付、半年前。こっちには患者がいるのに、研究室が先なんだ",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 323
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "冷却ファンに感染組織が絡み、機械室に焦げた樹脂の臭いが満ちる。非常電源盤は三か所とも落ちている。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 324
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が三か所の非常電源盤へ仲間を割り振り、手動始動レバーへ走る。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 325
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "まず病棟へ電気を戻そう。下に人がおるなら、その扉も開けんとな",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 326
      },
      {
        "kind": "battle-marker",
        "speaker": "◆ BATTLE",
        "text": "三か所の非常電源盤を起動し、発電機を守れ。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 327
      }
    ],
    "source": {
      "startLine": 319,
      "endLine": 328
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
        "text": "三つ目の盤が緑へ変わり、照明が戻る。壁の継ぎ目が開き、隠されたエレベーターに「B3-L」の表示。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 331
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "いくらちゃんの端末が鳴る。主人公たちの戦闘映像が、知らない回線へ送られていた。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 332
      },
      {
        "kind": "system",
        "speaker": "■ SYSTEM",
        "text": "外部転送完了／転送先：SEG-LAB",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 333
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "私の端末から送られてる……。つないだ時に仕込まれたんだ。ごめん、気づかなかった",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 334
      },
      {
        "kind": "dialogue",
        "speaker": "ババヤガ",
        "text": "今から止めるには、どの線や？",
        "portraitOwner": "unit-babayaga",
        "portraitKind": "major",
        "sourceLine": 335
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が表示を撮り、送信線を根元から抜く。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 336
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "それで切れました。送られた映像は取り戻せないけど……転送先は残ってる。勝手に見た奴、調べます",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 337
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "エレベーターの下から、短い救難音が返る。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 338
      }
    ],
    "source": {
      "startLine": 330,
      "endLine": 339
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
      "startLine": 330,
      "endLine": 339
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
        "text": "地下三階は病院の壁ではない。防弾ガラスの奥に、商店街、駅、区役所の監視映像が同時に並ぶ。薬局の白いタオルまで映っている。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 344
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "{{PLAYER_NAME}}さん、俺たちが逃げてた場所、全部映ってる",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 345
      },
      {
        "kind": "system",
        "speaker": "■ SYSTEM",
        "text": "T計画／都市対応実証フィールド／区画B-01〜B-09",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 346
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "救助のためのカメラやなかったんか。薬局の窓まで、ずっと見とったんやな",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 347
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "除染ゲートが異常を告げ、隔壁が閉まる。天井の配管から感染個体が落ちる。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 348
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が非常解除盤へ走り、仲間の退路を確保する。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 349
      },
      {
        "kind": "battle-marker",
        "speaker": "◆ BATTLE",
        "text": "除染制御を復旧し、隔離区画への扉を開けよ。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 350
      }
    ],
    "source": {
      "startLine": 343,
      "endLine": 351
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
        "sourceLine": 354
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "隊列の後ろを歩くマヨちゃんが、開いた扉の前で止まる。耳が立ったのを見て、先行するハチも足を止めた。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 355
      },
      {
        "kind": "dialogue",
        "speaker": "ハチ",
        "text": "マヨちゃん、どうした？　……奥、何かいるな",
        "portraitOwner": "unit-hachi",
        "portraitKind": "major",
        "sourceLine": 356
      },
      {
        "kind": "dialogue",
        "speaker": "ナオ",
        "text": "戻る道を空けておいてください。小さいから、誰か見ていてあげて",
        "portraitOwner": "unit-nao",
        "portraitKind": "major",
        "sourceLine": 357
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公がマヨちゃんの戦術ハーネスを確かめ、後方へ戻る経路を空ける。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 358
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "薬局の箱も病院の備蓄も、ここと同じ管理番号です",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 359
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "三人いるんすよね。……まず、あの扉を開けましょう",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 360
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "ああ。マヨちゃんは俺が抱く。お前は扉へ",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 361
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が防疫扉を開き、隔離区画へ踏み込む。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 362
      },
      {
        "kind": "system",
        "speaker": "■ SYSTEM",
        "text": "マヨちゃんが遊撃の配備登録候補になった。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 363
      },
      {
        "kind": "system",
        "speaker": "■ SYSTEM",
        "text": "生存者を救出し、大型検体を止める。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 364
      }
    ],
    "source": {
      "startLine": 353,
      "endLine": 365
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
      "startLine": 353,
      "endLine": 365
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
        "text": "待機室のガラスに、内側から三つの手形。研究員たちは酸素の残量を指で示し、主人公たちの背後の槽を見ない。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 370
      },
      {
        "kind": "dialogue",
        "speaker": "研究員の声",
        "text": "そのまま開けないで！　先に隔離を復旧してください。あれも一緒に出てしまう！",
        "portraitOwner": null,
        "portraitKind": "offscreen",
        "sourceLine": 371
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "最大槽の札には「MOTHER」。製造日は発生より前だった。供給管が待機室と同じ天井を通る。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 372
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "あれを作った人が、ここにいるんすか",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 373
      },
      {
        "kind": "dialogue",
        "speaker": "研究員の声",
        "text": "……私です。供給管の位置も、止め方も知っています。説明するから、聞いてください",
        "portraitOwner": null,
        "portraitKind": "offscreen",
        "sourceLine": 374
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "ああ、聞いとる。あんたらを出したあとも、聞かせてもらうぞ",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 375
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が酸素供給を待機室へ切り替え、隔離レバーを引く。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 376
      },
      {
        "kind": "boss-marker",
        "speaker": "◆ BOSS",
        "text": "MOTHER",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 377
      },
      {
        "kind": "battle-marker",
        "speaker": "◆ BATTLE",
        "text": "供給管を復旧し、待機室を守りながらMOTHERを止めよ。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 378
      }
    ],
    "source": {
      "startLine": 369,
      "endLine": 379
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
        "text": "封鎖扉が閉まる。研究員の一人は、MOTHERの槽を見ないよう壁づたいに歩く。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 382
      },
      {
        "kind": "dialogue",
        "speaker": "研究員",
        "text": "地上へ出す命令も、見ていました。私は止めずに、培養を続けた。……その記録です",
        "portraitOwner": "minor-human-shared-event-silhouette",
        "portraitKind": "minor",
        "sourceLine": 383
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "差し出された搬送票には、発生前の日付と回収班の赤い認識灯の記録。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 384
      },
      {
        "kind": "dialogue",
        "speaker": "ババヤガ",
        "text": "赤いレンズのやつらか",
        "portraitOwner": "unit-babayaga",
        "portraitKind": "major",
        "sourceLine": 385
      },
      {
        "kind": "dialogue",
        "speaker": "研究員",
        "text": "抑制液の処方も渡します。中和因子が入っています",
        "portraitOwner": "minor-human-shared-event-silhouette",
        "portraitKind": "minor",
        "sourceLine": 386
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "中和因子って、何を抑えるんですか？",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 387
      },
      {
        "kind": "dialogue",
        "speaker": "研究員",
        "text": "強化した感染組織は、自分の体まで食い潰す。それを抑えて、検体を長持ちさせる成分です",
        "portraitOwner": "minor-human-shared-event-silhouette",
        "portraitKind": "minor",
        "sourceLine": 388
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "感染を抑えるなら、人にも使えるんすか？",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 389
      },
      {
        "kind": "dialogue",
        "speaker": "研究員",
        "text": "今は検体用です。そのまま人に使うことはできません。処方と記録を、病院で調べてもらってください",
        "portraitOwner": "minor-human-shared-event-silhouette",
        "portraitKind": "minor",
        "sourceLine": 390
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "分かった。先生に渡す。今すぐ使える薬やないってことも、ちゃんと伝える",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 391
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が票と処方を封じ、三人を地上へ送り出す。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 392
      }
    ],
    "source": {
      "startLine": 381,
      "endLine": 393
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
      "startLine": 381,
      "endLine": 393
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
        "text": "坑道で炎が上がる。赤レンズ部隊が密閉搬送車を走らせようとしている。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 398
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "荷台の表示盤に妻と娘の名を見つけた男が、空のウイスキー瓶を握って飛び出す。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 399
      },
      {
        "kind": "dialogue",
        "speaker": "ザキミヤ",
        "text": "待て！　その車に妻と娘の記録がある！　持っていくな！",
        "portraitOwner": "unit-zakimiya",
        "portraitKind": "major",
        "sourceLine": 400
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "赤レンズの兵が発砲。ザキミヤの手の瓶が砕け、喉元を破片がかすめる。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 401
      },
      {
        "kind": "dialogue",
        "speaker": "ババヤガ",
        "text": "伏せろ！　次は当ててくるぞ！",
        "portraitOwner": "unit-babayaga",
        "portraitKind": "major",
        "sourceLine": 402
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "こっちに来い！",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 403
      },
      {
        "kind": "dialogue",
        "speaker": "ザキミヤ",
        "text": "俺だけ逃げたら、二人がどこへ行ったか分からん！",
        "portraitOwner": "unit-zakimiya",
        "portraitKind": "major",
        "sourceLine": 404
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が搬送車と男の間へ装甲車両を滑り込ませ、運転席を奪う。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 405
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "車内の記録は、坑道出口の端末で開けます。まず車をそこまで！",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 406
      },
      {
        "kind": "battle-marker",
        "speaker": "◆ BATTLE",
        "text": "密閉搬送車を坑道出口まで護衛し、ザキミヤと移送記録を守れ。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 407
      }
    ],
    "source": {
      "startLine": 397,
      "endLine": 408
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
        "text": "密閉搬送車が坑道出口へ着く。いくらちゃんが保守端末に接続すると、表示盤に妻子の名前。「湾岸封鎖区へ移送／以後不明」。ザキミヤは消えかけた画面を両手で押さえる。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 411
      },
      {
        "kind": "dialogue",
        "speaker": "ザキミヤ",
        "text": "以後不明……。死んだってことじゃ、ないんよな？",
        "portraitOwner": "unit-zakimiya",
        "portraitKind": "major",
        "sourceLine": 412
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "ここには死亡記録はありません。続きは中央台帳で調べられます。私も探します",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 413
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "ザキミヤが乳児の写真を見せる。親指が小さな顔を隠さないよう、端を持つ。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 414
      },
      {
        "kind": "dialogue",
        "speaker": "ザキミヤ",
        "text": "さっきは走れたのに。……立てん。足が、言うこと聞かん",
        "portraitOwner": "unit-zakimiya",
        "portraitKind": "major",
        "sourceLine": 415
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "俺もなります。あとになって、急に。……肩、つかまってもらっていいっすか",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 416
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "車まで支えるけん、あとは座っとってよか。水もあるぞ",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 417
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が空席の扉を開く。ザキミヤは写真を胸へ戻して乗る。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 418
      },
      {
        "kind": "system",
        "speaker": "■ SYSTEM",
        "text": "ザキミヤが合流。戦闘配備登録が解禁。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 419
      }
    ],
    "source": {
      "startLine": 410,
      "endLine": 420
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
      "startLine": 410,
      "endLine": 420
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
        "text": "救援薬の冷蔵コンテナは企業の認証がなければ開かない。奥では避難室の灯りが点滅する。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 425
      },
      {
        "kind": "dialogue",
        "speaker": "セガワの声",
        "text": "青い端子を繋げば、冷蔵コンテナと奥の避難室が開きます",
        "portraitOwner": null,
        "portraitKind": "offscreen",
        "sourceLine": 426
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "その前に、どちらさまですか。私の回線、勝手に使ってますよね",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 427
      },
      {
        "kind": "dialogue",
        "speaker": "セガワの声",
        "text": "セガワです。ムガリアンの技術開発局にいます",
        "portraitOwner": null,
        "portraitKind": "offscreen",
        "sourceLine": 428
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "病院のSEG-LABも、あなたの回線？",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 429
      },
      {
        "kind": "dialogue",
        "speaker": "セガワの声",
        "text": "ええ。こちらの回線で見ています。青い端子を繋ぐかは、あなたたちに任せます",
        "portraitOwner": null,
        "portraitKind": "offscreen",
        "sourceLine": 430
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "見てたなら、避難室に何人いるか分かりますよね",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 431
      },
      {
        "kind": "dialogue",
        "speaker": "セガワの声",
        "text": "二人です。一人は足を怪我している",
        "portraitOwner": null,
        "portraitKind": "offscreen",
        "sourceLine": 432
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "いくらちゃんが避難室の熱源を確かめる。二つ。嘘ではない。だからこそ、彼女は端末の録画を止めない。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 433
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が端子を繋ぎ、開いた扉の前へ立つ。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 434
      },
      {
        "kind": "battle-marker",
        "speaker": "◆ BATTLE",
        "text": "避難室と薬品庫を確保し、物資の搬出を守れ。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 435
      }
    ],
    "source": {
      "startLine": 424,
      "endLine": 436
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
        "text": "避難室から二人が出てくる。開いた冷蔵コンテナから、無傷の薬箱が運び出される。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 439
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "薬も人も助かった。ありがとう。……でも、あの映像は渡した覚えがないぞ",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 440
      },
      {
        "kind": "dialogue",
        "speaker": "セガワの声",
        "text": "こちらに残っています。元の記録も、いずれ見せます",
        "portraitOwner": null,
        "portraitKind": "offscreen",
        "sourceLine": 441
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "『いずれ』じゃ困るんですけど。私の端末にも記録が残ってます。こっちでも調べますね",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 442
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "輸送記録には、発生前に結ばれた封鎖と復旧の契約。別都市の契約書には、まだ地名がない。束の下から、水質異常を「一時的」と書き直した報告書が出てくる。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 443
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "事故が起きる前に、封鎖と復旧の契約までしてる。別の街の分も……場所の欄だけ、空っぽ",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 444
      },
      {
        "kind": "dialogue",
        "speaker": "ババヤガ",
        "text": "先に売上を決めて、あとから災害を起こすんか。えらい商売やな",
        "portraitOwner": "unit-babayaga",
        "portraitKind": "major",
        "sourceLine": 445
      },
      {
        "kind": "dialogue",
        "speaker": "ザキミヤ",
        "text": "こんなん、誰に見せたら止められるんや",
        "portraitOwner": "unit-zakimiya",
        "portraitKind": "major",
        "sourceLine": 446
      },
      {
        "kind": "dialogue",
        "speaker": "セガワの声",
        "text": "見せる前に、原本を分けてください。一か所にまとめれば、まとめて奪われます",
        "portraitOwner": null,
        "portraitKind": "offscreen",
        "sourceLine": 447
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が紙の原本を回収し、次の救難信号が出る線路へ向かう。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 448
      }
    ],
    "source": {
      "startLine": 438,
      "endLine": 449
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
      "startLine": 438,
      "endLine": 449
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
        "text": "民間車両が冷蔵貨車に繋がれたまま、感染体に押されている。白い光刃の男が連結部へ斬り込むが、人を乗せた車両まで揺れた。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 454
      },
      {
        "kind": "dialogue",
        "speaker": "TKY",
        "text": "そこの車！　人が乗っとる車両の連結器、三つ外してくれ！　俺が切ると丸ごと飛ぶ！",
        "portraitOwner": "unit-tky",
        "portraitKind": "major",
        "sourceLine": 455
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "待って、なんて呼べばいいっすか！",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 456
      },
      {
        "kind": "dialogue",
        "speaker": "TKY",
        "text": "TKYや！　呼ぶんやったら、連結器が外れた時にしてくれ！　俺はこいつの口を塞いどく！",
        "portraitOwner": "unit-tky",
        "portraitKind": "major",
        "sourceLine": 457
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "貨車が軋む。窓の内側から子どもが手を振り、すぐ引っ込める。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 458
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が一つ目の連結器へ走り、解除ハンドルを握る。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 459
      },
      {
        "kind": "boss-marker",
        "speaker": "◆ BOSS",
        "text": "オオグチ",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 460
      },
      {
        "kind": "battle-marker",
        "speaker": "◆ BATTLE",
        "text": "連結を三つ外し、民間車両を逃がせ。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 461
      }
    ],
    "source": {
      "startLine": 453,
      "endLine": 462
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
        "text": "車両が安全側へ動く。TKYは刃を消し、最後の子どもが降りるまで線路に残る。子どもへ手を振ると、握った柄の熱さに顔をしかめた。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 465
      },
      {
        "kind": "dialogue",
        "speaker": "避難者",
        "text": "もう一人、刀を二本持った人が本社の方へ行った。名前は聞けなかった",
        "portraitOwner": "minor-human-shared-event-silhouette",
        "portraitKind": "minor",
        "sourceLine": 466
      },
      {
        "kind": "dialogue",
        "speaker": "TKY",
        "text": "二本？　ようやるわ。一本でも手ぇ焼くのに",
        "portraitOwner": "unit-tky",
        "portraitKind": "major",
        "sourceLine": 467
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "いくらちゃんがババヤガへ端末を向ける。「チハ／湾岸封鎖区／十七日目生存」。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 468
      },
      {
        "kind": "dialogue",
        "speaker": "ババヤガ",
        "text": "……この人、俺の妻",
        "portraitOwner": "unit-babayaga",
        "portraitKind": "major",
        "sourceLine": 469
      },
      {
        "kind": "dialogue",
        "speaker": "TKY",
        "text": "湾岸やったら、俺も乗せて。さっきの子らが通る道、まだ開けとかんとな",
        "portraitOwner": "unit-tky",
        "portraitKind": "major",
        "sourceLine": 470
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が車両の扉を開く。TKYが避難者へ一度手を振って乗る。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 471
      },
      {
        "kind": "system",
        "speaker": "■ SYSTEM",
        "text": "TKYが合流。戦闘配備登録が解禁。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 472
      }
    ],
    "source": {
      "startLine": 464,
      "endLine": 473
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
      "startLine": 464,
      "endLine": 473
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
        "sourceLine": 478
      },
      {
        "kind": "dialogue",
        "speaker": "セガワの声",
        "text": "左の三つの盤を復旧すれば、民間の無線が繋がります。右は触らないでください。回収班に位置が知られます",
        "portraitOwner": null,
        "portraitKind": "offscreen",
        "sourceLine": 479
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "ちょっと待って。私も図面で確かめます。……うん、左の三つ。{{PLAYER_NAME}}さん、ここです",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 480
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "ババヤガが別の無線を合わせる。雑音の向こうで、女性が避難者の名前を一人ずつ呼んでいる。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 481
      },
      {
        "kind": "dialogue",
        "speaker": "ババヤガ",
        "text": "……チハや。この声、間違いない",
        "portraitOwner": "unit-babayaga",
        "portraitKind": "major",
        "sourceLine": 482
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "声が途切れ、制御盤へ感染者が押し寄せる。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 483
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が三つの盤を地図で示し、仲間を回線の前へ配置する。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 484
      },
      {
        "kind": "battle-marker",
        "speaker": "◆ BATTLE",
        "text": "救難回線の三つの盤を復旧し、制御区を守れ。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 485
      }
    ],
    "source": {
      "startLine": 477,
      "endLine": 486
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
        "text": "三つ目の盤が点灯し、回線が繋がる。女性は十二人の避難者を数え終え、最後の一人へ水を渡してから無線に出る。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 489
      },
      {
        "kind": "dialogue",
        "speaker": "ババヤガ",
        "text": "チハ。俺や",
        "portraitOwner": "unit-babayaga",
        "portraitKind": "major",
        "sourceLine": 490
      },
      {
        "kind": "dialogue",
        "speaker": "Mrs.チハの声",
        "text": "……分かるよ。聞こえてる",
        "portraitOwner": null,
        "portraitKind": "offscreen",
        "sourceLine": 491
      },
      {
        "kind": "dialogue",
        "speaker": "ババヤガ",
        "text": "今行く",
        "portraitOwner": "unit-babayaga",
        "portraitKind": "major",
        "sourceLine": 492
      },
      {
        "kind": "dialogue",
        "speaker": "Mrs.チハの声",
        "text": "待って。先に中央のゲートを閉めて。感染者が入ってくる限り、ここにいる十二人を出せないの",
        "portraitOwner": null,
        "portraitKind": "offscreen",
        "sourceLine": 493
      },
      {
        "kind": "dialogue",
        "speaker": "ババヤガ",
        "text": "……分かった。先に閉める。チハ、無茶するなよ",
        "portraitOwner": "unit-babayaga",
        "portraitKind": "major",
        "sourceLine": 494
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "一拍の無音のあと、彼女が小さく息を吐く。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 495
      },
      {
        "kind": "dialogue",
        "speaker": "Mrs.チハの声",
        "text": "あなたもね",
        "portraitOwner": null,
        "portraitKind": "offscreen",
        "sourceLine": 496
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が中央封鎖区への地図を受け取り、出発する。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 497
      }
    ],
    "source": {
      "startLine": 488,
      "endLine": 498
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
      "startLine": 488,
      "endLine": 498
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
        "text": "三基のゲートが開いたまま、湾岸へ感染者を送り出している。塔から、間隔を置いた単発の銃声。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 503
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "ゲートは三つ。一つでも開いてると、感染者が地下道から入ってきます。全部閉めないと",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 504
      },
      {
        "kind": "dialogue",
        "speaker": "Mrs.チハの声",
        "text": "残り二十七発。子どもたちを階段の下へ移す",
        "portraitOwner": null,
        "portraitKind": "offscreen",
        "sourceLine": 505
      },
      {
        "kind": "dialogue",
        "speaker": "ババヤガ",
        "text": "三つとも、こっちで閉める。子どもらは窓から離してくれ",
        "portraitOwner": "unit-babayaga",
        "portraitKind": "major",
        "sourceLine": 506
      },
      {
        "kind": "dialogue",
        "speaker": "Mrs.チハの声",
        "text": "もう移した。迎えに来るなら急いで",
        "portraitOwner": null,
        "portraitKind": "offscreen",
        "sourceLine": 507
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が三基の担当を指示し、最初の閉鎖盤へ向かう。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 508
      },
      {
        "kind": "battle-marker",
        "speaker": "◆ BATTLE",
        "text": "三基のゲートを閉鎖し、湾岸への流入を止めよ。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 509
      }
    ],
    "source": {
      "startLine": 502,
      "endLine": 510
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
        "text": "三つ目のゲートが閉じる。塔からの銃声も止まる。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 513
      },
      {
        "kind": "dialogue",
        "speaker": "ババヤガ",
        "text": "チハ、聞こえるか",
        "portraitOwner": "unit-babayaga",
        "portraitKind": "major",
        "sourceLine": 514
      },
      {
        "kind": "dialogue",
        "speaker": "Mrs.チハの声",
        "text": "聞こえる。子どもたちも無事",
        "portraitOwner": null,
        "portraitKind": "offscreen",
        "sourceLine": 515
      },
      {
        "kind": "dialogue",
        "speaker": "ババヤガ",
        "text": "よかった。そっちへ行く。車まで、俺がついていくけん",
        "portraitOwner": "unit-babayaga",
        "portraitKind": "major",
        "sourceLine": 516
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "地図に塔への細い通路が現れる。セガワが所要時間を読み上げ、いくらちゃんは時刻だけ記録する。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 517
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が車両を塔へ発進させる。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 518
      }
    ],
    "source": {
      "startLine": 512,
      "endLine": 519
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
      "startLine": 512,
      "endLine": 519
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
        "text": "回廊の奥に十二人。Mrs.チハは拳銃を腰へ戻し、子どもの靴紐を結び直す。背負っていたランチャーを構えた。残る弾は一発。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 524
      },
      {
        "kind": "dialogue",
        "speaker": "Mrs.チハ",
        "text": "子どもを真ん中に。押さないで、歩いて",
        "portraitOwner": "unit-mrs-chiha",
        "portraitKind": "major",
        "sourceLine": 525
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "単眼の感染体が明かりへ向く。ババヤガが呼ぶより先に、Mrs.チハが撃つ。弾が足元で炸裂し、粉塵が眼を覆う。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 526
      },
      {
        "kind": "dialogue",
        "speaker": "Mrs.チハ",
        "text": "煙が晴れるまで。子どもを先に！",
        "portraitOwner": "unit-mrs-chiha",
        "portraitKind": "major",
        "sourceLine": 527
      },
      {
        "kind": "dialogue",
        "speaker": "ババヤガ",
        "text": "お前は下がれ",
        "portraitOwner": "unit-babayaga",
        "portraitKind": "major",
        "sourceLine": 528
      },
      {
        "kind": "dialogue",
        "speaker": "Mrs.チハ",
        "text": "十二人目が通ったら",
        "portraitOwner": "unit-mrs-chiha",
        "portraitKind": "major",
        "sourceLine": 529
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が煙の手前へ部隊を展開させ、回廊の前へ出る。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 530
      },
      {
        "kind": "boss-marker",
        "speaker": "◆ BOSS",
        "text": "クロメ",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 531
      },
      {
        "kind": "battle-marker",
        "speaker": "◆ BATTLE",
        "text": "大型個体を退け、十二人の避難路を確保せよ。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 532
      }
    ],
    "source": {
      "startLine": 523,
      "endLine": 533
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
        "text": "十二人目が車両へ乗る。Mrs.チハはもう一度数え、それからババヤガを見る。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 536
      },
      {
        "kind": "dialogue",
        "speaker": "Mrs.チハ",
        "text": "その袖、破れてる。噛まれた？",
        "portraitOwner": "unit-mrs-chiha",
        "portraitKind": "major",
        "sourceLine": 537
      },
      {
        "kind": "dialogue",
        "speaker": "ババヤガ",
        "text": "違う。破れただけや。……お前は？　腕、見せて",
        "portraitOwner": "unit-babayaga",
        "portraitKind": "major",
        "sourceLine": 538
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "二人とも相手の腕を調べ、無傷と分かっても手を離さない。車内では十二人が出発を待っている。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 539
      },
      {
        "kind": "dialogue",
        "speaker": "Mrs.チハ",
        "text": "……ほんとに来た",
        "portraitOwner": "unit-mrs-chiha",
        "portraitKind": "major",
        "sourceLine": 540
      },
      {
        "kind": "dialogue",
        "speaker": "ババヤガ",
        "text": "来るに決まっとるやろ。……遅くなって、すまん",
        "portraitOwner": "unit-babayaga",
        "portraitKind": "major",
        "sourceLine": 541
      },
      {
        "kind": "dialogue",
        "speaker": "Mrs.チハ",
        "text": "遅いよ。……でも、来てくれてよかった。先に、この人たちを病院へ",
        "portraitOwner": "unit-mrs-chiha",
        "portraitKind": "major",
        "sourceLine": 542
      },
      {
        "kind": "dialogue",
        "speaker": "ババヤガ",
        "text": "ああ。お前も乗れ。俺がついていく",
        "portraitOwner": "unit-babayaga",
        "portraitKind": "major",
        "sourceLine": 543
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "いくらちゃんが防疫扉へ触れる前に、Mrs.チハが八桁の番号で開ける。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 544
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "その番号は？",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 545
      },
      {
        "kind": "dialogue",
        "speaker": "Mrs.チハ",
        "text": "会社の認証番号。入力履歴は、そのまま残しておいて",
        "portraitOwner": "unit-mrs-chiha",
        "portraitKind": "major",
        "sourceLine": 546
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "……会社の番号で、ここが開くんですね。分かりました。消しません",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 547
      },
      {
        "kind": "dialogue",
        "speaker": "ザキミヤ",
        "text": "中央台帳の場所、知っとる？　妻と娘が、湾岸へ運ばれた記録はあるんや",
        "portraitOwner": "unit-zakimiya",
        "portraitKind": "major",
        "sourceLine": 548
      },
      {
        "kind": "dialogue",
        "speaker": "Mrs.チハ",
        "text": "市民資料館の地下。紙の台帳もある。続きが追えるはず",
        "portraitOwner": "unit-mrs-chiha",
        "portraitKind": "major",
        "sourceLine": 549
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が予備弾薬と空席を渡す。いくらちゃんは入力履歴を保存する。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 550
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "いったん病院へ戻り、十二人を救護へ引き渡す。Mrs.チハが最後の一人を見送ると、ババヤガが車両の戸を開けて待っていた。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 551
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が市民資料館を地図に記し、車両を発進させる。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 552
      },
      {
        "kind": "system",
        "speaker": "■ SYSTEM",
        "text": "Mrs.チハが合流。戦闘配備登録が解禁。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 553
      }
    ],
    "source": {
      "startLine": 535,
      "endLine": 554
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
      "startLine": 535,
      "endLine": 554
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
        "text": "紙の台帳が天井まで積まれ、端末では遠隔消去が始まっている。電子音は一件消えるごとに短く鳴る。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 559
      },
      {
        "kind": "dialogue",
        "speaker": "ザキミヤ",
        "text": "妻と娘だけ先に探して――",
        "portraitOwner": "unit-zakimiya",
        "portraitKind": "major",
        "sourceLine": 560
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "棚の無数の名前を見る。彼は息を吸い直す。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 561
      },
      {
        "kind": "dialogue",
        "speaker": "ザキミヤ",
        "text": "……いや、この棚も運ぼう。うちの二人は、持ち出してから探す。ほかの家族の記録も、ここにあるんやもんな",
        "portraitOwner": "unit-zakimiya",
        "portraitKind": "major",
        "sourceLine": 562
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "モニターにムガリアン社長。救援薬と、家族の解放を提示する。代価は台帳の返却。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 563
      },
      {
        "kind": "dialogue",
        "speaker": "ムガリアン社長",
        "text": "オー、話を聞いて。薬も、ご家族の解放も手配できます。まず台帳を返していただけますか",
        "portraitOwner": "mugarian-president",
        "portraitKind": "major",
        "sourceLine": 564
      },
      {
        "kind": "dialogue",
        "speaker": "ザキミヤ",
        "text": "俺の家族を、あんたの取引に入れるな",
        "portraitOwner": "unit-zakimiya",
        "portraitKind": "major",
        "sourceLine": 565
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が画面の音量を切り、最上段の紙箱を仲間へ渡す。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 566
      },
      {
        "kind": "battle-marker",
        "speaker": "◆ BATTLE",
        "text": "遠隔消去を止め、紙台帳を搬出せよ。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 567
      }
    ],
    "source": {
      "startLine": 558,
      "endLine": 568
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
        "sourceLine": 571
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "二人とも三日前に生存確認。臨床試験棟Cです",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 572
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "ザキミヤは床へ座る。写真を見て、掌で目を覆う。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 573
      },
      {
        "kind": "dialogue",
        "speaker": "ザキミヤ",
        "text": "……まだ、間に合う",
        "portraitOwner": "unit-zakimiya",
        "portraitKind": "major",
        "sourceLine": 574
      },
      {
        "kind": "dialogue",
        "speaker": "Mrs.チハ",
        "text": "データを三か所へ送って。橋を渡る時、紙ごと奪われるかもしれない",
        "portraitOwner": "unit-mrs-chiha",
        "portraitKind": "major",
        "sourceLine": 575
      },
      {
        "kind": "dialogue",
        "speaker": "ババヤガ",
        "text": "詳しいな。会社で、そういう消し方も見たんか？",
        "portraitOwner": "unit-babayaga",
        "portraitKind": "major",
        "sourceLine": 576
      },
      {
        "kind": "dialogue",
        "speaker": "Mrs.チハ",
        "text": "……見た。消される予定の名簿も。だから、紙に戻して残した",
        "portraitOwner": "unit-mrs-chiha",
        "portraitKind": "major",
        "sourceLine": 577
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が原本を封じ、搬送車を海浜連絡橋へ向ける。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 578
      }
    ],
    "source": {
      "startLine": 570,
      "endLine": 579
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
      "startLine": 570,
      "endLine": 579
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
        "text": "橋上を企業の装甲車両が塞ぐ。背後には台帳を積んだ搬送車。紙箱の角が、荷台から一つだけはみ出ている。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 584
      },
      {
        "kind": "dialogue",
        "speaker": "セガワの声",
        "text": "保守車線は一度しか開けません。護送車が遮断機に着いたら、七秒だけ通します",
        "portraitOwner": null,
        "portraitKind": "offscreen",
        "sourceLine": 585
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "七秒っすか！？　……俺が行きます。箱、動かないように縛ってください。途中で落としたくないんで",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 586
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "運転席に座り、パイセンはベルトの金具を一度落とす。拾い直して、今度は音を立てずに留めた。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 587
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "俺らの車で横を塞ぐ。遮断機が上がったら、向こう岸まで止まるな",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 588
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "……向こう岸の標識で停まります。来てくださいよ",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 589
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が搬送車の扉を一度叩き、自分たちの車両を盾の位置へ出す。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 590
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "遮断機は下りたまま。企業車両のエンジンが唸り、搬送車の行く手へ回り込む。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 591
      },
      {
        "kind": "battle-marker",
        "speaker": "◆ BATTLE",
        "text": "証拠搬送車を橋の遮断機まで護衛し、敵車両を抑えよ。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 592
      }
    ],
    "source": {
      "startLine": 583,
      "endLine": 593
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
        "text": "搬送車が遮断機へ着く。セガワの合図で、保守車線の遮断機が上がった。七秒。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 596
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "企業車両が横から割り込む。主人公の車両が鼻先を塞ぎ、パイセンが搬送車を滑り込ませる。遮断機が荷台の角を擦って落ちた。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 597
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "無線に、パイセンの荒い呼吸と紙箱の揺れる音だけが残る。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 598
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "病院から受信確認。区役所、外周も……よし、三か所とも届いた！",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 599
      },
      {
        "kind": "dialogue",
        "speaker": "パイセンの声",
        "text": "一箱、角を潰しました。中は無事っす",
        "portraitOwner": null,
        "portraitKind": "offscreen",
        "sourceLine": 600
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "箱はあとで直せる。お前、どっかぶつけとらんか？",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 601
      },
      {
        "kind": "dialogue",
        "speaker": "パイセンの声",
        "text": "ないっす。……今になって、足震えてますけど",
        "portraitOwner": null,
        "portraitKind": "offscreen",
        "sourceLine": 602
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "なら、そのまま座っとけ。水、飲めよ。すぐ行く",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 603
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "河口防潮門から大型感染者が西新側へ流入したと知らせが入る。ザキミヤは試験棟の方を見る。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 604
      },
      {
        "kind": "dialogue",
        "speaker": "ザキミヤ",
        "text": "先に門を閉めよう。二人を連れて帰る道まで、失くしたくない",
        "portraitOwner": "unit-zakimiya",
        "portraitKind": "major",
        "sourceLine": 605
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が車両を河口へ向け直す。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 606
      }
    ],
    "source": {
      "startLine": 595,
      "endLine": 607
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
      "startLine": 595,
      "endLine": 607
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
        "sourceLine": 612
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "ここを閉めれば、商店街から病院まで歩いて薬を運べる",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 613
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "薬だけやない。食べ物も運べるし、人も行き来できる。ここは閉めよう",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 614
      },
      {
        "kind": "dialogue",
        "speaker": "TKY",
        "text": "門から引き剥がす。閉めるのは任せた",
        "portraitOwner": "unit-tky",
        "portraitKind": "major",
        "sourceLine": 615
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が手動閉鎖盤を起動し、感染体を水路側へ誘う。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 616
      },
      {
        "kind": "boss-marker",
        "speaker": "◆ BOSS",
        "text": "ガイレン",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 617
      },
      {
        "kind": "battle-marker",
        "speaker": "◆ BATTLE",
        "text": "ガイレンを退け、防潮門を閉鎖せよ。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 618
      }
    ],
    "source": {
      "startLine": 611,
      "endLine": 619
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
        "text": "門が閉じる。夜、仮設灯の下を薬を積んだ自転車が病院へ走る。発生以来初めて、住民がこの道を自分の足で渡る。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 624,
        "sceneTag": "corridor"
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "後ろから缶詰を積んだ小さな台車。クレイジーキングはがたつく車輪を足で押さえ、一缶も落とさず運んでくる。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 625,
        "sceneTag": "corridor"
      },
      {
        "kind": "dialogue",
        "speaker": "クレイジーキング",
        "text": "道は取り戻した。缶詰の半分を病院へ！",
        "portraitOwner": "unit-crazy-king",
        "portraitKind": "major",
        "sourceLine": 626,
        "sceneTag": "corridor"
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "もう半分は",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 627,
        "sceneTag": "corridor"
      },
      {
        "kind": "dialogue",
        "speaker": "クレイジーキング",
        "text": "残りは我らの朝飯。腹が鳴っては門を守れん",
        "portraitOwner": "unit-crazy-king",
        "portraitKind": "major",
        "sourceLine": 628,
        "sceneTag": "corridor"
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "あ、俺の分もあります？　さっきから腹鳴ってるんで",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 629,
        "sceneTag": "corridor"
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "本社へ続く道には、首筋や胸を斬られた感染者が倒れている。二刀の男が路地から出てくる。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 632,
        "sceneTag": "musashi"
      },
      {
        "kind": "dialogue",
        "speaker": "TKY",
        "text": "あの刃の人か",
        "portraitOwner": "unit-tky",
        "portraitKind": "major",
        "sourceLine": 633,
        "sceneTag": "musashi"
      },
      {
        "kind": "dialogue",
        "speaker": "宮本武蔵",
        "text": "あの黒い楼へ続く道で、感染者を斬ってきた。お主らも、そこへ行くのか",
        "portraitOwner": "unit-miyamoto-musashi",
        "portraitKind": "major",
        "sourceLine": 634,
        "sceneTag": "musashi"
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "名前を聞いてもいい？",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 635,
        "sceneTag": "musashi"
      },
      {
        "kind": "dialogue",
        "speaker": "宮本武蔵",
        "text": "宮本武蔵",
        "portraitOwner": "unit-miyamoto-musashi",
        "portraitKind": "major",
        "sourceLine": 636,
        "sceneTag": "musashi"
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "……あの、二刀流の？",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 637,
        "sceneTag": "musashi"
      },
      {
        "kind": "dialogue",
        "speaker": "宮本武蔵",
        "text": "他にも武蔵がおるのか。お主らは、あの楼へ行くのであろう？",
        "portraitOwner": "unit-miyamoto-musashi",
        "portraitKind": "major",
        "sourceLine": 638,
        "sceneTag": "musashi"
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "二刀に残る血と、塞がれずに続く道を見比べ、主人公が頷く。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 639,
        "sceneTag": "musashi"
      },
      {
        "kind": "dialogue",
        "speaker": "宮本武蔵",
        "text": "道が同じなら、刃を貸す",
        "portraitOwner": "unit-miyamoto-musashi",
        "portraitKind": "major",
        "sourceLine": 640,
        "sceneTag": "musashi"
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が空いた席を示す。武蔵は二刀を納めて乗る。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 641,
        "sceneTag": "musashi"
      },
      {
        "kind": "system",
        "speaker": "■ SYSTEM",
        "text": "宮本武蔵が合流。戦闘配備登録が解禁。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 642,
        "sceneTag": "musashi"
      }
    ],
    "source": {
      "startLine": 621,
      "endLine": 643
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
      "startLine": 621,
      "endLine": 643
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
        "text": "ゲートには赤いレンズの回収班。背後の建物に「臨床試験棟C」の表示。運び出す箱より先に、収容者の名簿を燃やしている。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 648
      },
      {
        "kind": "dialogue",
        "speaker": "赤レンズの隊長",
        "text": "記録を置いて退去しろ",
        "portraitOwner": "red-panther-commander",
        "portraitKind": "major",
        "sourceLine": 649
      },
      {
        "kind": "dialogue",
        "speaker": "ザキミヤ",
        "text": "中の人を出せ！　家族を探しに来たんや。そこをどけ！",
        "portraitOwner": "unit-zakimiya",
        "portraitKind": "major",
        "sourceLine": 650
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "隊員が音響誘導装置を構える。Mrs.チハが東塔を指した。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 651
      },
      {
        "kind": "dialogue",
        "speaker": "Mrs.チハ",
        "text": "東塔の音響装置を止めて。鳴れば、この一帯の感染者が寄る",
        "portraitOwner": "unit-mrs-chiha",
        "portraitKind": "major",
        "sourceLine": 652
      },
      {
        "kind": "dialogue",
        "speaker": "ババヤガ",
        "text": "装置の場所まで知っとるんやね",
        "portraitOwner": "unit-babayaga",
        "portraitKind": "major",
        "sourceLine": 653
      },
      {
        "kind": "dialogue",
        "speaker": "Mrs.チハ",
        "text": "設置図を見たことがある。……あとで話す。今は、あれを止めて",
        "portraitOwner": "unit-mrs-chiha",
        "portraitKind": "major",
        "sourceLine": 654
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が車両を避難路へ置き、東塔に照準を合わせる。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 655
      },
      {
        "kind": "battle-marker",
        "speaker": "◆ BATTLE",
        "text": "誘導装置を止め、臨床試験棟への道を開けよ。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 656
      }
    ],
    "source": {
      "startLine": 647,
      "endLine": 657
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
        "sourceLine": 660
      },
      {
        "kind": "dialogue",
        "speaker": "ザキミヤ",
        "text": "今朝、ここにおった",
        "portraitOwner": "unit-zakimiya",
        "portraitKind": "major",
        "sourceLine": 661
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "処分警報が鳴る。表示より先にMrs.チハが残り時間を口にする。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 662
      },
      {
        "kind": "dialogue",
        "speaker": "Mrs.チハ",
        "text": "八分で焼却が始まる。電源を落とされる前に入って",
        "portraitOwner": "unit-mrs-chiha",
        "portraitKind": "major",
        "sourceLine": 663
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "なんで知ってるんすか。……いや、今はいい。扉、開けましょう",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 664
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が棟の扉へ走り、全員が続く。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 665
      }
    ],
    "source": {
      "startLine": 659,
      "endLine": 666
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
      "startLine": 659,
      "endLine": 666
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
        "text": "白い廊下。「救命」「先進治療」の広告の下で、扉を叩く音が警報と重なる。C-4は一番奥。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 671
      },
      {
        "kind": "dialogue",
        "speaker": "ザキミヤ",
        "text": "C-4から開けられんのか",
        "portraitOwner": "unit-zakimiya",
        "portraitKind": "major",
        "sourceLine": 672
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "東側から一室ずつ電源を戻さないと、扉を開けられないんです。C-4は、その最後",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 673
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "ザキミヤはC-4へ走りかけ、最初の扉で止まる。中から、自分の娘ではない子どもの声がした。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 674
      },
      {
        "kind": "dialogue",
        "speaker": "ザキミヤ",
        "text": "……ここからやな。順番に開けよう。最後まで、俺もやるけん",
        "portraitOwner": "unit-zakimiya",
        "portraitKind": "major",
        "sourceLine": 675
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "四十三人、全員連れ出す",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 676
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が最初の生命維持レバーを上げる。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 677
      },
      {
        "kind": "battle-marker",
        "speaker": "◆ BATTLE",
        "text": "処分手順を止め、四十三人を順に救出せよ。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 678
      }
    ],
    "source": {
      "startLine": 670,
      "endLine": 679
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
        "text": "最後のC-4が開く。ザキミヤの妻は娘を抱いて立っている。娘は彼を見ても、まだ父親と分からない。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 682
      },
      {
        "kind": "dialogue",
        "speaker": "ザキミヤの妻",
        "text": "生きとったん",
        "portraitOwner": "minor-human-shared-event-silhouette",
        "portraitKind": "minor",
        "sourceLine": 683
      },
      {
        "kind": "dialogue",
        "speaker": "ザキミヤ",
        "text": "うん。もっと早く来たかった",
        "portraitOwner": "unit-zakimiya",
        "portraitKind": "major",
        "sourceLine": 684
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "彼が両手を差し出す。妻は煤と血で黒い指を見て、娘を抱き直した。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 685
      },
      {
        "kind": "dialogue",
        "speaker": "ザキミヤの妻",
        "text": "洗って。ここに水がある",
        "portraitOwner": "minor-human-shared-event-silhouette",
        "portraitKind": "minor",
        "sourceLine": 686
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "ザキミヤは流しで手を洗う。爪の下の黒が落ちるまで。妻もその間、娘を急かさない。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 687
      },
      {
        "kind": "dialogue",
        "speaker": "ザキミヤ",
        "text": "父ちゃんや。……覚えとらんか。そりゃそうやな。ずっと留守やったもんな",
        "portraitOwner": "unit-zakimiya",
        "portraitKind": "major",
        "sourceLine": 688
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "娘の指が、差し出した彼の指を握る。妻が娘を渡し、彼の腕を下から支える。ザキミヤは娘の首をそっと支え、ようやく妻を見る。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 689
      },
      {
        "kind": "dialogue",
        "speaker": "ザキミヤの妻",
        "text": "また行くんやろ",
        "portraitOwner": "minor-human-shared-event-silhouette",
        "portraitKind": "minor",
        "sourceLine": 690
      },
      {
        "kind": "dialogue",
        "speaker": "ザキミヤ",
        "text": "行く。……でも、帰ってくる。もう、あんな長く待たせん",
        "portraitOwner": "unit-zakimiya",
        "portraitKind": "major",
        "sourceLine": 691
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "無線に回収班の声。「エージェントCH-17、帰投しろ」。Mrs.チハが振り向く。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 692
      },
      {
        "kind": "dialogue",
        "speaker": "ババヤガ",
        "text": "チハ？",
        "portraitOwner": "unit-babayaga",
        "portraitKind": "major",
        "sourceLine": 693
      },
      {
        "kind": "dialogue",
        "speaker": "Mrs.チハ",
        "text": "私のこと。ここを出たら、全部話す",
        "portraitOwner": "unit-mrs-chiha",
        "portraitKind": "major",
        "sourceLine": 694
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が救出者を安全回廊経由で病院へ送り、Mrs.チハと共に追撃から離れる。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 695
      }
    ],
    "source": {
      "startLine": 681,
      "endLine": 696
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
      "startLine": 681,
      "endLine": 696
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
        "text": "防爆扉を閉めた作戦庫。遠くで追撃部隊の声がする。Mrs.チハはランチャー、拳銃、認証カードを主人公たちの前へ置いた。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 701
      },
      {
        "kind": "dialogue",
        "speaker": "Mrs.チハ",
        "text": "会社の事務をしてるって言ってたけど……本当は、ムガリアンの専属エージェントだった",
        "portraitOwner": "unit-mrs-chiha",
        "portraitKind": "major",
        "sourceLine": 702
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "何を回収してたんすか",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 703
      },
      {
        "kind": "dialogue",
        "speaker": "Mrs.チハ",
        "text": "物資と、外へ漏れた情報。計画のことも聞いてた。街の一部で感染事故を起こして、会社が収める。私は、その回収を担当するはずだった",
        "portraitOwner": "unit-mrs-chiha",
        "portraitKind": "major",
        "sourceLine": 704
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "狭かったら、人を噛ませてよかったんか",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 705
      },
      {
        "kind": "dialogue",
        "speaker": "Mrs.チハ",
        "text": "よくない。……二日目には分かってた。指示書に『損失は許容範囲』って。それを読んだあとも、私は会社に残った",
        "portraitOwner": "unit-mrs-chiha",
        "portraitKind": "major",
        "sourceLine": 706
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "防爆扉が揺れる。彼女は床のカードを拾わない。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 707
      },
      {
        "kind": "dialogue",
        "speaker": "Mrs.チハ",
        "text": "中から避難車の道を変えた。消す予定だった名簿を紙に戻した。湾岸の十二人も隠した",
        "portraitOwner": "unit-mrs-chiha",
        "portraitKind": "major",
        "sourceLine": 708
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "あの番号を入れた時に、言えたはずです。なんで今まで黙ってたんですか",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 709
      },
      {
        "kind": "dialogue",
        "speaker": "Mrs.チハ",
        "text": "信用してもらえなくなると思った。……今は、もっと信用できないよね",
        "portraitOwner": "unit-mrs-chiha",
        "portraitKind": "major",
        "sourceLine": 710
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "ババヤガはカードではなく妻の顔を見る。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 711
      },
      {
        "kind": "dialogue",
        "speaker": "ババヤガ",
        "text": "俺が裏で人を撃っとったことも、知っとった？",
        "portraitOwner": "unit-babayaga",
        "portraitKind": "major",
        "sourceLine": 712
      },
      {
        "kind": "dialogue",
        "speaker": "Mrs.チハ",
        "text": "結婚する前から。最初は仕事で調べた。好きになってからも言えなかった",
        "portraitOwner": "unit-mrs-chiha",
        "portraitKind": "major",
        "sourceLine": 713
      },
      {
        "kind": "dialogue",
        "speaker": "ババヤガ",
        "text": "俺だけが隠しとるつもりやった。……そうか",
        "portraitOwner": "unit-babayaga",
        "portraitKind": "major",
        "sourceLine": 714
      },
      {
        "kind": "dialogue",
        "speaker": "Mrs.チハ",
        "text": "うん。ごめん。それだけで済まないのも、分かってる",
        "portraitOwner": "unit-mrs-chiha",
        "portraitKind": "major",
        "sourceLine": 715
      },
      {
        "kind": "dialogue",
        "speaker": "ババヤガ",
        "text": "あとで、全部聞く。今は、ここの記録を外へ出そう",
        "portraitOwner": "unit-babayaga",
        "portraitKind": "major",
        "sourceLine": 716
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "主人公が認証カードを中央端末へ差す。内部記録を病院、区役所、外周へ送る画面で、実行キーから手を離した。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 717
      },
      {
        "kind": "dialogue",
        "speaker": "Mrs.チハ",
        "text": "これを送ったら、カードは焼ける。私の認証も失効する。……もう会社には戻れない",
        "portraitOwner": "unit-mrs-chiha",
        "portraitKind": "major",
        "sourceLine": 718
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が防爆扉を支え、実行キーの前をMrs.チハへ譲る。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 719
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "Mrs.チハが自分で押す。送信先が三つ点灯し、カードのICが焦げる。扉の向こうから帰投命令が響いた。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 720
      },
      {
        "kind": "dialogue",
        "speaker": "Mrs.チハ",
        "text": "聞こえてる。……でも、帰らない",
        "portraitOwner": "unit-mrs-chiha",
        "portraitKind": "major",
        "sourceLine": 721
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "彼女はランチャーと拳銃を拾う。ババヤガは、その手元ではなく彼女の顔を見たまま、何も言わない。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 722
      },
      {
        "kind": "battle-marker",
        "speaker": "◆ BATTLE",
        "text": "追撃を退け、指揮車から本社塔の認証キーを奪え。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 723
      }
    ],
    "source": {
      "startLine": 700,
      "endLine": 724
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
        "sourceLine": 727
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "病院で私たちを見ていた回線と同じ署名です",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 728
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "セガワさん。これは何ですか",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 729
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "無線に返事が来るまで、長い間がある。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 730
      },
      {
        "kind": "dialogue",
        "speaker": "セガワの声",
        "text": "ここでは話せません。原本は技術開発塔にあります。そこで見せます",
        "portraitOwner": null,
        "portraitKind": "offscreen",
        "sourceLine": 731
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "自分が出した命令かどうか、答えるぐらいはできるやろ。セガワ！",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 732
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "無線は切れない。ただ、セガワは答えない。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 733
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "ババヤガが弾倉をMrs.チハへ渡す。許したとは言わない。彼女も礼を言わず、受け取った。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 734
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が認証キーを抜き、技術開発塔へ向かう。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 735
      }
    ],
    "source": {
      "startLine": 726,
      "endLine": 736
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
      "startLine": 726,
      "endLine": 736
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
        "text": "透明な隔壁に大型感染体が二体。片方が腕を上げると、もう片方も一拍遅れて同じ角度へ上げる。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 741
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "社長の映像が点く。左袖の下に黒い血がにじんでいる。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 742
      },
      {
        "kind": "dialogue",
        "speaker": "ムガリアン社長",
        "text": "小さな感染事故を、当社の薬で収める。そうすれば、西新は長く当社の顧客になる。そのための計画でした",
        "portraitOwner": "mugarian-president",
        "portraitKind": "major",
        "sourceLine": 743
      },
      {
        "kind": "dialogue",
        "speaker": "ザキミヤ",
        "text": "小さな危機に、うちの娘も入ってたんか",
        "portraitOwner": "unit-zakimiya",
        "portraitKind": "major",
        "sourceLine": 744
      },
      {
        "kind": "dialogue",
        "speaker": "ムガリアン社長",
        "text": "娘さん個人を選んだわけではない。西新を選んだのは私だが、ここまで広げる許可は出していない",
        "portraitOwner": "mugarian-president",
        "portraitKind": "major",
        "sourceLine": 745
      },
      {
        "kind": "dialogue",
        "speaker": "セガワの声",
        "text": "中央制御を切れば二体は連動しません。先に止めてください",
        "portraitOwner": null,
        "portraitKind": "offscreen",
        "sourceLine": 746
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "社長の映像と無線を切り、いくらちゃんが制御線を現物で確かめる。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 747
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "二体につながる制御線はありました。切れば連携を止められるか……私も見ます。あの人の言葉だけで動かないで",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 748
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が切断箇所を確認し、隔壁の開放に備える。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 749
      },
      {
        "kind": "boss-marker",
        "speaker": "◆ BOSS",
        "text": "フタゴ",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 750
      },
      {
        "kind": "battle-marker",
        "speaker": "◆ BATTLE",
        "text": "制御を切り、二体の連携を崩して倒せ。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 751
      }
    ],
    "source": {
      "startLine": 740,
      "endLine": 752
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
        "sourceLine": 755
      },
      {
        "kind": "dialogue",
        "speaker": "Mrs.チハ",
        "text": "社長は噛まれてる。あの腕を見た",
        "portraitOwner": "unit-mrs-chiha",
        "portraitKind": "major",
        "sourceLine": 756
      },
      {
        "kind": "dialogue",
        "speaker": "セガワの声",
        "text": "未承認の処置薬を持っているはずです。使わせないでください",
        "portraitOwner": null,
        "portraitKind": "offscreen",
        "sourceLine": 757
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "その薬、あんたも知っとるんやな。あとで、ちゃんと聞かせてもらうぞ",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 758
      },
      {
        "kind": "dialogue",
        "speaker": "セガワの声",
        "text": "ええ",
        "portraitOwner": null,
        "portraitKind": "offscreen",
        "sourceLine": 759
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が昇降路に入り、仲間を呼ぶ。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 760
      }
    ],
    "source": {
      "startLine": 754,
      "endLine": 761
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
      "startLine": 754,
      "endLine": 761
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
        "text": "ガラスの向こうの社長は、左腕を机の下に隠す。未承認薬は一本だけ。彼の退路には医療設備が並ぶ。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 766
      },
      {
        "kind": "dialogue",
        "speaker": "ムガリアン社長",
        "text": "設備も薬も残します。私だけでいい。ここから出してください",
        "portraitOwner": "mugarian-president",
        "portraitKind": "major",
        "sourceLine": 767
      },
      {
        "kind": "dialogue",
        "speaker": "Mrs.チハ",
        "text": "設備は残す。働く人も守る。でも、あなたを逃がす約束はできない",
        "portraitOwner": "unit-mrs-chiha",
        "portraitKind": "major",
        "sourceLine": 768
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "社長が膝をつく。黒い変色が肩まで上がり、彼は薬を抜く。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 769
      },
      {
        "kind": "dialogue",
        "speaker": "セガワの声",
        "text": "人間への試験は終わっていません。打てば感染組織が増えます",
        "portraitOwner": null,
        "portraitKind": "offscreen",
        "sourceLine": 770
      },
      {
        "kind": "dialogue",
        "speaker": "ムガリアン社長",
        "text": "それしかないんだ。……じゃあ、どうしろと言うんだ！",
        "portraitOwner": "mugarian-president",
        "portraitKind": "major",
        "sourceLine": 771
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "誰も答えない。社長は針を自分の腕へ刺す。数秒だけ変色が止まり、彼が安堵した顔をしたところでガラスに亀裂が走る。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 772
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が仲間を退かせ、医療設備を守る位置へ出る。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 773
      },
      {
        "kind": "boss-marker",
        "speaker": "◆ BOSS",
        "text": "変異ムガリアン社長",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 774
      },
      {
        "kind": "battle-marker",
        "speaker": "◆ BATTLE",
        "text": "変異した社長を止め、薬と医療設備を守れ。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 775
      }
    ],
    "source": {
      "startLine": 765,
      "endLine": 776
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
        "text": "社長が倒れる。窓の外には、契約書で区画番号にした街の灯り。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 779
      },
      {
        "kind": "dialogue",
        "speaker": "ムガリアン社長",
        "text": "封鎖さえ、間に合っていれば……",
        "portraitOwner": "mugarian-president",
        "portraitKind": "major",
        "sourceLine": 780
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "あんたが封鎖した病院で、まだ人が待っとる。薬は持って帰るぞ",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 781
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "施設警報が静まる。病院へ、救出した人と薬が届いた知らせ。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 782
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "夜。仮設の炊き出しで、全員が紙コップの味噌汁を持つ。ザキミヤは妻子のそばで哺乳瓶を冷まし、いくらちゃんは片手で配車表を見ている。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 785,
        "sceneTag": "soup"
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "熱っ。……ちゃんと熱い",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 786,
        "sceneTag": "soup"
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "一気に飲むなよ。もう誰も取らんけん",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 787,
        "sceneTag": "soup"
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "Mrs.チハは湯気の向こうにいる。ババヤガは何も聞かず、彼女の分の椀をテーブルの端へ寄せた。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 788,
        "sceneTag": "soup"
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "冷蔵車列の追跡信号が無線に入る。社長の台帳にはない車。湯気の向こうで、全員が顔を上げる。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 789,
        "sceneTag": "soup"
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が残りを飲み、冷蔵車列の行き先を地図に示す。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 790,
        "sceneTag": "soup"
      }
    ],
    "source": {
      "startLine": 778,
      "endLine": 791
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
      "startLine": 778,
      "endLine": 791
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
        "text": "社員と家族を乗せたバスは正門へ。番号のない冷蔵車三台だけが保守路へ逸れる。護衛の赤レンズも、バスではなく冷蔵車についた。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 796
      },
      {
        "kind": "dialogue",
        "speaker": "研究員の声",
        "text": "バスは通して！　止めるのは冷蔵車です。撤収台帳にありません",
        "portraitOwner": null,
        "portraitKind": "offscreen",
        "sourceLine": 797
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "さっきの配車表、空欄が一台ありました。私が付けた追跡タグ、まだ生きてる",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 798
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "あの配車表っすか。飯の間もずっと見てたから、何してんだろって",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 799
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "そう、それ。味噌汁持ったまま見てたら、すっかり冷めちゃって。……戻ったら、おかわりしていいですか",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 800
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "残しとく。冷蔵車を止めたら、今度は端末を置いて飲めよ",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 801
      },
      {
        "kind": "dialogue",
        "speaker": "Mrs.チハ",
        "text": "あれは社長の命令じゃない。研究部門だけの私設回収",
        "portraitOwner": "unit-mrs-chiha",
        "portraitKind": "major",
        "sourceLine": 802
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が社員バスを先に通し、冷蔵車へ進路を切る。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 803
      },
      {
        "kind": "battle-marker",
        "speaker": "◆ BATTLE",
        "text": "民間車両を巻き込まず、冷蔵車列を止めよ。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 804
      }
    ],
    "source": {
      "startLine": 795,
      "endLine": 805
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
        "text": "荷室には薬局を出た日からの戦闘写真。救助した人数だけでなく、誰が誰を待ったかまで時刻が振られている。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 808
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "区役所で戻った時の俺まで写ってる。……あの人も、この写真にいるのに",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 809
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "いくらちゃんは写真を伏せる。薬局で自分が笑った瞬間にも、時刻と観察番号が振られている。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 810
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "あの時も、見てたんですね",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 811
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "セガワ。あの薬を渡した時も、俺らを見とったんか",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 812
      },
      {
        "kind": "dialogue",
        "speaker": "セガワの声",
        "text": "はい。薬は本物です。救助された人たちも、生きて帰りました",
        "portraitOwner": null,
        "portraitKind": "offscreen",
        "sourceLine": 813
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "薬が本物なら、何してもよかったんか。何のために見とった！",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 814
      },
      {
        "kind": "dialogue",
        "speaker": "セガワの声",
        "text": "誰を助けに戻るか。何秒迷うか。人数が増えても、同じことをするか。記録していました",
        "portraitOwner": null,
        "portraitKind": "offscreen",
        "sourceLine": 815
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "主人公が通信を切る。紙の搬送命令書の裏に、会社台帳にない研究区画の座標と、セガワの署名。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 816
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が物理原本を押収し、自分の地図へ座標を写す。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 817
      }
    ],
    "source": {
      "startLine": 807,
      "endLine": 818
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
      "startLine": 807,
      "endLine": 818
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
        "text": "旧物流網の奥で企業標章が削られ、赤い豹の章だけが残る。ここまで来ても、警備兵のレンズだけは同じ赤だ。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 823
      },
      {
        "kind": "system",
        "speaker": "■ SYSTEM",
        "text": "SPECIAL OPERATIONS UNIT：RED PANTHER",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 824
      },
      {
        "kind": "dialogue",
        "speaker": "Mrs.チハ",
        "text": "研究部門の直轄。社長より特級博士の命令を優先する",
        "portraitOwner": "unit-mrs-chiha",
        "portraitKind": "major",
        "sourceLine": 825
      },
      {
        "kind": "dialogue",
        "speaker": "RED PANTHER隊長",
        "text": "セガワ特級博士の命令だ。ここから先へは通さない",
        "portraitOwner": "red-panther-commander",
        "portraitKind": "major",
        "sourceLine": 826
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "じゃあ、本人呼んでくださいよ！　この命令書、セガワさんの署名なんすよ！",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 827
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "隊長は銃口を下げない。主人公は押収した命令書を示し、返答を待つ。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 828
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が仲間を遮蔽物へ移し、前進する。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 829
      },
      {
        "kind": "battle-marker",
        "speaker": "◆ BATTLE",
        "text": "RED PANTHERの封鎖を突破せよ。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 830
      }
    ],
    "source": {
      "startLine": 822,
      "endLine": 831
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
        "text": "紙ファイルの表紙に「特級博士 セガワ」。余白の「ネコ殺し」は赤ペンで消し損ねている。棚には動物試験の記録。壁の西新の地図には、避難者数と散布後に減った工場排水のグラフが重ねられている。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 834
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "なんで、うちの街やった",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 835
      },
      {
        "kind": "dialogue",
        "speaker": "セガワの声",
        "text": "病院、駅、役所、住宅が歩ける距離にある。逃げる人と、助けに戻る人を、同じ場所で観察できるからです",
        "portraitOwner": null,
        "portraitKind": "offscreen",
        "sourceLine": 836
      },
      {
        "kind": "dialogue",
        "speaker": "ザキミヤ",
        "text": "俺の娘が寝とった街を、実験にちょうどええと思ったんか",
        "portraitOwner": "unit-zakimiya",
        "portraitKind": "major",
        "sourceLine": 837
      },
      {
        "kind": "dialogue",
        "speaker": "セガワの声",
        "text": "ええ",
        "portraitOwner": null,
        "portraitKind": "offscreen",
        "sourceLine": 838
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "別の映像には、西新の防衛線で倒したTAKUYAの遺骸を回収する赤レンズ部隊。再生処置の記録が続く。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 839
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "あの日、終わったと思ってた",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 840
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "この記録……倒れたあとも、ずっと薬を入れてる。あの人が、また動かすつもりだったんだ",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 841
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が映像を止め、次の管制室へ進む。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 842
      }
    ],
    "source": {
      "startLine": 833,
      "endLine": 843
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
      "startLine": 833,
      "endLine": 843
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
        "text": "日本地図から各都市へ線が伸びる。噴霧器と医療設備に送る起動命令は、まだ待機中。西新で使った区画番号の続きが並ぶ。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 848
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "起動はまだです。今止めれば、次の街には撒かれません！",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 849
      },
      {
        "kind": "dialogue",
        "speaker": "ザキミヤ",
        "text": "西新の次に、誰の家のそばで撒くつもりや",
        "portraitOwner": "unit-zakimiya",
        "portraitKind": "major",
        "sourceLine": 850
      },
      {
        "kind": "dialogue",
        "speaker": "セガワの声",
        "text": "西新の水は、何度調べても基準を超えた。報告書では、毎年『一時的』で片づけられました",
        "portraitOwner": null,
        "portraitKind": "offscreen",
        "sourceLine": 851
      },
      {
        "kind": "dialogue",
        "speaker": "TKY",
        "text": "それ書いたやつを止めろよ。なんで街へ撒く",
        "portraitOwner": "unit-tky",
        "portraitKind": "major",
        "sourceLine": 852
      },
      {
        "kind": "dialogue",
        "speaker": "セガワの声",
        "text": "何年訴えても、工場は止まらなかった。西新に撒いたら、三日で止まった。でも、あなたたちが道を開けた。人はまた戻り始めた",
        "portraitOwner": null,
        "portraitKind": "offscreen",
        "sourceLine": 853
      },
      {
        "kind": "dialogue",
        "speaker": "TKY",
        "text": "戻ったらあかんのか。あそこ、人の家やぞ",
        "portraitOwner": "unit-tky",
        "portraitKind": "major",
        "sourceLine": 854
      },
      {
        "kind": "dialogue",
        "speaker": "セガワの声",
        "text": "人が戻れば、また汚す。工場だけ止めても、同じことを繰り返す。私は人間を残すつもりはありません",
        "portraitOwner": null,
        "portraitKind": "offscreen",
        "sourceLine": 855
      },
      {
        "kind": "dialogue",
        "speaker": "ザキミヤ",
        "text": "うちの娘もか。生まれたばっかりやぞ！　あの子が何したんや！",
        "portraitOwner": "unit-zakimiya",
        "portraitKind": "major",
        "sourceLine": 856
      },
      {
        "kind": "dialogue",
        "speaker": "セガワの声",
        "text": "何も。ただ、あの子だけを残す理由もありません",
        "portraitOwner": null,
        "portraitKind": "offscreen",
        "sourceLine": 857
      },
      {
        "kind": "dialogue",
        "speaker": "ザキミヤ",
        "text": "……もうええ。{{PLAYER_NAME}}さん、止めよう。こいつに、次を撒かせたらいかん",
        "portraitOwner": "unit-zakimiya",
        "portraitKind": "major",
        "sourceLine": 858
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "セガワは答えない。最初の保護カバーが閉まり始める。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 859
      },
      {
        "kind": "dialogue",
        "speaker": "宮本武蔵",
        "text": "あの蓋が閉じるぞ。わしが押さえる。中の仕掛けを止めよ",
        "portraitOwner": "unit-miyamoto-musashi",
        "portraitKind": "major",
        "sourceLine": 860
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公がカバーを開き、物理停止レバーへ手を伸ばす。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 861
      },
      {
        "kind": "battle-marker",
        "speaker": "◆ BATTLE",
        "text": "国内の散布装置を物理停止せよ。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 862
      }
    ],
    "source": {
      "startLine": 847,
      "endLine": 863
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
        "sourceLine": 866
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "国内の散布装置、全部停止。……ここから撒かれる分は、止められました",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 867
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "地下への扉に三つの表示。「国外一斉起動」「感染源原株」「T-03最終収容区」。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 868
      },
      {
        "kind": "dialogue",
        "speaker": "Mrs.チハ",
        "text": "外へ出る回線と原株を先に潰す。T-03の扉は、開けさせない",
        "portraitOwner": "unit-mrs-chiha",
        "portraitKind": "major",
        "sourceLine": 869
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が仲間の位置を確かめ、地下扉を開ける。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 870
      }
    ],
    "source": {
      "startLine": 865,
      "endLine": 871
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
      "startLine": 865,
      "endLine": 871
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
        "text": "国外の提携先へ伸びる起動線が、画面の端から一本ずつ赤くなる。壁には主人公たちの戦闘映像。薬局の老人を運ぶ姿、橋で停まった搬送車、顔を伏せたままのいくらちゃん。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 876
      },
      {
        "kind": "dialogue",
        "speaker": "セガワ",
        "text": "区役所では、救援車を出す方が生存率は高かった。あなたたちは戻った",
        "portraitOwner": "segawa",
        "portraitKind": "major",
        "sourceLine": 877
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "安藤さんを乗せて、あの車は出した。見とったんなら、そこまで知っとるやろ",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 878
      },
      {
        "kind": "dialogue",
        "speaker": "セガワ",
        "text": "ええ。次も戻ると思いました。人数が増えたらどうするか、そこも確かめたかった",
        "portraitOwner": "segawa",
        "portraitKind": "major",
        "sourceLine": 879
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "主人公はセガワのいるガラス室を見ず、起動回線と原株の位置を仲間へ示す。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 880
      },
      {
        "kind": "dialogue",
        "speaker": "Mrs.チハ",
        "text": "{{PLAYER_NAME}}さん、先に回線を。話している間に、起動が進んでる",
        "portraitOwner": "unit-mrs-chiha",
        "portraitKind": "major",
        "sourceLine": 881
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "回線が先。原株も残せません。両方やります！",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 882
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が国外回線の前へ隊列を組み、原株への通路を確認する。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 883
      },
      {
        "kind": "battle-marker",
        "speaker": "◆ BATTLE",
        "text": "国外起動回線を止め、続いて感染源原株を破壊せよ。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 884
      }
    ],
    "source": {
      "startLine": 875,
      "endLine": 885
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
        "text": "世界地図から予定線が消え、原株が高熱槽へ落ちる。いくらちゃんは停止した回線を一つずつ確認する。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 888
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "国外への起動命令も、全部止めました。……もう撒かれている場所は、まだ分かりません。返事が来ないところもあって",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 889
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "ガラス室でセガワが物理鍵を回す。拘束具の外れる音が地下から響き、彼は非常通路へ消える。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 890
      },
      {
        "kind": "dialogue",
        "speaker": "セガワの声",
        "text": "西新へ戻らないんですか。最後の避難バスは、まだあそこにいますよ",
        "portraitOwner": null,
        "portraitKind": "offscreen",
        "sourceLine": 891
      },
      {
        "kind": "system",
        "speaker": "■ SYSTEM",
        "text": "T-03／最終強化形態／個体名：TAKUYA-Ω",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 892
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "画面に、投薬管と鎖で拘束されたTAKUYA。進路は西新の安全回廊。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 893
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "あいつ、避難バスの方へ行ってる！　{{PLAYER_NAME}}さん、戻らないと！",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 894
      },
      {
        "kind": "dialogue",
        "speaker": "セガワの声",
        "text": "あなたたちが作った道です。人はそこへ集まった。今度も、戻るのでしょう？",
        "portraitOwner": null,
        "portraitKind": "offscreen",
        "sourceLine": 895
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が車両の鍵を取り、崩れた研究区画を迂回して西新へ戻る。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 896
      }
    ],
    "source": {
      "startLine": 887,
      "endLine": 897
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
      "startLine": 887,
      "endLine": 897
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
        "text": "最初にTAKUYAを止めた防衛線。最後尾の避難バスは、ここから見えない待機路で立ち往生している。無線から、ザキミヤの妻が娘をあやす声。仮設照明の陰から巨体が現れる。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 902
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "頬の傷、後ろへ流した淡い髪、黒い防護眼鏡。縫合痕のある裸の胸を、かつての黒い拘束帯が斜めに走る。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 903
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "異様に肥大した片腕に縫合痕が走る。首から垂れた黒い鎖が揺れ、背の投薬管が脈打つ。剣とも槌ともつかない大刃が路面を削る。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 904
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "あの傷……タクヤさんだ。俺らが止めたのに。まだ、動かされてる……",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 905
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "主人公が装甲車両を防壁の切れ目へ寄せ、待機路への入口を塞ぐ。離れたゲート脇では、セガワが指揮車を降り、携帯発信器を掲げた。いくらちゃんが見えないバスの監視映像を車内の画面へ送る。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 906
      },
      {
        "kind": "dialogue",
        "speaker": "セガワ",
        "text": "停止",
        "portraitOwner": "segawa",
        "portraitKind": "major",
        "sourceLine": 907
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "巨体が止まる。セガワが発信器を主人公たちへ向ける。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 908
      },
      {
        "kind": "dialogue",
        "speaker": "セガワ",
        "text": "前方の部隊を除去",
        "portraitOwner": "segawa",
        "portraitKind": "major",
        "sourceLine": 909
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃんの声",
        "text": "バス、あと三台。まだ後ろに人がいます！",
        "portraitOwner": null,
        "portraitKind": "offscreen",
        "sourceLine": 910
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公がセガワを追わず、TAKUYA-Ωと待機路への入口の間へ立つ。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 911
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "制御音が高くなる。TAKUYA-Ωは主人公たちではなく、音の出る手へ向きを変えた。発信器が大刃の下で砕ける。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 912
      },
      {
        "kind": "dialogue",
        "speaker": "セガワ",
        "text": "停止。命令対象は、前だ",
        "portraitOwner": "segawa",
        "portraitKind": "major",
        "sourceLine": 913
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "RED PANTHERの隊員が撃つ。弾は装甲で火花を散らし、大刃が指揮車の前を薙ぐ。セガワはなお、壊れた発信器のボタンを押した。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 914
      },
      {
        "kind": "dialogue",
        "speaker": "セガワ",
        "text": "寄るな。私は、お前を――",
        "portraitOwner": "segawa",
        "portraitKind": "major",
        "sourceLine": 915
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "肥大した手がセガワをつかみ、指揮車へ叩きつける。握りしめていた発信器の欠片が路面へ落ちた。セガワは動かない。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 916
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "防壁の切れ目へ感染群が流れ込む。その奥でTAKUYA-Ωが待機路のバスへ向きを変え、ゆっくり歩き出す。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 917
      },
      {
        "kind": "dialogue",
        "speaker": "ザキミヤ",
        "text": "あのバスが抜けるまで、俺は退かん",
        "portraitOwner": "unit-zakimiya",
        "portraitKind": "major",
        "sourceLine": 918
      },
      {
        "kind": "dialogue",
        "speaker": "TKY",
        "text": "病院まで道は空いとる。ここさえ抜けたら帰れるんや。あいつ、こっちへ向けるで！",
        "portraitOwner": "unit-tky",
        "portraitKind": "major",
        "sourceLine": 919
      },
      {
        "kind": "dialogue",
        "speaker": "Mrs.チハ",
        "text": "背中の管が再生を支えてる。回り込める人、そこを狙って！",
        "portraitOwner": "unit-mrs-chiha",
        "portraitKind": "major",
        "sourceLine": 920
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "{{PLAYER_NAME}}、群れが先や。バスが抜けるまで、ここを空けるな",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 921
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "……もう、いいよ！　来いよ、TAKUYA！　あのバスには近づけさせねえ！　こっちに来い！",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 922
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が仲間の配置を確かめ、まず感染群の前へ出る。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 923
      },
      {
        "kind": "boss-marker",
        "speaker": "◆ BOSS",
        "text": "TAKUYA-Ω",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 924
      },
      {
        "kind": "battle-marker",
        "speaker": "◆ BATTLE",
        "text": "TAKUYA-Ωを倒し、避難バスと安全回廊を守れ。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 925
      }
    ],
    "source": {
      "startLine": 901,
      "endLine": 926
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
        "text": "巨体が防衛線の路面へ崩れる。誰もすぐには近づかない。いくらちゃんは測定器を二度見て、前へ出かけた足を止める。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 931,
        "sceneTag": "defeat"
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "再生反応、ゼロ。……もう一回、確認します。ゼロ。今度は止まってます",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 932,
        "sceneTag": "defeat"
      },
      {
        "kind": "dialogue",
        "speaker": "研究員の声",
        "text": "待って、まだ焼かないで！　背中の投薬管に、中和因子が残っています！",
        "portraitOwner": null,
        "portraitKind": "offscreen",
        "sourceLine": 933,
        "sceneTag": "defeat"
      },
      {
        "kind": "dialogue",
        "speaker": "Mrs.チハ",
        "text": "地下の隔離区画で使っていた成分？　人に使えるの？",
        "portraitOwner": "unit-mrs-chiha",
        "portraitKind": "major",
        "sourceLine": 934,
        "sceneTag": "defeat"
      },
      {
        "kind": "dialogue",
        "speaker": "研究員の声",
        "text": "まだ分かりません。これは強い。TAKUYA-Ωが、自分の強化組織に食い潰されないよう作っていたものです",
        "portraitOwner": null,
        "portraitKind": "offscreen",
        "sourceLine": 935,
        "sceneTag": "defeat"
      },
      {
        "kind": "dialogue",
        "speaker": "研究員の声",
        "text": "投薬管、血液、骨髄を採ってください。初期感染を止める材料になるかもしれない。病院で調べます",
        "portraitOwner": null,
        "portraitKind": "offscreen",
        "sourceLine": 936,
        "sceneTag": "defeat"
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が三種の試料を密閉し、回収を確認して残りの組織に火を入れる。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 937,
        "sceneTag": "defeat"
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "最後の避難バスが安全回廊へ入る。いくらちゃんの地図から、大型反応が消えた。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 940,
        "sceneTag": "cleared"
      },
      {
        "kind": "dialogue",
        "speaker": "ザキミヤ",
        "text": "……帰ろう。今度は、帰る場所がある。妻と娘が待っとる",
        "portraitOwner": "unit-zakimiya",
        "portraitKind": "major",
        "sourceLine": 941,
        "sceneTag": "cleared"
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が通行止めの標識を外し、西新側へ倒す。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 942,
        "sceneTag": "cleared"
      }
    ],
    "source": {
      "startLine": 928,
      "endLine": 943
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
      "startLine": 928,
      "endLine": 943
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
        "text": "焼けた防衛線の路面に朝日が差す。試料を運ぶ車が病院へ先行する。武蔵は二刀を差し、別の道の前で立ち止まる。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 948,
        "sceneTag": "dawn"
      },
      {
        "kind": "dialogue",
        "speaker": "宮本武蔵",
        "text": "我が行くのは、こちららしい",
        "portraitOwner": "unit-miyamoto-musashi",
        "portraitKind": "major",
        "sourceLine": 949,
        "sceneTag": "dawn"
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が歩み寄る。武蔵は礼をして、煙の向こうへ進む。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 950,
        "sceneTag": "dawn"
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "搬送車が一台横切る。通過後、そこに武蔵の姿はない。主人公はしばらく道を見てから病院へ向く。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 951,
        "sceneTag": "dawn"
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "数日後。医師と研究員が、採取した中和因子を別々の検査器で確かめる。初期感染者の同意を得て、少量を投与する。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 954,
        "sceneTag": "hospital"
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "一時間、六時間、二十四時間。腕の変色は広がらない。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 955,
        "sceneTag": "hospital"
      },
      {
        "kind": "dialogue",
        "speaker": "女性駅員",
        "text": "また悪くなることは……ないんですか",
        "portraitOwner": "minor-human-shared-event-silhouette",
        "portraitKind": "minor",
        "sourceLine": 956,
        "sceneTag": "hospital"
      },
      {
        "kind": "dialogue",
        "speaker": "医師",
        "text": "今は止まっています。前の処置は、進行を遅らせるだけでした。今回は二十四時間、広がっていません。ただ、この先も悪くならないとは、まだ言えません",
        "portraitOwner": "minor-human-shared-event-silhouette",
        "portraitKind": "minor",
        "sourceLine": 957,
        "sceneTag": "hospital"
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "そうか。……明日も、ここで診てもらえるんやね",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 958,
        "sceneTag": "hospital"
      },
      {
        "kind": "dialogue",
        "speaker": "医師",
        "text": "ええ。明日も調べます。一緒に、様子を見ていきましょう",
        "portraitOwner": "minor-human-shared-event-silhouette",
        "portraitKind": "minor",
        "sourceLine": 959,
        "sceneTag": "hospital"
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "連絡室では、いくらちゃんが西新の外へ呼びかける。返事のない回線にも時刻を記録し、翌日また呼ぶ。区役所で拾ったラジオは、今も机の端にある。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 962,
        "sceneTag": "signal"
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "くまやの裏口。ババヤガとMrs.チハが、別々の武器を同じ机で整備している。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 965,
        "sceneTag": "kumaya"
      },
      {
        "kind": "dialogue",
        "speaker": "ババヤガ",
        "text": "あの時、あとで全部聞くって言うたやろ。……聞かせて",
        "portraitOwner": "unit-babayaga",
        "portraitKind": "major",
        "sourceLine": 966,
        "sceneTag": "kumaya"
      },
      {
        "kind": "dialogue",
        "speaker": "Mrs.チハ",
        "text": "長いよ。一晩じゃ、終わらないと思う",
        "portraitOwner": "unit-mrs-chiha",
        "portraitKind": "major",
        "sourceLine": 967,
        "sceneTag": "kumaya"
      },
      {
        "kind": "dialogue",
        "speaker": "ババヤガ",
        "text": "明日もおる。俺の話も、聞いてくれ",
        "portraitOwner": "unit-babayaga",
        "portraitKind": "major",
        "sourceLine": 968,
        "sceneTag": "kumaya"
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "Mrs.チハが頷く。二人は手を動かし続ける。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 969,
        "sceneTag": "kumaya"
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "{{PLAYER_NAME}}、明日はくまやのガスを見に来てくれ。暖簾も掛け直す",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 970,
        "sceneTag": "kumaya"
      }
    ],
    "source": {
      "startLine": 945,
      "endLine": 971
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
        "sourceLine": 976
      },
      {
        "kind": "montage",
        "speaker": null,
        "sceneLabel": "早良区役所",
        "text": "紙の名簿へ帰還者の名前が書き足される。空欄も消さない。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 977
      },
      {
        "kind": "montage",
        "speaker": null,
        "sceneLabel": "西新駅",
        "text": "列車は止まったまま。改札の灯りだけが、人の歩く道を照らす。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 978
      },
      {
        "kind": "montage",
        "speaker": null,
        "sceneLabel": "大学病院",
        "text": "試作血清が少量だけ冷蔵庫へ入る。翌日の検査予定が隣に貼られる。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 979
      },
      {
        "kind": "montage",
        "speaker": null,
        "sceneLabel": "河口防潮門",
        "text": "クレイジーキングの台車から交代の見張りへ缶詰が届く。門は閉じたまま。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 980
      },
      {
        "kind": "montage",
        "speaker": null,
        "sceneLabel": "ムガリアン施設",
        "text": "企業標章を覆い、救出した技術者が医療設備を再起動する。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 981
      },
      {
        "kind": "montage",
        "speaker": null,
        "sceneLabel": "RED PANTHER装備庫",
        "text": "赤いレンズと焼けた認証カードが、それぞれ証拠袋へ入る。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 982
      },
      {
        "kind": "montage",
        "speaker": null,
        "sceneLabel": "ザキミヤ",
        "text": "手を洗い、妻から娘を受け取る。腰の瓶の代わりにおむつを持つ。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 983
      },
      {
        "kind": "montage",
        "speaker": null,
        "sceneLabel": "装甲車両",
        "text": "色の違う新しい装甲板が付く。車内の地図には街の外へ一本の線。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 984
      },
      {
        "kind": "montage",
        "speaker": null,
        "sceneLabel": "TAKUYA撃破地点",
        "text": "撤去した標識の跡に、見張りの当番表が立つ。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 985
      },
      {
        "kind": "montage",
        "speaker": null,
        "sceneLabel": "くまや",
        "text": "{{PLAYER_NAME}}とクマバーソンが厨房のガス栓を開く。青い火が点く。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 986
      }
    ],
    "source": {
      "startLine": 973,
      "endLine": 987
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
        "sourceLine": 990
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "主人公が暖簾をくぐる。パイセンが席の荷物を急いでどける。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 991
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "あ、{{PLAYER_NAME}}さん！　こっちっす。荷物、すぐどけるんで！",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 992
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "そこ、空けとけって言うたやろ",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 993
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "席はちゃんと取ってたっすよ。荷物も、そのためで",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 994
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "はいはい。ほら、この皿持ってって",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 995
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が席に着く。マヨちゃんが足元を一周して伏せる。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 996
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "ザキミヤの妻が娘を寝かせる。ザキミヤが店の奥へ顔を向ける。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 997
      },
      {
        "kind": "dialogue",
        "speaker": "ザキミヤ",
        "text": "おーい、寝たぞ。ちょっと静かにしてやってくれ",
        "portraitOwner": "unit-zakimiya",
        "portraitKind": "major",
        "sourceLine": 998
      },
      {
        "kind": "dialogue",
        "speaker": "ザキミヤの妻",
        "text": "一番声が大きいの、あんたよ",
        "portraitOwner": "minor-human-shared-event-silhouette",
        "portraitKind": "minor",
        "sourceLine": 999
      },
      {
        "kind": "dialogue",
        "speaker": "ザキミヤ",
        "text": "……すまん",
        "portraitOwner": "unit-zakimiya",
        "portraitKind": "major",
        "sourceLine": 1000
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "ババヤガが牛乳を持って入る。Mrs.チハは受け取り、冷蔵庫を指す。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 1001
      },
      {
        "kind": "dialogue",
        "speaker": "Mrs.チハ",
        "text": "今度は忘れなかったね",
        "portraitOwner": "unit-mrs-chiha",
        "portraitKind": "major",
        "sourceLine": 1002
      },
      {
        "kind": "dialogue",
        "speaker": "ババヤガ",
        "text": "だいぶ待たせたな",
        "portraitOwner": "unit-babayaga",
        "portraitKind": "major",
        "sourceLine": 1003
      },
      {
        "kind": "dialogue",
        "speaker": "Mrs.チハ",
        "text": "残りの話も、忘れないで",
        "portraitOwner": "unit-mrs-chiha",
        "portraitKind": "major",
        "sourceLine": 1004
      },
      {
        "kind": "dialogue",
        "speaker": "ババヤガ",
        "text": "忘れん。あとで、座って話そう",
        "portraitOwner": "unit-babayaga",
        "portraitKind": "major",
        "sourceLine": 1005
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "いくらちゃんの無線は静かだ。壁の地図には、西新の外へ伸びる未確認の道が一本。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 1006
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "パイセンさん、もうちょっと詰めて。私も座りたいんですけど",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 1007
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "あ、どうぞ。……そこ、俺の皿っすよ",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 1008
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "分かってます。唐揚げ、ずいぶん守りが堅いですね",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 1009
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "{{PLAYER_NAME}}、何食う？",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 1010
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が唐揚げを指す。クマバーソンは頷き、油の温度を確かめる。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 1011
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "俺も一皿、追加で。……いくらちゃん、俺の方を見ないでください",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 1012
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "いくらちゃんの分も揚げるけん。その皿はパイセンの。もうちょい待っとって",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 1013
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "じゃ、私のはちょっと多めでお願いします",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 1014
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "主人公の前へ烏龍茶が置かれる。外に停めた装甲車両は、今夜は動かない。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 1015
      },
      {
        "kind": "title",
        "speaker": null,
        "text": "西新世紀末物語",
        "portraitOwner": null,
        "portraitKind": "title",
        "sourceLine": 1016
      }
    ],
    "source": {
      "startLine": 989,
      "endLine": 1019
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
