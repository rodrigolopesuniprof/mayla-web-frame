import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

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
}

export function HealthMagazineCarousel({ onOpenArticle, onOpenAll }: { onOpenArticle: (id: string) => void; onOpenAll?: () => void }) {
  const [articles, setArticles] = useState<Article[]>([]);

  useEffect(() => {
    // RLS already restricts to: own-company articles + global Mayla articles.
    supabase
      .from("health_articles")
      .select("id, slug, title, cover_image_url, excerpt, tags, reading_time_minutes, is_global, company_id")
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .order("published_at", { ascending: false })
      .limit(8)
      .then(({ data }) => {
        if (data) setArticles(data as Article[]);
      });
  }, []);

  if (articles.length === 0) {
    return (
      <div className="mb-6">
        <div className="px-5 mb-3">
          <p className="font-display text-lg font-semibold text-foreground flex items-center gap-2">
            <span>📰</span>
            <span>Saúde com Você</span>
          </p>
        </div>
        <div className="mx-5 rounded-3xl p-6 text-center border-2 border-dashed border-border bg-muted/30">
          <div className="text-3xl mb-2">📰</div>
          <p className="text-sm font-semibold text-foreground mb-1">Em breve, novidades aqui</p>
          <p className="text-xs text-muted-foreground leading-snug">
            Artigos e dicas de saúde aparecerão neste espaço.<br />
            <span className="text-muted-foreground/70">Admins: cadastre em <strong>Admin → Magazine</strong>.</span>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-6">
      <div className="px-5 mb-3 flex items-baseline justify-between">
        <p className="font-display text-lg font-semibold text-foreground flex items-center gap-2">
          <span>📰</span>
          <span>Saúde com Você</span>
        </p>
        {onOpenAll && (
          <button
            onClick={onOpenAll}
            className="text-xs font-semibold text-accent bg-transparent border-none cursor-pointer p-0 hover:underline"
          >
            Ver todas →
          </button>
        )}
      </div>
      <div
        className="flex gap-3 overflow-x-auto px-5 pb-3 snap-x snap-mandatory"
        style={{ scrollbarWidth: "none", scrollSnapType: "x mandatory" }}
      >
        {articles.map((a) => (
          <button
            key={a.id}
            onClick={() => onOpenArticle(a.id)}
            className="snap-start shrink-0 w-[280px] h-[220px] rounded-3xl overflow-hidden text-left active:scale-[.98] hover:scale-[1.02] transition-transform relative shadow-lg"
            style={{
              background: a.cover_image_url
                ? `url(${a.cover_image_url}) center/cover`
                : "linear-gradient(135deg, hsl(var(--mayla-pref)), hsl(var(--mayla-pref-lt)))",
            }}
          >
            {/* Gradient overlay */}
            <div
              className="absolute inset-0"
              style={{
                background: "linear-gradient(180deg, rgba(0,0,0,0) 30%, rgba(0,0,0,.85) 100%)",
              }}
            />
            {/* Tag pill on top */}
            {a.tags && a.tags[0] && (
              <span
                className="absolute top-3 left-3 text-[10px] font-bold uppercase tracking-wider rounded-full px-3 py-1 backdrop-blur-md"
                style={{ background: "rgba(255,255,255,.92)", color: "hsl(var(--mayla-pref))" }}
              >
                {a.tags[0]}
              </span>
            )}
            {/* Source pill: Mayla Saúde for global, otherwise hidden (company content is the default) */}
            {a.is_global && (
              <span
                className="absolute top-3 right-3 text-[10px] font-bold rounded-full px-2.5 py-1 backdrop-blur-md"
                style={{ background: "rgba(0,0,0,.55)", color: "white" }}
              >
                Saúde com Você
              </span>
            )}
            {/* Title overlay */}
            <div className="absolute bottom-0 left-0 right-0 p-4">
              <div className="text-white font-display text-base font-semibold leading-snug line-clamp-3 drop-shadow-md">
                {a.title}
              </div>
              {a.reading_time_minutes && (
                <div className="text-white/80 text-xs mt-1.5 flex items-center gap-1">
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
