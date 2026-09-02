import { getLeads } from './googleSheets';
import { getHubspotStatusMap } from './hubspot';
import { getGhlStatusMap } from './ghl';
import { getTresorStatusMap } from './tresorContacts';
import {
  processLeads,
  mergeHubspotStatus,
  mergeGhlStatus,
  mergeTresorStatus,
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

export async function loadDashboardData(logPrefix: string): Promise<DashboardData> {
  const settings = await getSettings();

  // Las fuentes de enriquecimiento en paralelo. 
  // Usamos .catch en GHL y Tresor para no tumbar el dashboard si fallan.
  const [rawLeads, hubspotMap, ghlMap, tresorMap] = await Promise.all([
    getLeads(),
    getHubspotStatusMap(),
    getGhlStatusMap().catch((err) => {
      console.error(`[${logPrefix}] Error al leer GoHighLevel, se omite por esta vez:`, err);
      return { byEmail: new Map() } as Awaited<ReturnType<typeof getGhlStatusMap>>;
    }),
    getTresorStatusMap().catch((err) => {
      console.error(`[${logPrefix}] Error al leer Tresor, se omite por esta vez:`, err);
      return new Map<string, any>();
    }),
  ]);

  // Cruce en cadena respetando los interruptores de Ajustes (settings)
  let leads = processLeads(rawLeads);
  leads = mergeHubspotStatus(leads, hubspotMap, settings);
  leads = mergeGhlStatus(leads, ghlMap, settings);
  leads = mergeTresorStatus(leads, tresorMap, settings);

  try {
    await saveLeadQualitySummary({
      generatedAt: new Date().toISOString(),
      byFuente: summarizeLeadQualityByFuente(leads),
      byCampana: summarizeLeadQualityByCampana(leads),
    });
  } catch (err) {
    console.error(`[${logPrefix}] Error al guardar calidad de leads:`, err);
  }

  let leadQualityHistoryChart: { data: LeadQualityHistoryChartPoint[]; fuentes: string[] } = { data: [], fuentes: [] };
  try {
    const history = await getLeadQualityHistory();
    leadQualityHistoryChart = buildLeadQualityHistoryChartData(history);
  } catch (err) {
    console.error(`[${logPrefix}] Error al leer historial de calidad de leads:`, err);
  }

  return { leads, hubspotLimit: hubspotMap.limit, leadQualityHistoryChart, settings };
}