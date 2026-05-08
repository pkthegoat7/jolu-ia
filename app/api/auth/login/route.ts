import { NextResponse } from 'next/server';
import bcrypt from 'bcrypt';
import { prisma } from '@/lib/prisma';
import { signJwt, COOKIE_NAME, cookieOptions } from '@/lib/jwt';

// Best-effort in-memory rate limiter (resets on cold start in serverless — use Redis/Upstash for strict enforcement)
const loginBucket = new Map<string, { count: number; resetAt: number }>();
const LOGIN_LIMIT = 10;
const LOGIN_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

function checkLoginRateLimit(key: string): boolean {
  const now = Date.now();
  const entry = loginBucket.get(key);
  if (!entry || now > entry.resetAt) {
    loginBucket.set(key, { count: 1, resetAt: now + LOGIN_WINDOW_MS });
    return true;
  }
  if (entry.count >= LOGIN_LIMIT) return false;
  entry.count++;
  return true;
}

export async function POST(request: Request) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
    if (!checkLoginRateLimit(ip)) {
      return NextResponse.json(
        { message: 'Muitas tentativas. Tente novamente em 15 minutos.' },
        { status: 429 },
      );
    }

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
      // Constant-time delay to prevent user enumeration via timing
      await bcrypt.compare(password, '$2b$10$invalidhashfortimingprotection000000000000000000000');
      return NextResponse.json({ message: 'Email ou senha inválidos' }, { status: 401 });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return NextResponse.json({ message: 'Email ou senha inválidos' }, { status: 401 });
    }

    const token = signJwt({ sub: user.id, email: user.email, name: user.name });

    const response = NextResponse.json({
      user: { id: user.id, email: user.email, name: user.name },
    });
    response.cookies.set(COOKIE_NAME, token, cookieOptions());
    return response;
  } catch (err) {
    console.error('[auth/login]', err);
    return NextResponse.json({ message: 'Erro interno.' }, { status: 500 });
  }
}
