"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { apiUrl } from "@/lib/api";
import { useFaceMesh } from "@/hooks/useFaceMesh";

function CornerBrackets({ lit }: { lit: boolean }) {
  const c = lit ? "border-[#c07898]/90" : "border-white/18";
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

const STEPS = [
  { n: "01", title: "Câmera",  body: "Permita o acesso ao dispositivo." },
  { n: "02", title: "Posição", body: "Centralize seu rosto na moldura." },
  { n: "03", title: "Análise", body: "Clique em Analisar Pele." },
];

export default function Home() {
  const videoRef  = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const router    = useRouter();

  const [status,    setStatus]    = useState("");
  const [loading,   setLoading]   = useState(false);
  const [faceDet,   setFaceDet]   = useState(false);
  const [meshReady, setMeshReady] = useState(false);
  const [camOn,     setCamOn]     = useState(false);

  const onFace = useCallback((d: boolean) => setFaceDet(d), []);
  const { start: startMesh, stop: stopMesh, getLandmarks } = useFaceMesh(videoRef, canvasRef, onFace);

  const startVideo = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setCamOn(true); setStatus("Carregando Face Mesh...");
        await startMesh();
        setMeshReady(true); setStatus("Posicione seu rosto no centro.");
      }
    } catch { setStatus("Erro ao acessar câmera. Verifique as permissões."); }
  };

  const analisar = async () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) { setStatus("Câmera não detectada."); return; }
    setLoading(true); setStatus("Analisando com IA..."); stopMesh();
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth; canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) { setLoading(false); return; }
    ctx.drawImage(video, 0, 0);
    canvas.toBlob(async (blob) => {
      if (!blob) { setStatus("Erro ao capturar imagem."); setLoading(false); startMesh(); return; }
      const fd = new FormData();
      fd.append("image", blob, "scan.jpg");
      const lm = getLandmarks();
      if (lm) fd.append("landmarks", JSON.stringify(lm));
      try {
        const token = localStorage.getItem("access_token");
        if (!token) { setStatus("Sessão expirada."); router.push("/login"); setLoading(false); return; }
        const res = await fetch(apiUrl("/analise/upload"), { method:"POST", body:fd, headers:{ Authorization:`Bearer ${token}` } });
        if (res.ok) {
          const data = await res.json();
          localStorage.setItem("ultima_analise", JSON.stringify(data));
          router.push("/dashboard");
        } else {
          if (res.status === 401) { localStorage.removeItem("access_token"); router.push("/login"); return; }
          throw new Error((await res.text()) || "Falha no servidor.");
        }
      } catch (err: unknown) {
        setStatus(`Erro: ${err instanceof Error ? err.message : "Falha."}`);
        startMesh();
      } finally { setLoading(false); }
    }, "image/jpeg", 0.9);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#f7f0f3]">

      {/* ── Header ── */}
      <header className="flex items-center justify-between px-7 py-4 border-b border-[#e8d0db]/60 bg-white/60 backdrop-blur-md sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full border border-[#dfc8d4] bg-white shadow-sm">
            <span className="font-display text-[11px] font-semibold tracking-widest text-[#4a2435]">PE</span>
          </div>
          <div className="leading-none">
            <p className="text-[9px] font-medium uppercase tracking-[0.38em] text-[#b96f8d]">Patrícia Elias</p>
            <p className="text-xs font-semibold text-[#4a2435]">Skin Intelligence</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-[#b96f8d] animate-pulse" />
          <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#7a3f56]">Escaneamento</span>
        </div>
      </header>

      {/* ── Main: single column ── */}
      <div className="flex flex-1 flex-col items-center px-5 py-8 gap-6 dot-grid max-w-lg mx-auto w-full">

        {/* 1 — Heading */}
        <div className="fu w-full">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.28em] text-[#b96f8d]">Diagnóstico por IA</p>
          <h1 className="font-display text-[2.4rem] font-light text-[#4a2435] leading-[1.1] tracking-tight">
            Escaneamento <span style={{ fontStyle:'italic', color:'#7a3f56' }}>facial</span> inteligente.
          </h1>
          <p className="mt-2 text-sm text-[#9a7282] leading-relaxed">
            Face Mesh com 468 pontos analisa sua pele em tempo real e gera recomendações personalizadas.
          </p>
        </div>

        {/* 2 — Steps */}
        <div className="fu1 w-full space-y-2.5">
          <p className="text-[10px] uppercase tracking-[0.26em] text-[#b8a0ac]">Como funciona</p>
          <div className="grid grid-cols-3 gap-2.5">
            {STEPS.map((s, i) => (
              <div key={s.n} className={`flex flex-col gap-2 glass rounded-2xl px-3 py-3 transition-all ${camOn && i === 1 && faceDet ? 'border-[#b96f8d]/40' : ''}`}>
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl text-[11px] font-bold text-white"
                  style={{ background:'linear-gradient(135deg,#4a2435,#b96f8d)' }}>
                  {s.n}
                </div>
                <div>
                  <p className="text-[12px] font-semibold text-[#4a2435]">{s.title}</p>
                  <p className="text-[11px] text-[#9a7282] mt-0.5 leading-snug">{s.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 3 — Camera */}
        <div className="fu2 w-full relative rounded-2xl overflow-hidden"
          style={{ background:'linear-gradient(145deg,#120a0e 0%,#2a0f1c 40%,#1a0b12 100%)' }}>

          {/* Atmospheric glow orbs */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="float-a absolute -top-16 -right-16 h-56 w-56 rounded-full"
              style={{ background:'radial-gradient(circle,rgba(192,120,152,.20),transparent 70%)' }} />
            <div className="float-b absolute -bottom-12 -left-12 h-44 w-44 rounded-full"
              style={{ background:'radial-gradient(circle,rgba(96,64,160,.16),transparent 70%)' }} />
          </div>

          <div className="relative p-4">
            {/* Outer ring decoration */}
            <div className="absolute inset-2 rounded-xl pointer-events-none"
              style={{ border:'1px solid rgba(192,120,152,.12)' }} />

            {/* Video box */}
            <div className="relative overflow-hidden rounded-xl"
              style={{ aspectRatio:'4/3', boxShadow:'0 0 60px rgba(192,120,152,.10),0 16px 40px rgba(0,0,0,.55)' }}>
              <video ref={videoRef} autoPlay muted playsInline className="h-full w-full object-cover" />
              <canvas ref={canvasRef} className="absolute inset-0 h-full w-full pointer-events-none" />
              <CornerBrackets lit={faceDet} />

              {/* Face guide oval */}
              {camOn && !faceDet && !loading && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="relative" style={{ width:140, height:185 }}>
                    <div className="absolute inset-0 rounded-full" style={{ border:'1px dashed rgba(255,255,255,.16)' }} />
                    <div className="pulse-ring absolute inset-0 rounded-full" style={{ border:'1px solid rgba(192,120,152,.28)' }} />
                  </div>
                </div>
              )}

              {/* Loading overlay */}
              {loading && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-5"
                  style={{ background:'rgba(8,3,6,.80)', backdropFilter:'blur(3px)' }}>
                  <div className="relative h-14 w-14">
                    <svg className="-rotate-90 h-full w-full absolute inset-0" viewBox="0 0 64 64">
                      <circle cx="32" cy="32" r="28" fill="none" stroke="rgba(255,255,255,.07)" strokeWidth="3" />
                      <circle cx="32" cy="32" r="28" fill="none" stroke="#c07898" strokeWidth="3"
                        strokeLinecap="round" strokeDasharray="44 132"
                        style={{ animation:'spin 1.1s linear infinite' }} />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="h-2 w-2 rounded-full bg-[#c07898] animate-pulse" />
                    </div>
                  </div>
                  <div className="text-center">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/80">Analisando</p>
                    <p className="mt-1 text-[10px] tracking-wide text-white/30">Processando dados faciais com IA</p>
                  </div>
                  <div className="scan-line absolute left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#c07898]/55 to-transparent" />
                </div>
              )}

              {/* Face badge */}
              {meshReady && (
                <div className={`absolute top-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-medium backdrop-blur-md border transition-all duration-500 ${
                  faceDet
                    ? "bg-emerald-500/12 border-emerald-400/25 text-emerald-300"
                    : "bg-black/22 border-white/08 text-white/35"
                }`}>
                  <span className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${faceDet ? "bg-emerald-400 animate-pulse" : "bg-white/18"}`} />
                  {faceDet ? "Rosto detectado" : "Aguardando rosto..."}
                </div>
              )}

              {/* Camera off placeholder */}
              {!camOn && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl"
                    style={{ border:'1px solid rgba(255,255,255,.09)', background:'rgba(255,255,255,.04)' }}>
                    <svg className="h-6 w-6 text-white/20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
                      <path d="M23 7 16 12l7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2"/>
                    </svg>
                  </div>
                  <p className="text-[10px] uppercase tracking-[0.24em]" style={{ color:'rgba(255,255,255,.18)' }}>Câmera inativa</p>
                </div>
              )}
            </div>

          </div>
        </div>

        {/* 4 — Buttons */}
        <div className="fu3 w-full flex gap-3">
          <button onClick={startVideo} disabled={loading}
            className="btn-ghost flex-1 rounded-2xl py-3.5 text-sm font-semibold disabled:opacity-50">
            {camOn ? "Reiniciar Câmera" : "Ligar Câmera"}
          </button>
          <button onClick={analisar} disabled={loading || !camOn}
            className="btn-brand flex-[2] rounded-2xl py-3.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50">
            {loading
              ? <span className="flex items-center justify-center gap-2"><span className="h-3.5 w-3.5 rounded-full border-2 border-white/25 border-t-white animate-spin" />Processando...</span>
              : "Analisar Pele →"}
          </button>
        </div>

        {/* 5 — Status */}
        {status && (
          <p className={`fu4 w-full flex items-center gap-2 text-[13px] font-medium ${status.includes("Erro") ? "text-red-500" : "text-[#8a6070]"}`}>
            <span className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${status.includes("Erro") ? "bg-red-400" : "bg-[#b96f8d] animate-pulse"}`} />
            {status}
          </p>
        )}

        <p className="text-[11px] text-[#c0a8b4] leading-relaxed text-center pb-2">
          Suas imagens são processadas com segurança e não são compartilhadas com terceiros.
        </p>
      </div>
    </div>
  );
}
