import {Vector3} from '../../vendor/three/three.module.js';
import {ease,clamp} from './timeline.js';

// Cross-fade from the real projected arrow into a fixed-size depth-direction
// symbol as foreshortening increases. Never change the camera or measured axis.
export function projectArrow(from,to,camera,width,height){
 const delta=to.clone().sub(from),length=delta.length();
 if(length<1e-7)return null;
 const a=from.clone().project(camera),b=to.clone().project(camera);
 if(a.z< -1||a.z>1||b.z< -1||b.z>1)return null;
 const view=camera.getWorldDirection(new Vector3()),cosine=delta.multiplyScalar(1/length).dot(view);
 const angle=Math.acos(Math.min(1,Math.abs(cosine)))*180/Math.PI;
 const markerOpacity=ease(clamp((18-angle)/12));
 return {x:(a.x+1)*width/2,y:(1-a.y)*height/2,tx:(b.x+1)*width/2,ty:(1-b.y)*height/2,markerOpacity,arrowOpacity:1-markerOpacity,toward:cosine<0};
}

export function createEndOnMarker(parent,color){
 const ns='http://www.w3.org/2000/svg',group=document.createElementNS(ns,'g');group.classList.add('explain-end-on-marker');
 const dot=document.createElementNS(ns,'circle'),cross=document.createElementNS(ns,'path'),title=document.createElementNS(ns,'title');
 dot.setAttribute('r','3.5');dot.setAttribute('fill',color);
 cross.setAttribute('fill','none');cross.setAttribute('stroke',color);cross.setAttribute('stroke-width','2.5');cross.setAttribute('stroke-linecap','round');
 group.append(title,dot,cross);parent.append(group);
 return {
  setColor(value){dot.setAttribute('fill',value);cross.setAttribute('stroke',value);},
  update(spec,radius=11,dotRadius=3.5){
   group.style.display=spec&&spec.markerOpacity>0?'':'none';if(!spec)return;
   group.style.opacity=spec.markerOpacity;group.setAttribute('transform',`translate(${spec.tx} ${spec.ty})`);
   group.dataset.direction=spec.toward?'toward':'away';dot.setAttribute('r',dotRadius);
   const r=radius*.4;cross.setAttribute('d',`M${-r} ${-r} L${r} ${r} M${-r} ${r} L${r} ${-r}`);
   dot.style.display=spec.toward?'':'none';cross.style.display=spec.toward?'none':'';
   title.textContent=spec.toward?'Arrow points toward you':'Arrow points away from you';
  },
 };
}
