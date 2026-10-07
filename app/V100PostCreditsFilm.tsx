"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { V100CreditsFilmView, type V100VisualFrame } from "./V100EndingRoll";
import { V100_POST_CREDITS_AUDIO, V100_POST_CREDITS_DURATION, V100_POST_CREDITS_LAUGH_CUE, V100_POST_CREDITS_SHOTS, V100_POST_CREDITS_TITLES, v100PostCreditsFrame } from "./v100PostCreditsData.js";
import "./v100PostCreditsFilm.css";

type Settings = { bgmEnabled?: boolean; bgmVolume?: number; sfxEnabled?: boolean; sfxVolume?: number; reducedMotion?: boolean };
type Props = { settings: Settings; blocked?: boolean; busy?: boolean; onComplete: () => boolean | Promise<boolean> };
export function V100PostCreditsFilm({ settings, blocked = false, busy = false, onComplete }: Props) {
  const stageRef = useRef<HTMLElement>(null), imageRef = useRef<HTMLDivElement>(null), titleRef = useRef<HTMLDivElement>(null);
  const musicRef = useRef<HTMLAudioElement>(null), wavesRef = useRef<HTMLAudioElement>(null), laughRef = useRef<HTMLAudioElement>(null);
  const laughStartedRef = useRef(false), laughFinishedRef = useRef(false), laughAttemptRef = useRef(0);
  const paintRef = useRef<((frame: V100VisualFrame) => void) | null>(null);
  const secondsRef = useRef(0), pausedRef = useRef(false), blockedRef = useRef(blocked), hiddenRef = useRef(false);
  const readyRef = useRef(false), completeRef = useRef(false), completingRef = useRef(false), attemptRef = useRef(0);
  const audioStateRef = useRef("loading"), startupAtRef = useRef(0), mountedRef = useRef(false);
  const configRef = useRef({ settings, busy, onComplete });
  const [initialFrame] = useState(() => v100PostCreditsFrame(0));
  const [frame, setFrame] = useState(initialFrame), [paused, setPaused] = useState(false);
  const [audioState, setAudioState] = useState("loading"), [done, setDone] = useState(false);
  const [laughState, setLaughState] = useState("pending");
  const updateAudioState = useCallback((state: string) => { audioStateRef.current = state; setAudioState(state); }, []);
  const reducedMediaRef = useRef<MediaQueryList | null>(null);
  useLayoutEffect(() => { configRef.current = { settings, busy, onComplete }; blockedRef.current = blocked; }, [settings, busy, onComplete, blocked]);
  useLayoutEffect(() => {
    const media = [musicRef.current, wavesRef.current, laughRef.current];
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      attemptRef.current += 1;
      laughAttemptRef.current += 1;
      // Passive cleanup runs after React has cleared these refs. Keep the
      // original elements so detached music, waves and voice all stop.
      for (const audio of media) audio?.pause();
    };
  }, []);
  const pauseAudio = useCallback(() => { attemptRef.current += 1; laughAttemptRef.current += 1; musicRef.current?.pause(); wavesRef.current?.pause(); laughRef.current?.pause(); }, []);
  const playLaugh = useCallback(async () => {
    const audio = laughRef.current, current = configRef.current.settings;
    if (!mountedRef.current || !audio || !laughStartedRef.current || laughFinishedRef.current || completeRef.current || pausedRef.current || blockedRef.current || hiddenRef.current) return;
    if (secondsRef.current >= 38) { laughFinishedRef.current = true; audio.pause(); setLaughState("skipped"); return; }
    if (current.sfxEnabled === false || (current.sfxVolume ?? .9) <= 0) { audio.pause(); setLaughState("muted"); return; }
    const token = ++laughAttemptRef.current;
    audio.playbackRate = 1;
    audio.volume = (current.sfxVolume ?? .9) * .82 * v100PostCreditsFrame(secondsRef.current).laughGain;
    try {
      // Preserve its native cursor across a pause, lock or menu. Never seek
      // back to the start of the one-shot laugh on a resume.
      await audio.play();
      if (!mountedRef.current || laughRef.current !== audio || pausedRef.current || blockedRef.current || hiddenRef.current || completeRef.current || laughFinishedRef.current || configRef.current.settings.sfxEnabled === false || (configRef.current.settings.sfxVolume ?? .9) <= 0) { audio.pause(); return; }
      if (token !== laughAttemptRef.current) return;
      setLaughState("playing");
    } catch (error) {
      if (!mountedRef.current || token !== laughAttemptRef.current) return;
      audio.pause();
      const gesture = error instanceof DOMException && error.name === "NotAllowedError";
      if (!gesture) laughFinishedRef.current = true;
      setLaughState(gesture ? "gesture" : "unavailable");
    }
  }, []);
  const play = useCallback(async () => {
    if (!mountedRef.current || completeRef.current || pausedRef.current || blockedRef.current || hiddenRef.current) return;
    const token = ++attemptRef.current, current = configRef.current.settings;
    startupAtRef.current = performance.now();
    if (!readyRef.current) updateAudioState("loading");
    const volumeFrame = v100PostCreditsFrame(secondsRef.current);
    const pairs = [[musicRef.current, current.bgmEnabled !== false && (current.bgmVolume ?? .8) > 0], [wavesRef.current, current.sfxEnabled !== false && (current.sfxVolume ?? .9) > 0]] as const;
    let gesture = false, unavailable = false;
    const results = await Promise.allSettled(pairs.map(async ([audio, enabled]) => {
      if (!audio || !enabled) { audio?.pause(); return; }
      audio.playbackRate = 1;
      audio.volume = audio === musicRef.current ? (current.bgmVolume ?? .8) * .55 * volumeFrame.musicGain : (current.sfxVolume ?? .9) * .5 * volumeFrame.wavesGain;
      if (audio.readyState > 0 && Math.abs(audio.currentTime - secondsRef.current) > .75) audio.currentTime = Math.min(audio.duration || V100_POST_CREDITS_DURATION, secondsRef.current);
      try {
        await audio.play();
        const latest = configRef.current.settings;
        const stillEnabled = audio === musicRef.current ? latest.bgmEnabled !== false && (latest.bgmVolume ?? .8) > 0 : latest.sfxEnabled !== false && (latest.sfxVolume ?? .9) > 0;
        if (!mountedRef.current || ![musicRef.current, wavesRef.current].includes(audio) || !stillEnabled || pausedRef.current || blockedRef.current || hiddenRef.current || completeRef.current) audio.pause();
      }
      catch (error) { if (error instanceof DOMException && error.name === "NotAllowedError") gesture = true; else unavailable = true; }
    }));
    if (!mountedRef.current) { for (const [audio] of pairs) audio?.pause(); return; }
    if (token !== attemptRef.current) return;
    if (pausedRef.current || blockedRef.current || hiddenRef.current || completeRef.current) { pauseAudio(); return; }
    if (results.some(result => result.status === "rejected")) unavailable = true;
    if (gesture) { pauseAudio(); readyRef.current = false; updateAudioState("gesture"); return; }
    readyRef.current = true;
    updateAudioState(unavailable ? "unavailable" : pairs.some(([, enabled]) => enabled) ? "playing" : "muted");
    void playLaugh();
  }, [pauseAudio, updateAudioState, playLaugh]);
  const finish = useCallback(async () => {
    if (completingRef.current || configRef.current.busy) return;
    completeRef.current = true; readyRef.current = false; pauseAudio(); setDone(true);
    completingRef.current = true;
    try { await configRef.current.onComplete(); }
    catch { /* Keep the final thank-you and retry button after a save failure. */ }
    finally { completingRef.current = false; }
  }, [pauseAudio]);
  useEffect(() => {
    const media = [musicRef.current, wavesRef.current, laughRef.current];
    const rotation = window.matchMedia("(orientation: portrait) and (max-width: 800px)");
    reducedMediaRef.current = window.matchMedia("(prefers-reduced-motion: reduce)");
    let pageHidden = false;
    hiddenRef.current = document.hidden || rotation.matches;
    const visibility = () => { hiddenRef.current = pageHidden || document.hidden || rotation.matches; if (hiddenRef.current) pauseAudio(); else void play(); };
    const pageHide = () => { pageHidden = true; visibility(); };
    const pageShow = () => { pageHidden = false; visibility(); };
    document.addEventListener("visibilitychange", visibility); window.addEventListener("pagehide", pageHide); window.addEventListener("pageshow", pageShow); rotation.addEventListener("change", visibility);
    let animation = 0, lastAt = performance.now(), lastPaint = -Infinity;
    const tick = (at: number) => {
      const delta = Math.max(0, Math.min(.25, (at - lastAt) / 1000)); lastAt = at;
      if (!hiddenRef.current && !pausedRef.current && !blockedRef.current && !readyRef.current && audioStateRef.current === "loading" && at - startupAtRef.current > 8000) { pauseAudio(); readyRef.current = true; updateAudioState("unavailable"); }
      if (!hiddenRef.current && !pausedRef.current && !blockedRef.current && !completeRef.current && readyRef.current) {
        secondsRef.current = Math.min(V100_POST_CREDITS_DURATION, secondsRef.current + delta);
        const next = v100PostCreditsFrame(secondsRef.current, configRef.current.settings.reducedMotion || reducedMediaRef.current?.matches);
        paintRef.current?.(next);
        const current = configRef.current.settings;
        if (musicRef.current) musicRef.current.volume = (current.bgmEnabled === false ? 0 : (current.bgmVolume ?? .8) * .55) * next.musicGain;
        if (wavesRef.current) wavesRef.current.volume = (current.sfxEnabled === false ? 0 : (current.sfxVolume ?? .9) * .5) * next.wavesGain;
        if (laughRef.current) laughRef.current.volume = (current.sfxEnabled === false ? 0 : (current.sfxVolume ?? .9) * .82) * next.laughGain;
        const displayed = imageRef.current?.querySelector<HTMLElement>("[data-credit-rendered-shot-index]");
        const displayedShot = V100_POST_CREDITS_SHOTS[Number(displayed?.dataset.creditRenderedShotIndex)];
        const smiling = displayedShot && ["crooked-smile", "ogata-grin"].includes(displayedShot.id);
        if (!laughStartedRef.current && next.elapsed >= V100_POST_CREDITS_LAUGH_CUE && next.elapsed < 38 && smiling) { laughStartedRef.current = true; void playLaugh(); }
        if (laughStartedRef.current && !laughFinishedRef.current && next.elapsed >= 38) { laughFinishedRef.current = true; laughRef.current?.pause(); setLaughState("skipped"); }
        if (imageRef.current) { imageRef.current.style.opacity = String(next.imageOpacity); imageRef.current.style.transform = `scale(${next.scale})`; imageRef.current.style.transformOrigin = next.focus; imageRef.current.style.filter = `brightness(${next.brightness})`; }
        if (titleRef.current) titleRef.current.style.opacity = String(next.titleOpacity);
        if (stageRef.current) stageRef.current.dataset.v100FilmElapsed = next.elapsed.toFixed(3);
        if (at - lastPaint >= 80) { setFrame(next); lastPaint = at; }
        if (next.ended) void finish();
      }
      animation = requestAnimationFrame(tick);
    };
    animation = requestAnimationFrame(tick); void play();
    return () => { cancelAnimationFrame(animation); document.removeEventListener("visibilitychange", visibility); window.removeEventListener("pagehide", pageHide); window.removeEventListener("pageshow", pageShow); rotation.removeEventListener("change", visibility); pauseAudio(); for (const audio of media) audio?.pause(); };
  }, [play, playLaugh, pauseAudio, finish, updateAudioState]);
  useEffect(() => { if (blocked || paused) pauseAudio(); else void play(); }, [blocked, paused, settings.bgmEnabled, settings.bgmVolume, settings.sfxEnabled, settings.sfxVolume, play, pauseAudio]);
  const togglePause = () => { const next = !pausedRef.current; pausedRef.current = next; setPaused(next); if (next) pauseAudio(); else void play(); };
  const skip = () => { laughFinishedRef.current = true; laughAttemptRef.current += 1; laughRef.current?.pause(); setLaughState("skipped"); secondsRef.current = 56.5; pausedRef.current = false; setPaused(false); readyRef.current = true; setFrame(v100PostCreditsFrame(56.5)); };
  return <section ref={stageRef} className={`v100-post-credits-film ${done ? "v100-post-credits-done" : ""}`} aria-label="クレジット後の映像" data-v100-surface="epilogue" data-v100-event-id="v100:event:epilogue" data-v100-audio-owner="v100-post-credits-film" data-v100-film-shot={V100_POST_CREDITS_SHOTS[frame.shotIndex].id} data-v100-film-title={frame.text ?? ""} data-v100-film-audio={audioState} data-v100-laugh-state={laughState}>
    <audio ref={musicRef} src={V100_POST_CREDITS_AUDIO.music} preload="metadata" crossOrigin="anonymous" />
    <audio ref={wavesRef} src={V100_POST_CREDITS_AUDIO.waves} preload="metadata" crossOrigin="anonymous" />
    <audio ref={laughRef} src={V100_POST_CREDITS_AUDIO.laugh} preload="auto" crossOrigin="anonymous" onPlaying={event => { if (pausedRef.current || blockedRef.current || hiddenRef.current || completeRef.current || laughFinishedRef.current || configRef.current.settings.sfxEnabled === false) event.currentTarget.pause(); }} onEnded={() => { laughFinishedRef.current = true; setLaughState("ended"); }} onError={event => { event.currentTarget.pause(); laughFinishedRef.current = true; setLaughState("unavailable"); }} />
    <div ref={imageRef} className="v100-post-credit-picture"><V100CreditsFilmView initialFrame={initialFrame} paintRef={paintRef} film={V100_POST_CREDITS_SHOTS} className="v100-post-credit-landscape" reducedMotion={settings.reducedMotion} /></div>
    <div className="v100-post-credit-vignette" aria-hidden="true" />
    <div ref={titleRef} className={`v100-post-credit-title v100-post-credit-title-${frame.text ?? "hidden"}`}>
      {frame.text === "continuation" && <h1>{V100_POST_CREDITS_TITLES.continuation}</h1>}
      {frame.text === "sequel" && <><h1>{V100_POST_CREDITS_TITLES.sequel}</h1><p>{V100_POST_CREDITS_TITLES.season}</p></>}
      {(frame.text === "thanks" || done) && <h1>{V100_POST_CREDITS_TITLES.thanks}</h1>}
    </div>
    <div className="v100-post-credit-controls">
      {audioState === "gesture" && <button type="button" className="v100-primary" onClick={() => void play()}>音を再生して続ける</button>}
      {laughState === "gesture" && !done && <button type="button" onClick={() => void playLaugh()}>笑い声を再生</button>}
      {!done && <><button type="button" onClick={togglePause}>{paused ? "再開" : "一時停止"}</button><button type="button" onClick={skip}>スキップ</button></>}
      {done && <button type="button" disabled={busy} onClick={() => void finish()}>続ける</button>}
      {audioState === "unavailable" && <small role="status">音を読み込めませんでした。映像は続けて視聴できます。</small>}
    </div>
  </section>;
}
