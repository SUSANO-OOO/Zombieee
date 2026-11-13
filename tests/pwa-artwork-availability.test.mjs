import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {canUseVerifiedPwaArtwork} from '../app/pwaArtworkAvailability.js';
import {V100_UI_MATERIAL_ART as artwork} from '../app/v100PreparationArt.js';

const active=asset=>({version:'1.0.8',releaseSha:'active',assets:[asset]});
const entry={path:artwork.path,hash:artwork.hash};
const allows=options=>canUseVerifiedPwaArtwork({artwork,gameBlocked:false,...options});

test('old committed pack cannot fetch candidate art, even after partial caching or an earlier browser choice',()=>{
  const installedManifest=active({path:'/art/old.webp',hash:'old-hash'});
  const before=structuredClone(installedManifest),storedHashes=new Set([artwork.hash,'old-hash']);
  assert.equal(allows({installedManifest,storedHashes,browserPlayAccepted:true}),false);
  assert.deepEqual(installedManifest,before);
  assert.deepEqual([...storedHashes],[artwork.hash,'old-hash'],'policy neither fetches nor changes verified content');
});

test('the exact committed art and its verified bytes are both required, including offline startup',()=>{
  const installedManifest=active(entry),storedHashes=new Set([artwork.hash]);
  assert.equal(allows({installedManifest,storedHashes}),true,'no published manifest/network is needed offline');
  assert.equal(allows({installedManifest,storedHashes:new Set()}),false);
  assert.equal(allows({installedManifest:active({...entry,hash:'previous-content'}),storedHashes}),false);
  assert.equal(allows({installedManifest:active({...entry,path:'/different-art.webp'}),storedHashes}),false);
  assert.equal(allows({installedManifest,storedHashes,gameBlocked:true}),false);
});

test('only explicit network play with no installed generation can use uncached art',()=>{
  assert.equal(allows({installedManifest:null,storedHashes:new Set(),browserPlayAccepted:true}),true);
  assert.equal(allows({installedManifest:null,storedHashes:new Set()}),false);
  assert.equal(allows({installedManifest:null,browserPlayAccepted:true,gameBlocked:true}),false);
  assert.equal(allows({installedManifest:{assets:[]},browserPlayAccepted:true}),false,'an installed generation never falls through to browser consent');
});

test('malformed or unverified artwork facts fail closed',()=>{
  for(const change of [{artwork:null},{artwork:{path:artwork.path}},{storedHashes:null},{installedManifest:{assets:null}}]){
    assert.equal(allows({installedManifest:active(entry),storedHashes:new Set([artwork.hash]),...change}),false);
  }
  assert.equal(canUseVerifiedPwaArtwork({artwork,installedManifest:active(entry),storedHashes:new Set([artwork.hash])}),false,'blocked is the safe default');
});

test('the art fingerprint matches the pack and CSS keeps its URL behind the ready gate',async()=>{
  const manifest=JSON.parse(await readFile(new URL('../public/asset-manifest.json',import.meta.url)));
  const row=manifest.assets.find(row=>row.path===artwork.path);assert.ok(row);assert.equal(row.hash,artwork.hash);
  const css=await readFile(new URL('../app/v100SupplyTitleFinish.css',import.meta.url),'utf8');
  assert.match(css,/#v100-campaign\s*\{\s*--v100-ui-materials:\s*none;/u);
  const declarations=[...css.matchAll(/([^{}]+)\{[^{}]*--v100-ui-materials:\s*url\([^)]*\)[^{}]*\}/gu)];
  assert.equal(declarations.length,1);assert.match(declarations[0][1],/html\[data-pwa-ui-materials="ready"\]/u);
});
