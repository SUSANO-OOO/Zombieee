const shots={
  's01-nao-rescue':{rect:[610,365,570,310],side:'left',alt:'ナオの手と、毛布で覆われた老人の顔。'},
  's09-transfer-disconnect':{rect:[850,400,400,220],side:'right',alt:'いくらが指す接続口と、抜いた赤いケーブルの端子。'},
  's14-train-couplers':{rect:[340,340,930,350],side:'right',alt:'両手で握る赤い連結解除レバー。隣の青いブレーキ管は残っている。'},
  's23-chiha-evidence-send':{rect:[350,400,510,230],side:'left',alt:'三つの受信灯と、煙を上げる認証カード。'},
  'ending-chiha-baba-distance':{rect:[200,375,660,240],side:'left',alt:'チハが伸ばす手と、少し引かれたババヤガの手の間。'},
  'ending-plates-and-karaage':{rect:[700,535,420,185],side:'left',alt:'食卓の下で横になり、寝返りを打つマヨ。'},
};
export const V177_STORY_DETAIL_SHOTS=Object.freeze(Object.fromEntries(Object.entries(shots).map(([id,shot])=>[id,Object.freeze({...shot,id,rect:Object.freeze(shot.rect)})])));

export function v177StoryDetailShotFor(src){
  if(typeof src!=='string')return null;
  const pathname=src.split(/[?#]/u)[0];
  return Object.values(V177_STORY_DETAIL_SHOTS).find(shot=>pathname.endsWith(`/art/v100/story-r9/cuts/${shot.id}.webp`))??null;
}
