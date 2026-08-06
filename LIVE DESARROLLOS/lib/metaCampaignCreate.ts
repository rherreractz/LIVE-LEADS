import type { CampaignBrief, CampaignObjective } from './metaCampaignGenerator';

/**
 * Crea la estructura real de Campaña + Ad Set en Meta (Marketing API),
 * SIEMPRE en estado PAUSED — nunca se activa sola. Queda lista en Ads
 * Manager para que alguien la revise y la active con un clic, sin riesgo
 * de gasto accidental.
 *
 * IMPORTANTE: esto SÍ escribe en la cuenta real del cliente (a diferencia
 * de metaAds.ts, que solo lee). El token META_ACCESS_TOKEN necesita el
 * scope ads_management (no solo ads_read) para que esto funcione.
 *
 * Deliberadamente NO se crea el anuncio (Ad) final con creativo/imagen —
 * eso requiere una Página de Facebook conectada y assets visuales, que
 * quedan fuera de este alcance. El copy generado se muestra en el
 * dashboard para pegarlo manualmente al crear el anuncio en Ads Manager.
 */

const GRAPH_BASE = 'https://graph.facebook.com';

const OBJECTIVE_MAP: Record<CampaignObjective, { objective: string; optimization_goal: string; billing_event: string }> = {
  leads: { objective: 'OUTCOME_LEADS', optimization_goal: 'LEAD_GENERATION', billing_event: 'IMPRESSIONS' },
  ventas: { objective: 'OUTCOME_SALES', optimization_goal: 'OFFSITE_CONVERSIONS', billing_event: 'IMPRESSIONS' },
  trafico: { objective: 'OUTCOME_TRAFFIC', optimization_goal: 'LINK_CLICKS', billing_event: 'IMPRESSIONS' },
  reconocimiento: { objective: 'OUTCOME_AWARENESS', optimization_goal: 'REACH', billing_event: 'IMPRESSIONS' },
  interaccion: { objective: 'OUTCOME_ENGAGEMENT', optimization_goal: 'POST_ENGAGEMENT', billing_event: 'IMPRESSIONS' },
};

const GENDER_MAP: Record<CampaignBrief['genders'], number[] | undefined> = {
  all: undefined,
  men: [1],
  women: [2],
};

interface GraphError {
  _error: { status: number; message: string; body: unknown };
}

function isGraphError(value: unknown): value is GraphError {
  return !!value && typeof value === 'object' && '_error' in (value as object);
}

async function graphPost(path: string, params: Record<string, unknown>, token: string, apiVersion: string): Promise<any> {
  const url = `${GRAPH_BASE}/${apiVersion}/${path.replace(/^\//, '')}`;
  const body = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    body.set(key, typeof value === 'string' ? value : JSON.stringify(value));
  });
  body.set('access_token', token);

  const res = await fetch(url, { method: 'POST', body });
  const data = await res.json();

  if (!res.ok) {
    const err = data?.error ?? {};
    const detailedMessage = [
      err.error_user_title,
      err.error_user_msg,
      err.message,
      err.error_subcode ? `(subcode ${err.error_subcode})` : null,
      err.fbtrace_id ? `[trace: ${err.fbtrace_id}]` : null,
    ]
      .filter(Boolean)
      .join(' — ');

    console.error(`[metaCampaignCreate] POST ${path} falló. Params enviados:`, params);
    console.error(`[metaCampaignCreate] Respuesta completa de Meta:`, JSON.stringify(data, null, 2));

    return {
      _error: { status: res.status, message: detailedMessage || `HTTP ${res.status}`, body: data },
    } satisfies GraphError;
  }

  return data;
}

export interface CreatePausedCampaignResult {
  campaignId: string;
  adSetId: string;
  adsManagerUrl: string;
}

export async function createPausedCampaign(
  accountId: string,
  token: string,
  brief: CampaignBrief,
  dailyBudgetMXN: number,
  countryCode = 'MX',
): Promise<CreatePausedCampaignResult> {
  const apiVersion = process.env.META_API_VERSION || 'v22.0';
  const mapping = OBJECTIVE_MAP[brief.objective];

  // 1. Campaña, PAUSED desde el día uno.
  const campaign = await graphPost(
    `${accountId}/campaigns`,
    {
      name: brief.campaignName,
      objective: mapping.objective,
      status: 'PAUSED',
      special_ad_categories: [],
      buying_type: 'AUCTION',
      // Requerido por Meta cuando el presupuesto se maneja a nivel Ad Set
      // (ABO, nuestro caso) en vez de a nivel Campaña (CBO). false = cada
      // ad set usa su propio presupuesto sin compartir con otros.
      is_adset_budget_sharing_enabled: false,
    },
    token,
    apiVersion,
  );

  if (isGraphError(campaign)) {
    throw new Error(`No se pudo crear la campaña en Meta: ${campaign._error.message}`);
  }

  const campaignId: string = campaign.id;

  // 2. Ad Set, también PAUSED, con el targeting y presupuesto del brief.
  // Targeting deliberadamente amplio (solo país + edad + género) — sin
  // intereses específicos, ya que targetear por interés requiere buscar
  // IDs válidos contra la API de Meta; queda como mejora futura. Esto
  // además está alineado con lo que Meta recomienda hoy (Advantage+
  // Audience / targeting amplio suele rendir mejor que restringir de más).
  const genders = GENDER_MAP[brief.genders];

  const adSet = await graphPost(
    `${accountId}/adsets`,
    {
      name: brief.adSetName,
      campaign_id: campaignId,
      status: 'PAUSED',
      daily_budget: Math.round(dailyBudgetMXN * 100), // Meta espera centavos
      billing_event: mapping.billing_event,
      optimization_goal: mapping.optimization_goal,
      bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
      targeting: {
        geo_locations: { countries: [countryCode] },
        age_min: brief.ageMin,
        age_max: brief.ageMax,
        ...(genders ? { genders } : {}),
        // Requerido por Meta desde 2026: hay que decidir explícitamente si
        // se activa Advantage+ Audience (Meta puede expandir el targeting
        // más allá de lo que definiste, si detecta que rinde mejor). En 0
        // (desactivado) para que el targeting se quede exacto como lo
        // generó Claude — cámbialo a 1 si prefieres dejar que Meta expanda.
        targeting_automation: { advantage_audience: 0 },
      },
      start_time: new Date(Date.now() + 5 * 60 * 1000).toISOString(), // 5 min en el futuro, requerido por la API aunque esté PAUSED
    },
    token,
    apiVersion,
  );

  if (isGraphError(adSet)) {
    // Si el ad set falla, la campaña quedó creada (vacía) — lo dejamos así
    // en vez de borrarla, para no complicar el flujo; queda visible en Ads
    // Manager como borrador sin ad sets.
    throw new Error(`La campaña se creó, pero no se pudo crear el Ad Set: ${adSet._error.message}`);
  }

  const adSetId: string = adSet.id;

  return {
    campaignId,
    adSetId,
    adsManagerUrl: `https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=${accountId.replace('act_', '')}&selected_campaign_ids=${campaignId}`,
  };
}