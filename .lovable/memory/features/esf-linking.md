ESF (Equipe de Saúde da Família) linking system: CNES API import, QR code citizen linking, admin dashboard

## Database
- `esf_teams` table: municipality_id, cnes_code, name, address, lat/lng, qr_code (unique, format ESF_CNESXXX)
- `profiles.esf_team_id` FK to esf_teams
- Trigger `trg_award_esf_link_points`: awards 500 pts when esf_team_id goes from null to value

## Components
- `AdminESF.tsx` - CNES import + ESF management per municipality
- `AdminDashboard.tsx` - metrics: citizens, notifications, ESF ranking
- `EsfLinkScreen.tsx` - citizen QR scan to link to ESF
- HomeTab shows "Vincule-se à sua ESF" card when not linked
- ProfileTab shows linked ESF info

## CNES Proxy
- Edge function `cnes-proxy` proxies SUS API
- Filters ESFs by name (SAUDE DA FAMILIA, ESF, PSF) and tipo_unidade (15, 72, 50)
