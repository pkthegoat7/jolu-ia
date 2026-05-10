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

export async function GET(request: Request) {
  const ctx = await getAdminClinicId(request);
  if (!ctx) {
    return NextResponse.json({ message: 'Não autorizado.' }, { status: 401 });
  }

  const sources = await prisma.catalogSource.findMany({
    where: { clinicId: ctx.clinicId },
    orderBy: [{ ativo: 'desc' }, { prioridade: 'desc' }, { createdAt: 'asc' }],
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

  return NextResponse.json(sources);
}

export async function POST(request: Request) {
  const ctx = await getAdminClinicId(request);
  if (!ctx) {
    return NextResponse.json({ message: 'Não autorizado.' }, { status: 401 });
  }

  const body = (await request.json()) as {
    name?: string;
    type?: string;
    envPrefix?: string;
    ativo?: boolean;
    prioridade?: number;
  };

  const name = body.name?.trim();
  const type = body.type?.trim();
  const envPrefix = body.envPrefix?.trim();

  if (!name || name.length > 200) {
    return NextResponse.json({ message: 'Nome obrigatório (máx 200 chars).' }, { status: 400 });
  }
  if (!type || !CATALOG_TYPES.includes(type as CatalogType)) {
    return NextResponse.json(
      { message: `Tipo inválido. Use: ${CATALOG_TYPES.join(', ')}.` },
      { status: 400 },
    );
  }
  if (!envPrefix || !ENV_PREFIX_REGEX.test(envPrefix)) {
    return NextResponse.json(
      { message: 'envPrefix inválido. Use UPPERCASE, dígitos e underscores (ex: JOLU_PE).' },
      { status: 400 },
    );
  }

  const ativo = typeof body.ativo === 'boolean' ? body.ativo : true;
  const prioridade = typeof body.prioridade === 'number' ? Math.floor(body.prioridade) : 0;

  const source = await prisma.catalogSource.create({
    data: {
      clinicId: ctx.clinicId,
      name,
      type: type as CatalogType,
      envPrefix,
      ativo,
      prioridade,
    },
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

  return NextResponse.json(source, { status: 201 });
}
