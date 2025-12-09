import initWasm, * as wasm from "./pkg/spritefusion_pixel_snapper.js";

const fileInput = document.getElementById("fileInput");
const snapBtn = document.getElementById("snap");
const downloadBtn = document.getElementById("download");
const canvas = document.getElementById("canvas");
const slider = document.getElementById("sliderLine");
const ctx = canvas.getContext("2d");

// state
let originalFileBytes = null;
let originalImage = null;
let processedImage = null;
let displayWidth = 0;
let displayHeight = 0;
let sliderX = null;
let processing = false;

await initWasm({ url:"./pkg/spritefusion_pixel_snapper_bg.wasm" });
console.log("wasm exports:", Object.keys(wasm));

fileInput.addEventListener("change", async(ev)=>{
  const f = ev.target.files?.[0];
  if(!f) return;
  try{
    const ab = await f.arrayBuffer();
    originalFileBytes = new Uint8Array(ab);

    const blob = new Blob([originalFileBytes]);
    originalImage = await blobToImage(blob);
    processedImage = null;

    resizeCanvasToImage(originalImage);
    sliderX = displayWidth/2;
    draw();
  }catch(e){
    console.error(e);
    alert("画像の読み込みに失敗しました");
  }
});

snapBtn.addEventListener("click", async()=>{
  if(!originalFileBytes) return alert("画像を選んでください");
  if(processing) return;
  if(typeof wasm.process_image!=="function"){
    console.error("process_image missing", wasm);
    return alert("内部エラー: wasm.process_image が存在しません");
  }

  processing = true;
  snapBtn.disabled = true;

  try{
    const k_colors = 16;
    const out = wasm.process_image(originalFileBytes, k_colors);
    const outU8 = (out instanceof Uint8Array)? out : new Uint8Array(out);
    const blob = new Blob([outU8],{type:"image/png"});
    processedImage = await blobToImage(blob);

    const url = URL.createObjectURL(blob);
    downloadBtn.href = url;

    resizeCanvasToImage(processedImage);
    draw();
  }catch(e){
    console.error(e);
    alert("処理に失敗しました（Console参照）");
  }finally{
    processing = false;
    snapBtn.disabled = false;
  }
});

function blobToImage(blob){
  return new Promise((resolve,reject)=>{
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = ()=>{ URL.revokeObjectURL(url); resolve(img); };
    img.onerror = err=>{ URL.revokeObjectURL(url); reject(err); };
    img.src = url;
  });
}

function resizeCanvasToImage(img){
  const vw = document.documentElement.clientWidth;
  const ratio = img.width/img.height;

  let w = Math.min(img.width, vw);
  let h = w/ratio;

  canvas.width = w;
  canvas.height = h;
  displayWidth = w;
  displayHeight = h;
}

function draw(){
  if(!originalImage) return;
  const leftWidth = Math.max(0, Math.min(displayWidth, sliderX||displayWidth/2));

  ctx.clearRect(0,0,displayWidth,displayHeight);

  // 左側 original
  ctx.drawImage(originalImage, 0,0, leftWidth/displayWidth*originalImage.width, originalImage.height,
    0,0,leftWidth,displayHeight);

  // 右側 processed or original
  const src = processedImage || originalImage;
  ctx.drawImage(src, leftWidth/displayWidth*src.width,0,
    (displayWidth-leftWidth)/displayWidth*src.width, src.height,
    leftWidth,0, displayWidth-leftWidth, displayHeight);

  slider.style.left = leftWidth+"px";
  slider.style.height = displayHeight+"px";
}

canvas.addEventListener("pointerdown",(ev)=>{
  canvas.setPointerCapture(ev.pointerId);
});

canvas.addEventListener("pointermove",(ev)=>{
  if(ev.pressure===0 && ev.buttons===0) return;
  sliderX = ev.offsetX;
  draw();
});
