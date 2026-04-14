import { supabase } from "@/integrations/supabase/client";

export async function proxyCall(action: string, params: Record<string, string> = {}, method = "GET", body?: any) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Não autenticado");

  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const qs = new URLSearchParams({ action, ...params }).toString();
  const url = `https://${projectId}.supabase.co/functions/v1/prontuario-proxy?${qs}`;

  const resp = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ error: "Erro desconhecido" }));
    throw new Error(err.error || `HTTP ${resp.status}`);
  }
  return resp.json();
}
