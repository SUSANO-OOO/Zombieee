import assert from "node:assert/strict";
import { V100_CREDITS_SONG, v100StaffRollResumeSeconds } from "../app/v100StaffRoll.js";
import { V100_CREDITS_FILM } from "../app/v100CreditsFilm.js";
import { v100StoryEventView } from "../app/v100StoryEvents.js";

export function staffRollFilmBuffersReady() {
  const movie = document.querySelector(".v100-staff-roll .v100-credit-landscape");
  const images = [...(movie?.querySelectorAll(".v100-credit-shot") ?? [])];
  return images.length === 2 && images.every(image => image.getAttribute("src")
    && image.complete && image.naturalWidth > 0 && image.dataset.creditDecoded === "true");
}

export function staffRollFilmLayoutReady({ picture, roll, viewport, cinema } = {}) {
  if (!cinema || !viewport || !Number.isFinite(viewport.width) || !Number.isFinite(viewport.height)
    || viewport.width <= 0 || viewport.height <= 0) return false;
  const fits = rect => rect && ["left", "top", "right", "bottom", "width", "height"].every(key => Number.isFinite(rect[key]))
    && rect.width > 0 && rect.height > 0 && rect.left >= 0 && rect.top >= 0
    && rect.right <= viewport.width && rect.bottom <= viewport.height
    && Math.abs(rect.right - rect.left - rect.width) <= .1
    && Math.abs(rect.bottom - rect.top - rect.height) <= .1;
  if (!fits(picture) || !fits(roll)) return false;
  // The complete image occupies the space LEFT of the credits. Requiring it
  // to cover the entire viewport would restore the face/text overlap.
  return picture.left <= 1 && picture.top <= 1 && picture.bottom >= viewport.height - 1
    && Math.abs(roll.left - picture.right - 12) <= .1
    && roll.width <= viewport.width * .34 && roll.left >= viewport.width * .64;
}

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
    // The fixture jumps ahead much faster than the film. A decoded displayed
    // shot can still have a pending hidden preload; replacing it at this point
    // cancels that request. Wait for both actual decodes before seeking, while
    // retaining the existing strict request-failure gate and decode deadline.
    await page.waitForFunction(staffRollFilmBuffersReady, undefined, { timeout: 15000 });
    const point = (v100StaffRollResumeSeconds(index, 11) + .1) / V100_CREDITS_SONG.duration;
    await page.waitForFunction(target => { const a = document.querySelector(".v100-staff-roll audio"); return a.buffered.length > 0 && a.buffered.end(a.buffered.length - 1) > a.duration * target; }, point, { timeout: 20000 });
    const probe = await surface.locator("audio").evaluate((audio, target) => { const before = { time: audio.currentTime, duration: audio.duration, seekable: [...Array(audio.seekable.length)].map((_, i) => [audio.seekable.start(i), audio.seekable.end(i)]) }; audio.currentTime = audio.duration * target; return { before, target: audio.duration * target, after: audio.currentTime }; }, point);
    assert.ok(Math.abs(probe.after - probe.target) < .1, JSON.stringify(probe));
  }
  try { await page.locator(`.v100-staff-roll[data-v100-node-index="${index}"]`).waitFor({ state: "visible", timeout: 15000 }); }
  catch (error) { const probe = await surface.evaluate(root => { const a = root.querySelector("audio"); return { index: root.dataset.v100NodeIndex, progress: root.dataset.v100CreditProgress, state: root.dataset.v100CreditAudio, time: a.currentTime, duration: a.duration, paused: a.paused, seeking: a.seeking, readyState: a.readyState, networkState: a.networkState, buffered: [...Array(a.buffered.length)].map((_, i) => [a.buffered.start(i), a.buffered.end(i)]), error: a.error?.code }; }); throw new Error(`${error}\n${JSON.stringify(probe)}`); }
  await page.waitForFunction(() => {
    const root = document.querySelector(".v100-staff-roll"), movie = root?.querySelector(".v100-credit-landscape");
    const image = movie?.querySelector(".v100-credit-shot:not(.v100-credit-shot-next)");
    return image?.dataset.creditDecoded === "true" && movie?.dataset.creditRenderedShotIndex === root?.dataset.v100CreditShotIndex;
  }, undefined, { timeout: 15000 });
  const observed = await surface.evaluate(element => {
    const audio = element.querySelector("audio"), movie = element.querySelector(".v100-credit-landscape");
    const image = movie.querySelector(".v100-credit-shot:not(.v100-credit-shot-next)");
    const picture = movie.getBoundingClientRect(), roll = element.querySelector(".v100-credit-roll-window").getBoundingClientRect();
    return { index: Number(element.getAttribute("data-v100-node-index")), scene: element.getAttribute("data-v100-credit-scene"),
      owner: element.getAttribute("data-v100-audio-owner"), credits: element.textContent,
      shotIndex: Number(element.dataset.v100CreditShotIndex), shotId: element.dataset.v100CreditShot,
      description: movie.getAttribute("aria-label"), captionCount: element.querySelectorAll(".v100-credit-memory, .v100-credit-brand").length,
      imageSizing: getComputedStyle(image).objectFit,
      background: image.currentSrc,
      imageDecoded: image.complete && image.naturalWidth > 0,
      audio: { src: audio.currentSrc, currentTime: audio.currentTime, duration: audio.duration, paused: audio.paused, loop: audio.loop, volume: audio.volume, gain: window.__endingOutputGain?.(audio) ?? audio.volume, readyState: audio.readyState },
      audioElements: document.querySelectorAll(".v100-staff-roll audio").length,
      pictureFits: picture.top >= 0 && picture.left >= 0 && picture.bottom <= innerHeight && picture.right <= innerWidth,
      filmLayout: { cinema: movie.classList.contains("v100-credit-cinema"), viewport: { width: innerWidth, height: innerHeight },
        picture: { left: picture.left, top: picture.top, right: picture.right, bottom: picture.bottom, width: picture.width, height: picture.height },
        roll: { left: roll.left, top: roll.top, right: roll.right, bottom: roll.bottom, width: roll.width, height: roll.height } },
      rollFits: roll.top >= 0 && roll.left >= 0 && roll.bottom <= innerHeight && roll.right <= innerWidth,
      rollLeavesMainFilmVisible: roll.width <= innerWidth * .34 && roll.left >= innerWidth * .64,
      readingFont: Number.parseFloat(getComputedStyle(element.querySelector(".v100-credit-roll-track p")).fontSize),
      controlPanel: (() => { const rect = element.querySelector(".v100-credit-controls").getBoundingClientRect(); return { width: rect.width, height: rect.height }; })(),
      controls: [...element.querySelectorAll(".v100-credit-buttons button")].map(button => { const rect = button.getBoundingClientRect(); const hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2); return { text: button.textContent, width: rect.width, height: rect.height, fits: rect.top >= 0 && rect.left >= 0 && rect.bottom <= innerHeight && rect.right <= innerWidth, reachable: hit === button || button.contains(hit) }; }),
      overflow: Math.max(document.body.scrollWidth - innerWidth, document.documentElement.scrollWidth - innerWidth),
      mixer: window.__V100_EVENT_AUDIO_QA__?.getSnapshot?.()?.diagnostics ?? null,
    };
  });
  const node = v100StoryEventView("v100:event:credits", playerName).nodes[index];
  assert.equal(observed.scene, node.sceneLabel);
  const shot = V100_CREDITS_FILM[observed.shotIndex];
  assert.equal(shot.sceneIndex, index); assert.equal(observed.shotId, shot.id);
  assert.equal(observed.description, shot.description);
  assert.ok(observed.background.includes(shot.src));
  assert.equal(observed.captionCount, 0);
  assert.equal(observed.imageSizing, "contain");
  assert.equal(observed.imageDecoded, true);
  assert.equal(observed.owner, "v100-staff-roll");
  assert.equal(observed.audioElements, 1); assert.equal(observed.audio.loop, false);
  assert.ok(observed.audio.src.endsWith(V100_CREDITS_SONG.src));
  // Chromium estimates this headerless CBR MP3 from byte rate (315.4968s);
  // encoded MPEG frames total 315.7682s. The 106s edit fades this original;
  // decoder metadata must not extend the film or change its saved cursor.
  assert.ok(Math.abs(observed.audio.duration - V100_CREDITS_SONG.duration) < .5, JSON.stringify(observed.audio));
  assert.equal(observed.audio.paused, false); assert.ok(observed.audio.currentTime > 0);
  observed.cinemaUsesAvailableFrame = staffRollFilmLayoutReady(observed.filmLayout);
  assert.equal(observed.pictureFits, true); assert.equal(observed.cinemaUsesAvailableFrame, true, JSON.stringify(observed.filmLayout));
  assert.equal(observed.rollFits, true); assert.equal(observed.rollLeavesMainFilmVisible, true);
  assert.ok(observed.readingFont >= 14);
  assert.equal(observed.controls.length, 2);
  assert.ok(observed.controls.every(button => button.width >= 44 && button.height >= 44 && button.fits && button.reachable), JSON.stringify(observed.controls));
  assert.ok(observed.controlPanel.width <= 164 && observed.controlPanel.height === 44, JSON.stringify(observed.controlPanel));
  assert.ok(observed.controls.every(button => !["クレジット", "一時停止"].includes(button.text)));
  assert.ok(observed.overflow <= 1);
  assert.ok(observed.credits.includes("音楽：魔王魂") && observed.credits.includes("追憶の幻想世界"));
  assert.equal(observed.mixer?.activeBgmVoices ?? 0, 0, "another BGM overlaps the staff roll");
  return observed;
}

export async function completeStaffRollByFilmEnd(page) {
  const root = page.locator(".v100-staff-roll");
  for (let attempt = 0; attempt < 3 && await root.getAttribute("data-v100-credit-speed") !== "4"; attempt++)
    await root.getByRole("button", { name: /映像と文字の速さ/u }).click();
  assert.equal(await root.locator("audio").evaluate(audio => audio.playbackRate), 1);
  await page.locator('[data-v100-surface="map"]').waitFor({ state: "visible", timeout: 40000 });
}
