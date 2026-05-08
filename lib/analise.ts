import { GoogleGenerativeAI } from '@google/generative-ai';
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
  modoFallback?: boolean;
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

const MAGIC_JPEG = [0xff, 0xd8, 0xff];
const MAGIC_PNG  = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

export function validateMagicBytes(buf: Buffer, type: string): boolean {
  if (type === 'image/jpeg') return MAGIC_JPEG.every((b, i) => buf[i] === b);
  if (type === 'image/png')  return MAGIC_PNG.every((b, i) => buf[i] === b);
  if (type === 'image/webp') return buf.slice(0, 4).toString('ascii') === 'RIFF' && buf.slice(8, 12).toString('ascii') === 'WEBP';
  return false;
}

export function validateLandmarks(data: unknown): Landmark[] | null {
  if (!Array.isArray(data) || data.length === 0) return null;
  const valid = data.every(
    (l) =>
      typeof l === 'object' && l !== null &&
      Number.isFinite((l as Landmark).x) &&
      Number.isFinite((l as Landmark).y) &&
      Number.isFinite((l as Landmark).z),
  );
  return valid ? (data as Landmark[]) : null;
}

function getSupabase() {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_KEY!);
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

function parseAnalysisJson(text: string): Record<string, string> | null {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]) as Record<string, string>;
  } catch {
    return null;
  }
}

async function analisarComGemini(base64Image: string): Promise<Record<string, string> | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('[Gemini] GEMINI_API_KEY não definida');
    return null;
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash-latest' });

    const result = await model.generateContent([
      { text: SKIN_ANALYSIS_SYSTEM + '\n\nAnalise esta imagem facial e retorne o JSON de diagnóstico de pele.' },
      { inlineData: { mimeType: 'image/jpeg', data: base64Image } },
    ]);

    const text = result.response.text();
    console.log('[Gemini] resposta bruta:', text.slice(0, 200));
    const parsed = parseAnalysisJson(text);
    if (parsed) {
      console.log('[Gemini] análise concluída:', JSON.stringify(parsed));
    } else {
      console.error('[Gemini] falha ao parsear JSON da resposta');
    }
    return parsed;
  } catch (err) {
    console.error('[Gemini] erro na análise:', err instanceof Error ? err.message : String(err));
    return null;
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

function fallbackPorBuffer(): ResultadoAnalise {
  const tipoPele = 'Mista';
  return {
    status: 'Concluido',
    tipoPele,
    nivelOleosidade: 'Media',
    nivelAcne: 'Leve',
    nivelSensibilidade: 'Media',
    observacoes: 'Análise estimada — serviço de IA indisponível no momento.',
    recomendacoes: recomendacoesPara(tipoPele),
    modoFallback: true,
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

  const parsed = await analisarComGemini(base64Image);

  if (!parsed) return fallbackPorBuffer();

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
