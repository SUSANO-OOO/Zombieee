// A Ranger's stop is a pair of actual steps, not a frozen crossed walk key.
// The existing painted-plan history owns this small, immutable state. No
// gameplay timer, actor/save field or shared mesh buffer is changed here.
import {v177RangerLowerBob} from './v177RangerLowerMotion.js';
const wrap = value => ((value % 1) + 1) % 1;
const clamp = value => Math.max(0, Math.min(1, value));
const ease = value => { const t = clamp(value); return t * t * t * (10 + t * (-15 + 6 * t)); };
const STEP_SECONDS = .22;
const STOP_LIFT = 12;
const CENTER = 240;
const REST_OFFSET = [-24, 24];
const direction = value => value === 'left' || value === -1 ? -1 : 1;

function naturalFoot(rig, leg, phase, settle) {
  const q = wrap(phase + leg.offset), t = (q - rig.stanceFraction) / (1 - rig.stanceFraction);
  const swing = q > rig.stanceFraction;
  const s = clamp(t), interpolation = s * s * (3 - 2 * s);
  return {x:leg.footCenter + rig.spanPx * (swing ? -.5 + interpolation : .5 - q / rig.stanceFraction),
    height:swing ? rig.liftPx * Math.sin(Math.PI * s) * (1 - settle) : 0,
    angle:swing ? -.16 * Math.sin(Math.PI * s) * (1 - settle) : 0};
}

function worldX(local, root, facing, scale) { return root + facing * scale * (local - CENTER); }
function localX(value, root, facing, scale) { return CENTER + facing * (value - root) / scale; }
function restFeet(rig, root, facing, scale) {
  return rig.legs.map((leg, i) => ({x:worldX(leg.footCenter + REST_OFFSET[i], root, facing, scale), height:0, angle:0, mode:'plant'}));
}
function targets(rig, feet, root, facing, scale) {
  return feet.map((foot, i) => [localX(foot.x, root, facing, scale), rig.legs[i].groundAnkle - foot.height, foot.angle]);
}

function stopping(rig, previous, input) {
  const {time, root, facing, scale, phase} = input;
  let stop = previous.stop;
  // Subthreshold body drift can continue after both stop steps have landed.
  // Start another real pair of steps instead of keeping that old goal forever.
  const goalMoved=stop&&previous.time-stop.at>=stop.durations[0]+stop.durations[1]
    &&stop.goal.some((foot,i)=>Math.abs(foot.x-worldX(rig.legs[i].footCenter+REST_OFFSET[i],root,facing,scale))>1e-10);
  if (!stop || previous.moving || previous.facing !== facing || goalMoved) {
    const goal = restFeet(rig, root, facing, scale);
    const height = previous.feet.map(foot => foot.height);
    const distances = previous.feet.map((foot, i) => Math.abs(goal[i].x - foot.x) / scale);
    const first = height[0] > height[1] + .01 ? 0 : height[1] > height[0] + .01 ? 1 : distances[0] < distances[1] ? 0 : 1;
    const order = [first, 1 - first];
    stop = {at:previous.time, from:previous.feet.map(foot => ({...foot})), goal,
      order, durations:order.map(i => distances[i] < 1e-10 && height[i] < 1e-10 ? 0 : STEP_SECONDS),
      lifts:distances.map(distance => Math.min(STOP_LIFT,distance*.4))};
  }
  let elapsed = Math.max(0, time - stop.at);
  const feet = stop.from.map(foot => ({...foot, mode:foot.height > 0 ? 'swing' : 'plant'}));
  for (let order = 0; order < 2; order++) {
    const i = stop.order[order], duration = stop.durations[order];
    if (elapsed >= duration) {
      feet[i] = {...stop.goal[i]};
      elapsed -= duration;
      continue;
    }
    const u = duration > 0 ? clamp(elapsed / duration) : 1, s = ease(u);
    feet[i] = {x:stop.from[i].x + (stop.goal[i].x - stop.from[i].x) * s,
      height:stop.from[i].height * (1 - s) + stop.lifts[i] * 16 * u * u * (1 - u) * (1 - u),
      angle:stop.from[i].angle * (1 - s), mode:'swing'};
    // Keep the other foot's actual plant or airborne pose until its own step.
    break;
  }
  return {time, root, facing, scale, phase, offset:previous.offset, moving:false, stop, feet};
}

function resumedOffset(rig, previous, input, travelSign) {
  const {root, facing, scale, phase} = input;
  const candidates = previous.feet.map((foot, i) => {
    const dx = localX(foot.x, root, facing, scale) - rig.legs[i].footCenter;
    const q = clamp(.5 - dx / rig.spanPx) * rig.stanceFraction;
    const otherQ = wrap(q + .5);
    return {offset:q - rig.legs[i].offset - phase,
      score:(foot.height < .01 ? 2 : 0) + (otherQ > rig.stanceFraction ? travelSign > 0 ? 1 - otherQ : otherQ - rig.stanceFraction : 0)};
  });
  return candidates.sort((a, b) => b.score - a.score)[0].offset;
}

function moving(rig, previous, input) {
  const {time, root, facing, scale, phase} = input;
  const resumed = !previous.moving || previous.facing !== facing;
  const delta = phase - previous.phase;
  const travelSign = Math.abs(delta) > 1e-9 ? Math.sign(delta) : previous.travelSign || 1;
  const offset = resumed ? resumedOffset(rig, previous, input, travelSign) : previous.offset;
  const cycleDistance = rig.spanPx / rig.stanceFraction;
  const velocity = Math.abs(delta) > 1e-9 ? (root - previous.root) / delta : facing * scale * cycleDistance;
  const feet = previous.feet.map((foot, i) => {
    const leg = rig.legs[i], absolute = phase + offset + leg.offset, q = wrap(absolute);
    const local=localX(foot.x,root,facing,scale);
    const vertical=leg.groundAnkle-leg.hip[1]-v177RangerLowerBob(phase+offset,input.settle??0);
    // Lane travel also advances the gait with no horizontal root travel.
    // Either support can approach full extension before its nominal toe-off.
    const toeOff=Math.hypot(local-leg.hip[0],vertical)>leg.upperLength+leg.lowerLength-1.2;
    const swing = q > rig.stanceFraction||toeOff;
    let step = !resumed && foot.step?.direction === travelSign ? foot.step : null;
    if (!swing && !step) return {...foot, height:0, angle:0, mode:'plant', step:null};
    if (!step) {
      const end = travelSign > 0 ? Math.floor(absolute) + 1 : Math.floor(absolute) + (q<=rig.stanceFraction?-1:0) + rig.stanceFraction;
      const start = previous.phase + offset + leg.offset;
      const remaining = end - absolute;
      const landing = leg.footCenter + (travelSign > 0 ? .5 : -.5) * rig.spanPx;
      step = {direction:travelSign, start, end, from:foot.x, height:foot.height,
        to:worldX(landing, root + velocity * remaining, facing, scale)};
    }
    // An airborne foot can follow the current projected depth. Freezing its
    // old-scale landing point can place a boot outside the leg's reach.
    const landing=leg.footCenter+(travelSign>0?.5:-.5)*rig.spanPx;
    step={...step,to:worldX(landing,root+velocity*(step.end-absolute),facing,scale)};
    const span = step.end - step.start;
    const u = Math.abs(span) > 1e-9 ? clamp((absolute - step.start) / span) : 1;
    if (u >= 1) return {x:step.to, height:0, angle:0, mode:'plant', step:null};
    const s = ease(u);
    return {x:step.from + (step.to - step.from) * s,
      height:step.height * (1 - s) + rig.liftPx * Math.sin(Math.PI * u),
      angle:-.16 * Math.sin(Math.PI * u), mode:'swing', step};
  });
  return {time, root, facing, scale, phase, offset, moving:true, travelSign, feet};
}

function held(previous,input) {
  const {time,root,facing,scale,phase}=input;
  const unchanged=root===previous.root&&facing===previous.facing&&scale===previous.scale;
  const transform=value=>unchanged?value:worldX(localX(value,previous.root,previous.facing,previous.scale),root,facing,scale);
  const foot=value=>({...value,x:transform(value.x),step:value.step?{...value.step,from:transform(value.step.from),to:transform(value.step.to)}:value.step});
  const stop=previous.stop?{...previous.stop,at:previous.stop.at+time-previous.time,
    from:previous.stop.from.map(foot),goal:previous.stop.goal.map(foot)}:undefined;
  return {...previous,time,root,facing,scale,phase,offset:previous.phase+previous.offset-phase,
    feet:previous.feet.map(foot),stop};
}

function advance(rig,previous,input) {
  const {time, root, facing, scale, phase} = input;
  let state;
  if (!previous || time < previous.time) {
    const feet = input.moving ? rig.legs.map(leg => {
      const foot = naturalFoot(rig, leg, phase, input.settle ?? 0);
      return {x:worldX(foot.x, root, facing, scale), height:foot.height, angle:foot.angle, mode:foot.height > 0 ? 'swing' : 'plant'};
    }) : restFeet(rig, root, facing, scale);
    state = {time, root, facing, scale, phase, offset:0, moving:!!input.moving, feet};
  } else if (time === previous.time && root === previous.root && phase === previous.phase
    && facing === previous.facing && !!input.moving === previous.moving) {
    state = previous;
  } else if (input.frozen || input.moving && Math.abs(phase-previous.phase)<1e-9 && root!==previous.root) {
    // A hit/knock displacement belongs to the existing rigid body reaction.
    // Keep its local leg pose; leaving world anchors behind would overextend it.
    state = held(previous,input);
  } else {
    state = input.moving ? moving(rig, previous, input) : stopping(rig, previous, input);
  }
  return state;
}

export function v177RangerFootPlacement(rig, previous, input) {
  if (rig.legs.length !== 2 || ![input.time, input.root, input.phase, input.scale].every(Number.isFinite) || !(input.scale > 0)) return null;
  input = {...input, facing:direction(input.facing)};
  const {time,root,facing,scale,phase}=input;
  // A short pursuit can start and stop between two actual paints. Its source
  // gait phase still records the travel; the last tick's moving flag does not.
  // Keep following that travel until the next unchanged pose starts settling.
  const samePaint=previous&&time===previous.time&&root===previous.root
    &&phase===previous.phase&&facing===previous.facing&&scale===previous.scale;
  if(previous&&!input.frozen&&time>=previous.time
    &&(Math.abs(phase-previous.phase)>1e-9||samePaint&&previous.moving))input={...input,moving:true};
  let state;
  if(previous&&input.moving&&!input.frozen&&time>=previous.time){
    // Sample crossed plant/swing boundaries even when the actual draw skips
    // frames. These are pose evaluations, never fabricated gameplay/paint ticks.
    const count=Math.ceil(Math.max((time-previous.time)/.05,Math.abs(phase-previous.phase)/.04));
    if(count>256)state=advance(rig,null,input);
    else{
      state=previous;
      for(let step=1;step<=Math.max(1,count);step++){
        const p=step/Math.max(1,count);
        state=advance(rig,state,{...input,time:previous.time+(time-previous.time)*p,
          root:previous.root+(root-previous.root)*p,phase:previous.phase+(phase-previous.phase)*p,
          scale:previous.scale+(scale-previous.scale)*p});
      }
    }
  }else state=advance(rig,previous,input);
  return {state, phase:wrap(phase + state.offset), targets:targets(rig, state.feet, root, facing, scale)};
}
