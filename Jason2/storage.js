(function(root){
'use strict';
let dbPromise;
const sessionData=new Map();
const projectsKey='private-projects-v1';
const categoriesKey='private-project-categories-v1';
function db(){return dbPromise||(dbPromise=new Promise((resolve,reject)=>{const req=indexedDB.open(window.JASON_CONFIG?.workspaceName||'jason-workspace-v2',1);req.onupgradeneeded=()=>req.result.createObjectStore('workspace');req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);}));}
async function get(name){if(root.JASON_CONFIG?.sandbox)return structuredClone(sessionData.get(name));const d=await db();return new Promise((resolve,reject)=>{const tx=d.transaction('workspace');const r=tx.objectStore('workspace').get(name);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
async function put(name,value){if(root.JASON_CONFIG?.sandbox){sessionData.set(name,structuredClone(value));return;}const d=await db();return new Promise((resolve,reject)=>{const tx=d.transaction('workspace','readwrite');tx.objectStore('workspace').put(value,name);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});}
async function update(name, change){
 if(root.JASON_CONFIG?.sandbox){
  const value=change(structuredClone(sessionData.get(name)));
  sessionData.set(name,structuredClone(value));
  return value;
 }
 const d=await db();
 return new Promise((resolve,reject)=>{
  const tx=d.transaction('workspace','readwrite'), store=tx.objectStore('workspace');
  const request=store.get(name);
  let value, failure;
  request.onsuccess=()=>{
   try{value=change(request.result);store.put(value,name);}
   catch(err){failure=err;tx.abort();}
  };
  tx.oncomplete=()=>resolve(value);
  tx.onabort=()=>reject(failure||tx.error);
 });
}
function readProjects(store,callback){
 const records=store.get(projectsKey),categories=store.get(categoriesKey);
 categories.onsuccess=()=>callback({records:records.result??[],categories:categories.result??[]});
}

async function legacyProjects(){
 if(root.JASON_CONFIG?.sandbox)return null;
 return new Promise((resolve,reject)=>{
  const request=indexedDB.open('union-cosmetic-jason2-sandbox');
  let missing=false;
  request.onupgradeneeded=()=>{missing=true;request.transaction.abort();};
  request.onerror=()=>{if(missing)resolve(null);else reject(request.error);};
  request.onsuccess=()=>{
   const legacy=request.result;
   if(!legacy.objectStoreNames.contains('workspace')){legacy.close();resolve(null);return;}
   const tx=legacy.transaction('workspace');
   let data;
   readProjects(tx.objectStore('workspace'),value=>{data=value;});
   tx.oncomplete=()=>{legacy.close();resolve(data);};
   tx.onabort=()=>{legacy.close();reject(tx.error);};
  };
 });
}

async function importLegacyProjects(source){
 if(root.JASON_CONFIG?.sandbox)throw Error('SANDBOX_OFFLINE');
 const database=await db();
 return new Promise((resolve,reject)=>{
  const tx=database.transaction('workspace','readwrite'),store=tx.objectStore('workspace');
  let result,failure;
  readProjects(store,current=>{
   try{
    const ids=new Set(current.records.map(record=>record.id));
    const additions=source.records.filter(record=>!ids.has(record.id));
    const categoryIds=new Set(current.categories.map(category=>category.id));
    const usedCategories=new Set(additions.map(record=>record.values.category));
    const categories=[...current.categories,...source.categories.filter(category=>
     usedCategories.has(category.id)&&!categoryIds.has(category.id))];
    const records=[...current.records,...additions];
    if(additions.length){store.put(records,projectsKey);store.put(categories,categoriesKey);}
    result={records,categories};
   }catch(error){failure=error;tx.abort();}
  });
  tx.oncomplete=()=>resolve(result);
  tx.onabort=()=>reject(failure||tx.error);
 });
}
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
// Inspect ZIP metadata without decompressing its contents. Office files must
// contain their package manifest and the matching document/workbook entry.
function zipEntries(bytes){
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),length=bytes.length;
 const invalid=()=>{throw Error('PPWR_TYPE');};
 if(length<22)invalid();
 let end=-1;for(let i=length-22;i>=Math.max(0,length-65557);i--)if(view.getUint32(i,true)===0x06054b50&&i+22+view.getUint16(i+20,true)===length){end=i;break;}
 if(end<0||view.getUint16(end+4,true)!==0||view.getUint16(end+6,true)!==0)invalid();
 const count=view.getUint16(end+10,true),size=view.getUint32(end+12,true),offset=view.getUint32(end+16,true);
 if(count===65535||view.getUint16(end+8,true)!==count||offset+size>end)invalid();
 const names=new Set();let position=offset;
 for(let i=0;i<count;i++){
  if(position+46>offset+size||view.getUint32(position,true)!==0x02014b50)invalid();
  const nameLength=view.getUint16(position+28,true),extra=view.getUint16(position+30,true),comment=view.getUint16(position+32,true),local=view.getUint32(position+42,true);
  if(position+46+nameLength+extra+comment>offset+size||local+30>offset||view.getUint32(local,true)!==0x04034b50||view.getUint16(position+34,true)!==0)invalid();
  names.add(new TextDecoder().decode(bytes.subarray(position+46,position+46+nameLength)));
  position+=46+nameLength+extra+comment;
 }
 if(position!==offset+size)invalid();return names;
}
async function ppwr(file){
 if(!file||!file.size||file.size>15*1024*1024)throw Error('PPWR_SIZE');
 const extension=String(file.name||'').split('.').pop().toLowerCase();
 if(!['docx','xlsx','zip'].includes(extension)){try{return await label(file);}catch(e){throw Error(e.message.replace('LABEL_','PPWR_'));}}
 let content;try{content=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result.split(',')[1]);reader.onerror=()=>reject(Error('PPWR_READ'));reader.readAsDataURL(file);});}catch{throw Error('PPWR_READ');}
 const bytes=Uint8Array.from(atob(content),c=>c.charCodeAt(0)),entries=zipEntries(bytes);
 if(extension!=='zip'&&(!entries.has('[Content_Types].xml')||!entries.has(extension==='docx'?'word/document.xml':'xl/workbook.xml')))throw Error('PPWR_TYPE');
 const mimeType=root.JasonModel.ppwrMimeTypes[extension];
 return {dataUrl:`data:${mimeType};base64,${content}`,name:file.name,mimeType,extension,size:file.size};
}
function ppwrPath(extension){return `OrderSheet/img/labels/ppwr-${crypto.randomUUID()}.${extension}`;}
root.JasonStorage={get,put,update,request,jpeg,label,labelPath,ppwr,ppwrPath,legacyProjects,importLegacyProjects};
})(window);
