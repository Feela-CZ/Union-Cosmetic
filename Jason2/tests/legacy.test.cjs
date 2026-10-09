/* Integration coverage for the maintained original editor and Order Sheet. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {JSDOM}=require('jsdom'),P=require('../../shared/packaging.js');
const root=path.join(__dirname,'../..'),read=p=>fs.readFileSync(path.join(root,p),'utf8'),clone=v=>JSON.parse(JSON.stringify(v));
const product={brand:'Lilien',type:'Nail Polish Remover',id:'8595196904307',hs:'33043000',name:'Aloe Vera',csName:'Aloe Vera',volume:{number:110,unit:'ml'},price:.7,key:110,pack:99,boxes_per_layer:12,boxes_per_pallet:120,carton_ean:'KEEP',custom:{keep:true}};
const logistics={Lilien:{'110':{ITEM:{length:6,width:3,height:10.5,weight:.13},CARTON:{nr_of_items:25},LAYER:{nr_of_cartons:16},PALLET:{nr_of_cartons:160}}}};
const tick=()=>new Promise(r=>setTimeout(r,0));
function setup(html){const d=new JSDOM(read(html),{url:'https://local.test/'+html.replaceAll(' ','%20'),runScripts:'outside-only',pretendToBeVisual:true});const w=d.window;w.API_BASE='https://api.test';w.IntersectionObserver=class{observe(){}unobserve(){}};w.alert=()=>{};w.HTMLElement.prototype.scrollIntoView=()=>{};w.eval(read('shared/packaging.js'));return {d,w};}
test('original editor displays only key values and saves products without copies',async t=>{
 const {d,w}=setup('JSON edit GUI/index.html'),puts=[];t.after(()=>d.window.close());
 w.fetch=async(url,args={})=>{if(args.method==='PUT'){puts.push({name:new URL(url).pathname.split('/').pop(),data:JSON.parse(args.body)});return {ok:true,json:async()=>({ok:true})};}return {ok:true,json:async()=>clone(String(url).includes('logistics')?logistics:[product])};};
 w.eval(read('JSON edit GUI/editor.js'));await tick();await tick();w.editProduct(0);
 assert.equal(w.document.querySelector('#pack').value,'25');assert.equal(w.document.querySelector('#boxes_per_layer').value,'16');assert.equal(w.document.querySelector('#boxes_per_pallet').value,'160');assert.ok(w.document.querySelector('#pack').readOnly);
 w.document.querySelector('#pack').value='999';await w.saveProductFinal({...P.cleanProduct(product),price:1});
 assert.equal(puts.length,1);assert.equal(puts[0].name,'products');assert.deepEqual(puts[0].data,[{...P.cleanProduct(product),price:1}]);d.window.close();
});
test('Order Sheet waits for logistics and converts boxes and pallets from keys',async t=>{
 const {d,w}=setup('OrderSheet/index.html');t.after(()=>d.window.close());let resolveLogistics;
 w.fetch=async url=>({ok:true,json:()=>String(url).includes('logistics')?new Promise(r=>resolveLogistics=r):Promise.resolve([clone(product)])});
 w.eval(read('OrderSheet/main.js'));await tick();assert.equal(w.document.querySelectorAll('#brand-container .brand-card').length,0);resolveLogistics(clone(logistics));await tick();await tick();
 w.selectBrand('Lilien');const card=w.document.querySelector('.product-card');assert.ok(card.textContent.includes('Boxes/Layer: 16'));assert.ok(card.textContent.includes('Boxes/Pallet: 160'));
 const pieces=card.querySelector('input[placeholder=pieces]'),boxes=card.querySelector('input[placeholder=boxes]'),pallets=card.querySelector('input[placeholder=pallets]');assert.equal(pieces.step,'25');boxes.value='2';boxes.dispatchEvent(new w.Event('blur'));assert.equal(pieces.value,'50');pallets.value='1';pallets.dispatchEvent(new w.Event('blur'));assert.equal(pieces.value,'4000');d.window.close();
});
test('Order Sheet disables packaging conversions when assigned key is absent',async t=>{
 const {d,w}=setup('OrderSheet/index.html');t.after(()=>d.window.close());w.fetch=async url=>({ok:true,json:async()=>String(url).includes('logistics')?{}:[clone(product)]});w.eval(read('OrderSheet/main.js'));await tick();await tick();w.selectBrand('Lilien');assert.ok(w.document.querySelector('input[placeholder="pack data missing"]').disabled);assert.ok(w.document.querySelector('.product-card').textContent.includes('Boxes/Layer: —'));d.window.close();
});
