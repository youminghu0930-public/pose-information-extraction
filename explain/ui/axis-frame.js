import {projectArrow,createEndOnMarker} from './arrow-projection.js';
import {arrowShape} from './arrow-shape.js';
import {createRotationSector} from './rotation-sector.js';
import * as THREE from '../../vendor/three/three.module.js';
import {axisColors} from '../palette.js';
import {add,mul} from '../math.js';
// Projected SVG arrows have no volume and retain exact pixel widths on every GPU.
export function createAxisFrameRenderer(scene,toWorld,width,canvas){
 const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');svg.classList.add('explain-flat-axes');svg.setAttribute('aria-hidden','true');canvas.parentElement.append(svg);let state;const componentAngle=createRotationSector(scene,toWorld);
 const angleLabel=document.createElementNS(ns,'text');angleLabel.setAttribute('fill',axisColors.z);angleLabel.setAttribute('font-size','11');angleLabel.setAttribute('font-family','system-ui');angleLabel.setAttribute('stroke','#f4f7f0');angleLabel.setAttribute('stroke-width','3');angleLabel.setAttribute('paint-order','stroke');svg.append(angleLabel);
 const arrows=Object.fromEntries(Object.entries(axisColors).map(([key,color])=>{
  const group=document.createElementNS(ns,'g'),line=document.createElementNS(ns,'path'),label=document.createElementNS(ns,'text');
  line.setAttribute('stroke','none');line.setAttribute('fill',color);line.setAttribute('stroke-linejoin','round');line.setAttribute('paint-order','stroke');
  label.setAttribute('fill',color);label.setAttribute('font-size','14');label.setAttribute('font-weight','600');label.textContent=key.toUpperCase();
  group.append(line);const marker=createEndOnMarker(group,color);group.append(label);svg.append(group);return [key,{group,line,marker,label}];
 }));
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(new Float32Array(12),3));geometry.setIndex([0,1,2,0,2,3]);
 const plane=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({color:axisColors.z,transparent:true,opacity:.13,depthWrite:false,side:THREE.DoubleSide}));plane.renderOrder=17;scene.add(plane);
 function update(next){
  state=next;componentAngle.update(state?.angleMarker);plane.visible=!!state&&state.plane>0&&state.planeOpacity>0;
  if(plane.visible){
   const {origin,x,y,length}=state.frame,L=length*state.plane,corners=[origin,add(origin,mul(x,L)),add(add(origin,mul(x,L)),mul(y,L)),add(origin,mul(y,L))];
   corners.forEach((p,i)=>{const v=toWorld(p);geometry.attributes.position.setXYZ(i,v.x,v.y,v.z);});geometry.attributes.position.needsUpdate=true;geometry.computeBoundingSphere();plane.material.opacity=.17*state.planeOpacity*state.opacity;
  }
 }
 function updateView(camera,w,h){
  svg.style.width=w+'px';svg.style.height=h+'px';svg.setAttribute('viewBox',`0 0 ${w} ${h}`);svg.style.opacity=state?.opacity??0;svg.style.zIndex='3';
  angleLabel.style.display=state?.angleMarker?'':'none';
  angleLabel.style.opacity=state?.angleMarker?.opacity??1;
  if(state?.angleMarker){const marker=state.angleMarker,p=toWorld(add(marker.origin,mul(add(marker.from,state.frame.x),marker.radius*.7))).project(camera);angleLabel.setAttribute('x',(p.x+1)*w/2+4);angleLabel.setAttribute('y',(1-p.y)*h/2-4);angleLabel.textContent=(Math.abs(marker.angle-90)<.05?'90':marker.angle.toFixed(1))+'°';}
  for(const [key,{group,line,marker,label}] of Object.entries(arrows)){
   const spec=state?.[key];group.style.display=spec?'':'none';if(!spec)continue;
   const projection=projectArrow(toWorld(spec.from),toWorld(spec.to),camera,w,h);
   if(!projection){group.style.display='none';continue;}
   const {x,y,tx,ty,arrowOpacity,markerOpacity}=projection;
   const shape=arrowShape(x,y,tx,ty,width);
   line.setAttribute('stroke-width','1.2');if(shape)line.setAttribute('d',shape);
   line.style.display=shape?'':'none';
   line.style.opacity=arrowOpacity;
   marker.update(projection,width>=4?15:10);
   label.style.display=markerOpacity>0?'':'none';label.setAttribute('x',tx+20);label.setAttribute('y',ty-15);
  }
 }
 return {update,updateView,dispose(){componentAngle.dispose();svg.remove();geometry.dispose();plane.material.dispose();scene.remove(plane);}};
}
