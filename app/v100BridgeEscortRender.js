import { drawV100Muzzle } from "./v100CombatVfx.js";
import { BRIDGE_GATE_SECONDS, BRIDGE_GATE_X, BRIDGE_HOLD_PROGRESS, BRIDGE_SHOT_FLASH, V100_BRIDGE_ART } from "./v100BridgeEscort.js";

function bridgeVehicleX(runtime) {
  const bridge = runtime.bridge;
  const approach = Math.min(1, Math.max(0, (runtime.progress - .22) / (BRIDGE_HOLD_PROGRESS - .22)));
  const elapsed = bridge.gateElapsed;
  const lunge = elapsed === null ? 0 : Math.min(1, elapsed / 1.45);
  const retreat = elapsed === null ? 0 : Math.min(1, Math.max(0, (elapsed - 1.45) / 3.9));
  const recoil = bridge.shotFlash / BRIDGE_SHOT_FLASH * 5;
  return 894 - approach * 74 - lunge * 59 + retreat * 142 + recoil;
}

export function drawArmoredVehicle(ctx, image, x, y) {
  ctx.drawImage(image, 64, 10, 1410, 527, x - 97, y - 77, 194, 78);
}

export function drawBridgeEscort(ctx, stageObjects, runtime, cartX, cartY, armorY) {
  const image = stageObjects[V100_BRIDGE_ART.id];
  if (!image?.complete || !image.naturalWidth) throw new Error("Coastal bridge props must be decoded before battle");
  const bridge = runtime.bridge;
  const armorX = bridgeVehicleX(runtime);
  const elapsed = bridge.gateElapsed;
  const lift = elapsed === null ? 0 : Math.min(1, elapsed / .48, (BRIDGE_GATE_SECONDS - elapsed) / .44);

  ctx.save();
  drawArmoredVehicle(ctx, image, armorX, armorY);
  if (bridge.shotFlash > 0) {
    drawV100Muzzle(ctx, stageObjects, { weapon: "crawler", elapsed: BRIDGE_SHOT_FLASH - bridge.shotFlash,
      x: armorX - 35, y: armorY - 70, tx: cartX, ty: cartY - 34 });
  }
  const gateY = cartY - 12;
  ctx.drawImage(image, 60, 551, 310, 464, BRIDGE_GATE_X - 42, gateY - 70, 47, 70);
  ctx.translate(BRIDGE_GATE_X, gateY - 50);
  ctx.rotate(-1.54 * lift);
  ctx.drawImage(image, 476, 739, 1006, 93, -4, -4.5, 90, 9);
  ctx.restore();
}
