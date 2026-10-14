import {useId} from 'react';
import {v177StoryDetailShotFor} from './v177StoryDetailShots.js';

export function V177StoryDetailShot({src,previous=false,arriving=false}:{src:string;previous?:boolean;arriving?:boolean}){
  const clipId='v177-story-detail-'+useId().replace(/[^a-z0-9_-]/giu,'');
  const shot=v177StoryDetailShotFor(src);
  if(!shot)return null;
  const [x,y,width,height]=shot.rect;
  return <figure className={'v177-story-detail-shot'+(previous?' v177-story-detail-previous':arriving?' v177-story-detail-arriving':'')} data-v177-story-detail={shot.id} data-side={shot.side} role="img" aria-label={shot.alt} aria-hidden={previous||undefined}>
    <svg viewBox={shot.rect.join(' ')} preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false">
      <defs><clipPath id={clipId} clipPathUnits="userSpaceOnUse"><rect x={x} y={y} width={width} height={height}/></clipPath></defs>
      <image href={src} x="0" y="0" width="1280" height="720" clipPath={`url(#${clipId})`}/>
    </svg>
  </figure>;
}
