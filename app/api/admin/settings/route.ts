import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';
import { isSafeUrl } from '@/lib/ssrf';

export async function GET(request: Request) {
  if (!getAuthUser(request)) {
    return NextResponse.json({ message: 'Não autorizado.' }, { status: 401 });
  }

  const settings = await prisma.settings.findUnique({ where: { id: 'default' } });
  return NextResponse.json({ webhookUrl: settings?.webhookUrl ?? '' });
}

export async function PUT(request: Request) {
  if (!getAuthUser(request)) {
    return NextResponse.json({ message: 'Não autorizado.' }, { status: 401 });
  }

  const body = await request.json() as { webhookUrl?: string | null };
  const url = body.webhookUrl?.trim() || null;

  if (url) {
    const check = isSafeUrl(url);
    if (!check.ok) {
      return NextResponse.json({ message: check.reason }, { status: 400 });
    }
  }

  const settings = await prisma.settings.upsert({
    where: { id: 'default' },
    update: { webhookUrl: url },
    create: { id: 'default', webhookUrl: url },
  });

  return NextResponse.json({ webhookUrl: settings.webhookUrl ?? '' });
}
