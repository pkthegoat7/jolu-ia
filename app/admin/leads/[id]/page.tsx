'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { apiUrl } from '@/lib/api';

type Produto  = { nome: string; motivo: string; modoDeUso: string };
type Resultado = {
  tipoPele: string; nivelOleosidade: string; nivelAcne: string;
  nivelSensibilidade: string; observacoes?: string; recomendacoes: Produto[];
  modoFallback?: boolean;
};
type Lead = {
  id: string; nome: string; email: string; telefone: string;
  desejaMelhorar: string; createdAt: string;
  token: { campanha: string; slug: string };
  analise: {
    id: string; imageUrl: string; emailEnviado: boolean;
    createdAt: string; resultado: Resultado;
  } | null;
};

const LEVEL_PCT: Record<string, number> = { Baixa: 14, Leve: 30, Media: 52, Moderada: 70, Alta: 86, Severa: 100 };
const LC: Record<string, { bar: string; bg: string; border: string; text: string; label: string }> = {
  Baixa:    { bar: '#34d399', bg: '#ecfdf5', border: '#a7f3d0', text: '#065f46', label: 'Baixa' },
  Leve:     { bar: '#38bdf8', bg: '#f0f9ff', border: '#7dd3fc', text: '#075985', label: 'Leve' },
  Media:    { bar: '#fbbf24', bg: '#fffbeb', border: '#fcd34d', text: '#92400e', label: 'Média' },
  Moderada: { bar: '#fb923c', bg: '#fff7ed', border: '#fdba74', text: '#9a3412', label: 'Moderada' },
  Alta:     { bar: '#f87171', bg: '#fef2f2', border: '#fca5a5', text: '#991b1b', label: 'Alta' },
  Severa:   { bar: '#ef4444', bg: '#fef2f2', border: '#fca5a5', text: '#7f1d1d', label: 'Severa' },
};

function MetricBar({ label, value }: { label: string; value: string }) {
  const C = LC[value] ?? LC['Media'];
  const pct = LEVEL_PCT[value] ?? 50;
  return (
    <div className="glass rounded-2xl p-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#5A7299]">{label}</p>
        <span className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
          style={{ background: C.bg, border: `1px solid ${C.border}`, color: C.text }}>{C.label}</span>
      </div>
      <div className="h-1.5 w-full rounded-full" style={{ background: '#ead9e0' }}>
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: C.bar }} />
      </div>
    </div>
  );
}

export default function LeadDetailPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [lead, setLead] = useState<Lead | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(apiUrl(`/admin/leads/${id}`), { credentials: 'include' })
      .then(async r => {
        if (r.status === 401) { router.push('/admin'); return; }
        const d = await r.json() as Lead;
        setLead(d);
      })
      .finally(() => setLoading(false));
  }, [id, router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F2F5FA]">
        <div className="h-8 w-8 rounded-full border-2 border-[#0C417D]/30 border-t-[#0C417D] animate-spin" />
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F2F5FA]">
        <div className="glass rounded-3xl p-12 text-center">
          <p className="font-display text-2xl font-light text-[#072C57]">Lead não encontrado</p>
          <button onClick={() => router.push('/admin/dashboard')} className="btn-brand mt-6 rounded-2xl px-8 py-3 text-sm font-semibold">
            Voltar
          </button>
        </div>
      </div>
    );
  }

  const ia = lead.analise?.resultado;

  return (
    <div className="min-h-screen bg-[#F2F5FA]">
      <header className="sticky top-0 z-20 flex items-center justify-between px-6 py-4 border-b border-[#DDE5F0]/60 bg-white/70 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/admin/dashboard')}
            className="btn-ghost flex items-center gap-2 rounded-xl px-3 py-2 text-[13px] font-semibold">
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M19 12H5M12 5l-7 7 7 7"/>
            </svg>
            Voltar
          </button>
          <div className="h-5 w-px bg-[#C4D2E4]" />
          <p className="text-sm font-semibold text-[#072C57]">Relatório: {lead.nome}</p>
        </div>
        <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#8AA2C2]">
          {new Date(lead.createdAt).toLocaleString('pt-BR')}
        </span>
      </header>

      <div className="mx-auto max-w-3xl px-4 sm:px-6 py-8 space-y-6">

        {/* Contact card */}
        <div className="glass rounded-2xl p-6 space-y-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#8AA2C2]">Dados do Lead</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { label: 'Nome', value: lead.nome },
              { label: 'Email', value: lead.email },
              { label: 'Telefone', value: lead.telefone },
              { label: 'Campanha', value: lead.token.campanha },
            ].map(f => (
              <div key={f.label}>
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8AA2C2]">{f.label}</p>
                <p className="mt-0.5 text-sm font-medium text-[#072C57]">{f.value}</p>
              </div>
            ))}
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8AA2C2]">Deseja Melhorar</p>
            <p className="mt-0.5 text-sm text-[#7a5060] italic">"{lead.desejaMelhorar}"</p>
          </div>
        </div>

        {!lead.analise ? (
          <div className="glass rounded-2xl p-10 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl"
              style={{ background: 'rgba(251,191,36,.10)', border: '1px solid rgba(251,191,36,.25)' }}>
              <svg className="h-7 w-7 text-amber-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>
              </svg>
            </div>
            <p className="font-display text-xl font-light text-[#072C57]">Análise pendente</p>
            <p className="mt-1 text-sm text-[#5A7299]">Este lead ainda não passou pelo escaneamento facial.</p>
          </div>
        ) : (
          <>
            {/* Hero with photo + skin type */}
            <div className="relative overflow-hidden rounded-2xl"
              style={{ background: 'linear-gradient(145deg,#190a11 0%,#3d1b2c 40%,#6b3350 75%,#9c6070 100%)' }}>
              <div className="relative z-10 p-6 flex flex-col sm:flex-row gap-6 items-center sm:items-start">
                <div className="h-24 w-24 overflow-hidden rounded-full flex-shrink-0"
                  style={{ border: '3px solid rgba(255,255,255,.20)', boxShadow: '0 0 40px rgba(192,120,152,.25)' }}>
                  <img src={lead.analise.imageUrl} alt={lead.nome} className="h-full w-full object-cover" />
                </div>
                <div className="text-center sm:text-left">
                  <p className="text-[10px] uppercase tracking-[0.3em] text-white/40">Tipo de Pele</p>
                  <h2 className="font-display text-4xl font-light text-white leading-none mt-1">{ia?.tipoPele}</h2>
                  {ia?.modoFallback && (
                    <p className="mt-2 rounded-lg px-3 py-1.5 text-[11px] font-medium bg-amber-500/20 text-amber-300 inline-block">
                      ⚠ Análise estimada — IA indisponível no momento da captura
                    </p>
                  )}
                  {ia?.observacoes && !ia.modoFallback && (
                    <p className="mt-2 text-[13px] italic text-white/55 leading-relaxed max-w-sm"
                      style={{ borderLeft: '2px solid rgba(192,120,152,.4)', paddingLeft: '12px' }}>
                      "{ia.observacoes}"
                    </p>
                  )}
                  <div className="mt-3 flex items-center gap-3 flex-wrap justify-center sm:justify-start">
                    <span className={`rounded-full px-3 py-1 text-[11px] font-medium ${lead.analise.emailEnviado ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'}`}>
                      {lead.analise.emailEnviado ? '✓ Email enviado' : '⏳ Email pendente'}
                    </span>
                    <span className="text-[11px] text-white/30">
                      Analisado em {new Date(lead.analise.createdAt).toLocaleString('pt-BR')}
                    </span>
                  </div>
                </div>
              </div>
              <div className="h-6 w-full" style={{ background: 'linear-gradient(to bottom, transparent, #F2F5FA)' }} />
            </div>

            {/* Metrics */}
            {ia && (
              <div>
                <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.26em] text-[#8AA2C2]">Métricas da Pele</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <MetricBar label="Oleosidade"    value={ia.nivelOleosidade}     />
                  <MetricBar label="Acne"           value={ia.nivelAcne}           />
                  <MetricBar label="Sensibilidade"  value={ia.nivelSensibilidade}  />
                </div>
              </div>
            )}

            {/* Products */}
            {ia?.recomendacoes && ia.recomendacoes.length > 0 && (
              <div>
                <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.26em] text-[#8AA2C2]">Protocolo Recomendado</p>
                <div className="space-y-3">
                  {ia.recomendacoes.map((p, i) => (
                    <div key={p.nome} className="glass rounded-2xl overflow-hidden">
                      <div className="flex">
                        <div className="w-1 flex-shrink-0" style={{ background: 'linear-gradient(to bottom,#0C417D,#3D6BA3)' }} />
                        <div className="flex-1 p-5">
                          <div className="flex items-start gap-4">
                            <div className="flex-shrink-0 flex h-9 w-9 items-center justify-center rounded-xl text-[11px] font-bold text-white"
                              style={{ background: 'linear-gradient(135deg,#072C57,#0C417D)' }}>
                              {String(i + 1).padStart(2, '0')}
                            </div>
                            <div className="flex-1 space-y-1">
                              <p className="text-[13px] font-semibold text-[#072C57]">{p.nome}</p>
                              <p className="text-[12px] text-[#7a5060]">{p.motivo}</p>
                              <p className="text-[12px] text-[#5A7299]">
                                <span className="font-semibold text-[#7a5060]">Uso:</span> {p.modoDeUso}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
