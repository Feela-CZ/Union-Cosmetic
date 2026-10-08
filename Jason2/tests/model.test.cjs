const test=require('node:test'),assert=require('node:assert/strict'),M=require('../model.js'),fs=require('node:fs');
const logistics={Lilien:{'500':{...M.emptyLogistics(),CARTON:{nr_of_items:10},LAYER:{nr_of_cartons:12,nr_of_items:120},PALLET:{nr_of_cartons:120,nr_of_items:1200,nr_of_layers:10},extra:{supplier:'keep'}}}};
const product={brand:'Lilien',type:'Liquid Soap',id:'8596048008129',name:'Soap',csName:'Mýdlo',price:1.2,key:'500',pack:10,boxes_per_layer:12,boxes_per_pallet:120,carton_ean:'00123456789012',volume:{number:'500',unit:'ml',precision:'keep'},custom:{nested:['keep']},new:true,new_date:'2025-01-01'};
test('archive logistics passes structural validation and remains byte-equivalent after clone',()=>{const input=JSON.parse(fs.readFileSync(require('node:path').join(__dirname,'../../JSON edit GUI/logistics.json'),'utf8'));assert.deepEqual(M.validateLogistics(M.clone(input)),input);});
test('editing preserves unknown fields, carton EAN and volume metadata',()=>{const p=M.saveProduct(product,{name:'Revised',volume:{...product.volume,number:'600'}},[product],0,logistics);assert.deepEqual(p.custom,product.custom);assert.equal(p.carton_ean,product.carton_ean);assert.equal(p.volume.precision,'keep');assert.equal(product.name,'Soap');});
test('duplicate IDs are rejected but unchanged IDs accepted',()=>{assert.throws(()=>M.saveProduct(null,product,[product],null,logistics),/EAN_DUPLICATE/);assert.equal(M.saveProduct(product,{price:0},[product],0,logistics).price,0);});
test('new assignment derives packaging, unchanged assignment preserves existing counts',()=>{const p=M.saveProduct(null,{...product,pack:0},[],null,logistics);assert.equal(p.pack,10);const old={...product,pack:11};assert.equal(M.saveProduct(old,{price:2},[old],0,logistics).pack,11);});
test('shared key update synchronizes all matching products only and preserves extensions',()=>{const state={products:[product,{...product,id:'2',carton_ean:'KEEP'},{...product,id:'3',brand:'Natava'}],logistics};const data=M.clone(logistics.Lilien['500']);data.CARTON.nr_of_items=6;const next=M.applyLogistics(state,'Lilien','500',data);assert.equal(next.products[0].pack,6);assert.equal(next.products[1].pack,6);assert.equal(next.products[2].pack,10);assert.equal(next.products[1].carton_ean,'KEEP');assert.deepEqual(next.logistics.Lilien['500'].extra,{supplier:'keep'});assert.equal(state.products[0].pack,10);});
test('rename changes associations, disallows duplicates and reserved keys',()=>{const state={products:[product],logistics};const n=M.renameKey(state,'Lilien','500','500A');assert.equal(n.products[0].key,'500A');assert.equal(n.logistics.Lilien['500'],undefined);assert.deepEqual(n.logistics.Lilien['500A'],logistics.Lilien['500']);assert.throws(()=>M.renameKey(n,'Lilien','500A','__proto__'),/KEY_REQUIRED/);});
test('search ignores accents, uses both names and all terms, supports status/flags',()=>{const rows=[{...product,flags:['Promo']},{...product,id:'2',discontinued:true}];assert.equal(M.filterProducts(rows,{search:'mydlo 859',status:'active',flag:'Promo'}).length,1);assert.equal(M.filterProducts(rows,{status:'discontinued'}).length,1);assert.equal(M.filterProducts(rows,{status:'all'}).length,2);});
test('EAN validates checksum and leading zeros',()=>{assert.equal(M.eanValid('8596048008129'),true);assert.equal(M.eanValid('8596048008120'),false);assert.equal(M.eanValid('0000000000000'),true);});
test('data checks find cross-file mismatch, missing keys, duplicates and arithmetic errors',()=>{const state={products:[{...product,pack:3},{...product}],logistics};const codes=M.issues(state).map(r=>r.code);assert.ok(codes.includes('packMismatch'));assert.ok(codes.includes('eanDuplicate'));const l=M.clone(logistics);l.Lilien['500'].PALLET.nr_of_items=7;assert.ok(M.issues({products:[product],logistics:l}).some(r=>r.code==='keyMath'));});
test('bad imports are rejected, safe extension fields retained',()=>{for(const value of [{},null,[null],[{flags:'bad'}],[{volume:[]}],[{brand:{}}]])assert.throws(()=>M.validateProducts(value));for(const value of [[],null,{Lilien:[]},{Lilien:{'500':{ITEM:'bad'}}}])assert.throws(()=>M.validateLogistics(value));assert.deepEqual(M.validateProducts([product]),[product]);});
test('placeholder keys excluded without deleting original data',()=>{const data={Lilien:{null:{x:1},___:{x:2},'500':{x:3}}};assert.equal(M.keyEntries(data).length,1);assert.deepEqual(data.Lilien.null,{x:1});assert.equal(M.key('null'),null);});

test('historical duplicate EAN does not block unrelated edits but new duplicates are rejected',()=>{const rows=[product,{...product,name:'Historical duplicate'}];assert.equal(M.saveProduct(product,{price:2},rows,0,logistics).price,2);assert.throws(()=>M.saveProduct(product,{id:product.id},rows,null,logistics),/EAN_DUPLICATE/);});

const duplicateIssues=products=>M.issues({products,logistics}).filter(r=>r.code==='eanDuplicate');
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

