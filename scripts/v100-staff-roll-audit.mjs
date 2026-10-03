import assert from "node:assert/strict";
import { V100_CREDITS_SONG } from "../app/v100StaffRoll.js";
import { V100_CREDITS_SCENES } from "../app/v100EventPresentation.js";
import { v100StoryEventView } from "../app/v100StoryEvents.js";

export async function inspectStaffRoll(page, { index = 0, playerName = "場面確認", seek = false } = {}) {
  const surface = page.locator(".v100-staff-roll");
  await surface.waitFor({ state: "visible", timeout: 15000 });
  await page.waitForFunction(() => ["playing", "gesture", "unavailable"].includes(document.querySelector(".v100-staff-roll")?.getAttribute("data-v100-credit-audio")), undefined, { timeout: 15000 });
  const start = page.getByRole("button", { name: "曲を再生して始める", exact: true });
  if (await start.isVisible().catch(() => false)) await start.click();
  await page.waitForFunction(() => {
    const audio = document.querySelector(".v100-staff-roll audio");
    return audio && audio.readyState >= 2 && !audio.paused && audio.currentTime > .03;
  }, undefined, { timeout: 15000 });
  if (seek) {
    const point = (index + .05) / 11;
    await page.waitForFunction(target => { const a = document.querySelector(".v100-staff-roll audio"); return a.buffered.length > 0 && a.buffered.end(a.buffered.length - 1) > a.duration * target; }, point, { timeout: 20000 });
    const probe = await surface.locator("audio").evaluate((audio, target) => { const before = { time: audio.currentTime, duration: audio.duration, seekable: [...Array(audio.seekable.length)].map((_, i) => [audio.seekable.start(i), audio.seekable.end(i)]) }; audio.currentTime = audio.duration * target; return { before, target: audio.duration * target, after: audio.currentTime }; }, point);
    assert.ok(Math.abs(probe.after - probe.target) < .1, JSON.stringify(probe));
  }
  try { await page.locator(`.v100-staff-roll[data-v100-node-index="${index}"]`).waitFor({ state: "visible", timeout: 15000 }); }
  catch (error) { const probe = await surface.evaluate(root => { const a = root.querySelector("audio"); return { index: root.dataset.v100NodeIndex, progress: root.dataset.v100CreditProgress, state: root.dataset.v100CreditAudio, time: a.currentTime, duration: a.duration, paused: a.paused, seeking: a.seeking, readyState: a.readyState, networkState: a.networkState, buffered: [...Array(a.buffered.length)].map((_, i) => [a.buffered.start(i), a.buffered.end(i)]), error: a.error?.code }; }); throw new Error(`${error}\n${JSON.stringify(probe)}`); }
  const observed = await surface.evaluate(element => {
    const audio = element.querySelector("audio"), memory = element.querySelector(".v100-credit-memory");
    const copy = memory?.getBoundingClientRect();
    return { index: Number(element.getAttribute("data-v100-node-index")), scene: element.getAttribute("data-v100-credit-scene"),
      owner: element.getAttribute("data-v100-audio-owner"), text: memory?.textContent, credits: element.textContent,
      background: getComputedStyle(element.querySelector(".v100-credit-shot")).backgroundImage,
      audio: { src: audio.currentSrc, currentTime: audio.currentTime, duration: audio.duration, paused: audio.paused, loop: audio.loop, volume: audio.volume, readyState: audio.readyState },
      audioElements: document.querySelectorAll(".v100-staff-roll audio").length,
      copyFits: copy && copy.top >= 0 && copy.left >= 0 && copy.bottom <= innerHeight && copy.right <= innerWidth,
      controls: [...element.querySelectorAll(".v100-credit-buttons button")].map(button => { const rect = button.getBoundingClientRect(); const hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2); return { text: button.textContent, height: rect.height, fits: rect.top >= 0 && rect.left >= 0 && rect.bottom <= innerHeight && rect.right <= innerWidth, reachable: hit === button || button.contains(hit) }; }),
      overflow: Math.max(document.body.scrollWidth - innerWidth, document.documentElement.scrollWidth - innerWidth),
      mixer: window.__V100_EVENT_AUDIO_QA__?.getSnapshot?.()?.diagnostics ?? null,
    };
  });
  const node = v100StoryEventView("v100:event:credits", playerName).nodes[index];
  assert.equal(observed.scene, node.sceneLabel);
  assert.ok(observed.text.includes(node.text));
  assert.ok(observed.background.includes(V100_CREDITS_SCENES[node.sceneLabel].backgroundPath));
  assert.equal(observed.owner, "v100-staff-roll");
  assert.equal(observed.audioElements, 1); assert.equal(observed.audio.loop, false);
  assert.ok(observed.audio.src.endsWith(V100_CREDITS_SONG.src));
  // Chromium estimates this headerless CBR MP3 from byte rate (315.4968s);
  // encoded MPEG frames total 315.7682s. Completion must use native ended.
  assert.ok(Math.abs(observed.audio.duration - V100_CREDITS_SONG.duration) < .5, JSON.stringify(observed.audio));
  assert.equal(observed.audio.paused, false); assert.ok(observed.audio.currentTime > 0);
  assert.equal(observed.copyFits, true);
  assert.ok(observed.controls.every(button => button.height >= 44 && button.fits && button.reachable), JSON.stringify(observed.controls));
  assert.ok(observed.overflow <= 1);
  assert.ok(observed.credits.includes("音楽：魔王魂") && observed.credits.includes("追憶の幻想世界"));
  assert.equal(observed.mixer?.activeBgmVoices ?? 0, 0, "another BGM overlaps the staff roll");
  return observed;
}

export async function completeStaffRollByNativeEnd(page) {
  await page.locator(".v100-staff-roll audio").evaluate(audio => { audio.currentTime = audio.duration - .08; });
  await page.locator('[data-v100-surface="epilogue"]').waitFor({ state: "visible", timeout: 15000 });
}
