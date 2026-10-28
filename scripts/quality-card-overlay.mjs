// UI-owned role symbols are vector overlays; character pixels are not repainted.
export function qualityCardOverlay(kind) {
  const roles = {
    chiha: {color: '#cf9f50', mark: '<circle cx="388" cy="398" r="33"/><path d="M420 383h34v27h-34M365 430l-12 23"/><circle cx="388" cy="398" r="10"/>'},
    musashi: {color: '#6b90b2', mark: '<path d="m355 350 90 95m0-95-90 95m-11-7 19 19m74-19 19 19"/>'},
    mayo: {color: '#e2ba4b', mark: '<path d="M387 379h24v22h22v24h-22v22h-24v-22h-22v-24h22z"/><circle cx="364" cy="368" r="10"/><circle cx="390" cy="353" r="10"/><circle cx="419" cy="356" r="10"/><circle cx="443" cy="375" r="10"/>'},
    king: {color: '#ff4e62', mark: '<path d="M345 389h39v40h-39zm39 7 52-39q15-7 23 5t-3 23l-53 41zM353 389v-18h25v18"/>'},
    tatara: {color: '#a688ff', mark: '<path d="m363 371 22-22 58 58-22 22zm40 40-43 43"/>'},
    raider: {color: '#ef6b5e', mark: '<path d="M347 379h76v24h-76zm76 8h34m-62 17v40h-31v-40m32 0 18 37m-55-61-13-12"/>'},
    gantetsu: {color: '#8eabc2', mark: '<path d="m361 355 76 0v55q-9 28-38 43-29-15-38-43zm20 18h36v20h-36z"/>'},
    monkey: {color: '#45d6db', mark: '<path d="M355 365q44 72 88 0m-88 0h88m-44 0v87m-10-12 10 12 10-12"/>'},
    mizuchi: {color: '#55c9e8', mark: '<circle cx="399" cy="399" r="36"/><path d="M399 345v30m0 48v30m-54-54h30m48 0h30"/>'},
    hachi: {color: '#e6c84f', mark: '<path d="m360 451 64-78q15-23-9-27q-16-3-22 14m-33 91-12-9"/>'},
    nao: {color: '#6fe0a0', mark: '<path d="M382 350h30v33h33v30h-33v33h-30v-33h-33v-30h33z"/>'},
    paisen: {color: '#f0a34a', mark: '<path d="M364 408v-32q0-14 13-14v32-36q0-14 13-14v48-36q0-14 13-14v50-31q0-14 13-14v49l12-12q13-10 20 2l-21 39-16 23h-36l-11-40z"/>'},
    kumaverson: {color: '#efb751', mark: '<circle cx="419" cy="391" r="31"/><path d="m396 414-41 43"/>'},
    babayaga: {color: '#75a8ff', mark: '<path d="M350 368h94v22h-37l-8 53h-26l8-53h-31z"/>'},
    zakimiya: {color: '#e2a64b', mark: '<path d="M392 351h20v34l17 17v44h-54v-44l17-17z"/>'},
    tky: {color: '#ff42c8', mark: '<path d="m354 449 104-104m-113 80 33 33"/>'},
  };
  const {color, mark} = roles[kind];
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512">
    <rect x="16" y="16" width="10" height="480" rx="5" fill="${color}"/>
    <path d="M322 330h174v166H294z" fill="#090d12" fill-opacity=".94" stroke="${color}" stroke-width="5"/>
    <g fill="none" stroke="${color}" stroke-width="9" stroke-linecap="round" stroke-linejoin="round">${mark}</g>
  </svg>`);
}
