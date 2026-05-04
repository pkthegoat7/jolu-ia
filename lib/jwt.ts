import jwt from 'jsonwebtoken';

const SECRET = process.env.JWT_SECRET ?? 'fallback_dev_secret';

export function signJwt(payload: object): string {
  return jwt.sign(payload, SECRET, { expiresIn: '7d' });
}

export function verifyJwt(token: string): Record<string, unknown> {
  return jwt.verify(token, SECRET) as Record<string, unknown>;
}

export function getAuthUser(request: Request): Record<string, unknown> | null {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  try {
    return verifyJwt(authHeader.slice(7));
  } catch {
    return null;
  }
}
