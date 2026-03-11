# Memory: index.md
Updated: 2026-03-10

## Mayla App - Design & Architecture

### Design System
- Fonts: Fraunces (display/headings), DM Sans (body)
- Colors: cream (#FDF6EE bg), rose (#E8574A accent), ink (#2A1E1A text), pref (#1A5C8A primary), sand (#EDE5D8 secondary)
- All colors defined as HSL in index.css under `--mayla-*` tokens
- Phone shell layout: max-width 430px, max-height 932px

### Architecture
- White-label multi-municipality platform
- AuthProvider + MunicipalityContext wrap app
- ProtectedRoute guards authenticated routes
- Admin panel at /admin (admin role required)

### Database
- `municipalities`: name, state, slug, colors (HSL), rppg_url, secretaria, logo_url, codigo_ibge
- `user_roles`: app_role enum (admin, manager, user) + has_role() security definer
- `profiles`: has municipality_id FK, cpf
- Storage bucket: `municipality-logos` (public, admin-only upload)
- Boa Esperança seeded (id: b9347a47-..., codigo_ibge: 320100)

### Edge Functions
- `import-users`: bulk create users from array, assign municipality + role
- `cnes-proxy`: proxies CNES API (apidadosabertos.saude.gov.br) for health establishments

### CNES Integration
- API: https://apidadosabertos.saude.gov.br/cnes/estabelecimentos
- Uses codigo_ibge (6 digits) from municipalities table
- ServicesTab: real-time query, Leaflet map, geolocation, filters (SUS/UBS/hospital/farmacia)
- Distance calculation using Haversine formula

### Admin Panel (/admin)
- Tabs: Municípios (CRUD + logo + colors + codigo_ibge), Usuários (list, filter, link, CSV import)

### Key Files
- src/contexts/AuthContext.tsx, MunicipalityContext.tsx
- src/pages/Login.tsx, ResetPassword.tsx, Admin.tsx
- src/components/admin/AdminMunicipalities.tsx, AdminUsers.tsx
- src/components/mayla/ServicesTab.tsx - CNES + map integration
