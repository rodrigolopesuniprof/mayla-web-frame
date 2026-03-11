import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./AuthContext";

interface Company {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  wellbeing_program_name: string;
  rppg_url: string | null;
  telemedicine_url: string | null;
  hr_contact_email: string | null;
  primary_color: string;
  accent_color: string;
  background_color: string;
  foreground_color: string;
  secondary_color: string;
}

interface CompanyContextType {
  company: Company | null;
  loading: boolean;
  isDefault: boolean;
}

const CompanyContext = createContext<CompanyContextType>({
  company: null,
  loading: true,
  isDefault: false,
});

export function CompanyProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDefault, setIsDefault] = useState(false);

  useEffect(() => {
    if (!user) {
      setCompany(null);
      setLoading(false);
      return;
    }

    const loadCompany = async () => {
      setLoading(true);
      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("user_id", user.id)
        .single();

      const companyId = profile?.company_id;
      const isFallback = !companyId;

      let companyData: any = null;

      if (companyId) {
        const { data } = await supabase.from("companies").select("*").eq("id", companyId).single();
        companyData = data;
      }

      // Fallback: try to load from municipalities if no company found (backward compat)
      if (!companyData) {
        const { data: profile2 } = await supabase
          .from("profiles")
          .select("municipality_id")
          .eq("user_id", user.id)
          .single();

        if (profile2?.municipality_id) {
          const { data: muni } = await supabase
            .from("municipalities")
            .select("*")
            .eq("id", profile2.municipality_id)
            .single();
          if (muni) {
            companyData = {
              id: muni.id,
              name: muni.name,
              slug: muni.slug,
              logo_url: muni.logo_url,
              wellbeing_program_name: muni.secretaria,
              rppg_url: muni.rppg_url,
              telemedicine_url: muni.telemedicine_url,
              hr_contact_email: muni.ubs_email,
              primary_color: muni.primary_color,
              accent_color: muni.accent_color,
              background_color: muni.background_color,
              foreground_color: muni.foreground_color,
              secondary_color: muni.secondary_color,
            };
          }
        }
      }

      if (companyData) {
        setCompany(companyData as Company);
        setIsDefault(isFallback && !companyData);
        const root = document.documentElement;
        root.style.setProperty("--primary", companyData.primary_color);
        root.style.setProperty("--accent", companyData.accent_color);
        root.style.setProperty("--background", companyData.background_color);
        root.style.setProperty("--foreground", companyData.foreground_color);
        root.style.setProperty("--secondary", companyData.secondary_color);
        root.style.setProperty("--mayla-pref", companyData.primary_color);
        root.style.setProperty("--mayla-rose", companyData.accent_color);
      }
      setLoading(false);
    };

    loadCompany();
  }, [user]);

  return (
    <CompanyContext.Provider value={{ company, loading, isDefault }}>
      {children}
    </CompanyContext.Provider>
  );
}

export const useCompany = () => useContext(CompanyContext);
