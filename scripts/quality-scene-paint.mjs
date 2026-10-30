import assert from 'node:assert/strict';

// A decoded <img> and visible CSS do not prove that a screenshot contains it.
// This only rejects an unpainted flat backdrop; it does not judge the art.
export function inspectScenePaintContrast(rgb,width,height){
 assert.ok(Number.isSafeInteger(width)&&width>1&&Number.isSafeInteger(height)&&height>0);
 assert.equal(rgb.length,width*height*3);
 let visibleEdges=0,comparisons=0;
 for(let y=0;y<height;y++)for(let x=1;x<width;x++){
  const i=(y*width+x)*3;
  const difference=Math.max(...[0,1,2].map(c=>Math.abs(rgb[i+c]-rgb[i-3+c])));
  if(difference>=8)visibleEdges++;
  comparisons++;
 }
 const edgeRatio=visibleEdges/comparisons;
 return {painted:edgeRatio>=0.01,edgeRatio,visibleEdges,comparisons};
}
