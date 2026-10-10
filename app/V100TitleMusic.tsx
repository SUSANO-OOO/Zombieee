"use client";

import { useLayoutEffect, useRef } from "react";
import { createEndingAudioMix } from "./endingAudioMix.js";
import { LANDSCAPE_BLOCK_QUERY } from "./landscapePolicy.js";

// Born Of The Sky (Scott Buckley, CC-BY 4.0): the energetic drum/guitar
// section, normalized and crossfaded into an 86-second offline loop.
export const TITLE_MUSIC_SRC = "/audio/v100/score/opening.mp3";
type Settings = { bgmEnabled: boolean; bgmVolume: number };

export function V100TitleMusic({ settings, voiceActive }: { settings: Settings; voiceActive: boolean }) {
  const musicEnabled = settings.bgmEnabled && settings.bgmVolume > 0;
  const audioRef = useRef<HTMLAudioElement>(null);
  const stateRef = useRef({ settings, voiceActive });
  const refreshRef = useRef<(() => void) | null>(null);
  useLayoutEffect(() => {
    stateRef.current = { settings, voiceActive };
    refreshRef.current?.();
  }, [settings, voiceActive]);

  useLayoutEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const portrait = window.matchMedia(LANDSCAPE_BLOCK_QUERY);
    let disposed = false, pageAway = false, pending = false, generation = 0;
    let frame = 0, lastFrame = 0, gain = 0;
    const allowed = () => !disposed && !pageAway && !document.hidden && !portrait.matches
      && stateRef.current.settings.bgmEnabled && stateRef.current.settings.bgmVolume > 0;
    const mix = createEndingAudioMix([audio], {
      canPlay: allowed,
      onRecoveryState: (state: string) => {
        if (!allowed()) return;
        if (state !== "running") {
          cancelAnimationFrame(frame);
          frame = 0; lastFrame = 0;
        }
        audio.dataset.titleMusicState = state === "gesture" ? "waiting" : state === "running" ? "playing" : state;
        if (state === "running" && !audio.paused && !frame) {
          lastFrame = 0;
          frame = requestAnimationFrame(animate);
        }
      },
    });
    const targetGain = () => stateRef.current.settings.bgmVolume * .42 * (stateRef.current.voiceActive ? .18 : 1);
    const silence = () => {
      generation++;
      cancelAnimationFrame(frame);
      frame = 0; lastFrame = 0; gain = 0;
      mix.setVolume(audio, 0);
      audio.pause();
      audio.dataset.titleMusicGain = "0.00000";
      audio.dataset.titleMusicState = "paused";
    };
    const animate = (now: number) => {
      if (!allowed() || audio.paused) { silence(); return; }
      const seconds = lastFrame ? Math.min(.1, (now - lastFrame) / 1000) : 0;
      lastFrame = now;
      const target = targetGain();
      // Fade in gently; duck promptly when the spoken title needs the space.
      gain += (target - gain) * Math.min(1, seconds / (target < gain ? .12 : .6));
      mix.setVolume(audio, gain);
      audio.dataset.titleMusicGain = gain.toFixed(5);
      frame = requestAnimationFrame(animate);
    };
    const request = () => {
      if (!allowed()) { silence(); return; }
      if (pending || (!audio.paused && !mix.needsRecovery(audio))) return;
      // Attach once, only when enabled. Muting later retains the native cursor.
      if (!audio.getAttribute("src")) audio.src = TITLE_MUSIC_SRC;
      pending = true;
      const token = ++generation;
      mix.setVolume(audio, 0);
      audio.dataset.titleMusicState = "starting";
      void mix.play(audio).then(() => {
        pending = false;
        if (disposed) return;
        if (token !== generation || !allowed()) {
          silence();
          if (allowed()) request();
          return;
        }
        audio.dataset.titleMusicState = "playing";
        lastFrame = 0;
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(animate);
      }).catch(() => {
        pending = false;
        if (disposed) return;
        silence();
        if (allowed()) audio.dataset.titleMusicState = "waiting";
      });
    };
    const hide = () => { pageAway = true; silence(); };
    const show = () => { pageAway = false; request(); };
    const visibility = () => { if (document.hidden) silence(); else request(); };
    // A normal touch can unlock mobile autoplay. Leaving the title during that
    // touch still disposes this exact owner before its promise can complete.
    refreshRef.current = request;
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("pagehide", hide);
    window.addEventListener("pageshow", show);
    portrait.addEventListener("change", request);
    window.addEventListener("pointerdown", request);
    window.addEventListener("keydown", request);
    request();
    return () => {
      disposed = true;
      refreshRef.current = null;
      silence();
      mix.dispose();
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("pagehide", hide);
      window.removeEventListener("pageshow", show);
      portrait.removeEventListener("change", request);
      window.removeEventListener("pointerdown", request);
      window.removeEventListener("keydown", request);
    };
  }, []);
  return <audio ref={audioRef} loop preload={musicEnabled ? "auto" : "none"} data-title-music="true" />;
}
