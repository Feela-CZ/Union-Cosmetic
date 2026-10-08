/* Jason data layer. The original JSON structure and unknown fields are retained. */
(function (root) {
'use strict';
const clone = value => JSON.parse(JSON.stringify(value));
const sections = {ITEM:['length','width','height','weight'],CARTON:['length','width','height','weight','nr_of_items'],LAYER:['nr_of_items','nr_of_cartons'],PALLET:['length','width','height','weight','nr_of_cartons','nr_of_items','nr_of_layers']};
const invalidKeys = new Set(['','null','undefined','___','—','-','__proto__','constructor','prototype']);
const key = v => v == null || invalidKeys.has(String(v).trim().toLowerCase()) ? null : String(v).trim();
const fold = v => String(v ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const count = v => { if(v == null || v === '') return ''; const m=String(v).replace(',','.').match(/^\s*(-?\d+(?:\.\d+)?)(?:\s*[^\d.]*)?$/);return m?Number(m[1]):''; };
function validateProducts(value) {
 if(!Array.isArray(value) || value.some(p => !p || typeof p!=='object' || Array.isArray(p))) throw Error('PRODUCTS_FORMAT');
 for(const p of value) {
  for(const field of ['brand','type','id','hs','name','csName','key','carton_ean']) if(p[field]!=null && !['string','number'].includes(typeof p[field])) throw Error('PRODUCTS_FORMAT');
  if(p.volume!=null && (typeof p.volume!=='object' || Array.isArray(p.volume))) throw Error('PRODUCTS_FORMAT');
  if(p.flags!=null && (!Array.isArray(p.flags) || p.flags.some(f=>typeof f!=='string'))) throw Error('PRODUCTS_FORMAT');
 }
 return value;
}
function validateLogistics(value) {
 if(!value || typeof value!=='object' || Array.isArray(value)) throw Error('LOGISTICS_FORMAT');
 for(const brand of Object.values(value)) {
  if(!brand || typeof brand!=='object' || Array.isArray(brand)) throw Error('LOGISTICS_FORMAT');
  for(const entry of Object.values(brand)) {
   if(!entry || typeof entry!=='object' || Array.isArray(entry)) throw Error('LOGISTICS_FORMAT');
   for(const sec of Object.keys(sections)) if(entry[sec]!=null && (typeof entry[sec]!=='object'||Array.isArray(entry[sec]))) throw Error('LOGISTICS_FORMAT');
  }
 }
 return value;
}
function emptyLogistics(){return Object.fromEntries(Object.entries(sections).map(([s,fs])=>[s,Object.fromEntries(fs.map(f=>[f,null]))]));}
function syncPackaging(p,l){ if(!l) return p; p.pack=count(l.CARTON?.nr_of_items);p.boxes_per_layer=count(l.LAYER?.nr_of_cartons);p.boxes_per_pallet=count(l.PALLET?.nr_of_cartons);return p; }
function saveProduct(original,patch,products,index,logistics){
 const p={...clone(original||{}),...clone(patch)};
 p.id=String(p.id??'').trim();
 if(!p.id) throw Error('EAN_REQUIRED');
 if((index==null||!original||String(original.id)!==p.id)&&products.some((x,i)=>i!==index&&String(x.id)===p.id)) throw Error('EAN_DUPLICATE');
 const l=key(p.key)?logistics[p.brand]?.[key(p.key)]:null;
 // Preserve an existing record's packaging unless its association actually changes.
 if(l && (!original || original.brand!==p.brand || key(original.key)!==key(p.key))) syncPackaging(p,l);
 return p;
}
function keyEntries(logistics){return Object.entries(logistics).flatMap(([brand,groups])=>Object.entries(groups).filter(([k])=>key(k)).map(([k,data])=>({brand,key:k,data})));}
function applyLogistics(state,brand,k,data){
 if(!key(k) || !key(brand))throw Error('KEY_REQUIRED');
 const next=clone(state);if(!Object.hasOwn(next.logistics,brand)) next.logistics[brand]={};
 next.logistics[brand][k]=clone(data);
 next.products.forEach(p=>{if(p.brand===brand&&key(p.key)===k)syncPackaging(p,data);});return next;
}
function renameKey(state,brand,oldKey,newKey){
 newKey=key(newKey);if(!newKey)throw Error('KEY_REQUIRED');
 if(newKey!==oldKey&&Object.hasOwn(state.logistics[brand]||{},newKey))throw Error('KEY_DUPLICATE');
 const next=clone(state);next.logistics[brand][newKey]=next.logistics[brand][oldKey];if(newKey!==oldKey)delete next.logistics[brand][oldKey];
 next.products.forEach(p=>{if(p.brand===brand&&key(p.key)===oldKey)p.key=newKey;});return next;
}
function filterProducts(products,f={}){
 const words=fold(f.search).split(/\s+/).filter(Boolean);
 return products.map((p,index)=>({p,index})).filter(({p})=>{
  if(f.brand&&p.brand!==f.brand||f.type&&p.type!==f.type||f.key&&key(p.key)!==f.key)return false;
  if(f.status==='active'&&p.discontinued===true||f.status==='discontinued'&&p.discontinued!==true||f.status==='new'&&p.new!==true)return false;
  if(f.flag&&!(p.flags||[]).includes(f.flag))return false;
  const hay=fold([p.brand,p.type,p.id,p.hs,p.name,p.csName,p.volume?.number,p.volume?.unit,p.key,p.carton_ean,...(p.flags||[])].join(' '));
  return words.every(w=>hay.includes(w));
 });
}
function eanValid(value){ const s=String(value);if(!/^\d{13}$/.test(s))return false;return (10-[...s.slice(0,12)].reduce((a,v,i)=>a+Number(v)*(i%2?3:1),0)%10)%10===Number(s[12]); }
function issues(state){
 const out=[],ids=new Map();
 state.products.forEach((p,i)=>{const add=(code,field)=>out.push({kind:'product',index:i,code,field});
  if(!p.id)add('eanMissing','id');else{if(ids.has(String(p.id))){add('eanDuplicate','id');out.push({kind:'product',index:ids.get(String(p.id)),code:'eanDuplicate',field:'id'});}ids.set(String(p.id),i);if(!eanValid(p.id))add('eanInvalid','id');}
  for(const f of ['brand','type','name','csName'])if(!p[f])add('missing',f);
  if(p.price==null||p.price===''||!Number.isFinite(Number(p.price))||Number(p.price)<0)add('priceInvalid','price');
  const k=key(p.key),l=k?state.logistics[p.brand]?.[k]:null;
  if(!k)add('keyMissing','key');else if(!l)add('keyUnknown','key');
  if(l){for(const [f,s,a]of [['pack','CARTON','nr_of_items'],['boxes_per_layer','LAYER','nr_of_cartons'],['boxes_per_pallet','PALLET','nr_of_cartons']])if(count(l[s]?.[a])!==''&&count(p[f])!==count(l[s]?.[a]))add('packMismatch',f);}
 });
 for(const {brand,key:k,data} of keyEntries(state.logistics)){
  const add=code=>out.push({kind:'key',brand,key:k,code});
  if(Object.entries(sections).some(([s,fs])=>fs.some(f=>data[s]?.[f]==null||data[s]?.[f]==='')))add('keyIncomplete');
  const c=count(data.CARTON?.nr_of_items),lc=count(data.LAYER?.nr_of_cartons),pc=count(data.PALLET?.nr_of_cartons),pi=count(data.PALLET?.nr_of_items),li=count(data.LAYER?.nr_of_items),layers=count(data.PALLET?.nr_of_layers);
  if(c!==''&&pc!==''&&pi!==''&&c*pc!==pi||c!==''&&lc!==''&&li!==''&&c*lc!==li||lc!==''&&layers!==''&&pc!==''&&lc*layers!==pc)add('keyMath');
  if(!state.products.some(p=>p.brand===brand&&key(p.key)===k))add('keyUnused');
 }
 return out;
}
const api={clone,sections,key,fold,count,validateProducts,validateLogistics,emptyLogistics,syncPackaging,saveProduct,keyEntries,applyLogistics,renameKey,filterProducts,eanValid,issues};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.JasonModel=api;
})(typeof window!=='undefined'?window:globalThis);
