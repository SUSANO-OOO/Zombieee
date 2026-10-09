"use client";
import {useEffect,useRef,useState} from "react";

// Decode before switching. The prior image stays visible during the dissolve;
// a dialogue advance within one cut never restarts its camera movement.
export function V100EventBackdrop({src,scene,location,title=false,cinematic=false}:{src:string;scene?:string|null;location?:string|null;title?:boolean;cinematic?:boolean}) {
  const [layers,setLayers]=useState({current:src,previous:null as string|null});
  const current=useRef(src);
  useEffect(()=>{
    if(title || current.current===src) return;
    let cancelled=false;
    let timer:ReturnType<typeof setTimeout>|undefined;
    const image=new Image();
    image.src=src;
    void image.decode().then(()=>{
      if(cancelled) return;
      const previous=current.current;
      current.current=src;
      setLayers({current:src,previous});
      timer=setTimeout(()=>{if(!cancelled) setLayers({current:src,previous:null});},700);
    }).catch(()=>{/* Keep the decoded previous frame; network diagnostics expose failure. */});
    return ()=>{cancelled=true;if(timer) clearTimeout(timer);};
  },[src,title]);
  return <div className="v100-event-backdrop" data-v100-scene={scene??undefined} data-v100-location={location??undefined} data-v100-title-card={title?"true":undefined} data-v100-cinematic={cinematic?"true":undefined} style={{backgroundImage:title?"none":`url(${layers.current})`}}>
    {!title && <>{layers.previous && <img className="v100-event-image v100-event-image-previous" src={layers.previous} alt="" aria-hidden="true"/>}<img key={layers.current} className={`v100-event-image ${layers.previous?"v100-event-image-arriving":""}`} src={layers.current} alt="" aria-hidden="true" decoding="async"/></>}
  </div>;
}
