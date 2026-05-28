// Edge function: cria usuário via link de convite, contornando a trava
// global de "Signups not allowed". Roda com SERVICE_ROLE_KEY.
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function dicebearUrl(name: string, seed: string) {
  const s = encodeURIComponent(`${name || "user"}-${seed}`);
  return `https://api.dicebear.com/7.x/avataaars/svg?seed=${s}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ ok: false, reason: "method_not_allowed" }, 405);

  try {
    const body = await req.json().catch(() => null) as null | {
      token?: string; email?: string; password?: string; full_name?: string; cpf?: string;
    };
    if (!body) return json({ ok: false, reason: "invalid_body" }, 400);

    const token = (body.token || "").trim();
    const email = (body.email || "").trim().toLowerCase();
    const password = body.password || "";
    const full_name = (body.full_name || "").trim();
    const cpf = (body.cpf || "").replace(/\D/g, "");

    if (!token) return json({ ok: false, reason: "missing_token" }, 400);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ ok: false, reason: "invalid_email" }, 400);
    if (password.length < 6) return json({ ok: false, reason: "weak_password" }, 400);
    if (!full_name) return json({ ok: false, reason: "missing_name" }, 400);
    if (cpf.length !== 11) return json({ ok: false, reason: "invalid_cpf" }, 400);

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // 1) valida token
    const { data: vtData, error: vtErr } = await admin.rpc("validate_invite_token", { _token: token });
    if (vtErr) {
      console.error("validate_invite_token error", vtErr);
      return json({ ok: false, reason: "token_validation_failed" }, 500);
    }
    const tInfo = Array.isArray(vtData) ? vtData[0] : vtData;
    if (!tInfo || !tInfo.valid || !tInfo.company_id) {
      return json({ ok: false, reason: tInfo?.reason || "invalid_token" }, 400);
    }
    const company_id: string = tInfo.company_id;

    // 2) cria usuário já confirmado (verificação por e-mail desativada por enquanto)
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name, cpf, company_id },
    });

    if (createErr || !created.user) {
      const msg = (createErr?.message || "").toLowerCase();
      let reason = "create_failed";
      if (msg.includes("already") || msg.includes("registered") || msg.includes("exists")) reason = "email_in_use";
      else if (msg.includes("password")) reason = "weak_password";
      else if (msg.includes("email")) reason = "invalid_email";
      console.error("createUser error", createErr);
      return json({ ok: false, reason, detail: createErr?.message }, 400);
    }

    const userId = created.user.id;

    // 3) registra uso do token (incrementa contador, marca signed_up_via_token)
    const { data: regData, error: regErr } = await admin.rpc("register_via_invite_token", {
      _token: token, _user_id: userId,
    });
    const reg = regData as { ok: boolean; reason?: string } | null;
    if (regErr || !reg || !reg.ok) {
      // rollback do usuário criado
      await admin.auth.admin.deleteUser(userId).catch(() => {});
      console.error("register_via_invite_token failed", { regErr, reg });
      return json({ ok: false, reason: reg?.reason || "register_failed" }, 400);
    }

    // 4) avatar DiceBear + 50 pts (não bloqueia o cadastro se falhar)
    try {
      await admin.rpc("apply_dicebear_avatar", {
        _user_id: userId,
        _url: dicebearUrl(full_name, userId),
      });
    } catch (e) {
      console.warn("apply_dicebear_avatar failed", e);
    }

    return json({ ok: true, user_id: userId, company_id });
  } catch (err) {
    console.error("invite-signup unexpected error", err);
    return json({ ok: false, reason: "internal_error" }, 500);
  }
});
