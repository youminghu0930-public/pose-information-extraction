import {reviewTiming} from './review-timing.js';
import {avoidEndOn} from './pair-camera.js';
import {add,sub,mul,unit,project,cross,rotate,dot,deg} from '../math.js';
import {frameDefinitions,completedAxes,constructAxes,mix} from './axis-frame.js';
import {constructionSegments} from './construction.js';
import {sampleConstruction} from './construction-state.js';
import {createConstructionCamera} from './construction-camera.js';
import {projectionMotion,projectionView} from './vector-projection.js';
import {jointPairArrow,jointPairEmphasis,pairFocusStage,pairReleaseStage} from './joint-pair.js';
import {cameraOrientation,cameraBetween,uprightCamera,uprightCameraBetween} from './camera.js';
import {scheduleTimeline} from '../timing.js';
import {ease,clamp} from '../ui/timeline.js';

// Signed rotation between two projections onto a moving, lower-spine plane.
// Joint choice is the only difference between hip and shoulder variants.
export function createSpinePlaneChoreography(model){
 const c=model.context,{entry,meta}=c;
 const reference=frameDefinitions(c.data,meta,entry.frame).reference;
 const joint=entry.subtype.startsWith('shoulder')?'shoulder':'hip';
 const lateral=c.lateral(joint),spine=c.spine('lower');
 const sourcePair=feature=>({from:c.source(feature.from),to:c.source(feature.to),joints:feature.joints});
 const pairs={lateral:sourcePair(lateral),up:sourcePair(spine)};
 const origin=pairs.up.from,n=unit(sub(pairs.up.to,origin)),raw=unit(sub(pairs.lateral.to,pairs.lateral.from));
 const base=reference.x,x=unit(project(base,n)),target=unit(project(raw,n)),z=unit(cross(x,n));
 const L=Math.max(Math.hypot(...sub(pairs.lateral.to,pairs.lateral.from))*.65,Math.hypot(...sub(pairs.up.to,origin)));
 const frame={origin,x,y:n,z,length:L},torso={...frame,x:target,z:unit(cross(target,n))};
 const values={turn:model.items[0].computed};
 const front=cameraOrientation(reference.z,reference.y),oblique=cameraOrientation(add(add(z,mul(x,.5)),mul(n,.65)),reference.y),face=cameraOrientation(n,reference.y);
 const preferred=add(add(z,mul(x,.5)),mul(n,.65));
 const baselineView=projectionView(base,n,reference.y,preferred),lateralView=projectionView(raw,n,reference.y,preferred);
 const uprightBetween=(a,b,p)=>uprightCameraBetween(a,b,p,reference.y,reference.z);
 const spineView=avoidEndOn(oblique,pairs.up,reference.y);
 const stretchView=avoidEndOn(baselineView,pairs.lateral,reference.y,joint==='shoulder'?{maxAlignment:.5,targetAlignment:.4}:undefined);
 const referenceCamera=createConstructionCamera(reference,front);
 const points=[...Object.values(pairs).flatMap(p=>[p.from,p.to]),...[-1,1].flatMap(a=>[-1,1].map(b=>add(origin,add(mul(x,L*a),mul(z,L*b))))),add(origin,mul(n,L))];
 const action=(id,duration=1600,extra={})=>({id,title:id.replaceAll('-',' '),duration:duration+500,motionDuration:duration,...extra});
 const pairStages=name=>[
  {...pairFocusStage('selected',name,name),id:name+'-focus',pair:name,phase:'focus'},
  action(name+'-grow',1600,{pair:name,phase:'grow'}),
  {...pairReleaseStage('selected',name,name),id:name+'-release',pair:name,phase:'release'},
  action(name+'-align',1400,{pair:name,phase:'align'}),
 ];
 const segments=[action('intro',2200),action('reference-focus',1100),...constructionSegments('reference',reference),
  action('selected-focus',1700),action('measurement-camera',1800),...pairStages('up'),action('plane',1400),
  action('reference-align',1800),action('reference-trim',1200),
  action('baseline-camera',1500),action('baseline-angle',700,{hold:2300}),action('baseline-project',1800),action('baseline-fade',1200),
  ...(stretchView===baselineView?[]:[action('lateral-stretch-camera',1500)]),...pairStages('lateral'),action('lateral-camera',1500),action('lateral-angle',700,{hold:2300}),action('lateral-project',1800),action('lateral-fade',1200),
  action('normalize',1200),action('rotation-camera',1600),action('turn',3400),
  {id:'finish',title:'Review the lower-spine turn',duration:6000,completion:true},action('reset',1200)];
 for(const s of segments)if(s.hold)s.duration=s.motionDuration+s.hold;
 const duration=scheduleTimeline(segments,entry.duration,entry.stay);
 const idx=id=>segments.findIndex(s=>s.id===id),has=(s,id)=>idx(id)>=0&&segments.indexOf(s)>=idx(id);
 const arrow=(direction)=>({from:origin,to:add(origin,mul(direction,L))});
 function axes(direction,opacity=1){const a=completedAxes(frame,opacity);a.x=arrow(direction);a.y=arrow(n);a.z=null;return a;}
 function angleMarker(direction,progress,opacity){
  const d=unit(direction),angle=deg(Math.acos(Math.max(-1,Math.min(1,dot(n,d)))));
  return {origin,from:n,normal:unit(cross(n,d)),angle,radius:L*.38,axis:'y',rightAngle:true,squareProgress:ease(clamp((progress-.65)/.35)),opacity};
 }
 function rotationState(state,p){
  state.referenceAxes=axes(rotate(x,n,values.turn*p));state.referenceAxes.y=null;
  state.torsoAxes=axes(target,.42);
  state.values.turn=p===0?0:values.turn*p;state.active='turn';
  state.sectors=[{origin,from:x,normal:n,angle:values.turn*p,radius:L*.8,axis:'y'}];
 }
 function sampleState(time){
  const s=segments.find(s=>time<s.end)??segments.at(-1),elapsed=time-s.start;
  const progress=clamp(elapsed/s.duration),p=ease(clamp(elapsed/(s.motionDuration??s.duration)));
  const state={segment:s.id,title:s.title,progress,referencePose:.5,selectedPose:1,referenceAxes:null,torsoAxes:null,values:{turn:0},active:null,focus:0,focusOrigin:origin,camera:cameraBetween(front,front,1),sectors:[],jointHighlights:[],pairFocus:null,plane:null};
  if(s.id==='intro')return state;
  if(s.id==='reference-focus'){state.referencePose=.5-.22*p;state.selectedPose=1-p;return state;}
  if(s.id.startsWith('reference-')&&s.step){
   state.referencePose=.28;state.selectedPose=0;
   if(s.constructionCamera){state.referenceAxes=constructAxes(reference,s.step,s.view==='out'?1:0);Object.assign(state,referenceCamera(s.view,p));}
   else {const result=sampleConstruction(reference,s,p,'reference');state.referenceAxes=result.axes;state.jointHighlights=result.highlights;Object.assign(state,referenceCamera(s.step==='orthogonalize'?'orthogonalize':['plane','forward','plane-fade'].includes(s.step)?'cross-hold':'hold',1));}
   return state;
  }
  state.referencePose=0;state.selectedPose=.28;state.referenceAxes=completedAxes(reference);
  if(s.id==='selected-focus'){
   state.referencePose=.28*(1-p);state.selectedPose=.28*p;return state;
  }
  const aligned=has(s,'reference-align'),move=s.id==='reference-align'?p:aligned?1:0;
  const refFrame={...reference,origin:mix(reference.origin,origin,move),length:reference.length*(1-move)+L*move};
  state.referenceAxes=completedAxes(refFrame);
  // Keep both the waiting reference frame and the spine plane in view.
  const refBounds=[refFrame.origin,...['x','y','z'].map(key=>add(refFrame.origin,mul(refFrame[key],refFrame.length)))];
  const fitPoints=[...points,...refBounds];
  state.camera=uprightBetween(front,spineView,s.id==='measurement-camera'?p:1);
  state.pairFocus={points:fitPoints,amount:s.id==='measurement-camera'?p:1};
  if(has(s,'baseline-camera'))state.camera=uprightBetween(spineView,baselineView,s.id==='baseline-camera'?p:1);
  if(has(s,'lateral-stretch-camera'))state.camera=uprightBetween(baselineView,stretchView,s.id==='lateral-stretch-camera'?p:1);
  if(has(s,'lateral-camera'))state.camera=uprightBetween(stretchView,lateralView,s.id==='lateral-camera'?p:1);
  if(s.id==='measurement-camera')return state;
  state.torsoAxes=axes(raw,.65);state.torsoAxes.x=has(s,'lateral-focus')?arrow(raw):null;
  if(s.pair){
   const pair=pairs[s.pair],aligned=arrow(s.pair==='up'?n:raw);
   const result=jointPairArrow(pair,aligned,s.phase,p);
   state.jointHighlights=[{pose:'selected',joints:pair.joints,strength:jointPairEmphasis(s.phase,p)}];
   if(s.pair==='lateral')state.torsoAxes.x=result;
   else state.torsoAxes.y=result;
  }
  if(has(s,'plane'))state.plane={origin,u:x,v:z,size:L*(s.id==='plane'?p:1),opacity:1};
  if(s.id==='reference-trim'){state.referenceAxes.y.opacity=1-p;state.referenceAxes.z.opacity=1-p;}
  if(has(s,'baseline-camera')){state.referenceAxes.y=null;state.referenceAxes.z=null;}
  if(!has(s,'baseline-angle'))return state;
  let baseDirection=base,lateralDirection=raw;
  if(has(s,'baseline-project')){
   const phase=s.id==='baseline-project'?'project':'fade';
   const projection=projectionMotion(base,n,phase,s.id==='baseline-fade'?p:phase==='project'?p:1);
   baseDirection=projection.direction;
   if(projection.originalOpacity>0){state.originalReferenceAxes=axes(base,projection.originalOpacity);state.originalReferenceAxes.y=null;}
  }
  if(has(s,'lateral-project')){
   const phase=s.id==='lateral-project'?'project':'fade';
   const projection=projectionMotion(raw,n,phase,s.id==='lateral-fade'?p:phase==='project'?p:1);
   lateralDirection=projection.direction;
   if(projection.originalOpacity>0){state.originalTorsoAxes=axes(raw,.65*projection.originalOpacity);state.originalTorsoAxes.y=null;}
  }
  if(has(s,'normalize')){
   const amount=s.id==='normalize'?p:1;baseDirection=mix(project(base,n),x,amount);lateralDirection=mix(project(raw,n),target,amount);
  }
  state.referenceAxes.x=arrow(baseDirection);
  // Pair stages retain their actual source endpoints until alignment is done.
  if(!s.pair&&has(s,'lateral-focus'))state.torsoAxes.x=arrow(lateralDirection);
  if(['baseline-angle','baseline-project'].includes(s.id))state.referenceAxes.angleMarker=angleMarker(baseDirection,s.id==='baseline-project'?p:0,s.id==='baseline-angle'?p:1);
  if(['lateral-angle','lateral-project'].includes(s.id))state.torsoAxes.angleMarker=angleMarker(lateralDirection,s.id==='lateral-project'?p:0,s.id==='lateral-angle'?p:1);
  if(s.id==='rotation-camera'){state.camera=uprightBetween(lateralView,face,p);return state;}
  if(s.id==='turn'){rotationState(state,p);state.camera=cameraBetween(face,face,1);return state;}
  if(s.id==='finish'){
   const timing=reviewTiming(progress,s.duration);
   if(timing.holding){rotationState(state,1);state.camera=cameraBetween(face,face,1);return state;}
   const reviewProgress=timing.progress;
   state.pairFocus=null;
   if(reviewProgress<.22){
    rotationState(state,1);const t=ease(reviewProgress/.22);state.referenceAxes.opacity=1-t;state.values.turn=0;state.sectors=[];
    state.camera=uprightBetween(face,oblique,t);state.pairFocus={points:fitPoints,amount:1-t};state.focus=.32*t;
   }else if(reviewProgress<.4){
    rotationState(state,0);state.referenceAxes.opacity=ease((reviewProgress-.22)/.18);state.sectors=[];state.focus=.32;state.camera=cameraBetween(oblique,oblique,1);
   }else{
    rotationState(state,ease(clamp((reviewProgress-.48)/.4)));state.focus=.32;state.camera=cameraBetween(oblique,oblique,1);
   }
   const reveal=ease(clamp(reviewProgress/.22));
   state.selectedPose=.28+.02*reveal;state.plane.opacity=1-.4*reveal;return state;
  }
  if(s.id==='reset'){
   rotationState(state,1);state.referenceAxes.opacity=1-p;state.torsoAxes.opacity=.42*(1-p);state.plane.opacity=.6*(1-p);
   state.pairFocus=null;state.focus=.32*(1-p);state.camera=cameraBetween(oblique,front,p);state.referencePose=.5*p;state.selectedPose=.3+.7*p;state.sectors=[];
  }
  return state;
 }
 function sample(time){const state=sampleState(time);state.camera=uprightCamera(state.camera,reference.y);return state;}
 return {segments,duration,frames:{reference,torso},values,sample};
}
