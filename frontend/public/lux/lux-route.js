(function(root){'use strict';
const clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
function bounds(width,height,w,h,header=0,bottom=0){const left=8,right=Math.max(left,width-w-8),top=Math.max(8,Math.min(header+8,height-h-8)),foot=Math.max(top,height-h-bottom-10);return {left,right,top,bottom:foot,w,h}}
function route(b){const span=b.bottom-b.top;return [{x:b.right,y:b.bottom},{x:b.left,y:b.bottom},{x:b.right,y:b.top+span*.15},{x:b.left,y:b.top+span*.45},{x:(b.left+b.right)/2,y:b.bottom}]}
function overlap(a,b){return Math.max(0,Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x))*Math.max(0,Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y))}
function safePoint(point,b,obstacles=[]){const candidates=[point,...route(b),{x:b.right,y:(b.top+b.bottom)/2},{x:b.left,y:b.top}].map(p=>({x:clamp(p.x,b.left,b.right),y:clamp(p.y,b.top,b.bottom)}));return candidates.map((p,i)=>({p,i,score:obstacles.reduce((sum,o)=>sum+overlap({...p,w:b.w,h:b.h},o),0)})).sort((a,z)=>a.score-z.score||a.i-z.i)[0].p}
const ease=t=>t<.5?2*t*t:1-(-2*t+2)**2/2;const api={bounds,route,safePoint,overlap,clamp,ease};if(typeof module!=='undefined')module.exports=api;else root.LuxRoute=api;
})(typeof window==='undefined'?this:window);
