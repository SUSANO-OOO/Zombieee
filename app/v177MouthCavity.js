const mix=(a,b,t)=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];

// The dark throat recedes behind the mandible tips. Joining the two outer
// tips directly would draw a solid vertical wall across the open mouth.
export function v177RecessedMouthContour(upper,lower) {
  const back=upper[0],bottom=lower.at(-1),front=upper.at(-1),jaw=lower[0];
  const topTip=mix(back,front,.92),bottomTip=mix(bottom,jaw,.92);
  const throat=mix(back,bottom,.5),lip=mix(topTip,bottomTip,.5),control=mix(lip,throat,.58);
  const points=[back,topTip];
  for(let i=1;i<=16;i++){
    const t=i/16,s=1-t;
    points.push([s*s*topTip[0]+2*s*t*control[0]+t*t*bottomTip[0],
      s*s*topTip[1]+2*s*t*control[1]+t*t*bottomTip[1]]);
  }
  points.push(bottom);
  return {points,throat,lip};
}
