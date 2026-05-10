import { Pool } from 'pg';
import OpenAI from 'openai';

let pool: Pool | null = null;
let openai: OpenAI | null = null;

function getPool(): Pool | null {
  if (pool) return pool;
  if (!process.env.PGVECTOR_URL) return null;
  pool = new Pool({
    connectionString: process.env.PGVECTOR_URL,
    max: 5,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 5_000,
  });
  return pool;
}

function getOpenAI(): OpenAI | null {
  if (openai) return openai;
  if (!process.env.OPENAI_API_KEY) return null;
  openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return openai;
}

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

async function embedDiagnosis(diagnosis: SkinDiagnosis): Promise<number[] | null> {
  const client = getOpenAI();
  if (!client) {
    console.warn('[pgvector] OPENAI_API_KEY não definida');
    return null;
  }

  const text = [
    `Tipo de pele: ${diagnosis.tipoPele}`,
    `Nível de oleosidade: ${diagnosis.nivelOleosidade}`,
    `Nível de acne: ${diagnosis.nivelAcne}`,
    `Sensibilidade: ${diagnosis.nivelSensibilidade}`,
    `Observações: ${diagnosis.observacoes}`,
  ].join('\n');

  const res = await client.embeddings.create({
    model: 'text-embedding-3-small',
    input: text,
    dimensions: 1536,
  });
  return res.data[0]?.embedding ?? null;
}

export async function searchProducts(
  diagnosis: SkinDiagnosis,
  limit = 5,
): Promise<ProductRecommendation[]> {
  const p = getPool();
  if (!p) {
    console.warn('[pgvector] PGVECTOR_URL não definida');
    return [];
  }

  const embedding = await embedDiagnosis(diagnosis);
  if (!embedding) return [];

  const vectorLiteral = `[${embedding.join(',')}]`;

  const { rows } = await p.query(
    `SELECT
       id,
       metadata->>'nome_produto' AS nome,
       metadata->>'tipo_produto' AS tipo,
       metadata->>'categorias' AS categorias,
       metadata->>'marca' AS marca,
       (metadata->>'preco_promocional')::numeric AS preco_promocional,
       (metadata->>'preco_normal')::numeric AS preco_normal,
       metadata->>'link_produto' AS link,
       1 - (embedding <=> $1::vector) AS similarity
     FROM n8n_vectors_produtos_ecommerce
     WHERE metadata->>'situacao' = 'Ativo'
     ORDER BY embedding <=> $1::vector ASC
     LIMIT $2`,
    [vectorLiteral, limit],
  );

  return rows.map((r) => ({
    id: r.id,
    nome: r.nome,
    tipo: r.tipo,
    categorias: r.categorias,
    marca: r.marca,
    precoPromocional: Number(r.preco_promocional),
    precoNormal: Number(r.preco_normal),
    link: r.link,
    similarity: Number(r.similarity),
  }));
}
