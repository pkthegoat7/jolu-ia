import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';

const CATALOG_TYPES = ['PGVECTOR', 'WOOCOMMERCE', 'MANUAL'] as const;
type CatalogType = (typeof CATALOG_TYPES)[number];
const ENV_PREFIX_REGEX = /^[A-Z][A-Z0-9_]{0,63}$/;

async function getAdminClinicId(request: Request): Promise<{ clinicId: string } | null> {
  const adminUser = requireAdmin(request);
  if (!adminUser) return null;
  const dbUser = await prisma.user.findUnique({
    where: { id: String(adminUser.sub) },
    select: { clinicId: true },
  });
  if (!dbUser?.clinicId) return null;
  return { clinicId: dbUser.clinicId };
}

async function fetchOwned(
  clinicId: string,
  id: string,
): Promise<{ id: string; clinicId: string } | null> {
  return prisma.catalogSource.findFirst({
    where: { id, clinicId },
    select: { id: true, clinicId: true },
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAdminClinicId(request);
  if (!ctx) {
    return NextResponse.json({ message: 'Não autorizado.' }, { status: 401 });
  }

  const { id } = await params;
  const owned = await fetchOwned(ctx.clinicId, id);
  if (!owned) {
    return NextResponse.json({ message: 'Fonte não encontrada.' }, { status: 404 });
  }

  const body = (await request.json()) as {
    name?: string;
    type?: string;
    envPrefix?: string;
    ativo?: boolean;
    prioridade?: number;
  };

  const data: Record<string, string | boolean | number> = {};

  if (typeof body.name === 'string') {
    const v = body.name.trim();
    if (!v || v.length > 200) {
      return NextResponse.json({ message: 'Nome inválido (máx 200 chars).' }, { status: 400 });
    }
    data.name = v;
  }

  if (typeof body.type === 'string') {
    if (!CATALOG_TYPES.includes(body.type as CatalogType)) {
      return NextResponse.json(
        { message: `Tipo inválido. Use: ${CATALOG_TYPES.join(', ')}.` },
        { status: 400 },
      );
    }
    data.type = body.type;
  }

  if (typeof body.envPrefix === 'string') {
    const v = body.envPrefix.trim();
    if (!ENV_PREFIX_REGEX.test(v)) {
      return NextResponse.json(
        { message: 'envPrefix inválido. Use UPPERCASE, dígitos e underscores.' },
        { status: 400 },
      );
    }
    data.envPrefix = v;
  }

  if (typeof body.ativo === 'boolean') data.ativo = body.ativo;

  if (typeof body.prioridade === 'number') data.prioridade = Math.floor(body.prioridade);

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ message: 'Nenhum campo para atualizar.' }, { status: 400 });
  }

  const updated = await prisma.catalogSource.update({
    where: { id },
    data,
    select: {
      id: true,
      name: true,
      type: true,
      envPrefix: true,
      ativo: true,
      prioridade: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAdminClinicId(request);
  if (!ctx) {
    return NextResponse.json({ message: 'Não autorizado.' }, { status: 401 });
  }

  const { id } = await params;
  const owned = await fetchOwned(ctx.clinicId, id);
  if (!owned) {
    return NextResponse.json({ message: 'Fonte não encontrada.' }, { status: 404 });
  }

  // Análises antigas mantêm o catalogSourceId snapshot (ON DELETE SET NULL).
  await prisma.catalogSource.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
