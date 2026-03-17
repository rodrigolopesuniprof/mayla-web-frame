interface ReportBottomNavProps {
  activeTab: string;
  onNavigate: (tab: string) => void;
}

const NAV_ITEMS = [
  { id: "inicio", label: "Início", icon: (c: string) => <svg viewBox="0 0 20 20" fill="none" stroke={c} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9L10 3L17 9V17H13V13H7V17H3V9Z"/></svg> },
  { id: "relatorio", label: "Relatório", icon: (c: string) => <svg viewBox="0 0 20 20" fill="none" stroke={c} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="14" height="14" rx="2"/><path d="M7 8H13M7 11H11"/></svg> },
  { id: "medir", label: "Medir", icon: (c: string) => <svg viewBox="0 0 20 20" fill="none" stroke={c} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><circle cx="10" cy="10" r="7"/><path d="M10 7V10L12 12"/></svg> },
  { id: "missoes", label: "Missões", icon: (c: string) => <svg viewBox="0 0 20 20" fill="none" stroke={c} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M10 2L12.4 7.6L18 8.3L14 12L15.1 17.5L10 14.8L4.9 17.5L6 12L2 8.3L7.6 7.6L10 2Z"/></svg> },
  { id: "perfil", label: "Perfil", icon: (c: string) => <svg viewBox="0 0 20 20" fill="none" stroke={c} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><circle cx="10" cy="7" r="3"/><path d="M4 18C4 14.7 6.7 12 10 12C13.3 12 16 14.7 16 18"/></svg> },
];

export function ReportBottomNav({ activeTab, onNavigate }: ReportBottomNavProps) {
  return (
    <nav className="rpt-bottom-nav">
      {NAV_ITEMS.map((item) => {
        const isActive = item.id === activeTab;
        const color = isActive ? "var(--rpt-text-primary)" : "var(--rpt-text-tertiary)";
        return (
          <button key={item.id} className={`rpt-nav-item ${isActive ? "active" : ""}`} onClick={() => onNavigate(item.id)}>
            <div className="rpt-nav-icon">{item.icon(color)}</div>
            <span className="rpt-nav-lbl">{item.label}</span>
            {isActive && <div className="rpt-nav-pip" />}
          </button>
        );
      })}
    </nav>
  );
}
