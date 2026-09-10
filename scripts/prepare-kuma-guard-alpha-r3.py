"""Standalone Kuma guard checker removal and atlas-cell generator."""
from argparse import ArgumentParser
from collections import deque
from pathlib import Path
import hashlib,json
import numpy as np
from PIL import Image

BASE=Path(__file__).resolve().parents[1]; SOURCE=BASE/'assets/source/v100/characters/kumaverson-guard-source-r3.png'; SHA='389890305ee0094f1e14b51568c6dc5cbf3dce26c57274f0745ea243928e5158'
def main():
 ap=ArgumentParser();ap.add_argument('--output',type=Path,default=BASE/'outputs/completion/kuma-guard-candidate-r3');o=ap.parse_args().output.resolve();o.mkdir(parents=True,exist_ok=True);assert hashlib.sha256(SOURCE.read_bytes()).hexdigest()==SHA
 a=np.asarray(Image.open(SOURCE).convert('RGB'),dtype=np.int16);h,w=a.shape[:2];ch=a.max(2)-a.min(2);lum=a.mean(2);ck=(ch<=12)&(lum>=105)&(lum<=220);p=np.pad(lum,2,mode='edge');v=np.zeros((h,w),np.float32)
 for y in range(5):
  for x in range(5):v+=(p[y:y+h,x:x+w]-lum)**2
 q=deque();bg=np.zeros((h,w),bool);seed=ck&(np.sqrt(v/25)>=6)
 for y,x in zip(*np.where(seed)):bg[y,x]=1;q.append((int(y),int(x)))
 while q:
  y,x=q.popleft()
  for yy in range(max(0,y-1),min(h,y+2)):
   for xx in range(max(0,x-1),min(w,x+2)):
    if ck[yy,xx] and not bg[yy,xx]:bg[yy,xx]=1;q.append((yy,xx))
 edge=np.zeros_like(bg)
 for dy in(-1,0,1):
  for dx in(-1,0,1):
   if dy or dx:edge|=np.roll(np.roll(bg,dy,0),dx,1)
 near=np.zeros((h,w,3),np.float32);n=np.zeros((h,w),np.float32)
 for dy in(-1,0,1):
  for dx in(-1,0,1):
   if dy or dx:
    s=np.roll(np.roll(bg,dy,0),dx,1);near+=np.where(s[...,None],a,0);n+=s
 near/=np.maximum(n[...,None],1);al=np.where(bg,0,np.where(edge&~bg&(ch<=18)&(abs(lum-near.mean(2))<=22),168,255)).astype('uint8');rgba=np.dstack([a.astype('uint8'),al]);f=al>0;seen=np.zeros_like(f);cs=[]
 for y,x in zip(*np.where(f)):
  if seen[y,x]:continue
  z=deque([(int(y),int(x))]);seen[y,x]=1;c=[]
  while z:
   yy,xx=z.popleft();c.append((yy,xx))
   for dy in(-1,0,1):
    for dx in(-1,0,1):
     ny,nx=yy+dy,xx+dx
     if 0<=ny<h and 0<=nx<w and f[ny,nx] and not seen[ny,nx]:seen[ny,nx]=1;z.append((ny,nx))
  cs.append(c)
 keep=np.zeros_like(f)
 for y,x in max(cs,key=len):keep[y,x]=1
 rgba[...,3]=np.where(keep,al,0);cut=Image.fromarray(rgba,'RGBA');full=o/'kumaverson-guard-alpha-r3.png';cut.save(full);ys,xs=np.where(rgba[...,3]>0);b=[int(xs.min()),int(ys.min()),int(xs.max()+1),int(ys.max()+1)];sc=334/(b[3]-b[1]);dims=(round(w*sc),round(h*sc));sx,sy=dims[0]/w,dims[1]/h;im=cut.resize(dims,Image.Resampling.LANCZOS);yy,xx=np.where(np.asarray(im)[...,3]>0);sb=[int(xx.min()),int(yy.min()),int(xx.max()+1),int(yy.max()+1)];tx=round(240-(sb[0]+sb[2])/2);ty=432-sb[3];cell=Image.new('RGBA',(480,448));cell.alpha_composite(im,(tx,ty));cp=o/'kumaverson-guard-atlas-cell-r3.png';cell.save(cp)
 r={'sourceSha256':SHA,'fullOutputSha256':hashlib.sha256(full.read_bytes()).hexdigest(),'cellOutputSha256':hashlib.sha256(cp.read_bytes()).hexdigest(),'algorithm':'standalone neutral checker flood plus largest foreground component; opaque RGB preserved','sourceSize':[w,h],'scaledSize':list(dims),'scaleX':sx,'scaleY':sy,'translation':[tx,ty],'visibleBoundsSource':b,'visibleBoundsCell':[sb[0]+tx,sb[1]+ty,sb[2]+tx,sb[3]+ty],'panSocketSource':[790,370],'panSocketCell':[round(tx+790*sx,3),round(ty+370*sy,3)],'foregroundComponentsBeforeCleanup':len(cs),'removedForegroundComponents':len(cs)-1,'adopted':False};(o/'alpha-check-r3.json').write_text(json.dumps(r,indent=2),encoding='utf-8');print(json.dumps(r,indent=2))
if __name__=='__main__':main()
