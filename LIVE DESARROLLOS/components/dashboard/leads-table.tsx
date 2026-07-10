import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { formatLeadDate } from '@/lib/leadUtils';
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
            <TableHead className="text-zinc-500">Contacto</TableHead>
            <TableHead className="text-zinc-500">Campaña</TableHead>
            <TableHead className="text-zinc-500">Equipo</TableHead>
            <TableHead className="text-zinc-500">Fuente</TableHead>
            <TableHead className="text-zinc-500">Proveedor</TableHead>
            <TableHead className="text-zinc-500">Etapa</TableHead>
            <TableHead className="text-zinc-500">Presupuesto</TableHead>
            <TableHead className="text-zinc-500">Motivo</TableHead>
            <TableHead className="text-zinc-500">Comentarios</TableHead>
            <TableHead className="text-right text-zinc-500">Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {leads.map((lead) => (
            <TableRow key={lead.id} className="border-zinc-800 hover:bg-white/5">
              <TableCell className="whitespace-nowrap text-zinc-500">{formatLeadDate(lead.parsedDate)}</TableCell>
              <TableCell className="font-medium text-zinc-100">{lead.Nombre || 'Sin nombre'}</TableCell>
              <TableCell className="text-zinc-500">
                <div className="flex flex-col">
                  <span>{lead.Correo || '—'}</span>
                  <span className="text-xs">{lead.Telefono || '—'}</span>
                </div>
              </TableCell>
              <TableCell className="text-zinc-500">{lead.Campana || '—'}</TableCell>
              <TableCell className="text-zinc-500">{lead.Equipo || '—'}</TableCell>
              <TableCell className="text-zinc-500">{lead.Fuente || '—'}</TableCell>
              <TableCell className="text-zinc-500">{lead.Proveedor || '—'}</TableCell>
              <TableCell className="text-zinc-500">
                {lead.Etapa ? (
                  <Badge variant="outline" className="border-zinc-700 font-normal text-zinc-300">
                    {lead.Etapa}
                  </Badge>
                ) : (
                  '—'
                )}
              </TableCell>
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
          ))}
        </TableBody>
      </Table>
    </ScrollArea>
  );
}