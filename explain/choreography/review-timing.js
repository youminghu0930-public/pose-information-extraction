// Let the completed result rest before any fade, camera motion or value reset.
export function reviewTiming(progress,duration){
 const hold=Math.min(1200,duration*.2)/duration;
 return {holding:progress<hold,progress:Math.max(0,(progress-hold)/(1-hold))};
}
