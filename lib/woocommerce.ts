import type { ResultadoAnalise } from './analise';
import { assertSafeUrl } from './ssrf';

function wcAuth(): string {
  const key = process.env.WC_CONSUMER_KEY;
  const secret = process.env.WC_CONSUMER_SECRET;
  if (!key || !secret) throw new Error('WC_CONSUMER_KEY e WC_CONSUMER_SECRET são obrigatórios.');
  return Buffer.from(`${key}:${secret}`).toString('base64');
}

async function wcFetch(endpoint: string, options?: RequestInit) {
  const base = process.env.WC_URL;
  if (!base) throw new Error('WC_URL não definida.');
  assertSafeUrl(base);

  const res = await fetch(`${base}/wp-json/wc/v3${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Basic ${wcAuth()}`,
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(`WooCommerce API ${res.status}: ${JSON.stringify(data)}`);
  }
  return data;
}

type WCCustomer = { id: number; email: string };

async function findCustomerByEmail(email: string): Promise<WCCustomer | null> {
  const results = await wcFetch(`/customers?email=${encodeURIComponent(email)}&per_page=1`);
  return Array.isArray(results) && results.length > 0 ? (results[0] as WCCustomer) : null;
}

function buildCustomerPayload(
  nome: string,
  email: string,
  telefone: string,
  resultado: ResultadoAnalise,
) {
  const [firstName, ...rest] = nome.trim().split(' ');
  const lastName = rest.join(' ');
  return {
    email,
    first_name: firstName,
    last_name: lastName,
    billing: { first_name: firstName, last_name: lastName, email, phone: telefone },
    meta_data: [
      { key: 'jolu_tipo_pele', value: resultado.tipoPele },
      { key: 'jolu_nivel_acne', value: resultado.nivelAcne },
      { key: 'jolu_nivel_oleosidade', value: resultado.nivelOleosidade },
      { key: 'jolu_nivel_sensibilidade', value: resultado.nivelSensibilidade },
      { key: 'jolu_analise_em', value: new Date().toISOString() },
    ],
  };
}

export async function syncLeadToWooCommerce(
  nome: string,
  email: string,
  telefone: string,
  resultado: ResultadoAnalise,
): Promise<void> {
  if (!process.env.WC_URL || !process.env.WC_CONSUMER_KEY || !process.env.WC_CONSUMER_SECRET) {
    console.log('[WC] Variáveis não configuradas — sincronização ignorada.');
    return;
  }

  const payload = buildCustomerPayload(nome, email, telefone, resultado);
  const existing = await findCustomerByEmail(email);

  if (existing) {
    await wcFetch(`/customers/${existing.id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    console.log(`[WC] Cliente atualizado: ${email} (id ${existing.id})`);
  } else {
    const created = await wcFetch('/customers', {
      method: 'POST',
      body: JSON.stringify(payload),
    }) as WCCustomer;
    console.log(`[WC] Cliente criado: ${email} (id ${created.id})`);
  }
}
