import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { TeamPickerDialog } from "./TeamPickerDialog";

interface NotificationItem {
  id: string;
  title: string;
  body: string | null;
  emoji: string;
  color: string;
  external_url: string | null;
  scope: string;
}

interface CtaItem {
  id: string;
  emoji: string;
  title: string;
  body: string;
  action: "team" | "consulta" | "medicao" | "magazine";
  color: string;
}

const CTAS: CtaItem[] = [
  { id: "cta-team", emoji: "👥", title: "Entrar em um time", body: "Junte-se a um time colaborativo e ganhe pontos com seus colegas!", action: "team", color: "263 70% 60%" },
  { id: "cta-consulta", emoji: "🩺", title: "Realizar consulta", body: "Fale com um profissional de saúde online ou presencial agora.", action: "consulta", color: "200 80% 50%" },
  { id: "cta-medicao", emoji: "📷", title: "Fazer medição de hoje", body: "30 segundos com a câmera para medir seus sinais vitais. +50 pts!", action: "medicao", color: "340 70% 55%" },
  { id: "cta-magazine", emoji: "📰", title: "Veja as novidades do dia", body: "Confira artigos e dicas frescas sobre saúde e bem-estar.", action: "magazine", color: "30 80% 55%" },
];

interface FabItem {
  kind: "cta" | "notification";
  cta?: CtaItem;
  notification?: NotificationItem;
}

const STORAGE_KEY = "mayla_fab_position";
const SEEN_KEY_PREFIX = "mayla_fab_seen_";
const READ_NOTIF_KEY = "mayla_fab_read_notifs";
const FAB_SIZE = 56;

interface Props {
  onAction: (action: "team" | "consulta" | "medicao" | "magazine") => void;
}

export function MaylaFloatingButton({ onAction }: Props) {
  const { user } = useAuth();
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [items, setItems] = useState<FabItem[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [open, setOpen] = useState(false);
  const [showTeamDialog, setShowTeamDialog] = useState(false);
  const draggingRef = useRef(false);
  const draggedRef = useRef(false);
  const offsetRef = useRef({ x: 0, y: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);

  // Initial position: bottom-right above bottom nav
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (typeof parsed.x === "number" && typeof parsed.y === "number") {
          setPos(parsed);
          return;
        }
      } catch {}
    }
    const w = window.innerWidth;
    const h = window.innerHeight;
    setPos({ x: w - FAB_SIZE - 16, y: h - FAB_SIZE - 100 });
  }, []);

  // Load notifications and pick a CTA
  useEffect(() => {
    if (!user) return;
    const today = new Date().toISOString().slice(0, 10);
    const seenKey = `${SEEN_KEY_PREFIX}${today}`;
    const seenCtas: string[] = JSON.parse(localStorage.getItem(seenKey) || "[]");
    const readNotifs: string[] = JSON.parse(localStorage.getItem(READ_NOTIF_KEY) || "[]");

    supabase.from("notifications")
      .select("id, title, body, emoji, color, external_url, scope")
      .order("priority", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(10)
      .then(({ data }) => {
        const notifItems: FabItem[] = (data || [])
          .filter((n) => !readNotifs.includes(n.id))
          .map((n) => ({ kind: "notification" as const, notification: n }));

        // Pick a CTA not seen today
        const availableCtas = CTAS.filter((c) => !seenCtas.includes(c.id));
        const pool = availableCtas.length > 0 ? availableCtas : CTAS;
        const pickedCta = pool[Math.floor(Math.random() * pool.length)];
        const ctaItem: FabItem = { kind: "cta", cta: pickedCta };

        // Mark as seen
        localStorage.setItem(seenKey, JSON.stringify([...seenCtas, pickedCta.id]));

        // Notifications first (priority), then CTA
        setItems([...notifItems, ctaItem]);
      });
  }, [user]);

  const persist = (p: { x: number; y: number }) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (!btnRef.current) return;
    btnRef.current.setPointerCapture(e.pointerId);
    draggingRef.current = true;
    draggedRef.current = false;
    const rect = btnRef.current.getBoundingClientRect();
    offsetRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!draggingRef.current) return;
    const dx = e.clientX - (offsetRef.current.x + (pos?.x ?? 0));
    const dy = e.clientY - (offsetRef.current.y + (pos?.y ?? 0));
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) draggedRef.current = true;
    const x = Math.max(8, Math.min(window.innerWidth - FAB_SIZE - 8, e.clientX - offsetRef.current.x));
    const y = Math.max(8, Math.min(window.innerHeight - FAB_SIZE - 8, e.clientY - offsetRef.current.y));
    setPos({ x, y });
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    btnRef.current?.releasePointerCapture(e.pointerId);
    if (pos) persist(pos);
    if (!draggedRef.current) {
      // Treat as click
      if (items.length > 0) setOpen(true);
    }
  };

  const current = items[currentIdx];
  const hasItems = items.length > 0;

  const handleAction = () => {
    if (!current) return;
    if (current.kind === "cta" && current.cta) {
      const action = current.cta.action;
      setOpen(false);
      if (action === "team") {
        setShowTeamDialog(true);
      } else {
        onAction(action);
      }
    } else if (current.kind === "notification" && current.notification?.external_url) {
      window.open(current.notification.external_url, "_blank", "noopener");
    }
    // Mark notification as read and move to next
    if (current.kind === "notification" && current.notification) {
      const readNotifs: string[] = JSON.parse(localStorage.getItem(READ_NOTIF_KEY) || "[]");
      localStorage.setItem(READ_NOTIF_KEY, JSON.stringify([...readNotifs, current.notification.id]));
    }
    advance();
  };

  const advance = () => {
    setItems((prev) => prev.filter((_, i) => i !== currentIdx));
    setCurrentIdx(0);
    setOpen(false);
  };

  if (!pos) return null;

  const itemColor = current?.kind === "notification" ? current.notification?.color : current?.cta?.color;
  const itemEmoji = current?.kind === "notification" ? current.notification?.emoji : current?.cta?.emoji;
  const itemTitle = current?.kind === "notification" ? current.notification?.title : current?.cta?.title;
  const itemBody = current?.kind === "notification" ? current.notification?.body : current?.cta?.body;

  return (
    <>
      <button
        ref={btnRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        className="fixed z-[60] rounded-full shadow-2xl border-2 border-white/40 select-none touch-none flex items-center justify-center text-2xl active:scale-95 transition-transform"
        style={{
          width: FAB_SIZE,
          height: FAB_SIZE,
          left: pos.x,
          top: pos.y,
          background: "linear-gradient(135deg, hsl(var(--mayla-pref)), hsl(var(--mayla-pref-lt)))",
          touchAction: "none",
          cursor: "grab",
        }}
        aria-label="Avisos da Mayla"
      >
        <span className="text-2xl">👩‍⚕️</span>
        {hasItems && (
          <>
            <span
              className="absolute inset-0 rounded-full pointer-events-none"
              style={{
                animation: "fab-pulse 1.6s ease-in-out infinite",
                boxShadow: "0 0 0 0 hsl(var(--destructive) / .7)",
              }}
            />
            <span
              className="absolute -top-1 -right-1 w-5 h-5 rounded-full text-[10px] font-bold text-white flex items-center justify-center"
              style={{ background: "hsl(var(--destructive))" }}
            >
              {items.length}
            </span>
          </>
        )}
        <style>{`
          @keyframes fab-pulse {
            0% { box-shadow: 0 0 0 0 hsl(var(--destructive) / .7); }
            70% { box-shadow: 0 0 0 14px hsl(var(--destructive) / 0); }
            100% { box-shadow: 0 0 0 0 hsl(var(--destructive) / 0); }
          }
        `}</style>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="text-2xl">{itemEmoji}</span>
              <span>{itemTitle}</span>
            </DialogTitle>
          </DialogHeader>
          {itemBody && <p className="text-base text-muted-foreground">{itemBody}</p>}
          {itemColor && (
            <div className="flex items-center gap-2">
              <span
                className="text-xs font-semibold rounded-md px-2 py-0.5 tracking-[.06em] uppercase"
                style={{ color: `hsl(${itemColor})`, background: `hsl(${itemColor} / .1)` }}
              >
                {current?.kind === "notification"
                  ? current.notification?.scope === "company" ? "Empresa" : current.notification?.scope === "municipal" ? "Município" : "Você"
                  : "Sugestão"}
              </span>
            </div>
          )}
          <div className="flex gap-2 pt-2">
            <button
              onClick={() => { advance(); }}
              className="flex-1 rounded-xl px-4 py-2.5 text-sm font-medium bg-secondary text-foreground hover:bg-secondary/80 transition-colors"
            >
              Depois
            </button>
            <button
              onClick={handleAction}
              className="flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold text-accent-foreground"
              style={{ background: "linear-gradient(135deg, hsl(var(--mayla-pref)), hsl(var(--mayla-pref-lt)))" }}
            >
              {current?.kind === "notification" && current.notification?.external_url ? "Abrir →" : "Fazer agora →"}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <TeamPickerDialog open={showTeamDialog} onOpenChange={setShowTeamDialog} />
    </>
  );
}
