

# Plan: Domain Adaptation — B2G (Municipal) → B2B (Corporate)

This is a large-scale refactoring. I recommend doing it incrementally across multiple steps. Here is the plan for **Step 1: Domain Adaptation** as requested.

---

## Scope of Changes

### 1. Database Migrations

Create new tables and rename/adapt existing ones. Since we can't rename tables in Supabase easily, the cleanest approach is to **create new tables** that mirror the corporate domain and **keep old tables temporarily** to avoid breaking anything.

**New table: `companies`** (replaces `municipalities`)
- Same structure: id, name, slug, logo_url, colors (primary/accent/bg/fg/secondary), plus corporate fields: `cnpj`, `industry`, `employee_count`, `plan_type`
- Remove: `state`, `codigo_ibge`, `secretaria`, `rppg_url`, `ubs_email`
- Add: `hr_contact_email`, `wellbeing_program_name`

**New table: `company_locations`** (replaces `health_units`)
- Same structure but rename semantics: company_id FK instead of municipality_id

**New table: `support_teams`** (replaces `esf_teams`)
- company_id FK, name, qr_code, etc.

**Adapt `profiles`:**
- Add `company_id` column (mirrors `municipality_id`)
- Add `support_team_id` (mirrors `esf_team_id`)
- Add `department`, `job_title`
- Rename `level` default from 'Cidadão' to 'Colaborador'

**Adapt `missions` tags:**
- New corporate tags (TAG_BURNOUT, TAG_MENTAL_HEALTH, TAG_EXERCISE, TAG_NR01, etc.)

**Adapt related tables** (`notifications`, `specialties`, `appointment_slots`, `appointments`, `special_measurements`, `municipality_features` → `company_features`):
- Add `company_id` columns mirroring `municipality_id`

### 2. Context Refactoring

**Rename `MunicipalityContext` → `CompanyContext`**
- `useMunicipality()` → `useCompany()`
- Reads from `companies` table instead of `municipalities`
- Same dynamic CSS variable injection

### 3. Component Text & Label Changes

All components referencing municipal terminology get updated:
- "Município" → "Empresa"
- "Cidadão" → "Colaborador"
- "ESF" → "Equipe de Apoio"
- "Secretaria de Saúde" → program name from company
- "UBS" → "Unidade" or "Local"
- "Vincule-se à sua ESF" → "Conecte-se à sua equipe"

**Files to update (28+ files):**
- `src/contexts/MunicipalityContext.tsx` → `src/contexts/CompanyContext.tsx`
- `src/lib/mayla-config.ts` — default labels
- `src/pages/Login.tsx` — signup company selector
- `src/pages/CityLanding.tsx` → `src/pages/CompanyLanding.tsx`
- `src/pages/MunicipalDashboard.tsx` → `src/pages/CompanyDashboard.tsx`
- `src/components/mayla/HomeTab.tsx` — labels, ESF card
- `src/components/mayla/ProfileTab.tsx` — ESF info → support team
- `src/components/mayla/MissionsTab.tsx` — tag labels
- `src/components/mayla/ServicesTab.tsx` — remove CNES/SUS, show company locations
- `src/components/mayla/EsfLinkScreen.tsx` → team linking
- `src/components/mayla/HealthSurvey.tsx` — adapt questions for corporate context
- `src/components/admin/AdminMunicipalities.tsx` → `AdminCompanies.tsx`
- `src/components/admin/AdminESF.tsx` → `AdminSupportTeams.tsx`
- `src/components/admin/AdminUsers.tsx` — terminology
- `src/components/admin/AdminDashboard.tsx` — metrics labels
- `src/components/admin/AdminNotifications.tsx` — company selector
- `src/components/admin/AdminSpecialties.tsx` — company selector
- `src/components/admin/AdminHealthUnits.tsx` → `AdminLocations.tsx`
- `src/components/admin/AdminAppointments.tsx` — terminology
- `src/App.tsx` — routes
- `src/pages/Admin.tsx` — tab labels
- Edge functions: `import-users`, `cnes-proxy` (adapt or deprecate)

### 4. Route Changes

| Old | New |
|---|---|
| `/cidade/:slug` | `/empresa/:slug` |
| `/painel/:slug` | `/painel/:slug` (keep) |
| `/login` | `/login` (keep) |

### 5. Edge Functions

- `import-users`: Change `municipality_id` → `company_id` in payload
- `cnes-proxy`: Keep but make optional (not core to B2B)

---

## Implementation Order

Given the size, I recommend splitting into **3 sub-steps**:

1. **Database**: Create `companies`, `company_locations`, `support_teams`, `company_features` tables + adapt `profiles` with new columns + RLS policies
2. **Context + Core**: Rename MunicipalityContext → CompanyContext, update App.tsx routes, Login.tsx
3. **Components**: Update all admin and citizen-facing components with new terminology and table references

---

## What We Keep As-Is
- Auth system (AuthContext, ProtectedRoute, user_roles, has_role)
- Gamification engine (missions, points, levels, triggers)
- Health measurements (health_measurements, special_measurements, Binah/rPPG)
- Appointment system (appointments, slots, specialties)
- Notification system
- Email infrastructure (PGMQ)
- UI component library (shadcn/ui)
- Design system (fonts, layout, phone shell)

Shall I proceed with implementation?

