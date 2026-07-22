// Shared helpers for LunaOS CRM integration used by /demo edge functions.
export const LUNA_BASE_URL = "https://mayla.lunaos.com.br/api/v1";

export function normalizeWhatsapp(input: string): { ok: false; error: string } | { ok: true; celular: string } {
  const digits = (input || "").replace(/\D/g, "");
  // strip leading 55 country code if present and length > 11
  let celular = digits;
  if (celular.startsWith("55") && celular.length > 11) celular = celular.slice(2);
  if (celular.length < 10 || celular.length > 13) {
    return { ok: false, error: "WhatsApp inválido" };
  }
  return { ok: true, celular };
}

export async function lunaSubmit(slug: string, body: Record<string, unknown>): Promise<Response> {
  const token = Deno.env.get("LUNA_API_TOKEN");
  if (!token) {
    return new Response(JSON.stringify({ ok: false, error: "LUNA_API_TOKEN not configured" }), { status: 500 });
  }
  const res = await fetch(`${LUNA_BASE_URL}/formularios/${slug}/respostas`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
  });
  return res;
}

export async function lunaOpenConversation(body: Record<string, unknown>): Promise<Response> {
  const token = Deno.env.get("LUNA_API_TOKEN");
  if (!token) {
    return new Response(JSON.stringify({ ok: false, error: "LUNA_API_TOKEN not configured" }), { status: 500 });
  }
  const res = await fetch(`${LUNA_BASE_URL}/contatos`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
  });
  return res;
}

export async function lunaOpenChatConversation(body: Record<string, unknown>): Promise<Response> {
  const token = Deno.env.get("LUNA_API_TOKEN");
  if (!token) {
    return new Response(JSON.stringify({ ok: false, error: "LUNA_API_TOKEN not configured" }), { status: 500 });
  }
  const res = await fetch(`${LUNA_BASE_URL}/conversas`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
  });
  return res;
}

// Very simple in-memory IP throttle: 20 requests per 5 minutes.
const buckets = new Map<string, { count: number; resetAt: number }>();
export function rateLimit(ip: string, limit = 20, windowMs = 5 * 60 * 1000): boolean {
  const now = Date.now();
  const b = buckets.get(ip);
  if (!b || b.resetAt < now) {
    buckets.set(ip, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (b.count >= limit) return false;
  b.count++;
  return true;
}

export function clientIp(req: Request): string {
  return (
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}
