import * as THREE from './vendor/three.module.min.js';
import { SVGRenderer } from './vendor/SVGRenderer.js';
// LUX is a real mesh-based character, rendered in a transparent WebGL canvas.
const canvas=document.getElementById('lux3d'),host=document.getElementById('luxMascot'),fallback=document.getElementById('lux3dFallback');
let renderer,software=false,surface=canvas;
try{renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:true,powerPreference:'low-power'});}catch{try{renderer=new SVGRenderer();renderer.setQuality('high');renderer.setPrecision(2);software=true;surface=renderer.domElement;surface.id='lux3d';surface.setAttribute('aria-hidden','true');canvas.replaceWith(surface);}catch{host.classList.add('no-webgl');}}
if(renderer){
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(31,1,0.1,30);camera.position.set(0,.6,8.2);camera.lookAt(0,.5,0);
 renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.65));if(!software)renderer.setClearColor(0x000000,0);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.18;
 scene.add(new THREE.HemisphereLight(0xfff7df,0x4b654e,2.2));const key=new THREE.DirectionalLight(0xffefd5,3.3);key.position.set(-3,5,6);scene.add(key);const rim=new THREE.DirectionalLight(0xffd794,2);rim.position.set(3,2,-3);scene.add(rim);const fill=new THREE.DirectionalLight(0xe5f0f6,1.3);fill.position.set(4,0,4);scene.add(fill);if(software){key.intensity=.5;rim.intensity=.25;fill.intensity=.25;scene.add(new THREE.AmbientLight(0xfff4e2,.4));}
 const mat=(color,metalness=.05,roughness=.38)=>new THREE.MeshStandardMaterial({color,metalness,roughness});
 const gold=mat(0xe8bd68,.4,.28),cream=mat(0xe6bd77,.16,.3),green=mat(0x26483a,.1,.33),lightGreen=mat(0x4b6c50,.07,.45),glove=mat(0xfff2d9,.03,.42),white=mat(0xffffff,.02,.2),iris=mat(0x42604b,.1,.22),black=mat(0x17201a,.03,.19),blush=mat(0xe59a80,.01,.6),mouthMat=mat(0x633d29,.02,.4);
 const figure=new THREE.Group();scene.add(figure);
 function mesh(g,m,parent=figure,x=0,y=0,z=0){const o=new THREE.Mesh(g,m);o.position.set(x,y,z);parent.add(o);return o}
 function ball(r,m,parent=figure,x=0,y=0,z=0,sx=1,sy=1,sz=1){const o=mesh(new THREE.SphereGeometry(r,16,12),m,parent,x,y,z);o.scale.set(sx,sy,sz);return o}
 function tube(points,r,m,parent=figure){return mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p))),16,r,6,false),m,parent)}
 const head=new THREE.Group();head.position.y=1.02;figure.add(head);
 const shape=new THREE.Shape();const points=[];for(let i=0;i<10;i++){const a=Math.PI/2+i*Math.PI/5,r=i%2?.55:.99;points.push(new THREE.Vector2(Math.cos(a)*r,Math.sin(a)*r))}shape.moveTo(points[0].x,points[0].y);for(let i=1;i<10;i++)shape.lineTo(points[i].x,points[i].y);shape.closePath();const geometry=new THREE.ExtrudeGeometry(shape,{depth:.25,bevelEnabled:true,bevelSegments:4,steps:1,bevelSize:.125,bevelThickness:.15,curveSegments:16});geometry.translate(0,0,-.125);mesh(geometry,cream,head);
 // Pearl-like central cheeks and glossy eyes are separate volume geometry.
 const eyes=[];for(const x of [-.29,.29]){const e=new THREE.Group();e.position.set(x,.06,.31);head.add(e);eyes.push(e);ball(.16,white,e,0,0,0,.83,1.17,.6);ball(.09,iris,e,x<0?.018:-.018,-.005,.075,.83,1.15,.6);ball(.057,black,e,x<0?.019:-.019,-.006,.114,.85,1.22,.5);ball(.026,white,e,-.015,.035,.143,1,1,.55);ball(.012,white,e,.039,-.025,.143,1,1,.55);tube([[x-.09,.28,.31],[x,.31,.34],[x+.08,.28,.31]],.018,gold,head);ball(.11,blush,head,x*1.39,-.15,.315,1,.48,.16)}
 ball(.065,gold,head,0,-.08,.36,1,.8,.8);
 const smile=tube([[-.17,-.20,.32],[-.1,-.28,.35],[0,-.305,.36],[.1,-.28,.35],[.17,-.2,.32]],.021,mouthMat,head);
 const talking=ball(.105,mouthMat,head,0,-.25,.34,1,.45,.18);talking.visible=false;const tongue=ball(.048,blush,talking,0,-.25,.6,1,.45,.25);
 // A tiny emerald fashion pin on one star tip.
 ball(.065,green,head,.67,.23,.24,1,1,.45);const pin=mesh(new THREE.TorusGeometry(.072,.014,8,24),gold,head,.67,.23,.27);
 // Tapered green satin body, gold piping and two little cartoon shoes.
 mesh(new THREE.CylinderGeometry(.22,.43,.67,36),green,figure,0,-.22,0);
 mesh(new THREE.TorusGeometry(.32,.025,10,40),gold,figure,0,-.24,0).rotation.x=Math.PI/2;
 const collar=mesh(new THREE.TorusGeometry(.23,.038,10,36),gold,figure,0,.1,0);collar.rotation.x=Math.PI/2;
 for(const x of [-.19,.19]){mesh(new THREE.CapsuleGeometry(.065,.25,6,12),lightGreen,figure,x,-.67,0);ball(.14,green,figure,x,-.88,.075,1.2,.7,1.6);ball(.05,gold,figure,x,-.875,.27,1.2,.7,.4)}
 // Articulated arms. Right hand waves; left hand carries a miniature comb.
 const right=new THREE.Group();right.position.set(.29,.03,0);figure.add(right);tube([[0,0,0],[.22,-.07,.02],[.44,.13,.04]],.065,green,right);const hand=new THREE.Group();hand.position.set(.47,.2,.05);right.add(hand);ball(.10,glove,hand,0,0,0,.9,1.1,.75);for(let i=0;i<3;i++)ball(.036,glove,hand,(i-1)*.052,.105,0,.8,1.6,.8);ball(.045,glove,hand,-.11,.02,.03,1.5,.7,.8);
 const left=new THREE.Group();left.position.set(-.29,.03,0);figure.add(left);tube([[0,0,0],[-.20,-.23,0],[-.38,-.18,.12]],.065,green,left);ball(.105,glove,left,-.4,-.18,.12,1,1,.7);
 const comb=new THREE.Group();comb.position.set(-.47,-.14,.22);comb.rotation.z=-.35;left.add(comb);mesh(new THREE.BoxGeometry(.08,.5,.065),gold,comb);for(let i=0;i<7;i++)mesh(new THREE.BoxGeometry(.19,.025,.04),gold,comb,-.09,-.19+i*.056,0);
 // Delicate sparkles behind the floating character, without a backing card.
 const sparkles=[];for(let i=0;i<4;i++){const g=new THREE.Group();g.position.set(i%2?1.05:-1.02,i<2?1.25:.15,-.3);const s=i%2?.085:.06;mesh(new THREE.OctahedronGeometry(s,0),gold,g).scale.set(.7,1.6,.7);figure.add(g);sparkles.push(g)}
 const shadowCanvas=document.createElement('canvas');shadowCanvas.width=shadowCanvas.height=128;const sc=shadowCanvas.getContext('2d'),grad=sc.createRadialGradient(64,64,2,64,64,62);grad.addColorStop(0,'rgba(24,43,30,.30)');grad.addColorStop(1,'rgba(24,43,30,0)');sc.fillStyle=grad;sc.fillRect(0,0,128,128);const shadow=mesh(new THREE.PlaneGeometry(1.7,.42),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(shadowCanvas),transparent:true,depthWrite:false}),scene,0,-1.12,-.2);
 if(software)shadow.visible=false;
 let mouseX=0,mouseY=0,last=0,visible=true;const reduce=matchMedia('(prefers-reduced-motion: reduce)');let currentY=-.15;
 document.addEventListener('pointermove',e=>{const r=surface.getBoundingClientRect();mouseX=THREE.MathUtils.clamp((e.clientX-r.left-r.width/2)/500,-.35,.35);mouseY=THREE.MathUtils.clamp((e.clientY-r.top-r.height/2)/500,-.15,.15)},{passive:true});
 const resize=()=>{const r=surface.getBoundingClientRect();if(!r.width||!r.height)return;renderer.setSize(r.width,r.height,false);camera.aspect=r.width/r.height;camera.updateProjectionMatrix()};new ResizeObserver(resize).observe(surface);resize();
 document.addEventListener('visibilitychange',()=>visible=!document.hidden);surface.addEventListener('webglcontextlost',e=>{e.preventDefault();host.classList.add('no-webgl')});surface.addEventListener('webglcontextrestored',()=>{host.classList.remove('no-webgl');resize()});
 function frame(ms){requestAnimationFrame(frame);if(!visible||host.hidden||ms-last<(software?100:33))return;last=ms;const t=ms/1000,motion=reduce.matches||document.body.classList.contains('lux-motion-paused')?0:1;const speaking=document.body.classList.contains('speaking'),listening=document.body.classList.contains('listening');figure.position.y=Math.sin(t*2)*.055*motion;currentY+=(mouseX-currentY)*.06;figure.rotation.y=motion?currentY+(host.classList.contains('lux-traveling')?(host.dataset.direction==='left'?.22:-.22):0):-.15;figure.rotation.z=Math.sin(t*.8)*.025*motion;head.rotation.x=mouseY*.45*motion;head.rotation.z=listening?-.09:Math.sin(t*1.2)*.024*motion;right.rotation.z=(.18+Math.sin(t*3)*.17)*motion;hand.rotation.z=Math.sin(t*5)*.16*motion;const blink=Math.sin(t*1.1)>0.993?.12:1;for(const e of eyes)e.scale.y=motion?blink:1;talking.visible=speaking;smile.visible=!speaking;if(speaking)talking.scale.y=reduce.matches?.6:.55+Math.abs(Math.sin(t*16))*.55;shadow.scale.x=1+Math.sin(t*2)*.05*motion;for(let i=0;i<sparkles.length;i++)sparkles[i].rotation.y=t*.5*motion+i;renderer.render(scene,camera)}
 fallback.hidden=true;host.dataset.renderer=software?'software-3d':'webgl-3d';requestAnimationFrame(frame);
}
