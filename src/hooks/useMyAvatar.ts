import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

function getInitials(name?: string | null) {
  if (!name) return "MA";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "MA";
  const first = parts[0][0] || "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase() || "MA";
}

export function useMyAvatar() {
  const [userId, setUserId] = useState<string | null>(null);
  const qc = useQueryClient();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUserId(session?.user?.id ?? null);
      qc.invalidateQueries({ queryKey: ["my-avatar"] });
    });
    return () => { sub.subscription.unsubscribe(); };
  }, [qc]);

  const query = useQuery({
    queryKey: ["my-avatar", userId],
    enabled: !!userId,
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("full_name, avatar_url, avatar_type")
        .eq("user_id", userId!)
        .maybeSingle();
      const p = data as any;
      return {
        avatarUrl: (p?.avatar_url ?? null) as string | null,
        avatarType: (p?.avatar_type ?? null) as string | null,
        initials: getInitials(p?.full_name),
      };
    },
  });

  return {
    avatarUrl: query.data?.avatarUrl ?? null,
    avatarType: query.data?.avatarType ?? null,
    initials: query.data?.initials ?? "MA",
  };
}
