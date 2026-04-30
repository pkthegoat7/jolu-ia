const normalizeBaseUrl = (value?: string) => {
  if (!value) return 'http://localhost:3001';
  return value.replace(/\/+$/, '');
};

export const API_BASE_URL = normalizeBaseUrl(process.env.NEXT_PUBLIC_API_URL);

export const apiUrl = (path: string) => {
  if (!path.startsWith('/')) {
    return `${API_BASE_URL}/${path}`;
  }

  return `${API_BASE_URL}${path}`;
};
