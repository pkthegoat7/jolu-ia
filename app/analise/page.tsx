'use client';

import { useState, useRef, useCallback, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiUrl } from '@/lib/api';
import { useFaceMesh } from '@/hooks/useFaceMesh';

// ── Face Guidance ─────────────────────────────────────────────────────
type GuidanceStatus = 'waiting' | 'warn' | 'ok';
type GuidanceArrow = 'up' | 'down' | 'left' | 'right' | 'in' | 'out' | null;
type Guidance = { message: string; status: GuidanceStatus; arrow: GuidanceArrow };

function computeGuidance(lm: Array<{ x: number; y: number; z: number }> | null): Guidance {
  const waiting: Guidance = { message: 'Posicione seu rosto na câmera', status: 'waiting', arrow: null };
  if (!lm || lm.length < 454) return waiting;

  const nose     = lm[4];
  const forehead = lm[10];
  const chin     = lm[152];
  const leftEye  = lm[33];
  const rightEye = lm[263];

  const faceHeight = Math.abs(chin.y - forehead.y);
  const cx = nose.x;
  const cy = nose.y;
  const tilt = Math.abs(Math.atan2(rightEye.y - leftEye.y, rightEye.x - leftEye.x) * (180 / Math.PI));

  if (faceHeight < 0.22) return { message: 'Aproxime o rosto da câmera', status: 'warn', arrow: 'in' };
  if (faceHeight > 0.72) return { message: 'Afaste o rosto da câmera',   status: 'warn', arrow: 'out' };
  if (cx < 0.37)         return { message: 'Mova o rosto para a direita', status: 'warn', arrow: 'right' };
  if (cx > 0.63)         return { message: 'Mova o rosto para a esquerda',status: 'warn', arrow: 'left' };
  if (cy < 0.28)         return { message: 'Abaixe levemente o rosto',    status: 'warn', arrow: 'down' };
  if (cy > 0.68)         return { message: 'Levante levemente o rosto',   status: 'warn', arrow: 'up' };
  if (tilt > 12)         return { message: 'Endireite levemente a cabeça', status: 'warn', arrow: null };

  return { message: 'Perfeito! Clique em Analisar', status: 'ok', arrow: null };
}

// ── Blur Overlay (canvas-based, works cross-browser) ─────────────────
function BlurOverlay({ videoRef, camOn }: {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  camOn: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!camOn) return;
    let raf = 0;
    const draw = () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState < 2 || video.videoWidth === 0) {
        raf = requestAnimationFrame(draw);
        return;
      }
      const w = video.videoWidth;
      const h = video.videoHeight;
      if (canvas.width !== w) canvas.width = w;
      if (canvas.height !== h) canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // 1. Draw blurred video over entire canvas
      ctx.filter = `blur(${Math.round(w * 0.018)}px)`;
      ctx.drawImage(video, 0, 0, w, h);
      ctx.filter = 'none';

      // 2. Darken the blurred area
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = 'rgba(8,3,6,0.45)';
      ctx.fillRect(0, 0, w, h);

      // 3. Cut transparent oval — raw video shows through from the layer below
      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath();
      // Matches SVG ellipse: cx=50/100, cy=37/75, rx=24/100, ry=32/75
      ctx.ellipse(w * 0.5, h * (37 / 75), w * 0.24, h * (32 / 75), 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalCompositeOperation = 'source-over';

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [camOn, videoRef]);

  if (!camOn) return null;
  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
    />
  );
}

// ── Guidance Overlay ──────────────────────────────────────────────────
function GuidanceOverlay({ guidance, camOn }: { guidance: Guidance; camOn: boolean }) {
  if (!camOn) return null;
  const color = guidance.status === 'ok' ? '#34d399' : guidance.status === 'warn' ? '#fb923c' : 'rgba(255,255,255,0.18)';
  const dash  = guidance.status === 'waiting' ? '4 3' : undefined;

  const Arrow = ({ dir }: { dir: GuidanceArrow }) => {
    if (!dir) return null;
    const paths: Record<string, string> = {
      up:    'M12 19V5m0 0-5 5m5-5 5 5',
      down:  'M12 5v14m0 0-5-5m5 5 5-5',
      left:  'M19 12H5m0 0 5-5m-5 5 5 5',
      right: 'M5 12h14m0 0-5-5m5 5-5 5',
      in:    'M21 21l-6-6m6 6v-4m0 4h-4M3 3l6 6M3 3v4m0-4h4',
      out:   'M3 3l18 18M3 21l18-18',
    };
    const positions: Record<string, string> = {
      up:    'top-2 left-1/2 -translate-x-1/2',
      down:  'bottom-2 left-1/2 -translate-x-1/2',
      left:  'left-2 top-1/2 -translate-y-1/2',
      right: 'right-2 top-1/2 -translate-y-1/2',
      in:    'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2',
      out:   'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2',
    };
    return (
      <div className={`absolute ${positions[dir]} pointer-events-none animate-bounce`}>
        <svg className="h-7 w-7 drop-shadow-lg" viewBox="0 0 24 24" fill="none" stroke="#fb923c" strokeWidth="2.2" strokeLinecap="round">
          <path d={paths[dir]} />
        </svg>
      </div>
    );
  };

  return (
    <div className="absolute inset-0 pointer-events-none">
      {/* Oval guide */}
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 75" preserveAspectRatio="none">
        <ellipse cx="50" cy="37" rx="24" ry="32"
          fill="none"
          stroke={color}
          strokeWidth="0.6"
          strokeDasharray={dash}
          style={{ transition: 'stroke 0.4s ease' }}
        />
        {guidance.status === 'ok' && (
          <ellipse cx="50" cy="37" rx="24" ry="32"
            fill="none" stroke={color} strokeWidth="0.4" opacity="0.3"
            style={{ animation: 'pulse 1.5s ease-in-out infinite' }}
          />
        )}
      </svg>
      {/* Direction arrow */}
      <Arrow dir={guidance.arrow} />
    </div>
  );
}

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
  const [guidance, setGuidance] = useState<Guidance>({ message: 'Posicione seu rosto na câmera', status: 'waiting', arrow: null });
  const [faceReady, setFaceReady] = useState(false);
  const okFramesRef = useRef(0);

  const onFace = useCallback((d: boolean) => setFaceDet(d), []);
  const onLandmarks = useCallback((lm: Array<{ x: number; y: number; z: number }> | null) => {
    const g = computeGuidance(lm);
    setGuidance(g);
    if (g.status === 'ok') {
      okFramesRef.current += 1;
      if (okFramesRef.current >= 10) setFaceReady(true);
    } else {
      okFramesRef.current = 0;
      setFaceReady(false);
    }
  }, []);
  const { start: startMesh, stop: stopMesh, getLandmarks } = useFaceMesh(videoRef, canvasRef, onFace, onLandmarks);

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
        setFaceReady(false);
        okFramesRef.current = 0;
        setGuidance({ message: 'Posicione seu rosto na câmera', status: 'waiting', arrow: null });
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
              <BlurOverlay videoRef={videoRef} camOn={camOn} />
              <canvas ref={canvasRef} className="absolute inset-0 h-full w-full pointer-events-none" />
              <CornerBrackets lit={faceReady} />
              <GuidanceOverlay guidance={guidance} camOn={camOn} />

              {meshReady && (
                <div className={`absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-medium backdrop-blur-md border transition-all duration-300 whitespace-nowrap ${
                  guidance.status === 'ok'
                    ? 'bg-emerald-500/15 border-emerald-400/30 text-emerald-300'
                    : guidance.status === 'warn'
                    ? 'bg-orange-500/15 border-orange-400/30 text-orange-300'
                    : 'bg-black/22 border-white/08 text-white/40'
                }`}>
                  <span className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${
                    guidance.status === 'ok' ? 'bg-emerald-400 animate-pulse'
                    : guidance.status === 'warn' ? 'bg-orange-400 animate-pulse'
                    : 'bg-white/18'
                  }`} />
                  {guidance.message}
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
          <button onClick={analisar} disabled={!camOn || !faceReady}
            className="btn-brand flex-[2] rounded-2xl py-3.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50">
            Analisar Pele →
          </button>
        </div>

        {scanStatus && !meshReady && (
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
