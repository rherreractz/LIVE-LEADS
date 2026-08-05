import type { RawLead, ProcessedLead, MotivoCategoria, LeadStatus } from './types';
import type { HubspotStatusMap, HubspotContactInfo } from './hubspot';

const SMALL_WORDS = new Set([
  'a', 'de', 'del', 'la', 'el', 'los', 'las', 'en', 'y', 'o', 'un', 'una', 'al',
]);

/**
 * Limpia un valor "crudo" proveniente de Facebook Lead Ads.
 * Ej: "en_los_próximos_3_a_6_meses." -> "En los próximos 3 a 6 meses"
 */
export function cleanRawText(value?: string | null): string {
  if (!value) return 'No especificado';

  const normalized = value
    .replace(/_/g, ' ')
    .replace(/\.+$/, '')
    .trim()
    .toLowerCase();

  if (!normalized) return 'No especificado';

  return normalized
    .split(' ')
    .filter(Boolean)
    .map((word, index) => {
      if (/^\d/.test(word)) return word;
      if (index !== 0 && SMALL_WORDS.has(word)) return word;
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
}

/**
 * Limpia específicamente montos de presupuesto, preservando el símbolo "$"
 * y normalizando unidades monetarias a mayúsculas.
 * Ej: "$2_a_3_mdp" -> "$2 a 3 MDP"
 */
export function cleanBudget(value?: string | null): string {
  if (!value) return 'No especificado';

  let cleaned = value.replace(/_/g, ' ').replace(/\.+$/, '').trim();
  cleaned = cleaned
    .replace(/\bmdp\b/gi, 'MDP')
    .replace(/\busd\b/gi, 'USD')
    .replace(/\bmxn\b/gi, 'MXN');

  return cleaned || 'No especificado';
}

/** Extrae el primer número de un string, útil para ordenar rangos de presupuesto. */
function extractLeadingNumber(text: string): number {
  const match = text.match(/(\d+(\.\d+)?)/);
  return match ? parseFloat(match[1]) : Number.POSITIVE_INFINITY;
}

export function normalizePhone(phone?: string | null): string {
  if (!phone) return '';
  // se queda con los últimos 10 dígitos para tolerar +52, lada, espacios, etc.
  return phone.replace(/\D/g, '').slice(-10);
}

export function normalizeEmail(email?: string | null): string {
  if (!email) return '';
  return email.trim().toLowerCase();
}

/**
 * Clasifica el motivo del lead en "Vivir" / "Invertir" / "Otro" a partir
 * del texto crudo, buscando palabras clave (antes de aplicar cleanRawText).
 */
export function classifyMotivo(motivo?: string | null): MotivoCategoria {
  if (!motivo) return 'Otro';
  const lower = motivo.toLowerCase();
  if (lower.includes('vivir')) return 'Vivir';
  if (lower.includes('invertir') || lower.includes('inversion') || lower.includes('inversión')) {
    return 'Invertir';
  }
  return 'Otro';
}

/**
 * Intenta parsear fechas en formatos comunes de Sheets/Meta (dd/mm/yyyy,
 * dd/mm/yyyy hh:mm:ss, ISO 8601). Devuelve null si no se puede interpretar.
 */
export function parseLeadDate(value?: string | null): Date | null {
  if (!value) return null;

  const dmy = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (dmy) {
    const [, d, m, y] = dmy;
    const date = new Date(Number(y), Number(m) - 1, Number(d));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function formatDateKey(date: Date): string {
  return date.toISOString().slice(0, 10); // YYYY-MM-DD
}

/** Formatea la fecha para mostrar en la tabla, ej. "07 jul 2026". */
export function formatLeadDate(date: Date | null): string {
  if (!date) return 'Sin fecha';
  return date.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
}

/**
 * Procesa el arreglo crudo proveniente de Google Sheets:
 *  - Limpia campos de texto libre (Presupuesto, Motivo, TiempoParaInvertir).
 *  - Detecta duplicados evaluando Telefono O Correo: la primera ocurrencia
 *    se marca como "Válido", las siguientes con el mismo teléfono o correo
 *    se marcan como "Duplicado".
 */
export function processLeads(rawLeads: RawLead[]): ProcessedLead[] {
  const seenPhones = new Set<string>();
  const seenEmails = new Set<string>();

  return rawLeads.map((lead, index) => {
    const phoneKey = normalizePhone(lead.Telefono);
    const emailKey = normalizeEmail(lead.Correo);

    const isDuplicate =
      (phoneKey !== '' && seenPhones.has(phoneKey)) ||
      (emailKey !== '' && seenEmails.has(emailKey));

    if (phoneKey) seenPhones.add(phoneKey);
    if (emailKey) seenEmails.add(emailKey);

    const parsedDate = parseLeadDate(lead.Fecha);

    return {
      ...lead,
      id: `lead-${index}-${phoneKey || emailKey || index}`,
      status: isDuplicate ? 'Duplicado' : 'Válido',
      parsedDate,
      presupuestoClean: cleanBudget(lead.Presupuesto),
      motivoClean: cleanRawText(lead.Motivo),
      tiempoClean: cleanRawText(lead.TiempoParaInvertir),
      motivoCategoria: classifyMotivo(lead.Motivo),
    };
  });
}

/**
 * Convierte un contacto de HubSpot (que no tiene lead correspondiente en el
 * Sheet) en un RawLead "sintético". Los campos que solo existen en el Sheet
 * (Presupuesto, Motivo, Campaña, etc.) quedan vacíos porque HubSpot no los
 * tiene — se muestran como "No especificado" una vez que pasan por
 * processLeads().
 */
function hubspotContactToRawLead(contact: HubspotContactInfo): RawLead {
  return {
    Fecha: contact.fechaCreacion || '',
    Campana: 'HubSpot',
    Nombre: contact.nombre || 'Sin nombre',
    Correo: contact.correo || '',
    Telefono: contact.telefono || '',
    Presupuesto: '',
    Motivo: '',
    TiempoParaInvertir: '',
    Equipo: '',
    Fuente: 'HubSpot',
    Proveedor: '',
    Formulario: '',
    Etapa: '',
    Comentarios: 'Contacto de HubSpot sin lead correspondiente en el Google Sheet.',
  };
}

/**
 * Convierte TODOS los contactos de HubSpot en RawLead. Útil si algún día
 * quieres usar HubSpot como única fuente. Los campos que solo existían en
 * el Sheet (Presupuesto, Motivo, Campaña real, etc.) quedan vacíos.
 */
export function getHubspotRawLeads(hubspotMap: HubspotStatusMap): RawLead[] {
  return hubspotMap.all.map(hubspotContactToRawLead);
}

/**
 * Devuelve un RawLead sintético por cada contacto de HubSpot que NO tenga
 * ya un lead con el mismo teléfono o correo en `existingLeads` (los del
 * Google Sheet). Se usa para combinar ambas fuentes sin duplicar: el Sheet
 * sigue siendo la base (con Equipo/Fuente/Proveedor reales), y esto agrega
 * los contactos que solo existen en HubSpot (ej. los que no pasaron por el
 * flujo normal de Meta Lead Ads).
 */
export function getHubspotOnlyRawLeads(existingLeads: RawLead[], hubspotMap: HubspotStatusMap): RawLead[] {
  const existingPhones = new Set<string>();
  const existingEmails = new Set<string>();

  existingLeads.forEach((lead) => {
    const phoneKey = normalizePhone(lead.Telefono);
    const emailKey = normalizeEmail(lead.Correo);
    if (phoneKey) existingPhones.add(phoneKey);
    if (emailKey) existingEmails.add(emailKey);
  });

  const nuevos = hubspotMap.all.filter((contact) => {
    const phoneKey = normalizePhone(contact.telefono);
    const emailKey = normalizeEmail(contact.correo);
    return !((phoneKey && existingPhones.has(phoneKey)) || (emailKey && existingEmails.has(emailKey)));
  });

  console.log(
    `[hubspot] Leads del Sheet: ${existingLeads.length} | Contactos de HubSpot: ${hubspotMap.all.length} | Solo en HubSpot: ${nuevos.length}`,
  );

  return nuevos.map(hubspotContactToRawLead);
}

/**
 * Cruza los leads procesados (Google Sheets) con el mapa de estados de
 * HubSpot, buscando primero por teléfono y usando el correo como respaldo.
 * Los leads sin match en HubSpot quedan con 'Sin dato' en ambos campos.
 */
export function mergeHubspotStatus(leads: ProcessedLead[], hubspotMap: HubspotStatusMap): ProcessedLead[] {
  let matched = 0;

  const result = leads.map((lead) => {
    const phoneKey = normalizePhone(lead.Telefono);
    const emailKey = normalizeEmail(lead.Correo);

    const match =
      (phoneKey ? hubspotMap.byPhone.get(phoneKey) : undefined) ??
      (emailKey ? hubspotMap.byEmail.get(emailKey) : undefined);

    if (match) matched += 1;

    return {
      ...lead,
      estadoLeadCrm: match?.estadoLead || 'Sin dato',
      etapaLeadCrm: match?.etapaLead || 'Sin dato',
      propietarioCrm: match?.propietario || 'Sin asignar',
      crmExtra: match?.extra || {},
    };
  });

  console.log(
    `[hubspot] Cruce Sheet <-> HubSpot: ${matched} de ${leads.length} leads del Sheet encontraron su contacto en HubSpot (de ${hubspotMap.byPhone.size} tel. / ${hubspotMap.byEmail.size} correos indexados).`,
  );

  return result;
}

// ---------------------------------------------------------------------------
// Agregaciones para alimentar las gráficas de Recharts
// ---------------------------------------------------------------------------

export function groupByDate(leads: ProcessedLead[]) {
  const counts = new Map<string, number>();

  leads.forEach((lead) => {
    if (!lead.parsedDate) return;
    const key = formatDateKey(lead.parsedDate);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  });

  return Array.from(counts.entries())
    .map(([date, total]) => ({
      date,
      label: new Date(`${date}T00:00:00`).toLocaleDateString('es-MX', {
        day: '2-digit',
        month: 'short',
      }),
      total,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function groupByBudget(leads: ProcessedLead[]) {
  const counts = new Map<string, number>();

  leads.forEach((lead) => {
    counts.set(lead.presupuestoClean, (counts.get(lead.presupuestoClean) ?? 0) + 1);
  });

  return Array.from(counts.entries())
    .map(([label, total]) => ({ label, total }))
    .sort((a, b) => extractLeadingNumber(a.label) - extractLeadingNumber(b.label));
}

export function groupByMotivo(leads: ProcessedLead[]) {
  const counts = { Vivir: 0, Invertir: 0, Otro: 0 };

  leads.forEach((lead) => {
    counts[lead.motivoCategoria] += 1;
  });

  return [
    { name: 'Vivir', value: counts.Vivir },
    { name: 'Invertir', value: counts.Invertir },
    { name: 'Otro', value: counts.Otro },
  ].filter((entry) => entry.value > 0);
}

// ---------------------------------------------------------------------------
// Filtros interactivos para el dashboard
// ---------------------------------------------------------------------------

export interface LeadFilters {
  /** 'all' o el valor exacto de la columna Campana */
  campaign: string;
  /** 'all' o 'YYYY-MM' */
  month: string;
  status: 'all' | LeadStatus;
  /** 'all' o el valor exacto de la columna Equipo */
  equipo: string;
  /** 'all' o el valor exacto de la columna Fuente (Instagram, Meta/Facebook, WhatsApp, etc.) */
  fuente: string;
  /** 'all' o el valor exacto de la columna Proveedor */
  proveedor: string;
  /** 'all' o el valor exacto de la columna Etapa */
  etapa: string;
}

export const DEFAULT_LEAD_FILTERS: LeadFilters = {
  campaign: 'all',
  month: 'all',
  status: 'all',
  equipo: 'all',
  fuente: 'all',
  proveedor: 'all',
  etapa: 'all',
};

/** Helper genérico: valores únicos no vacíos de un campo de texto del lead, ordenados alfabéticamente. */
function getUniqueValues(leads: ProcessedLead[], field: keyof ProcessedLead): string[] {
  const set = new Set<string>();
  leads.forEach((lead) => {
    const value = (lead[field] as string | undefined)?.trim();
    if (value) set.add(value);
  });
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

/** Lista de campañas únicas (no vacías), ordenadas alfabéticamente. */
export function getUniqueCampaigns(leads: ProcessedLead[]): string[] {
  return getUniqueValues(leads, 'Campana');
}

/** Lista de equipos únicos (no vacíos), ordenados alfabéticamente. */
export function getUniqueEquipos(leads: ProcessedLead[]): string[] {
  return getUniqueValues(leads, 'Equipo');
}

/** Lista de fuentes únicas (Instagram, Meta/Facebook, WhatsApp, etc.). */
export function getUniqueFuentes(leads: ProcessedLead[]): string[] {
  return getUniqueValues(leads, 'Fuente');
}

/** Lista de proveedores únicos. */
export function getUniqueProveedores(leads: ProcessedLead[]): string[] {
  return getUniqueValues(leads, 'Proveedor');
}

/** Lista de etapas únicas (estado del lead dentro del proceso de atención). */
export function getUniqueEtapas(leads: ProcessedLead[]): string[] {
  return getUniqueValues(leads, 'Etapa');
}

/** Meses únicos presentes en los datos, con label en español, más reciente primero. */
export function getUniqueMonths(leads: ProcessedLead[]): { value: string; label: string }[] {
  const map = new Map<string, string>();

  leads.forEach((lead) => {
    if (!lead.parsedDate) return;
    const value = lead.parsedDate.toISOString().slice(0, 7); // YYYY-MM
    if (!map.has(value)) {
      const label = lead.parsedDate.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' });
      map.set(value, label.charAt(0).toUpperCase() + label.slice(1));
    }
  });

  return Array.from(map.entries())
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => b.value.localeCompare(a.value));
}

/**
 * Búsqueda libre por texto: compara contra nombre, correo, teléfono,
 * campaña, comentarios y los campos resueltos de HubSpot (etapa, estado,
 * propietario). Coincidencia por substring, sin distinguir mayúsculas.
 */
export function searchLeads(leads: ProcessedLead[], query: string): ProcessedLead[] {
  const q = query.trim().toLowerCase();
  if (!q) return leads;

  return leads.filter((lead) => {
    const haystack = [
      lead.Nombre,
      lead.Correo,
      lead.Telefono,
      lead.Campana,
      lead.Comentarios,
      lead.Equipo,
      lead.Fuente,
      lead.Proveedor,
      lead.Etapa,
      lead.estadoLeadCrm,
      lead.etapaLeadCrm,
      lead.propietarioCrm,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    return haystack.includes(q);
  });
}

/** Aplica todos los filtros activos sobre el arreglo de leads procesados. */
export function filterLeads(leads: ProcessedLead[], filters: LeadFilters): ProcessedLead[] {
  return leads.filter((lead) => {
    if (filters.status !== 'all' && lead.status !== filters.status) return false;
    if (filters.campaign !== 'all' && lead.Campana?.trim() !== filters.campaign) return false;
    if (filters.equipo !== 'all' && lead.Equipo?.trim() !== filters.equipo) return false;
    if (filters.fuente !== 'all' && lead.Fuente?.trim() !== filters.fuente) return false;
    if (filters.proveedor !== 'all' && lead.Proveedor?.trim() !== filters.proveedor) return false;
    if (filters.etapa !== 'all' && lead.Etapa?.trim() !== filters.etapa) return false;

    if (filters.month !== 'all') {
      if (!lead.parsedDate) return false;
      if (lead.parsedDate.toISOString().slice(0, 7) !== filters.month) return false;
    }

    return true;
  });
}