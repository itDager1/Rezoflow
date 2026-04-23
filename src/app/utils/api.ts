import { projectId, publicAnonKey } from '/utils/supabase/info';

export const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-ca4c8ee9`;

// ─── Session token helpers ────────────────────────────────────────────────────
const TOKEN_KEY = 'rezoflow_token';

export const getStoredToken = (): string | null => {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
};

export const setStoredToken = (token: string): void => {
  try { localStorage.setItem(TOKEN_KEY, token); } catch {}
};

export const clearStoredToken = (): void => {
  try { localStorage.removeItem(TOKEN_KEY); } catch {}
};

// ─── Core request ─────────────────────────────────────────────────────────────
const getHeaders = (): Record<string, string> => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    // Required by Supabase edge functions gateway
    'Authorization': `Bearer ${publicAnonKey}`,
  };
  const token = getStoredToken();
  if (token) {
    // Our own auth token, separate from the Supabase anon key
    headers['X-Auth-Token'] = token;
  }
  return headers;
};

export async function apiRequest<T = any>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      ...getHeaders(),
      ...options?.headers,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    // Auto-logout hint: caller can listen for 401 if needed
    throw new Error(data.error || `HTTP ${response.status}`);
  }

  return data;
}
