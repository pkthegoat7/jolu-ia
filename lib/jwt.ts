import jwt from 'jsonwebtoken';

if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable must be set in production');
}

const SECRET = process.env.JWT_SECRET ?? 'fallback_dev_secret';

export const COOKIE_NAME = 'admin_token';

export function cookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict' as const,
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  };
}

export function signJwt(payload: object): string {
  return jwt.sign(payload, SECRET, { expiresIn: '7d' });
}

export function verifyJwt(token: string): Record<string, unknown> {
  return jwt.verify(token, SECRET) as Record<string, unknown>;
}

export function requireAdmin(request: Request): Record<string, unknown> | null {
  const user = getAuthUser(request);
  if (!user) return null;
  if (user.role !== 'ADMIN') return null;
  return user;
}

export function getAuthUser(request: Request): Record<string, unknown> | null {
  // Prefer HttpOnly cookie; fall back to Bearer header for API clients
  const cookieHeader = request.headers.get('cookie');
  if (cookieHeader) {
    const match = cookieHeader.match(/(?:^|;\s*)admin_token=([^;]+)/);
    if (match?.[1]) {
      try {
        return verifyJwt(decodeURIComponent(match[1]));
      } catch { /* fall through */ }
    }
  }
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    try {
      return verifyJwt(authHeader.slice(7));
    } catch { /* fall through */ }
  }
  return null;
}
