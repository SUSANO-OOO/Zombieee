"use client";
import {useEffect,useLayoutEffect,useRef,useState} from "react";
import {V177StoryDetailShot} from './V177StoryDetailShot';
import {v177StoryImagePositionFor} from './v177StoryDetailShots.js';

// Decode before switching. The prior image stays visible during the dissolve;
// a dialogue advance within one cut never restarts its camera movement.
export function V100EventBackdrop({src,description,scene,location,title=false,cinematic=false}:{src:string;description?:string|null;scene?:string|null;location?:string|null;title?:boolean;cinematic?:boolean}) {
  const [layers,setLayers]=useState({current:src,description:description??null,previous:null as string|null});
  const current=useRef(src);
  const backdrop=useRef<HTMLDivElement>(null);
  const displayedScene=layers.current;
  const modelScene=!title&&displayedScene.includes('/quality-20261028/scenes/');
  useLayoutEffect(()=>{
    if(!modelScene)return;
    const element=backdrop.current,stage=element?.closest('.v100-event-layout');
    const heading=stage?.querySelector('.v100-event-heading'),copy=stage?.querySelector('.v100-node-copy');
    if(!element||!stage||!heading||!copy)return;
    const fit=()=>{
      const origin=element.getBoundingClientRect();
      const top=heading.getBoundingClientRect().bottom-origin.top+8;
      const bottom=copy.getBoundingClientRect().top-origin.top-8;
      element.style.setProperty('--v100-model-image-top',`${top}px`);
      element.style.setProperty('--v100-model-image-height',`${Math.max(1,bottom-top)}px`);
    };
    fit();const observer=new ResizeObserver(fit);
    for(const node of [stage,heading,copy])observer.observe(node);
    return()=>observer.disconnect();
  },[modelScene,displayedScene]);
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
      setLayers({current:src,description:description??null,previous});
      timer=setTimeout(()=>{if(!cancelled) setLayers({current:src,description:description??null,previous:null});},700);
    }).catch(()=>{/* Keep the decoded previous frame; network diagnostics expose failure. */});
    return ()=>{cancelled=true;if(timer) clearTimeout(timer);};
  },[src,title,description]);
  return <><div ref={backdrop} className="v100-event-backdrop" data-v100-background={layers.current} data-v100-model-scene={modelScene?"true":undefined} data-v100-scene={scene??undefined} data-v100-location={location??undefined} data-v100-title-card={title?"true":undefined} data-v100-cinematic={cinematic?"true":undefined} style={{backgroundImage:title||modelScene?"none":`url(${layers.current})`,backgroundPosition:v177StoryImagePositionFor(layers.current)}}>
    {!title && <>{layers.previous && <img className="v100-event-image v100-event-image-previous" src={layers.previous} style={{objectPosition:v177StoryImagePositionFor(layers.previous)}} alt="" aria-hidden="true"/>}<img key={layers.current} className={`v100-event-image ${layers.previous?"v100-event-image-arriving":""}`} src={layers.current} style={{objectPosition:v177StoryImagePositionFor(layers.current)}} alt={layers.description??""} aria-hidden={layers.description?undefined:true} decoding="async"/></>}
  </div>
    {/* Keep the action close-up above the scene veil and outside its colour filter. */}
    {!title&&<>{layers.previous&&<V177StoryDetailShot key={'previous:'+layers.previous} src={layers.previous} previous/>}<V177StoryDetailShot key={'current:'+layers.current} src={layers.current} arriving={Boolean(layers.previous)}/></>}
  </>;
}
