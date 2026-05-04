import { NextResponse } from 'next/server';

export const maxDuration = 60;
import { randomBytes } from 'crypto';
import { prisma } from '@/lib/prisma';
import { analisarImagem, uploadToSupabase, type ResultadoAnalise } from '@/lib/analise';
import { Resend } from 'resend';

async function enviarEmailProtocolo(
  email: string,
  nome: string,
  resultado: ResultadoAnalise,
  analiseId: string,
) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.log(`[Email] RESEND_API_KEY não configurada — protocolo para ${email} (${nome})`);
    return;
  }

  const resend = new Resend(apiKey);

  const produtosHtml = resultado.recomendacoes
    .map(
      (p, i) => `
      <div style="margin-bottom:16px;padding:16px;background:#fdf8fb;border-left:3px solid #b96f8d;border-radius:8px;">
        <p style="margin:0 0 6px;font-weight:700;color:#4a2435;">${i + 1}. ${p.nome}</p>
        <p style="margin:0 0 4px;color:#7a5060;font-size:14px;">${p.motivo}</p>
        <p style="margin:0;color:#9a7282;font-size:13px;"><strong>Modo de uso:</strong> ${p.modoDeUso}</p>
      </div>`,
    )
    .join('');

  const html = `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
    <body style="margin:0;padding:0;background:#f7f0f3;font-family:Inter,Arial,sans-serif;">
      <div style="max-width:580px;margin:32px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(74,36,53,.10);">
        <div style="background:linear-gradient(135deg,#4a2435,#b96f8d);padding:32px 32px 24px;text-align:center;">
          <p style="margin:0 0 4px;font-size:11px;letter-spacing:0.3em;text-transform:uppercase;color:rgba(255,255,255,.6);">Patrícia Elias</p>
          <h1 style="margin:0;font-size:26px;font-weight:300;color:#fff;letter-spacing:-0.5px;">Seu Protocolo de Pele</h1>
        </div>
        <div style="padding:32px;">
          <p style="margin:0 0 20px;font-size:16px;color:#4a2435;">Olá, <strong>${nome}</strong>!</p>
          <p style="margin:0 0 24px;font-size:14px;color:#7a5060;line-height:1.6;">
            Sua análise facial foi concluída. Abaixo está seu diagnóstico completo e o protocolo de cuidados personalizado para você.
          </p>
          <div style="background:#f7f0f3;border-radius:12px;padding:20px;margin-bottom:24px;">
            <p style="margin:0 0 12px;font-size:10px;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;color:#b8a0ac;">Diagnóstico</p>
            <table style="width:100%;border-collapse:collapse;">
              <tr><td style="padding:6px 0;font-size:13px;color:#9a7282;width:140px;">Tipo de Pele</td><td style="padding:6px 0;font-size:13px;font-weight:600;color:#4a2435;">${resultado.tipoPele}</td></tr>
              <tr><td style="padding:6px 0;font-size:13px;color:#9a7282;">Oleosidade</td><td style="padding:6px 0;font-size:13px;font-weight:600;color:#4a2435;">${resultado.nivelOleosidade}</td></tr>
              <tr><td style="padding:6px 0;font-size:13px;color:#9a7282;">Acne</td><td style="padding:6px 0;font-size:13px;font-weight:600;color:#4a2435;">${resultado.nivelAcne}</td></tr>
              <tr><td style="padding:6px 0;font-size:13px;color:#9a7282;">Sensibilidade</td><td style="padding:6px 0;font-size:13px;font-weight:600;color:#4a2435;">${resultado.nivelSensibilidade}</td></tr>
            </table>
            ${resultado.observacoes && !resultado.observacoes.includes('fallback')
              ? `<p style="margin:12px 0 0;font-size:13px;font-style:italic;color:#9a7282;border-left:2px solid #c07898;padding-left:12px;">"${resultado.observacoes}"</p>`
              : ''}
          </div>
          <p style="margin:0 0 14px;font-size:10px;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;color:#b8a0ac;">Protocolo Recomendado</p>
          ${produtosHtml}
          <p style="margin:24px 0 0;font-size:13px;color:#9a7282;line-height:1.6;">
            Em caso de dúvidas, entre em contato com Patrícia Elias diretamente.
          </p>
        </div>
        <div style="padding:20px 32px;background:#f7f0f3;text-align:center;border-top:1px solid #e8d0db;">
          <p style="margin:0;font-size:11px;color:#b8a0ac;">© ${new Date().getFullYear()} Patrícia Elias · Skin Intelligence</p>
        </div>
      </div>
    </body>
    </html>`;

  await resend.emails.send({
    from: 'Patrícia Elias Skin <onboarding@resend.dev>',
    to: email,
    subject: `${nome}, seu protocolo personalizado de pele está aqui`,
    html,
  });

  await prisma.leadAnalise.update({
    where: { id: analiseId },
    data: { emailEnviado: true },
  });

  console.log(`[Email] Protocolo enviado para ${email}`);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: leadId } = await params;

    const lead = await prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead) {
      return NextResponse.json({ message: 'Lead não encontrado.' }, { status: 404 });
    }

    const existing = await prisma.leadAnalise.findUnique({ where: { leadId } });
    if (existing) {
      return NextResponse.json({ success: true });
    }

    const formData = await request.formData();
    const file = formData.get('image') as File | null;
    const landmarksJson = formData.get('landmarks') as string | null;

    if (!file) {
      return NextResponse.json({ message: 'Nenhuma imagem foi enviada.' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const landmarks = landmarksJson ? JSON.parse(landmarksJson) : null;

    const filePath = `leads/${Date.now()}-${randomBytes(4).toString('hex')}.jpg`;
    const publicUrl = await uploadToSupabase(buffer, filePath, 'image/jpeg');

    const resultado = await analisarImagem(buffer, landmarks);

    const registro = await prisma.leadAnalise.create({
      data: { leadId, imageUrl: publicUrl, resultado },
    });

    enviarEmailProtocolo(lead.email, lead.nome, resultado, registro.id).catch((err) =>
      console.error('[Email] Falha ao enviar protocolo:', err),
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[leads/analise]', err);
    return NextResponse.json({ message: 'Erro interno.' }, { status: 500 });
  }
}
