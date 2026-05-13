'use client';

import { useState, useRef, useCallback, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiUrl } from '@/lib/api';
import { useFaceMesh } from '@/hooks/useFaceMesh';

// ── Face Guidance ─────────────────────────────────────────────────────
type GuidanceStatus = 'waiting' | 'warn' | 'ok';
type GuidanceArrow = 'up' | 'down' | 'left' | 'right' | 'in' | 'out' | null;
type Guidance = { message: string; status: GuidanceStatus; arrow: GuidanceArrow };

type Pose = { yaw: number; pitch: number; roll: number; faceHeight: number; cx: number; cy: number };
type Landmark = { x: number; y: number; z: number };

function computePose(lm: Landmark[] | null): Pose | null {
  if (!lm || lm.length < 454) return null;
  const nose     = lm[4];
  const forehead = lm[10];
  const chin     = lm[152];
  const leftEye  = lm[33];
  const rightEye = lm[263];

  const faceHeight = Math.abs(chin.y - forehead.y);
  const eyeMidX = (leftEye.x + rightEye.x) / 2;
  const eyeMidY = (leftEye.y + rightEye.y) / 2;
  // Yaw: deslocamento horizontal do nariz em relação ao centro entre os olhos, normalizado pela largura do par de olhos.
  const eyeWidth = Math.abs(rightEye.x - leftEye.x) || 1;
  const yaw = (nose.x - eyeMidX) / eyeWidth;
  // Pitch: deslocamento vertical do nariz em relação à linha dos olhos, normalizado pela altura do rosto.
  const pitch = (nose.y - eyeMidY) / (faceHeight || 1);
  const roll = Math.atan2(rightEye.y - leftEye.y, rightEye.x - leftEye.x) * (180 / Math.PI);
  return { yaw, pitch, roll, faceHeight, cx: nose.x, cy: nose.y };
}

// Posicionamento básico (face centralizada, frontal, distância OK).
function checkFraming(p: Pose): Guidance | null {
  if (p.faceHeight < 0.18) return { message: 'Aproxime o rosto da câmera', status: 'warn', arrow: 'in' };
  if (p.faceHeight > 0.85) return { message: 'Afaste o rosto da câmera',   status: 'warn', arrow: 'out' };
  if (Math.abs(p.roll) > 18) return { message: 'Endireite levemente a cabeça', status: 'warn', arrow: null };
  // Yaw: nariz à direita do eixo (yaw < 0) = face virada para a direita do usuário.
  if (p.yaw < -0.28) return { message: 'Vire um pouco para a esquerda', status: 'warn', arrow: 'left' };
  if (p.yaw >  0.28) return { message: 'Vire um pouco para a direita', status: 'warn', arrow: 'right' };
  // Pitch: nariz abaixo da linha dos olhos (pitch > 0) = olhando para baixo.
  if (p.pitch >  0.20) return { message: 'Levante levemente o queixo',  status: 'warn', arrow: 'up'   };
  if (p.pitch < -0.20) return { message: 'Abaixe levemente o queixo',   status: 'warn', arrow: 'down' };
  return null;
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
  const videoRef      = useRef<HTMLVideoElement>(null);
  const sharpVideoRef = useRef<HTMLVideoElement>(null);
  const canvasRef     = useRef<HTMLCanvasElement>(null);
  const [camOn, setCamOn] = useState(false);
  const [, setFaceDet] = useState(false);
  const [meshReady, setMeshReady] = useState(false);
  const [scanStatus, setScanStatus] = useState('');
  const [guidance, setGuidance] = useState<Guidance>({ message: 'Posicione seu rosto na câmera', status: 'waiting', arrow: null });
  const [blurBg, setBlurBg] = useState('');
  const blurIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Auto-scan (captura única quando rosto fica estável) ──
  const okFramesRef = useRef(0);
  const scanRunningRef = useRef(false);
  const capturedRef = useRef(false);
  // Trampolim para chamar enviarAnalise dentro de onLandmarks sem ciclo de declaração.
  const enviarAnaliseRef = useRef<(b: Blob) => void>(() => {});

  const captureBlurFrame = useCallback(() => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0 || video.readyState < 2) return;
    const scale = 0.25;
    const w = Math.round(video.videoWidth * scale);
    const h = Math.round(video.videoHeight * scale);
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.filter = 'blur(5px)';
    ctx.drawImage(video, 0, 0, w, h);
    setBlurBg(c.toDataURL('image/jpeg', 0.7));
  }, []);

  // Captura frame atual do vídeo como Blob JPEG (resolução cheia).
  const captureFrameBlob = useCallback((): Promise<Blob | null> => {
    return new Promise((resolve) => {
      const video = videoRef.current;
      if (!video || !video.videoWidth) return resolve(null);
      const c = document.createElement('canvas');
      c.width = video.videoWidth;
      c.height = video.videoHeight;
      const ctx = c.getContext('2d');
      if (!ctx) return resolve(null);
      ctx.drawImage(video, 0, 0);
      c.toBlob((b) => resolve(b), 'image/jpeg', 0.9);
    });
  }, []);

  const onFace = useCallback((d: boolean) => setFaceDet(d), []);
  const onLandmarks = useCallback((lm: Landmark[] | null) => {
    if (capturedRef.current) return;

    const pose = computePose(lm);
    if (!pose) {
      setGuidance({ message: 'Posicione seu rosto na câmera', status: 'waiting', arrow: null });
      okFramesRef.current = 0;
      return;
    }

    const framingErr = checkFraming(pose);
    if (framingErr) {
      setGuidance(framingErr);
      okFramesRef.current = 0;
      return;
    }

    if (!scanRunningRef.current) {
      setGuidance({ message: 'Pronto — segure por um instante...', status: 'ok', arrow: null });
      okFramesRef.current = 0;
      return;
    }

    okFramesRef.current += 1;
    // Precisa segurar a pose ~22 frames (~1.5s a 15fps) para considerar estável.
    const FRAMES_NEEDED = 22;
    setGuidance({
      message: okFramesRef.current < FRAMES_NEEDED ? 'Segure assim...' : 'Capturando',
      status: 'ok',
      arrow: null,
    });

    if (okFramesRef.current >= FRAMES_NEEDED) {
      capturedRef.current = true;
      scanRunningRef.current = false;
      captureFrameBlob().then((blob) => {
        if (!blob) {
          capturedRef.current = false;
          scanRunningRef.current = true;
          okFramesRef.current = 0;
          setScanStatus('Falha ao capturar frame. Tentando novamente...');
          return;
        }
        enviarAnaliseRef.current(blob);
      });
    }
  }, [captureFrameBlob]);

  const { start: startMesh, stop: stopMesh, getLandmarks } = useFaceMesh(videoRef, canvasRef, onFace, onLandmarks);

  useEffect(() => () => { if (blurIntervalRef.current) clearInterval(blurIntervalRef.current); }, []);

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
  const startVideo = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        if (sharpVideoRef.current) sharpVideoRef.current.srcObject = stream;
        setCamOn(true);
        capturedRef.current = false;
        okFramesRef.current = 0;
        setGuidance({ message: 'Posicione seu rosto na câmera', status: 'waiting', arrow: null });
        setBlurBg('');
        if (blurIntervalRef.current) clearInterval(blurIntervalRef.current);
        setScanStatus('Carregando reconhecimento facial...');
        await startMesh();
        setMeshReady(true);
        setScanStatus('');
        // Auto-inicia o scan assim que o mesh está pronto — não precisa de clique.
        scanRunningRef.current = true;
        setTimeout(captureBlurFrame, 400);
        blurIntervalRef.current = setInterval(captureBlurFrame, 4000);
      }
    } catch {
      setScanStatus('Erro ao acessar câmera. Verifique as permissões.');
    }
  }, [startMesh, captureBlurFrame]);

  const enviarAnalise = async (frame: Blob) => {
    setStep('processing');
    stopMesh();

    const fd = new FormData();
    fd.append('image', frame, 'scan.jpg');
    fd.append('analysisToken', analysisToken);
    const lm = getLandmarks();
    if (lm) fd.append('landmarks', JSON.stringify(lm));

    try {
      const res = await fetch(apiUrl(`/leads/${leadId}/analise`), { method: 'POST', body: fd });
      if (res.ok) {
        router.push('/obrigado');
      } else {
        const data = await res.json().catch(() => ({}));
        setStep('scan');
        setScanStatus(data?.message ?? 'Erro na análise. Tente novamente.');
        capturedRef.current = false;
        okFramesRef.current = 0;
        scanRunningRef.current = true;
        startMesh();
      }
    } catch {
      setStep('scan');
      setScanStatus('Erro ao conectar. Tente novamente.');
      capturedRef.current = false;
      okFramesRef.current = 0;
      scanRunningRef.current = true;
      startMesh();
    }
  };
  enviarAnaliseRef.current = (b: Blob) => { void enviarAnalise(b); };

  // Auto-liga a câmera ao entrar na etapa de scan — sem precisar clicar.
  const startedRef = useRef(false);
  useEffect(() => {
    if (step !== 'scan' || startedRef.current) return;
    startedRef.current = true;
    void startVideo();
  }, [step, startVideo]);

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
            A captura acontece automaticamente quando o rosto estiver bem enquadrado. Não precisa apertar nada.
          </p>
        </div>

        {/* Camera box */}
        <div className="fu1 w-full relative rounded-2xl overflow-hidden"
          style={{ background: 'linear-gradient(145deg,#120a0e 0%,#2a0f1c 40%,#1a0b12 100%)' }}>
          <div className="p-4">
            <div className="relative overflow-hidden rounded-xl" style={{ aspectRatio: '4/3' }}>
              {/* Base video — used for face detection, covered by blur snapshot */}
              <video ref={videoRef} autoPlay muted playsInline className="h-full w-full object-cover" />
              {/* Static blurred snapshot — updated every 4s, zero ongoing GPU cost */}
              {blurBg && (
                <img src={blurBg} alt="" aria-hidden
                  className="absolute inset-0 h-full w-full object-cover pointer-events-none brightness-50" />
              )}
              {/* Sharp live video clipped to oval */}
              <video ref={sharpVideoRef} autoPlay muted playsInline
                className="absolute inset-0 h-full w-full object-cover pointer-events-none"
                style={{ clipPath: 'ellipse(24% 42.7% at 50% 49.3%)' }} />
              <canvas ref={canvasRef} className="absolute inset-0 h-full w-full pointer-events-none" />
              <CornerBrackets lit={guidance.status === 'ok'} />
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

        {/* Reiniciar — só aparece se houve falha após câmera ligada */}
        {camOn && scanStatus.includes('Erro') && (
          <div className="fu2 w-full">
            <button onClick={() => { startedRef.current = false; void startVideo(); }}
              className="btn-ghost w-full rounded-2xl py-3.5 text-sm font-semibold">
              Tentar novamente
            </button>
          </div>
        )}

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
