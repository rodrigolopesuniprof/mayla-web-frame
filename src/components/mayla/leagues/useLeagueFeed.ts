import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Agregador de dados derivados para o "feed ao vivo" das ligas.
 * Não escreve nada — só lê o que já existe (rankings, points_ledger,
 * league_challenges, league_prize_eligible) e monta cards tipados.
 */

export interface FeedMember {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  papel: "dono" | "coadmin" | "membro";
  pontos_semana: number;
  posicao: number | null;
  last_point_at: string | null;
}

export interface LiveEvent {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  points: number;
  created_at: string;
}

export interface FeedData {
  loading: boolean;
  members: FeedMember[];
  events: LiveEvent[];
  currentChallenge: {
    id: string;
    titulo: string;
    metrica: string;
    alvo: number;
    week_id: string;
  } | null;
  prize: { membros: number; elegivel: boolean } | null;
  memberCountWithPointsToday: number;
  reload: () => void;
}

const currentWeekId = () => {
  // ISO week matches to_char(now(),'IYYY"-W"IW')
  const d = new Date();
  const target = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNr = (target.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNr + 3);
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round((+target - +firstThursday) / (7 * 24 * 3600 * 1000));
  return `${target.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
};

export function useLeagueFeed(leagueId: string | null, companyId: string | null) {
  const { user } = useAuth();
  const [data, setData] = useState<FeedData>({
    loading: true, members: [], events: [], currentChallenge: null,
    prize: null, memberCountWithPointsToday: 0, reload: () => {},
  });

  const load = useCallback(async () => {
    if (!leagueId || !user) return;
    setData((d) => ({ ...d, loading: true }));

    // Resolve real league id when caller passes the legacy "__mayla__" sentinel.
    let realLeagueId = leagueId;
    if (leagueId === "__mayla__") {
      if (!companyId) return;
      const { data: resolved } = await supabase.rpc("ensure_default_league" as any, { _company_id: companyId });
      if (typeof resolved === "string") realLeagueId = resolved;
      else {
        const { data: row } = await supabase.from("leagues" as any)
          .select("id").eq("company_id", companyId).eq("is_default", true).maybeSingle();
        if ((row as any)?.id) realLeagueId = (row as any).id;
        else return;
      }
    }

    const rankingMap = new Map<string, { pontos_semana: number; posicao: number }>();
    const papelMap = new Map<string, "dono" | "coadmin" | "membro">();

    // Members + perfis (via RPC segura que só expõe primeiro nome + avatar) + ranking + desafio + prize.
    const [{ data: mems }, { data: publicProfs }, { data: rk }, { data: ch }, { data: pe }] = await Promise.all([
      supabase.from("league_members" as any)
        .select("user_id, papel")
        .eq("league_id", realLeagueId),
      supabase.rpc("get_league_members_public" as any, { p_league_id: realLeagueId }),
      supabase.rpc("league_ranking" as any, { p_league_id: realLeagueId }),
      supabase.from("league_challenges" as any)
        .select("id, titulo, metrica, alvo, week_id")
        .eq("league_id", realLeagueId).eq("week_id", currentWeekId())
        .order("created_at", { ascending: false }).limit(1),
      supabase.from("league_prize_eligible" as any)
        .select("membros, elegivel_premio_mayla").eq("league_id", realLeagueId).maybeSingle(),
    ]);

    const memberIds: string[] = ((mems || []) as any[]).map((m) => m.user_id);

    const nameMap = new Map<string, { full_name: string | null; avatar_url: string | null }>();
    ((publicProfs || []) as any[]).forEach((p) => {
      nameMap.set(p.user_id, { full_name: p.first_name ?? null, avatar_url: p.avatar_url ?? null });
    });
    ((mems || []) as any[]).forEach((m) => { papelMap.set(m.user_id, m.papel); });
    ((rk || []) as any[]).forEach((r) => {
      rankingMap.set(r.user_id, { pontos_semana: Number(r.pontos_semana) || 0, posicao: Number(r.posicao) || 0 });
    });

    // últimos pontos por membro (últimos 3 dias)
    let ledger: any[] = [];
    if (memberIds.length > 0) {
      const { data: ll } = await supabase
        .from("points_ledger")
        .select("user_id, points, created_at")
        .in("user_id", memberIds)
        .gte("created_at", new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString())
        .order("created_at", { ascending: false })
        .limit(200);
      ledger = (ll || []) as any[];
    }
    const lastByUser = new Map<string, string>();
    const events: LiveEvent[] = [];
    ledger.forEach((row) => {
      if (!lastByUser.has(row.user_id)) lastByUser.set(row.user_id, row.created_at);
      if (row.points >= 100 && events.length < 6) {
        const p = nameMap.get(row.user_id);
        events.push({
          user_id: row.user_id, full_name: p?.full_name || null, avatar_url: p?.avatar_url || null,
          points: row.points, created_at: row.created_at,
        });
      }
    });

    const membersOut: FeedMember[] = memberIds.map((uid) => ({
      user_id: uid,
      full_name: nameMap.get(uid)?.full_name || null,
      avatar_url: nameMap.get(uid)?.avatar_url || null,
      papel: papelMap.get(uid) || "membro",
      pontos_semana: rankingMap.get(uid)?.pontos_semana ?? 0,
      posicao: rankingMap.get(uid)?.posicao ?? null,
      last_point_at: lastByUser.get(uid) || null,
    }));
    membersOut.sort((a, b) => (b.pontos_semana || 0) - (a.pontos_semana || 0));

    const today = new Date(); today.setHours(0, 0, 0, 0);
    const withPoints = new Set<string>();
    ledger.forEach((r) => { if (new Date(r.created_at) >= today) withPoints.add(r.user_id); });

    setData({
      loading: false,
      members: membersOut,
      events,
      currentChallenge: ((ch || []) as any[])[0] || null,
      prize: pe ? { membros: Number((pe as any).membros) || 0, elegivel: !!(pe as any).elegivel_premio_mayla } : null,
      memberCountWithPointsToday: withPoints.size,
      reload: load,
    });
  }, [leagueId, companyId, user]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const id = setInterval(load, 45_000);
    return () => clearInterval(id);
  }, [load]);

  return data;
}

/** Milissegundos até o próximo domingo 23:59:59 em America/Sao_Paulo. */
export function useWeekCountdown() {
  const [label, setLabel] = useState("");
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      // domingo 23:59:59 no fuso -03:00
      const spNow = new Date(now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
      const day = spNow.getDay(); // 0=domingo
      const daysUntilSunday = day === 0 ? 0 : 7 - day;
      const end = new Date(spNow);
      end.setDate(end.getDate() + daysUntilSunday);
      end.setHours(23, 59, 59, 0);
      const diff = Math.max(0, +end - +spNow);
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff / 3600000) % 24);
      const m = Math.floor((diff / 60000) % 60);
      setLabel(d > 0 ? `${d}d ${String(h).padStart(2, "0")}h` : `${h}h ${String(m).padStart(2, "0")}m`);
    };
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, []);
  return label;
}
