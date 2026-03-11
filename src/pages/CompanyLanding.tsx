import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

export default function CompanyLanding() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!slug) return;

    const load = async () => {
      // Try companies table first, then municipalities for backward compat
      let found = false;

      const { data: company } = await supabase
        .from("companies")
        .select("id, name")
        .eq("slug", slug)
        .maybeSingle();

      if (company) {
        localStorage.setItem("selected_company_id", company.id);
        localStorage.setItem("selected_company_name", company.name);
        navigate("/login", { replace: true });
        found = true;
      }

      if (!found) {
        const { data: muni } = await supabase
          .from("municipalities")
          .select("id, name")
          .eq("slug", slug)
          .maybeSingle();

        if (muni) {
          localStorage.setItem("selected_municipality_id", muni.id);
          localStorage.setItem("selected_municipality_name", muni.name);
          navigate("/login", { replace: true });
          found = true;
        }
      }

      if (!found) setError(true);
    };

    load();
  }, [slug, navigate]);

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center px-6">
          <div className="font-display text-[42px] font-bold text-foreground tracking-tight leading-none mb-4">
            mayla<span className="text-accent">.</span>
          </div>
          <p className="text-muted-foreground mb-4">Empresa não encontrada.</p>
          <button
            onClick={() => navigate("/login")}
            className="text-primary hover:underline"
          >
            Ir para login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <p className="text-muted-foreground">Carregando...</p>
    </div>
  );
}
