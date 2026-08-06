'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface NamedAccount {
  name: string;
  accountId: string;
}

function getNamedAccounts(): NamedAccount[] {
  const raw = process.env.NEXT_PUBLIC_META_AD_ACCOUNTS;
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
  } catch {
    console.error('[meta-campaign-panel] NEXT_PUBLIC_META_AD_ACCOUNTS no es JSON válido.');
  }
  return [];
}

const OBJECTIVES: { value: string; label: string }[] = [
  { value: 'leads', label: 'Generación de leads' },
  { value: 'ventas', label: 'Ventas' },
  { value: 'trafico', label: 'Tráfico al sitio' },
  { value: 'reconocimiento', label: 'Reconocimiento de marca' },
  { value: 'interaccion', label: 'Interacción' },
];

interface AdCopyVariant {
  headline: string;
  primaryText: string;
  description: string;
  cta: string;
}

interface CampaignResult {
  brief: {
    campaignName: string;
    adSetName: string;
    dailyBudgetMXN: number;
    ageMin: number;
    ageMax: number;
    genders: string;
    targetingSummary: string;
    adCopyVariants: AdCopyVariant[];
    strategyNotes: string;
  };
  created: {
    campaignId: string;
    adSetId: string;
    adsManagerUrl: string;
  };
}

interface CreateAdState {
  loading: boolean;
  error: string | null;
  result: { adId: string; adsManagerUrl: string } | null;
  imageFile: File | null;
}

const EMPTY_AD_STATE: CreateAdState = { loading: false, error: null, result: null, imageFile: null };

export function MetaCampaignPanel() {
  const namedAccounts = getNamedAccounts();
  const [accountId, setAccountId] = useState('');
  const [selectedName, setSelectedName] = useState<string>(namedAccounts.length > 0 ? namedAccounts[0].name : '__manual__');
  const [mode, setMode] = useState<'prompt' | 'structured'>('prompt');
  const [prompt, setPrompt] = useState('');
  const [objective, setObjective] = useState('leads');
  const [businessDescription, setBusinessDescription] = useState('');
  const [targetDescription, setTargetDescription] = useState('');
  const [dailyBudgetMXN, setDailyBudgetMXN] = useState('300');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CampaignResult | null>(null);

  // Para el paso final: crear el Ad de verdad (imagen + copy elegido).
  const [pageId, setPageId] = useState(process.env.NEXT_PUBLIC_META_PAGE_ID || '');
  const [destinationLink, setDestinationLink] = useState('');
  const [adStates, setAdStates] = useState<Record<number, CreateAdState>>({});

  function getAdState(index: number): CreateAdState {
    return adStates[index] ?? EMPTY_AD_STATE;
  }

  function setAdState(index: number, patch: Partial<CreateAdState>) {
    setAdStates((prev) => ({ ...prev, [index]: { ...(prev[index] ?? EMPTY_AD_STATE), ...patch } }));
  }

  async function handleCreateAd(index: number, variant: AdCopyVariant) {
    if (!result) return;
    const state = getAdState(index);
    if (!state.imageFile) {
      setAdState(index, { error: 'Elige una imagen primero.' });
      return;
    }
    if (!pageId.trim() || !destinationLink.trim()) {
      setAdState(index, { error: 'Falta el Page ID o el link de destino (arriba de las variantes).' });
      return;
    }

    setAdState(index, { loading: true, error: null, result: null });
    try {
      const form = new FormData();
      form.set('accountId', effectiveAccountId);
      form.set('adSetId', result.created.adSetId);
      form.set('pageId', pageId.trim());
      form.set('headline', variant.headline);
      form.set('primaryText', variant.primaryText);
      form.set('destinationLink', destinationLink.trim());
      form.set('ctaText', variant.cta);
      form.set('adName', `${result.brief.campaignName} — Variante ${index + 1}`);
      form.set('image', state.imageFile);

      const res = await fetch('/api/meta-campaign/create-ad', { method: 'POST', body: form });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Ocurrió un error al crear el anuncio.');

      setAdState(index, { loading: false, result: { adId: json.adId, adsManagerUrl: json.adsManagerUrl } });
    } catch (err) {
      setAdState(index, { loading: false, error: err instanceof Error ? err.message : 'Ocurrió un error inesperado.' });
    }
  }

  const isManualEntry = selectedName === '__manual__';
  const effectiveAccountId = isManualEntry
    ? accountId.trim()
    : namedAccounts.find((a) => a.name === selectedName)?.accountId ?? '';

  const canSubmit =
    !!effectiveAccountId &&
    (mode === 'prompt'
      ? prompt.trim().length > 0
      : businessDescription.trim().length > 0 && targetDescription.trim().length > 0 && Number(dailyBudgetMXN) > 0);

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const payload =
        mode === 'prompt'
          ? { accountId: effectiveAccountId, prompt }
          : {
              accountId: effectiveAccountId,
              objective,
              businessDescription,
              targetDescription,
              dailyBudgetMXN: Number(dailyBudgetMXN),
            };

      const res = await fetch('/api/meta-campaign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Ocurrió un error al generar la campaña.');
      }
      setResult(json as CampaignResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ocurrió un error inesperado.');
    } finally {
      setLoading(false);
    }
  }

  const inputClass =
    'w-full rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 outline-none focus:border-zinc-600';

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setMode('prompt')}
          className={`rounded-md border px-3 py-1.5 text-xs ${
            mode === 'prompt' ? 'border-zinc-600 bg-zinc-800 text-zinc-100' : 'border-zinc-800 text-zinc-500 hover:text-zinc-300'
          }`}
        >
          Prompt libre
        </button>
        <button
          type="button"
          onClick={() => setMode('structured')}
          className={`rounded-md border px-3 py-1.5 text-xs ${
            mode === 'structured' ? 'border-zinc-600 bg-zinc-800 text-zinc-100' : 'border-zinc-800 text-zinc-500 hover:text-zinc-300'
          }`}
        >
          Campos detallados
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {namedAccounts.length > 0 && (
          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-zinc-500">Cuenta publicitaria</label>
            <select value={selectedName} onChange={(e) => setSelectedName(e.target.value)} className={inputClass}>
              {namedAccounts.map((acc) => (
                <option key={acc.accountId} value={acc.name}>
                  {acc.name}
                </option>
              ))}
              <option value="__manual__">Otra cuenta (pegar ID)…</option>
            </select>
          </div>
        )}

        {(isManualEntry || namedAccounts.length === 0) && (
          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-zinc-500">Ad Account ID</label>
            <input value={accountId} onChange={(e) => setAccountId(e.target.value)} placeholder="act_1234567890" className={inputClass} />
          </div>
        )}

        {mode === 'prompt' ? (
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-zinc-500">
              Describe la campaña que quieres (todo junto)
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={4}
              placeholder="Ej. Quiero generar leads para el desarrollo Live Neo en Cancún, departamentos desde $2.5 MDP, dirigido a inversionistas de 30-55 años interesados en bienes raíces en el Caribe mexicano, con $400 pesos al día de presupuesto."
              className={inputClass}
            />
            <p className="mt-1 text-xs text-zinc-600">
              Si no mencionas presupuesto u objetivo, Claude los infiere y te dice qué asumió en "Por qué esta estrategia".
            </p>
          </div>
        ) : (
          <>
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-zinc-500">Objetivo</label>
              <select value={objective} onChange={(e) => setObjective(e.target.value)} className={inputClass}>
                {OBJECTIVES.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-zinc-500">Presupuesto diario (MXN)</label>
              <input
                type="number"
                min={1}
                value={dailyBudgetMXN}
                onChange={(e) => setDailyBudgetMXN(e.target.value)}
                className={inputClass}
              />
            </div>

            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-zinc-500">
                Descripción del negocio / producto
              </label>
              <textarea
                value={businessDescription}
                onChange={(e) => setBusinessDescription(e.target.value)}
                rows={2}
                placeholder="Ej. Desarrollo residencial en Cancún, departamentos desde $2.5 MDP, entrega 2027…"
                className={inputClass}
              />
            </div>

            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-zinc-500">Público objetivo</label>
              <textarea
                value={targetDescription}
                onChange={(e) => setTargetDescription(e.target.value)}
                rows={2}
                placeholder="Ej. Inversionistas y compradores de segunda vivienda, 30-55 años, interesados en bienes raíces en el Caribe mexicano…"
                className={inputClass}
              />
            </div>
          </>
        )}
      </div>

      <div>
        <Button
          onClick={handleGenerate}
          disabled={loading || !canSubmit}
          className="h-9 bg-[#EFF767] px-4 text-zinc-950 hover:bg-[#EFF767]/90"
        >
          {loading ? 'Generando y creando en Meta (pausada)…' : 'Generar y crear en Meta (pausada)'}
        </Button>
        <p className="mt-2 text-xs text-zinc-500">
          Se crea de verdad en la cuenta, pero <span className="font-medium text-zinc-300">siempre en pausa</span> — no gasta nada
          hasta que alguien la active manualmente en Ads Manager.
        </p>
      </div>

      {error && <div className="rounded-md border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">{error}</div>}

      {result && (
        <div className="flex flex-col gap-6">
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-6">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
                Creada en Meta — PAUSADA
              </Badge>
            </div>
            <p className="mt-3 text-lg font-semibold text-zinc-50">{result.brief.campaignName}</p>
            <p className="text-sm text-zinc-400">Ad Set: {result.brief.adSetName}</p>
            <p className="text-sm text-zinc-400">Presupuesto diario: ${result.brief.dailyBudgetMXN} MXN</p>
            <p className="mt-2 text-xs text-zinc-500">
              Campaign ID: <span className="font-mono">{result.created.campaignId}</span> · Ad Set ID:{' '}
              <span className="font-mono">{result.created.adSetId}</span>
            </p>
            <a
              href={result.created.adsManagerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-block text-sm text-[#EFF767] hover:underline"
            >
              Abrir en Ads Manager →
            </a>
          </div>

          <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-6">
            <p className="mb-1 text-sm font-semibold text-zinc-100">Targeting</p>
            <p className="text-sm text-zinc-400">{result.brief.targetingSummary}</p>
            <p className="mt-1 text-xs text-zinc-500">
              Edad {result.brief.ageMin}-{result.brief.ageMax} · Género:{' '}
              {result.brief.genders === 'all' ? 'Todos' : result.brief.genders === 'men' ? 'Hombres' : 'Mujeres'}
            </p>
          </div>

          <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-6">
            <p className="mb-3 text-sm font-semibold text-zinc-100">Completar el anuncio (imagen + copy)</p>
            <div className="mb-4 grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-zinc-500">
                  Page ID de Facebook
                </label>
                <input value={pageId} onChange={(e) => setPageId(e.target.value)} placeholder="123456789012345" className={inputClass} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-zinc-500">Link de destino</label>
                <input
                  value={destinationLink}
                  onChange={(e) => setDestinationLink(e.target.value)}
                  placeholder="https://tusitio.com/desarrollo"
                  className={inputClass}
                />
              </div>
            </div>

            <div className="flex flex-col gap-4">
              {result.brief.adCopyVariants.map((variant, i) => {
                const adState = getAdState(i);
                return (
                  <div key={i} className="rounded-md border border-zinc-800 p-4">
                    <p className="mb-1 text-xs font-medium uppercase tracking-wider text-zinc-500">Variante {i + 1}</p>
                    <p className="font-semibold text-zinc-100">{variant.headline}</p>
                    <p className="mt-1 text-sm text-zinc-300">{variant.primaryText}</p>
                    <p className="mt-1 text-xs text-zinc-500">{variant.description}</p>
                    <Badge variant="outline" className="mt-2 border-zinc-700 text-zinc-400">
                      {variant.cta}
                    </Badge>

                    <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-zinc-800 pt-3">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => setAdState(i, { imageFile: e.target.files?.[0] ?? null, error: null })}
                        className="text-xs text-zinc-400 file:mr-2 file:rounded-md file:border file:border-zinc-700 file:bg-zinc-800 file:px-2 file:py-1 file:text-xs file:text-zinc-200"
                      />
                      <Button
                        onClick={() => handleCreateAd(i, variant)}
                        disabled={adState.loading || !adState.imageFile}
                        className="h-8 bg-zinc-100 px-3 text-xs text-zinc-950 hover:bg-zinc-300"
                      >
                        {adState.loading ? 'Creando anuncio…' : 'Crear anuncio con esta variante'}
                      </Button>
                    </div>

                    {adState.error && <p className="mt-2 text-xs text-red-400">{adState.error}</p>}
                    {adState.result && (
                      <div className="mt-2 flex items-center gap-2">
                        <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
                          Anuncio creado — PAUSADO
                        </Badge>
                        <a href={adState.result.adsManagerUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-[#EFF767] hover:underline">
                          Ver en Ads Manager →
                        </a>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-md border border-zinc-800 bg-zinc-900/50 p-4 text-xs text-zinc-500">
            <span className="font-medium text-zinc-400">Por qué esta estrategia: </span>
            {result.brief.strategyNotes}
          </div>
        </div>
      )}
    </div>
  );
}