import json
import re
from pathlib import Path
import requests

OUT=Path('tmp_threads_audit'); OUT.mkdir(exist_ok=True)
TARGET='https://www.threads.com/@uwachan2026/post/DbwZjCnE08w'
POST_ID='3958776431606189872'
DOC='9360915773983802'
ENDPOINTS=['https://www.threads.com/api/graphql','https://www.threads.net/api/graphql']
UAS={
 'browser':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36',
 'crawler':'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
}
PV={
'__relay_internal__pv__BarcelonaIsLoggedInrelayprovider':False,
'__relay_internal__pv__BarcelonaIsInternalUserrelayprovider':False,
'__relay_internal__pv__BarcelonaIsCrawlerrelayprovider':True,
'__relay_internal__pv__BarcelonaOptionalCookiesEnabledrelayprovider':True,
'__relay_internal__pv__BarcelonaIsLoggedOutrelayprovider':True,
}

def extract_lsd(html):
    pats=[
      r'"LSD"[^\n]{0,1000}?"token"\s*:\s*"([^"]+)"',
      r'"token"\s*:\s*"([A-Za-z0-9_-]{10,})"[^\n]{0,500}?"LSD"',
      r'lsd=([A-Za-z0-9_-]{10,})',
      r'"lsd"\s*:\s*"([A-Za-z0-9_-]{10,})"',
    ]
    for p in pats:
      m=re.search(p,html,re.I)
      if m:return m.group(1)
    return None

def summarize(txt):
    rec={'length':len(txt),'preview':txt[:5000]}
    try:
      data=json.loads(txt); rec['json_top']=list(data) if isinstance(data,dict) else type(data).__name__
      users=[]; paths=[]
      def walk(x,path=''):
        if isinstance(x,dict):
          if isinstance(x.get('username'),str):
            users.append({k:x.get(k) for k in ['id','pk','user_id','username','full_name','is_verified','is_private','follower_count','following_count','biography'] if k in x})
          if 'likers' in x: paths.append(path+'.likers')
          for k,v in x.items(): walk(v,path+'.'+str(k))
        elif isinstance(x,list):
          for i,v in enumerate(x): walk(v,path+f'[{i}]')
      walk(data)
      rec['users_found']=len(users); rec['liker_paths']=paths[:20]; rec['user_sample']=users[:10]
    except Exception as e: rec['json_error']=repr(e)
    return rec

report=[]
for ua_name,ua in UAS.items():
  s=requests.Session(); s.headers.update({'User-Agent':ua,'Accept-Language':'en-US,en;q=0.9'})
  try:
    g=s.get(TARGET,timeout=60,allow_redirects=True)
    html=g.text; lsd=extract_lsd(html)
    # also capture plausible token strings adjacent to LSD for diagnostics
    lsd_context=[]
    for m in re.finditer('LSD',html,re.I):
      lsd_context.append(html[max(0,m.start()-300):m.start()+700])
      if len(lsd_context)>=5:break
    report.append({'phase':'bootstrap','ua':ua_name,'status':g.status_code,'final_url':g.url,'html_length':len(html),'lsd':lsd,'cookies':s.cookies.get_dict(),'lsd_context':lsd_context})
  except Exception as e:
    report.append({'phase':'bootstrap','ua':ua_name,'error':repr(e)}); continue
  tokens=[]
  for t in [lsd,'t']:
    if t and t not in tokens: tokens.append(t)
  for endpoint in ENDPOINTS:
    for tok in tokens:
      for with_pv in [False,True]:
        vars={'mediaID':POST_ID}
        if with_pv: vars.update(PV)
        headers={
          'X-FB-LSD':tok,'X-IG-App-ID':'238260118697367','X-ASBD-ID':'129477',
          'Content-Type':'application/x-www-form-urlencoded','Origin':'https://www.threads.com','Referer':TARGET,
          'Accept':'*/*','Sec-Fetch-Site':'same-origin','Sec-Fetch-Mode':'cors','Sec-Fetch-Dest':'empty',
        }
        try:
          r=s.post(endpoint,data={'lsd':tok,'doc_id':DOC,'variables':json.dumps(vars,separators=(',',':'))},headers=headers,timeout=60,allow_redirects=True)
          rec={'phase':'query','ua':ua_name,'endpoint':endpoint,'token_kind':'live' if tok==lsd and lsd else 't','with_pv':with_pv,'status':r.status_code,'final_url':r.url}
          rec.update(summarize(r.text)); report.append(rec)
        except Exception as e:
          report.append({'phase':'query','ua':ua_name,'endpoint':endpoint,'token_kind':'live' if tok==lsd and lsd else 't','with_pv':with_pv,'error':repr(e)})
(OUT/'liker_graphql_test.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(report,ensure_ascii=False,indent=2)[:120000])
