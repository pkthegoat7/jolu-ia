import { NextResponse } from 'next/server';
import bcrypt from 'bcrypt';
import { prisma } from '@/lib/prisma';
import { signJwt } from '@/lib/jwt';

export async function POST(request: Request) {
  try {
    const body = await request.json() as { email?: string; password?: string };
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { message: 'Email and password are required' },
        { status: 400 },
      );
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return NextResponse.json({ message: 'Email ou senha inválidos' }, { status: 401 });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return NextResponse.json({ message: 'Email ou senha inválidos' }, { status: 401 });
    }

    const access_token = signJwt({ sub: user.id, email: user.email, name: user.name });

    return NextResponse.json({
      access_token,
      user: { id: user.id, email: user.email, name: user.name },
    });
  } catch (err) {
    console.error('[auth/login]', err);
    return NextResponse.json({ message: 'Erro interno.' }, { status: 500 });
  }
}
