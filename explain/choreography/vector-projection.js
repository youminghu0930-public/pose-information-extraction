import {cameraOrientation} from './camera.js';
import {project,cross,unit,dot,add,mul} from '../math.js';
import {mix} from './axis-frame.js';
// Keep the source visible while its copy drops perpendicularly onto the plane.
// Only the following fade phase removes the source arrow.
export function projectionMotion(direction,normal,phase,progress){
 const projected=project(direction,normal);
 return {direction:phase==='project'?mix(direction,projected,progress):projected,originalOpacity:phase==='fade'?1-progress:1};
}

// View the difference plane nearly face-on, preserving global vertical.
export function projectionView(direction,normal,globalUp,preferred){
 let face=unit(cross(normal,direction));
 if(dot(face,preferred)<0)face=mul(face,-1);
 return cameraOrientation(add(face,mul(normal,.12)),globalUp);
}
