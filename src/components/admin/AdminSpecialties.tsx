export function AdminSpecialties() {
  return (
    <div>
      <div className="mb-6">
        <h2 className="font-display text-2xl text-foreground">Especialistas</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Marketplace de profissionais de saúde
        </p>
      </div>

      <div className="rounded-2xl border-2 border-dashed border-primary/20 bg-primary/5 p-10 text-center">
        <div className="text-6xl mb-4">🩺</div>
        <h3 className="font-display text-xl font-semibold text-foreground mb-2">
          Em breve: Marketplace de Especialistas
        </h3>
        <p className="text-sm text-muted-foreground max-w-md mx-auto leading-relaxed mb-6">
          Médicos e profissionais de saúde poderão se cadastrar e oferecer consultas
          via telechamada aos colaboradores. Funcionalidades planejadas:
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-lg mx-auto mb-6">
          <div className="bg-card rounded-xl p-4 border border-border">
            <div className="text-2xl mb-2">📹</div>
            <div className="text-xs font-semibold text-foreground">Telechamada</div>
            <div className="text-[11px] text-muted-foreground mt-1">Via Jitsi Meeting</div>
          </div>
          <div className="bg-card rounded-xl p-4 border border-border">
            <div className="text-2xl mb-2">📋</div>
            <div className="text-xs font-semibold text-foreground">Cadastro Médico</div>
            <div className="text-[11px] text-muted-foreground mt-1">Perfil + currículo</div>
          </div>
          <div className="bg-card rounded-xl p-4 border border-border">
            <div className="text-2xl mb-2">💳</div>
            <div className="text-xs font-semibold text-foreground">Pagamento</div>
            <div className="text-[11px] text-muted-foreground mt-1">Avulso ou assinatura</div>
          </div>
        </div>

        <p className="text-[11px] text-muted-foreground">
          Esta funcionalidade será ativada em uma próxima atualização.
        </p>
      </div>
    </div>
  );
}
