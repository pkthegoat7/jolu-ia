// Blocks SSRF by rejecting private/loopback/link-local targets and non-HTTPS schemes.
const PRIVATE_HOSTNAME = [
  /^localhost$/i,
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2[0-9]|3[01])\./,
  /^169\.254\./,   // link-local
  /^0\.0\.0\.0$/,
  /^::1$/,
  /^fc00:/i,
  /^fe80:/i,
];

export function assertSafeUrl(rawUrl: string): void {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error('URL inválida.');
  }

  if (url.protocol !== 'https:') {
    throw new Error('Apenas URLs HTTPS são permitidas.');
  }

  const host = url.hostname.toLowerCase();
  for (const pattern of PRIVATE_HOSTNAME) {
    if (pattern.test(host)) {
      throw new Error('URLs de redes privadas não são permitidas.');
    }
  }
}

export function isSafeUrl(rawUrl: string): { ok: boolean; reason?: string } {
  try {
    assertSafeUrl(rawUrl);
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: (e as Error).message };
  }
}
