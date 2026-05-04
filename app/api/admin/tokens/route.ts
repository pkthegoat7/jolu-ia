import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { getAuthUser } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  if (!getAuthUser(request)) {
    return NextResponse.json({ message: 'Não autorizado.' }, { status: 401 });
  }

  const tokens = await prisma.campaignToken.findMany({
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { leads: true } } },
  });

  return NextResponse.json(tokens);
}

export async function POST(request: Request) {
  if (!getAuthUser(request)) {
    return NextResponse.json({ message: 'Não autorizado.' }, { status: 401 });
  }

  try {
    const body = await request.json() as { campanha?: string; slug?: string };
    const { campanha, slug } = body;

    if (!campanha) {
      return NextResponse.json({ message: 'Nome da campanha é obrigatório.' }, { status: 400 });
    }

    const finalSlug = slug?.trim() || randomBytes(6).toString('hex');

    const token = await prisma.campaignToken.create({
      data: { campanha, slug: finalSlug },
    });

    return NextResponse.json(token, { status: 201 });
  } catch (err: unknown) {
    const code = (err as { code?: string }).code;
    if (code === 'P2002') {
      return NextResponse.json({ message: 'Slug já em uso.' }, { status: 409 });
    }
    console.error('[admin/tokens POST]', err);
    return NextResponse.json({ message: 'Erro interno.' }, { status: 500 });
  }
}
