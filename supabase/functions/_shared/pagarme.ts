// Helpers compartilhados para integração Pagar.me
// - Criptografia AES-GCM das API keys das empresas
// - Cliente HTTP autenticado (basic auth)

export const PAGARME_API_URL = "https://api.pagar.me/core/v5";

const enc = new TextEncoder();
const dec = new TextDecoder();

function b64encode(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}
function b64decode(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function getMasterKey(): Promise<CryptoKey> {
  const raw = Deno.env.get("PAGARME_MASTER_KEY");
  if (!raw) throw new Error("PAGARME_MASTER_KEY not configured");
  // Deriva chave de 256 bits via SHA-256
  const hash = await crypto.subtle.digest("SHA-256", enc.encode(raw));
  return crypto.subtle.importKey("raw", hash, "AES-GCM", false, ["encrypt", "decrypt"]);
}

export async function encryptSecret(plain: string): Promise<string> {
  const key = await getMasterKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(plain))
  );
  const out = new Uint8Array(iv.length + ct.length);
  out.set(iv, 0);
  out.set(ct, iv.length);
  return b64encode(out);
}

export async function decryptSecret(encoded: string): Promise<string> {
  const key = await getMasterKey();
  const all = b64decode(encoded);
  const iv = all.slice(0, 12);
  const ct = all.slice(12);
  const pt = new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct));
  return dec.decode(pt);
}

export function buildAuthHeader(apiKey: string): string {
  return "Basic " + btoa(`${apiKey}:`);
}

export async function pagarmeFetch(
  apiKey: string,
  path: string,
  init: RequestInit = {}
): Promise<Response> {
  const url = `${PAGARME_API_URL}${path}`;
  const headers = new Headers(init.headers);
  headers.set("Authorization", buildAuthHeader(apiKey));
  headers.set("Content-Type", "application/json");
  return fetch(url, { ...init, headers });
}

export async function getCompanyCredentials(
  supabase: any,
  companyId: string
): Promise<{ apiKey: string; recipientId: string | null; environment: string }> {
  const { data, error } = await supabase
    .from("company_payment_credentials")
    .select("pagarme_api_key_encrypted, pagarme_recipient_id, environment, enabled")
    .eq("company_id", companyId)
    .maybeSingle();
  if (error) throw new Error(`Failed to load credentials: ${error.message}`);
  if (!data || !data.enabled) throw new Error("Empresa sem integração Pagar.me ativa");
  if (!data.pagarme_api_key_encrypted) throw new Error("Chave Pagar.me não configurada");
  const apiKey = await decryptSecret(data.pagarme_api_key_encrypted);
  return { apiKey, recipientId: data.pagarme_recipient_id, environment: data.environment };
}
