import { prisma } from '../prisma';

export type ResolvedCatalogSource = {
  id: string;
  type: 'PGVECTOR' | 'WOOCOMMERCE' | 'MANUAL';
  envPrefix: string;
  name: string;
};

export async function resolveActiveCatalogSource(
  clinicId: string,
): Promise<ResolvedCatalogSource | null> {
  const source = await prisma.catalogSource.findFirst({
    where: { clinicId, ativo: true },
    orderBy: { prioridade: 'desc' },
    select: { id: true, type: true, envPrefix: true, name: true },
  });
  return source as ResolvedCatalogSource | null;
}
