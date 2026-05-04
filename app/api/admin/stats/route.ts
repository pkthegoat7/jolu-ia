import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  if (!getAuthUser(request)) {
    return NextResponse.json({ message: 'Não autorizado.' }, { status: 401 });
  }

  const [totalLeads, analisadas, emailsEnviados] = await Promise.all([
    prisma.lead.count(),
    prisma.skinAnalysis.count(),
    prisma.skinAnalysis.count({ where: { emailEnviado: true } }),
  ]);

  return NextResponse.json({
    totalLeads,
    analisadas,
    emailsEnviados,
    pendentes: totalLeads - analisadas,
  });
}
