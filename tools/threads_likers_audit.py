import json
from pathlib import Path
import requests

OUT=Path('tmp_threads_audit'); OUT.mkdir(exist_ok=True)
POST_ID='3958776431606189872'
URL='https://www.threads.com/api/graphql'
DOCS=['9360915773983802']
UA='Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'
PV={
'__relay_internal__pv__BarcelonaIsLoggedInrelayprovider':False,
'__relay_internal__pv__BarcelonaIsInternalUserrelayprovider':False,
'__relay_internal__pv__BarcelonaIsCrawlerrelayprovider':True,
'__relay_internal__pv__BarcelonaOptionalCookiesEnabledrelayprovider':True,
'__relay_internal__pv__BarcelonaIsLoggedOutrelayprovider':True,
}

s=requests.Session(); s.headers.update({'User-Agent':UA})
report=[]
for doc in DOCS:
  for key in ['mediaID','postID','media_id']:
    vars={key:POST_ID,**PV}
    try:
      r=s.post(URL,data={'lsd':'t','doc_id':doc,'variables':json.dumps(vars,separators=(',',':'))},headers={'X-FB-LSD':'t','X-IG-App-ID':'238260118697367','Content-Type':'application/x-www-form-urlencoded'},timeout=60)
      txt=r.text
      rec={'doc_id':doc,'key':key,'status':r.status_code,'length':len(txt),'preview':txt[:30000]}
      try:
        data=r.json(); rec['json_top']=list(data) if isinstance(data,dict) else type(data).__name__
        # recursively count profile-like username objects and collect structural keys only
        users=[]; paths=[]
        def walk(x,path=''):
          if isinstance(x,dict):
            if isinstance(x.get('username'),str): users.append({k:x.get(k) for k in ['id','pk','user_id','username','full_name','is_verified','is_private','follower_count','following_count'] if k in x})
            if 'likers' in x: paths.append(path+'.likers')
            for k,v in x.items(): walk(v,path+'.'+str(k))
          elif isinstance(x,list):
            for i,v in enumerate(x): walk(v,path+f'[{i}]')
        walk(data)
        rec['users_found']=len(users); rec['liker_paths']=paths[:20]; rec['user_sample']=users[:5]
      except Exception as e: rec['json_error']=repr(e)
      report.append(rec)
    except Exception as e:
      report.append({'doc_id':doc,'key':key,'error':repr(e)})
(OUT/'liker_graphql_test.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(report,ensure_ascii=False,indent=2)[:120000])
