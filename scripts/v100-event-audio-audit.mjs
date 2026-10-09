// Runs inside the browser so the visible cursor and native audio are sampled together.
export function v100EventAudioSnapshot({ selector, eventId, nodeIndex, sceneId }) {
  const surface = document.querySelector(selector);
  if (!surface || surface.getAttribute("data-v100-event-id") !== eventId
    || surface.getAttribute("data-v100-node-index") !== String(nodeIndex)) return false;
  const audio = window.__V100_EVENT_AUDIO_QA__?.getSnapshot?.();
  if (audio?.owner !== "v100-event-runtime"
    || audio.desired?.eventId !== eventId || audio.desired?.nodeIndex !== nodeIndex
    || audio.desired?.sceneId !== sceneId || audio.active?.eventId !== eventId
    || audio.active?.nodeIndex !== nodeIndex || audio.sceneState?.sceneId !== sceneId
    || audio.diagnostics?.contextState !== "running"
    || !(audio.diagnostics?.activeSceneVoices > 0)) return false;
  return { eventId, nodeIndex, sceneId, audio };
}
