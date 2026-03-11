import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./AuthContext";

interface Municipality {
  id: string;
  name: string;
  state: string;
  slug: string;
  logo_url: string | null;
  secretaria: string;
  rppg_url: string | null;
  telemedicine_url: string | null;
  ubs_email: string | null;
  primary_color: string;
  accent_color: string;
  background_color: string;
  foreground_color: string;
  secondary_color: string;
}

interface MunicipalityContextType {
  municipality: Municipality | null;
  loading: boolean;
  isDefault: boolean;
}

const MunicipalityContext = createContext<MunicipalityContextType>({
  municipality: null,
  loading: true,
  isDefault: false,
});

export function MunicipalityProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [municipality, setMunicipality] = useState<Municipality | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDefault, setIsDefault] = useState(false);

  useEffect(() => {
    if (!user) {
      setMunicipality(null);
      setLoading(false);
      return;
    }

    const loadMunicipality = async () => {
      setLoading(true);
      // Get profile with municipality_id
      const { data: profile } = await supabase
        .from("profiles")
        .select("municipality_id")
        .eq("user_id", user.id)
        .single();

      // If user has a municipality, load it; otherwise load the default "mayla" one
      const muniId = profile?.municipality_id;
      const isFallback = !muniId;
      let muniQuery = supabase.from("municipalities").select("*");
      if (muniId) {
        muniQuery = muniQuery.eq("id", muniId);
      } else {
        muniQuery = muniQuery.eq("slug", "mayla");
      }
      const { data: muni } = await muniQuery.single();

      if (muni) {
        setMunicipality(muni as Municipality);
        setIsDefault(isFallback);
        const root = document.documentElement;
        root.style.setProperty("--primary", muni.primary_color);
        root.style.setProperty("--accent", muni.accent_color);
        root.style.setProperty("--background", muni.background_color);
        root.style.setProperty("--foreground", muni.foreground_color);
        root.style.setProperty("--secondary", muni.secondary_color);
        root.style.setProperty("--mayla-pref", muni.primary_color);
        root.style.setProperty("--mayla-rose", muni.accent_color);
      }
      setLoading(false);
    };

    loadMunicipality();
  }, [user]);

  return (
    <MunicipalityContext.Provider value={{ municipality, loading, isDefault }}>
      {children}
    </MunicipalityContext.Provider>
  );
}

export const useMunicipality = () => useContext(MunicipalityContext);
