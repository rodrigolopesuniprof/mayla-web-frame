import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface AccessState {
  loading: boolean;
  hasAccess: boolean;
  reason: "loading" | "no_user" | "active" | "no_subscription" | "past_due" | "canceled";
  subscription: any | null;
  requiresPayment: boolean;
}

/**
 * Verifica se o usuário pode acessar a plataforma.
 * Vias válidas: assinatura ativa OU empresa não exige pagamento (cadastro direto / token).
 * Usa a função SQL has_platform_access via RPC para fonte única de verdade.
 */
export function useHasAccess(): AccessState {
  const { user, loading: authLoading } = useAuth();
  const [state, setState] = useState<AccessState>({
    loading: true,
    hasAccess: false,
    reason: "loading",
    subscription: null,
    requiresPayment: false,
  });

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setState({ loading: false, hasAccess: false, reason: "no_user", subscription: null, requiresPayment: false });
      return;
    }

    let cancelled = false;
    (async () => {
      // Busca assinatura mais recente
      const { data: sub } = await supabase
        .from("subscriptions")
        .select("*, plan:subscription_plans(name, price_cents, billing_interval)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      // Verifica se a empresa do usuário exige pagamento
      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("user_id", user.id)
        .maybeSingle();

      let requiresPayment = false;
      if (profile?.company_id) {
        const { data: cred } = await supabase
          .from("company_payment_credentials")
          .select("require_paid_subscription")
          .eq("company_id", profile.company_id)
          .maybeSingle();
        requiresPayment = !!cred?.require_paid_subscription;
      }

      const status = sub?.status;
      const periodOk = !sub?.current_period_end || new Date(sub.current_period_end) > new Date();
      const isActive = (status === "active" || status === "trialing") && periodOk;

      let hasAccess = true;
      let reason: AccessState["reason"] = "active";

      if (requiresPayment) {
        if (isActive) {
          hasAccess = true;
          reason = "active";
        } else {
          hasAccess = false;
          if (!sub) reason = "no_subscription";
          else if (status === "past_due") reason = "past_due";
          else reason = "canceled";
        }
      }

      if (cancelled) return;
      setState({
        loading: false,
        hasAccess,
        reason,
        subscription: sub,
        requiresPayment,
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [user, authLoading]);

  return state;
}
