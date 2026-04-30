'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiUrl } from '@/lib/api';

const Ic = {
  User:  () => <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M20 21a8 8 0 1 0-16 0"/><circle cx="12" cy="7" r="4"/></svg>,
  Mail:  () => <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>,
  Lock:  () => <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V8a4 4 0 1 1 8 0v3"/></svg>,
  Check: () => <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V8a4 4 0 1 1 8 0v3"/><path d="m9.5 16 1.8 1.8 3.2-3.2"/></svg>,
};

function Field({ id, label, type, ph, val, set, Icon, hint }: {
  id:string; label:string; type:string; ph:string;
  val:string; set:(v:string)=>void;
  Icon:()=>React.ReactNode; hint?:string;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8b3f5a]">{label}</label>
      <div className="relative">
        <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#c4a0b8]"><Icon /></span>
        <input id={id} type={type} placeholder={ph} value={val} required className="field" onChange={e=>set(e.target.value)} />
      </div>
      {hint && <p className="mt-1 text-[11px] text-[#c0a0b4]">{hint}</p>}
    </div>
  );
}

export default function LoginPage() {
  const [isReg,setIsReg]=useState(false);
  const [name,setName]=useState('');
  const [email,setEmail]=useState('');
  const [pass,setPass]=useState('');
  const [conf,setConf]=useState('');
  const [error,setError]=useState('');
  const [msg,setMsg]=useState('');
  const [busy,setBusy]=useState(false);
  const router=useRouter();

  const submit=async(e:React.FormEvent)=>{
    e.preventDefault(); setError(''); setMsg('');
    if(isReg){
      if(!name.trim()){setError('Informe seu nome.');return;}
      if(pass.length<6){setError('Senha: mínimo 6 caracteres.');return;}
      if(pass!==conf){setError('As senhas não coincidem.');return;}
    }
    try{
      setBusy(true);
      if(isReg){
        const r=await fetch(apiUrl('/auth/register'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,email,password:pass})});
        const d=await r.json().catch(()=>({}));
        if(!r.ok){setError(d?.message||'Erro ao criar conta.');return;}
        const lr=await fetch(apiUrl('/auth/login'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password:pass})});
        const ld=await lr.json().catch(()=>({}));
        if(!lr.ok||!ld?.access_token){setMsg('Conta criada! Faça login.');setIsReg(false);setPass('');setConf('');return;}
        localStorage.setItem('access_token',ld.access_token);router.push('/');
      }else{
        const r=await fetch(apiUrl('/auth/login'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password:pass})});
        const d=await r.json().catch(()=>({}));
        if(r.ok&&d?.access_token){localStorage.setItem('access_token',d.access_token);router.push('/');}
        else setError(d?.message||'Credenciais inválidas.');
      }
    }catch{setError('Erro ao conectar com o servidor.');}
    finally{setBusy(false);}
  };

  const toggle=()=>{setIsReg(p=>!p);setError('');setMsg('');setPass('');setConf('');};

  return (
    <div className="flex min-h-screen">

      {/* ════ LEFT — brand panel ════ */}
      <div className="hidden lg:flex lg:w-[48%] flex-col relative overflow-hidden" style={{background:'#0c0610'}}>

        {/* ── Layer 1: base gradient ── */}
        <div className="absolute inset-0"
          style={{background:'linear-gradient(145deg,#0c0610 0%,#220d1a 30%,#4a1f35 58%,#7a3850 80%,#a0607a 100%)'}} />

        {/* ── Layer 2: aurora orbs ── */}
        <div className="aurora-shift orb float-a"
          style={{width:500,height:500,top:'-10%',right:'-15%',background:'radial-gradient(circle,rgba(192,64,106,.35) 0%,rgba(107,45,69,.15) 50%,transparent 70%)'}} />
        <div className="orb float-b"
          style={{width:380,height:380,bottom:'-5%',left:'-10%',background:'radial-gradient(circle,rgba(96,64,160,.30) 0%,rgba(64,32,100,.12) 50%,transparent 70%)'}} />
        <div className="orb float-c"
          style={{width:260,height:260,top:'40%',left:'10%',background:'radial-gradient(circle,rgba(201,165,117,.18) 0%,transparent 65%)'}} />

        {/* ── Layer 3: rings ── */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="rotate-slow absolute"
            style={{width:640,height:640,top:'-12%',right:'-18%',borderRadius:'100%',border:'1px dashed rgba(255,255,255,.05)'}} />
          <div className="rotate-rev absolute"
            style={{width:460,height:460,top:'5%',right:'-8%',borderRadius:'100%',border:'1px solid rgba(255,255,255,.08)'}} />
          <div className="float-a absolute"
            style={{width:300,height:300,top:'20%',right:'8%',borderRadius:'100%',border:'1px solid rgba(255,255,255,.10)'}} />
          <div className="absolute"
            style={{width:180,height:180,top:'32%',right:'18%',borderRadius:'100%',border:'1px solid rgba(255,255,255,.13)'}} />
          {/* PE monogram */}
          <div className="absolute flex items-center justify-center"
            style={{width:62,height:62,top:'calc(32% + 59px)',right:'calc(18% + 59px)',borderRadius:'100%',border:'1.5px solid rgba(255,255,255,.28)',background:'rgba(255,255,255,.07)',backdropFilter:'blur(8px)'}}>
            <span className="font-display text-lg font-light tracking-[0.22em] text-white/85">PE</span>
          </div>
          {/* Dot sparkles */}
          {[[20,15],[78,62],[12,72],[88,28],[55,88]].map(([t,l],i)=>(
            <div key={i} className="glow-pulse absolute rounded-full"
              style={{width:i%2?6:4,height:i%2?6:4,top:`${t}%`,left:`${l}%`,background:i%3===0?'rgba(201,165,117,.55)':i%3===1?'rgba(192,120,152,.45)':'rgba(160,128,220,.40)'}} />
          ))}
          {/* Watermark */}
          <span className="font-display absolute select-none text-[180px] font-light leading-none tracking-tighter text-white/[0.025]"
            style={{bottom:'-20px',left:'10px'}}>PELE</span>
        </div>

        {/* ── Layer 4: gradient overlay for readability ── */}
        <div className="absolute inset-0"
          style={{background:'linear-gradient(to right,rgba(12,6,16,.40) 0%,transparent 60%)'}} />

        {/* ── Content ── */}
        <div className="relative z-10 flex h-full flex-col justify-between p-12 xl:p-14">
          <div>
            <p className="text-[9px] uppercase tracking-[0.45em] text-white/35 mb-1">Patrícia Elias</p>
            <p className="text-sm font-medium tracking-wider text-white/55">Skin Intelligence</p>
          </div>

          <div className="space-y-5">
            <div className="flex items-center gap-2">
              <div className="h-px w-8" style={{background:'linear-gradient(to right,#c9a575,transparent)'}} />
              <p className="text-[10px] uppercase tracking-[0.32em]" style={{color:'#c9a575'}}>Tecnologia para sua pele</p>
            </div>
            <h2 className="font-display leading-[1.06] tracking-tight"
              style={{fontSize:'3.6rem',fontWeight:300,background:'linear-gradient(135deg,#ffffff 0%,#e8d0dc 40%,#c9a575 100%)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent'}}>
              Diagnóstico<br />
              preciso.<br />
              <em style={{fontStyle:'italic',fontWeight:400}}>Resultados reais.</em>
            </h2>
            <p className="text-sm text-white/40 leading-relaxed max-w-[270px]">
              Face Mesh com 468 pontos de mapeamento e inteligência artificial para revelar o que sua pele realmente precisa.
            </p>
          </div>

          {/* Feature rows */}
          <div className="space-y-3.5">
            {[
              {dot:'#c9a575', text:'Mapeamento facial em tempo real'},
              {dot:'#c07898', text:'Diagnóstico com IA · Claude Vision'},
              {dot:'#9080c0', text:'Linha Patrícia Elias exclusiva'},
            ].map(f=>(
              <div key={f.text} className="flex items-center gap-3">
                <div className="h-1.5 w-1.5 rounded-full flex-shrink-0" style={{background:f.dot,boxShadow:`0 0 6px ${f.dot}`}} />
                <span className="text-[13px] text-white/48">{f.text}</span>
              </div>
            ))}
          </div>

          <p className="text-[10px] text-white/20">© {new Date().getFullYear()} Patrícia Elias · Todos os direitos reservados.</p>
        </div>
      </div>

      {/* ════ RIGHT — form panel ════ */}
      <div className="relative flex flex-1 items-center justify-center overflow-hidden px-6 py-14">

        {/* Aurora background for right panel */}
        <div className="absolute inset-0 aurora-light" />
        <div className="absolute inset-0 dot-grid opacity-60" />

        {/* Soft orbs */}
        <div className="orb float-b absolute"
          style={{width:400,height:400,top:'-10%',right:'-15%',background:'radial-gradient(circle,rgba(192,120,152,.12),transparent 65%)'}} />
        <div className="orb float-a absolute"
          style={{width:320,height:320,bottom:'-8%',left:'-12%',background:'radial-gradient(circle,rgba(96,64,160,.08),transparent 65%)'}} />

        <div className="relative z-10 w-full max-w-[390px] space-y-7">

          {/* Mobile brand */}
          <div className="lg:hidden mb-5">
            <p className="text-[10px] uppercase tracking-[0.52em] text-[#b96f8d] mb-1">Patrícia Elias</p>
            <p className="font-display text-[2rem] font-light text-[#4a2435] leading-none tracking-tight">Skin Intelligence</p>
            <div className="mt-2 flex items-center gap-2">
              <div className="h-px w-8" style={{background:'linear-gradient(to right,#c9a575,transparent)'}} />
              <p className="text-[9px] uppercase tracking-[0.30em] text-[#c0a0b4]">Tecnologia para sua pele</p>
            </div>
          </div>

          {/* Heading */}
          <div className="fu">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full px-4 py-1.5"
              style={{background:'linear-gradient(135deg,rgba(74,36,53,.07),rgba(192,120,152,.11))',border:'1px solid rgba(192,120,152,.28)',boxShadow:'inset 0 1px 0 rgba(255,255,255,.65),0 2px 8px rgba(107,45,69,.08)'}}>
              <div className="h-1.5 w-1.5 rounded-full" style={{background:'linear-gradient(135deg,#c9a575,#c07898)',boxShadow:'0 0 5px rgba(201,165,117,.55)'}} />
              <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#8b3f5a]">
                {isReg?'Cadastro':'Acesso'}
              </span>
            </div>
            <h1 className="font-display text-[2.6rem] font-light leading-tight text-[#4a2435]">
              {isReg?'Crie sua\nconta.':'Bem-vinda\nde volta.'}
            </h1>
            <p className="mt-2 text-sm text-[#9a7282] leading-relaxed">
              {isReg
                ?'Preencha os dados para começar seu diagnóstico personalizado.'
                :'Entre para acessar sua análise facial inteligente.'}
            </p>
          </div>

          {/* Glass form card */}
          <div className="fu1 glass rounded-3xl p-8" style={{boxShadow:'0 8px 48px rgba(107,45,69,.14),0 2px 8px rgba(74,36,53,.06),inset 0 1px 0 rgba(255,255,255,.95)'}}>
            <form onSubmit={submit} className="space-y-4">
              {isReg&&<Field id="name" label="Nome completo" type="text" ph="Maria Silva" val={name} set={setName} Icon={Ic.User} hint="Nome e sobrenome." />}
              <Field id="email" label="E-mail" type="email" ph="seu@email.com" val={email} set={setEmail} Icon={Ic.Mail} />
              <Field id="pass" label="Senha" type="password" ph={isReg?'Mínimo 6 caracteres':'Sua senha'} val={pass} set={setPass} Icon={Ic.Lock} hint={isReg?'Pelo menos 6 caracteres.':undefined} />
              {isReg&&<Field id="conf" label="Confirmar senha" type="password" ph="Repita a senha" val={conf} set={setConf} Icon={Ic.Check} />}

              {error&&(
                <div className="flex gap-3 rounded-xl border border-red-100 bg-red-50/90 px-4 py-3">
                  <span className="mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">!</span>
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}
              {msg&&(
                <div className="flex gap-3 rounded-xl border border-emerald-100 bg-emerald-50/90 px-4 py-3">
                  <span className="mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full bg-emerald-500 text-[9px] font-bold text-white">✓</span>
                  <p className="text-sm text-emerald-700">{msg}</p>
                </div>
              )}

              <button type="submit" disabled={busy}
                className="btn-brand mt-1 w-full rounded-2xl py-4 text-sm font-semibold tracking-wide disabled:opacity-55">
                {busy
                  ?<span className="flex items-center justify-center gap-2.5"><span className="h-4 w-4 rounded-full border-2 border-white/25 border-t-white animate-spin"/>Processando...</span>
                  :isReg?'Criar conta':'Entrar'}
              </button>
            </form>

            <div className="hr-brand my-5" />

            <button type="button" onClick={toggle}
              className="w-full text-center text-sm text-[#9a7282] hover:text-[#4a2435] transition">
              {isReg?'Já tem conta? ':'Não tem conta? '}
              <span className="font-semibold text-[#8b3f5a] underline underline-offset-2">
                {isReg?'Entrar':'Cadastre-se'}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
