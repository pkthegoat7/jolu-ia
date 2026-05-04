import { NextResponse } from 'next/server';

export const maxDuration = 60;
import { getAuthUser } from '@/lib/jwt';
import { analisarImagem, uploadToSupabase } from '@/lib/analise';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  const user = getAuthUser(request);
  if (!user) {
    return NextResponse.json({ message: 'Não autorizado.' }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('image') as File | null;
    const landmarksJson = formData.get('landmarks') as string | null;

    if (!file) {
      return NextResponse.json({ message: 'Nenhuma imagem foi enviada.' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const landmarks = landmarksJson ? JSON.parse(landmarksJson) : null;

    const filePath = `fotos/${Date.now()}-${file.name}`;
    const publicUrl = await uploadToSupabase(buffer, filePath, file.type || 'image/jpeg');

    const resultado = await analisarImagem(buffer, landmarks);

    const analise = await prisma.analise.create({
      data: { userId: user.sub as string, imageUrl: publicUrl, resultado },
      include: { usuario: { select: { name: true } } },
    });

    return NextResponse.json(analise);
  } catch (err) {
    console.error('[analise/upload]', err);
    return NextResponse.json({ message: 'Erro ao processar análise.' }, { status: 500 });
  }
}
