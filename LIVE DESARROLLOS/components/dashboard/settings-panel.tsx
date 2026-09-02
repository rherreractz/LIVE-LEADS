'use client';

import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { AppSettings } from '@/lib/settingsStorage';

type Section = 'general' | 'advanced';

const LOGO_MAX_DATA_URI_LENGTH = 44000;
const LOGO_ACCEPTED_TYPES = 'image/png,image/jpeg,image/webp,image/svg+xml,image/gif';

function readFileAsDataUri(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('No se pudo leer el archivo.'));
    reader.readAsDataURL(file);
  });
}

const THEME_OPTIONS: { value: string; label: string }[] = [
  { value: 'light', label: 'Claro' },
  { value: 'dark', label: 'Oscuro' },
  { value: 'system', label: 'Sistema' },
];

function ThemeSwitch() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const current = mounted ? theme ?? 'system' : 'system';

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm text-muted-foreground">Modo claro / oscuro</label>
      <div className="inline-flex w-fit rounded-md border border-border p-0.5">
        {THEME_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setTheme(opt.value)}
            className={`rounded px-3 py-1 text-sm transition-colors ${
              current === opt.value ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        También puedes alternar con la tecla <kbd className="rounded border border-border px-1">D</kbd> (fuera de un campo de texto).
      </p>
    </div>
  );
}

const NAV_ITEMS: { id: Section; label: string }[] = [
  { id: 'general', label: 'General' },
  { id: 'advanced', label: 'Avanzado' },
];

export function SettingsPanel({ initialSettings }: { initialSettings: AppSettings }) {
  const [settings, setSettings] = useState<AppSettings>(initialSettings);
  const [section, setSection] = useState<Section>('general');
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [logoError, setLogoError] = useState<string | null>(null);

  async function handleLogoFile(file: File | undefined) {
    setLogoError(null);
    if (!file) return;
    try {
      const dataUri = await readFileAsDataUri(file);
      if (!dataUri.startsWith('data:image/')) {
        setLogoError('El archivo no es una imagen válida.');
        return;
      }
      if (dataUri.length > LOGO_MAX_DATA_URI_LENGTH) {
        setLogoError(
          `La imagen pesa demasiado (≈${Math.round(dataUri.length / 1000)} KB codificada, máx. ~${Math.round(
            LOGO_MAX_DATA_URI_LENGTH / 1000,
          )} KB). Usa una versión más pequeña o comprimida.`,
        );
        return;
      }
      setSettings((s) => ({ ...s, logoDataUri: dataUri }));
    } catch {
      setLogoError('No se pudo leer el archivo.');
    }
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      const raw = await res.text();
      const data = raw ? JSON.parse(raw) : null;

      if (!res.ok || !data?.ok) {
        setError(data?.error || `No se pudo guardar (HTTP ${res.status}).`);
        return;
      }

      setSavedAt(Date.now());
    } catch (err) {
      setError('No se pudo conectar con el servidor. ¿Se actualizó el sitio? Intenta recargar la página (Ctrl+Shift+R).');
      console.error('[settings-panel] Error al guardar:', err);
    } finally {
      setSaving(false);
    }
  }

  // Helper para leer el estado del switch (por default true si es undefined)
  const isSourceEnabled = (key: 'enableHubspot' | 'enableGhl' | 'enableTresor') => {
    return settings[key] !== false; 
  };

  const toggleSource = (key: 'enableHubspot' | 'enableGhl' | 'enableTresor') => {
    setSettings(s => ({ ...s, [key]: !isSourceEnabled(key) }));
  };

  const SOURCES = [
    { key: 'enableHubspot', label: 'HubSpot', note: 'teléfono y correo' },
    { key: 'enableGhl', label: 'GoHighLevel', note: 'solo correo' },
    { key: 'enableTresor', label: 'Fuentes Propias (Tresor)', note: 'solo correo' },
  ] as const;

  return (
    <div className="flex h-full min-h-0 flex-col sm:flex-row">
      <nav className="shrink-0 border-b border-border p-2 sm:w-48 sm:border-b-0 sm:border-r sm:p-3">
        <p className="mb-2 hidden px-2 text-xs font-medium uppercase tracking-wider text-muted-foreground sm:block">Ajustes</p>
        <ul className="flex gap-1 overflow-x-auto [scrollbar-width:none] sm:flex-col sm:gap-0.5 sm:overflow-visible [&::-webkit-scrollbar]:hidden">
          {NAV_ITEMS.map((item) => (
            <li key={item.id} className="shrink-0">
              <button
                type="button"
                onClick={() => setSection(item.id)}
                className={`rounded-md px-3 py-1.5 text-left text-sm sm:w-full ${
                  section === item.id ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      <div className="min-h-0 flex-1 overflow-auto p-4 sm:p-6">
        <div className="mx-auto flex max-w-xl flex-col gap-6">
          {section === 'general' && (
            <div className="flex flex-col gap-4">
              <h2 className="text-lg font-semibold text-foreground">General</h2>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="displayName" className="text-sm text-muted-foreground">
                  Nombre a mostrar
                </label>
                <Input
                  id="displayName"
                  value={settings.displayName || ''}
                  onChange={(e) => setSettings((s) => ({ ...s, displayName: e.target.value }))}
                  placeholder="(usa el nombre por default del proyecto)"
                  className="border-border bg-background text-foreground"
                />
                <p className="text-xs text-muted-foreground">Aparece en el encabezado del panel. Déjalo vacío para usar el nombre por default.</p>
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="logo" className="text-sm text-muted-foreground">
                  Logo
                </label>
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded border border-border ${
                      settings.logoBackground === 'dark' ? 'bg-zinc-900' : 'bg-background'
                    }`}
                  >
                    {settings.logoDataUri ? (
                      <img src={settings.logoDataUri} alt="Logo" className="max-h-full max-w-full object-contain" />
                    ) : (
                      <span className="text-[10px] text-muted-foreground">sin logo</span>
                    )}
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <input
                      id="logo"
                      type="file"
                      accept={LOGO_ACCEPTED_TYPES}
                      onChange={(e) => {
                        void handleLogoFile(e.target.files?.[0]);
                        e.target.value = '';
                      }}
                      className="text-xs text-muted-foreground file:mr-3 file:rounded-md file:border file:border-border file:bg-muted file:px-3 file:py-1 file:text-xs file:text-foreground hover:file:bg-muted/70"
                    />
                    {settings.logoDataUri && (
                      <button
                        type="button"
                        onClick={() => {
                          setLogoError(null);
                          setSettings((s) => ({ ...s, logoDataUri: '' }));
                        }}
                        className="w-fit text-xs text-red-600 hover:underline dark:text-red-400"
                      >
                        Quitar logo
                      </button>
                    )}
                  </div>
                </div>
                {settings.logoDataUri && (
                  <label className="flex items-center gap-2 text-xs text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={settings.logoBackground === 'dark'}
                      onChange={(e) => setSettings((s) => ({ ...s, logoBackground: e.target.checked ? 'dark' : '' }))}
                    />
                    El logo es de un solo color claro (ej. blanco) — mostrarlo sobre una placa oscura para que no desaparezca en modo
                    claro
                  </label>
                )}
                {logoError ? (
                  <p className="text-xs text-red-600 dark:text-red-400">{logoError}</p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    PNG, JPG, WEBP o SVG. Aparece en la pantalla de inicio de sesión y en el encabezado del panel. Usa una imagen chica
                    (idealmente &lt; 30 KB); si es muy pesada no se podrá guardar.
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="primaryColor" className="text-sm text-muted-foreground">
                  Color primario
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    aria-label="Color primario"
                    value={settings.primaryColor || '#53958B'}
                    onChange={(e) => setSettings((s) => ({ ...s, primaryColor: e.target.value }))}
                    className="h-9 w-9 cursor-pointer rounded border border-border bg-background p-0.5"
                  />
                  <Input
                    id="primaryColor"
                    value={settings.primaryColor || ''}
                    onChange={(e) => setSettings((s) => ({ ...s, primaryColor: e.target.value }))}
                    placeholder="(usa el color por default del proyecto)"
                    className="border-border bg-background text-foreground"
                  />
                </div>
              </div>

              <ThemeSwitch />
            </div>
          )}

          {section === 'advanced' && (
            <div className="flex flex-col gap-4">
              <h2 className="text-lg font-semibold text-foreground">Avanzado</h2>

              <div className="flex flex-col gap-2">
                <label className="text-sm text-muted-foreground">Fuentes de enriquecimiento de leads</label>
                <p className="text-xs text-muted-foreground">
                  Live lee los leads crudos de Google Sheets de forma permanente. Usa estos interruptores para habilitar o deshabilitar qué sistemas externos cruzan su información para actualizar el estado y etapa de esos leads en el panel.
                </p>

                {SOURCES.map((source) => {
                  const enabled = isSourceEnabled(source.key);
                  return (
                    <div
                      key={source.key}
                      className={`flex items-center justify-between gap-3 rounded-md border px-3 py-2 transition-colors ${
                        enabled 
                          ? 'border-emerald-500/40 bg-emerald-500/5' 
                          : 'border-border bg-muted/30'
                      }`}
                    >
                      <span className={`text-sm ${enabled ? 'text-foreground' : 'text-muted-foreground'}`}>
                        {source.label} <span className="text-xs opacity-70">· {source.note}</span>
                      </span>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={enabled}
                        onClick={() => toggleSource(source.key)}
                        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors ${
                          enabled ? 'bg-emerald-500' : 'bg-muted-foreground/30'
                        }`}
                      >
                        <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                          enabled ? 'translate-x-4' : 'translate-x-1'
                        }`} />
                      </button>
                    </div>
                  );
                })}
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="metaPageId" className="text-sm text-muted-foreground">
                  Page ID de Meta
                </label>
                <Input
                  id="metaPageId"
                  value={settings.metaPageId || ''}
                  onChange={(e) => setSettings((s) => ({ ...s, metaPageId: e.target.value }))}
                  placeholder="(usa NEXT_PUBLIC_META_PAGE_ID del servidor)"
                  className="border-border bg-background text-foreground"
                />
                <p className="text-xs text-muted-foreground">
                  Precarga este ID en el formulario de "Generar Campaña". Déjalo vacío para usar el que ya está configurado en el servidor.
                </p>
              </div>

              <div className="rounded-md border border-border bg-background p-3 text-xs text-muted-foreground">
                Cualquier tipo de modificacion en esta sección puede afectar la forma en que el panel funciona y se conecta a los CRMs. Solo cambia estos valores si sabes lo que estás haciendo.
              </div>
            </div>
          )}

          <div className="flex items-center gap-3 border-t border-border pt-4">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Guardando…' : 'Guardar cambios'}
            </Button>
            {savedAt && <span className="text-sm text-emerald-700 dark:text-emerald-400">✓ Guardado</span>}
            {error && <span className="text-sm text-red-600 dark:text-red-400">{error}</span>}
          </div>
          <p className="text-xs text-muted-foreground">
            Los cambios pueden tardar hasta 2 minutos en reflejarse en el resto del panel (caché interno) — recarga la página después de
            ese tiempo si no los ves de inmediato.
          </p>
        </div>
      </div>
    </div>
  );
}