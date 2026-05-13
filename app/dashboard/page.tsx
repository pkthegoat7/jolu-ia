'use client';

// This page is kept for backwards compatibility.
// The admin dashboard is now at /admin/dashboard.

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

type Produto = { nome: string; motivo: string; modoDeUso: string; };
type ResultadoIA = {
  status: string; tipoPele: string; nivelOleosidade: string;
  nivelAcne: string; nivelSensibilidade: string;
  observacoes?: string; recomendacoes: Produto[];
};
type Analise = { id: string; imageUrl: string; resultado?: ResultadoIA; usuario?: { name: string }; };

const LEVEL_PCT: Record<string, number> = { Baixa:14, Leve:30, Media:52, Moderada:70, Alta:86, Severa:100 };
const HEALTH:    Record<string, number> = { Baixa:92, Leve:78, Media:58, Moderada:40, Alta:24, Severa:10  };

const LC: Record<string, { bar:string; bg:string; border:string; text:string; label:string }> = {
  Baixa:    { bar:'#34d399', bg:'#ecfdf5', border:'#a7f3d0', text:'#065f46', label:'Baixa' },
  Leve:     { bar:'#38bdf8', bg:'#f0f9ff', border:'#7dd3fc', text:'#075985', label:'Leve'  },
  Media:    { bar:'#fbbf24', bg:'#fffbeb', border:'#fcd34d', text:'#92400e', label:'Média'  },
  Moderada: { bar:'#fb923c', bg:'#fff7ed', border:'#fdba74', text:'#9a3412', label:'Moderada' },
  Alta:     { bar:'#f87171', bg:'#fef2f2', border:'#fca5a5', text:'#991b1b', label:'Alta'  },
  Severa:   { bar:'#ef4444', bg:'#fef2f2', border:'#fca5a5', text:'#7f1d1d', label:'Severa' },
};

const SKIN_TAG: Record<string, { bg:string; border:string; text:string }> = {
  Oleosa:          { bg:'#fff7ed', border:'#fdba74', text:'#9a3412' },
  Mista:           { bg:'#fffbeb', border:'#fcd34d', text:'#78350f' },
  'Seca/Sensivel': { bg:'#f0f9ff', border:'#7dd3fc', text:'#0c4a6e' },
};

function ScoreRing({ score }: { score: number }) {
  const r = 38; const c = 2 * Math.PI * r;
  const fill = (score / 100) * c;
  const color = score >= 75 ? '#34d399' : score >= 50 ? '#fbbf24' : score >= 30 ? '#fb923c' : '#f87171';
  const label = score >= 75 ? 'Ótima' : score >= 50 ? 'Boa' : score >= 30 ? 'Regular' : 'Atenção';
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative h-24 w-24">
        <svg className="-rotate-90 h-full w-full" viewBox="0 0 84 84">
          <circle cx="42" cy="42" r={r} fill="none" stroke="rgba(255,255,255,.15)" strokeWidth="6" />
          <circle cx="42" cy="42" r={r} fill="none" stroke={color} strokeWidth="6"
            strokeLinecap="round" strokeDasharray={`${fill} ${c}`}
            style={{ transition:'stroke-dasharray 1.4s cubic-bezier(.4,0,.2,1)', filter:`drop-shadow(0 0 6px ${color}60)` }} />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[26px] font-bold leading-none text-white">{score}</span>
          <span className="text-[9px] font-medium uppercase tracking-wider text-white/45">/100</span>
        </div>
      </div>
      <div className="text-center">
        <p className="text-[11px] font-semibold text-white/60 uppercase tracking-wider">Saúde Geral</p>
        <p className="text-[13px] font-bold" style={{ color }}>{label}</p>
      </div>
    </div>
  );
}

function MetricCard({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  const C = LC[value] ?? LC['Media'];
  const pct = LEVEL_PCT[value] ?? 50;
  return (
    <div className="glass rounded-2xl overflow-hidden">
      <div className="h-1 w-full" style={{ background: C.bar, opacity:.85 }} />
      <div className="p-4">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-[#5A7299]">{icon}</span>
          <span className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
            style={{ background: C.bg, border:`1px solid ${C.border}`, color: C.text }}>
            {C.label}
          </span>
        </div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#5A7299]">{label}</p>
        <div className="mt-2.5 h-1.5 w-full rounded-full" style={{ background:'#ead9e0' }}>
          <div className="h-full rounded-full" style={{ width:`${pct}%`, background:C.bar, transition:'width 1.2s cubic-bezier(.4,0,.2,1)' }} />
        </div>
      </div>
    </div>
  );
}

const MetricIcons = {
  oil: <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2z"/><path d="M12 6v6l4 2"/></svg>,
  acne: <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/></svg>,
  sens: <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>,
};

export default function DashboardPage() {
  const router = useRouter();
  const [analise, setAnalise] = useState<Analise | null>(null);

  useEffect(() => {
    const raw = localStorage.getItem('ultima_analise');
    if (raw) { try { setAnalise(JSON.parse(raw) as Analise); } catch { /**/ } }
  }, []);

  const ia = analise?.resultado;
  const score = ia
    ? Math.round((HEALTH[ia.nivelOleosidade] + HEALTH[ia.nivelAcne] + HEALTH[ia.nivelSensibilidade]) / 3)
    : null;
  const skinTag = ia ? SKIN_TAG[ia.tipoPele] : null;

  return (
    <div className="min-h-screen flex flex-col bg-[#F2F5FA]">

      {/* ── Header ── */}
      <header className="flex items-center justify-between px-7 py-4 border-b border-[#DDE5F0]/60 bg-white/60 backdrop-blur-md sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full border border-[#C4D2E4] bg-white shadow-sm">
            <span className="font-display text-[11px] font-semibold tracking-widest text-[#072C57]">PE</span>
          </div>
          <div className="leading-none">
            <p className="text-[9px] font-medium uppercase tracking-[0.38em] text-[#0C417D]">Patrícia Elias</p>
            <p className="text-xs font-semibold text-[#072C57]">Skin Intelligence</p>
          </div>
        </div>
        <button onClick={() => router.push('/')}
          className="btn-ghost flex items-center gap-2 rounded-xl px-4 py-2 text-[13px] font-semibold">
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="M19 12H5M12 5l-7 7 7 7"/>
          </svg>
          Novo Scan
        </button>
      </header>

      {!analise ? (
        /* ── Empty state ── */
        <div className="flex flex-1 items-center justify-center p-8">
          <div className="fu glass rounded-3xl p-14 text-center max-w-sm w-full">
            <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl border border-[#C4D2E4]"
              style={{ background:'linear-gradient(135deg,rgba(185,111,141,.08),rgba(122,63,86,.14))' }}>
              <svg className="h-10 w-10 text-[#0C417D]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4">
                <path d="M9 12h6M9 16h6M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2z"/>
              </svg>
            </div>
            <p className="font-display text-3xl font-light text-[#072C57] mb-2">Sem análise</p>
            <p className="text-sm text-[#5A7299] mb-8 leading-relaxed">
              Faça seu primeiro scan para receber seu diagnóstico personalizado de pele.
            </p>
            <button onClick={() => router.push('/')} className="btn-brand w-full rounded-2xl py-3.5 text-sm font-semibold">
              Iniciar Scan →
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* ── HERO: dark gradient section ── */}
          <div className="relative overflow-hidden"
            style={{ background:'linear-gradient(145deg,#190a11 0%,#3d1b2c 40%,#6b3350 75%,#9c6070 100%)' }}>

            {/* Decorative rings */}
            <div className="pointer-events-none absolute -top-20 -right-20 h-80 w-80 rounded-full"
              style={{ border:'1px solid rgba(255,255,255,.05)' }} />
            <div className="pointer-events-none absolute top-8 right-8 h-48 w-48 rounded-full"
              style={{ border:'1px solid rgba(255,255,255,.07)' }} />
            <div className="pointer-events-none absolute -bottom-10 -left-10 h-48 w-48 rounded-full"
              style={{ border:'1px solid rgba(255,255,255,.05)' }} />
            {/* Glow blob */}
            <div className="pointer-events-none absolute right-0 top-0 h-full w-1/2"
              style={{ background:'radial-gradient(ellipse 70% 80% at 90% 40%, rgba(192,120,152,.18), transparent)' }} />

            <div className="relative z-10 px-7 py-8 max-w-2xl mx-auto">
              {/* Top row */}
              <div className="flex flex-col sm:flex-row gap-6 items-center sm:items-start">

                {/* Photo */}
                <div className="relative flex-shrink-0">
                  <div className="h-28 w-28 overflow-hidden rounded-full"
                    style={{ border:'3px solid rgba(255,255,255,.20)', boxShadow:'0 0 40px rgba(192,120,152,.25)' }}>
                    <img src={analise.imageUrl} alt="Análise" className="h-full w-full object-cover" />
                  </div>
                  {/* Status dot */}
                  <div className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500 shadow-lg">
                    <svg className="h-4 w-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M20 6 9 17l-5-5"/>
                    </svg>
                  </div>
                </div>

                {/* Text */}
                <div className="flex-1 text-center sm:text-left space-y-2">
                  {analise.usuario?.name && (
                    <p className="text-[10px] uppercase tracking-[0.3em] text-white/40">
                      Análise de <span className="text-white/65">{analise.usuario.name}</span>
                    </p>
                  )}

                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                    <h1 className="font-display text-4xl sm:text-5xl font-light text-white leading-none">
                      {ia?.tipoPele ?? 'Resultado'}
                    </h1>
                    {ia && skinTag && (
                      <span className="rounded-full px-3 py-1 text-[12px] font-semibold"
                        style={{ background: skinTag.bg, border:`1px solid ${skinTag.border}`, color: skinTag.text }}>
                        {ia.tipoPele}
                      </span>
                    )}
                  </div>

                  {ia?.observacoes && !ia.observacoes.includes('fallback') && (
                    <p className="text-[13px] italic text-white/55 leading-relaxed max-w-sm" style={{ borderLeft:'2px solid rgba(192,120,152,.4)', paddingLeft:'12px' }}>
                      "{ia.observacoes}"
                    </p>
                  )}

                  <div className="pt-1">
                    <span className="rounded-full px-2.5 py-0.5 text-[10px] font-medium"
                      style={{ background:'rgba(255,255,255,.08)', border:'1px solid rgba(255,255,255,.12)', color:'rgba(255,255,255,.55)' }}>
                      Patrícia Elias
                    </span>
                  </div>
                </div>

                {/* Score ring */}
                {score !== null && (
                  <div className="flex-shrink-0">
                    <ScoreRing score={score} />
                  </div>
                )}
              </div>
            </div>

            {/* Bottom fade */}
            <div className="h-6 w-full"
              style={{ background:'linear-gradient(to bottom, transparent, #F2F5FA)' }} />
          </div>

          {/* ── Content ── */}
          <div className="px-4 sm:px-6 pb-10 max-w-2xl mx-auto w-full space-y-5 pt-2">

            {/* Metrics grid */}
            {ia && (
              <div className="fu1">
                <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.26em] text-[#8AA2C2]">Métricas da Pele</p>
                <div className="grid grid-cols-3 gap-3">
                  <MetricCard label="Oleosidade"  value={ia.nivelOleosidade} icon={MetricIcons.oil}  />
                  <MetricCard label="Acne"        value={ia.nivelAcne}       icon={MetricIcons.acne} />
                  <MetricCard label="Sensibilidade" value={ia.nivelSensibilidade} icon={MetricIcons.sens} />
                </div>
              </div>
            )}

            {/* Products */}
            {ia?.recomendacoes && ia.recomendacoes.length > 0 && (
              <div className="fu2">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.26em] text-[#8AA2C2]">Produtos Recomendados</p>
                  <span className="text-[11px] text-[#8AA2C2]">{ia.recomendacoes.length} itens</span>
                </div>
                <div className="space-y-3">
                  {ia.recomendacoes.map((p, i) => (
                    <div key={p.nome} className="card-lift glass rounded-2xl overflow-hidden">
                      {/* Left accent bar */}
                      <div className="flex">
                        <div className="w-1 flex-shrink-0" style={{ background:'linear-gradient(to bottom, #0C417D, #3D6BA3)' }} />
                        <div className="flex-1 p-5">
                          <div className="flex items-start gap-4">
                            <div className="flex-shrink-0 flex h-10 w-10 items-center justify-center rounded-xl text-[11px] font-bold text-white"
                              style={{ background:'linear-gradient(135deg,#072C57,#0C417D)' }}>
                              {String(i + 1).padStart(2, '0')}
                            </div>
                            <div className="flex-1 min-w-0 space-y-1.5">
                              <p className="text-[13px] font-semibold text-[#072C57] leading-snug">{p.nome}</p>
                              <p className="text-[12px] text-[#7a5060] leading-relaxed">{p.motivo}</p>
                              <div className="flex gap-1.5 items-start">
                                <span className="text-[#0C417D] font-bold text-sm leading-[1.5]">›</span>
                                <p className="text-[12px] text-[#5A7299] leading-relaxed">
                                  <span className="font-semibold text-[#7a5060]">Modo de uso:</span> {p.modoDeUso}
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* CTA */}
            <div className="fu3 pt-2 pb-4">
              <button onClick={() => router.push('/')}
                className="btn-brand w-full rounded-2xl py-4 text-sm font-semibold tracking-wide">
                Fazer Nova Análise →
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
