/**
 * Genera un brief de campaña de Meta Ads con Claude: nombre, objetivo,
 * presupuesto sugerido, targeting básico, y 3 variantes de copy para
 * probar. El resultado se usa en metaCampaignCreate.ts para crear la
 * Campaña + Ad Set de verdad en Meta, en estado PAUSED.
 */

export type CampaignObjective = 'leads' | 'ventas' | 'trafico' | 'reconocimiento' | 'interaccion';

export type CampaignBriefInput =
  | {
      mode: 'structured';
      objective: CampaignObjective;
      businessDescription: string;
      targetDescription: string;
      dailyBudgetMXN: number;
      countryCode?: string;
    }
  | {
      mode: 'freeform';
      prompt: string;
      countryCode?: string;
    };

export interface AdCopyVariant {
  headline: string;
  primaryText: string;
  description: string;
  cta: string;
}

export interface CampaignBrief {
  campaignName: string;
  adSetName: string;
  objective: CampaignObjective;
  dailyBudgetMXN: number;
  ageMin: number;
  ageMax: number;
  genders: 'all' | 'men' | 'women';
  targetingSummary: string;
  adCopyVariants: AdCopyVariant[];
  strategyNotes: string;
}

const STRUCTURED_OUTPUT_INSTRUCTIONS = `
Devuelve EXCLUSIVAMENTE un objeto JSON (sin \`\`\`json, sin texto antes o después), con esta forma exacta:

{
  "campaignName": "<nombre corto y descriptivo de la campaña, en español>",
  "adSetName": "<nombre corto del ad set, en español>",
  "ageMin": <número entre 18 y 65>,
  "ageMax": <número entre 18 y 65, mayor o igual a ageMin>,
  "genders": "all"|"men"|"women",
  "targetingSummary": "<descripción en español, 1-2 frases, de a quién le va a hablar esta campaña>",
  "adCopyVariants": [
    { "headline": "<máx 40 caracteres>", "primaryText": "<máx 125 palabras>", "description": "<máx 30 caracteres>", "cta": "<texto de botón en español, ej. 'Más información', 'Solicitar cotización'>" }
    ... (exactamente 3 variantes, con ángulos distintos entre sí — no repitas la misma idea con otras palabras)
  ],
  "strategyNotes": "<2-3 frases en español explicando por qué esta estrategia tiene sentido para este negocio>"
}

Reglas de formato JSON: comillas dobles siempre, sin comas colgantes, sin comentarios, JSON válido y completo. No uses saltos de línea literales dentro de un valor string; usa espacios.
`;

const FREEFORM_OUTPUT_INSTRUCTIONS = `
El usuario te va a dar UN SOLO texto libre describiendo lo que quiere (puede incluir o no: objetivo, negocio, público, presupuesto). Interpreta ese texto e infiere lo que falte con criterio profesional.

Devuelve EXCLUSIVAMENTE un objeto JSON (sin \`\`\`json, sin texto antes o después), con esta forma exacta:

{
  "objective": "leads"|"ventas"|"trafico"|"reconocimiento"|"interaccion",
  "dailyBudgetMXN": <número; si el usuario no menciona presupuesto, infiere uno razonable para el objetivo (ej. 300-500 MXN/día como punto de partida conservador)>,
  "campaignName": "<nombre corto y descriptivo de la campaña, en español>",
  "adSetName": "<nombre corto del ad set, en español>",
  "ageMin": <número entre 18 y 65>,
  "ageMax": <número entre 18 y 65, mayor o igual a ageMin>,
  "genders": "all"|"men"|"women",
  "targetingSummary": "<descripción en español, 1-2 frases, de a quién le va a hablar esta campaña>",
  "adCopyVariants": [
    { "headline": "<máx 40 caracteres>", "primaryText": "<máx 125 palabras>", "description": "<máx 30 caracteres>", "cta": "<texto de botón en español, ej. 'Más información', 'Solicitar cotización'>" }
    ... (exactamente 3 variantes, con ángulos distintos entre sí)
  ],
  "strategyNotes": "<2-3 frases en español explicando la estrategia Y qué información infirió que el usuario no dio explícitamente, para que lo pueda corregir si hace falta>"
}

Reglas de formato JSON: comillas dobles siempre, sin comas colgantes, sin comentarios, JSON válido y completo. No uses saltos de línea literales dentro de un valor string; usa espacios.
`;

export async function generateCampaignBrief(input: CampaignBriefInput): Promise<CampaignBrief> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('Falta la variable de entorno ANTHROPIC_API_KEY.');
  }

  const model = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5';
  const isFreeform = input.mode === 'freeform';

  const systemPrompt = `Eres un estratega senior de Meta Ads (Facebook + Instagram), especializado en generar briefs de campaña listos para lanzar. Trabajas para una agencia que atiende clientes reales — tu copy debe sonar profesional y persuasivo, no genérico.

${isFreeform ? FREEFORM_OUTPUT_INSTRUCTIONS : STRUCTURED_OUTPUT_INSTRUCTIONS}`;

  const userMessage = isFreeform
    ? `Esto es lo que pidió el usuario, tal cual, en un solo texto:\n\n"""\n${input.prompt}\n"""\n\nPaís: ${input.countryCode || 'MX'}`
    : `Genera el brief para esta campaña:

- Objetivo: ${input.objective}
- Descripción del negocio/producto: ${input.businessDescription}
- Público objetivo (descripción libre del cliente): ${input.targetDescription}
- Presupuesto diario: $${input.dailyBudgetMXN} MXN
- País: ${input.countryCode || 'MX'}`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Error de la API de Anthropic (${res.status}): ${errorText}`);
  }

  const json = await res.json();
  const textBlock = (json.content ?? []).find((block: any) => block.type === 'text');
  if (!textBlock?.text) {
    throw new Error('La respuesta de Claude no incluyó ningún bloque de texto.');
  }

  const cleaned = textBlock.text
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    // Saltos de línea/tabs sueltos rompen strings de JSON si no vienen
    // escapados — los volvemos espacio (seguro: entre llaves/comas el
    // salto de línea es solo whitespace opcional).
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/,(\s*[}\]])/g, '$1');

  try {
    if (isFreeform) {
      return JSON.parse(cleaned) as CampaignBrief;
    }
    const parsed = JSON.parse(cleaned) as Omit<CampaignBrief, 'objective' | 'dailyBudgetMXN'>;
    return { ...parsed, objective: input.objective, dailyBudgetMXN: input.dailyBudgetMXN };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const positionMatch = message.match(/position (\d+)/);
    const position = positionMatch ? Number(positionMatch[1]) : null;
    const snippet = position != null ? cleaned.slice(Math.max(0, position - 150), position + 150) : cleaned.slice(0, 500);
    console.error('[metaCampaignGenerator] JSON inválido. Fragmento cercano al error:', snippet);
    throw new Error(`No se pudo interpretar el brief generado por Claude: ${message}`);
  }
}