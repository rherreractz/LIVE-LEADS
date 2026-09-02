import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { formatLeadDate, classifyGhlStageNumber } from '@/lib/leadUtils';
import type { ProcessedLead } from '@/lib/types';
import type { AppSettings } from '@/lib/settingsStorage';

const FUENTE_FULL_NAME: Record<string, string> = {
  fb: 'Facebook',
  ig: 'Instagram',
  an: 'Audience Network',
};

function fuenteDisplayName(fuente: string): string {
  return FUENTE_FULL_NAME[fuente.toLowerCase()] ?? fuente;
}

function ghlPillClassName(estadoGHL?: string): string {
  const color = estadoGHL ? classifyGhlStageNumber(estadoGHL) : null;
  if (color === 'Verde') return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400';
  if (color === 'Amarillo') return 'border-yellow-500/30 bg-yellow-500/10 text-yellow-700 dark:text-yellow-400';
  if (color === 'Rojo') return 'border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400';
  return 'border-border bg-transparent text-muted-foreground';
}

function statusPillClassName(value?: string): string {
  const v = (value || '').toLowerCase();

  if (
    v.includes('perdid') || v.includes('rechaz') || v.includes('no califica') || v.includes('descartad') ||
    v.includes('inválido') || v.includes('invalido') || v.includes('no responde') || v.includes('no da cita') ||
    v.includes('no acude') || v.includes('no hay negocio') || v.includes('cancela') || v.includes('no reserva') || 
    v.includes('no firma')
  ) {
    return 'border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400';
  }
  
  if (
    v.includes('nuevo') || v.includes('sin contact') || v.includes('primer contacto') || 
    v.includes('sin respuesta') || v.includes('registro')
  ) {
    return 'border-yellow-500/30 bg-yellow-500/10 text-yellow-700 dark:text-yellow-400';
  }

  if (
    v.includes('atendid') || v.includes('terminad') || v.includes('cerrad') || v.includes('conectad') || 
    v.includes('calific') || v.includes('ganad') || v.includes('contacto') || v.includes('cita') || 
    v.includes('visita') || v.includes('informes') || v.includes('negocio')
  ) {
    return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400';
  }

  if (v.includes('espera') || v.includes('proceso') || v.includes('intento') || v.includes('seguimiento')) {
    return 'border-orange-500/30 bg-orange-500/10 text-orange-700 dark:text-orange-400';
  }

  return 'border-border bg-transparent text-muted-foreground';
}

function fuentePillClassName(fuente?: string): string {
  const v = (fuente || '').toLowerCase();

  if (v === 'fb' || v.includes('facebook')) {
    return 'border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-400';
  }
  if (v === 'an') {
    return 'border-lime-400/30 bg-lime-400/10 text-lime-700 dark:text-lime-300';
  }
  if (v === 'ig' || v.includes('instagram')) {
    return 'border-pink-500/30 bg-pink-500/10 text-pink-700 dark:text-pink-400';
  }
  if (v.includes('whatsapp') || v === 'wp') {
    return 'border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-400';
  }
  if (v === 'hubspot') {
    return 'border-orange-500/30 bg-orange-500/10 text-orange-700 dark:text-orange-400';
  }

  return 'border-border bg-transparent text-muted-foreground';
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

export function LeadsTable({ leads, settings }: { leads: ProcessedLead[], settings?: AppSettings }) {
  if (leads.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-muted-foreground">No hay leads que coincidan con los filtros.</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <Table>
        <TableHeader className="sticky top-0 z-10 bg-card">
          <TableRow className="border-border hover:bg-transparent">
            <TableHead className="text-muted-foreground">FECHA</TableHead>
            <TableHead className="text-muted-foreground">NOMBRE</TableHead>
            <TableHead className="text-muted-foreground">ESTADO</TableHead>
            
            {/* INICIO COLUMNAS CONDICIONALES */}
            {settings?.enableTresor !== false && (
              <TableHead className="text-muted-foreground">ESTADO TRESOR</TableHead>
            )}
            {settings?.enableGhl !== false && (
              <TableHead className="text-muted-foreground">ESTADO GHL</TableHead>
            )}
            {/* FIN COLUMNAS CONDICIONALES */}
            
            <TableHead className="text-muted-foreground">PERSONA ENCARGADA</TableHead>
            <TableHead className="text-muted-foreground">FUENTE</TableHead>
            <TableHead className="text-muted-foreground">CONTACTO</TableHead>
            <TableHead className="text-muted-foreground">CAMPAÑA</TableHead>
            <TableHead className="text-muted-foreground">EQUIPO ENCARGADO</TableHead>
            <TableHead className="text-muted-foreground">PROVEEDOR</TableHead>
            <TableHead className="text-muted-foreground">PRESUPUESTO</TableHead>
            <TableHead className="text-muted-foreground">MOTIVO</TableHead>
            <TableHead className="text-muted-foreground">COMENTARIOS</TableHead>
            <TableHead className="text-right text-muted-foreground">STATUS</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {leads.map((lead) => {
            const etapaDisplay = lead.etapaLeadCrm && lead.etapaLeadCrm !== 'Sin dato' ? lead.etapaLeadCrm : lead.Etapa;

            return (
              <TableRow key={lead.id} className="border-border hover:bg-muted">
                <TableCell className="whitespace-nowrap text-muted-foreground">{formatLeadDate(lead.parsedDate)}</TableCell>
                <TableCell className="max-w-[160px] truncate font-medium text-foreground" title={lead.Nombre || undefined}>
                  {lead.Nombre || 'Sin nombre'}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {etapaDisplay ? (
                    <Badge variant="outline" className={statusPillClassName(etapaDisplay)}>
                      {etapaDisplay}
                    </Badge>
                  ) : (
                    '—'
                  )}
                </TableCell>
                
                {/* INICIO CELDAS CONDICIONALES */}
                {settings?.enableTresor !== false && (
                  <TableCell className="text-muted-foreground">
                    {lead.estadoTresor && lead.estadoTresor !== 'Sin dato' ? (
                      <Badge variant="outline" className={statusPillClassName(lead.estadoTresor)}>
                        {lead.estadoTresor}
                      </Badge>
                    ) : (
                      '—'
                    )}
                  </TableCell>
                )}
                {settings?.enableGhl !== false && (
                  <TableCell className="text-muted-foreground">
                    {lead.estadoGHL && lead.estadoGHL !== 'Sin dato' ? (
                      <Badge variant="outline" className={ghlPillClassName(lead.estadoGHL)}>
                        {lead.estadoGHL}
                      </Badge>
                    ) : (
                      '—'
                    )}
                  </TableCell>
                )}
                {/* FIN CELDAS CONDICIONALES */}
                
                <TableCell className="text-muted-foreground">
                  {(() => {
                    if (lead.propietarioCrm && lead.propietarioCrm !== 'Sin asignar') return lead.propietarioCrm;
                    if (lead.personaEncargadaGHL && lead.personaEncargadaGHL !== 'Sin asignar') return lead.personaEncargadaGHL;
                    return '—';
                  })()}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {lead.Fuente ? (
                    <Badge variant="outline" className={fuentePillClassName(lead.Fuente)}>
                      {fuenteDisplayName(lead.Fuente)}
                    </Badge>
                  ) : (
                    '—'
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  <div className="flex flex-col">
                    <span>{lead.Correo || '—'}</span>
                    <span className="text-xs">{lead.Telefono || '—'}</span>
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">{lead.Campana || '—'}</TableCell>
                <TableCell className="text-muted-foreground">{lead.Equipo || '—'}</TableCell>
                <TableCell className="text-muted-foreground">{lead.Proveedor || '—'}</TableCell>
                <TableCell className="text-muted-foreground">{lead.presupuestoClean}</TableCell>
                <TableCell className="text-muted-foreground">{lead.motivoClean}</TableCell>
                <TableCell className="max-w-[200px] truncate text-muted-foreground" title={lead.Comentarios || undefined}>
                  {lead.Comentarios || '—'}
                </TableCell>
                <TableCell className="text-right">
                  {lead.status === 'Duplicado' ? (
                    <Badge variant="outline" className="border-amber-500/30 text-amber-700 dark:text-amber-400">
                      Duplicado
                    </Badge>
                  ) : isToday(lead.parsedDate) ? (
                    <Badge className="border-transparent bg-[#53958B] text-zinc-950 hover:bg-[#53958B]">
                      Nuevo
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="border-border font-normal text-muted-foreground">
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