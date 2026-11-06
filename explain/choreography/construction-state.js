import {constructAxes} from './axis-frame.js';
import {jointPairEmphasis} from './joint-pair.js';
// Shared joint emphasis, arrow construction and angle reveal for any frame.
export function sampleConstruction(frame,segment,p,pose){
 const pair=segment.jointPair;
 const highlights=pair?[{pose,joints:frame.jointPairs[pair.name].joints,strength:jointPairEmphasis(pair.phase,p)}]:[];
 let axes;
 if(pair?.name==='up')axes=constructAxes(frame,segment.step,p,pair.phase);
 else if(pair)axes=constructAxes(frame,segment.step,pair.phase==='focus'?0:pair.phase==='release'?1:p);
 else if(segment.anglePhase){
  axes=constructAxes(frame,segment.step,segment.anglePhase==='remove'?.28+.72*p:0);
  axes.angleMarker.opacity=segment.anglePhase==='reveal'?p:1;
 }else axes=constructAxes(frame,segment.step,p);
 return {axes,highlights};
}
