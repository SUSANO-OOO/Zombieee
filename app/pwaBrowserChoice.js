// Optional UI preference, separate from campaign saves and installed-asset receipts.
// Storage restrictions must never prevent the player from entering the game.
export const PWA_BROWSER_CHOICE_KEY = 'nishijin:pwa-browser-choice:v1';

export function readBrowserPlayChoice(storage) {
  try {
    return (storage ?? globalThis.localStorage)?.getItem(PWA_BROWSER_CHOICE_KEY) === 'browser';
  } catch { return false; }
}

export function rememberBrowserPlayChoice(storage) {
  try {
    (storage ?? globalThis.localStorage)?.setItem(PWA_BROWSER_CHOICE_KEY, 'browser');
    return readBrowserPlayChoice(storage);
  } catch { return false; }
}
