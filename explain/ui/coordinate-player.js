import {createCaptionTimeline} from '../caption-timing.js';
import {createStepCaptions} from './captions.js';
import {bindWindowPlayback} from './window-input.js';
import {createPlaybackClock} from './playback.js';
import {make} from './dom.js';
import {createRotationSectors} from './rotation-sector.js';
import {measurementColor} from '../measurement-colors.js';
import {createPlaneRenderer} from './plane.js';
import {createAxisFrameRenderer} from './axis-frame.js';
import {createBoneGuides} from './bone-guides.js';
import {createMeasurementGuides} from './measurement-guides.js';
import {createVisibilitySampler} from '../choreography/visibility.js';
export function mountCoordinatePlayer(root,model,{scene,toWorld,setPoses,draw,canvas,setFocus,setCamera,setPairFocus},createPlan){
 const plan=createPlan(model),plane=createPlaneRenderer(scene,toWorld),reference=createAxisFrameRenderer(scene,toWorld,2.7,canvas),torso=createAxisFrameRenderer(scene,toWorld,4.5,canvas,plan.targetAxisColors),sectors=createRotationSectors(scene,toWorld),originalReference=createAxisFrameRenderer(scene,toWorld,2.7,canvas),originalTorso=createAxisFrameRenderer(scene,toWorld,4.5,canvas,plan.targetAxisColors);
 const guides=createMeasurementGuides(toWorld,canvas),boneGuides=createBoneGuides(scene,toWorld);
 const visibility=createVisibilitySampler(plan),captions=createStepCaptions(canvas),captionTimeline=createCaptionTimeline(model,plan);
 root.classList.add('metric-explanation');root.setAttribute('aria-label','Animated measurement coordinate frames');

 const values=make('div',undefined,'explain-item-options'),outputs={};values.setAttribute('role','group');values.setAttribute('aria-label','Measurement values');
 for(const item of model.items){const button=make('button');button.type='button';const output=make('strong','0.00'+item.unit);const color=measurementColor(model.context.entry.subtype,item.key);if(color)button.style.setProperty('--metric-axis-color',color);button.append(make('span',item.label),output);values.append(button);outputs[item.key]={button,output};button.onclick=()=>seek(plan.segments.find(s=>s.id===item.key).start);}
 const slider=make('input',undefined,'explain-time-slider');slider.type='range';slider.min=0;slider.max=plan.duration;slider.step='any';slider.value=0;slider.setAttribute('aria-label','Explanation timeline');
 root.append(values,slider);
 let time=0,windowPlayback;const playing=!matchMedia('(prefers-reduced-motion: reduce)').matches;

 function render(){
  const state=visibility.sample(time);captions.update(captionTimeline.sample(time),{immediate:!clock.playing});originalReference.update(state.originalReferenceAxes);originalTorso.update(state.originalTorsoAxes);reference.update(state.referenceAxes);torso.update(state.torsoAxes);sectors.update(state.sectors);plane.update(state.plane);guides.update(state.guides);boneGuides.update(state.boneGuides);setPairFocus(state.pairFocus);setCamera(state.camera);setPoses(state.referencePose,state.selectedPose,state.jointHighlights,state.boneHighlights);setFocus(state.focusOrigin??plan.frames.torso.origin,state.focus);slider.value=time;slider.setAttribute('aria-valuetext',state.title);
  for(const [key,{button,output}] of Object.entries(outputs)){const color=state.valueColors?.[key]??measurementColor(model.context.entry.subtype,key);if(color)button.style.setProperty('--metric-axis-color',color);output.textContent=state.values[key].toFixed(2)+model.items.find(item=>item.key===key).unit;button.setAttribute('aria-pressed',String(state.active===key));}
  draw();
 }
 function seek(value){time=Math.max(0,Math.min(plan.duration,Number(value)));clock.setPlaying(false);render();}
 const clock=createPlaybackClock({root,target:canvas,playing,onPlayingChange:value=>windowPlayback?.update(value),onAdvance:delta=>{time=(time+delta)%plan.duration;render();}});
 windowPlayback=bindWindowPlayback(canvas,clock);
 slider.oninput=()=>seek(slider.value);
 render();
 return {updateView(camera,w,h){originalReference.updateView(camera,w,h);originalTorso.updateView(camera,w,h);reference.updateView(camera,w,h);torso.updateView(camera,w,h);guides.updateView(camera,w,h);},dispose(){windowPlayback.dispose();clock.dispose();originalReference.dispose();originalTorso.dispose();reference.dispose();torso.dispose();sectors.dispose();plane.dispose();guides.dispose();boneGuides.dispose();captions.dispose();setPoses(.5,1);}};
}
