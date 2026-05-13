export type SkinDiagnosis = {
  tipoPele: string;
  nivelOleosidade: string;
  nivelAcne: string;
  nivelSensibilidade: string;
  observacoes: string;
};

export type ProductRecommendation = {
  id: string;
  nome: string;
  tipo: string;
  categorias: string;
  marca: string;
  precoPromocional: number;
  precoNormal: number;
  link: string;
  similarity: number;
};

export interface CatalogAdapter {
  searchProducts(diagnosis: SkinDiagnosis, limit: number): Promise<ProductRecommendation[]>;
  searchProductsForSlot?(slotQuery: string, diagnosis: SkinDiagnosis, limit: number): Promise<ProductRecommendation[]>;
}

export type SearchProductsResult = {
  products: ProductRecommendation[];
  sourceId: string | null;
};
