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
const printAttachments=['front','back','print'];
const batchFormats=[['','TBD','TBD'],['standard','Standard','Standard'],['other','Jiný','Custom'],['na','N/A','N/A']];
const currencies=['EUR','USD','CZK'].map(code=>[code,code,code]);
const dpakSizes=['500','750','1000','1500','1750','2000'];
const check=[['','TBD','TBD'],['ok','Potvrzeno','Confirmed'],['na','N/A','N/A']];
const bulkPacks=new Set(['ibc','drum','bag']);
const responsibleParties=[['union','Union Cosmetic','Union Cosmetic'],['customer','Zákazník','Customer']];
const quantityUnit=[['ml','ml','ml'],['l','l','l'],['g','g','g'],['kg','kg','kg']];
const field=(key,cs,en,kind='text',options)=>({key,label:[cs,en],kind,options});
const choice=(key,cs,en,options)=>field(key,cs,en,'select',options);
const approval=(key,cs,en,attachment)=>({...field(key,cs,en,'check',check),attachment});
const trial=(key,cs,en)=>field(key,cs,en,'checkbox');
const note=()=>field('notes','Poznámka','Note','notes');
const group=(id,cs,en,fields)=>({label:[cs,en],fields:[...fields,{...note(),key:id+'Notes'}]});
const packGroup=(id,cs,en,fields)=>({...group(id,cs,en,fields),packaging:true});
const product=pack=>[
 field('productName','Oficiální název výrobku','Official product name'),
 choice('category','Kategorie výrobku','Product category',categories),
 choice('packaging','Primární obal','Primary packaging',packaging),
 choice('cooperation','Typ spolupráce','Cooperation',cooperation),
 ...(pack==='dpak'?[choice('fill','Objem','Volume',dpakSizes.map(size=>[size,size,size])),
  field('fillUnit','Jednotka','Unit','fixed')]:[
  field('fill','Objem / obsah','Volume / content','decimal'),choice('fillUnit','Jednotka','Unit',quantityUnit)])
];
const project=[
 field('customer','Zákazník','Customer'),
 field('market','Cílový trh','Target market'),
 field('brand','Značka','Brand')
];
const closure=field('closure','Specifikace uzávěru','Closure specification','multiline');
const packagingSpec=field('packagingSpec','Specifikace obalu','Packaging specification','multiline');
const labelSpec=field('labelSpec','Specifikace etikety','Label specification','multiline');
const bodyMaterial=field('bodyMaterial','Materiál obalu','Packaging material');
const pouchSize=field('pouchSize','Rozměr sáčku','Pouch dimensions');
const profiles={
 dpak:[
  group('primary','D-PAK','D-PAK',[
   choice('barrier','Varianta D-PAK','D-PAK variant',[['evoh','EVOH','EVOH'],['alu','ALU','ALU']]),
   packagingSpec,closure,field('blank','Kód blanku','Blank code'),
   choice('capSeal','Přelepka přes víčko','Cap seal',[['yes','Ano','Yes'],['na','N/A','N/A']])]),
  group('trials','Zkoušky D-PAK','D-PAK trials',[
   trial('compatibility','Zkouška hmoty u Elopaku','Formula test at Elopak'),
   trial('lineTrial','Zkouška plnění u nás včetně těsnosti','In-house filling test including leak check')])
 ],
 bottle:[group('primary','Lahev','Bottle',[packagingSpec,closure,bodyMaterial])],
 canister:[group('primary','Kanystr','Canister',[packagingSpec,closure,bodyMaterial])],
 tube:[group('primary','Tuba','Tube',[packagingSpec,closure,bodyMaterial,field('seal','Způsob svaření tuby','Tube sealing method')])],
 jar:[group('primary','Kelímek','Jar',[packagingSpec,closure,bodyMaterial,field('liner','Vložka víčka','Cap liner')])],
 airless:[group('primary','Airless','Airless',[packagingSpec,field('pump','Specifikace pumpy','Pump specification','multiline'),
  bodyMaterial,field('dose','Dávka pumpy (ml)','Pump dose (ml)','decimal')])],
 sachet:[group('primary','Sáček','Sachet',[packagingSpec,pouchSize,field('laminate','Laminát','Laminate')])],
 box:[group('primary','Krabička','Folding box',[packagingSpec,field('boxSize','Rozměr krabičky','Box dimensions'),
  field('dieline','Výsek','Dieline reference')])],
 ibc:bulkProfile('IBC','IBC'),
 drum:bulkProfile('Sud','Drum'),
 bag:bulkProfile('Vak','Bulk bag')
};

function bulkProfile(cs,en){
 return [group('primary',cs,en,[packagingSpec,field('capacity','Kapacita obalu (l)','Container capacity (l)','decimal'),
  field('outlet','Výpust','Outlet'),field('containerSupplier','Dodavatel obalu','Container supplier'),
  choice('returnable','Vrácení obalu','Container return',[['yes','Ano','Yes'],['na','N/A','N/A']])])];
}

function groups(tab,values,packagingValues){
 if(tab==='customer')return [
  group('order','Zakázka','Project',project),
  group('contact','Kontaktní údaje','Contact details',[
   field('contact','Kontaktní osoba','Contact person'),field('email','E-mail','Email','email'),
   field('phone','Telefon','Phone','tel'),field('registrationCountry','Země registrace','Country of registration'),
   field('companyNumber','Company Registration No.','Company Registration No.','optional'),
   field('taxId','DIČ / VAT ID','VAT ID','optional'),
   field('invoiceAddress','Fakturační adresa','Billing address','address'),
   field('deliveryAddress','Dodací adresa','Shipping address','address')
  ]),
  group('terms','Obchodní podmínky','Commercial terms',[
   field('price','Cena za kus','Unit price','decimal'),choice('currency','Měna','Currency',currencies),
   field('moq','MOQ','MOQ','number'),field('incoterm','Incoterm','Incoterm'),
   field('advance','Záloha (%)','Advance (%)','decimal'),field('balanceDue','Splatnost doplatku','Balance due')
  ])
 ];
 if(tab==='product')return [
  group('product','Výrobek','Product',product(values.packaging)),
  group('formula','Hmota','Formula',[
   field('formula','ID hmoty','Formula ID'),{...field('sample','Vzorek','Sample','check',sample),attachment:'sample'},
   ...(values.sample==='approved'?[field('sampleReference','Odkaz na vzorek','Sample reference')]:[])
  ]),
  ...(Object.hasOwn(profiles,values.packaging)?profiles[values.packaging]:[]).map(section=>({...section,packaging:true})),
  ...((values.packaging&&values.cooperation==='cofilling')?[packGroup('cofilling','Co-filling','Co-filling',[
   field('bulkSupplier','Dodavatel hmoty','Bulk supplier'),field('bulkContainer','Příchozí obal hmoty','Incoming bulk container'),
   field('bulkBatch','Šarže dodané hmoty','Incoming bulk batch'),field('bulkProcessing','Postup přípravy hmoty','Bulk preparation procedure'),
   approval('bulkCoa','CoA dodané hmoty převzato','Bulk CoA received','bulkCoa'),
   approval('bulkProcessingApproved','Postup plnění potvrzen','Filling method confirmed','bulkProcessing')
  ])]:[]),
  ...(values.packaging?[markingSection(values.packaging,packagingValues)]:[]),
  ...((values.packaging&&!bulkPacks.has(values.packaging))?[packGroup('carton','Karton a paleta','Carton and pallet',[
   field('carton','Specifikace kartonu','Carton specification','optionalMultiline'),
   field('caseUnits','Kusů v kartonu','Units per carton','number'),
   field('cartonEan','EAN kartonu','Carton EAN','optional'),
   field('palletUnits','Kusů na paletě','Units per pallet','number'),
   field('palletLabel','Paletový štítek','Pallet label','optional'),
   approval('cartonApproved','Karton schválen','Carton approved','cartonSpecification'),
   {...field('cartonLabelApproved','Kartonový štítek','Carton label','check',sample),attachment:'carton'}
  ])]:[]),
  group('responsibility','Odpovědnost','Responsibility',[
   choice('responsiblePerson','Odpovědná osoba za výrobek','Responsible person',responsibleParties)
  ])
 ];
 return [];
}

function markingSection(pack,data){
 const isDoypack=pack==='doypack';
 const artwork=isDoypack?'print':printAttachments;
 return packGroup('marking','Značení','Marking',[
  ...(isDoypack?[]:[field('marking','Značení primárního obalu','Primary pack marking','check',marking),labelSpec]),
  field('productEan','EAN výrobku','Product EAN',bulkPacks.has(pack)?'optional':'text'),
  field('batchMode','Formát šarže','Batch format','check',batchFormats),
  ...(data?.batchMode==='other'?[{...field('batchFormat','Vlastní formát šarže','Custom batch format'),upload:'batch'}]:[]),
  ...(isDoypack?[]:[
   field('productionDateFormat','Formát data výroby','Production date format','optional'),
   field('expiryDateFormat','Formát data použitelnosti','Expiry date format','optional')]),
  {...approval('artworkCustomer','Tisková data – zákazník','Artwork – customer',artwork),row:true},
  {...approval('artworkUnion','Tisková data – Union Cosmetic','Artwork – Union Cosmetic',artwork),row:true},
  ...(isDoypack?[]:[approval('packApproved','Primární obal schválen','Primary pack approved','specification')])
 ]);
}

function requiredFields(values){
 const fields=['customer','market','category','cooperation','productName','packaging','fill','fillUnit','price','currency'];
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

function numericKind(field){
 if(['number','decimal'].includes(field.kind))return field.kind;
 if(['productEan','cartonEan'].includes(field.key))return 'ean';
 if(['companyNumber','taxId'].includes(field.key))return 'identifier';
 return '';
}

function validNumber(kind,value){
 if(!value)return true;
 if(/\s/u.test(value))return false;
 const patterns={number:/^\d+$/,decimal:/^\d+(?:[.,]\d+)?$/,ean:/^(?:\d{8}|\d{12,14})$/,identifier:/^[^\s]+$/};
 return !patterns[kind]||patterns[kind].test(value);
}

const attachmentSections=[
 {key:'front',label:['Přední etiketa','Front label']},
 {key:'back',label:['Zadní etiketa','Back label']},
 {key:'print',label:['Další tisková data','Other artwork'],multiple:true},
 {key:'specification',label:['Specifikace obalu','Packaging specification'],multiple:true},
 {key:'carton',label:['Kartonový štítek','Carton label']},
 {key:'cartonSpecification',label:['Specifikace kartonu','Carton specification'],multiple:true},
 {key:'sample',label:['Vzorek','Sample'],multiple:true},
 {key:'batch',label:['Ukázka formátu šarže','Batch format example']},
 {key:'bulkCoa',label:['CoA dodané hmoty','Bulk CoA']},
 {key:'bulkProcessing',label:['Postup plnění','Filling method'],multiple:true}
];

const ui={
 projects:['Privátní projekty','Private projects'],add:['Nový projekt','New project'],
 customer:['Zákazník','Customer'],product:['Výrobek','Product'],attachments:['Přílohy','Attachments'],
 back:['Všechny projekty','All projects'],save:['Uložit','Save'],saving:['Ukládám…','Saving…'],
 saved:['Uloženo','Saved'],unsaved:['Neuložené změny','Unsaved changes'],
 history:['Historie','History'],notes:['Poznámka','Note'],category:['Kategorie','Category'],packaging:['Obal','Packaging'],
 market:['Trh','Market'],complete:['Vyplnění','Completeness'],updated:['Upraveno','Updated'],
 search:['Hledat zákazníka nebo výrobek','Search customers or products'],
 allCustomers:['Všichni zákazníci','All customers'],
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
 required:['Vyplňte zákazníka.','Enter the customer.'],
 invalid:['Opravte zvýrazněný údaj.','Correct the highlighted field.'],
 tabLabel:['Části projektu','Project sections'],
 requiredField:['Nutné pro vyplnění na 100 %','Required for 100% completion'],
 otherCategory:['Jiné…','Other…'],newCategory:['Nová kategorie','New category'],categoryName:['Název kategorie','Category name'],
 categoryError:['Kategorii se nepodařilo uložit.','The category could not be saved.'],
 cancel:['Zrušit','Cancel'],
 dropFile:['Přetáhněte soubor nebo klikněte','Drop a file or click to browse'],
 dropFiles:['Přetáhněte soubory nebo klikněte','Drop files or click to browse'],
 dropReplacement:['Nahradit soubor','Replace file'],
 otherFiles:['Ostatní','Other'],attachmentName:['Název přílohy','Attachment name'],
 unnamedProject:['Rozpracovaný projekt','Project draft'],
 number:['Zadejte celé číslo bez mezer.','Enter a whole number without spaces.'],
 decimal:['Zadejte číslo bez mezer, s desetinnou čárkou nebo tečkou.','Enter a number without spaces, using a decimal point or comma.'],
 ean:['Zadejte EAN bez mezer (8 nebo 12–14 číslic).','Enter an EAN without spaces (8 or 12–14 digits).'],
 identifier:['Zadejte údaj bez mezer.','Enter the value without spaces.'],
 attachmentMissing:['Chybí příloha','Attachment missing'],
 approveAnyway:['Potvrdit bez přílohy','Confirm without attachment'],
 attachmentRemoved:['Chybí příloha ke schválení','Approval attachment missing'],
 keepApproved:['Ponechat schválení','Keep approval'],
 confirmRemoveHistory:['Smazat tento záznam z historie?','Delete this history entry?'],
 noHistory:['Zatím žádné změny.','No changes yet.'],
 removeHistory:['Smazat z historie','Delete from history'],
 previous:['Před změnou','Before'],current:['Po změně','After'],
 yes:['Ano','Yes'],
 getFile:['Stáhnout','Download'],removeFile:['Odebrat','Remove'],
 print:['Tisk','Print'],download:['Stáhnout přehled','Download summary'],next:['Další','Next']
};
root.JasonProjectFields={ui,packaging,categories,currencies,dpakSizes,groups,note,requiredFields,completeField,numericKind,validNumber,attachmentSections};
})(window);
