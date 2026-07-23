import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.99.0";
import {
  ExternalAuthValidationError,
  parseExternalAuthRequest,
  parseExternalPatient,
  type ExternalPatient,
} from "./logic.ts";

const REQUEST_BODY_LIMIT = 4_096;
const EXTERNAL_RESPONSE_LIMIT = 65_536;
const EXTERNAL_TIMEOUT_MS = 30_000;
const RATE_LIMIT = 10;
const RATE_LIMIT_WINDOW_SECONDS = 60;

type AdminClient = SupabaseClient;

class ExternalAuthError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
  ) {
    super(code);
    this.name = "ExternalAuthError";
  }
}

interface RuntimeConfig {
  externalApiUrl: string;
  externalApiToken: string;
  allowedOrigins: Set<string>;
  rateLimitSalt: string;
  supabaseUrl: string;
  serviceRoleKey: string;
}

function getRuntimeConfig(): RuntimeConfig {
  const externalApiUrl = Deno.env.get("EXTERNAL_AUTH_API_URL")?.trim();
  const externalApiToken = Deno.env.get("EXTERNAL_AUTH_API_TOKEN")?.trim();
  const rateLimitSalt = Deno.env.get("EXTERNAL_AUTH_RATE_LIMIT_SALT")?.trim();
  const supabaseUrl = Deno.env.get("SUPABASE_URL")?.trim();
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim();
  const allowedOrigins = new Set(
    (Deno.env.get("EXTERNAL_AUTH_ALLOWED_ORIGINS") || "")
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),
  );

  if (
    !externalApiUrl ||
    !externalApiToken ||
    !rateLimitSalt ||
    !supabaseUrl ||
    !serviceRoleKey ||
    allowedOrigins.size === 0
  ) {
    throw new ExternalAuthError("service_unavailable", 503);
  }

  for (const origin of allowedOrigins) {
    let parsedOrigin: URL;
    try {
      parsedOrigin = new URL(origin);
    } catch {
      throw new ExternalAuthError("service_unavailable", 503);
    }
    const isLocalHttp = parsedOrigin.protocol === "http:" &&
      ["localhost", "127.0.0.1"].includes(parsedOrigin.hostname);
    if (
      origin === "*" ||
      parsedOrigin.origin !== origin ||
      (parsedOrigin.protocol !== "https:" && !isLocalHttp)
    ) {
      throw new ExternalAuthError("service_unavailable", 503);
    }
  }

  let parsedApiUrl: URL;
  try {
    parsedApiUrl = new URL(externalApiUrl);
  } catch {
    throw new ExternalAuthError("service_unavailable", 503);
  }
  if (parsedApiUrl.protocol !== "https:") {
    throw new ExternalAuthError("service_unavailable", 503);
  }

  return {
    externalApiUrl: parsedApiUrl.toString(),
    externalApiToken,
    allowedOrigins,
    rateLimitSalt,
    supabaseUrl,
    serviceRoleKey,
  };
}

function corsHeaders(origin: string | null, allowedOrigins: Set<string>): HeadersInit {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "600",
    "Vary": "Origin",
  };
  if (origin && allowedOrigins.has(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }
  return headers;
}

function jsonResponse(
  body: unknown,
  status: number,
  origin: string | null,
  allowedOrigins: Set<string>,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(origin, allowedOrigins),
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function clientAddress(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded ||
    req.headers.get("cf-connecting-ip")?.trim() ||
    req.headers.get("x-real-ip")?.trim() ||
    "unknown";
}

async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function enforceRateLimit(
  admin: AdminClient,
  req: Request,
  salt: string,
): Promise<void> {
  const keyHash = await sha256(`${salt}:${clientAddress(req)}`);
  const { data, error } = await admin.rpc("consume_external_auth_rate_limit", {
    _key_hash: keyHash,
    _limit: RATE_LIMIT,
    _window_seconds: RATE_LIMIT_WINDOW_SECONDS,
  });

  if (error) throw new ExternalAuthError("service_unavailable", 503);
  if (data !== true) throw new ExternalAuthError("rate_limited", 429);
}

async function fetchExternalPatient(
  config: RuntimeConfig,
  ssid: string,
): Promise<ExternalPatient> {
  const url = new URL(config.externalApiUrl);
  url.searchParams.set("uuid", ssid);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), EXTERNAL_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(url, {
      method: "GET",
      headers: {
        "Accept": "application/json",
        "Authorization": `Bearer ${config.externalApiToken}`,
      },
      redirect: "error",
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new ExternalAuthError("external_timeout", 504);
    }
    throw new ExternalAuthError("external_unavailable", 502);
  } finally {
    clearTimeout(timeout);
  }

  if ([400, 404, 410, 422].includes(response.status)) {
    throw new ExternalAuthError("invalid_external_session", 401);
  }
  if (!response.ok) {
    throw new ExternalAuthError("external_unavailable", 502);
  }

  const declaredLength = Number(response.headers.get("content-length") || 0);
  if (declaredLength > EXTERNAL_RESPONSE_LIMIT) {
    throw new ExternalAuthError("invalid_external_response", 502);
  }

  const rawBody = await response.text();
  if (rawBody.length > EXTERNAL_RESPONSE_LIMIT) {
    throw new ExternalAuthError("invalid_external_response", 502);
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    throw new ExternalAuthError("invalid_external_response", 502);
  }

  return parseExternalPatient(body);
}

async function findAuthUserIdByEmail(
  admin: AdminClient,
  email: string,
): Promise<string | null> {
  const { data, error } = await admin.rpc("get_auth_user_id_by_email", {
    _email: email,
  });
  if (error) throw new ExternalAuthError("service_unavailable", 503);
  return typeof data === "string" ? data : null;
}

async function generateLoginToken(
  admin: AdminClient,
  userId: string,
): Promise<string> {
  const { data: authUser, error: userError } = await admin.auth.admin
    .getUserById(userId);
  if (userError || !authUser.user?.email) {
    throw new ExternalAuthError("provisioning_failed", 500);
  }

  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: authUser.user.email,
  });
  if (error || !data.properties?.hashed_token) {
    throw new ExternalAuthError("token_generation_failed", 500);
  }
  if (!data.user || data.user.id !== userId) {
    throw new ExternalAuthError("identity_conflict", 409);
  }

  return data.properties.hashed_token;
}

Deno.serve(async (req) => {
  const requestId = crypto.randomUUID();
  const startedAt = Date.now();
  const origin = req.headers.get("origin");
  let allowedOrigins = new Set<string>();

  const finish = (
    body: unknown,
    status: number,
    logCode: string,
  ): Response => {
    console.log(JSON.stringify({
      event: "external_auth",
      request_id: requestId,
      code: logCode,
      status,
      duration_ms: Date.now() - startedAt,
    }));
    return jsonResponse(body, status, origin, allowedOrigins);
  };

  try {
    const config = getRuntimeConfig();
    allowedOrigins = config.allowedOrigins;

    if (origin && !allowedOrigins.has(origin)) {
      throw new ExternalAuthError("origin_not_allowed", 403);
    }
    if (req.method === "OPTIONS") {
      return jsonResponse({ ok: true }, 200, origin, allowedOrigins);
    }
    if (req.method !== "POST") {
      throw new ExternalAuthError("method_not_allowed", 405);
    }

    const declaredLength = Number(req.headers.get("content-length") || 0);
    if (declaredLength > REQUEST_BODY_LIMIT) {
      throw new ExternalAuthError("invalid_body", 400);
    }

    const rawBody = await req.text();
    if (rawBody.length > REQUEST_BODY_LIMIT) {
      throw new ExternalAuthError("invalid_body", 400);
    }

    let body: unknown;
    try {
      body = JSON.parse(rawBody);
    } catch {
      throw new ExternalAuthError("invalid_body", 400);
    }
    const externalRequest = parseExternalAuthRequest(body);

    const admin = createClient(config.supabaseUrl, config.serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });

    await enforceRateLimit(admin, req, config.rateLimitSalt);
    const patient = await fetchExternalPatient(config, externalRequest.ssid);
    const userId = await findAuthUserIdByEmail(admin, patient.email);
    if (!userId) {
      throw new ExternalAuthError("email_not_registered", 404);
    }
    const tokenHash = await generateLoginToken(admin, userId);

    return finish(
      { ok: true, token_hash: tokenHash, type: "email" },
      200,
      "success",
    );
  } catch (error) {
    if (error instanceof ExternalAuthValidationError) {
      const status = error.code === "inactive_external_user"
        ? 403
        : error.code === "invalid_external_response"
        ? 502
        : 400;
      return finish(
        { ok: false, error: error.code, request_id: requestId },
        status,
        error.code,
      );
    }
    if (error instanceof ExternalAuthError) {
      return finish(
        { ok: false, error: error.code, request_id: requestId },
        error.status,
        error.code,
      );
    }

    console.error(JSON.stringify({
      event: "external_auth_unexpected",
      request_id: requestId,
      duration_ms: Date.now() - startedAt,
    }));
    return jsonResponse(
      { ok: false, error: "internal_error", request_id: requestId },
      500,
      origin,
      allowedOrigins,
    );
  }
});
