/* Project form definitions. Values and option codes are independent of the UI language. */
(function(root){
'use strict';

const packaging=[
 ['dpak','D-PAK','D-PAK'],['doypack','Doypack','Doypack'],['bottle','Lahev','Bottle'],
 ['canister','Kanystr','Canister'],['tube','Tuba','Tube'],['jar','Kelímek','Jar'],
 ['airless','Airless','Airless'],['sachet','Sáček','Sachet'],['box','Krabička','Folding box'],
 ['ibc','IBC','IBC'],['drum','Sud','Drum'],['bag','Vak','Bulk bag']
];
const categories=[
 ['cosmetics','Kosmetika','Cosmetics'],['detergent','Detergent','Detergent']
];
const cooperation=[
 ['existing','Stávající receptura','Existing formula'],['modified','Úprava receptury','Formula modification'],
 ['development','Vývoj receptury','Formula development'],['customer','Receptura zákazníka','Customer formula'],
 ['cofilling','Co-filling','Co-filling'],['bulk','Dodávka v bulku','Bulk supply']
];
const marking=[
 ['','TBD','TBD'],['label','Etiketa','Label'],['print','Přímý potisk','Direct print'],['na','N/A','N/A']
];
const sample=[['','TBD','TBD'],['approved','Schválen','Approved'],['na','N/A','N/A']];
const check=[['','TBD','TBD'],['ok','Potvrzeno','Confirmed'],['na','N/A','N/A']];
const bulkPacks=new Set(['ibc','drum','bag']);
const responsibleParties=[['union','Union Cosmetic','Union Cosmetic'],['customer','Zákazník','Customer']];
const quantityUnit=[['ml','ml','ml'],['l','l','l'],['g','g','g'],['kg','kg','kg']];
const field=(key,cs,en,kind='text',options)=>({key,label:[cs,en],kind,options});
const choice=(key,cs,en,options)=>field(key,cs,en,'select',options);
const confirm=(key,cs,en)=>field(key,cs,en,'check',check);
const group=(cs,en,fields)=>({label:[cs,en],fields});
const packGroup=(cs,en,fields)=>({...group(cs,en,fields),packaging:true});
const product=[
 field('productName','Oficiální název výrobku','Official product name'),
 choice('category','Kategorie výrobku','Product category',categories),
 choice('packaging','Primární obal','Primary packaging',packaging),
 choice('cooperation','Typ spolupráce','Cooperation',cooperation),
 field('fill','Objem/Obsah','Volume/Content','decimal'),
 choice('fillUnit','Jednotka','Unit',quantityUnit)
];
const project=[
 field('name','Název projektu','Project name'),
 field('customer','Zákazník','Customer'),
 field('market','Cílový trh','Target market'),
 field('brand','Značka','Brand')
];
const closure=field('closure','Uzávěr','Closure');
const packagingSpec=field('packagingSpec','Specifikace obalu','Packaging specification');
const bodyMaterial=field('bodyMaterial','Materiál obalu','Packaging material');
const pouchSize=field('pouchSize','Rozměr sáčku','Pouch dimensions');
const adhesive=field('adhesive','Materiál etikety','Label material');
const compatibility=confirm('compatibility','Zkouška hmoty v obalu','Formula/packaging compatibility');
const lineTrial=confirm('lineTrial','Zkouška plnění','Filling trial');

const profiles={
 dpak:[
  group('D-PAK','D-PAK',[packagingSpec,field('blank','Kód blanku','Blank code'),
   choice('barrier','Bariéra','Barrier',[['evoh','EVOH','EVOH'],['alu','Alu','Aluminium']]),
   closure,choice('capSeal','Přelepka přes víčko','Cap seal',[['yes','Ano','Yes'],['na','N/A','N/A']]),
   field('repro','Odkaz na schválené repro','Approved repro reference')]),
  group('Zkoušky D-PAK','D-PAK trials',[compatibility,lineTrial,confirm('sealTrial','Těsnost obalu','Pack leak test'),
   field('trialReference','Protokol o zkoušce','Trial report reference')])
 ],
 doypack:[
  group('Doypack','Doypack',[packagingSpec,pouchSize,field('laminate','Laminát','Laminate'),
   choice('pouchClosure','Uzavírání','Closure method',[['spout','Výpusť','Spout'],['weld','Svar','Heat seal'],['zip','Zip','Zip']]),
   field('spout','Specifikace výpusti','Spout specification')]),
  group('Zkoušky doypacku','Doypack trials',[compatibility,lineTrial,confirm('sealTrial','Těsnost sáčku','Pouch leak test'),
   field('trialReference','Protokol o zkoušce','Trial report reference')])
 ],
 bottle:[group('Lahev','Bottle',[packagingSpec,bodyMaterial,closure,adhesive,
  confirm('sealTrial','Těsnost lahve','Bottle leak test'),confirm('labelTrial','Přilnavost etikety','Label adhesion')])],
 canister:[group('Kanystr','Canister',[packagingSpec,bodyMaterial,closure,adhesive,
  confirm('sealTrial','Těsnost kanystru','Canister leak test')])],
 tube:[group('Tuba','Tube',[packagingSpec,bodyMaterial,closure,field('seal','Způsob svaření tuby','Tube sealing method'),
  confirm('sealTrial','Pevnost svaru','Seal strength')])],
 jar:[group('Kelímek','Jar',[packagingSpec,bodyMaterial,closure,field('liner','Vložka víčka','Cap liner'),
  compatibility])],
 airless:[group('Airless','Airless',[packagingSpec,bodyMaterial,field('pump','Specifikace pumpy','Pump specification'),
  field('dose','Dávka pumpy (ml)','Pump dose (ml)','decimal'),compatibility,confirm('pumpTrial','Funkce pumpy','Pump operation')])],
 sachet:[group('Sáček','Sachet',[packagingSpec,pouchSize,field('laminate','Laminát','Laminate'),
  confirm('sealTrial','Pevnost svaru','Seal strength')])],
 box:[group('Krabička','Folding box',[packagingSpec,field('boxSize','Rozměr krabičky','Box dimensions'),
  field('dieline','Výsek','Dieline reference'),confirm('boxFit','Výrobek v krabičce vyzkoušen','Product fit tested')])],
 ibc:bulkProfile('IBC','IBC'),
 drum:bulkProfile('Sud','Drum'),
 bag:bulkProfile('Vak','Bulk bag')
};

function bulkProfile(cs,en){
 return [group(cs,en,[packagingSpec,field('capacity','Kapacita obalu (l)','Container capacity (l)','decimal'),
  field('outlet','Výpust','Outlet'),field('containerSupplier','Dodavatel obalu','Container supplier'),
  choice('returnable','Vrácení obalu','Container return',[['yes','Ano','Yes'],['na','N/A','N/A']])])];
}

function groups(tab,values,packagingValues){
 if(tab==='customer')return [
  group('Zakázka','Project',project),
  group('Kontaktní údaje','Contact details',[
   field('contact','Kontaktní osoba','Contact person'),field('email','E-mail','Email','email'),
   field('phone','Telefon','Phone','tel'),field('registrationCountry','Země registrace','Country of registration'),
   field('companyNumber','Company Registration No.','Company Registration No.','optional'),
   field('taxId','DIČ / VAT ID','VAT ID','optional'),
   field('invoiceAddress','Fakturační adresa','Billing address','address'),
   field('deliveryAddress','Dodací adresa','Shipping address','address')
  ]),
  group('Obchodní podmínky','Commercial terms',[
   field('price','Cena za kus','Unit price','decimal'),field('currency','Měna','Currency'),
   field('moq','MOQ','MOQ','number'),field('incoterm','Incoterm','Incoterm'),field('deliveryPlace','Místo dodání','Place of delivery'),
   field('advance','Záloha (%)','Advance (%)','decimal'),field('balanceDue','Splatnost doplatku','Balance due')
  ])
 ];
 if(tab==='product')return [
  group('Výrobek','Product',product),
  group('Hmota','Formula',[
   field('formula','ID hmoty','Formula ID'),field('sample','Vzorek','Sample','check',sample),
   ...(values.sample==='approved'?[field('sampleReference','Odkaz na vzorek','Sample reference')]:[])
  ]),
  ...(Object.hasOwn(profiles,values.packaging)?profiles[values.packaging]:[]).map(section=>({
   ...section,packaging:true,
   fields:section.fields.filter(field=>field.key!=='spout'||packagingValues?.pouchClosure==='spout')
  })),
  ...((values.packaging&&values.cooperation==='cofilling')?[packGroup('Co-filling','Co-filling',[
   field('bulkSupplier','Dodavatel hmoty','Bulk supplier'),field('bulkContainer','Příchozí obal hmoty','Incoming bulk container'),
   field('bulkBatch','Šarže dodané hmoty','Incoming bulk batch'),field('bulkProcessing','Postup přípravy hmoty','Bulk preparation procedure'),
   confirm('bulkCoa','CoA dodané hmoty převzato','Bulk CoA received'),
   confirm('bulkProcessingApproved','Postup plnění potvrzen','Filling method confirmed')
  ])]:[]),
  ...(values.packaging?[packGroup('Značení','Marking',[
   field('marking','Značení primárního obalu','Primary pack marking','check',marking),
   ...(packagingValues?.marking!=='na'?[field('artwork','Odkaz na tisková data','Artwork reference')]:[]),
   field('productEan','EAN výrobku','Product EAN',bulkPacks.has(values.packaging)?'optional':'text'),
   field('batchFormat','Formát šarže','Batch format','optional'),
   field('productionDateFormat','Formát data výroby','Production date format','optional'),
   field('expiryDateFormat','Formát data použitelnosti','Expiry date format','optional'),
   field('codePosition','Umístění dotisku','Code position','optional'),
   confirm('artworkApproved','Tisková data schválena','Artwork approved'),
   confirm('packApproved','Primární obal schválen','Primary pack approved')
  ])]:[]),
  ...((values.packaging&&!bulkPacks.has(values.packaging))?[packGroup('Karton a paleta','Carton and pallet',[
   field('carton','Specifikace kartonu','Carton specification','optional'),field('caseUnits','Kusů v kartonu','Units per carton','number'),
   field('cartonEan','EAN kartonu','Carton EAN','optional'),field('cartonLabel','Kartonový štítek','Carton label','optional'),
   field('palletUnits','Kusů na paletě','Units per pallet','number'),
   field('palletLabel','Paletový štítek','Pallet label','optional'),
   confirm('cartonApproved','Karton schválen','Carton approved'),confirm('cartonLabelApproved','Kartonový štítek schválen','Carton label approved')
  ])]:[]),
  group('Odpovědnost','Responsibility',[
   choice('responsiblePerson','Odpovědná osoba za výrobek','Responsible person',responsibleParties)
  ])
 ];
 return [];
}

function requiredFields(values){
 const fields=['name','customer','market','category','cooperation','productName','packaging','fill','fillUnit','price','currency'];
 if(values.cooperation!=='cofilling')fields.push('formula');
 if(!bulkPacks.has(values.packaging))fields.push('productEan');
 if(values.category==='cosmetics')fields.push('responsiblePerson');
 return fields;
}

function completeField(key,value){
 const raw=typeof value==='object'?value?.na?'':value?.text:value;
 const text=String(raw??'').trim();
 if(!text)return false;
 if(key==='price'||key==='fill')return /^\d+(?:[.,]\d+)?$/.test(text)&&Number(text.replace(',','.'))>0;
 if(key==='productEan')return /^(?:\d{8}|\d{12,14})$/.test(text);
 return true;
}

const attachmentSections=[
 {key:'front',label:['Přední etiketa','Front label']},
 {key:'back',label:['Zadní etiketa','Back label']},
 {key:'carton',label:['Schválený kartonový štítek','Approved carton label']},
 {key:'print',label:['Tisková data','Artwork'],multiple:true},
 {key:'specification',label:['Specifikace obalu','Packaging specification'],multiple:true},
 {key:'trial',label:['Protokoly o zkouškách','Trial reports'],multiple:true},
 {key:'other',label:['Ostatní','Other files'],multiple:true}
];

const ui={
 projects:['Privátní projekty','Private projects'],add:['Nový projekt','New project'],
 customer:['Zákazník','Customer'],product:['Výrobek','Product'],attachments:['Přílohy','Attachments'],
 back:['Všechny projekty','All projects'],save:['Uložit','Save'],saving:['Ukládám…','Saving…'],
 saved:['Uloženo','Saved'],unsaved:['Neuložené změny','Unsaved changes'],
 project:['Projekt','Project'],category:['Kategorie','Category'],packaging:['Obal','Packaging'],
 market:['Trh','Market'],complete:['Vyplnění','Completeness'],updated:['Upraveno','Updated'],
 search:['Hledat projekt nebo zákazníka','Search projects or customers'],
 allCategories:['Všechny kategorie','All categories'],allPacks:['Všechny obaly','All packaging'],
 empty:['Zatím žádné projekty.','No projects yet.'],
 noMatches:['Žádné projekty neodpovídají filtrům.','No projects match the filters.'],
 loading:['Načítám projekty…','Loading projects…'],
 notFound:['Projekt nebyl nalezen v tomto prohlížeči.','The project was not found in this browser.'],
 error:['Projekty nelze načíst.','Projects could not be loaded.'],
 retry:['Zkusit znovu','Try again'],
 saveError:['Projekt se nepodařilo uložit.','The project could not be saved.'],
 conflict:['Projekt se mezitím změnil v jiné kartě. Stáhněte rozpracovanou verzi a načtěte uloženou.','The project changed in another tab. Download your draft and reload the saved version.'],
 reload:['Načíst uloženou verzi','Reload saved version'],
 reloadConfirm:['Nahradit neuložené změny uloženou verzí?','Replace unsaved changes with the saved version?'],
 required:['Vyplňte název projektu.','Enter the project name.'],
 tabLabel:['Části projektu','Project sections'],
 requiredField:['Nutné pro vyplnění na 100 %','Required for 100% completion'],
 otherCategory:['Jiné…','Other…'],newCategory:['Nová kategorie','New category'],categoryName:['Název kategorie','Category name'],
 categoryError:['Kategorii se nepodařilo uložit.','The category could not be saved.'],
 cancel:['Zrušit','Cancel'],addFile:['Přidat soubor','Add file'],replaceFile:['Nahradit soubor','Replace file'],
 getFile:['Stáhnout','Download'],removeFile:['Odebrat','Remove'],
 print:['Tisk','Print'],download:['Stáhnout přehled','Download summary'],next:['Další','Next']
};
root.JasonProjectFields={ui,packaging,categories,groups,requiredFields,completeField,attachmentSections};
})(window);
