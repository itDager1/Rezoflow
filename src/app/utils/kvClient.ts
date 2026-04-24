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
  const { error } = await supabase.from(TABLE).upsert({ key, value });
  if (error) throw new Error(`kvSet error [${key}]: ${error.message}`);
}

export async function kvDel(key: string): Promise<void> {
  const { error } = await supabase.from(TABLE).delete().eq('key', key);
  if (error) throw new Error(`kvDel error [${key}]: ${error.message}`);
}

export async function kvGetByPrefix(prefix: string): Promise<any[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('value')
    .like('key', `${prefix}%`);
  if (error) throw new Error(`kvGetByPrefix error [${prefix}]: ${error.message}`);
  return data?.map(d => d.value) ?? [];
}
