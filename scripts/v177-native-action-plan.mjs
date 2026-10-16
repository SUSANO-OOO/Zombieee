// All inputs supported by the existing paused animation foundation bridge.
// These are native pose checks, not proof of natural gameplay or all 21 states.
export const V177_NATIVE_ACTION_PLAN = Object.freeze([
  {action:'deploy',expectedState:'deploy',joint:true},
  {action:'deploy-move-right',expectedState:'deploy',joint:true},
  {action:'move-right',joint:true},
  {action:'move-left',joint:true},
  {action:'wind-up',expectedState:'wind-up',joint:true,attackOrigin:true},
  {action:'attack',expectedState:'active',joint:true,attackOrigin:true},
  {action:'recovery',expectedState:'recovery',joint:true,attackOrigin:true},
  {action:'reload',expectedState:'reload',joint:true,attackOrigin:true},
  {action:'hit-light',expectedState:'hit-light',joint:true},
  {action:'hit-heavy',expectedState:'hit-heavy',joint:true},
  {action:'stop',joint:true},
].map(Object.freeze));
