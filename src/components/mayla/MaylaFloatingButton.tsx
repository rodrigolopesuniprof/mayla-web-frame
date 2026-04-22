import { useEffect, useRef, useState, RefObject } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { TeamPickerDialog } from "./TeamPickerDialog";
import maylaSaudacao from "@/assets/mayla-saudacao.gif";
import maylaAviso from "@/assets/mayla-aviso.gif";

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

const STORAGE_KEY = "mayla_fab_position_v2";
const SEEN_KEY_PREFIX = "mayla_fab_seen_";
const READ_NOTIF_KEY = "mayla_fab_read_notifs";
const FAB_SIZE = 76;
const MARGIN = 12;
const BOTTOM_NAV_HEIGHT = 80;

interface Props {
  onAction: (action: "team" | "consulta" | "medicao" | "magazine") => void;
  onOpenAssistantWithMessage?: (msg: string) => void;
  containerRef: RefObject<HTMLDivElement>;
}

export function MaylaFloatingButton({ onAction, onOpenAssistantWithMessage, containerRef }: Props) {
  const { user } = useAuth();
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [items, setItems] = useState<FabItem[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [open, setOpen] = useState(false);
  const [showTeamDialog, setShowTeamDialog] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const draggingRef = useRef(false);
  const draggedRef = useRef(false);
  const offsetRef = useRef({ x: 0, y: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);

  const clampToContainer = (x: number, y: number) => {
    const c = containerRef.current;
    if (!c) return { x, y };
    const rect = c.getBoundingClientRect();
    const maxX = rect.width - FAB_SIZE - MARGIN;
    const maxY = rect.height - FAB_SIZE - BOTTOM_NAV_HEIGHT;
    return {
      x: Math.max(MARGIN, Math.min(maxX, x)),
      y: Math.max(MARGIN, Math.min(maxY, y)),
    };
  };

  useEffect(() => {
    const setInitial = () => {
      const c = containerRef.current;
      if (!c) {
        requestAnimationFrame(setInitial);
        return;
      }
      const rect = c.getBoundingClientRect();
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (typeof parsed.x === "number" && typeof parsed.y === "number") {
            setPos(clampToContainer(parsed.x, parsed.y));
            return;
          }
        } catch {}
      }
      setPos({
        x: rect.width - FAB_SIZE - MARGIN,
        y: rect.height - FAB_SIZE - BOTTOM_NAV_HEIGHT,
      });
    };
    setInitial();

    const onResize = () => {
      setPos((prev) => (prev ? clampToContainer(prev.x, prev.y) : prev));
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containerRef]);

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

        const availableCtas = CTAS.filter((c) => !seenCtas.includes(c.id));
        const pool = availableCtas.length > 0 ? availableCtas : CTAS;
        const pickedCta = pool[Math.floor(Math.random() * pool.length)];
        const ctaItem: FabItem = { kind: "cta", cta: pickedCta };
        localStorage.setItem(seenKey, JSON.stringify([...seenCtas, pickedCta.id]));

        setItems([...notifItems, ctaItem]);
      });
  }, [user]);

  const persist = (p: { x: number; y: number }) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (!btnRef.current || !containerRef.current) return;
    btnRef.current.setPointerCapture(e.pointerId);
    draggingRef.current = true;
    draggedRef.current = false;
    const btnRect = btnRef.current.getBoundingClientRect();
    offsetRef.current = { x: e.clientX - btnRect.left, y: e.clientY - btnRect.top };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!draggingRef.current || !containerRef.current) return;
    const cRect = containerRef.current.getBoundingClientRect();
    const rawX = e.clientX - cRect.left - offsetRef.current.x;
    const rawY = e.clientY - cRect.top - offsetRef.current.y;
    if (Math.abs(rawX - (pos?.x ?? 0)) > 4 || Math.abs(rawY - (pos?.y ?? 0)) > 4) {
      draggedRef.current = true;
    }
    setPos(clampToContainer(rawX, rawY));
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    btnRef.current?.releasePointerCapture(e.pointerId);
    if (pos) persist(pos);
    if (!draggedRef.current) {
      setOpen(true);
    }
  };

  const current = items[currentIdx];
  const hasItems = items.length > 0;

  const handleAction = () => {
    if (!current) {
      setOpen(false);
      return;
    }
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

  const handleSendChat = () => {
    const msg = chatInput.trim();
    if (!msg) return;
    setOpen(false);
    setChatInput("");
    onOpenAssistantWithMessage?.(msg);
  };

  if (!pos) return null;

  const itemColor = current?.kind === "notification" ? current.notification?.color : current?.cta?.color;
  const itemEmoji = current?.kind === "notification" ? current.notification?.emoji : current?.cta?.emoji;
  const itemTitle = current?.kind === "notification" ? current.notification?.title : current?.cta?.title;
  const itemBody = current?.kind === "notification" ? current.notification?.body : current?.cta?.body;
  const fabGif = hasItems ? maylaAviso : maylaSaudacao;

  return (
    <>
      <button
        ref={btnRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        className="absolute z-[60] rounded-full shadow-2xl border border-border bg-background select-none touch-none flex items-center justify-center overflow-hidden active:scale-95 transition-transform"
        style={{
          width: FAB_SIZE,
          height: FAB_SIZE,
          left: pos.x,
          top: pos.y,
          touchAction: "none",
          cursor: "grab",
        }}
        aria-label="Mayla, sua enfermeira virtual"
      >
        <img
          src={fabGif}
          alt="Mayla"
          draggable={false}
          className="w-full h-full object-cover rounded-full pointer-events-none"
        />
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
              className="absolute -top-1 -right-1 w-6 h-6 rounded-full text-[11px] font-bold text-white flex items-center justify-center border-2 border-background"
              style={{ background: "hsl(var(--destructive))" }}
            >
              {items.length}
            </span>
          </>
        )}
        <style>{`
          @keyframes fab-pulse {
            0% { box-shadow: 0 0 0 0 hsl(var(--destructive) / .7); }
            70% { box-shadow: 0 0 0 16px hsl(var(--destructive) / 0); }
            100% { box-shadow: 0 0 0 0 hsl(var(--destructive) / 0); }
          }
        `}</style>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full overflow-hidden border border-border shrink-0">
                <img src={hasItems ? maylaAviso : maylaSaudacao} alt="Mayla" className="w-full h-full object-cover" />
              </div>
              <div className="flex flex-col items-start">
                <span className="text-base">{itemTitle ?? "Olá! Sou a Mayla"}</span>
                {!current && (
                  <span className="text-xs text-muted-foreground font-normal">Sua enfermeira virtual</span>
                )}
              </div>
            </DialogTitle>
          </DialogHeader>

          {current && itemBody && (
            <p className="text-base text-muted-foreground">{itemBody}</p>
          )}

          {itemColor && current && (
            <div className="flex items-center gap-2">
              <span
                className="text-xs font-semibold rounded-md px-2 py-0.5 tracking-[.06em] uppercase"
                style={{ color: `hsl(${itemColor})`, background: `hsl(${itemColor} / .1)` }}
              >
                {current?.kind === "notification"
                  ? current.notification?.scope === "company" ? "Empresa" : current.notification?.scope === "municipal" ? "Município" : "Você"
                  : "Sugestão"}
              </span>
              {itemEmoji && <span className="text-lg">{itemEmoji}</span>}
            </div>
          )}

          {current && (
            <div className="flex gap-2 pt-1">
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
          )}

          {/* Chat input — sempre disponível */}
          <div className="pt-3 mt-1 border-t border-border">
            <div className="text-xs font-medium text-muted-foreground mb-2">Quer conversar comigo?</div>
            <form
              onSubmit={(e) => { e.preventDefault(); handleSendChat(); }}
              className="flex gap-2"
            >
              <input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Digite sua dúvida sobre saúde..."
                className="flex-1 bg-secondary rounded-full px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground border-none outline-none focus:ring-2 focus:ring-accent/40"
              />
              <button
                type="submit"
                disabled={!chatInput.trim()}
                className="rounded-full px-4 bg-accent text-accent-foreground text-sm font-semibold disabled:opacity-40"
              >
                Enviar
              </button>
            </form>
          </div>
        </DialogContent>
      </Dialog>

      <TeamPickerDialog open={showTeamDialog} onOpenChange={setShowTeamDialog} />
    </>
  );
}
