import { getLastMetaAudit } from './metaAuditStorage';

/**
 * Arma un resumen en texto plano de la última auditoría guardada de una
 * cuenta, para pasárselo a Claude como contexto extra al generar una
 * campaña — tanto en la generación manual (botón del panel) como en la
 * automática (cron semanal). Si no hay auditoría guardada, devuelve un
 * texto que lo indica explícitamente (Claude no debe inventar hallazgos).
 */
export async function buildAuditContextText(accountId: string): Promise<string> {
  const stored = await getLastMetaAudit(accountId);

  if (!stored) {
    return 'No hay una auditoría reciente guardada para esta cuenta — genera con criterio general de buenas prácticas de Meta Ads.';
  }

  const { audit, generatedAt } = stored;
  const quickWins = audit.quick_wins ?? [];
  const criticalIssues = audit.critical_issues ?? [];

  const lines: string[] = [
    `Última auditoría de Meta Ads de esta cuenta: ${new Date(generatedAt).toLocaleDateString('es-MX')} — Health Score ${Math.round(audit.health_score)}/100 (${audit.grade}).`,
  ];

  if (criticalIssues.length > 0) {
    lines.push('Problemas críticos detectados (considera si afectan la estrategia de esta campaña nueva):');
    criticalIssues.slice(0, 5).forEach((ci) => lines.push(`- ${ci.blocker_reason}`));
  }

  if (quickWins.length > 0) {
    lines.push('Quick wins / hallazgos recientes (úsalos como inspiración para el ángulo, targeting o estructura — no los repitas literal):');
    quickWins.slice(0, 6).forEach((qw) => lines.push(`- ${qw.action}`));
  }

  if (criticalIssues.length === 0 && quickWins.length === 0) {
    lines.push('La auditoría no encontró problemas críticos ni quick wins pendientes — la cuenta está en buen estado.');
  }

  return lines.join('\n');
}