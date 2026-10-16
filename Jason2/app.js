/* Jason 2.0 — no build step, no CDN, compatible with the original API and JSON files. */
(function(){
'use strict';
const M=JasonModel,S=JasonStorage,$=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const sandbox=JASON_CONFIG.sandbox===true;
function isolate(next){next.products=M.cleanProducts(next.products);const refs=M.labelReferences(next.products);next.labelFiles=Object.fromEntries(Object.entries(next.labelFiles||{}).filter(([path])=>refs.has(path)));next.pendingLabels=(next.pendingLabels||[]).filter(path=>Object.hasOwn(next.labelFiles,path));if(next.baseline?.products){try{next.baseline.products=sig(M.cleanProducts(JSON.parse(next.baseline.products)));}catch{}}if(sandbox){next.connected=false;next.api='';next.imageBase=JASON_CONFIG.imageBase;next.baseline={};next.pendingPhotos=[];next.pendingLabels=[];}return next;}
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const icons={products:'▦',keys:'◇',checks:'✓',data:'↔',undo:'↶',redo:'↷',export:'↓',plus:'+'};
let lang='cs',view='products',page=1,pageSize=30,sort={field:'name',asc:true},selected=new Set(),history=[],future=[],busy=false,editorDirty=false,editorSave=null,editorReturn=null,toastTimer,syncing=false,storageError=false;
let state={products:[],logistics:M.clone(window.JASON_SEED_LOGISTICS||{}),photos:{},pendingPhotos:[],labelFiles:{},pendingLabels:[],connected:false,api:JASON_CONFIG.apiBase,imageBase:JASON_CONFIG.imageBase,baseline:{},updated:null};
let filters={search:'',brand:'',type:'',key:'',status:'active',keyStatus:'active',new:'',flag:'',scope:''};
let photoVersion=Date.now(),photoObserver=null;
const photoVersions=new Map(),missingThumbnails=new Set();
const photoIds=Array.isArray(window.JASON_PHOTO_IDS)&&window.JASON_PHOTO_IDS.every(id=>typeof id==='string')?new Set(window.JASON_PHOTO_IDS):null;
const dataIssues=()=>M.issues(state,photoIds);
const t=k=>{
 const text=JasonText[lang][k]||JasonText.cs[k]||k;if(!text.includes('{date}'))return text;
 const date=new Date(`${window.JASON_SANDBOX_SEED?.snapshotAt}T00:00:00Z`),label=Number.isNaN(date.getTime())?'—':new Intl.DateTimeFormat(lang==='cs'?'cs-CZ':'en-GB',{day:'numeric',month:lang==='cs'?'numeric':'long',year:'numeric',timeZone:'UTC'}).format(date);
 return text.replaceAll('{date}',label);
};
const types=()=>Object.keys(JasonTypes.en);
const typeLabel=v=>JasonTypes[lang][v]||v;
const today=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
const brands=()=>[...new Set(['Lilien','Naturalis','Twister','Natava','Sunnoré',...state.products.map(p=>p.brand),...Object.keys(state.logistics)])].filter(Boolean).sort((a,b)=>a.localeCompare(b));
const flags=()=>[...new Set(state.products.flatMap(p=>p.flags||[]))].sort();
const sig=v=>JSON.stringify(v,(_,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.keys(x).sort().map(k=>[k,x[k]])):x);
const dirty=n=>state.connected&&sig(state[n])!==state.baseline[n];
let refreshing=false,lastRefresh=0,refreshFailed=false;
const canEdit=()=>!refreshing&&!(JASON_CONFIG.sharedOnly&&JASON_CONFIG.autoConnect&&!state.connected);
const hasPending=()=>!sandbox&&(dirty('products')||dirty('logistics')||state.pendingPhotos.length>0||state.pendingLabels.length>0);
const option=(value,label,sel)=>`<option value="${esc(value)}" ${String(value)===String(sel)?'selected':''}>${esc(label)}</option>`;
const button=(id,label,cls='')=>`<button type="button" id="${id}" class="${cls}">${esc(t(label))}</button>`;
function selectHTML(id,label,items,value,empty){return `<label class="filter"><span>${esc(t(label))}</span><select id="${id}">${option('',t(empty),value)}${items.map(x=>option(typeof x==='object'?x.value:x,typeof x==='object'?x.label:x,value)).join('')}</select></label>`;}
function toast(text,error=false){
 const e=$('#toast');clearTimeout(toastTimer);
 const hide=()=>{if(typeof e.hidePopover==='function')e.hidePopover();e.hidden=true;};
 hide();
 // Keep announcements inside the active modal's accessible subtree. A manual
 // popover lifts them above its backdrop and escapes the dialog's scroll area.
 const dialogs=$$('dialog[open]');(dialogs.at(-1)||document.body).append(e);
 e.textContent=text;e.className=error?'error':'';e.hidden=false;
 if(typeof e.showPopover==='function')e.showPopover();
 toastTimer=setTimeout(hide,error?9000:3500);
}
function error(e){const msg=e?.message||String(e);toast(`${t('failed')}: ${t(msg)}`,true);console.error(e);}
async function persist(){isolate(state);try{await S.put('state',{state,lang});storageError=false;}catch(e){storageError=true;toast(t('localError'),true);}renderStatus();}
function renderStatus(){
 $('#connection-label').textContent=t(sandbox?'sandboxLocal':state.connected?'connected':'local');$('.connection .dot').classList.toggle('online',state.connected);
 $('#save-status').textContent=storageError?t('localError'):syncing?t('saving'):hasPending()?t('pending'):t(state.connected?'synced':'saved');
 $('#save-status').classList.toggle('warning',hasPending()||storageError);$('#retry').hidden=!state.connected||!hasPending()||syncing;$('#retry').textContent=t('retry');
 if($('#refresh')){$('#refresh').hidden=sandbox||!JASON_CONFIG.autoConnect&&!state.connected;$('#refresh').textContent=t('refresh');$('#refresh').disabled=refreshing||syncing||busy;}
 if(refreshing)$('#save-status').textContent=t('connecting');else if(refreshFailed)$('#save-status').textContent=t('refreshFailed');
}
async function commit(next,label='updated'){
 // Make the restore point durable before applying changes.
 try{await S.put('recovery',M.clone(state));}catch(e){storageError=true;toast(t('localError'),true);throw e;}
 history.push(M.clone(state));if(history.length>12)history.shift();future=[];state=isolate(next);state.updated=new Date().toISOString();
 selected.clear();await persist();render();toast(t(label));if(state.connected)void syncRemote();
}
async function undo(redo=false){if(busy||editorDirty)return;const source=redo?future:history,target=redo?history:future;if(!source.length)return;const current=M.clone(state),next=source.pop();target.push(current);
 // Keep the acknowledged remote baseline; history changes data, never connection identity.
 next.connected=state.connected;next.api=state.api;next.imageBase=state.imageBase;next.baseline=state.baseline;
 next.pendingPhotos=Object.keys(next.photos).filter(id=>next.photos[id]!==state.photos[id]||state.pendingPhotos.includes(id));
 next.pendingLabels=Object.keys(next.labelFiles||{}).filter(path=>next.labelFiles[path]!==state.labelFiles[path]||state.pendingLabels.includes(path));
 state=isolate(next);await persist();selected.clear();render();toast(t(redo?'redo':'undo'));if(state.connected)void syncRemote();}
async function syncRemote(){
 if(sandbox||syncing||!state.connected)return;
 syncing=true;renderStatus();
 try{
  while(state.connected&&hasPending()){
   // Publish immutable files before their product references. On failure the
   // entire change stays durable locally and can be retried after reloading.
   if(state.pendingLabels.length&&dirty('products')){
    const remote=await S.request(state.api,'products');
    if(sig(M.cleanProducts(remote))!==state.baseline.products)throw Error(t('sharedConflict'));
   }
   for(const path of [...state.pendingLabels]){
    const data=state.labelFiles[path];
    if(data&&M.labelReferences(state.products).has(path)){
     await S.request(state.api,'upload-image','PUT',{path,content:data.split(',')[1]});
     if(state.labelFiles[path]!==data)continue;
    }
    state.pendingLabels=state.pendingLabels.filter(p=>p!==path);await persist();
   }
   for(const name of ['logistics','products']){
    if(!dirty(name))continue;
    const snapshot=M.clone(state[name]);
    const remote=await S.request(state.api,name);
    if(sig(name==='products'?M.cleanProducts(remote):remote)!==state.baseline[name])throw Error(lang==='cs'?'Společná data mezitím změnil jiný uživatel. Stáhněte zálohu a načtěte aktuální data před dalším odesláním.':'Shared data changed since loading. Download a backup and reload current data before sending again.');
    await S.request(state.api,name,'PUT',snapshot);state.baseline[name]=sig(snapshot);await persist();
   }
   for(const id of [...state.pendingPhotos]){
    const data=state.photos[id];if(!data){state.pendingPhotos=state.pendingPhotos.filter(x=>x!==id);continue;}
    await S.request(state.api,'upload-image','PUT',{path:`OrderSheet/img/${id}.jpg`,content:data.split(',')[1]});
    photoVersions.set(String(id),Date.now());
    if(state.photos[id]===data)state.pendingPhotos=state.pendingPhotos.filter(x=>x!==id);await persist();
   }
  }
 }catch(e){toast(`${t('saveError')} ${e.message}`,true);}
 finally{syncing=false;renderStatus();}
}
async function confirm(title,message,yes='confirm',danger=false){
 const d=$('#confirm-dialog');$('#confirm-title').textContent=t(title);$('#confirm-message').textContent=message;$('#confirm-no').textContent=t('cancel');$('#confirm-yes').textContent=t(yes);$('#confirm-yes').className=danger?'danger':'primary';d.showModal();
 return new Promise(resolve=>{const finish=v=>{d.close();d.oncancel=null;resolve(v);};$('#confirm-yes').onclick=()=>finish(true);$('#confirm-no').onclick=()=>finish(false);d.oncancel=e=>{e.preventDefault();finish(false);};});
}
async function closeEditor(){if(busy)return;if(editorDirty&&!await confirm('discard',t('discardHint'),'discardYes'))return;formClose();}
function openEditor(title,caption,html,small=false){
 const d=$('#editor');d.classList.toggle('small',small);$('#editor-title').textContent=title;$('#editor-caption').textContent=caption;$('#editor-body').innerHTML=html;editorDirty=false;editorSave=null;editorReturn=null;
 $('#editor-body').oninput=e=>{if(e.target.closest('form')&&!['include-products','include-empty','include-inactive'].includes(e.target.id))editorDirty=true;};$('#editor-body').onchange=e=>{if(e.target.closest('form')&&!['include-products','include-empty','include-inactive'].includes(e.target.id))editorDirty=true;};
 if(!d.open)d.showModal();
 d.scrollTop=0;
}
async function runForm(action){if(busy)return;busy=true;$$('#editor button[type="submit"]').forEach(b=>{b.disabled=true;b.dataset.original=b.textContent;b.textContent=t('saving');});try{await action();}catch(e){error(e);}finally{busy=false;$$('#editor button[type="submit"]').forEach(b=>{b.disabled=false;b.textContent=b.dataset.original||t('save');});}}
function formClose(result,returnToOrigin=true){const back=editorReturn;editorDirty=false;editorSave=null;editorReturn=null;$('#editor').close();if(returnToOrigin&&back)back(result);}
function render(){
 document.documentElement.lang=lang;document.title=`Jason 2.0 · ${t(sandbox?'sandboxVersion':'liveVersion')} · ${t(view)}`;
 $$('[data-text]').forEach(e=>e.textContent=t(sandbox&&e.dataset.text==='readonlyNote'?'sandboxFooter':e.dataset.text));$$('[data-lang]').forEach(e=>{e.classList.toggle('active',e.dataset.lang===lang);e.setAttribute('aria-pressed',e.dataset.lang===lang);});
 $('#workspace-mode').textContent=`JASON 2.0 / ${t(sandbox?'sandboxVersion':'liveVersion')}`;
 $('#sandbox-banner').hidden=!sandbox;$('#sandbox-banner').textContent=t('sandboxNote');
 $('#nav').innerHTML=['products','keys','checks'].map(v=>`<button class="nav-button ${view===v?'active':''}" data-view="${v}" ${view===v?'aria-current="page"':''}><span class="nav-icon">${icons[v]}</span>${esc(t(v))}<span class="nav-count">${v==='products'?state.products.length:v==='keys'?M.keyEntries(state.logistics,{status:'active'}).length:dataIssues().length}</span></button>`).join('');
 $$('[data-view]').forEach(b=>b.onclick=()=>changeView(b.dataset.view));
 $('#data-button').innerHTML=`<span class="nav-icon">↔</span>${esc(t(sandbox?'sandboxData':'data'))}`;
 $('#crumb').textContent=t(view);$('#page-title').textContent=t(view);
 $('#undo').textContent=icons.undo;$('#undo').title=t('undo');$('#undo').setAttribute('aria-label',t('undo'));$('#undo').disabled=!history.length;
 $('#redo').textContent=icons.redo;$('#redo').title=t('redo');$('#redo').setAttribute('aria-label',t('redo'));$('#redo').disabled=!future.length;
 $('#export').textContent=`↓ ${t('export')}`;$('#create').textContent=`+ ${t(view==='keys'?'addKey':'addProduct')}`;$('#create').hidden=view==='checks';$('#create').disabled=refreshing||(JASON_CONFIG.sharedOnly&&JASON_CONFIG.autoConnect&&!state.connected);
 renderToolbar();renderContent();renderStatus();
}
function changeView(next){view=next;page=1;selected.clear();filters={search:'',brand:'',type:'',key:'',status:'active',keyStatus:'active',new:'',flag:'',scope:''};location.hash=next;render();}
function renderToolbar(){
 const searchPlaceholder=t(view==='products'?'search':view==='keys'?'keySearch':'issueSearch');
 let html=`<label class="search-box"><span aria-hidden="true">⌕</span><input id="search" type="search" placeholder="${esc(searchPlaceholder)}" aria-label="${esc(searchPlaceholder)}" value="${esc(filters.search)}"></label>`;
 html+=selectHTML('filter-brand','brand',brands(),filters.brand,'allBrands');
 if(view==='products'){
  html+=selectHTML('filter-type','type',[...new Set([...types(),...state.products.map(p=>p.type)])].filter(Boolean).map(v=>({value:v,label:typeLabel(v)})),filters.type,'allTypes');
  html+=selectHTML('filter-key','key',[...new Set(M.keyEntries(state.logistics).filter(k=>(M.keyIsActive(k.data)||k.key===filters.key)&&(!filters.brand||k.brand===filters.brand)).map(k=>k.key))].sort((a,b)=>a.localeCompare(b,undefined,{numeric:true})),filters.key,'allKeys');
  html+=`<label class="filter"><span>${t('status')}</span><select id="filter-status">${['active','all','discontinued'].map(v=>option(v,t(v),filters.status)).join('')}</select></label>`;
  html+=selectHTML('filter-new','new',[{value:'yes',label:t('yes')},{value:'no',label:t('no')}],filters.new,'all');
  if(flags().length)html+=selectHTML('filter-flag','flag',flags(),filters.flag,'allFlags');
 }else if(view==='keys'){
  html+=`<label class="filter"><span>${t('status')}</span><select id="filter-keyStatus">${['active','inactive','all'].map(v=>option(v,t(v),filters.keyStatus)).join('')}</select></label>`;
  html+=selectHTML('filter-scope','keyScope',[{value:'used',label:t('used')},{value:'unused',label:t('unused')},{value:'incomplete',label:t('incomplete')}],filters.scope,'allScopes');
 }
 html+=`<button class="reset-button" id="reset">${t('reset')}</button>`;$('#toolbar').innerHTML=html;
 $('#search').oninput=e=>{filters.search=e.target.value;page=1;selected.clear();renderContent();};
 for(const f of ['brand','type','key','status','keyStatus','new','flag','scope']){const el=$(`#filter-${f}`);if(el)el.onchange=e=>{filters[f]=e.target.value;if(f==='brand')filters.key='';page=1;selected.clear();renderToolbar();renderContent();};}
 $('#reset').onclick=()=>{filters={search:'',brand:'',type:'',key:'',status:'active',keyStatus:'active',new:'',flag:'',scope:''};page=1;selected.clear();renderToolbar();renderContent();};
}
function filteredProducts(){
 const list=M.filterProducts(state.products,filters),byName=sort.field==='name';
 const collator=new Intl.Collator(lang,{numeric:true});
 const value=p=>byName?(lang==='cs'?p.csName||p.name:p.name||p.csName):sort.field==='volume'?Number(p.volume?.number)||0:p[sort.field];
 return list.sort((a,b)=>{const av=value(a.p),bv=value(b.p);return (typeof av==='number'&&typeof bv==='number'?av-bv:collator.compare(String(av??''),String(bv??'')))*(sort.asc?1:-1);});
}
function productExportRows(){const rows=filteredProducts();return selected.size?rows.filter(r=>selected.has(r.index)):rows;}
function completion(data){let done=0,total=0;Object.entries(M.sections).forEach(([s,fs])=>fs.forEach(f=>{total++;if(!M.isMissing(data[s]?.[f]))done++;}));return Math.round(done/total*100);}
function issueFieldLabel(field){if(!field)return '';if(field==='id')return t('ean');if(field.startsWith('volume.'))return t(field);return field.split('.').map(t).join(' / ');}
function badge(text,cls=''){return `<span class="badge ${cls}">${esc(text)}</span>`;}
function renderContent(){
 if(photoObserver){photoObserver.disconnect();photoObserver=null;}
 let rows,unit;
 if(view==='products'){rows=filteredProducts();unit=t('countProducts');}
 else if(view==='keys'){rows=M.keyEntries(state.logistics,{status:filters.keyStatus}).filter(r=>{const used=state.products.filter(p=>p.brand===r.brand&&M.key(p.key)===r.key).length;return (!filters.brand||r.brand===filters.brand)&&M.fold(r.brand+' '+r.key).includes(M.fold(filters.search))&&(!filters.scope||filters.scope==='used'&&used>0||filters.scope==='unused'&&used===0||filters.scope==='incomplete'&&completion(r.data)<100);}).sort((a,b)=>a.brand.localeCompare(b.brand)||a.key.localeCompare(b.key,undefined,{numeric:true}));unit=t('countKeys');}
 else{rows=dataIssues().filter(r=>{const p=r.kind==='product'?state.products[r.index]:null;return (!filters.brand||(p?.brand||r.brand)===filters.brand)&&M.fold([p?.name,p?.csName,p?.id,p?.brand,r.brand,r.key,t(r.code),issueFieldLabel(r.field)].join(' ')).includes(M.fold(filters.search));});unit=t('countIssues');}
 const perPage=pageSize==='all'?Math.max(1,rows.length):pageSize,pages=Math.max(1,Math.ceil(rows.length/perPage));page=Math.min(page,pages);const items=rows.slice((page-1)*perPage,page*perPage);
 if(!items.length){$('#content').innerHTML=`<div class="empty-state"><div class="empty-symbol">${view==='checks'?'✓':'◇'}</div><h2>${esc(t(view==='products'&&!state.products.length?'noProducts':view==='checks'&&!rows.length&&!filters.search&&!filters.brand?'noIssues':'empty'))}</h2><p>${esc(t(view==='products'&&!state.products.length?'noProductsHint':'emptyHint'))}</p>${view==='products'&&!state.products.length?button('empty-import','loadProducts','primary'):''}</div>`;if($('#empty-import'))$('#empty-import').onclick=()=>importFile('products');}
 else if(view==='products')renderProductTable(items);
 else if(view==='keys')renderKeyTable(items);
 else renderChecksTable(items);
 if(view==='checks'&&!photoIds)$('#content').insertAdjacentHTML('afterbegin',`<p class="notice amber" role="status">${esc(t('photoCheckUnavailable'))}</p>`);
 $('#pagination').innerHTML=`<span>${rows.length?(page-1)*perPage+1:0}–${Math.min(page*perPage,rows.length)} <span class="muted">/ ${rows.length} ${esc(unit)}</span></span><div class="pagination-actions"><label><select id="page-size" aria-label="${esc(t('countProducts'))}">${[30,60,120,'all'].map(n=>option(n,n==='all'?t('pageAll'):n,pageSize)).join('')}</select></label><button id="prev" ${page===1?'disabled':''}>${t('previous')}</button><span>${page} / ${pages}</span><button id="next" ${page===pages?'disabled':''}>${t('next')}</button></div>`;
 $('#prev').onclick=()=>{page--;renderContent();};$('#next').onclick=()=>{page++;renderContent();};$('#page-size').onchange=e=>{pageSize=e.target.value==='all'?'all':Number(e.target.value);page=1;renderContent();};
 renderBulk();
}
function renderProductTable(items){
 const headers=[['name','product'],['brand','brand'],['id','ean'],['volume','volume'],['price','price'],['key','key'],['discontinued','status']];
 $('#content').innerHTML=`<div class="table-scroll"><table><thead><tr><th class="select-cell"><input type="checkbox" id="select-page" aria-label="${esc(t('selectAll'))}" ${items.every(x=>selected.has(x.index))?'checked':''}></th>${headers.map(([f,label])=>`<th><button class="sort-button" data-sort="${f}">${esc(t(label))}${sort.field===f?(sort.asc?' ↑':' ↓'):''}</button></th>`).join('')}<th class="actions-cell">${t('actions')}</th></tr></thead><tbody>${items.map(({p,index})=>{
 const title=lang==='cs'?p.csName||p.name:p.name||p.csName;const secondary=lang==='cs'?p.name:p.csName,pack=M.packaging(p,state.logistics).pack;
 return `<tr class="${selected.has(index)?'selected':''}"><td class="select-cell"><input type="checkbox" data-select="${index}" aria-label="${esc(t('select')+' '+title)}" ${selected.has(index)?'checked':''}></td><td class="product-cell"><div class="product-identity">${productThumbnail(p,index,title)}<button class="product-link" data-edit="${index}"><span><strong>${esc(title||'—')}</strong><small>${esc(typeLabel(p.type))}${secondary&&secondary!==title?' · '+esc(secondary):''}</small></span></button></div></td><td>${badge(p.brand||'—','brand-'+M.fold(p.brand).replace(/[^a-z]/g,''))}</td><td class="mono">${esc(p.id||'—')}<small class="cell-sub">${p.hs?'HS '+esc(p.hs):''}</small></td><td class="nowrap">${esc(p.volume?.number??'')} ${esc(p.volume?.unit||'')}</td><td class="numeric">${p.price==null||p.price===''?'—':esc(Number.isFinite(Number(p.price))?Number(p.price).toLocaleString(lang==='cs'?'cs-CZ':'en-GB',{minimumFractionDigits:2,maximumFractionDigits:4}):p.price)}</td><td><button class="key-link" data-product-key="${index}">${esc(M.key(p.key)||'—')}</button><small class="cell-sub">${pack!==''?esc(pack)+' '+(lang==='cs'?'ks / karton':'items / carton'):''}</small></td><td class="status-cell"><span class="status-entry">${p.discontinued===true?badge(t('discontinued'),'status-discontinued'):badge(t('active'),'status-active')}${p.discontinued===true&&p.discontinued_date?'<small class="cell-sub">'+esc(p.discontinued_date)+'</small>':''}</span>${p.new===true?'<span class="status-entry">'+badge(t('new'),'status-new')+(p.new_date?'<small class="cell-sub">'+esc(p.new_date)+'</small>':'')+'</span>':''}${(p.flags||[]).map(f=>badge(f,'custom')).join('')}</td><td class="actions-cell"><button data-edit="${index}" class="row-edit">${t('edit')}</button><button data-more="${index}" class="more-button" aria-label="${esc(t('actions')+' '+title)}">•••</button></td></tr>`;
 }).join('')}</tbody></table></div>`;
 observeProductPhotos();renderProductSelection();
 $$('[data-sort]').forEach(b=>b.onclick=()=>{sort={field:b.dataset.sort,asc:sort.field===b.dataset.sort?!sort.asc:true};renderContent();});
 $$('[data-edit]').forEach(b=>b.onclick=()=>openProduct(Number(b.dataset.edit)));
 $$('[data-more]').forEach(b=>b.onclick=()=>productActions(Number(b.dataset.more)));
 $$('[data-product-key]').forEach(b=>b.onclick=()=>{const p=state.products[Number(b.dataset.productKey)];if(M.key(p.key)&&state.logistics[p.brand]?.[M.key(p.key)])openKey(p.brand,M.key(p.key));else openProduct(Number(b.dataset.productKey),'packaging');});
 $$('[data-select]').forEach(c=>c.onchange=()=>{const i=Number(c.dataset.select);if(c.checked)selected.add(i);else selected.delete(i);renderProductSelection();});
 $('#select-page').onchange=e=>{items.forEach(x=>{if(e.target.checked)selected.add(x.index);else selected.delete(x.index);});renderProductSelection();};
}
function renderProductSelection(){
 const inputs=$$('[data-select]');let checked=0;
 for(const input of inputs){input.checked=selected.has(Number(input.dataset.select));input.closest('tr').classList.toggle('selected',input.checked);if(input.checked)checked++;}
 const all=$('#select-page');if(all){all.checked=inputs.length>0&&checked===inputs.length;all.indeterminate=checked>0&&checked<inputs.length;}
 renderBulk();
}
function logisticsNumber(raw){const value=M.count(raw);return value===''||!Number.isFinite(value)||value<0?'—':esc(value.toLocaleString(lang==='cs'?'cs-CZ':'en-GB',{maximumFractionDigits:2}));}
function renderKeyTable(items){
 $('#content').innerHTML=`<div class="table-scroll"><table><thead><tr>${['key','brand','status','palletItems','palletWeight','estimatedHeight','affected','complete','actions'].map(k=>`<th>${t(k)}</th>`).join('')}</tr></thead><tbody>${items.map(r=>{const used=state.products.filter(p=>p.brand===r.brand&&M.key(p.key)===r.key).length,percent=completion(r.data);return `<tr><td><button class="key-link key-large" data-key-edit="${esc(r.brand)}" data-key-name="${esc(r.key)}">${esc(r.key)}</button></td><td>${badge(r.brand)}</td><td>${badge(t(M.keyIsActive(r.data)?'active':'inactive'),M.keyIsActive(r.data)?'status-active':'grey')}</td><td class="numeric">${logisticsNumber(r.data.PALLET?.nr_of_items)}</td><td class="numeric">${logisticsNumber(r.data.PALLET?.weight)}</td><td class="numeric" title="${esc(t('estimatedHeightHint'))}">${M.estimatedPalletHeight(r.data)===''?'—':'≈ '+logisticsNumber(M.estimatedPalletHeight(r.data))}</td><td><button class="text-button" data-used-brand="${esc(r.brand)}" data-used-key="${esc(r.key)}">${used} ${!used?'· '+t('unused'):''}</button></td><td><span class="completeness"><span><i style="width:${percent}%"></i></span>${percent}%</span></td><td><button class="row-edit" data-key-edit="${esc(r.brand)}" data-key-name="${esc(r.key)}">${t('edit')}</button></td></tr>`;}).join('')}</tbody></table></div>`;
 $$('[data-key-edit]').forEach(b=>b.onclick=()=>openKey(b.dataset.keyEdit,b.dataset.keyName));$$('[data-used-key]').forEach(b=>b.onclick=()=>{changeView('products');filters.brand=b.dataset.usedBrand;filters.key=b.dataset.usedKey;filters.status='all';renderToolbar();renderContent();});
}
function renderChecksTable(items){
 $('#content').innerHTML=`<div class="table-scroll"><table><thead><tr><th>${t('product')} / ${t('key')}</th><th>${t('brand')}</th><th>${t('issue')}</th><th>${t('actions')}</th></tr></thead><tbody>${items.map((r,i)=>{const p=r.kind==='product'?state.products[r.index]:null;return `<tr><td><strong>${esc(p?(lang==='cs'?p.csName||p.name:p.name||p.csName):r.key)}</strong><small class="cell-sub mono">${esc(p?.id||'')}</small></td><td>${esc(p?.brand||r.brand)}</td><td><span class="issue-dot ${r.code==='keyUnused'?'info':''}"></span>${esc(t(r.code))}${r.field?' · '+esc(issueFieldLabel(r.field)):''}</td><td><button data-issue="${i}" class="row-edit">${t('open')}</button></td></tr>`;}).join('')}</tbody></table></div>`;
 $$('[data-issue]').forEach(b=>b.onclick=()=>{const r=items[Number(b.dataset.issue)];if(r.kind==='product'){const tab=r.field==='photo'?'photo':['key','carton_ean'].includes(r.field)?'packaging':r.field==='new_date'?'flags':'details';openProduct(r.index,tab);}else openKey(r.brand,r.key);});
}
function renderBulk(){const e=$('#bulk-bar');e.hidden=!selected.size||view!=='products';if(e.hidden)return;e.innerHTML=`<span><strong>${selected.size}</strong> ${t('selected')}</span>${button('bulk-edit','bulk')}${button('bulk-select-all','selectAll')}${button('bulk-clear','selectNone')}`;$('#bulk-edit').onclick=openBulk;$('#bulk-select-all').onclick=()=>{filteredProducts().forEach(r=>selected.add(r.index));renderProductSelection();};$('#bulk-clear').onclick=()=>{selected.clear();renderProductSelection();};}
function field(name,label,value,type='text',extra='',hint=''){return `<label class="field"><span>${esc(t(label))}</span><input name="${esc(name)}" id="field-${esc(name)}" type="${type}" value="${esc(value??'')}" ${extra}>${hint?`<small>${esc(hint)}</small>`:''}</label>`;}
function datalist(id,values){return `<datalist id="${id}">${values.map(v=>`<option value="${esc(v)}">${esc(id==='types'?typeLabel(v):v)}</option>`).join('')}</datalist>`;}
function formFooter(label='save',left=''){return `<div class="form-footer"><span class="muted">${left}</span><div>${button('form-cancel','cancel')}<button type="submit" class="primary">${esc(t(label))}</button></div></div>`;}
function attachCancel(){if($('#form-cancel'))$('#form-cancel').onclick=closeEditor;}
function productPhoto(p,thumbnail=false){return (!state.connected||state.pendingPhotos.includes(p.id)?state.photos[p.id]:null)||(state.imageBase&&p.id?`${state.imageBase.replace(/\/$/,'')}/${thumbnail?'thumbnails/':''}${encodeURIComponent(p.id)}.jpg?v=${photoVersions.get(String(p.id))||photoVersion}`:'');}
function productThumbnail(p,index,title){
 const src=productPhoto(p,true),missing=!src||missingThumbnails.has(src);
 return `<button type="button" class="product-thumb" data-row-photo="${index}" aria-label="${esc((missing?t('noPhoto'):t('viewPhoto'))+' · '+(title||p.id||''))}" title="${esc(missing?t('noPhoto'):t('viewPhoto'))}" disabled><svg class="photo-fallback" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8" cy="8" r="1.5"/><path d="m3 17 5-5 4 4 4-6 5 7"/></svg>${missing?'':`<img data-photo-src="${esc(src)}" alt="${esc(title||p.id||'')}" width="44" height="44" loading="lazy" decoding="async" hidden>`}</button>`;
}
function observeProductPhotos(){
 const load=img=>{
  const src=img.dataset.photoSrc,button=img.closest('.product-thumb');
  img.onload=()=>{img.hidden=false;button.querySelector('.photo-fallback').hidden=true;button.disabled=false;};
  img.onerror=()=>{missingThumbnails.add(src);img.hidden=true;button.disabled=true;button.title=t('noPhoto');button.setAttribute('aria-label',t('noPhoto')+' · '+img.alt);button.querySelector('.photo-fallback').hidden=false;};
  img.hidden=false;img.src=src;
 };
 if(typeof IntersectionObserver==='function'){
  photoObserver=new IntersectionObserver(entries=>{for(const entry of entries)if(entry.isIntersecting){photoObserver.unobserve(entry.target);load(entry.target.querySelector('[data-photo-src]'));}},{rootMargin:'0px'});
  $$('[data-photo-src]').forEach(img=>photoObserver.observe(img.closest('.product-thumb')));
 }else $$('[data-photo-src]').forEach(load);
 $$('[data-row-photo]').forEach(button=>button.onclick=()=>{
  const p=state.products[Number(button.dataset.rowPhoto)],src=productPhoto(p);
  if(!src)return;$('#large-photo').alt=lang==='cs'?p.csName||p.name||p.id:p.name||p.csName||p.id;$('#large-photo').src=src;$('#photo-dialog').showModal();
 });
}
function logisticsOverview(data){
 return `<div class="logistics-overview">${Object.entries(M.sections).map(([section,fields])=>`<section><h4>${t(section)}</h4><dl>${fields.map(f=>{const raw=data[section]?.[f],value=M.count(raw);return `<div><dt>${esc(t(f))}</dt><dd>${raw==null||raw===''?'—':esc(value===''?String(raw):value.toLocaleString(lang==='cs'?'cs-CZ':'en-GB',{maximumFractionDigits:6}))}</dd></div>`;}).join('')}</dl></section>`).join('')}</div>`;
}
function openKeyExport(entry){
 const d=$('#single-key-export-dialog');$('#single-key-export-title').textContent=t('exportNow');$('#single-key-export-question').textContent=t('includeProductsQuestion');
 $('#single-key-export-no').textContent=t('no');$('#single-key-export-yes').textContent=t('yes');
 let downloading=false;
 const close=()=>{if(!downloading)d.close();};$('#single-key-export-close').onclick=close;d.oncancel=e=>{e.preventDefault();close();};
 for(const [id,include] of [['single-key-export-no',false],['single-key-export-yes',true]])$('#'+id).onclick=async()=>{
  if(downloading)return;downloading=true;$$('#single-key-export-dialog button').forEach(b=>b.disabled=true);
  try{await exportLogistics([entry],include);d.close();}catch(e){error(e);}finally{downloading=false;$$('#single-key-export-dialog button').forEach(b=>b.disabled=false);}
 };
 d.showModal();
}
const labelLanguageCodes=['cs','en','sk','de','pl','hu','fr','it','es','ro','bg','uk','ru','ar','vi'];
const allLabelLanguageCodes='aa ab ae af ak am an ar as av ay az ba be bg bh bi bm bn bo br bs ca ce ch co cr cs cu cv cy da de dv dz ee el en eo es et eu fa ff fi fj fo fr fy ga gd gl gn gu gv ha he hi ho hr ht hu hy hz ia id ie ig ii ik io is it iu ja jv ka kg ki kj kk kl km kn ko kr ks ku kv kw ky la lb lg li ln lo lt lu lv mg mh mi mk ml mn mr ms mt my na nb nd ne ng nl nn no nr nv ny oc oj om or os pa pi pl ps pt qu rm rn ro ru rw sa sc sd se sg si sk sl sm sn so sq sr ss st su sv sw ta te tg th ti tk tl tn to tr ts tt tw ty ug uk ur uz ve vi vo wa wo xh yi yo za zh zu'.split(' ');
const languageCodeText=codes=>codes.map(code=>String(code).toUpperCase()).join(', ');
function chooseLabelLanguages(current){
 const d=$('#label-languages-dialog'),names=new Intl.DisplayNames([lang],{type:'language'}),chosen=new Set(current.map(code=>String(code).toLowerCase()));
 const displayName=code=>{try{return names.of(code);}catch{return code;}};
 const codes=[...new Set([...allLabelLanguageCodes,...chosen])];
 d.innerHTML=`<form id="label-languages-form"><div class="language-dialog-heading"><h2 id="label-languages-title">${t('labelLanguages')}</h2><button type="button" class="close-button" id="label-languages-close" aria-label="${esc(t('cancel'))}">×</button></div><input id="label-language-search" type="search" placeholder="${esc(t('searchLanguage'))}" aria-label="${esc(t('searchLanguage'))}"><div class="label-language-grid" id="label-language-choices"></div><div class="dialog-actions"><button type="button" id="label-languages-cancel">${t('cancel')}</button><button type="submit" class="primary">${t('apply')}</button></div></form>`;
 const render=()=>{const query=M.fold($('#label-language-search').value).trim(),visible=query?codes.filter(code=>M.fold(displayName(code)).includes(query)||code===query).sort((a,b)=>displayName(a).localeCompare(displayName(b),lang)):[...new Set([...labelLanguageCodes,...chosen])];
  $('#label-language-choices').innerHTML=visible.map(code=>`<label class="checkbox-label"><input type="checkbox" data-label-language="${esc(code)}" ${chosen.has(code)?'checked':''}><span>${esc(displayName(code))}</span></label>`).join('')||`<p class="muted">${t('empty')}</p>`;
  $$('[data-label-language]').forEach(input=>input.onchange=()=>{if(input.checked)chosen.add(input.dataset.labelLanguage);else chosen.delete(input.dataset.labelLanguage);});
 };
 render();$('#label-language-search').oninput=render;d.showModal();
 return new Promise(resolve=>{
  const finish=value=>{d.close();d.replaceChildren();d.oncancel=null;d.onkeydown=null;resolve(value);};
  const apply=()=>{const unchanged=chosen.size===current.length&&current.every(code=>chosen.has(String(code).toLowerCase()));finish(unchanged?M.clone(current):[...current.filter(code=>chosen.has(String(code).toLowerCase())),...[...chosen].filter(code=>!current.some(old=>String(old).toLowerCase()===code))]);};
  $('#label-languages-close').onclick=()=>finish(null);$('#label-languages-cancel').onclick=()=>finish(null);$('#label-languages-form').onsubmit=e=>{e.preventDefault();apply();};
  d.oncancel=e=>{e.preventDefault();finish(null);};d.onkeydown=e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'){e.preventDefault();e.stopPropagation();apply();}};
 });
}
function labelSource(asset){const path=M.labelPath(asset);return path?(state.labelFiles[path]||`${state.imageBase.replace(/\/$/,'')}/labels/${path.split('/').pop()}`):'';}
function productInfoSections(p,isNew=false){
 const available=typeof p.inci==='string'&&!!p.inci.trim()&&!['not-applicable','pending'].includes(p.inciStatus),status=p.inciStatus==='not-applicable'?'not-applicable':available?'provided':'pending';
 const languages=Array.isArray(p.labelLanguages)?p.labelLanguages:[];
 const labelCard=(slot,title)=>`<article class="label-card" data-label-slot="${slot}"><div class="label-card-heading"><h4>${t(title)}</h4></div><div class="label-placeholder" data-label-preview="${slot}" tabindex="0" role="button" aria-label="${esc(t('uploadLabel')+' — '+t(title))}"></div><p class="label-file-name" data-label-name="${slot}"></p><input type="file" id="label-input-${slot}" accept="image/jpeg,image/png,image/webp,application/pdf,.jpg,.jpeg,.png,.webp,.pdf" hidden><div class="label-card-actions"><button type="button" data-label-upload="${slot}">${t('uploadLabel')}</button><button type="button" data-label-view="${slot}">${t('viewLabel')}</button><button type="button" data-label-download="${slot}">${t('downloadLabel')}</button><button type="button" class="danger-quiet" data-label-remove="${slot}">${t('removeLabel')}</button></div></article>`;
 return `<section id="section-inci" class="tab-section" role="tabpanel" aria-labelledby="tab-inci"><div class="section-intro"><h3>${t('inci')}</h3><select id="inci-status" name="inciStatus" aria-label="${esc(t('status'))}">${['provided','pending','not-applicable'].map(v=>option(v,v==='provided'?t('filled'):v==='pending'?'TBD':'N/A',status)).join('')}</select></div><textarea id="inci-text" name="inci" rows="8" aria-label="INCI" placeholder="TBD" ${status==='not-applicable'?'disabled':''}>${esc(p.inci||'')}</textarea><div class="info-actions"><button id="copy-inci" type="button" ${available?'':'disabled'}>${t('copyInci')}</button></div></section>
 <section id="section-labelLanguages" class="tab-section" role="tabpanel" aria-labelledby="tab-labelLanguages"><div class="section-intro"><h3>${t('labelLanguages')}</h3></div><p id="label-language-codes" class="language-codes">${languages.length?esc(languageCodeText(languages)):'TBD'}</p><div class="info-actions language-actions">${button('copy-label-languages','copyLanguages')}${button('edit-label-languages',isNew?'chooseLanguages':'edit')}</div></section>
 <section id="section-labels" class="tab-section" role="tabpanel" aria-labelledby="tab-labels"><div class="section-intro"><h3>${t('labels')}</h3></div><div class="label-grid split" id="product-label-grid">${labelCard('front','frontLabel')}${labelCard('back','backLabel')}</div><p class="muted label-file-hint">${t('labelFileHint')}</p></section>`;
}
function openProduct(index=null,tab='details',duplicate=false){
 if(!canEdit())return;
 const original=index!==null?M.clone(state.products[index]):null;
 const p=original?M.clone(original):{brand:filters.brand||'',type:'',id:'',hs:'',name:'',csName:'',volume:{number:'',unit:'ml'},price:'',key:null,new:false,new_date:'',discontinued:false,discontinued_date:'',carton_ean:null};
 if(duplicate)p.id='';
 let selectedPhoto=duplicate&&original?state.photos[original.id]||null:null,photoExists=false;
 const title=duplicate?t('duplicate'):original?(lang==='cs'?p.csName||p.name:p.name)||t('edit'):t('addProduct');
 openEditor(title,original&&!duplicate?`${p.brand} / ${p.id}`:t('product'),`<form id="product-form" novalidate><div class="editor-tabs" role="tablist" aria-label="${esc(t('product'))}">${['details','packaging','inci','labelLanguages','labels','photo','flags'].map(v=>`<button type="button" role="tab" id="tab-${v}" aria-controls="section-${v}" data-tab="${v}" aria-selected="${v===tab}">${t(v)}</button>`).join('')}</div>
 <div class="form-content"><div id="form-error" class="notice error-notice" role="alert" hidden></div>
 <section id="section-details" class="tab-section" role="tabpanel" aria-labelledby="tab-details"><div class="section-intro"><h3>${t('details')}</h3></div><div class="form-grid">${field('brand','brand',p.brand,'text','list="brands" required')}${field('type','type',p.type,'text','list="types"')}${field('id','ean',p.id,'text','required inputmode="numeric"',t('required'))}${field('hs','hs',p.hs,'text','inputmode="numeric"')}${field('name','name',p.name)}${field('csName','csName',p.csName)}<label class="field"><span>${t('volume')}</span><div class="input-group"><input name="volume-number" type="text" inputmode="decimal" value="${esc(p.volume?.number??'')}"><input name="volume-unit" list="units" value="${esc(p.volume?.unit??'')}" aria-label="${lang==='cs'?'Jednotka':'Unit'}"></div></label>${field('price','price',p.price,'number','min="0" step="any"')}</div>${datalist('brands',brands())}${datalist('types',[...new Set([...types(),...state.products.map(p=>p.type)])].filter(Boolean))}${datalist('units',['ml','g','pc','l','kg'])}<p class="notice" id="draft-warning" hidden>${t('draftWarning')}</p></section>
 <section id="section-packaging" class="tab-section" role="tabpanel" aria-labelledby="tab-packaging"><div class="section-intro"><h3>${t('packaging')}</h3></div><div class="form-grid"><label class="field"><span>${t('key')}</span><select name="key" id="product-key"></select></label>${field('carton_ean','carton_ean',p.carton_ean)}</div><p class="muted" id="key-summary"></p><section class="product-logistics"><div class="section-intro"><h3>${t('keyData')}</h3><div class="key-detail-actions">${button('product-key-open','editKey')}${button('product-key-export','exportNow')}</div></div><div id="product-key-data"></div></section></section>
 <section id="section-flags" class="tab-section" role="tabpanel" aria-labelledby="tab-flags"><h3>${t('flags')}</h3>${['new','discontinued'].map(v=>`<div class="flag-card"><label class="checkbox-label"><input type="checkbox" name="${v}" ${p[v]===true?'checked':''}>${t(v)}</label>${field(v+'_date',v+'_date',p[v+'_date'],'date')}</div>`).join('')}<div class="form-grid">${field('flags','customFlags',(p.flags||[]).join(', '),'text','',t('flagsHint'))}</div></section>
 <section id="section-photo" class="tab-section" role="tabpanel" aria-labelledby="tab-photo"><h3>${t('photo')}</h3><div class="photo-layout"><button type="button" class="photo-drop" id="photo-drop"><img id="photo-preview" alt="${esc(t('photo'))}" hidden><span id="photo-placeholder">+<small>${t('choosePhoto')}</small></span></button><div><p>${t(sandbox?'sandboxPhotoHint':'photoHint')}</p><input type="file" accept="image/jpeg,image/png,image/webp" id="photo-input" hidden>${button('photo-choose','choosePhoto')}${button('photo-download','downloadPhoto')}${button('photo-view','viewPhoto')}<p class="muted">${state.pendingPhotos.includes(p.id)?t('photoPending'):''}</p></div></div></section>
 ${productInfoSections(p,!original||duplicate)}</div>${formFooter()}</form>`);
 const form=$('#product-form'),elements=form.elements,selectedLabels={},labelReads=new Set(),labelReadRevisions={front:0,back:0};
 const originalInfo={inci:$('#inci-text').value,status:$('#inci-status').value,languages:Array.isArray(p.labelLanguages)?M.clone(p.labelLanguages):[]};
 let languageDraft=M.clone(originalInfo.languages);
 const updateInci=()=>{$('#inci-text').disabled=$('#inci-status').value==='not-applicable';$('#inci-text').placeholder=$('#inci-status').value==='not-applicable'?'N/A':'TBD';$('#copy-inci').disabled=$('#inci-status').value!=='provided'||!$('#inci-text').value.trim();};
 $('#inci-text').addEventListener('input',()=>{$('#inci-status').value=$('#inci-text').value.trim()?'provided':'pending';updateInci();});$('#inci-status').onchange=updateInci;updateInci();
 $('#copy-inci').onclick=async()=>{try{await navigator.clipboard.writeText($('#inci-text').value);toast(t('inciCopied'));}catch(e){error(e);}};
 const updateLanguages=()=>{$('#label-language-codes').textContent=languageDraft.length?languageCodeText(languageDraft):'TBD';$('#copy-label-languages').disabled=!languageDraft.length;};
 $('#copy-label-languages').onclick=async()=>{try{await navigator.clipboard.writeText(languageCodeText(languageDraft));toast(t('languagesCopied'));}catch(e){error(e);}};
 $('#edit-label-languages').onclick=async()=>{const result=await chooseLabelLanguages(languageDraft);if(result!==null&&JSON.stringify(result)!==JSON.stringify(languageDraft)){languageDraft=result;editorDirty=true;updateLanguages();}};updateLanguages();
 function currentLabel(slot){return Object.hasOwn(selectedLabels,slot)?selectedLabels[slot]:p.labels?.[slot];}
 function labelUrl(slot){const asset=currentLabel(slot);return asset?.dataUrl||labelSource(asset);}
 function renderLabel(slot){
  const asset=currentLabel(slot),src=labelUrl(slot),card=form.querySelector(`[data-label-slot="${slot}"]`),preview=card.querySelector('[data-label-preview]');
  const pdf=asset?.mimeType==='application/pdf'||M.labelPath(asset)?.endsWith('.pdf');
  card.classList.toggle('not-applicable',slot==='back'&&!src);
  preview.innerHTML=src?(pdf?'<strong class="label-state">PDF</strong>':`<img src="${esc(src)}" alt="${esc(t(slot==='front'?'frontLabel':'backLabel'))}">`):`<strong class="label-state">${slot==='back'?'N/A':'TBD'}</strong>`;
  card.querySelector('[data-label-name]').textContent=src?(asset?.name||M.labelPath(asset)?.split('/').pop()||''):'';
  for(const action of ['view','download'])card.querySelector(`[data-label-${action}]`).disabled=!src;
  card.querySelector('[data-label-view]').textContent=t(pdf?'openLabelPdf':'viewLabel');
  card.querySelector('[data-label-remove]').disabled=!asset;
  card.querySelector('[data-label-upload]').textContent=t(src?'replaceLabel':'uploadLabel');
  const img=preview.querySelector('img');if(img)img.onerror=()=>{preview.innerHTML=`<strong class="label-state">${esc(t('labelUnavailable'))}</strong>`;};
 }
 async function selectLabel(slot,file){
  if(busy)return;
  const input=form.querySelector('#label-input-'+slot),revision=++labelReadRevisions[slot],load=S.label(file);labelReads.add(load);input.disabled=true;
  try{const asset=await load;if(!form.isConnected||labelReadRevisions[slot]!==revision)return;selectedLabels[slot]=asset;editorDirty=true;renderLabel(slot);}catch(e){if(form.isConnected&&labelReadRevisions[slot]===revision)error(e);}finally{labelReads.delete(load);if(labelReadRevisions[slot]===revision){input.disabled=false;input.value='';}}
 }
 for(const slot of ['front','back']){
  const card=form.querySelector(`[data-label-slot="${slot}"]`),input=card.querySelector('input[type=file]'),preview=card.querySelector('[data-label-preview]');
  card.querySelector('[data-label-upload]').onclick=()=>input.click();
  input.onchange=()=>{if(input.files[0])void selectLabel(slot,input.files[0]);};
  preview.onclick=()=>input.click();preview.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();input.click();}};
  preview.ondragover=e=>{e.preventDefault();preview.classList.add('dragover');};preview.ondragleave=()=>preview.classList.remove('dragover');preview.ondrop=e=>{e.preventDefault();preview.classList.remove('dragover');if(e.dataTransfer.files[0])void selectLabel(slot,e.dataTransfer.files[0]);};
  card.querySelector('[data-label-remove]').onclick=()=>{labelReadRevisions[slot]++;input.disabled=false;input.value='';selectedLabels[slot]=null;editorDirty=true;renderLabel(slot);};
  card.querySelector('[data-label-view]').onclick=async()=>{
   try{const src=labelUrl(slot),asset=currentLabel(slot);if(!src)return;
    if(asset?.mimeType==='application/pdf'||M.labelPath(asset)?.endsWith('.pdf')){
     if(src.startsWith('data:')){const bytes=Uint8Array.from(atob(src.split(',')[1]),c=>c.charCodeAt(0)),url=URL.createObjectURL(new Blob([bytes],{type:'application/pdf'}));window.open(url,'_blank','noopener');setTimeout(()=>URL.revokeObjectURL(url),60000);}else window.open(src,'_blank','noopener');
    }else{$('#large-photo').src=src;$('#photo-dialog').showModal();}
   }catch(e){error(e);}
  };
  card.querySelector('[data-label-download]').onclick=async()=>{try{const src=labelUrl(slot),asset=currentLabel(slot),filename=asset?.name||M.labelPath(asset)?.split('/').pop()||'label';if(src.startsWith('data:'))downloadData(src,filename);else{const r=await fetch(src);if(!r.ok)throw Error('HTTP '+r.status);downloadBlob(await r.blob(),filename);}}catch(e){error(e);}};
  renderLabel(slot);
 }
 const showTab=v=>{$$('[data-tab]').forEach(b=>{b.setAttribute('aria-selected',b.dataset.tab===v);b.tabIndex=b.dataset.tab===v?0:-1;});$$('.tab-section').forEach(s=>{s.hidden=s.id!==`section-${v}`;});};
 $$('[data-tab]').forEach((b,i,list)=>{b.onclick=()=>showTab(b.dataset.tab);b.onkeydown=e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();const n=e.key==='Home'?0:e.key==='End'?list.length-1:(i+(e.key==='ArrowRight'?1:-1)+list.length)%list.length;showTab(list[n].dataset.tab);list[n].focus();}};});showTab(tab);
 function keysForBrand(overwrite=false){const b=elements.brand.value,k=overwrite?'':elements.key.value||p.key;const keys=M.keyEntries(state.logistics,{status:'active'}).filter(r=>r.brand===b).map(r=>r.key),assigned=!duplicate&&p.brand===b&&state.logistics[b]?.[M.key(k)];$('#product-key').innerHTML=option('','—',k)+keys.map(v=>option(v,v,k)).join('')+(M.key(k)&&!keys.includes(String(k))&&(!state.logistics[b]?.[M.key(k)]||assigned)?option(k,`${k} · ${t(assigned?'inactive':'keyUnknown')}`,k):'');if(overwrite){elements.key.value='';}updatePackaging();}
 function updatePackaging(){const l=state.logistics[elements.brand.value]?.[M.key(elements.key.value)];$('#key-summary').textContent=l?`${elements.brand.value} / ${elements.key.value} · ${state.products.filter(x=>x.brand===elements.brand.value&&M.key(x.key)===elements.key.value).length} ${t('countProducts')}${M.keyIsActive(l)?'':' · '+t('inactive')}`:t('keyMissing');$('#product-key-data').innerHTML=l?logisticsOverview(l):`<p class="muted">${t('keyMissing')}</p>`;$('#product-key-open').disabled=!l;$('#product-key-export').disabled=!l;}
 keysForBrand();elements.brand.onchange=()=>keysForBrand(true);elements.key.onchange=()=>updatePackaging();
 function currentKeyEntry(){const brand=elements.brand.value,key=M.key(elements.key.value);return {brand,key,data:M.clone(state.logistics[brand][key])};}
 $('#product-key-open').onclick=async()=>{
  if(busy)return;await Promise.allSettled([...labelReads]);if($('#product-form')!==form)return;const entry=currentKeyEntry(),d=$('#editor'),body=$('#editor-body');
  const origin={view,page,filters:{...filters},selected:new Set(selected),title:$('#editor-title').textContent,caption:$('#editor-caption').textContent,small:d.classList.contains('small'),scroll:d.scrollTop,dirty:editorDirty,save:editorSave};
  const draft=document.createDocumentFragment();while(body.firstChild)draft.append(body.firstChild);
  d.close();editorDirty=false;editorSave=null;changeView('keys');filters.brand=entry.brand;filters.search=entry.key;filters.keyStatus=M.keyIsActive(entry.data)?'active':'inactive';renderToolbar();renderContent();
  const back=result=>{
   view=origin.view;page=origin.page;filters=origin.filters;selected=origin.selected;location.hash=view;render();
   $('#editor-title').textContent=origin.title;$('#editor-caption').textContent=origin.caption;body.replaceChildren(draft);d.classList.toggle('small',origin.small);editorDirty=origin.dirty;editorSave=origin.save;editorReturn=null;
   if(result?.brand===entry.brand&&result?.oldKey===entry.key&&result.key!==entry.key){elements.key.insertAdjacentHTML('beforeend',option(result.key,result.key,result.key));elements.key.value=result.key;}
   keysForBrand();d.showModal();d.scrollTop=origin.scroll;$('#product-key-open').focus();
  };
  back.dirty=origin.dirty;openKey(entry.brand,entry.key,null,back);
 };$('#product-key-export').onclick=()=>openKeyExport(currentKeyEntry());
 for(const v of ['new','discontinued'])elements[v].onchange=()=>{elements[v+'_date'].value=elements[v].checked?(elements[v+'_date'].value||today()):'';};
 const warn=()=>{$('#draft-warning').hidden=!!elements.brand.value&&!!elements.name.value&&!!elements.csName.value&&M.eanValid(elements.id.value);};['id','brand','name','csName'].forEach(f=>elements[f].addEventListener('input',warn));warn();
 function preview(src){const img=$('#photo-preview');photoExists=false;img.hidden=true;$('#photo-placeholder').hidden=false;$('#photo-download').disabled=true;$('#photo-view').disabled=true;if(src){img.onload=()=>{photoExists=true;img.hidden=false;$('#photo-placeholder').hidden=true;$('#photo-download').disabled=false;$('#photo-view').disabled=false;};img.onerror=()=>{photoExists=false;img.hidden=true;$('#photo-placeholder').hidden=false;};img.src=src;}else img.removeAttribute('src');}
 preview(selectedPhoto||(!duplicate?productPhoto(p):original?productPhoto(original):''));
 async function selectPhoto(file){try{selectedPhoto=await S.jpeg(file);preview(selectedPhoto);editorDirty=true;}catch(e){error(e);}}
 $('#photo-choose').onclick=()=>$('#photo-input').click();$('#photo-drop').onclick=()=>$('#photo-input').click();$('#photo-input').onchange=e=>{if(e.target.files[0])void selectPhoto(e.target.files[0]);};$('#photo-drop').ondragover=e=>{e.preventDefault();e.currentTarget.classList.add('dragover');};$('#photo-drop').ondragleave=e=>e.currentTarget.classList.remove('dragover');$('#photo-drop').ondrop=e=>{e.preventDefault();e.currentTarget.classList.remove('dragover');if(e.dataTransfer.files[0])void selectPhoto(e.dataTransfer.files[0]);};
 $('#photo-view').onclick=()=>{if(!photoExists)return;$('#large-photo').src=$('#photo-preview').src;$('#photo-dialog').showModal();};$('#photo-download').onclick=async()=>{try{const src=$('#photo-preview').src;if(src.startsWith('data:'))downloadData(src,`${p.id||'photo'}.jpg`);else{const r=await fetch(src);if(!r.ok)throw Error('HTTP '+r.status);downloadBlob(await r.blob(),`${p.id||'photo'}.jpg`);}}catch(e){error(e);}};
 function preserve(name,old,value){return String(old??'')===String(value??'')?old:value;}
 editorSave=()=>runForm(async()=>{
  const notice=$('#form-error');notice.hidden=true;
  await Promise.allSettled([...labelReads]);
  if(!editorDirty&&!selectedPhoto&&original&&!duplicate){formClose();return;}
  try{
   const str=n=>elements[n].value.trim(),num=n=>str(n)===''?'':Number(str(n));
   const price=num('price');if(price!==''&&(!Number.isFinite(price)||price<0))throw Error('numeric');
   const id=str('id');if(!id)throw Error('EAN_REQUIRED');if(!str('brand'))throw Error('KEY_REQUIRED');
   const patch={brand:str('brand'),type:str('type'),id,hs:str('hs'),name:str('name'),csName:str('csName'),volume:{...(p.volume||{}),number:preserve('volume',p.volume?.number,str('volume-number')),unit:str('volume-unit')},price:preserve('price',p.price,num('price')),key:preserve('key',p.key,str('key')||null),carton_ean:preserve('carton_ean',p.carton_ean,str('carton_ean')||null)};
   if($('#inci-text').value!==originalInfo.inci||$('#inci-status').value!==originalInfo.status){
    const status=$('#inci-status').value;patch.inci=status==='provided'?$('#inci-text').value:'';patch.inciStatus=status==='provided'&&patch.inci.trim()?'provided':status==='not-applicable'?'not-applicable':'pending';patch.inciSource={type:'manual',updatedAt:new Date().toISOString()};
   }
   const languages=languageDraft;if(JSON.stringify(languages)!==JSON.stringify(originalInfo.languages)){
    if(languages.some(code=>!/^[a-zA-Z]{2,3}(?:-[a-zA-Z0-9]{2,8})*$/.test(code)))throw Error('LABEL_LANGUAGES');patch.labelLanguages=languages;
   }
   const files={};if(Object.keys(selectedLabels).length){
    patch.labels=p.labels&&typeof p.labels==='object'&&!Array.isArray(p.labels)?M.clone(p.labels):{};
    for(const [slot,asset] of Object.entries(selectedLabels)){
     if(!asset){patch.labels[slot]=null;continue;}
     const path=S.labelPath(id,slot,asset.extension);files[path]=asset.dataUrl;
     patch.labels[slot]={...(p.labels?.[slot]&&typeof p.labels[slot]==='object'?p.labels[slot]:{}),path,name:asset.name,mimeType:asset.mimeType,size:asset.size,uploadedAt:new Date().toISOString()};
    }
   }
   for(const v of ['new','discontinued']){const checked=elements[v].checked,flagChanged=(p[v]===true)!==checked;patch[v]=flagChanged?checked:p[v];patch[v+'_date']=flagChanged?(checked?(str(v+'_date')||today()):''):preserve(v+'_date',p[v+'_date'],str(v+'_date'));}
   const flagList=[...new Set(str('flags').split(',').map(s=>s.trim()).filter(Boolean))];if(p.flags!==undefined||flagList.length)patch.flags=flagList;
   const target=duplicate?null:index;const record=M.saveProduct(duplicate?p:original,patch,state.products,target,state.logistics);
   // If an EAN changes (or a product is copied), retain its visible photo at the new filename.
   if(!selectedPhoto&&photoExists&&(duplicate||original&&id!==String(original.id))){const r=await fetch($('#photo-preview').src);if(!r.ok)throw Error('HTTP '+r.status);selectedPhoto=await S.jpeg(new File([await r.blob()],'photo.jpg',{type:'image/jpeg'}));}
   const next=M.clone(state);if(target!==null)next.products[target]=record;else next.products.push(record);
   Object.assign(next.labelFiles,files);next.pendingLabels=[...new Set([...next.pendingLabels,...Object.keys(files)])];
   if(selectedPhoto){next.photos[id]=selectedPhoto;if(!next.pendingPhotos.includes(id))next.pendingPhotos.push(id);}
   await commit(next);formClose();
  }catch(e){notice.textContent=t(e.message);notice.hidden=false;showTab('details');notice.scrollIntoView({block:'nearest'});}
 });
 form.onsubmit=e=>{e.preventDefault();void editorSave();};attachCancel();
}
function productActions(index){if(!canEdit())return;const p=state.products[index];openEditor(lang==='cs'?p.csName||p.name:p.name,`${p.brand} / ${p.id}`,`<div class="action-menu">${button('action-edit','edit')}${button('action-copy','duplicate')}${button('action-delete','delete','danger-quiet')}</div>`,true);$('#action-edit').onclick=()=>openProduct(index);$('#action-copy').onclick=()=>openProduct(index,'details',true);$('#action-delete').onclick=async()=>{if(await confirm('deleteProduct',`${p.name||p.csName} (${p.id})\n\n${t('deleteProductHint')}`,'confirmDelete',true)){const next=M.clone(state);next.products.splice(index,1);await commit(next);formClose();}};}
function openBulk(){
 if(!canEdit())return;const chosen=[...selected];openEditor(t('bulk'),`${chosen.length} ${t('selected')}`,`<form id="bulk-form"><div class="form-content"><p>${t('bulkHint')}</p><label class="field"><span>${t('operation')}</span><select name="operation">${['setNew','clearNew','setDisc','clearDisc','addFlag','removeFlag'].map(v=>option(v,t(v),'')).join('')}</select></label>${field('flag','flag','','text','list="flag-list"')}${datalist('flag-list',flags())}<div id="form-error" class="notice error-notice" hidden></div></div>${formFooter('apply')}</form>`,true);
 const form=$('#bulk-form');form.elements.flag.closest('label').hidden=true;form.elements.operation.onchange=()=>form.elements.flag.closest('label').hidden=!['addFlag','removeFlag'].includes(form.elements.operation.value);
 editorSave=()=>runForm(async()=>{const op=form.elements.operation.value,f=form.elements.flag.value.trim();if(['addFlag','removeFlag'].includes(op)&&(!f||f.includes(','))){$('#form-error').textContent=t('checkFirst');$('#form-error').hidden=false;return;}
 const next=M.clone(state);for(const i of chosen){const p=next.products[i];if(op==='setNew'){p.new=true;p.new_date=p.new_date||today();}if(op==='clearNew'){p.new=false;p.new_date='';}if(op==='setDisc'){p.discontinued=true;p.discontinued_date=p.discontinued_date||today();}if(op==='clearDisc'){p.discontinued=false;p.discontinued_date='';}if(op==='addFlag')p.flags=[...new Set([...(p.flags||[]),f])];if(op==='removeFlag')p.flags=(p.flags||[]).filter(x=>x!==f);}
 await commit(next);formClose();});form.onsubmit=e=>{e.preventDefault();void editorSave();};attachCancel();
}
function openKey(brand='',oldKey=null,template=null,returnToProduct=null){
 if(!canEdit())return;
 let original=oldKey?M.clone(state.logistics[brand]?.[oldKey]||M.emptyLogistics()):M.clone(template||M.emptyLogistics());if(!oldKey)delete original.active;let working=M.clone(original);
 const copySources=M.keyEntries(state.logistics,{status:'active'});
 const used=oldKey?state.products.filter(p=>p.brand===brand&&M.key(p.key)===oldKey).length:0;
 openEditor(oldKey?`${brand} / ${oldKey}`:t('addKey'),t('keys'),`<form id="key-form" novalidate><div class="form-content">${returnToProduct?`<div class="editor-return">${button('key-back','backToProduct')}</div>`:''}<div class="notice ${used?'amber':''}">${used?`${t('sharedWarning')} ${t('affected')}: ${used}.`:t('keyHelp')}</div><div id="form-error" class="notice error-notice" hidden></div><div class="form-grid key-identity">${field('brand','brand',brand||filters.brand,'text',`required list="brands" ${oldKey?'readonly':''}`)}${field('key','keyName',oldKey||'','text','required',t('keyRename'))}<label class="field"><span>${t('status')}</span><select id="key-status" name="active">${[true,false].map(v=>option(v,t(v?'active':'inactive'),M.keyIsActive(original))).join('')}</select><small>${t('keyStatusHint')}</small></label>${oldKey?'':`<label class="field"><span>${t('copyFrom')}</span><select id="copy-key">${option('',t('blankKey'),'')}${copySources.map((r,i)=>option(i,`${r.brand} / ${r.key}`,'')).join('')}</select></label>`}</div>${datalist('brands',brands())}<p class="muted">${t('dimensionHint')}</p><div class="logistics-grid" id="logistics-fields"></div>${oldKey?`<div class="key-secondary-actions">${button('key-copy','duplicate')}${button('key-delete','delete','danger-quiet')}</div>`:''}</div>${formFooter('save',used?`${used} ${t('countProducts')}`:'')}</form>`);
 const form=$('#key-form');editorReturn=returnToProduct;if(returnToProduct)$('#key-back').onclick=closeEditor;
 function renderFields(){
  $('#logistics-fields').innerHTML=Object.entries(M.sections).map(([s,fs])=>{const fields=[...new Set([...fs,...Object.keys(working[s]||{})])].filter(f=>f!=='carton_ean');return `<fieldset><legend>${t(s)}</legend>${fields.map((f,i)=>field(`${s}:${f}`,f,working[s]?.[f],'text',`data-section="${s}" data-field="${esc(f)}" inputmode="decimal"`)).join('')}</fieldset>`;}).join('');
 }
 renderFields();if($('#copy-key'))$('#copy-key').onchange=e=>{working=e.target.value===''?M.emptyLogistics():M.clone(copySources[Number(e.target.value)].data);renderFields();};
 if(oldKey){$('#key-delete').disabled=used>0;$('#key-delete').title=used?t('keyInUse'):'';$('#key-delete').onclick=async()=>{if(await confirm('deleteKey',t('deleteKeyHint'),'delete',true)){const next=M.clone(state);delete next.logistics[brand][oldKey];await commit(next);formClose();}};
 $('#key-copy').onclick=()=>{formClose(undefined,false);openKey(brand,null,original,returnToProduct);editorDirty=true;};}
 editorSave=()=>runForm(async()=>{
  const notice=$('#form-error');notice.hidden=true;
  try{
   const b=form.elements.brand.value.trim(),k=M.key(form.elements.key.value);if(!M.key(b)||!k)throw Error('KEY_REQUIRED');
   if((!oldKey||k!==oldKey)&&Object.hasOwn(state.logistics[b]||{},k))throw Error('KEY_DUPLICATE');
   const data=M.clone(working),active=form.elements.active.value==='true';if(M.keyIsActive(data)!==active)data.active=active;
   $$('[data-section]').forEach(input=>{const s=input.dataset.section,f=input.dataset.field,raw=input.value.trim(),old=data[s]?.[f];if(!data[s])data[s]={};
    if(String(old??'')===raw)return;
    if(M.sections[s].includes(f)&&raw){const m=raw.replace(',','.').match(/^\s*(\d+(?:\.\d+)?)\s*(cm|kg)?\s*$/i);if(!m||f.startsWith('nr_')&&(m[2]||!Number.isInteger(Number(m[1]))))throw Error('numeric');if(['length','width','height'].includes(f)&&m[2]&&m[2].toLowerCase()!=='cm'||f==='weight'&&m[2]&&m[2].toLowerCase()!=='kg')throw Error('numeric');}
    data[s][f]=raw===''?null:/^\d+(?:[.,]\d+)?$/.test(raw)?Number(raw.replace(',','.')):raw;
   });
   if(oldKey&&k===oldKey&&b===brand&&sig(data)===sig(original)){formClose();return;}
   if(used&&(sig(data)!==sig(original)||k!==oldKey)&&!await confirm('confirmShared',`${b} / ${k}\n${t('affected')}: ${used}\n\n${t('confirmSharedHint')}`,'save'))return;
   let next=M.clone(state);if(oldKey&&k!==oldKey)next=M.renameKey(next,b,oldKey,k);next=M.applyLogistics(next,b,k,data);await commit(next);formClose({brand:b,oldKey,key:k});
  }catch(e){notice.textContent=t(e.message);notice.hidden=false;notice.scrollIntoView({block:'nearest'});}
 });form.onsubmit=e=>{e.preventDefault();void editorSave();};attachCancel();
}
function downloadBlob(blob,name){const url=URL.createObjectURL(blob);downloadData(url,name);setTimeout(()=>URL.revokeObjectURL(url),1000);}
function downloadData(url,name){const a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();}
function downloadJSON(value,name){downloadBlob(new Blob([JSON.stringify(value,null,2)+'\n'],{type:'application/json;charset=utf-8'}),name);}
function backup(){downloadJSON({format:'jason-backup',version:1,createdAt:new Date().toISOString(),products:state.products,logistics:state.logistics,photos:state.photos,pendingPhotos:state.pendingPhotos,labelFiles:state.labelFiles,pendingLabels:state.pendingLabels},`jason-backup-${today()}.json`);}
function openData(){
 openEditor(t(sandbox?'sandboxData':'dataTitle'),'JASON / DATA',`<div class="form-content data-content"><p>${t(sandbox?'sandboxNote':'dataHint')}</p>${JASON_CONFIG.sharedOnly?'<p class="notice amber">'+t('sharedOnly')+'</p>':''}<section class="data-section"><h3>${t('import')}</h3><div class="button-grid">${button('import-products','importProducts')}${button('import-logistics','importLogistics')}${button('restore-backup','restore')}${button('download-backup','backup','primary')}</div><div class="button-grid">${button('download-products','jsonProducts')}${button('download-logistics','jsonLogistics')}</div></section>${sandbox?'<section class="data-section"><h3>'+t('sandboxResetTitle')+'</h3><p>'+t('sandboxResetHint')+'</p>'+button('reset-sandbox','sandboxReset')+'</section>':`<section class="data-section"><h3>${t('connection')}</h3><p class="muted">${t('connectHint')}</p><div class="form-grid">${field('api','api',state.api,'url')}${field('images','images',state.imageBase,'url')}</div><div class="connection-actions">${button('connect','connect','primary')}${button('disconnect','disconnect')}<span>${t(state.connected?'connected':'local')}</span></div></section>`}</div>`,true);
 $('#import-products').onclick=()=>importFile('products');$('#import-logistics').onclick=()=>importFile('logistics');$('#restore-backup').onclick=()=>importFile('backup');$('#download-backup').onclick=backup;$('#download-products').onclick=()=>downloadJSON(state.products,'products.json');$('#download-logistics').onclick=()=>downloadJSON(state.logistics,'logistics.json');
 if(sandbox){$('#reset-sandbox').onclick=resetSandbox;return;}
 if(JASON_CONFIG.sharedOnly){$('#field-api').readOnly=true;$('#field-images').readOnly=true;for(const id of ['import-products','import-logistics','restore-backup'])$('#'+id).disabled=!state.connected;}
 $('#connect').onclick=async()=>{const api=JASON_CONFIG.sharedOnly?JASON_CONFIG.apiBase:$('#field-api').value.trim().replace(/\/$/,''),imageBase=JASON_CONFIG.sharedOnly?JASON_CONFIG.imageBase:$('#field-images').value.trim().replace(/\/$/,'');try{for(const url of [api,imageBase]){const u=new URL(url);if(u.protocol!=='https:'&&!(u.protocol==='http:'&&['localhost','127.0.0.1'].includes(u.hostname)))throw Error(lang==='cs'?'Použijte adresu HTTPS.':'Use an HTTPS address.');}if(await confirm('connectConfirm',t('connectConfirmHint'),'connect'))await connect(api,imageBase);}catch(e){error(e);}};
 $('#disconnect').hidden=!!JASON_CONFIG.sharedOnly;$('#disconnect').disabled=!state.connected;$('#disconnect').onclick=async()=>{if(hasPending()&&!await confirm('disconnect',t('unsent'),'disconnect'))return;state.connected=false;await persist();render();openData();};
}
async function connect(api,imageBase,automatic=false){
 if(sandbox||syncing||busy)return;busy=true;renderStatus();try{
  const [p,l]=await Promise.all([S.request(api,'products'),S.request(api,'logistics')]);M.validateProducts(p);M.validateLogistics(l);
  const next={...M.clone(state),products:p,logistics:l,photos:{},pendingPhotos:[],labelFiles:{},pendingLabels:[],api,imageBase,connected:true,baseline:{products:sig(p),logistics:sig(l)}};
  await commit(next,'loaded');formClose();
 }catch(e){if(!automatic)error(e);else toast(t('fileMissing'),true);}finally{busy=false;renderStatus();}
}
let importKind;
function importFile(kind){importKind=kind;$('#import-file').value='';$('#import-file').click();}
$('#import-file').onchange=async e=>{
 const file=e.target.files[0];if(!file)return;
 try{
  if(file.size>100*1024*1024)throw Error(lang==='cs'?'Soubor je příliš velký (max. 100 MB).':'File exceeds 100 MB.');
  const value=JSON.parse(await file.text());let next=M.clone(state);
  if(importKind==='products'){M.validateProducts(value);next.products=value;}
  else if(importKind==='logistics'){M.validateLogistics(value);next.logistics=value;}
  else{
   if(value.format!=='jason-backup'||value.version!==1)throw Error('BACKUP_FORMAT');M.validateProducts(value.products);M.validateLogistics(value.logistics);
   if(value.photos!=null&&(typeof value.photos!=='object'||Array.isArray(value.photos)||Object.entries(value.photos).some(([id,v])=>!id||typeof v!=='string'||!/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(v))))throw Error('BACKUP_FORMAT');
   M.validateLabelFiles(value.labelFiles||{});
   next={...next,products:value.products,logistics:value.logistics,photos:value.photos||{},pendingPhotos:Object.keys(value.photos||{}),labelFiles:value.labelFiles||{},pendingLabels:Object.keys(value.labelFiles||{}),connected:JASON_CONFIG.sharedOnly?state.connected:false,baseline:JASON_CONFIG.sharedOnly?state.baseline:{}};
  }
  const extra=next.connected?'\n\n'+(lang==='cs'?'Po potvrzení se změna odešle také do společných dat.':'After confirmation the change will also be sent to shared data.'):'';
  if(!await confirm('importConfirm',file.name+'\n\n'+t('importConfirmHint')+extra,'confirm'))return;
  await commit(next,'loaded');formClose();
 }catch(err){error(err);}
};
function openExport(){
 openEditor(t('exportTitle'),'JASON / EXCEL',`<form id="export-form"><div class="form-content"><p>${t('exportHint')}</p><div class="editor-tabs"><button type="button" id="export-tab-products">${t('exportProducts')}</button><button type="button" id="export-tab-keys">${t('exportKeys')}</button></div><div id="export-options"></div></div>${formFooter('exportNow')}</form>`,true);
 let mode=view==='keys'?'keys':'products',includeProducts=false,includeEmpty=false,includeInactive=false;
 function options(){
  $('#export-tab-products').setAttribute('aria-selected',mode==='products');$('#export-tab-keys').setAttribute('aria-selected',mode==='keys');
  if(mode==='products')$('#export-options').innerHTML=`<p class="notice">${productExportRows().length} ${t('countProducts')} · ${t(selected.size?'exportSelectedScope':'exportFilteredScope')}</p>`;
  else{$('#export-options').innerHTML=`<label class="field"><span>${t('brand')}</span><select id="export-brand">${option('',t('allBrands'),filters.brand)}${brands().map(v=>option(v,v,filters.brand)).join('')}</select></label><div class="export-options-row"><label class="checkbox-label"><input type="checkbox" id="include-empty" ${includeEmpty?'checked':''}>${t('includeEmpty')}</label><label class="checkbox-label"><input type="checkbox" id="include-products" ${includeProducts?'checked':''}>${t('includeProductList')}</label><label class="checkbox-label"><input type="checkbox" id="include-inactive" ${includeInactive?'checked':''}>${t('includeInactiveKeys')}</label></div><div class="export-controls">${button('keys-all','selectAll')}${button('keys-none','selectNone')}</div><div id="export-key-list" class="checkbox-list"></div>`;fillExportKeys();$('#include-products').onchange=e=>{includeProducts=e.target.checked;};$('#export-brand').onchange=fillExportKeys;$('#include-empty').onchange=e=>{includeEmpty=e.target.checked;fillExportKeys();};$('#include-inactive').onchange=e=>{includeInactive=e.target.checked;fillExportKeys();};$('#keys-all').onclick=()=>$$('[data-export-key]').forEach(c=>c.checked=true);$('#keys-none').onclick=()=>$$('[data-export-key]').forEach(c=>c.checked=false);}
 }
 function fillExportKeys(){const b=$('#export-brand').value,include=$('#include-empty').checked;$('#export-key-list').innerHTML=M.keyEntries(state.logistics).map((r,i)=>({r,i})).filter(({r})=>(!b||r.brand===b)&&(includeInactive||M.keyIsActive(r.data))&&(include||completion(r.data)>0)).map(({r,i})=>`<label class="checkbox-label"><input type="checkbox" data-export-key="${i}" checked>${esc(r.brand)} / <strong>${esc(r.key)}</strong>${M.keyIsActive(r.data)?'':badge(t('inactive'),'grey')}<small>${completion(r.data)}%</small></label>`).join('')||`<p class="muted">${t('nothing')}</p>`;}
 $('#export-tab-products').onclick=()=>{mode='products';options();};$('#export-tab-keys').onclick=()=>{mode='keys';options();};options();
 $('#export-form').onsubmit=e=>{e.preventDefault();void runForm(async()=>{if(mode==='products')await exportProducts();else await exportLogistics($$('[data-export-key]:checked').map(c=>M.keyEntries(state.logistics)[Number(c.dataset.exportKey)]),includeProducts);});};attachCancel();
}
async function exportProducts(){
 const rows=productExportRows();if(!rows.length)throw Error(t('nothing'));
 const names=['brand','type','id','hs','name','csName','volume','price','key','pack','boxes_per_layer','boxes_per_pallet','carton_ean','new','new_date','discontinued','discontinued_date','flags','labelLanguages','inci'];
 const data=rows.map(({p})=>names.map(n=>['pack','boxes_per_layer','boxes_per_pallet'].includes(n)?M.packaging(p,state.logistics)[n]:n==='volume'?`${p.volume?.number??''} ${p.volume?.unit||''}`.trim():n==='flags'?(p.flags||[]).join(', '):n==='labelLanguages'?(Array.isArray(p.labelLanguages)&&p.labelLanguages.length?languageCodeText(p.labelLanguages):'TBD'):n==='inci'?(p.inciStatus==='not-applicable'?'N/A':p.inciStatus==='pending'||typeof p.inci!=='string'||!p.inci.trim()?'TBD':p.inci):n==='type'?typeLabel(p[n]):['id','hs','carton_ean'].includes(n)?String(p[n]??''):['new','discontinued'].includes(n)?(p[n]===true?t('yes'):t('no')):p[n]??''));
 await JasonExport.ready();
 const wb=JasonExport.products({fields:names,headers:names.map(n=>t(n==='id'?'ean':n)),rows:data,title:t('exportProducts'),date:today(),count:rows.length,countLabel:t('countProducts')});
 await JasonExport.download(wb,`products-${today()}.xlsx`);
}
async function exportLogistics(entries,includeProducts=false){
 if(!entries.length)throw Error(t('nothing'));
 await JasonExport.ready();
 const wb=JasonExport.logistics({entries,sections:M.sections,count:M.count,labels:JasonText.en,products:state.products,includeProducts});
 await JasonExport.download(wb,`logistics-${today()}.xlsx`);
}
$('#editor-close').onclick=closeEditor;$('#editor').oncancel=e=>{e.preventDefault();void closeEditor();};$('#photo-close').onclick=()=>$('#photo-dialog').close();$('#data-button').onclick=openData;$('#export').onclick=openExport;$('#create').onclick=()=>view==='keys'?openKey():openProduct();$('#undo').onclick=()=>undo();$('#redo').onclick=()=>undo(true);$('#retry').onclick=()=>syncRemote();$$('[data-lang]').forEach(b=>b.onclick=async()=>{if($('#editor').open)await closeEditor();if($('#editor').open)return;lang=b.dataset.lang;await persist();render();});
window.addEventListener('beforeunload',e=>{if(syncing||storageError||editorDirty||editorReturn?.dirty||hasPending()){e.preventDefault();e.returnValue='';}});
document.addEventListener('keydown',e=>{
 const mod=e.ctrlKey||e.metaKey;if($('#single-key-export-dialog').open){if(mod&&['s','z'].includes(e.key.toLowerCase()))e.preventDefault();return;}if(!mod||$('#confirm-dialog').open)return;
 if(e.key.toLowerCase()==='s'){e.preventDefault();if(editorSave)void editorSave();else if(!$('#editor').open)backup();}
 if(e.key.toLowerCase()==='z'&&!e.target.closest('input,textarea,[contenteditable]')){e.preventDefault();if(!$('#editor').open)void undo(e.shiftKey);}
});
window.addEventListener('hashchange',()=>{const v=location.hash.slice(1);if(['products','keys','checks'].includes(v)&&v!==view)changeView(v);});
// First visit: display the existing published catalog while the API verifies it.
// Preview data cannot be edited or sent back before the authoritative read completes.
async function previewShared(){
 try{
  const responses=await Promise.all([fetch(JASON_CONFIG.legacyProducts,{cache:'no-cache'}),fetch(JASON_CONFIG.logisticsFile,{cache:'no-cache'})]);
  if(responses.some(r=>!r.ok))return;
  const [p,l]=await Promise.all(responses.map(r=>r.json())),products=M.validateProducts(p);M.validateLogistics(l);
  if(!refreshing||state.connected||state.products.length)return;
  state={...state,products,logistics:l};render();
 }catch{} // The API remains the authority if the quick preview is unavailable.
}
async function refreshShared(automatic=false){
 if(sandbox)return;
 if(refreshing||syncing||busy||automatic&&($('#editor').open||editorDirty||hasPending()))return;
 if(hasPending()&&!await confirm('connectConfirm',t('connectConfirmHint'),'refresh'))return;
 refreshing=true;refreshFailed=false;renderStatus();$('#create').disabled=true;
 try{
  const api=JASON_CONFIG.sharedOnly?JASON_CONFIG.apiBase:state.api;
  const [p,l]=await Promise.all([S.request(api,'products'),S.request(api,'logistics')]);M.validateProducts(p);M.validateLogistics(l);
  const changed=sig(p)!==sig(state.products)||sig(l)!==sig(state.logistics);
  if(changed){history=[];future=[];selected.clear();}
  state={...state,products:p,logistics:l,api,imageBase:JASON_CONFIG.sharedOnly?JASON_CONFIG.imageBase:state.imageBase,connected:true,baseline:{products:sig(p),logistics:sig(l)},pendingPhotos:[],pendingLabels:[],updated:new Date().toISOString()};
  if(!automatic){photoVersion=Date.now();photoVersions.clear();missingThumbnails.clear();}
  lastRefresh=Date.now();await persist();
 }catch(e){refreshFailed=true;toast(t(state.products.length?'refreshFailed':'sharedNotLoaded'),true);}
 finally{refreshing=false;render();}
}
function sandboxSeed(){
 const seed=window.JASON_SANDBOX_SEED;
 if(!seed)throw Error('SANDBOX_SEED_MISSING');
 M.validateProducts(seed.products);M.validateLogistics(seed.logistics);
 return isolate({...M.clone(state),products:M.clone(seed.products),logistics:M.clone(seed.logistics),photos:{},labelFiles:{},pendingLabels:[],updated:seed.snapshotAt,sandboxNameRevision:seed.nameRevision,sandboxInciRevision:seed.inciRevision,sandboxStatusRevision:seed.statusRevision});
}
async function upgradeSandboxNames(){
 const seed=window.JASON_SANDBOX_SEED;
 if(!sandbox||!seed?.nameRevision||state.sandboxNameRevision===seed.nameRevision)return;
 const repair=snapshot=>{
  for(const p of snapshot.products)for(const c of seed.nameCorrections||[]){
   if(String(p.id)===c.id&&p[c.field]===c.before)p[c.field]=c.after;
  }
  snapshot.sandboxNameRevision=seed.nameRevision;
 };
 repair(state);history.forEach(repair);
 if(history.length)await S.put('recovery',M.clone(history.at(-1)));
 await persist();
}
async function upgradeSandboxInci(){
 const seed=window.JASON_SANDBOX_SEED;
 if(!sandbox||!seed?.inciRevision||state.sandboxInciRevision===seed.inciRevision)return;
 // Keep ID types: a retired and a replacement product can share the same EAN.
 const identity=p=>JSON.stringify([p.id,p.volume?.number,p.volume?.unit]);
 const groups=new Map();
 for(const p of seed.products){const k=identity(p);groups.set(k,[...(groups.get(k)||[]),p]);}
 const fields=['inci','inciStatus','inciSource'];
 const repair=snapshot=>{
  for(const p of snapshot.products){
   const matches=groups.get(identity(p))||[],source=matches.length===1?matches[0]:matches.find(s=>s.name===p.name);
   if(!source)continue;
   // Replace only an exact previously supplied INCI; keep every local edit.
   const correction=(seed.inciCorrections||[]).find(c=>identity(c)===identity(p)&&fields.every(k=>Object.hasOwn(p,k)===Object.hasOwn(c.before,k)&&JSON.stringify(p[k])===JSON.stringify(c.before[k])));
   if(!correction&&fields.some(k=>Object.hasOwn(p,k)))continue;
   for(const k of fields){if(Object.hasOwn(source,k))p[k]=M.clone(source[k]);else if(correction)delete p[k];}
  }
  snapshot.sandboxInciRevision=seed.inciRevision;
 };
 repair(state);history.forEach(repair);
 if(history.length)await S.put('recovery',M.clone(history.at(-1)));
 await persist();
}
async function upgradeSandboxStatuses(){
 const seed=window.JASON_SANDBOX_SEED;
 if(!sandbox||!seed?.statusRevision||state.sandboxStatusRevision===seed.statusRevision)return;
 const identity=p=>JSON.stringify([p.brand,p.id,p.volume?.number,p.volume?.unit]);
 const repair=snapshot=>{
  for(const c of seed.statusCorrections?.products||[]){
   const matches=snapshot.products.filter(p=>identity(p)===identity(c));if(matches.length!==1)continue;const p=matches[0];
   // Missing/false and an empty date both represent the original active state.
   if((p.discontinued===true)!==(c.before.discontinued===true)||String(p.discontinued_date||'')!==String(c.before.discontinued_date||''))continue;
   for(const field of ['discontinued','discontinued_date']){if(Object.hasOwn(c.after,field))p[field]=M.clone(c.after[field]);else delete p[field];}
  }
  for(const c of seed.statusCorrections?.keys||[]){
   const data=snapshot.logistics?.[c.brand]?.[c.key];if(!data||M.keyIsActive(data)!==M.keyIsActive(c.before))continue;
   // A locally added/reassigned active product still needs its key in the sandbox.
   if(c.after.active===false&&snapshot.products.some(p=>p.brand===c.brand&&M.key(p.key)===c.key&&p.discontinued!==true))continue;
   data.active=c.after.active;
  }
  snapshot.sandboxStatusRevision=seed.statusRevision;
 };
 repair(state);history.forEach(repair);
 if(history.length)await S.put('recovery',M.clone(history.at(-1)));
 await persist();
}
async function resetSandbox(){
 if(!sandbox||busy||!await confirm('sandboxResetTitle',t('sandboxResetHint'),'sandboxReset'))return;
 try{const next=sandboxSeed();await S.put('recovery',null);state=next;history=[];future=[];selected.clear();await persist();formClose();render();toast(t('loaded'));}catch(e){error(e);}
}
async function boot(){
 let hasSavedState=false;
 try{const saved=await S.get('state');if(saved?.state){M.validateProducts(saved.state.products);M.validateLogistics(saved.state.logistics);state=isolate({...state,...saved.state});hasSavedState=true;lang=saved.lang==='en'?'en':'cs';const recovery=await S.get('recovery');if(recovery)history=[recovery];}}
 catch(e){storageError=true;toast(t('localError'),true);}
 if(sandbox&&!hasSavedState){try{state=sandboxSeed();await persist();}catch(e){error(e);}}
 if(sandbox&&hasSavedState){try{await upgradeSandboxNames();await upgradeSandboxInci();await upgradeSandboxStatuses();}catch(e){storageError=true;toast(t('localError'),true);}}
 if(JASON_CONFIG.sharedOnly){state.api=JASON_CONFIG.apiBase;state.imageBase=JASON_CONFIG.imageBase;}
 view=['products','keys','checks'].includes(location.hash.slice(1))?location.hash.slice(1):'products';render();
 if(sandbox)return;
 if(JASON_CONFIG.autoConnect||state.connected){if(!hasPending()){const refresh=refreshShared(true);if(JASON_CONFIG.autoConnect&&!hasSavedState)void previewShared();await refresh;}}
 else if(location.protocol!=='file:'&&['localhost','127.0.0.1'].includes(location.hostname)){
  try{const [pr,lr]=await Promise.all([fetch(JASON_CONFIG.legacyProducts),fetch(JASON_CONFIG.logisticsFile)]);if(pr.ok&&lr.ok){const p=await pr.json(),l=await lr.json();M.validateProducts(p);M.validateLogistics(l);state.products=p;state.logistics=l;await persist();render();}}catch{}
 }
}
if($('#refresh'))$('#refresh').onclick=()=>refreshShared(false);
window.addEventListener('focus',()=>{if(state.connected&&Date.now()-lastRefresh>15000)void refreshShared(true);});

void boot();
})();

