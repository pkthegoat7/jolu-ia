import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';

export const maxDuration = 60;
import { getAuthUser } from '@/lib/jwt';
import { analisarImagem, uploadToSupabase } from '@/lib/analise';
import { prisma } from '@/lib/prisma';

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

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

    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json({ message: 'Tipo de arquivo não permitido. Use JPEG, PNG ou WebP.' }, { status: 415 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    if (buffer.length > MAX_BYTES) {
      return NextResponse.json({ message: 'Arquivo muito grande. Máximo 10 MB.' }, { status: 413 });
    }

    const landmarks = landmarksJson ? JSON.parse(landmarksJson) : null;

    // Use UUID — never trust the client-supplied filename
    const filePath = `fotos/${randomUUID()}.jpg`;
    const publicUrl = await uploadToSupabase(buffer, filePath, 'image/jpeg');

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
