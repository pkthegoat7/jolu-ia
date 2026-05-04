export const apiUrl = (path: string) => {
  const base = typeof window !== 'undefined' ? '' : (process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000');
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${base}/api${normalizedPath}`;
};
