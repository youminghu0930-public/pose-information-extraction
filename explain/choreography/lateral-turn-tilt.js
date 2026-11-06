import {add,sub,mul,unit,project,cross,dot,deg} from '../math.js';
import {frameDefinitions,completedAxes,mix} from './axis-frame.js';
import {createReferencePrelude} from './reference-prelude.js';
import {createDirectionRotation} from './direction-rotation.js';
import {jointPairArrow,jointPairEmphasis} from './joint-pair.js';
import {avoidEndOn} from './pair-camera.js';
import {projectionMotion,projectionView} from './vector-projection.js';
import {cameraOrientation,cameraBetween,uprightCameraBetween,uprightCamera} from './camera.js';
import {scheduleTimeline} from '../timing.js';
import {reviewTiming} from './review-timing.js';
import {ease,clamp} from '../ui/timeline.js';

export function createLateralTurnTiltChoreography(model){
 const c=model.context,{entry,meta}=c,reference=frameDefinitions(c.data,meta,entry.frame).reference;
 const feature=c.lateral(entry.subtype.startsWith('hip')?'hip':'shoulder');
 const pair={from:c.source(feature.from),to:c.source(feature.to),joints:feature.joints};
 const origin=mul(add(pair.from,pair.to),.5),raw=unit(sub(pair.to,pair.from)),L=Math.hypot(...sub(pair.to,pair.from))*.65;
 const values=Object.fromEntries(model.items.map(item=>[item.key,item.computed]));
 const rotation=createDirectionRotation(reference,raw,values),{base,up,horizontal}=rotation;
 const frame={...reference,origin,length:L},torso={...frame,x:raw,y:up,z:unit(cross(raw,up))};
 const front=cameraOrientation(reference.z,up),oblique=cameraOrientation(add(add(reference.z,mul(base,.55)),mul(up,.45)),up);
 const stretch=avoidEndOn(oblique,pair,up,{maxAlignment:.5,targetAlignment:.4});
 const side=projectionView(raw,up,up,add(reference.z,mul(base,.5)));
 const top=cameraOrientation(add(mul(up,Math.cos(Math.PI/30)),mul(reference.z,Math.sin(Math.PI/30))),up);
 const between=(a,b,t)=>uprightCameraBetween(a,b,t,up,reference.z),prelude=createReferencePrelude(reference,front);
 const action=(id,motionDuration=1600,hold=500)=>({id,title:id.replaceAll('-',' '),duration:motionDuration+hold,motionDuration});
 const segments=[action('intro',2200),action('reference-focus',1100),...prelude.segments,action('selected-focus',1300),action('measurement-camera',1800),
  action('reference-align',1800),action('plane',1400),action('reference-trim',1100),
  ...['focus','grow','release','align'].map(phase=>({...action('lateral-'+phase,phase==='grow'?1600:1100),pairPhase:phase})),
  action('projection-camera',1500),action('projection-angle',700,2300),action('projection',1800),action('original-fade',1100),action('normalize',1100),
  action('turn-camera',1500),action('turn',3400),action('tilt-camera',1600),action('tilt-ready',1100),action('tilt',3400),
  {id:'finish',title:'Review shoulder turn and tilt',duration:6000,completion:true},action('reset',1200)];
 const duration=scheduleTimeline(segments,entry.duration,entry.stay),index=id=>segments.findIndex(s=>s.id===id),has=(s,id)=>segments.indexOf(s)>=index(id);
 const arrow=d=>({from:origin,to:add(origin,mul(d,L))});
 function axes(d,opacity=1){const axes=completedAxes(frame,opacity);axes.x=arrow(d);axes.y=null;axes.z=null;return axes;}
 function referenceAxes(d){const result=axes(d);result.y=arrow(up);return result;}
 const points=[pair.from,pair.to,...[-1,1].flatMap(a=>[-1,1].map(b=>add(origin,add(mul(base,L*a),mul(reference.z,L*b))))),add(origin,mul(raw,L))];
 function rotateState(state,key,p){
  const result=rotation.sample(key,p);state.referenceAxes=referenceAxes(result.direction);state.torsoAxes=axes(key==='turn'?horizontal:raw,.42);
  state.values=result.values;state.active=key;state.sectors=[{...result.sector,origin,radius:L*.8}];
 }
 function sampleState(time){
  const s=segments.find(s=>time<s.end)??segments.at(-1),elapsed=time-s.start,progress=clamp(elapsed/s.duration),p=ease(clamp(elapsed/(s.motionDuration??s.duration)));
  const state={segment:s.id,title:s.title,progress,referencePose:.5,selectedPose:1,referenceAxes:null,torsoAxes:null,values:{turn:0,tilt:0},active:null,focus:0,focusOrigin:origin,camera:cameraBetween(front,front,1),sectors:[],jointHighlights:[],pairFocus:null,plane:null};
  if(s.id==='intro')return state;
  if(s.id==='reference-focus'){state.referencePose=.5-.22*p;state.selectedPose=1-p;return state;}
  if(prelude.sample(state,s,p))return state;
  state.referencePose=0;state.selectedPose=.28;state.referenceAxes=completedAxes(reference);
  if(s.id==='selected-focus'){state.referencePose=.28*(1-p);state.selectedPose=.28*p;return state;}
  const move=s.id==='reference-align'?p:has(s,'reference-align')?1:0;
  const ref={...reference,origin:mix(reference.origin,origin,move),length:reference.length*(1-move)+L*move};
  state.referenceAxes=completedAxes(ref);
  const fitPoints=[...points,ref.origin,...['x','y','z'].map(axis=>add(ref.origin,mul(ref[axis],ref.length)))];
  state.pairFocus={points:fitPoints,amount:s.id==='measurement-camera'?p:1};
  state.camera=between(front,stretch,s.id==='measurement-camera'?p:1);
  if(s.id==='measurement-camera')return state;
  state.torsoAxes=has(s,'lateral-focus')?axes(raw,.65):null;

  if(has(s,'plane'))state.plane={origin,u:base,v:reference.z,size:L*(s.id==='plane'?p:1),opacity:1};
  if(s.id==='reference-trim'){state.referenceAxes.z.opacity=1-p;}
  if(has(s,'lateral-focus'))state.referenceAxes.z=null;
  if(s.pairPhase){state.torsoAxes.x=jointPairArrow(pair,arrow(raw),s.pairPhase,p);state.jointHighlights=[{pose:'selected',joints:pair.joints,strength:jointPairEmphasis(s.pairPhase,p)}];return state;}
  if(!has(s,'projection-camera'))return state;
  state.referenceAxes=referenceAxes(base);state.camera=between(stretch,side,s.id==='projection-camera'?p:1);
  if(s.id==='projection-angle'){
   state.torsoAxes.angleMarker={origin,from:up,normal:unit(cross(up,raw)),angle:deg(Math.acos(Math.max(-1,Math.min(1,dot(up,raw))))),radius:L*.38,axis:'y',opacity:p,rightAngle:true,squareProgress:0};
  }
  if(has(s,'projection')){
   const phase=s.id==='projection'?'project':'fade',q=projectionMotion(raw,up,phase,s.id==='original-fade'?p:phase==='project'?p:1);
   state.torsoAxes=axes(q.direction,.65);
   if(q.originalOpacity>0)state.originalTorsoAxes=axes(raw,.65*q.originalOpacity);
   if(s.id==='projection'){
    const d=unit(q.direction);
    state.torsoAxes.angleMarker={origin,from:up,normal:unit(cross(up,d)),angle:deg(Math.acos(Math.max(-1,Math.min(1,dot(up,d))))),radius:L*.38,axis:'y',opacity:1,rightAngle:true,squareProgress:ease(clamp((p-.65)/.35))};
   }
  }
  if(s.id==='normalize')state.torsoAxes=axes(mix(project(raw,up),horizontal,p),.65-.23*p);
  if(has(s,'turn-camera'))state.torsoAxes=axes(horizontal,.42);
  if(s.id==='turn-camera'){state.camera=between(side,top,p);return state;}
  if(s.id==='turn'){rotateState(state,'turn',p);state.camera=between(top,top,1);return state;}
  if(s.id==='tilt-camera'||s.id==='tilt-ready'){
   rotateState(state,'tilt',0);state.sectors=[];
   const amount=s.id==='tilt-camera'?p:1;state.torsoAxes.opacity=.42*amount;state.camera=between(top,side,amount);return state;
  }
  if(s.id==='tilt'){rotateState(state,'tilt',p);state.camera=between(side,side,1);return state;}
  if(s.id==='finish'){
   const timing=reviewTiming(progress,s.duration);rotateState(state,'tilt',1);state.camera=between(side,side,1);
   if(timing.holding)return state;
   const q=timing.progress;
   if(q<.22){const t=ease(q/.22);state.referenceAxes.opacity=1-t;state.values={turn:0,tilt:0};state.sectors=[];state.camera=between(side,oblique,t);state.pairFocus={points:fitPoints,amount:1-t};state.focus=.32*t;}
   else{
    state.pairFocus=null;state.focus=.32;state.camera=between(oblique,oblique,1);
    if(q<.38){rotateState(state,'turn',0);state.referenceAxes.opacity=ease((q-.22)/.16);state.sectors=[];}
    else if(q<.64)rotateState(state,'turn',ease(clamp((q-.44)/.2)));
    else rotateState(state,'tilt',ease(clamp((q-.71)/.2)));
   }
   const t=ease(clamp(q/.22));state.selectedPose=.28+.02*t;state.plane.opacity=1-.4*t;return state;
  }
  if(s.id==='reset'){
   rotateState(state,'tilt',1);state.referenceAxes.opacity=1-p;state.torsoAxes.opacity=.42*(1-p);state.plane.opacity=.6*(1-p);state.sectors=[];
   state.pairFocus=null;state.focus=.32*(1-p);state.camera=between(oblique,front,p);state.referencePose=.5*p;state.selectedPose=.3+.7*p;
  }
  return state;
 }
 function sample(time){const state=sampleState(time);state.camera=uprightCamera(state.camera,up);return state;}
 return {segments,duration,frames:{reference,torso},values,valueAxes:{turn:'y',tilt:'z'},sample};
}
