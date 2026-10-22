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
 async function select(selector,name='Supplier.pdf',drop=false,provided=null){const f=provided||file(name),el=$(selector);if(drop){const e=new w.Event('drop',{bubbles:true,cancelable:true});Object.defineProperty(e,'dataTransfer',{value:{files:[f]}});el.dispatchEvent(e);}else{Object.defineProperty(el,'files',{configurable:true,value:[f]});el.dispatchEvent(new w.Event('change',{bubbles:true}));}await wait(()=>!$('#ppwr-drop')?.disabled&&!$('#ppwr-bulk-drop')?.disabled);await sleep(10);}
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


const archiveFixtures={"docx": "UEsDBBQAAAAIAMF0Vl19j8M5SgAAAE0AAAATAAAAW0NvbnRlbnRfVHlwZXNdLnhtbLMJqSxILVaoyM3JK7ZVyigpKbDS1y9OzkjNTSzWyy9IzQPKpOUX5SaWALlF6foFicnZiemp+kYGBmb6yfl5Jal5JbolIDOU9O0AUEsDBBQAAAAIAMF0Vl1M12HDXAAAAGkAAAARAAAAd29yZC9kb2N1bWVudC54bWxFzEEKgCAQQNGrRAdookULMe9iaiU4M+IY1u1z1/Lz4OumPLsbA9XhwUSi2jZetWYFIO4KaGXiHKjbwQVt7VlOaFx8LuyCSKQTEyzzvALaSKPRTe3sXzAa/rn5AFBLAQIUAxQAAAAIAMF0Vl19j8M5SgAAAE0AAAATAAAAAAAAAAAAAACAAQAAAABbQ29udGVudF9UeXBlc10ueG1sUEsBAhQDFAAAAAgAwXRWXUzXYcNcAAAAaQAAABEAAAAAAAAAAAAAAIABewAAAHdvcmQvZG9jdW1lbnQueG1sUEsFBgAAAAACAAIAgAAAAAYBAAAAAA==", "xlsx": "UEsDBBQAAAAIAMF0Vl19j8M5SgAAAE0AAAATAAAAW0NvbnRlbnRfVHlwZXNdLnhtbLMJqSxILVaoyM3JK7ZVyigpKbDS1y9OzkjNTSzWyy9IzQPKpOUX5SaWALlF6foFicnZiemp+kYGBmb6yfl5Jal5JbolIDOU9O0AUEsDBBQAAAAIAMF0Vl1bepU8SwAAAE0AAAAPAAAAeGwvd29ya2Jvb2sueG1sDclRDkAwDADQq8gOoIsPH4K7FGWydV3aJhyfz5c3P6J5E8ndy6XaEpJ7mwBsT8RovTSq/5yijP5TL7CmhIclIucCQ4wjMN41wPoBUEsBAhQDFAAAAAgAwXRWXX2PwzlKAAAATQAAABMAAAAAAAAAAAAAAIABAAAAAFtDb250ZW50X1R5cGVzXS54bWxQSwECFAMUAAAACADBdFZdW3qVPEsAAABNAAAADwAAAAAAAAAAAAAAgAF7AAAAeGwvd29ya2Jvb2sueG1sUEsFBgAAAAACAAIAfgAAAPMAAAAAAA==", "zip": "UEsDBBQAAAAIAMF0Vl3cCGpXGAAAABYAAAATAAAAc3VwcGxpZXIvcmVhZG1lLnR4dAsICA9SKEktLlFIy6woKS1KVcjPy6kEAFBLAQIUAxQAAAAIAMF0Vl3cCGpXGAAAABYAAAATAAAAAAAAAAAAAACAAQAAAABzdXBwbGllci9yZWFkbWUudHh0UEsFBgAAAAABAAEAQQAAAEkAAAAAAA==", "emptyzip": "UEsFBgAAAAAAAAAAAAAAAAAAAAAAAA=="};

const ppwrMime={docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',zip:'application/zip'};
const fileFrom=(n,ext,kind=ext,name='Supplier.'+ext)=>new n.w.File([Buffer.from(archiveFixtures[kind],'base64')],name,{type:''});
const blobBytes=(w,blob)=>new Promise((resolve,reject)=>{const r=new w.FileReader();r.onload=()=>resolve(Buffer.from(r.result));r.onerror=reject;r.readAsArrayBuffer(blob);});
test('DOCX XLSX and ZIP preserve original bytes and filename through save, archive, download and backup restore',async t=>{
 const n=await setup();t.after(()=>n.dom.window.close());
 for(const [ext,drop] of [['docx',false],['xlsx',true],['zip',false]]){
  n.click('[data-edit="0"]');n.click('#tab-ppwr');const f=fileFrom(n,ext);await n.select(drop?'#ppwr-drop':'#ppwr-input',f.name,drop,f);assert.equal(n.$('[data-ppwr-open]'),null);n.submit('#product-form');await wait(()=>!n.$('#editor').open);
  const s=await n.saved(),a=s.products[0].ppwr.current;assert.equal(a.mimeType,ppwrMime[ext]);assert.ok(a.path.endsWith('.'+ext));assert.equal(a.name,f.name);assert.equal(s.labelFiles[a.path],'data:'+ppwrMime[ext]+';base64,'+archiveFixtures[ext]);assert.equal(s.products[0].ppwr.archive.length,['docx','xlsx','zip'].indexOf(ext));
  n.click('[data-edit="0"]');n.click('#tab-ppwr');let href,filename;n.w.HTMLAnchorElement.prototype.click=function(){filename=this.download;href=this.href;};n.click('.ppwr-current [data-ppwr-download]');await wait(()=>!!href);assert.equal(filename,f.name);assert.deepEqual(Buffer.from(href.split(',')[1],'base64'),Buffer.from(archiveFixtures[ext],'base64'));n.click('#form-cancel');
 }
 const s=await n.saved(),backup={format:'jason-backup',version:1,products:s.products,logistics:s.logistics,labelFiles:s.labelFiles};n.click('#data-button');n.click('#restore-backup');Object.defineProperty(n.$('#import-file'),'files',{configurable:true,value:[{size:JSON.stringify(backup).length,text:async()=>JSON.stringify(backup)}]});n.$('#import-file').dispatchEvent(new n.w.Event('change'));await wait(()=>n.$('#confirm-dialog').open);n.click('#confirm-yes');await wait(()=>!n.$('#editor').open);assert.deepEqual((await n.saved()).products,s.products);assert.deepEqual((await n.saved()).labelFiles,s.labelFiles);
 for(const a of s.products[0].ppwr.archive)assert.ok(n.w.JasonModel.labelReferences(s.products).has(a.path));assert.deepEqual(n.calls,[]);
});
test('bulk DOCX uses a single immutable upload and other document formats use the same API contract',async t=>{
 for(const ext of ['docx','xlsx','zip']){
  const n=await setup({shared:true});t.after(()=>n.dom.window.close());n.click('[data-select="0"]');n.click('[data-select="1"]');n.click('#bulk-ppwr');const file=fileFrom(n,ext);await n.select('#ppwr-bulk-drop',file.name,true,file);n.submit('#bulk-ppwr-form');await wait(()=>n.calls.some(c=>c.method==='PUT'&&c.url.endsWith('/products')));
  const uploads=n.calls.filter(c=>c.method==='PUT'&&c.url.endsWith('/upload-image'));assert.equal(uploads.length,1);assert.equal(uploads[0].body.content,archiveFixtures[ext]);assert.equal(n.remote.products[0].ppwr.current.path,n.remote.products[1].ppwr.current.path);assert.equal(n.remote.products[2].ppwr,undefined);
 }
});
test('remote DOCX downloads from the correct attachment path without local cached bytes or a preview',async t=>{
 const a={...asset('remote'),path:'OrderSheet/img/labels/ppwr-remote.docx',name:'Original.docx',mimeType:ppwrMime.docx};const n=await setup({shared:true,remote:{products:[{...fixture,ppwr:{current:a,archive:[]}}],logistics:{}}});t.after(()=>n.dom.window.close());
 let url,blob;const originalFetch=n.w.fetch;n.w.fetch=async(value,args)=>{if(String(value).endsWith('ppwr-remote.docx')){url=value;return {ok:true,blob:async()=>new n.w.Blob([Buffer.from(archiveFixtures.docx,'base64')],{type:ppwrMime.docx})};}return originalFetch(value,args);};n.w.URL.createObjectURL=value=>{blob=value;return 'blob:remote';};n.click('[data-edit="0"]');n.click('#tab-ppwr');assert.equal(n.$('[data-ppwr-open]'),null);n.click('[data-ppwr-download]');await wait(()=>!!blob);assert.equal(url,'../../OrderSheet/img/labels/ppwr-remote.docx');assert.deepEqual(await blobBytes(n.w,blob),Buffer.from(archiveFixtures.docx,'base64'));
});
test('mislabeled and broken archives are rejected while valid empty ZIP and uppercase Office filenames are accepted',async t=>{
 const n=await setup();t.after(()=>n.dom.window.close());const S=n.w.JasonStorage;
 await assert.rejects(S.ppwr(new n.w.File(['not an Office file'],'fake.docx')),/PPWR_TYPE/);await assert.rejects(S.ppwr(new n.w.File(['PK\x03\x04broken'],'broken.zip')),/PPWR_TYPE/);
 await assert.rejects(S.ppwr(fileFrom(n,'docx','xlsx')),/PPWR_TYPE/);await assert.rejects(S.ppwr(fileFrom(n,'xlsx','docx')),/PPWR_TYPE/);await assert.rejects(S.ppwr(fileFrom(n,'docx','zip')),/PPWR_TYPE/);
 assert.equal((await S.ppwr(fileFrom(n,'zip','emptyzip'))).extension,'zip');assert.equal((await S.ppwr(fileFrom(n,'docx','docx','DECLARATION.DOCX'))).mimeType,ppwrMime.docx);await assert.rejects(S.ppwr({size:15*1024*1024+1,name:'large.zip'}),/PPWR_SIZE/);
 const valid='data:'+ppwrMime.docx+';base64,'+archiveFixtures.docx;M.validateLabelFiles({'OrderSheet/img/labels/ppwr-good.docx':valid});assert.throws(()=>M.validateLabelFiles({'OrderSheet/img/labels/not-ppwr.docx':valid}),/BACKUP_FORMAT/);assert.throws(()=>M.validateLabelFiles({'OrderSheet/img/labels/ppwr-good.xlsx':valid}),/BACKUP_FORMAT/);assert.equal(M.labelPath('OrderSheet/img/labels/ppwr-good.docx'),null);
});
