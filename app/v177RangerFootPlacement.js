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
const restOffset = (leg, index) => leg.restOffset ?? REST_OFFSET[index];
const lowerBob = (rig, phase, settle) => rig.bob ? rig.bob(phase, settle) : v177RangerLowerBob(phase, settle);
const direction = value => value === 'left' || value === -1 ? -1 : 1;

function stepArc(from, peak, progress, arc = Math.sin(Math.PI * progress)) {
  const baseline = from * (1 - ease(progress));
  // Interpolate toward the apex rather than adding it above the retained
  // airborne pose. Keep the original lift timing and exact start/landing.
  return baseline + (peak - baseline) * arc;
}

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
  return rig.legs.map((leg, i) => ({x:worldX(leg.footCenter + restOffset(leg,i), root, facing, scale), height:0, angle:0, mode:'plant'}));
}
function targets(rig, feet, root, facing, scale) {
  return feet.map((foot, i) => [localX(foot.x, root, facing, scale), rig.legs[i].groundAnkle - foot.height, foot.angle]);
}

function reachable(rig, foot, i, input, offset) {
  const leg=rig.legs[i],x=localX(foot.x,input.root,input.facing,input.scale)-leg.hip[0];
  const y=leg.groundAnkle-foot.height-leg.hip[1];
  const bob=lowerBob(rig,input.phase+offset,input.settle??0);
  // Eligibility for reflecting the body uses the original IK's strict bounds.
  // Include the settled body height: an ankle just reachable during the bob
  // must not overextend as that same planted pose finishes settling.
  return [y-bob,y].every(vertical=>{
    const distance=Math.hypot(x,vertical);
    return distance>Math.abs(leg.upperLength-leg.lowerLength)+1e-7&&distance<leg.upperLength+leg.lowerLength;
  });
}

function helperX(from,to,u,vx,duration) {
  const diff=to-from,raw=(vx??0)*duration;
  const tangent=diff>=0?Math.max(0,Math.min(3*diff,raw)):Math.min(0,Math.max(3*diff,raw));
  return from+diff*u*u*(3-2*u)+tangent*u*(1-u)*(1-u);
}
function groundLanding(rig,leg,sign) {
  // Common bipeds fit their pelvis after resolving the current plants. The
  // next landing must use that planned support height, rather than clipping
  // the short leg's future step against the uncorrected standing hip.
  const hip=leg.landingHip??leg.hip;
  const radius=leg.upperLength+leg.lowerLength-1.2,vertical=leg.groundAnkle-hip[1]+1.2;
  const maxDx=Math.sqrt(Math.max(0,radius*radius-vertical*vertical)),goal=leg.footCenter+sign*rig.spanPx*.5;
  return Math.max(hip[0]-maxDx,Math.min(hip[0]+maxDx,goal));
}
function makeFlight(foot,previous,input,i,localGoal,kind,nominalEnd=null,duration=STEP_SECONDS) {
  const at=previous.time,endAt=at+duration;
  return {id:at+':'+i,at,endAt,fromHeight:foot.height,fromAngle:foot.angle,
    peak:Math.max(foot.height,kind==='move'?18:Math.min(STOP_LIFT,Math.abs(worldX(localGoal,input.root,input.facing,input.scale)-foot.x)/input.scale*.4)),
    xAt:at,fromX:foot.x,vx:foot.vx??0,goalLocal:localGoal,goalFacing:input.facing,kind,nominalEnd};
}
function sampleFlight(foot,input,flight) {
  const duration=flight.endAt-flight.at,u=clamp((input.time-flight.at)/duration);
  const goal=worldX(flight.goalLocal,input.root,flight.goalFacing,input.scale);
  if(u>=1)return {x:goal,height:0,angle:0,mode:'plant',flight:null,landedPaintTime:input.paintTime,
    phaseHold:flight.kind==='move'&&!flight.retargeted?{nominalEnd:flight.nominalEnd,direction:flight.travelSign}:null};
  const xDuration=flight.endAt-flight.xAt,xu=clamp((input.time-flight.xAt)/xDuration);
  const arc=flight.kind==='move'?Math.sin(Math.PI*u):16*u*u*(1-u)*(1-u);
  return {x:helperX(flight.fromX,goal,xu,flight.vx,xDuration),
    height:stepArc(flight.fromHeight,flight.peak,u,arc),
    angle:flight.kind==='move'?stepArc(flight.fromAngle,-.16,u):flight.fromAngle*(1-ease(u)),
    mode:'swing',flight,phaseHold:null};
}
function finishFlight(foot,previous,input,i,rig,stopping) {
  let flight=foot.flight;
  // A reflected body must not finish an airborne step at the old-facing
  // landing. Retarget from the painted X without restarting its lift or
  // postponing the landing already visible to the player.
  if(flight.goalFacing!==input.facing){
    flight={...flight,retargeted:true,xAt:previous.time,fromX:foot.x,vx:foot.vx??0,
      goalLocal:rig.legs[i].footCenter+restOffset(rig.legs[i],i),goalFacing:input.facing};
  }
  // Retarget the X segment once, retaining the original height curve and
  // absolute landing deadline. A late stop lands first and corrects afterwards.
  if(stopping&&flight.kind==='move'&&!flight.retargeted&&flight.endAt-previous.time>=.12){
    flight={...flight,retargeted:true,at:previous.time,endAt:Math.min(flight.endAt,previous.time+STEP_SECONDS),
      fromHeight:foot.height,fromAngle:foot.angle,xAt:previous.time,fromX:foot.x,vx:foot.vx??0,
      goalLocal:rig.legs[i].footCenter+restOffset(rig.legs[i],i),goalFacing:input.facing};
  }
  return sampleFlight(foot,input,flight);
}
function stopping(rig,previous,input) {
  const goal=restFeet(rig,input.root,input.facing,input.scale);
  const active=previous.feet.some(foot=>foot.flight);
  let first=-1;
  if(!active){
    const needed=previous.feet.map((foot,i)=>foot.height>0||Math.abs(foot.x-goal[i].x)>1e-10);
    const endangered=previous.feet.findIndex((foot,i)=>needed[i]&&!reachable(rig,foot,i,input,previous.offset));
    const h=previous.feet.map(foot=>foot.height),dist=previous.feet.map((foot,i)=>Math.abs(foot.x-goal[i].x));
    const alternate=previous.lastLandedLeg===0?1:previous.lastLandedLeg===1?0:-1;
    first=endangered>=0?endangered:alternate>=0&&needed[alternate]?alternate:needed[0]&&needed[1]?(h[0]>h[1]+.01?0:h[1]>h[0]+.01?1:dist[0]<dist[1]?0:1):needed[0]?0:needed[1]?1:-1;
  }
  const feet=previous.feet.map((foot,i)=>{
    if(foot.flight)return finishFlight(foot,previous,input,i,rig,true);
    // A running gait can enter a stop with both feet already airborne. Each
    // existing airborne foot must land; only new grounded steps take turns.
    if(i===first||rig.stanceFraction<.5&&foot.height>0){const flight=makeFlight(foot,previous,input,i,rig.legs[i].footCenter+restOffset(rig.legs[i],i),'stop');return sampleFlight(foot,input,flight);}
    return {...foot,mode:foot.height>0?'swing':'plant'};
  });
  return {time:input.time,root:input.root,facing:input.facing,scale:input.scale,phase:input.phase,
    offset:previous.offset,moving:false,feet};
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

function moving(rig,previous,input) {
  const {time,root,facing,scale,phase}=input,resumed=!previous.moving||previous.facing!==facing;
  const delta=phase-previous.phase,travelSign=Math.abs(delta)>1e-9?Math.sign(delta):previous.travelSign||1;
  const hasFlight=previous.feet.some(foot=>foot.flight);
  const offset=resumed&&!hasFlight?resumedOffset(rig,previous,input,travelSign):previous.offset;
  const requiresSupport=rig.phaseOwned&&rig.stanceFraction>=.5;
  let swingOwner=-1;
  if(requiresSupport){
    swingOwner=previous.feet.findIndex(foot=>foot.flight?foot.flight.endAt>time+1e-10:foot.height>1e-7);
    if(swingOwner<0){
      const candidates=previous.feet.map((foot,i)=>{
        const q=wrap(phase+offset+rig.legs[i].offset),unreachable=!reachable(rig,foot,i,input,offset);
        return{i,score:(q>rig.stanceFraction?2:0)+(unreachable?1:0),q};
      }).filter(row=>row.score>0).sort((a,b)=>b.score-a.score||b.q-a.q||a.i-b.i);
      swingOwner=candidates[0]?.i??-1;
    }
  }
  const feet=previous.feet.map((foot,i)=>{
    if(foot.flight)return finishFlight(foot,previous,input,i,rig,false);
    if(requiresSupport&&i!==swingOwner)return{...foot,mode:'plant',flight:null};
    const leg=rig.legs[i],absolute=phase+offset+leg.offset,q=wrap(absolute),local=localX(foot.x,root,facing,scale);
    const vertical=leg.groundAnkle-leg.hip[1]-lowerBob(rig,phase+offset,input.settle??0);
    const toeOff=Math.hypot(local-leg.hip[0],vertical)>leg.upperLength+leg.lowerLength-1.2;
    // Private boundary samples must not erase the landing before this paint.
    if(foot.landedPaintTime===input.paintTime&&reachable(rig,foot,i,input,offset))return {...foot,height:0,angle:0,mode:'plant',flight:null};
    const supportInFlight=previous.feet[1-i].flight&&previous.feet[1-i].flight.endAt>time+1e-10;
    // Other bipeds share this planner but own a phase-scheduled gait. Start
    // their swing before the support runs out of reach. Walking retains one
    // support; authored running gaits below .5 allow a flight interval. Ranger keeps
    // its separately accepted reach-driven continuous-mesh stride unchanged.
    if(requiresSupport&&supportInFlight)return {...foot,mode:'plant',flight:null};
    if(foot.height===0&&!toeOff&&(!rig.phaseOwned||q<=rig.stanceFraction))return {...foot,mode:'plant',flight:null};
    const nominalEnd=travelSign>0?Math.floor(absolute)+1:Math.floor(absolute)+(q<=rig.stanceFraction?-1:0)+rig.stanceFraction;
    const rate=time>previous.time?Math.abs(delta/(time-previous.time)):0;
    // Small real drift still calls for a short repositioning step, rather
    // than holding a boot in the air for the whole slow gait phase.
    // Walking flight must fit its actual swing fraction. A fixed220ms floor
    // exceeds half a fast stride and lifts both boots at once. Stop corrections
    // retain their own220ms owner and already-started flights keep their deadline.
    let gaitDuration=rate>0?Math.min(STEP_SECONDS*1.5,(1-rig.stanceFraction)/rate):STEP_SECONDS;
    // Land before the *other actual world plant* runs out of anatomical
    // reach. Nominal phase alone is insufficient after a short pursuit or
    // the two asymmetric source legs can both be in flight.
    const support=previous.feet[1-i],supportLeg=rig.legs[1-i];
    const speed=time>previous.time?Math.abs((root-previous.root)/(time-previous.time)):0;
    if(support.height<.01&&!support.flight&&speed>1e-8){
      const vertical=supportLeg.groundAnkle-supportLeg.hip[1]+1.2;
      const radius=supportLeg.upperLength+supportLeg.lowerLength-1.2;
      const reach=Math.sqrt(Math.max(0,radius*radius-vertical*vertical));
      const ahead=travelSign*(localX(support.x,root,facing,scale)-supportLeg.hip[0]);
      gaitDuration=Math.min(gaitDuration,Math.max(.12*29/Math.max(29,speed),(ahead+reach)*scale/speed-.025));
    }
    // A new correction discovered while catching up missed paints must still
    // show a lifted boot at this actual paint. Existing flight deadlines stay
    // unchanged; only this newly owned step gets a visible landing interval.
    const visibleTail=Math.min(STEP_SECONDS*.5,Math.max(0,time-previous.time));
    const duration=Math.max(gaitDuration,(input.paintTime??time)-previous.time+visibleTail);
    const flight={...makeFlight(foot,previous,input,i,groundLanding(rig,leg,travelSign),'move',nominalEnd,duration),travelSign};
    return sampleFlight(foot,input,flight);
  });
  return {time,root,facing,scale,phase,offset,moving:true,travelSign,feet};
}

function held(previous,input) {
  const {time,root,facing,scale,phase}=input;
  const unchanged=root===previous.root&&facing===previous.facing&&scale===previous.scale;
  const transform=value=>unchanged?value:worldX(localX(value,previous.root,previous.facing,previous.scale),root,facing,scale);
  const foot=value=>({...value,x:transform(value.x),flight:value.flight?{...value.flight,
    at:value.flight.at+time-previous.time,endAt:value.flight.endAt+time-previous.time,
    xAt:value.flight.xAt+time-previous.time,fromX:transform(value.flight.fromX),
    goalFacing:value.flight.goalFacing*facing*previous.facing}:value.flight});
  const stop=previous.stop?{...previous.stop,at:previous.stop.at+time-previous.time,
    from:previous.stop.from.map(foot),goal:previous.stop.goal.map(foot)}:undefined;
  return {...previous,time,root,facing,scale,phase,offset:previous.phase+previous.offset-phase,
    feet:previous.feet.map(foot),stop};
}

function advance(rig,previous,input) {
  const {time, root, facing, scale, phase} = input;
  let state;
  if(previous&&time===previous.time&&root===previous.root&&phase===previous.phase&&scale===previous.scale
    &&facing===(previous.requestedFacing??previous.facing))return previous;
  if (!previous || time < previous.time) {
    const feet = input.moving ? rig.legs.map(leg => {
      const foot = naturalFoot(rig, leg, phase, input.settle ?? 0);
      return {x:worldX(foot.x, root, facing, scale), height:foot.height, angle:foot.angle, mode:foot.height > 0 ? 'swing' : 'plant'};
    }) : restFeet(rig, root, facing, scale);
    state = {time, root, facing, scale, phase, offset:0, moving:!!input.moving, feet};
  } else if (time === previous.time && root === previous.root && phase === previous.phase
    && facing === previous.facing && scale === previous.scale) {
    state = previous;
  } else if (input.frozen || time===previous.time&&facing===previous.facing) {
    // A hit/knock displacement belongs to the existing rigid body reaction.
    // Keep its local leg pose; leaving world anchors behind would overextend it.
    state = held(previous,input);
  } else if (facing!==previous.facing && (previous.turnTargetFacing
    ||previous.feet.some((foot,i)=>!reachable(rig,foot,i,input,previous.offset)))) {
    // A fixed world ankle can become unreachable when only the body is
    // reflected. Lift that boot first with the existing step and keep the
    // previous display facing until both original legs allow the turn.
    if(previous.turnTargetFacing&&input.moving){
      // While the body waits to turn, it can still travel. Keep stepping in
      // the displayed frame instead of leaving a support behind the root.
      state=moving(rig,previous,{...input,facing:previous.facing});
      if(state.feet.every((foot,i)=>reachable(rig,foot,i,input,state.offset)))state={...state,facing};
      else state={...state,turnTargetFacing:facing};
    }else{
      state=stopping(rig,previous,input);
      if(state.feet.some((foot,i)=>!reachable(rig,foot,i,input,state.offset)))
        state={...state,facing:previous.facing,turnTargetFacing:facing};
    }
  } else {
    state = input.moving ? moving(rig, previous, input) : stopping(rig, previous, input);
  }
  // Turning eligibility must use the newly sampled feet, not the preceding
  // paint: an in-flight landing can cross the reflected body's reach limit.
  if(previous&&state.facing!==previous.facing&&(time<input.paintTime
    ||state.feet.some((foot,i)=>!reachable(rig,foot,i,{...input,facing:state.facing},state.offset))))
    state={...state,facing:previous.facing,turnTargetFacing:facing};
  if(previous&&time>previous.time){const dt=time-previous.time;
    state={...state,feet:state.feet.map((foot,i)=>({...foot,vx:input.frozen?0:(foot.x-previous.feet[i].x)/dt}))};
  }else if(previous&&time===previous.time){state={...state,feet:state.feet.map((foot,i)=>({...foot,vx:previous.feet[i].vx??0}))};
  }else state={...state,feet:state.feet.map(foot=>({...foot,vx:0}))};
  let lastLandedLeg=previous?.lastLandedLeg??null;
  if(previous)for(let i=0;i<2;i++)if(previous.feet[i].flight&&!state.feet[i].flight&&state.feet[i].height===0)lastLandedLeg=i;
  return {...state,requestedFacing:facing,lastLandedLeg};
}

export function v177RangerFootPlacement(rig, previous, input) {
  if (rig.legs.length !== 2 || ![input.time, input.root, input.phase, input.scale].every(Number.isFinite) || !(input.scale > 0)) return null;
  input = {...input, facing:direction(input.facing), paintTime:input.time,
    bodyCorrection:input.bodyCorrection??0};
  const {time,root,facing,scale,phase}=input;
  const shifted=Number.isFinite(input.bodyShiftX),shiftX=shifted?input.bodyShiftX-(previous?.bodyShiftX??0):0;
  if(previous&&time>=previous.time&&shiftX!==0&&root!==previous.root&&phase===previous.phase
    &&input.bodyCorrection===(previous.bodyCorrection??0)){
    // An advancing gait already owns its actual net travel. Transfer only
    // an otherwise unowned actual displacement. The raw correction can nearly
    // cancel an attempted pursuit: transferring it in full would subtract that
    // rejected travel again from a planted boot. Consume the receipt while
    // carrying only the painted net change, retaining all flight deadlines.
    const actualShiftX=root-previous.root;
    previous={...previous,root,feet:previous.feet.map(foot=>({...foot,x:foot.x+actualShiftX,
      flight:foot.flight?{...foot.flight,fromX:foot.flight.fromX+actualShiftX}:foot.flight}))};
  }
  // Once both feet have finished settling, retain their immutable records.
  // The clock still advances; a turn, impulse or unfinished step uses the
  // original path below, including its original landing deadline.
  if(rig.phaseOwned===true&&previous&&time>previous.time
    &&input.moving===false&&previous.moving===false&&!input.frozen
    &&input.settle===1&&root===previous.root&&phase===previous.phase
    &&scale===previous.scale&&facing===previous.facing
    &&previous.requestedFacing===facing
    &&input.bodyCorrection===(previous.bodyCorrection??0)
    &&previous.turnTargetFacing==null&&previous.stop==null
    &&Number.isFinite(previous.offset)&&previous.feet?.length===2
    &&previous.feet.every((foot,i)=>foot.mode==='plant'
      &&Object.is(foot.height,0)&&Object.is(foot.angle,0)&&Object.is(foot.vx,0)
      &&foot.flight==null&&foot.phaseHold==null
      &&foot.x===worldX(rig.legs[i].footCenter+restOffset(rig.legs[i],i),root,facing,scale))){
    const state={time,root,facing,scale,phase,offset:previous.offset,moving:false,
      feet:previous.feet,requestedFacing:facing,lastLandedLeg:previous.lastLandedLeg??null,
      bodyCorrection:input.bodyCorrection,...(shifted?{bodyShiftX:input.bodyShiftX}:{})};
    return{state,phase:wrap(phase+state.offset),targets:targets(rig,state.feet,root,facing,scale)};
  }
  // A short pursuit can start and stop between two actual paints. Its source
  // gait phase still records the travel; the last tick's moving flag does not.
  // Keep following that travel until the next unchanged pose starts settling.
  const samePaint=previous&&time===previous.time&&root===previous.root
    &&phase===previous.phase&&facing===previous.facing&&scale===previous.scale
    &&input.bodyCorrection===(previous.bodyCorrection??0);
  if(previous&&!input.frozen&&time>=previous.time
    &&(Math.abs(phase-previous.phase)>1e-9||samePaint&&previous.moving))input={...input,moving:true};
  let state;
  // A hard boss-body correction has its own receipt even below one stride.
  // Spawn/bounds corrections can also cross a whole stride before one step
  // lands. Carry that rigid pose; walking would leave its old ankles behind.
  // A solver can reject an attempted step while the actually painted root
  // stays put. Consume that receipt without freezing an unfinished landing.
  const displaced=previous&&time>=previous.time&&((input.bodyCorrection!==(previous.bodyCorrection??0)
      &&(root!==previous.root||scale!==previous.scale))
    ||time-previous.time<STEP_SECONDS&&Math.abs(root-previous.root)>scale*rig.spanPx/rig.stanceFraction);
  if(displaced)state={...held(previous,input),requestedFacing:facing,turnTargetFacing:undefined};
  else if(previous&&input.moving&&!input.frozen&&time>=previous.time){
    // Sample crossed plant/swing boundaries even when the actual draw skips
    // frames. These are pose evaluations, never fabricated gameplay/paint ticks.
    const count=Math.ceil(Math.max((time-previous.time)/.05,Math.abs(phase-previous.phase)/.04));
    if(count>256)state=advance(rig,null,input);
    else{
      state=previous;
      for(let step=1;step<=Math.max(1,count);step++){
        const p=step/Math.max(1,count);
        // The final sample is this exact paint. Reconstructing its floating
        // values can turn a repeated paint into a second tiny body movement.
        state=advance(rig,state,step===Math.max(1,count)?input:{...input,time:previous.time+(time-previous.time)*p,
          root:previous.root+(root-previous.root)*p,phase:previous.phase+(phase-previous.phase)*p,
          scale:previous.scale+(scale-previous.scale)*p});
      }
    }
  }else state=advance(rig,previous,input);
  state={...state,bodyCorrection:input.bodyCorrection,...(shifted?{bodyShiftX:input.bodyShiftX}:{})};
  return {state, phase:wrap(phase + state.offset), targets:targets(rig, state.feet, root, state.facing, scale)};
}
