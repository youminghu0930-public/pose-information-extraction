import {openingSegments,sampleOpening} from './opening.js';
import {createRotationReview} from './rotation-review.js';
import {createConstructionCamera} from './construction-camera.js';
import {constructionSegments,scheduleSegments} from './construction.js';
import {sampleConstruction as sampleFrameConstruction} from './construction-state.js';
import {frameDefinitions,constructAxes,completedAxes,mix} from './axis-frame.js';
import {createIntrinsicRotation} from './intrinsic-rotation.js';
import {ease,clamp} from '../ui/timeline.js';
import {cameraOrientation,cameraBetween,uprightCamera} from './camera.js';
export function createTorsoChoreography(model){
 const {data,meta,entry}=model.context,frames=frameDefinitions(data,meta,entry.frame),values=Object.fromEntries(model.items.map(item=>[item.key,item.computed]));
 const segments=[...openingSegments(),{id:'reference-focus',title:'Reference pose',duration:1100},...constructionSegments('reference',frames.reference,'Reference'),
  {id:'selected-focus',title:'Selected pose',duration:1300},...constructionSegments('torso',frames.torso,'Torso'),
  {id:'compare',title:'Two coordinate frames',duration:1200,motionDuration:700},
  {id:'align',title:'Align origins and lengths',duration:2700,motionDuration:2200},
  ...['turn','bend','tilt'].flatMap(key=>[
   {id:'camera-'+key,title:'View along '+({turn:'Y',bend:'X',tilt:'Z'}[key])+' axis',duration:1800,motionDuration:1300,cameraFor:key},
   {id:key,title:{turn:'Turn · Y axis',bend:'Forward bend · X axis',tilt:'Side tilt · Z axis'}[key],duration:3900,motionDuration:3400},
  ]),{id:'finish',title:'Aligned',duration:3000,completion:true},{id:'reset',title:'Reference + selected pose',duration:1200}];
 const total=scheduleSegments(segments,entry.duration,entry.stay);
 const rotation=createIntrinsicRotation(frames.reference,frames.torso,meta,values);
 const review=createRotationReview(frames.reference,rotation);
 const front=cameraOrientation(frames.reference.z,frames.reference.y);
 const cameras=Object.fromEntries(Object.entries(frames).map(([key,frame])=>[key,createConstructionCamera(frame,front)]));
 function sampleState(time){
  const t=clamp(time/total)*total,s=segments.find(segment=>t<segment.end)??segments.at(-1),elapsed=t-s.start,progress=clamp(elapsed/s.duration),p=ease(clamp(elapsed/(s.motionDuration??s.duration)));
  const state={segment:s.id,title:s.title,progress,referencePose:.5,selectedPose:1,referenceAxes:null,torsoAxes:null,values:{turn:0,bend:0,tilt:0},active:null,focus:0,camera:cameraBetween(front,front,1),sectors:[],jointHighlights:[],pairFocus:null};
  function sampleConstruction(key){
   const result=sampleFrameConstruction(frames[key],s,p,key==='reference'?'reference':'selected');
   state.jointHighlights=result.highlights;return result.axes;
  }
  if(sampleOpening(state,s,p,values))return state;
  if(s.id==='reference-focus'){state.referencePose=.5-.22*p;state.selectedPose=1-p;return state;}
  if(s.constructionCamera){
   const key=s.constructionCamera,f=frames[key];
   state.referencePose=key==='reference'?.28:0;state.selectedPose=key==='torso'?.28:0;
   const axes=constructAxes(f,s.step,s.view==='out'?1:0);
   state.referenceAxes=key==='reference'?axes:completedAxes(frames.reference);
   if(key==='torso')state.torsoAxes=axes;
   Object.assign(state,cameras[key](s.view,p));return state;
  }
  if(s.id.startsWith('reference-')){
   state.referencePose=.28;state.selectedPose=0;state.referenceAxes=sampleConstruction('reference');
   Object.assign(state,cameras.reference(s.step==='orthogonalize'?'orthogonalize':['plane','forward','plane-fade'].includes(s.step)?'cross-hold':'hold',1));
   return state;
  }
  state.referenceAxes=completedAxes(frames.reference);
  if(s.id==='selected-focus'){state.referencePose=.28*(1-p);state.selectedPose=.28*p;return state;}
  state.referencePose=0;
  if(s.id.startsWith('torso-')){
   state.selectedPose=.28;state.torsoAxes=sampleConstruction('torso');
   Object.assign(state,cameras.torso(s.step==='orthogonalize'?'orthogonalize':['plane','forward','plane-fade'].includes(s.step)?'cross-hold':'hold',1));
   return state;
  }
  state.torsoAxes=completedAxes(frames.torso,.42);
  if(s.id==='compare'){state.selectedPose=.28-.18*p;state.torsoAxes.opacity=1-.58*p;return state;}
  state.selectedPose=.1;
  if(s.id==='align'){
   state.referenceAxes=completedAxes({...frames.reference,origin:mix(frames.reference.origin,frames.torso.origin,p),length:frames.reference.length*(1-p)+frames.torso.length*p});state.focus=ease(clamp((p-.7)/.3));return state;
  }
  state.focus=1;
  if(s.id==='finish')return review.sample(state,progress,s.duration);
  rotation.sample(state,s,p);
  if(s.id==='reset'&&segments.find(segment=>segment.completion).duration>0){
   state.camera=cameraBetween(review.view,front,p);state.focus=review.focus*(1-p);
   state.selectedPose=review.pose+(1-review.pose)*p;
  }
  return state;
 }
 function sample(time){const state=sampleState(time);if(state.segment==='reset')state.referencePose=0;state.camera=uprightCamera(state.camera,frames.reference.y);return state;}
 return {segments,duration:total,frames,values,sample};
}
