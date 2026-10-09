/* Customer-ready XLSX output. Uses the same ExcelJS version as the original Jason. */
(function(root){
'use strict';
const colors={navy:'FF214A84',blue:'FF3566A6',pale:'FFE8EFF8',ink:'FF243A57',line:'FFB7C8DE',white:'FFFFFFFF',stripe:'FFF5F8FC'};
const fill=argb=>({type:'pattern',pattern:'solid',fgColor:{argb}});
const edge=style=>({style,color:{argb:colors.line}});
function base(){const wb=new root.ExcelJS.Workbook();wb.creator='Union Cosmetic';wb.company='UNION COSMETIC s.r.o.';wb.created=new Date();return wb;}
function cellStyle(cell,background=colors.white){
 cell.font={name:'Calibri',size:11,color:{argb:colors.ink}};
 cell.fill=fill(background);cell.alignment={vertical:'middle',wrapText:true};
 cell.border={top:edge('thin'),bottom:edge('thin'),left:edge('thin'),right:edge('thin')};
}
function title(ws,text,lastColumn){
 ws.mergeCells(1,1,1,lastColumn);const c=ws.getCell(1,1);c.value=text;
 c.font={name:'Calibri',size:17,bold:true,color:{argb:colors.white}};
 c.fill=fill(colors.navy);c.alignment={vertical:'middle',horizontal:'center',wrapText:true};ws.getRow(1).height=38;
}
function header(row,lastColumn){
 row.height=34;for(let col=1;col<=lastColumn;col++){
  const c=row.getCell(col);cellStyle(c,colors.pale);
  c.font={name:'Calibri',size:11,bold:true,color:{argb:colors.navy}};
  c.alignment={vertical:'middle',horizontal:'center',wrapText:true};c.border.bottom=edge('medium');
 }
}
function printSetup(ws,lastRow,lastColumn,headerRows){
 ws.properties.defaultRowHeight=24;
 ws.pageSetup={paperSize:9,orientation:'landscape',fitToPage:true,fitToWidth:1,fitToHeight:0,
  horizontalCentered:true,printTitlesRow:`1:${headerRows}`,printArea:`A1:${ws.getCell(lastRow,lastColumn).address}`,
  margins:{left:.25,right:.25,top:.4,bottom:.4,header:.15,footer:.15}};
 ws.headerFooter={oddFooter:'&LUNION COSMETIC s.r.o.&R&P / &N'};
}
function products({fields,headers,rows,title:label,date,count,countLabel='products'}){
 const wb=base(),ws=wb.addWorksheet('Products',{properties:{tabColor:{argb:colors.navy}},views:[{state:'frozen',xSplit:3,ySplit:3,showGridLines:false}]});
 const lastColumn=fields.length;title(ws,`UNION COSMETIC · ${label}`,lastColumn);
 ws.mergeCells(2,1,2,lastColumn);ws.getCell(2,1).value=`${date}  ·  ${count} ${countLabel}`;
 ws.getCell(2,1).font={name:'Calibri',size:10,color:{argb:colors.blue}};
 ws.getCell(2,1).alignment={vertical:'middle',horizontal:'left'};ws.getRow(2).height=24;
 ws.addRow(headers);header(ws.getRow(3),lastColumn);
 const widths={brand:15,type:27,id:20,hs:15,name:48,csName:48,volume:19,price:16,key:18,pack:18,boxes_per_layer:20,boxes_per_pallet:20,carton_ean:20,new:13,new_date:17,discontinued:15,discontinued_date:17,flags:28};
 fields.forEach((field,i)=>{ws.getColumn(i+1).width=widths[field]||18;});
 for(const values of rows){
  const row=ws.addRow(values);let lines=1;
  fields.forEach((field,i)=>{
   const c=row.getCell(i+1),value=values[i];cellStyle(c,row.number%2===0?colors.white:colors.stripe);
   if(['price','pack','boxes_per_layer','boxes_per_pallet'].includes(field)&&value!==''&&value!=null&&Number.isFinite(Number(value))){c.value=Number(value);c.numFmt=field==='price'?'0.00 "€"':'0';c.alignment.horizontal='right';}
   if(['id','hs','carton_ean','key'].includes(field)){c.value=String(value??'');c.numFmt='@';}
   if(['new','discontinued'].includes(field))c.alignment.horizontal='center';
   if(['name','csName','flags'].includes(field))lines=Math.max(lines,Math.ceil(String(value??'').length/(widths[field]-4)));
  });
  row.height=Math.max(28,lines*15+10);
 }
 ws.autoFilter={from:{row:3,column:1},to:{row:ws.rowCount,column:lastColumn}};
 printSetup(ws,ws.rowCount,lastColumn,3);return wb;
}
function logistics({entries,sections,count,labels}){
 const wb=base(),byBrand=new Map();
 for(const r of entries){if(!byBrand.has(r.brand))byBrand.set(r.brand,[]);byBrand.get(r.brand).push(r);}
 for(const [brand,groups]of byBrand){
  const baseName=String(brand).replace(/[\\/?*\[\]:']/g,' ').trim().slice(0,31)||'Logistics';
  let name=baseName,n=1;while(wb.getWorksheet(name)){const suffix=` ${n++}`;name=baseName.slice(0,31-suffix.length)+suffix;}
  const ws=wb.addWorksheet(name,{properties:{tabColor:{argb:colors.navy}},views:[{state:'frozen',xSplit:2,ySplit:2,showGridLines:false}]});
  const lastColumn=groups.length+2;title(ws,'LOGISTICS DATA',2);ws.getCell('A1').font={...ws.getCell('A1').font,size:13};ws.getRow(1).height=32;
  for(let col=3;col<=lastColumn;col++)ws.getCell(1,col).fill=fill(colors.navy);
  ws.addRow(['Section','Attribute',...groups.map(r=>String(r.key))]);header(ws.getRow(2),lastColumn);
  ws.getColumn(1).width=13;ws.getColumn(2).width=23;
  groups.forEach((r,i)=>{ws.getColumn(i+3).width=Math.max(12,Math.min(28,String(r.key).length+3));ws.getCell(2,i+3).numFmt='@';});
  for(const [section,attributes]of Object.entries(sections)){
   const start=ws.rowCount+1,background=colors.pale;
   for(const attribute of attributes){
    const unit=attribute==='weight'?' (kg)':['length','width','height'].includes(attribute)?' (cm)':'';
    const label=labels[attribute]||attribute;
    const row=ws.addRow([section,(unit?label.replace(/\s*\((?:cm|kg)\)$/i,''):label)+unit,...groups.map(r=>{const v=count(r.data[section]?.[attribute]);return v===''?'':v;})]);
    row.height=25;
    for(let col=1;col<=lastColumn;col++){
     const cell=row.getCell(col);cellStyle(cell,col<=2?background:colors.white);
     cell.alignment.horizontal=col===2?'left':'center';
     if(col>=3)cell.numFmt=attribute.startsWith('nr_')?'0':'General';
     if(row.number===start)cell.border.top=edge('medium');
     if(col===1)cell.border.left=edge('medium');
     if(col===lastColumn)cell.border.right=edge('medium');
    }
   }
   const end=ws.rowCount;for(let col=1;col<=lastColumn;col++)ws.getCell(end,col).border.bottom=edge('medium');
   ws.mergeCells(start,1,end,1);
   const c=ws.getCell(start,1);c.font={name:'Calibri',size:11,bold:true,color:{argb:colors.navy}};
   c.alignment={vertical:'middle',horizontal:'center',wrapText:true};
  }
  printSetup(ws,ws.rowCount,lastColumn,2);
 }
 return wb;
}
async function download(wb,filename){
 const buffer=await wb.xlsx.writeBuffer(),url=root.URL.createObjectURL(new root.Blob([buffer],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}));
 const a=root.document.createElement('a');a.href=url;a.download=filename;root.document.body.appendChild(a);a.click();
 root.setTimeout(()=>{a.remove();root.URL.revokeObjectURL(url);},1000);
}
root.JasonExport={products,logistics,download};
})(typeof window!=='undefined'?window:globalThis);
