import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

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

    const token = await prisma.campaignToken.findUnique({ where: { slug: tokenSlug } });
    if (!token || !token.ativo) {
      return NextResponse.json({ message: 'Link inválido ou expirado.' }, { status: 400 });
    }

    const lead = await prisma.lead.create({
      data: { nome, email, telefone, desejaMelhorar, tokenId: token.id },
    });

    return NextResponse.json({ id: lead.id, nome: lead.nome }, { status: 201 });
  } catch (err) {
    console.error('[leads POST]', err);
    return NextResponse.json({ message: 'Erro interno.' }, { status: 500 });
  }
}
