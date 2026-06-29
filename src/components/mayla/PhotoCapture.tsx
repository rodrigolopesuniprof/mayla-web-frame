import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

interface PhotoCaptureProps {
  userId: string;
  onCapture: (url: string) => void;
  onClose: () => void;
}

export function PhotoCapture({ userId, onCapture, onClose }: PhotoCaptureProps) {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    if (!file || file.size > 10 * 1024 * 1024) {
      alert("Arquivo muito grande. Máximo 10MB.");
      return;
    }

    setPreview(URL.createObjectURL(file));
    setUploading(true);

    const ext = file.name.split(".").pop() || "jpg";
    const path = `${userId}/${Date.now()}.${ext}`;

    const { error } = await supabase.storage
      .from("validation-photos")
      .upload(path, file, { contentType: file.type });

    if (error) {
      console.error("Upload error:", error);
      alert("Erro ao enviar foto. Tente novamente.");
      setUploading(false);
      setPreview(null);
      return;
    }

    // Bucket is private — generate a long-lived signed URL (10 years)
    const { data: urlData } = await supabase.storage
      .from("validation-photos")
      .createSignedUrl(path, 60 * 60 * 24 * 365 * 10);

    setUploading(false);
    onCapture(urlData?.signedUrl ?? "");
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex flex-col items-center justify-center p-6">
      <div className="bg-card rounded-2xl p-5 w-full max-w-sm flex flex-col items-center gap-4">
        <h3 className="font-display text-lg font-medium text-foreground">Enviar comprovante</h3>
        <p className="text-[12px] text-muted-foreground text-center">
          Tire uma foto do cartão de vacina, comprovante de consulta ou documento relevante
        </p>

        {preview ? (
          <img src={preview} alt="Preview" className="w-full rounded-xl max-h-60 object-cover" />
        ) : (
          <div
            onClick={() => fileRef.current?.click()}
            className="w-full h-48 rounded-xl border-2 border-dashed border-border flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-accent/40 transition-colors"
          >
            <span className="text-4xl">📷</span>
            <span className="text-[13px] text-muted-foreground">Toque para tirar foto ou selecionar</span>
          </div>
        )}

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
        />

        {uploading && (
          <p className="text-[12px] text-muted-foreground">Enviando foto...</p>
        )}

        <div className="flex gap-3 w-full">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-xl border border-border bg-card text-[14px] font-medium text-foreground cursor-pointer hover:bg-secondary/50 transition-colors"
          >
            Cancelar
          </button>
          {preview && !uploading && (
            <button
              onClick={() => { setPreview(null); fileRef.current?.click(); }}
              className="flex-1 py-3 rounded-xl border border-accent/30 bg-accent/10 text-[14px] font-medium text-accent cursor-pointer hover:bg-accent/20 transition-colors"
            >
              Tirar outra
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
