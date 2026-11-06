import {crossProductView} from './cross-product.js';
import {cameraOrientation,cameraBetween} from './camera.js';
import {avoidEndOn} from './pair-camera.js';

// Preserve the original shared close-up; adjust only near end-on stretches.
export function createConstructionCamera(frame,overview,globalUp=[0,-1,0]){
 const cross=crossProductView(frame);
 const points=[...cross.points,...Object.values(frame.jointPairs).flatMap(pair=>[pair.from,pair.to])];
 const face=cameraOrientation(frame.z,frame.y);
 let growth=cross.orientation;
 for(const pair of Object.values(frame.jointPairs))growth=avoidEndOn(growth,pair,globalUp);
 return (phase,progress)=>{
  const amount=phase==='in'?progress:phase==='out'?1-progress:1;
  const from=phase==='in'?overview:phase==='cross'?face:phase==='out'?cross.orientation:growth;
  const to=phase==='out'?overview:phase==='angle'||phase==='orthogonalize'?face:phase==='in'||phase==='hold'?growth:cross.orientation;
  const t=['in','out','angle','cross'].includes(phase)?progress:1;
  return {pairFocus:{points,amount},camera:cameraBetween(from,to,t)};
 };
}
