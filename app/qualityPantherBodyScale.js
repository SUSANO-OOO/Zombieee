// Head-to-sole alpha measurements at the authored idle pose. See the matching
// paint measurement test; weapons do not participate in the body reference.
const bodyReferences={
  'red-panther-knife':{height:419.300037},
  'red-panther-shield':{height:418.339873},
};

export function withQualityPantherBodyScale(kind,atlas) {
  const body=bodyReferences[kind];
  if(!body)return atlas;
  const source=atlas.referenceFrame;
  // Both original idle sprites have a 468 px body and a floor at y=496.
  // Retain the canonical horizontal root, anatomy, poses and socket locations.
  const scale=body.height/468;
  const rootX=source.tx+source.scale*source.width/2;
  const groundY=source.ty+source.scale*496;
  return {...atlas,referenceFrame:{...source,scale,
    tx:rootX-scale*source.width/2,ty:groundY-scale*496}};
}
