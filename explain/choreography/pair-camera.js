import {sub,unit,project,length} from '../math.js';
import {cameraOrientation} from './camera.js';
// View perpendicular to the pair, keeping the complete source and aligned arrow
// in a padded bounding sphere. Definitions stay in source coordinates.
export function pairCamera(pair,aligned,preferredDirection=[0,0,-1],up=[0,-1,0]){
 const direction=unit(sub(pair.to,pair.from));
 let normal=project(preferredDirection,direction);
 if(length(normal)<1e-6)normal=project(Math.abs(direction[1])<.9?[0,1,0]:[1,0,0],direction);
 const normalUnit=unit(normal);
 let vertical=project(up,normalUnit);
 if(length(vertical)<1e-6)vertical=project(direction,normalUnit);
 const points=[pair.from,pair.to,...(aligned?[aligned.from,aligned.to]:[])];
 return {points,orientation:cameraOrientation(normalUnit,vertical)};
}
