import {bindWindowPlayback} from './window-input.js';
import {createPlaybackClock} from './playback.js';
import {make} from './dom.js';
import {createRecipeTimeline} from './recipe-timeline.js';
export function mountExplanationPanel(root,model,{show,animate,canvas}){
 root.classList.add('metric-explanation');root.setAttribute('aria-label','Animated measurement explanation');
 root.append(make('p',model.category,'explain-category'),make('h5',model.title,'explain-title'));
 const choices=make('div',undefined,'explain-item-options');choices.setAttribute('role','group');choices.setAttribute('aria-label','Measurement component');
 const progress=make('progress');progress.max=1;progress.value=0;progress.setAttribute('aria-label','Construction progress');
 root.append(choices,progress);
 let windowPlayback,lastSegment;const buttons=[];let time=0,plan=createRecipeTimeline(model.items,model.context.entry.duration,undefined,model.context.entry.stay);
 const playing=!matchMedia('(prefers-reduced-motion: reduce)').matches;
 function render(){
  const {segment,progress:amount}=plan.sample(time);
  if(segment!==lastSegment){
   buttons.forEach((button,i)=>button.setAttribute('aria-pressed',String(i===(segment.itemIndex??0))));
   show(segment.intro?[]:model.items[segment.itemIndex].steps[segment.stepIndex].visuals);lastSegment=segment;
  }
  progress.value=segment.intro?0:amount;if(!segment.intro)animate(amount);
 }
 function restart(selected){plan=createRecipeTimeline(model.items,model.context.entry.duration,selected,model.context.entry.stay);time=0;lastSegment=undefined;clock.setPlaying(true);render();}
 model.items.forEach((item,i)=>{
  const b=make('button');b.type='button';b.append(make('span',item.label),make('strong',`${item.value.toFixed(2)}${item.unit}`));b.onclick=()=>restart(i);choices.append(b);buttons.push(b);
 });
 const clock=createPlaybackClock({root,target:root.parentElement.querySelector('canvas')??root,playing,onPlayingChange:value=>windowPlayback?.update(value),onAdvance:delta=>{time=(time+delta)%plan.duration;render();}});
 windowPlayback=bindWindowPlayback(canvas,clock);
 if(!playing)time=plan.duration;
 render();
 return {dispose(){windowPlayback.dispose();clock.dispose();}};
}
