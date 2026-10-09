// Observe real canvas drawing; never suppress or replace the game's output.
export function observePlayerAbilityText() {
  const forbidden = /気合連打|疾駆迎撃|精密排除|地砕衝|制圧掃射|火酒投擲|光刃解放|全弾制圧|二天一流・無空|凶暴マヨ|索敵マーク|対・毒吐き|対装甲破砕|フィニッシュ|直線制圧|密集切断|打撃・足止め|特殊個体分析|狂王暴走|鉄壁展開|仁王立ち|連打×|迎撃\s*-|精密\s*-|緊急処置|地砕\s*-|弱点査定|制圧\s*(?:-|\d+\/)|捕縛罠|火酒\s*-|光刃\s*-|榴弾\s*-|無空\s*-|受け流し|踏みとどまる|装甲破砕|^救護$|^足止め$/;
  const proof = { forbidden: [], numericDraws: 0, observedDraws: 0, observedBanners: 0 };
  globalThis.__PLAYER_ABILITY_TEXT_PROOF__ = proof;
  const recordForbidden = value => {
    if (forbidden.test(value) && proof.forbidden.length < 64) proof.forbidden.push(value);
  };
  // Banner text is DOM-rendered and can disappear before the battle ends.
  // Retain each actual message as it changes instead of checking only the end.
  if (globalThis.document && globalThis.MutationObserver) {
    const lastMessages = new WeakMap();
    const inspectBanners = () => {
      for (const banner of document.querySelectorAll('.battle-banner')) {
        const value = banner.textContent ?? '';
        if (lastMessages.get(banner) === value) continue;
        lastMessages.set(banner, value);
        proof.observedBanners += 1;
        recordForbidden(value);
      }
    };
    new MutationObserver(inspectBanners).observe(document, { subtree: true, childList: true, characterData: true });
    inspectBanners();
  }
  const draw = CanvasRenderingContext2D.prototype.fillText;
  CanvasRenderingContext2D.prototype.fillText = function (text, ...args) {
    if (this.canvas?.isConnected) {
      const value = String(text);
      proof.observedDraws += 1;
      if (/^[+-]?\d+(?:\.\d+)?$/.test(value)) proof.numericDraws += 1;
      recordForbidden(value);
    }
    return draw.call(this, text, ...args);
  };
}
