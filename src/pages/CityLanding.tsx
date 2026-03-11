import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

export default function CityLanding() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!slug) return;

    const load = async () => {
      const { data } = await supabase
        .from("municipalities")
        .select("id, name")
        .eq("slug", slug)
        .maybeSingle();

      if (data) {
        localStorage.setItem("selected_municipality_id", data.id);
        localStorage.setItem("selected_municipality_name", data.name);
        navigate("/login", { replace: true });
      } else {
        setError(true);
      }
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
          <p className="text-muted-foreground mb-4">Município não encontrado.</p>
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
