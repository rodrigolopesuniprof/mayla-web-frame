import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { supabase } from "@/integrations/supabase/client";

interface Article {
  id: string;
  title: string;
  cover_image_url: string | null;
  excerpt: string | null;
  content_markdown: string;
  tags: string[] | null;
  author_name: string | null;
  reading_time_minutes: number | null;
  published_at: string | null;
}

export function HealthMagazineArticle({ articleId, onBack }: { articleId: string; onBack: () => void }) {
  const [article, setArticle] = useState<Article | null>(null);
  const viewIdRef = useRef<string | null>(null);
  const startTimeRef = useRef<number>(Date.now());

  useEffect(() => {
    supabase
      .from("health_articles")
      .select("*")
      .eq("id", articleId)
      .maybeSingle()
      .then(async ({ data }) => {
        if (data) {
          setArticle(data as Article);
          // log view
          const { data: userData } = await supabase.auth.getUser();
          if (userData.user) {
            const { data: view } = await supabase
              .from("health_article_views")
              .insert({ user_id: userData.user.id, article_id: articleId })
              .select("id")
              .single();
            if (view) viewIdRef.current = view.id;
          }
        }
      });

    return () => {
      // Update read duration on unmount
      const duration = Math.floor((Date.now() - startTimeRef.current) / 1000);
      if (viewIdRef.current) {
        supabase
          .from("health_article_views")
          .update({ read_duration_seconds: duration, completed: duration > 30 })
          .eq("id", viewIdRef.current)
          .then();
      }
    };
  }, [articleId]);

  if (!article) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-6 h-6 rounded-full border-2 border-accent border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-background overflow-hidden">
      <div className="px-5 py-4 border-b border-border flex items-center gap-3">
        <button onClick={onBack} className="text-2xl text-foreground active:opacity-60" aria-label="Voltar">‹</button>
        <div className="font-display text-base font-semibold text-foreground flex-1 truncate">Saúde &amp; Bem-estar</div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {article.cover_image_url && (
          <div
            className="w-full h-48"
            style={{ background: `url(${article.cover_image_url}) center/cover` }}
          />
        )}
        <div className="px-5 py-5">
          {article.tags && article.tags[0] && (
            <span className="text-[10px] font-semibold uppercase tracking-wider text-accent">{article.tags[0]}</span>
          )}
          <h1 className="font-display text-2xl font-semibold text-foreground mt-2 leading-tight">{article.title}</h1>
          <div className="flex gap-2 text-xs text-muted-foreground mt-2">
            {article.author_name && <span>{article.author_name}</span>}
            {article.reading_time_minutes && <span>· {article.reading_time_minutes} min</span>}
          </div>
          <div className="prose prose-sm max-w-none text-foreground mt-5 prose-strong:text-foreground prose-headings:text-foreground prose-headings:font-display">
            <ReactMarkdown>{article.content_markdown}</ReactMarkdown>
          </div>
        </div>
      </div>
    </div>
  );
}
