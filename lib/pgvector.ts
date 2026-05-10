import { Pool, type PoolConfig } from 'pg';
import OpenAI from 'openai';

let pool: Pool | null = null;
let openai: OpenAI | null = null;

const DEFAULT_TABLE = 'n8n_vectors_produtos_ecommerce';
// Identifier safety: only [A-Za-z0-9_], must start with letter/underscore.
// Prevents SQL injection via env var since table names can't be parameterized.
const SAFE_IDENT = /^[A-Za-z_][A-Za-z0-9_]*$/;

function buildPoolConfig(): PoolConfig | null {
  const common = { max: 5, idleTimeoutMillis: 10_000, connectionTimeoutMillis: 5_000 };

  if (process.env.PGVECTOR_URL) {
    return { ...common, connectionString: process.env.PGVECTOR_URL };
  }

  const { PGVECTOR_HOST, PGVECTOR_PORT, PGVECTOR_DB, PGVECTOR_USER, PGVECTOR_PASSWORD } = process.env;
  if (PGVECTOR_HOST && PGVECTOR_PORT && PGVECTOR_DB && PGVECTOR_USER && PGVECTOR_PASSWORD) {
    return {
      ...common,
      host: PGVECTOR_HOST,
      port: Number(PGVECTOR_PORT),
      database: PGVECTOR_DB,
      user: PGVECTOR_USER,
      password: PGVECTOR_PASSWORD,
    };
  }

  return null;
}

function getPool(): Pool | null {
  if (pool) return pool;
  const cfg = buildPoolConfig();
  if (!cfg) return null;
  pool = new Pool(cfg);
  return pool;
}

function getTableName(): string {
  const t = process.env.PGVECTOR_TABLE ?? DEFAULT_TABLE;
  if (!SAFE_IDENT.test(t)) {
    console.warn(`[pgvector] PGVECTOR_TABLE inválido (${t}); usando default`);
    return DEFAULT_TABLE;
  }
  return t;
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
  const table = getTableName();

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
     FROM "${table}"
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
