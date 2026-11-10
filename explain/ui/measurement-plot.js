import {channelPath,sharedMeasurementScale} from '../measurement-series.js';
import {make} from './dom.js';
export function createMeasurementPlot(channels,frameCount){
 const lines=new Map();let hasSelection=false;let selected=new Set(channels.map(channel=>channel.key)),hoverFrame;
 const root=make('div',undefined,'video-measurement-plot'),ns='http://www.w3.org/2000/svg';
 const chart=make('div',undefined,'video-plot-chart'),labels=make('div',undefined,'video-plot-y-labels'),area=make('div',undefined,'video-plot-area');
 const svg=document.createElementNS(ns,'svg'),height=120,scale=sharedMeasurementScale(channels,2);
 let displayed={low:scale.low,high:scale.high},rangeHandle;const tickNodes=[];
 svg.setAttribute('viewBox',`0 0 1000 ${height}`);svg.setAttribute('preserveAspectRatio','none');svg.setAttribute('role','img');svg.setAttribute('aria-label','Measurements on a shared vertical axis with a current-frame cursor');
 const element=(tag,attributes)=>{const node=document.createElementNS(ns,tag);for(const [key,value] of Object.entries(attributes))node.setAttribute(key,value);svg.append(node);return node;};
 const unit=channels[0]?.unit==='°'?'°':'';
 function setTicks(next){
  for(const {text,line} of tickNodes){text.remove();line.remove();}tickNodes.length=0;
  const digits=Math.max(0,-Math.floor(Math.log10(next.step)));
  for(const tick of next.ticks){
   const text=make('span',tick.toFixed(digits)+unit);labels.append(text);
   const line=element('line',{x1:0,x2:1000,y1:0,y2:0,stroke:tick===0?'#afbfaa':'#dbe4d6','stroke-width':1,'vector-effect':'non-scaling-stroke'});
   svg.prepend(line);tickNodes.push({tick,text,line});
  }
 }
 function drawRange(){
  const span=displayed.high-displayed.low;
  for(const {tick,text,line} of tickNodes){
   const ratio=(displayed.high-tick)/span,visible=ratio>=0&&ratio<=1;
   text.style.top=ratio*100+'%';text.style.opacity=visible?'1':'0';
   line.setAttribute('y1',ratio*height);line.setAttribute('y2',ratio*height);line.style.opacity=visible?'1':'0';
  }
  const factor=(scale.high-scale.low)/span,offset=height*(displayed.high-scale.high)/span;
  for(const line of lines.values())line.setAttribute('transform',`translate(0 ${offset}) scale(1 ${factor})`);
 }
 function fitVisible(){
  cancelAnimationFrame(rangeHandle);
  const next=sharedMeasurementScale(channels.filter(channel=>selected.has(channel.key)),2),from={...displayed};setTicks(next);
  const start=performance.now(),immediate=!root.isConnected||matchMedia('(prefers-reduced-motion: reduce)').matches;
  function tick(now){
   const t=immediate?1:Math.min(1,(now-start)/280),p=t*t*(3-2*t);
   displayed={low:from.low+(next.low-from.low)*p,high:from.high+(next.high-from.high)*p};drawRange();
   if(t<1&&root.isConnected)rangeHandle=requestAnimationFrame(tick);
  }
  tick(start);
 }
 setTicks(scale);
 for(const channel of channels){
  const {path}=channelPath(channel.values,0,height,1000,scale);
  const line=element('path',{d:path,fill:'none',stroke:channel.color,'stroke-width':1.8,'vector-effect':'non-scaling-stroke'});
  lines.set(channel.key,line);line.classList.add('video-plot-series');

 }
 const cursor=element('line',{x1:0,x2:0,y1:0,y2:height,stroke:'#284b3d','stroke-width':1.5,'vector-effect':'non-scaling-stroke'});
 const hoverCursor=element('line',{x1:0,x2:0,y1:0,y2:height,stroke:'#284b3d','stroke-width':1,'stroke-dasharray':'3 3','vector-effect':'non-scaling-stroke'});hoverCursor.style.opacity='0';
 const tooltip=make('div',undefined,'video-plot-tooltip');tooltip.setAttribute('role','status');tooltip.hidden=true;
 function showHover(){
  if(hoverFrame===undefined)return;
  tooltip.replaceChildren();
  for(const channel of channels){if(!selected.has(channel.key))continue;
   const value=channel.values[hoverFrame],row=make('div');row.style.color=channel.color;
   row.textContent=`${channel.label}: ${Number.isFinite(value)?value.toFixed(2)+channel.unit:'—'}`;tooltip.append(row);
  }
  tooltip.hidden=!tooltip.children.length;
 }
 area.addEventListener('pointermove',event=>{
  const rect=area.getBoundingClientRect(),ratio=Math.max(0,Math.min(1,(event.clientX-rect.left)/rect.width));
  hoverFrame=Math.round(ratio*Math.max(0,frameCount-1));
  hoverCursor.setAttribute('x1',ratio*1000);hoverCursor.setAttribute('x2',ratio*1000);hoverCursor.style.opacity='1';
  tooltip.style.left=(ratio*100)+'%';tooltip.style.transform=ratio>.5?'translateX(-100%)':'none';showHover();
 });
 area.addEventListener('pointerleave',()=>{hoverFrame=undefined;tooltip.hidden=true;hoverCursor.style.opacity='0';});
 area.append(svg,tooltip);chart.append(area);root.append(chart,labels);drawRange();
 function updateEmphasis(){for(const [key,line] of lines){
  line.style.opacity=selected.has(key)?'1':'0';
  line.style.strokeWidth=hasSelection&&selected.has(key)?'2.8':'1.8';
 }}
 return {root,setSelection(keys){hasSelection=keys.length>0;selected=new Set(keys.length?keys:channels.map(channel=>channel.key));updateEmphasis();fitVisible();showHover();},update(frame){const x=frame/Math.max(1,frameCount-1)*1000;cursor.setAttribute('x1',x);cursor.setAttribute('x2',x);}};
}
