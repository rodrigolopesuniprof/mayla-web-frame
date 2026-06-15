// Cancela assinatura ao fim do ciclo (cancel_at_period_end).
// Usuário mantém acesso até current_period_end; Pagar.me não emite mais cobranças.
import { createClient } from "jsr:@supabase/supabase-js@2";
import { getCompanyCredentials, pagarmeFetch } from "../_shared/pagarme.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return j({ error: "Unauthorized" }, 401);
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: auth } } }
    );
    const { data: u } = await supabase.auth.getUser();
    if (!u?.user) return j({ error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const { subscription_id, immediate = false } = body;
    if (!subscription_id) return j({ error: "subscription_id required" }, 400);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: sub } = await admin.from("subscriptions")
      .select("id, user_id, company_id, pagarme_subscription_id, current_period_end")
      .eq("id", subscription_id).single();
    if (!sub) return j({ error: "Not found" }, 404);

    // Permissão: dono ou admin
    const { data: role } = await admin.from("user_roles").select("role")
      .eq("user_id", u.user.id).eq("role", "admin").maybeSingle();
    if (sub.user_id !== u.user.id && !role) return j({ error: "Forbidden" }, 403);

    // Cancela no Pagar.me — sem cobrar faturas pendentes.
    // Pagar.me cancela a assinatura na hora (não há flag "at period end").
    // Mantemos acesso local até current_period_end via cancel_at_period_end.
    if (sub.pagarme_subscription_id) {
      try {
        const creds = await getCompanyCredentials(admin, sub.company_id);
        await pagarmeFetch(creds.apiKey, `/subscriptions/${sub.pagarme_subscription_id}?cancel_pending_invoices=true`, { method: "DELETE" });
      } catch (e) {
        console.error("pagarme cancel error", e);
      }
    }

    if (immediate) {
      // Cancela imediatamente: perde acesso já
      await admin.from("subscriptions").update({
        status: "canceled",
        cancel_at_period_end: false,
        canceled_at: new Date().toISOString(),
      }).eq("id", sub.id);
    } else {
      // Cancela ao fim do ciclo: mantém status active até current_period_end
      await admin.from("subscriptions").update({
        cancel_at_period_end: true,
        canceled_at: new Date().toISOString(),
      }).eq("id", sub.id);
    }

    // Enfileira e-mail de confirmação de cancelamento
    try {
      const { data: authUser } = await admin.auth.admin.getUserById(sub.user_id);
      const recipient = authUser?.user?.email;
      if (recipient) {
        const { data: profile } = await admin.from("profiles").select("full_name").eq("user_id", sub.user_id).maybeSingle();
        const name = (profile?.full_name ?? "").split(" ")[0] || "Olá";
        const endDate = sub.current_period_end
          ? new Date(sub.current_period_end).toLocaleDateString("pt-BR")
          : null;
        const html = renderCanceledEmail(name, immediate ? null : endDate);
        await admin.rpc("enqueue_email", {
          queue_name: "transactional_emails",
          payload: {
            to: recipient,
            subject: "Assinatura cancelada",
            html,
            message_id: `sub-canceled-${sub.id}-${Date.now()}`,
            template_name: "subscription_canceled",
          },
        }).catch((e: any) => console.log("enqueue_email skipped:", e?.message));
      }
    } catch (e) {
      console.error("email enqueue error", e);
    }

    return j({ ok: true, cancel_at_period_end: !immediate });
  } catch (e) {
    return j({ error: (e as Error).message }, 500);
  }
});

function renderCanceledEmail(name: string, endDate: string | null): string {
  const accessMsg = endDate
    ? `<p>Você continua com acesso completo à plataforma até <strong>${endDate}</strong>. Após essa data, sua assinatura será encerrada e o acesso aos serviços premium será suspenso.</p>`
    : `<p>Seu acesso aos serviços premium foi suspenso imediatamente.</p>`;
  return `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;background:#f9f5f0;">
    <div style="background:#fff;border-radius:16px;padding:32px;">
      <h1 style="color:#2a6496;font-size:20px;">Assinatura cancelada</h1>
      <p>Olá, ${name}.</p>
      <p>Confirmamos o cancelamento da sua assinatura.</p>
      ${accessMsg}
      <p>Se mudar de ideia, é só assinar novamente a qualquer momento dentro do app.</p>
      <hr style="border:none;border-top:1px solid #eee;margin:24px 0;">
      <p style="font-size:12px;color:#aaa;text-align:center;">E-mail automático — não responda.</p>
    </div></body></html>`;
}

function j(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
