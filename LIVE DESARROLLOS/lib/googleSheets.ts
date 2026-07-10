import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import { unstable_cache } from 'next/cache';
import type { RawLead } from './types';

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets.readonly'];

/**
 * Variables de entorno requeridas (.env.local):
 *
 * GOOGLE_SERVICE_ACCOUNT_EMAIL="cuenta-de-servicio@proyecto.iam.gserviceaccount.com"
 * GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
 * GOOGLE_SHEET_ID="1AbCDeFGhIJkLmNoPQRstuVWXyz"
 *
 * La cuenta de servicio debe tener acceso de "Lector" (Viewer) al Sheet,
 * compartido explícitamente con su correo.
 */
async function fetchLeadsFromSheet(): Promise<RawLead[]> {
  const { GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY, GOOGLE_SHEET_ID } = process.env;

  if (!GOOGLE_SERVICE_ACCOUNT_EMAIL || !GOOGLE_PRIVATE_KEY || !GOOGLE_SHEET_ID) {
    console.error(
      '[googleSheets] Faltan variables de entorno: GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY o GOOGLE_SHEET_ID.'
    );
    return [];
  }

  try {
    const jwt = new JWT({
      email: GOOGLE_SERVICE_ACCOUNT_EMAIL,
      // En .env las llaves privadas suelen venir con "\n" literales, hay que
      // convertirlos a saltos de línea reales.
      key: GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      scopes: SCOPES,
    });

    const doc = new GoogleSpreadsheet(GOOGLE_SHEET_ID, jwt);
    await doc.loadInfo();

    // Asume que los leads viven en la primera hoja. Si usas una hoja
    // específica, cámbialo por doc.sheetsByTitle['Leads'].
    const sheet = doc.sheetsByIndex[0];
    const rows = await sheet.getRows();

    return rows.map((row) => ({
      Fecha: row.get('Fecha') ?? '',
      Campana: row.get('Campana') ?? '',
      Nombre: row.get('Nombre') ?? '',
      Correo: row.get('Correo') ?? '',
      Telefono: row.get('Telefono') ?? '',
      Presupuesto: row.get('Presupuesto') ?? '',
      Motivo: row.get('Motivo') ?? '',
      TiempoParaInvertir: row.get('TiempoParaInvertir') ?? '',
    }));
  } catch (error) {
    console.error('[googleSheets] Error al leer Google Sheets:', error);
    return [];
  }
}

/**
 * Versión cacheada (60s) de la lectura del Sheet, para no golpear la API de
 * Google en cada request al dashboard. Ajusta `revalidate` según qué tan
 * "en vivo" necesites los datos (o quítalo si prefieres SSR puro).
 */
export const getLeads = unstable_cache(fetchLeadsFromSheet, ['live-desarrollos-leads'], {
  revalidate: 60,
});