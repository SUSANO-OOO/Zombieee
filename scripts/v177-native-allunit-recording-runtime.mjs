import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

// Stable1.64.1 still predates WebKit's writer NotReady frame-retention fix321218.
// The exact official dated build binds Playwright20a2087e/WebKit5b391e6d.
// This browser is used only for original all-unit recording. PWA1.63 and
// the formal1.56 rendering/performance baseline keep their own runtimes.
export const NATIVE_RECORDING_WEBKIT_RUNTIME=Object.freeze({packageVersion:'1.65.0-alpha-2026-10-23',revision:'2380',browserVersion:'27.2'});

export async function nativeRecordingBrowserType({read=readFile,load=url=>import(url)}={}){
  const root=new URL('./native-recording-runtime/node_modules/',import.meta.url);
  const pkg=JSON.parse(await read(new URL('playwright/package.json',root)));
  const browsers=JSON.parse(await read(new URL('playwright-core/browsers.json',root)));
  assert.equal(pkg.version,NATIVE_RECORDING_WEBKIT_RUNTIME.packageVersion);
  const record=browsers.browsers.find(browser=>browser.name==='webkit');
  assert.equal(record?.revision,NATIVE_RECORDING_WEBKIT_RUNTIME.revision);
  assert.equal(record?.browserVersion,NATIVE_RECORDING_WEBKIT_RUNTIME.browserVersion);
  const {webkit}=await load(new URL('playwright/index.mjs',root).href);
  assert.ok(webkit.executablePath().includes(`webkit-${NATIVE_RECORDING_WEBKIT_RUNTIME.revision}`),
    'Original recording requires the fixed browser revision; older OS fallback is not accepted');
  return webkit;
}
