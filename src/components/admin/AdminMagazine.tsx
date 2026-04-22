import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Bold, Italic, Heading1, Heading2, Heading3, List, ListOrdered, Link as LinkIcon, Image as ImageIcon, Quote, Code, Minus, Eye, Pencil } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

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
  company_id: string | null;
  is_global: boolean;
}

interface Props {
  /** When provided: scoped to that company. When undefined: global Mayla Saúde channel (super admin only). */
  companyId?: string;
}

export function AdminMagazine({ companyId }: Props) {
  const [articles, setArticles] = useState<Article[]>([]);
  const [editing, setEditing] = useState<Partial<Article> | null>(null);
  const isGlobalChannel = !companyId;
  const contentRef = useRef<HTMLTextAreaElement>(null);
  const [previewMode, setPreviewMode] = useState(false);

  const wrapSelection = (before: string, after = before, placeholder = "texto") => {
    const ta = contentRef.current;
    if (!ta || !editing) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const value = editing.content_markdown || "";
    const selected = value.slice(start, end) || placeholder;
    const next = value.slice(0, start) + before + selected + after + value.slice(end);
    setEditing({ ...editing, content_markdown: next });
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(start + before.length, start + before.length + selected.length);
    });
  };

  const insertLinePrefix = (prefix: string) => {
    const ta = contentRef.current;
    if (!ta || !editing) return;
    const start = ta.selectionStart;
    const value = editing.content_markdown || "";
    const lineStart = value.lastIndexOf("\n", start - 1) + 1;
    const next = value.slice(0, lineStart) + prefix + value.slice(lineStart);
    setEditing({ ...editing, content_markdown: next });
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(start + prefix.length, start + prefix.length);
    });
  };

  const insertBlock = (block: string) => {
    const ta = contentRef.current;
    if (!ta || !editing) return;
    const start = ta.selectionStart;
    const value = editing.content_markdown || "";
    const needsNewlineBefore = start > 0 && value[start - 1] !== "\n";
    const insertion = (needsNewlineBefore ? "\n" : "") + block;
    const next = value.slice(0, start) + insertion + value.slice(start);
    setEditing({ ...editing, content_markdown: next });
    requestAnimationFrame(() => {
      ta.focus();
      const pos = start + insertion.length;
      ta.setSelectionRange(pos, pos);
    });
  };

  const insertLink = () => {
    const url = prompt("URL do link:", "https://");
    if (!url) return;
    wrapSelection("[", `](${url})`, "texto do link");
  };

  const insertImage = () => {
    const url = prompt("URL da imagem:", "https://");
    if (!url) return;
    insertBlock(`![imagem](${url})\n`);
  };

  const load = useCallback(async () => {
    let query = supabase
      .from("health_articles")
      .select("*")
      .order("sort_order")
      .order("created_at", { ascending: false });

    if (isGlobalChannel) {
      query = query.eq("is_global", true).is("company_id", null);
    } else {
      query = query.eq("company_id", companyId);
    }
    const { data } = await query;
    setArticles((data || []) as Article[]);
  }, [companyId, isGlobalChannel]);

  useEffect(() => { load(); }, [load]);

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
      company_id: isGlobalChannel ? null : companyId,
      is_global: isGlobalChannel,
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
    const { error } = await supabase.from("health_articles").delete().eq("id", id);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-display font-semibold text-foreground">
            {isGlobalChannel ? "📰 Magazine Global — Mayla Saúde" : "📰 Magazine da Empresa"}
          </h2>
          <p className="text-sm text-muted-foreground">
            {isGlobalChannel
              ? "Artigos publicados aqui aparecem para colaboradores de todas as empresas."
              : "Artigos exclusivos para os colaboradores desta empresa."}
          </p>
        </div>
        <Button onClick={() => setEditing({ is_active: true, tags: [] })}>+ Novo artigo</Button>
      </div>

      <div className="grid gap-3">
        {articles.map((a) => (
          <Card key={a.id} className="p-4 flex items-center gap-4">
            <div className="flex-1">
              <div className="font-semibold text-foreground flex items-center gap-2">
                {a.title}
                {a.is_global ? (
                  <Badge variant="secondary" className="text-[10px]">🌐 Global Mayla</Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px]">🏢 Empresa</Badge>
                )}
              </div>
              <div className="text-xs text-muted-foreground">{a.slug} · {a.is_active ? "Ativo" : "Inativo"}</div>
            </div>
            <Button variant="outline" size="sm" onClick={() => setEditing(a)}>Editar</Button>
            <Button variant="destructive" size="sm" onClick={() => remove(a.id)}>Excluir</Button>
          </Card>
        ))}
        {articles.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">Nenhum artigo cadastrado ainda.</p>
        )}
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
              <div>
                <div className="flex items-center justify-between mb-1">
                  <Label>Conteúdo (markdown)</Label>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setPreviewMode((p) => !p)} className="h-7 px-2 text-xs gap-1">
                    {previewMode ? <><Pencil className="w-3 h-3" /> Editar</> : <><Eye className="w-3 h-3" /> Visualizar</>}
                  </Button>
                </div>
                {!previewMode && (
                  <div className="flex flex-wrap gap-1 p-1 border border-b-0 rounded-t-md bg-muted/40">
                    <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0" title="Negrito (Ctrl+B)" onClick={() => wrapSelection("**")}><Bold className="w-3.5 h-3.5" /></Button>
                    <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0" title="Itálico (Ctrl+I)" onClick={() => wrapSelection("*")}><Italic className="w-3.5 h-3.5" /></Button>
                    <div className="w-px bg-border mx-0.5" />
                    <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0" title="Título 1" onClick={() => insertLinePrefix("# ")}><Heading1 className="w-3.5 h-3.5" /></Button>
                    <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0" title="Título 2" onClick={() => insertLinePrefix("## ")}><Heading2 className="w-3.5 h-3.5" /></Button>
                    <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0" title="Título 3" onClick={() => insertLinePrefix("### ")}><Heading3 className="w-3.5 h-3.5" /></Button>
                    <div className="w-px bg-border mx-0.5" />
                    <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0" title="Lista" onClick={() => insertLinePrefix("- ")}><List className="w-3.5 h-3.5" /></Button>
                    <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0" title="Lista numerada" onClick={() => insertLinePrefix("1. ")}><ListOrdered className="w-3.5 h-3.5" /></Button>
                    <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0" title="Citação" onClick={() => insertLinePrefix("> ")}><Quote className="w-3.5 h-3.5" /></Button>
                    <div className="w-px bg-border mx-0.5" />
                    <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0" title="Link" onClick={insertLink}><LinkIcon className="w-3.5 h-3.5" /></Button>
                    <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0" title="Imagem" onClick={insertImage}><ImageIcon className="w-3.5 h-3.5" /></Button>
                    <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0" title="Código" onClick={() => wrapSelection("`")}><Code className="w-3.5 h-3.5" /></Button>
                    <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0" title="Linha horizontal" onClick={() => insertBlock("\n---\n")}><Minus className="w-3.5 h-3.5" /></Button>
                  </div>
                )}
                {previewMode ? (
                  <div className="prose prose-sm max-w-none border rounded-md p-4 min-h-[260px] bg-background prose-headings:font-display prose-headings:text-foreground prose-p:text-foreground prose-a:text-primary prose-strong:text-foreground">
                    {editing.content_markdown
                      ? <ReactMarkdown remarkPlugins={[remarkGfm]}>{editing.content_markdown}</ReactMarkdown>
                      : <p className="text-muted-foreground italic text-sm">Sem conteúdo para visualizar.</p>}
                  </div>
                ) : (
                  <Textarea
                    ref={contentRef}
                    rows={12}
                    className="rounded-t-none font-mono text-sm"
                    placeholder="Escreva em markdown. Use a barra de ferramentas acima para formatar."
                    value={editing.content_markdown || ""}
                    onChange={(e) => setEditing({ ...editing, content_markdown: e.target.value })}
                    onKeyDown={(e) => {
                      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") { e.preventDefault(); wrapSelection("**"); }
                      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "i") { e.preventDefault(); wrapSelection("*"); }
                    }}
                  />
                )}
              </div>
              <div><Label>Tags (separadas por vírgula)</Label><Input value={(editing.tags || []).join(", ")} onChange={(e) => setEditing({ ...editing, tags: e.target.value.split(",").map((t) => t.trim()).filter(Boolean) })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Tempo de leitura (min)</Label><Input type="number" value={editing.reading_time_minutes || ""} onChange={(e) => setEditing({ ...editing, reading_time_minutes: parseInt(e.target.value) || null })} /></div>
                <div><Label>Autor</Label><Input value={editing.author_name || ""} onChange={(e) => setEditing({ ...editing, author_name: e.target.value })} /></div>
              </div>
              <div className="flex items-center gap-2"><Switch checked={editing.is_active ?? true} onCheckedChange={(v) => setEditing({ ...editing, is_active: v })} /><Label>Ativo</Label></div>
              <div className="text-xs text-muted-foreground">
                {isGlobalChannel
                  ? "🌐 Este artigo será publicado no canal global Mayla Saúde."
                  : "🏢 Este artigo será exclusivo desta empresa."}
              </div>
              <div className="flex gap-2 pt-2"><Button variant="ghost" onClick={() => setEditing(null)} className="flex-1">Cancelar</Button><Button onClick={save} className="flex-1">Salvar</Button></div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
