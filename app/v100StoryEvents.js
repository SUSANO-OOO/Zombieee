// Generated from the canonical v10 story source. Do not hand-edit.
import { V100_EVENT_IDS, V100_EVENT_BY_ID, renderV100PlayerName } from "./v100Registry.js";

export const V100_STORY_SOURCE_SHA256 = "c7293d739998431c38f337a7ef8d4e724b74696537ff44ad8f0c30d854a017a4";
export const V100_STORY_SOURCE_LINE_COUNT = 2681;
export const V100_STORY_SCRIPT_VERSION = "v10-final-release";

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
        "text": "雨上がり。暖簾から落ちた雫が、引き戸の前で小さく跳ねる。大衆居酒屋「くまや」では、店主のクマバーソンが厨房でフライパンを振り、常連席ではパイセンとババヤガが主人公を待っている。クマバーソン一家のチワワ、マヨちゃんは足元で丸くなっている。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 167
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "壁のテレビでは、ムガリアン製薬の企業広告。「医薬品から災害物流、検疫設備まで」の文字に続き、市の防災事業パートナーであることを示す西新の街並み。最後に、上質なスーツの社長が笑顔で映る。客の誰も見ていない。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 169
      },
      {
        "kind": "system",
        "speaker": "■ SYSTEM",
        "text": "主人公名入力：**{{PLAYER_NAME}}**",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 171
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "主人公が引き戸を開ける。カウンターの端で、パイセンが空のグラスを掲げる。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 173
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "遅かったな。唐揚げ、あと二個しか残っとらんぞ",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 175
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "俺が守った二個っす。感謝して食べてください",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 177
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "主人公がパイセンの前に積まれた三枚の小皿を見る。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 179
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "守ったやつの皿じゃないやろ、それ",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 181
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "証拠ないっすよね",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 183
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が車のキーを卓上へ置き、烏龍茶を持ち上げる。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 185
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "今日、車っすよね。帰り、お願いしていいっすか",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 187
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "来て十秒で帰りの話すんな",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 189
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "先に席を取るの、大事じゃないっすか",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 191
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "ババヤガの携帯が短く震える。画面には、妻のMrs.チハから届いた「牛乳」の二文字。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 193
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "新婚の連絡、牛乳だけなんすか",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 195
      },
      {
        "kind": "dialogue",
        "speaker": "ババヤガ",
        "text": "必要事項は二文字で足りるけん。市場も夫婦も、長文になったら下がる",
        "portraitOwner": "unit-babayaga",
        "portraitKind": "major",
        "sourceLine": 197
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "何が",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 199
      },
      {
        "kind": "dialogue",
        "speaker": "ババヤガ",
        "text": "信用",
        "portraitOwner": "unit-babayaga",
        "portraitKind": "major",
        "sourceLine": 201
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "証券マンが夫婦まで相場で話すの、やめた方がいいっすよ。あと牛乳忘れてます",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 203
      },
      {
        "kind": "dialogue",
        "speaker": "ババヤガ",
        "text": "まだ忘れてない。閉店までに買えんかったら、その時点で忘れたことになる",
        "portraitOwner": "unit-babayaga",
        "portraitKind": "major",
        "sourceLine": 205
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "店内の携帯が、ほぼ同時に鳴る。テレビの画面が緊急速報へ切り替わる。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 207
      },
      {
        "kind": "system",
        "speaker": "■ SYSTEM",
        "text": "早良区内で複数の傷害事案。不要不急の外出を控えてください。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 209
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "……ここ、早良区っすよね",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 211
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "外で何かが倒れる。続いて、引き戸を叩く音。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 213
      },
      {
        "kind": "dialogue",
        "speaker": "男の声",
        "text": "開けて！　頼む、開けてくれ！",
        "portraitOwner": null,
        "portraitKind": "offscreen",
        "sourceLine": 215
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "主人公が立つ。クマバーソンが厨房のフライパンを掴む。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 217
      },
      {
        "kind": "dialogue",
        "speaker": "ババヤガ",
        "text": "声は一人。足音は三人分",
        "portraitOwner": "unit-babayaga",
        "portraitKind": "major",
        "sourceLine": 219
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "じゃ、開けない方が――",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 221
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が入口脇の椅子をどけ、引き戸へ手を掛ける。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 223
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "開けたら、すぐ閉めるぞ。パイセン、客を奥へ",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 225
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "俺が奥っすか",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 227
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "戸が細く開く。血まみれの男が転がり込み、その背後から別の人影がガラスへ衝突する。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 229
      },
      {
        "kind": "dialogue",
        "speaker": "男",
        "text": "噛まれた。人に……人に噛まれた",
        "portraitOwner": "minor-human-shared-event-silhouette",
        "portraitKind": "minor",
        "sourceLine": 231
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "腕見せて。まだ喋れるな",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 233
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "通りの先でパトカーが横転する。倒れていた警官が、不自然な角度で起き上がる。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 235
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "警察、ですよね。あれ",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 237
      },
      {
        "kind": "dialogue",
        "speaker": "ババヤガ",
        "text": "制服だけはね。中身は、もう違う",
        "portraitOwner": "unit-babayaga",
        "portraitKind": "major",
        "sourceLine": 239
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "噛まれた男の指が床を掻く。呼吸が止まり、次の瞬間、主人公へ飛びつく。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 241
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が椅子を間へ差し込み、男の顎を受け止める。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 243
      },
      {
        "kind": "dialogue",
        "speaker": "ババヤガ",
        "text": "下がって",
        "portraitOwner": "unit-babayaga",
        "portraitKind": "major",
        "sourceLine": 245
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "ババヤガが消火器を噴射する。白煙の中、クマバーソンがフライパンで男を押し倒す。入口のガラスへ亀裂が走る。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 247
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "裏口！　動ける客から出すぞ！",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 249
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "はい！",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 251
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "パイセンは声を裏返しながらも、座り込んだ客の肩を抱いて立たせる。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 253
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が最後の客を勝手口へ通し、壊れかけた戸を厨房台で塞ぐ。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 255
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "マヨちゃんが白煙の下を抜けて勝手口へ走る。クマバーソンが四人と一匹を数え、最後に厨房を出る。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 257
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "油の音が止まる。暗転。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 259
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "放置された大型の災害対応装甲車両。ボンネットには乾いた血、荷室には毛布と水。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 265
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "これ、動くんすか。動いたとして、誰が運転するんすか",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 267
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "主人公が運転席へ乗り、キーのない始動盤を確かめる。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 269
      },
      {
        "kind": "dialogue",
        "speaker": "ババヤガ",
        "text": "配線を二本だけ繋げば動く。三本繋ぐと、たぶん燃える",
        "portraitOwner": "unit-babayaga",
        "portraitKind": "major",
        "sourceLine": 271
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "どっちがどっち",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 273
      },
      {
        "kind": "dialogue",
        "speaker": "ババヤガ",
        "text": "今から市場調査",
        "portraitOwner": "unit-babayaga",
        "portraitKind": "major",
        "sourceLine": 275
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "命を賭けた言い方を、格好よくするのやめません？",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 277
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が整備箱から非常始動キーを見つけ、差し込む。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 279
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "エンジンが低く唸る。三人が主人公を見る。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 281
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "正規ルートあったんやな",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 283
      },
      {
        "kind": "dialogue",
        "speaker": "ババヤガ",
        "text": "なら、期待値は上がった",
        "portraitOwner": "unit-babayaga",
        "portraitKind": "major",
        "sourceLine": 285
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "装甲車両の側面は傷だらけになっている。この四十日あまり、四人は外周の避難所を移りながら、生存者を拾い、通れる道を一本ずつ探してきた。地図の上では、西新へ通じる道のほとんどに赤い線。行政の一斉放送は二週間前に途絶え、福岡の外へ送った無線にも返事はない。日本のどこまで崩れたのか、誰にも分からない。拾えるのは、短い救難とノイズだけ。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 289
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "四十三日っすよ。帰るって言ってから",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 291
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "帰れんかったんやない。帰る道を作りよった",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 293
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "ババヤガは、圏外のままのMrs.チハの連絡先を一度だけ開き、画面を伏せる。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 295
      },
      {
        "kind": "dialogue",
        "speaker": "ババヤガ",
        "text": "最後の基地局が止まって、十一日。生きとるなら、湾岸側",
        "portraitOwner": "unit-babayaga",
        "portraitKind": "major",
        "sourceLine": 297
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "その言い方、怖くないんすか",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 299
      },
      {
        "kind": "dialogue",
        "speaker": "ババヤガ",
        "text": "怖いけん、数字にしよる",
        "portraitOwner": "unit-babayaga",
        "portraitKind": "major",
        "sourceLine": 301
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "クマバーソンが地図の「くまや」に丸を付ける。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 303
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "店が残っとるかは知らん。人がおるなら、先にそっち",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 305
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が西新商店街の入口へ、新しい進入線を引く。装甲車両のキーを取る。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 307
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "……帰りますか",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 309
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "帰るぞ。生きとるやつ連れて",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 311
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "装甲車両のヘッドライトが点く。西新の暗い街並みが、雨の向こうに浮かぶ。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 313
      }
    ],
    "source": {
      "startLine": 164,
      "endLine": 314
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
        "text": "商店街入口。シャッターの下りた店が続く。薬局二階の窓から、白いタオルが二度振られる。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 324
      },
      {
        "kind": "dialogue",
        "speaker": "女の声",
        "text": "そこの、ごっつい車。聞こえてたらライト一回だけお願い",
        "portraitOwner": null,
        "portraitKind": "offscreen",
        "sourceLine": 326
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公がヘッドライトを一度だけ点滅させる。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 328
      },
      {
        "kind": "dialogue",
        "speaker": "女の声",
        "text": "通じた。ちょっと好きになりました",
        "portraitOwner": null,
        "portraitKind": "offscreen",
        "sourceLine": 330
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "展開早くないっすか",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 332
      },
      {
        "kind": "dialogue",
        "speaker": "女の声",
        "text": "二階に四人。足を怪我したおじいちゃんが一人。私は五人目",
        "portraitOwner": null,
        "portraitKind": "offscreen",
        "sourceLine": 334
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "最初から五人って言え",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 336
      },
      {
        "kind": "dialogue",
        "speaker": "女の声",
        "text": "人数多いと、助けに来てくれる確率が下がるかなって。可愛く省略しました",
        "portraitOwner": null,
        "portraitKind": "offscreen",
        "sourceLine": 338
      },
      {
        "kind": "dialogue",
        "speaker": "ババヤガ",
        "text": "下の感染巣を薬局ごと焼けば、救助後の消毒は要らん",
        "portraitOwner": "unit-babayaga",
        "portraitKind": "major",
        "sourceLine": 340
      },
      {
        "kind": "dialogue",
        "speaker": "女の声",
        "text": "あ、好きになったの一回取り消します",
        "portraitOwner": null,
        "portraitKind": "offscreen",
        "sourceLine": 342
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "焼かん。裏の非常階段まで道を作る",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 344
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "薬局の入口で、棚を巻き込んだ感染組織が脈打つ。奥から複数の感染者。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 346
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "あれ抜けて、階段までっすか",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 348
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が装甲車両の扉を開け、予備の鉄パイプをパイセンへ差し出す。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 350
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "いや、確認しただけなんすけど……",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 352
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "二階の窓で、女が負傷者を庇いながら消火器を構える。感染者が階段を上り始める。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 354
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "もう、いいよ！　来いよ！",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 356
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "声だけ置いて行くな。足も出せ！",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 358
      },
      {
        "kind": "battle-marker",
        "speaker": "◆ BATTLE",
        "text": "感染拠点を破壊し、非常階段を確保せよ。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 360
      }
    ],
    "source": {
      "startLine": 323,
      "endLine": 361
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
        "text": "薬局二階。主人公が負傷した老人を背負って階段を下りる。最後に、携帯端末と小型アンテナを抱えた女性が出てくる。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 364
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "助かりました。いくらです。さっき好きになった人、名前は？",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 366
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "主人公が自分を指し、装甲車両の名札を見せる。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 368
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "**{{PLAYER_NAME}}**さん。覚えた。こっちは焼却案の人",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 370
      },
      {
        "kind": "dialogue",
        "speaker": "ババヤガ",
        "text": "ババヤガ",
        "portraitOwner": "unit-babayaga",
        "portraitKind": "major",
        "sourceLine": 372
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "名前も強い。薬局は焼かないでくださいね",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 374
      },
      {
        "kind": "dialogue",
        "speaker": "ババヤガ",
        "text": "収益性がないけん、もう焼かん",
        "portraitOwner": "unit-babayaga",
        "portraitKind": "major",
        "sourceLine": 376
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "そこ、善意じゃないんすね",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 378
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "いくらちゃんが救出者の毛布を直し、老人の手へ水を渡す。笑顔のまま、声だけを少し落とす。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 380
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "区役所に避難車が一台残ってます。さっきまで無線が生きてた。動けない人を乗せてるって",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 382
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "案内できる？",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 384
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "できます。基地局が死んでても、死んだふりしてる機械は結構あるので",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 386
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "薬品棚の裏から、行政支援物資のラベルを貼った未開封箱が見つかる。箱の隅に、発生前までテレビ広告で見慣れていた「MUGARIAN」の印字。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 388
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "これ、市の箱に見せてるけど民間の管理番号。変ですよね",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 390
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "ムガリアン製薬って、薬の会社っすよね",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 392
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "薬だけじゃないです。病院の設備も、災害物資の配送も、市の検疫システムも請けてる大企業",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 394
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "だから印字だけなら普通。でも、市のラベルを上から貼って隠す理由はないです",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 396
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が箱を装甲車両へ積み、区役所を地図に示す。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 398
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "乗っていいんですか？",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 400
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "主人公が後部座席を空ける。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 402
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "やっぱり、好きになったの戻します",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 404
      }
    ],
    "source": {
      "startLine": 363,
      "endLine": 407
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
      "startLine": 363,
      "endLine": 407
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
        "text": "区役所前。最後のマイクロバスへ、負傷者と段ボールが押し込まれている。周囲のバリケードは半分崩れている。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 415
      },
      {
        "kind": "dialogue",
        "speaker": "避難所職員",
        "text": "もう出します！　次の群れが来たら持ちません！",
        "portraitOwner": "minor-human-shared-event-silhouette",
        "portraitKind": "minor",
        "sourceLine": 417
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "乗車名簿、一人足りない。安藤さん、七十二歳",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 419
      },
      {
        "kind": "dialogue",
        "speaker": "避難所職員",
        "text": "コピー室です。腰を抜かして動けない。迎えに戻った職員も――",
        "portraitOwner": "minor-human-shared-event-silhouette",
        "portraitKind": "minor",
        "sourceLine": 421
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "遠くの角を、感染者の群れが曲がる。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 423
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "一人待って、全員出られなくなったら……",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 425
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公がバスの閉まりかけた扉へ手を掛け、運転手へ待つよう合図する。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 427
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "行くんすね。聞く前から分かってましたけど",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 429
      },
      {
        "kind": "dialogue",
        "speaker": "ババヤガ",
        "text": "東階段を落とせば九十秒買える",
        "portraitOwner": "unit-babayaga",
        "portraitKind": "major",
        "sourceLine": 431
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "コピー室、その東やぞ",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 433
      },
      {
        "kind": "dialogue",
        "speaker": "ババヤガ",
        "text": "なら不採用。西の公用車を燃やして壁にする",
        "portraitOwner": "unit-babayaga",
        "portraitKind": "major",
        "sourceLine": 435
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "提案がずっと物騒なのに、判断だけはまともなの困るなあ",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 437
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "パイセンが区役所の入口を見る。足が一度だけ後ろへ下がる。主人公が折り畳み車椅子を渡す。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 439
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "俺が行く顔してました？",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 441
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "主人公が頷く。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 443
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "してないっすよ。……行きますけど",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 445
      },
      {
        "kind": "battle-marker",
        "speaker": "◆ BATTLE",
        "text": "避難車両と救出経路を防衛せよ。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 447
      }
    ],
    "source": {
      "startLine": 414,
      "endLine": 448
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
        "text": "パイセンが車椅子を押して区役所から飛び出す。座った老人の膝には、役所の古いラジオ。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 451
      },
      {
        "kind": "dialogue",
        "speaker": "安藤",
        "text": "駅員室に、まだ三人おる。昨日、これで話した",
        "portraitOwner": "minor-human-shared-event-silhouette",
        "portraitKind": "minor",
        "sourceLine": 453
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "先にそれ言ってくださいよ。いや、今でいいっす、走るんで！",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 455
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "主人公とクマバーソンが車椅子を持ち上げ、バスへ載せる。扉が閉まり、車両が発進する。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 457
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "パイセン、手",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 459
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "何すか",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 461
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "震えてる。私もです",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 463
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "いくらちゃんが自分の手を並べて見せる。ほんの少し、同じように震えている。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 465
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "……勝手に仲間にしないでください",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 467
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "じゃあ、震え仲間は解散。駅行き仲間だけ継続で",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 469
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "主人公が区役所の壁に貼られた避難区画図を見る。商店街、駅、病院、湾岸が同じ番号体系で分けられ、「都市対応実証 B-02」の文字だけが黒く塗られている。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 471
      },
      {
        "kind": "dialogue",
        "speaker": "ババヤガ",
        "text": "災害が起きてから作った地図じゃない",
        "portraitOwner": "unit-babayaga",
        "portraitKind": "major",
        "sourceLine": 473
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "実証って、街で何かを試すって意味ですよね。西新は、発生前から区画分けされてた",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 475
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "持ってくぞ。今は駅が先",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 477
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が区画図を撮影し、装甲車両を西新駅へ向ける。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 479
      }
    ],
    "source": {
      "startLine": 450,
      "endLine": 480
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
      "startLine": 450,
      "endLine": 480
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
        "text": "横転した車が交差点を塞ぐ。その向こうで、乗用車の屋根より高い人影が立っている。上半身が異様に肥大し、橙色の防災ベストが肉へ食い込んでいる。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 488
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "……あれ、人なんすか",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 490
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "元は",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 492
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "壊れた街頭スピーカーが、避難放送の残骸を繰り返す。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 494
      },
      {
        "kind": "dialogue",
        "speaker": "録音された女の声",
        "text": "タクヤさん、聞こえたら薬局へ――タクヤさん――",
        "portraitOwner": null,
        "portraitKind": "offscreen",
        "sourceLine": 496
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "大型感染者が、音のする商店街側へ首を向ける。胸元の名札には、滲んだローマ字で「TAKUYA」。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 498
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "名前、まだ残ってる",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 500
      },
      {
        "kind": "dialogue",
        "speaker": "ババヤガ",
        "text": "名前に反応したんやない。音源を探しよる",
        "portraitOwner": "unit-babayaga",
        "portraitKind": "major",
        "sourceLine": 502
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "そういう言い切り、今いります？",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 504
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "TAKUYAが横転車を片腕で押し退ける。車体が路面を滑り、パイセンの目の前で止まる。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 506
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "あああああああうああ！",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 508
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公がパイセンの襟を掴んで引き戻し、自分が前へ出る。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 510
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "来るぞ！　正面で受けるな！",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 512
      },
      {
        "kind": "dialogue",
        "speaker": "ババヤガ",
        "text": "車の陰を使って、横へ回る",
        "portraitOwner": "unit-babayaga",
        "portraitKind": "major",
        "sourceLine": 514
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "パイセンは逃げかけ、主人公の背中を見る。落とした鉄パイプを拾い直す。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 516
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "聞いてないっすよ、こんなの……でも一人で行くのも、もっと無理っす！",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 518
      },
      {
        "kind": "boss-marker",
        "speaker": "◆ BOSS",
        "text": "TAKUYA",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 520
      },
      {
        "kind": "battle-marker",
        "speaker": "◆ BATTLE",
        "text": "TAKUYAを倒し、西新駅への道を開け。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 522
      }
    ],
    "source": {
      "startLine": 487,
      "endLine": 523
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
        "text": "主人公の最後の一撃で、TAKUYAが膝をつく。巨体は倒れながらも、壊れたスピーカーの方へ指を伸ばす。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 526
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "まだ、動く……",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 528
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公がパイセンを背へ庇い、再び武器を構える。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 530
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "指が路面へ落ちる。動かなくなる。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 532
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "もうええ。あんたは、ここで休め",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 534
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "クマバーソンが防災ベストの残骸を巨体の顔へ掛ける。パイセンは、動かなくなった巨体から目を離せない。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 536
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "駅員室の信号、まだ点いてる。弱いけど、消えてない",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 538
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "……行きましょう。消える前に",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 540
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が駅への道を開けるため、横転車へ牽引ワイヤーを掛ける。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 542
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "装甲車両が交差点を離れる。暗転は切らず、無人になった路上を数秒だけ残す。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 544
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "黒い防護服の一団が現れる。全員、赤いレンズのガスマスク。歩幅も銃口の向きも揃っている。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 546
      },
      {
        "kind": "dialogue",
        "speaker": "赤レンズの隊長",
        "text": "T-03、死亡を確認",
        "portraitOwner": "red-panther-commander",
        "portraitKind": "major",
        "sourceLine": 548
      },
      {
        "kind": "dialogue",
        "speaker": "赤レンズの隊員",
        "text": "回収します",
        "portraitOwner": "red-panther-commander",
        "portraitKind": "major",
        "sourceLine": 550
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "巨体を覆う防災ベストが剥がされ、黒い回収袋が広げられる。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 552
      }
    ],
    "source": {
      "startLine": 525,
      "endLine": 555
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
      "startLine": 525,
      "endLine": 555
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
        "text": "西新駅入口。シャッターは腰の高さで止まり、暗い構内から非常電話の呼出音が鳴り続けている。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 563
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "駅員室から。自動じゃないです。誰かが、まだ押してる",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 565
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "地下、逃げ場ないっすよね",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 567
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "地上も、さっき逃げ場なかったぞ",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 569
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "励まし方、だいぶ下手ですよ",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 571
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が床へ伏せ、シャッターの隙間から構内を確かめる。そのまま中へ滑り込む。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 573
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "非常電話が止まり、受話器から咳き込む声。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 575
      },
      {
        "kind": "dialogue",
        "speaker": "駅員の声",
        "text": "聞こえますか。駅員室に三人、ホームの保守室に二人います",
        "portraitOwner": null,
        "portraitKind": "offscreen",
        "sourceLine": 577
      },
      {
        "kind": "dialogue",
        "speaker": "駅員の声",
        "text": "一人、さっき噛まれました。まだ意識はあります",
        "portraitOwner": null,
        "portraitKind": "offscreen",
        "sourceLine": 579
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "パイセンが目を閉じ、鉄パイプを握り直す。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 581
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "そういうの聞いたら、行かない方が無理になるじゃないっすか",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 583
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "主人公が内側からシャッターを持ち上げる。パイセンが最初に潜る。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 585
      },
      {
        "kind": "dialogue",
        "speaker": "ババヤガ",
        "text": "改札内、感染者の熱源が十三。生存者は別や",
        "portraitOwner": "unit-babayaga",
        "portraitKind": "major",
        "sourceLine": 587
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "その言い方、十三が少なく聞こえるのすごいですね",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 589
      },
      {
        "kind": "battle-marker",
        "speaker": "◆ BATTLE",
        "text": "閉鎖改札を制圧し、駅員室までの通路を確保せよ。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 591
      }
    ],
    "source": {
      "startLine": 562,
      "endLine": 592
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
        "text": "駅員室。三人の職員が、若い女性駅員の腕へタオルを巻いている。咬傷の周囲はまだ黒く変色していない。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 595
      },
      {
        "kind": "dialogue",
        "speaker": "女性駅員",
        "text": "ホームの二人も、お願いします。私は後でいいです",
        "portraitOwner": "minor-human-shared-event-silhouette",
        "portraitKind": "minor",
        "sourceLine": 597
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "順番はこっちで決める。まだ立てるなら、一緒に行くぞ",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 599
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "主人公が女性駅員へ肩を貸す。パイセンが反対側へ入る。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 601
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "重くないっす。俺、今日だけで力ついたんで",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 603
      },
      {
        "kind": "dialogue",
        "speaker": "女性駅員",
        "text": "震えてますよ",
        "portraitOwner": "minor-human-shared-event-silhouette",
        "portraitKind": "minor",
        "sourceLine": 605
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "これは筋肉の準備運動っす",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 607
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "駅員が保守用の路線図を広げる。地下ホームの先から、大学病院の旧搬送路へ線が続いている。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 609
      },
      {
        "kind": "dialogue",
        "speaker": "駅員",
        "text": "ホームに医療用の冷蔵ケースがあります。二日前、黒い防護服の人たちが置いていった",
        "portraitOwner": "minor-human-shared-event-silhouette",
        "portraitKind": "minor",
        "sourceLine": 611
      },
      {
        "kind": "dialogue",
        "speaker": "ババヤガ",
        "text": "顔は",
        "portraitOwner": "unit-babayaga",
        "portraitKind": "major",
        "sourceLine": 613
      },
      {
        "kind": "dialogue",
        "speaker": "駅員",
        "text": "ガスマスク。レンズが赤かった",
        "portraitOwner": "minor-human-shared-event-silhouette",
        "portraitKind": "minor",
        "sourceLine": 615
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "主人公が、さっきTAKUYAを倒した交差点の方を振り返る。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 617
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "あの死体を拾った人たちと、たぶん同じ",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 619
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が負傷者を装甲車両へ向かわせ、自分たちはホームへ下りる。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 621
      }
    ],
    "source": {
      "startLine": 594,
      "endLine": 622
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
      "startLine": 594,
      "endLine": 622
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
        "text": "地下ホーム。非常灯が一定間隔で明滅する。暗闇の奥から、壊れた改札機の電子音だけが響く。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 630
      },
      {
        "kind": "dialogue",
        "speaker": "電子音",
        "text": "ピッ。残高が不足しています",
        "portraitOwner": "minor-human-shared-event-silhouette",
        "portraitKind": "minor",
        "sourceLine": 632
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "こういう時まで金取るんすか",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 634
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "大丈夫。今から不正乗車します",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 636
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "堂々と言うな",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 638
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "ホーム中央。改札機と感染組織が癒着した大型個体が、音へ反応して頭部を動かす。保守室の扉が内側から叩かれる。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 640
      },
      {
        "kind": "dialogue",
        "speaker": "保守員の声",
        "text": "こっちです！　扉が歪んで開かない！",
        "portraitOwner": null,
        "portraitKind": "offscreen",
        "sourceLine": 642
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "大きいの、音を追ってます。反対ホームへ寄せれば、扉まで空く",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 644
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "いくらちゃんが構内放送端末へ、クマバーソンのフライパンを差し出す。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 646
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "何する気",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 648
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "一番よく響きそうなので、三回叩いてください",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 650
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "太鼓扱い、怒られますよ",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 652
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "クマバーソンがフライパンを叩く。いくらちゃんはその音を録音し、反対ホームの放送へ最大音量で流す。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 654
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "よし。おいしい音のする方へ、どうぞ",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 656
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "大型個体が放送の方向へ向きを変える。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 658
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が合図を出し、一行が線路を越えて保守室へ向かう。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 660
      },
      {
        "kind": "boss-marker",
        "speaker": "◆ BOSS",
        "text": "改札喰い",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 662
      },
      {
        "kind": "battle-marker",
        "speaker": "◆ BATTLE",
        "text": "音響誘導中に保守室を開放し、大型個体を撃破せよ。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 664
      }
    ],
    "source": {
      "startLine": 629,
      "endLine": 665
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
        "text": "歪んだ保守室の扉が開く。中の二人は互いに肩を貸しながら出てくる。いくらちゃんが人数を数え、二人の顔を見てから息を吐く。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 668
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "二人ともいる。よかった。本当に、よかった",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 670
      },
      {
        "kind": "dialogue",
        "speaker": "保守員",
        "text": "冷蔵ケース、持っていってください。病院宛てです",
        "portraitOwner": "minor-human-shared-event-silhouette",
        "portraitKind": "minor",
        "sourceLine": 672
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "ケースには「感染初期処置用」と、薬局で見たものと同じムガリアンの管理番号。中身の半分は抜かれている。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 674
      },
      {
        "kind": "dialogue",
        "speaker": "ババヤガ",
        "text": "赤レンズが置いて、赤レンズが抜いた",
        "portraitOwner": "unit-babayaga",
        "portraitKind": "major",
        "sourceLine": 676
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "配送履歴だけ残ってます。大学病院、地下搬入口。これ、普通の地下鉄路線じゃないですね",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 678
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "さっきから地下の下が増えてません？",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 680
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "地下二階までは無料です。三階から怖さが課金されます",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 682
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "もう十分払ってるっすよ",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 684
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が冷蔵ケースを背負い、病院へ続く保守扉を開ける。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 686
      }
    ],
    "source": {
      "startLine": 667,
      "endLine": 687
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
      "startLine": 667,
      "endLine": 687
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
        "text": "狭い保守トンネル。新しい軍靴の跡と、赤いレンズ片の付いたガスマスク用フィルターが落ちている。奥の防火隔壁は開いたまま。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 697
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "この足跡、今日です。私たちより先に病院へ行ってる",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 699
      },
      {
        "kind": "dialogue",
        "speaker": "ババヤガ",
        "text": "幅が揃いすぎ。訓練しとる",
        "portraitOwner": "unit-babayaga",
        "portraitKind": "major",
        "sourceLine": 701
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "古い中継器が一度だけ点灯する。ババヤガの携帯に、四十一日前の未着信メッセージが届く。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 703
      },
      {
        "kind": "dialogue",
        "speaker": "Mrs.チハのメッセージ",
        "text": "無事。湾岸へ移る。連絡はしないで",
        "portraitOwner": null,
        "portraitKind": "offscreen",
        "sourceLine": 705
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "奥さん？",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 707
      },
      {
        "kind": "dialogue",
        "speaker": "ババヤガ",
        "text": "四十一日前は、生きとった",
        "portraitOwner": "unit-babayaga",
        "portraitKind": "major",
        "sourceLine": 709
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "今もや",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 711
      },
      {
        "kind": "dialogue",
        "speaker": "ババヤガ",
        "text": "そう決めると、外れた時の損が大きい",
        "portraitOwner": "unit-babayaga",
        "portraitKind": "major",
        "sourceLine": 713
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "損とか言うな。怖いなら怖いでよか",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 715
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "ババヤガが携帯をしまう。いつもより早く、ライフルの安全装置を外す。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 717
      },
      {
        "kind": "dialogue",
        "speaker": "ババヤガ",
        "text": "怖い。やけん、ここから病院まで壁ごと吹き飛ばしたい",
        "portraitOwner": "unit-babayaga",
        "portraitKind": "major",
        "sourceLine": 719
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "急に規模がおかしいっす",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 721
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "隔壁の向こうから感染者が押し寄せる。脇にはブレーキの外れた保守台車。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 723
      },
      {
        "kind": "dialogue",
        "speaker": "ババヤガ",
        "text": "台車を落とす。群れを押し戻して、その間に隔壁を閉める",
        "portraitOwner": "unit-babayaga",
        "portraitKind": "major",
        "sourceLine": 725
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が台車の輪止めを外し、全員へ退避合図を出す。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 727
      },
      {
        "kind": "battle-marker",
        "speaker": "◆ BATTLE",
        "text": "保守台車で流入を分断し、防火隔壁を復旧せよ。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 729
      }
    ],
    "source": {
      "startLine": 696,
      "endLine": 730
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
        "text": "隔壁が閉じる。反対側から爪が金属を叩くが、ロックは外れない。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 733
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "トンネル爆破より、だいぶまともでしたね",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 735
      },
      {
        "kind": "dialogue",
        "speaker": "ババヤガ",
        "text": "爆薬があれば、比較できた",
        "portraitOwner": "unit-babayaga",
        "portraitKind": "major",
        "sourceLine": 737
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "比較せんでいい",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 739
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "病院側の非常回線が開く。重なる声と警報。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 741
      },
      {
        "kind": "dialogue",
        "speaker": "救護員の声",
        "text": "聞こえる人、救急搬入口へ！　薬と人手が足りません！",
        "portraitOwner": null,
        "portraitKind": "offscreen",
        "sourceLine": 743
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が冷蔵ケースを持ち直し、病院側の扉へ走る。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 745
      }
    ],
    "source": {
      "startLine": 732,
      "endLine": 746
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
      "startLine": 732,
      "endLine": 746
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
        "text": "救急搬入口。ストレッチャーが廊下まで並び、発電機の音に泣き声と指示が混ざる。女性駅員が運び込まれる。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 754
      },
      {
        "kind": "dialogue",
        "speaker": "医師",
        "text": "噛まれてから何分ですか",
        "portraitOwner": "minor-human-shared-event-silhouette",
        "portraitKind": "minor",
        "sourceLine": 756
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "一時間ないです。喋れてます、歩けます",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 758
      },
      {
        "kind": "dialogue",
        "speaker": "医師",
        "text": "なら、まだ進行を遅らせられる。完治じゃない。時間を買うだけです",
        "portraitOwner": "minor-human-shared-event-silhouette",
        "portraitKind": "minor",
        "sourceLine": 760
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "主人公が冷蔵ケースを渡す。医師が中を見て、わずかに表情を緩める。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 762
      },
      {
        "kind": "dialogue",
        "speaker": "医師",
        "text": "これがあれば数人は持たせられる。どこで？",
        "portraitOwner": "minor-human-shared-event-silhouette",
        "portraitKind": "minor",
        "sourceLine": 764
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "駅です。でも半分、先に抜かれてました",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 766
      },
      {
        "kind": "dialogue",
        "speaker": "医師",
        "text": "地下の備蓄も消えました。会社の回収班が持っていった",
        "portraitOwner": "minor-human-shared-event-silhouette",
        "portraitKind": "minor",
        "sourceLine": 768
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "全部は助けられんの",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 770
      },
      {
        "kind": "dialogue",
        "speaker": "医師",
        "text": "身体が別の組織へ置き換わった後は、戻せません。今ここで止められる人を、止めるしかない",
        "portraitOwner": "minor-human-shared-event-silhouette",
        "portraitKind": "minor",
        "sourceLine": 772
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "搬入口の外で感染者が救急車へ衝突する。医師が注射器を握ったまま振り返る。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 774
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "先生はそっちやっとって。運ぶのと外は、俺らがやる",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 776
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公がストレッチャーの列を院内へ押し込み、搬入口の防火扉を固定する。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 778
      },
      {
        "kind": "battle-marker",
        "speaker": "◆ BATTLE",
        "text": "医薬品移送が終わるまで救急搬入口を防衛せよ。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 780
      }
    ],
    "source": {
      "startLine": 753,
      "endLine": 781
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
        "text": "最後のストレッチャーが院内へ入る。女性駅員の呼吸は落ち着き、腕の黒い変色も止まっている。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 784
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "止まった……んすよね",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 786
      },
      {
        "kind": "dialogue",
        "speaker": "医師",
        "text": "今は。次の投与まで六時間。その先の薬がない",
        "portraitOwner": "minor-human-shared-event-silhouette",
        "portraitKind": "minor",
        "sourceLine": 788
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "六時間あれば、探せる",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 790
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "医師が救急病棟の鍵を渡す。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 792
      },
      {
        "kind": "dialogue",
        "speaker": "医師",
        "text": "薬品庫は東病棟。残った看護師が二人います。ただ、廊下にはもう――",
        "portraitOwner": "minor-human-shared-event-silhouette",
        "portraitKind": "minor",
        "sourceLine": 794
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "人がおるなら行く。薬も持って帰る",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 796
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が空の冷蔵ケースを受け取り、東病棟の扉を開ける。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 798
      }
    ],
    "source": {
      "startLine": 783,
      "endLine": 799
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
      "startLine": 783,
      "endLine": 799
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
        "text": "弾痕の残る廊下。処置室の内側から、規則正しく三回、扉を叩く音。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 807
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が同じ回数だけ叩き返す。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 809
      },
      {
        "kind": "dialogue",
        "speaker": "看護師の声",
        "text": "人です。二人います。開けたら右の個室を見ないで",
        "portraitOwner": null,
        "portraitKind": "offscreen",
        "sourceLine": 811
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "何がいるんすか",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 813
      },
      {
        "kind": "dialogue",
        "speaker": "看護師の声",
        "text": "昨日まで患者だった人",
        "portraitOwner": null,
        "portraitKind": "offscreen",
        "sourceLine": 815
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "右の個室。名札の付いた病衣を着た完全変異体が、ガラスへ頭を打ち続けている。枕元には家族写真。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 817
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "この人、戻せないんすよね",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 819
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "……うん",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 821
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "パイセンは写真から視線を外し、処置室の扉を塞ぐ感染組織を見る。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 823
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "じゃあ、中の二人は戻す。薬も持ってく。さすがに許せないっす",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 825
      },
      {
        "kind": "battle-marker",
        "speaker": "◆ BATTLE",
        "text": "処置室までの経路を開き、感染拠点を破壊せよ。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 827
      }
    ],
    "source": {
      "startLine": 806,
      "endLine": 828
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
        "text": "二人の看護師が薬品庫からケースを運び出す。うち一人が、破れた紙台帳を主人公へ渡す。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 831
      },
      {
        "kind": "dialogue",
        "speaker": "看護師",
        "text": "発生初日、まだ喋れた患者を十二人、地下へ連れていかれました",
        "portraitOwner": "minor-human-shared-event-silhouette",
        "portraitKind": "minor",
        "sourceLine": 833
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "搬送先、B3-L。病院の図面は地下二階までなのに",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 835
      },
      {
        "kind": "dialogue",
        "speaker": "看護師",
        "text": "止めた医師は撃たれました。治すためだって言ってたけど、名前じゃなく番号で呼んでた",
        "portraitOwner": "minor-human-shared-event-silhouette",
        "portraitKind": "minor",
        "sourceLine": 837
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "パイセンが個室の家族写真を伏せず、元の位置へ戻す。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 839
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "番号にしたら、やったこと軽くなると思ったんすかね",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 841
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "軽くならない。少なくとも、私は名前で残す",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 843
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "いくらちゃんが台帳の全ページを撮影する。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 845
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が薬品ケースを救急搬入口へ送り、自分たちは地下機械室へ向かう。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 847
      }
    ],
    "source": {
      "startLine": 830,
      "endLine": 848
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
      "startLine": 830,
      "endLine": 848
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
        "text": "非常発電機。吸気口へ感染組織が絡みつき、制御盤だけが低い音で動いている。赤い封印ボタンに「研究区画優先」の表示。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 856
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "この赤いの、押したくなりません？",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 858
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "ならないっす",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 860
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "私、押したい。すごく",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 862
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "押したら手ぇ縛るぞ",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 864
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "可愛いリボンでお願いします",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 866
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "いくらちゃんは笑いながらも、ボタンには触れず配線図を撮る。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 868
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "病院の非常電源より、下の何かが優先されてます。発生前からずっと",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 870
      },
      {
        "kind": "dialogue",
        "speaker": "ババヤガ",
        "text": "電気代だけで隠し事が分かる。会社は帳簿から死ぬ",
        "portraitOwner": "unit-babayaga",
        "portraitKind": "major",
        "sourceLine": 872
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "発電機の奥で感染組織が膨らみ、冷却ファンが止まる。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 874
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が主電源を落とし、手動始動レバーへ取り付く。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 876
      },
      {
        "kind": "battle-marker",
        "speaker": "◆ BATTLE",
        "text": "冷却設備を守りながら非常電源を再起動せよ。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 878
      }
    ],
    "source": {
      "startLine": 855,
      "endLine": 879
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
        "text": "照明が戻る。壁の一部がエレベーター扉として開き、階数表示に「B3-L」が現れる。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 882
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "本当にあった……怖さの課金階",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 884
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "初回無料だったので、喜んでください",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 886
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "端末へ戦闘記録が自動保存される。いくらちゃんの笑顔が消える。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 888
      },
      {
        "kind": "system",
        "speaker": "■ SYSTEM",
        "text": "戦闘記録：外部転送完了／転送先：SEG-LAB",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 890
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "今の戦闘、勝手にどこかへ送られました。保存先、病院でもムガリアンでもない",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 892
      },
      {
        "kind": "dialogue",
        "speaker": "ババヤガ",
        "text": "切れる？",
        "portraitOwner": "unit-babayaga",
        "portraitKind": "major",
        "sourceLine": 894
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "もう送られた分は無理。次から入口は塞げます",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 896
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が表示を撮影し、外部送信線を物理的に抜く。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 898
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "写真、残しました。知らないところに覗かれたら、こっちも顔くらい覚えたいので",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 900
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "エレベーターの下から、断続的な救難音。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 902
      }
    ],
    "source": {
      "startLine": 881,
      "endLine": 903
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
      "startLine": 881,
      "endLine": 903
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
        "text": "エレベーターの先。病院とは別物の白い壁、厚い防弾ガラス、黒い防疫扉。除染ゲートの床には新しい血痕と、赤レンズ用フィルター。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 911
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "ここ、患者を治す場所に見えないっすね",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 913
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "街の監視画面があります。商店街、駅、区役所、病院……最初から全部カメラの中",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 915
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "俺らが逃げよる間も、誰か見よったんか",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 917
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "中央表示に、区役所で見た番号体系が並ぶ。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 919
      },
      {
        "kind": "system",
        "speaker": "■ SYSTEM",
        "text": "T計画／都市対応実証フィールド／区画B-01〜B-09",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 921
      },
      {
        "kind": "dialogue",
        "speaker": "ババヤガ",
        "text": "災害への対応を調べたんやない。災害を置いて、人の動きを調べた",
        "portraitOwner": "unit-babayaga",
        "portraitKind": "major",
        "sourceLine": 923
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "除染ゲートが異常判定を出し、隔壁が閉じる。天井から感染個体が落ちる。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 925
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が非常解除盤へ走り、退路を確保する。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 927
      },
      {
        "kind": "battle-marker",
        "speaker": "◆ BATTLE",
        "text": "除染制御を復旧し、隔離区画への防疫扉を開け。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 929
      }
    ],
    "source": {
      "startLine": 910,
      "endLine": 930
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
        "text": "ゲートが緑へ変わる。奥のモニターだけが点灯する。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 933
      },
      {
        "kind": "system",
        "speaker": "■ SYSTEM",
        "text": "生存反応：3／大型検体：1／管理企業：MUGARIAN PHARMACEUTICAL",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 935
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "管理企業、ムガリアン製薬。薬局の箱、病院の備蓄、地下研究所まで同じ会社です",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 937
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "街を助ける会社じゃなくて、街の中身を握ってた会社だったんすね",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 939
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "三人、生きてます。大型の方も、たぶん",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 941
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "先に三人を助ける。大型はその後",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 943
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が防疫扉を開き、隔離区画へ入る。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 945
      }
    ],
    "source": {
      "startLine": 932,
      "endLine": 946
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
      "startLine": 932,
      "endLine": 946
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
        "text": "円形の隔離区画。割れた培養槽、乾いた血痕。奥の待機室からインターホンが鳴る。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 956
      },
      {
        "kind": "dialogue",
        "speaker": "研究員の声",
        "text": "聞こえますか！　先に隔離を戻して、話は後！",
        "portraitOwner": null,
        "portraitKind": "offscreen",
        "sourceLine": 958
      },
      {
        "kind": "dialogue",
        "speaker": "別の研究員の声",
        "text": "最大槽が起きる！　抑制液が切れてる！",
        "portraitOwner": null,
        "portraitKind": "offscreen",
        "sourceLine": 960
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "最大の培養槽。ラベルは「MOTHER」。濁った液の中で影が動く。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 962
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "マザーって、何の母親っすか",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 964
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "三人閉じ込めたやつの名前は、あとで聞く！",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 966
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "隔離制御は手動再起動を要求している。三本の供給管が感染組織に塞がれている。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 968
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が再起動レバーを下ろし、待機室を背に武器を構える。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 970
      },
      {
        "kind": "boss-marker",
        "speaker": "◆ BOSS",
        "text": "MOTHER",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 972
      },
      {
        "kind": "battle-marker",
        "speaker": "◆ BATTLE",
        "text": "供給管を復旧し、隔離制御が戻るまで待機室を防衛せよ。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 974
      }
    ],
    "source": {
      "startLine": 955,
      "endLine": 975
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
        "text": "隔離区画が封鎖され、MOTHERが停止する。待機室から三人の研究員が出てくる。一人は倒れた検体を見て、足が止まる。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 978
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "歩ける？",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 980
      },
      {
        "kind": "dialogue",
        "speaker": "研究員",
        "text": "……はい",
        "portraitOwner": "minor-human-shared-event-silhouette",
        "portraitKind": "minor",
        "sourceLine": 982
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "なら出るぞ。立てん人がおったら、俺が背負う",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 984
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "主人公が水を渡す。研究員は一口飲んでから、紙の搬送票を差し出す。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 986
      },
      {
        "kind": "dialogue",
        "speaker": "研究員",
        "text": "あれ、発生してから作った個体じゃありません。私が配属された時には、もういた",
        "portraitOwner": "minor-human-shared-event-silhouette",
        "portraitKind": "minor",
        "sourceLine": 988
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "抑制液って？",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 990
      },
      {
        "kind": "dialogue",
        "speaker": "研究員",
        "text": "強化した感染組織は、放っておくと自分の身体まで食い潰す。それを止める中和因子です",
        "portraitOwner": "minor-human-shared-event-silhouette",
        "portraitKind": "minor",
        "sourceLine": 992
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "治す薬？",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 994
      },
      {
        "kind": "dialogue",
        "speaker": "研究員",
        "text": "検体を長持ちさせるためのもの。人間用じゃない。でも、仕組みは近い",
        "portraitOwner": "minor-human-shared-event-silhouette",
        "portraitKind": "minor",
        "sourceLine": 996
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "研究員が発生前の日付が入った搬送票を指す。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 998
      },
      {
        "kind": "dialogue",
        "speaker": "研究員",
        "text": "地上へ出した検体と、回収班の記録です。会社が消す前に持っていって",
        "portraitOwner": "minor-human-shared-event-silhouette",
        "portraitKind": "minor",
        "sourceLine": 1000
      },
      {
        "kind": "dialogue",
        "speaker": "ババヤガ",
        "text": "回収班。赤いレンズ？",
        "portraitOwner": "unit-babayaga",
        "portraitKind": "major",
        "sourceLine": 1002
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "研究員は頷く。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 1004
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が搬送票を防水袋へ入れ、三人を退路へ送り出す。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 1006
      }
    ],
    "source": {
      "startLine": 977,
      "endLine": 1007
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
      "startLine": 977,
      "endLine": 1007
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
        "text": "搬送坑道の奥で炎が上がる。密閉搬送車の陰から、ウイスキー瓶を腰へ差した男が、火のついた布を詰めた小瓶を片手に顔だけ出す。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 1015
      },
      {
        "kind": "dialogue",
        "speaker": "ザキミヤ",
        "text": "おーい！　そこの装甲車両、人が乗っとる方か！",
        "portraitOwner": "unit-zakimiya",
        "portraitKind": "major",
        "sourceLine": 1017
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "こっちも今それ聞きたい！",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 1019
      },
      {
        "kind": "dialogue",
        "speaker": "ザキミヤ",
        "text": "俺は人！　一人！　向こうは撃ってくる！",
        "portraitOwner": "unit-zakimiya",
        "portraitKind": "major",
        "sourceLine": 1021
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "坑道の奥。黒い防護服の回収班が、密閉搬送車へ銃口を向ける。赤いレンズが光を返す。ザキミヤが火炎瓶を投げ、床へ炎の壁を作って前進を止める。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 1023
      },
      {
        "kind": "dialogue",
        "speaker": "回収班",
        "text": "搬送車から離れろ。次は当てる",
        "portraitOwner": "minor-human-shared-event-silhouette",
        "portraitKind": "minor",
        "sourceLine": 1025
      },
      {
        "kind": "dialogue",
        "speaker": "ザキミヤ",
        "text": "ほら！　人の会話じゃないやろ！",
        "portraitOwner": "unit-zakimiya",
        "portraitKind": "major",
        "sourceLine": 1027
      },
      {
        "kind": "dialogue",
        "speaker": "ババヤガ",
        "text": "一発目、右へ二十二センチ外しとる。警告射撃",
        "portraitOwner": "unit-babayaga",
        "portraitKind": "major",
        "sourceLine": 1029
      },
      {
        "kind": "dialogue",
        "speaker": "ザキミヤ",
        "text": "精度の話しよる場合か！",
        "portraitOwner": "unit-zakimiya",
        "portraitKind": "major",
        "sourceLine": 1031
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "搬送車に何がある！",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 1033
      },
      {
        "kind": "dialogue",
        "speaker": "ザキミヤ",
        "text": "避難者の移送記録！　妻と、娘を探しよる！",
        "portraitOwner": "unit-zakimiya",
        "portraitKind": "major",
        "sourceLine": 1035
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "回収班が炎を迂回して前進する。ザキミヤは次の瓶へ手を伸ばし、空になった腰袋を二度探る。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 1037
      },
      {
        "kind": "dialogue",
        "speaker": "ザキミヤ",
        "text": "……もう投げるもんがない」",
        "portraitOwner": "unit-zakimiya",
        "portraitKind": "major",
        "sourceLine": 1039
      },
      {
        "kind": "dialogue",
        "speaker": "ザキミヤ",
        "text": "初対面に火ぃ渡す？　話、早いな。怖いくらい早い",
        "portraitOwner": "unit-zakimiya",
        "portraitKind": "major",
        "sourceLine": 1043
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "ザキミヤが新しい瓶へ布を詰める。手は震えているが、搬送車の前からは退かない。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 1045
      },
      {
        "kind": "battle-marker",
        "speaker": "◆ BATTLE",
        "text": "回収班を退け、密閉搬送車の破壊を阻止せよ。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 1047
      }
    ],
    "source": {
      "startLine": 1014,
      "endLine": 1048
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
        "text": "回収班が撤退する。ザキミヤはすぐ銃を下ろし、表示盤へ妻子の名前を打ち込む。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 1051
      },
      {
        "kind": "system",
        "speaker": "■ SYSTEM",
        "text": "最終移送：湾岸封鎖区／状態：不明",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 1053
      },
      {
        "kind": "dialogue",
        "speaker": "ザキミヤ",
        "text": "不明って、生きとる方の不明よな",
        "portraitOwner": "unit-zakimiya",
        "portraitKind": "major",
        "sourceLine": 1055
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "そうとも言い切れない。でも、死亡記録はないです。中央台帳なら続きを追えます",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 1057
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "ザキミヤが携帯の写真を見せる。産着に包まれた乳児と、疲れた顔で笑う女性。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 1059
      },
      {
        "kind": "dialogue",
        "speaker": "ザキミヤ",
        "text": "生まれたばっかりなんよ。俺の顔、まだ分かる前に離れて……",
        "portraitOwner": "unit-zakimiya",
        "portraitKind": "major",
        "sourceLine": 1061
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "言葉が続かない。腰の瓶へ手を伸ばすが、開けずに戻す。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 1063
      },
      {
        "kind": "dialogue",
        "speaker": "ザキミヤ",
        "text": "あんたら、湾岸まで行く？",
        "portraitOwner": "unit-zakimiya",
        "portraitKind": "major",
        "sourceLine": 1065
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "西新取り戻すなら、どのみち通る",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 1067
      },
      {
        "kind": "dialogue",
        "speaker": "ザキミヤ",
        "text": "俺、強くないぞ。火ぃ付けるくらいしかできんし、普通に怖がる",
        "portraitOwner": "unit-zakimiya",
        "portraitKind": "major",
        "sourceLine": 1069
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が装甲車両の空席を示す。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 1071
      },
      {
        "kind": "dialogue",
        "speaker": "ザキミヤ",
        "text": "……それでもいいなら、乗せて",
        "portraitOwner": "unit-zakimiya",
        "portraitKind": "major",
        "sourceLine": 1073
      }
    ],
    "source": {
      "startLine": 1050,
      "endLine": 1076
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
      "startLine": 1050,
      "endLine": 1076
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
        "text": "市の支援物資と、企業の冷蔵コンテナが同じゲートで管理されている。端末の認証は途中で止まり、消去警告が点滅する。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 1084
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "次を押したら、記録が消えるか、私が感電するか。半々です",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 1086
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "二択が雑っすね",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 1088
      },
      {
        "kind": "dialogue",
        "speaker": "知らない声",
        "text": "押さないで。右上の青い端子だけを繋いでください",
        "portraitOwner": null,
        "portraitKind": "offscreen",
        "sourceLine": 1090
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "全員が武器を構える。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 1092
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "誰",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 1094
      },
      {
        "kind": "dialogue",
        "speaker": "知らない声",
        "text": "セガワ。ムガリアン技術開発局です。設備の話ならできます",
        "portraitOwner": null,
        "portraitKind": "offscreen",
        "sourceLine": 1096
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "会社の人が、会社へ入れって言ってるんすか",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 1098
      },
      {
        "kind": "dialogue",
        "speaker": "セガワ",
        "text": "ええ。奥の倉庫に抗菌薬と輸液があります。記録より先に、そちらを出してください",
        "portraitOwner": "segawa",
        "portraitKind": "major",
        "sourceLine": 1100
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "青い端子、SEG-LABへ繋がってます。病院で勝手に戦闘記録を持っていった保存先",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 1102
      },
      {
        "kind": "dialogue",
        "speaker": "セガワ",
        "text": "僕の退避用サーバーです。会社が消す前に、記録を複製していました",
        "portraitOwner": "segawa",
        "portraitKind": "major",
        "sourceLine": 1104
      },
      {
        "kind": "dialogue",
        "speaker": "ババヤガ",
        "text": "こっちの戦闘まで残す必要は",
        "portraitOwner": "unit-babayaga",
        "portraitKind": "major",
        "sourceLine": 1106
      },
      {
        "kind": "dialogue",
        "speaker": "セガワ",
        "text": "ゲートを開ける際、周辺の警備反応を拾いました。無断だったことは謝ります",
        "portraitOwner": "segawa",
        "portraitKind": "major",
        "sourceLine": 1108
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "遠くから救難無線が割り込む。子どもの泣き声と、貨物車の警笛。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 1110
      },
      {
        "kind": "dialogue",
        "speaker": "救難の声",
        "text": "貨物退避場！　民間車両が動けません！",
        "portraitOwner": null,
        "portraitKind": "offscreen",
        "sourceLine": 1112
      },
      {
        "kind": "dialogue",
        "speaker": "セガワ",
        "text": "疑うのは後でいい。まず薬を出して、次へ行ってください",
        "portraitOwner": "segawa",
        "portraitKind": "major",
        "sourceLine": 1114
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が青い端子を接続する。正面ゲートが開く。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 1116
      },
      {
        "kind": "battle-marker",
        "speaker": "◆ BATTLE",
        "text": "薬品倉庫を確保し、物資搬出路を守れ。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 1118
      }
    ],
    "source": {
      "startLine": 1083,
      "endLine": 1119
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
        "text": "薬と水が装甲車両へ積み込まれる。ヤードの待機室から、隠れていた作業員二人も救出される。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 1122
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "人がおるの、先に言えたやろ",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 1124
      },
      {
        "kind": "dialogue",
        "speaker": "セガワ",
        "text": "中に人がいると断言できなかった。期待させて外したくなかったんです",
        "portraitOwner": "segawa",
        "portraitKind": "major",
        "sourceLine": 1126
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "クマバーソンが救出者へ水を渡し、無線へ戻る。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 1128
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "薬も人も本物やった。次の情報も聞く",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 1130
      },
      {
        "kind": "dialogue",
        "speaker": "セガワ",
        "text": "それで十分です",
        "portraitOwner": "segawa",
        "portraitKind": "major",
        "sourceLine": 1132
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "会社、潰したいんすか",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 1134
      },
      {
        "kind": "dialogue",
        "speaker": "セガワ",
        "text": "少なくとも、今の会社を残す理由はありません",
        "portraitOwner": "segawa",
        "portraitKind": "major",
        "sourceLine": 1136
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "輸送記録には、発生前から締結済みの「感染対応」「封鎖」「復旧」契約。さらに別都市の空欄付き契約書が混じる。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 1138
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "災害前から、災害後の請求書を作ってる",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 1140
      },
      {
        "kind": "dialogue",
        "speaker": "ザキミヤ",
        "text": "火事を売って、消火器も売る気やったんか",
        "portraitOwner": "unit-zakimiya",
        "portraitKind": "major",
        "sourceLine": 1142
      },
      {
        "kind": "dialogue",
        "speaker": "セガワ",
        "text": "社長案件です。証拠は残してください",
        "portraitOwner": "segawa",
        "portraitKind": "major",
        "sourceLine": 1144
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が紙の契約書を回収し、貨物退避場へ車両を向ける。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 1146
      }
    ],
    "source": {
      "startLine": 1121,
      "endLine": 1147
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
      "startLine": 1121,
      "endLine": 1147
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
        "text": "民間車両と冷蔵コンテナが連結されたまま。線路脇では、白い光刃を持つ男が感染者を切り払っている。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 1155
      },
      {
        "kind": "dialogue",
        "speaker": "TKY",
        "text": "おい、そこのごつい車！　人が乗っとる方だけ先に外したい！",
        "portraitOwner": "unit-tky",
        "portraitKind": "major",
        "sourceLine": 1157
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "何したらいい！",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 1159
      },
      {
        "kind": "dialogue",
        "speaker": "TKY",
        "text": "手動連結、三つ！　俺がでかいの止める！",
        "portraitOwner": "unit-tky",
        "portraitKind": "major",
        "sourceLine": 1161
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "名前は！",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 1163
      },
      {
        "kind": "dialogue",
        "speaker": "TKY",
        "text": "TKY！",
        "portraitOwner": "unit-tky",
        "portraitKind": "major",
        "sourceLine": 1165
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "何の略――",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 1167
      },
      {
        "kind": "dialogue",
        "speaker": "TKY",
        "text": "今、その質問いる？",
        "portraitOwner": "unit-tky",
        "portraitKind": "major",
        "sourceLine": 1169
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "いらないっす！",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 1171
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "線路奥。巨大な口を持つ感染体が、貨物部品を噛み砕いて進む。TKYが光刃を一振りし、飛んだ鉄片だけを切り落とす。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 1173
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "やりますねぇ……",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 1175
      },
      {
        "kind": "dialogue",
        "speaker": "TKY",
        "text": "褒めるなら手ぇ動かし！",
        "portraitOwner": "unit-tky",
        "portraitKind": "major",
        "sourceLine": 1177
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が最初の連結器へ飛びつき、解除ハンドルを回す。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 1179
      },
      {
        "kind": "boss-marker",
        "speaker": "◆ BOSS",
        "text": "オオグチ",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 1181
      },
      {
        "kind": "battle-marker",
        "speaker": "◆ BATTLE",
        "text": "三つの連結を解除し、民間車両を退避させよ。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 1183
      }
    ],
    "source": {
      "startLine": 1154,
      "endLine": 1184
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
        "text": "民間車両が安全側へ押し出される。TKYが光刃を消し、服に付いた埃を払う。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 1187
      },
      {
        "kind": "dialogue",
        "speaker": "避難者",
        "text": "この先にも、刃物で感染者を倒しよる男がおった。刀を二本持って、名前も言わず本社の方へ行った",
        "portraitOwner": "minor-human-shared-event-silhouette",
        "portraitKind": "minor",
        "sourceLine": 1189
      },
      {
        "kind": "dialogue",
        "speaker": "TKY",
        "text": "二本？　俺とは別やな。こんな状況で同業者増えるん、ちょっと嫌やわ",
        "portraitOwner": "unit-tky",
        "portraitKind": "major",
        "sourceLine": 1191
      },
      {
        "kind": "dialogue",
        "speaker": "TKY",
        "text": "助かった。見た目より、ええチームやな",
        "portraitOwner": "unit-tky",
        "portraitKind": "major",
        "sourceLine": 1193
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "見た目のどこが悪かったんすか",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 1195
      },
      {
        "kind": "dialogue",
        "speaker": "TKY",
        "text": "短パンとフライパン",
        "portraitOwner": "unit-tky",
        "portraitKind": "major",
        "sourceLine": 1197
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "お前も大概やぞ",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 1199
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "いくらちゃんが搬送台帳を開く。いつもの明るさを少し抑え、ババヤガへ端末を渡す。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 1201
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "湾岸へ移送された人に、チハさんがいます。発生から十七日目、生存確認",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 1203
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "ババヤガの指が、画面へ触れる直前で止まる。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 1205
      },
      {
        "kind": "dialogue",
        "speaker": "ババヤガ",
        "text": "妻",
        "portraitOwner": "unit-babayaga",
        "portraitKind": "major",
        "sourceLine": 1207
      },
      {
        "kind": "dialogue",
        "speaker": "TKY",
        "text": "湾岸へ行くんやな",
        "portraitOwner": "unit-tky",
        "portraitKind": "major",
        "sourceLine": 1209
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "行く",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 1211
      },
      {
        "kind": "dialogue",
        "speaker": "TKY",
        "text": "ほな、俺も乗せて。戻る場所はなくなったけど、行く方角は欲しい",
        "portraitOwner": "unit-tky",
        "portraitKind": "major",
        "sourceLine": 1213
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が装甲車両の扉を開ける。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 1215
      },
      {
        "kind": "dialogue",
        "speaker": "TKY",
        "text": "ほんまに、それだけで通じるんや",
        "portraitOwner": "unit-tky",
        "portraitKind": "major",
        "sourceLine": 1217
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "俺ら、だいたいこれっす",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 1219
      }
    ],
    "source": {
      "startLine": 1186,
      "endLine": 1222
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
      "startLine": 1186,
      "endLine": 1222
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
        "text": "壁に「T計画／都市対応実証」。一般施設の案内表示はここで途切れ、企業用の制御盤だけが残る。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 1230
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "湾岸の救難、ここを通ってます。右が警備、左が民間回線",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 1232
      },
      {
        "kind": "dialogue",
        "speaker": "セガワ",
        "text": "左だけを起動してください。右へ触れると回収班が来ます",
        "portraitOwner": "segawa",
        "portraitKind": "major",
        "sourceLine": 1234
      },
      {
        "kind": "dialogue",
        "speaker": "TKY",
        "text": "先に分かるん、ほんま助かるわ",
        "portraitOwner": "unit-tky",
        "portraitKind": "major",
        "sourceLine": 1236
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "左だけ。右は触らない。俺でも覚えられる",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 1238
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "じゃ、抜き打ちで後から聞きますね",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 1240
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "制御区へ感染者が流れ込み、回線の起動表示が赤へ変わる。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 1242
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が左側の主制御へ向かい、外郭シャッターを閉じる。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 1244
      },
      {
        "kind": "battle-marker",
        "speaker": "◆ BATTLE",
        "text": "救難回線の復旧が終わるまで制御盤を防衛せよ。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 1246
      }
    ],
    "source": {
      "startLine": 1229,
      "endLine": 1247
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
        "text": "ノイズの奥から、女性の声が入る。背後では負傷者へ指示を出している。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 1250
      },
      {
        "kind": "dialogue",
        "speaker": "Mrs.チハの声",
        "text": "動ける人から西階段へ。子どもを真ん中にして",
        "portraitOwner": null,
        "portraitKind": "offscreen",
        "sourceLine": 1252
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "ババヤガが無線を取る。口を開き、一度だけ声が出ない。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 1254
      },
      {
        "kind": "dialogue",
        "speaker": "ババヤガ",
        "text": "チハ",
        "portraitOwner": "unit-babayaga",
        "portraitKind": "major",
        "sourceLine": 1256
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "向こうの指示が止まる。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 1258
      },
      {
        "kind": "dialogue",
        "speaker": "Mrs.チハの声",
        "text": "……何",
        "portraitOwner": null,
        "portraitKind": "offscreen",
        "sourceLine": 1260
      },
      {
        "kind": "dialogue",
        "speaker": "ババヤガ",
        "text": "声、聞きたかった",
        "portraitOwner": "unit-babayaga",
        "portraitKind": "major",
        "sourceLine": 1262
      },
      {
        "kind": "dialogue",
        "speaker": "Mrs.チハの声",
        "text": "聞こえたでしょ。こっちは十二人、まだ動ける",
        "portraitOwner": null,
        "portraitKind": "offscreen",
        "sourceLine": 1264
      },
      {
        "kind": "dialogue",
        "speaker": "ババヤガ",
        "text": "今行く",
        "portraitOwner": "unit-babayaga",
        "portraitKind": "major",
        "sourceLine": 1266
      },
      {
        "kind": "dialogue",
        "speaker": "Mrs.チハの声",
        "text": "先に中央を止めて。流入が続いたら、来ても全員死ぬ",
        "portraitOwner": null,
        "portraitKind": "offscreen",
        "sourceLine": 1268
      },
      {
        "kind": "dialogue",
        "speaker": "ババヤガ",
        "text": "分かった",
        "portraitOwner": "unit-babayaga",
        "portraitKind": "major",
        "sourceLine": 1270
      },
      {
        "kind": "dialogue",
        "speaker": "Mrs.チハの声",
        "text": "……あとで",
        "portraitOwner": null,
        "portraitKind": "offscreen",
        "sourceLine": 1272
      },
      {
        "kind": "dialogue",
        "speaker": "ババヤガ",
        "text": "うん",
        "portraitOwner": "unit-babayaga",
        "portraitKind": "major",
        "sourceLine": 1274
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "通信が切れる。ババヤガは端末を戻す時だけ、ほんの少し手元を狂わせる。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 1276
      },
      {
        "kind": "dialogue",
        "speaker": "セガワ",
        "text": "中央封鎖区までの地図を出します。戦闘記録は繋いだままに。ゲートの反応予測に使う",
        "portraitOwner": "segawa",
        "portraitKind": "major",
        "sourceLine": 1278
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "今回は先に言いましたね",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 1280
      },
      {
        "kind": "dialogue",
        "speaker": "セガワ",
        "text": "前回、怒られましたから",
        "portraitOwner": "segawa",
        "portraitKind": "major",
        "sourceLine": 1282
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が地図を受け取り、記録接続を確認して中央封鎖区へ進む。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 1284
      }
    ],
    "source": {
      "startLine": 1249,
      "endLine": 1285
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
      "startLine": 1249,
      "endLine": 1285
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
        "text": "三基の封鎖ゲートが開いたまま。湾岸へ向かって感染者が流れ続ける。遠方のタワーで発砲光。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 1293
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "三つ全部閉めます。二つだけだと、地下排水路から抜ける",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 1295
      },
      {
        "kind": "dialogue",
        "speaker": "TKY",
        "text": "嫌なとこだけ、よう出来た施設やな",
        "portraitOwner": "unit-tky",
        "portraitKind": "major",
        "sourceLine": 1297
      },
      {
        "kind": "dialogue",
        "speaker": "Mrs.チハの声",
        "text": "また増えた。中央から来てる！",
        "portraitOwner": null,
        "portraitKind": "offscreen",
        "sourceLine": 1299
      },
      {
        "kind": "dialogue",
        "speaker": "ババヤガ",
        "text": "今閉める。弾は",
        "portraitOwner": "unit-babayaga",
        "portraitKind": "major",
        "sourceLine": 1301
      },
      {
        "kind": "dialogue",
        "speaker": "Mrs.チハの声",
        "text": "残り二十七。あなたが来るまでには、たぶん足りない",
        "portraitOwner": null,
        "portraitKind": "offscreen",
        "sourceLine": 1303
      },
      {
        "kind": "dialogue",
        "speaker": "ババヤガ",
        "text": "なら、二十六で止めて",
        "portraitOwner": "unit-babayaga",
        "portraitKind": "major",
        "sourceLine": 1305
      },
      {
        "kind": "dialogue",
        "speaker": "Mrs.チハの声",
        "text": "一発、あなた用に残せって？",
        "portraitOwner": null,
        "portraitKind": "offscreen",
        "sourceLine": 1307
      },
      {
        "kind": "dialogue",
        "speaker": "ババヤガ",
        "text": "合流の合図",
        "portraitOwner": "unit-babayaga",
        "portraitKind": "major",
        "sourceLine": 1309
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "短く、向こうで息を吐く音。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 1311
      },
      {
        "kind": "dialogue",
        "speaker": "Mrs.チハの声",
        "text": "馬鹿。早くして",
        "portraitOwner": null,
        "portraitKind": "offscreen",
        "sourceLine": 1313
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が一基目を指し、TKYとパイセンへ二基目、クマバーソンとザキミヤへ三基目を割り振る。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 1315
      },
      {
        "kind": "battle-marker",
        "speaker": "◆ BATTLE",
        "text": "三基のゲートを順に閉鎖し、湾岸への流入を止めよ。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 1317
      }
    ],
    "source": {
      "startLine": 1292,
      "endLine": 1318
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
        "text": "最後のゲートが閉じる。金属を叩く音が次第に遠のき、タワー側の銃声も止まる。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 1321
      },
      {
        "kind": "dialogue",
        "speaker": "Mrs.チハの声",
        "text": "減った。こっちも止まった",
        "portraitOwner": null,
        "portraitKind": "offscreen",
        "sourceLine": 1323
      },
      {
        "kind": "dialogue",
        "speaker": "ババヤガ",
        "text": "残弾は",
        "portraitOwner": "unit-babayaga",
        "portraitKind": "major",
        "sourceLine": 1325
      },
      {
        "kind": "dialogue",
        "speaker": "Mrs.チハの声",
        "text": "一発",
        "portraitOwner": null,
        "portraitKind": "offscreen",
        "sourceLine": 1327
      },
      {
        "kind": "dialogue",
        "speaker": "ババヤガ",
        "text": "上出来",
        "portraitOwner": "unit-babayaga",
        "portraitKind": "major",
        "sourceLine": 1329
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "地図上に、湾岸タワーまでの一本の緑線。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 1331
      },
      {
        "kind": "dialogue",
        "speaker": "セガワ",
        "text": "第三ゲート、予測より十四秒早かった。これなら間に合います",
        "portraitOwner": "segawa",
        "portraitKind": "major",
        "sourceLine": 1333
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "予測って、俺らの？",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 1335
      },
      {
        "kind": "dialogue",
        "speaker": "セガワ",
        "text": "ゲートの閉鎖時間です。急いで",
        "portraitOwner": "segawa",
        "portraitKind": "major",
        "sourceLine": 1337
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "いくらちゃんは何か言いかけ、いまは飲み込む。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 1339
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が装甲車両を湾岸タワーへ発進させる。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 1341
      }
    ],
    "source": {
      "startLine": 1320,
      "endLine": 1342
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
      "startLine": 1320,
      "endLine": 1342
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
        "text": "非常灯が数本だけ生きるタワー前。十二人の避難者が、割れた回廊の内側へ固まっている。Mrs.チハが最後尾でグレネードランチャーを構える。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 1350
      },
      {
        "kind": "dialogue",
        "speaker": "Mrs.チハ",
        "text": "子どもを先に。走らない、前の人を押さない",
        "portraitOwner": "unit-mrs-chiha",
        "portraitKind": "major",
        "sourceLine": 1352
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "広場中央。複数の眼を持つ大型感染体が、回廊の明かりへ向きを変える。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 1354
      },
      {
        "kind": "dialogue",
        "speaker": "ババヤガ",
        "text": "チハ",
        "portraitOwner": "unit-babayaga",
        "portraitKind": "major",
        "sourceLine": 1356
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "Mrs.チハは振り返らない。最後の一発を装填する。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 1358
      },
      {
        "kind": "dialogue",
        "speaker": "Mrs.チハ",
        "text": "返事は、これを退かしてから",
        "portraitOwner": "unit-mrs-chiha",
        "portraitKind": "major",
        "sourceLine": 1360
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "砲声。最後の弾が大型個体の顔面を削り、左側の眼だけが一斉に閉じる。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 1362
      },
      {
        "kind": "dialogue",
        "speaker": "Mrs.チハ",
        "text": "左が死角。弾は終わり",
        "portraitOwner": "unit-mrs-chiha",
        "portraitKind": "major",
        "sourceLine": 1364
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が大型個体と避難者の間へ入り、左側へ全員を展開させる。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 1366
      },
      {
        "kind": "boss-marker",
        "speaker": "◆ BOSS",
        "text": "クロメ",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 1368
      },
      {
        "kind": "battle-marker",
        "speaker": "◆ BATTLE",
        "text": "死角から大型個体を崩し、避難回廊を確保せよ。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 1370
      }
    ],
    "source": {
      "startLine": 1349,
      "endLine": 1371
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
        "text": "最後の避難者が装甲車両へ乗る。Mrs.チハは十二人をもう一度数え、そこで初めてババヤガの前に立つ。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 1374
      },
      {
        "kind": "dialogue",
        "speaker": "Mrs.チハ",
        "text": "……ほんとに来た",
        "portraitOwner": "unit-mrs-chiha",
        "portraitKind": "major",
        "sourceLine": 1376
      },
      {
        "kind": "dialogue",
        "speaker": "ババヤガ",
        "text": "うん",
        "portraitOwner": "unit-babayaga",
        "portraitKind": "major",
        "sourceLine": 1378
      },
      {
        "kind": "dialogue",
        "speaker": "Mrs.チハ",
        "text": "遅い",
        "portraitOwner": "unit-mrs-chiha",
        "portraitKind": "major",
        "sourceLine": 1380
      },
      {
        "kind": "dialogue",
        "speaker": "ババヤガ",
        "text": "ごめん。牛乳も買えんかった",
        "portraitOwner": "unit-babayaga",
        "portraitKind": "major",
        "sourceLine": 1382
      },
      {
        "kind": "dialogue",
        "speaker": "Mrs.チハ",
        "text": "見れば分かる",
        "portraitOwner": "unit-mrs-chiha",
        "portraitKind": "major",
        "sourceLine": 1384
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "Mrs.チハがババヤガの肩、腕、首筋を順に確かめる。噛み傷がないと分かると、額を一度だけ彼の肩へ置く。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 1386
      },
      {
        "kind": "dialogue",
        "speaker": "ババヤガ",
        "text": "そっちは",
        "portraitOwner": "unit-babayaga",
        "portraitKind": "major",
        "sourceLine": 1388
      },
      {
        "kind": "dialogue",
        "speaker": "Mrs.チハ",
        "text": "かすり傷。噛まれてない",
        "portraitOwner": "unit-mrs-chiha",
        "portraitKind": "major",
        "sourceLine": 1390
      },
      {
        "kind": "dialogue",
        "speaker": "ババヤガ",
        "text": "見せて",
        "portraitOwner": "unit-babayaga",
        "portraitKind": "major",
        "sourceLine": 1392
      },
      {
        "kind": "dialogue",
        "speaker": "Mrs.チハ",
        "text": "あとで。先に、十二人を病院へ",
        "portraitOwner": "unit-mrs-chiha",
        "portraitKind": "major",
        "sourceLine": 1394
      },
      {
        "kind": "dialogue",
        "speaker": "ババヤガ",
        "text": "……分かった",
        "portraitOwner": "unit-babayaga",
        "portraitKind": "major",
        "sourceLine": 1396
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "避難回廊の防疫扉がロックされたまま。いくらちゃんが端末を開くより早く、Mrs.チハが八桁の認証番号を入力する。扉が開く。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 1398
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "その番号、どこで？",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 1400
      },
      {
        "kind": "dialogue",
        "speaker": "Mrs.チハ",
        "text": "会社員をしてた時、業務資料で見たの。役に立つ日が来るとは思わなかったけど",
        "portraitOwner": "unit-mrs-chiha",
        "portraitKind": "major",
        "sourceLine": 1402
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "Mrs.チハの答えは滑らかすぎる。いくらちゃんは笑って頷き、入力履歴だけ保存する。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 1404
      },
      {
        "kind": "dialogue",
        "speaker": "ザキミヤ",
        "text": "全体台帳の場所、分かる？",
        "portraitOwner": "unit-zakimiya",
        "portraitKind": "major",
        "sourceLine": 1406
      },
      {
        "kind": "dialogue",
        "speaker": "Mrs.チハ",
        "text": "市民資料館。データだけじゃなく紙もある。あなたの家族も追えるはず",
        "portraitOwner": "unit-mrs-chiha",
        "portraitKind": "major",
        "sourceLine": 1408
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公がMrs.チハへ予備弾薬箱を渡し、装甲車両の席を空ける。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 1410
      },
      {
        "kind": "dialogue",
        "speaker": "Mrs.チハ",
        "text": "**{{PLAYER_NAME}}**さんね。夫を連れてきてくれて、ありがとう",
        "portraitOwner": "unit-mrs-chiha",
        "portraitKind": "major",
        "sourceLine": 1412
      }
    ],
    "source": {
      "startLine": 1373,
      "endLine": 1415
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
      "startLine": 1373,
      "endLine": 1415
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
        "text": "地下保管室。紙の名簿が棚から崩れ、端末では遠隔消去が進んでいる。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 1423
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "データは私が止めます。紙は、上の棚から順に外へ",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 1425
      },
      {
        "kind": "dialogue",
        "speaker": "ザキミヤ",
        "text": "俺の二人だけ、先に――",
        "portraitOwner": "unit-zakimiya",
        "portraitKind": "major",
        "sourceLine": 1427
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "棚を埋める無数の名前を見て、言葉を止める。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 1429
      },
      {
        "kind": "dialogue",
        "speaker": "ザキミヤ",
        "text": "……いや。全部やって。途中を飛ばしたら、誰かの二人が消える",
        "portraitOwner": "unit-zakimiya",
        "portraitKind": "major",
        "sourceLine": 1431
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "分かった。上から全部",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 1433
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が最上段の紙箱を下ろし、搬出口へ回す。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 1435
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "大型モニターが勝手に点く。「MUGARIAN PHARMACEUTICAL／代表取締役」の表示。発生前のテレビ広告と同じ、上質なスーツの男が、広い執務室からこちらを見ている。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 1437
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "社長本人。医薬品だけじゃなく、防災物流と検疫契約まで広げた人です",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 1439
      },
      {
        "kind": "dialogue",
        "speaker": "ムガリアン社長",
        "text": "コンバンハ、**{{PLAYER_NAME}}**さん",
        "portraitOwner": "mugarian-president",
        "portraitKind": "major",
        "sourceLine": 1441
      },
      {
        "kind": "dialogue",
        "speaker": "ムガリアン社長",
        "text": "勝手に会社の資産を持ち出すのは、よくない商談デスネ",
        "portraitOwner": "mugarian-president",
        "portraitKind": "major",
        "sourceLine": 1443
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "何で名前知ってるんすか",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 1445
      },
      {
        "kind": "dialogue",
        "speaker": "ムガリアン社長",
        "text": "当社設備へ何度も入ったでしょう？　お客様の顔と名前は覚えますヨ",
        "portraitOwner": "mugarian-president",
        "portraitKind": "major",
        "sourceLine": 1447
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "人の名簿まで資産にすんな",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 1449
      },
      {
        "kind": "dialogue",
        "speaker": "ムガリアン社長",
        "text": "管理にはコストが掛かる。コストが掛かるものには、所有者が要る。Simpleな話デス",
        "portraitOwner": "mugarian-president",
        "portraitKind": "major",
        "sourceLine": 1451
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "Mrs.チハの表情がわずかに固まる。ババヤガが横目で見る。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 1453
      },
      {
        "kind": "dialogue",
        "speaker": "ムガリアン社長",
        "text": "名簿を戻せば、消去を止めましょう。薬、燃料、通行権も付ける",
        "portraitOwner": "mugarian-president",
        "portraitKind": "major",
        "sourceLine": 1455
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公がモニターの音量を下げ、紙箱を次の者へ渡す。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 1457
      },
      {
        "kind": "dialogue",
        "speaker": "ムガリアン社長",
        "text": "……聞く気がない人は、商談が速いデスネ",
        "portraitOwner": "mugarian-president",
        "portraitKind": "major",
        "sourceLine": 1459
      },
      {
        "kind": "battle-marker",
        "speaker": "◆ BATTLE",
        "text": "遠隔消去端末と紙台帳の搬出路を防衛せよ。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 1461
      }
    ],
    "source": {
      "startLine": 1422,
      "endLine": 1462
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
        "text": "消去が停止し、紙とデータの両方が残る。いくらちゃんが検索画面を開いたまま、ザキミヤを手招きする。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 1465
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "いた",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 1467
      },
      {
        "kind": "dialogue",
        "speaker": "ザキミヤ",
        "text": "どっちが",
        "portraitOwner": "unit-zakimiya",
        "portraitKind": "major",
        "sourceLine": 1469
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "二人とも。奥さんも娘さんも、三日前に生存確認。臨床試験棟Cへ移されてます",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 1471
      },
      {
        "kind": "dialogue",
        "speaker": "ザキミヤ",
        "text": "三日前……",
        "portraitOwner": "unit-zakimiya",
        "portraitKind": "major",
        "sourceLine": 1473
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "その場へ座り込み、顔を両手で覆う。泣き声を押し殺し、数秒後に立ち上がる。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 1475
      },
      {
        "kind": "dialogue",
        "speaker": "ザキミヤ",
        "text": "行こう。今すぐ",
        "portraitOwner": "unit-zakimiya",
        "portraitKind": "major",
        "sourceLine": 1477
      },
      {
        "kind": "dialogue",
        "speaker": "Mrs.チハ",
        "text": "行く。でも、これを先に西新側へ出す。社長は証拠が消えるまで何度でも道を塞ぐ",
        "portraitOwner": "unit-mrs-chiha",
        "portraitKind": "major",
        "sourceLine": 1479
      },
      {
        "kind": "dialogue",
        "speaker": "ババヤガ",
        "text": "詳しいね",
        "portraitOwner": "unit-babayaga",
        "portraitKind": "major",
        "sourceLine": 1481
      },
      {
        "kind": "dialogue",
        "speaker": "Mrs.チハ",
        "text": "会社って、そういうものでしょ",
        "portraitOwner": "unit-mrs-chiha",
        "portraitKind": "major",
        "sourceLine": 1483
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "ババヤガは答えず、紙箱を一つ持ち上げる。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 1485
      },
      {
        "kind": "dialogue",
        "speaker": "セガワ",
        "text": "海浜連絡橋が最短です。名簿は三か所へ複製して。会社が取り返せない場所へ",
        "portraitOwner": "segawa",
        "portraitKind": "major",
        "sourceLine": 1487
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が証拠ケースを封じ、搬送車へ積む。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 1489
      }
    ],
    "source": {
      "startLine": 1464,
      "endLine": 1490
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
      "startLine": 1464,
      "endLine": 1490
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
        "text": "橋の中央を黒い装甲車両が塞ぐ。後方に証拠搬送車。遮断機は下りたまま。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 1498
      },
      {
        "kind": "dialogue",
        "speaker": "ムガリアン社長",
        "text": "その資料、返してください。薬、燃料、食料。欲しいものを言ってクダサイ",
        "portraitOwner": "mugarian-president",
        "portraitKind": "major",
        "sourceLine": 1500
      },
      {
        "kind": "dialogue",
        "speaker": "ザキミヤ",
        "text": "臨床試験棟の人は",
        "portraitOwner": "unit-zakimiya",
        "portraitKind": "major",
        "sourceLine": 1502
      },
      {
        "kind": "dialogue",
        "speaker": "ムガリアン社長",
        "text": "解放しましょう。あなたの奥様と赤ちゃんも、もちろん",
        "portraitOwner": "mugarian-president",
        "portraitKind": "major",
        "sourceLine": 1504
      },
      {
        "kind": "dialogue",
        "speaker": "ザキミヤ",
        "text": "人を値段に入れるな",
        "portraitOwner": "unit-zakimiya",
        "portraitKind": "major",
        "sourceLine": 1506
      },
      {
        "kind": "dialogue",
        "speaker": "ムガリアン社長",
        "text": "値段を付けているのは資料ですヨ。人には、交換価値があるだけ",
        "portraitOwner": "mugarian-president",
        "portraitKind": "major",
        "sourceLine": 1508
      },
      {
        "kind": "dialogue",
        "speaker": "Mrs.チハ",
        "text": "同じよ",
        "portraitOwner": "unit-mrs-chiha",
        "portraitKind": "major",
        "sourceLine": 1510
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "セガワから保守車線の図面。開く時間は七秒。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 1512
      },
      {
        "kind": "dialogue",
        "speaker": "セガワ",
        "text": "搬送車一台なら抜けます。運転手は残らず、そのまま西新側へ",
        "portraitOwner": "segawa",
        "portraitKind": "major",
        "sourceLine": 1514
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "パイセンが運転席へ飛び乗り、シートベルトを引く。引いてから顔が青くなる。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 1516
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "七秒、俺っすか",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 1518
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "自分で乗ったやろ",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 1520
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "乗ってから怖くなったんすよ！",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 1522
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公がパイセンの扉を一度叩き、装甲車両を盾になる位置へ出す。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 1524
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "無言で任せるの、断りづらいんだよなあ……！",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 1526
      },
      {
        "kind": "battle-marker",
        "speaker": "◆ BATTLE",
        "text": "七秒間の保守車線を確保し、証拠搬送車を通過させよ。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 1528
      }
    ],
    "source": {
      "startLine": 1497,
      "endLine": 1529
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
        "text": "搬送車が遮断機を擦りながら西新側へ抜ける。無線の向こうでパイセンが大きく息を吐く。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 1532
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "複製完了。病院、区役所、外周拠点。もう全部は消せません",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 1534
      },
      {
        "kind": "dialogue",
        "speaker": "ムガリアン社長",
        "text": "警察も裁判所も、いまは来ませんヨ。紙を三枚にして、誰に訴える？",
        "portraitOwner": "mugarian-president",
        "portraitKind": "major",
        "sourceLine": 1536
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "今すぐ裁けなくても、誰が何をしたかは残せます",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 1538
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "お前んとこへ直接行く",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 1540
      },
      {
        "kind": "dialogue",
        "speaker": "ムガリアン社長",
        "text": "どうぞ。商談室は、まだ壊れていません",
        "portraitOwner": "mugarian-president",
        "portraitKind": "major",
        "sourceLine": 1542
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "通信が切れる。入れ替わるように、セガワの声。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 1544
      },
      {
        "kind": "dialogue",
        "speaker": "セガワ",
        "text": "河口防潮門が開いたままです。大型感染者が西新側へ入り始めた",
        "portraitOwner": "segawa",
        "portraitKind": "major",
        "sourceLine": 1546
      },
      {
        "kind": "dialogue",
        "speaker": "ザキミヤ",
        "text": "試験棟は、橋の向こうやろ",
        "portraitOwner": "unit-zakimiya",
        "portraitKind": "major",
        "sourceLine": 1548
      },
      {
        "kind": "dialogue",
        "speaker": "Mrs.チハ",
        "text": "今閉めなければ、病院まで繋いだ道が消える",
        "portraitOwner": "unit-mrs-chiha",
        "portraitKind": "major",
        "sourceLine": 1550
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "ザキミヤは臨床試験棟の方向を見る。腰の瓶を握り、すぐ放す。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 1552
      },
      {
        "kind": "dialogue",
        "speaker": "ザキミヤ",
        "text": "……先に門。帰る場所まで失くしたら、あの二人を助けても置く場所がない",
        "portraitOwner": "unit-zakimiya",
        "portraitKind": "major",
        "sourceLine": 1554
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が装甲車両を反転させ、河口へ向ける。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 1556
      }
    ],
    "source": {
      "startLine": 1531,
      "endLine": 1557
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
      "startLine": 1531,
      "endLine": 1557
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
        "text": "中央ゲートが開いたまま。濁流とともに感染者が断続的に入り、中央で大型個体ガイレンが門柱を押さえている。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 1565
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "ここを閉めたら、商店街から病院まで夜でも歩けます。薬も、人も、自転車で通せる",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 1567
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "なら閉める。飯運ぶ道がない街は、取り戻したことにならん",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 1569
      },
      {
        "kind": "dialogue",
        "speaker": "セガワ",
        "text": "ガイレンを門柱から引き離してください。門が閉じれば、流入を止められます",
        "portraitOwner": "segawa",
        "portraitKind": "major",
        "sourceLine": 1571
      },
      {
        "kind": "dialogue",
        "speaker": "TKY",
        "text": "了解。門から剥がすわ",
        "portraitOwner": "unit-tky",
        "portraitKind": "major",
        "sourceLine": 1573
      },
      {
        "kind": "dialogue",
        "speaker": "ババヤガ",
        "text": "離れた瞬間に二発。外したら赤字",
        "portraitOwner": "unit-babayaga",
        "portraitKind": "major",
        "sourceLine": 1575
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "この人、弾丸を決算で撃ってるんすか",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 1577
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が門の手動閉鎖盤を起動し、ガイレンを水路側へ誘導する。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 1579
      },
      {
        "kind": "boss-marker",
        "speaker": "◆ BOSS",
        "text": "ガイレン",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 1581
      },
      {
        "kind": "battle-marker",
        "speaker": "◆ BATTLE",
        "text": "ガイレンを門柱から引き離し、防潮門を閉鎖せよ。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 1583
      }
    ],
    "source": {
      "startLine": 1564,
      "endLine": 1584
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
        "text": "中央ゲートが閉じる。外側から感染者がぶつかるが、門は動かない。装甲車両の地図で、商店街、区役所、駅、病院が一本の緑線へ繋がる。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 1587
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "夜。仮設灯の下を、薬を積んだ自転車が病院へ走る。住民が二人、三人と道を歩く。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 1589
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "……人、歩いてる",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 1591
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "道、開けたけんね",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 1593
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "分かってるんすけど。ああ、ほんとに開いたんだなって",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 1595
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "主人公が地図を畳まず、しばらく緑線を見ている。無線へ、急に大きな声。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 1597
      },
      {
        "kind": "dialogue",
        "speaker": "クレイジーキング",
        "text": "道が開いたな！　王の補給車が通るぞ、頭を下げろ！　積み荷は缶詰だ！",
        "portraitOwner": "unit-crazy-king",
        "portraitKind": "major",
        "sourceLine": 1599
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "頭は下げんでいい。缶詰は病院へ半分！",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 1601
      },
      {
        "kind": "dialogue",
        "speaker": "クレイジーキング",
        "text": "民の要求、承認！　残り半分は王が守る！",
        "portraitOwner": "unit-crazy-king",
        "portraitKind": "major",
        "sourceLine": 1603
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "派手に塗られた補給車が、安全回廊へ入っていく。パイセンが小さく笑い、それ以上は何も言わない。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 1605
      },
      {
        "kind": "dialogue",
        "speaker": "Mrs.チハ",
        "text": "会社を残せば、また門を開けられる",
        "portraitOwner": "unit-mrs-chiha",
        "portraitKind": "major",
        "sourceLine": 1607
      },
      {
        "kind": "dialogue",
        "speaker": "ザキミヤ",
        "text": "試験棟も、本社側や",
        "portraitOwner": "unit-zakimiya",
        "portraitKind": "major",
        "sourceLine": 1609
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "帰る道は作った。次、壊しに来るやつを止めるぞ",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 1611
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が本社側の地図を広げ、進入路へ線を引く。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 1613
      }
    ],
    "source": {
      "startLine": 1586,
      "endLine": 1614
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
      "startLine": 1586,
      "endLine": 1614
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
        "text": "高いフェンスの内側に黒い装甲車両。ゲート上には、赤レンズのガスマスク部隊が整列している。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 1662
      },
      {
        "kind": "dialogue",
        "speaker": "赤レンズの隊長",
        "text": "記録媒体を置け。車両から離れろ",
        "portraitOwner": "red-panther-commander",
        "portraitKind": "major",
        "sourceLine": 1664
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "臨床棟の人を返せ",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 1666
      },
      {
        "kind": "dialogue",
        "speaker": "赤レンズの隊長",
        "text": "交渉権限はない",
        "portraitOwner": "red-panther-commander",
        "portraitKind": "major",
        "sourceLine": 1668
      },
      {
        "kind": "dialogue",
        "speaker": "TKY",
        "text": "撃つ権限は？",
        "portraitOwner": "unit-tky",
        "portraitKind": "major",
        "sourceLine": 1670
      },
      {
        "kind": "dialogue",
        "speaker": "赤レンズの隊長",
        "text": "ある",
        "portraitOwner": "red-panther-commander",
        "portraitKind": "major",
        "sourceLine": 1672
      },
      {
        "kind": "dialogue",
        "speaker": "TKY",
        "text": "そっちはあるんやな。便利な会社や",
        "portraitOwner": "unit-tky",
        "portraitKind": "major",
        "sourceLine": 1674
      },
      {
        "kind": "dialogue",
        "speaker": "宮本武蔵",
        "text": "面を隠した兵か。足並みはよい。されど、退く気はないらしい",
        "portraitOwner": "unit-miyamoto-musashi",
        "portraitKind": "major",
        "sourceLine": 1676
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "隊員が小型の音響誘導装置を構える。Mrs.チハが誰より先に、東制御塔を見る。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 1678
      },
      {
        "kind": "dialogue",
        "speaker": "Mrs.チハ",
        "text": "投げられる前に東塔を落として。あれは周囲の感染者を呼ぶ",
        "portraitOwner": "unit-mrs-chiha",
        "portraitKind": "major",
        "sourceLine": 1680
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "見たことあるんですか",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 1682
      },
      {
        "kind": "dialogue",
        "speaker": "Mrs.チハ",
        "text": "仕様書で",
        "portraitOwner": "unit-mrs-chiha",
        "portraitKind": "major",
        "sourceLine": 1684
      },
      {
        "kind": "dialogue",
        "speaker": "ババヤガ",
        "text": "普通のOLが",
        "portraitOwner": "unit-babayaga",
        "portraitKind": "major",
        "sourceLine": 1686
      },
      {
        "kind": "dialogue",
        "speaker": "Mrs.チハ",
        "text": "普通じゃない会社だったから",
        "portraitOwner": "unit-mrs-chiha",
        "portraitKind": "major",
        "sourceLine": 1688
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "隊長の赤いレンズが、Mrs.チハの上で一拍だけ止まる。装置が投げられ、甲高い音が周囲へ走る。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 1690
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が装甲車両を誘導装置と避難者側の間へ入れ、東塔を指す。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 1692
      },
      {
        "kind": "battle-marker",
        "speaker": "◆ BATTLE",
        "text": "誘導装置を止め、防疫ゲートを制圧せよ。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 1694
      }
    ],
    "source": {
      "startLine": 1661,
      "endLine": 1695
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
        "text": "防疫制御が停止し、搬入ゲートが開く。壁の護送予定表に「臨床試験棟C／収容者43」。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 1698
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "四十三人。ザキミヤさん、二人ともいます。今朝の確認まで生存",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 1700
      },
      {
        "kind": "dialogue",
        "speaker": "ザキミヤ",
        "text": "今朝。そこにおるんやな",
        "portraitOwner": "unit-zakimiya",
        "portraitKind": "major",
        "sourceLine": 1702
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "処分警報が鳴る。Mrs.チハが表示を見た瞬間、残り時間を口にする。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 1704
      },
      {
        "kind": "dialogue",
        "speaker": "Mrs.チハ",
        "text": "八分。生命維持を落としてから焼却",
        "portraitOwner": "unit-mrs-chiha",
        "portraitKind": "major",
        "sourceLine": 1706
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "何で、表示前に分かったんすか",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 1708
      },
      {
        "kind": "dialogue",
        "speaker": "セガワ",
        "text": "彼女の話は後です。八分なら、いま走らないと間に合わない",
        "portraitOwner": "segawa",
        "portraitKind": "major",
        "sourceLine": 1710
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公がMrs.チハを見る。問いは口にせず、臨床棟を指して走る。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 1712
      }
    ],
    "source": {
      "startLine": 1697,
      "endLine": 1713
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
      "startLine": 1697,
      "endLine": 1713
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
        "text": "白い廊下。「救命」「先進治療」の広告。扉の内側から大勢が叩く音。館内放送が生命維持停止を告げる。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 1721
      },
      {
        "kind": "dialogue",
        "speaker": "ザキミヤ",
        "text": "C-4、どっち！",
        "portraitOwner": "unit-zakimiya",
        "portraitKind": "major",
        "sourceLine": 1723
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "奥！　でも、順番に電源を戻さないと全室ロックされます！",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 1725
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "ザキミヤが走り出す。主人公が腕を掴む。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 1727
      },
      {
        "kind": "dialogue",
        "speaker": "ザキミヤ",
        "text": "分かっとる！　俺だけ行ったら、ほかが閉まるんやろ！",
        "portraitOwner": "unit-zakimiya",
        "portraitKind": "major",
        "sourceLine": 1729
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "一度、息を吐く。掴まれた腕の震えが止まらない。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 1731
      },
      {
        "kind": "dialogue",
        "speaker": "ザキミヤ",
        "text": "分かっとるけん……早く、手伝って",
        "portraitOwner": "unit-zakimiya",
        "portraitKind": "major",
        "sourceLine": 1733
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "Mrs.チハが制御盤を開き、隠しロックを迷わず外す。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 1735
      },
      {
        "kind": "dialogue",
        "speaker": "Mrs.チハ",
        "text": "手動なら一室ずつ戻せる。東から。C-4は最後になる",
        "portraitOwner": "unit-mrs-chiha",
        "portraitKind": "major",
        "sourceLine": 1737
      },
      {
        "kind": "dialogue",
        "speaker": "ザキミヤ",
        "text": "最後……",
        "portraitOwner": "unit-zakimiya",
        "portraitKind": "major",
        "sourceLine": 1739
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "最後まで開ける。四十三人、全部や",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 1741
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が最初の生命維持レバーを上げる。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 1743
      },
      {
        "kind": "battle-marker",
        "speaker": "◆ BATTLE",
        "text": "処分手順を止め、四十三の収容室を順に開放せよ。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 1745
      }
    ],
    "source": {
      "startLine": 1720,
      "endLine": 1746
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
        "text": "最後の隔壁が開く。C-4保護室。乳児を抱いた女性が、入口のザキミヤを見る。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 1749
      },
      {
        "kind": "dialogue",
        "speaker": "ザキミヤの妻",
        "text": "……生きとったん",
        "portraitOwner": "minor-human-shared-event-silhouette",
        "portraitKind": "minor",
        "sourceLine": 1751
      },
      {
        "kind": "dialogue",
        "speaker": "ザキミヤ",
        "text": "うん",
        "portraitOwner": "unit-zakimiya",
        "portraitKind": "major",
        "sourceLine": 1753
      },
      {
        "kind": "dialogue",
        "speaker": "ザキミヤの妻",
        "text": "遅い",
        "portraitOwner": "minor-human-shared-event-silhouette",
        "portraitKind": "minor",
        "sourceLine": 1755
      },
      {
        "kind": "dialogue",
        "speaker": "ザキミヤ",
        "text": "……うん。ごめん",
        "portraitOwner": "unit-zakimiya",
        "portraitKind": "major",
        "sourceLine": 1757
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "一歩近づく。妻の視線が、血と煤で黒い両手へ落ちる。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 1759
      },
      {
        "kind": "dialogue",
        "speaker": "ザキミヤの妻",
        "text": "その手で触らんで",
        "portraitOwner": "minor-human-shared-event-silhouette",
        "portraitKind": "minor",
        "sourceLine": 1761
      },
      {
        "kind": "dialogue",
        "speaker": "ザキミヤ",
        "text": "あ",
        "portraitOwner": "unit-zakimiya",
        "portraitKind": "major",
        "sourceLine": 1763
      },
      {
        "kind": "dialogue",
        "speaker": "ザキミヤの妻",
        "text": "洗ってきて。ちゃんと",
        "portraitOwner": "minor-human-shared-event-silhouette",
        "portraitKind": "minor",
        "sourceLine": 1765
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "近くの流しで手を洗う。一度。爪に汚れが残る。二度。三度。水が透明になるまで。戻ると、妻が娘を差し出す。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 1767
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "ザキミヤは受け取る前に一度、主人公たちを見る。誰も急かさない。両手で娘を抱く。小さな指が、人差し指を握る。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 1769
      },
      {
        "kind": "dialogue",
        "speaker": "ザキミヤ",
        "text": "俺やぞ。分からんよな。分からんでいい。今から覚えて",
        "portraitOwner": "unit-zakimiya",
        "portraitKind": "major",
        "sourceLine": 1771
      },
      {
        "kind": "dialogue",
        "speaker": "ザキミヤの妻",
        "text": "また行くんやろ",
        "portraitOwner": "minor-human-shared-event-silhouette",
        "portraitKind": "minor",
        "sourceLine": 1773
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "ザキミヤは娘から目を離さず、頷く。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 1775
      },
      {
        "kind": "dialogue",
        "speaker": "ザキミヤの妻",
        "text": "帰ってきて。次は四十三日かけんで",
        "portraitOwner": "minor-human-shared-event-silhouette",
        "portraitKind": "minor",
        "sourceLine": 1777
      },
      {
        "kind": "dialogue",
        "speaker": "ザキミヤ",
        "text": "……分かった。怖くても、帰る",
        "portraitOwner": "unit-zakimiya",
        "portraitKind": "major",
        "sourceLine": 1779
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "娘を妻へ戻し、腰のウイスキー瓶を棚へ置く。一本だけ持ったまま、仲間の方へ戻る。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 1781
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "外部回線へ赤レンズ部隊の通信が割り込む。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 1783
      },
      {
        "kind": "dialogue",
        "speaker": "赤レンズの隊長",
        "text": "エージェントCH-17。収容対象を返還し、帰投しろ",
        "portraitOwner": "red-panther-commander",
        "portraitKind": "major",
        "sourceLine": 1785
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "全員の視線がMrs.チハへ集まる。彼女は否定しない。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 1787
      },
      {
        "kind": "dialogue",
        "speaker": "ババヤガ",
        "text": "チハ",
        "portraitOwner": "unit-babayaga",
        "portraitKind": "major",
        "sourceLine": 1789
      },
      {
        "kind": "dialogue",
        "speaker": "Mrs.チハ",
        "text": "ここでは話せない。追撃が来る",
        "portraitOwner": "unit-mrs-chiha",
        "portraitKind": "major",
        "sourceLine": 1791
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が救出者を安全回廊側へ送り、Mrs.チハを含め全員へ特殊作戦庫への移動を示す。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 1793
      }
    ],
    "source": {
      "startLine": 1748,
      "endLine": 1794
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
      "startLine": 1748,
      "endLine": 1794
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
        "text": "特殊作戦庫。黒い装甲車両、捕獲ケージ、赤レンズの予備マスク。防爆扉の外で、追撃部隊の足音が揃う。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 1802
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "Mrs.チハがグレネードランチャーを床へ置き、認証カードと拳銃も主人公の前へ出す。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 1804
      },
      {
        "kind": "dialogue",
        "speaker": "Mrs.チハ",
        "text": "表の仕事が嘘だったわけじゃない。会社員もしてた",
        "portraitOwner": "unit-mrs-chiha",
        "portraitKind": "major",
        "sourceLine": 1806
      },
      {
        "kind": "dialogue",
        "speaker": "Mrs.チハ",
        "text": "その裏で、ムガリアンの専属エージェントだった",
        "portraitOwner": "unit-mrs-chiha",
        "portraitKind": "major",
        "sourceLine": 1808
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "何をしてたんすか",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 1810
      },
      {
        "kind": "dialogue",
        "speaker": "Mrs.チハ",
        "text": "監査対象の身辺調査、物資の回収、漏れた情報の処理をしてた",
        "portraitOwner": "unit-mrs-chiha",
        "portraitKind": "major",
        "sourceLine": 1812
      },
      {
        "kind": "dialogue",
        "speaker": "Mrs.チハ",
        "text": "発生前に聞かされていたのは、限定した区画で起こす、小規模な感染事故と、その回収だけ",
        "portraitOwner": "unit-mrs-chiha",
        "portraitKind": "major",
        "sourceLine": 1814
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "短かったら、人を噛ませてよかったんか",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 1816
      },
      {
        "kind": "dialogue",
        "speaker": "Mrs.チハ",
        "text": "よくない。仕事だから見ないふりをした",
        "portraitOwner": "unit-mrs-chiha",
        "portraitKind": "major",
        "sourceLine": 1818
      },
      {
        "kind": "dialogue",
        "speaker": "Mrs.チハ",
        "text": "発生二日目、『損失は許容範囲』という報告を読んで、やっと自分が何に加担したか見た",
        "portraitOwner": "unit-mrs-chiha",
        "portraitKind": "major",
        "sourceLine": 1820
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "外の部隊が防爆扉へ爆薬を設置する。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 1822
      },
      {
        "kind": "dialogue",
        "speaker": "Mrs.チハ",
        "text": "避難車の経路を変えた。消される名簿を紙へ戻した",
        "portraitOwner": "unit-mrs-chiha",
        "portraitKind": "major",
        "sourceLine": 1824
      },
      {
        "kind": "dialogue",
        "speaker": "Mrs.チハ",
        "text": "湾岸の人を隠した。中にいれば止められると思ってた",
        "portraitOwner": "unit-mrs-chiha",
        "portraitKind": "major",
        "sourceLine": 1826
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "私たちへ、最初から言わなかったのは？",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 1828
      },
      {
        "kind": "dialogue",
        "speaker": "Mrs.チハ",
        "text": "言えば拘束された。それが正しい判断だったから",
        "portraitOwner": "unit-mrs-chiha",
        "portraitKind": "major",
        "sourceLine": 1830
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "ババヤガは認証カードではなく、妻の顔だけを見る。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 1832
      },
      {
        "kind": "dialogue",
        "speaker": "ババヤガ",
        "text": "俺の仕事も、知っとった？",
        "portraitOwner": "unit-babayaga",
        "portraitKind": "major",
        "sourceLine": 1834
      },
      {
        "kind": "dialogue",
        "speaker": "Mrs.チハ",
        "text": "結婚する前から。証券会社の裏で、人を撃っていたことも",
        "portraitOwner": "unit-mrs-chiha",
        "portraitKind": "major",
        "sourceLine": 1836
      },
      {
        "kind": "dialogue",
        "speaker": "ババヤガ",
        "text": "最初は監視やったん",
        "portraitOwner": "unit-babayaga",
        "portraitKind": "major",
        "sourceLine": 1838
      },
      {
        "kind": "dialogue",
        "speaker": "Mrs.チハ",
        "text": "最初は仕事で調べた。好きになった後も、知ってて黙ってた",
        "portraitOwner": "unit-mrs-chiha",
        "portraitKind": "major",
        "sourceLine": 1840
      },
      {
        "kind": "dialogue",
        "speaker": "ババヤガ",
        "text": "俺が隠せとると思うの、見よったんやね",
        "portraitOwner": "unit-babayaga",
        "portraitKind": "major",
        "sourceLine": 1842
      },
      {
        "kind": "dialogue",
        "speaker": "Mrs.チハ",
        "text": "あなたも、私がただのOLだと思ってた",
        "portraitOwner": "unit-mrs-chiha",
        "portraitKind": "major",
        "sourceLine": 1844
      },
      {
        "kind": "dialogue",
        "speaker": "ババヤガ",
        "text": "同じにせんで",
        "portraitOwner": "unit-babayaga",
        "portraitKind": "major",
        "sourceLine": 1846
      },
      {
        "kind": "dialogue",
        "speaker": "Mrs.チハ",
        "text": "しない。私の方が、もっと悪い",
        "portraitOwner": "unit-mrs-chiha",
        "portraitKind": "major",
        "sourceLine": 1848
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "防爆扉に亀裂。主人公が認証カードを拾う。武器は拾わず、Mrs.チハの足元へ押し戻す。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 1850
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が認証カードを中央端末へ差し、ムガリアンの内部記録を病院・区役所・外周拠点へ一斉送信する項目を選ぶ。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 1852
      },
      {
        "kind": "dialogue",
        "speaker": "Mrs.チハ",
        "text": "それを実行したら、カードは失効する。私も会社へは戻れない",
        "portraitOwner": "unit-mrs-chiha",
        "portraitKind": "major",
        "sourceLine": 1854
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "主人公が実行キーから手を離し、彼女へ場所を譲る。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 1856
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "Mrs.チハは一瞬だけカードを見る。自分で実行キーを押す。内部ログが病院、区役所、外周拠点へ送信され、カードのICが焼ける。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 1858
      },
      {
        "kind": "dialogue",
        "speaker": "赤レンズの隊長",
        "text": "CH-17、送信を止めろ。帰投資格を失うぞ",
        "portraitOwner": "red-panther-commander",
        "portraitKind": "major",
        "sourceLine": 1860
      },
      {
        "kind": "dialogue",
        "speaker": "Mrs.チハ",
        "text": "帰る場所は、もうそっちじゃない",
        "portraitOwner": "unit-mrs-chiha",
        "portraitKind": "major",
        "sourceLine": 1862
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "彼女がグレネードランチャーを拾う。防爆扉が破られる。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 1864
      },
      {
        "kind": "battle-marker",
        "speaker": "◆ BATTLE",
        "text": "追撃部隊を退け、指揮車から本社塔の認証キーを奪取せよ。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 1866
      }
    ],
    "source": {
      "startLine": 1801,
      "endLine": 1867
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
        "text": "指揮車を確保。認証キーと、研究部門から特殊部隊へ出た命令書が見つかる。署名欄は「S特級権限」。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 1870
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "社長権限を通ってない命令があります。検体回収、戦闘記録複製、T-03再生",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 1872
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "T-03は、交差点で回収されたTAKUYAの番号です",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 1874
      },
      {
        "kind": "dialogue",
        "speaker": "Mrs.チハ",
        "text": "特級権限を持っていた研究者は少ない",
        "portraitOwner": "unit-mrs-chiha",
        "portraitKind": "major",
        "sourceLine": 1876
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "セガワ。知っとる？",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 1878
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "無線の向こうで、ごく短い間。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 1880
      },
      {
        "kind": "dialogue",
        "speaker": "セガワ",
        "text": "技術開発塔で原本を確認できます。いま断定すると、社長に逃げる時間を与える",
        "portraitOwner": "segawa",
        "portraitKind": "major",
        "sourceLine": 1882
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "答えになってないっすよ",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 1884
      },
      {
        "kind": "dialogue",
        "speaker": "セガワ",
        "text": "ええ。まだ答えません",
        "portraitOwner": "segawa",
        "portraitKind": "major",
        "sourceLine": 1886
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "ババヤガが新しい弾倉をMrs.チハへ差し出す。彼女が受け取る。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 1888
      },
      {
        "kind": "dialogue",
        "speaker": "ババヤガ",
        "text": "あとで全部聞く",
        "portraitOwner": "unit-babayaga",
        "portraitKind": "major",
        "sourceLine": 1890
      },
      {
        "kind": "dialogue",
        "speaker": "Mrs.チハ",
        "text": "うん。逃げない",
        "portraitOwner": "unit-mrs-chiha",
        "portraitKind": "major",
        "sourceLine": 1892
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が本社塔の認証キーを抜き、技術開発塔へ向かう。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 1894
      }
    ],
    "source": {
      "startLine": 1869,
      "endLine": 1895
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
      "startLine": 1869,
      "endLine": 1895
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
        "text": "透明な隔壁の向こうに、よく似た大型感染体が二体。片方が動くと、わずかに遅れてもう片方も同じ動きをする。壁面には各都市向けの危機対応契約パッケージ。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 1903
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "中央モニターにムガリアン社長。笑顔は残っているが、左手を机の下へ隠している。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 1905
      },
      {
        "kind": "dialogue",
        "speaker": "ムガリアン社長",
        "text": "ずいぶん奥まで来ましたネ。しかも、私のエージェントまで連れて",
        "portraitOwner": "mugarian-president",
        "portraitKind": "major",
        "sourceLine": 1907
      },
      {
        "kind": "dialogue",
        "speaker": "Mrs.チハ",
        "text": "もう、あなたのじゃない",
        "portraitOwner": "unit-mrs-chiha",
        "portraitKind": "major",
        "sourceLine": 1909
      },
      {
        "kind": "dialogue",
        "speaker": "ムガリアン社長",
        "text": "カードを焼いたくらいで過去は消えませんヨ、CH-17",
        "portraitOwner": "mugarian-president",
        "portraitKind": "major",
        "sourceLine": 1911
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "発生前の契約を見た。薬、警備、封鎖、復旧。全部お前らが売る予定やったな",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 1913
      },
      {
        "kind": "dialogue",
        "speaker": "ムガリアン社長",
        "text": "危機は小さく起こし、当社が止める",
        "portraitOwner": "mugarian-president",
        "portraitKind": "major",
        "sourceLine": 1915
      },
      {
        "kind": "dialogue",
        "speaker": "ムガリアン社長",
        "text": "街は残る、行政は契約する、人は薬を買う。Businessとしては美しい",
        "portraitOwner": "mugarian-president",
        "portraitKind": "major",
        "sourceLine": 1917
      },
      {
        "kind": "dialogue",
        "speaker": "ザキミヤ",
        "text": "美しい？　うちの娘まで番号つけて",
        "portraitOwner": "unit-zakimiya",
        "portraitKind": "major",
        "sourceLine": 1919
      },
      {
        "kind": "dialogue",
        "speaker": "ムガリアン社長",
        "text": "この規模は計画ではない！　感染速度も変異も、封じ込めも、全部が想定を越えた",
        "portraitOwner": "mugarian-president",
        "portraitKind": "major",
        "sourceLine": 1921
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "一瞬だけ、漫画的な調子が消える。Mrs.チハが社長の左袖から落ちた黒い血を見る。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 1923
      },
      {
        "kind": "dialogue",
        "speaker": "Mrs.チハ",
        "text": "私は限定実証と聞かされてた。誰が感染体を、あの規模まで変えたの",
        "portraitOwner": "unit-mrs-chiha",
        "portraitKind": "major",
        "sourceLine": 1925
      },
      {
        "kind": "dialogue",
        "speaker": "ムガリアン社長",
        "text": "あなたたちが信用している博士に聞けばいい",
        "portraitOwner": "mugarian-president",
        "portraitKind": "major",
        "sourceLine": 1927
      },
      {
        "kind": "dialogue",
        "speaker": "ムガリアン社長",
        "text": "戦闘記録まで、ずいぶん熱心に見ている人デスヨ",
        "portraitOwner": "mugarian-president",
        "portraitKind": "major",
        "sourceLine": 1929
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "セガワさん",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 1931
      },
      {
        "kind": "dialogue",
        "speaker": "セガワ",
        "text": "社長は責任を分けたいだけです。先に中央の制御装置を切って。二体の連携が崩れます",
        "portraitOwner": "segawa",
        "portraitKind": "major",
        "sourceLine": 1933
      },
      {
        "kind": "dialogue",
        "speaker": "ムガリアン社長",
        "text": "ほら、またあなたたちを動かす",
        "portraitOwner": "mugarian-president",
        "portraitKind": "major",
        "sourceLine": 1935
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "フタゴの隔壁が開く。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 1937
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公は無線へ答えず、自分で中央の制御装置を確認し、切断箇所を選ぶ。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 1939
      },
      {
        "kind": "boss-marker",
        "speaker": "◆ BOSS",
        "text": "フタゴ",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 1941
      },
      {
        "kind": "battle-marker",
        "speaker": "◆ BATTLE",
        "text": "中央の制御装置を切り、二体の連携を崩して撃破せよ。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 1943
      }
    ],
    "source": {
      "startLine": 1902,
      "endLine": 1944
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
        "text": "フタゴが別々の場所へ倒れる。役員研究所への昇降路が開く。モニターの社長が立ち上がり、隠していた左手を一瞬だけ押さえる。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 1947
      },
      {
        "kind": "dialogue",
        "speaker": "Mrs.チハ",
        "text": "噛まれてる",
        "portraitOwner": "unit-mrs-chiha",
        "portraitKind": "major",
        "sourceLine": 1949
      },
      {
        "kind": "dialogue",
        "speaker": "ムガリアン社長",
        "text": "心配はいりません。当社には薬がある",
        "portraitOwner": "mugarian-president",
        "portraitKind": "major",
        "sourceLine": 1951
      },
      {
        "kind": "dialogue",
        "speaker": "Mrs.チハ",
        "text": "完成した薬はない",
        "portraitOwner": "unit-mrs-chiha",
        "portraitKind": "major",
        "sourceLine": 1953
      },
      {
        "kind": "dialogue",
        "speaker": "ムガリアン社長",
        "text": "社長にだけ出す薬は、社員に見せないものデス",
        "portraitOwner": "mugarian-president",
        "portraitKind": "major",
        "sourceLine": 1955
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "通信が切れる。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 1957
      },
      {
        "kind": "dialogue",
        "speaker": "TKY",
        "text": "逃げへんのやな",
        "portraitOwner": "unit-tky",
        "portraitKind": "major",
        "sourceLine": 1959
      },
      {
        "kind": "dialogue",
        "speaker": "セガワ",
        "text": "逃げるより、自分を買い戻す人です",
        "portraitOwner": "segawa",
        "portraitKind": "major",
        "sourceLine": 1961
      },
      {
        "kind": "dialogue",
        "speaker": "Mrs.チハ",
        "text": "よく知ってるのね",
        "portraitOwner": "unit-mrs-chiha",
        "portraitKind": "major",
        "sourceLine": 1963
      },
      {
        "kind": "dialogue",
        "speaker": "セガワ",
        "text": "長い付き合いなので",
        "portraitOwner": "segawa",
        "portraitKind": "major",
        "sourceLine": 1965
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が昇降路へ入り、全員が続く。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 1967
      }
    ],
    "source": {
      "startLine": 1946,
      "endLine": 1968
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
      "startLine": 1946,
      "endLine": 1968
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
        "text": "防弾ガラスの向こうにムガリアン社長。背後の個人用医療装置には、未承認の処置薬が一本。左腕の黒い変色は肩まで進んでいる。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 1976
      },
      {
        "kind": "dialogue",
        "speaker": "ムガリアン社長",
        "text": "最後に一度、商談しましょう。薬、燃料、食料を西新へ出す",
        "portraitOwner": "mugarian-president",
        "portraitKind": "major",
        "sourceLine": 1978
      },
      {
        "kind": "dialogue",
        "speaker": "ムガリアン社長",
        "text": "残る誘導装置も封鎖設備も止める",
        "portraitOwner": "mugarian-president",
        "portraitKind": "major",
        "sourceLine": 1980
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "主人公は用意された椅子へ座らない。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 1982
      },
      {
        "kind": "dialogue",
        "speaker": "ムガリアン社長",
        "text": "設備と技術者は残す。私の退路も保証する。社会の再建には、経営者が必要デスヨ",
        "portraitOwner": "mugarian-president",
        "portraitKind": "major",
        "sourceLine": 1984
      },
      {
        "kind": "dialogue",
        "speaker": "ザキミヤ",
        "text": "自分の席だけ、まだ残す気か",
        "portraitOwner": "unit-zakimiya",
        "portraitKind": "major",
        "sourceLine": 1986
      },
      {
        "kind": "dialogue",
        "speaker": "ムガリアン社長",
        "text": "席がなければ契約できないでしょう？",
        "portraitOwner": "mugarian-president",
        "portraitKind": "major",
        "sourceLine": 1988
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "死んだ人は戻らん",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 1990
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "社長の笑顔が消える。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 1992
      },
      {
        "kind": "dialogue",
        "speaker": "ムガリアン社長",
        "text": "戻らない。だから、生きている人間へ薬を売る",
        "portraitOwner": "mugarian-president",
        "portraitKind": "major",
        "sourceLine": 1994
      },
      {
        "kind": "dialogue",
        "speaker": "Mrs.チハ",
        "text": "設備は使う。技術者も守る。あなたの所有物には戻さない",
        "portraitOwner": "unit-mrs-chiha",
        "portraitKind": "major",
        "sourceLine": 1996
      },
      {
        "kind": "dialogue",
        "speaker": "ムガリアン社長",
        "text": "本当に、嫌いデスネ。あなた",
        "portraitOwner": "mugarian-president",
        "portraitKind": "major",
        "sourceLine": 1998
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "感染の痙攣で社長の膝が落ちる。医療装置から未承認の処置薬を抜く。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 2000
      },
      {
        "kind": "dialogue",
        "speaker": "セガワ",
        "text": "社長、それは動物試験の途中です。人間へ使えば、抑える前に感染組織が一気に増える",
        "portraitOwner": "segawa",
        "portraitKind": "major",
        "sourceLine": 2002
      },
      {
        "kind": "dialogue",
        "speaker": "ムガリアン社長",
        "text": "他の薬は？",
        "portraitOwner": "mugarian-president",
        "portraitKind": "major",
        "sourceLine": 2004
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "セガワは答えない。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 2006
      },
      {
        "kind": "dialogue",
        "speaker": "ムガリアン社長",
        "text": "ない。なら、これが一番高い生存率だ",
        "portraitOwner": "mugarian-president",
        "portraitKind": "major",
        "sourceLine": 2008
      },
      {
        "kind": "dialogue",
        "speaker": "Mrs.チハ",
        "text": "撃つために使うの？",
        "portraitOwner": "unit-mrs-chiha",
        "portraitKind": "major",
        "sourceLine": 2010
      },
      {
        "kind": "dialogue",
        "speaker": "ムガリアン社長",
        "text": "違う。私は、戦うためではなく生きるために打つ",
        "portraitOwner": "mugarian-president",
        "portraitKind": "major",
        "sourceLine": 2012
      },
      {
        "kind": "dialogue",
        "speaker": "ムガリアン社長",
        "text": "会社も市場も、生きていなければ意味がない",
        "portraitOwner": "mugarian-president",
        "portraitKind": "major",
        "sourceLine": 2014
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "社長が自分の腕へ注射する。数秒、黒い変色が止まる。次の瞬間、血管が逆方向へ膨れ、防弾ガラスが内側から割れる。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 2016
      },
      {
        "kind": "dialogue",
        "speaker": "ムガリアン社長",
        "text": "待て。これは、違う。こんな設計では――",
        "portraitOwner": "mugarian-president",
        "portraitKind": "major",
        "sourceLine": 2018
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公がMrs.チハをガラス片から引き、全員へ退避と迎撃を指示する。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 2020
      },
      {
        "kind": "boss-marker",
        "speaker": "◆ BOSS",
        "text": "変異ムガリアン社長",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 2022
      },
      {
        "kind": "battle-marker",
        "speaker": "◆ BATTLE",
        "text": "医療設備を守りながら、変異した社長を制圧せよ。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 2024
      }
    ],
    "source": {
      "startLine": 1975,
      "endLine": 2025
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
        "text": "変異した社長が床へ倒れる。一部だけ人の輪郭へ戻った顔が、割れた窓の外の街を見る。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 2028
      },
      {
        "kind": "dialogue",
        "speaker": "ムガリアン社長",
        "text": "客が、全部死んだら……誰が薬を買う",
        "portraitOwner": "mugarian-president",
        "portraitKind": "major",
        "sourceLine": 2030
      },
      {
        "kind": "dialogue",
        "speaker": "Mrs.チハ",
        "text": "それでも、最初の火をつけた",
        "portraitOwner": "unit-mrs-chiha",
        "portraitKind": "major",
        "sourceLine": 2032
      },
      {
        "kind": "dialogue",
        "speaker": "ムガリアン社長",
        "text": "小さい火だ。消せるはずだった",
        "portraitOwner": "mugarian-president",
        "portraitKind": "major",
        "sourceLine": 2034
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "人がおる場所へ火をつけた時点で、同じや",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 2036
      },
      {
        "kind": "dialogue",
        "speaker": "ムガリアン社長",
        "text": "墓場は市場にならない。世界まで壊す商売は……私は、していない",
        "portraitOwner": "mugarian-president",
        "portraitKind": "major",
        "sourceLine": 2038
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "呼吸が止まる。施設警報が一つずつ消える。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 2040
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "感染者の誘導装置、停止。臨床棟も、病院側の封鎖も開きました",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 2042
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "……終わった？",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 2044
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "帰って、飯食って、それでも静かやったら言え",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 2046
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "無線へ、地下隔離区画で救出した研究員から緊急通報。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 2048
      },
      {
        "kind": "dialogue",
        "speaker": "研究員の声",
        "text": "湾岸撤収ヤードから冷蔵車が出ます！　社員バスとは別。会社台帳にない車列です！",
        "portraitOwner": null,
        "portraitKind": "offscreen",
        "sourceLine": 2050
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "行き先、隠してます。セガワさんの回線にも載ってない",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 2052
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が社長の主制御を封印し、技術者へ医療設備を引き渡す。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 2054
      }
    ],
    "source": {
      "startLine": 2027,
      "endLine": 2055
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
      "startLine": 2027,
      "endLine": 2055
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
        "text": "夜明け前の撤収ヤード。社員と家族を乗せたバスが正門へ向かい、番号のない冷蔵車三台だけが保守路へ逸れる。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 2079
      },
      {
        "kind": "dialogue",
        "speaker": "研究員の声",
        "text": "社員バスは逃がして！　止めるのは冷蔵車です。あれ、会社の撤収台帳にありません！",
        "portraitOwner": null,
        "portraitKind": "offscreen",
        "sourceLine": 2081
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "冷蔵車は追跡信号を切ってます",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 2083
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "でも先頭車だけ、出発前の配車データに仕込んだ追跡タグが残ってます",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 2085
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "さっきって、いつ埋めたんすか",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 2087
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "みんなが味噌汁を飲んでる時。配車データが一台だけ空欄だったので",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 2089
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "お前、箸持ちながら何しよったん",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 2091
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "仕事です。行儀は悪かったです",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 2093
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "赤レンズの残存部隊が、社員バスではなく冷蔵車だけを護衛する。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 2095
      },
      {
        "kind": "dialogue",
        "speaker": "Mrs.チハ",
        "text": "あれは社長の退避命令じゃない。研究部門の私設回収",
        "portraitOwner": "unit-mrs-chiha",
        "portraitKind": "major",
        "sourceLine": 2097
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が正門の封鎖を解除し、社員バスを先に通す。通過を確認してから冷蔵車列へ進路を切る。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 2099
      },
      {
        "kind": "battle-marker",
        "speaker": "◆ BATTLE",
        "text": "民間車両を巻き込まず、冷蔵車三台を停止せよ。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 2101
      }
    ],
    "source": {
      "startLine": 2078,
      "endLine": 2102
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
        "text": "先頭車の荷室。生体試料の横に、耐衝撃ケースと紙のファイルが積まれている。すべて社内ネットワークから切り離された物理記録。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 2105
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "主人公たちの戦闘写真。編成、負傷、判断時間、退避先。パイセンが区役所で老人を迎えに戻った秒数まで記録されている。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 2107
      },
      {
        "kind": "system",
        "speaker": "■ SYSTEM",
        "text": "西新生存集団／実戦応答記録／観測責任者：SEG-LAB",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 2109
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "これ、俺が怖がってた時間まで書いてある",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 2111
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "病院の機械室からじゃない。薬局を出た頃からです",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 2113
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "街のカメラと、私たちが触った端末を渡り歩いてる",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 2115
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "いくらちゃんは怒鳴らず、写真を一枚ずつ裏返す。指先だけが速い。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 2117
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "助けた人数も、逃げ方も、誰が誰を庇うかも。私たち、人じゃなくて項目だったんだ",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 2119
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "セガワを呼べ",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 2121
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "無線を開く。数秒後、いつもの平らな声。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 2123
      },
      {
        "kind": "dialogue",
        "speaker": "セガワ",
        "text": "はい",
        "portraitOwner": "segawa",
        "portraitKind": "major",
        "sourceLine": 2125
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "この記録、お前やな",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 2127
      },
      {
        "kind": "dialogue",
        "speaker": "セガワ",
        "text": "そうです",
        "portraitOwner": "segawa",
        "portraitKind": "major",
        "sourceLine": 2129
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "普通に認めるんすか。俺ら、何回あんたの言う通りに動いたと思ってる",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 2131
      },
      {
        "kind": "dialogue",
        "speaker": "セガワ",
        "text": "情報は本物でした。薬も、人も、助かった",
        "portraitOwner": "segawa",
        "portraitKind": "major",
        "sourceLine": 2133
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "助けた話を盾にすんな",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 2135
      },
      {
        "kind": "dialogue",
        "speaker": "セガワ",
        "text": "盾にはしていません。助けた。観測した。両方やっただけです",
        "portraitOwner": "segawa",
        "portraitKind": "major",
        "sourceLine": 2137
      },
      {
        "kind": "dialogue",
        "speaker": "Mrs.チハ",
        "text": "冷蔵車をどこへ出すつもりだったの",
        "portraitOwner": "unit-mrs-chiha",
        "portraitKind": "major",
        "sourceLine": 2139
      },
      {
        "kind": "dialogue",
        "speaker": "セガワ",
        "text": "僕の研究区画です。会社が崩れる前に回収する予定だった",
        "portraitOwner": "segawa",
        "portraitKind": "major",
        "sourceLine": 2141
      },
      {
        "kind": "dialogue",
        "speaker": "セガワ",
        "text": "あなたたちがヤードまで戻るとは予測していなかった",
        "portraitOwner": "segawa",
        "portraitKind": "major",
        "sourceLine": 2143
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "予測から外れて、残念でしたね",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 2145
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "見たけりゃ見せてやるよ。あんたを止めるところまで、ちゃんと記録しといてください",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 2147
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "主人公が物理命令書の座標を地図へ出す。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 2149
      },
      {
        "kind": "dialogue",
        "speaker": "セガワ",
        "text": "来ますか",
        "portraitOwner": "segawa",
        "portraitKind": "major",
        "sourceLine": 2151
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が返答の代わりに通信を切り、私設研究区画へ目的地を設定する。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 2153
      }
    ],
    "source": {
      "startLine": 2104,
      "endLine": 2154
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
      "startLine": 2104,
      "endLine": 2154
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
        "text": "旧地下物流網の先。ムガリアンの標章は削られ、赤い豹の部隊章だけが残る。ガスマスク部隊が通路を塞ぐ。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 2164
      },
      {
        "kind": "system",
        "speaker": "■ SYSTEM",
        "text": "SPECIAL OPERATIONS UNIT：RED PANTHER",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 2166
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "RED PANTHER。あのガスマスク部隊の正式名称",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 2168
      },
      {
        "kind": "dialogue",
        "speaker": "Mrs.チハ",
        "text": "研究部門直轄。社長の命令より、特級博士の命令を優先する部隊",
        "portraitOwner": "unit-mrs-chiha",
        "portraitKind": "major",
        "sourceLine": 2170
      },
      {
        "kind": "dialogue",
        "speaker": "RED PANTHER隊長",
        "text": "ネコ殺しのセガワ特級博士命令。ここから先へ入れるな",
        "portraitOwner": "red-panther-commander",
        "portraitKind": "major",
        "sourceLine": 2172
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "本人と話したいだけなんすけど",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 2174
      },
      {
        "kind": "dialogue",
        "speaker": "RED PANTHER隊長",
        "text": "下がれ",
        "portraitOwner": "red-panther-commander",
        "portraitKind": "major",
        "sourceLine": 2176
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "会話する気ないの、会社共通なんすね",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 2178
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が命令書の原本を掲げ、返答がないことを確認して武器を構える。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 2180
      },
      {
        "kind": "battle-marker",
        "speaker": "◆ BATTLE",
        "text": "RED PANTHERの封鎖を突破せよ。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 2182
      }
    ],
    "source": {
      "startLine": 2163,
      "endLine": 2183
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
        "text": "研究区画。古い紙ファイルの表紙に「ムガリアン製薬 技術開発局／特級博士 セガワ／内部通称：ネコ殺し」。付箋には「初期動物試験記録に由来」とだけある。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 2186
      },
      {
        "kind": "system",
        "speaker": "■ SYSTEM",
        "text": "人物名更新：ネコ殺しのセガワ特級博士",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 2188
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "動物実験に由来。自分らで通称まで付けたんすか",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 2190
      },
      {
        "kind": "dialogue",
        "speaker": "セガワ",
        "text": "今、その話が必要ですか",
        "portraitOwner": "segawa",
        "portraitKind": "major",
        "sourceLine": 2192
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "必要じゃないけど、気持ち悪いんすよ",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 2194
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "壁一面に、西新の地図。すべて発生前の日付。商店街、駅、病院、住宅、区役所、湾岸。それぞれに「避難」「残留」「救助」「武装化」の観測欄。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 2196
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "何で西新やった",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 2198
      },
      {
        "kind": "dialogue",
        "speaker": "セガワ",
        "text": "狭い範囲に、都市の機能が揃っていたからです",
        "portraitOwner": "segawa",
        "portraitKind": "major",
        "sourceLine": 2200
      },
      {
        "kind": "dialogue",
        "speaker": "セガワ",
        "text": "人が逃げる。残る。集まる。助ける。奪う。一つの街で全部見られる",
        "portraitOwner": "segawa",
        "portraitKind": "major",
        "sourceLine": 2202
      },
      {
        "kind": "dialogue",
        "speaker": "ザキミヤ",
        "text": "人が住んどるから、都合がよかったってことか",
        "portraitOwner": "unit-zakimiya",
        "portraitKind": "major",
        "sourceLine": 2204
      },
      {
        "kind": "dialogue",
        "speaker": "セガワ",
        "text": "ええ",
        "portraitOwner": "segawa",
        "portraitKind": "major",
        "sourceLine": 2206
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "もうええ。まだ止めるもんがある。先へ行くぞ",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 2208
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "別の壁。西新へ戻った初日の交差点。RED PANTHERがTAKUYAの遺骸を回収している夜間映像。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 2210
      },
      {
        "kind": "system",
        "speaker": "■ SYSTEM",
        "text": "T-03回収／状態：死亡／再生処置：成功",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 2212
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "T-03……TAKUYA",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 2214
      },
      {
        "kind": "dialogue",
        "speaker": "ババヤガ",
        "text": "橙色の防災ベスト。あの日の個体",
        "portraitOwner": "unit-babayaga",
        "portraitKind": "major",
        "sourceLine": 2216
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "映像には、蘇生処置、巨大化、人工装甲の装着、主人公たちの戦い方を学習させる訓練が順に記録されている。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 2218
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "まだ、残してるんですか",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 2220
      },
      {
        "kind": "dialogue",
        "speaker": "セガワ",
        "text": "残すために回収しました。あなたたちのおかげで、よく育った",
        "portraitOwner": "segawa",
        "portraitKind": "major",
        "sourceLine": 2222
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "育ったって言うな",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 2224
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "奥の防壁が開く。日本地図と、複数都市へ伸びる未実行線。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 2226
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公がTAKUYAの映像を停止し、日本地図の管制室へ進む。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 2228
      }
    ],
    "source": {
      "startLine": 2185,
      "endLine": 2229
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
      "startLine": 2185,
      "endLine": 2229
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
        "text": "日本地図から複数都市へ線。多くは「未実行」、一部は通信断で状態不明。西新の外で何が起きているかは判別できない。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 2237
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "これ、専用施設を一から建てたんじゃない。薬局で見つけた支援物資と同じ配送網です",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 2239
      },
      {
        "kind": "dialogue",
        "speaker": "Mrs.チハ",
        "text": "災害用の噴霧器、病院の除染設備、自治体の備蓄倉庫。全部、ムガリアンが先に納入していた",
        "portraitOwner": "unit-mrs-chiha",
        "portraitKind": "major",
        "sourceLine": 2241
      },
      {
        "kind": "dialogue",
        "speaker": "Mrs.チハ",
        "text": "その機械へ、起動命令と薬剤を送る仕組み",
        "portraitOwner": "unit-mrs-chiha",
        "portraitKind": "major",
        "sourceLine": 2243
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "街を助けるための機械を、そのまま街を壊す道具にしたんすか",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 2245
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "次に西新にする場所、こんなに用意してたんすか",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 2247
      },
      {
        "kind": "dialogue",
        "speaker": "セガワ",
        "text": "西新は試験です。結果が取れたら、次へ進む",
        "portraitOwner": "segawa",
        "portraitKind": "major",
        "sourceLine": 2249
      },
      {
        "kind": "dialogue",
        "speaker": "ザキミヤ",
        "text": "会社は終わった。金でもない。何でまだやる",
        "portraitOwner": "unit-zakimiya",
        "portraitKind": "major",
        "sourceLine": 2251
      },
      {
        "kind": "dialogue",
        "speaker": "セガワ",
        "text": "人間は、止め方を知らないからです。戦争も、汚染も、使い潰すことも、まずいと理解して続ける",
        "portraitOwner": "segawa",
        "portraitKind": "major",
        "sourceLine": 2253
      },
      {
        "kind": "dialogue",
        "speaker": "TKY",
        "text": "せやから、あんた一人が止める？",
        "portraitOwner": "unit-tky",
        "portraitKind": "major",
        "sourceLine": 2255
      },
      {
        "kind": "dialogue",
        "speaker": "セガワ",
        "text": "地球から見れば、人類は病原体に近い。自分で治らないなら、外から除く必要がある",
        "portraitOwner": "segawa",
        "portraitKind": "major",
        "sourceLine": 2257
      },
      {
        "kind": "dialogue",
        "speaker": "宮本武蔵",
        "text": "国を治すと称して民を斬る者は、我の時代にもおった",
        "portraitOwner": "unit-miyamoto-musashi",
        "portraitKind": "major",
        "sourceLine": 2259
      },
      {
        "kind": "dialogue",
        "speaker": "ザキミヤ",
        "text": "うちの娘も病原体か",
        "portraitOwner": "unit-zakimiya",
        "portraitKind": "major",
        "sourceLine": 2261
      },
      {
        "kind": "dialogue",
        "speaker": "セガワ",
        "text": "あの子個人に罪はありません",
        "portraitOwner": "segawa",
        "portraitKind": "major",
        "sourceLine": 2263
      },
      {
        "kind": "dialogue",
        "speaker": "ザキミヤ",
        "text": "なら巻き込むな。罪がないって分かる頭で、殺す方を選ぶな",
        "portraitOwner": "unit-zakimiya",
        "portraitKind": "major",
        "sourceLine": 2265
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "最初の保護カバーが閉じ、散布準備が進む。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 2267
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公がカバーを叩き割り、停止レバーを下ろす。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 2269
      },
      {
        "kind": "dialogue",
        "speaker": "セガワ",
        "text": "僕は人類を治したいわけではない。治したいのは地球です",
        "portraitOwner": "segawa",
        "portraitKind": "major",
        "sourceLine": 2271
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "勝手に患者を決めんな。ここ通すぞ",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 2273
      },
      {
        "kind": "battle-marker",
        "speaker": "◆ BATTLE",
        "text": "国内の散布装置をすべて物理停止せよ。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 2275
      }
    ],
    "source": {
      "startLine": 2236,
      "endLine": 2276
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
        "text": "国内の散布装置が一つずつ停止する。最後の線が途切れ、散布準備表示がゼロになる。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 2279
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "国内、未実行分は全部止まりました。通信が切れてる地域は……今は分からない",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 2281
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "助かったって言い切れないんすね",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 2283
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "うん。でも、今ここから出る分は止めた。そこは言い切れる",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 2285
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "地下への扉に三つの表示。「国外提携施設・一斉起動回線」「感染源原株」「TAKUYA（T-03）最終収容区」。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 2287
      },
      {
        "kind": "dialogue",
        "speaker": "Mrs.チハ",
        "text": "原株と国外への起動回線を潰す。T-03は、その後",
        "portraitOwner": "unit-mrs-chiha",
        "portraitKind": "major",
        "sourceLine": 2289
      },
      {
        "kind": "dialogue",
        "speaker": "ババヤガ",
        "text": "その後まで、閉じとればね",
        "portraitOwner": "unit-babayaga",
        "portraitKind": "major",
        "sourceLine": 2291
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が地下扉を開け、研究中枢へ降りる。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 2293
      }
    ],
    "source": {
      "startLine": 2278,
      "endLine": 2294
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
      "startLine": 2278,
      "endLine": 2294
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
        "text": "研究中枢。国外の病院、倉庫、検疫所へ伸びる提携先一覧。その手前の壁一面に、主人公たちの戦闘映像。薬局で手を差し出した瞬間、区役所で一人を待った時間、橋で証拠車を庇った配置まで並ぶ。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 2302
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "上層のガラス室。セガワが研究服のまま立ち、RED PANTHER二名が退避用通路を守る。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 2304
      },
      {
        "kind": "dialogue",
        "speaker": "セガワ",
        "text": "途中から、あなたたちは予測を外れ始めた。効率が悪い選択を、何度もするからです",
        "portraitOwner": "segawa",
        "portraitKind": "major",
        "sourceLine": 2306
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "人を待ったこと言いよるんか",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 2308
      },
      {
        "kind": "dialogue",
        "speaker": "セガワ",
        "text": "一人のために集団を危険へ置く。家族より先に防潮門へ行く",
        "portraitOwner": "segawa",
        "portraitKind": "major",
        "sourceLine": 2310
      },
      {
        "kind": "dialogue",
        "speaker": "セガワ",
        "text": "証拠より負傷者を運ぶ。合理性だけでは再現できなかった",
        "portraitOwner": "segawa",
        "portraitKind": "major",
        "sourceLine": 2312
      },
      {
        "kind": "dialogue",
        "speaker": "セガワ",
        "text": "僕は後回しですか",
        "portraitOwner": "segawa",
        "portraitKind": "major",
        "sourceLine": 2316
      },
      {
        "kind": "dialogue",
        "speaker": "Mrs.チハ",
        "text": "逃げても追う。今は外へ出るものを止める",
        "portraitOwner": "unit-mrs-chiha",
        "portraitKind": "major",
        "sourceLine": 2318
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "国外への起動命令、もう送信準備に入ってます。原株の焼却と同時に止めます",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 2320
      }
    ],
    "source": {
      "startLine": 2301,
      "endLine": 2323
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
        "text": "国外への一斉起動回線が沈黙する。感染源の原株が高熱槽へ落ち、世界地図から予定線が消える。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 2326
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "止まりました。ここから外へ出るものは、もうない",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 2328
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "ガラス室のセガワが、机の下の物理鍵を回す。警報ではなく、低い起動音。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 2330
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "何した",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 2332
      },
      {
        "kind": "dialogue",
        "speaker": "セガワ",
        "text": "最後の治療です",
        "portraitOwner": "segawa",
        "portraitKind": "major",
        "sourceLine": 2334
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "地下深くで巨大な拘束具が外れる。モニターへ、人工装甲に覆われたTAKUYA。研究表示が更新される。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 2336
      },
      {
        "kind": "system",
        "speaker": "■ SYSTEM",
        "text": "T-03／最終強化形態／個体名：TAKUYA-Ω",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 2338
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "自分で、出したんすか",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 2340
      },
      {
        "kind": "dialogue",
        "speaker": "セガワ",
        "text": "ええ。事故でも保険でもない。僕の意思です",
        "portraitOwner": "segawa",
        "portraitKind": "major",
        "sourceLine": 2342
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "進路、西新……安全回廊へ向かってる！",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 2344
      },
      {
        "kind": "dialogue",
        "speaker": "セガワ",
        "text": "あなたたちが、戦いながら教えたんです",
        "portraitOwner": "segawa",
        "portraitKind": "major",
        "sourceLine": 2346
      },
      {
        "kind": "dialogue",
        "speaker": "セガワ",
        "text": "負傷者をどこへ運ぶか。人がどこへ集まるか。街を守る時、誰がどこに立つか",
        "portraitOwner": "segawa",
        "portraitKind": "major",
        "sourceLine": 2348
      },
      {
        "kind": "dialogue",
        "speaker": "Mrs.チハ",
        "text": "最初から、そのために見てたの",
        "portraitOwner": "unit-mrs-chiha",
        "portraitKind": "major",
        "sourceLine": 2350
      },
      {
        "kind": "dialogue",
        "speaker": "セガワ",
        "text": "最終個体が、生存集団を自力で見つけ、除去できるか。その答えが要る",
        "portraitOwner": "segawa",
        "portraitKind": "major",
        "sourceLine": 2352
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "RED PANTHERが退避通路の隔壁を落とす。セガワは移動式の指揮車両へ乗り込む。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 2354
      },
      {
        "kind": "dialogue",
        "speaker": "セガワ",
        "text": "制御は僕にしかできません。西新で待っています",
        "portraitOwner": "segawa",
        "portraitKind": "major",
        "sourceLine": 2356
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "TAKUYA-Ωの巨体が床を破り、別の搬出口へ進む。崩落で追跡路が一時塞がる。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 2358
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が装甲車両のキーを取り、崩れた研究区画を迂回して西新へ戻る。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 2360
      }
    ],
    "source": {
      "startLine": 2325,
      "endLine": 2361
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
      "startLine": 2325,
      "endLine": 2361
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
        "text": "夜明け前。西新へ戻った初日と同じ交差点。避難バスの列が安全回廊へ入り切らず、病院と商店街の灯りがその向こうに残る。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 2371
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "道路標識が揺れる。建物の陰から、人工装甲に覆われた脚。さらに一歩。路面のガラス片が跳ねる。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 2373
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "TAKUYA-Ω。以前とは比較にならない巨体。背中には何本もの投薬管。橙色の防災ベストの切れ端が、人工装甲へ縫い込まれている。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 2375
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "……TAKUYAっす。防災ベスト、あの日の",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 2377
      },
      {
        "kind": "dialogue",
        "speaker": "ババヤガ",
        "text": "同じ個体。死体から、ここまで育てた",
        "portraitOwner": "unit-babayaga",
        "portraitKind": "major",
        "sourceLine": 2379
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "巨体の前方に、セガワの移動指揮車。主人公が装甲車両で路肩の障害物を弾き、指揮車の退路を塞ぐ。車体が傾き、セガワとRED PANTHER二名が外へ出る。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 2381
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "セガワの手には、携帯型の制御発信器。TAKUYA-Ωが彼へ顔を向ける。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 2383
      },
      {
        "kind": "dialogue",
        "speaker": "セガワ",
        "text": "停止",
        "portraitOwner": "segawa",
        "portraitKind": "major",
        "sourceLine": 2385
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "高い制御音。巨体が、命令どおり動きを止める。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 2387
      },
      {
        "kind": "dialogue",
        "speaker": "セガワ",
        "text": "見てください。力だけではない。命令、標的の選別、移動経路まで学習させた",
        "portraitOwner": "segawa",
        "portraitKind": "major",
        "sourceLine": 2389
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "その結果で、人を踏ませるんか",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 2391
      },
      {
        "kind": "dialogue",
        "speaker": "セガワ",
        "text": "安全回廊の先に、西新の生存者が集まっている。ここを消せば、実験は完了する",
        "portraitOwner": "segawa",
        "portraitKind": "major",
        "sourceLine": 2393
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "無線から、いくらちゃん。避難誘導の息が切れている。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 2395
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃんの声",
        "text": "あと三台！　負傷者のバスが、まだ交差点の後ろです！",
        "portraitOwner": null,
        "portraitKind": "offscreen",
        "sourceLine": 2397
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公がセガワを追わず、TAKUYA-Ωと避難バスの間へ立つ。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 2399
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "一人、また一人と仲間が主人公の横へ並ぶ。セガワがその配置を見て、発信器をTAKUYA-Ωへ向ける。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 2401
      },
      {
        "kind": "dialogue",
        "speaker": "セガワ",
        "text": "対象を除去",
        "portraitOwner": "segawa",
        "portraitKind": "major",
        "sourceLine": 2403
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "制御音が強くなる。TAKUYA-Ωの頭部が痙攣し、主人公たちではなく、音源である発信器へ向く。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 2405
      },
      {
        "kind": "dialogue",
        "speaker": "セガワ",
        "text": "前です。対象は前にいる",
        "portraitOwner": "segawa",
        "portraitKind": "major",
        "sourceLine": 2407
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "巨体の腕が振り下ろされ、発信器を地面ごと砕く。制御音が止まる。RED PANTHERが撃つが、人工装甲に弾かれる。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 2409
      },
      {
        "kind": "dialogue",
        "speaker": "セガワ",
        "text": "停止。識別命令ゼロ。T-03、停止しろ",
        "portraitOwner": "segawa",
        "portraitKind": "major",
        "sourceLine": 2411
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "TAKUYA-ΩがRED PANTHERを薙ぎ払い、セガワを片手で持ち上げる。初めて、彼の声から平熱が消える。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 2413
      },
      {
        "kind": "dialogue",
        "speaker": "セガワ",
        "text": "入力を拒むな。僕が分かるだろう。お前を再生したのは――",
        "portraitOwner": "segawa",
        "portraitKind": "major",
        "sourceLine": 2415
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "背面の投薬管が一本、鞭のようにセガワの脇腹を貫く。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 2417
      },
      {
        "kind": "dialogue",
        "speaker": "セガワ",
        "text": "ぐっ……命令音を、脅威として学習したのか",
        "portraitOwner": "segawa",
        "portraitKind": "major",
        "sourceLine": 2419
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "血を吐きながらも、目だけはTAKUYA-Ωの反応を追う。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 2421
      },
      {
        "kind": "dialogue",
        "speaker": "セガワ",
        "text": "適応した。僕の予測より、正確に……制御者を、最初の障害として",
        "portraitOwner": "segawa",
        "portraitKind": "major",
        "sourceLine": 2423
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "巨体の指へ力が入る。セガワの理屈が、呼吸と一緒に崩れる。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 2425
      },
      {
        "kind": "dialogue",
        "speaker": "セガワ",
        "text": "待て。違う。僕は除く側だ。治療する側だ。僕は――",
        "portraitOwner": "segawa",
        "portraitKind": "major",
        "sourceLine": 2427
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "骨の折れる音。セガワの身体が路面へ落とされる。まだわずかに息がある。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 2429
      },
      {
        "kind": "dialogue",
        "speaker": "セガワ",
        "text": "……僕も、病巣か",
        "portraitOwner": "segawa",
        "portraitKind": "major",
        "sourceLine": 2431
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "TAKUYA-Ωの足が路面を踏み抜く。セガワの呼吸が止まる。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 2433
      },
      {
        "kind": "system",
        "speaker": "■ SYSTEM",
        "text": "ネコ殺しのセガワ特級博士：死亡",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 2435
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "パイセンが一歩退く。クマバーソンが肩を掴み、巨体へ向き直させる。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 2437
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "見るのは終わり。次、こっちに来るぞ",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 2439
      },
      {
        "kind": "dialogue",
        "speaker": "ザキミヤ",
        "text": "家族が後ろにおる。逃げたいけど、逃げたらあっちへ行く",
        "portraitOwner": "unit-zakimiya",
        "portraitKind": "major",
        "sourceLine": 2441
      },
      {
        "kind": "dialogue",
        "speaker": "TKY",
        "text": "ほな、前で止めるしかないな",
        "portraitOwner": "unit-tky",
        "portraitKind": "major",
        "sourceLine": 2443
      },
      {
        "kind": "dialogue",
        "speaker": "Mrs.チハ",
        "text": "再生能力がある。動かなくなるまで、攻撃を止めないで",
        "portraitOwner": "unit-mrs-chiha",
        "portraitKind": "major",
        "sourceLine": 2445
      },
      {
        "kind": "dialogue",
        "speaker": "宮本武蔵",
        "text": "大物よ。されど、斬れぬ相手ではない",
        "portraitOwner": "unit-miyamoto-musashi",
        "portraitKind": "major",
        "sourceLine": 2447
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "主人公が前へ出る。誰も返事を待たず、それぞれの位置へ散る。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 2449
      },
      {
        "kind": "boss-marker",
        "speaker": "◆ BOSS",
        "text": "TAKUYA-Ω",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 2451
      },
      {
        "kind": "system",
        "speaker": "■ SYSTEM",
        "text": "T-03／最終強化形態",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 2453
      },
      {
        "kind": "battle-marker",
        "speaker": "◆ BATTLE",
        "text": "TAKUYA-Ωを倒し、避難バスと安全回廊を守れ。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 2455
      }
    ],
    "source": {
      "startLine": 2370,
      "endLine": 2458
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
        "text": "主人公の最後の一撃を受け、TAKUYA-Ωは交差点の中央へ崩れ、動かなくなる。誰もすぐには近づかない。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 2461
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "いくらちゃんが測定器を持って走り寄る。手を伸ばしかけ、主人公に止められる。二人で距離を取り、反応を待つ。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 2463
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "……どうっすか",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 2465
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "いくらちゃんは数値だけでなく、巨体が二度と動かないことを確かめる。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 2467
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "再生反応、ない。今度はちゃんと、終わったよ",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 2469
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "研究員が遠隔モニターを確認し、声を上げる。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 2471
      },
      {
        "kind": "dialogue",
        "speaker": "研究員の声",
        "text": "待って、焼かないで！　背中の投薬管に中和因子が残ってます！",
        "portraitOwner": null,
        "portraitKind": "offscreen",
        "sourceLine": 2473
      },
      {
        "kind": "dialogue",
        "speaker": "Mrs.チハ",
        "text": "地下の隔離区画で使っていた中和因子？",
        "portraitOwner": "unit-mrs-chiha",
        "portraitKind": "major",
        "sourceLine": 2475
      },
      {
        "kind": "dialogue",
        "speaker": "研究員の声",
        "text": "もっと強い。自分の強化組織に食い潰されないよう、TAKUYA-Ωの体内で作られている",
        "portraitOwner": null,
        "portraitKind": "offscreen",
        "sourceLine": 2477
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "人に使える？",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 2479
      },
      {
        "kind": "dialogue",
        "speaker": "研究員の声",
        "text": "分からない。でも血液、骨髄、背中の投薬管を無傷で取れれば、試せる",
        "portraitOwner": null,
        "portraitKind": "offscreen",
        "sourceLine": 2481
      },
      {
        "kind": "dialogue",
        "speaker": "研究員の声",
        "text": "初期感染を止める材料になるかもしれない",
        "portraitOwner": null,
        "portraitKind": "offscreen",
        "sourceLine": 2483
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が試料キットを受け取り、自分で最初の投薬管を固定する。Mrs.チハとババヤガが採取経路を守る。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 2485
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "必要試料を密閉。巨体の全身を再確認し、回収部隊が来ないことを確かめてから、残る組織へ火を入れる。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 2487
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "今度は、置いて帰らないんすね",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 2489
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "助ける分だけ持って帰る。残りは、ここで終わらせる",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 2491
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "炎の向こうで、装甲車両の地図から最後の大型反応が消える。避難バスの最後尾が安全回廊へ入る。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 2493
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "流入路、全部停止。避難も終わりました",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 2495
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "ザキミヤが灯りの戻った西新を見る。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 2497
      },
      {
        "kind": "dialogue",
        "speaker": "ザキミヤ",
        "text": "帰ろう。今度は、みんなで",
        "portraitOwner": "unit-zakimiya",
        "portraitKind": "major",
        "sourceLine": 2499
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が通行止めの標識を外し、西新側へ倒す。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 2501
      }
    ],
    "source": {
      "startLine": 2460,
      "endLine": 2502
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
      "startLine": 2460,
      "endLine": 2502
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
        "text": "採取試料を載せた車両が病院へ先行する。主人公が交差点に残った地図を拾い、顔を上げる。朝霧の中、宮本武蔵が二刀を差したまま歩いている。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 2507
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が追いつき、前へ回る。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 2509
      },
      {
        "kind": "dialogue",
        "speaker": "宮本武蔵",
        "text": "この世の戦は、刀で斬れぬものが多すぎる",
        "portraitOwner": "unit-miyamoto-musashi",
        "portraitKind": "major",
        "sourceLine": 2511
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "主人公が西新の方を見る。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 2513
      },
      {
        "kind": "dialogue",
        "speaker": "宮本武蔵",
        "text": "されど、斬るべき時は分かりやすかった。そなたらが、前へ立ったゆえにな",
        "portraitOwner": "unit-miyamoto-musashi",
        "portraitKind": "major",
        "sourceLine": 2515
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "遠くで、聞き覚えのない鳥の声。宮本武蔵は霧の濃い旧道へ向く。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 2517
      },
      {
        "kind": "dialogue",
        "speaker": "宮本武蔵",
        "text": "我の道も、あちららしい",
        "portraitOwner": "unit-miyamoto-musashi",
        "portraitKind": "major",
        "sourceLine": 2519
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が一歩追う。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 2521
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "トラックが二人の間を横切る。通過後、道に宮本武蔵はいない。足跡も、二刀の音も消えている。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 2523
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "TAKUYA-Ωの血液、骨髄、投薬管。地下隔離区画で救出された研究員と病院の医師が、別々の端末で同じ結果を確認する。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 2529
      },
      {
        "kind": "dialogue",
        "speaker": "医師",
        "text": "中和因子が、人の感染組織にも結合しています",
        "portraitOwner": "minor-human-shared-event-silhouette",
        "portraitKind": "minor",
        "sourceLine": 2531
      },
      {
        "kind": "dialogue",
        "speaker": "研究員",
        "text": "完全変異した組織は戻らない。でも、初期なら増殖を止められる可能性がある",
        "portraitOwner": "minor-human-shared-event-silhouette",
        "portraitKind": "minor",
        "sourceLine": 2533
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "閉鎖改札で救出した女性駅員。抑制薬で進行を遅らせていた腕へ、本人の同意を得て試作血清を投与する。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 2535
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "一時間。六時間。二十四時間。腕の黒い変色は広がらず、感染の再進行もない。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 2537
      },
      {
        "kind": "dialogue",
        "speaker": "女性駅員",
        "text": "止まったんですか",
        "portraitOwner": "minor-human-shared-event-silhouette",
        "portraitKind": "minor",
        "sourceLine": 2539
      },
      {
        "kind": "dialogue",
        "speaker": "医師",
        "text": "今のところは。治ったと言うには早い。でも、時間を買うだけの薬ではなくなった",
        "portraitOwner": "minor-human-shared-event-silhouette",
        "portraitKind": "minor",
        "sourceLine": 2541
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "廊下で待っていたクマバーソンが、目元を手の甲で擦る。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 2543
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "救える人、増えたんやな",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 2545
      },
      {
        "kind": "dialogue",
        "speaker": "医師",
        "text": "初期感染だけです。作れる量も少ない",
        "portraitOwner": "minor-human-shared-event-silhouette",
        "portraitKind": "minor",
        "sourceLine": 2547
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "ゼロやない。それで十分、始められる",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 2549
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "いくらちゃんが複数の周波数へ呼びかける。福岡市外、県外、国内中継。応答は断続的で、ほとんどがノイズ。地図には「状況不明」が広がる。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 2553
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "返事、ないっすね",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 2555
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "返事がないのと、誰もいないのは別です。薬局にいた私も、最初は聞いてるだけだったので",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 2557
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "一つの周波数で、音声か風音か判別できない短い波形。いくらちゃんは印を付けるが、希望だとは言わない。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 2559
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が西新から外へ伸びる未確認道路を地図へ書き込み、装甲車両のキーを隣に置く。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 2561
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "くまやの裏口。二人が別々の武器を同じ机で整備している。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 2565
      },
      {
        "kind": "dialogue",
        "speaker": "ババヤガ",
        "text": "あとで全部聞くって言った",
        "portraitOwner": "unit-babayaga",
        "portraitKind": "major",
        "sourceLine": 2567
      },
      {
        "kind": "dialogue",
        "speaker": "Mrs.チハ",
        "text": "一晩じゃ終わらない",
        "portraitOwner": "unit-mrs-chiha",
        "portraitKind": "major",
        "sourceLine": 2569
      },
      {
        "kind": "dialogue",
        "speaker": "ババヤガ",
        "text": "なら、毎晩聞く",
        "portraitOwner": "unit-babayaga",
        "portraitKind": "major",
        "sourceLine": 2571
      },
      {
        "kind": "dialogue",
        "speaker": "Mrs.チハ",
        "text": "許したわけじゃないでしょ",
        "portraitOwner": "unit-mrs-chiha",
        "portraitKind": "major",
        "sourceLine": 2573
      },
      {
        "kind": "dialogue",
        "speaker": "ババヤガ",
        "text": "うん。そっちも俺を許さんでいい",
        "portraitOwner": "unit-babayaga",
        "portraitKind": "major",
        "sourceLine": 2575
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "Mrs.チハが彼のライフルを受け取り、曲がった照準を直す。ババヤガは彼女のグレネード弾を一本ずつ点検する。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 2577
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "台詞は使わず、既存背景と短い環境音で構成する。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 2581
      }
    ],
    "source": {
      "startLine": 2504,
      "endLine": 2594
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
        "kind": "action",
        "speaker": null,
        "text": "台詞は使わず、既存背景と短い環境音で構成する。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 2581
      }
    ],
    "source": {
      "startLine": 2580,
      "endLine": 2594
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
        "text": "西新奪還から三十日後。夜。窓の補強板はまだ半分残り、入口横には非常無線と武器置き場。それでも店内は、客の声と皿の音でうるさい。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 2597
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "主人公が暖簾をくぐる。いくらちゃんがカウンター下の無線へ「触るな」と書いた札を貼り、自分で周波数つまみに触っている。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 2599
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "貼った本人が触るな",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 2601
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "これは調整です。触るとは、雑にこう……あっ",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 2603
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "無線から大きなハウリング。店中が振り返る。いくらちゃんが何事もなかった顔で音量を下げる。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 2605
      },
      {
        "kind": "dialogue",
        "speaker": "いくらちゃん",
        "text": "正常です。遠くから何か来たら、これより上品に鳴ります",
        "portraitOwner": "guide-ikura",
        "portraitKind": "major",
        "sourceLine": 2607
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "信用できない機械がまた増えた",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 2609
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "主人公がいつもの席へ向かう。パイセンの前には皿が四枚。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 2611
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "**{{PLAYER_NAME}}**さん、ここ空いてるっす",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 2613
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "そこ俺の荷物置いとったやろ",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 2615
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "安全な場所へ移しました",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 2617
      },
      {
        "kind": "dialogue",
        "speaker": "TKY",
        "text": "厨房の入口は安全ちゃうぞ",
        "portraitOwner": "unit-tky",
        "portraitKind": "major",
        "sourceLine": 2619
      },
      {
        "kind": "player-action",
        "speaker": "▶ PLAYER",
        "text": "主人公が荷物を元へ戻し、席へ座る。",
        "portraitOwner": null,
        "portraitKind": "system",
        "sourceLine": 2621
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "小さな戦術ハーネスを着けたマヨちゃんがテーブルの下から出てきて、主人公の足元を一周する。そのまま椅子の横へ伏せる。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 2623
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "お前ら食いすぎ。仕入れ、まだ戻っとらんとぞ",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 2625
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "俺、そんな食ってないっすよ",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 2627
      },
      {
        "kind": "dialogue",
        "speaker": "Mrs.チハ",
        "text": "唐揚げ三、餃子四、焼き飯半分。TKYの餃子も一個",
        "portraitOwner": "unit-mrs-chiha",
        "portraitKind": "major",
        "sourceLine": 2629
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "数えてたんすか",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 2631
      },
      {
        "kind": "dialogue",
        "speaker": "TKY",
        "text": "最後の一個は余りちゃうねん",
        "portraitOwner": "unit-tky",
        "portraitKind": "major",
        "sourceLine": 2633
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "ザキミヤが妻子のいる端の席から、声を潜めて手を振る。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 2635
      },
      {
        "kind": "dialogue",
        "speaker": "ザキミヤ",
        "text": "おーい、少し静かに。今やっと寝た",
        "portraitOwner": "unit-zakimiya",
        "portraitKind": "major",
        "sourceLine": 2637
      },
      {
        "kind": "dialogue",
        "speaker": "ザキミヤの妻",
        "text": "一番声が大きい",
        "portraitOwner": "minor-human-shared-event-silhouette",
        "portraitKind": "minor",
        "sourceLine": 2639
      },
      {
        "kind": "dialogue",
        "speaker": "ザキミヤ",
        "text": "……はい",
        "portraitOwner": "unit-zakimiya",
        "portraitKind": "major",
        "sourceLine": 2641
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "引き戸が開き、ババヤガが牛乳パックを一本持って入る。Mrs.チハが見る。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 2643
      },
      {
        "kind": "dialogue",
        "speaker": "ババヤガ",
        "text": "今度は忘れんかった",
        "portraitOwner": "unit-babayaga",
        "portraitKind": "major",
        "sourceLine": 2645
      },
      {
        "kind": "dialogue",
        "speaker": "Mrs.チハ",
        "text": "ひと月以上遅い。冷蔵庫へ入れて",
        "portraitOwner": "unit-mrs-chiha",
        "portraitKind": "major",
        "sourceLine": 2647
      },
      {
        "kind": "dialogue",
        "speaker": "ババヤガ",
        "text": "利息は",
        "portraitOwner": "unit-babayaga",
        "portraitKind": "major",
        "sourceLine": 2649
      },
      {
        "kind": "dialogue",
        "speaker": "Mrs.チハ",
        "text": "話を全部してから決める",
        "portraitOwner": "unit-mrs-chiha",
        "portraitKind": "major",
        "sourceLine": 2651
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "ババヤガが素直に厨房へ入る。クマバーソンが主人公へ顔を向ける。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 2653
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "**{{PLAYER_NAME}}**、何食う？",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 2655
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "壁のメニュー。まだ消えている品がいくつもある。主人公が唐揚げを指す。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 2657
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "唐揚げな。今揚がる",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 2659
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "俺も追加で",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 2661
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "お前はもういい！",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 2663
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "主人公の前に烏龍茶が置かれる。パイセンが、発生前と同じ調子で口を開く。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 2665
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "あ、今日……帰り、お願いしていいっすか",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 2667
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "主人公がパイセンを見る。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 2669
      },
      {
        "kind": "dialogue",
        "speaker": "パイセン",
        "text": "いや、まだ帰らないっすよ。先に押さえただけです",
        "portraitOwner": "unit-paisen",
        "portraitKind": "major",
        "sourceLine": 2671
      },
      {
        "kind": "dialogue",
        "speaker": "クマバーソン",
        "text": "三十日経っても、そこだけ変わらんな",
        "portraitOwner": "unit-kumaverson",
        "portraitKind": "major",
        "sourceLine": 2673
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "新しい客が暖簾をくぐる。いくらちゃんの無線は静かなまま。厨房で油が鳴り、店内へ笑い声が戻る。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 2675
      },
      {
        "kind": "action",
        "speaker": null,
        "text": "店の外。修理された装甲車両と、西新の外へ伸びる地図。今夜は、どちらも動かない。",
        "portraitOwner": null,
        "portraitKind": "stage-direction",
        "sourceLine": 2677
      }
    ],
    "source": {
      "startLine": 2596,
      "endLine": 2681
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
