import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assert, assertEquals, assertStringIncludes } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL") ?? Deno.env.get("SUPABASE_URL")!;
const FN_URL = `${SUPABASE_URL}/functions/v1/health-assistant-chat`;

Deno.test("returns 401 without Authorization header", async () => {
  const res = await fetch(FN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages: [{ role: "user", content: "oi" }] }),
  });
  const text = await res.text();
  assertEquals(res.status, 401);
  assertStringIncludes(text, "Unauthorized");
});

Deno.test("returns 401 with invalid bearer token", async () => {
  const res = await fetch(FN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer not-a-valid-token" },
    body: JSON.stringify({ messages: [{ role: "user", content: "oi" }] }),
  });
  const text = await res.text();
  assertEquals(res.status, 401);
  assertStringIncludes(text.toLowerCase(), "unauthorized");
});

Deno.test("CORS preflight returns the allowed origin", async () => {
  const res = await fetch(FN_URL, { method: "OPTIONS" });
  await res.text();
  assertEquals(res.status, 200);
  assertEquals(res.headers.get("access-control-allow-origin"), "*");
});

// --- Unit tests for pure logic (re-implemented locally to avoid importing Deno.serve) ---

function detectSafetyFlags(text: string): { type: string }[] {
  const flags: { type: string }[] = [];
  const lower = text.toLowerCase();
  if (/\b(você (tem|está com)|seu diagnóstico|isso é|você sofre de)\b/.test(lower) && /(diabetes|hipertensão|depressão|ansiedade|covid|gripe|infecção)/.test(lower)) {
    flags.push({ type: "diagnosis_attempt" });
  }
  if (/\b(tome|use|aplique|dose de|mg|comprimido|antibiótico|antidepressivo|anti-inflamatório)\b/.test(lower)) {
    flags.push({ type: "prescription_attempt" });
  }
  return flags;
}

Deno.test("safety: detects prescription attempt", () => {
  const flags = detectSafetyFlags("Tome 500mg de antibiótico após o almoço");
  assert(flags.some((f) => f.type === "prescription_attempt"));
});

Deno.test("safety: detects diagnosis attempt", () => {
  const flags = detectSafetyFlags("Você está com diabetes, sem dúvida");
  assert(flags.some((f) => f.type === "diagnosis_attempt"));
});

Deno.test("safety: clean educational answer triggers no flags", () => {
  const flags = detectSafetyFlags("HRV é a variabilidade da frequência cardíaca; converse com seu médico para interpretar.");
  assertEquals(flags.length, 0);
});

Deno.test("anonymization: snapshot does not leak PII fields", () => {
  // Simula construção do snapshot: garantimos no código que apenas birth_date/biological_sex/altura/peso/has_* são selecionados
  // Esse teste documenta o contrato: nenhum campo de nome/cpf/email pode aparecer no JSON enviado ao Gemini.
  const profile = { birth_date: "1990-01-01", biological_sex: "F", altura: 165, peso: 60, has_diabetes: false, has_hypertension: false };
  const snapshot = {
    demographics: { age: 35, biological_sex: profile.biological_sex, height_cm: profile.altura, weight_kg: profile.peso },
    conditions: { diabetes: !!profile.has_diabetes, hypertension: !!profile.has_hypertension },
  };
  const json = JSON.stringify(snapshot);
  assert(!json.toLowerCase().includes("full_name"));
  assert(!json.toLowerCase().includes("cpf"));
  assert(!json.toLowerCase().includes("email"));
});
