const test=require('node:test'),assert=require('node:assert/strict'),M=require('../model.js'),fs=require('node:fs');
const logistics={Lilien:{'500':{...M.emptyLogistics(),CARTON:{nr_of_items:10},LAYER:{nr_of_cartons:12,nr_of_items:120},PALLET:{nr_of_cartons:120,nr_of_items:1200,nr_of_layers:10},extra:{supplier:'keep'}}}};
const product={brand:'Lilien',type:'Liquid Soap',id:'8596048008129',name:'Soap',csName:'Mýdlo',price:1.2,key:'500',pack:10,boxes_per_layer:12,boxes_per_pallet:120,carton_ean:'00123456789012',volume:{number:'500',unit:'ml',precision:'keep'},custom:{nested:['keep']},new:true,new_date:'2025-01-01'};
test('estimated pallet height converts units and leaves stored dimensions untouched',()=>{
 for(const height of [12,'12 cm','120 mm','0,12 m']){
  const data={CARTON:{height},PALLET:{nr_of_layers:10,height:'142 cm',weight:'193 kg'}};const before=M.clone(data);
  assert.equal(M.estimatedPalletHeight(data),134.4);assert.deepEqual(data,before);
 }
 assert.equal(M.estimatedPalletHeight({CARTON:{height:'12,35 cm'},PALLET:{nr_of_layers:7}}),100.9);
});
test('estimated height stays missing for incomplete or invalid inputs without using stored pallet height',()=>{
 for(const height of [null,'','bad','-12 cm','0 cm','12 inches','Infinity'])assert.equal(M.estimatedPalletHeight({CARTON:{height},PALLET:{nr_of_layers:10,height:142}}),'');
 for(const layers of [null,'','bad',0,-1,1.5,Infinity])assert.equal(M.estimatedPalletHeight({CARTON:{height:12},PALLET:{nr_of_layers:layers,height:142}}),'');
 assert.equal(M.estimatedPalletHeight(null),'');
});
test('archive logistics passes structural validation and remains byte-equivalent after clone',()=>{const input=JSON.parse(fs.readFileSync(require('node:path').join(__dirname,'../../JSON edit GUI/logistics.json'),'utf8'));assert.deepEqual(M.validateLogistics(M.clone(input)),input);});
test('editing preserves unknown fields, carton EAN and volume metadata',()=>{const p=M.saveProduct(product,{name:'Revised',volume:{...product.volume,number:'600'}},[product],0,logistics);assert.deepEqual(p.custom,product.custom);assert.equal(p.carton_ean,product.carton_ean);assert.equal(p.volume.precision,'keep');assert.equal(product.name,'Soap');});
test('duplicate IDs are rejected but unchanged IDs accepted',()=>{assert.throws(()=>M.saveProduct(null,product,[product],null,logistics),/EAN_DUPLICATE/);assert.equal(M.saveProduct(product,{price:0},[product],0,logistics).price,0);});
test('product save removes all duplicate counts, even on unchanged association',()=>{
 for(const original of [null,{...product,pack:99}]){const p=M.saveProduct(original,{...product,pack:0},[],0,logistics);for(const f of ['pack','boxes_per_layer','boxes_per_pallet'])assert.ok(!Object.hasOwn(p,f));assert.deepEqual(M.packaging(p,logistics),{pack:10,boxes_per_layer:12,boxes_per_pallet:120});}
});
test('shared key update changes derived packaging without product copies',()=>{
 const state={products:[product,{...product,id:'2',carton_ean:'KEEP'},{...product,id:'3',brand:'Natava'}],logistics};const data=M.clone(logistics.Lilien['500']);data.CARTON.nr_of_items=6;const next=M.applyLogistics(state,'Lilien','500',data);
 assert.equal(M.packaging(next.products[0],next.logistics).pack,6);assert.equal(M.packaging(next.products[1],next.logistics).pack,6);assert.equal(M.packaging(next.products[2],next.logistics).pack,'');assert.ok(next.products.every(p=>!Object.hasOwn(p,'pack')));assert.equal(next.products[1].carton_ean,'KEEP');assert.deepEqual(next.logistics.Lilien['500'].extra,{supplier:'keep'});assert.equal(state.products[0].pack,10);
});
test('missing or invalid key never falls back to old product counts',()=>{
 for(const key of [null,'unknown','null','__proto__'])assert.deepEqual(M.packaging({...product,key},logistics),{pack:'',boxes_per_layer:'',boxes_per_pallet:''});
 const l=M.clone(logistics);l.Lilien['500'].CARTON.nr_of_items=0;assert.equal(M.packaging(product,l).pack,0);
});
test('rename changes associations, disallows duplicates and reserved keys',()=>{const state={products:[product],logistics};const n=M.renameKey(state,'Lilien','500','500A');assert.equal(n.products[0].key,'500A');assert.equal(n.logistics.Lilien['500'],undefined);assert.deepEqual(n.logistics.Lilien['500A'],logistics.Lilien['500']);assert.throws(()=>M.renameKey(n,'Lilien','500A','__proto__'),/KEY_REQUIRED/);});
test('search ignores accents, uses both names and all terms, supports status/flags',()=>{const rows=[{...product,flags:['Promo']},{...product,id:'2',discontinued:true}];assert.equal(M.filterProducts(rows,{search:'mydlo 859',status:'active',flag:'Promo'}).length,1);assert.equal(M.filterProducts(rows,{status:'discontinued'}).length,1);assert.equal(M.filterProducts(rows,{status:'all'}).length,2);});
test('EAN validates checksum and leading zeros',()=>{assert.equal(M.eanValid('8596048008129'),true);assert.equal(M.eanValid('8596048008120'),false);assert.equal(M.eanValid('0000000000000'),true);});
test('data checks ignore obsolete product counts but retain duplicates and key arithmetic',()=>{const state={products:[{...product,pack:3},{...product}],logistics};const codes=M.issues(state).map(r=>r.code);assert.ok(!codes.includes('packMismatch'));assert.ok(codes.includes('eanDuplicate'));const l=M.clone(logistics);l.Lilien['500'].PALLET.nr_of_items=7;assert.ok(M.issues({products:[product],logistics:l}).some(r=>r.code==='keyMath'));});
test('bad imports are rejected, safe extension fields retained',()=>{for(const value of [{},null,[null],[{flags:'bad'}],[{volume:[]}],[{brand:{}}]])assert.throws(()=>M.validateProducts(value));for(const value of [[],null,{Lilien:[]},{Lilien:{'500':{ITEM:'bad'}}}])assert.throws(()=>M.validateLogistics(value));assert.deepEqual(M.validateProducts([product]),M.cleanProducts([product]));});
test('placeholder keys excluded without deleting original data',()=>{const data={Lilien:{null:{x:1},___:{x:2},'500':{x:3}}};assert.equal(M.keyEntries(data).length,1);assert.deepEqual(data.Lilien.null,{x:1});assert.equal(M.key('null'),null);});

test('historical duplicate EAN does not block unrelated edits but new duplicates are rejected',()=>{const rows=[product,{...product,name:'Historical duplicate'}];assert.equal(M.saveProduct(product,{price:2},rows,0,logistics).price,2);assert.throws(()=>M.saveProduct(product,{id:product.id},rows,null,logistics),/EAN_DUPLICATE/);});

const duplicateIssues=products=>M.issues({products,logistics}).filter(r=>r.code==='eanDuplicate');
test('new flag is independent of active/discontinued status in every combination',()=>{
 const rows=[{...product,id:'active',new:false},{...product,id:'active-new',new:true},{...product,id:'old',discontinued:true,new:false},{...product,id:'old-new',discontinued:true,new:true}];
 const ids=f=>M.filterProducts(rows,f).map(r=>r.p.id);
 assert.deepEqual(ids({status:'active'}),['active','active-new']);
 assert.deepEqual(ids({status:'active',new:'yes'}),['active-new']);
 assert.deepEqual(ids({status:'active',new:'no'}),['active']);
 assert.deepEqual(ids({status:'discontinued',new:'yes'}),['old-new']);
 assert.deepEqual(ids({status:'discontinued',new:'no'}),['old']);
 assert.deepEqual(ids({status:'all',new:'yes'}),['active-new','old-new']);
 assert.deepEqual(ids({status:'all',new:'no'}),['active','old']);
});
test('real Honey and Oat replacement sharing a discontinued EAN is not a duplicate',()=>{
 const rows=JSON.parse(fs.readFileSync(require('node:path').join(__dirname,'../../OrderSheet/products.json'),'utf8')).filter(p=>String(p.id)==='8596048005128');
 assert.equal(rows.length,2);assert.equal(rows.filter(p=>p.discontinued===true).length,1);assert.notEqual(rows[0].price,rows[1].price);
 const before=M.clone(rows);assert.deepEqual(duplicateIssues(rows),[]);assert.deepEqual(duplicateIssues([...rows].reverse()),[]);assert.deepEqual(rows,before);
});
test('active duplicates remain findings even with different prices and legacy status values',()=>{
 for(const discontinued of [false,null,undefined]){
  const rows=[{...product,discontinued},{...product,id:Number(product.id),price:2,discontinued:false}];
  assert.deepEqual(duplicateIssues(rows).map(r=>r.index),[0,1]);
 }
});
test('multiple active duplicates are each reported once and discontinued records excluded',()=>{
 const rows=[{...product,discontinued:true},product,{...product,price:2},{...product,price:3}];
 assert.deepEqual(duplicateIssues(rows).map(r=>r.index),[1,2,3]);
 assert.deepEqual(duplicateIssues(rows.map(p=>({...p,discontinued:true}))),[]);
});
test('discontinued records still receive other data checks',()=>{
 const rows=M.issues({products:[{...product,discontinued:true,id:'invalid',price:-1,key:'unknown'}],logistics});
 for(const code of ['eanInvalid','priceInvalid','keyUnknown'])assert.ok(rows.some(r=>r.code===code));
});

