import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!getAuthUser(request)) {
    return NextResponse.json({ message: 'Não autorizado.' }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json() as { ativo?: boolean };

  if (typeof body.ativo !== 'boolean') {
    return NextResponse.json({ message: 'Campo "ativo" é obrigatório.' }, { status: 400 });
  }

  const token = await prisma.campaignToken.update({
    where: { id },
    data: { ativo: body.ativo },
  });

  return NextResponse.json(token);
}
