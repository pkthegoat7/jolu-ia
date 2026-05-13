import type { CatalogAdapter, ProductRecommendation, SearchProductsResult, SkinDiagnosis } from './types';
import { resolveActiveCatalogSource } from './resolver';
import { makePgVectorAdapter } from './adapters/pgvector';

export type { SkinDiagnosis, ProductRecommendation, SearchProductsResult } from './types';

async function getAdapter(clinicId: string): Promise<{ adapter: CatalogAdapter | null; sourceId: string | null }> {
  const source = await resolveActiveCatalogSource(clinicId);
  if (!source) {
    console.warn(`[catalog] nenhuma CatalogSource ativa para clinica ${clinicId}`);
    return { adapter: null, sourceId: null };
  }

  switch (source.type) {
    case 'PGVECTOR':
      return { adapter: makePgVectorAdapter(source.envPrefix), sourceId: source.id };
    case 'WOOCOMMERCE':
    case 'MANUAL':
      console.warn(`[catalog] adapter ${source.type} ainda não implementado (source: ${source.name})`);
      return { adapter: null, sourceId: source.id };
  }
}

export async function searchProducts(
  diagnosis: SkinDiagnosis,
  clinicId: string,
  limit = 3,
): Promise<SearchProductsResult> {
  const { adapter, sourceId } = await getAdapter(clinicId);
  if (!adapter) return { products: [], sourceId };

  try {
    const products = await adapter.searchProducts(diagnosis, limit);
    return { products, sourceId };
  } catch (err) {
    console.error('[catalog] busca padrão falhou:', err instanceof Error ? err.message : err);
    return { products: [], sourceId };
  }
}

export async function searchProductsForSlot(
  slotQuery: string,
  diagnosis: SkinDiagnosis,
  clinicId: string,
): Promise<{ product: ProductRecommendation | null; sourceId: string | null }> {
  const { adapter, sourceId } = await getAdapter(clinicId);
  if (!adapter || !adapter.searchProductsForSlot) return { product: null, sourceId };

  try {
    const products = await adapter.searchProductsForSlot(slotQuery, diagnosis, 1);
    return { product: products[0] ?? null, sourceId };
  } catch (err) {
    console.error(`[catalog] busca por slot "${slotQuery}" falhou:`, err instanceof Error ? err.message : err);
    return { product: null, sourceId };
  }
}
