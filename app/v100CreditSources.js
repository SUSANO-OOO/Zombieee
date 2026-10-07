// Public credits match the adopted material ledger; no private identity sources are distributed.
export const V100_SOUND_CREDITS = Object.freeze([
  { role: "男性の笑い声", author: "adiantheman", works: ["Evil Laugh"], page: "https://freesound.org/people/adiantheman/sounds/829881/", license: "CC0" },
  { role: "波音", author: "transitking", works: ["Water Waves"], page: "https://opengameart.org/content/water-waves", license: "CC0" },
  {
    "role": "ボス戦音楽",
    "author": "nene",
    "works": [
      "Boss Battle #8 Metal"
    ],
    "page": "https://opengameart.org/content/boss-battle-8-metal",
    "license": "CC0"
  },
  {
    "role": "戦闘音・怪物の声",
    "author": "artisticdude",
    "works": [
      "RPG Sound Pack"
    ],
    "page": "https://opengameart.org/content/rpg-sound-pack",
    "license": "CC0"
  },
  {
    "role": "男性戦闘ボイス・感染者の声",
    "author": "HaelDB",
    "works": [
      "Male Grunt/Yelling sounds"
    ],
    "page": "https://opengameart.org/content/male-gruntyelling-sounds",
    "license": "CC0"
  },
  {
    "role": "女性戦闘ボイス",
    "author": "cicifyre",
    "works": [
      "Female RPG Voice Starter Pack"
    ],
    "page": "https://opengameart.org/content/female-rpg-voice-starter-pack",
    "license": "CC0"
  },
  {
    "role": "女性の戦闘不能ボイス",
    "author": "Galacti-Chron / 声：Sky Rae",
    "works": [
      "Dying Voices - Female - RPG"
    ],
    "page": "https://opengameart.org/content/dying-voices-female-rpg",
    "license": "CC0"
  },
  {
    "role": "怪物の声",
    "author": "Ogrebane",
    "works": [
      "Monster Sound Effects Pack"
    ],
    "page": "https://opengameart.org/content/monster-sound-effects-pack",
    "license": "CC0"
  },
  {
    "role": "炎・焼却音",
    "author": "AntumDeluge",
    "works": [
      "Fire Crackling"
    ],
    "page": "https://opengameart.org/content/fire-crackling",
    "license": "CC0"
  },
  {
    "role": "銃声",
    "author": "Vincent Sevedge (Tabasco)",
    "works": [
      "Gunshot Sounds"
    ],
    "page": "https://opengameart.org/content/gunshot-sounds",
    "license": "CC BY 3.0"
  },
  {
    "role": "操作音・物音・土煙",
    "author": "Kenney",
    "works": [
      "Interface Sounds",
      "Sci-fi Sounds",
      "Impact Sounds",
      "RPG Audio",
      "Smoke Particles"
    ],
    "page": "https://kenney.nl/assets",
    "license": "CC0"
  },
  {
    "role": "爆発音",
    "author": "Joth",
    "works": [
      "Chunky Explosion"
    ],
    "page": "https://opengameart.org/content/chunky-explosion",
    "license": "CC0"
  },
  {
    "role": "怪物の声・爆発画像",
    "author": "rubberduck",
    "works": [
      "80 CC0 creature SFX",
      "25 special effects rendered with Blender"
    ],
    "page": "https://opengameart.org/users/rubberduck",
    "license": "CC0"
  }
].map(credit => Object.freeze({ ...credit, works: Object.freeze(credit.works) })));
export const V100_BUNDLED_LEGACY_CREDITS = Object.freeze([
  {
    "author": "SRG774",
    "work": "Dark Sci-Fi Audio Pack",
    "page": "https://opengameart.org/content/dark-sci-fi-audio-pack"
  },
  {
    "author": "Emma_MA",
    "work": "Sad game over",
    "page": "https://opengameart.org/content/sad-game-over"
  },
  {
    "author": "Delta12 Studio",
    "work": "Rpg Sound Effect Pack",
    "page": "https://opengameart.org/content/rpg-sound-effect-pack"
  },
  {
    "author": "xhunterko",
    "work": "Static",
    "page": "https://opengameart.org/content/static"
  }
].map(Object.freeze));
export const V100_STORY_CAST_CREDITS = Object.freeze([
  {
    "title": "通信",
    "lines": [
      "いくらちゃん"
    ]
  },
  {
    "title": "西新で出会った人々",
    "lines": [
      "安藤",
      "くまやへ逃げ込んだ男",
      "西新駅の女性駅員",
      "地下ホームの保守員",
      "大学病院の医師",
      "大学病院の看護師たち",
      "地下研究区画の研究員たち",
      "ザキミヤの妻",
      "ザキミヤの娘"
    ]
  },
  {
    "title": "救援と復旧を支えた人々",
    "lines": [
      "早良区役所の避難所職員",
      "救援車の運転手",
      "薬局の避難者たち",
      "湾岸・本社からの避難者たち",
      "医療設備を復旧する技術者たち"
    ]
  },
  {
    "title": "立ちはだかった者たち",
    "lines": [
      "タクヤ — TAKUYA / TAKUYA-Ω",
      "改札喰い",
      "MOTHER",
      "オオグチ",
      "クロメ",
      "ガイレン",
      "フタゴ",
      "ムガリアン社長（変異体）",
      "RED PANTHER隊長",
      "セガワ特級博士"
    ]
  }
].map(credit => Object.freeze({ ...credit, lines: Object.freeze(credit.lines) })));
