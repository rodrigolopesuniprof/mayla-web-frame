import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3.23.8";
import { lunaSubmit, lunaOpenConversation, normalizeWhatsapp, rateLimit, clientIp } from "../_shared/luna.ts";

const MedicaoSchema = z.object({
  heart_rate: z.number().optional().nullable(),
  blood_pressure_sys: z.number().optional().nullable(),
  blood_pressure_dia: z.number().optional().nullable(),
  spo2: z.number().optional().nullable(),
  respiratory_rate: z.number().optional().nullable(),
  stress_level: z.number().optional().nullable(),
  hrv_sdnn: z.number().optional().nullable(),
  wellness_score: z.number().optional().nullable(),
  hemoglobin: z.number().optional().nullable(),
  hba1c: z.number().optional().nullable(),
});

const BodySchema = z.object({
  nome: z.string().trim().min(1).max(120),
  whatsapp: z.string().trim().min(8).max(20),
  medicao: MedicaoSchema,
});

function fmtInt(n: number | null | undefined): string | undefined {
  if (n == null || Number.isNaN(n)) return undefined;
  return String(Math.round(n));
}
function fmtDec(n: number | null | undefined, decimals = 1): string | undefined {
  if (n == null || Number.isNaN(n)) return undefined;
  // Brazilian decimal separator
  return Number(n).toFixed(decimals).replace(".", ",");
}

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
    const m = parsed.data.medicao;

    const paSys = fmtInt(m.blood_pressure_sys);
    const paDia = fmtInt(m.blood_pressure_dia);
    const pa = paSys && paDia ? `${paSys}/${paDia}` : undefined;

    const campos: Record<string, string> = {};
    const fc = fmtInt(m.heart_rate);
    if (fc) campos["f_c"] = fc;
    if (pa) campos["p_a"] = pa;
    const spo2 = fmtInt(m.spo2);
    if (spo2) campos["s_p_o2"] = spo2;
    const fr = fmtInt(m.respiratory_rate);
    if (fr) campos["f_r"] = fr;
    const stress = fmtInt(m.stress_level);
    if (stress) campos["s_t_r_e_s_s"] = stress;
    const vfc = fmtInt(m.hrv_sdnn);
    if (vfc) campos["v_f_c"] = vfc;
    const wellness = fmtInt(m.wellness_score);
    if (wellness) campos["b_e_m-_e_s_t_a_r"] = wellness;
    const hemog = fmtDec(m.hemoglobin, 1);
    if (hemog) campos["h_e_m_o_g"] = hemog;
    const hba1c = fmtDec(m.hba1c, 1);
    if (hba1c) campos["h_b_a1_c"] = hba1c;

    if (!campos["f_c"]) {
      // FC is required by the CRM form spec — bail cleanly if the measurement produced no HR.
      return new Response(JSON.stringify({ ok: false, error: "missing_fc" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = {
      nome,
      celular,
      ddi: "55",
      abrir_conversa: true,
      tags: ["site-mayla-saude", "dados-saude"],
      campos,
    };

    const upstream = await lunaSubmit("dados-de-saude", body);
    const text = await upstream.text();
    if (!upstream.ok) {
      console.error("[demo-health-submit] upstream error", upstream.status, text);
      return new Response(JSON.stringify({ ok: false, error: "crm_error", status: upstream.status }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let widgetUrl: string | null = null;
    let expiresAt: string | null = null;
    try {
      const parsedUpstream = JSON.parse(text);
      widgetUrl = parsedUpstream?.data?.widget?.url ?? null;
      expiresAt = parsedUpstream?.data?.widget?.expira_em ?? null;
    } catch (e) {
      console.warn("[demo-health-submit] could not parse upstream json", e);
    }
    if (!widgetUrl) {
      console.warn("[demo-health-submit] upstream ok but no widget.url in payload; body:", text);
    }

    return new Response(JSON.stringify({ ok: true, widgetUrl, expiresAt }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[demo-health-submit] fatal", err);
    return new Response(JSON.stringify({ ok: false, error: "internal_error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
