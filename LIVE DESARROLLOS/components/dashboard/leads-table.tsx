import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/LIVE DESARROLLOS/components/ui/table';
import { Badge } from '@/LIVE DESARROLLOS/components/ui/badge';
import { ScrollArea } from '@/LIVE DESARROLLOS/components/ui/scroll-area';
import { formatLeadDate } from '@/LIVE DESARROLLOS/lib/leadUtils';
import type { ProcessedLead } from '@/LIVE DESARROLLOS/lib/types';

/**
 * Colorea cualquier texto de estado/etapa como píldora, según palabras
 * clave. No asume un set cerrado de valores (el equipo puede cambiar las
 * opciones en HubSpot en cualquier momento) — por eso funciona por
 * coincidencia de palabras en vez de una lista fija de valores exactos.
 *
 * Rojo    -> perdido, rechazado, no califica, descartado
 * Verde   -> atendido, terminado, cerrado (ganado), conectado, calificado
 * Naranja -> en espera, en proceso, intento, seguimiento
 * Amarillo-> nuevo, sin contactar, primer contacto
 * Gris    -> cualquier otro valor (fallback neutro)
 */
function statusPillClassName(value?: string): string {
  const v = (value || '').toLowerCase();

  if (v.includes('perdid') || v.includes('rechaz') || v.includes('no califica') || v.includes('descartad')) {
    return 'border-red-500/30 bg-red-500/10 text-red-400';
  }
  if (
    v.includes('atendid') ||
    v.includes('terminad') ||
    v.includes('cerrad') ||
    v.includes('conectad') ||
    v.includes('calific') ||
    v.includes('ganad')
  ) {
    return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400';
  }
  if (v.includes('espera') || v.includes('proceso') || v.includes('intento') || v.includes('seguimiento')) {
    return 'border-orange-500/30 bg-orange-500/10 text-orange-400';
  }
  if (v.includes('nuevo') || v.includes('sin contact') || v.includes('primer contacto')) {
    return 'border-yellow-500/30 bg-yellow-500/10 text-yellow-400';
  }

  return 'border-zinc-700 bg-transparent text-zinc-400';
}

/**
 * Colorea la píldora de "Fuente" según el canal de origen. Usa
 * coincidencia por texto (no exacta) para tolerar mayúsculas/minúsculas.
 */
function fuentePillClassName(fuente?: string): string {
  const v = (fuente || '').toLowerCase();

  if (v === 'fb' || v.includes('facebook')) {
    return 'border-blue-500/30 bg-blue-500/10 text-blue-400';
  }
  if (v === 'an') {
    return 'border-lime-400/30 bg-lime-400/10 text-lime-300';
  }
  if (v === 'ig' || v.includes('instagram')) {
    return 'border-pink-500/30 bg-pink-500/10 text-pink-400';
  }
  if (v.includes('whatsapp') || v === 'wp') {
    return 'border-green-500/30 bg-green-500/10 text-green-400';
  }
  if (v === 'hubspot') {
    return 'border-orange-500/30 bg-orange-500/10 text-orange-400';
  }

  return 'border-zinc-700 bg-transparent text-zinc-400';
}

function isToday(date: Date | null) {
  if (!date) return false;
  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

export function LeadsTable({ leads }: { leads: ProcessedLead[] }) {
  if (leads.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-zinc-500">No hay leads que coincidan con los filtros.</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <Table>
        <TableHeader>
          <TableRow className="border-zinc-800 hover:bg-transparent">
            <TableHead className="text-zinc-500">Fecha</TableHead>
            <TableHead className="text-zinc-500">Nombre</TableHead>
            <TableHead className="text-zinc-500">Etapa</TableHead>
            <TableHead className="text-zinc-500">Estado del lead</TableHead>
            <TableHead className="text-zinc-500">Persona encargada</TableHead>
            <TableHead className="text-zinc-500">Fuente</TableHead>
            <TableHead className="text-zinc-500">Contacto</TableHead>
            <TableHead className="text-zinc-500">Campaña</TableHead>
            <TableHead className="text-zinc-500">Equipo encargado</TableHead>
            <TableHead className="text-zinc-500">Proveedor</TableHead>
            <TableHead className="text-zinc-500">Presupuesto</TableHead>
            <TableHead className="text-zinc-500">Motivo</TableHead>
            <TableHead className="text-zinc-500">Comentarios</TableHead>
            <TableHead className="text-right text-zinc-500">Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {leads.map((lead) => {
            // "Etapa" ahora muestra la etapa de HubSpot (etapaLeadCrm) si
            // existe; si no hay match en HubSpot, usa la Etapa cruda del
            // Sheet como respaldo.
            const etapaDisplay =
              lead.etapaLeadCrm && lead.etapaLeadCrm !== 'Sin dato' ? lead.etapaLeadCrm : lead.Etapa;

            return (
              <TableRow key={lead.id} className="border-zinc-800 hover:bg-white/5">
                <TableCell className="whitespace-nowrap text-zinc-500">{formatLeadDate(lead.parsedDate)}</TableCell>
                <TableCell className="max-w-[160px] truncate font-medium text-zinc-100" title={lead.Nombre || undefined}>
                  {lead.Nombre || 'Sin nombre'}
                </TableCell>
                <TableCell className="text-zinc-500">
                  {etapaDisplay ? (
                    <Badge variant="outline" className={statusPillClassName(etapaDisplay)}>
                      {etapaDisplay}
                    </Badge>
                  ) : (
                    '—'
                  )}
                </TableCell>
                <TableCell className="text-zinc-500">
                  {lead.estadoLeadCrm && lead.estadoLeadCrm !== 'Sin dato' ? (
                    <Badge variant="outline" className={statusPillClassName(lead.estadoLeadCrm)}>
                      {lead.estadoLeadCrm}
                    </Badge>
                  ) : (
                    '—'
                  )}
                </TableCell>
                <TableCell className="text-zinc-500">
                  {lead.propietarioCrm && lead.propietarioCrm !== 'Sin asignar' ? lead.propietarioCrm : '—'}
                </TableCell>
                <TableCell className="text-zinc-500">
                  {lead.Fuente ? (
                    <Badge variant="outline" className={fuentePillClassName(lead.Fuente)}>
                      {lead.Fuente}
                    </Badge>
                  ) : (
                    '—'
                  )}
                </TableCell>
                <TableCell className="text-zinc-500">
                  <div className="flex flex-col">
                    <span>{lead.Correo || '—'}</span>
                    <span className="text-xs">{lead.Telefono || '—'}</span>
                  </div>
                </TableCell>
                <TableCell className="text-zinc-500">{lead.Campana || '—'}</TableCell>
                <TableCell className="text-zinc-500">{lead.Equipo || '—'}</TableCell>
                <TableCell className="text-zinc-500">{lead.Proveedor || '—'}</TableCell>
                <TableCell className="text-zinc-500">{lead.presupuestoClean}</TableCell>
                <TableCell className="text-zinc-500">{lead.motivoClean}</TableCell>
                <TableCell className="max-w-[200px] truncate text-zinc-500" title={lead.Comentarios || undefined}>
                  {lead.Comentarios || '—'}
                </TableCell>
                <TableCell className="text-right">
                  {lead.status === 'Duplicado' ? (
                    <Badge variant="outline" className="border-amber-500/30 text-amber-400">
                      Duplicado
                    </Badge>
                  ) : isToday(lead.parsedDate) ? (
                    <Badge className="border-transparent bg-[#EFF767] text-zinc-950 hover:bg-[#EFF767]">
                      Nuevo
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="border-zinc-700 font-normal text-zinc-500">
                      Válido
                    </Badge>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </ScrollArea>
  );
}