'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiUrl } from '@/lib/api';

const Ic = {
  Mail: () => <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>,
  Lock: () => <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V8a4 4 0 1 1 8 0v3"/></svg>,
};

function Field({ id, label, type, ph, val, set, Icon }: {
  id: string; label: string; type: string; ph: string;
  val: string; set: (v: string) => void; Icon: () => React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.14em] text-[#0C417D]">{label}</label>
      <div className="relative">
        <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8AA2C2]"><Icon /></span>
        <input id={id} type={type} placeholder={ph} value={val} required className="field" onChange={e => set(e.target.value)} />
      </div>
    </div>
  );
}

export default function AdminLoginPage() {
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const r = await fetch(apiUrl('/auth/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: pass }),
        credentials: 'include',
      });
      const d = await r.json() as { message?: string };
      if (r.ok) {
        router.push('/admin/dashboard');
      } else {
        setError(d.message ?? 'Credenciais inválidas.');
      }
    } catch {
      setError('Erro ao conectar com o servidor.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen">
      {/* ── Left brand panel ── */}
      <div className="hidden lg:flex lg:w-[48%] flex-col relative overflow-hidden" style={{ background: '#0c0610' }}>
        <div className="absolute inset-0"
          style={{ background: 'linear-gradient(145deg,#0c0610 0%,#220d1a 30%,#4a1f35 58%,#7a3850 80%,#a0607a 100%)' }} />
        <div className="aurora-shift orb float-a"
          style={{ width: 500, height: 500, top: '-10%', right: '-15%', background: 'radial-gradient(circle,rgba(192,64,106,.35) 0%,rgba(107,45,69,.15) 50%,transparent 70%)' }} />
        <div className="orb float-b"
          style={{ width: 380, height: 380, bottom: '-5%', left: '-10%', background: 'radial-gradient(circle,rgba(96,64,160,.30) 0%,rgba(64,32,100,.12) 50%,transparent 70%)' }} />
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="rotate-slow absolute"
            style={{ width: 640, height: 640, top: '-12%', right: '-18%', borderRadius: '100%', border: '1px dashed rgba(255,255,255,.05)' }} />
          <div className="rotate-rev absolute"
            style={{ width: 460, height: 460, top: '5%', right: '-8%', borderRadius: '100%', border: '1px solid rgba(255,255,255,.08)' }} />
          <div className="absolute flex items-center justify-center"
            style={{ width: 62, height: 62, top: 'calc(32% + 59px)', right: 'calc(18% + 59px)', borderRadius: '100%', border: '1.5px solid rgba(255,255,255,.28)', background: 'rgba(255,255,255,.07)', backdropFilter: 'blur(8px)' }}>
            <span className="font-display text-lg font-light tracking-[0.22em] text-white/85">PE</span>
          </div>
          <span className="font-display absolute select-none text-[180px] font-light leading-none tracking-tighter text-white/[0.025]"
            style={{ bottom: '-20px', left: '10px' }}>ADMIN</span>
        </div>
        <div className="absolute inset-0" style={{ background: 'linear-gradient(to right,rgba(12,6,16,.40) 0%,transparent 60%)' }} />
        <div className="relative z-10 flex h-full flex-col justify-between p-12 xl:p-14">
          <div>
            <p className="text-[9px] uppercase tracking-[0.45em] text-white/35 mb-1">Patrícia Elias</p>
            <p className="text-sm font-medium tracking-wider text-white/55">Painel Administrativo</p>
          </div>
          <div className="space-y-5">
            <h2 className="font-display leading-[1.06] tracking-tight"
              style={{ fontSize: '3.4rem', fontWeight: 300, background: 'linear-gradient(135deg,#ffffff 0%,#e8d0dc 40%,#c9a575 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Gestão de<br />leads e<br /><em style={{ fontStyle: 'italic', fontWeight: 400 }}>relatórios.</em>
            </h2>
            <p className="text-sm text-white/40 leading-relaxed max-w-[270px]">
              Acompanhe cada pessoa capturada, visualize análises completas e gerencie suas campanhas.
            </p>
          </div>
          <div className="space-y-3.5">
            {[
              { dot: '#c9a575', text: 'Relatório completo de cada lead' },
              { dot: '#3D6BA3', text: 'Diagnóstico detalhado da pele' },
              { dot: '#9080c0', text: 'Gestão de links de campanha' },
            ].map(f => (
              <div key={f.text} className="flex items-center gap-3">
                <div className="h-1.5 w-1.5 rounded-full flex-shrink-0" style={{ background: f.dot, boxShadow: `0 0 6px ${f.dot}` }} />
                <span className="text-[13px] text-white/48">{f.text}</span>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-white/20">© {new Date().getFullYear()} Patrícia Elias · Acesso restrito</p>
        </div>
      </div>

      {/* ── Right form panel ── */}
      <div className="relative flex flex-1 items-center justify-center overflow-hidden px-6 py-14">
        <div className="absolute inset-0 aurora-light" />
        <div className="absolute inset-0 dot-grid opacity-60" />
        <div className="orb float-b absolute"
          style={{ width: 400, height: 400, top: '-10%', right: '-15%', background: 'radial-gradient(circle,rgba(192,120,152,.12),transparent 65%)' }} />

        <div className="relative z-10 w-full max-w-[390px] space-y-7">
          <div className="lg:hidden mb-5">
            <p className="text-[10px] uppercase tracking-[0.52em] text-[#0C417D] mb-1">Patrícia Elias</p>
            <p className="font-display text-[2rem] font-light text-[#072C57] leading-none">Painel Admin</p>
          </div>

          <div className="fu">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full px-4 py-1.5"
              style={{ background: 'linear-gradient(135deg,rgba(74,36,53,.07),rgba(192,120,152,.11))', border: '1px solid rgba(192,120,152,.28)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,.65),0 2px 8px rgba(107,45,69,.08)' }}>
              <div className="h-1.5 w-1.5 rounded-full" style={{ background: 'linear-gradient(135deg,#c9a575,#3D6BA3)', boxShadow: '0 0 5px rgba(201,165,117,.55)' }} />
              <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#0C417D]">Acesso Administrativo</span>
            </div>
            <h1 className="font-display text-[2.6rem] font-light leading-tight text-[#072C57]">Bem-vindo<br />de volta.</h1>
            <p className="mt-2 text-sm text-[#5A7299]">Entre para acessar o painel de gestão de leads.</p>
          </div>

          <div className="fu1 glass rounded-3xl p-8"
            style={{ boxShadow: '0 8px 48px rgba(107,45,69,.14),0 2px 8px rgba(74,36,53,.06),inset 0 1px 0 rgba(255,255,255,.95)' }}>
            <form onSubmit={submit} className="space-y-4">
              <Field id="email" label="E-mail" type="email" ph="admin@exemplo.com" val={email} set={setEmail} Icon={Ic.Mail} />
              <Field id="pass" label="Senha" type="password" ph="Sua senha" val={pass} set={setPass} Icon={Ic.Lock} />

              {error && (
                <div className="flex gap-3 rounded-xl border border-red-100 bg-red-50/90 px-4 py-3">
                  <span className="mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">!</span>
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              <button type="submit" disabled={busy}
                className="btn-brand mt-1 w-full rounded-2xl py-4 text-sm font-semibold tracking-wide disabled:opacity-55">
                {busy
                  ? <span className="flex items-center justify-center gap-2.5"><span className="h-4 w-4 rounded-full border-2 border-white/25 border-t-white animate-spin" />Processando...</span>
                  : 'Entrar no Painel'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
