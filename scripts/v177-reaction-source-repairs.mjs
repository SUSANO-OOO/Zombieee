import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const sourceFolder='assets/source/v100/sprite-repairs/reactions';
export const V177_REACTION_KINDS=Object.freeze(['zakimiya','mrs-chiha','miyamoto-musashi','kumaverson']);
export const V177_REACTION_RECIPES=Object.freeze({
  zakimiya:{key:52,hit:[1100,340,300,450],clear:[72,342,164],boot:[76,342,60,62],
    polygon:[[0,0],[205,0],[205,300],[150,325],[130,345],[117,367],[111,375],[95,390],[92,418],[0,418]],
    death:[1190,650,346,140],deathPolygon:[[0,83],[25,68],[40,60],[100,60],[110,30],[150,10],[346,10],[346,135],[0,135]],shiftX:-6},
  'mrs-chiha':{key:48,hit:[1190,230,370,500],clear:[180,386,370],boot:[194,372,64,83],
    neighbours:[[0,0,175,65],[0,65,100,120],[175,0,205,28],[300,320,370,386],[0,405,30,500]],
    death:[1390,530,384,210],deathPatch:[[0,0],[100,0],[100,99],[82,111],[100,129],[90,144],[0,144]]},
  'miyamoto-musashi':{key:48,hit:[1070,360,330,380],clear:[139,310,330],boot:[169,299,67,51],
    neighbours:[[214,265,330,310],[0,170,22,380]],death:[1210,615,326,125],
    deathPatch:[[0,0],[100,0],[100,12],[87,32],[80,46],[105,62],[100,84],[0,84]]},
  kumaverson:{master:'reference/characters/generated-working-v1/kumaverson-atlas-right-chroma-v1.png',
    hit:[418,470,382,471],death:[800,470,454,471],withoutEnlargement:true,floorCenter:true},
});
export function insideReactionPolygon(x,y,polygon){let yes=false;for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){
  const a=polygon[i],b=polygon[j];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])yes=!yes;
}return yes;}
const roundEven=x=>{const f=Math.floor(x);return x-f===.5?(f%2?f+1:f):Math.round(x);};
function keyPixels(data,magenta,threshold){const result=Buffer.alloc(data.length);
  for(let i=0;i<data.length;i+=4){let r=data[i],g=data[i+1],b=data[i+2],a;
    if(magenta){const d=Math.max(255-r,g,255-b),dominance=Math.min(r,b)-g,keyLike=d<=32||dominance>=16;
      if(keyLike){const t=(d-12)/208,soft=d<=12?0:d>=220?255:roundEven(255*t*t*(3-2*t)),dom=dominance<=0?255:roundEven((1-Math.min(1,dominance/Math.max(1,255-g)))*255);a=Math.min(soft,dom);}else a=d<=12?0:255;
      a=roundEven(a*data[i+3]/255);if(a>0&&a<=8)a=0;if(keyLike&&a<252){r=Math.min(r,Math.max(0,g-1));b=Math.min(b,Math.max(0,g-1));}
    }else{const d=Math.hypot(r,g,255-b);a=d<=threshold?0:d>=threshold+76?255:Math.round((d-threshold)*255/76);b=Math.min(b,Math.max(r,g)+(a===255?18:2));}
    if(a){result[i]=r;result[i+1]=g;result[i+2]=b;result[i+3]=a;}
  }return result;
}
async function sourceBytes(root,relative){const file=path.join(root,relative),bytes=await readFile(file);
  const proof=JSON.parse(await readFile(path.join(root,sourceFolder,'inputs.json'),'utf8'));
  const expected=proof.inputs.find(input=>input.path===relative);if(!expected||createHash('sha256').update(bytes).digest('hex')!==expected.sha256)throw new Error('Unapproved reaction input: '+relative);
  return bytes;
}
export async function deriveV177ReactionPose(kind,state,root=process.cwd()){
  const recipe=V177_REACTION_RECIPES[kind];if(!recipe||!['hit','death'].includes(state))throw new RangeError('Unknown reaction pose');
  const [left,top,width,height]=recipe[state],master=recipe.master??`assets/source/v090/characters/${kind}-combat-poses-source-r1.png`;
  const pixels=await sharp(await sourceBytes(root,master)).extract({left,top,width,height}).ensureAlpha().raw().toBuffer();
  let body=keyPixels(pixels,kind==='kumaverson',recipe.key);
  const polygon=state==='hit'?recipe.polygon:recipe.deathPolygon;
  if(polygon)for(let y=0;y<height;y++)for(let x=0;x<width;x++)if(!insideReactionPolygon(x+.5,y+.5,polygon))body.fill(0,(y*width+x)*4,(y*width+x)*4+4);
  if(state==='hit'&&recipe.clear){const [x0,y0,x1]=recipe.clear;for(let y=y0;y<height;y++)for(let x=x0;x<x1;x++)body.fill(0,(y*width+x)*4,(y*width+x)*4+4);
    // Preserve the original detached blood and impact paint. Only the
    // source-audited neighbouring pose rectangles lose their pixels.
    for(const [l,t,r,b]of recipe.neighbours??[])for(let y=t;y<b;y++)for(let x=l;x<r;x++)body.fill(0,(y*width+x)*4,(y*width+x)*4+4);
    const [x,y,w,h]=recipe.boot,boot=await sharp(await sourceBytes(root,`${sourceFolder}/${kind}-boot-guide-r1.png`)).resize(w,h).png().toBuffer();
    return sharp(body,{raw:{width,height,channels:4}}).composite([{input:boot,left:x,top:y}]).png().toBuffer();
  }
  if(state==='death'&&recipe.deathPatch){const guide=await sharp(await sourceBytes(root,`${sourceFolder}/${kind}-death-overlap-guide-r1.png`)).ensureAlpha().raw().toBuffer({resolveWithObject:true});
    if(guide.info.width!==width||guide.info.height!==height)throw new Error('Reaction patch size mismatch');
    for(let y=0;y<height;y++)for(let x=0;x<width;x++)if(insideReactionPolygon(x+.5,y+.5,recipe.deathPatch)){const p=(y*width+x)*4;guide.data.copy(body,p,p,p+4);}
  }
  return sharp(body,{raw:{width,height,channels:4}}).png().toBuffer();
}
export async function applyV177ReactionRepairs(kind,input,root=process.cwd()){
  const recipe=V177_REACTION_RECIPES[kind];if(!recipe)return input;
  const decoded=await sharp(input).ensureAlpha().raw().toBuffer({resolveWithObject:true});if(decoded.info.width!==3360||decoded.info.height!==896)throw new Error('Reaction atlas geometry mismatch');
  const bindings=JSON.parse(await readFile(path.join(root,sourceFolder,'inputs.json'),'utf8')).nonreactionCells?.[kind];
  if(bindings?.length!==10)throw new Error('Missing approved nonreaction bindings');
  for(const binding of bindings){const cell=Buffer.alloc(480*448*4);for(let y=0;y<448;y++){const start=((binding.row*448+y)*3360+binding.column*480)*4;decoded.data.copy(cell,y*480*4,start,start+480*4);}
    if(createHash('sha256').update(cell).digest('hex')!==binding.sha256)throw new Error('Nonreaction source drift: '+kind+'/'+binding.row+'/'+binding.column);
  }
  const result=Buffer.from(decoded.data);
  for(const [column,state]of [[5,'hit'],[6,'death']]){
    const pose=await sharp(await deriveV177ReactionPose(kind,state,root)).trim({threshold:0}).resize({width:448,height:416,fit:'inside',withoutEnlargement:!!recipe.withoutEnlargement,kernel:sharp.kernel.lanczos3}).ensureAlpha().raw().toBuffer({resolveWithObject:true});
    const w=pose.info.width,h=pose.info.height,x=(recipe.floorCenter?Math.floor:Math.round)((480-w)/2)+(state==='hit'?(recipe.shiftX??0):0),y=432-h;
    if(x<16||x+w>464||y<16)throw new Error('Reaction pose exceeds padded cell');
    for(let row=0;row<2;row++){
      for(let yy=0;yy<448;yy++)result.fill(0,((row*448+yy)*3360+column*480)*4,((row*448+yy)*3360+(column+1)*480)*4);
      for(let yy=0;yy<h;yy++)for(let xx=0;xx<w;xx++){const p=(yy*w+(row?w-1-xx:xx))*4,z=((row*448+y+yy)*3360+column*480+x+xx)*4;pose.data.copy(result,z,p,p+4);}
    }
  }
  return sharp(result,{raw:{width:3360,height:896,channels:4}}).png().toBuffer();
}
