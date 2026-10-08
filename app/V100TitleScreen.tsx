"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { RELEASE_VERSION } from "./releaseIdentity.js";
import { PRODUCTION_VISUALS } from "./productionVisuals.js";
import { createEndingAudioMix } from "./endingAudioMix.js";
import { V100_TITLE_VOICE, V100_TITLE_INTRO_END, v100TitleIntroFrame } from "./v100TitleIntro.js";
import "./v100TitleScreen.css";

type Props = {
  canContinue: boolean; canOpenModes: boolean; busy: boolean; reducedMotion: boolean;
  settings: { sfxEnabled: boolean; sfxVolume: number };
  onNew: () => void; onContinue: () => void; onSettings: () => void;
  onCredits: () => void; onModes: () => void; onData: () => void;
};

// Once per opened page; settings/credits do not repeat the title call.
let titleIntroSeen = false;
export function V100TitleScreen({ canContinue, canOpenModes, busy, reducedMotion, settings, onNew, onContinue, onSettings, onCredits, onModes, onData }: Props) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const mixerRef = useRef<ReturnType<typeof createEndingAudioMix> | null>(null);
  const rafRef = useRef(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(false);
  const doneRef = useRef(titleIntroSeen);
  const attemptRef = useRef(0);
  const elapsedRef = useRef(titleIntroSeen ? V100_TITLE_INTRO_END : 0);
  const settingsRef = useRef(settings);
  useEffect(() => {
    settingsRef.current = settings;
    const audio = audioRef.current;
    if (audio && mixerRef.current) mixerRef.current.setVolume(audio, settings.sfxEnabled ? V100_TITLE_VOICE.gain * settings.sfxVolume : 0);
  }, [settings]);
  const [phase, setPhase] = useState<"intro" | "waiting" | "complete">(titleIntroSeen ? "complete" : "intro");
  const [elapsed, setElapsed] = useState(titleIntroSeen ? V100_TITLE_INTRO_END : 0);
  const [systemReduced, setSystemReduced] = useState(false);

  const finish = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    titleIntroSeen = true;
    attemptRef.current += 1;
    cancelAnimationFrame(rafRef.current);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    mixerRef.current?.dispose();
    mixerRef.current = null;
    elapsedRef.current = V100_TITLE_INTRO_END;
    if (mountedRef.current) { setElapsed(V100_TITLE_INTRO_END); setPhase("complete"); }
  }, []);

  const begin = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !mountedRef.current || doneRef.current || document.hidden) return;
    const attempt = ++attemptRef.current;
    cancelAnimationFrame(rafRef.current);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    audio.pause();
    audio.currentTime = 0;
    elapsedRef.current = 0;
    setElapsed(0);
    setPhase("intro");
    const enabled = settingsRef.current.sfxEnabled && settingsRef.current.sfxVolume > 0;
    let clockStart = 0, voiceEnd = 0;
    const tick = (now: number) => {
      if (!mountedRef.current || doneRef.current || attempt !== attemptRef.current) return;
      let time: number;
      if (enabled) {
        if (audio.ended) { voiceEnd ||= now; time = V100_TITLE_VOICE.duration + (now - voiceEnd) / 1000; }
        else time = audio.currentTime;
      } else { clockStart ||= now; time = (now - clockStart) / 1000; }
      // Keep the wordmark tied to the native utterance, including buffering.
      elapsedRef.current = Math.max(elapsedRef.current, time);
      setElapsed(elapsedRef.current);
      if (elapsedRef.current >= V100_TITLE_INTRO_END) finish();
      else rafRef.current = requestAnimationFrame(tick);
    };
    if (!enabled) { rafRef.current = requestAnimationFrame(tick); return; }
    mixerRef.current ??= createEndingAudioMix([audio]);
    mixerRef.current.setVolume(audio, V100_TITLE_VOICE.gain * settingsRef.current.sfxVolume);
    // Invoke resume/play in the real touch handler when autoplay is blocked.
    timeoutRef.current = setTimeout(finish, 8000);
    void mixerRef.current.play(audio).then(() => {
      if (attempt !== attemptRef.current || doneRef.current || !mountedRef.current) return;
      rafRef.current = requestAnimationFrame(tick);
    }).catch((error: Error) => {
      if (attempt !== attemptRef.current || doneRef.current || !mountedRef.current) return;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      audio.pause();
      mixerRef.current?.setVolume(audio, 0);
      if (error.name === "NotAllowedError") setPhase("waiting");
      else finish();
    });
  }, [finish]);

  useEffect(() => {
    mountedRef.current = true;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const motion = () => setSystemReduced(media.matches);
    motion();
    media.addEventListener("change", motion);
    const hide = () => finish();
    const visibility = () => { if (document.hidden) hide(); };
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("pagehide", hide);
    if (!doneRef.current) {
      if (document.hidden) finish();
      else begin();
    }
    return () => {
      mountedRef.current = false;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      attemptRef.current += 1;
      cancelAnimationFrame(rafRef.current);
      mixerRef.current?.dispose();
      mixerRef.current = null;
      media.removeEventListener("change", motion);
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("pagehide", hide);
    };
  }, [begin, finish]);

  const quietMotion = reducedMotion || systemReduced;
  const frame = v100TitleIntroFrame(phase === "waiting" ? V100_TITLE_INTRO_END : elapsed, quietMotion);
  const style = {
    "--title-reveal": frame.reveal, "--title-rise": frame.rise + "px",
    "--title-flash": frame.flash, "--title-sweep": frame.sweep + "%",
    "--title-blood": phase === "waiting" ? 0 : frame.blood,
    "--title-version": frame.version, "--title-menu": frame.menu,
  } as CSSProperties;
  return <section className="v100-start-screen" data-v100-surface="title" data-reduced-motion={quietMotion} data-title-intro={phase} data-title-time={elapsed.toFixed(3)} style={style} aria-labelledby="v100-start-title">
    <audio ref={audioRef} src={V100_TITLE_VOICE.src} preload="auto" data-v100-title-voice="true" />
    <img className="v100-start-art" src={PRODUCTION_VISUALS.title} alt="" fetchPriority="high" />
    <div className="v100-start-shade" aria-hidden="true" />
    <div className="v100-start-haze" aria-hidden="true" />
    <div className="v100-start-content">
      <header className="v100-start-heading">
        <div className="v100-start-wordmark">
          <h1 id="v100-start-title" data-title="西新世紀末物語">西新世紀末物語</h1>
          <svg className="v100-start-blood" viewBox="0 0 760 150" preserveAspectRatio="none" aria-hidden="true">
            <path d="M48 69l21 6-16 5 4 12-11-8-13 4 8-12-11-9zM596 38l17 5-7 10 12 7-17-1-10 12 2-15-13-8 13-2zM705 87l12-1 8-9 1 13 13 5-12 4-4 13-6-11-12-3z" />
            <path d="M121 105l54-7-28 8 11 4-35 2zM485 103l63 5-19 4 7 4-42-8zM257 26l39 6-11 3-33-6z" />
            <ellipse cx="90" cy="110" rx="4" ry="2" /><ellipse cx="665" cy="35" rx="2" ry="4" />
            <circle cx="611" cy="82" r="2" /><circle cx="183" cy="115" r="2.5" /><circle cx="36" cy="47" r="2" /><circle cx="730" cy="61" r="3" />
          </svg>
          <div className="v100-start-glint" aria-hidden="true" />
        </div>
        <p className="v100-start-version">Ver {RELEASE_VERSION}</p>
      </header>
      {phase === "waiting" ? <button type="button" className="v100-start-tap" onClick={begin}>タップして開始</button> : <nav className="v100-start-menu" aria-label="スタートメニュー" inert={phase !== "complete"}>
        <button type="button" className="v100-start-primary" disabled={busy || !canContinue} onClick={onContinue}>続きから</button>
        <button type="button" disabled={busy} onClick={onNew}>初めから</button>
        <div className="v100-start-secondary">
          <button type="button" disabled={busy} onClick={onSettings}>設定</button>
          <button type="button" disabled={busy} onClick={onCredits}>クレジット</button>
        </div>
        <button type="button" className="v100-start-modes" disabled={busy || !canOpenModes} onClick={onModes}><span>モード選択</span><small>異常発生・サバイバル</small></button>
        {!canOpenModes && <small className="v100-start-mode-note">物語の作戦地図から利用できます</small>}
      </nav>}
    </div>
    <button type="button" className="v100-start-data" disabled={busy || phase !== "complete"} onClick={onData}>データ管理</button>
  </section>;
}
