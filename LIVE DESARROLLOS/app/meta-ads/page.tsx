import { getLeads } from '@/lib/googleSheets';
import { getHubspotStatusMap } from '@/lib/hubspot';
import { processLeads, mergeHubspotStatus } from '@/lib/leadUtils';
import { DashboardTabs } from '@/components/dashboard/dashboard-tabs';

// Revalida la página cada 60s (coordinado con el caché de getLeads() y
// getHubspotStatusMap()).
export const revalidate = 60;

export default async function DashboardPage() {
  // 1. Extracción segura de datos (Server Component -> nunca se envían
  //    credenciales de Google/HubSpot al cliente). Ambas fuentes en paralelo.
  const [rawLeads, hubspotMap] = await Promise.all([getLeads(), getHubspotStatusMap()]);

  // 2. Limpieza + deduplicación (server-side) solo sobre los leads del
  //    Sheet (los contactos que existen SOLO en HubSpot ya no se agregan
  //    como leads nuevos), luego cruce con el estado del CRM. El resultado
  //    ya procesado se pasa al Client Component, que maneja los filtros
  //    interactivos.
  const leads = mergeHubspotStatus(processLeads(rawLeads), hubspotMap);

  const lastUpdated = new Date().toLocaleString('es-MX', {
    dateStyle: 'long',
    timeStyle: 'short',
  });

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-zinc-950 text-zinc-100">
      <header className="flex shrink-0 flex-col justify-between gap-1 border-b border-zinc-800 px-6 py-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">Live Desarrollos</p>
          <h1 className="text-xl font-semibold tracking-tight text-zinc-50">Panel de Reportes</h1>
        </div>
        <div className="flex items-center gap-4">
          <p className="text-xs text-zinc-500">Última actualización: {lastUpdated}</p>
        </div>
      </header>

      <DashboardTabs leads={leads} initialHubspotLimit={hubspotMap.limit} />
    </div>
  );
}