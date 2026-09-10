import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
const ROOT = path.resolve(import.meta.dirname, "..");
const OUT = path.join(ROOT, "outputs/completion/motion-alpha-candidates-r3/analysis");
const dirs = ["mugarian-president-mutated", "takuya-omega", "red-panther-knife", "red-panther-shield", "red-panther-smg", "red-panther-commander"];
const matte = (d, i) => { const r=d[i],g=d[i+1],b=d[i+2]; const l=(r*299+g*587+b*114)/1000; return d[i+3]===255 && Math.max(r,g,b)-Math.min(r,g,b)<=12 && l>=205; };
async function inspect(file) {
  const {data,info}=await sharp(file).ensureAlpha().raw().toBuffer({resolveWithObject:true}); const w=info.width,h=info.height,seen=new Uint8Array(w*h),comps=[];
  for(let start=0;start<w*h;start++){if(seen[start]||!matte(data,start*4))continue; const q=[start],pix=[]; seen[start]=1; let border=false,minX=w,minY=h,maxX=-1,maxY=-1;
    while(q.length){const i=q.pop();pix.push(i);const x=i%w,y=Math.floor(i/w);minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);border ||= x===0||y===0||x===w-1||y===h-1;
      for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){if(!dx&&!dy)continue;const nx=x+dx,ny=y+dy;if(nx<0||ny<0||nx>=w||ny>=h)continue;const n=ny*w+nx;if(!seen[n]&&matte(data,n*4)){seen[n]=1;q.push(n);}}
    }
    if(!border&&pix.length>=16)comps.push({area:pix.length,bbox:[minX,minY,maxX-minX+1,maxY-minY+1],seed:[pix[0]%w,Math.floor(pix[0]/w)]});
  }
  return {source:path.relative(ROOT,file).replaceAll(path.sep,"/"),size:[w,h],alphaAuthored:[...data].some((v,i)=>i%4===3&&v<255),enclosed:comps.sort((a,b)=>b.area-a.area)};
}
async function main(){await fs.mkdir(OUT,{recursive:true});const records=[];for(const d of dirs){for(const n of (await fs.readdir(path.join(ROOT,"assets/source/v100/runtime/motion",d))).filter(n=>n.endsWith("-left-authored-v1.png"))){const r=await inspect(path.join(ROOT,"assets/source/v100/runtime/motion",d,n));records.push(r);console.log(r.source,r.alphaAuthored,r.enclosed.slice(0,20));}}await fs.writeFile(path.join(OUT,"enclosed-components.json"),JSON.stringify(records,null,2));}
main().catch(e=>{console.error(e);process.exitCode=1;});
