// New artwork must not turn update discovery into an unrequested download.
export function canUseVerifiedPwaArtwork({artwork,installedManifest,storedHashes,browserPlayAccepted=false,gameBlocked=true}) {
  if(gameBlocked || !artwork?.path || !artwork?.hash)return false;
  if(!installedManifest)return browserPlayAccepted===true;
  return Array.isArray(installedManifest.assets)
    && installedManifest.assets.some(asset=>asset.path===artwork.path && asset.hash===artwork.hash)
    && typeof storedHashes?.has==='function' && storedHashes.has(artwork.hash);
}
