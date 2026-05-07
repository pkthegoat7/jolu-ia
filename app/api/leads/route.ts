import { NextResponse } from 'next/server';
import { createHmac } from 'crypto';
import { prisma } from '@/lib/prisma';

function makeAnalysisToken(leadId: string): string {
  const secret = process.env.JWT_SECRET ?? 'fallback_dev_secret';
  return createHmac('sha256', secret).update(leadId).digest('hex');
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as {
      nome?: string;
      email?: string;
      telefone?: string;
      desejaMelhorar?: string;
      tokenSlug?: string;
    };

    const { nome, email, telefone, desejaMelhorar, tokenSlug } = body;

    if (!nome || !email || !telefone || !desejaMelhorar || !tokenSlug) {
      return NextResponse.json({ message: 'Todos os campos são obrigatórios.' }, { status: 400 });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ message: 'Email inválido.' }, { status: 400 });
    }

    const token = await prisma.campaignToken.findUnique({ where: { slug: tokenSlug } });
    if (!token || !token.ativo) {
      return NextResponse.json({ message: 'Link inválido ou expirado.' }, { status: 400 });
    }

    const lead = await prisma.lead.create({
      data: { nome, email, telefone, desejaMelhorar, tokenId: token.id },
    });

    return NextResponse.json(
      { id: lead.id, nome: lead.nome, analysisToken: makeAnalysisToken(lead.id) },
      { status: 201 },
    );
  } catch (err) {
    console.error('[leads POST]', err);
    return NextResponse.json({ message: 'Erro interno.' }, { status: 500 });
  }
}
