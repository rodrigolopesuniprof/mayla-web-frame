import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface Article {
  id: string;
  slug: string;
  title: string;
  cover_image_url: string | null;
  excerpt: string | null;
  content_markdown: string;
  tags: string[] | null;
  reading_time_minutes: number | null;
  author_name: string | null;
  is_active: boolean;
}

export function AdminMagazine() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [editing, setEditing] = useState<Partial<Article> | null>(null);

  const load = async () => {
    const { data } = await supabase.from("health_articles").select("*").order("sort_order").order("created_at", { ascending: false });
    setArticles((data || []) as Article[]);
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!editing?.title || !editing.slug || !editing.content_markdown) {
      toast({ title: "Preencha título, slug e conteúdo", variant: "destructive" });
      return;
    }
    const payload: any = {
      slug: editing.slug,
      title: editing.title,
      cover_image_url: editing.cover_image_url || null,
      excerpt: editing.excerpt || null,
      content_markdown: editing.content_markdown,
      tags: editing.tags || [],
      reading_time_minutes: editing.reading_time_minutes || null,
      author_name: editing.author_name || null,
      is_active: editing.is_active ?? true,
    };
    const { error } = editing.id
      ? await supabase.from("health_articles").update(payload).eq("id", editing.id)
      : await supabase.from("health_articles").insert({ ...payload, published_at: new Date().toISOString() });
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Artigo salvo!" });
    setEditing(null);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Excluir artigo?")) return;
    await supabase.from("health_articles").delete().eq("id", id);
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-display font-semibold text-foreground">Magazine de Saúde</h2>
          <p className="text-sm text-muted-foreground">Artigos exibidos na tela inicial dos colaboradores</p>
        </div>
        <Button onClick={() => setEditing({ is_active: true, tags: [] })}>+ Novo artigo</Button>
      </div>

      <div className="grid gap-3">
        {articles.map((a) => (
          <Card key={a.id} className="p-4 flex items-center gap-4">
            <div className="flex-1">
              <div className="font-semibold text-foreground">{a.title}</div>
              <div className="text-xs text-muted-foreground">{a.slug} · {a.is_active ? "Ativo" : "Inativo"}</div>
            </div>
            <Button variant="outline" size="sm" onClick={() => setEditing(a)}>Editar</Button>
            <Button variant="destructive" size="sm" onClick={() => remove(a.id)}>Excluir</Button>
          </Card>
        ))}
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing?.id ? "Editar" : "Novo"} artigo</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div><Label>Título</Label><Input value={editing.title || ""} onChange={(e) => setEditing({ ...editing, title: e.target.value })} /></div>
              <div><Label>Slug</Label><Input value={editing.slug || ""} onChange={(e) => setEditing({ ...editing, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-") })} /></div>
              <div><Label>Imagem de capa (URL)</Label><Input value={editing.cover_image_url || ""} onChange={(e) => setEditing({ ...editing, cover_image_url: e.target.value })} /></div>
              <div><Label>Resumo</Label><Textarea value={editing.excerpt || ""} onChange={(e) => setEditing({ ...editing, excerpt: e.target.value })} /></div>
              <div><Label>Conteúdo (markdown)</Label><Textarea rows={10} value={editing.content_markdown || ""} onChange={(e) => setEditing({ ...editing, content_markdown: e.target.value })} /></div>
              <div><Label>Tags (separadas por vírgula)</Label><Input value={(editing.tags || []).join(", ")} onChange={(e) => setEditing({ ...editing, tags: e.target.value.split(",").map((t) => t.trim()).filter(Boolean) })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Tempo de leitura (min)</Label><Input type="number" value={editing.reading_time_minutes || ""} onChange={(e) => setEditing({ ...editing, reading_time_minutes: parseInt(e.target.value) || null })} /></div>
                <div><Label>Autor</Label><Input value={editing.author_name || ""} onChange={(e) => setEditing({ ...editing, author_name: e.target.value })} /></div>
              </div>
              <div className="flex items-center gap-2"><Switch checked={editing.is_active ?? true} onCheckedChange={(v) => setEditing({ ...editing, is_active: v })} /><Label>Ativo</Label></div>
              <div className="flex gap-2 pt-2"><Button variant="ghost" onClick={() => setEditing(null)} className="flex-1">Cancelar</Button><Button onClick={save} className="flex-1">Salvar</Button></div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
