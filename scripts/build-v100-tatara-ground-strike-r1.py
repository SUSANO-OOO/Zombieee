from collections import deque
from pathlib import Path
import hashlib,json
import numpy as np
from PIL import Image
BASE=Path(__file__).resolve().parents[1]
SOURCE=BASE/'assets/source/v100/characters/tatara-ground-strike-r1.png'
SOURCE_SHA='16c24f1de11cc45da618c8ba0bc7e8a748cc2a5f8b1a1842bbb4063d70d469d8'
def comps(m):
 h,w=m.shape; seen=np.zeros_like(m); out=[]
 for y,x in zip(*np.where(m)):
  if seen[y,x]: continue
  q=deque([(int(y),int(x))]); seen[y,x]=1; c=[]
  while q:
   yy,xx=q.popleft(); c.append((yy,xx))
   for dy in (-1,0,1):
    for dx in (-1,0,1):
     ny,nx=yy+dy,xx+dx
     if (dy or dx) and 0<=ny<h and 0<=nx<w and m[ny,nx] and not seen[ny,nx]: seen[ny,nx]=1;q.append((ny,nx))
  out.append(c)
 return out
source=Image.open(SOURCE).convert('RGB'); rgb=np.asarray(source); h,w=rgb.shape[:2]; lum=rgb.mean(2); chroma=rgb.max(2)-rgb.min(2); neutral=(chroma<=30)&(lum>=70); bg=np.zeros((h,w),bool); q=deque()
for y in range(h):
 for x in (0,w-1):
  if neutral[y,x] and not bg[y,x]: bg[y,x]=1;q.append((y,x))
for x in range(w):
 for y in (0,h-1):
  if neutral[y,x] and not bg[y,x]: bg[y,x]=1;q.append((y,x))
while q:
 y,x=q.popleft()
 for yy in range(max(0,y-1),min(h,y+2)):
  for xx in range(max(0,x-1),min(w,x+2)):
   if neutral[yy,xx] and not bg[yy,xx]: bg[yy,xx]=1;q.append((yy,xx))
alpha=np.where(bg,0,255).astype('uint8')
for y,x in zip(*np.where(bg)):
 n=sum(not bg[yy,xx] for yy in range(max(0,y-1),min(h,y+2)) for xx in range(max(0,x-1),min(w,x+2)))
 if n: alpha[y,x]=min(160,32*n)
parts=comps(alpha>0); keep=np.zeros_like(alpha,dtype=bool)
for y,x in max(parts,key=len): keep[y,x]=1
alpha=np.where(keep,alpha,0).astype('uint8'); rgba=np.dstack([rgb,alpha]); ys,xs=np.where(alpha>0); bbox=[int(xs.min()),int(ys.min()),int(xs.max()+1),int(ys.max()+1)]; scale=345/(bbox[3]-bbox[1]); dims=(round(w*scale),round(h*scale)); resized=Image.fromarray(rgba,'RGBA').resize(dims,Image.Resampling.LANCZOS); ar=np.asarray(resized); yy,xx=np.where(ar[...,3]>0); sb=[int(xx.min()),int(yy.min()),int(xx.max()+1),int(yy.max()+1)]; tx,ty=16-sb[0],496-sb[3]
out=BASE/'public/art/v100/characters/tatara-ground-strike-r1.webp'; out.parent.mkdir(parents=True,exist_ok=True); cell=Image.new('RGBA',(640,512)); cell.alpha_composite(resized,(tx,ty)); cell.save(out,'WEBP',lossless=True,method=6)
review=BASE/'outputs/completion/tatara-ground-strike-r1'; review.mkdir(parents=True,exist_ok=True); Image.fromarray(rgba,'RGBA').save(review/'tatara-ground-strike-alpha.png'); dark=Image.new('RGB',(640,512),(38,42,48)); dark.paste(cell,(0,0),cell.getchannel('A')); dark.save(review/'tatara-ground-strike-dark-preview.png')
band=alpha[max(0,bbox[3]-18):bbox[3]]>128; counts=band.sum(0); xs2=np.where(counts>=2)[0]; groups=[]
for x in xs2:
 if not groups or x>groups[-1][-1]+1: groups.append([int(x)])
 else: groups[-1].append(int(x))
boots=[g for g in groups if g[0]>400 and len(g)>=20][-2:]; centers=[(g[0]+g[-1])/2 for g in boots] if len(boots)==2 else [622,1262]; mid=sum(centers)/2; anchor=mid*scale+tx; iy,ix=np.where((alpha>128)&(np.indices(alpha.shape)[1]<400)); bottom=int(iy.max()); bx=ix[iy==bottom]; hammer=[float(bx.mean()),float(bottom)]; hcell=[round(hammer[0]*scale+tx,3),round(hammer[1]*scale+ty,3)]; body=(alpha>128)&(np.indices(alpha.shape)[1]>=400); by,bx=np.where(body); bodybox=[int(bx.min()),int(by.min()),int(bx.max()+1),int(by.max()+1)]
prompt_path=BASE/'outputs/completion/tatara-ground-generation-prompt-r1.json'; prompt_ref=json.loads(prompt_path.read_text(encoding='utf-8')) if prompt_path.exists() else {}; prov={'generator':'scripts/build-v100-tatara-ground-strike-r1.py','source':{'path':'assets/source/v100/characters/tatara-ground-strike-r1.png','originalPath':'C:/Users/okait/.codex/generated_images/01a079d3-063c-7401-963b-c507867eead5/exec-ff543615-0f0e-449b-91c4-2ee31b7d9e36.png','bytes':SOURCE.stat().st_size,'sha256':SOURCE_SHA,'mode':'RGB','size':[w,h]},'processing':{'checkerRepair':'border-connected neutral grayscale flood; largest foreground component; RGB preserved','uniformScale':scale,'scaledSize':list(dims),'sourceVisibleBounds':bbox,'outputVisibleBounds':[sb[0]+tx,sb[1]+ty,sb[2]+tx,sb[3]+ty],'translation':[tx,ty],'bootSoleCentersSource':centers,'bootMidpointSource':mid,'hammerBottomFaceCenterSource':hammer,'hammerBottomFaceCenterCell':hcell,'bodyBoundsSource':bodybox,'bodyVisibleHeight':bodybox[3]-bodybox[1],'margins':{'left':sb[0]+tx,'right':640-sb[2]-tx,'top':sb[1]+ty,'bottom':512-sb[3]-ty}},'output':{'path':'public/art/v100/characters/tatara-ground-strike-r1.webp','bytes':out.stat().st_size,'sha256':hashlib.sha256(out.read_bytes()).hexdigest(),'size':[640,512],'sourceRect':{'x':0,'y':0,'w':640,'h':512},'contentRect':{'x':sb[0]+tx,'y':sb[1]+ty,'w':sb[2]-sb[0],'h':sb[3]-sb[1]},'anchorX':round(anchor/640,6),'anchorY':round(496/512,6),'nativeDirection':'left','flipXForRight':True},'identityScaleComparison':{'runtimeLegacyBruteAttackBContentHeight':346,'candidateVisibleHeight':sb[3]-sb[1],'candidateBodyVisibleHeight':bodybox[3]-bodybox[1]},'promptReference':{'path':'outputs/completion/tatara-ground-generation-prompt-r1.json','tool':prompt_ref.get('tool'),'sourceImage':prompt_ref.get('sourceImage'),'generatedSource':prompt_ref.get('generatedSource'),'prompt':prompt_ref.get('prompt')},'prompt':prompt_ref.get('prompt'),'adoption':'parent visual reviewed; pending native integration QA'}
(review/'tatara-ground-strike-r1-provenance.json').write_text(json.dumps(prov,ensure_ascii=False,indent=2)+'\n',encoding='utf-8'); print(json.dumps(prov,ensure_ascii=False,indent=2))
