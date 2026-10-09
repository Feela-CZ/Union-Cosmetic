/* Sandbox integration tests use real app code and reject every network request. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {JSDOM}=require('jsdom'),{IDBFactory}=require('fake-indexeddb');
const clone=x=>JSON.parse(JSON.stringify(x)),database=new IDBFactory(),network=[];
const fixture={brand:'Lilien',type:'Liquid Soap',id:'8596048008129',name:'TEST Soap',csName:'TEST Mýdlo',price:1.2,volume:{number:'500',unit:'ml'},key:'500A',pack:12,boxes_per_layer:20,boxes_per_pallet:160,discontinued:false};
const logistics={Lilien:{'500A':{ITEM:{length:5,width:5,height:15,weight:.5},CARTON:{length:30,width:20,height:20,weight:6,nr_of_items:12},LAYER:{nr_of_items:240,nr_of_cartons:20},PALLET:{length:120,width:80,height:150,weight:500,nr_of_cartons:160,nr_of_items:1920,nr_of_layers:8}}}};
const seed={snapshotAt:'2026-10-09',products:[fixture],logistics};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function wait(fn){for(let i=0;i<150;i++){if(await fn())return;await sleep(10);}throw Error('Wait timed out');}
async function setup(real=false){
 const dom=new JSDOM(fs.readFileSync(path.join(__dirname,'../test/index.html'),'utf8'),{url:'https://feela-cz.github.io/Union-Cosmetic/Jason2/test/',runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window;
 w.indexedDB=real?new IDBFactory():database;w.TextEncoder=TextEncoder;w.TextDecoder=TextDecoder;
 w.HTMLElement.prototype.scrollIntoView=()=>{};w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};w.HTMLAnchorElement.prototype.click=function(){};w.URL.createObjectURL=()=>'blob:test';w.URL.revokeObjectURL=()=>{};
 w.fetch=async(url,args={})=>{network.push({url,method:args.method||'GET'});throw Error('Sandbox must not access network');};
 w.eval(fs.readFileSync(path.join(__dirname,'../test/config.js'),'utf8'));w.eval(fs.readFileSync(path.join(__dirname,'../test/seed.js'),'utf8'));if(!real)w.JASON_SANDBOX_SEED=clone(seed);
 for(const file of ['model.js','storage.js','i18n.js','vendor/exceljs.min.js','export.js','app.js'])w.eval(fs.readFileSync(path.join(__dirname,'..',file),'utf8'));
 const $=s=>w.document.querySelector(s),click=s=>{const e=$(s);assert.ok(e,`Missing ${s}`);assert.ok(!e.disabled,`Disabled ${s}`);e.click();},input=(s,v)=>{const e=$(s);e.value=v;e.dispatchEvent(new w.Event('input',{bubbles:true}));},submit=s=>$(s).dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
 const saved=async()=>clone((await w.JasonStorage.get('state'))?.state);
 await wait(()=>$('#page-title').textContent==='Produkty');await wait(async()=>!!(await saved()));
 async function upload(kind,value){click('#data-button');click(kind==='products'?'#import-products':'#restore-backup');Object.defineProperty($('#import-file'),'files',{configurable:true,value:[{name:'test.json',size:JSON.stringify(value).length,text:async()=>JSON.stringify(value)}]});$('#import-file').dispatchEvent(new w.Event('change'));await wait(()=>$('#confirm-dialog').open);click('#confirm-yes');await wait(()=>!$('#editor').open);}
 return {dom,w,$,click,input,submit,saved,upload};
}
(async()=>{
 let count=0,c=await setup();async function test(name,fn){await fn();count++;console.log('PASS',name);}
 const live=await new Promise((resolve,reject)=>{const r=database.open('union-cosmetic-jason2',1);r.onupgradeneeded=()=>r.result.createObjectStore('workspace');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
 await new Promise((resolve,reject)=>{const tx=live.transaction('workspace','readwrite');tx.objectStore('workspace').put({sentinel:'LIVE DATA'},'state');tx.oncomplete=resolve;tx.onerror=reject;});
 const liveState=()=>new Promise((resolve,reject)=>{const r=live.transaction('workspace').objectStore('workspace').get('state');r.onsuccess=()=>resolve(r.result);r.onerror=reject;});
 await test('sandbox seeds separate storage and exposes no API connection',async()=>{
  const s=await c.saved();assert.deepEqual(s.products,seed.products);assert.deepEqual(s.logistics,seed.logistics);assert.equal(s.connected,false);assert.equal(s.api,'');assert.equal(c.$('#refresh').hidden,true);assert.equal(c.$('#sandbox-banner').hidden,false);assert.match(c.$('#workspace-mode').textContent,/Testovací/);c.click('#data-button');assert.equal(c.$('#connect'),null);assert.equal(c.$('#field-api'),null);assert.ok(c.$('#reset-sandbox'));c.click('#editor-close');assert.deepEqual(network,[]);
 });
 await test('sandbox blocks API reads, writes and photo uploads before fetch',async()=>{
  assert.equal(Object.isFrozen(c.w.JASON_CONFIG),true);
  for(const [name,method] of [['products','GET'],['products','PUT'],['logistics','PUT'],['upload-image','PUT']])await assert.rejects(c.w.JasonStorage.request('https://union-cosmetic.filipluchesi.workers.dev',name,method,{}),/SANDBOX_OFFLINE/);assert.deepEqual(network,[]);
 });
 await test('sandbox product, logistics and photo edits stay local',async()=>{
  c.click('[data-edit="0"]');c.input('#field-price','9.99');c.submit('#product-form');await wait(()=>!c.$('#editor').open);assert.equal((await c.saved()).products[0].price,9.99);
  c.click('[data-view=keys]');c.click('[data-key-edit="Lilien"]');c.input('[name="CARTON:nr_of_items"]','6');c.submit('#key-form');await wait(()=>c.$('#confirm-dialog').open);c.click('#confirm-yes');await wait(()=>!c.$('#editor').open);assert.equal((await c.saved()).products[0].pack,6);
  c.w.JasonStorage.jpeg=async()=> 'data:image/jpeg;base64,/9j/2Q==';c.click('[data-view=products]');c.click('[data-edit="0"]');c.click('#tab-photo');Object.defineProperty(c.$('#photo-input'),'files',{configurable:true,value:[{name:'local.png',type:'image/png'}]});c.$('#photo-input').dispatchEvent(new c.w.Event('change'));await wait(()=>c.$('#photo-preview').src.startsWith('data:'));c.submit('#product-form');await wait(()=>!c.$('#editor').open);
  assert.equal((await c.saved()).photos[fixture.id],'data:image/jpeg;base64,/9j/2Q==');assert.deepEqual((await c.saved()).pendingPhotos,[]);assert.equal(c.$('#retry').hidden,true);assert.deepEqual(network,[]);assert.deepEqual(await liveState(),{sentinel:'LIVE DATA'});
 });
 await test('sandbox reload keeps edits and focus never refreshes shared data',async()=>{
  c.dom.window.close();c=await setup();assert.equal((await c.saved()).products[0].price,9.99);assert.equal((await c.saved()).products[0].pack,6);c.w.dispatchEvent(new c.w.Event('focus'));await sleep(20);assert.deepEqual(network,[]);
 });
 await test('sandbox imports, backup restore, undo and redo never connect',async()=>{
  await c.upload('products',[{...fixture,price:7}]);await c.upload('backup',{format:'jason-backup',version:1,products:[{...fixture,price:8}],logistics,photos:{[fixture.id]:'data:image/jpeg;base64,/9j/2Q=='},connected:true,api:'https://union-cosmetic.filipluchesi.workers.dev'});
  assert.equal((await c.saved()).connected,false);assert.equal((await c.saved()).api,'');assert.deepEqual((await c.saved()).pendingPhotos,[]);c.click('#undo');await wait(async()=>(await c.saved()).products[0].price===7);c.click('#redo');await wait(async()=>(await c.saved()).products[0].price===8);assert.deepEqual(network,[]);
 });
 await test('sandbox neutralizes connected settings in cached state',async()=>{
  const s=await c.saved();await c.w.JasonStorage.put('state',{state:{...s,connected:true,api:'https://union-cosmetic.filipluchesi.workers.dev',pendingPhotos:[fixture.id]},lang:'cs'});c.dom.window.close();c=await setup();c.click('[data-edit="0"]');c.input('#field-price','10');c.submit('#product-form');await wait(()=>!c.$('#editor').open);assert.equal((await c.saved()).connected,false);assert.equal((await c.saved()).api,'');assert.deepEqual((await c.saved()).pendingPhotos,[]);assert.deepEqual(network,[]);
 });
 await test('sandbox reset requires confirmation and preserves live storage',async()=>{
  c.click('#data-button');c.click('#reset-sandbox');await wait(()=>c.$('#confirm-dialog').open);c.click('#confirm-no');assert.equal((await c.saved()).products[0].price,10);c.click('#reset-sandbox');await wait(()=>c.$('#confirm-dialog').open);c.click('#confirm-yes');await wait(()=>!c.$('#editor').open);const s=await c.saved();assert.deepEqual(s.products,seed.products);assert.deepEqual(s.logistics,seed.logistics);assert.deepEqual(s.photos,{});assert.equal(c.$('#undo').disabled,true);assert.equal(c.$('#redo').disabled,true);assert.deepEqual(network,[]);assert.deepEqual(await liveState(),{sentinel:'LIVE DATA'});
 });
 await test('real sandbox seed has 317 products, 78 keys and styled Excel export',async()=>{
  const r=await setup(true);assert.equal((await r.saved()).products.length,317);assert.equal(r.w.JasonModel.keyEntries((await r.saved()).logistics).length,78);let workbook;r.w.JasonExport.download=async wb=>{workbook=wb;};r.click('#export');r.submit('#export-form');await wait(()=>workbook);assert.equal(workbook.getWorksheet('Products').getCell('A1').fill.fgColor.argb,'FF214A84');assert.deepEqual(network,[]);r.dom.window.close();
 });
 c.dom.window.close();live.close();console.log(`ALL ${count} SANDBOX FLOW CHECKS PASSED`);
})().catch(e=>{console.error(e);process.exitCode=1;});
