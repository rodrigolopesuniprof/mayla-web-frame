import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";

interface QrScannerProps {
  onScan: (code: string) => void;
  onClose: () => void;
}

export function QrScanner({ onScan, onClose }: QrScannerProps) {
  const [error, setError] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerRef = useRef<string>("qr-reader-" + Math.random().toString(36).slice(2));

  useEffect(() => {
    const scanner = new Html5Qrcode(containerRef.current);
    scannerRef.current = scanner;

    scanner
      .start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          scanner.stop().catch(() => {});
          onScan(decodedText);
        },
        () => {} // ignore scan failures
      )
      .catch((err) => {
        setError("Não foi possível acessar a câmera. Verifique as permissões.");
        console.error("QR Scanner error:", err);
      });

    return () => {
      scanner.stop().catch(() => {});
    };
  }, [onScan]);

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex flex-col items-center justify-center p-6">
      <div className="bg-card rounded-2xl p-5 w-full max-w-sm flex flex-col items-center gap-4">
        <h3 className="font-display text-lg font-medium text-foreground">Escanear QR Code</h3>
        <p className="text-[12px] text-muted-foreground text-center">
          Aponte a câmera para o QR Code da unidade de saúde
        </p>

        <div
          id={containerRef.current}
          className="w-full rounded-xl overflow-hidden"
          style={{ minHeight: 280 }}
        />

        {error && (
          <p className="text-[12px] text-destructive text-center">{error}</p>
        )}

        <button
          onClick={onClose}
          className="w-full py-3 rounded-xl border border-border bg-card text-[14px] font-medium text-foreground cursor-pointer hover:bg-secondary/50 transition-colors"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
