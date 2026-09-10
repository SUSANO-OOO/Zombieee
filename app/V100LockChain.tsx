/** Decorative chain stays on the artwork; the unlock requirement remains text. */
export function V100LockChain() {
  return <svg className="v100-lock-chain" viewBox="0 0 120 80" aria-hidden="true">
    <g fill="none" stroke="#0a1519" strokeWidth="9" transform="translate(-8 3) rotate(25 60 40)">{[0,1,2,3,4,5,6].map(i=><rect key={i} x={i*22} y="29" width="29" height="16" rx="7" />)}</g>
    <g fill="none" stroke="#a8b6b9" strokeWidth="4" transform="translate(-8 3) rotate(25 60 40)">{[0,1,2,3,4,5,6].map(i=><rect key={i} x={i*22} y="29" width="29" height="16" rx="7" />)}</g>
    <path d="M52 40V31a9 9 0 0 1 18 0v9" fill="none" stroke="#111e22" strokeWidth="9"/><path d="M52 40V31a9 9 0 0 1 18 0v9" fill="none" stroke="#d2d6c9" strokeWidth="4"/>
    <rect x="45" y="38" width="31" height="25" rx="4" fill="#84754e" stroke="#d1bd8a" strokeWidth="2"/><path d="M60 47v8" stroke="#162326" strokeWidth="4"/>
  </svg>;
}
