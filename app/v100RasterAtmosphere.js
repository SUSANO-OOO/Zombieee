// Stable texture variation; drawing never consumes simulation randomness.
export function combatVariation(seed, channel = 0) {
  const value = Math.sin((seed + 1) * 12.9898 + (channel + 1) * 78.233) * 43758.5453;
  return value - Math.floor(value);
}
export function drawRasterPlume(ctx, image, {x,y,width,height,alpha,rotation=0,flip=false}) {
  if (!image?.complete || !image.naturalWidth || !image.naturalHeight
    || ![x,y,width,height,alpha,rotation].every(Number.isFinite) || width<=0 || height<=0 || alpha<=0) return false;
  ctx.save();
  ctx.globalCompositeOperation='source-over';
  ctx.shadowBlur=0;
  ctx.globalAlpha=Math.min(1,alpha);
  ctx.translate(x,y);
  if(rotation)ctx.rotate(rotation);
  if(flip)ctx.scale(-1,1);
  ctx.drawImage(image,-width/2,-height*.72,width,height);
  ctx.restore();
  return true;
}
