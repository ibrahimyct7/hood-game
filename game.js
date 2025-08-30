const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const statusEl = document.getElementById("status");
const distEl = document.getElementById("dist");
const resetBtn = document.getElementById("reset");

let W=innerWidth,H=innerHeight; canvas.width=W; canvas.height=H;
addEventListener("resize",()=>{W=innerWidth;H=innerHeight;canvas.width=W;canvas.height=H;});

const assets={bg:new Image(),character:new Image()};
assets.bg.src="assets/forest.png";
assets.character.src="assets/character.png";

const GROUND_Y=Math.floor(H*0.8);
const LEG_LEN=150, TORSO_R=50, CAMERA_LOCK_X=Math.floor(W*0.4);
let camX=0;
let leftFoot={x:0,y:GROUND_Y,grabbing:false};
let rightFoot={x:120,y:GROUND_Y,grabbing:false};
let body={x:60,y:GROUND_Y-LEG_LEN,angle:0,alive:true,distance:0};

const mouse={down:false,x:0,y:0,grab:null};

let obstacles=[];
function regenObstacles(){
  obstacles=[];let x=200;
  for(let i=0;i<30;i++){
    if(Math.random()<0.5){
      // spike
      obstacles.push({type:"spike",x,width:40});
      x+=200;
    }else{
      // ramp
      obstacles.push({type:"ramp",x,width:120});
      x+=250;
    }
  }
}
regenObstacles();

function reset(){
  camX=0;
  leftFoot={x:0,y:GROUND_Y,grabbing:false};
  rightFoot={x:120,y:GROUND_Y,grabbing:false};
  body={x:60,y:GROUND_Y-LEG_LEN,angle:0,alive:true,distance:0};
  regenObstacles();
  statusEl.textContent="ready";
  resetBtn.style.display="none";
}
resetBtn.onclick=reset;

canvas.onmousedown=e=>{
  mouse.down=true;
  const rect=canvas.getBoundingClientRect();
  mouse.x=e.clientX-rect.left; mouse.y=e.clientY-rect.top;
  const lx=worldToScreenX(leftFoot.x), rx=worldToScreenX(rightFoot.x);
  if(Math.hypot(mouse.x-lx,mouse.y-leftFoot.y)<40){mouse.grab="L";leftFoot.grabbing=true;}
  else if(Math.hypot(mouse.x-rx,mouse.y-rightFoot.y)<40){mouse.grab="R";rightFoot.grabbing=true;}
};
canvas.onmousemove=e=>{
  if(!mouse.down||!mouse.grab||!body.alive) return;
  const rect=canvas.getBoundingClientRect();
  mouse.x=e.clientX-rect.left;
  const wx=screenToWorldX(mouse.x);
  const f=mouse.grab==="L"?leftFoot:rightFoot;
  f.x=wx;
};
canvas.onmouseup=()=>{mouse.down=false;if(mouse.grab==="L")leftFoot.grabbing=false;if(mouse.grab==="R")rightFoot.grabbing=false;mouse.grab=null;};

function worldToScreenX(wx){return wx-camX+CAMERA_LOCK_X;}
function screenToWorldX(sx){return sx+camX-CAMERA_LOCK_X;}

function solveBody(){
  const midx=(leftFoot.x+rightFoot.x)/2;
  return {x:midx,y:GROUND_Y-LEG_LEN};
}

function checkObstacles(){
  for(const o of obstacles){
    if(o.type==="spike"){
      if(Math.abs(body.x-(o.x+20))<30 && body.y>GROUND_Y-LEG_LEN/2){return "spike";}
    }else if(o.type==="ramp"){
      // simple ramp collision
      if(body.x>o.x && body.x<o.x+o.width){body.y=GROUND_Y-LEG_LEN-20;}
    }
  }
  return null;
}

let last=performance.now();
function loop(t){
  const dt=(t-last)/1000; last=t;
  if(body.alive){
    const pos=solveBody();
    body.x=pos.x; body.y=pos.y;
    const fail=checkObstacles();
    if(fail){body.alive=false; statusEl.textContent="hit "+fail; resetBtn.style.display="block";}
    camX=body.x-CAMERA_LOCK_X;
    body.distance=Math.max(0,body.x/50);
    distEl.textContent=body.distance.toFixed(1);
  }
  draw();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

function draw(){
  ctx.clearRect(0,0,W,H);
  drawBackground();
  ctx.fillStyle="#1a3a3a"; ctx.fillRect(0,GROUND_Y,W,H-GROUND_Y);
  for(const o of obstacles){
    const sx=worldToScreenX(o.x);
    if(o.type==="spike"){
      ctx.fillStyle="#aaa"; ctx.beginPath();
      ctx.moveTo(sx,GROUND_Y); ctx.lineTo(sx+20,GROUND_Y-40); ctx.lineTo(sx+40,GROUND_Y); ctx.closePath(); ctx.fill();
    }else if(o.type==="ramp"){
      ctx.fillStyle="#7a4d1c"; ctx.beginPath();
      ctx.moveTo(sx,GROUND_Y); ctx.lineTo(sx+o.width,GROUND_Y-40); ctx.lineTo(sx+o.width,GROUND_Y); ctx.closePath(); ctx.fill();
    }
  }
  drawLeg(leftFoot); drawLeg(rightFoot); drawCharacter();
}

function drawBackground(){
  const img=assets.bg;if(!img.complete)return;
  const x=-(camX*0.5)%img.width;
  ctx.drawImage(img,x,0,img.width,H); ctx.drawImage(img,x+img.width,0,img.width,H);
}

function drawLeg(f){
  ctx.lineWidth=14; ctx.strokeStyle="#7a4d1c"; ctx.beginPath();
  ctx.moveTo(worldToScreenX(body.x),body.y); ctx.lineTo(worldToScreenX(f.x),GROUND_Y); ctx.stroke();
  ctx.fillStyle="rgba(255,255,100,0.9)";
  ctx.beginPath(); ctx.arc(worldToScreenX(f.x),GROUND_Y,14,0,Math.PI*2); ctx.fill();
}

function drawCharacter(){
  const img=assets.character;if(!img.complete){ctx.fillStyle="#222";ctx.fillRect(worldToScreenX(body.x)-30,body.y-60,60,60);return;}
  ctx.drawImage(img,worldToScreenX(body.x)-40,body.y-80,80,80);
}
