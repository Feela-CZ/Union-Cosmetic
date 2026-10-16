/* Sandbox integration tests use real app code and reject every network request. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {JSDOM}=require('jsdom'),{IDBFactory}=require('fake-indexeddb');
const clone=x=>JSON.parse(JSON.stringify(x)),database=new IDBFactory(),network=[];
const fixture={brand:'Lilien',type:'Liquid Soap',id:'8596048008129',name:'TEST Soap',csName:'TEST Mýdlo',price:1.2,volume:{number:'500',unit:'ml'},key:'500A',pack:12,boxes_per_layer:20,boxes_per_pallet:160,discontinued:false};
const logistics={Lilien:{'500A':{ITEM:{length:5,width:5,height:15,weight:.5},CARTON:{length:30,width:20,height:20,weight:6,nr_of_items:12},LAYER:{nr_of_items:240,nr_of_cartons:20},PALLET:{length:120,width:80,height:150,weight:500,nr_of_cartons:160,nr_of_items:1920,nr_of_layers:8}}}};
const seed={snapshotAt:'2026-10-09',products:[fixture],logistics};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function wait(fn){for(let i=0;i<150;i++){if(await fn())return;await sleep(10);}throw Error('Wait timed out');}
async function setup(real=false,cached=null){
 const dom=new JSDOM(fs.readFileSync(path.join(__dirname,'../test/index.html'),'utf8'),{url:'https://feela-cz.github.io/Union-Cosmetic/Jason2/test/',runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window;
 w.indexedDB=real?new IDBFactory():database;w.TextEncoder=TextEncoder;w.TextDecoder=TextDecoder;
 w.HTMLElement.prototype.scrollIntoView=()=>{};w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};w.HTMLAnchorElement.prototype.click=function(){};w.URL.createObjectURL=()=>'blob:test';w.URL.revokeObjectURL=()=>{};
 w.fetch=async(url,args={})=>{network.push({url,method:args.method||'GET'});throw Error('Sandbox must not access network');};
 w.eval(fs.readFileSync(path.join(__dirname,'../test/config.js'),'utf8'));w.eval(fs.readFileSync(path.join(__dirname,'../test/seed.js'),'utf8'));if(!real)w.JASON_SANDBOX_SEED=clone(seed);
 w.eval(fs.readFileSync(path.join(__dirname,'../../shared/packaging.js'),'utf8'));
 for(const file of ['model.js','storage.js','i18n.js','vendor/exceljs.min.js','export.js','app.js']){
  if(file==='app.js'&&cached){await w.JasonStorage.put('state',{state:clone(cached.state),lang:cached.lang||'cs'});await w.JasonStorage.put('recovery',cached.recovery?clone(cached.recovery):null);}
  w.eval(fs.readFileSync(path.join(__dirname,'..',file),'utf8'));
 }
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
  const s=await c.saved();assert.deepEqual(s.products,clone(c.w.JasonModel.cleanProducts(seed.products)));assert.deepEqual(s.logistics,seed.logistics);assert.equal(s.connected,false);assert.equal(s.api,'');assert.equal(c.$('#refresh').hidden,true);assert.equal(c.$('#sandbox-banner').hidden,false);assert.match(c.$('#workspace-mode').textContent,/Testovací/);c.click('#data-button');assert.equal(c.$('#connect'),null);assert.equal(c.$('#field-api'),null);assert.ok(c.$('#reset-sandbox'));c.click('#editor-close');assert.deepEqual(network,[]);
 });
 await test('sandbox blocks API reads, writes and photo uploads before fetch',async()=>{
  assert.equal(Object.isFrozen(c.w.JASON_CONFIG),true);
  for(const [name,method] of [['products','GET'],['products','PUT'],['logistics','PUT'],['upload-image','PUT']])await assert.rejects(c.w.JasonStorage.request('https://union-cosmetic.filipluchesi.workers.dev',name,method,{}),/SANDBOX_OFFLINE/);assert.deepEqual(network,[]);
 });
 await test('sandbox product, logistics and photo edits stay local',async()=>{
  c.click('[data-edit="0"]');c.input('#field-price','9.99');c.submit('#product-form');await wait(()=>!c.$('#editor').open);assert.equal((await c.saved()).products[0].price,9.99);
  c.click('[data-view=keys]');c.click('[data-key-edit="Lilien"]');c.input('[name="CARTON:nr_of_items"]','6');c.submit('#key-form');await wait(()=>c.$('#confirm-dialog').open);c.click('#confirm-yes');await wait(()=>!c.$('#editor').open);assert.equal((await c.saved()).products[0].pack,undefined);assert.equal(c.w.JasonModel.packaging((await c.saved()).products[0],(await c.saved()).logistics).pack,6);
  c.w.JasonStorage.jpeg=async()=> 'data:image/jpeg;base64,/9j/2Q==';c.click('[data-view=products]');c.click('[data-edit="0"]');c.click('#tab-photo');Object.defineProperty(c.$('#photo-input'),'files',{configurable:true,value:[{name:'local.png',type:'image/png'}]});c.$('#photo-input').dispatchEvent(new c.w.Event('change'));await wait(()=>c.$('#photo-preview').src.startsWith('data:'));c.submit('#product-form');await wait(()=>!c.$('#editor').open);
  assert.equal((await c.saved()).photos[fixture.id],'data:image/jpeg;base64,/9j/2Q==');assert.deepEqual((await c.saved()).pendingPhotos,[]);assert.equal(c.$('#retry').hidden,true);assert.deepEqual(network,[]);assert.deepEqual(await liveState(),{sentinel:'LIVE DATA'});
 });
 await test('sandbox labels, INCI and languages survive reload and backup without sending files or touching live storage',async()=>{
  c.click('[data-view=products]');c.click('[data-edit="0"]');c.input('#inci-text','Aqua, Parfum');
  c.click('#edit-label-languages');c.$('[data-label-language=ar]').checked=true;c.$('[data-label-language=ar]').dispatchEvent(new c.w.Event('change',{bubbles:true}));c.submit('#label-languages-form');await wait(()=>!c.$('#label-languages-dialog').open);
  const png='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a3uoAAAAASUVORK5CYII=';
  const file=new c.w.File([Buffer.from(png,'base64')],'local-label.png',{type:'image/png'});
  Object.defineProperty(c.$('#label-input-front'),'files',{configurable:true,value:[file]});c.$('#label-input-front').dispatchEvent(new c.w.Event('change',{bubbles:true}));await wait(()=>!c.$('#label-input-front').disabled);
  c.submit('#product-form');await wait(()=>!c.$('#editor').open);let s=await c.saved(),label=s.products[0].labels.front.path;
  assert.equal(s.labelFiles[label],'data:image/png;base64,'+png);assert.deepEqual(s.pendingLabels,[]);assert.equal(s.products[0].inci,'Aqua, Parfum');assert.deepEqual(s.products[0].labelLanguages,['ar']);
  c.dom.window.close();c=await setup();s=await c.saved();assert.equal(s.labelFiles[label],'data:image/png;base64,'+png);c.click('[data-edit="0"]');c.click('#tab-labels');assert.equal(c.$('[data-label-preview=front] img').src,s.labelFiles[label]);c.click('#editor-close');
  await c.upload('backup',{format:'jason-backup',version:1,products:s.products,logistics:s.logistics,photos:s.photos,labelFiles:s.labelFiles,pendingLabels:[label],connected:true,api:'https://union-cosmetic.filipluchesi.workers.dev'});
  assert.equal((await c.saved()).labelFiles[label],s.labelFiles[label]);assert.deepEqual((await c.saved()).pendingLabels,[]);assert.deepEqual(network,[]);assert.deepEqual(await liveState(),{sentinel:'LIVE DATA'});
 });
 await test('sandbox reload keeps edits and focus never refreshes shared data',async()=>{
  c.dom.window.close();c=await setup();assert.equal((await c.saved()).products[0].price,9.99);assert.equal((await c.saved()).products[0].pack,undefined);assert.equal(c.w.JasonModel.packaging((await c.saved()).products[0],(await c.saved()).logistics).pack,6);c.w.dispatchEvent(new c.w.Event('focus'));await sleep(20);assert.deepEqual(network,[]);
 });
 await test('sandbox imports, backup restore, undo and redo never connect',async()=>{
  await c.upload('products',[{...fixture,price:7}]);await c.upload('backup',{format:'jason-backup',version:1,products:[{...fixture,price:8}],logistics,photos:{[fixture.id]:'data:image/jpeg;base64,/9j/2Q=='},connected:true,api:'https://union-cosmetic.filipluchesi.workers.dev'});
  assert.equal((await c.saved()).connected,false);assert.equal((await c.saved()).api,'');assert.deepEqual((await c.saved()).pendingPhotos,[]);c.click('#undo');await wait(async()=>(await c.saved()).products[0].price===7);c.click('#redo');await wait(async()=>(await c.saved()).products[0].price===8);assert.deepEqual(network,[]);
 });
 await test('sandbox neutralizes connected settings in cached state',async()=>{
  const s=await c.saved();await c.w.JasonStorage.put('state',{state:{...s,connected:true,api:'https://union-cosmetic.filipluchesi.workers.dev',pendingPhotos:[fixture.id]},lang:'cs'});c.dom.window.close();c=await setup();c.click('[data-edit="0"]');c.input('#field-price','10');c.submit('#product-form');await wait(()=>!c.$('#editor').open);assert.equal((await c.saved()).connected,false);assert.equal((await c.saved()).api,'');assert.deepEqual((await c.saved()).pendingPhotos,[]);assert.deepEqual(network,[]);
 });
 await test('sandbox reset requires confirmation and preserves live storage',async()=>{
  c.click('#data-button');c.click('#reset-sandbox');await wait(()=>c.$('#confirm-dialog').open);c.click('#confirm-no');assert.equal((await c.saved()).products[0].price,10);c.click('#reset-sandbox');await wait(()=>c.$('#confirm-dialog').open);c.click('#confirm-yes');await wait(()=>!c.$('#editor').open);const s=await c.saved();assert.deepEqual(s.products,clone(c.w.JasonModel.cleanProducts(seed.products)));assert.deepEqual(s.logistics,seed.logistics);assert.deepEqual(s.photos,{});assert.equal(c.$('#undo').disabled,true);assert.equal(c.$('#redo').disabled,true);assert.deepEqual(network,[]);assert.deepEqual(await liveState(),{sentinel:'LIVE DATA'});
 });
 await test('fresh sandbox reflects current product and key activity and uses the actual seed date',async()=>{
  const r=await setup(true),s=await r.saved();assert.equal(s.sandboxStatusRevision,r.w.JASON_SANDBOX_SEED.statusRevision);assert.match(r.$('#sandbox-banner').textContent,/16\. 10\. 2026/);
  const sleeping=r.w.JasonModel.keyEntries(s.logistics,{status:'inactive'}).map(k=>k.brand+'/'+k.key).sort();assert.deepEqual(clone(sleeping),['Lilien/45','Lilien/5000','Natava/500g','Naturalis/250g','Sunnoré/75'].sort());assert.equal(r.w.JasonModel.keyEntries(s.logistics,{status:'active'}).length,73);
  for(const id of ['8596048004367','8596048004336','8596048004343'])assert.equal(s.products.find(p=>String(p.id)===id).discontinued,true);
  for(const id of ['8596048004312','8596048004329','8596048004350'])assert.notEqual(s.products.find(p=>String(p.id)===id).discontinued,true);
  r.click('[data-view=keys]');assert.equal(r.$('#filter-keyStatus').value,'active');r.$('#filter-keyStatus').value='inactive';r.$('#filter-keyStatus').dispatchEvent(new r.w.Event('change',{bubbles:true}));assert.equal(r.w.document.querySelectorAll('tbody tr').length,5);assert.match(r.$('tbody').textContent,/Neaktivní/);
  r.click('[data-lang=en]');await wait(()=>r.$('#page-title').textContent==='Logistics keys');assert.match(r.$('#sandbox-banner').textContent,/16 October 2026/);assert.match(r.$('tbody').textContent,/Inactive/);r.dom.window.close();assert.deepEqual(network,[]);
 });
 await test('cached sandbox and undo receive activity corrections without losing local product, logistics or label edits',async()=>{
  const fresh=await setup(true),expected=await fresh.saved(),corrections=clone(fresh.w.JASON_SANDBOX_SEED.statusCorrections);fresh.dom.window.close();const old=clone(expected);delete old.sandboxStatusRevision;
  for(const c of corrections.products){const p=old.products.find(p=>p.id===c.id);for(const k of ['discontinued','discontinued_date']){if(Object.hasOwn(c.before,k))p[k]=c.before[k];else delete p[k];}}
  for(const c of corrections.keys){const data=old.logistics[c.brand][c.key];if(Object.hasOwn(c.before,'active'))data.active=c.before.active;else delete data.active;}
  const p=old.products.find(p=>String(p.id)==='8596048004367');p.price=77;p.name='Local name';p.inci='Local formula';p.custom={keep:true};p.discontinued=false;p.discontinued_date='';p.labels={front:{path:'OrderSheet/img/labels/local-status.png'}};old.labelFiles={'OrderSheet/img/labels/local-status.png':'data:image/png;base64,aGVsbG8='};old.photos={local:'data:image/jpeg;base64,local'};old.logistics.Lilien['45'].ITEM.weight=42;
  const recovery=clone(old);recovery.products.find(p=>String(p.id)==='8596048004367').price=66;const before=clone(old);
  const r=await setup(true,{state:old,recovery});await wait(async()=>(await r.saved()).sandboxStatusRevision===expected.sandboxStatusRevision);
  for(const s of [await r.saved(),clone(await r.w.JasonStorage.get('recovery'))]){
   assert.equal(r.w.JasonModel.keyEntries(s.logistics,{status:'inactive'}).length,5);assert.equal(s.logistics.Lilien['45'].ITEM.weight,42);assert.deepEqual(s.photos,old.photos);assert.deepEqual(s.labelFiles,old.labelFiles);
   const p=s.products.find(p=>String(p.id)==='8596048004367');assert.equal(p.discontinued,true);assert.equal(p.discontinued_date,'2026-10-16');assert.equal(p.name,'Local name');assert.equal(p.inci,'Local formula');assert.deepEqual(p.custom,{keep:true});assert.deepEqual(p.labels,old.products.find(p=>String(p.id)==='8596048004367').labels);
  }
  assert.deepEqual(old,before);r.click('#undo');await wait(async()=>(await r.saved()).products.find(p=>String(p.id)==='8596048004367').price===66);assert.equal((await r.saved()).logistics.Lilien['45'].active,false);assert.deepEqual(await liveState(),{sentinel:'LIVE DATA'});assert.deepEqual(network,[]);r.dom.window.close();
 });
 await test('activity migration preserves custom status dates, missing keys and keys serving local active products; it runs only once',async()=>{
  const fresh=await setup(true),expected=await fresh.saved(),corrections=clone(fresh.w.JASON_SANDBOX_SEED.statusCorrections);fresh.dom.window.close();const old=clone(expected);delete old.sandboxStatusRevision;
  for(const c of corrections.products){const p=old.products.find(p=>p.id===c.id);delete p.discontinued;delete p.discontinued_date;}
  for(const c of corrections.keys)delete old.logistics[c.brand][c.key].active;
  const p=old.products.find(p=>String(p.id)==='8596048004336');p.discontinued=true;p.discontinued_date='2026-10-01';delete old.logistics.Natava['500g'];old.products.push({...fixture,id:'local-added-product',key:'45'});
  const r=await setup(true,{state:old});await wait(async()=>(await r.saved()).sandboxStatusRevision===expected.sandboxStatusRevision);const current=await r.saved();assert.equal(current.products.find(p=>String(p.id)==='8596048004336').discontinued_date,'2026-10-01');assert.equal(current.logistics.Natava['500g'],undefined);assert.notEqual(current.logistics.Lilien['45'].active,false);assert.equal(current.products.at(-1).id,'local-added-product');
  current.products.find(p=>String(p.id)==='8596048004343').discontinued=false;current.products.find(p=>String(p.id)==='8596048004343').discontinued_date='';current.logistics.Sunnoré['75'].active=true;r.dom.window.close();const again=await setup(true,{state:current});assert.deepEqual(await again.saved(),current);assert.deepEqual(network,[]);again.dom.window.close();
 });
 await test('real sandbox names sort correctly in Czech and English on fresh load',async()=>{
  const r=await setup(true),p=(await r.saved()).products;
  assert.equal(r.$('.product-link strong').textContent,'Lilien balzám na rty - Brusinka');
  assert.equal(p.find(x=>String(x.id)==='8596048008488').csName,'Lilien intimní sprchový gel');
  for(const x of p)for(const field of ['name','csName'])if(typeof x[field]==='string')assert.equal(x[field],x[field].trim().replace(/\s+/gu,' '));
  r.click('[data-lang=en]');await wait(()=>r.$('.product-link strong').textContent==='Lilien Body lotion Aloe Vera');
  assert.deepEqual(network,[]);r.dom.window.close();
 });
 await test('existing sandbox and restore point get exact name corrections without losing local edits',async()=>{
  const fresh=await setup(true),expected=await fresh.saved(),corrections=clone(fresh.w.JASON_SANDBOX_SEED.nameCorrections);
  fresh.dom.window.close();
  const old=clone(expected);delete old.sandboxNameRevision;
  for(const p of old.products)for(const c of corrections)if(String(p.id)===c.id&&p[c.field]===c.after)p[c.field]=c.before;
  const edited=old.products.find(p=>String(p.id)==='8596048008488');edited.name='My edited product name';edited.price=9.87;edited.custom={keep:['local edit']};
  old.photos={'8596048008488':'data:image/jpeg;base64,local'};old.logistics.Lilien['500A'].ITEM.weight=42;
  const recovery=clone(old);recovery.products.find(p=>String(p.id)==='8596048008488').price=8.76;
  const before=clone(old),recoveryBefore=clone(recovery);
  const repaired=s=>{const n=clone(s);for(const p of n.products)for(const c of corrections)if(String(p.id)===c.id&&p[c.field]===c.before)p[c.field]=c.after;n.sandboxNameRevision=expected.sandboxNameRevision;return n;};
  const r=await setup(true,{state:old,recovery});
  await wait(async()=>(await r.saved()).sandboxNameRevision===expected.sandboxNameRevision);
  assert.deepEqual(await r.saved(),repaired(old));assert.deepEqual(clone(await r.w.JasonStorage.get('recovery')),repaired(recovery));
  assert.deepEqual(old,before);assert.deepEqual(recovery,recoveryBefore);
  assert.equal(r.$('.product-link strong').textContent,'Lilien balzám na rty - Brusinka');
  r.click('#undo');await wait(async()=>(await r.saved()).products.find(p=>String(p.id)==='8596048008488').price===8.76);
  assert.equal((await r.saved()).products.find(p=>String(p.id)==='8596048008488').csName,'Lilien intimní sprchový gel');
  const current=await r.saved();current.products.find(p=>String(p.id)==='8596048008488').csName='Lilien - intimní sprchový gel';r.dom.window.close();
  const again=await setup(true,{state:current});assert.deepEqual(await again.saved(),current);
  again.dom.window.close();assert.deepEqual(network,[]);assert.deepEqual(await liveState(),{sentinel:'LIVE DATA'});
 });
 await test('cached sandbox imports INCI into state and undo without replacing local edits or custom INCI',async()=>{
  const fresh=await setup(true),expected=await fresh.saved(),revision=expected.sandboxInciRevision;fresh.dom.window.close();
  const old=clone(expected);delete old.sandboxInciRevision;
  for(const p of old.products)for(const k of ['inci','inciStatus','inciSource'])delete p[k];
  const custom=old.products.find(p=>String(p.id)==='8596048008488');custom.inci='Local custom INCI';custom.price=77;
  const changed=old.products.find(p=>String(p.id)==='8596048006965');changed.name='Local product name';changed.price=88;changed.custom={keep:true};
  old.logistics.Lilien['500A'].ITEM.weight=42;old.photos={local:'data:image/jpeg;base64,local'};
  const recovery=clone(old);recovery.products.find(p=>String(p.id)==='8596048006965').price=66;
  const r=await setup(true,{state:old,recovery});await wait(async()=>(await r.saved()).sandboxInciRevision===revision);
  const current=await r.saved(),restore=clone(await r.w.JasonStorage.get('recovery'));
  for(const s of [current,restore]){
   assert.equal(s.products.find(p=>String(p.id)==='8596048008488').inci,'Local custom INCI');
   const imported=s.products.find(p=>String(p.id)==='8596048006965');assert.equal(imported.inci,expected.products[0].inci);assert.equal(imported.name,'Local product name');assert.deepEqual(imported.custom,{keep:true});
   assert.deepEqual(s.logistics,old.logistics);assert.deepEqual(s.photos,old.photos);
   assert.equal(s.products[17].inciStatus,'pending');assert.equal(s.products[20].inciStatus,'verified');
  }
  assert.equal(current.products.find(p=>String(p.id)==='8596048006965').price,88);
  r.click('#undo');await wait(async()=>(await r.saved()).products.find(p=>String(p.id)==='8596048006965').price===66);
  assert.equal((await r.saved()).products[0].inci,expected.products[0].inci);
  assert.deepEqual(network,[]);r.dom.window.close();
 });
 await test('label INCI updates existing candles and undo while preserving custom INCI and other edits',async()=>{
  const fresh=await setup(true),expected=await fresh.saved(),corrections=clone(fresh.w.JASON_SANDBOX_SEED.inciCorrections);fresh.dom.window.close();
  assert.equal(corrections.length,7);
  const fields=['inci','inciStatus','inciSource'],old=clone(expected);old.sandboxInciRevision='20261013-verified-inci';
  for(const c of corrections){const p=old.products.find(p=>p.id===c.id);for(const k of fields){if(Object.hasOwn(c.before,k))p[k]=clone(c.before[k]);else delete p[k];}}
  const flower=old.products.find(p=>p.id==='8596048008273');flower.name='Local name';flower.price=77;flower.custom={keep:true};
  old.products.find(p=>p.id==='8596048008266').inci='My custom formula';
  const recovery=clone(old);recovery.products.find(p=>p.id==='8596048008273').price=66;
  const r=await setup(true,{state:old,recovery});await wait(async()=>(await r.saved()).sandboxInciRevision===expected.sandboxInciRevision);
  for(const s of [await r.saved(),clone(await r.w.JasonStorage.get('recovery'))]){
   assert.equal(s.products.find(p=>p.id==='8596048008266').inci,'My custom formula');
   for(const id of ['8596048008259','8596048008273','8596048012195']){
    const p=s.products.find(p=>p.id===id),e=expected.products.find(p=>p.id===id);for(const k of fields)assert.deepEqual(p[k],e[k]);
   }
   const f=s.products.find(p=>p.id==='8596048008273');assert.equal(f.name,'Local name');assert.deepEqual(f.custom,{keep:true});
   assert.ok(f.inci.includes('Oenothera Biennis Oil'));assert.ok(!f.inci.includes('Geranium Maculatum Herb Oil'));
   assert.deepEqual(s.logistics,old.logistics);assert.deepEqual(s.photos,old.photos);
  }
  const expectedFlower=expected.products.find(p=>p.id==='8596048008273');assert.equal(expectedFlower.inci.split(', ').filter(v=>v==='Geraniol*').length,1);
  r.click('#undo');await wait(async()=>(await r.saved()).products.find(p=>p.id==='8596048008273').price===66);
  assert.equal((await r.saved()).products.find(p=>p.id==='8596048008273').inci,expectedFlower.inci);
  assert.deepEqual(network,[]);r.dom.window.close();
 });
 await test('flower correction repairs a copy with the erroneous transcription without replacing custom INCI',async()=>{
  const fresh=await setup(true),expected=await fresh.saved(),corrections=clone(fresh.w.JASON_SANDBOX_SEED.inciCorrections);fresh.dom.window.close();
  const erroneous=corrections.find(c=>c.id==='8596048008273'&&c.before.inci.includes('Geranium Maculatum Herb Oil'));assert.ok(erroneous);
  const old=clone(expected);old.sandboxInciRevision='20261013-candle-labels';
  const p=old.products.find(p=>p.id===erroneous.id);Object.assign(p,clone(erroneous.before));p.price=87;p.custom={keep:true};
  const r=await setup(true,{state:old,recovery:old});await wait(async()=>(await r.saved()).sandboxInciRevision===expected.sandboxInciRevision);
  for(const s of [await r.saved(),clone(await r.w.JasonStorage.get('recovery'))]){
   const p=s.products.find(p=>p.id===erroneous.id);assert.equal(p.inci,expected.products.find(p=>p.id===erroneous.id).inci);assert.equal(p.price,87);assert.deepEqual(p.custom,{keep:true});
   assert.ok(p.inci.includes('Lavandula Angustifolia Oil, Geraniol*, Linalool*'));assert.ok(p.inci.includes('Oenothera Biennis Oil'));
  }
  r.dom.window.close();const custom=clone(old);custom.products.find(p=>p.id===erroneous.id).inci='Custom local formula';
  const c=await setup(true,{state:custom});await wait(async()=>(await c.saved()).sandboxInciRevision===expected.sandboxInciRevision);
  assert.equal((await c.saved()).products.find(p=>p.id===erroneous.id).inci,'Custom local formula');assert.deepEqual(network,[]);c.dom.window.close();
 });
 await test('safety warnings are removed from INCI in cached state and undo',async()=>{
  const fresh=await setup(true),expected=await fresh.saved(),corrections=clone(fresh.w.JASON_SANDBOX_SEED.inciCorrections);fresh.dom.window.close();
  const old=clone(expected);old.sandboxInciRevision='20261013-candle-labels';
  const ids=['8596048012331','8596048012348'];
  for(const id of ids){const p=old.products.find(p=>String(p.id)===id),c=corrections.find(c=>String(c.id)===id);assert.ok(c.before.inci.startsWith('EUH'));Object.assign(p,c.before);p.price=31;}
  const r=await setup(true,{state:old,recovery:old});await wait(async()=>(await r.saved()).sandboxInciRevision===expected.sandboxInciRevision);
  for(const s of [await r.saved(),clone(await r.w.JasonStorage.get('recovery'))])for(const id of ids){const p=s.products.find(p=>String(p.id)===id);assert.equal(p.inciStatus,'pending');assert.equal(Object.hasOwn(p,'inci'),false);assert.equal(Object.hasOwn(p,'inciSource'),false);assert.equal(p.price,31);}
  assert.deepEqual(network,[]);r.dom.window.close();
 });
 await test('real sandbox seed has 317 products, 78 keys and styled Excel export',async()=>{
  const r=await setup(true);assert.equal((await r.saved()).products.length,317);assert.equal(r.w.JasonModel.keyEntries((await r.saved()).logistics).length,78);let workbook;r.w.JasonExport.download=async wb=>{workbook=wb;};r.click('#export');r.submit('#export-form');await wait(()=>workbook);assert.equal(workbook.getWorksheet('Products').getCell('A1').fill.fgColor.argb,'FF214A84');assert.deepEqual(network,[]);r.dom.window.close();
 });
 c.dom.window.close();live.close();console.log(`ALL ${count} SANDBOX FLOW CHECKS PASSED`);
})().catch(e=>{console.error(e);process.exitCode=1;});
