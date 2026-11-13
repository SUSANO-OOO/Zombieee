// Status overlays may move around UI; their owners and combat positions never do.
export function layoutV100AllyHealthBars(rows,{bounds,obstacles=[],gap=4}) {
  const placed=[];
  for(const row of rows){
    const maxY=Math.max(bounds.top+gap,Math.min(bounds.bottom-row.height-gap,
      Number.isFinite(row.maxY)?row.maxY:Infinity));
    const x=row.x,preferredY=Math.max(bounds.top+gap,Math.min(maxY,row.y));
    const occupied=[...obstacles,...placed.map(p=>({x:p.x-p.width/2,y:p.y,width:p.width,height:p.height}))];
    const candidates=[preferredY,bounds.top+gap,bounds.bottom-row.height-gap,
      ...occupied.flatMap(r=>[r.y-row.height-gap,r.y+r.height+gap])];
    const choices=[...new Set(candidates)].filter(y=>y>=bounds.top+gap&&y<=maxY&&y+row.height<=bounds.bottom-gap
      &&!occupied.some(r=>x+row.width/2>r.x-gap&&x-row.width/2<r.x+r.width+gap&&y+row.height>r.y-gap&&y<r.y+r.height+gap))
      .sort((a,b)=>Math.abs(a-preferredY)-Math.abs(b-preferredY)||a-b);
    placed.push({...row,x,y:choices[0]??preferredY});
  }
  return placed;
}
