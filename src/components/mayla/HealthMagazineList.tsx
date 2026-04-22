import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft } from "lucide-react";

interface Article {
  id: string;
  slug: string;
  title: string;
  cover_image_url: string | null;
  excerpt: string | null;
  tags: string[] | null;
  reading_time_minutes: number | null;
  is_global: boolean | null;
  company_id: string | null;
  published_at: string | null;
}

export function HealthMagazineList({
  onBack,
  onOpenArticle,
}: {
  onBack: () => void;
  onOpenArticle: (id: string) => void;
}) {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // RLS already restricts to: own-company articles + global Mayla articles.
    supabase
      .from("health_articles")
      .select(
        "id, slug, title, cover_image_url, excerpt, tags, reading_time_minutes, is_global, company_id, published_at"
      )
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .order("published_at", { ascending: false })
      .then(({ data }) => {
        if (data) setArticles(data as Article[]);
        setLoading(false);
      });
  }, []);

  return (
    <div className="flex-1 overflow-y-auto bg-background animate-fade-up">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border px-5 py-4 flex items-center gap-3">
        <button
          onClick={onBack}
          className="bg-transparent border-none cursor-pointer p-1 -ml-1 text-foreground"
          aria-label="Voltar"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <p className="font-display text-lg font-semibold text-foreground flex items-center gap-2">
            <span>📰</span>
            <span>Saúde com Você</span>
          </p>
          <p className="text-xs text-muted-foreground">Todos os artigos publicados</p>
        </div>
      </div>

      {/* List */}
      <div className="px-5 py-4 space-y-3">
        {loading && (
          <p className="text-sm text-muted-foreground text-center py-8">Carregando...</p>
        )}

        {!loading && articles.length === 0 && (
          <div className="rounded-3xl p-6 text-center border-2 border-dashed border-border bg-muted/30">
            <div className="text-3xl mb-2">📰</div>
            <p className="text-sm font-semibold text-foreground mb-1">Nenhum artigo publicado</p>
            <p className="text-xs text-muted-foreground leading-snug">
              Quando houver novos conteúdos, eles aparecerão aqui.
            </p>
          </div>
        )}

        {articles.map((a) => (
          <button
            key={a.id}
            onClick={() => onOpenArticle(a.id)}
            className="w-full text-left rounded-2xl overflow-hidden bg-secondary active:scale-[.99] hover:scale-[1.005] transition-transform border-none cursor-pointer p-0 flex gap-3"
          >
            <div
              className="shrink-0 w-24 h-24 rounded-l-2xl"
              style={{
                background: a.cover_image_url
                  ? `url(${a.cover_image_url}) center/cover`
                  : "linear-gradient(135deg, hsl(var(--mayla-pref)), hsl(var(--mayla-pref-lt)))",
              }}
            />
            <div className="flex-1 py-3 pr-3 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                {a.tags && a.tags[0] && (
                  <span
                    className="text-[10px] font-bold uppercase tracking-wider rounded-full px-2 py-0.5"
                    style={{
                      background: "hsl(var(--mayla-pref) / .12)",
                      color: "hsl(var(--mayla-pref))",
                    }}
                  >
                    {a.tags[0]}
                  </span>
                )}
                {a.is_global && (
                  <span className="text-[10px] font-bold rounded-full px-2 py-0.5 bg-foreground/80 text-background">
                    Saúde com Você
                  </span>
                )}
              </div>
              <div className="font-display text-sm font-semibold text-foreground line-clamp-2 leading-snug">
                {a.title}
              </div>
              {a.excerpt && (
                <div className="text-xs text-muted-foreground line-clamp-1 mt-1">
                  {a.excerpt}
                </div>
              )}
              {a.reading_time_minutes && (
                <div className="text-[11px] text-muted-foreground mt-1.5 flex items-center gap-1">
                  <span>⏱</span>
                  <span>{a.reading_time_minutes} min de leitura</span>
                </div>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
