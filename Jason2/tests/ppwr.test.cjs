const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {JSDOM}=require('jsdom'),{IDBFactory}=require('fake-indexeddb');
const M=require('../model.js');
const fixture={brand:'Lilien',type:'Liquid Soap',id:'8596048008129',name:'Soap 500 ml',csName:'Mýdlo 500 ml',volume:{number:500,unit:'ml'},price:1,key:null,custom:{keep:true}};
const fixtures=[fixture,{...fixture,id:'8596048008136',name:'Soap 1 L',csName:'Mýdlo 1 L',volume:{number:1000,unit:'ml'}},{...fixture,id:'8596048008143',name:'Other',csName:'Jiný výrobek'}];
const clone=x=>JSON.parse(JSON.stringify(x)),sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function wait(fn){for(let i=0;i<250;i++){if(await fn())return;await sleep(10);}throw Error('Wait timed out');}
async function setup({database=new IDBFactory(),shared=false,remote={products:clone(fixtures),logistics:{}},failUpload=false}={}){
 const dom=new JSDOM(fs.readFileSync(path.join(__dirname,'../index.html'),'utf8'),{url:'https://local.test/Jason2/',runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window,errors=[],calls=[];
 w.indexedDB=database;w.TextEncoder=TextEncoder;w.TextDecoder=TextDecoder;w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};w.HTMLElement.prototype.scrollIntoView=()=>{};w.HTMLAnchorElement.prototype.click=function(){};w.URL.createObjectURL=()=>'blob:ppwr';w.URL.revokeObjectURL=()=>{};w.open=()=>{};w.console.error=e=>errors.push(e.message);
 w.JASON_CONFIG={sandbox:!shared,apiBase:shared?'https://mock.test':'',imageBase:'../../OrderSheet/img',autoConnect:shared,sharedOnly:shared,workspaceName:'ppwr-test',legacyProducts:'',logisticsFile:''};
 w.JASON_SANDBOX_SEED={snapshotAt:'2026-10-22',products:clone(fixtures),logistics:{}};
 w.fetch=async(url,args={})=>{calls.push({url,method:args.method||'GET',body:args.body&&JSON.parse(args.body)});if(!shared)throw Error('Unexpected network');const name=new URL(url).pathname.split('/').pop();if(args.method==='PUT'){if(name==='upload-image'&&failUpload)return {ok:false,status:503,text:async()=>'test upload failed'};if(name!=='upload-image')remote[name]=JSON.parse(args.body);return {ok:true};}return {ok:true,json:async()=>clone(remote[name])};};
 w.eval(fs.readFileSync(path.join(__dirname,'../../shared/packaging.js'),'utf8'));
 for(const file of ['model.js','storage.js','i18n.js','export.js','app.js'])w.eval(fs.readFileSync(path.join(__dirname,'..',file),'utf8'));
 const $=s=>w.document.querySelector(s),click=s=>{assert.ok($(s),s);assert.ok(!$(s).disabled,s+' disabled');$(s).click();},submit=s=>$(s).dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true})),saved=async()=>clone((await w.JasonStorage.get('state')).state);
 await wait(()=>$('#page-title').textContent==='Produkty');await wait(async()=>!!(await w.JasonStorage.get('state')));
 if(shared)await wait(async()=>(await saved()).connected);
 const file=name=>new w.File(['%PDF-1.4\nTEST PPWR ONLY\n%%EOF'],name,{type:'application/pdf'});
 async function select(selector,name='Supplier.pdf',drop=false){const f=file(name),el=$(selector);if(drop){const e=new w.Event('drop',{bubbles:true,cancelable:true});Object.defineProperty(e,'dataTransfer',{value:{files:[f]}});el.dispatchEvent(e);}else{Object.defineProperty(el,'files',{configurable:true,value:[f]});el.dispatchEvent(new w.Event('change',{bubbles:true}));}await wait(()=>!$('#ppwr-drop')?.disabled&&!$('#ppwr-bulk-drop')?.disabled);await sleep(10);}
 return {dom,w,$,click,submit,saved,file,select,calls,errors,remote,database};
}
const asset=n=>({path:`OrderSheet/img/labels/ppwr-${n}.pdf`,name:n+'.pdf',mimeType:'application/pdf',size:30,uploadedAt:'2026-10-22T10:00:00Z'});
test('PPWR validates references, preserves unknown metadata, archives immutably and refuses unsafe paths',()=>{
 const a=asset('old'),b=asset('new'),old={current:{...a,unknown:{supplier:'keep'}},archive:[],extra:7},before=clone(old),result=M.replacePPWR(old,b);
 assert.deepEqual(old,before);assert.deepEqual(result.archive,[before.current]);assert.equal(result.extra,7);assert.equal(result.current.path,b.path);
 const shared=[{...fixture,ppwr:result},{...fixtures[1],ppwr:{current:a,archive:[]}}];assert.equal(M.ppwrProducts(shared,a.path).length,2);assert.equal(M.labelReferences(shared).size,2);
 const removed=M.removePPWR(result,b.path);assert.equal(removed.current,null);assert.equal(removed.archive[0].path,a.path);
 for(const ppwr of [{current:{...a,path:'../../unsafe.pdf'},archive:[]},{current:a,archive:[a]},{current:{...a,size:-1},archive:[]},{current:a,archive:null}])assert.throws(()=>M.validateProducts([{...fixture,ppwr}]),/PPWR_FORMAT/);
});
test('new product PPWR supports real file input, waits for reads, cancel does not store and reopening preserves the original file',async t=>{
 const n=await setup();t.after(()=>n.dom.window.close());n.click('#create');n.click('#tab-ppwr');assert.equal(n.$('#ppwr-archive').textContent.includes('0'),true);
 await n.select('#ppwr-input');assert.equal((await n.saved()).products.some(p=>p.ppwr),false);n.click('#form-cancel');n.click('#confirm-yes');assert.equal((await n.saved()).products.some(p=>p.ppwr),false);
 n.click('#create');n.$('[name=brand]').value='Lilien';n.$('[name=id]').value='1234567890123';n.$('[name=name]').value='New';n.click('#tab-ppwr');
 Object.defineProperty(n.$('#ppwr-input'),'files',{configurable:true,value:[n.file('New.pdf')]});n.$('#ppwr-input').dispatchEvent(new n.w.Event('change',{bubbles:true}));n.submit('#product-form');await wait(()=>!n.$('#editor').open);
 const state=await n.saved(),p=state.products.find(p=>p.id==='1234567890123');assert.equal(p.ppwr.current.name,'New.pdf');assert.equal(Object.keys(state.labelFiles).length,1);assert.equal(state.labelFiles[p.ppwr.current.path].startsWith('data:application/pdf;base64,'),true);assert.deepEqual(n.calls,[]);
});
test('bulk drag and drop uploads one shared file to selected products only and related list includes all sizes',async t=>{
 const n=await setup();t.after(()=>n.dom.window.close());n.click('[data-select="0"]');n.click('[data-select="1"]');n.click('#bulk-ppwr');
 await n.select('#ppwr-bulk-drop','Category.pdf',true);n.submit('#bulk-ppwr-form');await wait(()=>!n.$('#editor').open);
 const state=await n.saved();assert.equal(state.products[0].ppwr.current.path,state.products[1].ppwr.current.path);assert.equal(state.products[2].ppwr,undefined);assert.equal(Object.keys(state.labelFiles).length,1);
 n.click('[data-edit="0"]');n.click('#tab-ppwr');n.click('[data-ppwr-products]');assert.equal(n.$('#ppwr-products-dialog tbody').children.length,2);assert.match(n.$('#ppwr-products-dialog').textContent,/Mýdlo 500 ml/);assert.match(n.$('#ppwr-products-dialog').textContent,/Mýdlo 1 L/);n.click('#ppwr-products-close');assert.equal(n.$('#section-ppwr').hidden,false);assert.deepEqual(n.calls,[]);
});
test('replacement archives, cancel rolls back, deletions keep other products and archive/current are independently removable',async t=>{
 const n=await setup();t.after(()=>n.dom.window.close());n.click('[data-select="0"]');n.click('[data-select="1"]');n.click('#bulk-ppwr');await n.select('#ppwr-bulk-input','Old.pdf');n.submit('#bulk-ppwr-form');await wait(()=>!n.$('#editor').open);const first=(await n.saved()).products[0].ppwr.current.path;
 n.click('[data-edit="0"]');n.click('#tab-ppwr');await n.select('#ppwr-drop','New.pdf',true);assert.equal(n.$('#ppwr-archive .ppwr-filename').textContent,'Old.pdf');n.click('#form-cancel');n.click('#confirm-yes');assert.equal((await n.saved()).products[0].ppwr.current.path,first);
 n.click('[data-edit="0"]');n.click('#tab-ppwr');await n.select('#ppwr-input','New.pdf');n.submit('#product-form');await wait(()=>!n.$('#editor').open);
 let state=await n.saved();assert.equal(state.products[0].ppwr.archive[0].path,first);assert.equal(state.products[1].ppwr.current.path,first);assert.equal(Object.keys(state.labelFiles).length,2);
 n.click('[data-edit="0"]');n.click('#tab-ppwr');n.click('#ppwr-archive [data-ppwr-delete]');n.click('#confirm-no');assert.equal(n.$('#ppwr-archive .ppwr-filename').textContent,'Old.pdf');
 n.click('#ppwr-archive [data-ppwr-delete]');n.click('#confirm-yes');await wait(()=>!n.$('#ppwr-archive [data-ppwr-delete]'));n.submit('#product-form');await wait(()=>!n.$('#editor').open);state=await n.saved();assert.equal(state.products[0].ppwr.archive.length,0);assert.equal(state.products[1].ppwr.current.path,first);assert.ok(state.labelFiles[first]);
 n.click('[data-edit="0"]');n.click('#tab-ppwr');n.click('.ppwr-current [data-ppwr-delete]');n.click('#confirm-yes');await wait(()=>!n.$('.ppwr-current [data-ppwr-delete]'));n.submit('#product-form');await wait(()=>!n.$('#editor').open);state=await n.saved();assert.equal(state.products[0].ppwr.current,null);assert.equal(Object.keys(state.labelFiles).length,1);assert.equal(state.products[0].custom.keep,true);assert.deepEqual(n.calls,[]);
});

test('PPWR survives reload and manual backup roundtrip, and queued files use one upload before product references',async t=>{
 const n=await setup();n.click('[data-edit="0"]');n.click('#tab-ppwr');await n.select('#ppwr-input','Persist.pdf');n.submit('#product-form');await wait(()=>!n.$('#editor').open);
 const stored=await n.saved(),database=n.database;n.dom.window.close();const reload=await setup({database});t.after(()=>reload.dom.window.close());assert.deepEqual((await reload.saved()).products,stored.products);assert.deepEqual((await reload.saved()).labelFiles,stored.labelFiles);
 const live=await setup({shared:true});t.after(()=>live.dom.window.close());live.click('[data-select="0"]');live.click('[data-select="1"]');live.click('#bulk-ppwr');await live.select('#ppwr-bulk-input','Shared.pdf');live.submit('#bulk-ppwr-form');await wait(async()=>!(await live.saved()).pendingLabels.length&&live.calls.some(c=>c.method==='PUT'&&c.url.endsWith('/products')));
 const writes=live.calls.filter(c=>c.method==='PUT');assert.deepEqual(writes.map(c=>c.url.split('/').pop()),['upload-image','products']);assert.equal(writes[0].body.path,live.remote.products[0].ppwr.current.path);assert.equal(live.remote.products[0].ppwr.current.path,live.remote.products[1].ppwr.current.path);assert.equal(live.remote.products[2].ppwr,undefined);
});
test('failed upload never publishes product reference, keeps retryable bytes, and a malformed upload leaves current file intact',async t=>{
 const n=await setup({shared:true,failUpload:true});t.after(()=>n.dom.window.close());n.click('[data-edit="0"]');n.click('#tab-ppwr');await n.select('#ppwr-input','Retry.pdf');n.submit('#product-form');await wait(async()=>(await n.saved()).pendingLabels.length===1);await sleep(30);assert.equal(n.calls.filter(c=>c.method==='PUT'&&c.url.endsWith('/products')).length,0);assert.ok((await n.saved()).labelFiles[(await n.saved()).pendingLabels[0]]);
 n.click('[data-edit="0"]');n.click('#tab-ppwr');const old=n.$('.ppwr-current .ppwr-filename').textContent;Object.defineProperty(n.$('#ppwr-input'),'files',{configurable:true,value:[new n.w.File(['not a pdf'],'fake.pdf',{type:'application/pdf'})]});n.$('#ppwr-input').dispatchEvent(new n.w.Event('change',{bubbles:true}));await wait(()=>n.errors.includes('PPWR_TYPE'));assert.equal(n.$('.ppwr-current .ppwr-filename').textContent,old);
});

test('bulk replacement keeps each previous version, rollback cancels changes, backup import restores bytes and undo restores deleted files',async t=>{
 const n=await setup();t.after(()=>n.dom.window.close());
 for(const index of [0,1]){n.click('[data-edit="'+index+'"]');n.click('#tab-ppwr');await n.select('#ppwr-input','Old-'+index+'.pdf');n.submit('#product-form');await wait(()=>!n.$('#editor').open);}
 const old=await n.saved();n.click('[data-select="0"]');n.click('[data-select="1"]');n.click('#bulk-ppwr');await n.select('#ppwr-bulk-input','New.pdf');n.click('#form-cancel');n.click('#confirm-yes');assert.deepEqual((await n.saved()).products,old.products);
 n.click('#bulk-ppwr');await n.select('#ppwr-bulk-input','New.pdf');n.submit('#bulk-ppwr-form');await wait(()=>!n.$('#editor').open);const grouped=await n.saved();
 assert.equal(grouped.products[0].ppwr.current.path,grouped.products[1].ppwr.current.path);for(const index of [0,1])assert.equal(grouped.products[index].ppwr.archive[0].path,old.products[index].ppwr.current.path);
 n.click('[data-edit="0"]');n.click('#tab-ppwr');n.click('.ppwr-current [data-ppwr-delete]');n.click('#confirm-yes');await wait(()=>!n.$('.ppwr-current [data-ppwr-delete]'));n.submit('#product-form');await wait(()=>!n.$('#editor').open);assert.equal((await n.saved()).products[0].ppwr.current,null);n.click('#undo');await wait(async()=>(await n.saved()).products[0].ppwr.current?.path===grouped.products[0].ppwr.current.path);
 const b={format:'jason-backup',version:1,products:grouped.products,logistics:grouped.logistics,labelFiles:grouped.labelFiles};n.click('#data-button');n.click('#restore-backup');Object.defineProperty(n.$('#import-file'),'files',{configurable:true,value:[{size:JSON.stringify(b).length,text:async()=>JSON.stringify(b)}]});n.$('#import-file').dispatchEvent(new n.w.Event('change'));await wait(()=>n.$('#confirm-dialog').open);n.click('#confirm-yes');await wait(()=>!n.$('#editor').open);assert.deepEqual((await n.saved()).products,grouped.products);assert.deepEqual((await n.saved()).labelFiles,grouped.labelFiles);assert.deepEqual(n.calls,[]);
});
