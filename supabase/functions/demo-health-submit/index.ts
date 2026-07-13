import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3.23.8";
import { lunaSubmit, lunaOpenChatConversation, normalizeWhatsapp, rateLimit, clientIp } from "../_shared/luna.ts";

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

function buildMeasurementSummary(campos: Record<string, string>): string {
  const lines = [
    "Olá, Maria. Finalizei meu teste de saúde pela câmera no site da Mayla e quero conversar sobre meu resultado.",
    "",
    "Resumo da avaliação:",
  ];

  const labels: Array<[string, string]> = [
    ["f_c", "Frequência cardíaca"],
    ["p_a", "Pressão arterial"],
    ["s_p_o2", "SpO₂"],
    ["f_r", "Frequência respiratória"],
    ["s_t_r_e_s_s", "Estresse"],
    ["v_f_c", "VFC"],
    ["b_e_m-_e_s_t_a_r", "Bem-estar"],
    ["h_e_m_o_g", "Hemoglobina"],
    ["h_b_a1_c", "HbA1c"],
  ];

  for (const [key, label] of labels) {
    if (campos[key]) lines.push(`- ${label}: ${campos[key]}`);
  }

  lines.push("", "Observação: este é um teste demonstrativo e não substitui avaliação profissional.");
  return lines.join("\n");
}

function extractWidget(payload: unknown): { widgetUrl: string | null; expiresAt: string | null; conversationId: number | null } {
  const data = (payload as any)?.data ?? payload as any;
  const widget = data?.widget ?? data?.handoff ?? data?.conversa?.widget ?? null;
  return {
    widgetUrl: widget?.url ?? data?.widgetUrl ?? data?.widget_url ?? null,
    expiresAt: widget?.expira_em ?? widget?.expires_at ?? data?.expiresAt ?? null,
    conversationId: data?.conversa?.id ?? data?.conversa_id ?? data?.conversationId ?? null,
  };
}

function safeDebugBody(text: string): string {
  return text.length > 1200 ? `${text.slice(0, 1200)}...` : text;
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
      abrir_conversa: false,
      conexao_id: 1,
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

    // Second call: open a fresh conversation with the Maria agent via /conversas.
    // LunaOS documents this endpoint as the direct handoff route: it registers
    // the first inbound message, triggers the IA observer and returns data.widget.url
    // when conexao_id points to a site connection.
    let widgetUrl: string | null = null;
    let expiresAt: string | null = null;
    let chatError: string | null = null;
    let conversationId: number | null = null;
    let debug: Record<string, unknown> | null = null;
    try {
      const conversaBody: Record<string, unknown> = {
        nome,
        celular,
        ddi: "55",
        conexao_id: 1,
        assunto: "Teste de saúde Mayla",
        mensagem: buildMeasurementSummary(campos),
        tags: ["site-mayla-saude", "dados-saude", "abrir-chat-maria"],
      };
      const chatRes = await lunaOpenChatConversation(conversaBody);
      const chatText = await chatRes.text();
      if (!chatRes.ok) {
        console.error("[demo-health-submit] /conversas error", chatRes.status, chatText);
        chatError = `conversas_${chatRes.status}`;
        debug = { route: "/conversas", status: chatRes.status, body: safeDebugBody(chatText) };
      } else {
        try {
          const parsedChat = JSON.parse(chatText);
          const handoff = extractWidget(parsedChat);
          widgetUrl = handoff.widgetUrl;
          expiresAt = handoff.expiresAt;
          conversationId = handoff.conversationId;
          if (!widgetUrl) {
            console.warn("[demo-health-submit] /conversas ok but no widget.url; body:", chatText);
            chatError = "no_widget_url";
            debug = { route: "/conversas", status: chatRes.status, body: safeDebugBody(chatText) };
          }
        } catch (e) {
          console.warn("[demo-health-submit] could not parse /conversas json", e, chatText);
          chatError = "parse_error";
          debug = { route: "/conversas", status: chatRes.status, body: safeDebugBody(chatText) };
        }
      }
    } catch (e) {
      console.error("[demo-health-submit] /conversas fetch failed", e);
      chatError = "fetch_failed";
    }

    return new Response(JSON.stringify({ ok: true, widgetUrl, expiresAt, chatError, conversationId, debug }), {
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
