import {createStaticMeasurementSampler} from '../static-measurement.js';
import {createAxisFrameRenderer} from './axis-frame.js';
import {createRotationSectors} from './rotation-sector.js';
import {createPlaneRenderer} from './plane.js';
import {createMeasurementGuides} from './measurement-guides.js';

export function createVideoMetricOverlays({scene,toWorld,canvas,data,metrics,setPoses}){
 let sampler,keys=[],frame=0;const layers=new Map();
 const clear=()=>{for(const layer of layers.values())layer.dispose();layers.clear();};
 function layerFor(key){
  if(layers.has(key))return layers.get(key);
  const reference=createAxisFrameRenderer(scene,toWorld,2.7,canvas),target=createAxisFrameRenderer(scene,toWorld,4.5,canvas),plane=createPlaneRenderer(scene,toWorld),sectors=createRotationSectors(scene,toWorld),guides=createMeasurementGuides(toWorld,canvas);
  const layer={update(state){reference.update(state.referenceAxes);target.update(state.torsoAxes);plane.update(state.plane);sectors.update(state.sectors);guides.update(state.guides);},updateView(camera,w,h){reference.updateView(camera,w,h);target.updateView(camera,w,h);guides.updateView(camera,w,h);},dispose(){reference.dispose();target.dispose();plane.dispose();sectors.dispose();guides.dispose();}};
  layers.set(key,layer);return layer;
 }
 function update(){
  clearInactive();
  if(!sampler||!keys.length){setPoses(0,1);return;}
  try{for(const {key,state} of sampler.sample(frame,keys))layerFor(key).update(state);setPoses(0,.35);}
  catch(error){clear();setPoses(0,1);console.warn('Measurement overlay unavailable for frame',frame,error);}
 }
 function clearInactive(){for(const [key,layer] of layers)if(!keys.includes(key)){layer.dispose();layers.delete(key);}}
 return {
  setMetric(entry,selected){clear();sampler=createStaticMeasurementSampler(data,metrics,entry);keys=[...selected];update();},
  setSelection(selected){keys=[...selected];update();},setFrame(value){frame=value;update();},
  updateView(camera,w,h){for(const layer of layers.values())layer.updateView(camera,w,h);},
  dispose(){clear();setPoses(0,1);},
 };
}
