import { NextResponse } from 'next/server';
import bcrypt from 'bcrypt';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  // Block registration unless explicitly enabled via env var (applies to all environments)
  if (process.env.ALLOW_REGISTRATION !== 'true') {
    return NextResponse.json({ message: 'Registro desabilitado.' }, { status: 403 });
  }

  try {
    const body = await request.json() as { email?: string; password?: string; name?: string };
    const password = body.password;
    const name = body.name;
    const email = body.email?.trim().toLowerCase();

    if (!email || !password || !name) {
      return NextResponse.json(
        { message: 'Email, password, and name are required' },
        { status: 400 },
      );
    }
    if (password.length > 1024) {
      return NextResponse.json({ message: 'Senha muito longa.' }, { status: 400 });
    }

    const salt = await bcrypt.genSalt();
    const passwordHash = await bcrypt.hash(password, salt);

    const user = await prisma.user.create({
      data: { email, name, passwordHash },
      select: { id: true, email: true, name: true, createdAt: true },
    });

    return NextResponse.json(user, { status: 201 });
  } catch (err: unknown) {
    const code = (err as { code?: string }).code;
    if (code === 'P2002') {
      return NextResponse.json({ message: 'Email já cadastrado.' }, { status: 409 });
    }
    console.error('[auth/register]', err);
    return NextResponse.json({ message: 'Erro interno.' }, { status: 500 });
  }
}
