import { getLeads } from '@/lib/googleSheets';
import { processLeads } from '@/lib/leadUtils';
import { DashboardShell } from '@/components/dashboard/dashboard-shell';

// Revalida la página cada 60s (coordinado con el caché de getLeads).
export const revalidate = 60;

export default async function DashboardPage() {
  // 1. Extracción segura de datos (Server Component -> nunca se envían
  //    credenciales de Google al cliente).
  const rawLeads = await getLeads();

  // 2. Limpieza + deduplicación (server-side). El resultado ya procesado
  //    se pasa al Client Component, que maneja los filtros interactivos.
  const leads = processLeads(rawLeads);

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
        <p className="text-xs text-zinc-500">Última actualización: {lastUpdated}</p>
      </header>

      <DashboardShell leads={leads} />
    </div>
  );
}