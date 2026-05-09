'use client';

import { useEffect, useState } from 'react';

export default function ObrigadoPage() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 80);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#f7f0f3] px-6 py-12"
      style={{ opacity: visible ? 1 : 0, transition: 'opacity 0.6s ease' }}>

      {/* Decorative orbs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="float-a absolute -top-24 -right-24 h-80 w-80 rounded-full"
          style={{ background: 'radial-gradient(circle,rgba(192,120,152,.14),transparent 70%)' }} />
        <div className="float-b absolute -bottom-20 -left-20 h-64 w-64 rounded-full"
          style={{ background: 'radial-gradient(circle,rgba(96,64,160,.10),transparent 70%)' }} />
      </div>

      <div className="relative z-10 w-full max-w-md space-y-8 text-center">

        {/* Brand */}
        <div>
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-[#dfc8d4] bg-white shadow-sm">
            <span className="font-display text-sm font-semibold tracking-widest text-[#4a2435]">PE</span>
          </div>
          <p className="text-[9px] font-medium uppercase tracking-[0.38em] text-[#b96f8d]">Patrícia Elias · Skin Intelligence</p>
        </div>

        {/* Success icon */}
        <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full"
          style={{ background: 'linear-gradient(135deg,#4a2435,#b96f8d)', boxShadow: '0 0 60px rgba(192,120,152,.35)' }}>
          <svg className="h-10 w-10 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M20 6 9 17l-5-5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>

        {/* Main message */}
        <div className="space-y-3">
          <h1 className="font-display text-[3rem] font-light text-[#4a2435] leading-none tracking-tight">
            Análise <span style={{ fontStyle: 'italic', color: '#7a3f56' }}>concluída!</span>
          </h1>
          <p className="text-base text-[#7a5060] leading-relaxed">
            Sua análise facial foi processada com sucesso.
          </p>
        </div>

        {/* Info card */}
        <div className="glass rounded-3xl p-8 text-left space-y-5"
          style={{ boxShadow: '0 8px 48px rgba(107,45,69,.12),inset 0 1px 0 rgba(255,255,255,.95)' }}>

          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl"
              style={{ background: 'linear-gradient(135deg,rgba(74,36,53,.08),rgba(192,120,152,.14))', border: '1px solid rgba(192,120,152,.25)' }}>
              <svg className="h-5 w-5 text-[#b96f8d]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>
              </svg>
            </div>
            <div>
              <p className="text-[13px] font-semibold text-[#4a2435]">Protocolo no seu e-mail</p>
              <p className="mt-0.5 text-[13px] text-[#7a5060] leading-relaxed">
                Você receberá em breve seu protocolo completo e personalizado de cuidados com a pele, com produtos recomendados exclusivamente para o seu perfil.
              </p>
            </div>
          </div>

          <div className="h-px bg-[#e8d0db]" />

          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl"
              style={{ background: 'linear-gradient(135deg,rgba(74,36,53,.08),rgba(201,165,117,.18))', border: '1px solid rgba(201,165,117,.30)' }}>
              <svg className="h-5 w-5 text-[#c9a575]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
            </div>
            <div>
              <p className="text-[13px] font-semibold text-[#4a2435]">Diagnóstico exclusivo</p>
              <p className="mt-0.5 text-[13px] text-[#7a5060] leading-relaxed">
                Seu diagnóstico completo, incluindo tipo de pele, métricas e recomendações, será enviado diretamente para você.
              </p>
            </div>
          </div>
        </div>

        {/* CTA hint */}
        <p className="text-[12px] text-[#b8a0ac] leading-relaxed">
          Verifique sua caixa de entrada e a pasta de spam.<br />
          Em caso de dúvidas, entre em contato com Patrícia Elias.
        </p>

      </div>
    </div>
  );
}
