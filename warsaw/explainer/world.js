import * as THREE from 'three';
import { OrbitControls } from './vendor/OrbitControls.js';

export function createWorld(onSelect) {
  const host = document.querySelector('#world');
  const fallback = document.querySelector('#world-fallback');
  const motionButton = document.querySelector('#motion-toggle');
  const qualityButton = document.querySelector('#quality-toggle');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' }); }
  catch { fallback.hidden = false; host.hidden = true; document.querySelector('.world-toolbar').hidden = true; return; }
  renderer.setClearColor(0x080f19, 0);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.25;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  host.appendChild(renderer.domElement);
  renderer.domElement.setAttribute('aria-hidden', 'true');
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x080f19, .006);
  const camera = new THREE.PerspectiveCamera(37, 1, .1, 250);
  const home = new THREE.Vector3(65, 51, 70);
  camera.position.copy(home);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 7, 0);
  controls.enableDamping = true;
  controls.dampingFactor = .07;
  controls.enableZoom = false;
  controls.enablePan = false;
  controls.minPolarAngle = .35;
  controls.maxPolarAngle = 1.35;
  renderer.domElement.style.touchAction = 'pan-y';
  scene.add(new THREE.HemisphereLight(0xb9ddff, 0x152233, 2.3));
  const sun = new THREE.DirectionalLight(0xf8c99a, 4.5);
  sun.position.set(-25, 55, 20); sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -45, right: 45, top: 45, bottom: -45, far: 130 });
  sun.shadow.bias = -.001; sun.shadow.normalBias = .1;
  scene.add(sun);
  const rim = new THREE.DirectionalLight(0x78b8ed, 3.5); rim.position.set(30, 22, -35); scene.add(rim);

  const materials = {};
  for (const [name, color, roughness, metalness] of [
    ['ground',0x132233,.87,.15], ['base',0x0b1623,.7,.35], ['road',0x0b1724,.95,0],
    ['stone',0xc3c3b2,.68,.08], ['stoneLight',0xe4dac0,.6,.1], ['stoneDark',0x777d7e,.8,.08],
    ['city',0x243947,.78,.1], ['city2',0x314654,.76,.18], ['roof',0x1a2a37,.66,.22], ['tree',0x285248,.93,0]
  ]) materials[name] = new THREE.MeshStandardMaterial({ color, roughness, metalness });
  const blue = new THREE.MeshBasicMaterial({color:0x99dcff});
  const warm = new THREE.MeshBasicMaterial({color:0xf7bd79});
  const boxGeometry = new THREE.BoxGeometry(1, 1, 1);
  const box = (w,h,d,x,y,z,mat='stone', parent=scene) => {
    const mesh = new THREE.Mesh(boxGeometry, materials[mat] || mat);
    mesh.scale.set(w,h,d); mesh.position.set(x,y,z); mesh.castShadow=true; mesh.receiveShadow=true; parent.add(mesh); return mesh;
  };
  box(78,1.9,64,0,-1.35,0,'base');
  box(77,.4,63,0,-.2,0,'ground');
  const edge = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(78,2.3,64)),new THREE.LineBasicMaterial({color:0x44617b,transparent:true,opacity:.45}));
  edge.position.y=-1.15; scene.add(edge);
  const grid = new THREE.GridHelper(76,38,0x476276,0x2a3e51); grid.position.y=.03; grid.material.transparent=true;grid.material.opacity=.23;scene.add(grid);
  for(const x of [-24,-12,12,24]) box(3,.045,63,x,.04,0,'road');
  for(const z of [-22,-11,11,22]) box(77,.05,2.6,0,.045,z,'road');
  const roadGlow = new THREE.MeshBasicMaterial({color:0x3d687b,transparent:true,opacity:.45});
  for(const x of [-24,24]) box(.04,.06,62,x+1.5,.05,0,roadGlow);
  for(const z of [-22,22]) box(76,.06,.04,0,.05,z+1.3,roadGlow);

  let seed=1992;
  const rand=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
  const city = new THREE.Group(); scene.add(city);
  const windows=[];
  for(let x=-33;x<=33;x+=10.8) for(let z=-27;z<=27;z+=9) {
    if(Math.abs(x)<13&&Math.abs(z)<16)continue;
    const w=4.2+rand()*2.4,d=3.6+rand()*2.4,h=2.4+rand()*7.4;
    const px=x+(rand()-.5)*1.3,pz=z+(rand()-.5)*1.2;
    box(w,h,d,px,h/2,pz,rand()>.5?'city':'city2',city);
    box(w+.2,.22,d+.2,px,h+.11,pz,'roof',city);
    if(h>6)box(w*.63,h*.22,d*.65,px,h+h*.11,pz,'city',city);
    box(w*.37,.4,d*.28,px,h+.4,pz,'roof',city);
    for(let floor=1;floor<h-.5;floor+=1.3) for(let j=-w/2+.6;j<w/2-.3;j+=.85) {
      if(rand()>.38)windows.push([px+j,floor,pz+d/2+.015,.24,.44,.03]);
      if(rand()>.42)windows.push([px+w/2+.015,floor,pz+j*.75,.03,.44,.24]);
    }
  }
  const windowMesh=new THREE.InstancedMesh(boxGeometry,warm,windows.length);
  const dummy=new THREE.Object3D();
  windows.forEach((v,i)=>{dummy.position.set(...v.slice(0,3));dummy.scale.set(...v.slice(3));dummy.updateMatrix();windowMesh.setMatrixAt(i,dummy.matrix);});
  scene.add(windowMesh);

  // A purpose-built Palace-inspired landmark. It is an explanatory model, not game geometry.
  const palace=new THREE.Group(); scene.add(palace);
  box(20,.8,16,0,.4,0,'stoneDark',palace);
  box(18,3.6,14,0,2.6,0,'stone',palace);
  box(19,.38,15,0,4.6,0,'stoneLight',palace);
  box(12,4.8,10,0,7,0,'stone',palace);
  box(12.7,.4,10.7,0,9.6,0,'stoneLight',palace);
  box(8,9,7,0,14.3,0,'stone',palace);
  box(8.7,.4,7.7,0,18.9,0,'stoneLight',palace);
  box(6.4,3.3,5.6,0,20.7,0,'stone',palace);
  box(7,.5,6.2,0,22.5,0,'stoneLight',palace);
  box(4,3.6,3.5,0,24.55,0,'stoneDark',palace);
  box(4.6,.35,4.1,0,26.5,0,'stoneLight',palace);
  box(2.4,2.4,2.4,0,27.9,0,'stone',palace);
  const spire=new THREE.Mesh(new THREE.ConeGeometry(.4,5.7,8),materials.stoneLight);spire.position.set(0,31.8,0);palace.add(spire);
  const cap=new THREE.Mesh(new THREE.SphereGeometry(.13,8,6),blue);cap.position.y=34.7;palace.add(cap);
  for(const x of [-7.5,7.5])for(const z of [-5.5,5.5]){
    box(3,6.5,3,x,3.8,z,'stone',palace);box(3.4,.4,3.4,x,7.25,z,'stoneLight',palace);
    const turret=new THREE.Mesh(new THREE.ConeGeometry(1.5,2,4),materials.stoneDark);turret.rotation.y=Math.PI/4;turret.position.set(x,8.45,z);palace.add(turret);
  }
  for(const x of [-6.5,-3.3,0,3.3,6.5]){
    box(1.4,2.5,.07,x,2.1,7.03,'roof',palace);box(.06,2.2,.07,x,2.1,7.08,warm,palace);
  }
  const pillarGeometry=new THREE.CylinderGeometry(.32,.41,3.8,12);
  for(let x=-8;x<=8;x+=1.6){const pillar=new THREE.Mesh(pillarGeometry,materials.stoneLight);pillar.position.set(x,2.7,8.4);pillar.castShadow=true;palace.add(pillar);box(.9,.3,.9,x,.8,8.4,'stone',palace);}
  box(18,.6,3,0,4.8,8.2,'stoneLight',palace);
  for(let i=0;i<4;i++)box(18+i*.6,.18,2.4+i*.7,0,.63-i*.16,9+i*.1,'stone',palace);
  for(const x of [-3.6,3.6])for(let y=10.7;y<18.5;y+=1.65)box(.07,.85,5.8,x,y,0,'stoneLight',palace);
  for(const z of [-3.53,3.53])for(let y=11;y<18.8;y+=1.65)for(let x=-2.7;x<=2.7;x+=1.1){box(.46,.87,.05,x,y,z,'roof',palace);box(.17,.65,.06,x,y,z+.015,warm,palace);}
  for(const z of [-5.05,5.05])for(let x=-4.8;x<=4.8;x+=1.25){box(.55,2.2,.07,x,6.9,z,'roof',palace);box(.22,1.9,.08,x,6.9,z+.01,warm,palace);}
  const clockGeom=new THREE.CircleGeometry(.83,32);
  const clockFace=new THREE.Mesh(clockGeom,new THREE.MeshBasicMaterial({color:0xbce6f4}));clockFace.position.set(0,24.9,1.78);palace.add(clockFace);
  box(.055,.6,.04,0,25.15,1.82,'roof',palace);const hand=box(.48,.05,.04,.23,24.9,1.82,'roof',palace);hand.rotation.z=.3;
  const haloGeo=new THREE.RingGeometry(20,20.06,100);const halo=new THREE.Mesh(haloGeo,new THREE.MeshBasicMaterial({color:0x6cacd4,transparent:true,opacity:.4,side:THREE.DoubleSide}));halo.rotation.x=-Math.PI/2;halo.position.y=.09;scene.add(halo);

  const treeGeo=new THREE.ConeGeometry(.8,2.7,6);
  for(let i=0;i<45;i++){
    const x=-33+rand()*66,z=-27+rand()*54;if(Math.abs(x)<12&&Math.abs(z)<16)continue;
    const tree=new THREE.Mesh(treeGeo,materials.tree);tree.position.set(x,1.4,z);tree.castShadow=true;scene.add(tree);
  }
  // Six selectable signals link the city metaphor to the explanations.
  const topics=[['model','Nodes & edges',-20,5.5,16],['dependencies','Build dependencies',-25,7,-12],['review','Review branches',-3,8,-22],['navigation','Routefinding',24,6,-13],['hierarchy','Scene hierarchy',27,6,12],['provenance','Source to output',9,5,24]];
  const selectable=[];const rings=[];const signalPaths=[];
  const labelTexture=(number)=>{
    const c=document.createElement('canvas');c.width=128;c.height=128;const ctx=c.getContext('2d');ctx.fillStyle='#99dcff';ctx.beginPath();ctx.arc(64,64,53,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#080f19';ctx.lineWidth=2;ctx.stroke();ctx.fillStyle='#080f19';ctx.font='500 46px Segoe UI';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(number,64,64);const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;return tex;
  };
  topics.forEach(([id,label,x,y,z],i)=>{
    const texture=labelTexture(String(i+1).padStart(2,'0'));
    const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,depthTest:false}));sprite.position.set(x,y,z);sprite.scale.set(2.4,2.4,1);sprite.userData={id,label};sprite.renderOrder=5;scene.add(sprite);selectable.push(sprite);
    const ring=new THREE.Mesh(new THREE.TorusGeometry(1.7,.025,6,64),blue);ring.rotation.x=-Math.PI/2;ring.position.set(x,.25,z);scene.add(ring);rings.push(ring);
    const anchor=new THREE.Vector3(x,y-.6,z),middle=new THREE.Vector3(x*.6,16,z*.6),destination=new THREE.Vector3(0,20,0);
    const curve=new THREE.QuadraticBezierCurve3(anchor,middle,destination);signalPaths.push(curve);
    const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(curve.getPoints(45)),new THREE.LineBasicMaterial({color:0x77b5da,transparent:true,opacity:.24}));scene.add(line);
    const stem=new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(x,.3,z),new THREE.Vector3(x,y-1.3,z)]),new THREE.LineBasicMaterial({color:0x76b2d2,transparent:true,opacity:.35}));scene.add(stem);
  });
  const signals=new THREE.InstancedMesh(new THREE.SphereGeometry(.105,7,5),blue,36);scene.add(signals);
  const starPositions=new Float32Array(100*3);
  for(let i=0;i<100;i++){starPositions[i*3]=(rand()-.5)*110;starPositions[i*3+1]=15+rand()*40;starPositions[i*3+2]=(rand()-.5)*85;}
  const starsGeo=new THREE.BufferGeometry();starsGeo.setAttribute('position',new THREE.BufferAttribute(starPositions,3));const stars=new THREE.Points(starsGeo,new THREE.PointsMaterial({color:0x7699b5,size:.095,transparent:true,opacity:.55}));scene.add(stars);

  let paused=reduce.matches,low=false,visible=true,frame=0,disposed=false,clock=0,last=0;
  const syncPause=()=>{motionButton.setAttribute('aria-pressed',String(paused));motionButton.innerHTML=paused?'▶ <span>Resume motion</span>':'Ⅱ <span>Pause motion</span>';};
  syncPause();
  const resize=()=>{const {width,height}=host.getBoundingClientRect();if(width<1||height<1)return;camera.aspect=width/height;camera.updateProjectionMatrix();renderer.setSize(width,height,false);controls.enableRotate=width>600;renderer.render(scene,camera);};
  const observer=new ResizeObserver(resize);observer.observe(host);
  const schedule=()=>{if(!frame&&!disposed&&visible&&!document.hidden)frame=requestAnimationFrame(draw);};
  const point=new THREE.Vector3();
  function draw(time){frame=0;if(disposed||!visible||document.hidden)return;const dt=Math.min((time-last)/1000,.05);last=time;
    if(!paused){clock+=dt;controls.autoRotate=true;controls.autoRotateSpeed=.12;}else controls.autoRotate=false;
    controls.update();
    for(let i=0;i<36;i++){signalPaths[i%6].getPoint((clock*.1+Math.floor(i/6)/6)%1,point);dummy.position.copy(point);dummy.scale.setScalar(1);dummy.updateMatrix();signals.setMatrixAt(i,dummy.matrix);}signals.instanceMatrix.needsUpdate=true;
    renderer.render(scene,camera);if(!paused)schedule();
  }
  const visibility=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;if(visible){last=performance.now();schedule();}else if(frame){cancelAnimationFrame(frame);frame=0;}},{threshold:.01});visibility.observe(host);
  controls.addEventListener('change',schedule);
  document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(frame);frame=0;}else{last=performance.now();schedule();}});
  motionButton.addEventListener('click',()=>{paused=!paused;syncPause();schedule();});
  reduce.addEventListener('change',event=>{paused=event.matches;syncPause();schedule();});
  qualityButton.addEventListener('click',()=>{low=!low;renderer.setPixelRatio(low?1:Math.min(devicePixelRatio,1.5));renderer.shadowMap.enabled=!low;qualityButton.setAttribute('aria-pressed',String(low));qualityButton.innerHTML=low?'◇ <span>Restore detail</span>':'◇ <span>Lower detail</span>';resize();});
  document.querySelector('#reset-view').addEventListener('click',()=>{camera.position.copy(home);controls.target.set(0,7,0);controls.update();resize();});
  const raycaster=new THREE.Raycaster();const mouse=new THREE.Vector2();const tooltip=document.querySelector('#world-tooltip');
  const hitAt=event=>{const rect=renderer.domElement.getBoundingClientRect();mouse.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);raycaster.setFromCamera(mouse,camera);return raycaster.intersectObjects(selectable)[0];};
  let downX=0,downY=0;
  renderer.domElement.addEventListener('pointerdown',event=>{downX=event.clientX;downY=event.clientY;});
  renderer.domElement.addEventListener('pointerup',event=>{if(Math.hypot(event.clientX-downX,event.clientY-downY)>7)return;const hit=hitAt(event);if(hit)onSelect(hit.object.userData.id);});
  renderer.domElement.addEventListener('pointermove',event=>{const hit=hitAt(event);tooltip.hidden=!hit;renderer.domElement.style.cursor=hit?'pointer':'grab';if(hit){tooltip.textContent=hit.object.userData.label+' ↗';const rect=host.getBoundingClientRect();tooltip.style.left=Math.min(event.clientX-rect.left+10,rect.width-190)+'px';tooltip.style.top=(event.clientY-rect.top-35)+'px';}});
  renderer.domElement.addEventListener('pointerleave',()=>tooltip.hidden=true);
  renderer.domElement.addEventListener('webglcontextlost',event=>{event.preventDefault();fallback.hidden=false;host.hidden=true;cancelAnimationFrame(frame);frame=0;document.querySelector('.world-toolbar').hidden=true;});
  window.addEventListener('pagehide',event=>{if(event.persisted)return;disposed=true;cancelAnimationFrame(frame);observer.disconnect();visibility.disconnect();controls.dispose();scene.traverse(object=>{object.geometry?.dispose();const mats=Array.isArray(object.material)?object.material:[object.material];mats.forEach(mat=>{mat?.map?.dispose();mat?.dispose();});});renderer.dispose();});
  resize();schedule();
  return { renderer, scene, camera, get paused(){return paused;} };
}
