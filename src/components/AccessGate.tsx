import { useHasAccess } from "@/hooks/useHasAccess";
import { Navigate, useLocation } from "react-router-dom";

/**
 * Bloqueia acesso à plataforma se o usuário não tem via válida.
 * Redireciona para /perfil/assinatura quando empresa exige assinatura paga.
 */
export function AccessGate({ children }: { children: React.ReactNode }) {
  const access = useHasAccess();
  const location = useLocation();

  if (access.loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <p className="text-muted-foreground">Verificando acesso...</p>
      </div>
    );
  }

  if (!access.hasAccess && location.pathname !== "/perfil/assinatura") {
    return <Navigate to="/perfil/assinatura" replace />;
  }

  return <>{children}</>;
}
