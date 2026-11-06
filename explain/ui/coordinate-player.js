import {bindWindowPlayback} from './window-input.js';
import {createPlaybackClock} from './playback.js';
import {make} from './dom.js';
import {createRotationSectors} from './rotation-sector.js';
import {axisColors} from '../palette.js';
import {createPlaneRenderer} from './plane.js';
import {createAxisFrameRenderer} from './axis-frame.js';
export function mountCoordinatePlayer(root,model,{scene,toWorld,setPoses,draw,canvas,setFocus,setCamera,setPairFocus},createPlan){
 const plan=createPlan(model),plane=createPlaneRenderer(scene,toWorld),reference=createAxisFrameRenderer(scene,toWorld,2,canvas),torso=createAxisFrameRenderer(scene,toWorld,4.5,canvas),sectors=createRotationSectors(scene,toWorld),originalReference=createAxisFrameRenderer(scene,toWorld,2,canvas),originalTorso=createAxisFrameRenderer(scene,toWorld,4.5,canvas);
 root.classList.add('metric-explanation');root.setAttribute('aria-label','Animated measurement coordinate frames');

 const values=make('div',undefined,'explain-item-options'),outputs={};values.setAttribute('role','group');values.setAttribute('aria-label','Rotation values');
 for(const item of model.items){const button=make('button');button.type='button';const output=make('strong','0.00°');button.style.setProperty('--metric-axis-color',axisColors[(plan.valueAxes??{turn:'y',bend:'x',tilt:'z'})[item.key]]);button.append(make('span',item.label),output);values.append(button);outputs[item.key]={button,output};button.onclick=()=>seek(plan.segments.find(s=>s.id===item.key).start);}
 const slider=make('input',undefined,'explain-time-slider');slider.type='range';slider.min=0;slider.max=plan.duration;slider.step='any';slider.value=0;slider.setAttribute('aria-label','Explanation timeline');
 root.append(values,slider);
 let time=0,windowPlayback;const playing=!matchMedia('(prefers-reduced-motion: reduce)').matches;

 function render(){
  const state=plan.sample(time);originalReference.update(state.originalReferenceAxes);originalTorso.update(state.originalTorsoAxes);reference.update(state.referenceAxes);torso.update(state.torsoAxes);sectors.update(state.sectors);plane.update(state.plane);setPairFocus(state.pairFocus);setCamera(state.camera);setPoses(state.referencePose,state.selectedPose,state.jointHighlights);setFocus(state.focusOrigin??plan.frames.torso.origin,state.focus);slider.value=time;slider.setAttribute('aria-valuetext',state.title);
  for(const [key,{button,output}] of Object.entries(outputs)){output.textContent=state.values[key].toFixed(2)+'°';button.setAttribute('aria-pressed',String(state.active===key));}
  draw();
 }
 function seek(value){time=Math.max(0,Math.min(plan.duration,Number(value)));clock.setPlaying(false);render();}
 const clock=createPlaybackClock({root,target:canvas,playing,onPlayingChange:value=>windowPlayback?.update(value),onAdvance:delta=>{time=(time+delta)%plan.duration;render();}});
 windowPlayback=bindWindowPlayback(canvas,clock);
 slider.oninput=()=>seek(slider.value);
 render();
 return {updateView(camera,w,h){originalReference.updateView(camera,w,h);originalTorso.updateView(camera,w,h);reference.updateView(camera,w,h);torso.updateView(camera,w,h);},dispose(){windowPlayback.dispose();clock.dispose();originalReference.dispose();originalTorso.dispose();reference.dispose();torso.dispose();sectors.dispose();plane.dispose();setPoses(.5,1);}};
}
