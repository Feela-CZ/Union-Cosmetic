(function(root){
'use strict';
let dbPromise;
function db(){return dbPromise||(dbPromise=new Promise((resolve,reject)=>{const req=indexedDB.open(window.JASON_CONFIG?.workspaceName||'jason-workspace-v2',1);req.onupgradeneeded=()=>req.result.createObjectStore('workspace');req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);}));}
async function get(name){const d=await db();return new Promise((resolve,reject)=>{const tx=d.transaction('workspace');const r=tx.objectStore('workspace').get(name);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
async function put(name,value){const d=await db();return new Promise((resolve,reject)=>{const tx=d.transaction('workspace','readwrite');tx.objectStore('workspace').put(value,name);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});}
async function request(base,name,method='GET',data){if(window.JASON_CONFIG?.sandbox)throw Error('SANDBOX_OFFLINE');const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),30000);try{const r=await fetch(`${base.replace(/\/$/,'')}/api/${name}${method==='GET'?'?ts='+Date.now():''}`,{method,headers:method==='PUT'?{'Content-Type':'application/json'}:{},body:method==='PUT'?JSON.stringify(data):undefined,signal:controller.signal,cache:'no-store'});if(!r.ok)throw Error(`HTTP ${r.status}: ${(await r.text()).slice(0,180)}`);if(method==='GET')return await r.json();return true;}finally{clearTimeout(timeout);}}
async function jpeg(file){if(!/^image\/(jpeg|png|webp)$/.test(file.type))throw Error('PHOTO_TYPE');if(file.size>15*1024*1024)throw Error('PHOTO_SIZE');const image=await createImageBitmap(file);const scale=Math.min(1,2000/Math.max(image.width,image.height));const canvas=document.createElement('canvas');canvas.width=Math.round(image.width*scale);canvas.height=Math.round(image.height*scale);const ctx=canvas.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(image,0,0,canvas.width,canvas.height);image.close();return canvas.toDataURL('image/jpeg',0.92);}
// Label files keep their original bytes and resolution, unlike product photos.
async function label(file){
 if(!file||file.size>15*1024*1024)throw Error('LABEL_SIZE');
 const dataUrl=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=()=>reject(Error('LABEL_READ'));r.readAsDataURL(file);});
 const content=dataUrl.slice(dataUrl.indexOf(',')+1),head=atob(content.slice(0,32));
 let mimeType,extension;
 if(head.startsWith('\x89PNG\r\n\x1a\n')){mimeType='image/png';extension='png';}
 else if(head.startsWith('\xff\xd8\xff')){mimeType='image/jpeg';extension='jpg';}
 else if(head.startsWith('RIFF')&&head.slice(8,12)==='WEBP'){mimeType='image/webp';extension='webp';}
 else if(head.startsWith('%PDF-')){mimeType='application/pdf';extension='pdf';}
 else throw Error('LABEL_TYPE');
 if(mimeType!=='application/pdf'&&typeof createImageBitmap==='function'){
  try{const image=await createImageBitmap(file);image.close();}catch{throw Error('LABEL_READ');}
 }
 return {dataUrl:`data:${mimeType};base64,${content}`,name:file.name,mimeType,extension,size:file.size};
}
function labelPath(id,slot,extension){return `OrderSheet/img/labels/${String(id).replace(/[^a-zA-Z0-9_-]/g,'_').slice(0,80)||'product'}-${slot}-${crypto.randomUUID()}.${extension}`;}
root.JasonStorage={get,put,request,jpeg,label,labelPath};
})(window);

