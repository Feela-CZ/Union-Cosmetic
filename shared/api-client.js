export async function loadProducts() {
  const r = await fetch(`/api/products?ts=${Date.now()}`);
  if (!r.ok) throw new Error('Load products failed: ' + r.status);
  return await r.json();
}

export async function loadLogistics() {
  const r = await fetch(`/api/logistics?ts=${Date.now()}`);
  if (!r.ok) throw new Error('Load logistics failed: ' + r.status);
  return await r.json();
}

export async function saveProducts(products) {
  // Více pokusů při dočasném selhání (timeout, výpadek, race na GitHubu)
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const r = await fetch('/api/products', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(products)
      });

      if (!r.ok) {
        throw new Error((await r.text()) || 'Save products failed');
      }

      // Úspěch – vracíme odpověď (nebo fallback {ok:true})
      return await r.json().catch(() => ({ ok: true }));
    } catch (err) {
      console.warn(`saveProducts attempt ${attempt} failed:`, err);
      // Po posledním pokusu už nečekáme, jen spadne chyba
      if (attempt === 3) break;
      // Krátká pauza před dalším pokusem
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  throw new Error('Save products failed after 3 retries');
}

export async function saveLogistics(logistics) {
  const r = await fetch('/api/logistics', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(logistics)
  });
  if (!r.ok) throw new Error((await r.text()) || 'Save logistics failed');
  return r.json().catch(() => ({ ok: true }));
}