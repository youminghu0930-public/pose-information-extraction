import {projectArrow,createEndOnMarker} from './arrow-projection.js';
// One closed silhouette avoids a shaft poking through a separate arrowhead.
// Dimensions are CSS pixels, independent of camera distance and orientation.
// When space is limited, scale every dimension together rather than squashing
// the triangle. Keep at least two thirds of the arrow available for its shaft.
export function arrowShape(x,y,tx,ty,width){
 const dx=tx-x,dy=ty-y,length=Math.hypot(dx,dy);
 if(length<4)return null;
 const ux=dx/length,uy=dy/length,scale=Math.min(1,length/(width*9));
 const shaft=width*scale,head=shaft*3,halfHead=shaft*1.35;
 const point=(along,side)=>`${x+ux*along-uy*side} ${y+uy*along+ux*side}`;
 return `M${point(0,-shaft/2)} L${point(length-head,-shaft/2)} L${point(length-head,-halfHead)} L${point(length,0)} L${point(length-head,halfHead)} L${point(length-head,shaft/2)} L${point(0,shaft/2)} Z`;
}
export function createFlatArrows(canvas){
 const ns='http://www.w3.org/2000/svg',root=document.createElementNS(ns,'svg');root.classList.add('explain-flat-axes');root.setAttribute('aria-hidden','true');canvas.parentElement.append(root);
 let arrows=[];
 return {
  add(color,width=2.4){
   const path=document.createElementNS(ns,'path');path.setAttribute('fill',color);path.setAttribute('stroke','none');path.setAttribute('stroke-linejoin','round');path.setAttribute('paint-order','stroke');root.append(path);
   const marker=createEndOnMarker(root,color);
   const arrow={visible:true,from:null,to:null,path,marker,width,setEndpoints(from,to){this.from=from.clone();this.to=to.clone();}};arrows.push(arrow);return arrow;
  },
  updateView(camera,w,h){
   root.setAttribute('viewBox',`0 0 ${w} ${h}`);root.style.width=w+'px';root.style.height=h+'px';
   for(const arrow of arrows){
    const projection=arrow.visible&&arrow.from&&arrow.to?projectArrow(arrow.from,arrow.to,camera,w,h):null;
    const shape=projection?arrowShape(projection.x,projection.y,projection.tx,projection.ty,arrow.width):null;
    arrow.path.style.display=shape?'':'none';if(shape)arrow.path.setAttribute('d',shape);
    arrow.path.style.opacity=projection?.arrowOpacity??0;arrow.marker.update(projection);
   }
  },
  clear(){arrows=[];root.replaceChildren();},dispose(){root.remove();},
 };
}
