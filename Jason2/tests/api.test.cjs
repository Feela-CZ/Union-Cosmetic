const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../../functions/api/[name].js'),'utf8');
test('repository API strips legacy counts on reads and writes while preserving Czech text',async()=>{
 const {onRequest}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
 const original=[{id:'001',brand:'Lilien',csName:'Mýdlo',key:'110',pack:99,boxes_per_layer:12,boxes_per_pallet:120,carton_ean:'KEEP',custom:{note:'Číslo'}}],clean=[{id:'001',brand:'Lilien',csName:'Mýdlo',key:'110',carton_ean:'KEEP',custom:{note:'Číslo'}}];
 const oldFetch=global.fetch;let stored;
 global.fetch=async(url,args={})=>{if(args.method==='PUT'){stored=JSON.parse(Buffer.from(JSON.parse(args.body).content,'base64').toString('utf8'));return new Response('{}');}return Response.json({sha:'base',content:Buffer.from(JSON.stringify(original)).toString('base64')});};
 const env={GH_OWNER:'owner',GH_REPO:'repo',GITHUB_TOKEN:'test',GH_PRODUCTS_PATH:'OrderSheet/products.json'};
 try{
  const read=await onRequest({request:new Request('https://api.test/api/products'),env,params:{name:'products'}});assert.equal(read.status,200);assert.deepEqual(await read.json(),clean);
  const write=await onRequest({request:new Request('https://api.test/api/products',{method:'PUT',body:JSON.stringify(original)}),env,params:{name:'products'}});assert.equal(write.status,200);assert.deepEqual(stored,clean);
 }finally{global.fetch=oldFetch;}
});
