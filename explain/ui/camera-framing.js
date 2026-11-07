import {Vector3} from '../../vendor/three/three.module.js';
// Fit a complete joint pair and arrow, using the narrower viewport angle so
// portrait and landscape viewports both preserve margin around the endpoints.
export function fitPairCamera(focus,toWorld,halfFov,defaultDistance,defaultTarget,defaultZoom=1){
 const points=focus.points.map(toWorld),center=new Vector3();
 points.forEach(point=>center.add(point));center.multiplyScalar(1/points.length);
 const radius=Math.max(.035,...points.map(point=>point.distanceTo(center)));
 const distance=radius/(Math.sin(halfFov)*.62)*(focus.distanceScale??1);
 return {zoom:1+(defaultZoom-1)*(1-focus.amount),target:defaultTarget.clone().lerp(center,focus.amount),distance:defaultDistance+(Math.min(defaultDistance,distance)-defaultDistance)*focus.amount};
}
