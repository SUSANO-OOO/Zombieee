// Observe real canvas drawing; never suppress or replace the game's output.
export function observePlayerAbilityText() {
  const forbidden = /索敵マーク|対・毒吐き|対装甲破砕|フィニッシュ|直線制圧|密集切断|打撃・足止め|特殊個体分析|狂王暴走|鉄壁展開|仁王立ち|連打×|迎撃\s*-|精密\s*-|緊急処置|地砕\s*-|弱点査定|制圧\s*(?:-|\d+\/)|捕縛罠|火酒\s*-|光刃\s*-|榴弾\s*-|無空\s*-|受け流し|踏みとどまる|装甲破砕|^救護$|^足止め$/;
  const proof = { forbidden: [], numericDraws: 0, observedDraws: 0 };
  globalThis.__PLAYER_ABILITY_TEXT_PROOF__ = proof;
  const draw = CanvasRenderingContext2D.prototype.fillText;
  CanvasRenderingContext2D.prototype.fillText = function (text, ...args) {
    if (this.canvas?.isConnected) {
      const value = String(text);
      proof.observedDraws += 1;
      if (/^[+-]?\d+(?:\.\d+)?$/.test(value)) proof.numericDraws += 1;
      if (forbidden.test(value) && proof.forbidden.length < 64) proof.forbidden.push(value);
    }
    return draw.call(this, text, ...args);
  };
}
