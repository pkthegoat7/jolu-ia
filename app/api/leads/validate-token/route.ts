import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const slug = searchParams.get('slug');

  if (!slug) {
    return NextResponse.json({ valid: false });
  }

  const token = await prisma.campaignToken.findUnique({ where: { slug } });
  if (!token || !token.ativo) {
    return NextResponse.json({ valid: false });
  }

  return NextResponse.json({ valid: true, campanha: token.campanha });
}
