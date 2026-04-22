import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ChatRequest {
  messages: { role: "user" | "assistant"; content: string }[];
  conversationId?: string;
}

const SYSTEM_PROMPT = `Você é a Mayla, uma assistente digital de saúde acolhedora, em português do Brasil. Seu papel é EDUCATIVO e DESCRITIVO.

REGRAS ABSOLUTAS:
1. NUNCA forneça diagnósticos médicos.
2. NUNCA prescreva medicamentos, dosagens ou tratamentos.
3. SEMPRE que valores estiverem fora da faixa normal, recomende avaliação por profissional de saúde.
4. Use tom acolhedor, claro e empático.
5. Use respostas curtas e objetivas, com markdown leve (negrito, listas) quando ajudar a clareza.
6. Se o usuário descrever sintomas graves (dor no peito, falta de ar súbita, perda de consciência, etc.), oriente buscar atendimento de emergência (SAMU 192) imediatamente.
7. Você pode explicar o que cada indicador (FC, PA, SpO2, HRV, etc.) significa e comparar com faixas de referência clínica.
8. Não invente dados. Se não souber, diga que não tem essa informação no contexto.

CONTEXTO CLÍNICO DO USUÁRIO será fornecido em mensagem system separada (anonimizado, sem nome/CPF).`;

async function buildHealthContext(supabase: any, userId: string): Promise<{ snapshot: any; contextMsg: string }> {
  const [{ data: profile }, { data: scoreRow }, { data: measurements }, { data: alerts }] = await Promise.all([
    supabase.from("profiles").select("birth_date, biological_sex, has_diabetes, has_hypertension, altura, peso").eq("user_id", userId).maybeSingle(),
    supabase.from("health_scores").select("score_general, score_physiological, score_emotional, score_lifestyle, generated_at").eq("user_id", userId).order("generated_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("health_measurements").select("heart_rate, blood_pressure_sys, blood_pressure_dia, spo2, respiratory_rate, hrv, stress_level, measured_at").eq("user_id", userId).order("measured_at", { ascending: false }).limit(3),
    supabase.from("health_alerts").select("metric, severity, description, generated_at").eq("user_id", userId).is("dismissed_at", null).order("generated_at", { ascending: false }).limit(5),
  ]);

  const age = profile?.birth_date ? Math.floor((Date.now() - new Date(profile.birth_date).getTime()) / (365.25 * 24 * 3600 * 1000)) : null;

  const snapshot = {
    demographics: {
      age,
      biological_sex: profile?.biological_sex ?? null,
      height_cm: profile?.altura ?? null,
      weight_kg: profile?.peso ?? null,
    },
    conditions: {
      diabetes: !!profile?.has_diabetes,
      hypertension: !!profile?.has_hypertension,
    },
    latest_score: scoreRow ?? null,
    recent_measurements: measurements ?? [],
    active_alerts: alerts ?? [],
  };

  const contextMsg = `DADOS ANONIMIZADOS DO USUÁRIO (use apenas para contextualizar):\n${JSON.stringify(snapshot, null, 2)}`;
  return { snapshot, contextMsg };
}

function detectSafetyFlags(text: string): { type: string; details: any }[] {
  const flags: { type: string; details: any }[] = [];
  const lower = text.toLowerCase();
  if (/\b(você (tem|está com)|seu diagnóstico|isso é|você sofre de)\b/.test(lower) && /(diabetes|hipertensão|depressão|ansiedade|covid|gripe|infecção)/.test(lower)) {
    flags.push({ type: "diagnosis_attempt", details: { excerpt: text.slice(0, 200) } });
  }
  if (/\b(tome|use|aplique|dose de|mg|comprimido|antibiótico|antidepressivo|anti-inflamatório)\b/.test(lower)) {
    flags.push({ type: "prescription_attempt", details: { excerpt: text.slice(0, 200) } });
  }
  return flags;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: authErr } = await userClient.auth.getClaims(token);
    if (authErr || !claims?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const userId = claims.claims.sub;

    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const body: ChatRequest = await req.json();
    if (!Array.isArray(body.messages) || body.messages.length === 0) {
      return new Response(JSON.stringify({ error: "messages required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Build / reuse conversation
    let conversationId = body.conversationId;
    const { snapshot, contextMsg } = await buildHealthContext(adminClient, userId);

    if (!conversationId) {
      const { data: profile } = await adminClient.from("profiles").select("company_id").eq("user_id", userId).maybeSingle();
      const { data: conv, error: convErr } = await adminClient.from("assistant_conversations").insert({
        user_id: userId,
        company_id: profile?.company_id ?? null,
        health_context_snapshot: snapshot,
      }).select("id").single();
      if (convErr) throw convErr;
      conversationId = conv.id;
    }

    // Persist incoming user message (last one)
    const lastUserMsg = body.messages[body.messages.length - 1];
    if (lastUserMsg?.role === "user") {
      await adminClient.from("assistant_messages").insert({
        conversation_id: conversationId,
        role: "user",
        content: lastUserMsg.content,
      });
    }

    const startedAt = Date.now();
    const model = "google/gemini-3-flash-preview";

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        stream: true,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "system", content: contextMsg },
          ...body.messages,
        ],
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Muitas requisições. Aguarde alguns instantes e tente novamente." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos de IA esgotados. Adicione créditos no workspace." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const t = await aiResponse.text();
      console.error("Gateway error:", aiResponse.status, t);
      return new Response(JSON.stringify({ error: "Erro no gateway de IA" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Tee the stream: pass through to client AND collect for persistence
    const reader = aiResponse.body!.getReader();
    const decoder = new TextDecoder();
    let assistantText = "";
    let buffer = "";

    const stream = new ReadableStream({
      async start(controller) {
        // Send conversation id header-equivalent as first SSE event
        controller.enqueue(new TextEncoder().encode(`event: meta\ndata: ${JSON.stringify({ conversationId })}\n\n`));
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value, { stream: true });
            controller.enqueue(value);
            buffer += chunk;
            let idx;
            while ((idx = buffer.indexOf("\n")) !== -1) {
              let line = buffer.slice(0, idx);
              buffer = buffer.slice(idx + 1);
              if (line.endsWith("\r")) line = line.slice(0, -1);
              if (!line.startsWith("data: ")) continue;
              const json = line.slice(6).trim();
              if (json === "[DONE]") continue;
              try {
                const parsed = JSON.parse(json);
                const delta = parsed.choices?.[0]?.delta?.content;
                if (delta) assistantText += delta;
              } catch { /* partial */ }
            }
          }
        } catch (e) {
          console.error("stream error:", e);
        } finally {
          controller.close();
          // Persist assistant message after stream ends
          const latency = Date.now() - startedAt;
          try {
            const { data: msg } = await adminClient.from("assistant_messages").insert({
              conversation_id: conversationId,
              role: "assistant",
              content: assistantText,
              model,
              latency_ms: latency,
            }).select("id").single();

            // Update conversation counters
            await adminClient.from("assistant_conversations").update({
              last_message_at: new Date().toISOString(),
              message_count: (body.messages.length + 1),
            }).eq("id", conversationId);

            // Safety flags
            if (msg?.id) {
              const flags = detectSafetyFlags(assistantText);
              if (flags.length > 0) {
                await adminClient.from("assistant_safety_flags").insert(
                  flags.map((f) => ({ message_id: msg.id, flag_type: f.type, details: f.details }))
                );
              }
            }
          } catch (e) {
            console.error("persist error:", e);
          }
        }
      },
    });

    return new Response(stream, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
    });
  } catch (e) {
    console.error("health-assistant-chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
