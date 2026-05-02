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
  const [tab, setTab] = useState<'leads' | 'tokens'>('leads');
  const [newCampanha, setNewCampanha] = useState('');
  const [newSlug, setNewSlug] = useState('');
  const [tokenBusy, setTokenBusy] = useState(false);
  const [search, setSearch] = useState('');

  const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;

  const authFetch = useCallback(async (url: string, opts?: RequestInit) => {
    const res = await fetch(url, { ...opts, headers: { ...opts?.headers, Authorization: `Bearer ${token}` } });
    if (res.status === 401) { localStorage.removeItem('access_token'); router.push('/admin'); }
    return res;
  }, [token, router]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [lRes, sRes, tRes] = await Promise.all([
        authFetch(apiUrl(`/admin/leads?page=${page}&limit=30`)),
        authFetch(apiUrl('/admin/stats')),
        authFetch(apiUrl('/admin/tokens')),
      ]);
      const l = await lRes.json() as LeadsResp;
      const s = await sRes.json() as Stats;
      const t = await tRes.json() as Token[];
      setLeads(l.data ?? []);
      setTotal(l.total ?? 0);
      setStats(s);
      setTokens(Array.isArray(t) ? t : []);
    } finally {
      setLoading(false);
    }
  }, [authFetch, page]);

  useEffect(() => { load(); }, [load]);

  const logout = () => { localStorage.removeItem('access_token'); router.push('/admin'); };

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
          {(['leads', 'tokens'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`rounded-xl px-5 py-2 text-[13px] font-semibold transition-all ${tab === t ? 'bg-white shadow-sm text-[#4a2435]' : 'text-[#9a7282] hover:text-[#4a2435]'}`}>
              {t === 'leads' ? `Leads (${total})` : 'Campanhas'}
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
                        {['Nome', 'Email', 'Telefone', 'Campanha', 'Tipo de Pele', 'Data', 'Status'].map(h => (
                          <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.18em] text-[#b8a0ac]">{h}</th>
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
                <div className="flex gap-2">
                  <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
                    className="btn-ghost rounded-xl px-4 py-2 text-[13px] font-semibold disabled:opacity-40">Anterior</button>
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
                      <button onClick={() => toggleToken(t.id, t.ativo)}
                        className={`rounded-xl px-4 py-2 text-[13px] font-semibold whitespace-nowrap transition-all ${t.ativo ? 'btn-ghost' : 'btn-brand'}`}>
                        {t.ativo ? 'Desativar' : 'Ativar'}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
