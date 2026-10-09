const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
global.ExcelJS=require('../vendor/exceljs.min.js');require('../export-assets.js');require('../export.js');
const M=require('../model.js'),E=global.JasonExport;
const fields=['brand','type','id','hs','name','csName','volume','price','key','pack','boxes_per_layer','boxes_per_pallet','carton_ean','new','new_date','discontinued','discontinued_date','flags'];
test('Excel export loads and serializes without dynamic code evaluation',async()=>{
 const vm=require('node:vm'),context=vm.createContext({setTimeout,clearTimeout,TextEncoder,TextDecoder},{codeGeneration:{strings:false,wasm:false}});
 context.self=context;
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../vendor/exceljs.min.js'),'utf8'),context);
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../export.js'),'utf8'),context);
 const wb=context.JasonExport.products({fields:['id'],headers:['EAN'],rows:[['0000000000000']],title:'Products',count:1});
 const bytes=await wb.xlsx.writeBuffer(),loaded=new ExcelJS.Workbook();await loaded.xlsx.load(bytes);
 assert.equal(loaded.getWorksheet('Products').getCell('A4').value,'0000000000000');
});
async function roundtrip(wb){const next=new ExcelJS.Workbook();await next.xlsx.load(await wb.xlsx.writeBuffer());return next;}
test('logistics artwork is embedded in every export and survives saving without network',async()=>{
 const entries=['Lilien','Natava','Naturalis','Sunnoré','Twister'].map(brand=>({brand,key:'001A',data:M.emptyLogistics()}));
 for(const includeProducts of [false,true]){
  const wb=await roundtrip(E.logistics({entries,sections:M.sections,count:M.count,labels:{},includeProducts}));
  for(const ws of wb.worksheets){const images=ws.getImages();assert.equal(images.length,ws.name==='Sunnoré'?3:2);for(const image of images){const asset=wb.getImage(image.imageId);assert.ok(asset.buffer.length>1000);assert.ok(image.range.tl.nativeRow>=20);assert.ok(image.range.ext.width>0);}}
  assert.equal(wb.getWorksheet('Lilien').getCell('C2').value,'001A');assert.equal(wb.getWorksheet('Lilien').views[0].xSplit,2);
 }
});
test('optional list matches brand and selected keys, preserves text EANs and flags discontinued rows',async()=>{
 const entries=[{brand:'Lilien',key:'001A',data:M.emptyLogistics()},{brand:'Lilien',key:'750',data:M.emptyLogistics()}];
 const products=[{brand:'Natava',key:'001A',name:'Other brand',id:'111'}, {brand:'Lilien',key:'not-selected',name:'Other key',id:'222'}, {brand:'Lilien',key:750,name:'Numeric key',id:8596048008129}, {brand:'Lilien',key:'001A',name:'Original',id:'0000000000001',carton_ean:'00000000000001'}, {brand:'Lilien',key:'001A',csName:'Náhradní název',id:'0000000000001',discontinued:true}];
 const before=JSON.stringify(products),options={entries,sections:M.sections,count:M.count,labels:{},products};
 const plain=await roundtrip(E.logistics(options)),plainWs=plain.getWorksheet('Lilien');assert.ok(!plainWs.getColumn(1).values.includes('PRODUCTS'));assert.equal(plainWs.getImages().length,2);
 const wb=await roundtrip(E.logistics({...options,includeProducts:true})),ws=wb.getWorksheet('Lilien'),heading=ws.getColumn(1).values.indexOf('LOGISTICS KEY');
 assert.ok(heading>20);assert.equal(ws.getCell(heading,2).value,'PRODUCT NAME');
 assert.deepEqual([0,1,2].map(i=>ws.getCell(heading+1+i,1).value),['001A','001A','750']);
 assert.deepEqual([0,1,2].map(i=>ws.getCell(heading+1+i,2).value),['Original','Náhradní název (Discontinued)','Numeric key']);
 assert.equal(ws.getCell(heading+1,5).value,'0000000000001');assert.equal(ws.getCell(heading+1,6).value,'00000000000001');assert.equal(ws.getCell(heading+3,5).value,'8596048008129');assert.equal(ws.getCell(heading+1,5).numFmt,'@');
 assert.equal(ws.getCell('C2').value,'001A');assert.equal(ws.getCell('D2').value,'750');assert.ok(ws.pageSetup.printArea.endsWith('F'+ws.rowCount));assert.equal(JSON.stringify(products),before);
});
test('selected unused keys get an explicit empty product list rather than unrelated products',async()=>{
 const wb=await roundtrip(E.logistics({entries:[{brand:'Lilien',key:'unused',data:M.emptyLogistics()}],sections:M.sections,count:M.count,labels:{},includeProducts:true,products:[{brand:'Lilien',key:'750',name:'Excluded'}]}));
 const ws=wb.getWorksheet('Lilien');assert.ok(ws.getColumn(1).values.includes('No products assigned to the selected keys.'));assert.equal(ws.getImages().length,2);
});
test('saved product workbook retains styles, identifiers, numeric prices and native Excel controls',async()=>{
 const row=['Lilien','Soap','0000000000000','00123456','Soap','Mýdlo','4x50 g',1.16,'500A',12,13,65,'00123456789012','Yes','','No','','Promo'];
 const wb=await roundtrip(E.products({fields,headers:fields,rows:[row],title:'Products',date:'2026-10-08',count:1})),ws=wb.getWorksheet('Products');
 assert.equal(ws.getCell('C4').value,'0000000000000');assert.equal(ws.getCell('D4').value,'00123456');assert.equal(ws.getCell('M4').value,'00123456789012');assert.equal(ws.getCell('H4').value,1.16);assert.equal(ws.getCell('G4').value,'4x50 g');
 assert.equal(ws.getCell('H4').numFmt,'0.00 "€"');assert.equal(ws.getCell('A1').fill.fgColor.argb,'FF214A84');assert.equal(ws.getCell('A1').font.color.argb,'FFFFFFFF');assert.equal(ws.getCell('A3').font.bold,true);assert.equal(ws.getCell('E4').alignment.wrapText,true);
 assert.equal(ws.autoFilter,'A3:R4');assert.equal(ws.views[0].ySplit,3);assert.equal(ws.pageSetup.orientation,'landscape');assert.equal(ws.pageSetup.printTitlesRow,'1:3');assert.equal(ws.getColumn(5).width,48);
});
test('saved logistics workbook retains section merges, colors, borders, units and zero values',async()=>{
 const data=M.emptyLogistics();data.ITEM.length='12,5 cm';data.ITEM.weight='0 kg';data.CARTON.nr_of_items=12;
 const wb=await roundtrip(E.logistics({entries:[{brand:'Lilien',key:'001A',data}],sections:M.sections,count:M.count,labels:{length:'Length (cm)',weight:'Weight'}})),ws=wb.getWorksheet('Lilien');
 assert.equal(ws.getCell('C2').value,'001A');assert.equal(ws.getCell('C3').value,12.5);assert.equal(ws.getCell('C6').value,0);assert.equal(ws.getCell('C11').value,12);assert.equal(ws.getCell('C4').value,'');assert.equal(ws.getCell('B3').value,'Length (cm)');assert.equal(ws.getCell('B6').value,'Weight (kg)');
 assert.equal(ws.getCell('A1').value,'LOGISTICS DATA');assert.equal(ws.getCell('A1').font.size,13);assert.equal(ws.getCell('B1').master.address,'A1');assert.equal(ws.getCell('C1').isMerged,false);assert.equal(ws.getCell('C1').value,null);
 assert.equal(new Set(['A3','B3','A7','B7','A12','B12','A14','B14'].map(c=>ws.getCell(c).fill.fgColor.argb)).size,1);
 assert.ok(ws.getCell('A6').isMerged);assert.equal(ws.getCell('A3').fill.fgColor.argb,ws.getCell('A7').fill.fgColor.argb);assert.equal(ws.getCell('C7').border.top.style,'medium');assert.equal(ws.getCell('C6').border.bottom.style,'medium');assert.equal(ws.views[0].xSplit,2);assert.equal(ws.pageSetup.printTitlesRow,'1:2');
});
test('real logistics export includes all keys across brands and safe unique worksheet names',async()=>{
 const logistics=JSON.parse(fs.readFileSync(path.join(__dirname,'../../JSON edit GUI/logistics.json'),'utf8')),entries=M.keyEntries(logistics);
 const long='Long brand name with more than thirty-one characters';
 entries.push({brand:long+'?',key:'test',data:M.emptyLogistics()},{brand:long+'*',key:'test',data:M.emptyLogistics()});
 const wb=await roundtrip(E.logistics({entries,sections:M.sections,count:M.count,labels:{}}));
 for(const ws of wb.worksheets){assert.equal(ws.getCell('A1').value,'LOGISTICS DATA');assert.equal(ws.getCell('B1').master.address,'A1');assert.equal(ws.getCell('C1').isMerged,false);}
 assert.equal(wb.worksheets.reduce((n,ws)=>n+ws.columnCount-2,0),entries.length);
 assert.equal(new Set(wb.worksheets.map(ws=>ws.name)).size,wb.worksheets.length);assert.ok(wb.worksheets.every(ws=>ws.name.length<=31));
});
