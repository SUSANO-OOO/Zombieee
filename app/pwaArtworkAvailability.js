// New artwork must not turn update discovery into an unrequested download.
export function canUseVerifiedPwaArtwork({artwork,installedManifest,storedHashes,browserPlayAccepted=false,gameBlocked=true,baseUrl="/"}) {
  if(gameBlocked || !artwork?.path || !artwork?.hash)return false;
  if(!installedManifest)return browserPlayAccepted===true;
  // Pages prefixes runtime URLs; manifest paths stay relative to the app root.
  const scope = new URL(baseUrl,"https://pwa.invalid/").pathname.replace(/\/?$/u,"/");
  const path = scope !== "/" && artwork.path.startsWith(scope)
    ? "/" + artwork.path.slice(scope.length) : artwork.path;
  return Array.isArray(installedManifest.assets)
    && installedManifest.assets.some(asset=>asset.path===path && asset.hash===artwork.hash)
    && typeof storedHashes?.has==='function' && storedHashes.has(artwork.hash);
}

export function verifiedPwaArtworkPaths({artworks={},...facts}={}){
  return [...new Set(Object.values(artworks??{}).filter(artwork=>canUseVerifiedPwaArtwork({...facts,artwork}))
    .map(artwork=>artwork.path))].sort().join('\n');
}
