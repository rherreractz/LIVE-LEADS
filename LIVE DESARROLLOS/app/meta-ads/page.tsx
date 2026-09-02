import { loadDashboardData } from '@/lib/dashboardData';
import { DashboardTabs } from '@/components/dashboard/dashboard-tabs';
import { Logo } from '@/components/dashboard/logo';
import type { CSSProperties } from 'react';

// Misma página que app/page.tsx (es donde /login redirige por defecto) —
// ambas comparten la lógica de carga vía lib/dashboardData.ts.
export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const { leads, hubspotLimit, leadQualityHistoryChart, settings } = await loadDashboardData('meta-ads/page');

  const lastUpdated = new Date().toLocaleString('es-MX', {
    dateStyle: 'long',
    timeStyle: 'short',
  });

  const effectiveMetaPageId = settings.metaPageId || process.env.NEXT_PUBLIC_META_PAGE_ID || '';
  const displayName = settings.displayName || 'Live Desarrollos';

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground" style={settings.primaryColor ? ({ '--brand-color': settings.primaryColor } as CSSProperties) : undefined}>
      <header className="flex shrink-0 flex-col justify-between gap-1 border-b border-border px-6 py-4 sm:flex-row sm:items-end">
        <div className="flex items-center gap-3">
          <Logo src={settings.logoDataUri} alt={displayName} background={settings.logoBackground} className="h-9 shrink-0" />
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground" style={settings.primaryColor ? { color: settings.primaryColor } : undefined}>
              {displayName}
            </p>
            <h1 className="text-xl font-semibold tracking-tight text-foreground">Panel de Reportes</h1>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <p className="text-xs text-muted-foreground">Última actualización: {lastUpdated}</p>
        </div>
      </header>

      <DashboardTabs
        leads={leads}
        initialHubspotLimit={hubspotLimit}
        leadQualityHistory={leadQualityHistoryChart}
        settings={settings}
        effectiveMetaPageId={effectiveMetaPageId}
      />
    </div>
  );
}
