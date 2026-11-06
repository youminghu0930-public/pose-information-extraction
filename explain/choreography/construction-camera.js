import {crossProductView} from './cross-product.js';
import {cameraOrientation,cameraBetween} from './camera.js';

// One set of framing bounds for the entire construction. Small steps only turn
// the close-up camera when necessary; they never pull back to the whole pose.
export function createConstructionCamera(frame,overview){
 const cross=crossProductView(frame);
 const points=[...cross.points,...Object.values(frame.jointPairs).flatMap(pair=>[pair.from,pair.to])];
 const face=cameraOrientation(frame.z,frame.y);
 return (phase,progress)=>{
  const amount=phase==='in'?progress:phase==='out'?1-progress:1;
  const from=phase==='in'?overview:phase==='cross'?face:cross.orientation;
  const to=phase==='out'?overview:phase==='angle'||phase==='orthogonalize'?face:cross.orientation;
  const t=['in','out','angle','cross'].includes(phase)?progress:1;
  return {pairFocus:{points,amount},camera:cameraBetween(from,to,t)};
 };
}
