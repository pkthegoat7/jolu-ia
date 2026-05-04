import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';

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

  const body = await request.json() as { webhookUrl?: string };

  const settings = await prisma.settings.upsert({
    where: { id: 'default' },
    update: { webhookUrl: body.webhookUrl ?? null },
    create: { id: 'default', webhookUrl: body.webhookUrl ?? null },
  });

  return NextResponse.json({ webhookUrl: settings.webhookUrl ?? '' });
}
