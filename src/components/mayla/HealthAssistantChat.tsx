import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface Msg {
  id?: string;
  role: "user" | "assistant";
  content: string;
}

const SUGGESTIONS = [
  "Como está minha pressão?",
  "Explique meu score de saúde",
  "Dicas de bem-estar para hoje",
  "O que significa HRV?",
];

export function HealthAssistantChat({ onBack }: { onBack: () => void }) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  const send = async (text: string) => {
    const userMsg: Msg = { role: "user", content: text };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput("");
    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Sessão expirada");

      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/health-assistant-chat`;
      const resp = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          messages: next.map((m) => ({ role: m.role, content: m.content })),
          conversationId,
        }),
      });

      if (resp.status === 429) {
        toast({ title: "Aguarde um momento", description: "Muitas mensagens. Tente novamente em instantes.", variant: "destructive" });
        setLoading(false);
        return;
      }
      if (resp.status === 402) {
        toast({ title: "Créditos esgotados", description: "Entre em contato com o suporte.", variant: "destructive" });
        setLoading(false);
        return;
      }
      if (!resp.ok || !resp.body) throw new Error("Falha na resposta do assistente");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let assistant = "";
      let inserted = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let idx;
        while ((idx = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) {
            // handle meta event
            if (line.startsWith("event: meta")) continue;
            continue;
          }
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") continue;
          try {
            const parsed = JSON.parse(jsonStr);
            if (parsed.conversationId && !conversationId) {
              setConversationId(parsed.conversationId);
              continue;
            }
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              assistant += delta;
              setMessages((prev) => {
                if (!inserted) {
                  inserted = true;
                  return [...prev, { role: "assistant", content: assistant }];
                }
                return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistant } : m));
              });
            }
          } catch {
            buffer = line + "\n" + buffer;
            break;
          }
        }
      }
    } catch (e: any) {
      toast({ title: "Erro", description: e.message ?? "Falha ao falar com o assistente", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const sendFeedback = async (messageIndex: number, rating: "up" | "down") => {
    // Find the assistant message id by querying recent messages
    if (!conversationId) return;
    const assistantMessages = messages.filter((m) => m.role === "assistant");
    const msgPosition = assistantMessages.indexOf(messages[messageIndex]);
    const { data } = await supabase
      .from("assistant_messages")
      .select("id")
      .eq("conversation_id", conversationId)
      .eq("role", "assistant")
      .order("created_at", { ascending: true });
    const target = data?.[msgPosition];
    if (!target) return;
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;
    const { error } = await supabase.from("assistant_feedback").upsert({
      message_id: target.id,
      user_id: userData.user.id,
      rating,
    }, { onConflict: "message_id,user_id" });
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: rating === "up" ? "Obrigado pelo feedback! 👍" : "Vamos melhorar 🙏" });
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-background overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-border flex items-center gap-3">
        <button onClick={onBack} className="text-2xl text-foreground active:opacity-60" aria-label="Voltar">‹</button>
        <div className="flex-1">
          <div className="font-display text-lg font-semibold text-foreground flex items-center gap-2">
            <span>👩‍⚕️</span> Mayla, sua enfermeira digital
          </div>
          <div className="text-xs text-muted-foreground">Educacional · não substitui consulta médica</div>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="space-y-4">
            <div className="bg-secondary rounded-2xl p-4 flex gap-3">
              <div className="shrink-0 w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center text-xl">👩‍⚕️</div>
              <p className="text-sm text-foreground leading-relaxed">
                Olá! Sou a <strong>Mayla</strong>, sua <strong>enfermeira digital</strong>. Posso explicar seus indicadores, ajudar a entender seus dados e orientar cuidados gerais de saúde. Não faço diagnósticos nem prescrevo medicamentos.
              </p>
            </div>
            <div className="space-y-2">
              <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Sugestões</div>
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="w-full text-left bg-secondary/60 hover:bg-secondary rounded-xl px-4 py-3 text-sm text-foreground transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`flex gap-2 ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            {m.role === "assistant" && (
              <div className="shrink-0 w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center text-base self-end mb-1" aria-label="Mayla">👩‍⚕️</div>
            )}
            <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${m.role === "user" ? "bg-accent text-accent-foreground" : "bg-secondary text-foreground"}`}>
              {m.role === "assistant" ? (
                <div className="prose prose-sm max-w-none text-foreground prose-strong:text-foreground prose-p:my-1 prose-ul:my-1 prose-li:my-0">
                  <ReactMarkdown>{m.content}</ReactMarkdown>
                </div>
              ) : (
                <p className="text-sm whitespace-pre-wrap">{m.content}</p>
              )}
              {m.role === "assistant" && m.content && !loading && (
                <div className="flex gap-2 mt-2 pt-2 border-t border-foreground/10">
                  <button onClick={() => sendFeedback(i, "up")} className="text-base hover:scale-110 transition-transform" aria-label="Útil">👍</button>
                  <button onClick={() => sendFeedback(i, "down")} className="text-base hover:scale-110 transition-transform" aria-label="Não útil">👎</button>
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && messages[messages.length - 1]?.role === "user" && (
          <div className="flex justify-start">
            <div className="bg-secondary rounded-2xl px-4 py-3">
              <div className="flex gap-1">
                <div className="w-2 h-2 rounded-full bg-muted-foreground animate-pulse" />
                <div className="w-2 h-2 rounded-full bg-muted-foreground animate-pulse" style={{ animationDelay: "0.2s" }} />
                <div className="w-2 h-2 rounded-full bg-muted-foreground animate-pulse" style={{ animationDelay: "0.4s" }} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t border-border p-3 bg-background">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (input.trim() && !loading) send(input.trim());
          }}
          className="flex gap-2"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Pergunte sobre sua saúde..."
            disabled={loading}
            className="flex-1 bg-secondary rounded-full px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground border-none outline-none focus:ring-2 focus:ring-accent/40"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="rounded-full px-5 bg-accent text-accent-foreground text-sm font-semibold disabled:opacity-40"
          >
            Enviar
          </button>
        </form>
      </div>
    </div>
  );
}
