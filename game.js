// Hooded Walker – physics-y stepper made for your two PNGs.
// Pure Canvas, no external libs. Drop into GitHub Pages and it runs.

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const statusEl = document.getElementById("status");
const distEl = document.getElementById("dist");
const resetBtn = document.getElementById("reset");

let W=innerWidth, H=innerHeight;
canvas.width = W; canvas.height = H;
addEventListener("resize", ()=>{ W=innerWidth; H=innerHeight; canvas.width=W; canvas.height=H; });

// ASSETS
const assets = {
  bg: new Image(),
  character: new Image(),
};
assets.bg.src = "assets/forest.png";
assets.character.src = "assets/character.png";

// WORLD
const GROUND_Y = Math.floor(H*0.8);
const MPS = 2.0;     // base forward meters/sec for parallax (derived from steps)
const PIXELS_PER_M = 60;
const LEG_LEN = Math.max(120, Math.min(200, Math.floor(H*0.22))); // scale with screen
const TORSO_R = Math.floor(LEG_LEN*0.35);
const MAX_TILT = 0.65; // radians
const STEP_MIN = LEG_LEN*0.3;
const STEP_MAX = LEG_LEN*1.9; // if feet further apart than 2*LEG_LEN -> fall
const CAMERA_LOCK_X = Math.floor(W*0.38);

// Camera scroll (world offset)
let camX = 0;

// FEET (world coordinates)
let leftFoot = {x: 0, y: GROUND_Y, grabbing:false};
let rightFoot= {x: LEG_LEN*0.9, y: GROUND_Y, grabbing:false};
// BODY (world coordinates)
let body = {x: (leftFoot.x+rightFoot.x)/2, y: GROUND_Y-LEG_LEN, angle: 0, vx: 0, alive:true};

// Mouse state (screen coords)
const mouse = {x:0, y:0, down:false, grab:null};

// Obstacles: array of {x, width} lava pits in world coords at ground
let obstacles = [];
function regenObstacles(seedX= -200){
  obstacles = [];
  let x = seedX;
  for(let i=0;i<200;i++){
    x += Math.random()* (LEG_LEN*1.2) + LEG_LEN*1.0;
    const width = Math.random() < 0.5 ? Math.random()* (LEG_LEN*0.6) + 30 : Math.random()* (LEG_LEN*1.0) + 60;
    obstacles.push({x, width});
    x += width + Math.random()* (LEG_LEN*0.8);
  }
}
regenObstacles();

function reset(){
  camX = 0;
  leftFoot = {x: 0, y: GROUND_Y, grabbing:false};
  rightFoot= {x: LEG_LEN*0.9, y: GROUND_Y, grabbing:false};
  body = {x: (leftFoot.x+rightFoot.x)/2, y: GROUND_Y-LEG_LEN, angle: 0, vx: 0, alive:true, distance:0};
  regenObstacles(-200);
  statusEl.textContent = "ready";
}
resetBtn.addEventListener("click", reset);

// INPUT
canvas.addEventListener("mousedown", (e)=>{
  mouse.down = true;
  const rect = canvas.getBoundingClientRect();
  mouse.x = e.clientX-rect.left;
  mouse.y = e.clientY-rect.top;
  // detect nearest foot hit
  const lx = worldToScreenX(leftFoot.x), rx = worldToScreenX(rightFoot.x);
  const hitL = Math.hypot(mouse.x-lx, mouse.y-leftFoot.y) < 40;
  const hitR = Math.hypot(mouse.x-rx, mouse.y-rightFoot.y) < 40;
  if(hitL && !mouse.grab) { mouse.grab = "L"; leftFoot.grabbing = true; }
  else if(hitR && !mouse.grab){ mouse.grab = "R"; rightFoot.grabbing = true; }
});
addEventListener("mousemove", (e)=>{
  const rect = canvas.getBoundingClientRect();
  mouse.x = e.clientX-rect.left;
  mouse.y = e.clientY-rect.top;
  if(mouse.down && mouse.grab && body.alive){
    // Drag along ground line (x only; y fixed on ground)
    const worldX = screenToWorldX(mouse.x);
    const target = mouse.grab==="L" ? leftFoot : rightFoot;
    target.x = worldX;
    target.y = GROUND_Y;
  }
});
addEventListener("mouseup", ()=>{
  mouse.down=false;
  if(mouse.grab==="L") leftFoot.grabbing=false;
  if(mouse.grab==="R") rightFoot.grabbing=false;
  mouse.grab=null;
});

// UTILS: world<->screen transforms
function worldToScreenX(wx){ return Math.floor(wx - camX + CAMERA_LOCK_X); }
function screenToWorldX(sx){ return sx + camX - CAMERA_LOCK_X; }

// Compute torso position as intersection of two circles of radius LEG_LEN centered at feet
function solveBodyFromFeet(){
  const x1=leftFoot.x, y1=leftFoot.y;
  const x2=rightFoot.x, y2=rightFoot.y;
  const dx = x2-x1, dy = y2-y1;
  const d = Math.hypot(dx, dy);
  if(d===0) return null;
  // impossible if feet too far
  if(d > 2*LEG_LEN || d < 2){ return null; }
  const a = d/2;
  const ux = dx/d, uy = dy/d;
  const px = x1 + ux*a;
  const py = y1 + uy*a;
  const h2 = LEG_LEN*LEG_LEN - a*a;
  if(h2 <= 0) return null;
  const h = Math.sqrt(h2);
  const perpX = -uy, perpY = ux;
  // two intersections
  const ix1 = px + perpX*h;
  const iy1 = py + perpY*h;
  const ix2 = px - perpX*h;
  const iy2 = py - perpY*h;
  // choose higher (smaller y)
  if(iy1 < iy2) return {x:ix1, y:iy1};
  return {x:ix2, y:iy2};
}

function footInLava(foot){
  for(const o of obstacles){
    if(foot.x >= o.x && foot.x <= o.x+o.width) return true;
  }
  return false;
}

let last = performance.now();
function loop(t){
  const dt = Math.min(0.033, (t - last)/1000); // clamp
  last = t;

  // Physics & game state
  if(body.alive){
    const pos = solveBodyFromFeet();
    if(!pos){
      body.alive=false; statusEl.textContent="fell: overreach"; 
    }else{
      body.x = pos.x; body.y = pos.y;
      // tilt angle (vector from midpoint between feet to body)
      const midx = (leftFoot.x+rightFoot.x)/2;
      const midy = (leftFoot.y+rightFoot.y)/2;
      body.angle = Math.atan2(body.y-midy, body.x-midx);
      if(Math.abs(body.angle) > MAX_TILT || body.y+TORSO_R > GROUND_Y+2){
        body.alive=false; statusEl.textContent="fell: lost balance";
      }
    }
    if(footInLava(leftFoot) || footInLava(rightFoot)){
      body.alive=false; statusEl.textContent="oof! hot lava";
    }

    // Advance camera: keep body near lock X by scrolling cam when moving forward
    const targetCam = body.x - CAMERA_LOCK_X;
    const delta = targetCam - camX;
    camX += delta * 6 * dt;
    body.distance = Math.max(0, body.x/PIXELS_PER_M);
    distEl.textContent = body.distance.toFixed(1);
  }

  // DRAW
  ctx.clearRect(0,0,W,H);
  drawBackground();
  drawGround();
  drawObstacles();

  drawLeg(leftFoot);
  drawLeg(rightFoot);
  drawCharacterSprite();
  drawUI();

  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// RENDERERS
function drawBackground(){
  const img = assets.bg;
  if(!img.complete) return;
  // Parallax layers by drawing bg twice with different scroll factors
  const h = H;
  const w = Math.max(W, img.width);
  const layer1Speed = 0.3;
  const layer2Speed = 0.6;
  for(const [speed, yOff] of [[layer1Speed, 0],[layer2Speed, -10]]){
    const x = - (camX*speed) % img.width;
    ctx.globalAlpha = speed===layer1Speed ? 0.9 : 1.0;
    ctx.drawImage(img, x, 0, img.width, h);
    ctx.drawImage(img, x+img.width, 0, img.width, h);
  }
  ctx.globalAlpha = 1;
}

function drawGround(){
  ctx.fillStyle = "#152d2d";
  ctx.fillRect(0, GROUND_Y, W, H-GROUND_Y);
  // grass silhouettes
  ctx.fillStyle = "#1a3a3a";
  for(let i=0;i<W;i+=30){
    const h = 10+ (i%60?6:12);
    ctx.beginPath();
    ctx.moveTo(i,GROUND_Y);
    ctx.lineTo(i+15,GROUND_Y-h);
    ctx.lineTo(i+30,GROUND_Y);
    ctx.closePath();
    ctx.fill();
  }
}

function drawObstacles(){
  for(const o of obstacles){
    const sx = worldToScreenX(o.x);
    const ex = worldToScreenX(o.x+o.width);
    if(ex<0 || sx>W) continue;
    // pit hole
    ctx.fillStyle="#081111";
    ctx.fillRect(sx, GROUND_Y-6, ex-sx, 36);
    // lava glow
    const grd = ctx.createLinearGradient(0,GROUND_Y-4,0,GROUND_Y+40);
    grd.addColorStop(0,"#ffcf00");
    grd.addColorStop(1,"#ff5500");
    ctx.fillStyle = grd;
    ctx.fillRect(sx+2, GROUND_Y-2, ex-sx-4, 10);
  }
}

function drawLeg(foot){
  // draw wooden pole between body and foot
  ctx.lineWidth = 16;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.strokeStyle = "#2b1a0a"; // border
  ctx.beginPath();
  ctx.moveTo(worldToScreenX(body.x), body.y);
  ctx.lineTo(worldToScreenX(foot.x), foot.y);
  ctx.stroke();

  ctx.lineWidth = 12;
  ctx.strokeStyle = "#7a4d1c";
  ctx.beginPath();
  ctx.moveTo(worldToScreenX(body.x), body.y);
  ctx.lineTo(worldToScreenX(foot.x), foot.y);
  ctx.stroke();

  // foot handle
  ctx.fillStyle = (mouse.grab==="L" && foot===leftFoot) || (mouse.grab==="R" && foot===rightFoot) ? "#ffeeaa" : "#ddd";
  ctx.beginPath();
  ctx.arc(worldToScreenX(foot.x), foot.y, 6, 0, Math.PI*2);
  ctx.fill();
}

function drawCharacterSprite(){
  const img = assets.character;
  if(!img.complete){
    // fallback: simple hood
    ctx.fillStyle="#111"; ctx.beginPath();
    ctx.arc(worldToScreenX(body.x), body.y-TORSO_R*0.1, TORSO_R, Math.PI*0.1, Math.PI*1.9);
    ctx.fill();
    return;
  }
  // Draw centered at body with slight shadow; scale to torso
  const scale = (TORSO_R*2) / (img.height*0.6); // heuristic to fit
  const drawW = img.width*scale;
  const drawH = img.height*scale;
  const dx = worldToScreenX(body.x) - drawW*0.45;
  const dy = body.y - drawH*0.65;
  ctx.save();
  ctx.translate(worldToScreenX(body.x), body.y);
  ctx.rotate(body.angle*0.4);
  ctx.translate(-worldToScreenX(body.x), -body.y);
  ctx.drawImage(img, dx, dy, drawW, drawH);
  ctx.restore();
}

function drawUI(){
  // crosshair at camera lock
  // ctx.strokeStyle="rgba(255,255,255,.08)";
  // ctx.beginPath(); ctx.moveTo(CAMERA_LOCK_X,0); ctx.lineTo(CAMERA_LOCK_X,H); ctx.stroke();
}
