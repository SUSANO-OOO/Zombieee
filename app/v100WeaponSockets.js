// Measured barrel tips in the approved atlas cells, before sprite transforms.
// These coordinates follow the two firing poses, not the combat hitbox.
export const V100_WEAPON_SOCKETS=Object.freeze({
 babayaga:{path:'/art/v060/characters/babayaga-battle-v1.png',right:[[362,119],[338,116]],left:[[115,131],[135,134]]},
 ranger:{path:'/art/v070/characters/ranger-battle-v1.png',right:[[374,83],[360,83]],left:[[107,83],[118,84]]},
 gunner:{path:'/art/v070/characters/gunner-battle-v1.png',right:[[360,144],[324,149]],left:[[118,144],[158,151]]},
 'red-panther-smg':{path:'/art/v100/enemies/red-panther-smg-battle-v2.png',right:[[390,152],[390,152]],left:[[154,152],[154,152]]},
 'red-panther-commander':{path:'/art/v100/enemies/red-panther-commander-battle-v2.png',right:[[378,162],[378,162]],left:[[166,162],[166,162]]},
});
export function v100RenderedWeaponSocket({kind,state,direction,frame,size,pose,x,y,bob=0,depthScale=1}){
 const definition=V100_WEAPON_SOCKETS[kind];
 if(!definition||!['attack-a','attack-b'].includes(state))return null;
 if(frame.path!==definition.path)throw new Error('Recalibrate the weapon socket for changed atlas: '+kind);
 const point=definition[direction][state==='attack-b'?1:0],facing=direction==='left'?-1:1;
 const localX=(point[0]/frame.sourceRect.w-frame.anchorX)*size.w*(frame.flipX?-1:1)*pose.scaleX;
 const localY=(point[1]/frame.sourceRect.h-frame.anchorY)*size.h*pose.scaleY;
 const angle=pose.rotationRadians*facing,c=Math.cos(angle),s=Math.sin(angle);
 return {
  x:x+pose.offsetX*depthScale*facing+localX*c-localY*s,
  y:y-bob+pose.offsetY*depthScale+localX*s+localY*c,
 };
}
