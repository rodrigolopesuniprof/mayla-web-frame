import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3.23.8";
import { lunaSubmit, normalizeWhatsapp, rateLimit, clientIp } from "../_shared/luna.ts";

const BodySchema = z.object({
  nome: z.string().trim().min(1).max(120),
  whatsapp: z.string().trim().min(8).max(20),
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    if (!rateLimit(clientIp(req))) {
      return new Response(JSON.stringify({ ok: false, error: "rate_limited" }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const raw = await req.json().catch(() => null);
    const parsed = BodySchema.safeParse(raw);
    if (!parsed.success) {
      return new Response(JSON.stringify({ ok: false, error: parsed.error.flatten().fieldErrors }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const wp = normalizeWhatsapp(parsed.data.whatsapp);
    if (!wp.ok) {
      return new Response(JSON.stringify({ ok: false, error: wp.error }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const nome = parsed.data.nome;
    const celular = wp.celular;

    const body = {
      nome,
      celular,
      ddi: "55",
      abrir_conversa: false,
      tags: ["site-mayla-saude", "teste-saude"],
      campos: {
        seu_nome: nome,
        whats_app: celular,
      },
    };

    const upstream = await lunaSubmit("site-mayla-saude-teste-de-saude", body);
    const text = await upstream.text();
    if (!upstream.ok) {
      console.error("[demo-lead-submit] upstream error", upstream.status, text);
      return new Response(JSON.stringify({ ok: false, error: "crm_error", status: upstream.status }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[demo-lead-submit] fatal", err);
    return new Response(JSON.stringify({ ok: false, error: "internal_error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
