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

    // Ranking + membros + perfis
    let memberIds: string[] = [];
    let rankingMap = new Map<string, { pontos_semana: number; posicao: number }>();
    let papelMap = new Map<string, "dono" | "coadmin" | "membro">();

    if (leagueId === "__mayla__" && companyId) {
      const [{ data: profs }, { data: rk }] = await Promise.all([
        supabase.from("profiles").select("user_id, full_name, avatar_url").eq("company_id", companyId).limit(500),
        supabase.rpc("mayla_ranking" as any, { p_company_id: companyId }),
      ]);
      memberIds = ((profs || []) as any[]).map((p) => p.user_id);
      const nameMap = new Map<string, any>();
      ((profs || []) as any[]).forEach((p) => nameMap.set(p.user_id, p));
      ((rk || []) as any[]).forEach((r) => {
        rankingMap.set(r.user_id, { pontos_semana: Number(r.pontos_semana) || 0, posicao: Number(r.posicao) || 0 });
      });
      papelMap = new Map(memberIds.map((id) => [id, "membro" as const]));

      const membersOut: FeedMember[] = memberIds.map((uid) => ({
        user_id: uid,
        full_name: nameMap.get(uid)?.full_name || null,
        avatar_url: nameMap.get(uid)?.avatar_url || null,
        papel: "membro",
        pontos_semana: rankingMap.get(uid)?.pontos_semana ?? 0,
        posicao: rankingMap.get(uid)?.posicao ?? null,
        last_point_at: null,
      }));
      // sort by ranking desc
      membersOut.sort((a, b) => (b.pontos_semana || 0) - (a.pontos_semana || 0));

      // last points per user + prize (mayla não tem prize/challenge)
      const { data: ledger } = await supabase
        .from("points_ledger")
        .select("user_id, points, created_at")
        .eq("company_id", companyId)
        .gte("created_at", new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString())
        .order("created_at", { ascending: false })
        .limit(200);
      const lastByUser = new Map<string, string>();
      const events: LiveEvent[] = [];
      ((ledger || []) as any[]).forEach((row) => {
        if (!lastByUser.has(row.user_id)) lastByUser.set(row.user_id, row.created_at);
        if (row.points >= 100 && events.length < 6) {
          const p = nameMap.get(row.user_id);
          events.push({
            user_id: row.user_id, full_name: p?.full_name || null, avatar_url: p?.avatar_url || null,
            points: row.points, created_at: row.created_at,
          });
        }
      });
      membersOut.forEach((m) => { m.last_point_at = lastByUser.get(m.user_id) || null; });

      const today = new Date(); today.setHours(0, 0, 0, 0);
      const withPoints = new Set<string>();
      ((ledger || []) as any[]).forEach((r) => {
        if (new Date(r.created_at) >= today) withPoints.add(r.user_id);
      });

      setData({
        loading: false, members: membersOut, events, currentChallenge: null,
        prize: null, memberCountWithPointsToday: withPoints.size, reload: load,
      });
      return;
    }

    // Liga real: busca membros e perfis separadamente para não depender de relacionamento
    // implícito entre league_members.user_id e profiles.user_id na API de dados.
    const [{ data: mems }, { data: rk }, { data: ch }, { data: pe }] = await Promise.all([
      supabase.from("league_members" as any)
        .select("user_id, papel")
        .eq("league_id", leagueId),
      supabase.rpc("league_ranking" as any, { p_league_id: leagueId }),
      supabase.from("league_challenges" as any)
        .select("id, titulo, metrica, alvo, week_id")
        .eq("league_id", leagueId).eq("week_id", currentWeekId())
        .order("created_at", { ascending: false }).limit(1),
      supabase.from("league_prize_eligible" as any)
        .select("membros, elegivel_premio_mayla").eq("league_id", leagueId).maybeSingle(),
    ]);

    memberIds = ((mems || []) as any[]).map((m) => m.user_id);

    const { data: profs } = memberIds.length > 0
      ? await supabase.from("profiles")
          .select("user_id, full_name, avatar_url")
          .in("user_id", memberIds)
      : { data: [] as any[] };

    const nameMap = new Map<string, any>();
    ((profs || []) as any[]).forEach((p) => {
      nameMap.set(p.user_id, { full_name: p.full_name ?? null, avatar_url: p.avatar_url ?? null });
    });
    ((mems || []) as any[]).forEach((m) => {
      papelMap.set(m.user_id, m.papel);
    });
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
