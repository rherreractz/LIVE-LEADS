import type { ProcessedLead } from './types';
import { formatLeadDate } from './leadUtils';

interface ExportOptions {
  filtersSummary: string;
  generatedAt: string;
}

/**
 * Genera y descarga un PDF con el reporte de leads (respeta el orden y
 * filtro ya aplicado — recibe el arreglo que el usuario está viendo en
 * pantalla). Los imports de jsPDF son dinámicos para que nunca se evalúen
 * durante el render en servidor de este Client Component.
 */
export async function exportLeadsToPdf(leads: ProcessedLead[], options: ExportOptions): Promise<void> {
  const { default: jsPDF } = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');

  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });

  doc.setFontSize(16);
  doc.setTextColor(20, 20, 20);
  doc.text('Live Desarrollos — Reporte de Leads', 40, 40);

  doc.setFontSize(10);
  doc.setTextColor(90, 90, 90);
  doc.text(`Generado: ${options.generatedAt}`, 40, 58);
  doc.text(`Filtros aplicados: ${options.filtersSummary}`, 40, 72);
  doc.text(`Total de registros: ${leads.length}`, 40, 86);

  autoTable(doc, {
    startY: 100,
    head: [['Fecha', 'Nombre', 'Correo', 'Teléfono', 'Campaña', 'Presupuesto', 'Motivo', 'Status']],
    body: leads.map((lead) => [
      formatLeadDate(lead.parsedDate),
      lead.Nombre || 'Sin nombre',
      lead.Correo || '—',
      lead.Telefono || '—',
      lead.Campana || '—',
      lead.presupuestoClean,
      lead.motivoClean,
      lead.status,
    ]),
    styles: { fontSize: 8, cellPadding: 5 },
    headStyles: { fillColor: [24, 24, 27], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [245, 245, 245] },
    margin: { left: 40, right: 40 },
  });

  const filename = `live-desarrollos-leads-${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(filename);
}