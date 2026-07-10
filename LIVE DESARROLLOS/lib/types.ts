export interface RawLead {
  Fecha: string;
  Campana: string;
  Nombre: string;
  Correo: string;
  Telefono: string;
  Presupuesto: string;
  Motivo: string;
  TiempoParaInvertir: string;
}

export type LeadStatus = 'Válido' | 'Duplicado';
export type MotivoCategoria = 'Vivir' | 'Invertir' | 'Otro';

export interface ProcessedLead extends RawLead {
  /** id estable para usar como `key` en React */
  id: string;
  status: LeadStatus;
  /** Fecha parseada a objeto Date (o null si no se pudo interpretar) */
  parsedDate: Date | null;
  /** Presupuesto limpio, ej. "$2 a 3 MDP" */
  presupuestoClean: string;
  /** Motivo limpio para mostrar en tabla, ej. "Vivir en Olivia" */
  motivoClean: string;
  /** TiempoParaInvertir limpio, ej. "En los próximos 3 a 6 meses" */
  tiempoClean: string;
  /** Categoría normalizada para la gráfica de dona */
  motivoCategoria: MotivoCategoria;
}