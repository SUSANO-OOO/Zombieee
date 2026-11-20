export const V100_RAIL_EVACUATION_STAGE = "stage-evacuation-freight-yard";
export const V100_RAIL_EVACUATION = Object.freeze({
  railEvacuation: true,
  powerCount: 3,
  powerLabel: "連結器",
  powerVerb: "解除",
  powerHoldSeconds: 2.4,
  powerXs: Object.freeze([320, 470, 642]),
  powerYs: Object.freeze([282, 212, 282]),
  powerReadyAtSeconds: Object.freeze([0, 0, 0]),
  powerRadiusX: 68,
  powerRadiusY: 34,
  evacuationSeconds: 4.2,
});
export const V100_RAIL_EVACUATION_ART = Object.freeze({
  id: "v100-rail-evacuation",
  path: "/art/v100/mission-objects/s14-rail-evacuation-atlas-r1.webp",
});

// The backing plate and red handle are separate pieces of the same raster
// atlas. The painted hinge stays aligned as the handle rotates.
const train = [4, 4, 672, 153];
const housing = [4, 161, 172, 107];
const handle = [184, 161, 224, 123];

export function hasRailEvacuation(missionType, config) {
  return missionType === "boss-assault" && config?.railEvacuation === true;
}

export function railEvacuationReadout(runtime) {
  const released = runtime.powerActivated ?? 0;
  if (runtime.completed) {
    return { phase: "safe", phaseLabel: "退避完了", label: "民間車両", status: "退避済み", progress: 1 };
  }
  if (released >= V100_RAIL_EVACUATION.powerCount) {
    return { phase: "departing", phaseLabel: "退避中", label: "民間車両", status: "退避中",
      progress: runtime.evacuationProgress ?? 0 };
  }
  return { phase: "releasing", phaseLabel: "連結器", label: "連結器",
    status: `${released}/${V100_RAIL_EVACUATION.powerCount} 解除`, progress: released / V100_RAIL_EVACUATION.powerCount };
}

export function drawV100RailEvacuation(context, runtime, stageObjects, contentY, railY) {
  const image = stageObjects[V100_RAIL_EVACUATION_ART.id];
  if (!image?.complete || !image.naturalWidth) throw new Error("Freight-yard evacuation art must be decoded before battle starts");
  context.save();
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";

  const departure = runtime.evacuationProgress ?? 0;
  if (departure < 1) {
    const carWidth = 346;
    const carHeight = carWidth * train[3] / train[2];
    // The passenger car clears the full left edge on the far track.
    const carX = 620 - 808 * departure * departure * (2 - departure);
    context.drawImage(image, ...train, carX - carWidth / 2, railY - carHeight, carWidth, carHeight);
  }

  const released = runtime.powerActivated ?? 0;
  for (const [index, x] of V100_RAIL_EVACUATION.powerXs.entries()) {
    const y = contentY(V100_RAIL_EVACUATION.powerYs[index]);
    const next = index === released;
    const done = index < released;
    const progress = done ? 1 : next ? Math.min(1, (runtime.powerHold ?? 0) / V100_RAIL_EVACUATION.powerHoldSeconds) : 0;
    const easing = progress * progress * (3 - 2 * progress);
    const baseWidth = 44;
    const baseHeight = baseWidth * housing[3] / housing[2];
    const handleWidth = 57;
    const handleHeight = handleWidth * handle[3] / handle[2];
    context.drawImage(image, ...housing, x - baseWidth / 2, y - baseHeight, baseWidth, baseHeight);
    context.save();
    context.translate(x + baseWidth * .152, y - baseHeight * .625);
    context.rotate(-.52 + 1.22 * easing);
    context.drawImage(image, ...handle, -handleWidth * .106, -handleHeight * .827, handleWidth, handleHeight);
    context.restore();

    const label = done ? `${index + 1} 解除済` : `レバー${index + 1}`;
    context.font = "bold 15px sans-serif";
    context.textAlign = "center";
    context.lineWidth = 3.5;
    context.lineJoin = "round";
    context.strokeStyle = "#17100b";
    context.fillStyle = done ? "#bfe0ae" : next ? "#ffe5ab" : "#cbc2b6";
    context.strokeText(label, x, y + 15);
    context.fillText(label, x, y + 15);
  }
  context.restore();
}
