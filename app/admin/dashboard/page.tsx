'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { apiUrl } from '@/lib/api';

type Token = { id: string; slug: string; campanha: string; ativo: boolean; _count: { leads: number }; createdAt: string };
type Lead  = {
  id: string; nome: string; email: string; telefone: string;
  desejaMelhorar: string; createdAt: string;
  token: { campanha: string; slug: string };
  analise: { id: string; emailEnviado: boolean; createdAt: string; resultado: { tipoPele?: string } } | null;
};
type Stats = { totalLeads: number; analisadas: number; emailsEnviados: number; pendentes: number };
type LeadsResp = { data: Lead[]; total: number; page: number; limit: number };

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="glass rounded-2xl p-5 flex flex-col gap-1">
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#b8a0ac]">{label}</p>
      <p className="font-display text-4xl font-light" style={{ color }}>{value}</p>
    </div>
  );
}

export default function AdminDashboard() {
  const router = useRouter();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [tokens, setTokens] = useState<Token[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'leads' | 'tokens' | 'config'>('leads');
  const [newCampanha, setNewCampanha] = useState('');
  const [newSlug, setNewSlug] = useState('');
  const [tokenBusy, setTokenBusy] = useState(false);
  const [search, setSearch] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [webhookBusy, setWebhookBusy] = useState(false);
  const [webhookMsg, setWebhookMsg] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [confirmDeleteTokenId, setConfirmDeleteTokenId] = useState<string | null>(null);
  const [deletingToken, setDeletingToken] = useState(false);

  // Cookie is HttpOnly — sent automatically on same-origin requests.
  const authFetch = useCallback(async (url: string, opts?: RequestInit) => {
    const res = await fetch(url, { ...opts, credentials: 'include' });
    if (res.status === 401) { router.push('/admin'); }
    return res;
  }, [router]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [lRes, sRes, tRes, cfgRes] = await Promise.all([
        authFetch(apiUrl(`/admin/leads?page=${page}&limit=30`)),
        authFetch(apiUrl('/admin/stats')),
        authFetch(apiUrl('/admin/tokens')),
        authFetch(apiUrl('/admin/settings')),
      ]);
      const l = await lRes.json() as LeadsResp;
      const s = await sRes.json() as Stats;
      const t = await tRes.json() as Token[];
      const cfg = await cfgRes.json() as { webhookUrl: string };
      setLeads(l.data ?? []);
      setTotal(l.total ?? 0);
      setStats(s);
      setTokens(Array.isArray(t) ? t : []);
      setWebhookUrl(cfg.webhookUrl ?? '');
    } finally {
      setLoading(false);
    }
  }, [authFetch, page]);

  const saveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setWebhookBusy(true);
    setWebhookMsg('');
    try {
      await authFetch(apiUrl('/admin/settings'), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ webhookUrl: webhookUrl.trim() || null }),
      });
      setWebhookMsg('Configurações salvas com sucesso.');
    } catch {
      setWebhookMsg('Erro ao salvar.');
    } finally {
      setWebhookBusy(false);
    }
  };

  useEffect(() => { load(); }, [load]);

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    router.push('/admin');
  };

  const createToken = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCampanha.trim()) return;
    setTokenBusy(true);
    try {
      await authFetch(apiUrl('/admin/tokens'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campanha: newCampanha, slug: newSlug || undefined }),
      });
      setNewCampanha(''); setNewSlug('');
      await load();
    } finally { setTokenBusy(false); }
  };

  const deleteLead = async () => {
    if (!confirmDeleteId) return;
    setDeleting(true);
    try {
      await authFetch(apiUrl(`/admin/leads/${confirmDeleteId}`), { method: 'DELETE' });
      setConfirmDeleteId(null);
      await load();
    } finally {
      setDeleting(false);
    }
  };

  const deleteToken = async () => {
    if (!confirmDeleteTokenId) return;
    setDeletingToken(true);
    try {
      await authFetch(apiUrl(`/admin/tokens/${confirmDeleteTokenId}`), { method: 'DELETE' });
      setConfirmDeleteTokenId(null);
      await load();
    } finally {
      setDeletingToken(false);
    }
  };

  const toggleToken = async (id: string, ativo: boolean) => {
    await authFetch(apiUrl(`/admin/tokens/${id}`), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ativo: !ativo }),
    });
    await load();
  };

  const baseUrl = typeof window !== 'undefined' ? `${window.location.origin}/analise` : '';

  const filtered = leads.filter(l =>
    !search || [l.nome, l.email, l.telefone, l.token.campanha].some(s => s.toLowerCase().includes(search.toLowerCase()))
  );

  const skinColor: Record<string, string> = {
    'Oleosa': '#fb923c', 'Mista': '#fbbf24', 'Seca/Sensivel': '#38bdf8',
  };

  return (
    <div className="min-h-screen bg-[#f7f0f3]">
      {/* ── Header ── */}
      <header className="sticky top-0 z-20 flex items-center justify-between px-6 py-4 border-b border-[#e8d0db]/60 bg-white/70 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full border border-[#dfc8d4] bg-white shadow-sm">
            <span className="font-display text-[11px] font-semibold tracking-widest text-[#4a2435]">PE</span>
          </div>
          <div className="leading-none">
            <p className="text-[9px] font-medium uppercase tracking-[0.38em] text-[#b96f8d]">Patrícia Elias</p>
            <p className="text-xs font-semibold text-[#4a2435]">Painel Administrativo</p>
          </div>
        </div>
        <button onClick={logout} className="btn-ghost rounded-xl px-4 py-2 text-[13px] font-semibold">Sair</button>
      </header>

      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-8 space-y-6">

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard label="Total de Leads" value={stats.totalLeads} color="#4a2435" />
            <StatCard label="Analisadas"    value={stats.analisadas}   color="#b96f8d" />
            <StatCard label="E-mails Env."  value={stats.emailsEnviados} color="#34d399" />
            <StatCard label="Pendentes"     value={stats.pendentes}    color="#fb923c" />
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 p-1 glass rounded-2xl w-fit">
          {(['leads', 'tokens', 'config'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`rounded-xl px-5 py-2 text-[13px] font-semibold transition-all ${tab === t ? 'bg-white shadow-sm text-[#4a2435]' : 'text-[#9a7282] hover:text-[#4a2435]'}`}>
              {t === 'leads' ? `Leads (${total})` : t === 'tokens' ? 'Campanhas' : 'Configurações'}
            </button>
          ))}
        </div>

        {/* ── LEADS TAB ── */}
        {tab === 'leads' && (
          <div className="space-y-4">
            {/* Search */}
            <div className="relative max-w-sm">
              <svg className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#c4a0b8]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
              <input type="text" placeholder="Buscar por nome, email, campanha..." value={search}
                onChange={e => setSearch(e.target.value)}
                className="field pl-10 text-sm" />
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-20">
                <div className="h-8 w-8 rounded-full border-2 border-[#b96f8d]/30 border-t-[#b96f8d] animate-spin" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="glass rounded-3xl p-16 text-center">
                <p className="font-display text-2xl font-light text-[#4a2435]">Nenhum lead ainda</p>
                <p className="mt-2 text-sm text-[#9a7282]">Crie uma campanha e compartilhe o link para começar a capturar leads.</p>
              </div>
            ) : (
              <div className="glass rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[#e8d0db]/60">
                        {['Nome', 'Email', 'Telefone', 'Campanha', 'Tipo de Pele', 'Data', 'Status', ''].map((h, i) => (
                          <th key={i} className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.18em] text-[#b8a0ac]">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((l, i) => (
                        <tr key={l.id}
                          onClick={() => router.push(`/admin/leads/${l.id}`)}
                          className={`cursor-pointer transition-colors hover:bg-[#f7f0f3] ${i % 2 === 0 ? '' : 'bg-[#fdf8fb]'}`}>
                          <td className="px-4 py-3.5 font-medium text-[#4a2435]">{l.nome}</td>
                          <td className="px-4 py-3.5 text-[#7a5060]">{l.email}</td>
                          <td className="px-4 py-3.5 text-[#7a5060]">{l.telefone}</td>
                          <td className="px-4 py-3.5">
                            <span className="rounded-full px-2.5 py-0.5 text-[11px] font-medium bg-[#f3e8f0] text-[#7a3f56]">
                              {l.token.campanha}
                            </span>
                          </td>
                          <td className="px-4 py-3.5">
                            {l.analise?.resultado?.tipoPele ? (
                              <span className="rounded-full px-2.5 py-0.5 text-[11px] font-medium"
                                style={{ background: `${skinColor[l.analise.resultado.tipoPele] ?? '#9a7282'}22`, color: skinColor[l.analise.resultado.tipoPele] ?? '#9a7282' }}>
                                {l.analise.resultado.tipoPele}
                              </span>
                            ) : (
                              <span className="text-[#c0a8b4] text-[11px]">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3.5 text-[11px] text-[#b8a0ac]">
                            {new Date(l.createdAt).toLocaleDateString('pt-BR')}
                          </td>
                          <td className="px-4 py-3.5">
                            {l.analise ? (
                              <span className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-600">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Analisada
                              </span>
                            ) : (
                              <span className="flex items-center gap-1.5 text-[11px] font-medium text-amber-500">
                                <span className="h-1.5 w-1.5 rounded-full bg-amber-400" /> Pendente
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3.5" onClick={e => e.stopPropagation()}>
                            <button
                              onClick={() => setConfirmDeleteId(l.id)}
                              className="flex items-center justify-center h-7 w-7 rounded-lg text-[#c4a0b8] hover:bg-red-50 hover:text-red-500 transition-colors"
                              title="Apagar lead">
                              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>
                              </svg>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Pagination */}
            {total > 30 && (
              <div className="flex items-center justify-between text-sm">
                <p className="text-[#9a7282]">{total} leads no total</p>
                <div className="flex items-center gap-2">
                  <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
                    className="btn-ghost rounded-xl px-4 py-2 text-[13px] font-semibold disabled:opacity-40">Anterior</button>
                  <span className="text-[13px] text-[#9a7282]">Página {page} de {Math.ceil(total / 30)}</span>
                  <button disabled={page * 30 >= total} onClick={() => setPage(p => p + 1)}
                    className="btn-ghost rounded-xl px-4 py-2 text-[13px] font-semibold disabled:opacity-40">Próximo</button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── TOKENS TAB ── */}
        {tab === 'tokens' && (
          <div className="space-y-6">
            {/* Create token */}
            <div className="glass rounded-2xl p-6">
              <p className="mb-4 text-[10px] font-semibold uppercase tracking-[0.22em] text-[#b8a0ac]">Novo Link de Campanha</p>
              <form onSubmit={createToken} className="flex flex-col sm:flex-row gap-3">
                <input type="text" placeholder="Nome da campanha (ex: Instagram Mai/2026)" value={newCampanha}
                  onChange={e => setNewCampanha(e.target.value)} required className="field flex-1" />
                <input type="text" placeholder="Slug personalizado (opcional)" value={newSlug}
                  onChange={e => setNewSlug(e.target.value)} className="field flex-1" />
                <button type="submit" disabled={tokenBusy}
                  className="btn-brand rounded-2xl px-6 py-3 text-[13px] font-semibold whitespace-nowrap disabled:opacity-55">
                  {tokenBusy ? 'Criando...' : 'Criar Link'}
                </button>
              </form>
            </div>

            {/* Token list */}
            {tokens.length === 0 ? (
              <div className="glass rounded-3xl p-12 text-center">
                <p className="font-display text-2xl font-light text-[#4a2435]">Nenhuma campanha</p>
                <p className="mt-2 text-sm text-[#9a7282]">Crie seu primeiro link de campanha acima.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {tokens.map(t => {
                  const link = `${baseUrl}?t=${t.slug}`;
                  return (
                    <div key={t.id} className="glass rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center gap-4">
                      <div className="flex-1 min-w-0 space-y-1.5">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-[#4a2435]">{t.campanha}</p>
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${t.ativo ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}>
                            {t.ativo ? 'Ativo' : 'Inativo'}
                          </span>
                          <span className="rounded-full px-2 py-0.5 text-[10px] font-medium bg-[#f3e8f0] text-[#7a3f56]">
                            {t._count.leads} leads
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <code className="text-[11px] text-[#7a5060] bg-[#f3e8f0] rounded-lg px-2 py-0.5 truncate max-w-xs sm:max-w-md">
                            {link}
                          </code>
                          <button onClick={() => navigator.clipboard.writeText(link)}
                            className="text-[11px] text-[#b96f8d] hover:text-[#7a3f56] font-medium transition-colors whitespace-nowrap">
                            Copiar
                          </button>
                        </div>
                        <p className="text-[11px] text-[#b8a0ac]">
                          Criado em {new Date(t.createdAt).toLocaleDateString('pt-BR')}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => toggleToken(t.id, t.ativo)}
                          className={`rounded-xl px-4 py-2 text-[13px] font-semibold whitespace-nowrap transition-all ${t.ativo ? 'btn-ghost' : 'btn-brand'}`}>
                          {t.ativo ? 'Desativar' : 'Ativar'}
                        </button>
                        <button
                          onClick={() => setConfirmDeleteTokenId(t.id)}
                          className="flex items-center justify-center h-9 w-9 rounded-xl text-[#c4a0b8] hover:bg-red-50 hover:text-red-500 transition-colors"
                          title="Apagar campanha">
                          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>
                          </svg>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
        {/* ── CONFIG TAB ── */}
        {tab === 'config' && (
          <div className="space-y-6 max-w-xl">
            <div className="glass rounded-2xl p-6">
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-[#b8a0ac]">Webhook de Notificação</p>
              <p className="mb-5 text-sm text-[#9a7282] leading-relaxed">
                Quando uma análise for concluída, o sistema envia um <code className="bg-[#f3e8f0] text-[#7a3f56] rounded px-1.5 py-0.5 text-[11px]">POST</code> para esta URL com os dados do lead e o diagnóstico de pele.
              </p>
              <form onSubmit={saveSettings} className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8b3f5a]">
                    URL do Webhook
                  </label>
                  <input
                    type="url"
                    placeholder="https://seu-sistema.com/webhook"
                    value={webhookUrl}
                    onChange={e => setWebhookUrl(e.target.value)}
                    className="field w-full"
                  />
                  <p className="mt-1.5 text-[11px] text-[#b8a0ac]">
                    Deixe em branco para desativar. Assine os payloads com <code className="bg-[#f3e8f0] text-[#7a3f56] rounded px-1 py-0.5">WEBHOOK_SECRET</code> nas variáveis de ambiente.
                  </p>
                </div>

                {webhookMsg && (
                  <div className={`flex gap-3 rounded-xl border px-4 py-3 ${webhookMsg.includes('Erro') ? 'border-red-100 bg-red-50/90' : 'border-emerald-100 bg-emerald-50/90'}`}>
                    <p className={`text-sm ${webhookMsg.includes('Erro') ? 'text-red-700' : 'text-emerald-700'}`}>{webhookMsg}</p>
                  </div>
                )}

                <button type="submit" disabled={webhookBusy}
                  className="btn-brand rounded-2xl px-6 py-3 text-[13px] font-semibold disabled:opacity-55">
                  {webhookBusy ? 'Salvando...' : 'Salvar configurações'}
                </button>
              </form>
            </div>

            <div className="glass rounded-2xl p-6">
              <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-[#b8a0ac]">Exemplo de Payload</p>
              <pre className="text-[11px] text-[#7a5060] bg-[#f7f0f3] rounded-xl p-4 overflow-x-auto leading-relaxed">{`{
  "event": "lead.analyzed",
  "timestamp": "2026-05-04T11:00:00Z",
  "data": {
    "lead": {
      "nome": "Maria Silva",
      "email": "maria@email.com",
      "telefone": "(11) 99999-9999",
      "campanha": "Instagram Mai/2026"
    },
    "analise": {
      "tipoPele": "Mista",
      "nivelOleosidade": "Media",
      "nivelAcne": "Leve",
      "recomendacoes": [...]
    }
  }
}`}</pre>
            </div>
          </div>
        )}

      </div>

      {/* ── Delete token confirmation modal ── */}
      {confirmDeleteTokenId && (() => {
        const t = tokens.find(tk => tk.id === confirmDeleteTokenId);
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm px-4">
            <div className="glass rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl">
              <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl"
                style={{ background: 'rgba(239,68,68,.10)', border: '1px solid rgba(239,68,68,.20)' }}>
                <svg className="h-7 w-7 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>
                </svg>
              </div>
              <h2 className="font-display text-xl font-light text-[#4a2435] mb-2">Apagar campanha?</h2>
              <p className="text-sm text-[#9a7282] mb-2 leading-relaxed">
                <strong className="text-[#4a2435]">{t?.campanha}</strong>
              </p>
              {t && t._count.leads > 0 && (
                <p className="text-sm text-red-500 mb-4 leading-relaxed">
                  Atenção: {t._count.leads} lead{t._count.leads > 1 ? 's' : ''} vinculado{t._count.leads > 1 ? 's' : ''} também {t._count.leads > 1 ? 'serão apagados' : 'será apagado'}.
                </p>
              )}
              <p className="text-sm text-[#9a7282] mb-7 leading-relaxed">Esta ação é irreversível.</p>
              <div className="flex gap-3">
                <button
                  onClick={() => setConfirmDeleteTokenId(null)}
                  disabled={deletingToken}
                  className="flex-1 btn-ghost rounded-2xl py-3 text-[13px] font-semibold disabled:opacity-50">
                  Cancelar
                </button>
                <button
                  onClick={deleteToken}
                  disabled={deletingToken}
                  className="flex-1 rounded-2xl py-3 text-[13px] font-semibold text-white transition-all disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg,#dc2626,#ef4444)' }}>
                  {deletingToken ? 'Apagando...' : 'Apagar'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Delete confirmation modal ── */}
      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm px-4">
          <div className="glass rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl">
            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl"
              style={{ background: 'rgba(239,68,68,.10)', border: '1px solid rgba(239,68,68,.20)' }}>
              <svg className="h-7 w-7 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>
              </svg>
            </div>
            <h2 className="font-display text-xl font-light text-[#4a2435] mb-2">Apagar este lead?</h2>
            <p className="text-sm text-[#9a7282] mb-7 leading-relaxed">
              Esta ação é irreversível. O lead e sua análise serão removidos permanentemente.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDeleteId(null)}
                disabled={deleting}
                className="flex-1 btn-ghost rounded-2xl py-3 text-[13px] font-semibold disabled:opacity-50">
                Cancelar
              </button>
              <button
                onClick={deleteLead}
                disabled={deleting}
                className="flex-1 rounded-2xl py-3 text-[13px] font-semibold text-white transition-all disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg,#dc2626,#ef4444)' }}>
                {deleting ? 'Apagando...' : 'Apagar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
