import {add,sub,mul} from '../math.js';
import {axisColors} from '../palette.js';

// Only the active measurement projects the moving point onto its origin axis.
// Opacity is timed independently of extension so guides can fade during pauses.
export function displacementAxisGuides(origin,components,active,amount,opacity=1){
 const current=components[active],cursor=add(current.from,mul(sub(current.to,current.from),amount)),guides=[];
 components.forEach((component,i)=>{
  if(i!==active)return;
  const progress=amount,to=add(origin,mul(sub(component.to,component.from),progress)),color=axisColors[component.axis];
  guides.push({id:'axis-measure-'+component.key,kind:'line',from:origin,to,color,width:2.7,opacity});
  guides.push({id:'axis-connector-'+component.key,kind:'line',from:cursor,to,color,width:1.7,dashed:true,opacity});
 });
 guides.push({id:'measurement-cursor',kind:'point',from:cursor,color:axisColors[current.axis],radius:3.5,opacity});
 return guides;
}
