import json,re
from pathlib import Path
import requests

OUT=Path('tmp_threads_audit'); OUT.mkdir(exist_ok=True)
TARGET='https://www.threads.com/@uwachan2026/post/DbwZjCnE08w'
DOC='9360915773983802'
IDS=[
 ('pk','3958776431606189872'),
 ('fbid','18041551211807712'),
 ('compound','3958776431606189872_41585372900'),
 ('shortcode','DbwZjCnE08w'),
]
URLS=['https://www.threads.com/api/graphql','https://www.threads.net/api/graphql']
UA='Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'
PV={
'__relay_internal__pv__BarcelonaIsLoggedInrelayprovider':False,
'__relay_internal__pv__BarcelonaIsInternalUserrelayprovider':False,
'__relay_internal__pv__BarcelonaIsCrawlerrelayprovider':True,
'__relay_internal__pv__BarcelonaOptionalCookiesEnabledrelayprovider':True,
'__relay_internal__pv__BarcelonaIsLoggedOutrelayprovider':True,
}

def lsd(html):
 m=re.search(r'"LSD"[^\n]{0,1000}?"token"\s*:\s*"([^"]+)"',html,re.I); return m.group(1) if m else 't'
def site(html,key,default=''):
 p={
  'hsi':r'"hsi"\s*:\s*"([^"]+)"',
  'rev':r'"client_revision"\s*:\s*(\d+)',
  'spin_r':r'"__spin_r"\s*:\s*(\d+)',
  'spin_b':r'"__spin_b"\s*:\s*"([^"]+)"',
 }
 m=re.search(p[key],html); return m.group(1) if m else default

def inspect(txt):
 d={'length':len(txt),'preview':txt[:1500]}
 try:
  x=json.loads(txt); users=[]; liker=[]; curs=[]
  def w(v,path=''):
   if isinstance(v,dict):
    if isinstance(v.get('username'),str): users.append({k:v.get(k) for k in ('id','pk','user_id','username','full_name','is_verified','is_private','follower_count','following_count') if k in v})
    if 'likers' in v: liker.append(path+'.likers')
    for k in ('end_cursor','next_max_id','next_cursor','cursor'):
     if v.get(k): curs.append((path+'.'+k,str(v.get(k))))
    for k,z in v.items(): w(z,path+'.'+str(k))
   elif isinstance(v,list):
    for i,z in enumerate(v): w(z,path+f'[{i}]')
  w(x); d.update(users_found=len(users),user_sample=users[:3],liker_paths=liker[:10],cursors=curs[:20],top=list(x) if isinstance(x,dict) else type(x).__name__)
 except Exception as e:d['json_error']=repr(e)
 return d

s=requests.Session(); s.headers.update({'User-Agent':UA,'Accept-Language':'en-US,en;q=0.9'})
g=s.get(TARGET,timeout=60); html=g.text; tok=lsd(html); csrf=s.cookies.get('csrftoken','')
meta={'bootstrap_status':g.status_code,'lsd':tok,'csrf':csrf,'hsi':site(html,'hsi'),'rev':site(html,'rev'),'spin_r':site(html,'spin_r'),'spin_b':site(html,'spin_b'),'cookies':s.cookies.get_dict()}
results=[]
base_headers={'X-FB-LSD':tok,'X-IG-App-ID':'238260118697367','X-ASBD-ID':'129477','X-CSRFToken':csrf,'Content-Type':'application/x-www-form-urlencoded','Origin':'https://www.threads.com','Referer':TARGET,'Accept':'*/*'}
for endpoint in URLS:
 for id_name,ident in IDS:
  for typ in ('string','int'):
   if typ=='int' and not ident.isdigit(): continue
   val=int(ident) if typ=='int' else ident
   for pv in (False,True):
    vars={'mediaID':val}; vars.update(PV if pv else {})
    # minimal and Comet-style outer form, because both are used by current web client surfaces.
    for outer in ('minimal','comet'):
     form={'lsd':tok,'doc_id':DOC,'variables':json.dumps(vars,separators=(',',':'))}
     if outer=='comet':
      form.update({'__user':'0','__a':'1','__req':'1','__comet_req':'122','__hsi':meta['hsi'],'__rev':meta['rev'],'__spin_r':meta['spin_r'],'__spin_b':meta['spin_b'],'jazoest':'2'+''.join(str(ord(c)) for c in tok)[:30]})
     try:
      r=s.post(endpoint,data=form,headers=base_headers,timeout=60)
      rec={'endpoint':endpoint,'id_name':id_name,'type':typ,'pv':pv,'outer':outer,'status':r.status_code}; rec.update(inspect(r.text)); results.append(rec)
     except Exception as e: results.append({'endpoint':endpoint,'id_name':id_name,'type':typ,'pv':pv,'outer':outer,'error':repr(e)})
# Also check whether the advertised Apify actor can be invoked anonymously; no token or credentials are supplied.
apify=[]
for u in ['https://api.apify.com/v2/acts/memo23~threads-scraper','https://api.apify.com/v2/acts/memo23~threads-scraper/runs']:
 try:
  if u.endswith('/runs'):
   r=requests.post(u,json={'postUrls':[TARGET],'includeLikers':True,'maxItems':5},timeout=60)
  else:r=requests.get(u,timeout=60)
  apify.append({'url':u,'status':r.status_code,'length':len(r.text),'preview':r.text[:3000]})
 except Exception as e:apify.append({'url':u,'error':repr(e)})
out={'meta':meta,'tests':results,'apify_anonymous':apify}
(OUT/'liker_graphql_test.json').write_text(json.dumps(out,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'meta':meta,'summary':[x for x in results if x.get('users_found',0)>0 or x.get('status')!=200][:50],'tested':len(results),'apify':apify},ensure_ascii=False,indent=2)[:120000])
