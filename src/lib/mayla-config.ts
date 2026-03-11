// Configurações padrão (fallback quando empresa não carregou)
export const COMPANY_CONFIG = {
  nome: "Mayla",
  programa: "Bem-estar Corporativo",
  empresa: "",
} as const;

export const RPPG_URL = "https://rppg.saudecomvc.com.br/login";

export type TabId = "inicio" | "bemestar" | "programas" | "missoes" | "perfil";

export const TABS: { id: TabId; emoji: string; label: string }[] = [
  { id: "inicio", emoji: "🏠", label: "Início" },
  { id: "bemestar", emoji: "🌿", label: "Bem-estar" },
  { id: "programas", emoji: "📋", label: "Programas" },
  { id: "missoes", emoji: "🎯", label: "Missões" },
  { id: "perfil", emoji: "👤", label: "Perfil" },
];
