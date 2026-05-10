// Carrega .env.local primeiro (sobrescreve), depois .env. O Next.js faz isso
// automaticamente em runtime, mas scripts standalone com tsx nao.
import { config as loadEnv } from 'dotenv';
import path from 'path';
loadEnv({ path: path.resolve(process.cwd(), '.env.local'), override: true });
loadEnv({ path: path.resolve(process.cwd(), '.env') });

import { searchProducts, type SkinDiagnosis } from '../lib/pgvector';

// Cenarios de teste — perfis sinteticos para cada tipo de pele
const CENARIOS: Array<{ nome: string; profile: SkinDiagnosis }> = [
  {
    nome: 'Pele Oleosa com acne',
    profile: {
      tipoPele: 'Oleosa',
      nivelOleosidade: 'Alta',
      nivelAcne: 'Moderada',
      nivelSensibilidade: 'Baixa',
      observacoes: 'Brilho excessivo na zona T, poros dilatados, presenca de cravos e algumas espinhas inflamadas.',
    },
  },
  {
    nome: 'Pele Mista normal',
    profile: {
      tipoPele: 'Mista',
      nivelOleosidade: 'Media',
      nivelAcne: 'Leve',
      nivelSensibilidade: 'Baixa',
      observacoes: 'Zona T levemente oleosa, bochechas com ressecamento ocasional, textura uniforme.',
    },
  },
  {
    nome: 'Pele Seca/Sensivel',
    profile: {
      tipoPele: 'Seca/Sensivel',
      nivelOleosidade: 'Baixa',
      nivelAcne: 'Baixa',
      nivelSensibilidade: 'Alta',
      observacoes: 'Pele com vermelhidao, sensacao de repuxamento, propensa a irritacao com produtos novos.',
    },
  },
];

function formatBRL(n: number): string {
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

async function main() {
  // Sanity check de credenciais
  const hasUrl = !!process.env.PGVECTOR_URL;
  const hasFields =
    !!(process.env.PGVECTOR_HOST && process.env.PGVECTOR_USER && process.env.PGVECTOR_PASSWORD);
  if (!hasUrl && !hasFields) {
    console.error('PGVECTOR_URL nao definida (nem os campos PGVECTOR_HOST/USER/PASSWORD).');
    console.error('Configure no .env.local antes de rodar este teste.');
    process.exit(1);
  }
  if (!process.env.OPENAI_API_KEY) {
    console.error('OPENAI_API_KEY nao definida. Configure no .env.local.');
    process.exit(1);
  }

  console.log('=== Teste de recomendacoes pgvector ===\n');

  for (const c of CENARIOS) {
    console.log(`▶ ${c.nome}`);
    console.log(`  Perfil: ${c.profile.tipoPele} | Oleosidade=${c.profile.nivelOleosidade} | Acne=${c.profile.nivelAcne} | Sensibilidade=${c.profile.nivelSensibilidade}`);
    console.log(`  Obs: ${c.profile.observacoes}`);

    const t0 = Date.now();
    const produtos = await searchProducts(c.profile, 5);
    const ms = Date.now() - t0;

    if (produtos.length === 0) {
      console.log('  ✗ Nenhum produto retornado. Veja os logs acima para diagnostico.\n');
      continue;
    }

    console.log(`  ✓ ${produtos.length} produtos em ${ms}ms:\n`);
    produtos.forEach((p, i) => {
      const preco =
        p.precoPromocional && p.precoNormal && p.precoPromocional < p.precoNormal
          ? `${formatBRL(p.precoNormal)} → ${formatBRL(p.precoPromocional)}`
          : formatBRL(p.precoPromocional || p.precoNormal);
      console.log(`    ${i + 1}. [sim ${p.similarity.toFixed(3)}] ${p.nome}`);
      console.log(`       Marca: ${p.marca || '—'} | Tipo: ${p.tipo || '—'}`);
      console.log(`       Categorias: ${p.categorias || '—'}`);
      console.log(`       Preco: ${preco}`);
      console.log(`       Link: ${p.link || '—'}`);
      console.log('');
    });
  }

  process.exit(0);
}

main().catch((err) => {
  console.error('Erro:', err);
  process.exit(1);
});
