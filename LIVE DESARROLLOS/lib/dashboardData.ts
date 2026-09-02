import { getLeads } from './googleSheets';
import { getHubspotStatusMap } from './hubspot';
import { getGhlStatusMap } from './ghl';
import {
  processLeads,
  mergeHubspotStatus,
  mergeGhlStatus,
  summarizeLeadQualityByFuente,
  summarizeLeadQualityByCampana,
  buildLeadQualityHistoryChartData,
  type LeadQualityHistoryChartPoint,
} from './leadUtils';
import { saveLeadQualitySummary, getLeadQualityHistory } from './leadQualityStorage';
import { getSettings, type AppSettings } from './settingsStorage';
import type { ProcessedLead } from './types';

export interface DashboardData {
  leads: ProcessedLead[];
  /** Límite de contactos que devolvió HubSpot (lo usa el botón "cargar más" de la tabla). */
  hubspotLimit: number;
  leadQualityHistoryChart: { data: LeadQualityHistoryChartPoint[]; fuentes: string[] };
  settings: AppSettings;
}

/**
 * Carga TODO lo que necesitan app/page.tsx y app/meta-ads/page.tsx (antes
 * esta lógica estaba duplicada letra por letra en los dos archivos).
 *
 * Live usa un Google Sheet como fuente PRIMARIA de leads; HubSpot y GHL solo
 * ENRIQUECEN el estado de esos leads (HubSpot por teléfono/correo, GHL solo
 * por correo). Ese pipeline NO cambió — lo único nuevo es que además se lee
 * la configuración editable del panel (`getSettings()`), que vive en la
 * pestaña "Settings" del mismo Sheet de storage.
 *
 * @param logPrefix Prefijo para los console.error (ej. 'page' o 'meta-ads/page').
 */
export async function loadDashboardData(logPrefix: string): Promise<DashboardData> {
  const settings = await getSettings();

  // Las 3 fuentes en paralelo. GHL puede tardar (cuenta grande, paginado) —
  // si falla o tarda demasiado, no tumba el dashboard: solo la columna
  // "Estado GHL" queda sin dato por esta vez.
  const [rawLeads, hubspotMap, ghlMap] = await Promise.all([
    getLeads(),
    getHubspotStatusMap(),
    getGhlStatusMap().catch((err) => {
      console.error(`[${logPrefix}] Error al leer GoHighLevel, se omite por esta vez:`, err);
      return { byEmail: new Map() } as Awaited<ReturnType<typeof getGhlStatusMap>>;
    }),
  ]);

  // Limpieza + dedupe SOLO sobre los leads reales del Sheet, luego cruce con
  // el estado del CRM (HubSpot primero, GHL después — GHL cruza solo por correo).
  const leadsWithHubspot = mergeHubspotStatus(processLeads(rawLeads), hubspotMap);
  const leads = mergeGhlStatus(leadsWithHubspot, ghlMap);

  // Snapshot de calidad de leads (por Fuente y por Campaña, según el
  // semáforo) — se guarda para que la generación de campañas lo use como
  // contexto real. Se espera (await): en serverless una promesa sin esperar
  // puede cortarse cuando ya se mandó la respuesta.
  try {
    await saveLeadQualitySummary({
      generatedAt: new Date().toISOString(),
      byFuente: summarizeLeadQualityByFuente(leads),
      byCampana: summarizeLeadQualityByCampana(leads),
    });
  } catch (err) {
    console.error(`[${logPrefix}] Error al guardar calidad de leads:`, err);
  }

  // Historial completo (un punto por día) para la gráfica de línea del
  // tiempo — ya incluye el snapshot de hoy. Si falla, la gráfica se muestra
  // vacía, no tumba el resto del dashboard.
  let leadQualityHistoryChart: { data: LeadQualityHistoryChartPoint[]; fuentes: string[] } = { data: [], fuentes: [] };
  try {
    const history = await getLeadQualityHistory();
    leadQualityHistoryChart = buildLeadQualityHistoryChartData(history);
  } catch (err) {
    console.error(`[${logPrefix}] Error al leer historial de calidad de leads:`, err);
  }

  return { leads, hubspotLimit: hubspotMap.limit, leadQualityHistoryChart, settings };
}
