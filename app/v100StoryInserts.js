// Diegetic close-ups supplement the R9 prose. Each state only exposes facts
// already established at its source line; animation never advances the story.
export const V100_R9_INSERTS = Object.freeze({
 'message-backlog':{type:'phone',label:'届かなかったメッセージ',detail:'発生二日目 → 現在',alt:'古い通知が携帯に届く。チハのメッセージは現在の居場所を示すものではない。'},
 'patient-ledger':{type:'ledger',label:'病院の搬送台帳',detail:'十二人の搬送記録 / B3-L',alt:'十二人の患者の搬送先を示す台帳と、B3-Lの記録。'},
 'family-ledger':{type:'ledger',label:'搬送記録の照合',detail:'試験棟C / C4',alt:'病院の名簿と搬送票を重ねて家族の搬送先を確かめる。'},
 'power-diversion':{type:'network',label:'非常電源の供給先',detail:'研究区画優先',alt:'病棟への供給を止め、地下研究区画へ電気を送る配線。三つの非常電源盤で病棟への供給を戻す。'},
 'seg-lab-transfer':{type:'transfer',label:'外部転送履歴',detail:'転送先：SEG-LAB',alt:'救助の映像が本人の操作なしでSEG-LABへ送られている。'},
 'seg-lab-disconnected':{type:'transfer',label:'接続を切断',detail:'送信済みの映像は残る',alt:'ケーブルを抜いて転送を止めても、既に送られた映像は消えない。'},
 'oxygen-valve':{type:'valve',label:'待機室への酸素供給',detail:'入口を開けると培養槽も開く',alt:'入口とは別の供給弁から待機室へ空気を送る。培養槽との隔壁は分かれている。'},
 'train-couplers':{type:'couplers',label:'救助列車の連結器',detail:'赤いレバーを三つ引く',alt:'三か所の連結器の赤い解除レバー。隣のブレーキ管は切らずに残す。'},
 'rescue-panels':{type:'panels',label:'救助用制御盤',detail:'三か所を復旧',alt:'離れた三か所の救助用制御盤を復旧して、避難する人々の救助路を開く。'},
 'tunnel-gates':{type:'panels',label:'地下の隔壁',detail:'三か所を閉鎖',alt:'三つの地下隔壁を閉じて、湾岸への感染群を止める。'},
 'bridge-routes':{type:'bridge',label:'橋の退路',detail:'搬送車は保守車線 / 本隊は一般車線',alt:'資料を積んだ搬送車と本隊の装甲車両は別々の車線を通り、対岸で合流する。'},
 'bridge-crossing':{type:'bridge',label:'保守車線の遮断機',detail:'開放は七秒だけ',alt:'本隊が一般車線で敵車両を押しのける間に、パイセンの搬送車が七秒の開放中に保守車線を渡る。'},
 'domestic-network':{type:'network',label:'国内の散布装置',detail:'一斉起動待ち',alt:'国内各地の散布装置が起動を待っている。画面を割っても止まらず、物理停止レバーに届く必要がある。'},
 'domestic-stopped':{type:'network',label:'国内の散布装置',detail:'物理停止 / 防潮門の遠隔線も切断',alt:'国内の散布装置を停止し、本社から防潮門を遠隔開放する接続も外す。現地操作は残る。'},
 'overseas-network':{type:'network',label:'国外の起動回線',detail:'国外回線 → 感染源原株',alt:'国外の起動回線が赤く変わる。回線を止めてから感染源原株を処分する。'},
 'overseas-stopped':{type:'network',label:'国外の起動回線',detail:'回線停止 / 原株を高熱槽へ',alt:'国外への起動線が消え、感染源原株の容器が高熱槽へ下がる。'},
 'takuya-identity':{type:'identity',label:'TAKUYA-Ω',detail:'あの日のタクヤ',alt:'防護眼鏡、淡い髪、頬の傷は最初のタクヤと同じ。回収後の投薬管と巨大化した片腕が加わっている。'},
 'medical-observation':{type:'medical',label:'中和因子の経過観察',detail:'初期感染者への少量投与',alt:'同意を得た初期感染者へ少量投与し、時間ごとの腕の変色を比べる。完治の確認ではない。'},
});

export function v100StoryInsertFor(id, sourceLine = 0) {
 const base=V100_R9_INSERTS[id];
 if(!base) return null;
 return {...base,id,
  disconnected:id==='seg-lab-disconnected',stopped:id.endsWith('-stopped'),
  crossing:id==='bridge-crossing',
  dated:id==='message-backlog'&&sourceLine>=610,
  messageVisible:id==='message-backlog'&&sourceLine>=604,
  observed:id==='medical-observation'&&sourceLine>=2353,
  familyConfirmed:id==='family-ledger'&&(sourceLine>=1788||sourceLine>=1527&&sourceLine<=1533),
 };
}
