// Generated from the Version 1.0.0 Producer rewrite. Do not hand-edit.
import { V100_EVENT_IDS, V100_EVENT_BY_ID, renderV100PlayerName } from "./v100Registry.js";

export const V100_STORY_SOURCE_SHA256 = "3067731d970ba4725e5cd999e86886d0d277c4a3a30f49eea45c533d4127764d";
export const V100_STORY_SOURCE_LINE_COUNT = 984;
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
        "sourceLine": 9,
        "sceneTag": "daily"
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "クマバーソンは唐揚げを二つ皿へ移す。足元のマヨちゃんは、落ちてこない三つ目を見上げている。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 10,
        "sceneTag": "daily"
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "配達帰りのハチが橙色の雨具を畳む。靴には、商店街の工事現場の泥。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 11,
        "sceneTag": "daily"
      },
      {
        "kind": "dialogue",
        "speaker": "ハチ",
        "text": "裏道、また塞がれてました。帰りは表を通った方がいい",
        "portraitOwner": "unit-hachi",
        "portraitKind": "major",
        "sourceLine": 12,
        "sceneTag": "daily"
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "{{PLAYER_NAME}}さん、席ならあります。唐揚げの方は……すいません、俺が一個",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 13,
        "sceneTag": "daily"
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "あとの二個、分けるしかなかね。正直に言うたけん、皿は洗って",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 14,
        "sceneTag": "daily"
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "パイセンが空の小皿を伏せる。ババヤガの端末が震え、彼は画面を一度だけ見た。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 15,
        "sceneTag": "daily"
      },
      {
        "kind": "dialogue",
        "speaker": "ババヤガ",
        "text": "妻から『牛乳』",
        "portraitOwner": "unit-babayaga",
        "portraitKind": "major",
        "sourceLine": 16,
        "sceneTag": "daily"
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "それだけ？",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 17,
        "sceneTag": "daily"
      },
      {
        "kind": "dialogue",
        "speaker": "ババヤガ",
        "text": "十分や。買い忘れたら、俺のせいってことやろ",
        "portraitOwner": "unit-babayaga",
        "portraitKind": "major",
        "sourceLine": 18,
        "sceneTag": "daily"
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "分かっとるなら、忘れんなよ",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 19,
        "sceneTag": "daily"
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が車の鍵を置き、烏龍茶のグラスを受け取る。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 20,
        "sceneTag": "daily"
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "壁のテレビにムガリアン製薬の広告。市の防災物資、病院設備、商店街の薬局が順に映る。客の誰も見ていない。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 21,
        "sceneTag": "daily"
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "店中の端末が同時に鳴る。「早良区内で複数の傷害事件」。テレビの広告も緊急速報に切り替わった。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 24,
        "sceneTag": "crisis"
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "工事の事故……じゃないっすよね",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 25,
        "sceneTag": "crisis"
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "引き戸に血のついた手。通りの奥から、靴を引きずる音が二つ近づく。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 26,
        "sceneTag": "crisis"
      },
      {
        "kind": "dialogue",
        "speaker": "男の声",
        "text": "頼む、開けてくれ！",
        "portraitOwner": null,
        "portraitKind": "offscreen",
        "sourceLine": 27,
        "sceneTag": "crisis"
      },
      {
        "kind": "dialogue",
        "speaker": "ババヤガ",
        "text": "声は一人。後ろは二人",
        "portraitOwner": "unit-babayaga",
        "portraitKind": "major",
        "sourceLine": 28,
        "sceneTag": "crisis"
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が戸を細く開け、男を引き入れる。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 29,
        "sceneTag": "crisis"
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "男の腕には歯形がある。クマバーソンが布巾を当てる。男は水を求めて口を開くが、声にならない。掴んでいた布巾から、指が一本ずつ離れた。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 30,
        "sceneTag": "crisis"
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "名前、言える？",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 31,
        "sceneTag": "crisis"
      },
      {
        "kind": "dialogue",
        "speaker": "男",
        "text": "……たす、け……",
        "portraitOwner": "minor-human-shared-event-silhouette",
        "portraitKind": "minor",
        "sourceLine": 32,
        "sceneTag": "crisis"
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "言い終える前に呼吸が止まる。クマバーソンが脈を探した瞬間、男が跳ね起き、主人公へ噛みつく。椅子の脚が顎を受け止めた。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 33,
        "sceneTag": "crisis"
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が椅子を押し返し、客の退路を空ける。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 34,
        "sceneTag": "crisis"
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "パイセン、客を裏へ。マヨちゃんも！",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 35,
        "sceneTag": "crisis"
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "立てる人から裏へ！　俺が最後に出ます！",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 36,
        "sceneTag": "crisis"
      },
      {
        "kind": "dialogue",
        "speaker": "ハチ",
        "text": "裏路地を見ます。曲がり角で待っててください",
        "portraitOwner": "unit-hachi",
        "portraitKind": "major",
        "sourceLine": 37,
        "sceneTag": "crisis"
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "ババヤガの消火器が白く噴く。クマバーソンがフライパンで男を押さえ、最後の客とともに退く。パイセンが外から勝手口を閉めた。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 38,
        "sceneTag": "crisis"
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "クマバーソンが、消毒薬を取りに出たタクヤへ電話する。呼び出し音が三度鳴って切れた。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 39,
        "sceneTag": "crisis"
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "裏路地へ出たところで、くまやの暖簾が片方だけ落ちる。クマバーソンは手を伸ばしかけ、客を支えるパイセンを見て引っ込めた。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 41,
        "sceneTag": "escape"
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "暖簾はあとでよか。走れ！",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 42,
        "sceneTag": "escape"
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "発生から三日目。災害対策倉庫に放置された装甲車両。荷室には毛布、燃料計にはまだ半分。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 43,
        "sceneTag": "escape"
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "これ、誰が運転するんすか。俺なら塀まで三秒っす",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 44,
        "sceneTag": "escape"
      },
      {
        "kind": "dialogue",
        "speaker": "ハチ",
        "text": "外に鍵はない。整備箱を探します",
        "portraitOwner": "unit-hachi",
        "portraitKind": "major",
        "sourceLine": 45,
        "sceneTag": "escape"
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "ババヤガは始動盤の配線に手を伸ばすが、主人公が非常始動キーを見つける方が早い。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 46,
        "sceneTag": "escape"
      },
      {
        "kind": "dialogue",
        "speaker": "ババヤガ",
        "text": "危うく、切らんでいい線まで切るとこやった",
        "portraitOwner": "unit-babayaga",
        "portraitKind": "major",
        "sourceLine": 47,
        "sceneTag": "escape"
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公がキーを差し、全員を乗せて倉庫を出る。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 48,
        "sceneTag": "escape"
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "発生から四十三日目。装甲車両の側面には、避難所を渡り歩く間についた傷が重なる。西新へ入る道だけが、地図の上でまだ途切れている。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 51,
        "sceneTag": "radio"
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "一行は外周で生存者を拾いながら帰る道を探してきた。外へ送った無線には、二週間、返事がない。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 52,
        "sceneTag": "radio"
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "四十三日。店の唐揚げ、さすがに残ってないっすよね",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 53,
        "sceneTag": "radio"
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "店が残っとるかどうかも分からん。人がおるなら、そっちからや",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 54,
        "sceneTag": "radio"
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "ババヤガは圏外のままの妻の連絡先を伏せる。ハチが商店街からの細い救難信号を拾った。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 55,
        "sceneTag": "radio"
      },
      {
        "kind": "dialogue",
        "speaker": "ハチ",
        "text": "薬局の二階。まだ誰かが呼んでます",
        "portraitOwner": "unit-hachi",
        "portraitKind": "major",
        "sourceLine": 56,
        "sceneTag": "radio"
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が薬局へ進入線を引き、装甲車両を発進させる。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 57,
        "sceneTag": "radio"
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "そっちを通れば、くまやにも帰れるんすね",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 58,
        "sceneTag": "radio"
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "帰りは空席なしで帰る。それだけや",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 59,
        "sceneTag": "radio"
      },
      {
        "kind": "system",
        "speaker": "■ SYSTEM",
        "text": "西新商店街の薬局へ向かう。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 60,
        "sceneTag": "radio"
      }
    ],
    "source": {
      "startLine": 6,
      "endLine": 61
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
        "sourceLine": 66
      },
      {
        "kind": "dialogue",
        "speaker": "女の声",
        "text": "そこの装甲車！　聞こえたらライト、一回！",
        "portraitOwner": null,
        "portraitKind": "offscreen",
        "sourceLine": 67
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公がライトを点滅させる。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 68
      },
      {
        "kind": "dialogue",
        "speaker": "女の声",
        "text": "五人です。一人、階段を降りられません。……全員、乗れますか",
        "portraitOwner": null,
        "portraitKind": "offscreen",
        "sourceLine": 69
      },
      {
        "kind": "dialogue",
        "speaker": "ババヤガ",
        "text": "乗せる。下の棚は燃やした方が早い",
        "portraitOwner": "unit-babayaga",
        "portraitKind": "major",
        "sourceLine": 70
      },
      {
        "kind": "dialogue",
        "speaker": "女の声",
        "text": "薬局ごと？　さっきのライトの人と代わってください",
        "portraitOwner": null,
        "portraitKind": "offscreen",
        "sourceLine": 71
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "焼かん。裏階段まで道をつくる。窓から離れとって",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 72
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "パイセンが鉄パイプを車内へ放り、両手を空ける。二階の窓では、誰かが老人の身体を支えている。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 73
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "俺が上がります！　{{PLAYER_NAME}}さん、車を裏階段へ。降りてきた人、頼みます！",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 74
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が車両を裏階段の前へ寄せ、救出路を示す。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 75
      },
      {
        "kind": "battle-marker",
        "speaker": "◆ BATTLE",
        "text": "感染拠点を破壊し、裏階段を確保せよ。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 76
      }
    ],
    "source": {
      "startLine": 65,
      "endLine": 77
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
        "sourceLine": 80
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "赤銅色の編み髪の女性が老人の脈を取り直す。救急バッグの包帯は、階段でほかの人の手当に使い切っていた。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 81
      },
      {
        "kind": "dialogue",
        "speaker": "ナオ",
        "text": "ナオです。おじいちゃんを車で横に。私が隣に乗ります",
        "portraitOwner": "unit-nao",
        "portraitKind": "major",
        "sourceLine": 82
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "まだ運べるもん、あります？",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 83
      },
      {
        "kind": "dialogue",
        "speaker": "ナオ",
        "text": "ある。あの人の靴、片方。歩けるようになった時に要るから",
        "portraitOwner": "unit-nao",
        "portraitKind": "major",
        "sourceLine": 84
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "いくらです。ライトが見えて、『来た』って叫びました。……間違ってなくてよかった",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 85
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "いくらちゃんは老人へ水を渡し、薬品箱の市のラベルをめくる。その下に「MUGARIAN」の印字。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 86
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "市の救援箱なのに、下にムガリアンの番号がある",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 87
      },
      {
        "kind": "dialogue",
        "speaker": "ババヤガ",
        "text": "上から貼っただけやな",
        "portraitOwner": "unit-babayaga",
        "portraitKind": "major",
        "sourceLine": 88
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "誰が手配したのか、調べます",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 89
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "区役所からの無線が途切れ途切れに入る。「最後の一台。まだ出せない」。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 90
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公がいくらちゃんのアンテナを車両へ積み、空いた座席を示す。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 91
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "乗っていいんですか。じゃあ、区役所の途切れた声、私が拾います",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 92
      },
      {
        "kind": "system",
        "speaker": "■ SYSTEM",
        "text": "救護のナオが配備登録候補になった。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 93
      },
      {
        "kind": "system",
        "speaker": "■ SYSTEM",
        "text": "いくらちゃんが通信支援に加わる。次は早良区役所。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 94
      }
    ],
    "source": {
      "startLine": 79,
      "endLine": 95
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
      "startLine": 79,
      "endLine": 95
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
        "sourceLine": 100
      },
      {
        "kind": "dialogue",
        "speaker": "避難所職員",
        "text": "もう出せます。安藤さんを待つなら、車内の人ごと感染群の前に残ることになります",
        "portraitOwner": "minor-human-shared-event-silhouette",
        "portraitKind": "minor",
        "sourceLine": 101
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "後部座席で毛布を握る子どもが、開いた扉越しにパイセンを見る。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 102
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "俺が迎えに行きます。扉、閉めて待っててください。必ず戻るんで",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 103
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が装甲車両を救援車の前へ寄せ、パイセンへ車椅子を渡す。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 104
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "こっちは出口を守る。安藤さんから離れるなよ",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 105
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "了解。安藤さんを乗せたら、俺も飛び乗ります",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 106
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "角を曲がった感染者の列が、車両のライトへ一斉に向く。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 107
      },
      {
        "kind": "battle-marker",
        "speaker": "◆ BATTLE",
        "text": "救援車と救出経路を守れ。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 108
      }
    ],
    "source": {
      "startLine": 99,
      "endLine": 109
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
        "sourceLine": 112
      },
      {
        "kind": "dialogue",
        "speaker": "安藤",
        "text": "駅員室で三人、生きとる。昨夜これで話した",
        "portraitOwner": "minor-human-shared-event-silhouette",
        "portraitKind": "minor",
        "sourceLine": 113
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "いくらちゃん、ラジオ！　安藤さんは俺が運ぶ。運転手さん、乗ったら出して！",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 114
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "安藤がラジオを渡す。パイセンと運転手が彼を空席へ座らせ、車椅子を畳んで積む。屋根の射手も降りた。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 115
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "救援車が出る。パイセンは手袋を外し、震える指を一度だけ握り直す。いくらちゃんが黙ってラジオの周波数を合わせた。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 116
      },
      {
        "kind": "dialogue",
        "speaker": "ミズチ",
        "text": "ミズチ。救援車の退路は確保した。駅へ行くなら、防衛線までの道は開けておく",
        "portraitOwner": "unit-mizuchi",
        "portraitKind": "major",
        "sourceLine": 117
      },
      {
        "kind": "dialogue",
        "speaker": "ババヤガ",
        "text": "残弾は",
        "portraitOwner": "unit-babayaga",
        "portraitKind": "major",
        "sourceLine": 118
      },
      {
        "kind": "dialogue",
        "speaker": "ミズチ",
        "text": "七発。駅までなら足りる",
        "portraitOwner": "unit-mizuchi",
        "portraitKind": "major",
        "sourceLine": 119
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "壁の避難図。商店街から駅、病院、湾岸まで、発生前の日付で「都市対応実証 B-02」と区切られている。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 122,
        "sceneTag": "evidence"
      },
      {
        "kind": "dialogue",
        "speaker": "ババヤガ",
        "text": "事故のあとに書いた線じゃない",
        "portraitOwner": "unit-babayaga",
        "portraitKind": "major",
        "sourceLine": 123,
        "sceneTag": "evidence"
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が避難図を撮り、駅員室へ向かう道を地図に記す。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 124,
        "sceneTag": "evidence"
      },
      {
        "kind": "system",
        "speaker": "■ SYSTEM",
        "text": "射撃のミズチが配備登録候補になった。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 125,
        "sceneTag": "evidence"
      },
      {
        "kind": "system",
        "speaker": "■ SYSTEM",
        "text": "駅員室の生存者へ向かう。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 126,
        "sceneTag": "evidence"
      }
    ],
    "source": {
      "startLine": 111,
      "endLine": 127
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
      "startLine": 111,
      "endLine": 127
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
        "sourceLine": 132
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "……タクヤさん？",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 133
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "返事はない。TAKUYAが刃を振ると、柵の留め具が一列に飛んだ。パイセンの足元へ鉄板が滑る。巨体は柵を越えず、暗がりへ引いた。刃を引きずる音だけが群れの後ろを移っていく。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 134
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公がパイセンの襟をつかんで引き戻す。鉄板は二人のいた場所を抜け、装甲車両の車輪に当たった。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 135
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "発生の日、薬を頼んだのは俺や。戻るまで待てんかった",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 136
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "裏口を閉めたの、俺っす。……今、目ぇ逸らしたら、また同じになる",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 137
      },
      {
        "kind": "dialogue",
        "speaker": "ババヤガ",
        "text": "パイセン、前を見ろ。群れが柵を越えた",
        "portraitOwner": "unit-babayaga",
        "portraitKind": "major",
        "sourceLine": 138
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "見えてる。右から来る！",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 139
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が装甲車両を横に寄せ、左右の進入路へ仲間を割り振る。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 140
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "パイセンは扉を閉め、クマバーソンの横へ走る。後ろでは駅へ向かう避難者が、まだ防壁を通り抜けていた。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 141
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "先に人を通せ！　タクヤさんが出てきたら、俺が知らせる！",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 142
      },
      {
        "kind": "boss-marker",
        "speaker": "◆ BOSS",
        "text": "TAKUYA",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 143
      },
      {
        "kind": "battle-marker",
        "speaker": "◆ BATTLE",
        "text": "感染群を退け、TAKUYAを止めよ。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 144
      }
    ],
    "source": {
      "startLine": 131,
      "endLine": 145
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
        "sourceLine": 148
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "タクヤ、もう運ばんでええ。……遅うなって、すまん",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 149
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "パイセンは刃を見ないようにして、外れた鎖を端へ寄せる。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 150
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "駅の人が待ってます。……行きましょう",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 151
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "信号は生きてます。細いけど、切れてない",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 152
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が防壁の残骸に牽引線を掛け、駅へ通る道を開く。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 153
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "装甲車両が去ったあと、赤いレンズの防護服が防衛線へ入る。銃口を下げたまま、迷いなくTAKUYAへ向かう。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 156,
        "sceneTag": "retrieval"
      },
      {
        "kind": "dialogue",
        "speaker": "赤レンズの隊長",
        "text": "T-03、回収。記録は残すな",
        "portraitOwner": "red-panther-commander",
        "portraitKind": "major",
        "sourceLine": 157,
        "sceneTag": "retrieval"
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "隊員がTAKUYAの遺体を黒い袋へ収め、クマバーソンの外した鎖も拾い上げる。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 158,
        "sceneTag": "retrieval"
      }
    ],
    "source": {
      "startLine": 147,
      "endLine": 159
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
      "startLine": 147,
      "endLine": 159
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
        "sourceLine": 164
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "自動じゃない。誰かが、かけ直してます",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 165
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "下りたら、空が見えなくなるんすよね",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 166
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が隙間から入り、内側のシャッターを押し上げる。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 167
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "受話器から、咳に混じって駅員の声。駅員室に三人、ホームの保守室に二人。一人は噛まれている。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 168
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "五人。帰りの人数も、数えといてください",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 169
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "俺がシャッターを押さえる。お前は声の方へ行け",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 170
      },
      {
        "kind": "battle-marker",
        "speaker": "◆ BATTLE",
        "text": "閉鎖改札の感染拠点を破壊し、駅員室へ進め。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 171
      }
    ],
    "source": {
      "startLine": 163,
      "endLine": 172
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
        "sourceLine": 175
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "一緒に出る。順番を決めるために置いてきたわけじゃなか",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 176
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "パイセンが反対側から肩を貸す。女性は、彼の震える手に体重を預けすぎないよう歩く。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 177
      },
      {
        "kind": "dialogue",
        "speaker": "駅員",
        "text": "黒い防護服が、ホームへ冷蔵ケースを置いていきました。レンズが赤くて",
        "portraitOwner": "minor-human-shared-event-silhouette",
        "portraitKind": "minor",
        "sourceLine": 178
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "主人公が赤いレンズの証言を記録する。駅員は、奥の保守扉を指した。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 179
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "駅員室の配線盤裏の点検口から、罠装置を腰に下げた男が這い出す。非常電話を鳴らし続けたのは彼だった。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 180
      },
      {
        "kind": "dialogue",
        "speaker": "モンキー",
        "text": "電話、聞こえたろ。回線をつないだのは俺。シャッターも開けられる。ただし、音でこっちも見つかる",
        "portraitOwner": "unit-monkey",
        "portraitKind": "major",
        "sourceLine": 181
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が駅員室の退路を指し、開閉の合図をモンキーへ預ける。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 182
      },
      {
        "kind": "dialogue",
        "speaker": "モンキー",
        "text": "先に逃がすのか。その順なら回路を組める。合図は一回で頼む",
        "portraitOwner": "unit-monkey",
        "portraitKind": "major",
        "sourceLine": 183
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が駅員を車両へ送り、ホームへの保守扉を開ける。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 184
      },
      {
        "kind": "system",
        "speaker": "■ SYSTEM",
        "text": "工兵のモンキーが配備登録候補になった。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 185
      },
      {
        "kind": "system",
        "speaker": "■ SYSTEM",
        "text": "ホームの二人と冷蔵ケースを確認する。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 186
      }
    ],
    "source": {
      "startLine": 174,
      "endLine": 187
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
      "startLine": 174,
      "endLine": 187
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
        "sourceLine": 192
      },
      {
        "kind": "dialogue",
        "speaker": "保守員の声",
        "text": "二人います！　扉が曲がって、内側から押しても開きません！",
        "portraitOwner": null,
        "portraitKind": "offscreen",
        "sourceLine": 193
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "手前にあれだけいるのに、奥でも何か待ってるんすか",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 194
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "改札の奥で電子音が一度鳴る。金属を引きずる音が止まる。やがて、反対側の暗がりを回るように、ゆっくり遠ざかった。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 195
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "放送設備、まだ使える。手前の群れだけでも反対側へ振ります",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 196
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "何を流す",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 197
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "はっきり鳴るもの。短い音なら、繰り返せます",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 198
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "クマバーソンがフライパンを叩く。いくらちゃんがその一打を録り、反対ホームのスピーカーで繰り返した。群れの先頭が向きを変える。奥の大きな影は、まだ動かない。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 199
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "帰ったら、これは洗ってから使おうな",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 200
      },
      {
        "kind": "dialogue",
        "speaker": "保守員の声",
        "text": "扉が、もう！",
        "portraitOwner": null,
        "portraitKind": "offscreen",
        "sourceLine": 201
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が仲間を保守室側へ展開し、放送の切り替えをいくらちゃんに任せる。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 202
      },
      {
        "kind": "boss-marker",
        "speaker": "◆ BOSS",
        "text": "改札喰い",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 203
      },
      {
        "kind": "battle-marker",
        "speaker": "◆ BATTLE",
        "text": "感染群を退け、改札喰いを倒して保守室の二人を救え。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 204
      }
    ],
    "source": {
      "startLine": 191,
      "endLine": 205
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
        "sourceLine": 208
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "一人が、曲がったチェーンソーを床へ置く。扉の内側には浅い切り傷が一筋。刃を止めた彼は、保守員を背に、外から押される扉を支え続けていた。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 209
      },
      {
        "kind": "dialogue",
        "speaker": "クレイジーキング",
        "text": "王の剣、封印。民は無事か",
        "portraitOwner": "unit-crazy-king",
        "portraitKind": "major",
        "sourceLine": 210
      },
      {
        "kind": "dialogue",
        "speaker": "保守員",
        "text": "自分の前に立ってくれてました。ずっと",
        "portraitOwner": "minor-human-shared-event-silhouette",
        "portraitKind": "minor",
        "sourceLine": 211
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "二人で出てきたなら、それで勝ちや",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 212
      },
      {
        "kind": "dialogue",
        "speaker": "クレイジーキング",
        "text": "……なら、余の勝ちだ",
        "portraitOwner": "unit-crazy-king",
        "portraitKind": "major",
        "sourceLine": 213
      },
      {
        "kind": "dialogue",
        "speaker": "保守員",
        "text": "これ、病院へ。置いていった人たちは、中身を半分持っていった",
        "portraitOwner": "minor-human-shared-event-silhouette",
        "portraitKind": "minor",
        "sourceLine": 214
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "冷蔵ケースには「感染初期処置用」。薬局と同じムガリアンの管理番号。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 215
      },
      {
        "kind": "dialogue",
        "speaker": "ババヤガ",
        "text": "半分を抜いて、残りをここへ。誰が使うか見とったんやろな",
        "portraitOwner": "unit-babayaga",
        "portraitKind": "major",
        "sourceLine": 216
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "誰に",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 217
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "配送先は大学病院の地下搬入口。線路沿いの保守扉から抜けられます",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 218
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公がケースを背負い、病院へ続く保守扉を開ける。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 219
      },
      {
        "kind": "system",
        "speaker": "■ SYSTEM",
        "text": "前衛のクレイジーキングが配備登録候補になった。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 220
      },
      {
        "kind": "system",
        "speaker": "■ SYSTEM",
        "text": "病院へ向かう保守トンネルを進む。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 221
      }
    ],
    "source": {
      "startLine": 207,
      "endLine": 222
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
      "startLine": 207,
      "endLine": 222
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
        "sourceLine": 227
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "病院側へ行ってます。この足跡、一列で迷ってない",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 228
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "中継器が一瞬だけ電波を戻し、発生二日目に送られた未着信メッセージがババヤガの端末へ届く。差出人はMrs.チハ。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 229
      },
      {
        "kind": "dialogue",
        "speaker": "Mrs.チハのメッセージ",
        "text": "無事。湾岸へ移る。連絡はしないで",
        "portraitOwner": null,
        "portraitKind": "offscreen",
        "sourceLine": 230
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "奥さん、ですか",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 231
      },
      {
        "kind": "dialogue",
        "speaker": "ババヤガ",
        "text": "四十日前か。……牛乳はもう買えんな",
        "portraitOwner": "unit-babayaga",
        "portraitKind": "major",
        "sourceLine": 232
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "会えたら、何を買うか本人に聞け",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 233
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "奥の隔壁が開いたまま、感染群が病院側へ押し寄せる。手前には輪止めを噛ませた保守台車。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 234
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "冷蔵ケースを台車に。あの隔壁まで運べたら、追ってくる奴らを閉め出せます！",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 235
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公がケースを台車に固定し、輪止めを外して発進させる。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 236
      },
      {
        "kind": "battle-marker",
        "speaker": "◆ BATTLE",
        "text": "保守台車を病院側の隔壁まで護衛し、感染群の流入を止めよ。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 237
      }
    ],
    "source": {
      "startLine": 226,
      "endLine": 238
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
        "sourceLine": 241
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "病院側の踊り場で、軽機関銃を構えた射手が最後の流入路を押さえている。銃身は熱く、弾帯はもう短い。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 242
      },
      {
        "kind": "dialogue",
        "speaker": "レイダー",
        "text": "レイダー。病院へ人を通すなら、私の後ろを走って。止まったら撃てない",
        "portraitOwner": "unit-raider",
        "portraitKind": "major",
        "sourceLine": 243
      },
      {
        "kind": "dialogue",
        "speaker": "ミズチ",
        "text": "その弾数で、何分持つ",
        "portraitOwner": "unit-mizuchi",
        "portraitKind": "major",
        "sourceLine": 244
      },
      {
        "kind": "dialogue",
        "speaker": "レイダー",
        "text": "何分も要らない。向こうにある弾を取りに行く",
        "portraitOwner": "unit-raider",
        "portraitKind": "major",
        "sourceLine": 245
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "ババヤガは返信欄に「牛乳」と打ち、圏外表示を見て消す。端末はしまわず、胸ポケットへ入れた。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 246
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "冷えるぞ。歩きながら探そう",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 247
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "病院側の非常回線が開く。救急搬入口で薬と人手が足りない。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 248
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が冷蔵ケースを持ち直し、病院の扉へ走る。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 249
      },
      {
        "kind": "system",
        "speaker": "■ SYSTEM",
        "text": "制圧射撃のレイダーが配備登録候補になった。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 250
      }
    ],
    "source": {
      "startLine": 240,
      "endLine": 251
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
      "startLine": 240,
      "endLine": 251
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
        "sourceLine": 256
      },
      {
        "kind": "dialogue",
        "speaker": "医師",
        "text": "噛まれてから、どれくらい",
        "portraitOwner": "minor-human-shared-event-silhouette",
        "portraitKind": "minor",
        "sourceLine": 257
      },
      {
        "kind": "dialogue",
        "speaker": "ナオ",
        "text": "一時間未満。会話できます。腕の変色はここまで",
        "portraitOwner": "unit-nao",
        "portraitKind": "major",
        "sourceLine": 258
      },
      {
        "kind": "dialogue",
        "speaker": "医師",
        "text": "初期なら進行を遅らせられる。治せるとは、まだ言えません",
        "portraitOwner": "minor-human-shared-event-silhouette",
        "portraitKind": "minor",
        "sourceLine": 259
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が冷蔵ケースを渡す。医師は不足した容器の跡を見て、唇を結ぶ。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 260
      },
      {
        "kind": "dialogue",
        "speaker": "医師",
        "text": "残りで何人分になるか、すぐ確かめます。患者を入れる間、外を守って",
        "portraitOwner": "minor-human-shared-event-silhouette",
        "portraitKind": "minor",
        "sourceLine": 261
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "運ぶ方も俺らでやる。先生は腕を見とって",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 262
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "救急車へ感染者がぶつかる。搬入口の防火扉が半分しか閉まらない。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 263
      },
      {
        "kind": "battle-marker",
        "speaker": "◆ BATTLE",
        "text": "医薬品と負傷者の移送が終わるまで搬入口を守れ。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 264
      }
    ],
    "source": {
      "startLine": 255,
      "endLine": 265
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
        "sourceLine": 268
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "防火扉の留め具が外れかける。大きなハンマーを持つ男が、扉ではなく歪んだ枠だけを叩き戻す。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 269
      },
      {
        "kind": "dialogue",
        "speaker": "タタラ",
        "text": "タタラ。扉を叩いたら患者側へ倒れる。枠だけ直す",
        "portraitOwner": "unit-tatara",
        "portraitKind": "major",
        "sourceLine": 270
      },
      {
        "kind": "dialogue",
        "speaker": "医師",
        "text": "この人、朝から扉と口喧嘩してるんです",
        "portraitOwner": "minor-human-shared-event-silhouette",
        "portraitKind": "minor",
        "sourceLine": 271
      },
      {
        "kind": "dialogue",
        "speaker": "タタラ",
        "text": "口では負けとる。だから叩く方を頼む",
        "portraitOwner": "unit-tatara",
        "portraitKind": "major",
        "sourceLine": 272
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "線、越えてないっすよね",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 273
      },
      {
        "kind": "dialogue",
        "speaker": "医師",
        "text": "今は。次は六時間後。それまでは、隣にいてあげて",
        "portraitOwner": "minor-human-shared-event-silhouette",
        "portraitKind": "minor",
        "sourceLine": 274
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "その六時間で、次の薬を探す",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 275
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "医師が救急病棟の鍵を渡す。薬品庫と、残った看護師が二人。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 276
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が空の冷蔵ケースを受け取り、東病棟の扉を開ける。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 277
      },
      {
        "kind": "system",
        "speaker": "■ SYSTEM",
        "text": "破砕兵のタタラが配備登録候補になった。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 278
      },
      {
        "kind": "system",
        "speaker": "■ SYSTEM",
        "text": "救急病棟で薬と職員を探す。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 279
      }
    ],
    "source": {
      "startLine": 267,
      "endLine": 280
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
      "startLine": 267,
      "endLine": 280
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
        "sourceLine": 285
      },
      {
        "kind": "dialogue",
        "speaker": "看護師の声",
        "text": "二人います。右の個室は開けないで",
        "portraitOwner": null,
        "portraitKind": "offscreen",
        "sourceLine": 286
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "ガラスの向こうには患者の名札と家族写真。病衣の人影が、何度も窓へ額を当てている。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 287
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "名前も、家族の写真もある。……置いていくしかないんすか",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 288
      },
      {
        "kind": "dialogue",
        "speaker": "ナオ",
        "text": "開けたら、その人も廊下の二人も助けられない",
        "portraitOwner": "unit-nao",
        "portraitKind": "major",
        "sourceLine": 289
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "パイセンはガラスに映った自分の顔から目を逸らし、処置室の扉へ向き直る。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 290
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "……分かりました。中の二人の声を、先に拾います",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 291
      },
      {
        "kind": "battle-marker",
        "speaker": "◆ BATTLE",
        "text": "処置室への道を開き、感染拠点を破壊せよ。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 292
      }
    ],
    "source": {
      "startLine": 284,
      "endLine": 293
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
        "sourceLine": 296
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "処置室の内側から、大きな防護盾が運び出される。看護師二人の前に立っていた男は、肩の傷を見せようとしない。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 297
      },
      {
        "kind": "dialogue",
        "speaker": "ガンテツ",
        "text": "ガンテツです。看護師さんから出してください。私は最後で",
        "portraitOwner": "unit-gantetsu",
        "portraitKind": "major",
        "sourceLine": 298
      },
      {
        "kind": "dialogue",
        "speaker": "ナオ",
        "text": "肩を隠したままでは、最後まで立てません。盾を降ろして",
        "portraitOwner": "unit-nao",
        "portraitKind": "major",
        "sourceLine": 299
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "ガンテツは一度だけ看護師二人を見る。二人が頷くのを見て、ようやく盾を置いた。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 300
      },
      {
        "kind": "dialogue",
        "speaker": "看護師",
        "text": "名前を呼んでも、番号で答えろと言われました",
        "portraitOwner": "minor-human-shared-event-silhouette",
        "portraitKind": "minor",
        "sourceLine": 301
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "搬送先はB3-L。病院の図面には、そんな階がない",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 302
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "パイセンが紙台帳の端を揃え、破れたページを掌で押さえる。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 303
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "この紙、俺が持ちます。名前だけは汚したくない",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 304
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が台帳を撮り、薬を搬入口へ送り出す。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 305
      },
      {
        "kind": "system",
        "speaker": "■ SYSTEM",
        "text": "防衛重装のガンテツが配備登録候補になった。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 306
      },
      {
        "kind": "system",
        "speaker": "■ SYSTEM",
        "text": "地下機械室からB3-Lの入口を探す。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 307
      }
    ],
    "source": {
      "startLine": 295,
      "endLine": 308
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
      "startLine": 295,
      "endLine": 308
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
        "sourceLine": 313
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "上の病棟より、下の階へ電気が流れてる",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 314
      },
      {
        "kind": "dialogue",
        "speaker": "ババヤガ",
        "text": "発生前からか",
        "portraitOwner": "unit-babayaga",
        "portraitKind": "major",
        "sourceLine": 315
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "設定した日付が残ってます。半年前",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 316
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "冷却ファンに感染組織が絡み、機械室に焦げた樹脂の臭いが満ちる。非常電源盤は三か所とも落ちている。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 317
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が三か所の非常電源盤へ仲間を割り振り、手動始動レバーへ走る。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 318
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "病棟の灯りを戻す。下の扉も、開ける",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 319
      },
      {
        "kind": "battle-marker",
        "speaker": "◆ BATTLE",
        "text": "三か所の非常電源盤を起動し、発電機を守れ。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 320
      }
    ],
    "source": {
      "startLine": 312,
      "endLine": 321
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
        "sourceLine": 324
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "いくらちゃんの端末が鳴る。主人公たちの戦闘映像が、知らない回線へ送られていた。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 325
      },
      {
        "kind": "system",
        "speaker": "■ SYSTEM",
        "text": "外部転送完了／転送先：SEG-LAB",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 326
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "私が繋いだ端末から抜かれた。……気づけなかった",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 327
      },
      {
        "kind": "dialogue",
        "speaker": "ババヤガ",
        "text": "次を止められるか",
        "portraitOwner": "unit-babayaga",
        "portraitKind": "major",
        "sourceLine": 328
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が表示を撮り、送信線を根元から抜く。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 329
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "もう送られた分は消せない。でも、こっちにも記録が残った",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 330
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "エレベーターの下から、短い救難音が返る。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 331
      }
    ],
    "source": {
      "startLine": 323,
      "endLine": 332
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
      "startLine": 323,
      "endLine": 332
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
        "sourceLine": 337
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "{{PLAYER_NAME}}さん、俺たちが逃げてた場所、全部映ってる",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 338
      },
      {
        "kind": "system",
        "speaker": "■ SYSTEM",
        "text": "T計画／都市対応実証フィールド／区画B-01〜B-09",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 339
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "備えとったんやない。俺らが店を出る前から、待っとった",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 340
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "除染ゲートが異常を告げ、隔壁が閉まる。天井の配管から感染個体が落ちる。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 341
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が非常解除盤へ走り、仲間の退路を確保する。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 342
      },
      {
        "kind": "battle-marker",
        "speaker": "◆ BATTLE",
        "text": "除染制御を復旧し、隔離区画への扉を開けよ。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 343
      }
    ],
    "source": {
      "startLine": 336,
      "endLine": 344
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
        "sourceLine": 347
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "隊列の後ろを歩くマヨちゃんが、開いた扉の前で止まる。耳が立ったのを見て、先行するハチも足を止めた。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 348
      },
      {
        "kind": "dialogue",
        "speaker": "ハチ",
        "text": "さっきまで尻尾振ってたのに。奥に何かいる",
        "portraitOwner": "unit-hachi",
        "portraitKind": "major",
        "sourceLine": 349
      },
      {
        "kind": "dialogue",
        "speaker": "ナオ",
        "text": "前へ出すなら、戻す道も空けて。小さいから、見失う",
        "portraitOwner": "unit-nao",
        "portraitKind": "major",
        "sourceLine": 350
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公がマヨちゃんの戦術ハーネスを確かめ、後方へ戻る経路を空ける。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 351
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "薬局の箱も病院の備蓄も、ここと同じ管理番号です",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 352
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "三人とも、こっちを待ってる。先に開けましょう",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 353
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "ああ。マヨちゃんは俺が抱く。お前は扉へ",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 354
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が防疫扉を開き、隔離区画へ踏み込む。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 355
      },
      {
        "kind": "system",
        "speaker": "■ SYSTEM",
        "text": "マヨちゃんが遊撃の配備登録候補になった。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 356
      },
      {
        "kind": "system",
        "speaker": "■ SYSTEM",
        "text": "生存者を救出し、大型検体を止める。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 357
      }
    ],
    "source": {
      "startLine": 346,
      "endLine": 358
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
      "startLine": 346,
      "endLine": 358
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
        "sourceLine": 363
      },
      {
        "kind": "dialogue",
        "speaker": "研究員の声",
        "text": "隔離を戻して。扉を開けたら、あれも出ます",
        "portraitOwner": null,
        "portraitKind": "offscreen",
        "sourceLine": 364
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "最大槽の札には「MOTHER」。製造日は発生より前だった。供給管が待機室と同じ天井を通る。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 365
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "あれを作った人が、ここにいるんすか",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 366
      },
      {
        "kind": "dialogue",
        "speaker": "研究員の声",
        "text": "います。私です。だから、管を切る場所も分かる",
        "portraitOwner": null,
        "portraitKind": "offscreen",
        "sourceLine": 367
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "出てから話を聞く。三人とも、ここで死なせん",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 368
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が酸素供給を待機室へ切り替え、隔離レバーを引く。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 369
      },
      {
        "kind": "boss-marker",
        "speaker": "◆ BOSS",
        "text": "MOTHER",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 370
      },
      {
        "kind": "battle-marker",
        "speaker": "◆ BATTLE",
        "text": "供給管を復旧し、待機室を守りながらMOTHERを止めよ。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 371
      }
    ],
    "source": {
      "startLine": 362,
      "endLine": 372
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
        "sourceLine": 375
      },
      {
        "kind": "dialogue",
        "speaker": "研究員",
        "text": "私は培養を続けた。地上へ出す命令も見た。止めずに、今日まで来た",
        "portraitOwner": "minor-human-shared-event-silhouette",
        "portraitKind": "minor",
        "sourceLine": 376
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "差し出された搬送票には、発生前の日付と回収班の赤い認識灯の記録。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 377
      },
      {
        "kind": "dialogue",
        "speaker": "ババヤガ",
        "text": "赤いレンズのやつらか",
        "portraitOwner": "unit-babayaga",
        "portraitKind": "major",
        "sourceLine": 378
      },
      {
        "kind": "dialogue",
        "speaker": "研究員",
        "text": "抑制液の処方も渡します。進行を遅らせるだけで、治療薬にはならない",
        "portraitOwner": "minor-human-shared-event-silhouette",
        "portraitKind": "minor",
        "sourceLine": 379
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "医者に渡す。その違いも、俺が伝える",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 380
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が票と処方を封じ、三人を地上へ送り出す。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 381
      }
    ],
    "source": {
      "startLine": 374,
      "endLine": 382
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
      "startLine": 374,
      "endLine": 382
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
        "sourceLine": 387
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "荷台の表示盤に妻と娘の名を見つけた男が、空のウイスキー瓶を握って飛び出す。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 388
      },
      {
        "kind": "dialogue",
        "speaker": "ザキミヤ",
        "text": "待て！　その車に妻と娘の記録がある！　持っていくな！",
        "portraitOwner": "unit-zakimiya",
        "portraitKind": "major",
        "sourceLine": 389
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "赤レンズの兵が発砲。ザキミヤの手の瓶が砕け、喉元を破片がかすめる。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 390
      },
      {
        "kind": "dialogue",
        "speaker": "ババヤガ",
        "text": "伏せろ！　次は当ててくるぞ！",
        "portraitOwner": "unit-babayaga",
        "portraitKind": "major",
        "sourceLine": 391
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "こっちに来い！",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 392
      },
      {
        "kind": "dialogue",
        "speaker": "ザキミヤ",
        "text": "俺だけ逃げたら、二人がどこへ行ったか分からん！",
        "portraitOwner": "unit-zakimiya",
        "portraitKind": "major",
        "sourceLine": 393
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が搬送車と男の間へ装甲車両を滑り込ませ、運転席を奪う。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 394
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "車内の記録は、坑道出口の端末で開けます。まず車をそこまで！",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 395
      },
      {
        "kind": "battle-marker",
        "speaker": "◆ BATTLE",
        "text": "密閉搬送車を坑道出口まで護衛し、ザキミヤと移送記録を守れ。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 396
      }
    ],
    "source": {
      "startLine": 386,
      "endLine": 397
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
        "sourceLine": 400
      },
      {
        "kind": "dialogue",
        "speaker": "ザキミヤ",
        "text": "不明なら、まだ探してええんよな",
        "portraitOwner": "unit-zakimiya",
        "portraitKind": "major",
        "sourceLine": 401
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "中央台帳に続きがあります。ここには死亡記録もない",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 402
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "ザキミヤが乳児の写真を見せる。親指が小さな顔を隠さないよう、端を持つ。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 403
      },
      {
        "kind": "dialogue",
        "speaker": "ザキミヤ",
        "text": "あんな大声は出せたのにな。立とうとしたら、足が言うこと聞かん",
        "portraitOwner": "unit-zakimiya",
        "portraitKind": "major",
        "sourceLine": 404
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "俺も最初そうでした。今も、たまになります",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 405
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "座席ならある。立つのは、乗ってからでよか",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 406
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が空席の扉を開く。ザキミヤは写真を胸へ戻して乗る。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 407
      },
      {
        "kind": "system",
        "speaker": "■ SYSTEM",
        "text": "ザキミヤが合流。戦闘配備登録が解禁。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 408
      }
    ],
    "source": {
      "startLine": 399,
      "endLine": 409
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
      "startLine": 399,
      "endLine": 409
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
        "sourceLine": 414
      },
      {
        "kind": "dialogue",
        "speaker": "セガワの声",
        "text": "青い端子を繋げば、冷蔵コンテナと奥の避難室が開きます",
        "portraitOwner": null,
        "portraitKind": "offscreen",
        "sourceLine": 415
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "病院のSEG-LABも、あなたの回線？",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 416
      },
      {
        "kind": "dialogue",
        "speaker": "セガワの声",
        "text": "私の設備です。映像で見ています。扉を開けるかどうかは、あなたたちが決めてください",
        "portraitOwner": null,
        "portraitKind": "offscreen",
        "sourceLine": 417
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "見てたなら、避難室に何人いるか分かりますよね",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 418
      },
      {
        "kind": "dialogue",
        "speaker": "セガワの声",
        "text": "二人です。一人は足を怪我している",
        "portraitOwner": null,
        "portraitKind": "offscreen",
        "sourceLine": 419
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "いくらちゃんが避難室の熱源を確かめる。二つ。嘘ではない。だからこそ、彼女は端末の録画を止めない。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 420
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が端子を繋ぎ、開いた扉の前へ立つ。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 421
      },
      {
        "kind": "battle-marker",
        "speaker": "◆ BATTLE",
        "text": "避難室と薬品庫を確保し、物資の搬出を守れ。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 422
      }
    ],
    "source": {
      "startLine": 413,
      "endLine": 423
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
        "sourceLine": 426
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "助かった。そこは礼を言う。だが映像は渡した覚えがない",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 427
      },
      {
        "kind": "dialogue",
        "speaker": "セガワの声",
        "text": "消せない記録がある。それも含めて、いずれ見せます",
        "portraitOwner": null,
        "portraitKind": "offscreen",
        "sourceLine": 428
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "待つ気はありません。こちらでも調べます",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 429
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "輸送記録には、発生前に結ばれた封鎖と復旧の契約。別都市の契約書には、まだ地名がない。束の下から、水質異常を「一時的」と書き直した報告書が出てくる。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 430
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "災害より先に、請求先だけ決めていた",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 431
      },
      {
        "kind": "dialogue",
        "speaker": "ザキミヤ",
        "text": "これ、誰に見せたら止まる",
        "portraitOwner": "unit-zakimiya",
        "portraitKind": "major",
        "sourceLine": 432
      },
      {
        "kind": "dialogue",
        "speaker": "セガワの声",
        "text": "原本を一か所へ集めないでください。消す側も、その方法を知っています",
        "portraitOwner": null,
        "portraitKind": "offscreen",
        "sourceLine": 433
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が紙の原本を回収し、次の救難信号が出る線路へ向かう。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 434
      }
    ],
    "source": {
      "startLine": 425,
      "endLine": 435
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
      "startLine": 425,
      "endLine": 435
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
        "sourceLine": 440
      },
      {
        "kind": "dialogue",
        "speaker": "TKY",
        "text": "そこの車！　人が乗っとる車両の連結器、三つ外してくれ！　俺が切ると丸ごと飛ぶ！",
        "portraitOwner": "unit-tky",
        "portraitKind": "major",
        "sourceLine": 441
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "あんたは？",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 442
      },
      {
        "kind": "dialogue",
        "speaker": "TKY",
        "text": "こいつの口を塞ぐ。名乗りはあと。……TKY、三文字や。覚えやすいやろ",
        "portraitOwner": "unit-tky",
        "portraitKind": "major",
        "sourceLine": 443
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "貨車が軋む。窓の内側から子どもが手を振り、すぐ引っ込める。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 444
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が一つ目の連結器へ走り、解除ハンドルを握る。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 445
      },
      {
        "kind": "boss-marker",
        "speaker": "◆ BOSS",
        "text": "オオグチ",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 446
      },
      {
        "kind": "battle-marker",
        "speaker": "◆ BATTLE",
        "text": "連結を三つ外し、民間車両を逃がせ。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 447
      }
    ],
    "source": {
      "startLine": 439,
      "endLine": 448
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
        "sourceLine": 451
      },
      {
        "kind": "dialogue",
        "speaker": "避難者",
        "text": "もう一人、刀を二本持った人が本社の方へ行った。名前は聞けなかった",
        "portraitOwner": "minor-human-shared-event-silhouette",
        "portraitKind": "minor",
        "sourceLine": 452
      },
      {
        "kind": "dialogue",
        "speaker": "TKY",
        "text": "二刀か。こっちは一刀で手一杯やのに",
        "portraitOwner": "unit-tky",
        "portraitKind": "major",
        "sourceLine": 453
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "いくらちゃんがババヤガへ端末を向ける。「チハ／湾岸封鎖区／十七日目生存」。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 454
      },
      {
        "kind": "dialogue",
        "speaker": "ババヤガ",
        "text": "……この人、俺の妻",
        "portraitOwner": "unit-babayaga",
        "portraitKind": "major",
        "sourceLine": 455
      },
      {
        "kind": "dialogue",
        "speaker": "TKY",
        "text": "湾岸へ行くんやな。さっきの子らが通る道、俺も開けとく",
        "portraitOwner": "unit-tky",
        "portraitKind": "major",
        "sourceLine": 456
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が車両の扉を開く。TKYが避難者へ一度手を振って乗る。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 457
      },
      {
        "kind": "system",
        "speaker": "■ SYSTEM",
        "text": "TKYが合流。戦闘配備登録が解禁。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 458
      }
    ],
    "source": {
      "startLine": 450,
      "endLine": 459
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
      "startLine": 450,
      "endLine": 459
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
        "sourceLine": 464
      },
      {
        "kind": "dialogue",
        "speaker": "セガワの声",
        "text": "民間回線は左の三つの盤から起こせます。右へ触れると回収班に位置が出ます",
        "portraitOwner": null,
        "portraitKind": "offscreen",
        "sourceLine": 465
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "図面は私も見ます。左の三つです。右には触らないで",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 466
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "ババヤガが別の無線を合わせる。雑音の向こうで、女性が避難者の名前を一人ずつ呼んでいる。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 467
      },
      {
        "kind": "dialogue",
        "speaker": "ババヤガ",
        "text": "……チハ。名前の呼び方が、同じや",
        "portraitOwner": "unit-babayaga",
        "portraitKind": "major",
        "sourceLine": 468
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "声が途切れ、制御盤へ感染者が押し寄せる。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 469
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が三つの盤を地図で示し、仲間を回線の前へ配置する。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 470
      },
      {
        "kind": "battle-marker",
        "speaker": "◆ BATTLE",
        "text": "救難回線の三つの盤を復旧し、制御区を守れ。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 471
      }
    ],
    "source": {
      "startLine": 463,
      "endLine": 472
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
        "sourceLine": 475
      },
      {
        "kind": "dialogue",
        "speaker": "ババヤガ",
        "text": "チハ。俺や",
        "portraitOwner": "unit-babayaga",
        "portraitKind": "major",
        "sourceLine": 476
      },
      {
        "kind": "dialogue",
        "speaker": "Mrs.チハの声",
        "text": "分かってる。呼ぶ声だけで",
        "portraitOwner": null,
        "portraitKind": "offscreen",
        "sourceLine": 477
      },
      {
        "kind": "dialogue",
        "speaker": "ババヤガ",
        "text": "今行く",
        "portraitOwner": "unit-babayaga",
        "portraitKind": "major",
        "sourceLine": 478
      },
      {
        "kind": "dialogue",
        "speaker": "Mrs.チハの声",
        "text": "中央のゲートを閉めて。ここへ来ても、流入が続けば十二人は出せない",
        "portraitOwner": null,
        "portraitKind": "offscreen",
        "sourceLine": 479
      },
      {
        "kind": "dialogue",
        "speaker": "ババヤガ",
        "text": "……順番は分かった。そこから動くな",
        "portraitOwner": "unit-babayaga",
        "portraitKind": "major",
        "sourceLine": 480
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "一拍の無音のあと、彼女が小さく息を吐く。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 481
      },
      {
        "kind": "dialogue",
        "speaker": "Mrs.チハの声",
        "text": "あなたも",
        "portraitOwner": null,
        "portraitKind": "offscreen",
        "sourceLine": 482
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が中央封鎖区への地図を受け取り、出発する。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 483
      }
    ],
    "source": {
      "startLine": 474,
      "endLine": 484
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
      "startLine": 474,
      "endLine": 484
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
        "sourceLine": 489
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "全部閉めます。一本残せば、地下から抜ける",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 490
      },
      {
        "kind": "dialogue",
        "speaker": "Mrs.チハの声",
        "text": "残り二十七発。子どもたちを階段の下へ移す",
        "portraitOwner": null,
        "portraitKind": "offscreen",
        "sourceLine": 491
      },
      {
        "kind": "dialogue",
        "speaker": "ババヤガ",
        "text": "俺らが三つ閉める。子どもらを窓から離しとけ",
        "portraitOwner": "unit-babayaga",
        "portraitKind": "major",
        "sourceLine": 492
      },
      {
        "kind": "dialogue",
        "speaker": "Mrs.チハの声",
        "text": "もう移した。迎えに来るなら急いで",
        "portraitOwner": null,
        "portraitKind": "offscreen",
        "sourceLine": 493
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が三基の担当を指示し、最初の閉鎖盤へ向かう。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 494
      },
      {
        "kind": "battle-marker",
        "speaker": "◆ BATTLE",
        "text": "三基のゲートを閉鎖し、湾岸への流入を止めよ。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 495
      }
    ],
    "source": {
      "startLine": 488,
      "endLine": 496
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
        "sourceLine": 499
      },
      {
        "kind": "dialogue",
        "speaker": "ババヤガ",
        "text": "チハ、聞こえるか",
        "portraitOwner": "unit-babayaga",
        "portraitKind": "major",
        "sourceLine": 500
      },
      {
        "kind": "dialogue",
        "speaker": "Mrs.チハの声",
        "text": "聞こえる。子どもたちも無事",
        "portraitOwner": null,
        "portraitKind": "offscreen",
        "sourceLine": 501
      },
      {
        "kind": "dialogue",
        "speaker": "ババヤガ",
        "text": "よかった。十二人目まで、俺が通す",
        "portraitOwner": "unit-babayaga",
        "portraitKind": "major",
        "sourceLine": 502
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "地図に塔への細い通路が現れる。セガワが所要時間を読み上げ、いくらちゃんは時刻だけ記録する。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 503
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が車両を塔へ発進させる。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 504
      }
    ],
    "source": {
      "startLine": 498,
      "endLine": 505
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
      "startLine": 498,
      "endLine": 505
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
        "sourceLine": 510
      },
      {
        "kind": "dialogue",
        "speaker": "Mrs.チハ",
        "text": "子どもを真ん中に。押さないで、歩いて",
        "portraitOwner": "unit-mrs-chiha",
        "portraitKind": "major",
        "sourceLine": 511
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "単眼の感染体が明かりへ向く。ババヤガが呼ぶより先に、Mrs.チハが撃つ。弾が足元で炸裂し、粉塵が眼を覆う。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 512
      },
      {
        "kind": "dialogue",
        "speaker": "Mrs.チハ",
        "text": "煙が晴れるまで。子どもを先に！",
        "portraitOwner": "unit-mrs-chiha",
        "portraitKind": "major",
        "sourceLine": 513
      },
      {
        "kind": "dialogue",
        "speaker": "ババヤガ",
        "text": "お前は下がれ",
        "portraitOwner": "unit-babayaga",
        "portraitKind": "major",
        "sourceLine": 514
      },
      {
        "kind": "dialogue",
        "speaker": "Mrs.チハ",
        "text": "十二人目が通ったら",
        "portraitOwner": "unit-mrs-chiha",
        "portraitKind": "major",
        "sourceLine": 515
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が煙の手前へ部隊を展開させ、回廊の前へ出る。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 516
      },
      {
        "kind": "boss-marker",
        "speaker": "◆ BOSS",
        "text": "クロメ",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 517
      },
      {
        "kind": "battle-marker",
        "speaker": "◆ BATTLE",
        "text": "大型個体を退け、十二人の避難路を確保せよ。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 518
      }
    ],
    "source": {
      "startLine": 509,
      "endLine": 519
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
        "sourceLine": 522
      },
      {
        "kind": "dialogue",
        "speaker": "Mrs.チハ",
        "text": "その袖、破れてる。噛まれた？",
        "portraitOwner": "unit-mrs-chiha",
        "portraitKind": "major",
        "sourceLine": 523
      },
      {
        "kind": "dialogue",
        "speaker": "ババヤガ",
        "text": "違う。お前は",
        "portraitOwner": "unit-babayaga",
        "portraitKind": "major",
        "sourceLine": 524
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "二人とも相手の腕を調べ、無傷と分かっても手を離さない。車内では十二人が出発を待っている。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 525
      },
      {
        "kind": "dialogue",
        "speaker": "Mrs.チハ",
        "text": "……ほんとに来た",
        "portraitOwner": "unit-mrs-chiha",
        "portraitKind": "major",
        "sourceLine": 526
      },
      {
        "kind": "dialogue",
        "speaker": "ババヤガ",
        "text": "遅くなった",
        "portraitOwner": "unit-babayaga",
        "portraitKind": "major",
        "sourceLine": 527
      },
      {
        "kind": "dialogue",
        "speaker": "Mrs.チハ",
        "text": "遅い。話はあと。この十二人を病院へ",
        "portraitOwner": "unit-mrs-chiha",
        "portraitKind": "major",
        "sourceLine": 528
      },
      {
        "kind": "dialogue",
        "speaker": "ババヤガ",
        "text": "分かった。十二人、俺が数える",
        "portraitOwner": "unit-babayaga",
        "portraitKind": "major",
        "sourceLine": 529
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "いくらちゃんが防疫扉へ触れる前に、Mrs.チハが八桁の番号で開ける。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 530
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "その番号は？",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 531
      },
      {
        "kind": "dialogue",
        "speaker": "Mrs.チハ",
        "text": "会社で使った番号。いくらちゃん、入力履歴を残して",
        "portraitOwner": "unit-mrs-chiha",
        "portraitKind": "major",
        "sourceLine": 532
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "残します。誰の番号かも、あとで聞きます",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 533
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が予備弾薬と空席を渡す。いくらちゃんは入力履歴を保存する。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 534
      },
      {
        "kind": "system",
        "speaker": "■ SYSTEM",
        "text": "Mrs.チハが合流。戦闘配備登録が解禁。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 535
      }
    ],
    "source": {
      "startLine": 521,
      "endLine": 536
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
      "startLine": 521,
      "endLine": 536
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
        "sourceLine": 541
      },
      {
        "kind": "dialogue",
        "speaker": "ザキミヤ",
        "text": "妻と娘だけ先に探して――",
        "portraitOwner": "unit-zakimiya",
        "portraitKind": "major",
        "sourceLine": 542
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "棚の無数の名前を見る。彼は息を吸い直す。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 543
      },
      {
        "kind": "dialogue",
        "speaker": "ザキミヤ",
        "text": "……この棚も、あっちも持つ。うちの二人だけ選んだら、後ろの名前を見られん",
        "portraitOwner": "unit-zakimiya",
        "portraitKind": "major",
        "sourceLine": 544
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "モニターにムガリアン社長。救援薬と、家族の解放を提示する。代価は台帳の返却。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 545
      },
      {
        "kind": "dialogue",
        "speaker": "ムガリアン社長",
        "text": "薬も、ご家族の解放も手配できます。先に台帳を、こちらへ",
        "portraitOwner": "mugarian-president",
        "portraitKind": "major",
        "sourceLine": 546
      },
      {
        "kind": "dialogue",
        "speaker": "ザキミヤ",
        "text": "俺の家族を、あんたの取引に入れるな",
        "portraitOwner": "unit-zakimiya",
        "portraitKind": "major",
        "sourceLine": 547
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が画面の音量を切り、最上段の紙箱を仲間へ渡す。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 548
      },
      {
        "kind": "battle-marker",
        "speaker": "◆ BATTLE",
        "text": "遠隔消去を止め、紙台帳を搬出せよ。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 549
      }
    ],
    "source": {
      "startLine": 540,
      "endLine": 550
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
        "sourceLine": 553
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "二人とも三日前に生存確認。臨床試験棟Cです",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 554
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "ザキミヤは床へ座る。写真を見て、掌で目を覆う。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 555
      },
      {
        "kind": "dialogue",
        "speaker": "ザキミヤ",
        "text": "……まだ、間に合う",
        "portraitOwner": "unit-zakimiya",
        "portraitKind": "major",
        "sourceLine": 556
      },
      {
        "kind": "dialogue",
        "speaker": "Mrs.チハ",
        "text": "三か所へ写して。紙だけでは、橋を越える前に奪われる",
        "portraitOwner": "unit-mrs-chiha",
        "portraitKind": "major",
        "sourceLine": 557
      },
      {
        "kind": "dialogue",
        "speaker": "ババヤガ",
        "text": "消し方を知っとる顔やね",
        "portraitOwner": "unit-babayaga",
        "portraitKind": "major",
        "sourceLine": 558
      },
      {
        "kind": "dialogue",
        "speaker": "Mrs.チハ",
        "text": "消される名簿を、前に見た。だから紙を残した",
        "portraitOwner": "unit-mrs-chiha",
        "portraitKind": "major",
        "sourceLine": 559
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が原本を封じ、搬送車を海浜連絡橋へ向ける。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 560
      }
    ],
    "source": {
      "startLine": 552,
      "endLine": 561
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
      "startLine": 552,
      "endLine": 561
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
        "sourceLine": 566
      },
      {
        "kind": "dialogue",
        "speaker": "セガワの声",
        "text": "保守車線は一度しか開けません。護送車が遮断機に着いたら、七秒だけ通します",
        "portraitOwner": null,
        "portraitKind": "offscreen",
        "sourceLine": 567
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "俺が運びます。箱、動かないように縛ってください",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 568
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "運転席に座り、パイセンはベルトの金具を一度落とす。拾い直して、今度は音を立てずに留めた。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 569
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "俺らの車が壁になる。秒を数えるな、前だけ見ろ",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 570
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "……向こう岸の標識で停まります。来てくださいよ",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 571
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が搬送車の扉を一度叩き、自分たちの車両を盾の位置へ出す。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 572
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "遮断機は下りたまま。企業車両のエンジンが唸り、搬送車の行く手へ回り込む。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 573
      },
      {
        "kind": "battle-marker",
        "speaker": "◆ BATTLE",
        "text": "証拠搬送車を橋の遮断機まで護衛し、敵車両を抑えよ。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 574
      }
    ],
    "source": {
      "startLine": 565,
      "endLine": 575
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
        "text": "搬送車が遮断機へ着く。セガワの合図で保守車線が上がった。七秒。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 578
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "企業車両が横から割り込む。主人公の車両が鼻先を塞ぎ、パイセンが搬送車を滑り込ませる。遮断機が荷台の角を擦って落ちた。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 579
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "無線に、パイセンの荒い呼吸と紙箱の揺れる音だけが残る。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 580
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "病院、区役所、外周。複製は三か所へ届いた",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 581
      },
      {
        "kind": "dialogue",
        "speaker": "パイセンの声",
        "text": "一箱、角を潰しました。中は無事っす",
        "portraitOwner": null,
        "portraitKind": "offscreen",
        "sourceLine": 582
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "お前も無事なら、あとで水飲んで叱る",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 583
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "河口防潮門から大型感染者が西新側へ流入したと知らせが入る。ザキミヤは試験棟の方を見る。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 584
      },
      {
        "kind": "dialogue",
        "speaker": "ザキミヤ",
        "text": "先に門を閉めよう。二人を連れて帰る道まで、失くしたくない",
        "portraitOwner": "unit-zakimiya",
        "portraitKind": "major",
        "sourceLine": 585
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が車両を河口へ向け直す。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 586
      }
    ],
    "source": {
      "startLine": 577,
      "endLine": 587
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
      "startLine": 577,
      "endLine": 587
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
        "sourceLine": 592
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "ここを閉めれば、商店街から病院まで歩いて薬を運べる",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 593
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "食べ物も、人も。取り戻すなら、その道からや",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 594
      },
      {
        "kind": "dialogue",
        "speaker": "TKY",
        "text": "門から引き剥がす。閉めるのは任せた",
        "portraitOwner": "unit-tky",
        "portraitKind": "major",
        "sourceLine": 595
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が手動閉鎖盤を起動し、感染体を水路側へ誘う。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 596
      },
      {
        "kind": "boss-marker",
        "speaker": "◆ BOSS",
        "text": "ガイレン",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 597
      },
      {
        "kind": "battle-marker",
        "speaker": "◆ BATTLE",
        "text": "ガイレンを退け、防潮門を閉鎖せよ。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 598
      }
    ],
    "source": {
      "startLine": 591,
      "endLine": 599
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
        "sourceLine": 604,
        "sceneTag": "corridor"
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "後ろから缶詰を積んだ小さな台車。クレイジーキングはがたつく車輪を足で押さえ、一缶も落とさず運んでくる。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 605,
        "sceneTag": "corridor"
      },
      {
        "kind": "dialogue",
        "speaker": "クレイジーキング",
        "text": "道は取り戻した。缶詰の半分を病院へ！",
        "portraitOwner": "unit-crazy-king",
        "portraitKind": "major",
        "sourceLine": 606,
        "sceneTag": "corridor"
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "もう半分は",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 607,
        "sceneTag": "corridor"
      },
      {
        "kind": "dialogue",
        "speaker": "クレイジーキング",
        "text": "残りは我らの朝飯。腹が鳴っては門を守れん",
        "portraitOwner": "unit-crazy-king",
        "portraitKind": "major",
        "sourceLine": 608,
        "sceneTag": "corridor"
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "朝飯つきなら、俺も入れてください",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 609,
        "sceneTag": "corridor"
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "本社へ続く道には、首筋や胸を斬られた感染者が倒れている。二刀の男が路地から出てくる。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 612,
        "sceneTag": "musashi"
      },
      {
        "kind": "dialogue",
        "speaker": "TKY",
        "text": "あの刃の人か",
        "portraitOwner": "unit-tky",
        "portraitKind": "major",
        "sourceLine": 613,
        "sceneTag": "musashi"
      },
      {
        "kind": "dialogue",
        "speaker": "宮本武蔵",
        "text": "血の流れは、あの黒い楼へ向かう。お主らも行くのか",
        "portraitOwner": "unit-miyamoto-musashi",
        "portraitKind": "major",
        "sourceLine": 614,
        "sceneTag": "musashi"
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "名前を聞いてもいい？",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 615,
        "sceneTag": "musashi"
      },
      {
        "kind": "dialogue",
        "speaker": "宮本武蔵",
        "text": "宮本武蔵",
        "portraitOwner": "unit-miyamoto-musashi",
        "portraitKind": "major",
        "sourceLine": 616,
        "sceneTag": "musashi"
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "誰もすぐには返さない。武蔵はその沈黙を気にせず、遠くの塔を見上げる。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 617,
        "sceneTag": "musashi"
      },
      {
        "kind": "dialogue",
        "speaker": "宮本武蔵",
        "text": "道が同じなら、刃を貸す",
        "portraitOwner": "unit-miyamoto-musashi",
        "portraitKind": "major",
        "sourceLine": 618,
        "sceneTag": "musashi"
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が空いた席を示す。武蔵は二刀を納めて乗る。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 619,
        "sceneTag": "musashi"
      },
      {
        "kind": "system",
        "speaker": "■ SYSTEM",
        "text": "宮本武蔵が合流。戦闘配備登録が解禁。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 620,
        "sceneTag": "musashi"
      }
    ],
    "source": {
      "startLine": 601,
      "endLine": 621
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
      "startLine": 601,
      "endLine": 621
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
        "sourceLine": 626
      },
      {
        "kind": "dialogue",
        "speaker": "赤レンズの隊長",
        "text": "記録を置いて退去しろ",
        "portraitOwner": "red-panther-commander",
        "portraitKind": "major",
        "sourceLine": 627
      },
      {
        "kind": "dialogue",
        "speaker": "ザキミヤ",
        "text": "中の人を出せ。四十三人、いるんやろ",
        "portraitOwner": "unit-zakimiya",
        "portraitKind": "major",
        "sourceLine": 628
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "隊員が音響誘導装置を構える。Mrs.チハが東塔を指した。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 629
      },
      {
        "kind": "dialogue",
        "speaker": "Mrs.チハ",
        "text": "東塔の音響装置を止めて。鳴れば、この一帯の感染者が寄る",
        "portraitOwner": "unit-mrs-chiha",
        "portraitKind": "major",
        "sourceLine": 630
      },
      {
        "kind": "dialogue",
        "speaker": "ババヤガ",
        "text": "装置の場所まで知っとるんやね",
        "portraitOwner": "unit-babayaga",
        "portraitKind": "major",
        "sourceLine": 631
      },
      {
        "kind": "dialogue",
        "speaker": "Mrs.チハ",
        "text": "設置図を見た。話す時には、そのことも話す",
        "portraitOwner": "unit-mrs-chiha",
        "portraitKind": "major",
        "sourceLine": 632
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が車両を避難路へ置き、東塔に照準を合わせる。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 633
      },
      {
        "kind": "battle-marker",
        "speaker": "◆ BATTLE",
        "text": "誘導装置を止め、臨床試験棟への道を開けよ。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 634
      }
    ],
    "source": {
      "startLine": 625,
      "endLine": 635
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
        "sourceLine": 638
      },
      {
        "kind": "dialogue",
        "speaker": "ザキミヤ",
        "text": "今朝、ここにおった",
        "portraitOwner": "unit-zakimiya",
        "portraitKind": "major",
        "sourceLine": 639
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "処分警報が鳴る。表示より先にMrs.チハが残り時間を口にする。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 640
      },
      {
        "kind": "dialogue",
        "speaker": "Mrs.チハ",
        "text": "八分で焼却が始まる。電源を落とされる前に入って",
        "portraitOwner": "unit-mrs-chiha",
        "portraitKind": "major",
        "sourceLine": 641
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "なんで知ってるんすか。……いや、今はいい。扉、開けましょう",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 642
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が棟の扉へ走り、全員が続く。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 643
      }
    ],
    "source": {
      "startLine": 637,
      "endLine": 644
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
      "startLine": 637,
      "endLine": 644
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
        "sourceLine": 649
      },
      {
        "kind": "dialogue",
        "speaker": "ザキミヤ",
        "text": "C-4から開けられんのか",
        "portraitOwner": "unit-zakimiya",
        "portraitKind": "major",
        "sourceLine": 650
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "東から電源を戻さないと、全部ロックされます",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 651
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "ザキミヤはC-4へ走りかけ、最初の扉で止まる。中から、自分の娘ではない子どもの声がした。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 652
      },
      {
        "kind": "dialogue",
        "speaker": "ザキミヤ",
        "text": "ここから開けよう。……俺に最後まで手伝わせて",
        "portraitOwner": "unit-zakimiya",
        "portraitKind": "major",
        "sourceLine": 653
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "四十三人、全部開ける",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 654
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が最初の生命維持レバーを上げる。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 655
      },
      {
        "kind": "battle-marker",
        "speaker": "◆ BATTLE",
        "text": "処分手順を止め、四十三人を順に救出せよ。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 656
      }
    ],
    "source": {
      "startLine": 648,
      "endLine": 657
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
        "sourceLine": 660
      },
      {
        "kind": "dialogue",
        "speaker": "ザキミヤの妻",
        "text": "生きとったん",
        "portraitOwner": "minor-human-shared-event-silhouette",
        "portraitKind": "minor",
        "sourceLine": 661
      },
      {
        "kind": "dialogue",
        "speaker": "ザキミヤ",
        "text": "うん。もっと早く来たかった",
        "portraitOwner": "unit-zakimiya",
        "portraitKind": "major",
        "sourceLine": 662
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "彼が両手を差し出す。妻は煤と血で黒い指を見て、娘を抱き直した。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 663
      },
      {
        "kind": "dialogue",
        "speaker": "ザキミヤの妻",
        "text": "洗って。ここに水がある",
        "portraitOwner": "minor-human-shared-event-silhouette",
        "portraitKind": "minor",
        "sourceLine": 664
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "ザキミヤは流しで手を洗う。爪の下の黒が落ちるまで。妻もその間、娘を急かさない。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 665
      },
      {
        "kind": "dialogue",
        "speaker": "ザキミヤ",
        "text": "父ちゃんや。……分からんよな。これから何回でも、名前呼んで",
        "portraitOwner": "unit-zakimiya",
        "portraitKind": "major",
        "sourceLine": 666
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "娘の指が、差し出した彼の指を握る。ザキミヤはようやく妻を見る。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 667
      },
      {
        "kind": "dialogue",
        "speaker": "ザキミヤの妻",
        "text": "また行くんやろ",
        "portraitOwner": "minor-human-shared-event-silhouette",
        "portraitKind": "minor",
        "sourceLine": 668
      },
      {
        "kind": "dialogue",
        "speaker": "ザキミヤ",
        "text": "行く。でも帰る。今度は、待たせる日を数えさせん",
        "portraitOwner": "unit-zakimiya",
        "portraitKind": "major",
        "sourceLine": 669
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "無線に回収班の声。「エージェントCH-17、帰投しろ」。Mrs.チハが振り向く。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 670
      },
      {
        "kind": "dialogue",
        "speaker": "ババヤガ",
        "text": "チハ？",
        "portraitOwner": "unit-babayaga",
        "portraitKind": "major",
        "sourceLine": 671
      },
      {
        "kind": "dialogue",
        "speaker": "Mrs.チハ",
        "text": "私のこと。ここを出たら、全部話す",
        "portraitOwner": "unit-mrs-chiha",
        "portraitKind": "major",
        "sourceLine": 672
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が救出者を安全回廊経由で病院へ送り、Mrs.チハと共に追撃から離れる。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 673
      }
    ],
    "source": {
      "startLine": 659,
      "endLine": 674
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
      "startLine": 659,
      "endLine": 674
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
        "sourceLine": 679
      },
      {
        "kind": "dialogue",
        "speaker": "Mrs.チハ",
        "text": "ムガリアンの専属エージェントだった。あなたたちには、会社員だと嘘をついてた",
        "portraitOwner": "unit-mrs-chiha",
        "portraitKind": "major",
        "sourceLine": 680
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "何を回収してたんすか",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 681
      },
      {
        "kind": "dialogue",
        "speaker": "Mrs.チハ",
        "text": "物資と、外へ漏れた情報。発生前は、小さな区画で起こして収める事故だと聞かされた",
        "portraitOwner": "unit-mrs-chiha",
        "portraitKind": "major",
        "sourceLine": 682
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "狭かったら、人を噛ませてよかったんか",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 683
      },
      {
        "kind": "dialogue",
        "speaker": "Mrs.チハ",
        "text": "よくない。発生二日目に『損失は許容範囲』と読んでも、私は会社に残った",
        "portraitOwner": "unit-mrs-chiha",
        "portraitKind": "major",
        "sourceLine": 684
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "防爆扉が揺れる。彼女は床のカードを拾わない。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 685
      },
      {
        "kind": "dialogue",
        "speaker": "Mrs.チハ",
        "text": "中から避難車の道を変えた。消す予定だった名簿を紙に戻した。湾岸の十二人も隠した",
        "portraitOwner": "unit-mrs-chiha",
        "portraitKind": "major",
        "sourceLine": 686
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "それを、私たちに言わなかった",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 687
      },
      {
        "kind": "dialogue",
        "speaker": "Mrs.チハ",
        "text": "言えば疑われると思った。……でも、疑われて当然だった",
        "portraitOwner": "unit-mrs-chiha",
        "portraitKind": "major",
        "sourceLine": 688
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "ババヤガはカードではなく妻の顔を見る。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 689
      },
      {
        "kind": "dialogue",
        "speaker": "ババヤガ",
        "text": "俺が裏で人を撃っとったことも、知っとった？",
        "portraitOwner": "unit-babayaga",
        "portraitKind": "major",
        "sourceLine": 690
      },
      {
        "kind": "dialogue",
        "speaker": "Mrs.チハ",
        "text": "結婚する前から。最初は仕事で調べた。好きになってからも言えなかった",
        "portraitOwner": "unit-mrs-chiha",
        "portraitKind": "major",
        "sourceLine": 691
      },
      {
        "kind": "dialogue",
        "speaker": "ババヤガ",
        "text": "俺だけが隠しとるつもりやった。ずっと",
        "portraitOwner": "unit-babayaga",
        "portraitKind": "major",
        "sourceLine": 692
      },
      {
        "kind": "dialogue",
        "speaker": "Mrs.チハ",
        "text": "うん。だから許してとは言わない",
        "portraitOwner": "unit-mrs-chiha",
        "portraitKind": "major",
        "sourceLine": 693
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "主人公が認証カードを中央端末へ差す。内部記録を病院、区役所、外周へ送る画面で、実行キーから手を離した。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 694
      },
      {
        "kind": "dialogue",
        "speaker": "Mrs.チハ",
        "text": "押せば私のカードは焼ける。会社へ戻る道も消える",
        "portraitOwner": "unit-mrs-chiha",
        "portraitKind": "major",
        "sourceLine": 695
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が防爆扉を支え、実行キーの前をMrs.チハへ譲る。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 696
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "Mrs.チハが自分で押す。送信先が三つ点灯し、カードのICが焦げる。扉の向こうから帰投命令が響いた。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 697
      },
      {
        "kind": "dialogue",
        "speaker": "Mrs.チハ",
        "text": "聞こえた。もう、そっちへは帰らない",
        "portraitOwner": "unit-mrs-chiha",
        "portraitKind": "major",
        "sourceLine": 698
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "彼女はランチャーと拳銃を拾う。ババヤガは、その手元ではなく彼女の顔を見たまま、何も言わない。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 699
      },
      {
        "kind": "battle-marker",
        "speaker": "◆ BATTLE",
        "text": "追撃を退け、指揮車から本社塔の認証キーを奪え。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 700
      }
    ],
    "source": {
      "startLine": 678,
      "endLine": 701
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
        "sourceLine": 704
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "病院で私たちを見ていた回線と同じ署名です",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 705
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "セガワさん。これは何ですか",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 706
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "無線に返事が来るまで、長い間がある。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 707
      },
      {
        "kind": "dialogue",
        "speaker": "セガワの声",
        "text": "原本は技術開発塔にあります。そこへ来れば、全部見せます",
        "portraitOwner": null,
        "portraitKind": "offscreen",
        "sourceLine": 708
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "聞いとるのは、お前の口や",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 709
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "無線は切れない。ただ、セガワは答えない。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 710
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "ババヤガが弾倉をMrs.チハへ渡す。許したとは言わない。彼女も礼を言わず、受け取った。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 711
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が認証キーを抜き、技術開発塔へ向かう。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 712
      }
    ],
    "source": {
      "startLine": 703,
      "endLine": 713
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
      "startLine": 703,
      "endLine": 713
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
        "sourceLine": 718
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "社長の映像が点く。左袖の下に黒い血がにじんでいる。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 719
      },
      {
        "kind": "dialogue",
        "speaker": "ムガリアン社長",
        "text": "小さな危機を当社が収めれば、街は戻り、契約だけが残る。……そのはずでした",
        "portraitOwner": "mugarian-president",
        "portraitKind": "major",
        "sourceLine": 720
      },
      {
        "kind": "dialogue",
        "speaker": "ザキミヤ",
        "text": "小さな危機に、うちの娘も入ってたんか",
        "portraitOwner": "unit-zakimiya",
        "portraitKind": "major",
        "sourceLine": 721
      },
      {
        "kind": "dialogue",
        "speaker": "ムガリアン社長",
        "text": "あなたの娘を選んだ覚えはない。だが、西新を選んだのは私だ。ここまで広げる許可は出していない",
        "portraitOwner": "mugarian-president",
        "portraitKind": "major",
        "sourceLine": 722
      },
      {
        "kind": "dialogue",
        "speaker": "セガワの声",
        "text": "中央制御を切れば二体は連動しません。先に止めてください",
        "portraitOwner": null,
        "portraitKind": "offscreen",
        "sourceLine": 723
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "社長の映像と無線を切り、いくらちゃんが制御線を現物で確かめる。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 724
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "線はある。切れば二体が離れるかは、私たちで確かめる",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 725
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が切断箇所を確認し、隔壁の開放に備える。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 726
      },
      {
        "kind": "boss-marker",
        "speaker": "◆ BOSS",
        "text": "フタゴ",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 727
      },
      {
        "kind": "battle-marker",
        "speaker": "◆ BATTLE",
        "text": "制御を切り、二体の連携を崩して倒せ。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 728
      }
    ],
    "source": {
      "startLine": 717,
      "endLine": 729
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
        "sourceLine": 732
      },
      {
        "kind": "dialogue",
        "speaker": "Mrs.チハ",
        "text": "社長は噛まれてる。あの腕を見た",
        "portraitOwner": "unit-mrs-chiha",
        "portraitKind": "major",
        "sourceLine": 733
      },
      {
        "kind": "dialogue",
        "speaker": "セガワの声",
        "text": "未承認の処置薬を持っているはずです。使わせないでください",
        "portraitOwner": null,
        "portraitKind": "offscreen",
        "sourceLine": 734
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "あんたも、何を持っとるか後で聞く",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 735
      },
      {
        "kind": "dialogue",
        "speaker": "セガワの声",
        "text": "ええ",
        "portraitOwner": null,
        "portraitKind": "offscreen",
        "sourceLine": 736
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が昇降路に入り、仲間を呼ぶ。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 737
      }
    ],
    "source": {
      "startLine": 731,
      "endLine": 738
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
      "startLine": 731,
      "endLine": 738
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
        "sourceLine": 743
      },
      {
        "kind": "dialogue",
        "speaker": "ムガリアン社長",
        "text": "設備も薬も渡します。私の退路だけは保証してください",
        "portraitOwner": "mugarian-president",
        "portraitKind": "major",
        "sourceLine": 744
      },
      {
        "kind": "dialogue",
        "speaker": "Mrs.チハ",
        "text": "設備は残す。働く人も守る。でも、あなたを逃がす約束はできない",
        "portraitOwner": "unit-mrs-chiha",
        "portraitKind": "major",
        "sourceLine": 745
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "社長が膝をつく。黒い変色が肩まで上がり、彼は薬を抜く。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 746
      },
      {
        "kind": "dialogue",
        "speaker": "セガワの声",
        "text": "人間への試験は終わっていません。打てば感染組織が増えます",
        "portraitOwner": null,
        "portraitKind": "offscreen",
        "sourceLine": 747
      },
      {
        "kind": "dialogue",
        "speaker": "ムガリアン社長",
        "text": "じゃあ、私には何が残っている",
        "portraitOwner": "mugarian-president",
        "portraitKind": "major",
        "sourceLine": 748
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "誰も答えない。社長は針を自分の腕へ刺す。数秒だけ変色が止まり、彼が安堵した顔をしたところでガラスに亀裂が走る。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 749
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が仲間を退かせ、医療設備を守る位置へ出る。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 750
      },
      {
        "kind": "boss-marker",
        "speaker": "◆ BOSS",
        "text": "変異ムガリアン社長",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 751
      },
      {
        "kind": "battle-marker",
        "speaker": "◆ BATTLE",
        "text": "変異した社長を止め、薬と医療設備を守れ。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 752
      }
    ],
    "source": {
      "startLine": 742,
      "endLine": 753
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
        "sourceLine": 756
      },
      {
        "kind": "dialogue",
        "speaker": "ムガリアン社長",
        "text": "封鎖線は、九本あったのに……",
        "portraitOwner": "mugarian-president",
        "portraitKind": "major",
        "sourceLine": 757
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "その線の内側に人がおる。最初から見えてなかったんやろ",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 758
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "施設警報が静まる。病院へ、救出した人と薬が届いた知らせ。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 759
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "夜。仮設の炊き出しで、全員が紙コップの味噌汁を持つ。ザキミヤは妻子のそばで哺乳瓶を冷まし、いくらちゃんは片手で配車表を見ている。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 762,
        "sceneTag": "soup"
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "熱っ。……ちゃんと熱い",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 763,
        "sceneTag": "soup"
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "熱いなら、冷めるまで持っとけ",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 764,
        "sceneTag": "soup"
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "Mrs.チハは湯気の向こうにいる。ババヤガは何も聞かず、彼女の分の椀をテーブルの端へ寄せた。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 765,
        "sceneTag": "soup"
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "冷蔵車列の追跡信号が無線に入る。社長の台帳にはない車。湯気の向こうで、全員が顔を上げる。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 766,
        "sceneTag": "soup"
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が残りを飲み、冷蔵車列の行き先を地図に示す。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 767,
        "sceneTag": "soup"
      }
    ],
    "source": {
      "startLine": 755,
      "endLine": 768
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
      "startLine": 755,
      "endLine": 768
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
        "sourceLine": 773
      },
      {
        "kind": "dialogue",
        "speaker": "研究員の声",
        "text": "バスは通して！　止めるのは冷蔵車です。撤収台帳にありません",
        "portraitOwner": null,
        "portraitKind": "offscreen",
        "sourceLine": 774
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "さっきの配車表、空欄が一台ありました。私が付けた追跡タグ、まだ生きてる",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 775
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "さっき、味噌汁より見てたやつっすか",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 776
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "ええ。おかわり、後でできますかね",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 777
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "鍋は火に掛けとく。先に車を止めよう",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 778
      },
      {
        "kind": "dialogue",
        "speaker": "Mrs.チハ",
        "text": "あれは社長の命令じゃない。研究部門だけの私設回収",
        "portraitOwner": "unit-mrs-chiha",
        "portraitKind": "major",
        "sourceLine": 779
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が社員バスを先に通し、冷蔵車へ進路を切る。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 780
      },
      {
        "kind": "battle-marker",
        "speaker": "◆ BATTLE",
        "text": "民間車両を巻き込まず、冷蔵車列を止めよ。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 781
      }
    ],
    "source": {
      "startLine": 772,
      "endLine": 782
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
        "sourceLine": 785
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "区役所で戻った時の俺まで写ってる。……あの人も、この写真にいるのに",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 786
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "いくらちゃんは写真を伏せる。薬局で自分が笑った瞬間にも、時刻と観察番号が振られている。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 787
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "あの時も、見てたんですね",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 788
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "セガワ。薬を届けてくれた時からか",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 789
      },
      {
        "kind": "dialogue",
        "speaker": "セガワの声",
        "text": "はい。薬に細工はしていません。助けた人たちも、そのまま家へ帰しました",
        "portraitOwner": null,
        "portraitKind": "offscreen",
        "sourceLine": 790
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "それを先に言うな。今聞いとるのは、何をしたかや",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 791
      },
      {
        "kind": "dialogue",
        "speaker": "セガワの声",
        "text": "何を選ぶか、記録していました。謝って済むことではありません",
        "portraitOwner": null,
        "portraitKind": "offscreen",
        "sourceLine": 792
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "主人公が通信を切る。紙の搬送命令書の裏に、会社台帳にない研究区画の座標と、セガワの署名。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 793
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が物理原本を押収し、自分の地図へ座標を写す。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 794
      }
    ],
    "source": {
      "startLine": 784,
      "endLine": 795
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
      "startLine": 784,
      "endLine": 795
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
        "sourceLine": 800
      },
      {
        "kind": "system",
        "speaker": "■ SYSTEM",
        "text": "SPECIAL OPERATIONS UNIT：RED PANTHER",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 801
      },
      {
        "kind": "dialogue",
        "speaker": "Mrs.チハ",
        "text": "研究部門の直轄。社長より特級博士の命令を優先する",
        "portraitOwner": "unit-mrs-chiha",
        "portraitKind": "major",
        "sourceLine": 802
      },
      {
        "kind": "dialogue",
        "speaker": "RED PANTHER隊長",
        "text": "セガワ特級博士の命令だ。ここから先へは通さない",
        "portraitOwner": "red-panther-commander",
        "portraitKind": "major",
        "sourceLine": 803
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "セガワさんが来いって言ったんすよ。通せよ",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 804
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "隊長は銃口を下げない。主人公は押収した命令書を示し、返答を待つ。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 805
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が仲間を遮蔽物へ移し、前進する。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 806
      },
      {
        "kind": "battle-marker",
        "speaker": "◆ BATTLE",
        "text": "RED PANTHERの封鎖を突破せよ。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 807
      }
    ],
    "source": {
      "startLine": 799,
      "endLine": 808
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
        "sourceLine": 811
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "なんで、うちの街やった",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 812
      },
      {
        "kind": "dialogue",
        "speaker": "セガワの声",
        "text": "歩ける距離に病院、駅、役所、住宅がある。逃げ道も、助けに戻る道も、同時に見える",
        "portraitOwner": null,
        "portraitKind": "offscreen",
        "sourceLine": 813
      },
      {
        "kind": "dialogue",
        "speaker": "ザキミヤ",
        "text": "俺の娘が寝とった街を、実験にちょうどええと思ったんか",
        "portraitOwner": "unit-zakimiya",
        "portraitKind": "major",
        "sourceLine": 814
      },
      {
        "kind": "dialogue",
        "speaker": "セガワの声",
        "text": "ええ",
        "portraitOwner": null,
        "portraitKind": "offscreen",
        "sourceLine": 815
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "別の映像には、西新の防衛線で倒したTAKUYAの遺骸を回収する赤レンズ部隊。再生処置の記録が続く。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 816
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "あの日、終わったと思ってた",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 817
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "終わらせなかった人がいる",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 818
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が映像を止め、次の管制室へ進む。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 819
      }
    ],
    "source": {
      "startLine": 810,
      "endLine": 820
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
      "startLine": 810,
      "endLine": 820
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
        "sourceLine": 825
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "まだ動いてない。ここで止めれば、街には届きません",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 826
      },
      {
        "kind": "dialogue",
        "speaker": "ザキミヤ",
        "text": "西新の次に、誰の家のそばで撒くつもりや",
        "portraitOwner": "unit-zakimiya",
        "portraitKind": "major",
        "sourceLine": 827
      },
      {
        "kind": "dialogue",
        "speaker": "セガワの声",
        "text": "西新の水は、何度調べても基準を超えた。報告書では、毎年『一時的』で片づけられました",
        "portraitOwner": null,
        "portraitKind": "offscreen",
        "sourceLine": 828
      },
      {
        "kind": "dialogue",
        "speaker": "TKY",
        "text": "それ書いたやつを止めろよ。なんで街へ撒く",
        "portraitOwner": "unit-tky",
        "portraitKind": "major",
        "sourceLine": 829
      },
      {
        "kind": "dialogue",
        "speaker": "セガワの声",
        "text": "何年訴えても、工場は一日も止まらなかった。西新に撒いたら三日で止まった。逃げた人が戻るかも、あそこで見たかった",
        "portraitOwner": null,
        "portraitKind": "offscreen",
        "sourceLine": 830
      },
      {
        "kind": "dialogue",
        "speaker": "ザキミヤ",
        "text": "それで、うちの娘にも撒くんか",
        "portraitOwner": "unit-zakimiya",
        "portraitKind": "major",
        "sourceLine": 831
      },
      {
        "kind": "dialogue",
        "speaker": "セガワの声",
        "text": "……あの子に罪はありません",
        "portraitOwner": null,
        "portraitKind": "offscreen",
        "sourceLine": 832
      },
      {
        "kind": "dialogue",
        "speaker": "ザキミヤ",
        "text": "知っとるなら、その手を止めろ。風は子どもを選ばん",
        "portraitOwner": "unit-zakimiya",
        "portraitKind": "major",
        "sourceLine": 833
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "セガワは答えない。最初の保護カバーが閉まり始める。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 834
      },
      {
        "kind": "dialogue",
        "speaker": "宮本武蔵",
        "text": "治すと称して民を斬る。いつの世も、言葉は変わらぬな",
        "portraitOwner": "unit-miyamoto-musashi",
        "portraitKind": "major",
        "sourceLine": 835
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公がカバーを開き、物理停止レバーへ手を伸ばす。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 836
      },
      {
        "kind": "battle-marker",
        "speaker": "◆ BATTLE",
        "text": "国内の散布装置を物理停止せよ。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 837
      }
    ],
    "source": {
      "startLine": 824,
      "endLine": 838
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
        "sourceLine": 841
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "ここから出す分は止めた。それは言い切れます",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 842
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "地下への扉に三つの表示。「国外一斉起動」「感染源原株」「T-03最終収容区」。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 843
      },
      {
        "kind": "dialogue",
        "speaker": "Mrs.チハ",
        "text": "外へ出る回線と原株を先に潰す。T-03の扉は、開けさせない",
        "portraitOwner": "unit-mrs-chiha",
        "portraitKind": "major",
        "sourceLine": 844
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が仲間の位置を確かめ、地下扉を開ける。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 845
      }
    ],
    "source": {
      "startLine": 840,
      "endLine": 846
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
      "startLine": 840,
      "endLine": 846
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
        "sourceLine": 851
      },
      {
        "kind": "dialogue",
        "speaker": "セガワ",
        "text": "区役所では、救援車を出す方が生存率は高かった。あなたたちは戻った",
        "portraitOwner": "segawa",
        "portraitKind": "major",
        "sourceLine": 852
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "あの人を乗せて出した。その数字も書いとけ",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 853
      },
      {
        "kind": "dialogue",
        "speaker": "セガワ",
        "text": "書きました。あなたたちなら次も戻るのか、確かめたかった",
        "portraitOwner": "segawa",
        "portraitKind": "major",
        "sourceLine": 854
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "主人公はセガワのいるガラス室を見ず、起動回線と原株の位置を仲間へ示す。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 855
      },
      {
        "kind": "dialogue",
        "speaker": "Mrs.チハ",
        "text": "人を測るのは終わり。回線を切ってから、あなたを止める",
        "portraitOwner": "unit-mrs-chiha",
        "portraitKind": "major",
        "sourceLine": 856
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "回線が先。原株も残せません。両方やります！",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 857
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が国外回線の前へ隊列を組み、原株への通路を確認する。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 858
      },
      {
        "kind": "battle-marker",
        "speaker": "◆ BATTLE",
        "text": "国外起動回線を止め、続いて感染源原株を破壊せよ。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 859
      }
    ],
    "source": {
      "startLine": 850,
      "endLine": 860
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
        "sourceLine": 863
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "ここから外へ出す予定線は、全部止まった。返事のない土地のことは、まだ分からない",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 864
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "ガラス室でセガワが物理鍵を回す。拘束具の外れる音が地下から響き、彼は非常通路へ消える。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 865
      },
      {
        "kind": "dialogue",
        "speaker": "セガワの声",
        "text": "西新へ戻ってください。まだ、終わっていない",
        "portraitOwner": null,
        "portraitKind": "offscreen",
        "sourceLine": 866
      },
      {
        "kind": "system",
        "speaker": "■ SYSTEM",
        "text": "T-03／最終強化形態／個体名：TAKUYA-Ω",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 867
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "画面に、投薬管と鎖で拘束されたTAKUYA。進路は西新の安全回廊。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 868
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "避難してる人の方へ、向かってる",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 869
      },
      {
        "kind": "dialogue",
        "speaker": "セガワの声",
        "text": "あなたたちが道を開けた。人はそこへ集まる",
        "portraitOwner": null,
        "portraitKind": "offscreen",
        "sourceLine": 870
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が車両の鍵を取り、崩れた研究区画を迂回して西新へ戻る。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 871
      }
    ],
    "source": {
      "startLine": 862,
      "endLine": 872
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
      "startLine": 862,
      "endLine": 872
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
        "sourceLine": 877
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "頬の傷、後ろへ流した淡い髪、黒い防護眼鏡。縫合痕のある裸の胸を、かつての黒い拘束帯が斜めに走る。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 878
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "異様に肥大した片腕に縫合痕が走る。首から垂れた黒い鎖が揺れ、背の投薬管が脈打つ。剣とも槌ともつかない大刃が路面を削る。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 879
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "あの傷……TAKUYAさんだ。あの夜、俺らが止めた人っす",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 880
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "主人公が装甲車両を防壁の切れ目へ寄せ、待機路への入口を塞ぐ。離れたゲート脇では、セガワが指揮車を降り、携帯発信器を掲げた。いくらちゃんが見えないバスの監視映像を車内の画面へ送る。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 881
      },
      {
        "kind": "dialogue",
        "speaker": "セガワ",
        "text": "停止",
        "portraitOwner": "segawa",
        "portraitKind": "major",
        "sourceLine": 882
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "巨体が止まる。セガワが発信器を主人公たちへ向ける。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 883
      },
      {
        "kind": "dialogue",
        "speaker": "セガワ",
        "text": "前方の部隊を除去",
        "portraitOwner": "segawa",
        "portraitKind": "major",
        "sourceLine": 884
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃんの声",
        "text": "バス、あと三台。まだ後ろに人がいます！",
        "portraitOwner": null,
        "portraitKind": "offscreen",
        "sourceLine": 885
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公がセガワを追わず、TAKUYA-Ωと待機路への入口の間へ立つ。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 886
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "制御音が高くなる。TAKUYA-Ωは主人公たちではなく、音の出る手へ向きを変えた。発信器が大刃の下で砕ける。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 887
      },
      {
        "kind": "dialogue",
        "speaker": "セガワ",
        "text": "停止。命令対象は、前だ",
        "portraitOwner": "segawa",
        "portraitKind": "major",
        "sourceLine": 888
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "RED PANTHERの隊員が撃つ。弾は装甲で火花を散らし、大刃が指揮車の前を薙ぐ。セガワはなお、壊れた発信器のボタンを押した。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 889
      },
      {
        "kind": "dialogue",
        "speaker": "セガワ",
        "text": "寄るな。私は、お前を――",
        "portraitOwner": "segawa",
        "portraitKind": "major",
        "sourceLine": 890
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "肥大した手がセガワをつかみ、指揮車へ叩きつける。握りしめていた発信器の欠片が路面へ落ちた。セガワは動かない。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 891
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "防壁の切れ目へ感染群が流れ込む。その奥でTAKUYA-Ωが待機路のバスへ向きを変え、ゆっくり歩き出す。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 892
      },
      {
        "kind": "dialogue",
        "speaker": "ザキミヤ",
        "text": "あのバスが抜けるまで、俺は退かん",
        "portraitOwner": "unit-zakimiya",
        "portraitKind": "major",
        "sourceLine": 893
      },
      {
        "kind": "dialogue",
        "speaker": "TKY",
        "text": "門を開けて、病院までつないだんや。ここで切らせへん",
        "portraitOwner": "unit-tky",
        "portraitKind": "major",
        "sourceLine": 894
      },
      {
        "kind": "dialogue",
        "speaker": "Mrs.チハ",
        "text": "後ろの管が、再生を支えている。狙える時に狙って",
        "portraitOwner": "unit-mrs-chiha",
        "portraitKind": "major",
        "sourceLine": 895
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "{{PLAYER_NAME}}、群れが先や。バスが抜けるまで、ここを空けるな",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 896
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "TAKUYA！　あの日も怖かった。今も怖えよ！　……それでも、あのバスには指一本触れさせねえ！",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 897
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が仲間の配置を確かめ、まず感染群の前へ出る。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 898
      },
      {
        "kind": "boss-marker",
        "speaker": "◆ BOSS",
        "text": "TAKUYA-Ω",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 899
      },
      {
        "kind": "battle-marker",
        "speaker": "◆ BATTLE",
        "text": "TAKUYA-Ωを倒し、避難バスと安全回廊を守れ。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 900
      }
    ],
    "source": {
      "startLine": 876,
      "endLine": 901
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
        "sourceLine": 906,
        "sceneTag": "defeat"
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "再生反応、ゼロ。……もう一回測っても、ゼロです",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 907,
        "sceneTag": "defeat"
      },
      {
        "kind": "dialogue",
        "speaker": "研究員の声",
        "text": "焼く前に、背中の投薬管、血液、骨髄を採ってください。中和因子が残っています",
        "portraitOwner": null,
        "portraitKind": "offscreen",
        "sourceLine": 908,
        "sceneTag": "defeat"
      },
      {
        "kind": "dialogue",
        "speaker": "Mrs.チハ",
        "text": "人に使えるの？",
        "portraitOwner": "unit-mrs-chiha",
        "portraitKind": "major",
        "sourceLine": 909,
        "sceneTag": "defeat"
      },
      {
        "kind": "dialogue",
        "speaker": "研究員の声",
        "text": "まだ分からない。初期感染を止める材料になるかもしれない。検査は病院で",
        "portraitOwner": null,
        "portraitKind": "offscreen",
        "sourceLine": 910,
        "sceneTag": "defeat"
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が三種の試料を密閉し、回収を確認して残りの組織に火を入れる。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 911,
        "sceneTag": "defeat"
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "最後の避難バスが安全回廊へ入る。いくらちゃんの地図から、大型反応が消えた。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 914,
        "sceneTag": "cleared"
      },
      {
        "kind": "dialogue",
        "speaker": "ザキミヤ",
        "text": "帰ろう。娘に、今日は遅くなるって言ってない",
        "portraitOwner": "unit-zakimiya",
        "portraitKind": "major",
        "sourceLine": 915,
        "sceneTag": "cleared"
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が通行止めの標識を外し、西新側へ倒す。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 916,
        "sceneTag": "cleared"
      }
    ],
    "source": {
      "startLine": 903,
      "endLine": 917
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
      "startLine": 903,
      "endLine": 917
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
        "sourceLine": 922,
        "sceneTag": "dawn"
      },
      {
        "kind": "dialogue",
        "speaker": "宮本武蔵",
        "text": "我が行くのは、こちららしい",
        "portraitOwner": "unit-miyamoto-musashi",
        "portraitKind": "major",
        "sourceLine": 923,
        "sceneTag": "dawn"
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が歩み寄る。武蔵は礼をして、煙の向こうへ進む。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 924,
        "sceneTag": "dawn"
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "搬送車が一台横切る。通過後、そこに武蔵の姿はない。主人公はしばらく道を見てから病院へ向く。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 925,
        "sceneTag": "dawn"
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "数日後。医師と研究員が、採取した中和因子を別々の検査器で確かめる。初期感染者の同意を得て、少量を投与する。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 928,
        "sceneTag": "hospital"
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "一時間、六時間、二十四時間。腕の変色は広がらない。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 929,
        "sceneTag": "hospital"
      },
      {
        "kind": "dialogue",
        "speaker": "女性駅員",
        "text": "もう、戻らないんですか",
        "portraitOwner": "minor-human-shared-event-silhouette",
        "portraitKind": "minor",
        "sourceLine": 930,
        "sceneTag": "hospital"
      },
      {
        "kind": "dialogue",
        "speaker": "医師",
        "text": "今は止まっています。治ったと言うには、まだ早い",
        "portraitOwner": "minor-human-shared-event-silhouette",
        "portraitKind": "minor",
        "sourceLine": 931,
        "sceneTag": "hospital"
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "でも、明日を待てるんやね",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 932,
        "sceneTag": "hospital"
      },
      {
        "kind": "dialogue",
        "speaker": "医師",
        "text": "ええ。明日、もう一度確かめられます",
        "portraitOwner": "minor-human-shared-event-silhouette",
        "portraitKind": "minor",
        "sourceLine": 933,
        "sceneTag": "hospital"
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "連絡室では、いくらちゃんが西新の外へ呼びかける。返事のない回線にも時刻を記録し、翌日また呼ぶ。区役所で拾ったラジオは、今も机の端にある。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 936,
        "sceneTag": "signal"
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "くまやの裏口。ババヤガとMrs.チハが、別々の武器を同じ机で整備している。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 939,
        "sceneTag": "kumaya"
      },
      {
        "kind": "dialogue",
        "speaker": "ババヤガ",
        "text": "全部聞くって言った",
        "portraitOwner": "unit-babayaga",
        "portraitKind": "major",
        "sourceLine": 940,
        "sceneTag": "kumaya"
      },
      {
        "kind": "dialogue",
        "speaker": "Mrs.チハ",
        "text": "一晩では終わらない",
        "portraitOwner": "unit-mrs-chiha",
        "portraitKind": "major",
        "sourceLine": 941,
        "sceneTag": "kumaya"
      },
      {
        "kind": "dialogue",
        "speaker": "ババヤガ",
        "text": "なら、明日も聞く",
        "portraitOwner": "unit-babayaga",
        "portraitKind": "major",
        "sourceLine": 942,
        "sceneTag": "kumaya"
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "Mrs.チハが頷く。二人は手を動かし続ける。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 943,
        "sceneTag": "kumaya"
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "{{PLAYER_NAME}}、明日はくまやのガスを見に来てくれ。暖簾も掛け直す",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 944,
        "sceneTag": "kumaya"
      }
    ],
    "source": {
      "startLine": 919,
      "endLine": 945
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
        "sourceLine": 950
      },
      {
        "kind": "montage",
        "speaker": null,
        "sceneLabel": "早良区役所",
        "text": "紙の名簿へ帰還者の名前が書き足される。空欄も消さない。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 951
      },
      {
        "kind": "montage",
        "speaker": null,
        "sceneLabel": "西新駅",
        "text": "列車は止まったまま。改札の灯りだけが、人の歩く道を照らす。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 952
      },
      {
        "kind": "montage",
        "speaker": null,
        "sceneLabel": "大学病院",
        "text": "試作血清が少量だけ冷蔵庫へ入る。翌日の検査予定が隣に貼られる。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 953
      },
      {
        "kind": "montage",
        "speaker": null,
        "sceneLabel": "河口防潮門",
        "text": "クレイジーキングの台車から交代の見張りへ缶詰が届く。門は閉じたまま。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 954
      },
      {
        "kind": "montage",
        "speaker": null,
        "sceneLabel": "ムガリアン施設",
        "text": "企業標章を覆い、救出した技術者が医療設備を再起動する。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 955
      },
      {
        "kind": "montage",
        "speaker": null,
        "sceneLabel": "RED PANTHER装備庫",
        "text": "赤いレンズと焼けた認証カードが、それぞれ証拠袋へ入る。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 956
      },
      {
        "kind": "montage",
        "speaker": null,
        "sceneLabel": "ザキミヤ",
        "text": "手を洗い、妻から娘を受け取る。腰の瓶の代わりにおむつを持つ。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 957
      },
      {
        "kind": "montage",
        "speaker": null,
        "sceneLabel": "装甲車両",
        "text": "色の違う新しい装甲板が付く。車内の地図には街の外へ一本の線。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 958
      },
      {
        "kind": "montage",
        "speaker": null,
        "sceneLabel": "TAKUYA撃破地点",
        "text": "撤去した標識の跡に、見張りの当番表が立つ。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 959
      },
      {
        "kind": "montage",
        "speaker": null,
        "sceneLabel": "くまや",
        "text": "{{PLAYER_NAME}}とクマバーソンが厨房のガス栓を開く。青い火が点く。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 960
      }
    ],
    "source": {
      "startLine": 947,
      "endLine": 961
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
        "sourceLine": 964
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "主人公が暖簾をくぐる。パイセンが席の荷物を急いでどける。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 965
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "{{PLAYER_NAME}}さん、こっち空いてます",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 966
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "そこは最初から空けとった",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 967
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が席に着く。マヨちゃんが足元を一周して伏せる。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 968
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "ザキミヤの妻が娘を寝かせる。ザキミヤが「静かに」と言い、一番大きな声になった。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 969
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "ババヤガが牛乳を持って入る。Mrs.チハは受け取り、冷蔵庫を指す。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 970
      },
      {
        "kind": "dialogue",
        "speaker": "Mrs.チハ",
        "text": "今度は忘れなかったね",
        "portraitOwner": "unit-mrs-chiha",
        "portraitKind": "major",
        "sourceLine": 971
      },
      {
        "kind": "dialogue",
        "speaker": "ババヤガ",
        "text": "だいぶ待たせたな",
        "portraitOwner": "unit-babayaga",
        "portraitKind": "major",
        "sourceLine": 972
      },
      {
        "kind": "dialogue",
        "speaker": "Mrs.チハ",
        "text": "残りの話も、忘れないで",
        "portraitOwner": "unit-mrs-chiha",
        "portraitKind": "major",
        "sourceLine": 973
      },
      {
        "kind": "dialogue",
        "speaker": "ババヤガ",
        "text": "忘れん",
        "portraitOwner": "unit-babayaga",
        "portraitKind": "major",
        "sourceLine": 974
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "いくらちゃんの無線は静かだ。壁の地図には、西新の外へ伸びる未確認の道が一本。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 975
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "{{PLAYER_NAME}}、何食う？",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 976
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が唐揚げを指す。クマバーソンは頷き、油の温度を確かめる。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 977
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "俺も一皿、追加で",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 978
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "まず自分のを食え",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 979
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "主人公の前へ烏龍茶が置かれる。外に停めた装甲車両は、今夜は動かない。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 980
      },
      {
        "kind": "title",
        "speaker": null,
        "text": "西新世紀末物語",
        "portraitOwner": null,
        "portraitKind": "title",
        "sourceLine": 981
      }
    ],
    "source": {
      "startLine": 963,
      "endLine": 984
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
