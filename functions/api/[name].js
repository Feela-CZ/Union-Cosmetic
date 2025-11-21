// functions/api/[name].js
export async function onRequest(context) {
  const { request, env, params } = context;
  const name = params.name;

  if (!['products','logistics'].includes(name))
    return cors(new Response('Not found',{status:404}), request);

  if (request.method === 'OPTIONS')
    return preflight(request);

  const owner  = env.GH_OWNER;
  const repo   = env.GH_REPO;
  const branch = env.GH_BRANCH || 'main';

  const prefix   = env.GH_PATH ? env.GH_PATH.replace(/\/+$/,'') + '/' : '';
  const specific = env[`GH_${name.toUpperCase()}_PATH`];
  const filePath = specific ? specific : `${prefix}${name}.json`;

  const apiBase =
    `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(filePath)}`;

  const headers = {
    'Accept': 'application/vnd.github+json',
    'Authorization': `Bearer ${env.GITHUB_TOKEN}`,
    'X-GitHub-Api-Version': '2022-11-28'
  };

  try {
    // ---------- GET ----------
    if (request.method === 'GET') {
      const res = await fetch(`${apiBase}?ref=${encodeURIComponent(branch)}`, { headers });
      if (!res.ok)
        return cors(new Response('GitHub GET failed: ' + res.status, {status:502}), request);

      const data = await res.json();
      const jsonStr = atob(data.content);

      return cors(
        new Response(jsonStr, {
          headers: {
            'Content-Type':'application/json',
            'Cache-Control':'no-store'
          }
        }),
        request
      );
    }

    // ---------- PUT ----------
    if (request.method === 'PUT') {
      const bodyText = await request.text();

      let parsed;
      try { parsed = JSON.parse(bodyText); }
      catch(e) {
        return cors(new Response('Invalid JSON',{status:400}), request);
      }

      // 1) Vytáhni SHA
      const meta = await fetch(`${apiBase}?ref=${encodeURIComponent(branch)}`, { headers });
      if (!meta.ok)
        return cors(new Response('GitHub meta failed: '+meta.status, {status:502}), request);

      const { sha } = await meta.json();

      // 2) Pauza (GitHub někdy propaguje commit pomalu)
      await new Promise(r => setTimeout(r, 3000));

      // 3) Retry logika
      let success = false;
      let putRes;

      for (let attempt = 1; attempt <= 3; attempt++) {
        putRes = await fetch(apiBase, {
          method: 'PUT',
          headers,
          body: JSON.stringify({
            message: `chore(${name}.json): update via Pages Function`,
            content: btoa(JSON.stringify(parsed, null, 2)),
            sha,
            branch
          })
        });

        if (putRes.ok) {
          success = true;
          break;
        }

        // pauza před dalším pokusem
        await new Promise(r => setTimeout(r, 2000));
      }

      if (!success)
        return cors(new Response('GitHub PUT failed: ' + putRes.status, {status:502}), request);

      return cors(
        new Response(JSON.stringify({ok:true}), {
          headers: { 'Content-Type':'application/json' }
        }),
        request
      );
    }

    // ---------- METHOD NOT ALLOWED ----------
    return cors(new Response('Method not allowed', {status:405}), request);

  } catch(err) {
    return cors(new Response('Server error: ' + err, {status:500}), request);
  }
}


// ---------- HELPERS ----------
function cors(resp, req){
  const o = req.headers.get('Origin') || '*';
  resp.headers.set('Access-Control-Allow-Origin', o);
  resp.headers.set('Vary','Origin');
  resp.headers.set('Access-Control-Allow-Methods','GET, PUT, OPTIONS');
  resp.headers.set('Access-Control-Allow-Headers','Content-Type');
  return resp;
}

function preflight(req){
  const r = new Response(null,{status:204});
  r.headers.set('Access-Control-Allow-Origin', req.headers.get('Origin') || '*');
  r.headers.set('Access-Control-Allow-Methods','GET, PUT, OPTIONS');
  r.headers.set('Access-Control-Allow-Headers','Content-Type');
  r.headers.set('Access-Control-Max-Age','86400');
  return r;
}