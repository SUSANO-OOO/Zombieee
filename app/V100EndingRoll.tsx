"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { V100_CREDITS_SCENES } from "./v100EventPresentation.js";
import { V100AssetCredits } from "./V100AssetCredits";
import { V100_CREDITS_SONG, v100StaffRollCamera, v100StaffRollFrame, v100StaffRollResumeSeconds, v100StaffRollSections } from "./v100StaffRoll.js";
import "./v100StaffRoll.css";

type Shot = { sceneLabel?: string; text?: string };
type Props = { nodes: Shot[]; playerName: string; initialNodeIndex?: number; settings: { bgmEnabled?: boolean; bgmVolume?: number; reducedMotion?: boolean }; busy?: boolean; blocked?: boolean;
  onScene?: (index: number) => void; onComplete: () => Promise<boolean> | boolean };

export function V100StaffRoll({ nodes, playerName, initialNodeIndex = 0, settings, busy = false, blocked = false, onScene, onComplete }: Props) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const rollRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLElement>(null);
  const shotRef = useRef<HTMLDivElement>(null);
  const controlsRef = useRef<HTMLDivElement>(null);
  const elapsedRef = useRef(v100StaffRollResumeSeconds(initialNodeIndex, nodes.length));
  const durationRef = useRef(V100_CREDITS_SONG.duration);
  const initialIndexRef = useRef(initialNodeIndex);
  const lastSceneRef = useRef(initialNodeIndex);
  const callbacksRef = useRef({ onScene, onComplete, busy });
  const endedRef = useRef(false);
  const completingRef = useRef(false);
  const completionRequestedRef = useRef(false);
  const playingRef = useRef(false);
  const playbackAllowedRef = useRef(false);
  const playAttemptRef = useRef(0);
  const startupAtRef = useRef<number | null>(null);
  const pauseRef = useRef(false);
  const occludedRef = useRef(false);
  const waitingAtRef = useRef<number | null>(null);
  const blockedRef = useRef(blocked);
  const outroRef = useRef<number | null>(null);
  const [outro, setOutro] = useState(false);
  const [paused, setPaused] = useState(false);
  const [soundState, setSoundState] = useState("loading");
  const soundStateRef = useRef(soundState);
  const [ended, setEnded] = useState(false);
  const [showRights, setShowRights] = useState(false);
  const [frame, setFrame] = useState(() => v100StaffRollFrame(v100StaffRollResumeSeconds(initialNodeIndex, nodes.length), V100_CREDITS_SONG.duration, nodes.length));
  const soundEnabled = settings.bgmEnabled !== false && (settings.bgmVolume ?? .8) > 0;
  const soundEnabledRef = useRef(soundEnabled);
  useLayoutEffect(() => {
    callbacksRef.current = { onScene, onComplete, busy };
    soundStateRef.current = soundState;
    soundEnabledRef.current = soundEnabled;
    blockedRef.current = blocked;
  }, [onScene, onComplete, busy, soundState, soundEnabled, blocked]);

  const finish = useCallback(async () => {
    if (completingRef.current) return;
    if (callbacksRef.current.busy) { completionRequestedRef.current = true; return; }
    completionRequestedRef.current = false;
    endedRef.current = true;
    setEnded(true);
    playbackAllowedRef.current = false;
    playAttemptRef.current += 1;
    audioRef.current?.pause();
    completingRef.current = true;
    try {
      if (!await callbacksRef.current.onComplete()) { stageRef.current?.style.setProperty("--credit-curtain", "0"); setOutro(false); }
    } catch { stageRef.current?.style.setProperty("--credit-curtain", "0"); setOutro(false); }
    finally { completingRef.current = false; }
  }, []);

  useEffect(() => { if (!busy && completionRequestedRef.current) void finish(); }, [busy, finish]);

  const play = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio || !soundEnabledRef.current || document.hidden || occludedRef.current || pauseRef.current || blockedRef.current || outroRef.current !== null || endedRef.current) return;
    const attempt = ++playAttemptRef.current;
    playbackAllowedRef.current = true;
    startupAtRef.current = performance.now();
    setSoundState("loading");
    try {
      if (audio.readyState > 0 && Math.abs(audio.currentTime - elapsedRef.current) > .75) audio.currentTime = elapsedRef.current;
      await audio.play();
      if (attempt !== playAttemptRef.current) return;
      if (!playbackAllowedRef.current || document.hidden || occludedRef.current || pauseRef.current || blockedRef.current || outroRef.current !== null || endedRef.current) { audio.pause(); return; }
      playingRef.current = true;
      waitingAtRef.current = null;
      setSoundState("playing");
    } catch (error) {
      if (attempt !== playAttemptRef.current) return;
      playbackAllowedRef.current = false;
      audio.pause();
      playingRef.current = false;
      waitingAtRef.current = null;
      setSoundState(error instanceof DOMException && error.name === "NotAllowedError" ? "gesture" : "unavailable");
    }
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = Math.max(0, Math.min(1, (settings.bgmVolume ?? .8) * .72));
    const handle = requestAnimationFrame(() => {
      if (soundEnabled) void play();
      else { playbackAllowedRef.current = false; playAttemptRef.current += 1; audio.pause(); playingRef.current = false; setSoundState("muted"); }
    });
    return () => cancelAnimationFrame(handle);
  }, [soundEnabled, settings.bgmVolume, play]);
  useEffect(() => {
    if (blocked) { playbackAllowedRef.current = false; playAttemptRef.current += 1; audioRef.current?.pause(); playingRef.current = false; }
    else { const frame = requestAnimationFrame(() => { void play(); }); return () => cancelAnimationFrame(frame); }
  }, [blocked, play]);

  const beginOutro = useCallback(() => {
    if (outroRef.current !== null || endedRef.current) return;
    outroRef.current = 0;
    elapsedRef.current = durationRef.current;
    playbackAllowedRef.current = false;
    playAttemptRef.current += 1;
    playingRef.current = false;
    setFrame(v100StaffRollFrame(durationRef.current, durationRef.current, nodes.length));
    setOutro(true);
  }, [nodes.length]);

  useEffect(() => {
    const audio = audioRef.current;
    const rotationBlocker = window.matchMedia("(orientation: portrait) and (max-width: 800px)");
    occludedRef.current = document.hidden || rotationBlocker.matches;
    const visibility = () => {
      occludedRef.current = document.hidden || rotationBlocker.matches;
      if (occludedRef.current) { playbackAllowedRef.current = false; playAttemptRef.current += 1; audio?.pause(); playingRef.current = false; }
      else void play();
    };
    const pageHide = () => { occludedRef.current = true; playbackAllowedRef.current = false; playAttemptRef.current += 1; audio?.pause(); playingRef.current = false; };
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("pagehide", pageHide);
    window.addEventListener("pageshow", visibility);
    rotationBlocker.addEventListener("change", visibility);
    let animation = 0;
    let lastAt = performance.now();
    let lastPaint = -Infinity;
    const tick = (at: number) => {
      const delta = Math.max(0, Math.min(.25, (at - lastAt) / 1000));
      lastAt = at;
      if (!document.hidden && !occludedRef.current && !pauseRef.current && !blockedRef.current && !endedRef.current) {
        if (outroRef.current !== null) {
          outroRef.current += delta;
          stageRef.current?.style.setProperty("--credit-curtain", String(Math.max(0, Math.min(1, (outroRef.current - 1.4) / 1.4))));
          if (outroRef.current >= 2.8) void finish();
        }
        if (playingRef.current && audio && !audio.paused && !audio.ended) {
          if (waitingAtRef.current === null) elapsedRef.current = Math.max(elapsedRef.current, audio.currentTime);
          else if (at - waitingAtRef.current > 8000) {
            playbackAllowedRef.current = false; playAttemptRef.current += 1; audio.pause(); playingRef.current = false; waitingAtRef.current = null; setSoundState("unavailable");
          }
        } else if (!soundEnabledRef.current || ["muted", "unavailable"].includes(soundStateRef.current)) elapsedRef.current += delta;
        else if (soundStateRef.current === "loading" && startupAtRef.current !== null && at - startupAtRef.current > 8000) {
          playbackAllowedRef.current = false; playAttemptRef.current += 1; audio?.pause(); setSoundState("unavailable");
        }
        const next = v100StaffRollFrame(elapsedRef.current, durationRef.current, nodes.length);
        stageRef.current?.style.setProperty("--credit-blend", String(next.blend));
        const roll = rollRef.current, viewport = viewportRef.current;
        if (roll && viewport) {
          const footer = roll.querySelector("footer");
          const finalCenter = footer ? footer.offsetTop + footer.clientHeight / 2 : roll.scrollHeight;
          const travel = finalCenter + viewport.clientHeight / 2;
          const rollProgress = Math.min(1, next.elapsed / Math.max(1, durationRef.current - 20));
          roll.style.transform = `translate3d(0, ${viewport.clientHeight - rollProgress * travel}px, 0)`;
        }
        const shot = shotRef.current;
        if (shot) {
          const shotIndex = Number(shot.dataset.creditCameraIndex);
          const camera = v100StaffRollCamera(shotIndex, shotIndex === next.index ? next.withinScene : 1);
          shot.style.setProperty("--credit-x", `${camera.x}%`);
          shot.style.setProperty("--credit-y", `${camera.y}%`);
          shot.style.setProperty("--credit-scale", String(camera.scale));
        }
        if (next.index !== lastSceneRef.current && !callbacksRef.current.busy) {
          lastSceneRef.current = next.index;
          callbacksRef.current.onScene?.(next.index);
        }
        if (next.index !== Number(shotRef.current?.dataset.creditCameraIndex) || at - lastPaint >= 100) { setFrame(next); lastPaint = at; }
        // MP3 duration can be an estimate until its last frame is decoded.
        // Let native ended finish a playing song without cutting its tail.
        if (next.ended && (!soundEnabledRef.current || ["muted", "unavailable"].includes(soundStateRef.current))) beginOutro();
      }
      animation = requestAnimationFrame(tick);
    };
    animation = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(animation);
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("pagehide", pageHide);
      window.removeEventListener("pageshow", visibility);
      rotationBlocker.removeEventListener("change", visibility);
      audio?.pause();
    };
  }, [finish, beginOutro, nodes.length, play]);

  useEffect(() => {
    const controls = controlsRef.current, stage = stageRef.current;
    if (!controls || !stage) return;
    const resize = () => stage.style.setProperty("--credits-control-height", `${controls.getBoundingClientRect().height}px`);
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(controls);
    return () => observer.disconnect();
  }, []);

  const togglePause = () => {
    const next = !pauseRef.current;
    pauseRef.current = next; setPaused(next);
    if (next) { playbackAllowedRef.current = false; playAttemptRef.current += 1; audioRef.current?.pause(); playingRef.current = false; }
    else void play();
  };
  const current = nodes[frame.index], next = nodes[frame.nextIndex];
  const cameraStyle = (index: number, progress: number) => { const camera = v100StaffRollCamera(index, progress); return { "--credit-x": `${camera.x}%`, "--credit-y": `${camera.y}%`, "--credit-scale": camera.scale } as CSSProperties; };
  const background = (shot: Shot | undefined) => V100_CREDITS_SCENES[shot?.sceneLabel ?? ""]?.backgroundPath;
  return <section ref={stageRef} className={`v100-staff-roll ${settings.reducedMotion ? "v100-credits-reduced" : ""} ${outro ? "v100-credits-outro" : ""}`} aria-label="スタッフロール" data-v100-surface="credits" data-v100-event-id="v100:event:credits" data-v100-event-category="credits" data-v100-audio-owner="v100-staff-roll" data-v100-credit-scene={current?.sceneLabel} data-v100-node-index={frame.index} data-v100-credit-audio={soundState} data-v100-credit-progress={frame.progress.toFixed(4)} data-v100-credit-bookend={frame.elapsed < 12 || frame.index === nodes.length - 1 ? "true" : "false"} style={{ "--credit-blend": 0 } as CSSProperties}>
    <audio ref={audioRef} src={V100_CREDITS_SONG.src} preload="metadata" crossOrigin="anonymous"
      onDurationChange={event => { const length = event.currentTarget.duration; if (Number.isFinite(length) && length > 0) durationRef.current = length; }}
      onLoadedMetadata={event => {
        const audio = event.currentTarget;
        if (Number.isFinite(audio.duration) && audio.duration > 0) {
          durationRef.current = audio.duration;
          if (audio.currentTime === 0) {
            elapsedRef.current = Math.max(elapsedRef.current, v100StaffRollResumeSeconds(initialIndexRef.current, nodes.length, audio.duration));
            if (elapsedRef.current > 0) audio.currentTime = elapsedRef.current;
          }
        }
      }}
      onPlaying={event => { if (!playbackAllowedRef.current || document.hidden || occludedRef.current || pauseRef.current || blockedRef.current || outroRef.current !== null || endedRef.current) { event.currentTarget.pause(); return; } playingRef.current = true; waitingAtRef.current = null; setSoundState("playing"); }}
      onWaiting={() => { waitingAtRef.current ??= performance.now(); }}
      onCanPlay={event => { if (playbackAllowedRef.current && !event.currentTarget.paused) { playingRef.current = true; waitingAtRef.current = null; } }}
      onSeeked={event => { if (playbackAllowedRef.current && !event.currentTarget.paused) { playingRef.current = true; waitingAtRef.current = null; elapsedRef.current = Math.max(elapsedRef.current, event.currentTarget.currentTime); } }}
      onError={event => { playbackAllowedRef.current = false; playAttemptRef.current += 1; event.currentTarget.pause(); playingRef.current = false; waitingAtRef.current = null; setSoundState("unavailable"); }}
      onEnded={beginOutro} />
    <div className="v100-credit-landscape" aria-hidden="true"><div ref={shotRef} key={frame.index} data-credit-camera-index={frame.index} className="v100-credit-shot" style={{ backgroundImage: `url(${background(current)})`, ...cameraStyle(frame.index, 0) }} /><div key={`next-${frame.nextIndex}`} className="v100-credit-shot v100-credit-shot-next" style={{ backgroundImage: `url(${background(next)})`, ...cameraStyle(frame.nextIndex, 0) }} /></div>
    <div className="v100-credit-memory"><span>西新の、その後</span><h2>{current?.sceneLabel}</h2><p>{current?.text}</p></div>
    <div className="v100-credit-brand"><small>西新をつないだ、すべての人へ</small><strong>西新世紀末物語</strong>{frame.progress > .9 && <p>{playerName}、ありがとう。</p>}</div>
    <div ref={viewportRef} className="v100-credit-roll-window"><div ref={rollRef} className="v100-credit-roll-track"><header><small>THE END</small><h1>西新世紀末物語</h1><p>STAFF & CREDITS</p></header>{v100StaffRollSections(playerName).map(section => <section key={section.title}><h2>{section.title}</h2>{section.lines.map((line, index) => <p key={`${section.title}-${index}`}>{line}</p>)}</section>)}<footer><strong>あなたの物語は、ここに残る。</strong><p>Version 1.0.0</p></footer></div></div>
    <div ref={controlsRef} className="v100-credit-controls"><div className="v100-credit-song"><span>音楽：魔王魂</span><a href={V100_CREDITS_SONG.page} target="_blank" rel="noreferrer">「追憶の幻想世界」</a></div><div className="v100-credit-buttons">
      {soundState === "gesture" && <button className="v100-primary" type="button" onClick={() => void play()}>曲を再生して始める</button>}
      {soundState === "unavailable" && <button type="button" onClick={() => { audioRef.current?.load(); void play(); }}>曲を再試行</button>}
      {!ended && <button type="button" onClick={togglePause}>{paused ? "再開" : "一時停止"}</button>}
      <button type="button" onClick={() => { if (!pauseRef.current) togglePause(); setShowRights(true); }}>素材クレジット</button>
      <button type="button" disabled={busy} onClick={() => void finish()}>{ended ? "続ける" : "スキップ"}</button>
    </div>{soundState === "unavailable" && <small role="status">曲を読み込めませんでした。音なしで続けています。</small>}</div>
    {showRights && <div className="v100-modal-backdrop"><section className="v100-modal v100-credits-modal" role="dialog" aria-modal="true" aria-labelledby="v100-roll-rights-title"><div className="v100-panel-heading"><h2 id="v100-roll-rights-title">制作・素材クレジット</h2><button type="button" onClick={() => setShowRights(false)}>閉じる</button></div><V100AssetCredits expanded /></section></div>}
  </section>;
}
