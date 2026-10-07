"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { V100_CREDITS_FILM } from "./v100CreditsFilm.js";
import { v100CreditsCameraStyle } from "./v100CreditsFilmEdit.js";
import { V100AssetCredits } from "./V100AssetCredits";
import { V100_CREDITS_SONG, v100StaffRollFrame, v100StaffRollResumeSeconds, v100StaffRollSections } from "./v100StaffRoll.js";
import "./v100StaffRoll.css";

type Shot = { sceneLabel?: string; text?: string };
type Props = { nodes: Shot[]; playerName: string; initialNodeIndex?: number; settings: { bgmEnabled?: boolean; bgmVolume?: number; reducedMotion?: boolean }; busy?: boolean; blocked?: boolean;
  onScene?: (index: number) => void; onComplete: () => Promise<boolean> | boolean };

export type V100VisualFrame = { shotIndex: number; nextShotIndex: number; blend: number; withinShot?: number };
type ShotCamera = { from: number; to: number; x: number; y: number; positionX: number; positionY: number };
type FilmLayer = { index: number; decoded: boolean; failed: boolean; token: number };

export function V100CreditsFilmView({ initialFrame, paintRef, reducedMotion, film = V100_CREDITS_FILM, className = "" }: { initialFrame: V100VisualFrame; paintRef: RefObject<((frame: V100VisualFrame) => void) | null>; reducedMotion?: boolean; film?: readonly { src: string; description: string; camera?: ShotCamera }[]; className?: string }) {
  const landscapeRef = useRef<HTMLDivElement>(null);
  const firstRef = useRef<HTMLImageElement>(null), secondRef = useRef<HTMLImageElement>(null);
  const layersRef = useRef<FilmLayer[]>([{ index: -1, decoded: false, failed: false, token: 0 }, { index: -1, decoded: false, failed: false, token: 0 }]);
  const activeRef = useRef(0), latestRef = useRef(initialFrame), reducedRef = useRef(reducedMotion);
  const reducedMediaRef = useRef<MediaQueryList | null>(null);
  const imageAt = useCallback((slot: number) => slot === 0 ? firstRef.current : secondRef.current, []);
  const prepare = useCallback((slot: number, index: number) => {
    const layer = layersRef.current[slot], image = imageAt(slot), shot = film[index];
    if (!image || !shot || layer.index === index) return;
    // Only the hidden buffer changes source. Keep the displayed image alive
    // until the incoming buffer has loaded and decoded.
    image.style.opacity = "0";
    layer.index = index; layer.decoded = false; layer.failed = false; layer.token += 1;
    image.dataset.creditShotIndex = String(index);
    image.dataset.creditDecoded = "false";
    image.src = shot.src;
  }, [film, imageAt]);
  const paint = useCallback((next: V100VisualFrame) => {
    latestRef.current = next;
    const layers = layersRef.current;
    let active = activeRef.current, incoming = 1 - active;
    if (layers[active].index < 0) prepare(active, next.shotIndex);
    if (!layers[active].decoded && layers[active].failed && layers[incoming].decoded) {
      activeRef.current = incoming; active = incoming; incoming = 1 - active;
    }
    if (layers[active].index !== next.shotIndex) {
      prepare(incoming, next.shotIndex);
      if (layers[incoming].decoded) {
        // Promote the same decoded element used by the dissolve. Source,
        // opacity and layer order change together before the browser paints.
        activeRef.current = incoming; active = incoming; incoming = 1 - active;
      }
    }
    const displayed = film[layers[active].index];
    const current = imageAt(active), standby = imageAt(incoming), landscape = landscapeRef.current;
    if (!current || !standby || !landscape || !displayed) return;
    current.className = "v100-credit-shot"; current.style.zIndex = "0";
    current.style.opacity = layers[active].decoded ? "1" : "0";
    standby.className = "v100-credit-shot v100-credit-shot-next"; standby.style.zIndex = "1";
    standby.style.opacity = "0";
    const reduced = reducedRef.current || reducedMediaRef.current?.matches;
    const cameraPaint = (image: HTMLImageElement, index: number, progress: number) => {
      const camera = v100CreditsCameraStyle(film[index]?.camera, progress, reduced);
      image.style.transformOrigin = camera.origin; image.style.objectPosition = camera.position; image.style.transform = camera.transform;
    };
    if (layers[active].index === next.shotIndex) {
      cameraPaint(current, layers[active].index, next.withinShot ?? 0);
      if (next.nextShotIndex !== next.shotIndex) prepare(incoming, next.nextShotIndex);
      else if (!layers[active].decoded && layers[active].failed && film.length > 1) prepare(incoming, Math.max(0, next.shotIndex - 1));
      cameraPaint(standby, layers[incoming].index, 0);
      if (!reduced && layers[incoming].decoded && layers[incoming].index === next.nextShotIndex && next.nextShotIndex !== next.shotIndex) standby.style.opacity = String(next.blend);
    }
    landscape.dataset.creditRenderedShotIndex = String(layers[active].index);
    landscape.setAttribute("aria-label", displayed.description);
  }, [film, imageAt, prepare]);
  const decoded = useCallback(async (slot: number) => {
    const image = imageAt(slot), layer = layersRef.current[slot], token = layer.token;
    if (!image) return;
    try { await image.decode(); }
    catch {
      if (imageAt(slot) === image && layer.token === token) { layer.failed = true; paint(latestRef.current); }
      return;
    }
    if (imageAt(slot) !== image || layer.token !== token || !image.complete || image.naturalWidth === 0) return;
    layer.decoded = true;
    image.dataset.creditDecoded = "true";
    paint(latestRef.current);
  }, [imageAt, paint]);
  useLayoutEffect(() => {
    reducedMediaRef.current = window.matchMedia("(prefers-reduced-motion: reduce)");
    paintRef.current = paint;
    paint(latestRef.current);
    return () => { paintRef.current = null; };
  }, [paint, paintRef]);
  useLayoutEffect(() => { reducedRef.current = reducedMotion; paint(latestRef.current); }, [reducedMotion, paint]);
  return <div ref={landscapeRef} className={`v100-credit-landscape ${className}`} role="img">
    <img ref={firstRef} className="v100-credit-shot" alt="" aria-hidden="true" decoding="async" onLoad={() => void decoded(0)} onError={() => void decoded(0)} />
    <img ref={secondRef} className="v100-credit-shot v100-credit-shot-next" alt="" aria-hidden="true" decoding="async" onLoad={() => void decoded(1)} onError={() => void decoded(1)} />
  </div>;
}

export function V100StaffRoll({ nodes, initialNodeIndex = 0, settings, busy = false, blocked = false, onScene, onComplete }: Props) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const rollRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLElement>(null);
  const filmPaintRef = useRef<((frame: V100VisualFrame) => void) | null>(null);
  const controlsRef = useRef<HTMLDivElement>(null);
  const [initialSeconds] = useState(() => v100StaffRollResumeSeconds(initialNodeIndex, nodes.length));
  const elapsedRef = useRef(initialSeconds);
  const musicCursorRef = useRef(initialSeconds);
  const musicSampleRef = useRef(initialSeconds);
  const speedRef = useRef(1);
  const musicVolumeRef = useRef(.576);
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
  const [speed, setSpeed] = useState(1);
  const [soundState, setSoundState] = useState("loading");
  const soundStateRef = useRef(soundState);
  const [ended, setEnded] = useState(false);
  const [showRights, setShowRights] = useState(false);
  const [initialFilmFrame] = useState(() => v100StaffRollFrame(initialSeconds, V100_CREDITS_SONG.duration, nodes.length));
  const [frame, setFrame] = useState(initialFilmFrame);
  const lastFrameShotRef = useRef(frame.shotIndex);
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
    if (!audio || !soundEnabledRef.current || document.hidden || occludedRef.current || pauseRef.current || blockedRef.current || (outroRef.current !== null && outroRef.current >= 1.8) || endedRef.current) return;
    const attempt = ++playAttemptRef.current;
    playbackAllowedRef.current = true;
    startupAtRef.current = performance.now();
    setSoundState("loading");
    try {
      // Film speed is independent of the original music. Resume the music at
      // its own cursor, never at the accelerated film cursor.
      audio.playbackRate = 1;
      if (audio.readyState > 0 && Math.abs(audio.currentTime - musicCursorRef.current) > .75) audio.currentTime = musicCursorRef.current;
      musicSampleRef.current = audio.currentTime;
      await audio.play();
      if (attempt !== playAttemptRef.current) return;
      if (!playbackAllowedRef.current || document.hidden || occludedRef.current || pauseRef.current || blockedRef.current || (outroRef.current !== null && outroRef.current >= 1.8) || endedRef.current) { audio.pause(); return; }
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
    musicVolumeRef.current = Math.max(0, Math.min(1, (settings.bgmVolume ?? .8) * .72));
    audio.volume = musicVolumeRef.current * (outroRef.current === null ? 1 : Math.max(0, 1 - outroRef.current / 1.8));
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
    pauseRef.current = false;
    setPaused(false);
    setFrame(v100StaffRollFrame(durationRef.current, durationRef.current, nodes.length));
    setOutro(true);
    if (audioRef.current?.paused && !audioRef.current.ended) void play();
  }, [nodes.length, play]);

  useEffect(() => {
    const audio = audioRef.current;
    const rotationBlocker = window.matchMedia("(orientation: portrait) and (max-width: 800px)");
    let pageHidden = false;
    occludedRef.current = document.hidden || rotationBlocker.matches;
    const visibility = () => {
      occludedRef.current = pageHidden || document.hidden || rotationBlocker.matches;
      if (occludedRef.current) { playbackAllowedRef.current = false; playAttemptRef.current += 1; audio?.pause(); playingRef.current = false; }
      else void play();
    };
    const pageHide = () => { pageHidden = true; visibility(); };
    const pageShow = () => { pageHidden = false; visibility(); };
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("pagehide", pageHide);
    window.addEventListener("pageshow", pageShow);
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
          if (audio) audio.volume = musicVolumeRef.current * Math.max(0, 1 - outroRef.current / 1.8);
          stageRef.current?.style.setProperty("--credit-curtain", String(Math.max(0, Math.min(1, (outroRef.current - 1.4) / 1.4))));
          if (outroRef.current >= 2.8) void finish();
        } else if (playingRef.current && audio && !audio.paused && !audio.ended) {
          if (waitingAtRef.current === null) {
            const musicDelta = Math.max(0, audio.currentTime - musicSampleRef.current);
            musicCursorRef.current = audio.currentTime;
            musicSampleRef.current = audio.currentTime;
            elapsedRef.current += musicDelta * speedRef.current;
          }
          else if (at - waitingAtRef.current > 8000) {
            playbackAllowedRef.current = false; playAttemptRef.current += 1; audio.pause(); playingRef.current = false; waitingAtRef.current = null; setSoundState("unavailable");
          }
        } else if (!soundEnabledRef.current || ["muted", "unavailable"].includes(soundStateRef.current)) {
          musicCursorRef.current = Math.min(durationRef.current, musicCursorRef.current + delta);
          elapsedRef.current += delta * speedRef.current;
        }
        else if (soundStateRef.current === "loading" && startupAtRef.current !== null && at - startupAtRef.current > 8000) {
          playbackAllowedRef.current = false; playAttemptRef.current += 1; audio?.pause(); setSoundState("unavailable");
        }
        const next = v100StaffRollFrame(elapsedRef.current, durationRef.current, nodes.length);
        filmPaintRef.current?.(next);
        const roll = rollRef.current, viewport = viewportRef.current;
        if (roll && viewport) {
          const footer = roll.querySelector("footer");
          const finalCenter = footer ? footer.offsetTop + footer.clientHeight / 2 : roll.scrollHeight;
          const header = roll.querySelector("header");
          const start = Math.max(0, (viewport.clientHeight - (header?.clientHeight ?? 0)) / 2);
          const travel = start + finalCenter - viewport.clientHeight / 2;
          const rollProgress = Math.min(1, Math.max(0, (next.elapsed - 4) / Math.max(1, durationRef.current - 24)));
          roll.style.transform = `translate3d(0, ${start - rollProgress * travel}px, 0)`;
        }
        if (next.index !== lastSceneRef.current && !callbacksRef.current.busy) {
          lastSceneRef.current = next.index;
          callbacksRef.current.onScene?.(next.index);
        }
        if (next.shotIndex !== lastFrameShotRef.current || at - lastPaint >= 100) { setFrame(next); lastFrameShotRef.current = next.shotIndex; lastPaint = at; }
        // MP3 duration can be an estimate until its last frame is decoded.
        // Let native ended finish a playing song without cutting its tail.
        if (next.ended && (speedRef.current !== 1 || elapsedRef.current > musicCursorRef.current + .5 || !soundEnabledRef.current || ["muted", "unavailable"].includes(soundStateRef.current))) beginOutro();
      }
      animation = requestAnimationFrame(tick);
    };
    animation = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(animation);
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("pagehide", pageHide);
      window.removeEventListener("pageshow", pageShow);
      rotationBlocker.removeEventListener("change", visibility);
      playbackAllowedRef.current = false;
      playAttemptRef.current += 1;
      playingRef.current = false;
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
  const cycleSpeed = () => {
    const next = speedRef.current === 1 ? 2 : speedRef.current === 2 ? 4 : 1;
    speedRef.current = next;
    setSpeed(next);
  };
  const current = nodes[frame.index];
  const currentShot = V100_CREDITS_FILM[frame.shotIndex];
  return <section ref={stageRef} className={`v100-staff-roll ${settings.reducedMotion ? "v100-credits-reduced" : ""} ${outro ? "v100-credits-outro" : ""}`} aria-label="スタッフロール" data-v100-surface="credits" data-v100-event-id="v100:event:credits" data-v100-event-category="credits" data-v100-audio-owner="v100-staff-roll" data-v100-credit-speed={speed} data-v100-credit-scene={current?.sceneLabel} data-v100-credit-shot={currentShot?.id} data-v100-credit-shot-index={frame.shotIndex} data-v100-node-index={frame.index} data-v100-credit-audio={soundState} data-v100-credit-progress={frame.progress.toFixed(4)}>
    <audio ref={audioRef} src={V100_CREDITS_SONG.src} preload="metadata" crossOrigin="anonymous"
      onDurationChange={event => { const length = event.currentTarget.duration; if (Number.isFinite(length) && length > 0) durationRef.current = length; }}
      onLoadedMetadata={event => {
        const audio = event.currentTarget;
        if (Number.isFinite(audio.duration) && audio.duration > 0) {
          durationRef.current = audio.duration;
          if (audio.currentTime === 0) {
            elapsedRef.current = Math.max(elapsedRef.current, v100StaffRollResumeSeconds(initialIndexRef.current, nodes.length, audio.duration));
            musicCursorRef.current = v100StaffRollResumeSeconds(initialIndexRef.current, nodes.length, audio.duration);
            musicSampleRef.current = musicCursorRef.current;
            if (musicCursorRef.current > 0) audio.currentTime = musicCursorRef.current;
          }
        }
      }}
      onPlaying={event => { if (!playbackAllowedRef.current || document.hidden || occludedRef.current || pauseRef.current || blockedRef.current || endedRef.current) { event.currentTarget.pause(); return; } playingRef.current = true; waitingAtRef.current = null; setSoundState("playing"); }}
      onWaiting={() => { waitingAtRef.current ??= performance.now(); }}
      onCanPlay={event => { if (playbackAllowedRef.current && !event.currentTarget.paused) { playingRef.current = true; waitingAtRef.current = null; } }}
      onSeeked={event => { musicCursorRef.current = event.currentTarget.currentTime; musicSampleRef.current = event.currentTarget.currentTime; if (playbackAllowedRef.current && !event.currentTarget.paused) { playingRef.current = true; waitingAtRef.current = null; elapsedRef.current = Math.max(elapsedRef.current, event.currentTarget.currentTime); } }}
      onError={event => { playbackAllowedRef.current = false; playAttemptRef.current += 1; event.currentTarget.pause(); playingRef.current = false; waitingAtRef.current = null; setSoundState("unavailable"); }}
      onEnded={beginOutro} />
    <V100CreditsFilmView initialFrame={initialFilmFrame} paintRef={filmPaintRef} reducedMotion={settings.reducedMotion} className="v100-credit-cinema" />
    <div className="v100-credit-cinema-shade" aria-hidden="true" />
    <div ref={viewportRef} className="v100-credit-roll-window"><div ref={rollRef} className="v100-credit-roll-track"><header><small>THE END</small><h1>西新世紀末物語</h1><p>STAFF & CREDITS</p></header>{v100StaffRollSections().map(section => <section key={section.title}><h2>{section.title}</h2>{section.lines.map((line, index) => <p key={`${section.title}-${index}`}>{line}</p>)}</section>)}<footer><h2>THANK YOU FOR PLAYING</h2><strong>西新世紀末物語</strong></footer></div></div>
    <div ref={controlsRef} className="v100-credit-controls"><div className="v100-credit-song"><span>音楽：魔王魂</span><a href={V100_CREDITS_SONG.page} target="_blank" rel="noreferrer">「追憶の幻想世界」</a></div><div className="v100-credit-buttons">
      {soundState === "gesture" && <button className="v100-primary v100-credit-audio-action" type="button" onClick={() => void play()}>曲を再生して始める</button>}
      {soundState === "unavailable" && <button className="v100-credit-audio-action" type="button" onClick={() => { audioRef.current?.load(); void play(); }}>曲を再試行</button>}
      {!ended && <button type="button" disabled={outro} onClick={togglePause}>{paused ? "再開" : "一時停止"}</button>}
      {!ended && <button type="button" disabled={outro} onClick={cycleSpeed} aria-label={`映像と文字の速さ：${speed === 1 ? "通常" : `${speed}倍`}。曲は通常速度`}>{speed === 1 ? "通常 ▶▶" : `${speed}倍 ▶▶`}</button>}
      <button type="button" disabled={outro} onClick={() => { if (!pauseRef.current) togglePause(); setShowRights(true); }}>クレジット</button>
      <button type="button" disabled={busy || (outro && !ended)} onClick={() => ended ? void finish() : beginOutro()}>{ended ? "続ける" : "スキップ"}</button>
    </div>{soundState === "unavailable" && <small role="status">曲を読み込めませんでした。音なしで続けています。</small>}</div>
    {showRights && <div className="v100-modal-backdrop"><section className="v100-modal v100-credits-modal" role="dialog" aria-modal="true" aria-labelledby="v100-roll-rights-title"><div className="v100-panel-heading"><h2 id="v100-roll-rights-title">制作・素材クレジット</h2><button type="button" onClick={() => setShowRights(false)}>閉じる</button></div><V100AssetCredits expanded /></section></div>}
  </section>;
}
