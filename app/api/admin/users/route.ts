import { NextResponse } from 'next/server';
import bcrypt from 'bcrypt';
import { requireAdmin } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';

const ROLES = ['ADMIN', 'VIEWER'] as const;
type Role = (typeof ROLES)[number];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function getAdminCtx(request: Request): Promise<{ adminId: string; clinicId: string } | null> {
  const adminUser = requireAdmin(request);
  if (!adminUser) return null;
  const dbUser = await prisma.user.findUnique({
    where: { id: String(adminUser.sub) },
    select: { id: true, clinicId: true },
  });
  if (!dbUser?.clinicId) return null;
  return { adminId: dbUser.id, clinicId: dbUser.clinicId };
}

export async function GET(request: Request) {
  const ctx = await getAdminCtx(request);
  if (!ctx) return NextResponse.json({ message: 'Não autorizado.' }, { status: 401 });

  const users = await prisma.user.findMany({
    where: { clinicId: ctx.clinicId },
    orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
    select: { id: true, email: true, name: true, role: true, createdAt: true },
  });

  return NextResponse.json(users);
}

export async function POST(request: Request) {
  const ctx = await getAdminCtx(request);
  if (!ctx) return NextResponse.json({ message: 'Não autorizado.' }, { status: 401 });

  const body = (await request.json()) as {
    name?: string; email?: string; password?: string; role?: string;
  };

  const name = body.name?.trim();
  const email = body.email?.trim().toLowerCase();
  const password = body.password ?? '';
  const role = (body.role ?? 'VIEWER').toUpperCase();

  if (!name || name.length < 2 || name.length > 120) {
    return NextResponse.json({ message: 'Nome obrigatório (2-120 chars).' }, { status: 400 });
  }
  if (!email || !EMAIL_RE.test(email) || email.length > 200) {
    return NextResponse.json({ message: 'E-mail inválido.' }, { status: 400 });
  }
  if (password.length < 8 || password.length > 1024) {
    return NextResponse.json({ message: 'Senha precisa ter pelo menos 8 caracteres.' }, { status: 400 });
  }
  if (!ROLES.includes(role as Role)) {
    return NextResponse.json({ message: 'Role inválido. Use ADMIN ou VIEWER.' }, { status: 400 });
  }

  const passwordHash = await bcrypt.hash(password, 10);

  try {
    const user = await prisma.user.create({
      data: {
        name, email, passwordHash,
        role: role as Role,
        clinicId: ctx.clinicId,
      },
      select: { id: true, email: true, name: true, role: true, createdAt: true },
    });
    return NextResponse.json(user, { status: 201 });
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === 'P2002') {
      return NextResponse.json({ message: 'E-mail já cadastrado.' }, { status: 409 });
    }
    console.error('[admin/users] erro ao criar:', err);
    return NextResponse.json({ message: 'Erro interno.' }, { status: 500 });
  }
}
