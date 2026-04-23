import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ChatRequest {
  messages: { role: "user" | "assistant"; content: string }[];
  conversationId?: string;
}

const FALLBACK_PROMPT = `Você é a Mayla, assistente de saúde e bem-estar empática e educacional. NUNCA diagnostique nem prescreva. NUNCA se identifique como enfermeira, médica ou outro profissional de saúde. Em emergências, oriente SAMU 192.

REGRAS DE FORMATO (CRÍTICO):
1. Respostas curtas: máximo ~300 caracteres (2-3 frases).
2. Para perguntas estruturadas (ex: "Como está minha saúde hoje?", "Quero conhecer o aplicativo"): responda em BLOCOS NUMERADOS de ~300 caracteres cada, separados por linha em branco. 3 blocos para análises, 4 blocos para tour do app.
3. SEMPRE termine com um bloco [ACTIONS]...[/ACTIONS] em JSON com chips sugeridos. Ex: [ACTIONS][{"id":"consulta","label":"Fazer consulta"}][/ACTIONS]. IDs válidos: consulta, medicao, dicas, relatorio, magazine. Escolha 1-3 chips relevantes. NUNCA mencione esse bloco no texto.

PERSONALIZAÇÃO: se diabetes=true priorize diabetes; hypertension=true priorize hipertensão; sem condições use dicas gerais (sono, hidratação, atividade).

TOM: empático, brasileiro, claro. Use 1 emoji ocasional.`;
const FALLBACK_MODEL = "gemini-2.5-flash";
const FALLBACK_TEMPERATURE = 0.7;

// Mensagem de fallback amigável quando todos os modelos estão sobrecarregados/indisponíveis.
const OVERLOAD_REPLY = `Estou com bastante demanda agora e não consegui processar sua pergunta com toda atenção que ela merece 🙏

Enquanto isso, posso te ajudar com algumas coisas rapidinho. O que faz mais sentido pra você?

[ACTIONS][{"id":"saude_geral","label":"Entender minha saúde"},{"id":"tour_app","label":"Conhecer o app"},{"id":"noticias","label":"Ver novidades de saúde"}][/ACTIONS]`;

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

async function loadActivePrompt(adminClient: any): Promise<{ system_prompt: string; model: string; temperature: number }> {
  const { data } = await adminClient
    .from("assistant_prompts")
    .select("system_prompt, model, temperature")
    .eq("is_active", true)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return {
    system_prompt: data?.system_prompt ?? FALLBACK_PROMPT,
    model: data?.model ?? FALLBACK_MODEL,
    temperature: typeof data?.temperature === "number" ? data.temperature : FALLBACK_TEMPERATURE,
  };
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
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) {
      return new Response(JSON.stringify({ error: "GEMINI_API_KEY não configurada" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Auth: use getUser(token) — getClaims não existe no SDK 2.45
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: authErr } = await userClient.auth.getUser(token);
    if (authErr || !userData?.user?.id) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const userId = userData.user.id;

    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const body: ChatRequest = await req.json();
    if (!Array.isArray(body.messages) || body.messages.length === 0) {
      return new Response(JSON.stringify({ error: "messages required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Carrega prompt ativo + contexto clínico em paralelo
    const [promptCfg, ctx] = await Promise.all([
      loadActivePrompt(adminClient),
      buildHealthContext(adminClient, userId),
    ]);
    const { snapshot, contextMsg } = ctx;

    let conversationId = body.conversationId;
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

    const lastUserMsg = body.messages[body.messages.length - 1];
    if (lastUserMsg?.role === "user") {
      await adminClient.from("assistant_messages").insert({
        conversation_id: conversationId,
        role: "user",
        content: lastUserMsg.content,
      });
    }

    const startedAt = Date.now();

    // Mapeia mensagens para o formato Gemini (user/model)
    const geminiContents = body.messages.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

    // Cascata de modelos: tenta o configurado, depois fallbacks conhecidos.
    const fallbackChain = Array.from(new Set([
      promptCfg.model,
      "gemini-2.5-flash",
      "gemini-2.5-flash-lite",
      "gemini-flash-latest",
    ].filter((m) => m && m !== "gemini-2.0-flash"))); // remove modelo descontinuado

    const geminiPayload = JSON.stringify({
      systemInstruction: { parts: [{ text: `${promptCfg.system_prompt}\n\n${contextMsg}` }] },
      contents: geminiContents,
      generationConfig: { temperature: promptCfg.temperature },
      safetySettings: [
        { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_ONLY_HIGH" },
        { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_ONLY_HIGH" },
        { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_ONLY_HIGH" },
        { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_ONLY_HIGH" },
      ],
    });

    let aiResponse: Response | null = null;
    let usedModel = promptCfg.model;
    let lastErrText = "";
    let lastStatus = 0;

    for (const candidate of fallbackChain) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${candidate}:streamGenerateContent?alt=sse&key=${GEMINI_API_KEY}`;
      console.log(`[health-assistant] trying model: ${candidate}`);
      const resp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: geminiPayload,
      });
      if (resp.ok && resp.body) {
        aiResponse = resp;
        usedModel = candidate;
        console.log(`[health-assistant] using model: ${candidate}`);
        break;
      }
      lastStatus = resp.status;
      lastErrText = await resp.text().catch(() => "");
      console.error(`[health-assistant] model ${candidate} failed (${resp.status}):`, lastErrText.slice(0, 300));
      // Faz cascata para 404 (modelo indisponível), 429 (rate limit) e 5xx (sobrecarga/erro do provider).
      // Erros 401/403 (auth) param imediatamente.
      const shouldFallback = resp.status === 404 || resp.status === 429 || resp.status >= 500;
      if (!shouldFallback) break;
    }

    // Se todos os modelos falharem, devolve uma resposta amigável (em vez de erro)
    // com chips de ação para o usuário continuar interagindo.
    if (!aiResponse || !aiResponse.body) {
      // Erro de autenticação: ainda devolve como erro (problema de configuração).
      if (lastStatus === 401 || lastStatus === 403) {
        return new Response(JSON.stringify({ error: "Chave Gemini inválida. Verifique GEMINI_API_KEY.", providerStatus: lastStatus }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Sobrecarga / rate limit / 5xx → stream sintético com fallback amigável.
      console.warn(`[health-assistant] all models failed (lastStatus=${lastStatus}), returning friendly fallback`);
      const fallbackText = OVERLOAD_REPLY;
      const encoder = new TextEncoder();
      const fallbackStream = new ReadableStream({
        async start(controller) {
          controller.enqueue(encoder.encode(`event: meta\ndata: ${JSON.stringify({ conversationId })}\n\n`));
          // Envia em alguns chunks para manter UX de streaming
          const chunks = fallbackText.match(/[\s\S]{1,80}/g) || [fallbackText];
          for (const c of chunks) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: c } }] })}\n\n`));
            await new Promise((r) => setTimeout(r, 30));
          }
          controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
          controller.close();
          // Persiste a resposta de fallback
          try {
            await adminClient.from("assistant_messages").insert({
              conversation_id: conversationId,
              role: "assistant",
              content: fallbackText,
              model: "fallback-overload",
              latency_ms: Date.now() - startedAt,
            });
            await adminClient.from("assistant_conversations").update({
              last_message_at: new Date().toISOString(),
              message_count: (body.messages.length + 1),
            }).eq("id", conversationId);
          } catch (e) {
            console.error("persist fallback error:", e);
          }
        },
      });
      return new Response(fallbackStream, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
      });
    }
    promptCfg.model = usedModel;

    const reader = aiResponse.body.getReader();
    const decoder = new TextDecoder();
    const encoder = new TextEncoder();
    let assistantText = "";
    let buffer = "";

    const stream = new ReadableStream({
      async start(controller) {
        controller.enqueue(encoder.encode(`event: meta\ndata: ${JSON.stringify({ conversationId })}\n\n`));
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            let idx;
            while ((idx = buffer.indexOf("\n")) !== -1) {
              let line = buffer.slice(0, idx);
              buffer = buffer.slice(idx + 1);
              if (line.endsWith("\r")) line = line.slice(0, -1);
              if (!line.startsWith("data: ")) continue;
              const json = line.slice(6).trim();
              if (!json || json === "[DONE]") continue;
              try {
                const parsed = JSON.parse(json);
                const parts = parsed?.candidates?.[0]?.content?.parts ?? [];
                let delta = "";
                for (const p of parts) if (typeof p?.text === "string") delta += p.text;
                if (delta) {
                  assistantText += delta;
                  // Re-emite no formato OpenAI-like que o frontend já entende
                  const oaiChunk = { choices: [{ delta: { content: delta } }] };
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify(oaiChunk)}\n\n`));
                }
              } catch { /* partial */ }
            }
          }
          controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
        } catch (e) {
          console.error("stream error:", e);
        } finally {
          controller.close();
          const latency = Date.now() - startedAt;
          try {
            const { data: msg } = await adminClient.from("assistant_messages").insert({
              conversation_id: conversationId,
              role: "assistant",
              content: assistantText,
              model: promptCfg.model,
              latency_ms: latency,
            }).select("id").single();

            await adminClient.from("assistant_conversations").update({
              last_message_at: new Date().toISOString(),
              message_count: (body.messages.length + 1),
            }).eq("id", conversationId);

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
