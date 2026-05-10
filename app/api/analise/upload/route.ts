import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { requireAdmin } from '@/lib/jwt';
import { analisarImagem, uploadToSupabase, validateMagicBytes, validateLandmarks } from '@/lib/analise';
import { prisma } from '@/lib/prisma';

export const maxDuration = 60;

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_BYTES = 10 * 1024 * 1024;

export async function POST(request: Request) {
  const user = requireAdmin(request);
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

    if (!validateMagicBytes(buffer, file.type)) {
      return NextResponse.json({ message: 'Conteúdo do arquivo não corresponde ao tipo declarado.' }, { status: 415 });
    }

    let landmarks = null;
    if (landmarksJson) {
      try {
        landmarks = validateLandmarks(JSON.parse(landmarksJson));
      } catch {
        return NextResponse.json({ message: 'Formato de landmarks inválido.' }, { status: 400 });
      }
    }

    const userId = typeof user.sub === 'string' ? user.sub : null;
    if (!userId) {
      return NextResponse.json({ message: 'Token inválido.' }, { status: 401 });
    }

    const dbUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { clinicId: true },
    });
    if (!dbUser?.clinicId) {
      return NextResponse.json(
        { message: 'Usuário não está vinculado a uma clínica.' },
        { status: 400 },
      );
    }

    const filePath = `fotos/${randomUUID()}.jpg`;
    const publicUrl = await uploadToSupabase(buffer, filePath, 'image/jpeg');

    const resultado = await analisarImagem(buffer, landmarks, dbUser.clinicId);

    const analise = await prisma.analise.create({
      data: { userId, imageUrl: publicUrl, resultado },
      include: { usuario: { select: { name: true } } },
    });

    return NextResponse.json(analise);
  } catch (err) {
    console.error('[analise/upload]', err instanceof Error ? err.message : 'unknown error');
    return NextResponse.json({ message: 'Erro ao processar análise.' }, { status: 500 });
  }
}
