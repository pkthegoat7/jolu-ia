import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';
import { isSafeUrl } from '@/lib/ssrf';

const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function getAdminClinicId(request: Request): Promise<{ clinicId: string } | null> {
  const adminUser = requireAdmin(request);
  if (!adminUser) return null;
  const dbUser = await prisma.user.findUnique({
    where: { id: String(adminUser.sub) },
    select: { clinicId: true },
  });
  if (!dbUser?.clinicId) return null;
  return { clinicId: dbUser.clinicId };
}

export async function GET(request: Request) {
  const ctx = await getAdminClinicId(request);
  if (!ctx) {
    return NextResponse.json({ message: 'Não autorizado.' }, { status: 401 });
  }

  const clinic = await prisma.clinic.findUnique({
    where: { id: ctx.clinicId },
    select: {
      id: true,
      name: true,
      brandName: true,
      brandTagline: true,
      logoUrl: true,
      primaryColor: true,
      senderEmail: true,
      senderName: true,
    },
  });
  if (!clinic) {
    return NextResponse.json({ message: 'Clínica não encontrada.' }, { status: 404 });
  }
  return NextResponse.json(clinic);
}

export async function PATCH(request: Request) {
  const ctx = await getAdminClinicId(request);
  if (!ctx) {
    return NextResponse.json({ message: 'Não autorizado.' }, { status: 401 });
  }

  const body = (await request.json()) as {
    name?: string;
    brandName?: string;
    brandTagline?: string;
    logoUrl?: string | null;
    primaryColor?: string;
    senderEmail?: string | null;
    senderName?: string | null;
  };

  const data: Record<string, string | null> = {};

  if (typeof body.name === 'string') {
    const v = body.name.trim();
    if (!v) return NextResponse.json({ message: 'Nome obrigatório.' }, { status: 400 });
    if (v.length > 200) return NextResponse.json({ message: 'Nome muito longo.' }, { status: 400 });
    data.name = v;
  }

  if (typeof body.brandName === 'string') {
    const v = body.brandName.trim();
    if (v.length > 200) return NextResponse.json({ message: 'brandName muito longo.' }, { status: 400 });
    data.brandName = v;
  }

  if (typeof body.brandTagline === 'string') {
    const v = body.brandTagline.trim();
    if (v.length > 200) return NextResponse.json({ message: 'brandTagline muito longo.' }, { status: 400 });
    data.brandTagline = v;
  }

  if ('logoUrl' in body) {
    const v = body.logoUrl?.trim() || null;
    if (v) {
      const check = isSafeUrl(v);
      if (!check.ok) return NextResponse.json({ message: `logoUrl: ${check.reason}` }, { status: 400 });
      if (v.length > 2048) return NextResponse.json({ message: 'logoUrl muito longa.' }, { status: 400 });
    }
    data.logoUrl = v;
  }

  if (typeof body.primaryColor === 'string') {
    const v = body.primaryColor.trim();
    if (!HEX_COLOR.test(v)) {
      return NextResponse.json({ message: 'primaryColor deve estar no formato #RRGGBB.' }, { status: 400 });
    }
    data.primaryColor = v;
  }

  if ('senderEmail' in body) {
    const v = body.senderEmail?.trim() || null;
    if (v && (!EMAIL_REGEX.test(v) || v.length > 254)) {
      return NextResponse.json({ message: 'senderEmail inválido.' }, { status: 400 });
    }
    data.senderEmail = v;
  }

  if ('senderName' in body) {
    const v = body.senderName?.trim() || null;
    if (v && v.length > 200) {
      return NextResponse.json({ message: 'senderName muito longo.' }, { status: 400 });
    }
    data.senderName = v;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ message: 'Nenhum campo para atualizar.' }, { status: 400 });
  }

  const updated = await prisma.clinic.update({
    where: { id: ctx.clinicId },
    data,
    select: {
      id: true,
      name: true,
      brandName: true,
      brandTagline: true,
      logoUrl: true,
      primaryColor: true,
      senderEmail: true,
      senderName: true,
    },
  });

  return NextResponse.json(updated);
}
