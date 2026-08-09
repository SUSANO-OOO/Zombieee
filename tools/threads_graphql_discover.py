import asyncio
import json
import re
from pathlib import Path
from urllib.parse import urljoin

from playwright.async_api import async_playwright

TARGET = "https://www.threads.com/@uwachan2026/post/DbwZjCnE08w"
OUT = Path("tmp_threads_audit")
OUT.mkdir(exist_ok=True)

TERMS = [
    "liker", "likers", "xdt_api__v1__media__likers", "media/likers",
    "Barcelona.*Liker", "LikersQuery", "likers_connection", "like_count",
]


def contexts(text, needle, radius=1200, limit=30):
    out=[]
    flags=re.I
    try:
        pat=re.compile(needle, flags)
    except re.error:
        pat=re.compile(re.escape(needle), flags)
    for m in pat.finditer(text):
        s=max(0,m.start()-radius); e=min(len(text),m.end()+radius)
        out.append(text[s:e])
        if len(out)>=limit: break
    return out


async def main():
    result={"target":TARGET,"scripts":[],"matches":[],"html_matches":{}}
    async with async_playwright() as p:
        browser=await p.chromium.launch(headless=True)
        ctx=await browser.new_context(locale="en-US", user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36")
        page=await ctx.new_page()
        r=await page.goto(TARGET, wait_until="domcontentloaded", timeout=90000)
        result["status"]=r.status if r else None
        await page.wait_for_timeout(5000)
        html=await page.content()
        for t in TERMS:
            c=contexts(html,t,800,20)
            if c: result["html_matches"][t]=c
        scripts=await page.locator("script[src]").evaluate_all("els=>els.map(e=>e.src)")
        # also resource entries loaded as JS
        res=await page.evaluate("()=>performance.getEntriesByType('resource').filter(x=>x.initiatorType==='script'||/\\.js(?:$|\\?)/.test(x.name)).map(x=>x.name)")
        urls=[]
        for u in scripts+res:
            if u and u not in urls: urls.append(u)
        result["script_count"]=len(urls)
        for idx,u in enumerate(urls):
            rec={"url":u}
            try:
                resp=await ctx.request.get(u, timeout=60000)
                rec["status"]=resp.status
                txt=await resp.text()
                rec["bytes"]=len(txt)
                local=[]
                for t in TERMS:
                    cc=contexts(txt,t,1800,12)
                    for x in cc:
                        # extract nearby obvious persisted query IDs/names
                        ids=sorted(set(re.findall(r'(?<!\d)\d{10,20}(?!\d)',x)))
                        names=sorted(set(re.findall(r'[A-Za-z0-9_]*(?:Liker|Like)[A-Za-z0-9_]*(?:Query|query|Connection|connection)?',x)))[:60]
                        local.append({"term":t,"context":x,"ids":ids[:30],"names":names})
                if local:
                    rec["matches"]=local
                    result["matches"].append(rec)
                elif idx<10:
                    result["scripts"].append({k:rec[k] for k in rec})
            except Exception as e:
                rec["error"]=repr(e)
                if idx<20: result["scripts"].append(rec)
        # capture tokens/bootloader IDs useful to reproduce requests
        result["cookies"]=await ctx.cookies()
        result["lsd"] = await page.evaluate("""()=>{
          const m=document.documentElement.innerHTML.match(/\\\"LSD\\\"[^]{0,500}?\\\"token\\\":\\\"([^\\\"]+)/); return m?m[1]:null;
        }""")
        await ctx.close(); await browser.close()
    (OUT/"graphql_discovery.json").write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding="utf-8")
    print(json.dumps({"status":result.get("status"),"script_count":result.get("script_count"),"match_files":len(result.get("matches",[])),"match_urls":[x.get("url") for x in result.get("matches",[])[:20]]},ensure_ascii=False,indent=2))

if __name__=="__main__":
    asyncio.run(main())
