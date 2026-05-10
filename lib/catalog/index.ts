import type { CatalogAdapter, SearchProductsResult, SkinDiagnosis } from './types';
import { resolveActiveCatalogSource } from './resolver';
import { makePgVectorAdapter } from './adapters/pgvector';

export type { SkinDiagnosis, ProductRecommendation, SearchProductsResult } from './types';

export async function searchProducts(
  diagnosis: SkinDiagnosis,
  clinicId: string,
  limit = 3,
): Promise<SearchProductsResult> {
  const source = await resolveActiveCatalogSource(clinicId);
  if (!source) {
    console.warn(`[catalog] nenhuma CatalogSource ativa para clinica ${clinicId}`);
    return { products: [], sourceId: null };
  }

  let adapter: CatalogAdapter | null = null;
  switch (source.type) {
    case 'PGVECTOR':
      adapter = makePgVectorAdapter(source.envPrefix);
      break;
    case 'WOOCOMMERCE':
    case 'MANUAL':
      console.warn(`[catalog] adapter ${source.type} ainda não implementado (source: ${source.name})`);
      return { products: [], sourceId: source.id };
  }

  if (!adapter) return { products: [], sourceId: source.id };

  try {
    const products = await adapter.searchProducts(diagnosis, limit);
    return { products, sourceId: source.id };
  } catch (err) {
    console.error(`[catalog] adapter ${source.type} falhou:`, err instanceof Error ? err.message : err);
    return { products: [], sourceId: source.id };
  }
}
