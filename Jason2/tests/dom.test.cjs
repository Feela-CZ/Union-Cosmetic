/* Component/flow tests in a simulated DOM. These are not rendered browser tests. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
let JSDOM,IDBFactory;
try{({JSDOM}=require('jsdom'));({IDBFactory}=require('fake-indexeddb'));}catch{({JSDOM}=require('../../../test-runtime/node_modules/jsdom'));({IDBFactory}=require('../../../test-runtime/node_modules/fake-indexeddb'));}
const clone=x=>JSON.parse(JSON.stringify(x));
const fixture={brand:'Lilien',type:'Liquid Soap',id:'8596048008129',hs:'00123456',name:'TEST Soap',csName:'TEST Mýdlo',volume:{number:'500',unit:'ml',note:'keep'},price:1.2,key:'500A',pack:12,boxes_per_layer:20,boxes_per_pallet:160,carton_ean:'00123456789012',new:false,new_date:'',discontinued:false,discontinued_date:'',custom:{keep:['yes']}};
const logistics={Lilien:{'500A':{ITEM:{length:'5 cm',width:'5 cm',height:'15 cm',weight:'0.5 kg'},CARTON:{length:'30 cm',width:'20 cm',height:'20 cm',weight:'6 kg',nr_of_items:12},LAYER:{nr_of_items:240,nr_of_cartons:20},PALLET:{length:'120 cm',width:'80 cm',height:'150 cm',weight:'500 kg',nr_of_cartons:160,nr_of_items:1920,nr_of_layers:8},extra:{keep:'supplier'}}}};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function wait(fn){for(let i=0;i<150;i++){if(await fn())return;await sleep(10);}throw Error('Wait condition timed out');}
async function setup(shared=false,initialRemote=null,withPhotoObserver=false,knownPhotoIds=[fixture.id]){
 const errors=[],html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
 const dom=new JSDOM(html,{url:shared?'https://feela-cz.github.io/Union-Cosmetic/Jason2/':'https://local.test/Jason2/',runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window;
 w.indexedDB=new IDBFactory();w.HTMLElement.prototype.scrollIntoView=()=>{};w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};w.HTMLAnchorElement.prototype.click=function(){};w.URL.createObjectURL=()=>'blob:test';w.URL.revokeObjectURL=()=>{};
 w.fetch=async()=>({ok:false,status:404,text:async()=>'',json:async()=>{throw Error('404');}});
 w.console.error=e=>errors.push(e.message||String(e));
 if(knownPhotoIds!==null)w.JASON_PHOTO_IDS=knownPhotoIds;
 const photoObservers=[];
 if(withPhotoObserver)w.IntersectionObserver=class{
  constructor(callback,options){this.callback=callback;this.options=options;this.targets=new Set();photoObservers.push(this);}
  observe(target){this.targets.add(target);}
  unobserve(target){this.targets.delete(target);}
  disconnect(){this.disconnected=true;this.targets.clear();}
  show(target){this.callback([{target,isIntersecting:true}]);}
 };
 w.eval(fs.readFileSync(path.join(__dirname,'../config.js'),'utf8'));if(!shared){w.JASON_CONFIG.sharedOnly=false;w.JASON_CONFIG.autoConnect=false;w.JASON_SEED_LOGISTICS=JSON.parse(fs.readFileSync(path.join(__dirname,'../../JSON edit GUI/logistics.json'),'utf8'));}if(initialRemote)w.fetch=initialRemote;
 w.TextEncoder=TextEncoder;w.TextDecoder=TextDecoder;
 w.eval(fs.readFileSync(path.join(__dirname,'../../shared/packaging.js'),'utf8'));
 for(const name of ['model.js','storage.js','i18n.js','vendor/exceljs.min.js','export.js','app.js'])w.eval(fs.readFileSync(path.join(__dirname,'..',name),'utf8'));
 const $=s=>w.document.querySelector(s),$$=s=>[...w.document.querySelectorAll(s)],click=s=>{const e=$(s);assert.ok(e,`Missing ${s}`);assert.ok(!e.disabled,`Disabled ${s}`);e.click();},input=(s,v)=>{const e=$(s);assert.ok(e,`Missing ${s}`);e.value=v;e.dispatchEvent(new w.Event('input',{bubbles:true}));},change=(s,v)=>{const e=$(s);e.value=v;e.dispatchEvent(new w.Event('change',{bubbles:true}));};
 await wait(()=>$('#page-title').textContent==='Produkty');
 const saved=async()=>clone((await w.JasonStorage.get('state'))?.state);
 async function upload(kind,data,confirm=true){click('#data-button');click(kind==='products'?'#import-products':kind==='logistics'?'#import-logistics':'#restore-backup');Object.defineProperty($('#import-file'),'files',{configurable:true,value:[{name:'test.json',size:JSON.stringify(data).length,text:async()=>JSON.stringify(data)}]});$('#import-file').dispatchEvent(new w.Event('change'));if(confirm){await wait(()=>$('#confirm-dialog').open);click('#confirm-yes');await wait(()=>!$('#editor').open);}}
 const submit=s=>{$(s).dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));};
 return {w,dom,$,$$,click,input,change,saved,upload,submit,errors,photoObservers};
}
async function pickLanguages(n,codes,apply=true){
 n.click('#edit-label-languages');
 for(const code of codes){if(!n.$(`[data-label-language="${code}"]`))n.input('#label-language-search',code);const el=n.$(`[data-label-language="${code}"]`);assert.ok(el);el.checked=true;el.dispatchEvent(new n.w.Event('change',{bubbles:true}));n.input('#label-language-search','');}
 if(apply)n.submit('#label-languages-form');else n.click('#label-languages-cancel');
 await wait(()=>!n.$('#label-languages-dialog').open);
}
(async()=>{
 let passed=0;const c=await setup(),{w,$,$$,click,input,change,saved,upload,submit,errors}=c;
 async function test(name,fn){await fn();passed++;console.log('PASS',name);}
 await test('product information editor has accessible tabs and both upload slots without a layout selector',async()=>{
  const n=await setup();await n.upload('products',[fixture]);const before=await n.saved();
  n.click('[data-edit="0"]');
  assert.deepEqual(n.$$('[data-tab]').map(b=>b.dataset.tab),['details','packaging','inci','labelLanguages','labels','photo','flags']);
  for(const tab of ['inci','labelLanguages','labels']){
   n.click('#tab-'+tab);assert.equal(n.$('#section-'+tab).hidden,false);
   assert.equal(n.$$('.tab-section:not([hidden])').length,1);
   assert.ok(n.$('#section-'+tab).textContent.includes('TBD'));
   assert.equal(n.$('#tab-'+tab).getAttribute('aria-controls'),'section-'+tab);
   assert.equal(n.$('#section-'+tab).getAttribute('aria-labelledby'),'tab-'+tab);
  }
  assert.deepEqual(n.$$('[data-label-slot]:not([hidden])').map(e=>e.dataset.labelSlot),['front','back']);
  assert.equal(n.$('[data-label-slot=back] .label-state').textContent,'N/A');
  assert.equal(n.$('[data-label-slot=front] .label-state').textContent,'TBD');
  assert.equal(n.$('[data-label-upload=back]').disabled,false);
  for(const tab of ['inci','labelLanguages']){
   assert.equal((n.$('#section-'+tab).textContent.match(/TBD/g)||[]).length,1);
   assert.ok(!n.$('#section-'+tab).textContent.includes('Under construction'));
  }
  assert.equal(n.$('#section-inci h3').textContent,'INCI');
  assert.equal(n.$('#section-labelLanguages h3').textContent,'Jazyky etikety');
  assert.equal(n.$('[data-label-language=cs]'),null);
  assert.equal(n.$('#label-language-codes').textContent,'TBD');
  assert.equal(n.$('#copy-label-languages').disabled,true);
  assert.deepEqual(n.$$('[data-label-slot] h4').map(e=>e.textContent),['Přední','Zadní']);
  assert.equal(n.$('[data-label-layout]'),null);
  n.$('#tab-labels').dispatchEvent(new n.w.KeyboardEvent('keydown',{key:'ArrowLeft',bubbles:true}));
  assert.equal(n.$('#tab-labelLanguages').getAttribute('aria-selected'),'true');
  n.click('#editor-close');assert.equal(n.$('#confirm-dialog').open,false);assert.equal(n.$('#editor').open,false);
  assert.deepEqual(await n.saved(),before);
  n.click('[data-lang=en]');n.click('[data-edit="0"]');assert.equal(n.$('#tab-labelLanguages').textContent,'Label languages');
  n.click('#tab-labels');assert.equal(n.$('[data-label-slot=front] h4').textContent,'Front');
  n.click('#editor-close');assert.deepEqual(n.errors,[]);n.dom.window.close();
 });
 await test('product languages are copyable codes only; picker cancellation and unchanged confirmation never dirty the product',async()=>{
  const n=await setup();await n.upload('products',[{...fixture,labelLanguages:['en','cs','de']}]);const before=await n.saved();
  let copied;Object.defineProperty(n.w.navigator,'clipboard',{value:{writeText:async value=>{copied=value;}}});
  n.click('[data-edit="0"]');n.click('#tab-labelLanguages');assert.equal(n.$('#label-language-codes').textContent,'EN, CS, DE');assert.equal(n.$$('[data-label-language]').length,0);assert.equal(n.$('#label-other-languages'),null);
  assert.equal(n.$('#section-labelLanguages').textContent.includes('čeština'),false);n.click('#copy-label-languages');await wait(()=>copied==='EN, CS, DE');assert.deepEqual(await n.saved(),before);
  await pickLanguages(n,['ar'],false);assert.equal(n.$('#label-language-codes').textContent,'EN, CS, DE');
  await pickLanguages(n,[]);assert.equal(n.$('#label-language-codes').textContent,'EN, CS, DE');
  n.click('#editor-close');assert.equal(n.$('#confirm-dialog').open,false);assert.deepEqual(await n.saved(),before);assert.deepEqual(n.errors,[]);n.dom.window.close();
 });
 await test('compact language picker maps searched names to codes, supports clearing and only saves with the product',async()=>{
  const n=await setup();await n.upload('products',[fixture]);const before=await n.saved();n.click('[data-edit="0"]');n.click('#tab-labelLanguages');n.click('#edit-label-languages');
  assert.equal(n.$('#label-languages-dialog').open,true);assert.equal(n.$$('#label-language-choices small').length,0);assert.equal(n.$('#label-language-choices').textContent.includes('CS'),false);
  n.input('#label-language-search','portugal');assert.equal(n.$$('[data-label-language]').length,1);assert.equal(n.$('[data-label-language]').dataset.labelLanguage,'pt');n.$('[data-label-language=pt]').click();
  n.input('#label-language-search','');n.$('[data-label-language=ar]').click();n.submit('#label-languages-form');await wait(()=>!n.$('#label-languages-dialog').open);assert.equal(n.$('#label-language-codes').textContent,'PT, AR');assert.deepEqual(await n.saved(),before);
  n.submit('#product-form');await wait(()=>!n.$('#editor').open);assert.deepEqual((await n.saved()).products[0].labelLanguages,['pt','ar']);
  n.click('[data-edit="0"]');n.click('#edit-label-languages');for(const el of n.$$('[data-label-language]:checked'))el.click();n.submit('#label-languages-form');await wait(()=>!n.$('#label-languages-dialog').open);assert.equal(n.$('#label-language-codes').textContent,'TBD');assert.equal(n.$('#copy-label-languages').disabled,true);
  n.submit('#product-form');await wait(()=>!n.$('#editor').open);assert.deepEqual((await n.saved()).products[0].labelLanguages,[]);assert.deepEqual(n.errors,[]);n.dom.window.close();
 });
 await test('INCI renders as text and copying never changes product data or submits the form',async()=>{
  const n=await setup(),inci='Aqua, <test>, Parfum.\nLinalool*';await n.upload('products',[{...fixture,inci,inciStatus:'verified'}]);
  let copied;Object.defineProperty(n.w.navigator,'clipboard',{value:{writeText:async text=>{copied=text;}}});
  const before=await n.saved();n.click('[data-edit="0"]');n.click('#tab-inci');
  assert.equal(n.$('#inci-text').value,inci);assert.equal(n.$('#section-inci test'),null);
  assert.equal(n.$('#copy-inci').disabled,false);n.click('#copy-inci');await wait(()=>copied===inci);
  assert.equal(n.$('#toast').parentElement,n.$('#editor'));assert.equal(n.$('#toast').hidden,false);
  assert.equal(n.$('#editor').open,true);assert.deepEqual(await n.saved(),before);
  n.click('#editor-close');assert.equal(n.$('#confirm-dialog').open,false);
  for(const [product,label] of [[{...fixture,inciStatus:'not-applicable'},'N/A'],[{...fixture,inciStatus:'pending'},'TBD']]){
   await n.upload('products',[product]);n.click('[data-edit="0"]');n.click('#tab-inci');
   assert.equal(n.$('#inci-text').placeholder,label);assert.equal(n.$('#copy-inci').disabled,true);n.click('#editor-close');
  }
  assert.deepEqual(n.errors,[]);n.dom.window.close();
 });
 await test('modal clipboard notifications reopen in the top layer and dismiss after their timeout',async()=>{
  const n=await setup();await n.upload('products',[{...fixture,inci:'Aqua, Parfum'}]);
  const e=n.$('#toast');let shown=0,open=false,dismiss,delay;
  e.showPopover=()=>{assert.equal(e.hidden,false);assert.equal(e.parentElement,n.$('#editor'));open=true;shown++;};
  e.hidePopover=()=>{open=false;};
  const timer=n.w.setTimeout.bind(n.w);n.w.setTimeout=(fn,ms,...args)=>{if(ms===3500||ms===9000){dismiss=fn;delay=ms;return 99999;}return timer(fn,ms,...args);};
  let fail=false;Object.defineProperty(n.w.navigator,'clipboard',{value:{writeText:async()=>{if(fail)throw Error('Clipboard denied');}}});
  n.click('[data-edit="0"]');n.click('#tab-inci');const before=await n.saved();
  n.click('#copy-inci');await wait(()=>shown===1);assert.equal(e.getAttribute('popover'),'manual');assert.equal(open,true);assert.equal(delay,3500);
  n.click('#copy-inci');await wait(()=>shown===2);assert.equal(open,true);
  dismiss();assert.equal(open,false);assert.equal(e.hidden,true);assert.equal(n.$('#editor').open,true);
  fail=true;n.click('#copy-inci');await wait(()=>shown===3);assert.equal(e.className,'error');assert.equal(delay,9000);assert.equal(open,true);
  dismiss();assert.equal(e.hidden,true);assert.deepEqual(await n.saved(),before);assert.deepEqual(n.errors,['Clipboard denied']);
  n.dom.window.close();
 });
 await test('saving an existing product through preview tabs preserves future metadata and never stores TBD',async()=>{
  const n=await setup(),p={...fixture,inci:'Existing formula',labelLanguages:['cs','en'],labels:{front:{path:'custom.pdf',revision:2}},extra:{future:true}};
  await n.upload('products',[p]);n.click('[data-edit="0"]');n.click('#tab-labels');n.click('#tab-inci');
  n.input('#field-price','2.45');n.submit('#product-form');await wait(()=>!n.$('#editor').open);
  const result=(await n.saved()).products[0];assert.deepEqual(result.labels,p.labels);assert.deepEqual(result.labelLanguages,p.labelLanguages);assert.equal(result.inci,p.inci);assert.deepEqual(result.extra,p.extra);assert.equal(result.price,2.45);
  assert.ok(!JSON.stringify(result).includes('TBD'));assert.ok(!Object.hasOwn(result,'labelLayout'));
  assert.deepEqual(n.errors,[]);n.dom.window.close();
 });
 await test('clean product names sort alphabetically in both languages and export in the same order',async()=>{
  const n=await setup(),products=[
   {...fixture,id:'1',name:'Lilien liquid soap Hygiene Plus',csName:'Lilien intimní sprchový gel'},
   {...fixture,id:'2',name:'Lilien Body lotion Aloe Vera',csName:'Lilien balzám na rty - Brusinka'},
   {...fixture,id:'3',name:'Lilien Boys Shampoo & Bath',csName:'Lilien balzám na rty - Klasik'}
  ];await n.upload('products',products);const before=await n.saved();
  const ids=()=>n.$$('tbody tr [data-select]').map(e=>products[Number(e.dataset.select)].id);
  assert.deepEqual(ids(),['2','3','1']);
  n.click('[data-lang=en]');assert.deepEqual(ids(),['2','3','1']);
  n.click('[data-sort=name]');assert.deepEqual(ids(),['1','3','2']);
  let wb;n.w.JasonExport.download=async x=>{wb=x;};n.click('#export');n.submit('#export-form');await wait(()=>wb);
  const ws=wb.getWorksheet('Products');assert.deepEqual([4,5,6].map(row=>ws.getCell('C'+row).value),['1','3','2']);
  await wait(()=>!n.$('#export-form [type=submit]').disabled);n.click('#editor-close');
  assert.deepEqual((await n.saved()).products,before.products);assert.deepEqual(n.errors,[]);n.dom.window.close();
 });
 await test('first hosted visit shows the published catalog before a slow API and blocks edits until verification',async()=>{
  let resolveProducts,resolveLogistics,puts=0;const apiProducts=new Promise(r=>resolveProducts=r),apiLogistics=new Promise(r=>resolveLogistics=r),actual={...fixture,name:'Current API product'};
  const n=await setup(true,async(url,args={})=>{
   if(args.method==='PUT'){puts++;throw Error('Unexpected write');}
   const pathname=new URL(url,'https://feela-cz.github.io/Union-Cosmetic/Jason2/').pathname;
   if(pathname.endsWith('/products.json'))return {ok:true,json:async()=>[clone(fixture)]};
   if(pathname.endsWith('/logistics.json'))return {ok:true,json:async()=>clone(logistics)};
   if(pathname.endsWith('/api/products'))return apiProducts;
   if(pathname.endsWith('/api/logistics'))return apiLogistics;
   throw Error('Unexpected request '+url);
  });
  await wait(()=>n.$$('tbody tr').length===1);assert.equal(n.$('#create').disabled,true);assert.equal(n.$('#save-status').textContent,'Načítám společná data…');assert.equal(puts,0);
  n.click('[data-edit="0"]');assert.equal(n.$('#editor').open,false);n.click('[data-more="0"]');assert.equal(n.$('#editor').open,false);
  n.click('[data-select="0"]');n.click('#bulk-edit');assert.equal(n.$('#editor').open,false);
  resolveProducts({ok:true,json:async()=>[clone(actual)]});resolveLogistics({ok:true,json:async()=>clone(logistics)});
  await wait(()=>!n.$('#create').disabled);const state=await n.saved();assert.equal(state.products[0].name,actual.name);assert.equal(state.connected,true);assert.equal(puts,0);
  n.click('[data-edit="0"]');assert.equal(n.$('#field-name').value,actual.name);n.click('#editor-close');assert.deepEqual(n.errors,[]);n.dom.window.close();
 });
 await test('missing product fields show translated findings and open the relevant tabs without changing data',async()=>{
  const n=await setup();await n.upload('logistics',logistics);
  const p={...fixture,hs:' ',carton_ean:null,volume:{number:null,unit:null},price:' ',new:true,new_date:''};
  await n.upload('products',[p,{...p,id:'retired',discontinued:true}]);const before=await n.saved();
  n.click('[data-view=checks]');assert.equal(n.$$('tbody tr').length,6);
  for(const [label,tab] of [['HS kód','details'],['EAN kartonu','packaging'],['Objem / množství – hodnota','details'],['Objem / množství – jednotka','details'],['Datum novinky','flags'],['Cena','details']]){
   n.input('#search',label);assert.equal(n.$$('tbody tr').length,1,label);
   n.click('[data-issue]');assert.equal(n.$('#tab-'+tab).getAttribute('aria-selected'),'true');
   if(label==='Objem / množství – jednotka')assert.equal(n.$('[name=volume-unit]').value,'');
   n.click('#editor-close');
  }
  n.input('#search','');n.click('[data-lang=en]');n.input('#search','Volume / quantity – unit');
  assert.equal(n.$$('tbody tr').length,1);assert.ok(n.$('tbody').textContent.includes('Missing value'));
  assert.deepEqual(await n.saved(),before);assert.deepEqual(n.errors,[]);n.dom.window.close();
 });
 await test('logistics findings identify searchable missing fields and open the correct key',async()=>{
  const n=await setup(),keys=clone(logistics);keys.Lilien['500A'].PALLET.weight=' ';
  await n.upload('products',[fixture]);await n.upload('logistics',keys);const before=await n.saved();
  n.click('[data-view=checks]');n.input('#search','Paleta / Hmotnost');assert.equal(n.$$('tbody tr').length,1);
  n.click('[data-issue]');assert.equal(n.$('#key-form [name=key]').value,'500A');n.click('#editor-close');
  assert.deepEqual(await n.saved(),before);assert.deepEqual(n.errors,[]);n.dom.window.close();
 });
 await test('missing photo finding opens the photo tab and clears after saving a local photo',async()=>{
  const n=await setup(),missing={...fixture,id:'0012345678901',csName:'Missing photo'};
  await n.upload('products',[missing,{...missing,id:'retired',discontinued:true}]);
  n.click('[data-view=checks]');
  const rows=n.$$('tbody tr').filter(r=>r.textContent.includes('Chybí fotografie'));
  assert.equal(rows.length,1);assert.ok(rows[0].textContent.includes('Missing photo'));
  rows[0].querySelector('button').click();assert.equal(n.$('#tab-photo').getAttribute('aria-selected'),'true');
  n.w.JasonStorage.jpeg=async()=>'data:image/jpeg;base64,/9j/2Q==';
  Object.defineProperty(n.$('#photo-input'),'files',{configurable:true,value:[{name:'new.jpg',type:'image/jpeg'}]});
  n.$('#photo-input').dispatchEvent(new n.w.Event('change'));await wait(()=>n.$('#photo-preview').src.startsWith('data:'));
  n.submit('#product-form');await wait(()=>!n.$('#editor').open);
  assert.ok(!n.$('#content').textContent.includes('Chybí fotografie'));assert.deepEqual(n.errors,[]);n.dom.window.close();
 });
 await test('unavailable photo index is shown explicitly without missing-photo false positives',async()=>{
  const n=await setup(false,null,false,null);await n.upload('products',[fixture]);n.click('[data-view=checks]');
  assert.ok(n.$('#content').textContent.includes('Seznam fotografií se nepodařilo načíst'));
  assert.ok(!n.$$('#content tbody tr').some(r=>r.textContent.includes('Chybí fotografie')));n.dom.window.close();
 });
 await test('row photos load only on visibility, reuse URLs and open the original without edits',async()=>{
  const n=await setup(false,null,true),products=Array.from({length:64},(_,i)=>({...fixture,id:String(1000000000000+i),csName:'Product '+i}));
  await n.upload('products',products);const before=await n.saved();
  const observer=n.photoObservers.at(-1),images=n.$$('[data-photo-src]');
  assert.equal(images.length,30);assert.equal(observer.targets.size,30);assert.equal(observer.options.rootMargin,'0px');
  assert.ok(images.every(img=>!img.hasAttribute('src')));
  const image=images[0],button=image.closest('.product-thumb'),url=image.dataset.photoSrc;
  assert.match(url,/\/thumbnails\/\d+\.jpg\?v=/);assert.equal(image.getAttribute('loading'),'lazy');assert.equal(image.getAttribute('decoding'),'async');
  observer.show(button);assert.equal(image.src,url);image.dispatchEvent(new n.w.Event('load'));
  assert.equal(button.disabled,false);assert.equal(button.querySelector('.photo-fallback').hidden,true);
  button.click();assert.ok(n.$('#photo-dialog').open);assert.ok(!n.$('#editor').open);
  assert.ok(!n.$('#large-photo').src.includes('/thumbnails/'));n.click('#photo-close');
  n.$('[data-select]').dispatchEvent(new n.w.Event('change'));
  assert.notEqual(observer.disconnected,true);assert.equal(n.$('[data-photo-src]'),image);assert.equal(n.$('[data-photo-src]').dataset.photoSrc,url);
  assert.equal(n.$('[data-photo-src]').src,url);
  const failed=n.$$('[data-photo-src]')[1],failedUrl=failed.dataset.photoSrc;
  n.photoObservers.at(-1).show(failed.closest('.product-thumb'));failed.dispatchEvent(new n.w.Event('error'));
  assert.equal(failed.hidden,true);assert.equal(failed.closest('button').disabled,true);
  n.change('#page-size','60');assert.ok(!n.$$('[data-photo-src]').some(img=>img.dataset.photoSrc===failedUrl));
  assert.equal(n.$$('[data-row-photo]').length,60);assert.deepEqual(await n.saved(),before);assert.deepEqual(n.errors,[]);n.dom.window.close();
 });
 await test('All displays every filtered product and preserves selections without rebuilding rows or photo observers',async()=>{
  const n=await setup(false,null,true),products=Array.from({length:131},(_,i)=>({...fixture,id:String(1000000000000+i),csName:'Product '+i}));
  await n.upload('products',products);const before=await n.saved();n.click('[data-select="0"]');n.change('#page-size','all');
  assert.equal(n.$$('#content tbody tr').length,131);assert.equal(n.$('#page-size').value,'all');assert.equal(n.$('#page-size option[value=all]').textContent,'Vše');assert.equal(n.$('#prev').disabled,true);assert.equal(n.$('#next').disabled,true);assert.ok(n.$('#pagination').textContent.includes('1–131'));
  const observer=n.photoObservers.at(-1),image=n.$('[data-photo-src]'),last=n.$('[data-select="130"]');n.click('[data-select="130"]');
  assert.equal(n.$('[data-select="130"]'),last);assert.equal(n.$('[data-photo-src]'),image);assert.notEqual(observer.disconnected,true);assert.equal(n.$('#select-page').indeterminate,true);
  n.change('#page-size','30');assert.equal(n.$$('tbody tr').length,30);n.change('#page-size','all');assert.equal(n.$('[data-select="0"]').checked,true);assert.equal(n.$('[data-select="130"]').checked,true);
  let wb;n.w.JasonExport.download=async book=>{wb=book;};n.click('#export');n.submit('#export-form');await wait(()=>wb);assert.equal(wb.getWorksheet('Products').rowCount,5);assert.deepEqual([4,5].map(row=>wb.getWorksheet('Products').getCell('C'+row).value),[products[0].id,products[130].id]);await wait(()=>!n.$('#export-form [type=submit]').disabled);n.click('#editor-close');
  const currentImage=n.$('[data-photo-src]');n.click('#select-page');assert.ok(n.$$('[data-select]').every(c=>c.checked));assert.equal(n.$('#select-page').indeterminate,false);n.click('#bulk-clear');assert.ok(n.$$('[data-select]').every(c=>!c.checked));assert.equal(n.$('[data-photo-src]'),currentImage);
  n.click('[data-lang=en]');await wait(()=>n.$('#page-size option[value=all]').textContent==='All');assert.equal(n.$$('tbody tr').length,131);
  n.input('#search','no matches');assert.equal(n.$$('tbody tr').length,0);assert.ok(n.$('#pagination').textContent.includes('0–0'));assert.ok(!n.$('#pagination').textContent.includes('NaN'));n.input('#search','Product 130');assert.equal(n.$$('tbody tr').length,1);assert.equal(n.$('#page-size').value,'all');
  assert.deepEqual(await n.saved(),before);assert.deepEqual(n.errors,[]);n.dom.window.close();
 });
 await test('row photos prefer local restored photos without remote downloads',async()=>{
  const n=await setup(false,null,true),data='data:image/jpeg;base64,/9j/2Q==';
  await n.upload('backup',{format:'jason-backup',version:1,products:[fixture],logistics,photos:{[fixture.id]:data}});
  const image=n.$('[data-photo-src]');assert.equal(image.dataset.photoSrc,data);assert.equal(image.hasAttribute('src'),false);
  n.photoObservers.at(-1).show(image.closest('button'));image.dispatchEvent(new n.w.Event('load'));image.closest('button').click();
  assert.equal(n.$('#large-photo').src,data);assert.ok(n.$('#photo-dialog').open);n.dom.window.close();
 });
 await test('key overview shows pallet items, weight and display-only estimated height with plain legends',async()=>{
  const n=await setup(),keys=clone(logistics);keys.Lilien['500A'].PALLET.weight='500,5 kg';keys.Lilien['missing']=n.w.JasonModel.emptyLogistics();
  await n.upload('products',[fixture]);await n.upload('logistics',keys);const before=await n.saved();
  n.click('[data-view=keys]');const headings=n.$$('thead th').map(e=>e.textContent);
  assert.deepEqual(headings.slice(2,5),['Kusů na paletě','Hmotnost palety (kg)','Orientační výška palety (cm)']);
  assert.ok(!headings.includes('Kusů v kartonu'));
  let cells=n.$$('tbody tr')[0].querySelectorAll('td');assert.equal(cells[2].textContent.replace(/\s/g,''),'1920');assert.equal(cells[3].textContent,'500,5');assert.equal(cells[4].textContent,'≈ 174,4');assert.match(cells[4].title,/14,4/);
  assert.deepEqual(Array.from(n.$$('tbody tr')[1].querySelectorAll('td')).slice(2,5).map(e=>e.textContent),['—','—','—']);
  n.click('[data-lang=en]');await wait(()=>n.$$('thead th')[4].textContent==='Estimated pallet height (cm)');assert.equal(n.$$('tbody tr')[0].querySelectorAll('td')[4].textContent,'≈ 174.4');
  n.click('[data-key-edit="Lilien"][data-key-name="500A"]');assert.deepEqual(n.$$('#logistics-fields legend').map(e=>e.textContent),['Item','Carton','Layer','Pallet']);assert.equal(n.$('.section-letter'),null);
  n.click('#editor-close');assert.deepEqual(await n.saved(),before);assert.deepEqual(n.errors,[]);n.dom.window.close();
 });
 await test('imports remove old packaging counts and reassignment reads only the new key',async()=>{
  const n=await setup(),original={...fixture,pack:'99',boxes_per_layer:'01',boxes_per_pallet:null},keys=clone(logistics);
  keys.Lilien['500B']=clone(keys.Lilien['500A']);keys.Lilien['500B'].CARTON.nr_of_items=24;keys.Lilien['500B'].LAYER.nr_of_cartons=10;keys.Lilien['500B'].PALLET.nr_of_cartons=80;
  await n.upload('products',[original]);await n.upload('logistics',keys);n.click('[data-edit="0"]');n.click('#tab-packaging');
  for(const field of ['pack','boxes_per_layer','boxes_per_pallet'])assert.equal(n.$('#field-'+field),null);
  assert.equal(n.$('#field-carton_ean').value,fixture.carton_ean);n.input('#field-price','2.5');n.submit('#product-form');await wait(()=>!n.$('#editor').open);
  let p=(await n.saved()).products[0];assert.equal(p.price,2.5);for(const field of ['pack','boxes_per_layer','boxes_per_pallet'])assert.ok(!Object.hasOwn(p,field));assert.equal(n.w.JasonModel.packaging(p,(await n.saved()).logistics).pack,12);
  n.click('[data-edit="0"]');n.click('#tab-packaging');n.change('#product-key','500B');n.submit('#product-form');await wait(()=>!n.$('#editor').open);
  p=(await n.saved()).products[0];assert.deepEqual(clone(n.w.JasonModel.packaging(p,(await n.saved()).logistics)),{pack:24,boxes_per_layer:10,boxes_per_pallet:80});assert.equal(p.pack,undefined);assert.equal(p.carton_ean,fixture.carton_ean);assert.deepEqual(p.custom,fixture.custom);let workbook;n.w.JasonExport.download=async wb=>{workbook=wb;};n.click('#export');n.submit('#export-form');await wait(()=>workbook);assert.equal(workbook.getWorksheet('Products').getCell('J4').value,24);assert.equal(workbook.getWorksheet('Products').getCell('K4').value,10);assert.equal(workbook.getWorksheet('Products').getCell('L4').value,80);
  assert.deepEqual(n.errors,[]);n.dom.window.close();
 });
 await test('product key export asks for the product list without losing or saving a product draft',async()=>{
  const n=await setup(),keys=clone(logistics);keys.Lilien['500A'].ITEM.weight='0 kg';keys.Natava={'500A':clone(keys.Lilien['500A'])};keys.Natava['500A'].CARTON.nr_of_items=24;
  await n.upload('products',[fixture]);await n.upload('logistics',keys);const before=await n.saved();
  n.click('[data-edit="0"]');n.input('#field-name','UNSAVED PRODUCT');n.click('#tab-packaging');
  assert.equal(n.$('#product-key-include-products'),null);assert.equal(n.$('#key-preview-dialog'),null);
  assert.equal(n.$$('#product-key-data section').length,4);assert.equal(n.$$('#product-key-data dd').length,18);assert.ok(n.$$('#product-key-data dd').some(el=>el.textContent==='0'));
  let wb;n.w.JasonExport.download=async book=>{wb=book;};n.click('#product-key-export');assert.equal(n.$('#single-key-export-dialog').open,true);assert.equal(wb,undefined);
  n.w.document.dispatchEvent(new n.w.KeyboardEvent('keydown',{key:'s',ctrlKey:true,bubbles:true,cancelable:true}));await sleep(20);assert.deepEqual(await n.saved(),before);
  n.click('#single-key-export-close');assert.equal(wb,undefined);assert.equal(n.$('#field-name').value,'UNSAVED PRODUCT');
  n.click('#product-key-export');n.click('#single-key-export-no');await wait(()=>wb);await wait(()=>!n.$('#single-key-export-dialog').open);
  assert.deepEqual(Array.from(wb.worksheets,s=>s.name),['Lilien Data']);assert.equal(wb.getWorksheet('Lilien Data').columnCount,3);assert.equal(wb.getWorksheet('Lilien Data').getCell('C2').value,'500A');assert.equal(wb.getWorksheet('Lilien Data').getCell('C6').value,0);
  wb=null;n.click('#product-key-export');n.click('#single-key-export-yes');await wait(()=>wb);await wait(()=>!n.$('#single-key-export-dialog').open);assert.deepEqual(Array.from(wb.worksheets,s=>s.name),['Lilien Data','Lilien Products']);assert.equal(wb.getWorksheet('Lilien Products').getCell('C3').value,fixture.id);
  n.change('#product-key','');assert.ok(n.$('#product-key-open').disabled);assert.ok(n.$('#product-key-export').disabled);assert.equal(n.$$('#product-key-data dd').length,0);
  n.input('#field-brand','Natava');n.change('#field-brand','Natava');n.change('#product-key','500A');assert.ok(n.$('#product-key-data').textContent.includes('24'));
  wb=null;n.click('#product-key-export');n.click('#single-key-export-no');await wait(()=>wb);await wait(()=>!n.$('#single-key-export-dialog').open);assert.deepEqual(Array.from(wb.worksheets,s=>s.name),['Natava Data']);assert.equal(wb.getWorksheet('Natava Data').getCell('C11').value,24);
  assert.equal(n.$('#field-name').value,'UNSAVED PRODUCT');assert.deepEqual(await n.saved(),before);assert.deepEqual(n.errors,[]);n.dom.window.close();
 });
 await test('key return restores the product draft, original tab, filters and selection and protects unsaved key edits',async()=>{
  const n=await setup();await n.upload('products',[fixture]);await n.upload('logistics',logistics);const before=await n.saved();
  n.input('#search','TEST');n.change('#filter-brand','Lilien');n.click('[data-select="0"]');n.click('[data-edit="0"]');n.input('#field-price','2.45');n.click('#tab-packaging');n.click('#product-key-open');await wait(()=>n.$('#key-form'));
  assert.equal(n.$('#confirm-dialog').open,false);assert.equal(n.$('#page-title').textContent,'Logistické klíče');assert.equal(n.$('#key-form [name=key]').value,'500A');assert.equal(n.$('#key-back').textContent,'← Zpět k produktu');
  const unload=new n.w.Event('beforeunload',{cancelable:true});n.w.dispatchEvent(unload);assert.equal(unload.defaultPrevented,true);
  n.input('[name="ITEM:weight"]','0.7 kg');n.click('#key-back');await wait(()=>n.$('#confirm-dialog').open);n.click('#confirm-no');await sleep(20);assert.ok(n.$('#key-form'));assert.equal(n.$('[name="ITEM:weight"]').value,'0.7 kg');
  n.click('#key-back');await wait(()=>n.$('#confirm-dialog').open);n.click('#confirm-yes');await wait(()=>n.$('#product-form'));
  assert.equal(n.$('#page-title').textContent,'Produkty');assert.equal(n.$('#tab-packaging').getAttribute('aria-selected'),'true');assert.equal(n.$('#field-price').value,'2.45');assert.equal(n.$('#search').value,'TEST');assert.equal(n.$('#filter-brand').value,'Lilien');assert.equal(n.$('[data-select="0"]').checked,true);assert.deepEqual(await n.saved(),before);
  n.submit('#product-form');await wait(()=>!n.$('#editor').open);assert.equal((await n.saved()).products[0].price,2.45);assert.deepEqual((await n.saved()).logistics,before.logistics);assert.deepEqual(n.errors,[]);n.dom.window.close();
 });
 await test('saving and renaming a key returns to the original product with updated logistics and preserves its draft',async()=>{
  const n=await setup();await n.upload('products',[fixture]);await n.upload('logistics',logistics);const before=await n.saved();
  n.click('[data-lang=en]');await wait(()=>n.$('#page-title').textContent==='Products');n.click('[data-edit="0"]');n.input('#field-name','Draft name');n.click('#tab-packaging');n.click('#product-key-open');await wait(()=>n.$('#key-form'));
  assert.equal(n.$('#key-back').textContent,'← Back to product');n.input('[name="ITEM:weight"]','0.7 kg');n.input('#key-form [name=key]','RENAMED');n.submit('#key-form');await wait(()=>n.$('#confirm-dialog').open);n.click('#confirm-yes');await wait(()=>n.$('#product-form'));
  const after=await n.saved();assert.equal(after.logistics.Lilien.RENAMED.ITEM.weight,'0.7 kg');assert.equal(after.products[0].name,fixture.name);assert.equal(after.products[0].key,'RENAMED');assert.deepEqual(after.logistics.Lilien.RENAMED.extra,before.logistics.Lilien['500A'].extra);
  assert.equal(n.$('#page-title').textContent,'Products');assert.equal(n.$('#field-name').value,'Draft name');assert.equal(n.$('#product-key').value,'RENAMED');assert.ok(n.$('#product-key-data').textContent.includes('0.7'));
  n.submit('#product-form');await wait(()=>!n.$('#editor').open);assert.equal((await n.saved()).products[0].name,'Draft name');assert.equal((await n.saved()).products[0].key,'RENAMED');assert.deepEqual(n.errors,[]);n.dom.window.close();
 });
 await test('cancel and unchanged save return to product while standalone key editors have no return button',async()=>{
  const n=await setup();await n.upload('products',[fixture]);await n.upload('logistics',logistics);const before=await n.saved();
  n.click('[data-edit="0"]');n.click('#tab-packaging');n.click('#product-key-open');await wait(()=>n.$('#key-form'));n.click('#editor-close');await wait(()=>n.$('#product-form'));assert.equal(n.$('#tab-packaging').getAttribute('aria-selected'),'true');
  n.click('#product-key-open');await wait(()=>n.$('#key-form'));n.submit('#key-form');await wait(()=>n.$('#product-form'));n.click('#editor-close');
  n.click('[data-view=keys]');n.click('[data-key-edit]');assert.equal(n.$('#key-back'),null);n.click('#editor-close');assert.deepEqual(await n.saved(),before);assert.deepEqual(n.errors,[]);n.dom.window.close();
 });
 await test('new flag keeps its status badge and filters independently, including exports',async()=>{
  const n=await setup();
  const products=[{...fixture,id:'active',new:false},{...fixture,id:'active-new',new:true},{...fixture,id:'old-new',new:true,discontinued:true}];
  await n.upload('products',products);
  assert.deepEqual(n.$$('#filter-status option').map(o=>o.value),['active','all','discontinued']);
  assert.equal(n.$$('tbody tr').length,2);
  assert.equal(n.$$('tbody .status-active').length,2);assert.equal(n.$$('tbody .status-new').length,1);
  n.change('#filter-new','yes');assert.equal(n.$$('tbody tr').length,1);assert.ok(n.$('tbody .status-active'));assert.ok(n.$('tbody .status-new'));
  let wb;n.w.JasonExport.download=async book=>{wb=book;};n.click('#export');n.submit('#export-form');await wait(()=>wb);assert.equal(wb.getWorksheet('Products').getCell('C4').value,'active-new');assert.equal(wb.getWorksheet('Products').rowCount,4);await wait(()=>!n.$('#export-form [type=submit]').disabled);n.click('#editor-close');
  n.change('#filter-status','discontinued');assert.equal(n.$$('tbody tr').length,1);assert.ok(n.$('tbody .status-discontinued'));assert.ok(n.$('tbody .status-new'));
  n.change('#filter-new','no');assert.equal(n.$$('tbody tr').length,0);
  n.change('#filter-status','active');assert.equal(n.$$('tbody tr').length,1);assert.equal(n.$('tbody .status-new'),null);
  n.click('#reset');assert.equal(n.$('#filter-status').value,'active');assert.equal(n.$('#filter-new').value,'');assert.equal(n.$$('tbody tr').length,2);
  assert.deepEqual((await n.saved()).products,clone(n.w.JasonModel.cleanProducts(products)));n.dom.window.close();
 });
 await test('empty catalog and archived logistics initialized',async()=>{assert.ok($('#empty-import'));assert.ok(Number($('[data-view=keys] .nav-count').textContent)>0);});
 await test('import authentic JSON structure and search without accents',async()=>{await upload('products',[fixture]);await upload('logistics',logistics);input('#search','mydlo 859');assert.equal($$('tbody tr').length,1);click('#reset');assert.equal((await saved()).products[0].hs,'00123456');});
 await test('product edit retains unknown fields and exact identifiers',async()=>{click('[data-edit="0"]');input('#field-price','2.45');click('#tab-flags');input('#field-flags','Promo, Export');submit('#product-form');await wait(()=>!$('#editor').open);const p=(await saved()).products[0];assert.equal(p.price,2.45);assert.deepEqual(p.custom,fixture.custom);assert.equal(p.volume.note,'keep');assert.equal(p.carton_ean,fixture.carton_ean);assert.deepEqual(p.flags,['Promo','Export']);});
 await test('duplicate EAN blocks save; copying preserves unknown fields',async()=>{click('[data-more="0"]');click('#action-copy');input('#field-id',fixture.id);submit('#product-form');await wait(()=>!$('#form-error').hidden);assert.match($('#form-error').textContent,/už používá/);assert.equal((await saved()).products.length,1);input('#field-id','0000000000000');input('#field-name','TEST Copy');submit('#product-form');await wait(()=>!$('#editor').open);assert.equal((await saved()).products.length,2);assert.deepEqual((await saved()).products[1].custom,fixture.custom);});
 await test('undo and redo preserve data',async()=>{click('#undo');await wait(async()=>(await saved()).products.length===1);click('#redo');await wait(async()=>(await saved()).products.length===2);});
 await test('shared key editing and renaming do not copy counts into products',async()=>{click('[data-view=keys]');click('[data-key-edit="Lilien"]');input('[name="CARTON:nr_of_items"]','6');input('#field-key','500B');submit('#key-form');await wait(()=>$('#confirm-dialog').open);click('#confirm-yes');await wait(()=>!$('#editor').open);const s=await saved();assert.ok(s.products.every(p=>!Object.hasOwn(p,'pack')&&p.key==='500B'&&w.JasonModel.packaging(p,s.logistics).pack===6));assert.equal(s.logistics.Lilien['500A'],undefined);assert.equal(s.logistics.Lilien['500B'].extra.keep,'supplier');assert.equal(s.products[0].carton_ean,fixture.carton_ean);});
 await test('copy key retains values and supplier extension',async()=>{click('[data-key-edit="Lilien"]');click('#key-copy');assert.equal($('[name="CARTON:nr_of_items"]').value,'6');input('#field-key','500C');submit('#key-form');await wait(()=>!$('#editor').open);const s=await saved();assert.equal(s.logistics.Lilien['500C'].CARTON.nr_of_items,6);assert.equal(s.logistics.Lilien['500C'].extra.keep,'supplier');});
 await test('used key deletion prevented; unused deletion recoverable',async()=>{click('[data-key-name="500B"][data-key-edit]');assert.equal($('#key-delete').disabled,true);click('#editor-close');click('[data-key-name="500C"][data-key-edit]');click('#key-delete');click('#confirm-yes');await wait(()=>!$('#editor').open);assert.equal((await saved()).logistics.Lilien['500C'],undefined);});
 await test('new product derives packaging from selected key',async()=>{click('[data-view=products]');click('#create');input('#field-brand','Lilien');change('#field-brand','Lilien');input('#field-id','0000000000001');input('#field-name','TEST New');input('#field-csName','TEST Nový');input('#field-price','0');click('#tab-packaging');change('#product-key','500B');assert.equal($('#field-pack'),null);assert.ok($('#product-key-data').textContent.includes('6'));submit('#product-form');await wait(()=>!$('#editor').open);const p=(await saved()).products[2];assert.equal(p.pack,undefined);assert.equal(w.JasonModel.packaging(p,(await saved()).logistics).pack,6);assert.equal(p.price,0);});
 await test('bulk discontinuation and all/discontinued filters',async()=>{click('#select-page');click('#bulk-edit');change('[name=operation]','setDisc');submit('#bulk-form');await wait(()=>!$('#editor').open);assert.equal($$('tbody tr').length,0);change('#filter-status','discontinued');assert.equal($$('tbody tr').length,3);assert.ok((await saved()).products.every(p=>p.discontinued&&p.discontinued_date));});
 await test('product XLSX content uses text identifiers and current filters',async()=>{let workbook;w.JasonExport.download=async wb=>{workbook=wb;};click('#export');submit('#export-form');await wait(()=>workbook);const ws=workbook.getWorksheet('Products');assert.equal(typeof ws.getCell('C4').value,'string');assert.equal(ws.rowCount,6);assert.ok(ws.getColumn(3).values.includes('0000000000000'));assert.equal(ws.getCell('H4').numFmt,'0.00 "€"');assert.equal(ws.getCell('A1').fill.fgColor.argb,'FF214A84');await wait(()=>!$('#export-form [type=submit]').disabled);click('#editor-close');});
 await test('checked products override filtered export and the dialog shows the selected count',async()=>{
  let wb;w.JasonExport.download=async x=>{wb=x;};click('[data-select="0"]');click('#export');assert.match($('#export-options').textContent,/1 produktů.*vybrané položky/);submit('#export-form');await wait(()=>wb);assert.equal(wb.getWorksheet('Products').rowCount,4);assert.equal(wb.getWorksheet('Products').getCell('C4').value,fixture.id);await wait(()=>!$('#export-form [type=submit]').disabled);click('#editor-close');click('#bulk-clear');
 });
 await test('product selection exports across pages and clearing it restores filtered export',async()=>{
  const pages=await setup(),rows=Array.from({length:35},(_,i)=>({...fixture,id:String(1000000000000+i),name:'TEST PAGE '+String(i).padStart(3,'0'),csName:'TEST PAGE '+String(i).padStart(3,'0')}));
  await pages.upload('products',rows);let wb;pages.w.JasonExport.download=async x=>{wb=x;};pages.click('[data-select="0"]');pages.click('#next');pages.click('[data-select="30"]');pages.click('#export');assert.match(pages.$('#export-options').textContent,/2 produktů.*vybrané položky/);pages.submit('#export-form');await wait(()=>wb);const ws=wb.getWorksheet('Products');assert.equal(ws.rowCount,5);assert.deepEqual([ws.getCell('C4').value,ws.getCell('C5').value].sort(),[rows[0].id,rows[30].id].sort());await wait(()=>!pages.$('#export-form [type=submit]').disabled);pages.click('#editor-close');pages.click('#bulk-clear');pages.input('#search',rows[0].id);wb=null;pages.click('#export');assert.match(pages.$('#export-options').textContent,/1 produktů.*aktuálních filtrů/);pages.submit('#export-form');await wait(()=>wb);assert.equal(wb.getWorksheet('Products').rowCount,4);pages.dom.window.close();
 });
 await test('logistics XLSX matrix exports partial keys, numeric counts and units',async()=>{let wb;w.JasonExport.download=async x=>{wb=x;};click('[data-view=keys]');click('#export');assert.equal($('#include-products').checked,false);submit('#export-form');await wait(()=>wb);const ws=wb.getWorksheet('Lilien Data');assert.equal(ws.getCell('C2').value,'500B');assert.equal(ws.getCell('C11').value,6);assert.match(ws.getCell('B3').value,/\(cm\)/);assert.match(ws.getCell('B6').value,/\(kg\)/);assert.equal(ws.getCell('A3').fill.fgColor.argb,ws.getCell('A7').fill.fgColor.argb);assert.equal(ws.getImages().length,0);await wait(()=>!$('#export-form [type=submit]').disabled);click('#editor-close');});
 await test('optional logistics product list respects selected keys and checkbox survives tab switches',async()=>{
  const n=await setup(),keys=clone(logistics);keys.Lilien['500B']=clone(keys.Lilien['500A']);keys.Natava={'500A':clone(keys.Lilien['500A'])};
  await n.upload('products',[fixture,{...fixture,key:'500B',id:'0000000000002',name:'Unselected'},{...fixture,brand:'Natava',id:'0000000000003',name:'Other brand'}]);await n.upload('logistics',keys);const before=await n.saved();
  let wb;n.w.JasonExport.download=async book=>{wb=book;};n.click('[data-view=keys]');n.click('#export');assert.equal(n.$('#include-products').checked,false);assert.equal(n.$('#include-products').closest('.export-options-row'),n.$('#include-empty').closest('.export-options-row'));assert.equal(n.$('#export-form .form-footer input'),null);n.click('#include-empty');n.click('#include-products');n.click('#export-tab-products');assert.equal(n.$('#include-products'),null);n.click('#export-tab-keys');assert.equal(n.$('#include-products').checked,true);assert.equal(n.$('#include-empty').checked,true);n.change('#export-brand','Lilien');
  n.click('#keys-none');n.click('[data-export-key="0"]');n.submit('#export-form');await wait(()=>wb);const ws=wb.getWorksheet('Lilien Products');assert.equal(ws.getCell('A2').value,'LOGISTICS KEY');assert.equal(ws.getCell('B3').value,fixture.name);assert.equal(ws.getCell('C3').value,fixture.id);assert.equal(ws.columnCount,4);assert.equal(ws.views[0].xSplit||0,0);assert.equal(wb.worksheets.length,2);
  assert.deepEqual(await n.saved(),before);assert.deepEqual(n.errors,[]);n.dom.window.close();
 });
 await test('data checks detect arithmetic inconsistency and open affected key',async()=>{click('[data-view=checks]');assert.ok($('#content').textContent.includes('nesouhlasí'));$$('tbody tr').find(r=>r.textContent.includes('nesouhlasí')).querySelector('[data-issue]').click();assert.ok($('#editor').open);click('#editor-close');});
 await test('invalid JSON import leaves state unchanged',async()=>{const before=await saved();await upload('products',{bad:true},false);await wait(()=>$('#toast').textContent.includes('formát'));assert.deepEqual((await saved()).products,before.products);click('#editor-close');errors.length=0;});
 await test('unsaved form close prompts and cancellation retains work',async()=>{click('[data-view=products]');change('#filter-status','all');click('[data-edit="0"]');input('#field-name','UNSAVED');click('#editor-close');await wait(()=>$('#confirm-dialog').open);click('#confirm-no');assert.ok($('#editor').open);click('#editor-close');click('#confirm-yes');await wait(()=>!$('#editor').open);assert.equal((await saved()).products[0].name,'TEST Soap');});
 await test('language switches core UI, product types and forms',async()=>{click('[data-lang=en]');await wait(()=>$('h1').textContent==='Products');click('#create');assert.equal($('#tab-packaging').textContent,'Packaging & logistics');click('#editor-close');});
 await test('backup restoration keeps data/photos and disconnects',async()=>{const s=await saved();await upload('backup',{format:'jason-backup',version:1,products:s.products,logistics:s.logistics,photos:{}});assert.equal((await saved()).connected,false);assert.deepEqual((await saved()).products,s.products);});
 assert.deepEqual(errors,[]);c.dom.window.close();
 const history=await setup();
 await test('checks suppress discontinued EAN replacements and expose active duplicates',async()=>{
  const rows=JSON.parse(fs.readFileSync(path.join(__dirname,'../../OrderSheet/products.json'),'utf8')).filter(p=>String(p.id)==='8596048005128');
  await history.upload('products',rows);history.click('[data-view=checks]');
  assert.ok(!history.$('#content').textContent.includes('Duplicitní EAN'));
  await history.upload('products',rows.map(p=>({...p,discontinued:false})));
  assert.equal(history.$$('tbody tr').filter(r=>r.textContent.includes('Duplicitní EAN / ID mezi aktivními produkty')).length,2);
  assert.deepEqual(history.errors,[]);
 });
 history.dom.window.close();
 const png='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a3uoAAAAASUVORK5CYII=';
 async function selectLabel(n,slot,name='label.png',data=png){
  const bytes=Buffer.from(data,'base64'),file=new n.w.File([bytes],name,{type:name.endsWith('.pdf')?'application/pdf':'image/png'});
  Object.defineProperty(n.$('#label-input-'+slot),'files',{configurable:true,value:[file]});
  n.$('#label-input-'+slot).dispatchEvent(new n.w.Event('change',{bubbles:true}));
  await wait(()=>!n.$('#label-input-'+slot).disabled);return file;
 }
 await test('existing product saves original front/back bytes, language selection and manually supplied INCI',async()=>{
  const n=await setup();await n.upload('products',[{...fixture,inci:'Old',inciStatus:'verified',inciSource:{url:'original'},labelLanguages:['en','cs'],labels:{future:{keep:true}},extra:'keep'}]);
  n.click('[data-edit="0"]');n.input('#inci-text','Aqua, Parfum.\nLinalool*');
  await pickLanguages(n,['ar','pt','nl']);
  await selectLabel(n,'front','přední.png');await selectLabel(n,'back','back.pdf',Buffer.from('%PDF-1.4\nlabel\n%%EOF').toString('base64'));
  assert.equal(n.$('[data-label-view=front]').disabled,false);n.click('[data-label-view=front]');assert.ok(n.$('#photo-dialog').open);n.click('#photo-close');
  n.submit('#product-form');await wait(()=>!n.$('#editor').open);const s=await n.saved(),p=s.products[0];
  assert.equal(p.inci,'Aqua, Parfum.\nLinalool*');assert.equal(p.inciStatus,'provided');assert.equal(p.inciSource.type,'manual');assert.equal(p.inciSource.url,undefined);
  assert.deepEqual(p.labelLanguages,['en','cs','ar','pt','nl']);assert.deepEqual(p.labels.future,{keep:true});assert.equal(p.extra,'keep');
  assert.equal(p.labels.front.name,'přední.png');assert.equal(p.labels.back.mimeType,'application/pdf');
  assert.equal(s.labelFiles[p.labels.front.path],'data:image/png;base64,'+png);assert.equal(Object.keys(s.labelFiles).length,2);
  assert.ok(!JSON.stringify(p).includes('base64'));assert.equal(s.pendingLabels.length,2);
  n.click('[data-edit="0"]');n.click('#tab-labels');assert.ok(n.$('[data-label-preview=front] img').src.startsWith('data:image/png;'));
  assert.equal(n.$('[data-label-preview=back]').textContent,'PDF');n.click('#editor-close');assert.equal(n.$('#confirm-dialog').open,false);
  assert.deepEqual(n.errors,[]);n.dom.window.close();
 });
 await test('new product has every information field and removing a back label restores N/A without deleting the front',async()=>{
  const n=await setup();n.click('#create');n.input('#field-id','0012345678901');n.input('#field-brand','Lilien');n.input('#field-name','New labelled product');n.input('#inci-text','Aqua');
  await pickLanguages(n,['cs']);
  await selectLabel(n,'front');await selectLabel(n,'back');n.submit('#product-form');await wait(()=>!n.$('#editor').open);
  let s=await n.saved();assert.equal(s.products[0].inci,'Aqua');assert.deepEqual(s.products[0].labelLanguages,['cs']);const front=s.products[0].labels.front.path;
  n.click('[data-edit="0"]');n.click('#tab-labels');n.click('[data-label-remove=back]');assert.equal(n.$('[data-label-preview=back]').textContent,'N/A');n.submit('#product-form');await wait(()=>!n.$('#editor').open);
  s=await n.saved();assert.equal(s.products[0].labels.front.path,front);assert.equal(s.products[0].labels.back,null);assert.equal(s.pendingLabels.length,1);
  n.click('#undo');await wait(async()=>!!(await n.saved()).products[0].labels.back);assert.ok((await n.saved()).labelFiles[(await n.saved()).products[0].labels.back.path]);
  assert.deepEqual(n.errors,[]);n.dom.window.close();
 });
 await test('label draft and INCI survive the roundtrip to the logistics editor; untouched language order is preserved',async()=>{
  const n=await setup();await n.upload('products',[{...fixture,labelLanguages:['en','cs'],inci:'Original',inciStatus:'verified',inciSource:{url:'source'}}]);await n.upload('logistics',logistics);
  n.click('[data-edit="0"]');n.input('#inci-text','Draft INCI');await selectLabel(n,'front');n.click('#tab-packaging');n.click('#product-key-open');await wait(()=>n.$('#key-back'));n.click('#key-back');await wait(()=>n.$('#product-form'));assert.equal(n.$('#inci-text').value,'Draft INCI');n.click('#tab-labels');assert.equal(n.$('[data-label-name=front]').textContent,'label.png');
  n.submit('#product-form');await wait(()=>!n.$('#editor').open);const s=await n.saved();assert.equal(s.products[0].inci,'Draft INCI');assert.deepEqual(s.products[0].labelLanguages,['en','cs']);assert.equal(Object.keys(s.labelFiles).length,1);
  n.click('[data-edit="0"]');n.change('#inci-status','not-applicable');n.submit('#product-form');await wait(()=>!n.$('#editor').open);assert.equal((await n.saved()).products[0].inciStatus,'not-applicable');
  n.click('[data-edit="0"]');assert.equal(n.$('#inci-text').placeholder,'N/A');n.click('#editor-close');assert.deepEqual(n.errors,[]);n.dom.window.close();
 });
 await test('invalid label files and oversized inputs are rejected before replacing a working label',async()=>{
  const n=await setup();await n.upload('products',[fixture]);n.click('[data-edit="0"]');await selectLabel(n,'front');const src=n.$('[data-label-preview=front] img').src;
  await selectLabel(n,'front','fake.png',Buffer.from('<svg>bad</svg>').toString('base64'));assert.ok(n.$('#toast').textContent.includes('JPG'));assert.equal(n.$('[data-label-preview=front] img').src,src);
  const big=new n.w.File(['png'],'large.png');Object.defineProperty(big,'size',{value:16*1024*1024});await assert.rejects(n.w.JasonStorage.label(big),/LABEL_SIZE/);
  assert.deepEqual(n.errors,['LABEL_TYPE']);n.dom.window.close();
 });
 await test('discarding an uploaded label leaves the product and all files unchanged',async()=>{
  const n=await setup();await n.upload('products',[fixture]);const before=await n.saved();n.click('[data-edit="0"]');await selectLabel(n,'front');n.click('#editor-close');await wait(()=>n.$('#confirm-dialog').open);n.click('#confirm-yes');assert.deepEqual(await n.saved(),before);n.dom.window.close();
 });
 await test('failed label upload blocks publishing product references; retry uploads original bytes before products',async()=>{
  let remote={products:[clone(fixture)],logistics:clone(logistics)},fail=true,calls=[];
  const n=await setup(true,async(url,args={})=>{
   const name=new URL(url).pathname.split('/').pop();if(args.method==='PUT'){
    const body=JSON.parse(args.body);calls.push({name,body});if(name==='upload-image'&&fail)return {ok:false,status:503,text:async()=>'Upload test failure'};
    if(name!=='upload-image')remote[name]=body;return {ok:true,status:200};
   }return {ok:true,status:200,json:async()=>clone(remote[name])};
  });await wait(async()=>(await n.saved()).connected);n.click('[data-edit="0"]');await selectLabel(n,'front');n.submit('#product-form');await wait(()=>calls.length>0&&n.$('#save-status').textContent.includes('čekají'));
  assert.deepEqual(calls.map(c=>c.name),['upload-image']);assert.equal(remote.products[0].labels,undefined);let s=await n.saved();assert.equal(s.pendingLabels.length,1);
  fail=false;n.click('#retry');await wait(()=>n.$('#save-status').textContent.includes('společných'));s=await n.saved();
  assert.deepEqual(calls.map(c=>c.name),['upload-image','upload-image','products']);assert.equal(calls[1].body.content,png);assert.equal(calls[1].body.path,remote.products[0].labels.front.path);assert.deepEqual(s.pendingLabels,[]);
  const path=remote.products[0].labels.front.path;n.click('[data-edit="0"]');await selectLabel(n,'front','replacement.png');n.submit('#product-form');await wait(()=>remote.products[0].labels.front.path!==path);await wait(()=>n.$('#retry').hidden);assert.notEqual(remote.products[0].labels.front.path,path);
  const before=calls.length;n.click('[data-edit="0"]');n.click('[data-label-remove=front]');n.submit('#product-form');await wait(()=>remote.products[0].labels.front===null);await wait(()=>n.$('#retry').hidden);
  assert.deepEqual(calls.slice(before).map(c=>c.name),['products']);n.dom.window.close();
 });
 await test('backup restores label files and rejects paths outside the label directory',async()=>{
  const n=await setup(),path='OrderSheet/img/labels/backup-front-test.png',data='data:image/png;base64,'+png;
  const backup={format:'jason-backup',version:1,products:[{...fixture,labels:{front:{path,mimeType:'image/png'}}}],logistics,photos:{},labelFiles:{[path]:data}};
  await n.upload('backup',backup);assert.equal((await n.saved()).labelFiles[path],data);n.click('[data-edit="0"]');n.click('#tab-labels');assert.equal(n.$('[data-label-preview=front] img').src,data);n.click('#editor-close');
  const before=await n.saved();await n.upload('backup',{...backup,labelFiles:{'OrderSheet/products.json':data}},false);await wait(()=>n.$('#toast').className==='error');assert.deepEqual(await n.saved(),before);assert.equal(n.$('#confirm-dialog').open,false);n.dom.window.close();
 });
 // Deterministic API adapter checks using fake responses, no network.
 const d=await setup();let remote={products:[clone(fixture)],logistics:clone(logistics)},puts=[],fail=false,conflict=false;
 d.w.fetch=async(url,args={})=>{const n=new URL(url).pathname.split('/').pop();if(!String(url).startsWith('https://mock.test'))return {ok:false,status:404,text:async()=>''};if(args.method==='PUT'){const value=JSON.parse(args.body);puts.push({name:n,data:value});if(n==='products'&&fail)return {ok:false,status:500,text:async()=>'TEST FAILURE'};if(n!=='upload-image')remote[n]=value;return {ok:true,status:200};}return {ok:true,status:200,json:async()=>clone(conflict&&n==='products'?[{...fixture,name:'OTHER USER'}]:remote[n])};};
 await test('API connect reads without PUT; failed write retains local change',async()=>{d.click('#data-button');d.input('#field-api','https://mock.test');d.input('#field-images','https://images.test');d.click('#connect');d.click('#confirm-yes');await wait(()=>!d.$('#editor').open);assert.equal(puts.length,0);fail=true;d.click('[data-edit="0"]');d.input('#field-price','3.5');d.submit('#product-form');await wait(()=>!d.$('#retry').hidden);assert.equal(remote.products[0].price,1.2);assert.equal((await d.saved()).products[0].price,3.5);});
 await test('retry sends failed draft, using original API payload',async()=>{fail=false;d.click('#retry');await wait(()=>d.$('#save-status').textContent.includes('společných'));assert.equal(remote.products[0].price,3.5);assert.ok(puts.some(p=>p.name==='products'&&Array.isArray(p.data)));});
 await test('concurrent remote change prevents overwrite',async()=>{conflict=true;const before=puts.length;d.click('[data-edit="0"]');d.input('#field-price','4.5');d.submit('#product-form');await wait(()=>d.$('#toast').textContent.includes('jiný uživatel'));assert.equal(puts.length,before);assert.equal((await d.saved()).products[0].price,4.5);conflict=false;d.click('#retry');await wait(()=>d.$('#save-status').textContent.includes('společných'));});
 await test('key edits write logistics only and immediately change derived counts',async()=>{
  const before=puts.length,products=clone(remote.products);d.click('[data-view=keys]');d.click('[data-key-edit="Lilien"]');d.input('[name="CARTON:nr_of_items"]','8');d.submit('#key-form');await wait(()=>d.$('#confirm-dialog').open);d.click('#confirm-yes');await wait(()=>remote.logistics.Lilien['500A'].CARTON.nr_of_items===8);await wait(()=>d.$('#retry').hidden);
  assert.deepEqual(puts.slice(before).map(x=>x.name),['logistics']);assert.deepEqual(remote.products,products);const s=await d.saved();assert.equal(s.products[0].pack,undefined);assert.equal(d.w.JasonModel.packaging(s.products[0],s.logistics).pack,8);
 });
 await test('photo pending queue uses original upload-image contract',async()=>{d.w.JasonStorage.jpeg=async()=> 'data:image/jpeg;base64,/9j/2Q==';d.click('[data-view=products]');d.click('[data-edit="0"]');d.click('#tab-photo');Object.defineProperty(d.$('#photo-input'),'files',{configurable:true,value:[{name:'arbitrary-name.png',type:'image/png'}]});d.$('#photo-input').dispatchEvent(new d.w.Event('change'));await wait(()=>d.$('#photo-preview').src.startsWith('data:'));d.submit('#product-form');await wait(()=>puts.some(p=>p.name==='upload-image'));const upload=puts.find(p=>p.name==='upload-image');assert.equal(upload.data.path,'OrderSheet/img/'+fixture.id+'.jpg');assert.equal(upload.data.content,'/9j/2Q==');await wait(async()=>(await d.saved()).pendingPhotos.length===0);});
 d.dom.window.close();
 const mixed={...clone(fixture),volume:{number:'4x50',unit:'g',note:'keep'},pack:99,discontinued:null,discontinued_date:null};
 let live={products:[mixed],logistics:clone(logistics)},livePuts=[];
 const f=await setup(true,async(url,args={})=>{const n=new URL(url).pathname.split('/').pop();if(args.method==='PUT'){livePuts.push(n);live[n]=JSON.parse(args.body);return {ok:true,status:200};}return {ok:true,status:200,json:async()=>clone(live[n])};});
 await test('hosted preview automatically reads the existing shared API without writes',async()=>{await wait(async()=>(await f.saved())?.connected);assert.equal((await f.saved()).products.length,1);assert.deepEqual(livePuts,[]);assert.match(f.$('#connection-label').textContent,/společným/);});
 await test('loading old product counts removes them locally without writing',async()=>{f.click('[data-view=keys]');f.click('[data-key-edit="Lilien"]');f.submit('#key-form');await wait(()=>!f.$('#editor').open);assert.equal((await f.saved()).products[0].pack,undefined);assert.equal(f.w.JasonModel.packaging((await f.saved()).products[0],(await f.saved()).logistics).pack,12);assert.deepEqual(livePuts,[]);});
 await test('multipack volume survives editing another field',async()=>{f.click('[data-view=products]');f.click('[data-edit="0"]');assert.equal(f.$('[name="volume-number"]').value,'4x50');f.input('#field-price','2.5');f.submit('#product-form');await wait(()=>live.products[0].price===2.5);assert.deepEqual(live.products[0].volume,mixed.volume);assert.equal(live.products[0].pack,undefined);assert.equal(live.products[0].discontinued,null);assert.equal(live.products[0].discontinued_date,null);await wait(async()=>!(await f.saved()).pendingPhotos.length&&f.$('#retry').hidden);});
 await test('manual refresh picks up legacy editor changes without writing',async()=>{live.products[0].name='LEGACY UPDATED';const before=livePuts.length;f.click('#refresh');await wait(async()=>(await f.saved()).products[0].name==='LEGACY UPDATED');assert.equal(livePuts.length,before);});
 await test('shared configuration is fixed and cannot create a second database',async()=>{f.click('#data-button');assert.equal(f.$('#field-api').readOnly,true);assert.equal(f.$('#field-api').value,'https://union-cosmetic.filipluchesi.workers.dev');assert.equal(f.$('#disconnect').hidden,true);f.click('#editor-close');});
 await test('backup restore in hosted preview retains common database and requires confirmation',async()=>{const s=await f.saved();await f.upload('backup',{format:'jason-backup',version:1,products:s.products,logistics:s.logistics,photos:{}});assert.equal((await f.saved()).connected,true);assert.equal((await f.saved()).api,'https://union-cosmetic.filipluchesi.workers.dev');});
 await test('automatic refresh never overwrites an open product form',async()=>{f.click('[data-edit="0"]');f.input('#field-name','DRAFT');live.products[0].name='ANOTHER EDIT';f.w.dispatchEvent(new f.w.Event('focus'));await sleep(30);assert.equal(f.$('#field-name').value,'DRAFT');assert.equal((await f.saved()).products[0].name,'LEGACY UPDATED');});
 f.dom.window.close();console.log(`ALL ${passed} DOM/API FLOW CHECKS PASSED`);
})().catch(e=>{console.error(e);process.exit(1);});

