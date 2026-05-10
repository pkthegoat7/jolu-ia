'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { apiUrl } from '@/lib/api';

type Clinic = {
  id: string;
  name: string;
  brandName: string;
  brandTagline: string;
  logoUrl: string | null;
  primaryColor: string;
  senderEmail: string | null;
  senderName: string | null;
};

type CatalogType = 'PGVECTOR' | 'WOOCOMMERCE' | 'MANUAL';

type CatalogSource = {
  id: string;
  name: string;
  type: CatalogType;
  envPrefix: string;
  ativo: boolean;
  prioridade: number;
  createdAt: string;
  updatedAt: string;
};

export default function ClinicAdminPage() {
  const router = useRouter();
  const [tab, setTab] = useState<'settings' | 'sources'>('settings');
  const [loading, setLoading] = useState(true);
  const [clinic, setClinic] = useState<Clinic | null>(null);
  const [sources, setSources] = useState<CatalogSource[]>([]);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const authFetch = useCallback(async (url: string, opts?: RequestInit) => {
    const res = await fetch(url, { ...opts, credentials: 'include' });
    if (res.status === 401) router.push('/admin');
    return res;
  }, [router]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [cRes, sRes] = await Promise.all([
        authFetch(apiUrl('/admin/clinic')),
        authFetch(apiUrl('/admin/catalog-sources')),
      ]);
      if (cRes.ok) setClinic(await cRes.json());
      if (sRes.ok) setSources(await sRes.json());
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => { void load(); }, [load]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f7f0f3]">
        <div className="h-8 w-8 rounded-full border-2 border-[#b96f8d]/30 border-t-[#b96f8d] animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f7f0f3] px-5 py-8">
      <div className="mx-auto w-full max-w-3xl space-y-6">
        <header className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[#b96f8d]">Clínica</p>
            <h1 className="font-display text-3xl font-light text-[#4a2435]">{clinic?.name ?? '—'}</h1>
          </div>
          <button onClick={() => router.push('/admin/dashboard')}
            className="rounded-xl border border-[#dfc8d4] bg-white px-4 py-2 text-sm text-[#4a2435] hover:bg-[#fdf8fb]">
            ← Dashboard
          </button>
        </header>

        <div className="flex gap-2 border-b border-[#e8d0db]">
          {(['settings', 'sources'] as const).map((t) => (
            <button
              key={t}
              onClick={() => { setTab(t); setMsg(null); }}
              className={`px-4 py-2 text-sm font-semibold transition-colors ${
                tab === t
                  ? 'border-b-2 border-[#b96f8d] text-[#4a2435]'
                  : 'text-[#9a7282] hover:text-[#4a2435]'
              }`}
            >
              {t === 'settings' ? 'Configurações' : 'Fontes de Catálogo'}
            </button>
          ))}
        </div>

        {msg && (
          <div className={`rounded-xl border px-4 py-3 text-sm ${
            msg.kind === 'ok'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-red-200 bg-red-50 text-red-700'
          }`}>
            {msg.text}
          </div>
        )}

        {tab === 'settings' && clinic && (
          <SettingsForm clinic={clinic} authFetch={authFetch} onSaved={(c) => {
            setClinic(c);
            setMsg({ kind: 'ok', text: 'Configurações salvas.' });
          }} onError={(text) => setMsg({ kind: 'err', text })} />
        )}

        {tab === 'sources' && (
          <SourcesPanel
            sources={sources}
            authFetch={authFetch}
            onChanged={async () => {
              const res = await authFetch(apiUrl('/admin/catalog-sources'));
              if (res.ok) setSources(await res.json());
            }}
            onError={(text) => setMsg({ kind: 'err', text })}
            onSuccess={(text) => setMsg({ kind: 'ok', text })}
          />
        )}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
function SettingsForm({
  clinic,
  authFetch,
  onSaved,
  onError,
}: {
  clinic: Clinic;
  authFetch: (url: string, opts?: RequestInit) => Promise<Response>;
  onSaved: (c: Clinic) => void;
  onError: (text: string) => void;
}) {
  const [name, setName] = useState(clinic.name);
  const [brandName, setBrandName] = useState(clinic.brandName);
  const [brandTagline, setBrandTagline] = useState(clinic.brandTagline);
  const [logoUrl, setLogoUrl] = useState(clinic.logoUrl ?? '');
  const [primaryColor, setPrimaryColor] = useState(clinic.primaryColor);
  const [senderEmail, setSenderEmail] = useState(clinic.senderEmail ?? '');
  const [senderName, setSenderName] = useState(clinic.senderName ?? '');
  const [busy, setBusy] = useState(false);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await authFetch(apiUrl('/admin/clinic'), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name, brandName, brandTagline,
          logoUrl: logoUrl || null,
          primaryColor,
          senderEmail: senderEmail || null,
          senderName: senderName || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        onError(data.message ?? 'Erro ao salvar.');
        return;
      }
      onSaved(data);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={save} className="glass rounded-2xl p-6 space-y-5">
      <Field label="Nome interno" value={name} set={setName} required hint="Nome interno da clínica (não aparece no e-mail)." />
      <Field label="Brand name" value={brandName} set={setBrandName} hint='Aparece no header e footer do e-mail (ex: "Patrícia Elias").' />
      <Field label="Brand tagline" value={brandTagline} set={setBrandTagline} hint='Subtítulo (ex: "Skin Intelligence").' />
      <Field label="Logo URL" value={logoUrl} set={setLogoUrl} type="url" hint="URL pública da imagem (https). Deixe vazio pra usar texto." />
      <div className="space-y-1.5">
        <label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8b3f5a]">Cor primária</label>
        <div className="flex items-center gap-3">
          <input type="color" value={primaryColor} onChange={e => setPrimaryColor(e.target.value)}
            className="h-10 w-16 cursor-pointer rounded-lg border border-[#dfc8d4]" />
          <input type="text" value={primaryColor} onChange={e => setPrimaryColor(e.target.value)}
            placeholder="#b96f8d" className="field flex-1" maxLength={7} />
        </div>
      </div>
      <Field label="Sender email" value={senderEmail} set={setSenderEmail} type="email" hint="Reply-to dos e-mails (opcional)." />
      <Field label="Sender name" value={senderName} set={setSenderName} hint="Nome no campo From (ex: Patrícia Elias Skin)." />

      <button type="submit" disabled={busy}
        className="btn-brand w-full rounded-2xl py-3.5 text-sm font-semibold disabled:opacity-55">
        {busy ? 'Salvando…' : 'Salvar configurações'}
      </button>
    </form>
  );
}

// ────────────────────────────────────────────────────────────────────
function SourcesPanel({
  sources,
  authFetch,
  onChanged,
  onError,
  onSuccess,
}: {
  sources: CatalogSource[];
  authFetch: (url: string, opts?: RequestInit) => Promise<Response>;
  onChanged: () => Promise<void>;
  onError: (text: string) => void;
  onSuccess: (text: string) => void;
}) {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [type, setType] = useState<CatalogType>('PGVECTOR');
  const [envPrefix, setEnvPrefix] = useState('');
  const [prioridade, setPrioridade] = useState('1');
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const resetForm = () => {
    setName(''); setType('PGVECTOR'); setEnvPrefix(''); setPrioridade('1');
  };

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await authFetch(apiUrl('/admin/catalog-sources'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name, type, envPrefix,
          prioridade: parseInt(prioridade, 10) || 0,
          ativo: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        onError(data.message ?? 'Erro ao criar.');
        return;
      }
      onSuccess(`Fonte "${data.name}" criada.`);
      resetForm();
      setCreating(false);
      await onChanged();
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (s: CatalogSource) => {
    const res = await authFetch(apiUrl(`/admin/catalog-sources/${s.id}`), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ativo: !s.ativo }),
    });
    if (!res.ok) {
      const data = await res.json();
      onError(data.message ?? 'Erro ao alternar status.');
      return;
    }
    await onChanged();
  };

  const remove = async (id: string) => {
    const res = await authFetch(apiUrl(`/admin/catalog-sources/${id}`), {
      method: 'DELETE',
    });
    if (!res.ok) {
      const data = await res.json();
      onError(data.message ?? 'Erro ao excluir.');
      return;
    }
    onSuccess('Fonte excluída.');
    setConfirmDeleteId(null);
    await onChanged();
  };

  return (
    <div className="space-y-5">
      {!creating && (
        <button onClick={() => setCreating(true)}
          className="btn-brand w-full rounded-2xl py-3 text-sm font-semibold">
          + Nova fonte
        </button>
      )}

      {creating && (
        <form onSubmit={create} className="glass rounded-2xl p-6 space-y-4">
          <p className="text-sm font-semibold text-[#4a2435]">Nova fonte de catálogo</p>
          <Field label="Nome" value={name} set={setName} required hint="Ex: Loja PE Hetzner" />
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8b3f5a]">Tipo</label>
            <select value={type} onChange={e => setType(e.target.value as CatalogType)}
              className="field">
              <option value="PGVECTOR">PGVECTOR (busca vetorial via OpenAI)</option>
              <option value="WOOCOMMERCE" disabled>WooCommerce (não implementado)</option>
              <option value="MANUAL" disabled>Manual (não implementado)</option>
            </select>
          </div>
          <Field label="Env prefix" value={envPrefix} set={setEnvPrefix} required
            hint="UPPERCASE, ex: JOLU_PE. As envs ficam JOLU_PE_PGVECTOR_URL etc." />
          <Field label="Prioridade" value={prioridade} set={setPrioridade} type="number"
            hint="Maior = mais prioritária quando há múltiplas fontes ativas." />
          <div className="flex gap-3">
            <button type="button" onClick={() => { setCreating(false); resetForm(); }}
              className="flex-1 rounded-2xl border border-[#dfc8d4] bg-white py-3 text-sm font-semibold text-[#4a2435]">
              Cancelar
            </button>
            <button type="submit" disabled={busy}
              className="btn-brand flex-1 rounded-2xl py-3 text-sm font-semibold disabled:opacity-55">
              {busy ? 'Criando…' : 'Criar'}
            </button>
          </div>
        </form>
      )}

      {sources.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-[#dfc8d4] p-8 text-center text-sm text-[#9a7282]">
          Nenhuma fonte cadastrada. Sem fontes ativas, o sistema usa o fallback hardcoded.
        </p>
      ) : (
        <div className="space-y-3">
          {sources.map((s) => (
            <SourceRow
              key={s.id}
              source={s}
              authFetch={authFetch}
              isEditing={editingId === s.id}
              onEdit={() => setEditingId(s.id)}
              onCancelEdit={() => setEditingId(null)}
              onChanged={async () => { setEditingId(null); await onChanged(); }}
              onError={onError}
              onToggle={() => toggle(s)}
              confirmDelete={confirmDeleteId === s.id}
              onAskDelete={() => setConfirmDeleteId(s.id)}
              onCancelDelete={() => setConfirmDeleteId(null)}
              onConfirmDelete={() => remove(s.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SourceRow({
  source, authFetch, isEditing, onEdit, onCancelEdit, onChanged, onError,
  onToggle, confirmDelete, onAskDelete, onCancelDelete, onConfirmDelete,
}: {
  source: CatalogSource;
  authFetch: (url: string, opts?: RequestInit) => Promise<Response>;
  isEditing: boolean;
  onEdit: () => void;
  onCancelEdit: () => void;
  onChanged: () => Promise<void>;
  onError: (t: string) => void;
  onToggle: () => void;
  confirmDelete: boolean;
  onAskDelete: () => void;
  onCancelDelete: () => void;
  onConfirmDelete: () => void;
}) {
  const [name, setName] = useState(source.name);
  const [envPrefix, setEnvPrefix] = useState(source.envPrefix);
  const [prioridade, setPrioridade] = useState(String(source.prioridade));
  const [busy, setBusy] = useState(false);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await authFetch(apiUrl(`/admin/catalog-sources/${source.id}`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, envPrefix, prioridade: parseInt(prioridade, 10) || 0 }),
      });
      if (!res.ok) {
        const data = await res.json();
        onError(data.message ?? 'Erro ao salvar.');
        return;
      }
      await onChanged();
    } finally {
      setBusy(false);
    }
  };

  if (isEditing) {
    return (
      <form onSubmit={save} className="glass rounded-2xl p-5 space-y-4">
        <Field label="Nome" value={name} set={setName} required />
        <Field label="Env prefix" value={envPrefix} set={setEnvPrefix} required />
        <Field label="Prioridade" value={prioridade} set={setPrioridade} type="number" />
        <div className="flex gap-3">
          <button type="button" onClick={onCancelEdit}
            className="flex-1 rounded-2xl border border-[#dfc8d4] bg-white py-2.5 text-sm font-semibold text-[#4a2435]">
            Cancelar
          </button>
          <button type="submit" disabled={busy}
            className="btn-brand flex-1 rounded-2xl py-2.5 text-sm font-semibold disabled:opacity-55">
            {busy ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className={`glass rounded-2xl p-5 ${source.ativo ? '' : 'opacity-60'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <p className="font-semibold text-[#4a2435]">{source.name}</p>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
              source.ativo ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'
            }`}>
              {source.ativo ? 'Ativo' : 'Inativo'}
            </span>
          </div>
          <p className="mt-1 text-xs text-[#9a7282]">
            <strong>{source.type}</strong> · prefix <code className="font-mono">{source.envPrefix}</code> · prioridade {source.prioridade}
          </p>
        </div>
        <div className="flex flex-shrink-0 gap-2">
          <button onClick={onToggle}
            className="rounded-lg border border-[#dfc8d4] bg-white px-3 py-1.5 text-xs font-semibold text-[#4a2435]">
            {source.ativo ? 'Desativar' : 'Ativar'}
          </button>
          <button onClick={onEdit}
            className="rounded-lg border border-[#dfc8d4] bg-white px-3 py-1.5 text-xs font-semibold text-[#4a2435]">
            Editar
          </button>
          <button onClick={onAskDelete}
            className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-600">
            Excluir
          </button>
        </div>
      </div>
      {confirmDelete && (
        <div className="mt-4 flex items-center justify-between rounded-xl border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-sm text-red-700">Excluir esta fonte? Análises antigas mantêm o registro.</p>
          <div className="flex gap-2">
            <button onClick={onCancelDelete}
              className="rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-[#4a2435]">
              Cancelar
            </button>
            <button onClick={onConfirmDelete}
              className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white">
              Excluir
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
function Field({
  label, value, set, type = 'text', required, hint,
}: {
  label: string;
  value: string;
  set: (v: string) => void;
  type?: string;
  required?: boolean;
  hint?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8b3f5a]">{label}</label>
      <input type={type} value={value} required={required}
        onChange={e => set(e.target.value)}
        className="field" />
      {hint && <p className="text-xs text-[#b8a0ac]">{hint}</p>}
    </div>
  );
}
