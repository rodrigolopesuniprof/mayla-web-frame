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
}

export function HealthMagazineCarousel({ onOpenArticle }: { onOpenArticle: (id: string) => void }) {
  const [articles, setArticles] = useState<Article[]>([]);

  useEffect(() => {
    supabase
      .from("health_articles")
      .select("id, slug, title, cover_image_url, excerpt, tags, reading_time_minutes")
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .order("published_at", { ascending: false })
      .limit(8)
      .then(({ data }) => {
        if (data) setArticles(data as Article[]);
      });
  }, []);

  if (articles.length === 0) return null;

  return (
    <div className="mb-5">
      <div className="px-5 mb-3 flex items-baseline justify-between">
        <p className="text-xs font-medium text-muted-foreground tracking-[.1em] uppercase">Saúde &amp; Bem-estar</p>
        <span className="text-xs text-muted-foreground">Magazine</span>
      </div>
      <div className="flex gap-3 overflow-x-auto px-5 pb-2 snap-x snap-mandatory" style={{ scrollbarWidth: "none" }}>
        {articles.map((a) => (
          <button
            key={a.id}
            onClick={() => onOpenArticle(a.id)}
            className="snap-start shrink-0 w-[260px] bg-secondary rounded-2xl overflow-hidden text-left active:scale-[.97] transition-transform"
          >
            <div
              className="w-full h-32 bg-muted"
              style={{
                background: a.cover_image_url
                  ? `url(${a.cover_image_url}) center/cover`
                  : "linear-gradient(135deg, hsl(var(--mayla-pref)), hsl(var(--mayla-pref-lt)))",
              }}
            />
            <div className="p-3">
              {a.tags && a.tags[0] && (
                <span className="text-[10px] font-semibold uppercase tracking-wider text-accent">{a.tags[0]}</span>
              )}
              <div className="text-sm font-semibold text-foreground leading-snug mt-1 line-clamp-2">{a.title}</div>
              {a.reading_time_minutes && (
                <div className="text-xs text-muted-foreground mt-1">{a.reading_time_minutes} min de leitura</div>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
