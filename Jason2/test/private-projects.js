/* Private projects are loaded only by the sandbox entry point. */
(function(root){
'use strict';
if(root.JASON_CONFIG?.sandbox!==true)return;

const {ui,packaging,categories,currencies,dpakSizes,groups,note,requiredFields,completeField,numericKind,validNumber,attachmentSections,usesDirectPrint}=root.JasonProjectFields;
const storage=root.JasonStorage;
const key='private-projects-v1';
const categoryKey='private-project-categories-v1';
const formTabs=['customer','product','attachments'];
const tabs=[...formTabs,'history'];
const newCategory='__new_category';
const $=selector=>document.querySelector(selector);
const escape=value=>String(value??'').replace(/[&<>"']/g,char=>(
 {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
let language='cs',records,customCategories=[],loading=false,loadError=false;
let notify=()=>{},sort={field:'updated',asc:false};
const drafts=new Map();
const filters={search:'',customer:'',category:'',packaging:''};

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
const categoryOptions=()=>[...categories,...customCategories.map(({id,name})=>[id,name,name])];
const customerName=value=>String(value??'').trim();
const customerOptions=()=>[...new Set(records.map(record=>customerName(record.values.customer)).filter(Boolean))]
 .sort((a,b)=>a.localeCompare(b,language==='cs'?'cs':'en')).map(name=>[name,name,name]);
const projectTitle=({values:v})=>[customerName(v.customer),v.productName?.trim()||optionText(categoryOptions(),v.category),
 optionText(packaging,v.packaging)].filter(Boolean).join(' · ')||t('unnamedProject');
const optionalField=field=>['optional','optionalMultiline'].includes(field.kind);
const attachmentNotes={...note(),key:'attachmentNotes'};
const approvalStates=new Set(['ok','approved']);
const evidenceSlots=field=>[].concat(field.attachment??[]);
const hasEvidence=(record,field)=>evidenceSlots(field).some(key=>record.attachments?.[key]?.length);
const fieldsThatRebuild=new Set(['packaging','cooperation','category','marking','batchMode','barrier','compatibility']);

function sections(tab,record){
 const {values,packagingValues}=record;
 return groups(tab,values,packagingValues?.[values.packaging]).map(section=>{
  const scope=section.packaging?values.packaging:'';
  return {...section,scope};
 });
}

function getValue(record,field,scope){
 const values=scope?record.packagingValues?.[scope]:record.values;
 const value=values?.[field.key];
 if(field.key==='taxId'&&value===undefined){
  return values.vat?.text&&!values.vat.na?values.vat:values.tin??values.vat;
 }
 if(field.key==='responsiblePerson'){
  const name=searchable(value?.text??value).trim();
  if(['union','union cosmetic','union cosmetic s.r.o.'].includes(name))return 'union';
  if(['customer','zakaznik'].includes(name)||name&&name===searchable(record.values.customer).trim())return 'customer';
  return '';
 }
 if(field.key==='productEan'&&field.kind!=='optional'&&typeof value==='object')return value?.na?'':value?.text;
 if(optionalField(field)&&typeof value==='string')return {text:value,na:false};
 return value;
}

function changePackaging(record,pack){
 const v=record.values;
 if(v.packaging==='dpak'){
  record.dpakFill=v.fill??'';
  Object.assign(v,record.otherFill??{fill:'',fillUnit:''});
 }
 if(pack==='dpak'){
  record.otherFill={fill:v.fill??'',fillUnit:v.fillUnit??''};
  v.fill=record.dpakFill??'';
  v.fillUnit='ml';
 }
 v.packaging=pack;
}

function moveToNotes(values,field,notes){
 const text=values?.[field];
 if(!text)return;
 if(values[notes]!==text)values[notes]=[values[notes],text].filter(Boolean).join('\n\n');
 delete values[field];
}

function normalizeProject(project){
 const record=structuredClone(project),v=record.values;
 v.currency=String(v.currency??'').trim().toUpperCase();
 moveToNotes(v,'sampleReference','formulaNotes');
 if(v.packaging==='dpak'){
  if(v.fill&&!dpakSizes.includes(String(v.fill))){
   record.legacyDpakFill={fill:v.fill,fillUnit:v.fillUnit};
   v.fill='';
  }else v.fill=String(v.fill??'');
  v.fillUnit='ml';
 }
 for(const data of Object.values(record.packagingValues)){
  if(data.batchMode===undefined){
   const batch=data.batchFormat;
   const text=batch?.text??batch;
   if(batch?.na)data.batchMode='na';
   else if(searchable(text).trim()==='standard')data.batchMode='standard';
   else if(text)data.batchMode='other';
   if(batch&&typeof batch==='object')data.batchFormat=batch.text??'';
  }
  if(data.cartonLabelApproved==='ok')data.cartonLabelApproved='approved';
  if(data.artworkCustomer===undefined&&data.artworkApproved==='na')data.artworkCustomer='na';
  if(data.artworkUnion===undefined&&data.artworkApproved==='na')data.artworkUnion='na';
  moveToNotes(data,'labelSpec','markingNotes');
 }
 moveToNotes(record.packagingValues.doypack,'primaryNotes','markingNotes');
 const slots=record.attachments??={};
 for(const key of ['other','trial']){
  for(const file of slots[key]??[]){
   const id='custom-'+file.id;
   (record.attachmentNames??={})[id]=file.name;
   slots[id]=[file];
  }
  delete slots[key];
 }
 return record;
}

function completeness(record){
 const required=requiredFields(record.values);
 const filled=required.filter(key=>{
  const scope=key==='productEan'?record.values.packaging:'';
  const value=key==='productEan'&&!scope?'':getValue(record,{key},scope);
  if(key==='fill'&&record.values.packaging==='dpak')return dpakSizes.includes(String(value));
  if(key==='fillUnit'&&record.values.packaging==='dpak')return true;
  if(key==='currency')return currencies.some(([code])=>code===String(value??'').trim().toUpperCase());
  return completeField(key,value);
 }).length;
 return Math.round(filled/required.length*100);
}

function draftFor(id){
 if(drafts.has(id))return drafts.get(id);
 const project=records.find(record=>record.id===id);
 if(!project&&id!=='new')return null;
 const draft={
  record:project?normalizeProject(project):{id:crypto.randomUUID(),revision:0,values:{},packagingValues:{}},
  tab:'customer',dirty:false,editCount:0,busy:false,message:''
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
  const [items,taxonomy]=await Promise.all([storage.get(key),storage.get(categoryKey)]);
  records=items??[];
  customCategories=taxonomy??[];
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
  filterOptions('allCustomers',customerOptions(),'customer')+filterOptions('allCategories',categoryOptions(),'category')+filterOptions('allPacks',packaging,'packaging');
 $('#project-search').oninput=event=>{filters.search=event.target.value;listRows();};
 for(const id of ['customer','category','packaging']){
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
 const headings=['customer','product','category','packaging','market','complete','updated'];
 const categories=categoryOptions();
 const filtered=records.map(record=>{
  const {values:v}=record;
  return {record,cells:{customer:customerName(v.customer),product:v.productName??'',
   category:optionText(categories,v.category),packaging:optionText(packaging,v.packaging),market:v.market??''}};
 }).filter(({record,cells})=>
  (!filters.customer||cells.customer===filters.customer)&&
  ['category','packaging'].every(id=>!filters[id]||record.values[id]===filters[id])&&
  Object.values(cells).some(item=>searchable(item).includes(query)));
 if(!filtered.length){
  $('#content').innerHTML='<p class="project-empty">'+escape(t(records.length?'noMatches':'empty'))+'</p>';
  return;
 }
 for(const {record,cells} of filtered){
  cells.complete=completeness(record);
  cells.updated=Date.parse(record.updatedAt);
 }
 const collator=new Intl.Collator(language,{numeric:true});
 const missing=value=>value===''||Number.isNaN(value);
 filtered.sort((a,b)=>{
  const av=a.cells[sort.field],bv=b.cells[sort.field];
  if(missing(av)!==missing(bv))return missing(av)?1:-1;
  if(missing(av))return 0;
  const order=typeof av==='number'?av-bv:collator.compare(av,bv);
  return sort.asc?order:-order;
 });
 $('#content').innerHTML='<div class="table-wrap project-list"><table><thead><tr>'+
  headings.map(field=>{
   const active=sort.field===field;
   return '<th scope="col"'+(active?' aria-sort="'+(sort.asc?'ascending':'descending')+'"':'')+'>'+
    '<button type="button" class="sort-button" data-project-sort="'+field+'">'+escape(t(field))+
    (active?'<span aria-hidden="true"> '+(sort.asc?'↑':'↓')+'</span>':'')+'</button></th>';
  }).join('')+
  '</tr></thead><tbody>'+filtered.map(({record,cells})=>{
   const href='#projects/'+encodeURIComponent(record.id);
   const link='<a class="product-link" href="'+href+'">'+escape(cells.customer||t('unnamedProject'))+'</a>';
   const percent=cells.complete;
   return '<tr data-project-id="'+escape(record.id)+'"><td>'+link+'</td>'+
    headings.slice(1,5).map(field=>'<td data-label="'+escape(t(field))+'">'+escape(display(cells[field]))+'</td>').join('')+
    '<td data-label="'+escape(t('complete'))+'"><span class="completeness"><span aria-hidden="true"><i style="width:'+percent+'%"></i></span>'+percent+'%</span></td>'+
    '<td data-label="'+escape(t('updated'))+'">'+escape(dateText(record.updatedAt))+'</td></tr>';
  }).join('')+'</tbody></table></div>';
 for(const control of document.querySelectorAll('[data-project-sort]')){
  control.onclick=()=>{
   const field=control.dataset.projectSort;
   sort={field,asc:sort.field===field?!sort.asc:true};
   listRows();
   $('[data-project-sort="'+field+'"]').focus({preventScroll:true});
  };
 }
 $('#content').querySelectorAll('[data-project-id]').forEach(row=>{
  row.onclick=event=>{if(!event.target.closest('a')&&!getSelection()?.toString())open(row.dataset.projectId);};
 });
}

function fieldHTML(record,field,scope){
 const value=getValue(record,field,scope);
 const required=requiredFields(record.values).includes(field.key);
 const mark=required?'<span class="project-required" title="'+escape(t('requiredField'))+'" aria-label="'+escape(t('requiredField'))+'"> *</span>':'';
 const label=escape(local(field.label)),id='project-'+keyFor(field,scope);
 const attributes=' data-project-field="'+field.key+'" data-scope="'+escape(scope)+'"';
 if(field.kind==='checkbox'){
  const ready=trialReady(record.packagingValues[scope]??{},field.key);
  return '<label class="project-trial"><input type="checkbox" id="'+id+'"'+attributes+(ready?'':' disabled')+
   (value==='ok'?' checked':'')+'>'+label+'</label>';
 }
 if(field.kind==='check'){
  return '<fieldset class="project-check'+(field.row?' project-approval-row':'')+'"><legend>'+label+'</legend><div class="project-check-options">'+
   field.options.map(([code,cs,en])=>'<label><input type="radio" name="'+id+'" value="'+code+'"'+attributes+((value??'')===code?' checked':'')+'><span>'+escape(local([cs,en]))+'</span></label>').join('')+
   '</div></fieldset>';
 }
 const optional=optionalField(field);
 const current=optional?value?.text:value;
 const number=numericKind(field);
 const common=' id="'+id+'"'+attributes+(required?' aria-required="true"':'')+
  (optional?' data-project-optional'+(value?.na?' disabled':''):'');
 let control;
 if(field.kind==='select'){
  const items=field.key==='category'?[...categoryOptions(),[newCategory,...ui.otherCategory]]:field.options;
  control='<select'+common+'>'+options(items,current)+'</select>';
 }else if(field.kind==='fixed')control='<input'+common+' value="ml" readonly>';
 else if(['address','multiline','optionalMultiline','notes'].includes(field.kind)){
  control='<textarea rows="'+(field.kind==='address'?6:3)+'"'+common+'>'+escape(current)+'</textarea>';
 }else{
  const kind=['date','email','tel'].includes(field.kind)?field.kind:'text';
  const inputMode=number==='decimal'?'decimal':['number','ean'].includes(number)?'numeric':'';
  const extra=(number?' data-project-number="'+number+'"':'')+(inputMode?' inputmode="'+inputMode+'"':'');
  control='<input type="'+kind+'"'+common+extra+' value="'+escape(current)+'">';
 }
 const na=optional?'<label class="project-na"><input type="checkbox" data-na="'+field.key+'" data-scope="'+escape(scope)+'"'+(value?.na?' checked':'')+
  ' aria-label="'+label+' · N/A"> N/A</label>':'';
 const width=field.kind==='address'?' project-address':['multiline','optionalMultiline','notes'].includes(field.kind)?' project-wide':'';
 const upload=field.upload?attachmentHTML(attachmentSections.find(section=>section.key===field.upload),record):'';
 return '<div class="field project-field'+width+(field.upload?' project-with-attachment':'')+'"><label for="'+id+'">'+label+mark+'</label>'+
  '<div class="project-input">'+control+na+'</div>'+upload+'</div>';
}

function trialReady(data,key){
 return Boolean(data.barrier&&(key==='compatibility'||data.compatibility==='ok'));
}

function validateInput(control){
 const kind=control.dataset.projectNumber;
 if(!kind)return;
 const message=!control.disabled&&!validNumber(kind,control.value)?t(kind):'';
 control.setCustomValidity(message);
 control.toggleAttribute('aria-invalid',Boolean(message));
}

function status(draft){
 const statusElement=$('#project-save-feedback');
 if(!statusElement)return;
 statusElement.textContent=draft.busy?t('saving'):draft.message?t(draft.message):draft.dirty?t('unsaved'):'';
 statusElement.parentElement.hidden=!statusElement.textContent;
 statusElement.classList.toggle('project-error',Boolean(draft.message));
 const saveButton=$('#project-save');
 if(saveButton){
  saveButton.disabled=draft.busy;
  saveButton.textContent=t(draft.busy?'saving':'save');
 }
 const reload=$('#project-reload');
 if(reload)reload.hidden=draft.message!=='conflict';
}
async function updateField(draft,target,isNA=false){
 const field=isNA?target.dataset.na:target.dataset.projectField;
 if(target.readOnly)return;
 if(field==='category'&&target.value===newCategory){
  target.value=draft.record.values.category??'';
  createCategory(draft);
  return;
 }
 const record=draft.record,scope=target.dataset.scope;
 const values=scope?(record.packagingValues[scope]??={}):record.values;
 const spec=sections(draft.tab,record).flatMap(section=>section.fields).find(spec=>spec.key===field);
 if(spec?.attachment&&approvalStates.has(target.value)&&!hasEvidence(record,spec)){
  const labels=evidenceSlots(spec).map(key=>local(attachmentSections.find(section=>section.key===key).label));
  const names=new Intl.ListFormat(language==='cs'?'cs':'en',{type:'disjunction'}).format(labels);
  const message=language==='cs'?'Přidej přílohu ('+names+'), nebo potvrď bez ní.':'Add an attachment ('+names+'), or confirm without it.';
  if(!await projectConfirm('attachmentMissing',message,'approveAnyway')){
   detail(route(),draft);
   focusField(target);
   return;
  }
 }
 if(isNA||target.hasAttribute('data-project-optional')){
  const previous=getValue(record,{key:field,kind:'optional'},scope)||{};
  values[field]=isNA?{...previous,na:target.checked}:{...previous,text:target.value};
  const input=$('#project-'+keyFor({key:field},scope));
  input.disabled=values[field].na===true;
  validateInput(input);
 }else if(field==='packaging')changePackaging(record,target.value);
 else if(spec?.kind==='checkbox'){
  if(!trialReady(values,field))return;
  values[field]=target.checked?'ok':'';
  if(field==='compatibility'&&!target.checked)values.lineTrial='';
 }else{
  if(field==='marking'&&(values.marking==='print')!==(target.value==='print')){
   values.artworkCustomer='';
   values.artworkUnion='';
  }
  if(field==='barrier'&&values.barrier&&values.barrier!==target.value){
   values.compatibility='';
   values.lineTrial='';
  }
  values[field]=target.value;
  validateInput(target);
 }
 if(['customer','productName'].includes(field))$('#page-title').textContent=projectTitle(record);
 markEdited(draft);
 if(fieldsThatRebuild.has(field)){
  detail(route(),draft);
  focusField(target);
 }
}

function focusField(target){
 const control=target.type==='radio'
  ?[...document.getElementsByName(target.name)].find(input=>input.value===target.value)
  :document.getElementById(target.id);
 control?.focus({preventScroll:true});
}

function projectConfirm(title,message,action){
 const dialog=document.createElement('dialog');
 dialog.className='confirm-dialog project-modal';
 dialog.setAttribute('aria-labelledby','project-confirm-title');
 dialog.innerHTML='<h2 id="project-confirm-title">'+escape(t(title))+'</h2><p>'+escape(message)+'</p>'+
  '<div class="dialog-actions">'+button('cancel','data-project-cancel')+button(action,'data-project-confirm','primary')+'</div>';
 document.body.append(dialog);
 dialog.showModal();
 return new Promise(resolve=>{
  const finish=accepted=>{dialog.close();dialog.remove();resolve(accepted);};
  dialog.querySelector('[data-project-cancel]').onclick=()=>finish(false);
  dialog.querySelector('[data-project-confirm]').onclick=()=>finish(true);
  dialog.oncancel=event=>{event.preventDefault();finish(false);};
 });
}

function markEdited(draft){
 draft.dirty=true;
 draft.editCount++;
 draft.message='';
 status(draft);
}

function createCategory(draft){
 const dialog=document.createElement('dialog');
 dialog.className='small project-category-dialog project-modal';
 dialog.setAttribute('aria-labelledby','project-category-title');
 dialog.innerHTML='<form><h2 id="project-category-title">'+escape(t('newCategory'))+'</h2>'+
  '<label class="field"><span>'+escape(t('categoryName'))+'</span><input name="name" required maxlength="80"></label>'+
  '<p class="project-error" role="alert" hidden></p><div class="dialog-actions">'+
  button('cancel','data-category-cancel')+'<button type="submit" class="primary">'+escape(t('save'))+'</button></div></form>';
 document.body.append(dialog);
 const form=dialog.querySelector('form'),input=form.elements.namedItem('name');
 dialog.onclose=()=>{dialog.remove();$('#project-category')?.focus({preventScroll:true});};
 const cancel=dialog.querySelector('[data-category-cancel]');
 cancel.onclick=()=>dialog.close();
 dialog.oncancel=event=>{if(cancel.disabled)event.preventDefault();};
 form.onsubmit=async event=>{
  event.preventDefault();
  const name=input.value.trim();
  if(!name){input.value='';input.reportValidity();return;}
  const submit=dialog.querySelector('[type="submit"]');
  submit.disabled=cancel.disabled=true;
  const existing=categories.find(item=>item.slice(1).some(label=>searchable(label)===searchable(name)));
  try{
   if(existing)draft.record.values.category=existing[0];
   else{
    customCategories=await storage.update(categoryKey,stored=>{
     const known=stored??[];
     return known.some(item=>searchable(item.name)===searchable(name))?known:[...known,{id:crypto.randomUUID(),name}];
    });
    draft.record.values.category=customCategories.find(item=>searchable(item.name)===searchable(name)).id;
   }
   markEdited(draft);
   dialog.close();
   if(active())detail(route(),draft);
   $('#project-category')?.focus({preventScroll:true});
  }catch{
   const error=dialog.querySelector('[role="alert"]');
   error.textContent=t('categoryError');
   error.hidden=false;
  }finally{submit.disabled=cancel.disabled=false;}
 };
 dialog.showModal();
 input.focus();
}

function visibleAttachments(record){
 const {packaging:pack,cooperation}=record.values;
 const fields=sections('product',record).flatMap(section=>section.fields);
 const directPrint=usesDirectPrint(pack,record.packagingValues[pack]);
 return [
  ...attachmentSections.map(section=>({...section,hideUpload:section.legacy||
   (section.key==='print'&&!directPrint)||(directPrint&&['front','back'].includes(section.key))})).filter(({key,hideUpload})=>{
   if(record.attachments?.[key]?.length)return true;
   if(hideUpload)return false;
   if(key==='batch')return fields.some(field=>field.upload===key);
   if(key==='bulkCoa'||key==='bulkProcessing')return cooperation==='cofilling';
   if(key==='carton')return !['ibc','drum','bag'].includes(pack);
   return true;
  }),
  ...Object.entries(record.attachmentNames??{}).map(([key,name])=>({key,label:[name,name],multiple:true}))
 ];
}

function attachmentHTML({key,label,multiple,hideUpload},record){
 const files=record.attachments?.[key]??[];
 const action=multiple?'dropFiles':files.length?'dropReplacement':'dropFile';
 const id='project-attachment-'+escape(key);
 return '<section class="project-attachment-section"><h3 id="'+id+'">'+escape(local(label))+'</h3>'+
  (hideUpload?'':button(action,'data-add-attachment="'+escape(key)+'" aria-describedby="'+id+'"','ppwr-drop project-attachment-drop')+
  '<input data-attachment-input="'+escape(key)+'" type="file"'+(multiple?' multiple':'')+' hidden>')+
  (files.length?'<ul class="project-attachment-list">'+files.map(file=>'<li><span>'+escape(file.name)+'</span><div>'+
   button('getFile','data-download-attachment="'+escape(file.id)+'"')+
   button('removeFile','data-remove-attachment="'+escape(file.id)+'"')+'</div></li>').join('')+'</ul>':
   key==='back'&&record.attachments?.front?.length?'<p class="project-attachment-na">N/A</p>':'')+'</section>';
}

function attachmentsHTML(record){
 return '<div class="project-attachment-grid">'+
  [...visibleAttachments(record),{key:'other',label:ui.otherFiles,multiple:true}]
   .map(section=>attachmentHTML(section,record)).join('')+
  '</div><section class="project-section project-fields">'+fieldHTML(record,attachmentNotes,'')+'</section>';
}

function nameAttachment(draft,files){
 const dialog=document.createElement('dialog');
 dialog.className='small project-category-dialog project-modal';
 dialog.setAttribute('aria-labelledby','project-attachment-name-title');
 dialog.innerHTML='<form><h2 id="project-attachment-name-title">'+escape(t('attachmentName'))+'</h2>'+
  '<input name="name" aria-labelledby="project-attachment-name-title" required maxlength="100">'+
  '<div class="dialog-actions">'+button('cancel','data-name-cancel')+
  '<button type="submit" class="primary">'+escape(t('save'))+'</button></div></form>';
 document.body.append(dialog);
 const form=dialog.querySelector('form'),input=form.elements.namedItem('name');
 const close=()=>{dialog.close();dialog.remove();};
 dialog.querySelector('[data-name-cancel]').onclick=close;
 dialog.oncancel=event=>{event.preventDefault();close();};
 form.onsubmit=event=>{
  event.preventDefault();
  const name=input.value.trim();
  if(!name){input.value='';input.reportValidity();return;}
  const key='custom-'+crypto.randomUUID();
  (draft.record.attachmentNames??={})[key]=name;
  setAttachments(draft,key,files,true);
  close();
  detail(route(),draft);
  $('[data-add-attachment="other"]')?.focus({preventScroll:true});
 };
 dialog.showModal();
 input.focus();
}

function setAttachments(draft,key,files,multiple){
 const record=draft.record,slots=record.attachments??={};
 for(const {field,scope} of approvedUsing(record,key)){
  if(!hasEvidence(record,field))continue;
  const values=scope?record.packagingValues[scope]:record.values;
  values[field.key]='';
 }
 const selected=files.map(file=>({id:crypto.randomUUID(),name:file.name,blob:file}));
 slots[key]=multiple?[...(slots[key]??[]),...selected]:selected;
 markEdited(draft);
}

function findFile(record,id){
 return Object.values(record.attachments??{}).flat().find(file=>file.id===id)??record.historyFiles?.[id];
}

function downloadAttachment(record,id){
 const saved=records?.find(project=>project.id===record.id);
 const file=findFile(record,id)??(saved&&findFile(saved,id));
 if(file)downloadFile(new Blob([file.blob],{type:'application/octet-stream'}),file.name);
}

function bindAttachments(panel,draft){
 const record=draft.record;
 function addFiles(key,fileList){
  if(!key||!fileList?.length)return;
  if(key==='other'){nameAttachment(draft,Array.from(fileList));return;}
  const section=visibleAttachments(record).find(item=>item.key===key);
  if(!section)return;
  const files=Array.from(fileList).slice(0,section.multiple?undefined:1);
  setAttachments(draft,key,files,section.multiple);
  detail(route(),draft);
  panelForAttachment(key)?.focus({preventScroll:true});
 }
 function panelForAttachment(key){
  return [...document.querySelectorAll('[data-add-attachment]')].find(button=>button.dataset.addAttachment===key);
 }
 panel.onclick=async event=>{
  const control=event.target.closest('button');
  if(!control)return;
  const {addAttachment,downloadAttachment:downloadId,removeAttachment}=control.dataset;
  if(addAttachment){control.nextElementSibling.click();return;}
  if(downloadId){downloadAttachment(record,downloadId);return;}
  if(!removeAttachment)return;
  const slots=record.attachments??{};
  const [key,files]=Object.entries(slots).find(([,files])=>files.some(file=>file.id===removeAttachment))??[];
  if(!key)return;
  if(files.length===1&&approvedUsing(record,key).some(({field})=>
   evidenceSlots(field).every(slot=>slot===key||!slots[slot]?.length))){
   const message=language==='cs'?'Odebrat poslední soubor a ponechat schválení?':'Remove the last file and keep the approval?';
   if(!await projectConfirm('attachmentRemoved',message,'keepApproved'))return;
  }
  slots[key]=files.filter(file=>file.id!==removeAttachment);
  if(!slots[key].length&&record.attachmentNames?.[key]){
   delete record.attachmentNames[key];
   delete slots[key];
  }
  markEdited(draft);
  detail(route(),draft);
  (panelForAttachment(key)??$('[data-add-attachment="other"]'))?.focus({preventScroll:true});
 };
 panel.addEventListener('change',event=>addFiles(event.target.dataset.attachmentInput,event.target.files));
 for(const box of panel.querySelectorAll('[data-add-attachment]')){
  box.ondragover=event=>{
   if(!Array.from(event.dataTransfer?.types??[]).includes('Files'))return;
   event.preventDefault();
   event.dataTransfer.dropEffect='copy';
   box.classList.add('dragover');
  };
  box.ondragleave=()=>box.classList.remove('dragover');
  box.ondrop=event=>{
   event.preventDefault();
   box.classList.remove('dragover');
   addFiles(box.dataset.addAttachment,event.dataTransfer?.files);
  };
 }
}

function approvedUsing(record,key){
 return [...historyFields(record).values()].filter(({field,scope})=>
  evidenceSlots(field).includes(key)&&approvalStates.has(getValue(record,field,scope)));
}

function fieldText(record,field,scope,lang){
 const value=getValue(record,field,scope);
 if(field.options){
  const options=field.key==='category'?categoryOptions():field.options;
  return options.find(item=>item[0]===(value??''))?.[lang+1]??'';
 }
 if(field.kind==='checkbox')return value==='ok'?ui.yes[lang]:'';
 if(optionalField(field))return value?.na?'N/A':value?.text??'';
 return String(value??'');
}

function historyFields(record){
 const fields=new Map();
 for(const tab of ['customer','product']){
  for(const {scope,fields:specs} of sections(tab,record)){
   for(const field of specs)fields.set(keyFor(field,scope),{field,scope});
  }
 }
 for(const pack of Object.keys(record.packagingValues)){
  for(const section of groups('product',{...record.values,packaging:pack},record.packagingValues[pack])){
   if(!section.packaging)continue;
   for(const field of section.fields)fields.set(keyFor(field,pack),{field,scope:pack});
  }
 }
 fields.set(attachmentNotes.key,{field:attachmentNotes,scope:''});
 return fields;
}

function historyText(record,field,scope){
 return [0,1].map(lang=>{
  if(field.key==='price'){
   return [record.values.price,record.values.currency].filter(Boolean).join(' ');
  }
  return fieldText(record,field,scope,lang);
 });
}

function historyChanges(previous,record){
 if(!previous)return [];
 const changes=[];
 const add=entry=>changes.push({id:crypto.randomUUID(),at:record.updatedAt,...entry});
 const fields=new Map([...historyFields(previous),...historyFields(record)]);
 for(const {field,scope} of fields.values()){
  if(field.key==='currency')continue;
  if(['fill','fillUnit'].includes(field.key)&&previous.values.packaging!==record.values.packaging)continue;
  const before=historyText(previous,field,scope),after=historyText(record,field,scope);
  if(before[0]!==after[0]||before[1]!==after[1]){
   const pack=scope?packaging.find(([code])=>code===scope):null;
   const label=pack?field.label.map((label,index)=>pack[index+1]+' · '+label):field.label;
   add({label,before,after});
  }
 }
 const slots=new Map([...visibleAttachments(previous),...visibleAttachments(record)].map(section=>[section.key,section]));
 for(const {key,label} of slots.values()){
  const fileRefs=project=>(project.attachments?.[key]??[]).map(({id,name})=>({id,name}));
  const before=fileRefs(previous),after=fileRefs(record);
  if(before.length!==after.length||before.some((file,index)=>file.id!==after[index]?.id)){
   add({label,before,after,files:true});
  }
 }
 return changes;
}

function keepHistoryFiles(record,previous){
 const archived={};
 const currentIds=new Set(Object.values(record.attachments??{}).flat().map(file=>file.id));
 for(const entry of record.history??[]){
  if(!entry.files)continue;
  for(const {id} of [...entry.before,...entry.after]){
   if(currentIds.has(id)||archived[id])continue;
   const file=record.historyFiles?.[id]??(previous&&findFile(previous,id));
   if(file)archived[id]=file;
  }
 }
 record.historyFiles=archived;
}

function historyHTML(record){
 if(!record.history?.length)return '<p class="project-empty">'+escape(t('noHistory'))+'</p>';
 const describe=(entry,value)=>{
  if(!entry.files)return escape(local(value)||'—');
  return value.map(file=>'<div class="project-history-file"><span>'+escape(file.name)+'</span>'+
   button('getFile','data-download-attachment="'+escape(file.id)+'"')+'</div>').join('')||'—';
 };
 return '<ul class="project-history">'+record.history.map(entry=>'<li><div class="project-history-header"><div><strong>'+
  escape(local(entry.label))+'</strong> <time datetime="'+escape(entry.at)+'">'+
  escape(dateText(entry.at,{dateStyle:'medium',timeStyle:'short'}))+'</time></div>'+
  button('removeHistory','data-remove-history="'+escape(entry.id)+'"')+'</div><dl><div><dt>'+escape(t('previous'))+
  '</dt><dd>'+describe(entry,entry.before)+'</dd></div><div><dt>'+escape(t('current'))+'</dt><dd>'+
  describe(entry,entry.after)+'</dd></div></dl></li>').join('')+'</ul>';
}

function bindHistory(panel,draft){
 panel.onclick=async event=>{
  const control=event.target.closest('button');
  if(!control)return;
  const {removeHistory,downloadAttachment:downloadId}=control.dataset;
  if(downloadId){downloadAttachment(draft.record,downloadId);return;}
  if(!removeHistory||!await projectConfirm('removeHistory',t('confirmRemoveHistory'),'removeHistory'))return;
  draft.record.history=draft.record.history.filter(item=>item.id!==removeHistory);
  markEdited(draft);
  detail(route(),draft);
  $('#project-tab-history')?.focus({preventScroll:true});
 };
}

function detail(id,draft){
 const record=draft.record,tab=draft.tab,next=formTabs[formTabs.indexOf(tab)+1];
 $('#toolbar').innerHTML='<div class="project-actions">'+button('print','id="project-print"')+button('download','id="project-download"')+
  button('back','id="project-back"','project-back')+
  button('save','id="project-save"','primary')+'</div>';
 $('#page-title').textContent=projectTitle(record);
 $('#crumb').textContent=t('projects');
 $('#content').innerHTML='<div class="project-detail"><div class="project-tabs" role="tablist" aria-label="'+escape(t('tabLabel'))+'">'+
  tabs.map(name=>'<button type="button" role="tab" id="project-tab-'+name+'" data-project-tab="'+name+'" aria-controls="project-tab-panel" aria-selected="'+(tab===name)+'" tabindex="'+(tab===name?0:-1)+'">'+escape(t(name))+'</button>').join('')+
  '</div><div class="project-feedback" hidden><span id="project-save-feedback" role="status"></span>'+
  button('reload','id="project-reload" hidden')+'</div><div class="project-detail-body" id="project-tab-panel" role="tabpanel" aria-labelledby="project-tab-'+tab+'">'+
  (tab==='attachments'?attachmentsHTML(record):tab==='history'?historyHTML(record):sections(tab,record).map(section=>'<section class="project-section"><h2>'+escape(local(section.label))+
   '</h2><div class="project-fields">'+section.fields.map(field=>fieldHTML(record,field,section.scope)).join('')+'</div></section>').join(''))+
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
  if(target.dataset.projectField&&!target.matches('select, input[type="radio"], input[type="checkbox"]'))void updateField(draft,target);
 };
 panel.onchange=event=>{
  const target=event.target;
  if(target.dataset.na)void updateField(draft,target,true);
  else if(target.dataset.projectField&&target.matches('select, input[type="radio"], input[type="checkbox"]'))void updateField(draft,target);
 };
 for(const control of panel.querySelectorAll('[data-project-number]'))validateInput(control);
 if(tab==='attachments'||tab==='product')bindAttachments(panel,draft);
 if(tab==='history')bindHistory(panel,draft);
 if(next)$('#project-next').onclick=()=>showTab(next);
 $('#project-reload').onclick=async()=>{
  if(!confirm(t('reloadConfirm')))return;
  drafts.delete(route());
  records=undefined;
  render(language);
 };
 $('#project-save').onclick=save;
 $('#project-back').onclick=()=>open();
 $('#project-print').onclick=()=>print(record);
 $('#project-download').onclick=()=>download(record);
 status(draft);
}

async function save(){
 if(!active()||!route()||!records||$('.project-modal[open]'))return;
 const id=route(),draft=draftFor(id);
 if(!draft||draft.busy)return;
 const record=draft.record,customer=customerName(record.values.customer);
 if(!customer&&record.revision===0){
  draft.tab='customer';
  draft.message='required';
  detail(id,draft);
  $('#project-customer').focus();
  return;
 }
 const invalid=invalidField(record);
 if(invalid){
  draft.tab=invalid.tab;
  draft.message='invalid';
  detail(id,draft);
  const control=document.getElementById('project-'+keyFor(invalid.field,invalid.scope));
  control?.focus();
  control?.reportValidity();
  return;
 }
 draft.busy=true;
 const next=structuredClone(record);
 next.values.customer=customer;
 next.updatedAt=new Date().toISOString();
 next.revision++;
 const previous=records.find(project=>project.id===record.id);
 const normalizedPrevious=previous&&normalizeProject(previous);
 const entries=historyChanges(normalizedPrevious,next);
 next.history=[...entries,...(next.history??[])];
 keepHistoryFiles(next,normalizedPrevious);
 const editCount=draft.editCount;
 status(draft);
 try{
  records=await storage.update(key,current=>{
   const projects=current??[];
   const saved=projects.find(project=>project.id===next.id);
   if((saved?.revision??0)!==record.revision)throw Error('CONFLICT');
   return saved?projects.map(project=>project.id===next.id?next:project):[...projects,next];
  });
  // Preserve any typing that happened while IndexedDB was writing.
  const changed=draft.editCount!==editCount;
  draft.record=changed?{...record,revision:next.revision,updatedAt:next.updatedAt,
   history:[...entries,...(record.history??[])],historyFiles:next.historyFiles}:structuredClone(next);
  draft.dirty=changed;
  draft.message='';
  drafts.delete(id);
  drafts.set(next.id,draft);
  if(active()&&route()===id){
   const focused=document.activeElement?.id;
   history.replaceState(null,'','#projects/'+next.id);
   // Keep focus and text entry intact if a change arrived during the save.
   if(!changed){detail(next.id,draft);if(focused)document.getElementById(focused)?.focus({preventScroll:true});}
  }
  if(active()&&!route())list();
  updateCount();
  if(!changed)notify(t('saved'));
 }catch(error){
  draft.message=error.message==='CONFLICT'?'conflict':'saveError';
 }finally{
  draft.busy=false;
  if(active()&&[id,draft.record.id].includes(route()))status(draft);
 }
}

function invalidField(record){
 for(const tab of ['customer','product']){
  for(const {scope,fields} of sections(tab,record)){
   for(const field of fields){
    const kind=numericKind(field);
    if(!kind)continue;
    const value=getValue(record,field,scope);
    if(value?.na)continue;
    if(!validNumber(kind,String(value?.text??value??'')))return {tab,scope,field};
   }
  }
 }
 return null;
}

function summary(record){
 const title=escape(projectTitle(record));
 const content=formTabs.map(tab=>{
  if(tab==='attachments')return '<article><h2>'+escape(t('attachments'))+'</h2><dl>'+visibleAttachments(record).filter(section=>record.attachments?.[section.key]?.length).map(section=>{
   const files=record.attachments[section.key];
   return '<div><dt>'+escape(local(section.label))+'</dt><dd>'+escape(files.map(file=>file.name).join('\n'))+'</dd></div>';
  }).join('')+(record.values.attachmentNotes?'<div><dt>'+escape(t('notes'))+'</dt><dd>'+
   escape(record.values.attachmentNotes)+'</dd></div>':'')+'</dl></article>';
  const sectionsHTML=sections(tab,record).map(section=>'<section><h3>'+escape(local(section.label))+'</h3><dl>'+
   section.fields.map(field=>{
    const description=fieldText(record,field,section.scope,language==='en'?1:0);
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
 const filename=(projectTitle(record).replace(/[^\p{L}\p{N}._-]+/gu,'-').slice(0,90)||'private-project')+'.html';
 downloadFile(new Blob([data],{type:'text/html;charset=utf-8'}),filename);
}
function downloadFile(blob,filename){
 const url=URL.createObjectURL(blob);
 const link=document.createElement('a');
 link.href=url;
 link.download=filename;
 document.body.append(link);
 link.click();
 link.remove();
 setTimeout(()=>URL.revokeObjectURL(url),1000);
}

function updateCount(){
 const badge=$('[data-view="projects"] .nav-count');
 if(badge)badge.textContent=count();
}
function render(lang,showToast=notify){
 language=lang;
 notify=showToast;
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
