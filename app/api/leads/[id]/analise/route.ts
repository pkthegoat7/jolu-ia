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

  const produtosHtml = resultado.recomendacoes
    .map(
      (p, i) => `
      <div style="margin-bottom:16px;padding:16px;background:#fdf8fb;border-left:3px solid #b96f8d;border-radius:8px;">
        <p style="margin:0 0 6px;font-weight:700;color:#4a2435;">${i + 1}. ${escapeHtml(p.nome)}</p>
        <p style="margin:0 0 4px;color:#7a5060;font-size:14px;">${escapeHtml(p.motivo)}</p>
        <p style="margin:0;color:#9a7282;font-size:13px;"><strong>Modo de uso:</strong> ${escapeHtml(p.modoDeUso)}</p>
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
          <p style="margin:0 0 20px;font-size:16px;color:#4a2435;">Olá, <strong>${escapeHtml(nome)}</strong>!</p>
          <p style="margin:0 0 24px;font-size:14px;color:#7a5060;line-height:1.6;">
            Sua análise facial foi concluída. Abaixo está seu diagnóstico completo e o protocolo de cuidados personalizado para você.
          </p>
          <div style="background:#f7f0f3;border-radius:12px;padding:20px;margin-bottom:24px;">
            <p style="margin:0 0 12px;font-size:10px;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;color:#b8a0ac;">Diagnóstico</p>
            <table style="width:100%;border-collapse:collapse;">
              <tr><td style="padding:6px 0;font-size:13px;color:#9a7282;width:140px;">Tipo de Pele</td><td style="padding:6px 0;font-size:13px;font-weight:600;color:#4a2435;">${escapeHtml(resultado.tipoPele)}</td></tr>
              <tr><td style="padding:6px 0;font-size:13px;color:#9a7282;">Oleosidade</td><td style="padding:6px 0;font-size:13px;font-weight:600;color:#4a2435;">${escapeHtml(resultado.nivelOleosidade)}</td></tr>
              <tr><td style="padding:6px 0;font-size:13px;color:#9a7282;">Acne</td><td style="padding:6px 0;font-size:13px;font-weight:600;color:#4a2435;">${escapeHtml(resultado.nivelAcne)}</td></tr>
              <tr><td style="padding:6px 0;font-size:13px;color:#9a7282;">Sensibilidade</td><td style="padding:6px 0;font-size:13px;font-weight:600;color:#4a2435;">${escapeHtml(resultado.nivelSensibilidade)}</td></tr>
            </table>
            ${resultado.observacoes && !resultado.modoFallback
              ? `<p style="margin:12px 0 0;font-size:13px;font-style:italic;color:#9a7282;border-left:2px solid #c07898;padding-left:12px;">"${escapeHtml(resultado.observacoes)}"</p>`
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

    const resultado = await analisarImagem(buffer, landmarks);

    const registro = await prisma.skinAnalysis.create({
      data: { leadId, imageUrl: publicUrl, resultado },
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
