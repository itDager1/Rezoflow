// Frontend KV store — reads/writes directly to the Supabase kv_store_ca4c8ee9 table
// using the same key structure as the server-side kv_store.tsx
import { supabase } from './supabase';

const TABLE = 'kv_store_ca4c8ee9';

// Only TRUE is cached permanently — false/errors are never cached so the next
// call automatically retries. This prevents a bad probe on page-load from
// permanently blocking cross-device data sharing.
let _available: true | null = null;

// Call this after Supabase Auth login so the probe re-runs with authenticated JWT
export function resetAvailabilityCache(): void {
  _available = null;
}

export async function isAvailable(): Promise<boolean> {
  if (_available === true) return true; // Fast path: already confirmed available

  try {
    const { error } = await supabase
      .from(TABLE)
      .select('key')
      .eq('key', '__rf_probe__')
      .maybeSingle();

    if (!error) {
      _available = true;
      return true;
    }

    const code = error.code || '';
    const msg  = error.message?.toLowerCase() || '';
    const isAuthError =
      code === 'PGRST301' ||
      code === '42501'    ||
      msg.includes('permission denied') ||
      msg.includes('jwt')               ||
      msg.includes('not allowed');

    if (!isAuthError) {
      // Non-auth error (e.g. row not found) — table is accessible
      _available = true;
      return true;
    }

    // Auth / permission error — don't cache, allow retry after re-login
    return false;
  } catch {
    // Network error — don't cache, retry on next call
    return false;
  }
}

export async function kvGet(key: string): Promise<any> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('value')
    .eq('key', key)
    .maybeSingle();
  if (error) throw new Error(`kvGet error [${key}]: ${error.message}`);
  return data?.value ?? null;
}

export async function kvSet(key: string, value: any): Promise<void> {
  const MAX_RETRIES = 3;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      // Exponential back-off: 400 ms, 800 ms
      await new Promise(r => setTimeout(r, 400 * attempt));
    }

    try {
      const { error } = await supabase
        .from(TABLE)
        .upsert({ key, value }, { onConflict: 'key' });

      if (!error) return; // success

      lastError = new Error(`kvSet error [${key}]: ${error.message}`);

      // Only retry on transient schema-cache / connectivity errors
      const msg = (error.message ?? '').toLowerCase();
      const isRetryable =
        msg.includes('schema cache') ||
        msg.includes('retrying')     ||
        msg.includes('connection')   ||
        msg.includes('network')      ||
        msg.includes('fetch')        ||
        msg.includes('timeout');

      if (!isRetryable) break; // permanent error – don't retry
    } catch (err) {
      // Supabase itself threw (e.g. TypeError: Failed to fetch when offline)
      lastError = new Error(`kvSet error [${key}]: ${err instanceof Error ? err.message : String(err)}`);
      // Always retry on thrown errors — they're transient by nature
    }
  }

  throw lastError;
}

export async function kvDel(key: string): Promise<void> {
  const MAX_RETRIES = 3;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      await new Promise(r => setTimeout(r, 400 * attempt));
    }
    try {
      const { error } = await supabase.from(TABLE).delete().eq('key', key);
      if (!error) return;
      lastError = new Error(`kvDel error [${key}]: ${error.message}`);
      const msg = (error.message ?? '').toLowerCase();
      const isRetryable =
        msg.includes('schema cache') ||
        msg.includes('connection')   ||
        msg.includes('network')      ||
        msg.includes('fetch')        ||
        msg.includes('timeout');
      if (!isRetryable) break;
    } catch (err) {
      lastError = new Error(`kvDel error [${key}]: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  if (lastError) throw lastError;
}

export async function kvGetByPrefix(prefix: string): Promise<any[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('value')
    .like('key', `${prefix}%`);
  if (error) throw new Error(`kvGetByPrefix error [${prefix}]: ${error.message}`);
  return data?.map(d => d.value) ?? [];
}