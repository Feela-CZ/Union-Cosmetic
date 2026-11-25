/* Private projects are loaded only by the sandbox entry point. */
(function(root){
'use strict';
if(root.JASON_CONFIG?.sandbox!==true)return;

const {ui,packaging,categories,stages,groups}=root.JasonProjectFields;
const storage=root.JasonStorage;
const key='private-projects-v1';
const tabs=['customer','product','production'];
const $=selector=>document.querySelector(selector);
const escape=value=>String(value??'').replace(/[&<>"']/g,char=>(
 {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
let language='cs',records,loading=false,loadError=false;
const drafts=new Map();
const filters={search:'',category:'',packaging:'',stage:''};

const local=pair=>pair[language==='en'?1:0];
const t=id=>local(ui[id]);
const optionText=(options,value)=>{
 const option=options.find(item=>item[0]===value);
 return option?local(option.slice(1)):'';
};
const active=()=>location.hash==='#projects'||location.hash.startsWith('#projects/');
const route=()=>location.hash.slice('#projects/'.length);
const keyFor=(spec,scope)=>scope?scope+':'+spec.key:spec.key;
const display=value=>value||'—';

function sections(tab,record){
 const {values,packagingValues}=record;
 return groups(tab,values,packagingValues?.[values.packaging]).map(section=>{
  const scope=section.packaging?values.packaging:'';
  return {...section,scope};
 });
}

function getValue(record,field,scope){
 return (scope?record.packagingValues?.[scope]:record.values)?.[field.key];
}

function draftFor(id){
 if(drafts.has(id))return drafts.get(id);
 const project=records.find(record=>record.id===id);
 if(!project&&id!=='new')return null;
 const draft={
  record:project?structuredClone(project):{id:crypto.randomUUID(),revision:0,values:{stage:'brief'},packagingValues:{}},
  tab:'customer',dirty:false,busy:false,message:''
 };
 drafts.set(id,draft);
 return draft;
}

function open(id){
 const hash=id?'#projects/'+id:'#projects';
 if(location.hash!==hash)location.hash=hash;
 else if(active())render(language);
}

async function load(){
 if(loading)return;
 loading=true;
 loadError=false;
 try{
  records=(await storage.get(key))??[];
  if(!Array.isArray(records))throw Error('Invalid projects');
 }catch{
  records=undefined;
  loadError=true;
 }finally{
  loading=false;
  updateCount();
  if(active())render(language);
 }
}

function count(){return records?.length??0;}
function options(items,selected,placeholder='—'){
 return '<option value="">'+escape(placeholder)+'</option>'+items.map(([value,cs,en])=>
  '<option value="'+escape(value)+'"'+(value===selected?' selected':'')+'>'+escape(local([cs,en]))+'</option>').join('');
}
function filterOptions(label,items,id){
 return '<select id="project-filter-'+id+'" aria-label="'+escape(t(label))+'">'+options(items,filters[id],t(label))+'</select>';
}
function button(label,attrs='',className=''){
 return '<button type="button" class="'+className+'" '+attrs+'>'+escape(t(label))+'</button>';
}

function list(){
 $('#toolbar').innerHTML='<label class="search-box"><span aria-hidden="true">⌕</span><input id="project-search" type="search" placeholder="'+escape(t('search'))+'" aria-label="'+escape(t('search'))+'" value="'+escape(filters.search)+'"></label>'+
  filterOptions('allCategories',categories,'category')+filterOptions('allPacks',packaging,'packaging')+filterOptions('allStages',stages,'stage');
 $('#project-search').oninput=event=>{filters.search=event.target.value;listRows();};
 for(const id of ['category','packaging','stage']){
  $('#project-filter-'+id).onchange=event=>{filters[id]=event.target.value;listRows();};
 }
 listRows();
}
function dateText(value,options={dateStyle:'medium'}){
 const date=new Date(value);
 return Number.isNaN(date.getTime())?'—':new Intl.DateTimeFormat(language==='cs'?'cs-CZ':'en-GB',options).format(date);
}
const searchable=value=>String(value??'').normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase();
function listRows(){
 const query=searchable(filters.search).trim();
 const filtered=records.filter(({values:v})=>
  ['category','packaging','stage'].every(id=>!filters[id]||v[id]===filters[id])&&
  [v.name,v.customer,v.productName,v.market].some(item=>searchable(item).includes(query)))
  .sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));
 if(!filtered.length){
  $('#content').innerHTML='<p class="project-empty">'+escape(t(records.length?'noMatches':'empty'))+'</p>';
  return;
 }
 const headings=['project','category','customer','packaging','market','stage','updated'];
 $('#content').innerHTML='<div class="table-wrap project-list"><table><thead><tr>'+
  headings.map(label=>'<th scope="col">'+escape(t(label))+'</th>').join('')+
  '</tr></thead><tbody>'+filtered.map(record=>{
   const v=record.values,href='#projects/'+encodeURIComponent(record.id);
   const link='<a class="product-link" href="'+href+'">'+escape(v.name)+'</a>';
   const cells=[optionText(categories,v.category),v.customer,optionText(packaging,v.packaging),v.market];
   return '<tr data-project-id="'+escape(record.id)+'"><td>'+link+(v.productName?'<div class="cell-sub">'+escape(v.productName)+'</div>':'')+'</td>'+
    cells.map((value,index)=>'<td data-label="'+escape(t(headings[index+1]))+'">'+escape(display(value))+'</td>').join('')+
    '<td data-label="'+escape(t('stage'))+'"><span class="badge project-stage stage-'+escape(v.stage)+'">'+escape(display(optionText(stages,v.stage)))+'</span></td>'+
    '<td data-label="'+escape(t('updated'))+'">'+escape(dateText(record.updatedAt))+'</td></tr>';
  }).join('')+'</tbody></table></div>';
 $('#content').querySelectorAll('[data-project-id]').forEach(row=>{
  row.onclick=event=>{if(!event.target.closest('a')&&!getSelection()?.toString())open(row.dataset.projectId);};
 });
}

function fieldHTML(record,field,scope){
 const value=getValue(record,field,scope);
 const label=escape(local(field.label)),id='project-'+keyFor(field,scope);
 const attributes=' data-project-field="'+field.key+'" data-scope="'+escape(scope)+'"';
 if(field.kind==='check'){
  return '<fieldset class="project-check"><legend>'+label+'</legend><div class="project-check-options">'+
   field.options.map(([code,cs,en])=>'<label><input type="radio" name="'+id+'" value="'+code+'"'+attributes+((value??'')===code?' checked':'')+'><span>'+escape(local([cs,en]))+'</span></label>').join('')+
   '</div></fieldset>';
 }
 const optional=field.kind==='optional';
 const current=optional?value?.text:value;
 const common=' id="'+id+'"'+attributes;
 let control;
 if(field.kind==='select')control='<select'+common+'>'+options(field.options,current)+'</select>';
 else if(field.kind==='address')control='<textarea rows="3"'+common+'>'+escape(current)+'</textarea>';
 else{
  const kind=['date','email','tel','number'].includes(field.kind)?field.kind:'text';
  const extra=(field.kind==='decimal'?' inputmode="decimal"':field.kind==='number'?' min="0" step="1"':'')+
   (optional?' data-project-optional'+(value?.na?' disabled':''):'')+(field.key==='name'?' required maxlength="160"':'');
  control='<input type="'+kind+'"'+common+extra+' value="'+escape(current)+'">';
 }
 const na=optional?'<label class="project-na"><input type="checkbox" data-na="'+field.key+'" data-scope="'+escape(scope)+'"'+(value?.na?' checked':'')+
  ' aria-label="'+label+' · N/A"> N/A</label>':'';
 return '<div class="field project-field'+(field.kind==='address'?' project-address':'')+'"><label for="'+id+'">'+label+'</label>'+
  '<div class="project-input">'+control+na+'</div></div>';
}
function status(draft){
 const statusElement=$('#project-save-feedback');
 if(!statusElement)return;
 statusElement.textContent=draft.busy?t('saving'):draft.message?t(draft.message):draft.dirty?t('unsaved'):'';
 statusElement.parentElement.hidden=!statusElement.textContent;
 statusElement.classList.toggle('project-error',Boolean(draft.message&&draft.message!=='saved'));
 const saveButton=$('#project-save');
 if(saveButton){
  saveButton.disabled=draft.busy;
  saveButton.textContent=t(draft.busy?'saving':'save');
 }
 const reload=$('#project-reload');
 if(reload)reload.hidden=draft.message!=='conflict';
}
function updateField(draft,target,isNA=false){
 const field=isNA?target.dataset.na:target.dataset.projectField;
 const scope=target.dataset.scope;
 const values=scope?(draft.record.packagingValues[scope]??={}):draft.record.values;
 if(isNA||target.hasAttribute('data-project-optional')){
  const previous=values[field]||{};
  values[field]=isNA?{...previous,na:target.checked}:{...previous,text:target.value};
  if(isNA)$('#project-'+keyFor({key:field},scope)).disabled=target.checked;
 }else values[field]=target.value;
 draft.dirty=true;
 draft.message='';
 status(draft);
 if(['packaging','cooperation','sample','marking','pouchClosure'].includes(field)){
  const checked=target.type==='radio'?target:null;
  const control=target.id;
  detail(route(),draft);
  if(checked){
   [...document.getElementsByName(checked.name)].find(input=>input.value===checked.value)?.focus({preventScroll:true});
  }else document.getElementById(control)?.focus({preventScroll:true});
 }
}

function detail(id,draft){
 const record=draft.record,v=record.values,tab=draft.tab,next=tabs[tabs.indexOf(tab)+1];
 $('#toolbar').innerHTML='<a class="project-back" href="#projects">‹ '+escape(t('back'))+'</a>'+
  '<div class="project-actions">'+button('print','id="project-print"')+button('download','id="project-download"')+
  button('save','id="project-save"','primary')+'</div>';
 $('#page-title').textContent=v.name?.trim()||t('add');
 $('#crumb').textContent=t('projects');
 $('#content').innerHTML='<div class="project-detail"><div class="project-tabs" role="tablist" aria-label="'+escape(t('tabLabel'))+'">'+
  tabs.map(name=>'<button type="button" role="tab" id="project-tab-'+name+'" data-project-tab="'+name+'" aria-controls="project-tab-panel" aria-selected="'+(tab===name)+'" tabindex="'+(tab===name?0:-1)+'">'+escape(t(name))+'</button>').join('')+
  '</div><div class="project-feedback" hidden><span id="project-save-feedback" role="status"></span>'+
  button('reload','id="project-reload" hidden')+'</div><div class="project-detail-body" id="project-tab-panel" role="tabpanel" aria-labelledby="project-tab-'+tab+'">'+
  sections(tab,record).map(section=>'<section class="project-section"><h2>'+escape(local(section.label))+
   '</h2><div class="project-fields">'+section.fields.map(field=>fieldHTML(record,field,section.scope)).join('')+'</div></section>').join('')+
  (next?'<div class="project-bottom">'+'<button id="project-next" type="button" class="primary">'+escape(t('next')+' · '+t(next))+'</button>'+'</div>':'')+'</div></div>';

 const panel=$('#project-tab-panel'),tablist=$('.project-tabs');
 function showTab(name){
  draft.tab=name;
  detail(id,draft);
  $('#project-tab-'+name).focus();
 }
 tablist.onclick=event=>{
  const selected=event.target.closest('[data-project-tab]');
  if(selected)showTab(selected.dataset.projectTab);
 };
 tablist.onkeydown=event=>{
  const index=tabs.indexOf(draft.tab),last=tabs.length-1;
  const target={'ArrowLeft':(index+last)%tabs.length,'ArrowRight':(index+1)%tabs.length,Home:0,End:last}[event.key];
  if(target!==undefined){event.preventDefault();showTab(tabs[target]);}
 };
 panel.oninput=event=>{
  const target=event.target;
  if(target.dataset.projectField&&!target.matches('select, input[type="radio"]'))updateField(draft,target);
 };
 panel.onchange=event=>{
  const target=event.target;
  if(target.dataset.na)updateField(draft,target,true);
  else if(target.dataset.projectField&&target.matches('select, input[type="radio"]'))updateField(draft,target);
 };
 if(next)$('#project-next').onclick=()=>showTab(next);
 $('#project-reload').onclick=async()=>{
  if(!confirm(t('reloadConfirm')))return;
  drafts.delete(route());
  records=undefined;
  render(language);
 };
 $('#project-save').onclick=save;
 $('#project-print').onclick=()=>print(record);
 $('#project-download').onclick=()=>download(record);
 status(draft);
}

async function save(){
 if(!active()||!route()||!records)return;
 const id=route(),draft=draftFor(id);
 if(!draft||draft.busy)return;
 const name=draft.record.values.name?.trim();
 if(!name){
  draft.tab='customer';
  draft.message='required';
  detail(id,draft);
  $('#project-name').focus();
  return;
 }
 draft.busy=true;
 const next=structuredClone(draft.record);
 next.values.name=name;
 next.updatedAt=new Date().toISOString();
 next.revision++;
 const snapshot=draft.record;
 status(draft);
 try{
  records=await storage.update(key,current=>{
   const projects=current??[];
   const saved=projects.find(project=>project.id===next.id);
   if((saved?.revision??0)!==snapshot.revision)throw Error('CONFLICT');
   return saved?projects.map(project=>project.id===next.id?next:project):[...projects,next];
  });
  // Preserve any typing that happened while IndexedDB was writing.
  const changed=JSON.stringify(snapshot.values)!==JSON.stringify(next.values)||
   JSON.stringify(snapshot.packagingValues)!==JSON.stringify(next.packagingValues);
  draft.record=changed?{...snapshot,revision:next.revision,updatedAt:next.updatedAt}:structuredClone(next);
  draft.dirty=changed;
  draft.message=changed?'':'saved';
  drafts.delete(id);
  drafts.set(next.id,draft);
  if(active()&&route()===id){
   const focused=document.activeElement?.id;
   history.replaceState(null,'','#projects/'+next.id);
   // Keep focus and text entry intact if a change arrived during the save.
   if(!changed){detail(next.id,draft);if(focused)document.getElementById(focused)?.focus({preventScroll:true});}
  }
  updateCount();
 }catch(error){
  draft.message=error.message==='CONFLICT'?'conflict':'saveError';
 }finally{
  draft.busy=false;
  if(active()&&[id,draft.record.id].includes(route()))status(draft);
 }
}

function summary(record){
 const title=escape(record.values.name?.trim()||t('add'));
 const content=tabs.map(tab=>{
  const sectionsHTML=sections(tab,record).map(section=>'<section><h3>'+escape(local(section.label))+'</h3><dl>'+
   section.fields.map(field=>{
    const value=getValue(record,field,section.scope);
    const description=field.options?optionText(field.options,value):field.kind==='optional'?(value?.na?'N/A':value?.text):value;
    return '<div><dt>'+escape(local(field.label))+'</dt><dd>'+escape(display(description))+'</dd></div>';
   }).join('')+'</dl></section>').join('');
  return '<article><h2>'+escape(t(tab))+'</h2>'+sectionsHTML+'</article>';
 }).join('');
 return {title,html:'<h1>'+title+'</h1>'+content};
}
function print(record){
 $('#project-print-sheet')?.remove();
 const node=document.createElement('div');
 node.id='project-print-sheet';
 node.className='project-print-document';
 node.innerHTML=summary(record).html;
 document.body.append(node);
 document.body.classList.add('project-printing');
 const cleanup=()=>{
  node.remove();
  if(!$('#project-print-sheet'))document.body.classList.remove('project-printing');
 };
 window.addEventListener('afterprint',cleanup,{once:true});
 try{window.print();}catch(error){cleanup();throw error;}
}
function download(record){
 const page=summary(record);
 const style='body{font:14px system-ui,sans-serif;max-width:1050px;margin:2rem auto;padding:0 1rem;color:#182438}h1{font-size:2rem}h2{margin-top:1.4em;border-bottom:1px solid #8f9db1;padding-bottom:.3em}h3{margin-bottom:0}dl{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:.6rem;margin:.5rem 0 1rem}dl div{border:1px solid #cad1db;padding:.45rem;break-inside:avoid}dt{font-size:.8em;font-weight:600}dd{margin:.2em 0 0;white-space:pre-wrap;overflow-wrap:anywhere}@page{size:A4;margin:12mm}@media print{body{margin:0;padding:0;font-size:10pt}h2,h3{break-after:avoid}dl{grid-template-columns:repeat(3,minmax(0,1fr))}}';
 const data='<!doctype html><html lang="'+language+'"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+page.title+'</title><style>'+style+'</style><body>'+page.html+'</body></html>';
 const url=URL.createObjectURL(new Blob([data],{type:'text/html;charset=utf-8'}));
 const link=document.createElement('a');
 link.href=url;
 link.download=(record.values.name?.trim().replace(/[^\p{L}\p{N}._-]+/gu,'-').slice(0,90)||'private-project')+'.html';
 document.body.append(link);
 link.click();
 link.remove();
 setTimeout(()=>URL.revokeObjectURL(url),1000);
}

function updateCount(){
 const badge=$('[data-view="projects"] .nav-count');
 if(badge)badge.textContent=count();
}
function render(lang){
 language=lang;
 const id=route();
 const create=$('#create'),toolbar=$('#toolbar');
 create.textContent='+ '+t('add');
 create.hidden=Boolean(id);
 create.disabled=!records;
 toolbar.innerHTML='';
 $('#bulk-bar').hidden=true;
 $('#pagination').innerHTML='';
 $('#page-title').textContent=t('projects');
 $('#crumb').textContent=t('projects');
 if(!records){
  $('#content').innerHTML='<div class="project-empty"><p>'+escape(t(loadError?'error':'loading'))+'</p>'+
   (loadError?button('retry','id="projects-retry"'):'')+'</div>';
  if(loadError)$('#projects-retry').onclick=load;
  else void load();
  return;
 }
 updateCount();
 if(!id){
  for(const [draftId,draft] of drafts)if(!draft.dirty&&!draft.busy)drafts.delete(draftId);
  list();
  return;
 }
 const draft=draftFor(id);
 if(draft)detail(id,draft);
 else{
  toolbar.innerHTML='<a class="project-back" href="#projects">‹ '+escape(t('back'))+'</a>';
  $('#content').innerHTML='<p class="project-empty">'+escape(t('notFound'))+'</p>';
 }
}

root.JasonPrivateProjects={
 title:lang=>ui.projects[lang==='en'?1:0],
 count,render,load,create:()=>open('new'),save,
 hasDrafts:()=>[...drafts.values()].some(draft=>draft.dirty||draft.busy)
};
})(window);
