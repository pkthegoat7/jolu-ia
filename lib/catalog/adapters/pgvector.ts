import { Pool, type PoolConfig } from 'pg';
import OpenAI from 'openai';
import type { CatalogAdapter, ProductRecommendation, SkinDiagnosis } from '../types';

const DEFAULT_TABLE = 'n8n_vectors_produtos_ecommerce';
// Identifier safety: only [A-Za-z0-9_], must start with letter/underscore.
// Prevents SQL injection via env var since table names can't be parameterized.
const SAFE_IDENT = /^[A-Za-z_][A-Za-z0-9_]*$/;

// Pool reuse per envPrefix — different clinics with the same prefix share, distinct prefixes
// get distinct pools (safe even if their underlying DBs happen to be the same).
const poolCache = new Map<string, Pool>();
let openai: OpenAI | null = null;

function getOpenAI(): OpenAI | null {
  if (openai) return openai;
  if (!process.env.OPENAI_API_KEY) return null;
  openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return openai;
}

function readEnv(envPrefix: string, key: string): string | undefined {
  // Try prefixed first (e.g. JOLU_PE_PGVECTOR_URL), fall back to bare (PGVECTOR_URL)
  // for transition. Once all sources are migrated, the bare fallback can be removed.
  return process.env[`${envPrefix}_${key}`] ?? process.env[key];
}

function buildPoolConfig(envPrefix: string): PoolConfig | null {
  const common = { max: 5, idleTimeoutMillis: 10_000, connectionTimeoutMillis: 5_000 };

  const url = readEnv(envPrefix, 'PGVECTOR_URL');
  if (url) return { ...common, connectionString: url };

  const host = readEnv(envPrefix, 'PGVECTOR_HOST');
  const port = readEnv(envPrefix, 'PGVECTOR_PORT');
  const db = readEnv(envPrefix, 'PGVECTOR_DB');
  const user = readEnv(envPrefix, 'PGVECTOR_USER');
  const password = readEnv(envPrefix, 'PGVECTOR_PASSWORD');
  if (host && port && db && user && password) {
    return { ...common, host, port: Number(port), database: db, user, password };
  }

  return null;
}

function getPool(envPrefix: string): Pool | null {
  const cached = poolCache.get(envPrefix);
  if (cached) return cached;
  const cfg = buildPoolConfig(envPrefix);
  if (!cfg) return null;
  const pool = new Pool(cfg);
  poolCache.set(envPrefix, pool);
  return pool;
}

function getTableName(envPrefix: string): string {
  const t = readEnv(envPrefix, 'PGVECTOR_TABLE') ?? DEFAULT_TABLE;
  if (!SAFE_IDENT.test(t)) {
    console.warn(`[pgvector:${envPrefix}] PGVECTOR_TABLE inválido (${t}); usando default`);
    return DEFAULT_TABLE;
  }
  return t;
}

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

export function makePgVectorAdapter(envPrefix: string): CatalogAdapter {
  return {
    async searchProducts(diagnosis: SkinDiagnosis, limit: number): Promise<ProductRecommendation[]> {
      const p = getPool(envPrefix);
      if (!p) {
        console.warn(`[pgvector:${envPrefix}] credenciais não configuradas`);
        return [];
      }

      const embedding = await embedDiagnosis(diagnosis);
      if (!embedding) return [];

      const vectorLiteral = `[${embedding.join(',')}]`;
      const table = getTableName(envPrefix);

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
    },
  };
}
