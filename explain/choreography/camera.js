import {Matrix4,Quaternion,Vector3} from '../../vendor/three/three.module.js';
import {unit,cross} from '../math.js';
export function cameraOrientation(direction,up){
 const z=unit(direction),x=unit(cross(up,z)),y=unit(cross(z,x));
 return new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(new Vector3(...x),new Vector3(...y),new Vector3(...z)));
}
export function cameraBetween(from,to,t){
 const q=from.clone().slerp(to,t);
 return {direction:new Vector3(0,0,1).applyQuaternion(q).toArray(),up:new Vector3(0,1,0).applyQuaternion(q).toArray()};
}
