const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
global.ExcelJS=require('../vendor/exceljs.min.js');require('../export.js');
const M=require('../model.js'),E=global.JasonExport;
const fields=['brand','type','id','hs','name','csName','volume','price','key','pack','boxes_per_layer','boxes_per_pallet','carton_ean','new','new_date','discontinued','discontinued_date','flags'];
async function roundtrip(wb){const next=new ExcelJS.Workbook();await next.xlsx.load(await wb.xlsx.writeBuffer());return next;}
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
 assert.ok(ws.getCell('A6').isMerged);assert.notEqual(ws.getCell('A3').fill.fgColor.argb,ws.getCell('A7').fill.fgColor.argb);assert.equal(ws.getCell('C7').border.top.style,'medium');assert.equal(ws.getCell('C6').border.bottom.style,'medium');assert.equal(ws.views[0].xSplit,2);assert.equal(ws.pageSetup.printTitlesRow,'1:2');
});
test('real logistics export includes all keys across brands and safe unique worksheet names',async()=>{
 const logistics=JSON.parse(fs.readFileSync(path.join(__dirname,'../../JSON edit GUI/logistics.json'),'utf8')),entries=M.keyEntries(logistics);
 const long='Long brand name with more than thirty-one characters';
 entries.push({brand:long+'?',key:'test',data:M.emptyLogistics()},{brand:long+'*',key:'test',data:M.emptyLogistics()});
 const wb=await roundtrip(E.logistics({entries,sections:M.sections,count:M.count,labels:{}}));
 assert.equal(wb.worksheets.reduce((n,ws)=>n+ws.columnCount-2,0),entries.length);
 assert.equal(new Set(wb.worksheets.map(ws=>ws.name)).size,wb.worksheets.length);assert.ok(wb.worksheets.every(ws=>ws.name.length<=31));
});
