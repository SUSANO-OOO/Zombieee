// Fixed-length legs use the approved walk-a pixels; face, weapon and clothing stay authored.
const rigs = {
  kumaverson: { path: '/art/v060/characters/kumaverson-battle-v1.png', hip:[250,285],knee:[259,331],ankle:[258,404],target:[245,291],reach:29,lift:17,
    thigh:[[238,271],[266,278],[278,302],[282,333],[259,351],[233,335],[234,309]],
    calf:[[244,323],[278,324],[281,356],[270,398],[270,415],[244,420],[231,400],[238,367]],
    foot:[[244,399],[271,398],[277,403],[298,395],[307,408],[288,423],[245,432],[235,418]],
    body:[[0,0],[480,0],[480,281],[264,281],[244,281],[0,281]],
    detail:[[[157,231],[186,239],[218,250],[239,270],[244,295],[231,311],[199,315],[178,301],[167,274]]] },
  babayaga: { path:'/art/v060/characters/babayaga-battle-v1.png',hip:[235,247],knee:[264,327],ankle:[294,404],target:[236,244],reach:34,lift:16,
    thigh:[[213,238],[245,236],[255,271],[278,316],[270,338],[244,339],[228,293],[216,267]],
    calf:[[244,317],[274,317],[282,353],[305,396],[300,417],[274,416],[257,370]],
    foot:[[279,397],[298,393],[311,399],[330,395],[338,408],[316,424],[289,430],[277,415]],
    body:[[0,0],[480,0],[480,282],[268,282],[256,251],[0,251]],
    detail:[[[158,244],[176,244],[185,277],[174,310],[163,336],[152,331],[163,294],[164,272]]] },
  zakimiya: { path:'/art/v090/characters/zakimiya-battle-r1.png',hip:[235,236],knee:[261,313],ankle:[279,402],target:[236,236],reach:34,lift:17,
    thigh:[[214,225],[249,225],[263,265],[279,309],[273,333],[240,332],[231,286],[218,257]],
    calf:[[245,312],[275,310],[283,349],[298,400],[285,419],[266,416],[253,368]],
    foot:[[276,390],[294,389],[306,407],[326,407],[332,418],[303,432],[280,433],[269,419]],
    body:[[0,0],[480,0],[480,250],[266,250],[250,239],[0,239]],
    detail:[[[167,190],[198,191],[216,235],[223,269],[207,275],[185,250],[172,225]]] },
  tky: { path:'/art/v090/characters/tky-battle-r1.png',hip:[211,309],knee:[185,353],ankle:[160,397],target:[232,302],reach:27,lift:15,
    thigh:[[192,303],[220,302],[222,321],[203,355],[185,373],[162,361],[173,336]],
    calf:[[174,348],[197,362],[179,393],[176,409],[156,413],[145,400],[153,378]],
    foot:[[145,389],[169,390],[170,408],[193,415],[194,429],[166,434],[145,421],[137,410]],
    body:[[0,0],[480,0],[480,260],[260,260],[246,285],[227,297],[211,321],[195,338],[173,347],[156,351],[163,328],[125,340],[148,309],[169,270],[0,270]],
    detail:[[[157,207],[182,223],[202,253],[192,271],[171,244],[154,222]],[[185,250],[197,249],[315,394],[305,403],[190,260]]] },
  'mrs-chiha': { path:'/art/v090/characters/mrs-chiha-battle-r1.png',hip:[202,320],knee:[176,359],ankle:[160,402],target:[229,316],reach:23,lift:13,
    thigh:[[185,310],[217,311],[211,339],[195,366],[169,373],[158,359],[175,331]],
    calf:[[162,351],[190,364],[177,391],[175,414],[152,416],[144,401],[153,375]],
    foot:[[145,394],[171,392],[173,410],[195,415],[197,430],[174,434],[152,426],[141,415]],
    body:[[0,0],[480,0],[480,278],[250,278],[233,299],[222,325],[210,344],[201,358],[193,337],[170,352],[152,348],[165,321],[182,280],[0,280]],detail:[] },
};
export const V100_MAIN_HUMAN_WALK_KINDS=Object.freeze(Object.keys(rigs));
export const V100_MAIN_HUMAN_WALK_ASSETS=Object.freeze(Object.fromEntries(Object.entries(rigs).map(([kind,rig])=>[kind,rig.path])));
const stance=.65, frameCount=24, cellW=240, cellH=224;
const cycle=p=>((Number(p)||0)%1+1)%1;
const length=(a,b)=>Math.hypot(b[0]-a[0],b[1]-a[1]);
function kneeFor(hip,ankle,upper,lower){
  const dx=ankle[0]-hip[0],dy=ankle[1]-hip[1],d=Math.hypot(dx,dy),along=(upper*upper-lower*lower+d*d)/(2*d),bend=Math.sqrt(Math.max(0,upper*upper-along*along));
  return [hip[0]+dx/d*along+dy/d*bend,hip[1]+dy/d*along-dx/d*bend];
}
export function v100MainHumanWalkCycleDistance(kind,scale){const r=rigs[kind];return r?2*r.reach*Math.max(.001,Number(scale)||.001)/stance:null;}
export function v100MainHumanWalkPose(kind,phase){
  const r=rigs[kind];if(!r)return null;
  const p=cycle(phase),rise=-1.1*Math.cos(p*4*Math.PI),upper=length(r.hip,r.knee),lower=length(r.knee,r.ankle);
  const foot=q=>{q=cycle(q);if(q<=stance+1e-10)return{point:[r.target[0]+r.reach*(1-2*Math.min(q,stance)/stance),r.ankle[1]],planted:true,angle:0};const t=(q-stance)/(1-stance),s=t*t*(3-2*t);return{point:[r.target[0]+r.reach*(2*s-1),r.ankle[1]-r.lift*Math.sin(Math.PI*t)],planted:false,angle:-.15*Math.sin(Math.PI*t)};};
  const leg=(offset,q)=>{const f=foot(q),hip=[r.target[0]+offset,r.target[1]+rise];return{...f,hip,knee:kneeFor(hip,f.point,upper,lower)};};
  return{phase:p,rise,upper,lower,near:leg(3,p),far:leg(-3,p+.5)};
}
function drawPiece(ctx,image,polygon,sourceA,sourceB,targetA,targetB,extraRotation=0){
  ctx.save();ctx.translate(...targetA);
  const rotation=sourceB?Math.atan2(targetB[1]-targetA[1],targetB[0]-targetA[0])-Math.atan2(sourceB[1]-sourceA[1],sourceB[0]-sourceA[0]):0;
  ctx.rotate(rotation+extraRotation);ctx.translate(-sourceA[0],-sourceA[1]);ctx.beginPath();
  polygon.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.clip();ctx.drawImage(image,480,0,480,448,0,0,480,448);ctx.restore();
}
function paint(ctx,image,kind,pose){
  const r=rigs[kind],bodyA=[r.target[0],r.hip[1]],bodyB=[r.target[0],r.target[1]+pose.rise];
  const leg=l=>{drawPiece(ctx,image,r.thigh,r.hip,r.knee,l.hip,l.knee);drawPiece(ctx,image,r.calf,r.knee,r.ankle,l.knee,l.point);drawPiece(ctx,image,r.foot,r.ankle,null,l.point,null,l.angle+(kind==="kumaverson"?.25:kind==="babayaga"?.15:kind==="zakimiya"?.1:0));};
  ctx.save();ctx.filter='brightness(.86)';leg(pose.far);ctx.restore();leg(pose.near);
  drawPiece(ctx,image,r.body,bodyA,null,bodyB,null);
  for(const polygon of r.detail)drawPiece(ctx,image,polygon,bodyA,null,bodyB,null);
}
export function createV100MainHumanWalkRenderer({createCanvas=()=>document.createElement('canvas')}={}){
  const cache=new Map();let builds=0;
  const clear=()=>{for(const {canvas} of cache.values()){canvas.width=0;canvas.height=0;}cache.clear();};
  function prepare(kind,image){
    if(!rigs[kind]||!image?.naturalWidth)return false;
    if(cache.get(kind)?.image===image)return true;
    const old=cache.get(kind);if(old){old.canvas.width=0;old.canvas.height=0;cache.delete(kind);}
    const canvas=createCanvas();canvas.width=cellW*6;canvas.height=cellH*4;const ctx=canvas.getContext('2d');if(!ctx)return false;
    ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
    for(let i=0;i<frameCount;i++){ctx.save();ctx.translate(i%6*cellW,Math.floor(i/6)*cellH);ctx.scale(.5,.5);paint(ctx,image,kind,v100MainHumanWalkPose(kind,i/frameCount));ctx.restore();}
    cache.set(kind,{image,canvas});builds++;return true;
  }
  function draw(ctx,image,kind,phase,dx,dy,dw,dh){if(!prepare(kind,image))return false;const i=Math.floor(cycle(phase)*frameCount)%frameCount;ctx.drawImage(cache.get(kind).canvas,i%6*cellW,Math.floor(i/6)*cellH,cellW,cellH,dx,dy,dw,dh);return true;}
  return Object.freeze({prepare,draw,clear,snapshot:()=>({entries:cache.size,bytes:cache.size*cellW*cellH*frameCount*4,builds,frames:frameCount})});
}
