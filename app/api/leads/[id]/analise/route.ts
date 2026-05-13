import { NextResponse, after } from 'next/server';
import { randomBytes, createHmac, timingSafeEqual } from 'crypto';
import { promises as dns } from 'dns';
import { isIP } from 'net';
import nodemailer from 'nodemailer';
import { prisma } from '@/lib/prisma';
import { analisarImagem, uploadToSupabase, validateMagicBytes, validateLandmarks, type ResultadoAnalise } from '@/lib/analise';
import { assertSafeUrl, isPrivateIp } from '@/lib/ssrf';
import { syncLeadToWooCommerce } from '@/lib/woocommerce';
import { renderProtocoloEmail } from '@/lib/email-template';

function makeAnalysisToken(leadId: string): string {
  const secret = process.env.ANALYSIS_TOKEN_SECRET ?? process.env.JWT_SECRET ?? 'fallback_dev_secret';
  if (process.env.NODE_ENV === 'production' && !process.env.ANALYSIS_TOKEN_SECRET && !process.env.JWT_SECRET) {
    throw new Error('ANALYSIS_TOKEN_SECRET must be set in production');
  }
  return createHmac('sha256', secret).update(leadId).digest('hex');
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
  clinic: { senderName?: string | null; brandName?: string | null; senderEmail?: string | null } | null,
) {
  const gmailUser = process.env.GMAIL_USER;
  const gmailPass = process.env.GMAIL_APP_PASSWORD;
  if (!gmailUser || !gmailPass) {
    console.log(`[Email] GMAIL_USER/GMAIL_APP_PASSWORD não configurados — protocolo para ${email} (${nome})`);
    return;
  }

  const html = renderProtocoloEmail(nome, resultado, clinic);

  const fromEmail = clinic?.senderEmail || gmailUser;
  const fromName = clinic?.senderName || clinic?.brandName || 'Patrícia Elias Skin';

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: gmailUser, pass: gmailPass },
  });

  await transporter.sendMail({
    from: `${fromName} <${fromEmail}>`,
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
    // Liveness multi-ângulo: aceita 'image_front' (preferencial) ou 'image' (legacy fallback).
    // Os outros frames (left/right/up/down) são opcionais — usados só pelo cliente como anti-spoof.
    const file = (formData.get('image_front') as File | null) ?? (formData.get('image') as File | null);
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

    let resultado;
    try {
      resultado = await analisarImagem(buffer, landmarks, lead.clinicId, lead.desejaMelhorar);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao montar protocolo';
      console.error('[analise] catálogo incompleto:', msg);
      return NextResponse.json({ message: msg }, { status: 422 });
    }

    const registro = await prisma.skinAnalysis.create({
      data: {
        leadId,
        clinicId: lead.clinicId,
        catalogSourceId: resultado.catalogSourceId ?? null,
        imageUrl: publicUrl,
        resultado,
      },
    });

    const [tokenInfo, clinic] = await Promise.all([
      prisma.campaignToken.findUnique({ where: { id: lead.tokenId } }),
      prisma.clinic.findUnique({
        where: { id: lead.clinicId },
        select: { senderName: true, senderEmail: true, brandName: true },
      }),
    ]);

    // Use after() so these run after the response is delivered,
    // ensuring the Vercel sandbox stays alive long enough to complete them.
    after(() =>
      enviarEmailProtocolo(lead.email, lead.nome, resultado, registro.id, clinic).catch((err) =>
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
