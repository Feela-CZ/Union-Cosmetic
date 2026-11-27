/* Workspace integration tests use real app code and reject every network request. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {JSDOM}=require('jsdom'),{IDBFactory}=require('fake-indexeddb');
const clone=x=>JSON.parse(JSON.stringify(x)),database=new IDBFactory(),network=[];
const fixture={brand:'Lilien',type:'Liquid Soap',id:'8596048008129',name:'TEST Soap',csName:'TEST Mýdlo',price:1.2,volume:{number:'500',unit:'ml'},key:'500A',pack:12,boxes_per_layer:20,boxes_per_pallet:160,discontinued:false};
const logistics={Lilien:{'500A':{ITEM:{length:5,width:5,height:15,weight:.5},CARTON:{length:30,width:20,height:20,weight:6,nr_of_items:12},LAYER:{nr_of_items:240,nr_of_cartons:20},PALLET:{length:120,width:80,height:150,weight:500,nr_of_cartons:160,nr_of_items:1920,nr_of_layers:8}}}};
const seed={snapshotAt:'2026-10-09',products:[fixture],logistics};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function wait(fn){for(let i=0;i<150;i++){if(await fn())return;await sleep(10);}throw Error('Wait timed out');}
async function setup(real=false,{live=false,factory=real?new IDBFactory():database}={}){
 const entry=live?'':'test/';
 const dom=new JSDOM(fs.readFileSync(path.join(__dirname,'../'+entry+'index.html'),'utf8'),{url:'https://feela-cz.github.io/Union-Cosmetic/Jason2/'+entry,runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window;
 w.indexedDB=factory;w.TextEncoder=TextEncoder;w.TextDecoder=TextDecoder;w.structuredClone=structuredClone;
 w.HTMLElement.prototype.scrollIntoView=()=>{};w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};w.HTMLAnchorElement.prototype.click=function(){};w.URL.createObjectURL=()=>'blob:test';w.URL.revokeObjectURL=()=>{};
 w.fetch=async(url,args={})=>{network.push({url,method:args.method||'GET'});throw Error('Sandbox must not access network');};
 w.eval(fs.readFileSync(path.join(__dirname,'../'+entry+'config.js'),'utf8'));
 if(live)w.JASON_CONFIG.autoConnect=false;
 else{
  w.eval(fs.readFileSync(path.join(__dirname,'../test/seed.js'),'utf8'));
  if(!real)w.JASON_SANDBOX_SEED=clone(seed);
 }
 w.eval(fs.readFileSync(path.join(__dirname,'../../shared/packaging.js'),'utf8'));
 for(const file of ['model.js','storage.js','i18n.js','vendor/exceljs.min.js','export.js','test/project-fields.js','test/private-projects.js','app.js']){
  w.eval(fs.readFileSync(path.join(__dirname,'..',file),'utf8'));
 }
 const $=s=>w.document.querySelector(s),click=s=>{const e=$(s);assert.ok(e,`Missing ${s}`);assert.ok(!e.disabled,`Disabled ${s}`);e.click();},input=(s,v)=>{const e=$(s);e.value=v;e.dispatchEvent(new w.Event('input',{bubbles:true}));},submit=s=>$(s).dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
 const saved=async()=>clone((await w.JasonStorage.get('state'))?.state);
 await wait(()=>$('#page-title').textContent==='Produkty');if(!live)await wait(async()=>!!(await saved()));
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
 await test('private projects keep separate packaging drafts, localized labels and sandbox-only records',async()=>{
  const catalogue=await c.saved();
  const choose=(key,value)=>{
   const field=c.$('#project-'+key);
   field.value=value;
   field.dispatchEvent(new c.w.Event('change',{bubbles:true}));
  };
  c.click('[data-view=projects]');await wait(()=>!c.$('#create').disabled);
  c.click('#create');await wait(()=>c.$('#project-customer'));
  assert.equal(c.$('#project-name'),null);c.input('#project-customer','Example customer');
  c.input('#project-market','DE');c.input('#project-price','0,85');choose('currency','EUR');
  assert.equal(c.$('#project-stage'),null);assert.ok(c.$('#project-taxId'));
  c.click('#project-tab-product');
  choose('category','cosmetics');choose('packaging','dpak');
  choose('cooperation','existing');assert.equal(c.$('#project-fillUnit').value,'ml');choose('responsiblePerson','union');
  c.input('#project-productName','Test product');choose('fill','1000');c.input('#project-formula','TEST-001');
  assert.equal(c.$('[data-project-field=productEan]').getAttribute('aria-required'),'true');
  c.input('[data-project-field=productEan]','0123456789012');
  c.input('[data-project-field=blank]','D-PAK TEST');
  c.click('[data-project-field=sample][value=na]');
  choose('packaging','doypack');
  assert.equal(c.$('[data-project-field=blank]'),null);
  c.click('[data-project-field=batchMode][value=standard]');
  choose('packaging','dpak');
  assert.equal(c.$('[data-project-field=blank]').value,'D-PAK TEST');
  c.click('#project-tab-attachments');assert.ok(c.$('[data-add-attachment=front]'));
  assert.ok(c.$('[data-add-attachment=back]'));assert.ok(c.$('[data-add-attachment=carton]'));
  c.click('#project-save');
  await wait(()=>!c.$('#project-save').disabled&&!c.$('#toast').hidden&&c.$('#toast').textContent==='Uloženo');
  const [project]=await c.w.JasonStorage.get('private-projects-v1');
  assert.equal(project.values.packaging,'dpak');
  assert.equal(project.values.sample,'na');
  assert.equal(project.packagingValues.doypack.batchMode,'standard');
  assert.deepEqual(await c.saved(),catalogue);
  c.click('#project-back');await wait(()=>c.$('.project-list a'));
  assert.equal(c.$('.project-list .completeness').textContent,'100%');
  assert.equal(c.$('#project-filter-stage'),null);
  c.w.location.hash=new URL(c.$('.project-list a').href).hash;await wait(()=>c.$('#project-customer'));
  assert.equal(c.$('#project-customer').value,'Example customer');
  c.click('[data-lang=en]');await wait(()=>c.$('#project-tab-product').textContent==='Product');
  c.click('#project-tab-product');
  assert.equal(c.$('[data-project-field=blank]').value,'D-PAK TEST');
  assert.equal(c.$('[data-project-field=sample][value=na]').checked,true);
  c.click('[data-lang=cs]');await wait(()=>c.$('#project-tab-product').textContent==='Výrobek');
  c.click('[data-view=products]');
  assert.deepEqual(network,[]);assert.deepEqual(await liveState(),{sentinel:'LIVE DATA'});
 });
 await test('private projects validate values, check attachments and retain individually removable history',async()=>{
  const select=(key,value)=>{
   const input=c.w.document.getElementById('project-'+key);
   input.value=value;
   input.dispatchEvent(new c.w.Event('change',{bubbles:true}));
  };
  const upload=(key,name)=>{
   const input=c.$('[data-attachment-input='+key+']');
   Object.defineProperty(input,'files',{value:[{name,size:5,blob:name}]});
   input.dispatchEvent(new c.w.Event('change',{bubbles:true}));
  };
  const project=async()=>(await c.w.JasonStorage.get('private-projects-v1'))[0];
  const save=async()=>{c.click('#project-save');await wait(()=>!c.$('#project-save').disabled&&!c.$('#toast').hidden&&c.$('#toast').textContent==='Uloženo');};
  c.click('[data-view=projects]');await wait(()=>c.$('.project-list a'));c.w.location.hash=new URL(c.$('.project-list a').href).hash;
  await wait(()=>c.$('#project-customer'));
  assert.equal(c.$('#project-deliveryPlace'),null);
  assert.deepEqual([...c.$('#project-currency').options].map(option=>option.value),['','EUR','USD','CZK']);
  c.input('#project-phone','+420 123 456 789');c.input('#project-price','1 000');
  c.click('#project-save');
  assert.equal(c.$('#project-price').validity.valid,false);
  assert.equal((await project()).values.price,'0,85');
  c.input('#project-price','1,10');
  c.click('#project-tab-product');
  assert.deepEqual([...c.$('#project-fill').options].map(option=>option.value),['','500','750','1000','1500','1750','2000']);
  assert.equal(c.$('[data-project-field=compatibility]').disabled,true);
  select('dpak:barrier','evoh');
  assert.equal(c.$('[data-project-field=lineTrial]').disabled,true);
  c.click('[data-project-field=compatibility]');c.click('[data-project-field=lineTrial]');
  assert.equal(c.$('[data-project-field=lineTrial]').checked,true);
  assert.equal(c.$('[data-project-field=sealTrial]'),null);
  c.click('[data-project-field=batchMode][value=other]');
  c.input('[data-project-field=batchFormat]','YYDDD');upload('batch','batch.png');
  c.click('[data-project-field=artworkCustomer][value=ok]');
  await wait(()=>c.$('[data-project-cancel]'));c.click('[data-project-cancel]');
  await wait(()=>c.$('[data-project-field=artworkCustomer][value=""]').checked);
  c.click('[data-project-field=artworkCustomer][value=ok]');
  c.click('[data-project-confirm]');
  await wait(()=>!c.$('.project-modal[open]'));
  c.click('#project-tab-attachments');upload('front','design.pdf');
  c.click('#project-tab-product');
  c.click('[data-project-field=artworkUnion][value=ok]');
  assert.equal(c.$('.project-modal[open]'),null);
  c.input('[data-project-field=caseUnits]','1.5');
  c.click('#project-save');
  assert.equal(c.$('[data-project-field=caseUnits]').validity.valid,false);
  c.input('[data-project-field=caseUnits]','10');
  await save();
  const design=(await project()).attachments.front[0];
  c.click('#project-tab-attachments');upload('front','design.pdf');
  c.click('#project-tab-product');
  assert.equal(c.$('[data-project-field=artworkUnion][value=""]').checked,true);
  assert.equal(c.$('[data-project-field=artworkCustomer][value=""]').checked,true);
  select('packaging','bottle');
  assert.equal(c.$('[data-project-field=compatibility]'),null);
  assert.equal(c.$('[data-project-field=adhesive]'),null);
  select('packaging','doypack');
  assert.equal(c.$('[data-project-field=lineTrial]'),null);
  select('packaging','dpak');
  assert.equal(c.$('#project-fill').value,'1000');
  assert.equal(c.$('[data-project-field=lineTrial]').checked,true);
  await save();
  const stored=await project();
  assert.equal(stored.values.phone,'+420 123 456 789');
  assert.equal(stored.historyFiles[design.id].name,'design.pdf');
  assert.equal(stored.history.some(entry=>entry.before[0]==='0,85 EUR'&&entry.after[0]==='1,10 EUR'),true);
  c.click('#project-tab-history');
  const price=stored.history.find(entry=>entry.before[0]==='0,85 EUR');
  c.click('[data-remove-history="'+price.id+'"]');c.click('[data-project-confirm]');
  await wait(()=>!c.$('[data-remove-history="'+price.id+'"]'));
  await save();
  assert.equal((await project()).history.some(entry=>entry.id===price.id),false);
  assert.equal((await project()).historyFiles[design.id].name,'design.pdf');
  c.click('[data-view=products]');
 });
 await test('existing Doypack opens the simplified form with saved approvals, notes and files',async()=>{
  const r=await setup(true);
  const key='private-projects-v1';
  const base={
   id:'existing-doypack',revision:1,updatedAt:'2026-11-26T12:00:00Z',
   values:{customer:'Test customer',productName:'Test Doypack',packaging:'doypack',fill:'750',fillUnit:'ml'},
   packagingValues:{doypack:{
    laminate:'Saved laminate',primaryNotes:'Saved packaging note',markingNotes:'Saved marking note',
    labelSpec:'Saved label details',batchMode:'other',batchFormat:'YYDDD',artworkCustomer:'ok',packApproved:'ok',
    productEan:'0123456789012'
   }},
   attachments:{front:[{id:'old-front',name:'old-front.pdf',blob:'Old file'}]},
   history:[{id:'prior',at:'2026-11-26T12:00:00Z',label:['Cena','Price'],before:['1','1'],after:['2','2']}]
  };
  await r.w.JasonStorage.put(key,[base]);
  await r.w.JasonPrivateProjects.load();
  r.w.location.hash='#projects/'+base.id;
  await wait(()=>r.$('#project-customer'));
  r.click('#project-tab-product');
  for(const key of ['packagingSpec','closure','laminate','marking','labelSpec','productionDateFormat','expiryDateFormat','packApproved']){
   assert.equal(r.$('[data-project-field='+key+']'),null);
  }
  assert.equal(r.$('[data-project-field=markingNotes]').value,'Saved marking note\n\nSaved label details\n\nSaved packaging note');
  assert.equal(r.$('[data-project-field=productEan]').value,'0123456789012');
  assert.equal(r.$('[data-project-field=batchFormat]').value,'YYDDD');
  assert.ok(r.$('[data-project-field=artworkCustomer][value=ok]').checked);
  r.click('[data-project-field=artworkUnion][value=ok]');
  await wait(()=>r.$('.project-modal[open]'));
  assert.match(r.$('.project-modal p').textContent,/Tisková data/);
  r.click('[data-project-cancel]');
  await wait(()=>r.$('[data-project-field=artworkUnion][value=""]').checked);
  r.click('#project-tab-attachments');
  for(const key of ['front','back','specification'])assert.equal(r.$('[data-add-attachment='+key+']'),null);
  assert.equal(r.$('#project-attachment-print').textContent,'Tisková data');
  assert.ok(r.$('[data-download-attachment=old-front]'));
  const input=r.$('[data-attachment-input=print]');
  Object.defineProperty(input,'files',{value:[{name:'artwork.pdf',blob:'New artwork'}]});
  input.dispatchEvent(new r.w.Event('change',{bubbles:true}));
  r.click('#project-tab-product');
  r.click('[data-project-field=artworkUnion][value=ok]');
  assert.equal(r.$('.project-modal[open]'),null);
  r.click('#project-save');
  await wait(()=>!r.$('#project-save').disabled&&!r.$('#toast').hidden&&r.$('#toast').textContent==='Uloženo');
  const [stored]=await r.w.JasonStorage.get(key);
  assert.equal(stored.id,base.id);
  assert.deepEqual(stored.values,{...base.values,currency:''});
  assert.equal(stored.packagingValues.doypack.laminate,base.packagingValues.doypack.laminate);
  assert.equal(stored.packagingValues.doypack.artworkCustomer,'ok');
  assert.equal(stored.packagingValues.doypack.artworkUnion,'ok');
  assert.ok(stored.history.some(entry=>entry.id==='prior'));
  assert.deepEqual(stored.attachments.front,base.attachments.front);
  assert.equal(stored.attachments.print[0].name,'artwork.pdf');
  r.dom.window.close();
 });
 await test('project overview sorts all columns and sample approval needs no attachment',async()=>{
  const r=await setup(true),key='private-projects-v1';
  const first={id:'alpha',revision:1,updatedAt:'2026-11-25T12:00:00Z',
   values:{customer:'Alfa',productName:'Krém 2',market:'DE',packaging:'bottle',category:'cosmetics',
    sampleReference:'https://example.test/sample',formulaNotes:'Existing note'},
   packagingValues:{bottle:{labelSpec:'Old label note',marking:'label'}},
   attachments:{sample:[{id:'old-sample',name:'sample.pdf',blob:'Previous sample file'}]}
  };
  const second={id:'zulu',revision:1,updatedAt:'2026-11-26T12:00:00Z',
   values:{customer:'Žaneta',productName:'Krém 10',market:'PL',packaging:'dpak',category:'detergent',currency:'EUR'},packagingValues:{}};
  await r.w.JasonStorage.put(key,[first,second]);
  await r.w.JasonPrivateProjects.load();
  r.click('[data-view=projects]');await wait(()=>r.$('[data-project-id]'));
  const ids=()=>[...r.w.document.querySelectorAll('[data-project-id]')].map(row=>row.dataset.projectId);
  assert.deepEqual(ids(),['zulu','alpha']);
  for(const [field,ascending] of [
   ['customer',['alpha','zulu']],['product',['alpha','zulu']],['category',['zulu','alpha']],
   ['packaging',['zulu','alpha']],['market',['alpha','zulu']],['complete',['alpha','zulu']],['updated',['alpha','zulu']]
  ]){
   const target='[data-project-sort='+field+']';
   r.click(target);
   assert.deepEqual(ids(),ascending,field);
   assert.equal(r.$(target).parentElement.getAttribute('aria-sort'),'ascending');
   r.click(target);
   assert.deepEqual(ids(),ascending.slice().reverse(),field);
   assert.equal(r.$(target).parentElement.getAttribute('aria-sort'),'descending');
  }
  r.w.location.hash='#projects/alpha';await wait(()=>r.$('#project-customer'));
  assert.deepEqual([...r.w.document.querySelectorAll('.project-actions button')].map(b=>b.id),
   ['project-print','project-download','project-back','project-save']);
  r.click('#project-tab-product');
  assert.equal(r.$('[data-project-field=sampleReference]'),null);
  assert.equal(r.$('[data-project-field=labelSpec]'),null);
  assert.equal(r.$('[data-project-field=formulaNotes]').value,'Existing note\n\nhttps://example.test/sample');
  assert.equal(r.$('[data-project-field=markingNotes]').value,'Old label note');
  r.click('[data-project-field=sample][value=approved]');
  r.click('[data-project-field=packApproved][value=ok]');
  r.click('[data-project-field=cartonApproved][value=ok]');
  assert.equal(r.$('.project-modal[open]'),null);
  r.click('#project-tab-attachments');
  for(const section of ['sample','specification','cartonSpecification','print']){
   assert.equal(r.$('[data-add-attachment='+section+']'),null);
  }
  assert.ok(r.$('[data-download-attachment=old-sample]'));
  assert.ok(r.$('[data-add-attachment=front]'));
  assert.ok(r.$('[data-add-attachment=back]'));
  r.click('#project-save');
  await wait(()=>!r.$('#project-save').disabled&&!r.$('#toast').hidden);
  assert.equal(r.$('#toast').textContent,'Uloženo');
  const [saved]=await r.w.JasonStorage.get(key);
  assert.equal(saved.values.sample,'approved');
  assert.equal(saved.attachments.sample[0].id,'old-sample');
  r.click('#project-back');await wait(()=>r.$('[data-project-id=alpha]'));
  assert.equal(r.w.location.hash,'#projects');
  r.dom.window.close();
 });
 await test('sandbox product, logistics and photo edits stay local',async()=>{
  c.click('[data-edit="0"]');c.input('#field-price','9.99');c.submit('#product-form');await wait(()=>!c.$('#editor').open);assert.equal((await c.saved()).products[0].price,9.99);
  c.click('[data-view=keys]');c.click('[data-key-edit="Lilien"]');c.input('[name="CARTON:nr_of_items"]','6');c.submit('#key-form');await wait(()=>c.$('#confirm-dialog').open);c.click('#confirm-yes');await wait(()=>!c.$('#editor').open);assert.equal((await c.saved()).products[0].pack,undefined);assert.equal(c.w.JasonModel.packaging((await c.saved()).products[0],(await c.saved()).logistics).pack,6);
  c.w.JasonStorage.jpeg=async()=> 'data:image/jpeg;base64,/9j/2Q==';c.click('[data-view=products]');c.click('[data-edit="0"]');c.click('#tab-photo');Object.defineProperty(c.$('#photo-input'),'files',{configurable:true,value:[{name:'local.png',type:'image/png'}]});c.$('#photo-input').dispatchEvent(new c.w.Event('change'));await wait(()=>c.$('#photo-preview').src.startsWith('data:'));c.submit('#product-form');await wait(()=>!c.$('#editor').open);
  assert.equal((await c.saved()).photos[fixture.id],'data:image/jpeg;base64,/9j/2Q==');assert.deepEqual((await c.saved()).pendingPhotos,[]);assert.equal(c.$('#retry').hidden,true);assert.deepEqual(network,[]);assert.deepEqual(await liveState(),{sentinel:'LIVE DATA'});
 });
 await test('sandbox labels, INCI and languages survive a backup roundtrip within the session without sending files or touching live storage',async()=>{
  c.click('[data-view=products]');c.click('[data-edit="0"]');c.input('#inci-text','Aqua, Parfum');
  c.click('#edit-label-languages');c.$('[data-label-language=ar]').checked=true;c.$('[data-label-language=ar]').dispatchEvent(new c.w.Event('change',{bubbles:true}));c.submit('#label-languages-form');await wait(()=>!c.$('#label-languages-dialog').open);
  const png='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a3uoAAAAASUVORK5CYII=';
  const file=new c.w.File([Buffer.from(png,'base64')],'local-label.png',{type:'image/png'});
  Object.defineProperty(c.$('#label-input-front'),'files',{configurable:true,value:[file]});c.$('#label-input-front').dispatchEvent(new c.w.Event('change',{bubbles:true}));await wait(()=>!c.$('#label-input-front').disabled);
  c.submit('#product-form');await wait(()=>!c.$('#editor').open);let s=await c.saved(),label=s.products[0].labels.front.path;
  assert.equal(s.labelFiles[label],'data:image/png;base64,'+png);assert.deepEqual(s.pendingLabels,[]);assert.equal(s.products[0].inci,'Aqua, Parfum');assert.deepEqual(s.products[0].labelLanguages,['ar']);
  c.click('[data-edit="0"]');c.click('#tab-labels');assert.equal(c.$('[data-label-preview=front] img').src,s.labelFiles[label]);c.click('#editor-close');
  await c.upload('backup',{format:'jason-backup',version:1,products:s.products,logistics:s.logistics,photos:s.photos,labelFiles:s.labelFiles,pendingLabels:[label],connected:true,api:'https://union-cosmetic.filipluchesi.workers.dev'});
  assert.equal((await c.saved()).labelFiles[label],s.labelFiles[label]);assert.deepEqual((await c.saved()).pendingLabels,[]);assert.deepEqual(network,[]);assert.deepEqual(await liveState(),{sentinel:'LIVE DATA'});
 });
 await test('a new test page discards session projects, edits, photos and undo',async()=>{
  assert.equal((await c.saved()).products[0].price,9.99);
  assert.equal((await c.w.JasonStorage.get('private-projects-v1')).length,1);
  c.dom.window.close();c=await setup();
  const s=await c.saved();
  assert.equal(s.products[0].price,fixture.price);
  assert.deepEqual(s.logistics,logistics);
  assert.deepEqual(s.photos,{});
  assert.deepEqual(s.labelFiles,{});
  assert.equal(await c.w.JasonStorage.get('private-projects-v1'),undefined);
  assert.equal(await c.w.JasonStorage.get('recovery'),undefined);
  assert.equal(c.$('#undo').disabled,true);
  assert.deepEqual((await database.databases()).map(db=>db.name),['union-cosmetic-jason2']);
  c.w.dispatchEvent(new c.w.Event('focus'));await sleep(20);assert.deepEqual(network,[]);
 });
 await test('sandbox imports, backup restore, undo and redo never connect',async()=>{
  await c.upload('products',[{...fixture,price:7}]);await c.upload('backup',{format:'jason-backup',version:1,products:[{...fixture,price:8}],logistics,photos:{[fixture.id]:'data:image/jpeg;base64,/9j/2Q=='},connected:true,api:'https://union-cosmetic.filipluchesi.workers.dev'});
  assert.equal((await c.saved()).connected,false);assert.equal((await c.saved()).api,'');assert.deepEqual((await c.saved()).pendingPhotos,[]);c.click('#undo');await wait(async()=>(await c.saved()).products[0].price===7);c.click('#redo');await wait(async()=>(await c.saved()).products[0].price===8);assert.deepEqual(network,[]);
 });
 await test('sandbox reset requires confirmation and preserves live storage',async()=>{
  c.click('#data-button');c.click('#reset-sandbox');await wait(()=>c.$('#confirm-dialog').open);c.click('#confirm-no');assert.equal((await c.saved()).products[0].price,8);c.click('#reset-sandbox');await wait(()=>c.$('#confirm-dialog').open);c.click('#confirm-yes');await wait(()=>!c.$('#editor').open);const s=await c.saved();assert.deepEqual(s.products,clone(c.w.JasonModel.cleanProducts(seed.products)));assert.deepEqual(s.logistics,seed.logistics);assert.deepEqual(s.photos,{});assert.equal(c.$('#undo').disabled,true);assert.equal(c.$('#redo').disabled,true);assert.deepEqual(network,[]);assert.deepEqual(await liveState(),{sentinel:'LIVE DATA'});
 });
 await test('fresh sandbox reflects current product and key activity and uses the actual seed date',async()=>{
  const r=await setup(true),s=await r.saved();assert.equal(s.sandboxStatusRevision,r.w.JASON_SANDBOX_SEED.statusRevision);assert.match(r.$('#sandbox-banner').textContent,/22\. 10\. 2026/);
  const sleeping=r.w.JasonModel.keyEntries(s.logistics,{status:'inactive'}).map(k=>k.brand+'/'+k.key).sort();assert.deepEqual(clone(sleeping),['Lilien/45','Lilien/5000','Natava/500g','Naturalis/250g','Sunnoré/75'].sort());assert.equal(r.w.JasonModel.keyEntries(s.logistics,{status:'active'}).length,73);
  for(const id of ['8596048004367','8596048004336','8596048004343'])assert.equal(s.products.find(p=>String(p.id)===id).discontinued,true);
  for(const id of ['8596048004312','8596048004329','8596048004350'])assert.notEqual(s.products.find(p=>String(p.id)===id).discontinued,true);
  r.click('[data-view=keys]');assert.equal(r.$('#filter-keyStatus').value,'active');r.$('#filter-keyStatus').value='inactive';r.$('#filter-keyStatus').dispatchEvent(new r.w.Event('change',{bubbles:true}));assert.equal(r.w.document.querySelectorAll('tbody tr').length,5);assert.match(r.$('tbody').textContent,/Neaktivní/);
  r.click('[data-lang=en]');await wait(()=>r.$('#page-title').textContent==='Logistics keys');assert.match(r.$('#sandbox-banner').textContent,/22 October 2026/);assert.match(r.$('tbody').textContent,/Inactive/);r.dom.window.close();assert.deepEqual(network,[]);
 });
 await test('real sandbox names sort correctly in Czech and English on fresh load',async()=>{
  const r=await setup(true),p=(await r.saved()).products;
  assert.equal(r.$('.product-link strong').textContent,'Lilien balzám na rty - Brusinka');
  assert.equal(p.find(x=>String(x.id)==='8596048008488').csName,'Lilien intimní sprchový gel');
  for(const x of p)for(const field of ['name','csName'])if(typeof x[field]==='string')assert.equal(x[field],x[field].trim().replace(/\s+/gu,' '));
  r.click('[data-lang=en]');await wait(()=>r.$('.product-link strong').textContent==='Lilien Body lotion Aloe Vera');
  assert.deepEqual(network,[]);r.dom.window.close();
 });
 await test('real sandbox seed has 317 products, 78 keys and styled Excel export',async()=>{
  const r=await setup(true);assert.equal((await r.saved()).products.length,317);assert.equal(r.w.JasonModel.keyEntries((await r.saved()).logistics).length,78);let workbook;r.w.JasonExport.download=async wb=>{workbook=wb;};r.click('#export');r.submit('#export-form');await wait(()=>workbook);assert.equal(workbook.getWorksheet('Products').getCell('A1').fill.fgColor.argb,'FF214A84');assert.deepEqual(network,[]);r.dom.window.close();
 });
 await test('live projects persist and copy selected legacy storage without touching the catalog',async()=>{
  const factory=new IDBFactory(),key='private-projects-v1',categoryKey='private-project-categories-v1';
  const open=(name)=>new Promise((resolve,reject)=>{
   const r=factory.open(name,1);
   r.onupgradeneeded=()=>r.result.createObjectStore('workspace');
   r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);
  });
  const put=(db,entries)=>new Promise((resolve,reject)=>{
   const tx=db.transaction('workspace','readwrite');
   for(const [key,value] of entries)tx.objectStore('workspace').put(value,key);
   tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error);
  });
  const record={id:'legacy',revision:1,updatedAt:'2026-11-27T12:00:00Z',
   values:{customer:'Existing test project',category:'custom'},packagingValues:{},
   attachments:{front:[{id:'label',name:'label.pdf',blob:new Blob(['file contents'])}]},
   history:[{id:'prior',at:'2026-11-27T12:00:00Z',label:['Cena','Price'],before:['1','1'],after:['2','2']}]};
  const original={...record,id:'same',values:{customer:'Existing live project'}};
  const old=await open('union-cosmetic-jason2-sandbox');
  await put(old,[[key,[record,{...original,values:{customer:'Test duplicate'}}]],[categoryKey,[{id:'custom',name:'Custom category'}]],['state',{sentinel:'legacy catalog'}]]);
  old.close();
  const production=await open('union-cosmetic-jason2');
  await put(production,[[key,[original]]]);
  production.close();
  const sandbox=await setup(false,{factory});
  assert.equal(await sandbox.w.JasonStorage.get(key),undefined);
  assert.equal(await sandbox.w.JasonStorage.legacyProjects(),null);
  await assert.rejects(sandbox.w.JasonStorage.importLegacyProjects({records:[record],categories:[]}),/SANDBOX_OFFLINE/);
  sandbox.dom.window.close();
  let r=await setup(false,{live:true,factory});
  r.click('[data-view=projects]');await wait(()=>r.$('#project-import'));
  assert.equal(r.$('[data-project-id=legacy]'),null);
  r.click('#project-import');r.click('[data-project-confirm]');
  await wait(()=>r.$('[data-project-id=legacy]'));
  assert.equal(r.$('#project-import'),null);
  assert.equal(r.$('[data-project-id=same] a').textContent,'Existing live project');
  const records=await r.w.JasonStorage.get(key),copied=records.find(project=>project.id==='legacy');
  assert.deepEqual(copied.history,record.history);
  assert.equal(await copied.attachments.front[0].blob.text(),'file contents');
  assert.deepEqual(await r.w.JasonStorage.get(categoryKey),[{id:'custom',name:'Custom category'}]);
  assert.equal(await r.w.JasonStorage.get('state'),undefined);
  r.click('#create');await wait(()=>r.$('#project-customer'));r.input('#project-customer','Live creation');
  r.click('#project-save');await wait(()=>!r.$('#toast').hidden&&r.$('#toast').textContent==='Uloženo');
  r.dom.window.close();
  r=await setup(false,{live:true,factory});
  r.click('[data-view=projects]');await wait(()=>r.$('[data-project-id=legacy]'));
  assert.equal(r.w.document.querySelectorAll('[data-project-id]').length,3);
  assert.equal(r.$('#project-import'),null);
  assert.ok([...r.w.document.querySelectorAll('.project-list a')].some(link=>link.textContent==='Live creation'));
  assert.deepEqual(network,[]);
  r.dom.window.close();
 });
 c.dom.window.close();live.close();console.log(`ALL ${count} SANDBOX FLOW CHECKS PASSED`);
})().catch(e=>{console.error(e);process.exitCode=1;});

