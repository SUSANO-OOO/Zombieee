import asyncio
import json
import re
from pathlib import Path
from urllib.parse import urlparse

from playwright.async_api import async_playwright

TARGET = "https://www.threads.com/@uwachan2026/post/DbwZjCnE08w"
OUT = Path("tmp_threads_audit")
OUT.mkdir(exist_ok=True)

network = []
users = {}


def walk(obj):
    if isinstance(obj, dict):
        username = obj.get("username")
        if isinstance(username, str) and username:
            uid = obj.get("pk") or obj.get("id") or obj.get("user_id")
            if uid is not None or any(k in obj for k in ("profile_pic_url", "full_name", "is_verified", "is_private")):
                key = str(uid) if uid is not None else username.lower()
                if key not in users:
                    users[key] = {
                        k: obj.get(k)
                        for k in (
                            "pk", "id", "user_id", "username", "full_name", "profile_pic_url",
                            "is_verified", "is_private", "follower_count", "following_count",
                            "biography", "bio", "text_post_app_is_private"
                        ) if k in obj
                    }
        for v in obj.values():
            walk(v)
    elif isinstance(obj, list):
        for v in obj:
            walk(v)


async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True, args=["--disable-blink-features=AutomationControlled"])
        context = await browser.new_context(
            locale="en-US",
            timezone_id="Asia/Tokyo",
            viewport={"width": 1440, "height": 1000},
            user_agent=(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/150.0.0.0 Safari/537.36"
            ),
        )
        page = await context.new_page()
        pending = set()

        async def handle_response(resp):
            u = resp.url
            if "graphql" not in u and "api/" not in u:
                return
            entry = {"url": u, "status": resp.status, "method": resp.request.method}
            try:
                pd = resp.request.post_data
                if pd:
                    entry["post_data"] = pd[:8000]
            except Exception:
                pass
            try:
                ctype = (await resp.all_headers()).get("content-type", "")
                if "json" in ctype or "graphql" in u:
                    data = await resp.json()
                    walk(data)
                    raw = json.dumps(data, ensure_ascii=False)
                    entry["json_preview"] = raw[:30000]
            except Exception as e:
                entry["json_error"] = repr(e)
            network.append(entry)

        def on_response(resp):
            task = asyncio.create_task(handle_response(resp))
            pending.add(task)
            task.add_done_callback(lambda t: pending.discard(t))

        page.on("response", on_response)

        result = {"target": TARGET}
        try:
            r = await page.goto(TARGET, wait_until="domcontentloaded", timeout=90000)
            result["goto_status"] = r.status if r else None
            await page.wait_for_timeout(8000)
            result["final_url"] = page.url
            result["title"] = await page.title()
            result["body_before"] = (await page.locator("body").inner_text())[:120000]
            await page.screenshot(path=str(OUT / "before.png"), full_page=True)

            elements = await page.locator("a,button,[role=button]").evaluate_all("""
                els => els.map((e, i) => ({
                    i,
                    tag: e.tagName,
                    text: (e.innerText || e.textContent || '').trim().slice(0, 300),
                    aria: e.getAttribute('aria-label'),
                    title: e.getAttribute('title'),
                    href: e.getAttribute('href')
                })).filter(x => x.text || x.aria || x.title || x.href)
            """)
            result["controls_before"] = elements[:3000]

            candidates = []
            for e in elements:
                s = " ".join(str(e.get(k) or "") for k in ("text", "aria", "title", "href"))
                if re.search(r"\blikes?\b", s, re.I) or re.search(r"\b\d+(?:\.\d+)?\s*[KM]?\b", s, re.I):
                    candidates.append(e)
            result["like_candidates"] = candidates[:200]

            clicked = None
            # Prefer explicit Likes/like controls.
            for e in candidates:
                s = " ".join(str(e.get(k) or "") for k in ("text", "aria", "title"))
                if re.search(r"\blikes?\b", s, re.I):
                    loc = page.locator("a,button,[role=button]").nth(e["i"])
                    try:
                        await loc.click(timeout=5000)
                        clicked = e
                        break
                    except Exception:
                        continue
            result["clicked"] = clicked
            await page.wait_for_timeout(5000)

            result["body_after_click"] = (await page.locator("body").inner_text())[:160000]
            await page.screenshot(path=str(OUT / "after_click.png"), full_page=True)

            # Scroll the most likely dialog/list container to generate pagination requests.
            for _ in range(40):
                await page.evaluate("""
                    () => {
                      const all = [...document.querySelectorAll('*')];
                      const scrollables = all.filter(e => {
                        const s = getComputedStyle(e);
                        return /(auto|scroll)/.test(s.overflowY) && e.scrollHeight > e.clientHeight + 100;
                      }).sort((a,b) => (b.scrollHeight-b.clientHeight)-(a.scrollHeight-a.clientHeight));
                      const el = document.querySelector('[role=dialog]') || scrollables[0] || document.scrollingElement;
                      if (el) el.scrollTop = el.scrollHeight;
                    }
                """)
                await page.wait_for_timeout(750)

            result["body_after_scroll"] = (await page.locator("body").inner_text())[:200000]
            result["dialogs"] = await page.locator("[role=dialog]").count()
            await page.screenshot(path=str(OUT / "after_scroll.png"), full_page=True)
        except Exception as e:
            result["fatal_error"] = repr(e)
        finally:
            if pending:
                await asyncio.gather(*list(pending), return_exceptions=True)
            result["network_count"] = len(network)
            result["users_found"] = len(users)
            (OUT / "probe.json").write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
            (OUT / "network.json").write_text(json.dumps(network, ensure_ascii=False, indent=2), encoding="utf-8")
            (OUT / "users_probe.json").write_text(json.dumps(list(users.values()), ensure_ascii=False, indent=2), encoding="utf-8")
            await context.close()
            await browser.close()


if __name__ == "__main__":
    asyncio.run(main())
