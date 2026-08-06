import { NextRequest, NextResponse } from 'next/server';
import { generateCampaignBrief, type CampaignObjective } from '@/lib/metaCampaignGenerator';
import { createPausedCampaign } from '@/lib/metaCampaignCreate';

export const maxDuration = 60;

const VALID_OBJECTIVES: CampaignObjective[] = ['leads', 'ventas', 'trafico', 'reconocimiento', 'interaccion'];

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const accountId: string | undefined = body?.accountId;
    const countryCode: string | undefined = body?.countryCode;
    const prompt: string | undefined = body?.prompt;

    if (!accountId || !accountId.startsWith('act_')) {
      return NextResponse.json({ error: 'accountId es requerido y debe tener el formato "act_1234567890".' }, { status: 400 });
    }

    const token = process.env.META_ACCESS_TOKEN;
    if (!token) {
      return NextResponse.json({ error: 'Falta la variable de entorno META_ACCESS_TOKEN en el servidor.' }, { status: 500 });
    }

    let brief;

    if (prompt?.trim()) {
      // Modo prompt libre: Claude infiere objetivo y presupuesto del texto.
      brief = await generateCampaignBrief({ mode: 'freeform', prompt: prompt.trim(), countryCode });
    } else {
      // Modo estructurado: campos separados.
      const objective: string | undefined = body?.objective;
      const businessDescription: string | undefined = body?.businessDescription;
      const targetDescription: string | undefined = body?.targetDescription;
      const dailyBudgetMXN: number | undefined = Number(body?.dailyBudgetMXN);

      if (!objective || !VALID_OBJECTIVES.includes(objective as CampaignObjective)) {
        return NextResponse.json({ error: `objective debe ser uno de: ${VALID_OBJECTIVES.join(', ')}` }, { status: 400 });
      }
      if (!businessDescription?.trim() || !targetDescription?.trim()) {
        return NextResponse.json({ error: 'businessDescription y targetDescription son requeridos.' }, { status: 400 });
      }
      if (!Number.isFinite(dailyBudgetMXN) || (dailyBudgetMXN as number) <= 0) {
        return NextResponse.json({ error: 'dailyBudgetMXN debe ser un número mayor a 0.' }, { status: 400 });
      }

      brief = await generateCampaignBrief({
        mode: 'structured',
        objective: objective as CampaignObjective,
        businessDescription,
        targetDescription,
        dailyBudgetMXN: dailyBudgetMXN as number,
        countryCode,
      });
    }

    // 2. Se crea de verdad en Meta, SIEMPRE en PAUSED.
    const created = await createPausedCampaign(accountId, token, brief, brief.dailyBudgetMXN, countryCode);

    return NextResponse.json({ brief, created });
  } catch (error) {
    console.error('[meta-campaign] Error:', error);
    const message = error instanceof Error ? error.message : 'Error desconocido al generar la campaña.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}