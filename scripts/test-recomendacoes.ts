// Carrega .env.local primeiro (sobrescreve), depois .env. O Next.js faz isso
// automaticamente em runtime, mas scripts standalone com tsx nao.
import { config as loadEnv } from 'dotenv';
import path from 'path';
loadEnv({ path: path.resolve(process.cwd(), '.env.local'), override: true });
loadEnv({ path: path.resolve(process.cwd(), '.env') });

import { searchProducts, type SkinDiagnosis } from '../lib/catalog';
import { prisma } from '../lib/prisma';

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
  if (!process.env.OPENAI_API_KEY) {
    console.error('OPENAI_API_KEY nao definida. Configure no .env.local.');
    process.exit(1);
  }

  // Resolve a clinica via CLI arg, ou pega a primeira do banco
  const clinicSlug = process.argv[2];
  let clinicId: string;
  let clinicName: string;

  if (clinicSlug) {
    const c = await prisma.clinic.findFirst({
      where: { OR: [{ id: clinicSlug }, { name: { contains: clinicSlug, mode: 'insensitive' } }] },
    });
    if (!c) {
      console.error(`Clinica nao encontrada: ${clinicSlug}`);
      process.exit(1);
    }
    clinicId = c.id;
    clinicName = c.name;
  } else {
    const c = await prisma.clinic.findFirst({ orderBy: { createdAt: 'asc' } });
    if (!c) {
      console.error('Nenhuma clinica encontrada no banco.');
      process.exit(1);
    }
    clinicId = c.id;
    clinicName = c.name;
  }

  // Sanity: ha uma CatalogSource ativa?
  const source = await prisma.catalogSource.findFirst({
    where: { clinicId, ativo: true },
    orderBy: { prioridade: 'desc' },
  });
  if (!source) {
    console.error(`Nenhuma CatalogSource ativa para clinica "${clinicName}" (${clinicId}).`);
    process.exit(1);
  }

  console.log(`=== Teste de recomendacoes ===`);
  console.log(`Clinica: ${clinicName} (${clinicId})`);
  console.log(`Source : ${source.name} | type=${source.type} | envPrefix=${source.envPrefix}\n`);

  for (const c of CENARIOS) {
    console.log(`▶ ${c.nome}`);
    console.log(`  Perfil: ${c.profile.tipoPele} | Oleosidade=${c.profile.nivelOleosidade} | Acne=${c.profile.nivelAcne} | Sensibilidade=${c.profile.nivelSensibilidade}`);
    console.log(`  Obs: ${c.profile.observacoes}`);

    const t0 = Date.now();
    const { products, sourceId } = await searchProducts(c.profile, clinicId, 5);
    const ms = Date.now() - t0;

    if (products.length === 0) {
      console.log('  ✗ Nenhum produto retornado. Veja os logs acima para diagnostico.\n');
      continue;
    }

    console.log(`  ✓ ${products.length} produtos em ${ms}ms (sourceId=${sourceId}):\n`);
    products.forEach((p, i) => {
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
}

main()
  .catch((err) => {
    console.error('Erro:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
