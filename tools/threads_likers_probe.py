import asyncio
import json
import re
from pathlib import Path

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
                merged = users.setdefault(key, {})
                for k in (
                    "pk", "id", "user_id", "username", "full_name", "profile_pic_url",
                    "is_verified", "is_private", "follower_count", "following_count",
                    "biography", "bio", "text_post_app_is_private"
                ):
                    if k in obj and obj.get(k) is not None:
                        merged[k] = obj.get(k)
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
            req = resp.request
            rtype = req.resource_type
            if rtype in {"image", "font", "stylesheet", "media"}:
                return
            u = resp.url
            entry = {
                "url": u,
                "status": resp.status,
                "method": req.method,
                "resource_type": rtype,
            }
            try:
                pd = req.post_data
                if pd:
                    entry["post_data"] = pd[:30000]
            except Exception:
                pass
            try:
                headers = await resp.all_headers()
                ctype = headers.get("content-type", "")
                entry["content_type"] = ctype
                if "json" in ctype:
                    data = await resp.json()
                    walk(data)
                    entry["json_preview"] = json.dumps(data, ensure_ascii=False)[:100000]
                elif rtype in {"xhr", "fetch"} or "graphql" in u.lower():
                    txt = await resp.text()
                    entry["text_preview"] = txt[:100000]
                    try:
                        data = json.loads(txt)
                        walk(data)
                    except Exception:
                        pass
            except Exception as e:
                entry["body_error"] = repr(e)
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
            body = await page.locator("body").inner_text()
            result["body_before"] = body[:120000]
            await page.screenshot(path=str(OUT / "before.png"), full_page=True)

            html = await page.content()
            (OUT / "page_before.html").write_text(html, encoding="utf-8")
            result["html_terms"] = {
                term: [m.start() for m in re.finditer(term, html, re.I)][:20]
                for term in ["likers", "like_count", "graphql", "doc_id", "Barcelona", "xdt", "44.9K"]
            }

            # Inspect every exact metric-looking button/div, including ancestor structure.
            metrics = await page.locator("[role=button]").evaluate_all("""
                els => els.map((e, i) => {
                    const txt = (e.innerText || e.textContent || '').trim();
                    const rect = e.getBoundingClientRect();
                    return {
                        i,
                        text: txt.slice(0, 200),
                        role: e.getAttribute('role'),
                        aria: e.getAttribute('aria-label'),
                        tabindex: e.getAttribute('tabindex'),
                        cls: e.className,
                        x: rect.x, y: rect.y, w: rect.width, h: rect.height,
                        outer: e.outerHTML.slice(0, 6000),
                        parent: e.parentElement ? e.parentElement.outerHTML.slice(0, 8000) : null,
                        grandparent: e.parentElement && e.parentElement.parentElement ? e.parentElement.parentElement.outerHTML.slice(0, 10000) : null
                    };
                }).filter(x => /^\\d+(?:\\.\\d+)?[KMB]?$/.test(x.text) || /likes?/i.test(x.text || '') || /likes?/i.test(x.aria || ''))
            """)
            result["metric_buttons"] = metrics[:500]

            # The main post's first metric button is its like count. Prefer a K-count near page top.
            metric_locator = page.locator("[role=button]").filter(has_text=re.compile(r"^\s*\d+(?:\.\d+)?K\s*$"))
            count = await metric_locator.count()
            result["k_metric_count"] = count
            click_diagnostics = []
            clicked = False
            # main post is at top, so choose the earliest visible K metric by Y position.
            candidates = []
            for i in range(min(count, 30)):
                loc = metric_locator.nth(i)
                try:
                    box = await loc.bounding_box()
                    txt = (await loc.inner_text()).strip()
                    if box:
                        candidates.append((box["y"], i, txt, box))
                except Exception as e:
                    click_diagnostics.append({"i": i, "error": repr(e)})
            candidates.sort(key=lambda x: x[0])
            result["k_metric_candidates"] = [
                {"y": y, "i": i, "text": txt, "box": box} for y, i, txt, box in candidates
            ]

            for y, i, txt, box in candidates:
                # Top-level 44.9K is the first K metric on the page; skip view count because it is in a link, not role=button.
                loc = metric_locator.nth(i)
                try:
                    before_dialogs = await page.locator("[role=dialog]").count()
                    await loc.click(timeout=7000)
                    await page.wait_for_timeout(3000)
                    after_dialogs = await page.locator("[role=dialog]").count()
                    click_diagnostics.append({"i": i, "text": txt, "y": y, "normal_click": True, "dialogs_before": before_dialogs, "dialogs_after": after_dialogs})
                    result["clicked_metric"] = {"i": i, "text": txt, "y": y, "method": "normal"}
                    clicked = True
                    break
                except Exception as e:
                    click_diagnostics.append({"i": i, "text": txt, "y": y, "normal_click_error": repr(e)})
                    try:
                        await loc.evaluate("e => e.click()")
                        await page.wait_for_timeout(3000)
                        result["clicked_metric"] = {"i": i, "text": txt, "y": y, "method": "js"}
                        clicked = True
                        break
                    except Exception as e2:
                        click_diagnostics[-1]["js_click_error"] = repr(e2)
            result["click_diagnostics"] = click_diagnostics
            result["clicked"] = clicked

            await page.wait_for_timeout(3000)
            result["body_after_click"] = (await page.locator("body").inner_text())[:200000]
            result["dialog_count_after_click"] = await page.locator("[role=dialog]").count()
            dialogs = await page.locator("[role=dialog]").evaluate_all("""
                els => els.map((e,i) => ({i, text:(e.innerText||e.textContent||'').trim().slice(0,50000), outer:e.outerHTML.slice(0,50000)}))
            """)
            result["dialogs_after_click"] = dialogs
            await page.screenshot(path=str(OUT / "after_click.png"), full_page=True)

            # Scroll all meaningful scrollable containers; this should generate liker pagination if a modal opened.
            last_user_count = -1
            stable_rounds = 0
            for round_no in range(100):
                scroll_info = await page.evaluate("""
                    () => {
                      const all = [...document.querySelectorAll('*')];
                      const scrollables = all.filter(e => {
                        const s = getComputedStyle(e);
                        return /(auto|scroll)/.test(s.overflowY) && e.scrollHeight > e.clientHeight + 20;
                      }).sort((a,b) => (b.scrollHeight-b.clientHeight)-(a.scrollHeight-a.clientHeight));
                      const touched = [];
                      for (const el of scrollables.slice(0,8)) {
                        touched.push({tag:el.tagName, role:el.getAttribute('role'), text:(el.innerText||'').slice(0,100), sh:el.scrollHeight,ch:el.clientHeight,old:el.scrollTop});
                        el.scrollTop = el.scrollHeight;
                      }
                      window.scrollTo(0, document.body.scrollHeight);
                      return touched;
                    }
                """)
                if round_no in {0,1,2,5,10,20,40,60,80,99}:
                    result.setdefault("scroll_samples", []).append({"round": round_no, "scrollables": scroll_info})
                await page.wait_for_timeout(600)
                if len(users) == last_user_count:
                    stable_rounds += 1
                else:
                    stable_rounds = 0
                    last_user_count = len(users)
                if stable_rounds >= 20 and round_no >= 25:
                    break

            result["body_after_scroll"] = (await page.locator("body").inner_text())[:250000]
            result["dialogs_final"] = await page.locator("[role=dialog]").count()
            result["performance_resources"] = await page.evaluate("""
                () => performance.getEntriesByType('resource').map(x => ({name:x.name, initiatorType:x.initiatorType, duration:x.duration, transferSize:x.transferSize})).slice(-3000)
            """)
            await page.screenshot(path=str(OUT / "after_scroll.png"), full_page=True)
            (OUT / "page_after.html").write_text(await page.content(), encoding="utf-8")
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
