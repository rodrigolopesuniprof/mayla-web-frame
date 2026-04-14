import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function useCompanyFeature(featureKey: string) {
  const { user } = useAuth();
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    (async () => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!profile?.company_id) { setLoading(false); return; }
      const { data: feature } = await supabase
        .from("company_features")
        .select("enabled")
        .eq("company_id", profile.company_id)
        .eq("feature_key", featureKey)
        .maybeSingle();
      setEnabled(feature?.enabled ?? true);
      setLoading(false);
    })();
  }, [user, featureKey]);

  return { enabled, loading };
}
