/* Packaging is derived from logistics keys; product JSON stores only the association. */
(function(root){
'use strict';
const fields=['pack','boxes_per_layer','boxes_per_pallet'];
const invalid=new Set(['','null','undefined','___','—','-','__proto__','constructor','prototype']);
const key=value=>value==null||invalid.has(String(value).trim().toLowerCase())?null:String(value).trim();
const count=value=>{if(value==null||value==='')return '';const m=String(value).replace(',','.').match(/^\s*(-?\d+(?:\.\d+)?)(?:\s*[^\d.]*)?$/);return m&&Number.isFinite(Number(m[1]))?Number(m[1]):'';};
function cleanProduct(product){const next={...product};for(const f of fields)delete next[f];return next;}
function cleanProducts(products){return products.map(cleanProduct);}
function fromKey(product,logistics){
 const k=key(product?.key),brand=product?.brand;
 const data=k&&Object.hasOwn(logistics||{},brand)&&Object.hasOwn(logistics[brand]||{},k)?logistics[brand][k]:null;
 return {pack:count(data?.CARTON?.nr_of_items),boxes_per_layer:count(data?.LAYER?.nr_of_cartons),boxes_per_pallet:count(data?.PALLET?.nr_of_cartons)};
}
const api={fields,key,count,cleanProduct,cleanProducts,fromKey};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.UnionPackaging=api;
})(typeof window!=='undefined'?window:globalThis);
