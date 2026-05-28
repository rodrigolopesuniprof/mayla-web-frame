import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";

const BUCKET = "app-branding";
const PROJECT_URL = "https://ymexlslqsdflgkcvwjoz.supabase.co";

function publicUrl(path: string) {
  // cache-bust based on minute to force browser refresh after re-upload
  return `${PROJECT_URL}/storage/v1/object/public/${BUCKET}/${path}?v=${Date.now()}`;
}

interface SlotProps {
  title: string;
  description: string;
  recommended: string;
  path: string;
  accept: string;
  aspect: string;
}

function BrandingSlot({ title, description, recommended, path, accept, aspect }: SlotProps) {
  const [preview, setPreview] = useState(() => publicUrl(path));
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (file: File) => {
    setUploading(true);
    const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
      upsert: true,
      cacheControl: "0",
      contentType: file.type,
    });
    setUploading(false);
    if (error) {
      toast({ title: "Erro ao enviar", description: error.message, variant: "destructive" });
      return;
    }
    toast({
      title: "Imagem atualizada!",
      description: "Pode levar algumas horas para o WhatsApp/redes sociais atualizarem o cache.",
    });
    setPreview(publicUrl(path));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">{description}</p>
        <p className="text-xs text-muted-foreground">
          <strong>Recomendado:</strong> {recommended}
        </p>
        <div
          className="border border-border rounded-lg overflow-hidden bg-secondary flex items-center justify-center"
          style={{ aspectRatio: aspect, maxWidth: 400 }}
        >
          <img
            src={preview}
            alt={title}
            className="w-full h-full object-contain"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = "none";
            }}
          />
        </div>
        <div>
          <Label htmlFor={`upload-${path}`} className="sr-only">Enviar arquivo</Label>
          <input
            id={`upload-${path}`}
            type="file"
            accept={accept}
            disabled={uploading}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleUpload(f);
              e.target.value = "";
            }}
            className="block text-sm file:mr-3 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:bg-primary file:text-primary-foreground file:cursor-pointer cursor-pointer"
          />
        </div>
      </CardContent>
    </Card>
  );
}

export function AdminBranding() {
  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h2 className="font-display text-2xl text-foreground">🎨 Marca & Compartilhamento</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Imagens globais usadas em todos os domínios do app. A atualização vale para todos os colaboradores
          imediatamente — o cache de WhatsApp/redes sociais pode demorar algumas horas.
        </p>
      </div>

      <BrandingSlot
        title="Ícone do app (favicon)"
        description="Ícone exibido ao lado do link em navegadores, WhatsApp e abas do navegador. Substitui o ícone padrão da plataforma."
        recommended="PNG quadrado, 512×512px, fundo transparente ou colorido."
        path="favicon.png"
        accept="image/png,image/jpeg,image/x-icon"
        aspect="1 / 1"
      />

      <BrandingSlot
        title="Imagem de compartilhamento (banner)"
        description="Imagem que aparece quando o link do app é compartilhado no WhatsApp, LinkedIn, Facebook, Telegram etc."
        recommended="JPG ou PNG retangular, 1200×630px (proporção 1.91:1)."
        path="social-banner.jpg"
        accept="image/jpeg,image/png"
        aspect="1200 / 630"
      />
    </div>
  );
}
