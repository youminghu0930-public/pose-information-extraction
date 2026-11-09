import {channelPath,sharedMeasurementScale} from '../measurement-series.js';
import {make} from './dom.js';
export function createMeasurementPlot(channels,frameCount){
 const root=make('div',undefined,'video-measurement-plot'),ns='http://www.w3.org/2000/svg';
 const chart=make('div',undefined,'video-plot-chart'),legend=make('div',undefined,'video-plot-legend'),labels=make('div',undefined,'video-plot-y-labels'),area=make('div',undefined,'video-plot-area');
 const svg=document.createElementNS(ns,'svg'),height=120,scale=sharedMeasurementScale(channels,2);
 legend.setAttribute('role','group');legend.setAttribute('aria-label','Plot series visibility');
 svg.setAttribute('viewBox',`0 0 1000 ${height}`);svg.setAttribute('preserveAspectRatio','none');svg.setAttribute('role','img');svg.setAttribute('aria-label','Measurements on a shared vertical axis with a current-frame cursor');
 const element=(tag,attributes)=>{const node=document.createElementNS(ns,tag);for(const [key,value] of Object.entries(attributes))node.setAttribute(key,value);svg.append(node);return node;};
 const digits=Math.max(0,-Math.floor(Math.log10(scale.step))),unit=channels[0]?.unit==='°'?'°':'';
 for(const tick of scale.ticks){
  const ratio=(scale.high-tick)/(scale.high-scale.low),text=make('span',tick.toFixed(digits)+unit);
  text.style.top=(ratio*100)+'%';labels.append(text);
  element('line',{x1:0,x2:1000,y1:ratio*height,y2:ratio*height,stroke:tick===0?'#afbfaa':'#dbe4d6','stroke-width':1,'vector-effect':'non-scaling-stroke'});
 }
 for(const channel of channels){
  const button=make('button');button.type='button';button.style.setProperty('--series-color',channel.color);
  button.setAttribute('aria-label',`Toggle ${channel.label.toLowerCase()} curve`);button.setAttribute('aria-pressed','true');
  button.append(make('span',undefined,'video-plot-swatch'),make('span',channel.label));legend.append(button);
  const {path}=channelPath(channel.values,0,height,1000,scale);
  const line=element('path',{d:path,fill:'none',stroke:channel.color,'stroke-width':1.8,'vector-effect':'non-scaling-stroke'});
  button.onclick=()=>{const visible=button.getAttribute('aria-pressed')!=='true';button.setAttribute('aria-pressed',String(visible));line.style.display=visible?'':'none';};
 }
 const cursor=element('line',{x1:0,x2:0,y1:0,y2:height,stroke:'#284b3d','stroke-width':1.5,'vector-effect':'non-scaling-stroke'});
 area.append(svg);chart.append(labels,area);root.append(chart,legend);
 return {root,update(frame){const x=frame/Math.max(1,frameCount-1)*1000;cursor.setAttribute('x1',x);cursor.setAttribute('x2',x);}};
}
