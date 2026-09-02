/**
 * Prueba rápida del Private Integration Token de GoHighLevel (GHL).
 *
 * Uso (desde la carpeta del proyecto):
 *   node --env-file=.env.local scripts/test-ghl-key.mjs
 *
 * Lee GHL_PRIVATE_TOKEN y GHL_LOCATION_ID del entorno y golpea los 3
 * endpoints que usa el dashboard (pipelines, users, opportunities/search).
 * Imprime el status HTTP de cada uno y un resumen. Sale con código 1 si
 * el token no sirve para leer pipelines (la señal más clara de key mala).
 */

const GHL_API_BASE = 'https://services.leadconnectorhq.com';
const GHL_API_VERSION = '2021-07-28';

const token = process.env.GHL_PRIVATE_TOKEN;
const locationId = process.env.GHL_LOCATION_ID;

function mask(v) {
  if (!v) return '(vacío)';
  if (v.length <= 10) return v[0] + '***';
  return `${v.slice(0, 6)}…${v.slice(-4)} (len ${v.length})`;
}

console.log('— Config detectada —');
console.log('  GHL_PRIVATE_TOKEN:', mask(token));
console.log('  GHL_LOCATION_ID  :', locationId || '(vacío)');
console.log('');

if (!token || !locationId) {
  console.error('✗ Faltan GHL_PRIVATE_TOKEN / GHL_LOCATION_ID. ¿Corriste con --env-file=.env.local?');
  process.exit(1);
}

const headers = {
  Authorization: `Bearer ${token}`,
  Version: GHL_API_VERSION,
  Accept: 'application/json',
};

async function probe(label, url) {
  const started = Date.now();
  try {
    const res = await fetch(url, { headers });
    const ms = Date.now() - started;
    const body = await res.text();
    let parsed;
    try {
      parsed = JSON.parse(body);
    } catch {
      parsed = null;
    }
    const ok = res.ok;
    console.log(`${ok ? '✓' : '✗'} ${label}: HTTP ${res.status} (${ms} ms)`);
    if (!ok) {
      console.log('   respuesta:', body.slice(0, 400));
    }
    return { label, status: res.status, ok, parsed };
  } catch (err) {
    console.log(`✗ ${label}: error de red — ${err.message}`);
    return { label, status: 0, ok: false, parsed: null };
  }
}

const loc = encodeURIComponent(locationId);

const results = [];
results.push(
  await probe('pipelines', `${GHL_API_BASE}/opportunities/pipelines?locationId=${loc}`),
);
results.push(await probe('users', `${GHL_API_BASE}/users/?locationId=${loc}`));
results.push(
  await probe(
    'opportunities/search',
    `${GHL_API_BASE}/opportunities/search?location_id=${loc}&limit=2`,
  ),
);

console.log('\n— Resumen —');
const pipelines = results.find((r) => r.label === 'pipelines');
if (pipelines?.ok) {
  const list = pipelines.parsed?.pipelines ?? [];
  console.log(`  Pipelines encontrados: ${list.length}`);
  for (const p of list) {
    console.log(`   • ${p.name} (${p.stages?.length ?? 0} stages)`);
  }
}
const users = results.find((r) => r.label === 'users');
if (users?.ok) {
  console.log(`  Usuarios encontrados: ${(users.parsed?.users ?? []).length}`);
}
const opps = results.find((r) => r.label === 'opportunities/search');
if (opps?.ok) {
  console.log(
    `  Oportunidades (total reportado): ${opps.parsed?.meta?.total ?? opps.parsed?.total ?? 'n/d'}`,
  );
}

const keyWorks = pipelines?.ok === true;
console.log('');
console.log(keyWorks ? '✓ La key de GHL FUNCIONA.' : '✗ La key de GHL NO funciona (o falta permiso).');
process.exit(keyWorks ? 0 : 1);
