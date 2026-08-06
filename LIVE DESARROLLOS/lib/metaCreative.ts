/**
 * Último paso para completar el anuncio: sube la imagen a la galería de
 * Meta, crea el "ad creative" (el diseño: imagen + copy + botón) y crea el
 * Ad final dentro del Ad Set que ya existe — SIEMPRE en PAUSED, igual que
 * el resto del flujo.
 *
 * No usamos ningún storage propio: la imagen se manda directo desde el
 * navegador a esta ruta, y de aquí se reenvía a Meta en el mismo request
 * (no se guarda en disco en ningún punto).
 */

const GRAPH_BASE = 'https://graph.facebook.com';

/**
 * Mapa de textos de botón en español (los que genera Claude) a los
 * valores exactos que acepta la API de Meta (catálogo cerrado, en
 * inglés). Si el texto generado no hace match con nada de la lista, se
 * usa LEARN_MORE por default.
 */
const CTA_MAP: Record<string, string> = {
  'más información': 'LEARN_MORE',
  'saber más': 'LEARN_MORE',
  'contáctanos': 'CONTACT_US',
  contactanos: 'CONTACT_US',
  'solicitar cotización': 'GET_QUOTE',
  'solicitar cotizacion': 'GET_QUOTE',
  cotizar: 'GET_QUOTE',
  registrarse: 'SIGN_UP',
  suscribirse: 'SUBSCRIBE',
  'comprar ahora': 'SHOP_NOW',
  'ver más': 'LEARN_MORE',
  'agendar cita': 'BOOK_TRAVEL',
  'enviar mensaje': 'MESSAGE_PAGE',
  whatsapp: 'WHATSAPP_MESSAGE',
  'descargar': 'DOWNLOAD',
  'aplicar ahora': 'APPLY_NOW',
};

export function mapCtaToMetaEnum(ctaText: string): string {
  const normalized = ctaText.trim().toLowerCase();
  return CTA_MAP[normalized] || 'LEARN_MORE';
}

interface GraphError {
  _error: { status: number; message: string; body: unknown };
}

function isGraphError(value: unknown): value is GraphError {
  return !!value && typeof value === 'object' && '_error' in (value as object);
}

async function graphPostForm(path: string, form: FormData, token: string, apiVersion: string): Promise<any> {
  const url = `${GRAPH_BASE}/${apiVersion}/${path.replace(/^\//, '')}`;
  form.set('access_token', token);

  const res = await fetch(url, { method: 'POST', body: form });
  const data = await res.json();

  if (!res.ok) {
    const err = data?.error ?? {};
    const detailedMessage = [err.error_user_title, err.error_user_msg, err.message, err.error_subcode ? `(subcode ${err.error_subcode})` : null]
      .filter(Boolean)
      .join(' — ');
    console.error(`[metaCreative] POST ${path} falló:`, JSON.stringify(data, null, 2));
    return { _error: { status: res.status, message: detailedMessage || `HTTP ${res.status}`, body: data } } satisfies GraphError;
  }

  return data;
}

async function graphPostJSON(path: string, params: Record<string, unknown>, token: string, apiVersion: string): Promise<any> {
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
    const detailedMessage = [err.error_user_title, err.error_user_msg, err.message, err.error_subcode ? `(subcode ${err.error_subcode})` : null]
      .filter(Boolean)
      .join(' — ');
    console.error(`[metaCreative] POST ${path} falló:`, JSON.stringify(data, null, 2));
    return { _error: { status: res.status, message: detailedMessage || `HTTP ${res.status}`, body: data } } satisfies GraphError;
  }

  return data;
}

export interface CreateAdInput {
  accountId: string;
  token: string;
  adSetId: string;
  pageId: string;
  imageFile: File;
  headline: string;
  primaryText: string;
  destinationLink: string;
  ctaText: string; // texto libre en español (de la variante generada) o la selección del usuario
  adName: string;
}

export interface CreateAdResult {
  adId: string;
  creativeId: string;
  adsManagerUrl: string;
}

export async function createPausedAdWithImage(input: CreateAdInput): Promise<CreateAdResult> {
  const apiVersion = process.env.META_API_VERSION || 'v22.0';

  // 1. Subir la imagen a la galería de anuncios de la cuenta.
  const imageForm = new FormData();
  imageForm.set('source', input.imageFile, input.imageFile.name);

  const uploadResult = await graphPostForm(`${input.accountId}/adimages`, imageForm, input.token, apiVersion);
  if (isGraphError(uploadResult)) {
    throw new Error(`No se pudo subir la imagen a Meta: ${uploadResult._error.message}`);
  }

  // La respuesta viene como { images: { "nombre-del-archivo": { hash, url, ... } } }
  const imagesObj = uploadResult.images ?? {};
  const firstImageKey = Object.keys(imagesObj)[0];
  const imageHash: string | undefined = firstImageKey ? imagesObj[firstImageKey]?.hash : undefined;

  if (!imageHash) {
    throw new Error('Meta no devolvió un hash de imagen válido tras la subida.');
  }

  // 2. Crear el ad creative (el diseño del anuncio).
  const creative = await graphPostJSON(
    `${input.accountId}/adcreatives`,
    {
      name: `${input.adName} — creativo`,
      object_story_spec: {
        page_id: input.pageId,
        link_data: {
          message: input.primaryText,
          link: input.destinationLink,
          name: input.headline,
          image_hash: imageHash,
          call_to_action: { type: mapCtaToMetaEnum(input.ctaText), value: { link: input.destinationLink } },
        },
      },
    },
    input.token,
    apiVersion,
  );

  if (isGraphError(creative)) {
    throw new Error(`No se pudo crear el creativo: ${creative._error.message}`);
  }

  const creativeId: string = creative.id;

  // 3. Crear el Ad final, PAUSED.
  const ad = await graphPostJSON(
    `${input.accountId}/ads`,
    {
      name: input.adName,
      adset_id: input.adSetId,
      status: 'PAUSED',
      creative: { creative_id: creativeId },
    },
    input.token,
    apiVersion,
  );

  if (isGraphError(ad)) {
    throw new Error(`El creativo se creó, pero no se pudo crear el anuncio: ${ad._error.message}`);
  }

  return {
    adId: ad.id,
    creativeId,
    adsManagerUrl: `https://adsmanager.facebook.com/adsmanager/manage/ads?act=${input.accountId.replace('act_', '')}&selected_ad_ids=${ad.id}`,
  };
}