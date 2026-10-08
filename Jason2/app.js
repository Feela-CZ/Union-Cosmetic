/* Jason 2.0 — no build step, no CDN, compatible with the original API and JSON files. */
(function(){
'use strict';
const M=JasonModel,S=JasonStorage,$=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const icons={products:'▦',keys:'◇',checks:'✓',data:'↔',help:'?',undo:'↶',redo:'↷',export:'↓',plus:'+'};
let lang='cs',view='products',page=1,pageSize=30,sort={field:'name',asc:true},selected=new Set(),history=[],future=[],busy=false,editorDirty=false,editorSave=null,toastTimer,syncing=false,storageError=false;
let state={products:[],logistics:M.clone(window.JASON_SEED_LOGISTICS||{}),photos:{},pendingPhotos:[],connected:false,api:JASON_CONFIG.apiBase,imageBase:JASON_CONFIG.imageBase,baseline:{},updated:null};
let filters={search:'',brand:'',type:'',key:'',status:'active',flag:'',scope:''};
const t=k=>JasonText[lang][k]||JasonText.cs[k]||k;
const types=()=>Object.keys(JasonTypes.en);
const typeLabel=v=>JasonTypes[lang][v]||v;
const today=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
const brands=()=>[...new Set(['Lilien','Naturalis','Twister','Natava','Sunnoré',...state.products.map(p=>p.brand),...Object.keys(state.logistics)])].filter(Boolean).sort((a,b)=>a.localeCompare(b));
const flags=()=>[...new Set(state.products.flatMap(p=>p.flags||[]))].sort();
const sig=v=>JSON.stringify(v,(_,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.keys(x).sort().map(k=>[k,x[k]])):x);
const dirty=n=>state.connected&&sig(state[n])!==state.baseline[n];
let refreshing=false,lastRefresh=0,refreshFailed=false;
const hasPending=()=>dirty('products')||dirty('logistics')||state.pendingPhotos.length>0;
const option=(value,label,sel)=>`<option value="${esc(value)}" ${String(value)===String(sel)?'selected':''}>${esc(label)}</option>`;
const button=(id,label,cls='')=>`<button type="button" id="${id}" class="${cls}">${esc(t(label))}</button>`;
function selectHTML(id,label,items,value,empty){return `<label class="filter"><span>${esc(t(label))}</span><select id="${id}">${option('',t(empty),value)}${items.map(x=>option(typeof x==='object'?x.value:x,typeof x==='object'?x.label:x,value)).join('')}</select></label>`;}
function toast(text,error=false){const e=$('#toast');e.textContent=text;e.className=error?'error':'';e.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>{e.hidden=true;},error?9000:3500);}
function error(e){const msg=e?.message||String(e);toast(`${t('failed')}: ${t(msg)}`,true);console.error(e);}
async function persist(){try{await S.put('state',{state,lang});storageError=false;}catch(e){storageError=true;toast(t('localError'),true);}renderStatus();}
function renderStatus(){
 $('#connection-label').textContent=t(state.connected?'connected':'local');$('.connection .dot').classList.toggle('online',state.connected);
 $('#save-status').textContent=storageError?t('localError'):syncing?t('saving'):hasPending()?t('pending'):t(state.connected?'synced':'saved');
 $('#save-status').classList.toggle('warning',hasPending()||storageError);$('#retry').hidden=!state.connected||!hasPending()||syncing;$('#retry').textContent=t('retry');
 if($('#refresh')){$('#refresh').hidden=!JASON_CONFIG.autoConnect&&!state.connected;$('#refresh').textContent=t('refresh');$('#refresh').disabled=refreshing||syncing||busy;}
 if(refreshing)$('#save-status').textContent=t('connecting');else if(refreshFailed)$('#save-status').textContent=t('refreshFailed');
}
async function commit(next,label='updated'){
 // Make the restore point durable before applying changes.
 try{await S.put('recovery',M.clone(state));}catch(e){storageError=true;toast(t('localError'),true);throw e;}
 history.push(M.clone(state));if(history.length>12)history.shift();future=[];state=next;state.updated=new Date().toISOString();
 selected.clear();await persist();render();toast(t(label));if(state.connected)void syncRemote();
}
async function undo(redo=false){if(busy||editorDirty)return;const source=redo?future:history,target=redo?history:future;if(!source.length)return;const current=M.clone(state),next=source.pop();target.push(current);
 // Keep the acknowledged remote baseline; history changes data, never connection identity.
 next.connected=state.connected;next.api=state.api;next.imageBase=state.imageBase;next.baseline=state.baseline;
 next.pendingPhotos=Object.keys(next.photos).filter(id=>next.photos[id]!==state.photos[id]||state.pendingPhotos.includes(id));
 state=next;await persist();selected.clear();render();toast(t(redo?'redo':'undo'));if(state.connected)void syncRemote();}
async function syncRemote(){
 if(syncing||!state.connected)return;
 syncing=true;renderStatus();
 try{
  while(state.connected&&hasPending()){
   for(const name of ['logistics','products']){
    if(!dirty(name))continue;
    const snapshot=M.clone(state[name]);
    const remote=await S.request(state.api,name);
    if(sig(remote)!==state.baseline[name])throw Error(lang==='cs'?'Společná data mezitím změnil jiný uživatel. Stáhněte zálohu a načtěte aktuální data před dalším odesláním.':'Shared data changed since loading. Download a backup and reload current data before sending again.');
    await S.request(state.api,name,'PUT',snapshot);state.baseline[name]=sig(snapshot);await persist();
   }
   for(const id of [...state.pendingPhotos]){
    const data=state.photos[id];if(!data){state.pendingPhotos=state.pendingPhotos.filter(x=>x!==id);continue;}
    await S.request(state.api,'upload-image','PUT',{path:`OrderSheet/img/${id}.jpg`,content:data.split(',')[1]});
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
async function closeEditor(){if(busy)return;if(editorDirty&&!await confirm('discard',t('discardHint'),'discardYes'))return;$('#editor').close();editorDirty=false;editorSave=null;}
function openEditor(title,caption,html,small=false){
 const d=$('#editor');d.classList.toggle('small',small);$('#editor-title').textContent=title;$('#editor-caption').textContent=caption;$('#editor-body').innerHTML=html;editorDirty=false;editorSave=null;
 $('#editor-body').oninput=e=>{if(e.target.closest('form'))editorDirty=true;};$('#editor-body').onchange=e=>{if(e.target.closest('form'))editorDirty=true;};
 if(!d.open)d.showModal();
 d.scrollTop=0;
}
async function runForm(action){if(busy)return;busy=true;$$('#editor button[type="submit"]').forEach(b=>{b.disabled=true;b.dataset.original=b.textContent;b.textContent=t('saving');});try{await action();}catch(e){error(e);}finally{busy=false;$$('#editor button[type="submit"]').forEach(b=>{b.disabled=false;b.textContent=b.dataset.original||t('save');});}}
function formClose(){editorDirty=false;editorSave=null;$('#editor').close();}
function render(){
 document.documentElement.lang=lang;document.title=`Jason · ${t(view)}`;
 $$('[data-text]').forEach(e=>e.textContent=t(e.dataset.text));$$('[data-lang]').forEach(e=>{e.classList.toggle('active',e.dataset.lang===lang);e.setAttribute('aria-pressed',e.dataset.lang===lang);});
 $('#nav').innerHTML=['products','keys','checks'].map(v=>`<button class="nav-button ${view===v?'active':''}" data-view="${v}" ${view===v?'aria-current="page"':''}><span class="nav-icon">${icons[v]}</span>${esc(t(v))}<span class="nav-count">${v==='products'?state.products.length:v==='keys'?M.keyEntries(state.logistics).length:M.issues(state).length}</span></button>`).join('');
 $$('[data-view]').forEach(b=>b.onclick=()=>changeView(b.dataset.view));
 $('#data-button').innerHTML=`<span class="nav-icon">↔</span>${esc(t('data'))}`;$('#help-button').innerHTML=`<span class="nav-icon">?</span>${esc(t('help'))}`;
 $('#crumb').textContent=t(view);$('#page-title').textContent=t(view);$('#page-description').textContent=t(view==='products'?'subtitle':view==='keys'?'keyHelp':'checksHint');
 $('#undo').textContent=icons.undo;$('#undo').title=t('undo');$('#undo').setAttribute('aria-label',t('undo'));$('#undo').disabled=!history.length;
 $('#redo').textContent=icons.redo;$('#redo').title=t('redo');$('#redo').setAttribute('aria-label',t('redo'));$('#redo').disabled=!future.length;
 $('#export').textContent=`↓ ${t('export')}`;$('#create').textContent=`+ ${t(view==='keys'?'addKey':'addProduct')}`;$('#create').hidden=view==='checks';$('#create').disabled=refreshing||(JASON_CONFIG.sharedOnly&&JASON_CONFIG.autoConnect&&!state.connected);
 const active=state.products.filter(p=>p.discontinued!==true).length;
 $('#stats').innerHTML=[['products',state.products.length,`${active} ${t('active').toLowerCase()}`],['keys',M.keyEntries(state.logistics).length,t('packaging')],['checks',M.issues(state).length,t('checks')]].map(([v,n,sub])=>`<button class="stat-card ${v===view?'current':''}" data-stat="${v}"><span>${esc(t(v))}</span><strong>${n.toLocaleString(lang==='cs'?'cs-CZ':'en-GB')}</strong><small>${esc(sub)}</small></button>`).join('');
 $$('[data-stat]').forEach(b=>b.onclick=()=>changeView(b.dataset.stat));renderToolbar();renderContent();renderStatus();
}
function changeView(next){view=next;page=1;selected.clear();filters={search:'',brand:'',type:'',key:'',status:'active',flag:'',scope:''};location.hash=next;render();}
function renderToolbar(){
 const searchPlaceholder=t(view==='products'?'search':view==='keys'?'keySearch':'issueSearch');
 let html=`<label class="search-box"><span aria-hidden="true">⌕</span><input id="search" type="search" placeholder="${esc(searchPlaceholder)}" aria-label="${esc(searchPlaceholder)}" value="${esc(filters.search)}"><kbd>Ctrl K</kbd></label>`;
 html+=selectHTML('filter-brand','brand',brands(),filters.brand,'allBrands');
 if(view==='products'){
  html+=selectHTML('filter-type','type',[...new Set([...types(),...state.products.map(p=>p.type)])].filter(Boolean).map(v=>({value:v,label:typeLabel(v)})),filters.type,'allTypes');
  html+=selectHTML('filter-key','key',[...new Set(M.keyEntries(state.logistics).filter(k=>!filters.brand||k.brand===filters.brand).map(k=>k.key))].sort((a,b)=>a.localeCompare(b,undefined,{numeric:true})),filters.key,'allKeys');
  html+=`<label class="filter"><span>${t('status')}</span><select id="filter-status">${['active','all','new','discontinued'].map(v=>option(v,t(v),filters.status)).join('')}</select></label>`;
  if(flags().length)html+=selectHTML('filter-flag','flag',flags(),filters.flag,'allFlags');
 }else if(view==='keys')html+=selectHTML('filter-scope','keyScope',[{value:'used',label:t('used')},{value:'unused',label:t('unused')},{value:'incomplete',label:t('incomplete')}],filters.scope,'allScopes');
 html+=`<button class="reset-button" id="reset">${t('reset')}</button>`;$('#toolbar').innerHTML=html;
 $('#search').oninput=e=>{filters.search=e.target.value;page=1;selected.clear();renderContent();};
 for(const f of ['brand','type','key','status','flag','scope']){const el=$(`#filter-${f}`);if(el)el.onchange=e=>{filters[f]=e.target.value;if(f==='brand')filters.key='';page=1;selected.clear();renderToolbar();renderContent();};}
 $('#reset').onclick=()=>{filters={search:'',brand:'',type:'',key:'',status:'active',flag:'',scope:''};page=1;selected.clear();renderToolbar();renderContent();};
}
function filteredProducts(){const list=M.filterProducts(state.products,filters);return list.sort((a,b)=>{const value=p=>sort.field==='name'?(lang==='cs'?p.csName||p.name:p.name):sort.field==='volume'?Number(p.volume?.number)||0:p[sort.field];const av=value(a.p),bv=value(b.p);return (typeof av==='number'&&typeof bv==='number'?av-bv:String(av??'').localeCompare(String(bv??''),lang,{numeric:true}))*(sort.asc?1:-1);});}
function completion(data){let done=0,total=0;Object.entries(M.sections).forEach(([s,fs])=>fs.forEach(f=>{total++;if(data[s]?.[f]!=null&&data[s]?.[f]!=='')done++;}));return Math.round(done/total*100);}
function badge(text,cls=''){return `<span class="badge ${cls}">${esc(text)}</span>`;}
function renderContent(){
 let rows,unit;
 if(view==='products'){rows=filteredProducts();unit=t('countProducts');}
 else if(view==='keys'){rows=M.keyEntries(state.logistics).filter(r=>{const used=state.products.filter(p=>p.brand===r.brand&&M.key(p.key)===r.key).length;return (!filters.brand||r.brand===filters.brand)&&M.fold(r.brand+' '+r.key).includes(M.fold(filters.search))&&(!filters.scope||filters.scope==='used'&&used>0||filters.scope==='unused'&&used===0||filters.scope==='incomplete'&&completion(r.data)<100);}).sort((a,b)=>a.brand.localeCompare(b.brand)||a.key.localeCompare(b.key,undefined,{numeric:true}));unit=t('countKeys');}
 else{rows=M.issues(state).filter(r=>{const p=r.kind==='product'?state.products[r.index]:null;return (!filters.brand||(p?.brand||r.brand)===filters.brand)&&M.fold([p?.name,p?.csName,p?.id,p?.brand,r.brand,r.key,t(r.code),t(r.field)].join(' ')).includes(M.fold(filters.search));});unit=t('countIssues');}
 const pages=Math.max(1,Math.ceil(rows.length/pageSize));page=Math.min(page,pages);const items=rows.slice((page-1)*pageSize,page*pageSize);
 if(!items.length){$('#content').innerHTML=`<div class="empty-state"><div class="empty-symbol">${view==='checks'?'✓':'◇'}</div><h2>${esc(t(view==='products'&&!state.products.length?'noProducts':view==='checks'&&!rows.length&&!filters.search&&!filters.brand?'noIssues':'empty'))}</h2><p>${esc(t(view==='products'&&!state.products.length?'noProductsHint':'emptyHint'))}</p>${view==='products'&&!state.products.length?button('empty-import','loadProducts','primary'):''}</div>`;if($('#empty-import'))$('#empty-import').onclick=()=>importFile('products');}
 else if(view==='products')renderProductTable(items);
 else if(view==='keys')renderKeyTable(items);
 else renderChecksTable(items);
 $('#pagination').innerHTML=`<span>${rows.length?(page-1)*pageSize+1:0}–${Math.min(page*pageSize,rows.length)} <span class="muted">/ ${rows.length} ${esc(unit)}</span></span><div class="pagination-actions"><label><select id="page-size" aria-label="${esc(t('countProducts'))}">${[30,60,120].map(n=>option(n,n,pageSize)).join('')}</select></label><button id="prev" ${page===1?'disabled':''}>${t('previous')}</button><span>${page} / ${pages}</span><button id="next" ${page===pages?'disabled':''}>${t('next')}</button></div>`;
 $('#prev').onclick=()=>{page--;renderContent();};$('#next').onclick=()=>{page++;renderContent();};$('#page-size').onchange=e=>{pageSize=Number(e.target.value);page=1;renderContent();};
 renderBulk();
}
function renderProductTable(items){
 const headers=[['name','product'],['brand','brand'],['id','ean'],['volume','volume'],['price','price'],['key','key'],['new','status']];
 $('#content').innerHTML=`<div class="table-scroll"><table><thead><tr><th class="select-cell"><input type="checkbox" id="select-page" aria-label="${esc(t('selectAll'))}" ${items.every(x=>selected.has(x.index))?'checked':''}></th>${headers.map(([f,label])=>`<th><button class="sort-button" data-sort="${f}">${esc(t(label))}${sort.field===f?(sort.asc?' ↑':' ↓'):''}</button></th>`).join('')}<th class="actions-cell">${t('actions')}</th></tr></thead><tbody>${items.map(({p,index})=>{
 const title=lang==='cs'?p.csName||p.name:p.name||p.csName;const secondary=lang==='cs'?p.name:p.csName;
 return `<tr class="${selected.has(index)?'selected':''}"><td class="select-cell"><input type="checkbox" data-select="${index}" aria-label="${esc(t('select')+' '+title)}" ${selected.has(index)?'checked':''}></td><td class="product-cell"><button class="product-link" data-edit="${index}"><span class="product-avatar">${esc((p.brand||'?').slice(0,1))}</span><span><strong>${esc(title||'—')}</strong><small>${esc(typeLabel(p.type))}${secondary&&secondary!==title?' · '+esc(secondary):''}</small></span></button></td><td>${badge(p.brand||'—','brand-'+M.fold(p.brand).replace(/[^a-z]/g,''))}</td><td class="mono">${esc(p.id||'—')}<small class="cell-sub">${p.hs?'HS '+esc(p.hs):''}</small></td><td class="nowrap">${esc(p.volume?.number??'')} ${esc(p.volume?.unit||'')}</td><td class="numeric">${p.price==null||p.price===''?'—':esc(Number.isFinite(Number(p.price))?Number(p.price).toLocaleString(lang==='cs'?'cs-CZ':'en-GB',{minimumFractionDigits:2,maximumFractionDigits:4}):p.price)}</td><td><button class="key-link" data-product-key="${index}">${esc(M.key(p.key)||'—')}</button><small class="cell-sub">${p.pack!==''&&p.pack!=null?esc(p.pack)+' '+(lang==='cs'?'ks / karton':'items / carton'):''}</small></td><td class="status-cell">${p.discontinued===true?badge(t('discontinued'),'grey'):p.new===true?badge(t('new'),'green'):badge(t('active'),'subtle')}${(p.flags||[]).map(f=>badge(f,'custom')).join('')}<small class="cell-sub">${esc(p.discontinued?p.discontinued_date:p.new?p.new_date:'')}</small></td><td class="actions-cell"><button data-edit="${index}" class="row-edit">${t('edit')}</button><button data-more="${index}" class="more-button" aria-label="${esc(t('actions')+' '+title)}">•••</button></td></tr>`;
 }).join('')}</tbody></table></div>`;
 $$('[data-sort]').forEach(b=>b.onclick=()=>{sort={field:b.dataset.sort,asc:sort.field===b.dataset.sort?!sort.asc:true};renderContent();});
 $$('[data-edit]').forEach(b=>b.onclick=()=>openProduct(Number(b.dataset.edit)));
 $$('[data-more]').forEach(b=>b.onclick=()=>productActions(Number(b.dataset.more)));
 $$('[data-product-key]').forEach(b=>b.onclick=()=>{const p=state.products[Number(b.dataset.productKey)];if(M.key(p.key)&&state.logistics[p.brand]?.[M.key(p.key)])openKey(p.brand,M.key(p.key));else openProduct(Number(b.dataset.productKey),'packaging');});
 $$('[data-select]').forEach(c=>c.onchange=()=>{const i=Number(c.dataset.select);if(c.checked)selected.add(i);else selected.delete(i);renderContent();});
 $('#select-page').onchange=e=>{items.forEach(x=>{if(e.target.checked)selected.add(x.index);else selected.delete(x.index);});renderContent();};
}
function renderKeyTable(items){
 $('#content').innerHTML=`<div class="table-scroll"><table><thead><tr>${['key','brand','pack','boxes_per_layer','boxes_per_pallet','affected','complete','actions'].map(k=>`<th>${t(k)}</th>`).join('')}</tr></thead><tbody>${items.map(r=>{const used=state.products.filter(p=>p.brand===r.brand&&M.key(p.key)===r.key).length,percent=completion(r.data);return `<tr><td><button class="key-link key-large" data-key-edit="${esc(r.brand)}" data-key-name="${esc(r.key)}">${esc(r.key)}</button></td><td>${badge(r.brand)}</td><td>${esc(r.data.CARTON?.nr_of_items??'—')}</td><td>${esc(r.data.LAYER?.nr_of_cartons??'—')}</td><td>${esc(r.data.PALLET?.nr_of_cartons??'—')}</td><td><button class="text-button" data-used-brand="${esc(r.brand)}" data-used-key="${esc(r.key)}">${used} ${!used?'· '+t('unused'):''}</button></td><td><span class="completeness"><span><i style="width:${percent}%"></i></span>${percent}%</span></td><td><button class="row-edit" data-key-edit="${esc(r.brand)}" data-key-name="${esc(r.key)}">${t('edit')}</button></td></tr>`;}).join('')}</tbody></table></div>`;
 $$('[data-key-edit]').forEach(b=>b.onclick=()=>openKey(b.dataset.keyEdit,b.dataset.keyName));$$('[data-used-key]').forEach(b=>b.onclick=()=>{changeView('products');filters.brand=b.dataset.usedBrand;filters.key=b.dataset.usedKey;filters.status='all';renderToolbar();renderContent();});
}
function renderChecksTable(items){
 $('#content').innerHTML=`<div class="table-scroll"><table><thead><tr><th>${t('product')} / ${t('key')}</th><th>${t('brand')}</th><th>${t('issue')}</th><th>${t('actions')}</th></tr></thead><tbody>${items.map((r,i)=>{const p=r.kind==='product'?state.products[r.index]:null;return `<tr><td><strong>${esc(p?(lang==='cs'?p.csName||p.name:p.name):r.key)}</strong><small class="cell-sub mono">${esc(p?.id||'')}</small></td><td>${esc(p?.brand||r.brand)}</td><td><span class="issue-dot ${r.code==='keyUnused'?'info':''}"></span>${esc(t(r.code))}${r.field?' · '+esc(t(r.field==='id'?'ean':r.field)):''}</td><td><button data-issue="${i}" class="row-edit">${t('open')}</button></td></tr>`;}).join('')}</tbody></table></div>`;
 $$('[data-issue]').forEach(b=>b.onclick=()=>{const r=items[Number(b.dataset.issue)];if(r.kind==='product')openProduct(r.index);else openKey(r.brand,r.key);});
}
function renderBulk(){const e=$('#bulk-bar');e.hidden=!selected.size||view!=='products';if(e.hidden)return;e.innerHTML=`<span><strong>${selected.size}</strong> ${t('selected')}</span>${button('bulk-edit','bulk')}${button('bulk-select-all','selectAll')}${button('bulk-clear','selectNone')}`;$('#bulk-edit').onclick=openBulk;$('#bulk-select-all').onclick=()=>{filteredProducts().forEach(r=>selected.add(r.index));renderContent();};$('#bulk-clear').onclick=()=>{selected.clear();renderContent();};}
function field(name,label,value,type='text',extra='',hint=''){return `<label class="field"><span>${esc(t(label))}</span><input name="${esc(name)}" id="field-${esc(name)}" type="${type}" value="${esc(value??'')}" ${extra}>${hint?`<small>${esc(hint)}</small>`:''}</label>`;}
function datalist(id,values){return `<datalist id="${id}">${values.map(v=>`<option value="${esc(v)}">${esc(id==='types'?typeLabel(v):v)}</option>`).join('')}</datalist>`;}
function formFooter(label='save',left=''){return `<div class="form-footer"><span class="muted">${left}</span><div>${button('form-cancel','cancel')}<button type="submit" class="primary">${esc(t(label))}</button></div></div>`;}
function attachCancel(){if($('#form-cancel'))$('#form-cancel').onclick=closeEditor;}
function productPhoto(p){return (!state.connected||state.pendingPhotos.includes(p.id)?state.photos[p.id]:null)||(state.imageBase&&p.id?`${state.imageBase.replace(/\/$/,'')}/${encodeURIComponent(p.id)}.jpg?ts=${Date.now()}`:'');}
function openProduct(index=null,tab='details',duplicate=false){
 if(refreshing)return;
 const original=index!==null?M.clone(state.products[index]):null;
 const p=original?M.clone(original):{brand:filters.brand||'',type:'',id:'',hs:'',name:'',csName:'',volume:{number:'',unit:'ml'},price:'',key:null,pack:'',boxes_per_layer:'',boxes_per_pallet:'',new:false,new_date:'',discontinued:false,discontinued_date:'',carton_ean:null};
 if(duplicate)p.id='';
 let selectedPhoto=duplicate&&original?state.photos[original.id]||null:null,photoExists=false;
 const title=duplicate?t('duplicate'):original?(lang==='cs'?p.csName||p.name:p.name)||t('edit'):t('addProduct');
 openEditor(title,original&&!duplicate?`${p.brand} / ${p.id}`:t('product'),`<form id="product-form" novalidate><div class="editor-tabs" role="tablist">${['details','packaging','flags','photo'].map(v=>`<button type="button" role="tab" id="tab-${v}" aria-controls="section-${v}" data-tab="${v}" aria-selected="${v===tab}">${t(v)}</button>`).join('')}</div>
 <div class="form-content"><div id="form-error" class="notice error-notice" role="alert" hidden></div>
 <section id="section-details" class="tab-section" role="tabpanel" aria-labelledby="tab-details"><div class="section-intro"><h3>${t('details')}</h3><span>${t('unknownFields')}</span></div><div class="form-grid">${field('brand','brand',p.brand,'text','list="brands" required')}${field('type','type',p.type,'text','list="types"')}${field('id','ean',p.id,'text','required inputmode="numeric"',t('required'))}${field('hs','hs',p.hs,'text','inputmode="numeric"')}${field('name','name',p.name)}${field('csName','csName',p.csName)}<label class="field"><span>${t('volume')}</span><div class="input-group"><input name="volume-number" type="text" inputmode="decimal" value="${esc(p.volume?.number??'')}"><input name="volume-unit" list="units" value="${esc(p.volume?.unit||'ml')}" aria-label="${lang==='cs'?'Jednotka':'Unit'}"></div></label>${field('price','price',p.price,'number','min="0" step="any"')}</div>${datalist('brands',brands())}${datalist('types',[...new Set([...types(),...state.products.map(p=>p.type)])].filter(Boolean))}${datalist('units',['ml','g','pc','l','kg'])}<p class="notice" id="draft-warning" hidden>${t('draftWarning')}</p></section>
 <section id="section-packaging" class="tab-section" role="tabpanel" aria-labelledby="tab-packaging"><div class="section-intro"><h3>${t('packaging')}</h3></div><p class="notice">${t('keyHint')}</p><div class="form-grid"><label class="field"><span>${t('key')}</span><select name="key" id="product-key"></select></label>${field('carton_ean','carton_ean',p.carton_ean)}${field('pack','pack',p.pack,'number','min="0" step="1"')}${field('boxes_per_layer','boxes_per_layer',p.boxes_per_layer,'number','min="0" step="1"')}${field('boxes_per_pallet','boxes_per_pallet',p.boxes_per_pallet,'number','min="0" step="1"')}</div><p class="muted" id="key-summary"></p></section>
 <section id="section-flags" class="tab-section" role="tabpanel" aria-labelledby="tab-flags"><h3>${t('flags')}</h3>${['new','discontinued'].map(v=>`<div class="flag-card"><label class="checkbox-label"><input type="checkbox" name="${v}" ${p[v]===true?'checked':''}>${t(v)}</label>${field(v+'_date',v+'_date',p[v+'_date'],'date')}</div>`).join('')}<div class="form-grid">${field('flags','customFlags',(p.flags||[]).join(', '),'text','',t('flagsHint'))}</div><p class="muted">${t('localOnly')}</p></section>
 <section id="section-photo" class="tab-section" role="tabpanel" aria-labelledby="tab-photo"><h3>${t('photo')}</h3><div class="photo-layout"><button type="button" class="photo-drop" id="photo-drop"><img id="photo-preview" alt="${esc(t('photo'))}" hidden><span id="photo-placeholder">+<small>${t('choosePhoto')}</small></span></button><div><p>${t('photoHint')}</p><input type="file" accept="image/jpeg,image/png,image/webp" id="photo-input" hidden>${button('photo-choose','choosePhoto')}${button('photo-download','downloadPhoto')}${button('photo-view','viewPhoto')}<p class="muted">${state.pendingPhotos.includes(p.id)?t('photoPending'):''}</p></div></div></section>
 </div>${formFooter()}</form>`);
 const form=$('#product-form'),elements=form.elements;
 const showTab=v=>{$$('[data-tab]').forEach(b=>{b.setAttribute('aria-selected',b.dataset.tab===v);b.tabIndex=b.dataset.tab===v?0:-1;});$$('.tab-section').forEach(s=>{s.hidden=s.id!==`section-${v}`;});};
 $$('[data-tab]').forEach((b,i,list)=>{b.onclick=()=>showTab(b.dataset.tab);b.onkeydown=e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();const n=e.key==='Home'?0:e.key==='End'?list.length-1:(i+(e.key==='ArrowRight'?1:-1)+list.length)%list.length;showTab(list[n].dataset.tab);list[n].focus();}};});showTab(tab);
 function keysForBrand(overwrite=false){const b=elements.brand.value,k=elements.key.value||p.key;const keys=M.keyEntries(state.logistics).filter(r=>r.brand===b).map(r=>r.key);$('#product-key').innerHTML=option('','—',k)+keys.map(v=>option(v,v,k)).join('')+(M.key(k)&&!keys.includes(String(k))?option(k,`${k} · ${t('keyUnknown')}`,k):'');if(overwrite){elements.key.value='';}updatePackaging(false);}
 function updatePackaging(fill){const l=state.logistics[elements.brand.value]?.[M.key(elements.key.value)];if(fill&&l){const temp=M.syncPackaging({},l);['pack','boxes_per_layer','boxes_per_pallet'].forEach(f=>elements[f].value=temp[f]);}$('#key-summary').textContent=l?`${elements.brand.value} / ${elements.key.value} · ${state.products.filter(x=>x.brand===elements.brand.value&&M.key(x.key)===elements.key.value).length} ${t('countProducts')}`:t('keyMissing');}
 keysForBrand();elements.brand.onchange=()=>keysForBrand(true);elements.key.onchange=()=>updatePackaging(true);
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
  if(!editorDirty&&!selectedPhoto&&original&&!duplicate){formClose();return;}
  try{
   const str=n=>elements[n].value.trim(),num=n=>str(n)===''?'':Number(str(n));
   for(const n of ['price','pack','boxes_per_layer','boxes_per_pallet']){const v=num(n);if(v!==''&&(!Number.isFinite(v)||v<0||['pack','boxes_per_layer','boxes_per_pallet'].includes(n)&&!Number.isInteger(v)))throw Error('numeric');}
   const id=str('id');if(!id)throw Error('EAN_REQUIRED');if(!str('brand'))throw Error('KEY_REQUIRED');
   const patch={brand:str('brand'),type:str('type'),id,hs:str('hs'),name:str('name'),csName:str('csName'),volume:{...(p.volume||{}),number:preserve('volume',p.volume?.number,str('volume-number')),unit:str('volume-unit')},price:preserve('price',p.price,num('price')),key:preserve('key',p.key,str('key')||null),carton_ean:preserve('carton_ean',p.carton_ean,str('carton_ean')||null),...Object.fromEntries(['pack','boxes_per_layer','boxes_per_pallet'].map(n=>[n,preserve(n,p[n],num(n))]))};
   for(const v of ['new','discontinued']){patch[v]=elements[v].checked;patch[v+'_date']=elements[v].checked?(str(v+'_date')||today()):'';}
   const flagList=[...new Set(str('flags').split(',').map(s=>s.trim()).filter(Boolean))];if(p.flags!==undefined||flagList.length)patch.flags=flagList;
   const target=duplicate?null:index;const record=M.saveProduct(duplicate?p:original,patch,state.products,target,state.logistics);
   // If an EAN changes (or a product is copied), retain its visible photo at the new filename.
   if(!selectedPhoto&&photoExists&&(duplicate||original&&id!==String(original.id))){const r=await fetch($('#photo-preview').src);if(!r.ok)throw Error('HTTP '+r.status);selectedPhoto=await S.jpeg(new File([await r.blob()],'photo.jpg',{type:'image/jpeg'}));}
   const next=M.clone(state);if(target!==null)next.products[target]=record;else next.products.push(record);
   if(selectedPhoto){next.photos[id]=selectedPhoto;if(!next.pendingPhotos.includes(id))next.pendingPhotos.push(id);}
   await commit(next);formClose();
  }catch(e){notice.textContent=t(e.message);notice.hidden=false;showTab('details');notice.scrollIntoView({block:'nearest'});}
 });
 form.onsubmit=e=>{e.preventDefault();void editorSave();};attachCancel();
}
function productActions(index){const p=state.products[index];openEditor(lang==='cs'?p.csName||p.name:p.name,`${p.brand} / ${p.id}`,`<div class="action-menu">${button('action-edit','edit')}${button('action-copy','duplicate')}${button('action-delete','delete','danger-quiet')}</div>`,true);$('#action-edit').onclick=()=>openProduct(index);$('#action-copy').onclick=()=>openProduct(index,'details',true);$('#action-delete').onclick=async()=>{if(await confirm('deleteProduct',`${p.name||p.csName} (${p.id})\n\n${t('deleteProductHint')}`,'confirmDelete',true)){const next=M.clone(state);next.products.splice(index,1);await commit(next);formClose();}};}
function openBulk(){
 const chosen=[...selected];openEditor(t('bulk'),`${chosen.length} ${t('selected')}`,`<form id="bulk-form"><div class="form-content"><p>${t('bulkHint')}</p><label class="field"><span>${t('operation')}</span><select name="operation">${['setNew','clearNew','setDisc','clearDisc','addFlag','removeFlag'].map(v=>option(v,t(v),'')).join('')}</select></label>${field('flag','flag','','text','list="flag-list"')}${datalist('flag-list',flags())}<div id="form-error" class="notice error-notice" hidden></div></div>${formFooter('apply')}</form>`,true);
 const form=$('#bulk-form');form.elements.flag.closest('label').hidden=true;form.elements.operation.onchange=()=>form.elements.flag.closest('label').hidden=!['addFlag','removeFlag'].includes(form.elements.operation.value);
 editorSave=()=>runForm(async()=>{const op=form.elements.operation.value,f=form.elements.flag.value.trim();if(['addFlag','removeFlag'].includes(op)&&(!f||f.includes(','))){$('#form-error').textContent=t('checkFirst');$('#form-error').hidden=false;return;}
 const next=M.clone(state);for(const i of chosen){const p=next.products[i];if(op==='setNew'){p.new=true;p.new_date=p.new_date||today();}if(op==='clearNew'){p.new=false;p.new_date='';}if(op==='setDisc'){p.discontinued=true;p.discontinued_date=p.discontinued_date||today();}if(op==='clearDisc'){p.discontinued=false;p.discontinued_date='';}if(op==='addFlag')p.flags=[...new Set([...(p.flags||[]),f])];if(op==='removeFlag')p.flags=(p.flags||[]).filter(x=>x!==f);}
 await commit(next);formClose();});form.onsubmit=e=>{e.preventDefault();void editorSave();};attachCancel();
}
function openKey(brand='',oldKey=null,template=null){
 if(refreshing)return;
 let original=oldKey?M.clone(state.logistics[brand]?.[oldKey]||M.emptyLogistics()):M.clone(template||M.emptyLogistics()),working=M.clone(original);
 const used=oldKey?state.products.filter(p=>p.brand===brand&&M.key(p.key)===oldKey).length:0;
 openEditor(oldKey?`${brand} / ${oldKey}`:t('addKey'),t('keys'),`<form id="key-form" novalidate><div class="form-content"><div class="notice ${used?'amber':''}">${used?`${t('sharedWarning')} ${t('affected')}: ${used}.`:t('keyHelp')}</div><div id="form-error" class="notice error-notice" hidden></div><div class="form-grid key-identity">${field('brand','brand',brand||filters.brand,'text',`required list="brands" ${oldKey?'readonly':''}`)}${field('key','keyName',oldKey||'','text','required',t('keyRename'))}${oldKey?'':`<label class="field"><span>${t('copyFrom')}</span><select id="copy-key">${option('',t('blankKey'),'')}${M.keyEntries(state.logistics).map((r,i)=>option(i,`${r.brand} / ${r.key}`,'')).join('')}</select></label>`}</div>${datalist('brands',brands())}<p class="muted">${t('dimensionHint')}</p><div class="logistics-grid" id="logistics-fields"></div>${oldKey?`<div class="key-secondary-actions">${button('key-copy','duplicate')}${button('key-delete','delete','danger-quiet')}</div>`:''}</div>${formFooter('save',used?`${used} ${t('countProducts')}`:'')}</form>`);
 const form=$('#key-form');
 function renderFields(){
  $('#logistics-fields').innerHTML=Object.entries(M.sections).map(([s,fs])=>{const fields=[...new Set([...fs,...Object.keys(working[s]||{})])].filter(f=>f!=='carton_ean');return `<fieldset><legend><span class="section-letter">${s[0]}</span>${t(s)}</legend>${fields.map((f,i)=>field(`${s}:${f}`,f,working[s]?.[f],'text',`data-section="${s}" data-field="${esc(f)}" inputmode="decimal"`)).join('')}</fieldset>`;}).join('');
 }
 renderFields();if($('#copy-key'))$('#copy-key').onchange=e=>{working=e.target.value===''?M.emptyLogistics():M.clone(M.keyEntries(state.logistics)[Number(e.target.value)].data);renderFields();};
 if(oldKey){$('#key-delete').disabled=used>0;$('#key-delete').title=used?t('keyInUse'):'';$('#key-delete').onclick=async()=>{if(await confirm('deleteKey',t('deleteKeyHint'),'delete',true)){const next=M.clone(state);delete next.logistics[brand][oldKey];await commit(next);formClose();}};
 $('#key-copy').onclick=()=>{formClose();openKey(brand,null,original);editorDirty=true;};}
 editorSave=()=>runForm(async()=>{
  const notice=$('#form-error');notice.hidden=true;
  try{
   const b=form.elements.brand.value.trim(),k=M.key(form.elements.key.value);if(!M.key(b)||!k)throw Error('KEY_REQUIRED');
   if((!oldKey||k!==oldKey)&&Object.hasOwn(state.logistics[b]||{},k))throw Error('KEY_DUPLICATE');
   const data=M.clone(working);
   $$('[data-section]').forEach(input=>{const s=input.dataset.section,f=input.dataset.field,raw=input.value.trim(),old=data[s]?.[f];if(!data[s])data[s]={};
    if(String(old??'')===raw)return;
    if(M.sections[s].includes(f)&&raw){const m=raw.replace(',','.').match(/^\s*(\d+(?:\.\d+)?)\s*(cm|kg)?\s*$/i);if(!m||f.startsWith('nr_')&&(m[2]||!Number.isInteger(Number(m[1]))))throw Error('numeric');if(['length','width','height'].includes(f)&&m[2]&&m[2].toLowerCase()!=='cm'||f==='weight'&&m[2]&&m[2].toLowerCase()!=='kg')throw Error('numeric');}
    data[s][f]=raw===''?null:/^\d+(?:[.,]\d+)?$/.test(raw)?Number(raw.replace(',','.')):raw;
   });
   if(oldKey&&k===oldKey&&b===brand&&sig(data)===sig(original)){formClose();return;}
   if(used&&(sig(data)!==sig(original)||k!==oldKey)&&!await confirm('confirmShared',`${b} / ${k}\n${t('affected')}: ${used}\n\n${t('confirmSharedHint')}`,'save'))return;
   let next=M.clone(state);if(oldKey&&k!==oldKey)next=M.renameKey(next,b,oldKey,k);next=M.applyLogistics(next,b,k,data);await commit(next);formClose();
  }catch(e){notice.textContent=t(e.message);notice.hidden=false;notice.scrollIntoView({block:'nearest'});}
 });form.onsubmit=e=>{e.preventDefault();void editorSave();};attachCancel();
}
function downloadBlob(blob,name){const url=URL.createObjectURL(blob);downloadData(url,name);setTimeout(()=>URL.revokeObjectURL(url),1000);}
function downloadData(url,name){const a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();}
function downloadJSON(value,name){downloadBlob(new Blob([JSON.stringify(value,null,2)+'\n'],{type:'application/json;charset=utf-8'}),name);}
function backup(){downloadJSON({format:'jason-backup',version:1,createdAt:new Date().toISOString(),products:state.products,logistics:state.logistics,photos:state.photos,pendingPhotos:state.pendingPhotos},`jason-backup-${today()}.json`);}
function openData(){
 openEditor(t('dataTitle'),'JASON / DATA',`<div class="form-content data-content"><p>${t('dataHint')}</p>${JASON_CONFIG.sharedOnly?'<p class="notice amber">'+t('sharedOnly')+'</p>':''}<section class="data-section"><h3>${t('import')}</h3><div class="button-grid">${button('import-products','importProducts')}${button('import-logistics','importLogistics')}${button('restore-backup','restore')}${button('download-backup','backup','primary')}</div><div class="button-grid">${button('download-products','jsonProducts')}${button('download-logistics','jsonLogistics')}</div></section><section class="data-section"><h3>${t('connection')}</h3><p class="muted">${t('connectHint')}</p><div class="form-grid">${field('api','api',state.api,'url')}${field('images','images',state.imageBase,'url')}</div><div class="connection-actions">${button('connect','connect','primary')}${button('disconnect','disconnect')}<span>${t(state.connected?'connected':'local')}</span></div></section><p class="muted">${t('localOnly')}</p></div>`,true);
 $('#import-products').onclick=()=>importFile('products');$('#import-logistics').onclick=()=>importFile('logistics');$('#restore-backup').onclick=()=>importFile('backup');$('#download-backup').onclick=backup;$('#download-products').onclick=()=>downloadJSON(state.products,'products.json');$('#download-logistics').onclick=()=>downloadJSON(state.logistics,'logistics.json');
 if(JASON_CONFIG.sharedOnly){$('#field-api').readOnly=true;$('#field-images').readOnly=true;for(const id of ['import-products','import-logistics','restore-backup'])$('#'+id).disabled=!state.connected;}
 $('#connect').onclick=async()=>{const api=JASON_CONFIG.sharedOnly?JASON_CONFIG.apiBase:$('#field-api').value.trim().replace(/\/$/,''),imageBase=JASON_CONFIG.sharedOnly?JASON_CONFIG.imageBase:$('#field-images').value.trim().replace(/\/$/,'');try{for(const url of [api,imageBase]){const u=new URL(url);if(u.protocol!=='https:'&&!(u.protocol==='http:'&&['localhost','127.0.0.1'].includes(u.hostname)))throw Error(lang==='cs'?'Použijte adresu HTTPS.':'Use an HTTPS address.');}if(await confirm('connectConfirm',t('connectConfirmHint'),'connect'))await connect(api,imageBase);}catch(e){error(e);}};
 $('#disconnect').hidden=!!JASON_CONFIG.sharedOnly;$('#disconnect').disabled=!state.connected;$('#disconnect').onclick=async()=>{if(hasPending()&&!await confirm('disconnect',t('unsent'),'disconnect'))return;state.connected=false;await persist();render();openData();};
}
async function connect(api,imageBase,automatic=false){
 if(syncing||busy)return;busy=true;renderStatus();try{
  const [p,l]=await Promise.all([S.request(api,'products'),S.request(api,'logistics')]);M.validateProducts(p);M.validateLogistics(l);
  const next={...M.clone(state),products:p,logistics:l,photos:{},pendingPhotos:[],api,imageBase,connected:true,baseline:{products:sig(p),logistics:sig(l)}};
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
   next={...next,products:value.products,logistics:value.logistics,photos:value.photos||{},pendingPhotos:Object.keys(value.photos||{}),connected:JASON_CONFIG.sharedOnly?state.connected:false,baseline:JASON_CONFIG.sharedOnly?state.baseline:{}};
  }
  const extra=next.connected?'\n\n'+(lang==='cs'?'Po potvrzení se změna odešle také do společných dat.':'After confirmation the change will also be sent to shared data.'):'';
  if(!await confirm('importConfirm',file.name+'\n\n'+t('importConfirmHint')+extra,'confirm'))return;
  await commit(next,'loaded');formClose();
 }catch(err){error(err);}
};
function openExport(){
 openEditor(t('exportTitle'),'JASON / EXCEL',`<form id="export-form"><div class="form-content"><p>${t('exportHint')}</p><div class="editor-tabs"><button type="button" id="export-tab-products">${t('exportProducts')}</button><button type="button" id="export-tab-keys">${t('exportKeys')}</button></div><div id="export-options"></div></div>${formFooter('exportNow')}</form>`,true);
 let mode=view==='keys'?'keys':'products';
 function options(){
  $('#export-tab-products').setAttribute('aria-selected',mode==='products');$('#export-tab-keys').setAttribute('aria-selected',mode==='keys');
  if(mode==='products')$('#export-options').innerHTML=`<p class="notice">${filteredProducts().length} ${t('countProducts')}</p>`;
  else{$('#export-options').innerHTML=`<label class="field"><span>${t('brand')}</span><select id="export-brand">${option('',t('allBrands'),filters.brand)}${brands().map(v=>option(v,v,filters.brand)).join('')}</select></label><label class="checkbox-label"><input type="checkbox" id="include-empty">${t('includeEmpty')}</label><div class="export-controls">${button('keys-all','selectAll')}${button('keys-none','selectNone')}</div><div id="export-key-list" class="checkbox-list"></div>`;fillExportKeys();$('#export-brand').onchange=fillExportKeys;$('#include-empty').onchange=fillExportKeys;$('#keys-all').onclick=()=>$$('[data-export-key]').forEach(c=>c.checked=true);$('#keys-none').onclick=()=>$$('[data-export-key]').forEach(c=>c.checked=false);}
 }
 function fillExportKeys(){const b=$('#export-brand').value,include=$('#include-empty').checked;$('#export-key-list').innerHTML=M.keyEntries(state.logistics).map((r,i)=>({r,i})).filter(({r})=>(!b||r.brand===b)&&(include||completion(r.data)>0)).map(({r,i})=>`<label class="checkbox-label"><input type="checkbox" data-export-key="${i}" checked>${esc(r.brand)} / <strong>${esc(r.key)}</strong><small>${completion(r.data)}%</small></label>`).join('')||`<p class="muted">${t('nothing')}</p>`;}
 $('#export-tab-products').onclick=()=>{mode='products';options();};$('#export-tab-keys').onclick=()=>{mode='keys';options();};options();
 $('#export-form').onsubmit=e=>{e.preventDefault();try{if(mode==='products')exportProducts();else exportLogistics($$('[data-export-key]:checked').map(c=>M.keyEntries(state.logistics)[Number(c.dataset.exportKey)]));}catch(err){error(err);}};attachCancel();
}
function exportProducts(){
 const rows=filteredProducts();if(!rows.length)throw Error(t('nothing'));
 const names=['brand','type','id','hs','name','csName','volume','price','key','pack','boxes_per_layer','boxes_per_pallet','carton_ean','new','new_date','discontinued','discontinued_date','flags'];
 const data=[names.map(n=>t(n==='id'?'ean':n)),...rows.map(({p})=>names.map(n=>n==='volume'?`${p.volume?.number??''} ${p.volume?.unit||''}`.trim():n==='flags'?(p.flags||[]).join(', '):n==='type'?typeLabel(p[n]):['id','hs','carton_ean'].includes(n)?String(p[n]??''):p[n]??''))];
 const ws=XLSX.utils.aoa_to_sheet(data);ws['!cols']=names.map(n=>({wch:['name','csName'].includes(n)?45:n==='flags'?30:18}));ws['!autofilter']={ref:ws['!ref']};const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,'Products');XLSX.writeFile(wb,`products-${today()}.xlsx`);
}
function exportLogistics(entries){
 if(!entries.length)throw Error(t('nothing'));const wb=XLSX.utils.book_new();
 const byBrand=Object.groupBy?Object.groupBy(entries,r=>r.brand):entries.reduce((a,r)=>{(a[r.brand]||(a[r.brand]=[])).push(r);return a;},Object.create(null));
 for(const [brand,groups]of Object.entries(byBrand)){
  const data=[[`LOGISTICS DATA – ${brand}`],['Section','Attribute',...groups.map(r=>r.key)]],merges=[{s:{r:0,c:0},e:{r:0,c:groups.length+1}}];
  for(const [s,fs]of Object.entries(M.sections)){const start=data.length;for(const f of fs)data.push([s,`${JasonText.en[f]}${['length','width','height','weight'].includes(f)?'':''}`,...groups.map(r=>{const v=M.count(r.data[s]?.[f]);return v===''?'':v;})]);merges.push({s:{r:start,c:0},e:{r:data.length-1,c:0}});}
  const ws=XLSX.utils.aoa_to_sheet(data);ws['!merges']=merges;ws['!cols']=[{wch:12},{wch:24},...groups.map(()=>({wch:15}))];
  const base=brand.replace(/[\\/?*\[\]:]/g,' ').slice(0,28)||'Logistics';let name=base,n=1;while(wb.SheetNames.includes(name))name=base+' '+n++;XLSX.utils.book_append_sheet(wb,ws,name);
 }
 XLSX.writeFile(wb,`logistics-${today()}.xlsx`);
}
$('#editor-close').onclick=closeEditor;$('#editor').oncancel=e=>{e.preventDefault();void closeEditor();};$('#photo-close').onclick=()=>$('#photo-dialog').close();$('#data-button').onclick=openData;$('#help-button').onclick=()=>openEditor(t('help'),'JASON / QUICK START',`<div class="form-content"><p class="help-copy">${esc(t('helpText'))}</p></div>`,true);$('#export').onclick=openExport;$('#create').onclick=()=>view==='keys'?openKey():openProduct();$('#undo').onclick=()=>undo();$('#redo').onclick=()=>undo(true);$('#retry').onclick=()=>syncRemote();$$('[data-lang]').forEach(b=>b.onclick=async()=>{if($('#editor').open)await closeEditor();if($('#editor').open)return;lang=b.dataset.lang;await persist();render();});
window.addEventListener('beforeunload',e=>{if(syncing||storageError||editorDirty||hasPending()){e.preventDefault();e.returnValue='';}});
document.addEventListener('keydown',e=>{
 const mod=e.ctrlKey||e.metaKey;if(!mod||$('#confirm-dialog').open)return;
 if(e.key.toLowerCase()==='k'){e.preventDefault();if(!$('#editor').open)$('#search').focus();}
 if(e.key.toLowerCase()==='s'){e.preventDefault();if(editorSave)void editorSave();else if(!$('#editor').open)backup();}
 if(e.key.toLowerCase()==='z'&&!e.target.closest('input,textarea,[contenteditable]')){e.preventDefault();if(!$('#editor').open)void undo(e.shiftKey);}
});
window.addEventListener('hashchange',()=>{const v=location.hash.slice(1);if(['products','keys','checks'].includes(v)&&v!==view)changeView(v);});
async function refreshShared(automatic=false){
 if(refreshing||syncing||busy||automatic&&($('#editor').open||editorDirty||hasPending()))return;
 if(hasPending()&&!await confirm('connectConfirm',t('connectConfirmHint'),'refresh'))return;
 refreshing=true;refreshFailed=false;renderStatus();$('#create').disabled=true;
 try{
  const api=JASON_CONFIG.sharedOnly?JASON_CONFIG.apiBase:state.api;
  const [p,l]=await Promise.all([S.request(api,'products'),S.request(api,'logistics')]);M.validateProducts(p);M.validateLogistics(l);
  const changed=sig(p)!==sig(state.products)||sig(l)!==sig(state.logistics);
  if(changed){history=[];future=[];selected.clear();}
  state={...state,products:p,logistics:l,api,imageBase:JASON_CONFIG.sharedOnly?JASON_CONFIG.imageBase:state.imageBase,connected:true,baseline:{products:sig(p),logistics:sig(l)},pendingPhotos:[],updated:new Date().toISOString()};
  lastRefresh=Date.now();await persist();
 }catch(e){refreshFailed=true;toast(t(state.products.length?'refreshFailed':'sharedNotLoaded'),true);}
 finally{refreshing=false;render();}
}
async function boot(){
 try{const saved=await S.get('state');if(saved?.state){M.validateProducts(saved.state.products);M.validateLogistics(saved.state.logistics);state={...state,...saved.state};lang=saved.lang==='en'?'en':'cs';const recovery=await S.get('recovery');if(recovery)history=[recovery];}}
 catch(e){storageError=true;toast(t('localError'),true);}
 if(JASON_CONFIG.sharedOnly){state.api=JASON_CONFIG.apiBase;state.imageBase=JASON_CONFIG.imageBase;}
 view=['products','keys','checks'].includes(location.hash.slice(1))?location.hash.slice(1):'products';render();
 if(JASON_CONFIG.autoConnect||state.connected){if(!hasPending())await refreshShared(true);}
 else if(location.protocol!=='file:'&&['localhost','127.0.0.1'].includes(location.hostname)){
  try{const [pr,lr]=await Promise.all([fetch(JASON_CONFIG.legacyProducts),fetch(JASON_CONFIG.logisticsFile)]);if(pr.ok&&lr.ok){const p=await pr.json(),l=await lr.json();M.validateProducts(p);M.validateLogistics(l);state.products=p;state.logistics=l;await persist();render();}}catch{}
 }
}
if($('#refresh'))$('#refresh').onclick=()=>refreshShared(false);
window.addEventListener('focus',()=>{if(state.connected&&Date.now()-lastRefresh>15000)void refreshShared(true);});

void boot();
})();
