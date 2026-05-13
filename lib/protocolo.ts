import type { ProductRecommendation, SkinDiagnosis } from './catalog/types';
import { searchProductsForSlot } from './catalog';

// Slots ordered to mirror the Patrícia Elias / Joselene-style PDF protocol.
// Essential slots: if any of these is missing in the catalog, the analysis fails
// (clinic must complete the catalog before continuing).
// Optional slots: if missing, the corresponding routine block is omitted.
export type SlotId =
  | 'limpeza'
  | 'tonico'
  | 'iluminador'
  | 'serum_creme'
  | 'hidratante'
  | 'protetor_solar'
  | 'ativo_renovador'
  | 'selante_nutritivo'
  | 'suplemento';

export type SlotDef = {
  id: SlotId;
  rotulo: string;          // tag exibida no e-mail (LIMPEZA, TÔNICO, etc.)
  query: string;           // texto pra embedding no pgvector
  comoUsar: string;        // instrução padrão se o catálogo não trouxer
  essencial: boolean;
};

export const SLOTS: SlotDef[] = [
  {
    id: 'limpeza',
    rotulo: 'LIMPEZA',
    query: 'gel sabonete espuma de limpeza facial purificante',
    comoUsar: 'Aplicar uma noz na ponta dos dedos, massagear no rosto úmido em movimentos circulares por 30 segundos. Enxaguar com água fria.',
    essencial: true,
  },
  {
    id: 'tonico',
    rotulo: 'TÔNICO',
    query: 'tônico facial água termal hidrolato calmante',
    comoUsar: 'Borrifar diretamente no rosto a 20cm de distância ou aplicar com algodão. Não enxaguar. Aguardar absorver antes do próximo passo.',
    essencial: true,
  },
  {
    id: 'iluminador',
    rotulo: 'ILUMINADOR & CLAREADOR',
    query: 'sérum niacinamida ácido tranexâmico clareador iluminador uniformizador',
    comoUsar: '3 a 4 gotas no rosto todo, espalhar com a ponta dos dedos em movimentos suaves. Estender ao pescoço e colo. Aguardar 1 minuto para absorção.',
    essencial: false,
  },
  {
    id: 'serum_creme',
    rotulo: 'SÉRUM CREME',
    query: 'sérum creme antiidade ácido hialurônico vitamina C preenchedor anti-rugas',
    comoUsar: 'Pressione 2 vezes a válvula e espalhe no rosto inteiro com movimentos suaves de dentro para fora, incluindo a área dos olhos — batendo delicadamente com o dedo anelar ao redor do osso orbital.',
    essencial: true,
  },
  {
    id: 'hidratante',
    rotulo: 'HIDRATAÇÃO',
    query: 'gel hidratante facial aloe vera babosa creme hidratante',
    comoUsar: 'Camada fina no rosto todo. Espalhar e deixar absorver completamente.',
    essencial: true,
  },
  {
    id: 'protetor_solar',
    rotulo: 'PROTEÇÃO SOLAR',
    query: 'protetor solar facial FPS toque seco oil free com cor',
    comoUsar: '2 dedos de produto (indicador + médio) para rosto e pescoço. Espalhar e bater levemente. Reaplicar a cada 3 horas em exposição solar direta. Inegociável, todos os dias.',
    essencial: true,
  },
  {
    id: 'ativo_renovador',
    rotulo: 'RENOVADOR',
    query: 'retinol ácido retinóico tretinoína vitamina A ativo renovador noturno',
    comoUsar: 'Quantidade de uma ervilha pequena para o rosto inteiro. Aplicar em pele 100% seca, evitando 1cm ao redor dos olhos, cantos do nariz e comissura labial. Aguardar 15 a 20 minutos antes do próximo passo.',
    essencial: false,
  },
  {
    id: 'selante_nutritivo',
    rotulo: 'SELANTE NUTRITIVO',
    query: 'óleo facial rosa mosqueta argan nutritivo selante antioxidante',
    comoUsar: '2 a 3 gotas nas mãos, esfregar para aquecer e pressionar no rosto todo (técnica de pressão, não esfregar). Não aplicar na pálpebra ou área dos olhos.',
    essencial: false,
  },
  {
    id: 'suplemento',
    rotulo: 'RECOMENDAÇÃO ESPECIAL',
    query: 'colágeno hidrolisado verisol peptídeos bioativos ácido hialurônico suplemento oral',
    comoUsar: '1 dose diária, dissolvida em água, suco ou no momento do dia que melhor encaixar na sua rotina.',
    essencial: false,
  },
];

export type SlotProduto = {
  slot: SlotDef;
  produto: ProductRecommendation;
};

export type ProtocoloPersonalizado = {
  queixaPrincipal: string;
  focoProtocolo: string;
  estrategia: string;
  slots: SlotProduto[];
  catalogSourceId: string | null;
};

// Foco do protocolo derivado das métricas — sem chamar IA pra isso (rápido e determinístico).
function deriveFoco(d: SkinDiagnosis): string {
  const partes: string[] = [];
  if (d.nivelAcne === 'Severa' || d.nivelAcne === 'Moderada') partes.push('controle de acne');
  if (d.nivelOleosidade === 'Alta') partes.push('controle de oleosidade');
  if (d.nivelSensibilidade === 'Alta') partes.push('fortalecimento de barreira');
  if (d.tipoPele === 'Seca/Sensivel') partes.push('hidratação profunda');
  if (partes.length === 0) partes.push('renovação, firmeza e proteção');
  return partes.slice(0, 3).map((p) => p[0].toUpperCase() + p.slice(1)).join(' · ');
}

function deriveEstrategia(d: SkinDiagnosis): string {
  const partes: string[] = [];
  if (d.tipoPele === 'Oleosa') {
    partes.push('Sua pele apresenta produção sebácea elevada — o protocolo combina ativos de controle com hidratação leve para equilibrar sem ressecar.');
  } else if (d.tipoPele === 'Seca/Sensivel') {
    partes.push('Sua pele pede cuidado calmante e reparador — o protocolo prioriza fortalecimento da barreira cutânea com ativos suaves e nutritivos.');
  } else {
    partes.push('Sua pele mista responde bem a uma rotina equilibrada — o protocolo trabalha hidratação inteligente nas zonas secas e regulação suave na zona T.');
  }
  if (d.nivelAcne === 'Severa' || d.nivelAcne === 'Moderada') {
    partes.push('Adicionamos ativos direcionados à inflamação e renovação celular para reduzir lesões e marcas.');
  }
  partes.push('A consistência diária é o que entrega resultado real.');
  return partes.join(' ');
}

export async function montarProtocolo(
  diagnosis: SkinDiagnosis,
  desejaMelhorar: string,
  clinicId: string,
): Promise<ProtocoloPersonalizado> {
  const slotsEncontrados: SlotProduto[] = [];
  let catalogSourceId: string | null = null;
  const faltandoEssenciais: string[] = [];

  for (const slot of SLOTS) {
    const { product, sourceId } = await searchProductsForSlot(slot.query, diagnosis, clinicId);
    if (sourceId) catalogSourceId = sourceId;
    if (product) {
      slotsEncontrados.push({ slot, produto: product });
    } else if (slot.essencial) {
      faltandoEssenciais.push(slot.rotulo);
    }
  }

  if (faltandoEssenciais.length > 0) {
    throw new Error(
      `Catálogo incompleto — faltam produtos para: ${faltandoEssenciais.join(', ')}. ` +
      `Peça ao admin para cadastrar produtos dessas categorias antes de prosseguir.`,
    );
  }

  return {
    queixaPrincipal: desejaMelhorar.trim() || 'Cuidados gerais com a pele',
    focoProtocolo: deriveFoco(diagnosis),
    estrategia: deriveEstrategia(diagnosis),
    slots: slotsEncontrados,
    catalogSourceId,
  };
}
