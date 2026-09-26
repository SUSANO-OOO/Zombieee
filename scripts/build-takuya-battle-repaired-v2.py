from pathlib import Path
import hashlib,json
import numpy as np
from PIL import Image,ImageDraw

ROOT=Path(__file__).resolve().parents[1]
SOURCE=ROOT/'public/takuya-boss-sprites-v2.png'
OUT=ROOT/'public/art/v100/bosses/takuya-battle-repaired-v1.png'
META=ROOT/'public/art/v100/bosses/takuya-battle-repaired-v1-metadata.json'
PROV=ROOT/'assets/source/v100/takuya/takuya-battle-repaired-v1.provenance.json'
CONTACT=ROOT/'outputs/completion/takuya-atlas-repaired-v1/contact-sheet.png'
RAW_W,RAW_H=362,724; CELL_W,CELL_H=512,757; OFF_X,OFF_Y=48,16
STATES=('idle','walk-a','walk-b','attack-a','attack-b','hit'); GROUND=[604,609,607,606,617,608]
MAIN={'idle':1,'walk-a':2,'walk-b':3,'attack-a':0,'attack-b':5,'hit':4}

def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()
def components(alpha):
 h,w=alpha.shape; seen=np.zeros_like(alpha,bool); out=[]
 for y,x in zip(*np.where(alpha)):
  if seen[y,x]: continue
  st=[(int(y),int(x))]; seen[y,x]=1; pts=[]
  while st:
   yy,xx=st.pop(); pts.append((yy,xx))
   for dy in (-1,0,1):
    for dx in (-1,0,1):
     ny,nx=yy+dy,xx+dx
     if 0<=ny<h and 0<=nx<w and alpha[ny,nx] and not seen[ny,nx]: seen[ny,nx]=1; st.append((ny,nx))
  out.append(pts)
 return out
def rect(im):
 a=np.array(im)[:,:,3]; ys,xs=np.where(a>0); return [int(xs.min()),int(ys.min()),int(xs.max()+1),int(ys.max()+1)]
def blade(raw):
 a=np.array(raw); poly=[(OFF_X+47,483),(OFF_X+229,381),(OFF_X+268,443),(OFF_X+81,550)]; m=Image.new('L',(CELL_W,RAW_H),0); ImageDraw.Draw(m).polygon(poly,fill=255); keep=(a[:,:,3]>0)&(np.array(m)>0); out=np.zeros_like(a); out[keep]=a[keep]; return Image.fromarray(out,'RGBA'),poly,int(keep.sum())
def shift_rgba(im,dx,dy,size):
 out=Image.new('RGBA',size,(0,0,0,0)); out.alpha_composite(im,(dx,dy)); return out

src=Image.open(SOURCE).convert('RGBA'); srca=np.array(src); allpts=components(srca[:,:,3]>0)
assert len(allpts)==21
assigned={s:[] for s in STATES}; assigned['attack-b'].extend(range(6,21))
for s,cid in MAIN.items(): assigned[s].append(cid)
assert sorted(i for ids in assigned.values() for i in ids)==list(range(21))
raws={s:np.zeros((RAW_H,CELL_W,4),np.uint8) for s in STATES}
for cid,pts in enumerate(allpts):
 s=next(s for s,ids in assigned.items() if cid in ids); origin=STATES.index(s)*RAW_W
 for y,x in pts:
  lx=x-origin+OFF_X
  if 0<=lx<CELL_W: raws[s][y,lx]=srca[y,x]
# source component reconstruction is exact for all assigned pixels.
assert sum(int((raws[s][:,:,3]>0).sum()) for s in STATES)==int((srca[:,:,3]>0).sum())
raw={s:Image.fromarray(raws[s],'RGBA') for s in STATES}
def cell(im):
 o=Image.new('RGBA',(CELL_W,CELL_H),(0,0,0,0)); o.alpha_composite(im,(0,OFF_Y)); return o
cells={s:cell(raw[s]) for s in STATES}; changes={}
# walk-a: global component body/rope plus explicit authored blade transfer.
b,poly,n=blade(raw['walk-b']); lay=Image.new('RGBA',(CELL_W,CELL_H),(0,0,0,0)); lay.alpha_composite(b,(20,OFF_Y-5)); cells['walk-a'].alpha_composite(lay)
protect=Image.new('L',(CELL_W,CELL_H),0); ImageDraw.Draw(protect).polygon([(OFF_X+270,OFF_Y+327),(OFF_X+323,OFF_Y+327),(OFF_X+339,OFF_Y+372),(OFF_X+322,OFF_Y+399),(OFF_X+286,OFF_Y+401),(OFF_X+271,OFF_Y+380)],fill=255)
ca=np.array(cells['walk-a']); oa=np.array(cell(raw['walk-a'])); pm=np.array(protect)>0; ca[pm]=oa[pm]; cells['walk-a']=Image.fromarray(ca,'RGBA')
changes['walk-a']={'globalComponent':2,'bladePolygon':poly,'bladePixels':n,'translationPx':[20,-5],'handProtection':'exact source RGBA overwrite'}
# hit candidate: rotate the authored walk-b blade around its connection then translate to hit handle.
blade_canvas=Image.new('RGBA',(CELL_W,CELL_H),(0,0,0,0)); blade_canvas.alpha_composite(b,(0,OFF_Y)); rotated=blade_canvas.rotate(-8, resample=Image.Resampling.BICUBIC, center=(OFF_X+249,OFF_Y+413), expand=False)
placed=shift_rgba(rotated,-44,31,(CELL_W,CELL_H)); cells['hit'].alpha_composite(placed)
hp=Image.new('L',(CELL_W,CELL_H),0); ImageDraw.Draw(hp).polygon([(OFF_X+175,OFF_Y+390),(OFF_X+216,OFF_Y+385),(OFF_X+245,OFF_Y+425),(OFF_X+236,OFF_Y+470),(OFF_X+198,OFF_Y+480),(OFF_X+174,OFF_Y+450)],fill=255); ha=np.array(cells['hit']); h0=np.array(cell(raw['hit'])); hm=np.array(hp)>0; ha[hm]=h0[hm]; cells['hit']=Image.fromarray(ha,'RGBA')
changes['hit']={'globalComponent':4,'bladeSource':'walk-b global component 3 polygon','rotationDegreesClockwise':8,'sourceConnection':[249,413],'targetConnection':[205,444],'translationPx':[-44,31],'handProtection':'exact source RGBA overwrite'}
changes['idle']={'globalComponent':1}; changes['walk-b']={'globalComponent':3}; changes['attack-a']={'globalComponent':0}; changes['attack-b']={'globalComponent':5,'debrisComponents':list(range(6,21))}
atlas=Image.new('RGBA',(CELL_W*6,CELL_H),(0,0,0,0))
for i,s in enumerate(STATES): atlas.alpha_composite(cells[s],(i*CELL_W,0))
OUT.parent.mkdir(parents=True,exist_ok=True); atlas.save(OUT)
rects=[rect(cells[s]) for s in STATES]
meta={'format':'nishijin-v100-takuya-repaired-motion-atlas','version':1,'path':'/art/v100/bosses/takuya-battle-repaired-v1.png','cellWidth':CELL_W,'cellHeight':CELL_H,'columns':6,'sourceWidth':RAW_W,'sourceHeight':RAW_H,'sourceOffset':{'x':OFF_X,'y':OFF_Y},'anchorX':229/512,'groundAnchorPixels':GROUND,'states':list(STATES),'visibleRects':rects,'sourceSha256':sha(SOURCE),'atlasSha256':sha(OUT)}
META.write_text(json.dumps(meta,indent=2)+'\n')
CONTACT.parent.mkdir(parents=True,exist_ok=True); cs=Image.new('RGBA',(CELL_W*6,CELL_H),(44,60,82,255)); d=ImageDraw.Draw(cs)
for i,s in enumerate(STATES): cs.alpha_composite(cells[s],(i*CELL_W,0)); d.text((i*CELL_W+8,8),s,fill=(255,255,255,255))
cs.save(CONTACT)
PROV.parent.mkdir(parents=True,exist_ok=True); prov={'generator':'scripts/build-takuya-battle-repaired-v2.py','source':{'path':'public/takuya-boss-sprites-v2.png','sha256':sha(SOURCE),'globalAlphaComponents':21,'assignment':{s:assigned[s] for s in STATES},'unassigned':[],'duplicateAssignments':[]},'output':{'path':str(OUT.relative_to(ROOT)).replace('\\','/'),'sha256':sha(OUT)},'geometry':meta,'changes':changes,'checks':{'all21ComponentsAssignedExactlyOnce':True,'sourceRGBAReusedForAssignedComponents':True,'legacy35cePreserved':'outputs/completion/takuya-atlas-repaired-v1/rejected-35ce-candidate.png'}}
PROV.write_text(json.dumps(prov,indent=2)+'\n'); print(json.dumps({'sha256':sha(OUT),'visibleRects':rects},indent=2))
