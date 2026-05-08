'use client';

import { useState, useRef, useCallback, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiUrl } from '@/lib/api';
import { useFaceMesh } from '@/hooks/useFaceMesh';

// ── Corner Brackets ──────────────────────────────────────────────────
function CornerBrackets({ lit }: { lit: boolean }) {
  const c = lit ? 'border-[#c07898]/90' : 'border-white/18';
  const s = `absolute w-5 h-5 transition-all duration-700 ${c}`;
  return (
    <>
      <div className={`${s} top-3 left-3 border-t-[1.5px] border-l-[1.5px]`} />
      <div className={`${s} top-3 right-3 border-t-[1.5px] border-r-[1.5px]`} />
      <div className={`${s} bottom-3 left-3 border-b-[1.5px] border-l-[1.5px]`} />
      <div className={`${s} bottom-3 right-3 border-b-[1.5px] border-r-[1.5px]`} />
    </>
  );
}

// ── Icon helpers ──────────────────────────────────────────────────────
const Ic = {
  User:  () => <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M20 21a8 8 0 1 0-16 0"/><circle cx="12" cy="7" r="4"/></svg>,
  Mail:  () => <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>,
  Phone: () => <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.38 2 2 0 0 1 3.58 1h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 8.91a16 16 0 0 0 6 6l.71-.71a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>,
  Sparkle: () => <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z"/></svg>,
};

function Field({ id, label, type, ph, val, set, Icon, textarea }: {
  id: string; label: string; type: string; ph: string;
  val: string; set: (v: string) => void; Icon: () => React.ReactNode; textarea?: boolean;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8b3f5a]">{label}</label>
      <div className="relative">
        <span className="pointer-events-none absolute left-3.5 top-3.5 text-[#c4a0b8]"><Icon /></span>
        {textarea ? (
          <textarea id={id} placeholder={ph} value={val} required rows={3}
            className="field resize-none pt-3 pb-3" onChange={e => set(e.target.value)} />
        ) : (
          <input id={id} type={type} placeholder={ph} value={val} required
            className="field" onChange={e => set(e.target.value)} />
        )}
      </div>
    </div>
  );
}

// ── Main component (inner) ────────────────────────────────────────────
function AnalisePage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const tokenSlug = searchParams.get('t') ?? '';

  const [step, setStep] = useState<'validating' | 'invalid' | 'form' | 'scan' | 'processing'>('validating');
  const [campanha, setCampanha] = useState('');
  const [leadId, setLeadId] = useState('');
  const [analysisToken, setAnalysisToken] = useState('');
  const [error, setError] = useState('');

  // Form fields
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [telefone, setTelefone] = useState('');
  const [desejos, setDesejos] = useState('');
  const [formBusy, setFormBusy] = useState(false);

  // Camera
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [camOn, setCamOn] = useState(false);
  const [faceDet, setFaceDet] = useState(false);
  const [meshReady, setMeshReady] = useState(false);
  const [scanStatus, setScanStatus] = useState('');

  const onFace = useCallback((d: boolean) => setFaceDet(d), []);
  const { start: startMesh, stop: stopMesh, getLandmarks } = useFaceMesh(videoRef, canvasRef, onFace);

  // ── Validate token on mount ──────────────────────────────────────
  useEffect(() => {
    if (!tokenSlug) { setStep('invalid'); return; }
    fetch(apiUrl(`/leads/validate-token?slug=${encodeURIComponent(tokenSlug)}`))
      .then(r => r.json())
      .then((d: { valid: boolean; campanha?: string }) => {
        if (d.valid) { setCampanha(d.campanha ?? ''); setStep('form'); }
        else setStep('invalid');
      })
      .catch(() => setStep('invalid'));
  }, [tokenSlug]);

  // ── Submit lead form ──────────────────────────────────────────────
  const submitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!nome.trim() || !email.trim() || !telefone.trim() || !desejos.trim()) {
      setError('Preencha todos os campos.');
      return;
    }
    setFormBusy(true);
    try {
      const res = await fetch(apiUrl('/leads'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome, email, telefone, desejaMelhorar: desejos, tokenSlug }),
      });
      const data = await res.json() as { id?: string; nome?: string; analysisToken?: string; message?: string };
      if (!res.ok) { setError(data.message ?? 'Erro ao registrar.'); return; }
      setLeadId(data.id!);
      setAnalysisToken(data.analysisToken ?? '');
      setStep('scan');
    } catch {
      setError('Erro ao conectar. Tente novamente.');
    } finally {
      setFormBusy(false);
    }
  };

  // ── Camera helpers ────────────────────────────────────────────────
  const startVideo = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setCamOn(true);
        setScanStatus('Carregando Face Mesh...');
        await startMesh();
        setMeshReady(true);
        setScanStatus('Posicione seu rosto no centro e clique em Analisar.');
      }
    } catch {
      setScanStatus('Erro ao acessar câmera. Verifique as permissões.');
    }
  };

  const analisar = async () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) { setScanStatus('Câmera não detectada.'); return; }
    setStep('processing');
    stopMesh();

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) { setStep('scan'); return; }
    ctx.drawImage(video, 0, 0);

    canvas.toBlob(async (blob) => {
      if (!blob) { setStep('scan'); return; }
      const fd = new FormData();
      fd.append('image', blob, 'scan.jpg');
      fd.append('analysisToken', analysisToken);
      const lm = getLandmarks();
      if (lm) fd.append('landmarks', JSON.stringify(lm));
      try {
        const res = await fetch(apiUrl(`/leads/${leadId}/analise`), { method: 'POST', body: fd });
        if (res.ok) {
          router.push('/obrigado');
        } else {
          setStep('scan');
          setScanStatus('Erro na análise. Tente novamente.');
          startMesh();
        }
      } catch {
        setStep('scan');
        setScanStatus('Erro ao conectar. Tente novamente.');
        startMesh();
      }
    }, 'image/jpeg', 0.9);
  };

  // ── Render: validating ────────────────────────────────────────────
  if (step === 'validating') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f7f0f3]">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 rounded-full border-2 border-[#b96f8d]/30 border-t-[#b96f8d] animate-spin" />
          <p className="text-sm text-[#9a7282]">Verificando link...</p>
        </div>
      </div>
    );
  }

  // ── Render: invalid link ──────────────────────────────────────────
  if (step === 'invalid') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f7f0f3] p-6">
        <div className="glass rounded-3xl p-12 text-center max-w-sm w-full">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl"
            style={{ background: 'linear-gradient(135deg,rgba(220,80,80,.10),rgba(180,60,60,.16))', border: '1px solid rgba(220,80,80,.25)' }}>
            <svg className="h-8 w-8 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="12" cy="12" r="10"/><path d="m15 9-6 6M9 9l6 6"/>
            </svg>
          </div>
          <p className="font-display text-2xl font-light text-[#4a2435] mb-2">Link inválido</p>
          <p className="text-sm text-[#9a7282] leading-relaxed">
            Este link de análise não é válido ou já expirou. Solicite um novo link.
          </p>
        </div>
      </div>
    );
  }

  // ── Render: form ─────────────────────────────────────────────────
  if (step === 'form') {
    return (
      <div className="min-h-screen bg-[#f7f0f3] flex flex-col items-center justify-center px-5 py-12">
        <div className="w-full max-w-md space-y-6">

          {/* Brand */}
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-[#dfc8d4] bg-white shadow-sm">
              <span className="font-display text-sm font-semibold tracking-widest text-[#4a2435]">PE</span>
            </div>
            <p className="text-[9px] font-medium uppercase tracking-[0.38em] text-[#b96f8d]">Patrícia Elias</p>
            <h1 className="mt-1 font-display text-[2.2rem] font-light text-[#4a2435] leading-tight">
              Análise <span style={{ fontStyle: 'italic', color: '#7a3f56' }}>gratuita</span> de pele
            </h1>
            {campanha && (
              <p className="mt-1 text-[11px] text-[#b8a0ac] uppercase tracking-widest">{campanha}</p>
            )}
            <p className="mt-2 text-sm text-[#9a7282]">
              Preencha seus dados para receber seu protocolo personalizado por e-mail.
            </p>
          </div>

          {/* Form card */}
          <div className="glass rounded-3xl p-8" style={{ boxShadow: '0 8px 48px rgba(107,45,69,.12),inset 0 1px 0 rgba(255,255,255,.95)' }}>
            <form onSubmit={submitForm} className="space-y-4">
              <Field id="nome" label="Nome completo" type="text" ph="Maria Silva" val={nome} set={setNome} Icon={Ic.User} />
              <Field id="email" label="E-mail" type="email" ph="seu@email.com" val={email} set={setEmail} Icon={Ic.Mail} />
              <Field id="tel" label="Telefone / WhatsApp" type="tel" ph="(11) 99999-9999" val={telefone} set={setTelefone} Icon={Ic.Phone} />
              <Field id="desejos" label="O que deseja melhorar na sua pele?" type="text" ph="Ex: reduzir manchas, controlar acne..." val={desejos} set={setDesejos} Icon={Ic.Sparkle} textarea />

              {error && (
                <div className="flex gap-3 rounded-xl border border-red-100 bg-red-50/90 px-4 py-3">
                  <span className="mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">!</span>
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              <button type="submit" disabled={formBusy}
                className="btn-brand mt-1 w-full rounded-2xl py-4 text-sm font-semibold tracking-wide disabled:opacity-55">
                {formBusy
                  ? <span className="flex items-center justify-center gap-2.5"><span className="h-4 w-4 rounded-full border-2 border-white/25 border-t-white animate-spin" />Aguarde...</span>
                  : 'Iniciar minha análise →'}
              </button>
            </form>
            <p className="mt-4 text-center text-[11px] text-[#c0a8b4] leading-relaxed">
              Seus dados são protegidos e usados apenas para envio do protocolo.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── Render: processing overlay ────────────────────────────────────
  if (step === 'processing') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f7f0f3]">
        <div className="flex flex-col items-center gap-5 text-center px-6">
          <div className="relative h-20 w-20">
            <svg className="-rotate-90 h-full w-full" viewBox="0 0 84 84">
              <circle cx="42" cy="42" r="38" fill="none" stroke="rgba(192,120,152,.15)" strokeWidth="4" />
              <circle cx="42" cy="42" r="38" fill="none" stroke="#c07898" strokeWidth="4"
                strokeLinecap="round" strokeDasharray="50 189"
                style={{ animation: 'spin 1.1s linear infinite' }} />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="h-3 w-3 rounded-full bg-[#c07898] animate-pulse" />
            </div>
          </div>
          <div>
            <p className="font-display text-2xl font-light text-[#4a2435]">Analisando sua pele</p>
            <p className="mt-1 text-sm text-[#9a7282]">Inteligência artificial processando sua imagem...</p>
          </div>
        </div>
      </div>
    );
  }

  // ── Render: scan ─────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col bg-[#f7f0f3]">
      <header className="flex items-center justify-between px-6 py-4 border-b border-[#e8d0db]/60 bg-white/60 backdrop-blur-md sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full border border-[#dfc8d4] bg-white shadow-sm">
            <span className="font-display text-[11px] font-semibold tracking-widest text-[#4a2435]">PE</span>
          </div>
          <div className="leading-none">
            <p className="text-[9px] font-medium uppercase tracking-[0.38em] text-[#b96f8d]">Patrícia Elias</p>
            <p className="text-xs font-semibold text-[#4a2435]">Análise Facial</p>
          </div>
        </div>
        <p className="text-[11px] text-[#9a7282]">Olá, <strong className="text-[#4a2435]">{nome}</strong></p>
      </header>

      <div className="flex flex-1 flex-col items-center px-5 py-8 gap-6 dot-grid max-w-lg mx-auto w-full">

        {/* Heading */}
        <div className="fu w-full">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.28em] text-[#b96f8d]">Escaneamento Facial</p>
          <h2 className="font-display text-[2rem] font-light text-[#4a2435] leading-tight">
            Posicione seu rosto <span style={{ fontStyle: 'italic', color: '#7a3f56' }}>no centro</span>.
          </h2>
          <p className="mt-1 text-sm text-[#9a7282]">
            Face Mesh com 468 pontos analisa sua pele em tempo real.
          </p>
        </div>

        {/* Camera box */}
        <div className="fu1 w-full relative rounded-2xl overflow-hidden"
          style={{ background: 'linear-gradient(145deg,#120a0e 0%,#2a0f1c 40%,#1a0b12 100%)' }}>
          <div className="p-4">
            <div className="relative overflow-hidden rounded-xl" style={{ aspectRatio: '4/3' }}>
              <video ref={videoRef} autoPlay muted playsInline className="h-full w-full object-cover" />
              <canvas ref={canvasRef} className="absolute inset-0 h-full w-full pointer-events-none" />
              <CornerBrackets lit={faceDet} />

              {camOn && !faceDet && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="relative" style={{ width: 140, height: 185 }}>
                    <div className="absolute inset-0 rounded-full" style={{ border: '1px dashed rgba(255,255,255,.16)' }} />
                    <div className="pulse-ring absolute inset-0 rounded-full" style={{ border: '1px solid rgba(192,120,152,.28)' }} />
                  </div>
                </div>
              )}

              {meshReady && (
                <div className={`absolute top-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-medium backdrop-blur-md border transition-all ${
                  faceDet ? 'bg-emerald-500/12 border-emerald-400/25 text-emerald-300' : 'bg-black/22 border-white/08 text-white/35'
                }`}>
                  <span className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${faceDet ? 'bg-emerald-400 animate-pulse' : 'bg-white/18'}`} />
                  {faceDet ? 'Rosto detectado' : 'Aguardando rosto...'}
                </div>
              )}

              {!camOn && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl"
                    style={{ border: '1px solid rgba(255,255,255,.09)', background: 'rgba(255,255,255,.04)' }}>
                    <svg className="h-6 w-6 text-white/20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
                      <path d="M23 7 16 12l7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2"/>
                    </svg>
                  </div>
                  <p className="text-[10px] uppercase tracking-[0.24em] text-white/18">Câmera inativa</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Buttons */}
        <div className="fu2 w-full flex gap-3">
          <button onClick={startVideo}
            className="btn-ghost flex-1 rounded-2xl py-3.5 text-sm font-semibold">
            {camOn ? 'Reiniciar' : 'Ligar Câmera'}
          </button>
          <button onClick={analisar} disabled={!camOn || !faceDet}
            className="btn-brand flex-[2] rounded-2xl py-3.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50">
            Analisar Pele →
          </button>
        </div>

        {scanStatus && (
          <p className={`fu3 w-full flex items-center gap-2 text-[13px] font-medium ${scanStatus.includes('Erro') ? 'text-red-500' : 'text-[#8a6070]'}`}>
            <span className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${scanStatus.includes('Erro') ? 'bg-red-400' : 'bg-[#b96f8d] animate-pulse'}`} />
            {scanStatus}
          </p>
        )}

        <p className="text-[11px] text-[#c0a8b4] leading-relaxed text-center pb-2">
          Suas imagens são processadas com segurança e não são compartilhadas com terceiros.
        </p>
      </div>
    </div>
  );
}

// Wrap in Suspense because useSearchParams requires it in Next.js app router
export default function AnaliseSuspense() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-[#f7f0f3]">
        <div className="h-8 w-8 rounded-full border-2 border-[#b96f8d]/30 border-t-[#b96f8d] animate-spin" />
      </div>
    }>
      <AnalisePage />
    </Suspense>
  );
}
