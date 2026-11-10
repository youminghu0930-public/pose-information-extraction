import {make} from './dom.js';
import {measurementChannels} from '../measurement-series.js';
import {createMeasurementPlot} from './measurement-plot.js';

export function createVideoMeasurements({entry,metrics,frameCount,onSelection,selectedKeys=[]}){
 const channels=measurementChannels(metrics,entry,frameCount),selected=new Set(selectedKeys),outputs=new Map();
 const measurements=make('div',undefined,'explain-item-options video-measurement-values');measurements.setAttribute('role','group');measurements.setAttribute('aria-label','Select measurement overlays');
 for(const channel of channels){
  const button=make('button');button.type='button';button.style.setProperty('--metric-axis-color',channel.color);button.setAttribute('aria-pressed',String(selected.has(channel.key)));button.title=`Show ${channel.label.toLowerCase()} reference, measurement and curve`;
  const value=make('strong');button.append(make('span',channel.label),value);measurements.append(button);outputs.set(channel.key,value);
  button.onclick=()=>{if(selected.has(channel.key))selected.delete(channel.key);else selected.add(channel.key);button.setAttribute('aria-pressed',String(selected.has(channel.key)));plot.setSelection([...selected]);onSelection([...selected]);};
 }
 const plot=createMeasurementPlot(channels,frameCount);if(selectedKeys.length)plot.setSelection(selectedKeys);
 return {measurements,plot:plot.root,update(frame){
  for(const channel of channels){const value=channel.values[frame];outputs.get(channel.key).textContent=Number.isFinite(value)?value.toFixed(2)+channel.unit:'—';}
  plot.update(frame);
 }};
}
