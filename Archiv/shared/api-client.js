
export async function loadProducts() {
  const r = await fetch(`/api/products?ts=${Date.now()}`);
  if(!r.ok) throw new Error('Load products failed: '+r.status);
  return await r.json();
}
export async function loadLogistics() {
  const r = await fetch(`/api/logistics?ts=${Date.now()}`);
  if(!r.ok) throw new Error('Load logistics failed: '+r.status);
  return await r.json();
}
export async function saveProducts(products) {
  const r = await fetch('/api/products', { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify(products) });
  if(!r.ok) throw new Error(await r.text() || 'Save products failed');
  return r.json().catch(()=>({ok:true}));
}
export async function saveLogistics(logistics) {
  const r = await fetch('/api/logistics', { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify(logistics) });
  if(!r.ok) throw new Error(await r.text() || 'Save logistics failed');
  return r.json().catch(()=>({ok:true}));
}
