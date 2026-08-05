'use client';

import { useMemo, useState } from 'react';
import { Download, Search, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LeadsPerDayChart, MotivoDonutChart, BudgetBarChart } from './lead-charts';
import { LeadsTable } from './leads-table';
import {
  groupByDate,
  groupByBudget,
  groupByMotivo,
  getUniqueCampaigns,
  getUniqueMonths,
  getUniqueEquipos,
  getUniqueFuentes,
  getUniqueProveedores,
  getUniqueEtapas,
  filterLeads,
  searchLeads,
  DEFAULT_LEAD_FILTERS,
  type LeadFilters,
} from '@/lib/leadUtils';
import { exportLeadsToPdf } from '@/lib/exportPdf';
import type { ProcessedLead } from '@/lib/types';

function isToday(date: Date | null) {
  if (!date) return false;
  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

function buildFiltersSummary(filters: LeadFilters, months: { value: string; label: string }[]): string {
  const parts: string[] = [];

  parts.push(filters.campaign === 'all' ? 'Todas las campañas' : filters.campaign);

  if (filters.month === 'all') {
    parts.push('Todos los meses');
  } else {
    parts.push(months.find((m) => m.value === filters.month)?.label ?? filters.month);
  }

  if (filters.status === 'all') parts.push('Todos los status');
  else if (filters.status === 'Válido') parts.push('Solo válidos');
  else parts.push('Solo duplicados');

  if (filters.equipo !== 'all') parts.push(`Equipo: ${filters.equipo}`);
  if (filters.fuente !== 'all') parts.push(`Fuente: ${filters.fuente}`);
  if (filters.proveedor !== 'all') parts.push(`Proveedor: ${filters.proveedor}`);
  if (filters.etapa !== 'all') parts.push(`Etapa: ${filters.etapa}`);

  return parts.join(' · ');
}

const LOAD_MORE_STEP = 200;

export function DashboardShell({
  leads: initialLeads,
  initialHubspotLimit,
}: {
  leads: ProcessedLead[];
  initialHubspotLimit: number;
}) {
  const [leads, setLeads] = useState(initialLeads);
  const [hubspotLimit, setHubspotLimit] = useState(initialHubspotLimit);
  const [hasMoreLeads, setHasMoreLeads] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<LeadFilters>(DEFAULT_LEAD_FILTERS);
  const [isExporting, setIsExporting] = useState(false);

  // Las opciones de los selects salen del set COMPLETO de leads, no del filtrado,
  // para que no desaparezcan opciones al ir combinando filtros.
  const campaigns = useMemo(() => getUniqueCampaigns(leads), [leads]);
  const months = useMemo(() => getUniqueMonths(leads), [leads]);
  const equipos = useMemo(() => getUniqueEquipos(leads), [leads]);
  const fuentes = useMemo(() => getUniqueFuentes(leads), [leads]);
  const proveedores = useMemo(() => getUniqueProveedores(leads), [leads]);
  const etapas = useMemo(() => getUniqueEtapas(leads), [leads]);

  const filteredLeads = useMemo(
    () => searchLeads(filterLeads(leads, filters), search),
    [leads, filters, search]
  );

  const validLeads = useMemo(() => filteredLeads.filter((l) => l.status === 'Válido'), [filteredLeads]);
  const duplicateLeads = useMemo(() => filteredLeads.filter((l) => l.status === 'Duplicado'), [filteredLeads]);
  const todayLeads = useMemo(() => filteredLeads.filter((l) => isToday(l.parsedDate)), [filteredLeads]);
  const duplicateRate = filteredLeads.length > 0 ? (duplicateLeads.length / filteredLeads.length) * 100 : 0;

  const leadsPerDay = useMemo(() => groupByDate(filteredLeads), [filteredLeads]);
  const motivoData = useMemo(() => groupByMotivo(filteredLeads), [filteredLeads]);
  const budgetData = useMemo(() => groupByBudget(filteredLeads), [filteredLeads]);

  const sortedLeads = useMemo(
    () => [...filteredLeads].sort((a, b) => (b.parsedDate?.getTime() ?? 0) - (a.parsedDate?.getTime() ?? 0)),
    [filteredLeads]
  );

  const hasActiveFilters =
    filters.campaign !== 'all' ||
    filters.month !== 'all' ||
    filters.status !== 'all' ||
    filters.equipo !== 'all' ||
    filters.fuente !== 'all' ||
    filters.proveedor !== 'all' ||
    filters.etapa !== 'all' ||
    search.trim() !== '';

  function handleClearFilters() {
    setFilters(DEFAULT_LEAD_FILTERS);
    setSearch('');
  }

  async function handleLoadMore() {
    setIsLoadingMore(true);
    setLoadMoreError(null);
    try {
      const nextLimit = hubspotLimit + LOAD_MORE_STEP;
      const res = await fetch(`/api/leads?hubspotLimit=${nextLimit}`);
      if (!res.ok) throw new Error(`Error ${res.status}`);

      const data = (await res.json()) as {
        leads: (Omit<ProcessedLead, 'parsedDate'> & { parsedDate: string | null })[];
        hubspotLimit: number;
        hasMore: boolean;
      };
      // El JSON serializa Date como string ISO; hay que revivirlo a Date.
      setLeads(data.leads.map((lead) => ({ ...lead, parsedDate: lead.parsedDate ? new Date(lead.parsedDate) : null })));
      setHubspotLimit(data.hubspotLimit);
      setHasMoreLeads(data.hasMore);
    } catch {
      setLoadMoreError('No se pudieron cargar más leads. Intenta de nuevo.');
    } finally {
      setIsLoadingMore(false);
    }
  }

  async function handleExportPdf() {
    setIsExporting(true);
    try {
      await exportLeadsToPdf(sortedLeads, {
        filtersSummary: buildFiltersSummary(filters, months),
        generatedAt: new Date().toLocaleString('es-MX', { dateStyle: 'long', timeStyle: 'short' }),
      });
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden px-4 py-4 sm:px-6">
      {/* Filtros */}
      <section className="flex shrink-0 flex-wrap items-center gap-2">
        <div className="relative min-w-[160px] flex-1 sm:w-[220px] sm:flex-none">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar nombre, correo, teléfono…"
            className="h-9 border-zinc-800 bg-zinc-900 pl-8 pr-7 text-sm text-zinc-200 placeholder:text-zinc-500"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-200"
              aria-label="Limpiar búsqueda"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <Select value={filters.campaign} onValueChange={(value) => setFilters((f) => ({ ...f, campaign: value || 'all' }))}>
          <SelectTrigger className="h-9 min-w-[130px] flex-1 border-zinc-800 bg-zinc-900 text-sm text-zinc-200 sm:w-[180px] sm:flex-none">
            <SelectValue placeholder="Campaña">{(value: string) => (value === 'all' ? 'Campaña' : value)}</SelectValue>
          </SelectTrigger>
          <SelectContent className="border-zinc-800 bg-zinc-900 text-zinc-200">
            <SelectItem value="all">Todas las campañas</SelectItem>
            {campaigns.map((campaign) => (
              <SelectItem key={campaign} value={campaign}>
                {campaign}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filters.month} onValueChange={(value) => setFilters((f) => ({ ...f, month: value || 'all' }))}>
          <SelectTrigger className="h-9 min-w-[110px] flex-1 border-zinc-800 bg-zinc-900 text-sm text-zinc-200 sm:w-[160px] sm:flex-none">
            <SelectValue placeholder="Mes">
              {(value: string) => (value === 'all' ? 'Mes' : months.find((m) => m.value === value)?.label ?? value)}
            </SelectValue>
          </SelectTrigger>
          <SelectContent className="border-zinc-800 bg-zinc-900 text-zinc-200">
            <SelectItem value="all">Todos los meses</SelectItem>
            {months.map((month) => (
              <SelectItem key={month.value} value={month.value}>
                {month.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* --- Filtros nuevos: Equipo / Fuente / Proveedor / Etapa --- */}
        <Select value={filters.equipo} onValueChange={(value) => setFilters((f) => ({ ...f, equipo: value || 'all' }))}>
          <SelectTrigger className="h-9 min-w-[120px] flex-1 border-zinc-800 bg-zinc-900 text-sm text-zinc-200 sm:w-[150px] sm:flex-none">
            <SelectValue placeholder="Equipo">{(value: string) => (value === 'all' ? 'Equipo' : value)}</SelectValue>
          </SelectTrigger>
          <SelectContent className="border-zinc-800 bg-zinc-900 text-zinc-200">
            <SelectItem value="all">Todos los equipos</SelectItem>
            {equipos.map((equipo) => (
              <SelectItem key={equipo} value={equipo}>
                {equipo}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filters.fuente} onValueChange={(value) => setFilters((f) => ({ ...f, fuente: value || 'all' }))}>
          <SelectTrigger className="h-9 min-w-[120px] flex-1 border-zinc-800 bg-zinc-900 text-sm text-zinc-200 sm:w-[150px] sm:flex-none">
            <SelectValue placeholder="Fuente">{(value: string) => (value === 'all' ? 'Fuente' : value)}</SelectValue>
          </SelectTrigger>
          <SelectContent className="border-zinc-800 bg-zinc-900 text-zinc-200">
            <SelectItem value="all">Todas las fuentes</SelectItem>
            {fuentes.map((fuente) => (
              <SelectItem key={fuente} value={fuente}>
                {fuente}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filters.proveedor} onValueChange={(value) => setFilters((f) => ({ ...f, proveedor: value || 'all' }))}>
          <SelectTrigger className="h-9 min-w-[120px] flex-1 border-zinc-800 bg-zinc-900 text-sm text-zinc-200 sm:w-[150px] sm:flex-none">
            <SelectValue placeholder="Proveedor">{(value: string) => (value === 'all' ? 'Proveedor' : value)}</SelectValue>
          </SelectTrigger>
          <SelectContent className="border-zinc-800 bg-zinc-900 text-zinc-200">
            <SelectItem value="all">Todos los proveedores</SelectItem>
            {proveedores.map((proveedor) => (
              <SelectItem key={proveedor} value={proveedor}>
                {proveedor}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filters.etapa} onValueChange={(value) => setFilters((f) => ({ ...f, etapa: value || 'all' }))}>
          <SelectTrigger className="h-9 min-w-[120px] flex-1 border-zinc-800 bg-zinc-900 text-sm text-zinc-200 sm:w-[150px] sm:flex-none">
            <SelectValue placeholder="Etapa">{(value: string) => (value === 'all' ? 'Etapa' : value)}</SelectValue>
          </SelectTrigger>
          <SelectContent className="border-zinc-800 bg-zinc-900 text-zinc-200">
            <SelectItem value="all">Todas las etapas</SelectItem>
            {etapas.map((etapa) => (
              <SelectItem key={etapa} value={etapa}>
                {etapa}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Tabs
          value={filters.status}
          onValueChange={(value) => setFilters((f) => ({ ...f, status: value as LeadFilters['status'] }))}
        >
          <TabsList className="h-9 border border-zinc-800 bg-zinc-900">
            <TabsTrigger
              value="all"
              className="text-xs text-zinc-400 data-[state=active]:bg-zinc-800 data-[state=active]:text-zinc-50"
            >
              Todos
            </TabsTrigger>
            <TabsTrigger
              value="Válido"
              className="text-xs text-zinc-400 data-[state=active]:bg-zinc-800 data-[state=active]:text-zinc-50"
            >
              Válidos
            </TabsTrigger>
            <TabsTrigger
              value="Duplicado"
              className="text-xs text-zinc-400 data-[state=active]:bg-zinc-800 data-[state=active]:text-zinc-50"
            >
              Duplicados
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            className="h-9 text-xs text-zinc-500 hover:bg-white/5 hover:text-zinc-200"
            onClick={handleClearFilters}
          >
            Limpiar filtros
          </Button>
        )}

        <span className="ml-auto text-xs text-zinc-500">
          {filteredLeads.length} de {leads.length} leads
        </span>
      </section>

      {/* Contenido principal: la tabla ES el foco. Gráficas solo aparecen desde lg. */}
      <section className="grid min-h-0 flex-1 grid-cols-12 gap-3">
        <Card className="col-span-12 flex min-h-0 flex-col border-zinc-800 bg-zinc-900 shadow-none lg:col-span-8">
          <CardHeader className="flex shrink-0 flex-row items-center justify-between gap-2 p-4 pb-2">
            <div className="flex items-center gap-2">
              <CardTitle className="text-base font-medium text-zinc-50">Leads</CardTitle>
              {loadMoreError && <span className="text-xs text-red-400">{loadMoreError}</span>}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={isLoadingMore || !hasMoreLeads}
                onClick={handleLoadMore}
                className="h-8 gap-1.5 border-zinc-800 bg-zinc-900 text-xs text-zinc-200 hover:bg-zinc-800"
              >
                {isLoadingMore ? 'Cargando…' : !hasMoreLeads ? 'No hay más leads' : `Cargar ${LOAD_MORE_STEP} más`}
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={isExporting || sortedLeads.length === 0}
                onClick={handleExportPdf}
                className="h-8 gap-1.5 border-zinc-800 bg-zinc-900 text-xs text-zinc-200 hover:bg-zinc-800"
              >
                <Download className="h-3.5 w-3.5" />
                {isExporting ? 'Generando…' : 'Exportar PDF'}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="min-h-0 flex-1 p-0">
            <LeadsTable leads={sortedLeads} />
          </CardContent>
        </Card>

        <aside className="hidden min-h-0 grid-rows-3 gap-3 lg:col-span-4 lg:grid">
          <Card className="flex min-h-0 flex-col border-zinc-800 bg-zinc-900 shadow-none">
            <CardHeader className="shrink-0 p-3 pb-0">
              <CardTitle className="text-xs font-medium text-zinc-400">Leads por Día</CardTitle>
            </CardHeader>
            <CardContent className="min-h-0 flex-1 p-2 pt-1">
              <LeadsPerDayChart data={leadsPerDay} />
            </CardContent>
          </Card>

          <Card className="flex min-h-0 flex-col border-zinc-800 bg-zinc-900 shadow-none">
            <CardHeader className="shrink-0 p-3 pb-0">
              <CardTitle className="text-xs font-medium text-zinc-400">Vivir vs Invertir</CardTitle>
            </CardHeader>
            <CardContent className="min-h-0 flex-1 p-2 pt-1">
              <MotivoDonutChart data={motivoData} />
            </CardContent>
          </Card>

          <Card className="flex min-h-0 flex-col border-zinc-800 bg-zinc-900 shadow-none">
            <CardHeader className="shrink-0 p-3 pb-0">
              <CardTitle className="text-xs font-medium text-zinc-400">Presupuesto</CardTitle>
            </CardHeader>
            <CardContent className="min-h-0 flex-1 p-2 pt-1">
              <BudgetBarChart data={budgetData} />
            </CardContent>
          </Card>
        </aside>
      </section>

      {/* Stats — franja compacta debajo de la tabla, reacciona a los filtros */}
      <section className="grid shrink-0 grid-cols-2 gap-2 sm:grid-cols-4">
        <Card className="flex items-center justify-between border-zinc-800 bg-zinc-900 px-3 py-2.5 shadow-none">
          <span className="text-xs font-medium text-zinc-400">Total</span>
          <span className="text-lg font-semibold text-zinc-50">{filteredLeads.length}</span>
        </Card>

        <Card className="flex items-center justify-between border-zinc-800 bg-zinc-900 px-3 py-2.5 shadow-none">
          <span className="text-xs font-medium text-zinc-400">Válidos</span>
          <span className="text-lg font-semibold text-zinc-50">{validLeads.length}</span>
        </Card>

        <Card className="flex items-center justify-between border-zinc-800 bg-zinc-900 px-3 py-2.5 shadow-none">
          <span className="text-xs font-medium text-zinc-400">Duplicados</span>
          <span className="text-lg font-semibold text-zinc-50">
            {duplicateLeads.length}
            <span className="ml-1 text-xs font-normal text-zinc-500">({duplicateRate.toFixed(1)}%)</span>
          </span>
        </Card>

        <Card className="flex items-center justify-between border-zinc-800 bg-zinc-900 px-3 py-2.5 shadow-none">
          <span className="text-xs font-medium text-zinc-400">Hoy</span>
          <span className="text-lg font-semibold text-zinc-50">{todayLeads.length}</span>
        </Card>
      </section>
    </div>
  );
}