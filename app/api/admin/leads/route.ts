import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  if (!getAuthUser(request)) {
    return NextResponse.json({ message: 'Não autorizado.' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const rawPage = parseInt(searchParams.get('page') ?? '1', 10);
  const rawLimit = parseInt(searchParams.get('limit') ?? '30', 10);
  const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 && rawLimit <= 100 ? rawLimit : 30;
  const skip = (page - 1) * limit;

  const [data, total] = await Promise.all([
    prisma.lead.findMany({
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        token: { select: { campanha: true, slug: true } },
        analise: { select: { id: true, emailEnviado: true, createdAt: true, resultado: true } },
      },
    }),
    prisma.lead.count(),
  ]);

  return NextResponse.json({ data, total, page, limit });
}
