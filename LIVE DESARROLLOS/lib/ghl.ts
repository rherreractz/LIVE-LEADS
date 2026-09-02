import { normalizeEmail } from './leadUtils';

/**
 * "Integración con GoHighLevel (GHL)" — mantiene el nombre del módulo y la
 * forma de sus exports (GhlStatusMap/GhlStatusEntry/getGhlStatusMap/
 * lookupGhlStatus) porque el resto del código (dashboardData.ts,
 * mergeGhlStatus en leadUtils.ts, la columna "Estado GHL" de la tabla) los
 * consume tal cual — pero la FUENTE de los datos cambió.
 *
 * CAMBIO (ver CONTEXTO_GENERAL sección 8.1): a Carlo le quitaron el acceso
 * al Private Integration Token directo de GHL. A cambio, el equipo le dio
 * acceso a un API de solo lectura ya construido, que reempaca los mismos
 * contactos/pipeline/stage de GHL:
 *
 *   GET {TRESOR_CONTACTS_API_URL}?page=N&pageSize=100
 *   Header: Authorization: Bearer {TRESOR_CONTACTS_API_KEY}
 *   -> { data: [{ name, phone, email, pipeline, stage, createdAt, lastActivity }], page, pageSize, total, totalPages }
 *
 * Ya NO se llaman `/opportunities/pipelines`, `/opportunities/search` ni
 * `/users/` de GHL directamente — el API de Tresor ya entrega `pipeline` y
 * `stage` como texto legible, así que no hace falta resolver IDs de
 * pipeline/stage ni de usuario por separado.
 *
 * Nota: este API NO expone quién tiene asignado el lead (no hay
 * "assignedTo"), así que `personaEncargadaGHL` queda fija en "Sin asignar"
 * hasta que se consiga ese dato de otra fuente.
 *
 * Variables de entorno requeridas (reemplazan a GHL_PRIVATE_TOKEN /
 * GHL_LOCATION_ID / GHL_USERS_FALLBACK, que ya no se usan aquí — se dejan
 * en el .env por si el token directo de GHL se recupera más adelante y se
 * quiere revertir este cambio, ver historial de git de este archivo):
 *
 *   TRESOR_CONTACTS_API_URL="https://reporte-ads-tresor.vercel.app/api/public/contacts"
 *   TRESOR_CONTACTS_API_KEY="..."
 */

interface TresorContact {
  name: string;
  phone: string;
  email: string;
  pipeline: string;
  stage: string;
  createdAt: string;
  lastActivity: string;
}

interface TresorContactsResponse {
  data: TresorContact[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface GhlStatusEntry {
  estadoGHL: string; // antes: nombre del Stage de GHL. Ahora: campo `stage` del API de Tresor.
  pipelineGHL: string; // antes: nombre del Pipeline de GHL. Ahora: campo `pipeline` del API de Tresor.
  personaEncargadaGHL: string; // el API de Tresor no expone esto todavía — siempre "Sin asignar".
}

export interface GhlStatusMap {
  byEmail: Map<string, GhlStatusEntry>;
}

/** Trae TODOS los contactos del API de Tresor (paginado, 100 por página). */
async function fetchAllTresorContacts(apiUrl: string, apiKey: string): Promise<TresorContact[]> {
  const all: TresorContact[] = [];
  let page = 1;
  const pageSize = 100;

  // Tope de seguridad, mismo espíritu que el `safety` del fetch viejo de
  // oportunidades de GHL: máximo 60 páginas (6000 contactos) para no
  // quedar en loop si el API responde algo inesperado.
  let safety = 0;
  while (safety < 60) {
    safety += 1;

    const url = `${apiUrl}?page=${page}&pageSize=${pageSize}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (!res.ok) {
      console.error(`[ghl] Error ${res.status} al leer contactos de Tresor (página ${page}):`, await res.text());
      break;
    }

    const json: TresorContactsResponse = await res.json();
    all.push(...json.data);

    if (page >= json.totalPages) break;
    page += 1;
  }

  return all;
}

/**
 * Versión SIN caché — hace el trabajo pesado real (todas las páginas de
 * contactos). Úsala solo si necesitas datos 100% frescos ahora mismo; para
 * el uso normal del dashboard usa getGhlStatusMap() de abajo, que cachea.
 */
async function getGhlStatusMapUncached(): Promise<GhlStatusMap> {
  const apiUrl = process.env.TRESOR_CONTACTS_API_URL;
  const apiKey = process.env.TRESOR_CONTACTS_API_KEY;

  if (!apiUrl || !apiKey) {
    console.error('[ghl] Faltan TRESOR_CONTACTS_API_URL / TRESOR_CONTACTS_API_KEY — se omite el enriquecimiento de GHL.');
    return { byEmail: new Map() };
  }

  const contacts = await fetchAllTresorContacts(apiUrl, apiKey);

  const byEmail = new Map<string, GhlStatusEntry>();

  for (const contact of contacts) {
    const email = normalizeEmail(contact.email);
    if (!email) continue; // sin correo no podemos cruzarlo con tus leads

    byEmail.set(email, {
      estadoGHL: contact.stage || 'Sin etapa',
      pipelineGHL: contact.pipeline || 'Sin pipeline',
      personaEncargadaGHL: 'Sin asignar',
    });
  }

  console.log(`[ghl] Refrescado (vía Tresor Contacts API): ${byEmail.size} correos indexados de ${contacts.length} contactos.`);

  return { byEmail };
}

/**
 * CACHÉ EN MEMORIA — mismo patrón que antes. El API de Tresor pagina más
 * rápido que GHL directo (no hay que resolver pipelines/usuarios aparte),
 * pero seguimos cacheando para no pegarle en cada carga del dashboard.
 *
 * Vive mientras la función serverless siga "caliente" — en un cold start
 * se vuelve a llenar solo, sin que haya que hacer nada manualmente.
 */
const GHL_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutos

let ghlCache: { data: GhlStatusMap; fetchedAt: number } | null = null;
let ghlCacheInFlight: Promise<GhlStatusMap> | null = null;

export async function getGhlStatusMap(): Promise<GhlStatusMap> {
  const now = Date.now();

  if (ghlCache && now - ghlCache.fetchedAt < GHL_CACHE_TTL_MS) {
    return ghlCache.data;
  }

  // Si ya hay un refresh en curso (dos requests casi al mismo tiempo con
  // el caché vencido), que ambas esperen la MISMA llamada en vez de
  // disparar el fetch pesado dos veces por separado.
  if (ghlCacheInFlight) {
    return ghlCacheInFlight;
  }

  ghlCacheInFlight = getGhlStatusMapUncached()
    .then((data) => {
      ghlCache = { data, fetchedAt: Date.now() };
      return data;
    })
    .finally(() => {
      ghlCacheInFlight = null;
    });

  return ghlCacheInFlight;
}

/** Busca el estado de GHL (vía Tresor) de un lead por su correo (ya normalizado o crudo). */
export function lookupGhlStatus(map: GhlStatusMap, email?: string | null): GhlStatusEntry | null {
  const key = normalizeEmail(email);
  if (!key) return null;
  return map.byEmail.get(key) ?? null;
}