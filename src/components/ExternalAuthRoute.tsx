import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { AccessGate } from "@/components/AccessGate";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  readExternalAuthAttempt,
  removeSsidFromUrl,
  type ExternalAuthAttempt,
} from "@/lib/external-auth";
import Index from "@/pages/Index";

type AuthState =
  | { phase: "idle" | "authenticating"; errorCode?: never; requestId?: never }
  | { phase: "authenticated"; errorCode?: never; requestId?: never }
  | { phase: "error"; errorCode: string; requestId?: string };

interface ExternalAuthResponse {
  ok?: boolean;
  token_hash?: string;
  type?: string;
  error?: string;
  request_id?: string;
}

const errorMessages: Readonly<Record<string, string>> = {
  invalid_source: "A origem deste acesso não é permitida.",
  invalid_ssid: "O link de acesso é inválido.",
  invalid_external_session: "Este link de acesso é inválido ou já foi utilizado.",
  inactive_external_user: "Este usuário está inativo no sistema de origem.",
  identity_conflict: "Não foi possível associar este acesso à conta existente.",
  rate_limited: "Muitas tentativas foram feitas. Aguarde um minuto e tente novamente.",
  external_timeout: "O sistema de origem demorou demais para responder.",
  external_unavailable: "O sistema de origem está indisponível no momento.",
};

function currentAttempt(): ExternalAuthAttempt | null {
  return readExternalAuthAttempt(window.location.search);
}

async function responseFromInvokeError(error: unknown): Promise<ExternalAuthResponse | null> {
  if (!error || typeof error !== "object" || !("context" in error)) return null;
  const context = (error as { context?: unknown }).context;
  if (!(context instanceof Response)) return null;

  try {
    return await context.clone().json() as ExternalAuthResponse;
  } catch {
    return null;
  }
}

function LoadingState() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center">
        <div className="mx-auto mb-3 h-7 w-7 animate-spin rounded-full border-2 border-accent border-t-transparent" />
        <p className="text-muted-foreground">Validando seu acesso...</p>
      </div>
    </div>
  );
}

export function ExternalAuthRoute() {
  const { user } = useAuth();
  const attemptRef = useRef<ExternalAuthAttempt | null | undefined>(undefined);
  if (attemptRef.current === undefined) attemptRef.current = currentAttempt();
  const attempt = attemptRef.current;
  const started = useRef(false);
  const authenticatedUserId = useRef<string | null>(null);
  const [state, setState] = useState<AuthState>(() => ({
    phase: attempt ? "authenticating" : "idle",
  }));

  useLayoutEffect(() => {
    if (!attempt) return;
    const cleanUrl = removeSsidFromUrl(new URL(window.location.href));
    window.history.replaceState(window.history.state, "", cleanUrl);
  }, [attempt]);

  useEffect(() => {
    if (!attempt || started.current) return;
    started.current = true;
    let cancelled = false;

    const authenticate = async () => {
      // The external flow must never fall back to a session that was already open.
      const { error: signOutError } = await supabase.auth.signOut({ scope: "local" });
      if (signOutError) throw signOutError;

      const { data, error } = await supabase.functions.invoke<ExternalAuthResponse>(
        "external-auth",
        { body: { source: attempt.source, ssid: attempt.ssid } },
      );

      if (error) {
        const errorBody = await responseFromInvokeError(error);
        throw Object.assign(new Error("external_auth_failed"), {
          errorCode: errorBody?.error ?? "service_unavailable",
          requestId: errorBody?.request_id,
        });
      }
      if (!data?.ok || typeof data.token_hash !== "string" || data.type !== "email") {
        throw Object.assign(new Error("invalid_auth_response"), {
          errorCode: data?.error ?? "service_unavailable",
          requestId: data?.request_id,
        });
      }

      const { data: otpData, error: otpError } = await supabase.auth.verifyOtp({
        token_hash: data.token_hash,
        type: "email",
      });
      if (otpError || !otpData.user || !otpData.session) {
        throw Object.assign(otpError ?? new Error("session_creation_failed"), {
          errorCode: "session_creation_failed",
          requestId: data.request_id,
        });
      }

      authenticatedUserId.current = otpData.user.id;
      if (!cancelled) setState({ phase: "authenticated" });
    };

    authenticate().catch((error: unknown) => {
      if (cancelled) return;
      const details = error as { errorCode?: string; requestId?: string };
      setState({
        phase: "error",
        errorCode: details.errorCode ?? "service_unavailable",
        requestId: details.requestId,
      });
    });

    return () => {
      cancelled = true;
    };
  }, [attempt]);

  if (state.phase === "error") {
    if (state.errorCode === "email_not_registered") {
      return <Navigate to="/login" replace />;
    }

    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6">
        <div className="w-full max-w-sm text-center">
          <h1 className="mb-2 text-xl font-semibold text-foreground">Não foi possível entrar</h1>
          <p className="mb-6 text-muted-foreground">
            {errorMessages[state.errorCode] ?? "Não foi possível validar seu acesso. Tente novamente mais tarde."}
          </p>
          {state.requestId && (
            <p className="mb-6 text-xs text-muted-foreground">Código de atendimento: {state.requestId}</p>
          )}
          <Link className="text-sm font-medium text-primary underline-offset-4 hover:underline" to="/login">
            Ir para o login
          </Link>
        </div>
      </div>
    );
  }

  if (attempt && (
    state.phase !== "authenticated" ||
    !authenticatedUserId.current ||
    user?.id !== authenticatedUserId.current
  )) {
    return <LoadingState />;
  }

  return (
    <ProtectedRoute>
      <AccessGate>
        <Index initialTab={attempt?.target ?? "inicio"} />
      </AccessGate>
    </ProtectedRoute>
  );
}
