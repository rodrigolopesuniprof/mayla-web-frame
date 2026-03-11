// Configurações padrão (fallback quando município não carregou)
export const MUNICIPALITY_CONFIG = {
  nome: "Mayla",
  secretaria: "Saúde com Você",
  cidade: "",
  estado: "",
} as const;

export const RPPG_URL = "https://rppg.saudecomvc.com.br/login";

export type TabId = "inicio" | "saude" | "servicos" | "missoes" | "perfil";

export const TABS: { id: TabId; emoji: string; label: string }[] = [
  { id: "inicio", emoji: "🏠", label: "Início" },
  { id: "saude", emoji: "❤️", label: "Saúde" },
  { id: "servicos", emoji: "🏥", label: "Serviços" },
  { id: "missoes", emoji: "🎯", label: "Missões" },
  { id: "perfil", emoji: "👤", label: "Perfil" },
];
