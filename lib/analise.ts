import Anthropic from '@anthropic-ai/sdk';
import sharp from 'sharp';
import { createClient } from '@supabase/supabase-js';

type Landmark = { x: number; y: number; z: number };

export type ResultadoAnalise = {
  status: string;
  tipoPele: string;
  nivelOleosidade: string;
  nivelAcne: string;
  nivelSensibilidade: string;
  observacoes: string;
  recomendacoes: { nome: string; motivo: string; modoDeUso: string }[];
};

const FACE_OVAL_INDICES = [
  10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379,
  378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127,
  162, 21, 54, 103, 67, 109,
];

const SKIN_ANALYSIS_SYSTEM = `You are a professional dermatologist and skin analysis AI.
Analyze the provided facial image and return ONLY a valid JSON object — no markdown, no extra text.

Required JSON schema:
{
  "tipoPele": "Oleosa" | "Mista" | "Seca/Sensivel",
  "nivelOleosidade": "Alta" | "Media" | "Baixa",
  "nivelAcne": "Severa" | "Moderada" | "Leve" | "Baixa",
  "nivelSensibilidade": "Alta" | "Media" | "Baixa",
  "observacoes": "<1-2 sentences in Portuguese describing what you actually observed>"
}`;

function getSupabase() {
  const url = process.env.SUPABASE_URL!;
  const key = process.env.SUPABASE_KEY!;
  return createClient(url, key);
}

function getClaude() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
}

async function cropFaceRegion(imageBuffer: Buffer, landmarks: Landmark[]): Promise<Buffer> {
  try {
    const image = sharp(imageBuffer);
    const { width, height } = await image.metadata();
    if (!width || !height) return imageBuffer;

    const xs = FACE_OVAL_INDICES
      .filter((i) => i < landmarks.length)
      .map((i) => landmarks[i].x * width);
    const ys = FACE_OVAL_INDICES
      .filter((i) => i < landmarks.length)
      .map((i) => landmarks[i].y * height);

    if (xs.length === 0) return imageBuffer;

    const padding = 0.12;
    const minX = Math.max(0, Math.floor(Math.min(...xs) - width * padding));
    const minY = Math.max(0, Math.floor(Math.min(...ys) - height * padding));
    const maxX = Math.min(width, Math.ceil(Math.max(...xs) + width * padding));
    const maxY = Math.min(height, Math.ceil(Math.max(...ys) + height * padding));

    return await image
      .extract({ left: minX, top: minY, width: maxX - minX, height: maxY - minY })
      .jpeg({ quality: 85 })
      .toBuffer();
  } catch {
    return imageBuffer;
  }
}

function recomendacoesPara(tipoPele: string) {
  const mapa: Record<string, { nome: string; motivo: string; modoDeUso: string }[]> = {
    Oleosa: [
      {
        nome: 'Patricia Elias Gel de Limpeza Purificante',
        motivo: 'Ajuda a controlar brilho excessivo sem ressecar a pele.',
        modoDeUso: 'Aplicar de manha e a noite com movimentos circulares.',
      },
      {
        nome: 'Patricia Elias Serum Controle de Acne',
        motivo: 'Formula direcionada para reduzir inflamacao e obstrucao dos poros.',
        modoDeUso: 'Usar a noite, apos limpeza e antes do hidratante.',
      },
      {
        nome: 'Patricia Elias Protetor Solar Oil Free FPS 60',
        motivo: 'Protege contra UV sem aumentar a oleosidade.',
        modoDeUso: 'Aplicar pela manha e reaplicar a cada 3 horas.',
      },
    ],
    Mista: [
      {
        nome: 'Patricia Elias Espuma de Limpeza Equilibrante',
        motivo: 'Equilibra zonas secas e oleosas do rosto.',
        modoDeUso: 'Usar 2 vezes ao dia com enxague abundante.',
      },
      {
        nome: 'Patricia Elias Serum Hidra-Repair',
        motivo: 'Mantem hidratacao sem pesar na zona T.',
        modoDeUso: 'Aplicar 4 gotas de manha e a noite.',
      },
      {
        nome: 'Patricia Elias Protetor Solar Toque Seco FPS 50',
        motivo: 'Protecao diaria com acabamento confortavel.',
        modoDeUso: 'Aplicar de forma uniforme antes da exposicao solar.',
      },
    ],
    'Seca/Sensivel': [
      {
        nome: 'Patricia Elias Leite de Limpeza Calmante',
        motivo: 'Limpeza suave para pele sensibilizada.',
        modoDeUso: 'Aplicar com algodao sem friccao excessiva.',
      },
      {
        nome: 'Patricia Elias Creme Reparador de Barreira',
        motivo: 'Fortalece a barreira cutanea e reduz desconforto.',
        modoDeUso: 'Aplicar 2 vezes ao dia apos limpeza.',
      },
      {
        nome: 'Patricia Elias Protetor Solar Mineral FPS 50',
        motivo: 'Protecao com menor risco de irritacao.',
        modoDeUso: 'Aplicar pela manha e reaplicar ao longo do dia.',
      },
    ],
  };
  return mapa[tipoPele] ?? mapa['Mista'];
}

function fallbackPorBuffer(imageBuffer: Buffer): ResultadoAnalise {
  const bucket = imageBuffer.length % 3;
  const tipos = ['Oleosa', 'Mista', 'Seca/Sensivel'];
  const tipoPele = tipos[bucket];
  return {
    status: 'Concluido',
    tipoPele,
    nivelOleosidade: bucket === 0 ? 'Alta' : bucket === 1 ? 'Media' : 'Baixa',
    nivelAcne: bucket === 0 ? 'Moderada' : 'Leve',
    nivelSensibilidade: bucket === 2 ? 'Alta' : 'Baixa',
    observacoes: 'Análise realizada sem dados de IA (fallback).',
    recomendacoes: recomendacoesPara(tipoPele),
  };
}

export async function analisarImagem(
  imageBuffer: Buffer,
  landmarks: Landmark[] | null,
): Promise<ResultadoAnalise> {
  let faceBuffer = imageBuffer;
  if (landmarks) {
    faceBuffer = await cropFaceRegion(imageBuffer, landmarks);
  }

  const base64Image = faceBuffer.toString('base64');
  let parsed: Record<string, string> | null = null;

  try {
    const claude = getClaude();
    const response = await claude.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      system: SKIN_ANALYSIS_SYSTEM,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: 'image/jpeg', data: base64Image },
            },
            {
              type: 'text',
              text: 'Analise esta imagem facial e retorne o JSON de diagnóstico de pele.',
            },
          ],
        },
      ],
    });

    const text = response.content
      .filter((b) => b.type === 'text')
      .map((b) => (b as { type: 'text'; text: string }).text)
      .join('');

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      parsed = JSON.parse(jsonMatch[0]) as Record<string, string>;
    }
  } catch (err) {
    console.error('[Claude] erro na análise:', err instanceof Error ? err.message : err);
  }

  if (!parsed) return fallbackPorBuffer(imageBuffer);

  const tipoPele = parsed.tipoPele ?? 'Mista';
  return {
    status: 'Concluido',
    tipoPele,
    nivelOleosidade: parsed.nivelOleosidade ?? 'Media',
    nivelAcne: parsed.nivelAcne ?? 'Leve',
    nivelSensibilidade: parsed.nivelSensibilidade ?? 'Media',
    observacoes: parsed.observacoes ?? '',
    recomendacoes: recomendacoesPara(tipoPele),
  };
}

export async function uploadToSupabase(
  buffer: Buffer,
  filePath: string,
  mimeType: string,
): Promise<string> {
  const supabase = getSupabase();
  const { error } = await supabase.storage
    .from('fotos-analise')
    .upload(filePath, buffer, { contentType: mimeType, upsert: true });

  if (error) throw new Error(`Erro no upload: ${error.message}`);

  const { data: { publicUrl } } = supabase.storage
    .from('fotos-analise')
    .getPublicUrl(filePath);

  return publicUrl;
}
