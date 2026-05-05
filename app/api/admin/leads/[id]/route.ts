import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!getAuthUser(request)) {
    return NextResponse.json({ message: 'Não autorizado.' }, { status: 401 });
  }

  const { id } = await params;

  const lead = await prisma.lead.findUnique({
    where: { id },
    include: { token: true, analise: true },
  });

  if (!lead) {
    return NextResponse.json({ message: 'Lead não encontrado.' }, { status: 404 });
  }

  return NextResponse.json(lead);
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!getAuthUser(request)) {
    return NextResponse.json({ message: 'Não autorizado.' }, { status: 401 });
  }

  const { id } = await params;

  const lead = await prisma.lead.findUnique({ where: { id }, select: { id: true } });
  if (!lead) {
    return NextResponse.json({ message: 'Lead não encontrado.' }, { status: 404 });
  }

  // SkinAnalysis is deleted automatically via ON DELETE CASCADE
  await prisma.lead.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
