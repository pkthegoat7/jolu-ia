import { NextResponse } from 'next/server';
import bcrypt from 'bcrypt';
import { requireAdmin } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';

const ROLES = ['ADMIN', 'VIEWER'] as const;
type Role = (typeof ROLES)[number];

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

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAdminCtx(request);
  if (!ctx) return NextResponse.json({ message: 'Não autorizado.' }, { status: 401 });

  const { id } = await params;
  const target = await prisma.user.findUnique({ where: { id }, select: { id: true, clinicId: true, role: true } });
  if (!target || target.clinicId !== ctx.clinicId) {
    return NextResponse.json({ message: 'Usuário não encontrado.' }, { status: 404 });
  }

  const body = (await request.json()) as { name?: string; role?: string; password?: string };
  const data: { name?: string; role?: Role; passwordHash?: string } = {};

  if (body.name !== undefined) {
    const name = body.name.trim();
    if (name.length < 2 || name.length > 120) {
      return NextResponse.json({ message: 'Nome inválido.' }, { status: 400 });
    }
    data.name = name;
  }

  if (body.role !== undefined) {
    const role = body.role.toUpperCase();
    if (!ROLES.includes(role as Role)) {
      return NextResponse.json({ message: 'Role inválido.' }, { status: 400 });
    }
    // Impede o admin de se rebaixar a VIEWER (evita travar a clinica sem admin).
    if (target.id === ctx.adminId && role !== 'ADMIN') {
      return NextResponse.json(
        { message: 'Você não pode rebaixar seu próprio acesso.' },
        { status: 400 },
      );
    }
    data.role = role as Role;
  }

  if (body.password !== undefined) {
    if (body.password.length < 8 || body.password.length > 1024) {
      return NextResponse.json({ message: 'Senha precisa ter pelo menos 8 caracteres.' }, { status: 400 });
    }
    data.passwordHash = await bcrypt.hash(body.password, 10);
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ message: 'Nada a atualizar.' }, { status: 400 });
  }

  const updated = await prisma.user.update({
    where: { id },
    data,
    select: { id: true, email: true, name: true, role: true, createdAt: true },
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAdminCtx(request);
  if (!ctx) return NextResponse.json({ message: 'Não autorizado.' }, { status: 401 });

  const { id } = await params;
  if (id === ctx.adminId) {
    return NextResponse.json({ message: 'Você não pode excluir a si mesmo.' }, { status: 400 });
  }

  const target = await prisma.user.findUnique({ where: { id }, select: { clinicId: true } });
  if (!target || target.clinicId !== ctx.clinicId) {
    return NextResponse.json({ message: 'Usuário não encontrado.' }, { status: 404 });
  }

  await prisma.user.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
