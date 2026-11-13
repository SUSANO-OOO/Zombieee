"use client";
import {createContext} from 'react';

// Primitive path fingerprint: unrelated download progress must not change the
// context value and must never restart an active battle's image preparation.
// An unwrapped/old consumer has no permission to request new optional artwork.
export const PwaBattleArtworkPathsContext=createContext('');

// A retry must not expand the prepared set midway through the same battle.
// Newly verified art waits for the next selection; revoked paths are removed
// whenever an already-existing preparation/retry begins.
export function selectBattleArtworkPolicy(previous,key,verifiedPaths){
  const verified=typeof verifiedPaths==='string'?verifiedPaths:'';
  if(previous?.key!==key)return {key,paths:verified};
  const allowed=new Set(verified.split('\n').filter(Boolean));
  const paths=previous.paths.split('\n').filter(path=>allowed.has(path)).join('\n');
  return previous.paths===paths?previous:{key,paths};
}
