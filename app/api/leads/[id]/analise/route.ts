import { NextResponse, after } from 'next/server';
import { randomBytes, createHmac, timingSafeEqual } from 'crypto';
import { promises as dns } from 'dns';
import { isIP } from 'net';
import nodemailer from 'nodemailer';
import { prisma } from '@/lib/prisma';
import { analisarImagem, uploadToSupabase, validateMagicBytes, validateLandmarks, type ResultadoAnalise } from '@/lib/analise';
import { assertSafeUrl, isPrivateIp } from '@/lib/ssrf';
import { syncLeadToWooCommerce } from '@/lib/woocommerce';

function makeAnalysisToken(leadId: string): string {
  const secret = process.env.ANALYSIS_TOKEN_SECRET ?? process.env.JWT_SECRET ?? 'fallback_dev_secret';
  if (process.env.NODE_ENV === 'production' && !process.env.ANALYSIS_TOKEN_SECRET && !process.env.JWT_SECRET) {
    throw new Error('ANALYSIS_TOKEN_SECRET must be set in production');
  }
  return createHmac('sha256', secret).update(leadId).digest('hex');
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function validateAnalysisToken(leadId: string, provided: string): boolean {
  const expected = makeAnalysisToken(leadId);
  if (provided.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
}

export const maxDuration = 60;

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

// Best-effort in-memory rate limiter (resets per cold start in serverless)
const ipBucket = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 60 * 60 * 1000;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = ipBucket.get(ip);
  if (!entry || now > entry.resetAt) {
    ipBucket.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT) return false;
  entry.count++;
  return true;
}

async function enviarEmailProtocolo(
  email: string,
  nome: string,
  resultado: ResultadoAnalise,
  analiseId: string,
) {
  const gmailUser = process.env.GMAIL_USER;
  const gmailPass = process.env.GMAIL_APP_PASSWORD;
  if (!gmailUser || !gmailPass) {
    console.log(`[Email] GMAIL_USER/GMAIL_APP_PASSWORD não configurados — protocolo para ${email} (${nome})`);
    return;
  }

  function nivelBadge(nivel: string): string {
    const alto  = ['Alta', 'Severa', 'Moderada'];
    const medio = ['Media', 'Leve'];
    if (alto.includes(nivel))  return `<span style="display:inline-block;padding:2px 10px;border-radius:20px;font-size:11px;font-weight:700;background:#fce4ec;color:#b71c1c;">${escapeHtml(nivel)}</span>`;
    if (medio.includes(nivel)) return `<span style="display:inline-block;padding:2px 10px;border-radius:20px;font-size:11px;font-weight:700;background:#fff8e1;color:#e65100;">${escapeHtml(nivel)}</span>`;
    return `<span style="display:inline-block;padding:2px 10px;border-radius:20px;font-size:11px;font-weight:700;background:#e8f5e9;color:#1b5e20;">${escapeHtml(nivel)}</span>`;
  }

  const fmtBRL = (n: number) =>
    n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  function precoBloco(p: { precoPromocional?: number; precoNormal?: number }): string {
    if (p.precoPromocional && p.precoNormal && p.precoPromocional < p.precoNormal) {
      return `<p style="margin:8px 0 0;font-size:14px;color:#4a2435;"><span style="text-decoration:line-through;color:#b8a0ac;">${fmtBRL(p.precoNormal)}</span> <strong style="color:#7a3f56;">${fmtBRL(p.precoPromocional)}</strong></p>`;
    }
    if (p.precoPromocional || p.precoNormal) {
      return `<p style="margin:8px 0 0;font-size:14px;color:#4a2435;"><strong>${fmtBRL((p.precoPromocional ?? p.precoNormal)!)}</strong></p>`;
    }
    return '';
  }

  function linkBloco(link?: string): string {
    if (!link) return '';
    // escapeHtml protege o atributo href de injeção (aspas/ângulos)
    return `<p style="margin:10px 0 0;"><a href="${escapeHtml(link)}" style="display:inline-block;padding:8px 16px;background:#b96f8d;color:#fff;text-decoration:none;font-size:13px;font-weight:600;border-radius:8px;">Ver produto →</a></p>`;
  }

  const produtosHtml = resultado.recomendacoes
    .map(
      (p, i) => `
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:14px;border-radius:12px;overflow:hidden;border:1px solid #f0dde6;">
        <tr>
          <td width="48" valign="top" style="padding:16px 0 16px 16px;">
            <div style="width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,#4a2435,#b96f8d);color:#fff;font-size:15px;font-weight:700;text-align:center;line-height:36px;">${i + 1}</div>
          </td>
          <td valign="top" style="padding:16px 16px 16px 12px;">
            <p style="margin:0 0 4px;font-size:14px;font-weight:700;color:#4a2435;">${escapeHtml(p.nome)}</p>
            ${p.motivo ? `<p style="margin:0 0 8px;font-size:13px;color:#7a5060;line-height:1.5;">${escapeHtml(p.motivo)}</p>` : ''}
            <p style="margin:0;font-size:12px;color:#b96f8d;background:#fdf8fb;border-radius:6px;padding:6px 10px;display:inline-block;">
              <strong style="color:#4a2435;">Como usar:</strong> ${escapeHtml(p.modoDeUso)}
            </p>
            ${precoBloco(p)}
            ${linkBloco(p.link)}
          </td>
        </tr>
      </table>`,
    )
    .join('');

  const ano = new Date().getFullYear();

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="light">
  <title>Seu Protocolo de Pele — Patrícia Elias</title>
</head>
<body style="margin:0;padding:0;background:#f3e8ee;font-family:Georgia,'Times New Roman',serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f3e8ee;padding:32px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 8px 40px rgba(74,36,53,.13);">

  <!-- HEADER -->
  <tr>
    <td style="background:linear-gradient(150deg,#3b1a28 0%,#6d2b45 50%,#b96f8d 100%);padding:0;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="padding:40px 40px 16px;text-align:center;">
            <p style="margin:0 0 6px;font-size:10px;letter-spacing:0.35em;text-transform:uppercase;color:rgba(255,255,255,.55);font-family:Arial,sans-serif;">Patrícia Elias · Skin Intelligence</p>
            <h1 style="margin:0;font-size:30px;font-weight:400;color:#fff;letter-spacing:0.5px;line-height:1.2;">Seu Protocolo<br><em>Personalizado de Pele</em></h1>
          </td>
        </tr>
        <tr>
          <td style="padding:0 40px 40px;text-align:center;">
            <div style="display:inline-block;width:48px;height:1px;background:rgba(255,255,255,.3);vertical-align:middle;"></div>
            <span style="display:inline-block;margin:0 12px;font-size:18px;color:rgba(255,255,255,.5);">✦</span>
            <div style="display:inline-block;width:48px;height:1px;background:rgba(255,255,255,.3);vertical-align:middle;"></div>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- SAUDAÇÃO -->
  <tr>
    <td style="padding:36px 40px 0;">
      <p style="margin:0 0 12px;font-size:22px;font-weight:400;color:#4a2435;">Olá, <strong>${escapeHtml(nome)}</strong> 🌸</p>
      <p style="margin:0;font-size:14px;color:#7a5060;line-height:1.8;font-family:Arial,sans-serif;">
        Sua análise facial com inteligência artificial foi concluída com sucesso.<br>
        Preparamos um diagnóstico completo e um protocolo de cuidados exclusivo,<br>
        desenvolvido especialmente para o seu tipo de pele.
      </p>
    </td>
  </tr>

  <!-- DIVISOR -->
  <tr>
    <td style="padding:28px 40px 0;">
      <div style="height:1px;background:linear-gradient(to right,transparent,#e0c8d4,transparent);"></div>
    </td>
  </tr>

  <!-- DIAGNÓSTICO TÍTULO -->
  <tr>
    <td style="padding:28px 40px 16px;">
      <p style="margin:0 0 4px;font-size:10px;font-weight:700;letter-spacing:0.25em;text-transform:uppercase;color:#b96f8d;font-family:Arial,sans-serif;">Diagnóstico Facial</p>
      <p style="margin:0;font-size:18px;color:#4a2435;font-weight:400;">Resultado da sua análise</p>
    </td>
  </tr>

  <!-- TIPO DE PELE DESTAQUE -->
  <tr>
    <td style="padding:0 40px 20px;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg,#fdf2f7,#f7e8f0);border-radius:14px;border:1px solid #f0dde6;">
        <tr>
          <td style="padding:20px 24px;">
            <p style="margin:0 0 6px;font-size:10px;letter-spacing:0.2em;text-transform:uppercase;color:#b96f8d;font-family:Arial,sans-serif;">Tipo de Pele Identificado</p>
            <p style="margin:0;font-size:26px;font-weight:400;color:#4a2435;">${escapeHtml(resultado.tipoPele)}</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- MÉTRICAS 2x2 -->
  <tr>
    <td style="padding:0 40px 8px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td width="48%" valign="top" style="padding-right:8px;padding-bottom:12px;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#fff;border:1px solid #f0dde6;border-radius:12px;">
              <tr>
                <td style="padding:16px 18px;">
                  <p style="margin:0 0 6px;font-size:10px;letter-spacing:0.15em;text-transform:uppercase;color:#b8a0ac;font-family:Arial,sans-serif;">Oleosidade</p>
                  ${nivelBadge(resultado.nivelOleosidade)}
                </td>
              </tr>
            </table>
          </td>
          <td width="48%" valign="top" style="padding-left:8px;padding-bottom:12px;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#fff;border:1px solid #f0dde6;border-radius:12px;">
              <tr>
                <td style="padding:16px 18px;">
                  <p style="margin:0 0 6px;font-size:10px;letter-spacing:0.15em;text-transform:uppercase;color:#b8a0ac;font-family:Arial,sans-serif;">Acne</p>
                  ${nivelBadge(resultado.nivelAcne)}
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td width="48%" valign="top" style="padding-right:8px;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#fff;border:1px solid #f0dde6;border-radius:12px;">
              <tr>
                <td style="padding:16px 18px;">
                  <p style="margin:0 0 6px;font-size:10px;letter-spacing:0.15em;text-transform:uppercase;color:#b8a0ac;font-family:Arial,sans-serif;">Sensibilidade</p>
                  ${nivelBadge(resultado.nivelSensibilidade)}
                </td>
              </tr>
            </table>
          </td>
          <td width="48%" valign="top" style="padding-left:8px;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#fff;border:1px solid #f0dde6;border-radius:12px;">
              <tr>
                <td style="padding:16px 18px;">
                  <p style="margin:0 0 6px;font-size:10px;letter-spacing:0.15em;text-transform:uppercase;color:#b8a0ac;font-family:Arial,sans-serif;">Status</p>
                  <span style="display:inline-block;padding:2px 10px;border-radius:20px;font-size:11px;font-weight:700;background:#e8f5e9;color:#1b5e20;">Concluído</span>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- OBSERVAÇÕES DA IA -->
  ${resultado.observacoes && !resultado.modoFallback ? `
  <tr>
    <td style="padding:8px 40px 0;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#fdf8fb;border-radius:12px;border-left:4px solid #b96f8d;">
        <tr>
          <td style="padding:18px 20px;">
            <p style="margin:0 0 6px;font-size:10px;letter-spacing:0.2em;text-transform:uppercase;color:#b96f8d;font-family:Arial,sans-serif;">Observação da IA</p>
            <p style="margin:0;font-size:13px;font-style:italic;color:#5a3545;line-height:1.7;font-family:Georgia,serif;">"${escapeHtml(resultado.observacoes)}"</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>` : ''}

  <!-- DIVISOR -->
  <tr>
    <td style="padding:28px 40px 0;">
      <div style="height:1px;background:linear-gradient(to right,transparent,#e0c8d4,transparent);"></div>
    </td>
  </tr>

  <!-- PROTOCOLO TÍTULO -->
  <tr>
    <td style="padding:28px 40px 16px;">
      <p style="margin:0 0 4px;font-size:10px;font-weight:700;letter-spacing:0.25em;text-transform:uppercase;color:#b96f8d;font-family:Arial,sans-serif;">Protocolo Exclusivo</p>
      <p style="margin:0;font-size:18px;color:#4a2435;font-weight:400;">Produtos recomendados para você</p>
    </td>
  </tr>

  <!-- PRODUTOS -->
  <tr>
    <td style="padding:0 40px;">
      ${produtosHtml}
    </td>
  </tr>

  <!-- CTA -->
  <tr>
    <td style="padding:28px 40px 0;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg,#4a2435,#b96f8d);border-radius:14px;">
        <tr>
          <td style="padding:24px 28px;text-align:center;">
            <p style="margin:0 0 6px;font-size:13px;color:rgba(255,255,255,.8);font-family:Arial,sans-serif;">Dúvidas sobre seu protocolo?</p>
            <p style="margin:0;font-size:16px;font-weight:700;color:#fff;font-family:Arial,sans-serif;">Entre em contato com Patrícia Elias</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- NOTA DE RODAPÉ -->
  <tr>
    <td style="padding:24px 40px 0;">
      <p style="margin:0;font-size:12px;color:#b8a0ac;line-height:1.6;font-family:Arial,sans-serif;text-align:center;">
        Este protocolo foi gerado por inteligência artificial com base em sua análise facial.<br>
        Para um diagnóstico aprofundado, consulte sempre uma dermatologista.
      </p>
    </td>
  </tr>

  <!-- FOOTER -->
  <tr>
    <td style="padding:28px 40px 36px;text-align:center;">
      <div style="height:1px;background:linear-gradient(to right,transparent,#e0c8d4,transparent);margin-bottom:24px;"></div>
      <p style="margin:0 0 4px;font-size:13px;color:#4a2435;font-weight:600;font-family:Arial,sans-serif;">Patrícia Elias · Skin Intelligence</p>
      <p style="margin:0;font-size:11px;color:#c0a0ac;font-family:Arial,sans-serif;">© ${ano} · Todos os direitos reservados</p>
    </td>
  </tr>

</table>
</td></tr>
</table>
</body>
</html>`;

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: gmailUser, pass: gmailPass },
  });

  await transporter.sendMail({
    from: `Patrícia Elias Skin <${gmailUser}>`,
    to: email,
    subject: `${nome}, seu protocolo personalizado de pele está aqui`,
    html,
  });

  await prisma.skinAnalysis.update({
    where: { id: analiseId },
    data: { emailEnviado: true },
  });

  console.log(`[Email] Protocolo enviado para ${email}`);
}

async function dispararWebhook(
  lead: { id: string; nome: string; email: string; telefone: string; desejaMelhorar: string; createdAt: Date },
  campanha: string,
  resultado: ResultadoAnalise,
) {
  const settings = await prisma.settings.findUnique({ where: { id: 'default' } });
  if (!settings?.webhookUrl) return;

  try {
    assertSafeUrl(settings.webhookUrl);
  } catch (e) {
    console.warn('[Webhook] URL inválida ignorada:', (e as Error).message);
    return;
  }

  // DNS rebinding check: resolve the hostname right before fetching
  try {
    const hostname = new URL(settings.webhookUrl).hostname;
    if (!isIP(hostname)) {
      const { address } = await dns.lookup(hostname, { family: 4 });
      if (isPrivateIp(address)) {
        console.warn('[Webhook] Domínio resolveu para IP privado:', address);
        return;
      }
    }
  } catch {
    console.warn('[Webhook] Falha ao resolver DNS — webhook bloqueado.');
    return;
  }

  const payload = {
    event: 'lead.analyzed',
    timestamp: new Date().toISOString(),
    data: {
      lead: {
        id: lead.id,
        nome: lead.nome,
        email: lead.email,
        telefone: lead.telefone,
        desejaMelhorar: lead.desejaMelhorar,
        campanha,
        criadoEm: lead.createdAt,
      },
      analise: resultado,
    },
  };

  const body = JSON.stringify(payload);
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };

  const secret = process.env.WEBHOOK_SECRET;
  if (secret) {
    headers['X-Jolu-Signature'] = `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    await fetch(settings.webhookUrl, { method: 'POST', headers, body, signal: controller.signal });
    console.log(`[Webhook] Disparado para ${settings.webhookUrl}`);
  } finally {
    clearTimeout(timeout);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: leadId } = await params;

    // Rate limit by leadId (resource-scoped, not IP-spoofable)
    if (!checkRateLimit(leadId)) {
      return NextResponse.json(
        { message: 'Muitas tentativas. Tente novamente mais tarde.' },
        { status: 429 },
      );
    }

    const lead = await prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead) {
      return NextResponse.json({ message: 'Lead não encontrado.' }, { status: 404 });
    }

    const existing = await prisma.skinAnalysis.findUnique({ where: { leadId } });
    if (existing) {
      return NextResponse.json({ success: true });
    }

    const formData = await request.formData();
    const file = formData.get('image') as File | null;
    const landmarksJson = formData.get('landmarks') as string | null;
    const providedToken = (formData.get('analysisToken') as string | null) ?? '';

    // Verify HMAC token to prevent IDOR (unauthorized submission for any leadId)
    if (!validateAnalysisToken(leadId, providedToken)) {
      return NextResponse.json({ message: 'Token de análise inválido.' }, { status: 403 });
    }

    if (!file) {
      return NextResponse.json({ message: 'Nenhuma imagem foi enviada.' }, { status: 400 });
    }

    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json({ message: 'Tipo de arquivo não permitido. Use JPEG, PNG ou WebP.' }, { status: 415 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    if (buffer.length > MAX_BYTES) {
      return NextResponse.json({ message: 'Arquivo muito grande. Máximo 10 MB.' }, { status: 413 });
    }

    // Validate magic bytes — file.type is client-controlled and can be spoofed
    if (!validateMagicBytes(buffer, file.type)) {
      return NextResponse.json({ message: 'Conteúdo do arquivo não corresponde ao tipo declarado.' }, { status: 415 });
    }

    let landmarks = null;
    if (landmarksJson) {
      try {
        landmarks = validateLandmarks(JSON.parse(landmarksJson));
      } catch {
        return NextResponse.json({ message: 'Formato de landmarks inválido.' }, { status: 400 });
      }
      if (landmarks === null) {
        return NextResponse.json({ message: 'Estrutura de landmarks inválida.' }, { status: 400 });
      }
    }

    const filePath = `leads/${Date.now()}-${randomBytes(4).toString('hex')}.jpg`;
    const publicUrl = await uploadToSupabase(buffer, filePath, 'image/jpeg');

    const resultado = await analisarImagem(buffer, landmarks, lead.clinicId);

    const registro = await prisma.skinAnalysis.create({
      data: {
        leadId,
        clinicId: lead.clinicId,
        catalogSourceId: resultado.catalogSourceId ?? null,
        imageUrl: publicUrl,
        resultado,
      },
    });

    const tokenInfo = await prisma.campaignToken.findUnique({ where: { id: lead.tokenId } });

    // Use after() so these run after the response is delivered,
    // ensuring the Vercel sandbox stays alive long enough to complete them.
    after(() =>
      enviarEmailProtocolo(lead.email, lead.nome, resultado, registro.id).catch((err) =>
        console.error('[Email] Falha ao enviar protocolo:', err),
      ),
    );

    after(() =>
      dispararWebhook(lead, tokenInfo?.campanha ?? '', resultado).catch((err) =>
        console.error('[Webhook] Falha ao disparar:', err),
      ),
    );

    after(() =>
      syncLeadToWooCommerce(lead.nome, lead.email, lead.telefone, resultado).catch((err) =>
        console.error('[WC] Falha ao sincronizar cliente:', err),
      ),
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[leads/analise]', err instanceof Error ? err.message : 'unknown error');
    return NextResponse.json({ message: 'Erro interno.' }, { status: 500 });
  }
}
